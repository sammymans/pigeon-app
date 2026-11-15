import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { areBlocked, opaqueToken, pairKey, profileProjection, requireProfile, requireSameNamespace } from './model';
import { connectionDto } from './validators';

async function blockProfile(ctx: MutationCtx, actor: Doc<'profiles'>, target: Doc<'profiles'>) {
  requireSameNamespace(actor, target);
  if (actor._id === target._id) throw new ConvexError('You cannot block yourself.');
  const existing = await ctx.db.query('blocks').withIndex('by_blockerId_and_blockedId', (q) => q.eq('blockerId', actor._id).eq('blockedId', target._id)).unique();
  if (!existing) await ctx.db.insert('blocks', { blockerId: actor._id, blockedId: target._id, namespace: actor.namespace, createdAt: Date.now() });
  const connection = await ctx.db.query('connections').withIndex('by_pairKey', (q) => q.eq('pairKey', pairKey(actor._id, target._id))).unique();
  if (connection) await ctx.db.patch('connections', connection._id, { state: 'declined', updatedAt: Date.now() });
}

export const list = query({
  args: {}, returns: v.array(connectionDto),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const [outgoing, incoming] = await Promise.all([
      ctx.db.query('connections').withIndex('by_requesterId', (q) => q.eq('requesterId', profile._id)).order('desc').take(100),
      ctx.db.query('connections').withIndex('by_targetId', (q) => q.eq('targetId', profile._id)).order('desc').take(100),
    ]);
    const result = [];
    for (const connection of [...outgoing, ...incoming]) {
      const direction = connection.requesterId === profile._id ? 'outgoing' as const : 'incoming' as const;
      const otherId = direction === 'outgoing' ? connection.targetId : connection.requesterId;
      const other = await ctx.db.get('profiles', otherId);
      if (other && !(await areBlocked(ctx, profile._id, otherId))) result.push({ id: connection._id, profile: profileProjection(other), state: connection.state, direction });
    }
    return result;
  },
});

export const request = mutation({
  args: { flightId: v.string() }, returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const flightId = ctx.db.normalizeId('flights', args.flightId);
    const flight = flightId ? await ctx.db.get('flights', flightId) : null;
    if (!flight || flight.state !== 'intercepted' || flight.catcherId !== profile._id) throw new ConvexError('Only the successful catcher can request a connection.');
    const sender = await ctx.db.get('profiles', flight.senderId);
    if (!sender) throw new ConvexError('This profile is unavailable.');
    requireSameNamespace(profile, sender);
    if (await areBlocked(ctx, profile._id, sender._id)) throw new ConvexError('This connection is unavailable.');
    const prior = await ctx.db.query('connections').withIndex('by_flightId', (q) => q.eq('flightId', flight._id)).unique();
    if (prior) return { id: prior._id };
    const existing = await ctx.db.query('connections').withIndex('by_pairKey', (q) => q.eq('pairKey', pairKey(profile._id, sender._id))).unique();
    if (existing) throw new ConvexError(existing.state === 'declined' ? 'This connection request was declined. You cannot ask again.' : 'You already have a connection or pending request.');
    const id = await ctx.db.insert('connections', { pairKey: pairKey(profile._id, sender._id), requesterId: profile._id, targetId: sender._id, state: 'pending', flightId: flight._id, namespace: profile.namespace, createdAt: Date.now(), updatedAt: Date.now() });
    return { id };
  },
});

export const respond = mutation({
  args: { connectionId: v.string(), response: v.union(v.literal('accept'), v.literal('decline'), v.literal('block')) }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const id = ctx.db.normalizeId('connections', args.connectionId);
    const connection = id ? await ctx.db.get('connections', id) : null;
    if (!connection || connection.targetId !== profile._id) throw new ConvexError('This request is unavailable.');
    const requester = await ctx.db.get('profiles', connection.requesterId);
    if (!requester) throw new ConvexError('This request is unavailable.');
    if (args.response === 'block') {
      await blockProfile(ctx, profile, requester);
      return null;
    }
    if (await areBlocked(ctx, profile._id, requester._id)) throw new ConvexError('This connection is unavailable.');
    const state = args.response === 'accept' ? 'accepted' as const : 'declined' as const;
    if (connection.state === state) return null;
    if (connection.state !== 'pending') throw new ConvexError('This request has already been answered.');
    await ctx.db.patch('connections', connection._id, { state, updatedAt: Date.now() });
    return null;
  },
});

