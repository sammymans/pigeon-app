import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { changeSkyCount, launchFor } from './flightModel';
import { opaqueToken, pairKey, requireProfile } from './model';

async function requireDemo(ctx: MutationCtx) {
  const profile = await requireProfile(ctx);
  const group = await ctx.db.query('demoNamespaces').withIndex('by_namespace', (q) => q.eq('namespace', profile.namespace)).unique();
  if (!profile.demo || !profile.namespace.startsWith('demo:') || !group || !group.members.includes(profile._id)) throw new ConvexError('Demo controls are restricted to prepared demo accounts.');
  return group;
}

async function seedGroup(ctx: MutationCtx, group: Doc<'demoNamespaces'>) {
  if (group.seeded) return;
  const [sender, recipient, player] = await Promise.all(group.members.map((id) => ctx.db.get('profiles', id)));
  if (!sender || !recipient || !player) throw new ConvexError('The demo accounts are unavailable.');
  const pairs = group.selfServiceOwnerId ? [[sender, recipient], [sender, player]] : [[sender, recipient]];
  for (const [requester, target] of pairs) {
    const key = pairKey(requester._id, target._id);
    const connection = await ctx.db.query('connections').withIndex('by_pairKey', (q) => q.eq('pairKey', key)).unique();
    if (connection?.state === 'declined') throw new ConvexError('Reset this demo before preparing the friend pair.');
    if (!connection) await ctx.db.insert('connections', { pairKey: key, requesterId: requester._id, targetId: target._id, state: 'accepted', namespace: group.namespace, createdAt: Date.now(), updatedAt: Date.now() });
    else await ctx.db.patch('connections', connection._id, { state: 'accepted', updatedAt: Date.now() });
  }
  const selfService = Boolean(group.selfServiceOwnerId);
  await launchFor(ctx, sender, { recipientId: recipient._id, body: selfService ? 'Sample letter from Demo Pip: I crossed an ocean to ask if you ate lunch. These pen pals are fictional demo characters.' : 'I crossed an ocean to ask: did you eat lunch?', visibility: 'open', defense: 'cruise', openAcknowledged: true, demo: true, requestKey: 'demo-seed-open' });
  await launchFor(ctx, selfService ? sender : recipient, { recipientId: selfService ? player._id : sender._id, body: selfService ? 'Hello from Demo Pip, your sample pen pal! This sealed letter really waited for its server-timed arrival. Send me a pigeon back.' : 'A little sealed hello. This one was always just for you.', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, demo: true, requestKey: 'demo-seed-sealed' });
  await launchFor(ctx, selfService ? recipient : sender, { recipientId: selfService ? sender._id : recipient._id, body: selfService ? 'A sample letter from Demo Coo, a fictional pen pal. You can request a connection after catching, but this character cannot accept it for you.' : 'My pigeon took the scenic route. Blame the hat.', visibility: 'open', defense: 'zigzag', openAcknowledged: true, demo: true, requestKey: 'demo-seed-zigzag' });
  await ctx.db.patch('demoNamespaces', group._id, { seeded: true });
}

export const start = mutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get('users', userId) : null;
    if (!userId || !user?.isAnonymous) throw new ConvexError('Sign in with the anonymous demo provider first.');
    const existing = await ctx.db.query('profiles').withIndex('by_userId', (q) => q.eq('userId', userId)).unique();
    if (existing) {
      const group = await ctx.db.query('demoNamespaces').withIndex('by_namespace', (q) => q.eq('namespace', existing.namespace)).unique();
      if (!existing.demo || group?.selfServiceOwnerId !== userId || !group.members.includes(existing._id)) throw new ConvexError('Existing accounts cannot be converted into self-service demos.');
      return null;
    }
    const suffix = opaqueToken().slice(0, 16);
    const namespace = `demo:self-${userId}`;
    const playerId = await ctx.db.insert('profiles', { userId, handle: `demo_you_${suffix.slice(0, 15)}`, cityId: 'san-francisco', equipped: 'classic', demo: true, namespace });
    const members: Id<'profiles'>[] = [];
    for (const [name, cityId] of [['pip', 'san-francisco'], ['coo', 'london']] as const) {
      const fixtureUserId = await ctx.db.insert('users', { name: `Demo ${name === 'pip' ? 'Pip' : 'Coo'} — fictional sample pen pal` });
      members.push(await ctx.db.insert('profiles', { userId: fixtureUserId, handle: `demo_${name}_${suffix.slice(0, 15)}`, cityId, equipped: 'classic', demo: true, namespace }));
    }
    members.push(playerId);
    const groupId = await ctx.db.insert('demoNamespaces', { namespace, members, seeded: false, selfServiceOwnerId: userId });
    const group = await ctx.db.get('demoNamespaces', groupId);
    if (!group) throw new ConvexError('Could not prepare your demo.');
    await seedGroup(ctx, group);
    return null;
  },
});

