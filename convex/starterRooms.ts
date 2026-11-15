import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { CityId } from '../src/domain';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { launchFor } from './flightModel';
import { normalizeHandle, opaqueToken, optionalProfile, pairKey, profileProjection, requireProfile } from './model';
import { cityId, defense, profileDto } from './validators';

async function consentingUser(ctx: MutationCtx, acknowledged: boolean) {
  if (!acknowledged) throw new ConvexError('Agree to Open Skies: another room member can catch and read your letters. Joining connects you with the other members for timed letters.');
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get('users', userId) : null;
  if (!userId || !user?.isAnonymous) throw new ConvexError('Start a fresh anonymous session for this three-person demo.');
  return userId;
}

async function createProfile(ctx: MutationCtx, userId: Id<'users'>, input: { handle: string; cityId: CityId }, namespace: string) {
  const handle = normalizeHandle(input.handle);
  if (await ctx.db.query('profiles').withIndex('by_handle', q => q.eq('handle', handle)).unique()) throw new ConvexError('That handle is already taken.');
  return ctx.db.insert('profiles', { userId, handle, cityId: input.cityId, equipped: 'classic', demo: true, namespace });
}

export const create = mutation({
  args: { handle: v.string(), cityId, openAcknowledged: v.boolean() }, returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await consentingUser(ctx, args.openAcknowledged);
    const existing = await optionalProfile(ctx);
    if (existing) {
      const room = await ctx.db.query('starterRooms').withIndex('by_namespace', q => q.eq('namespace', existing.namespace)).unique();
      if (existing.demo && room?.ownerId === existing._id && room.members.includes(existing._id)) return null;
      throw new ConvexError('Existing profiles cannot move into a new room. Use a fresh anonymous session.');
    }
    const namespace = `demo:room-${userId}`;
    const ownerId = await createProfile(ctx, userId, args, namespace);
    const expiresAt = Date.now() + 30 * 60_000;
    const roomId = await ctx.db.insert('starterRooms', { ownerId, namespace, members: [ownerId], inviteToken: opaqueToken(), expiresAt, inviteOpen: true });
    await ctx.scheduler.runAt(expiresAt, internal.starterRooms.expireInvitation, { roomId });
    return null;
  },
});

export const join = mutation({
  args: { token: v.string(), handle: v.string(), cityId, openAcknowledged: v.boolean() }, returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await consentingUser(ctx, args.openAcknowledged);
    const room = await ctx.db.query('starterRooms').withIndex('by_inviteToken', q => q.eq('inviteToken', args.token)).unique();
    if (!room) throw new ConvexError('This invite is expired or unavailable.');
    const existing = await optionalProfile(ctx);
    if (existing) {
      if (existing.demo && existing.namespace === room.namespace && room.members.includes(existing._id)) return null;
      throw new ConvexError('Existing profiles cannot move into a room. Use a fresh anonymous session.');
    }
    const now = Date.now();
    if (!room.inviteOpen || room.expiresAt <= now || room.members.length >= 3) throw new ConvexError('This invite is expired or unavailable.');
    const members = await Promise.all(room.members.map(id => ctx.db.get('profiles', id)));
    if (members.some(member => !member?.demo || member.namespace !== room.namespace)) throw new ConvexError('This invite is unavailable.');
    const profileId = await createProfile(ctx, userId, args, room.namespace);
    for (const member of members) {
      await ctx.db.insert('connections', { pairKey: pairKey(member!._id, profileId), requesterId: member!._id, targetId: profileId, state: 'accepted', namespace: room.namespace, createdAt: now, updatedAt: now });
    }
    const ids = [...room.members, profileId];
    await ctx.db.patch('starterRooms', room._id, { members: ids, inviteOpen: ids.length < 3 });
    return null;
  },
});

export const status = query({
  args: {}, returns: v.union(v.null(), v.object({ roomId: v.string(), isOwner: v.boolean(), inviteToken: v.union(v.string(), v.null()), expiresAt: v.number(), capacity: v.literal(3), members: v.array(profileDto) })),
  handler: async (ctx) => {
    const profile = await optionalProfile(ctx);
    if (!profile?.demo) return null;
    const room = await ctx.db.query('starterRooms').withIndex('by_namespace', q => q.eq('namespace', profile.namespace)).unique();
    if (!room || !room.members.includes(profile._id)) return null;
    const members = await Promise.all(room.members.map(id => ctx.db.get('profiles', id)));
    return {
      roomId: room._id, isOwner: room.ownerId === profile._id,
      inviteToken: room.ownerId === profile._id && room.inviteOpen && room.members.length < 3 ? room.inviteToken : null,
      expiresAt: room.expiresAt, capacity: 3 as const,
      members: members.filter(member => member !== null).map(profileProjection),
    };
  },
});

export const launch = mutation({
  args: { recipientId: v.string(), body: v.string(), defense, requestKey: v.string(), openAcknowledged: v.boolean() }, returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const room = await ctx.db.query('starterRooms').withIndex('by_namespace', q => q.eq('namespace', profile.namespace)).unique();
    if (!profile.demo || !room?.members.includes(profile._id) || !room.members.some(id => id === args.recipientId)) throw new ConvexError('Choose a member of your three-person room.');
    return { id: await launchFor(ctx, profile, { ...args, visibility: 'open', demo: true }) };
  },
});

export const expireInvitation = internalMutation({
  args: { roomId: v.id('starterRooms') }, returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get('starterRooms', args.roomId);
    if (room?.inviteOpen && room.expiresAt <= Date.now()) await ctx.db.patch('starterRooms', room._id, { inviteOpen: false });
    return null;
  },
});
