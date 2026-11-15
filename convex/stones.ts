import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server';
import { requireProfile } from './model';

export const REFILL_MS = 20 * 60_000;
export const pouchDto = v.object({ count: v.number(), capacity: v.literal(12), nextRefillAt: v.union(v.number(), v.null()) });

export async function syncPouch(ctx: MutationCtx, profileId: Id<'profiles'>, now: number) {
  let pouch = await ctx.db.query('stonePouches').withIndex('by_profileId', q => q.eq('profileId', profileId)).unique();
  if (!pouch) {
    const id = await ctx.db.insert('stonePouches', { profileId, count: 6 });
    return (await ctx.db.get('stonePouches', id))!;
  }
  if (pouch.count < 3 && pouch.nextRefillAt !== undefined && pouch.nextRefillAt <= now) {
    const count = Math.min(3, pouch.count + 1 + Math.floor((now - pouch.nextRefillAt) / REFILL_MS));
    const nextRefillAt = count < 3 ? pouch.nextRefillAt + (count - pouch.count) * REFILL_MS : undefined;
    await ctx.db.patch('stonePouches', pouch._id, { count, nextRefillAt });
    if (nextRefillAt !== undefined) await ctx.scheduler.runAt(nextRefillAt, internal.stones.refill, { profileId });
    pouch = { ...pouch, count, nextRefillAt };
  }
  return pouch;
}

export async function changePouch(ctx: MutationCtx, profileId: Id<'profiles'>, delta: number, now: number) {
  const pouch = await syncPouch(ctx, profileId, now);
  const count = Math.min(12, Math.max(0, pouch.count + delta));
  const nextRefillAt = count < 3 ? pouch.nextRefillAt ?? now + REFILL_MS : undefined;
  await ctx.db.patch('stonePouches', pouch._id, { count, nextRefillAt });
  if (nextRefillAt !== undefined && nextRefillAt !== pouch.nextRefillAt) await ctx.scheduler.runAt(nextRefillAt, internal.stones.refill, { profileId });
  return { count, capacity: 12 as const, nextRefillAt: nextRefillAt ?? null };
}

export const sync = mutation({ args: {}, returns: pouchDto, handler: async ctx => {
  const profile = await requireProfile(ctx);
  const pouch = await syncPouch(ctx, profile._id, Date.now());
  return { count: pouch.count, capacity: 12 as const, nextRefillAt: pouch.nextRefillAt ?? null };
} });

export const status = query({ args: {}, returns: pouchDto, handler: async ctx => {
  const profile = await requireProfile(ctx);
  const pouch = await ctx.db.query('stonePouches').withIndex('by_profileId', q => q.eq('profileId', profile._id)).unique();
  return { count: pouch?.count ?? 6, capacity: 12 as const, nextRefillAt: pouch?.nextRefillAt ?? null };
} });

export const refill = internalMutation({ args: { profileId: v.id('profiles') }, returns: v.null(), handler: async (ctx, { profileId }) => {
  await syncPouch(ctx, profileId, Date.now());
  return null;
} });