export const provision = internalMutation({
  args: { namespace: v.string(), userIds: v.array(v.id('users')) }, returns: v.null(),
  handler: async (ctx, args) => {
    if (!/^[a-z0-9-]{3,48}$/.test(args.namespace) || args.userIds.length !== 3 || new Set(args.userIds).size !== 3) throw new ConvexError('Provide a namespace and exactly three different authenticated accounts.');
    const namespace = `demo:${args.namespace}`;
    const group = await ctx.db.query('demoNamespaces').withIndex('by_namespace', (q) => q.eq('namespace', namespace)).unique();
    const members: Id<'profiles'>[] = [];
    for (const userId of args.userIds) {
      const user = await ctx.db.get('users', userId);
      const profile = await ctx.db.query('profiles').withIndex('by_userId', (q) => q.eq('userId', userId)).unique();
      if (!user || !profile) throw new ConvexError('Sign up and choose a profile for all three accounts before provisioning.');
      if (profile.demo && profile.namespace !== namespace) throw new ConvexError('An account already belongs to another demo.');
      if (!profile.demo) {
        const [sent, received, outgoing, incoming] = await Promise.all([
          ctx.db.query('flights').withIndex('by_senderId_and_demo', (q) => q.eq('senderId', profile._id).eq('demo', false)).first(),
          ctx.db.query('flights').withIndex('by_recipientId_and_demo', (q) => q.eq('recipientId', profile._id).eq('demo', false)).first(),
          ctx.db.query('connections').withIndex('by_requesterId', (q) => q.eq('requesterId', profile._id)).first(),
          ctx.db.query('connections').withIndex('by_targetId', (q) => q.eq('targetId', profile._id)).first(),
        ]);
        if (sent || received || outgoing || incoming) throw new ConvexError('Provision fresh accounts, not existing live users.');
      }
      members.push(profile._id);
    }
    if (group && (group.members.length !== members.length || group.members.some((id, i) => id !== members[i]))) throw new ConvexError('This demo namespace already has different members.');
    for (const id of members) await ctx.db.patch('profiles', id, { demo: true, namespace });
    if (!group) await ctx.db.insert('demoNamespaces', { namespace, members, seeded: false });
    return null;
  },
});

export const seed = mutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const group = await requireDemo(ctx);
    await seedGroup(ctx, group);
    return null;
  },
});

export const reset = mutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const group = await requireDemo(ctx);
    const flights = await ctx.db.query('flights').withIndex('by_namespace_and_visibility_and_state', (q) => q.eq('namespace', group.namespace)).take(500);
    if (flights.length === 500) throw new ConvexError('This demo is too large for a single reset; ask the operator to archive it.');
    const activePublic = flights.filter((flight) => flight.state === 'in_flight' && flight.visibility === 'open').length;
    if (activePublic) await changeSkyCount(ctx, true, -activePublic, Date.now());
    for (const flight of flights) await ctx.db.delete('flights', flight._id);
    for (const table of ['messages', 'catchAttempts', 'connections', 'blocks', 'reports', 'invites'] as const) {
      const records = await ctx.db.query(table).withIndex('by_namespace', (q) => q.eq('namespace', group.namespace)).take(1000);
      if (records.length === 1000) throw new ConvexError('This demo is too large for a single reset; ask the operator to archive it.');
      for (const record of records) await ctx.db.delete(table, record._id);
    }
    for (const id of group.members) await ctx.db.patch('profiles', id, { catchCoolingDown: false, catchCooldownUntil: undefined });
    await ctx.db.patch('demoNamespaces', group._id, { seeded: false });
    return null;
  },
});
