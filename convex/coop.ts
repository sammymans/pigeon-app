import { ConvexError, v } from 'convex/values';
import { applyShopAction } from '../src/shop';
import { mutation, query } from './_generated/server';
import { requireProfile } from './model';
import { readCoop, saveCoop } from './coopModel';
import { shopAction, shopState } from './coopSchema';

export const mine = query({
  args: {}, returns: shopState,
  handler: async ctx => readCoop(ctx, await requireProfile(ctx), Date.now()),
});

export const transact = mutation({
  args: { action: shopAction, requestKey: v.string() }, returns: v.null(),
  handler: async (ctx, { action, requestKey }) => {
    const profile = await requireProfile(ctx);
    if (!requestKey.trim() || requestKey.length > 128) throw new ConvexError('A valid shop request key is required.');
    const previous = await ctx.db.query('coopReceipts').withIndex('by_ownerId_and_requestKey', q => q.eq('ownerId', profile._id).eq('requestKey', requestKey)).unique();
    if (previous) {
      // Convex normalizes object field order; compare explicit sorted keys as well.
      const canonical = (value: object) => JSON.stringify(value, Object.keys(value).sort());
      if (canonical(previous.action) !== canonical(action)) throw new ConvexError('This request belongs to another purchase.');
      return null;
    }
    const birds = await ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).collect();
    const now = Date.now();
    const state = await readCoop(ctx, profile, now);
    try { await saveCoop(ctx, profile, applyShopAction(state, action, birds.map(bird => ({ id: bird._id, name: bird.name })), now)); }
    catch (error) { if (error instanceof Error) throw new ConvexError(error.message); throw error; }
    await ctx.db.insert('coopReceipts', { ownerId: profile._id, requestKey, action });
    return null;
  },
});
