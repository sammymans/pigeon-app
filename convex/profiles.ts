import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { normalizeHandle, optionalProfile, profileProjection, requireProfile } from './model';
import { cityId, profileDto } from './validators';

export const me = query({
  args: {}, returns: v.union(profileDto, v.null()),
  handler: async (ctx) => {
    const profile = await optionalProfile(ctx);
    return profile ? profileProjection(profile) : null;
  },
});

export const save = mutation({
  args: { handle: v.string(), cityId }, returns: profileDto,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get('users', userId) : null;
    if (!userId || !user) throw new ConvexError('Sign in first.');
    const handle = normalizeHandle(args.handle);
    const existing = await ctx.db.query('profiles').withIndex('by_userId', (q) => q.eq('userId', userId)).unique();
    if (user.isAnonymous && !existing) throw new ConvexError('Start your isolated demo before choosing a profile.');
    const taken = await ctx.db.query('profiles').withIndex('by_handle', (q) => q.eq('handle', handle)).unique();
    if (taken && taken._id !== existing?._id) throw new ConvexError('That handle is already taken.');
    if (existing) {
      await ctx.db.patch('profiles', existing._id, { handle, cityId: args.cityId });
      return profileProjection({ ...existing, handle, cityId: args.cityId });
    }
    const id = await ctx.db.insert('profiles', { userId, handle, cityId: args.cityId, equipped: 'classic', demo: false, namespace: 'live' });
    const created = await ctx.db.get('profiles', id);
    if (!created) throw new ConvexError('Could not create your profile.');
    return profileProjection(created);
  },
});

export const setCity = mutation({
  args: { cityId }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await ctx.db.patch('profiles', profile._id, { cityId: args.cityId });
    return null;
  },
});

export const clock = mutation({ args: {}, returns: v.number(), handler: async () => Date.now() });