export const block = mutation({
  args: { profileId: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const id = ctx.db.normalizeId('profiles', args.profileId);
    const target = id ? await ctx.db.get('profiles', id) : null;
    if (!target) throw new ConvexError('This profile is unavailable.');
    await blockProfile(ctx, profile, target);
    return null;
  },
});

export const report = mutation({
  args: { profileId: v.optional(v.string()), flightId: v.optional(v.string()), reason: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const reporter = await requireProfile(ctx);
    const reason = args.reason.trim();
    if (!reason || reason.length > 1000 || (!args.profileId && !args.flightId)) throw new ConvexError('Choose something to report and give a reason of up to 1000 characters.');
    const profileId = args.profileId ? ctx.db.normalizeId('profiles', args.profileId) : null;
    const flightId = args.flightId ? ctx.db.normalizeId('flights', args.flightId) : null;
    if (args.profileId && (!profileId || !(await ctx.db.get('profiles', profileId)))) throw new ConvexError('This profile is unavailable.');
    if (args.flightId) {
      const flight = flightId ? await ctx.db.get('flights', flightId) : null;
      if (!flight || (flight.visibility === 'sealed' && flight.senderId !== reporter._id && flight.recipientId !== reporter._id)) throw new ConvexError('This flight is unavailable.');
    }
    await ctx.db.insert('reports', { reporterId: reporter._id, ...(profileId ? { profileId } : {}), ...(flightId ? { flightId } : {}), reason, namespace: reporter.namespace, createdAt: Date.now() });
    return null;
  },
});

export const createInvite = mutation({
  args: {}, returns: v.object({ token: v.string() }),
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const latest = await ctx.db.query('invites').withIndex('by_inviterId', (q) => q.eq('inviterId', profile._id)).order('desc').first();
    if (latest && !latest.acceptedBy && latest.expiresAt > Date.now()) return { token: latest.token };
    const token = opaqueToken();
    await ctx.db.insert('invites', { token, inviterId: profile._id, namespace: profile.namespace, createdAt: Date.now(), expiresAt: Date.now() + 7 * 24 * 3600_000 });
    return { token };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const invite = await ctx.db.query('invites').withIndex('by_token', (q) => q.eq('token', args.token)).unique();
    if (!invite || invite.expiresAt <= Date.now() || (invite.acceptedBy && invite.acceptedBy !== profile._id)) throw new ConvexError('This invite is expired or unavailable.');
    if (invite.inviterId === profile._id) throw new ConvexError('Share this invite with a friend.');
    const inviter = await ctx.db.get('profiles', invite.inviterId);
    if (!inviter) throw new ConvexError('This invite is unavailable.');
    requireSameNamespace(profile, inviter);
    if (await areBlocked(ctx, profile._id, inviter._id)) throw new ConvexError('This connection is unavailable.');
    const key = pairKey(profile._id, inviter._id);
    const connection = await ctx.db.query('connections').withIndex('by_pairKey', (q) => q.eq('pairKey', key)).unique();
    if (connection?.state === 'declined') throw new ConvexError('This connection was declined.');
    if (connection) await ctx.db.patch('connections', connection._id, { state: 'accepted', updatedAt: Date.now() });
    else await ctx.db.insert('connections', { pairKey: key, requesterId: inviter._id, targetId: profile._id, state: 'accepted', namespace: profile.namespace, createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.patch('invites', invite._id, { acceptedBy: profile._id });
    return null;
  },
});
