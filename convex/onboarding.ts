import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { normalizeHandle, optionalProfile, requireProfile } from './model';

const starterNames = ['Mochi', 'Pip', 'Button', 'Noodle', 'Puddle'];

async function provisionFlock(ctx: MutationCtx, profile: Doc<'profiles'>) {
  const existing = await ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).collect();
  for (const [slot, name] of starterNames.entries()) {
    if (!existing.some(pigeon => pigeon.slot === slot)) await ctx.db.insert('pigeons', { ownerId: profile._id, name, slot });
  }
}

export const ensureFlock = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireProfile(ctx);
    await provisionFlock(ctx, profile);
    return { pigeons: (await completeStatus(ctx, profile)).pigeons };
  },
});

export const flock = query({
  args: {},
  handler: async ctx => {
    const profile = await requireProfile(ctx);
    const active = await ctx.db.query('flights').withIndex('by_senderId_and_state', q => q.eq('senderId', profile._id).eq('state', 'in_flight')).take(4);
    return { pigeons: (await completeStatus(ctx, profile)).pigeons.map(bird => {
      const flight = active.find(item => item.pigeonId === bird.id);
      return { ...bird, ...(flight ? { activeFlightId: flight._id } : {}) };
    }) };
  },
});

async function completeStatus(ctx: QueryCtx, profile: Doc<'profiles'>) {
  const pigeons = await ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).collect();
  return {
    status: 'complete' as const, accountId: profile.userId, username: profile.handle, displayName: profile.displayName,
    pigeons: pigeons.sort((a, b) => a.slot - b.slot).map(pigeon => ({ id: pigeon._id, name: pigeon.name })),
  };
}

export const status = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get('users', userId) : null;
    if (!user) return { status: 'signedOut' as const, pigeons: [] };
    const profile = await optionalProfile(ctx);
    if (profile) return completeStatus(ctx, profile);
    if (user.isAnonymous) return { status: 'signedOut' as const, pigeons: [] };
    return { status: 'profileRequired' as const, accountId: userId!, pigeons: [] };
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
  handler: completeOnboarding,
});

export async function completeOnboarding(ctx: MutationCtx, args: { username: string; displayName?: string }) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get('users', userId) : null;
  if (!userId || !user || user.isAnonymous) throw new ConvexError('Verify your phone before continuing.');
  const existing = await optionalProfile(ctx);
  if (existing?.demo) throw new ConvexError('Demo profiles cannot become live accounts.');
  if (existing) { await provisionFlock(ctx, existing); return completeStatus(ctx, existing); }
  if (!user.phone || user.phoneVerificationTime === undefined) throw new ConvexError('Verify your phone before continuing.');
  const handle = normalizeHandle(args.username);
  const displayName = args.displayName?.trim() || undefined;
  if (displayName && (Array.from(displayName).length > 50 || /[\u0000-\u001f\u007f]/.test(displayName))) throw new ConvexError('Use a name of at most 50 characters without control characters.');
  const taken = await ctx.db.query('profiles').withIndex('by_handle', q => q.eq('handle', handle)).unique();
  if (taken) throw new ConvexError('That username is already taken.');
  const id = await ctx.db.insert('profiles', { userId, handle, displayName, equipped: 'classic', demo: false, namespace: 'live', onboardingCompletedAt: Date.now() });
  const created = (await ctx.db.get('profiles', id))!;
  await provisionFlock(ctx, created);
  return completeStatus(ctx, created);
}
