import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { CityId } from '../src/domain';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { normalizeHandle, opaqueToken, optionalProfile, pairKey, profileProjection } from './model';
import { cityId, profileDto } from './validators';

async function anonymousUser(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get('users', userId) : null;
  if (!userId || !user?.isAnonymous) throw new ConvexError('Sign in with the anonymous demo provider first.');
  return userId;
}

async function createProfile(ctx: MutationCtx, userId: Id<'users'>, input: { handle: string; cityId: CityId }, namespace: string) {
  const handle = normalizeHandle(input.handle);
  const taken = await ctx.db.query('profiles').withIndex('by_handle', (q) => q.eq('handle', handle)).unique();
  if (taken) throw new ConvexError('That handle is already taken.');
  return await ctx.db.insert('profiles', { userId, handle, cityId: input.cityId, equipped: 'classic', demo: true, namespace });
}

export const create = mutation({
  args: { handle: v.string(), cityId }, returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await anonymousUser(ctx);
    const existing = await optionalProfile(ctx);
    if (existing) {
      const room = await ctx.db.query('starterPairs').withIndex('by_ownerId', (q) => q.eq('ownerId', existing._id)).unique();
      if (!room || !existing.demo || existing.namespace !== room.namespace) throw new ConvexError('Existing accounts cannot be converted into paired demos.');
      return null;
    }
    const namespace = `demo:pair-${userId}`;
    const ownerId = await createProfile(ctx, userId, args, namespace);
    const expiresAt = Date.now() + 30 * 60_000;
    const roomId = await ctx.db.insert('starterPairs', { ownerId, namespace, inviteToken: opaqueToken(), expiresAt, inviteOpen: true });
    await ctx.scheduler.runAt(expiresAt, internal.starterPair.expireInvitation, { roomId });
    return null;
  },
});

export const join = mutation({
  args: { token: v.string(), handle: v.string(), cityId }, returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await anonymousUser(ctx);
    const room = await ctx.db.query('starterPairs').withIndex('by_inviteToken', (q) => q.eq('inviteToken', args.token)).unique();
    if (!room) throw new ConvexError('This invite is expired or unavailable.');
    const existing = await optionalProfile(ctx);
    if (existing) {
      if (room.partnerId === existing._id && existing.demo && existing.namespace === room.namespace) return null;
      throw new ConvexError('Existing accounts cannot be converted into paired demos.');
    }
    const now = Date.now();
    if (!room.inviteOpen || room.partnerId || room.expiresAt <= now) throw new ConvexError('This invite is expired or unavailable.');
    const owner = await ctx.db.get('profiles', room.ownerId);
    if (!owner?.demo || owner.namespace !== room.namespace) throw new ConvexError('This invite is expired or unavailable.');
    const partnerId = await createProfile(ctx, userId, args, room.namespace);
    await ctx.db.insert('connections', { pairKey: pairKey(owner._id, partnerId), requesterId: owner._id, targetId: partnerId, state: 'accepted', namespace: room.namespace, createdAt: now, updatedAt: now });
    await ctx.db.patch('starterPairs', room._id, { partnerId, inviteOpen: false });
    return null;
  },
});

export const status = query({
  args: {}, returns: v.union(v.object({ inviteToken: v.union(v.string(), v.null()), expiresAt: v.union(v.number(), v.null()), partner: v.union(profileDto, v.null()) }), v.null()),
  handler: async (ctx) => {
    const profile = await optionalProfile(ctx);
    if (!profile?.demo) return null;
    const owned = await ctx.db.query('starterPairs').withIndex('by_ownerId', (q) => q.eq('ownerId', profile._id)).unique();
    const room = owned ?? await ctx.db.query('starterPairs').withIndex('by_partnerId', (q) => q.eq('partnerId', profile._id)).unique();
    if (!room || room.namespace !== profile.namespace) return null;
    const otherId = owned ? room.partnerId : room.ownerId;
    const other = otherId ? await ctx.db.get('profiles', otherId) : null;
    return {
      inviteToken: owned && room.inviteOpen && !room.partnerId ? room.inviteToken : null,
      expiresAt: owned && !room.partnerId ? room.expiresAt : null,
      partner: other ? profileProjection(other) : null,
    };
  },
});

export const expireInvitation = internalMutation({
  args: { roomId: v.id('starterPairs') }, returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get('starterPairs', args.roomId);
    if (room?.inviteOpen && room.expiresAt <= Date.now()) await ctx.db.patch('starterPairs', room._id, { inviteOpen: false });
    return null;
  },
});
