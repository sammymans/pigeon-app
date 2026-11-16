import { initialShop, refillStones, type ShopState } from '../src/shop';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

export async function readCoop(ctx: QueryCtx, profile: Doc<'profiles'>, now: number) {
  const wallet = await ctx.db.query('coopWallets').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).unique();
  if (wallet) return refillStones(wallet.state, now);
  const birds = await ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).collect();
  return initialShop(now, birds.filter(bird => !bird.commerceRevoked).sort((a, b) => a.slot - b.slot)[0]?._id);
}

export async function saveCoop(ctx: MutationCtx, profile: Doc<'profiles'>, state: ShopState) {
  const wallet = await ctx.db.query('coopWallets').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).unique();
  if (wallet) await ctx.db.patch('coopWallets', wallet._id, { state });
  else await ctx.db.insert('coopWallets', { ownerId: profile._id, state });
}
