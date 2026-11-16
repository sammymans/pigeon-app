import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { normalizeHandle, optionalProfile } from './model';

const starterNames = ['Mochi', 'Pip', 'Button', 'Noodle', 'Puddle'];

async function completeStatus(ctx: QueryCtx, profile: Doc<'profiles'>) {
  const pigeons = await ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).collect();
  return {
    status: 'complete' as const, username: profile.handle, displayName: profile.displayName,
    pigeons: pigeons.sort((a, b) => a.slot - b.slot).map(pigeon => ({ id: pigeon._id, name: pigeon.name })),
  };
}

export const status = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get('users', userId) : null;
    if (!user || user.isAnonymous) return { status: 'signedOut' as const, pigeons: [] };
    const profile = await optionalProfile(ctx);
    if (profile && !profile.demo) return completeStatus(ctx, profile);
    return { status: 'profileRequired' as const, pigeons: [] };
  },
});

export const usernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get('users', userId) : null;
    if (!user || user.isAnonymous) throw new ConvexError('Sign in first.');
    const username = normalizeHandle(args.username);
    const existing = await ctx.db.query('profiles').withIndex('by_handle', q => q.eq('handle', username)).unique();
    return { username, available: !existing || existing.userId === userId };
  },
});

export const complete = mutation({
  args: { username: v.string(), displayName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get('users', userId) : null;
    if (!userId || !user || user.isAnonymous) throw new ConvexError('Verify your phone before continuing.');
    const existing = await optionalProfile(ctx);
    if (existing?.demo) throw new ConvexError('Demo profiles cannot become live accounts.');
    if (existing) return completeStatus(ctx, existing);
    if (!user.phone || user.phoneVerificationTime === undefined) throw new ConvexError('Verify your phone before continuing.');
    const handle = normalizeHandle(args.username);
    const displayName = args.displayName?.trim() || undefined;
    if (displayName && (Array.from(displayName).length > 50 || /[\u0000-\u001f\u007f]/.test(displayName))) throw new ConvexError('Use a name of at most 50 characters without control characters.');
    const taken = await ctx.db.query('profiles').withIndex('by_handle', q => q.eq('handle', handle)).unique();
    if (taken) throw new ConvexError('That username is already taken.');
    const id = await ctx.db.insert('profiles', { userId, handle, displayName, equipped: 'classic', demo: false, namespace: 'live', onboardingCompletedAt: Date.now() });
    for (const [slot, name] of starterNames.entries()) await ctx.db.insert('pigeons', { ownerId: id, name, slot });
    return completeStatus(ctx, (await ctx.db.get('profiles', id))!);
  },
});
