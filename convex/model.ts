import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

export async function optionalProfile(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.query('profiles').withIndex('by_userId', (q) => q.eq('userId', userId)).unique() : null;
}

export async function requireProfile(ctx: QueryCtx) {
  const profile = await optionalProfile(ctx);
  if (!profile) throw new ConvexError('Sign in and choose a handle first.');
  return profile;
}

export function profileProjection(profile: Doc<'profiles'>) {
  return { id: profile._id, handle: profile.handle, cityId: profile.cityId, equipped: profile.equipped, demo: profile.demo };
}

export function normalizeHandle(value: string) {
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) throw new ConvexError('Use 3–24 lowercase letters, numbers, or underscores.');
  return handle;
}

export function pairKey(a: Id<'profiles'>, b: Id<'profiles'>) {
  return [a, b].sort().join(':');
}

export async function areBlocked(ctx: QueryCtx, a: Id<'profiles'>, b: Id<'profiles'>) {
  const [outgoing, incoming] = await Promise.all([
    ctx.db.query('blocks').withIndex('by_blockerId_and_blockedId', (q) => q.eq('blockerId', a).eq('blockedId', b)).unique(),
    ctx.db.query('blocks').withIndex('by_blockerId_and_blockedId', (q) => q.eq('blockerId', b).eq('blockedId', a)).unique(),
  ]);
  return Boolean(outgoing || incoming);
}

export function opaqueToken() {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')).join('');
}

export function requireSameNamespace(a: Doc<'profiles'>, b: Doc<'profiles'>) {
  if (a.namespace !== b.namespace || a.demo !== b.demo) throw new ConvexError('Demo accounts stay in their isolated demo sky.');
}
