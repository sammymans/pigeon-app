import { ConvexError, v } from 'convex/values';
import type { QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireProfile } from './model';
import { accessoryValidator } from './commerceSchema';
import { approvedShopCatalog } from './shopCatalog';
import { sandboxConnection } from './whopProtocol';
import { orderDto } from './commerceData';
import type { ShopSnapshot } from '../src/shop';

export async function shopSnapshot(ctx: QueryCtx, profile: Doc<'profiles'>): Promise<ShopSnapshot> {
  const [pigeons, flights, wallet, accessories, disputed, reconciliation, pending] = await Promise.all([
    ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).collect(),
    ctx.db.query('flights').withIndex('by_senderId_and_state', q => q.eq('senderId', profile._id).eq('state', 'in_flight')).collect(),
    ctx.db.query('commerceWallets').withIndex('by_profileId', q => q.eq('profileId', profile._id)).unique(),
    ctx.db.query('commerceAccessories').withIndex('by_profileId', q => q.eq('profileId', profile._id)).collect(),
    ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', q => q.eq('profileId', profile._id).eq('status', 'disputed')).first(),
    ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', q => q.eq('profileId', profile._id).eq('status', 'reconciliation')).first(),
    ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', q => q.eq('profileId', profile._id).eq('status', 'pending')).first(),
  ]);
  const config = approvedShopCatalog();
  const held = (wallet?.balance ?? 0) < 0 || Boolean(disputed || reconciliation);
  const unassignedFlight = flights.some(flight => !('pigeonId' in flight) || !flight.pigeonId);
  const pendingOrder = disputed ?? reconciliation ?? pending;
  return {
    source: 'server', revision: String(wallet?.revision ?? 0), points: Math.max(0, wallet?.balance ?? 0), serverNow: Date.now(),
    ...(pendingOrder && pendingOrder.sku !== 'aviator' ? { pendingOrder: { ...orderDto(pendingOrder), sku: pendingOrder.sku } } : {}),
    birds: pigeons.sort((a, b) => a.slot - b.slot).map(bird => {
      const flying = unassignedFlight || flights.some(flight => 'pigeonId' in flight && flight.pigeonId === bird._id);
      return { id: bird._id, name: bird.name, appearance: bird.slot === 2 || bird.slot === 4 ? 'button' as const : 'mochi' as const, status: flying ? 'flying' as const : 'ready' as const, ...(flying ? { returnLabel: unassignedFlight ? 'Availability syncing' : 'In flight' } : {}) };
    }),
    inventory: accessories.map(item => ({ itemId: item.itemId, quantity: 1, ...(!held && item.wornBy ? { wornBy: item.wornBy } : {}) })),
    capabilities: {
      accessories: Boolean(config?.scarfApproved && !held), boosters: false, stones: false,
      checkout: Boolean(config?.packs.length && sandboxConnection() && !disputed && !reconciliation),
      reason: held ? 'Your wallet needs payment review. Spending and accessories are paused.' : 'Proposed prices and paid gameplay are disabled until approved sandbox catalog configuration. Configuration is not live verification.',
    },
  };
}

export const snapshot = query({ args: {}, handler: async ctx => shopSnapshot(ctx, await requireProfile(ctx)) });

export const mutate = mutation({
  args: { kind: v.union(v.literal('buy-accessory'), v.literal('equip')), itemId: accessoryValidator, birdId: v.id('pigeons'), expectedWearer: v.optional(v.id('pigeons')), requestKey: v.string(), revision: v.string() },
  handler: async (ctx, args): Promise<ShopSnapshot> => {
    const profile = await requireProfile(ctx);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(args.requestKey)) throw new ConvexError({ code: 'rejected', message: 'Use a unique request key.' });
    const { requestKey, revision, ...command } = args;
    const payload = JSON.stringify(command);
    const key = `command:${requestKey}`;
    const previous = await ctx.db.query('commerceLedger').withIndex('by_profileId_and_key', q => q.eq('profileId', profile._id).eq('key', key)).unique();
    if (previous) {
      if (previous.payload !== payload) throw new ConvexError({ code: 'rejected', message: 'This request key belongs to a different action.' });
      return shopSnapshot(ctx, profile);
    }
    const state = await shopSnapshot(ctx, profile);
    if (!state.capabilities.accessories) throw new ConvexError({ code: 'unavailable', message: state.capabilities.reason! });
    if (state.revision !== revision) throw new ConvexError({ code: 'stale', message: 'Your coop changed. Refresh and confirm again.' });
    const bird = await ctx.db.get('pigeons', args.birdId);
    if (!bird || bird.ownerId !== profile._id) throw new ConvexError({ code: 'rejected', message: 'That pigeon is not in your coop.' });
    if (state.birds.find(b => b.id === bird._id)?.status !== 'ready') throw new ConvexError({ code: 'rejected', message: 'Wait until this pigeon is home to change accessories.' });
    const owned = await ctx.db.query('commerceAccessories').withIndex('by_profileId_and_itemId', q => q.eq('profileId', profile._id).eq('itemId', args.itemId)).unique();
    let delta = 0;
    if (args.kind === 'buy-accessory') {
      if (owned) throw new ConvexError({ code: 'rejected', message: 'You already own this accessory. Move it without buying again.' });
      if (args.itemId !== 'cloud-scarf') throw new ConvexError({ code: 'unavailable', message: 'No approved price exists for this item.' });
      if ((state.points ?? 0) < 60) throw new ConvexError({ code: 'insufficient', message: 'Not enough points. Top up, then confirm this item again.' });
      delta = -60;
      await ctx.db.insert('commerceAccessories', { profileId: profile._id, itemId: args.itemId, wornBy: bird._id, acquiredAt: Date.now() });
    } else {
      if (!owned) throw new ConvexError({ code: 'rejected', message: 'You do not own this accessory.' });
      if (owned.wornBy !== args.expectedWearer) throw new ConvexError({ code: 'stale', message: 'This accessory moved. Refresh and confirm again.' });
      if (owned.wornBy && state.birds.find(b => b.id === owned.wornBy)?.status !== 'ready') throw new ConvexError({ code: 'rejected', message: 'Wait until the current wearer is home.' });
      await ctx.db.patch('commerceAccessories', owned._id, { wornBy: bird._id });
    }
    const wallet = await ctx.db.query('commerceWallets').withIndex('by_profileId', q => q.eq('profileId', profile._id)).unique();
    if (wallet) await ctx.db.patch('commerceWallets', wallet._id, { balance: wallet.balance + delta, revision: wallet.revision + 1 });
    else await ctx.db.insert('commerceWallets', { profileId: profile._id, balance: delta, revision: 1 });
    await ctx.db.insert('commerceLedger', { profileId: profile._id, key, payload, delta, kind: args.kind === 'equip' ? 'equip' : 'spend', createdAt: Date.now() });
    return shopSnapshot(ctx, profile);
  },
});
