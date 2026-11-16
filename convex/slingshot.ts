import { ConvexError, v } from 'convex/values';
import { FLIGHT_MS, GAME_VERSION, PLAY_MS, traceShot } from '../starter/game/trajectory';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { changeSkyCount, finishAttempt, settleFlight } from './flightModel';
import { areBlocked, requireProfile } from './model';
import { encounterState, point } from './slingshotSchema';
import { changePouch, pouchDto, syncPouch } from './stones';

const encounterDto = v.object({
  id: v.string(), version: v.literal('slingshot-v1'), flightId: v.string(), preparedAt: v.number(), readyUntil: v.number(), seed: v.number(),
  armedAt: v.union(v.number(), v.null()), fireUntil: v.union(v.number(), v.null()), finishBy: v.union(v.number(), v.null()),
  shotLimit: v.number(), state: encounterState, endedAt: v.union(v.number(), v.null()),
  shots: v.array(v.object({ key: v.string(), releasedAt: v.number(), direction: point, endsAt: v.number(), outcome: v.union(v.literal('flying'), v.literal('missed'), v.literal('caught')) })),
});
const responseDto = v.object({ encounter: v.union(encounterDto, v.null()), pouch: pouchDto, serverTime: v.number() });
const terminal = (state: string) => !['ready', 'active', 'projectile'].includes(state);

async function response(ctx: QueryCtx, profileId: Id<'profiles'>, encounter: Doc<'slingshotEncounters'> | null, now: number) {
  const pouch = await ctx.db.query('stonePouches').withIndex('by_profileId', q => q.eq('profileId', profileId)).unique();
  return { serverTime: now, pouch: { count: pouch?.count ?? 6, capacity: 12 as const, nextRefillAt: pouch?.nextRefillAt ?? null }, encounter: encounter ? {
    id: encounter._id, version: encounter.version, flightId: encounter.flightId, preparedAt: encounter.preparedAt, readyUntil: encounter.readyUntil, seed: encounter.seed,
    armedAt: encounter.armedAt ?? null, fireUntil: encounter.fireUntil ?? null, finishBy: encounter.finishBy ?? null,
    shotLimit: encounter.shotLimit, state: encounter.state, endedAt: encounter.endedAt ?? null,
    shots: encounter.shots.map(shot => ({ key: shot.key, releasedAt: shot.releasedAt, direction: shot.direction, endsAt: shot.endsAt, outcome: !shot.resolved ? 'flying' as const : shot.hit ? 'caught' as const : 'missed' as const })),
  } : null };
}

async function finish(ctx: MutationCtx, encounter: Doc<'slingshotEncounters'>, state: 'caught' | 'escaped' | 'expired' | 'delivered' | 'abandoned', now: number) {
  if (terminal(encounter.state)) return encounter;
  const flight = await ctx.db.get('flights', encounter.flightId);
  await ctx.db.patch('slingshotEncounters', encounter._id, { state, endedAt: now });
  if (flight?.activeEncounterId === encounter._id) {
    await ctx.db.patch('flights', flight._id, { activeEncounterId: undefined, updatedAt: now,
      ...(state === 'caught' ? { state: 'intercepted' as const, catcherId: encounter.catcherId, catchOpen: false } : {}),
      events: [...flight.events, { at: now, label: state === 'caught' ? 'Intercepted' : state === 'abandoned' ? 'Slingshot attempt ended' : 'Outflew a slingshot attempt' }],
    });
    if (state === 'caught') await changeSkyCount(ctx, flight.demo, -1, now);
  }
  return { ...encounter, state, endedAt: now };
}

async function settle(ctx: MutationCtx, encounter: Doc<'slingshotEncounters'>, now: number) {
  if (terminal(encounter.state)) return encounter;
  const stored = await ctx.db.get('flights', encounter.flightId);
  if (!stored) return finish(ctx, encounter, 'expired', now);
  const flight = await settleFlight(ctx, stored, now);
  if (flight.state === 'delivered') return finish(ctx, encounter, 'delivered', now);
  if (flight.state !== 'in_flight' || flight.activeEncounterId !== encounter._id) return finish(ctx, encounter, 'expired', now);
  const index = encounter.shots.findIndex(shot => !shot.resolved);
  if (index >= 0) {
    const shot = encounter.shots[index];
    if (shot.endsAt > now) return encounter;
    const blocked = await areBlocked(ctx, encounter.catcherId, flight.senderId) || await areBlocked(ctx, encounter.catcherId, flight.recipientId);
    const shots = encounter.shots.map((value, i) => i === index ? { ...value, resolved: true, hit: value.hit && !blocked } : value);
    await ctx.db.patch('slingshotEncounters', encounter._id, { shots });
    encounter = { ...encounter, shots };
    if (shot.hit && !blocked) return finish(ctx, encounter, 'caught', now);
    if (shots.length >= encounter.shotLimit || now >= encounter.fireUntil!) return finish(ctx, encounter, 'escaped', now);
    await ctx.db.patch('slingshotEncounters', encounter._id, { state: 'active' });
    return { ...encounter, state: 'active' as const };
  }
  if (now >= (encounter.fireUntil ?? encounter.readyUntil)) return finish(ctx, encounter, encounter.armedAt === undefined ? 'expired' : 'escaped', now);
  return encounter;
}

async function owned(ctx: MutationCtx, id: string) {
  const profile = await requireProfile(ctx);
  const encounterId = ctx.db.normalizeId('slingshotEncounters', id);
  const stored = encounterId ? await ctx.db.get('slingshotEncounters', encounterId) : null;
  if (!stored || stored.catcherId !== profile._id) throw new ConvexError('This encounter is unavailable.');
  const now = Date.now();
  const encounter = await settle(ctx, stored, now);
  await syncPouch(ctx, profile._id, now);
  return { profile, encounter, now };
}

export const state = query({ args: { flightId: v.string() }, returns: responseDto, handler: async (ctx, { flightId }) => {
  const profile = await requireProfile(ctx);
  const id = ctx.db.normalizeId('flights', flightId);
  const encounter = id ? await ctx.db.query('slingshotEncounters').withIndex('by_flightId_and_catcherId', q => q.eq('flightId', id).eq('catcherId', profile._id)).unique() : null;
  return response(ctx, profile._id, encounter, encounter?.endedAt ?? encounter?.preparedAt ?? 0);
} });

export const sync = mutation({ args: { flightId: v.string() }, returns: responseDto, handler: async (ctx, { flightId }) => {
  const profile = await requireProfile(ctx);
  const now = Date.now();
  await syncPouch(ctx, profile._id, now);
  const id = ctx.db.normalizeId('flights', flightId);
  const stored = id ? await ctx.db.query('slingshotEncounters').withIndex('by_flightId_and_catcherId', q => q.eq('flightId', id).eq('catcherId', profile._id)).unique() : null;
  return response(ctx, profile._id, stored ? await settle(ctx, stored, now) : null, now);
} });

export const prepare = mutation({ args: { flightId: v.string() }, returns: responseDto, handler: async (ctx, { flightId }) => {
  const profile = await requireProfile(ctx);
  const now = Date.now();
  const id = ctx.db.normalizeId('flights', flightId);
  let flight = id ? await ctx.db.get('flights', id) : null;
  if (!flight || flight.visibility !== 'open' || flight.namespace !== profile.namespace || flight.senderId === profile._id || flight.recipientId === profile._id) throw new ConvexError('This pigeon cannot be intercepted.');
  if ('tripId' in flight || 'tripLeg' in flight) throw new ConvexError('This courier journey is not available for interception yet.');
  const prior = await ctx.db.query('slingshotEncounters').withIndex('by_flightId_and_catcherId', q => q.eq('flightId', flight!._id).eq('catcherId', profile._id)).unique();
  if (prior) return response(ctx, profile._id, await settle(ctx, prior, now), now);
  flight = await settleFlight(ctx, flight, now);
  if (flight.state !== 'in_flight' || await areBlocked(ctx, profile._id, flight.senderId) || await areBlocked(ctx, profile._id, flight.recipientId)) throw new ConvexError('This pigeon cannot be intercepted.');
  if (await ctx.db.query('catchAttempts').withIndex('by_flightId_and_catcherId', q => q.eq('flightId', flight!._id).eq('catcherId', profile._id)).unique()) throw new ConvexError('You already attempted this pigeon.');
  if (flight.activeAttemptId) {
    const legacy = await ctx.db.get('catchAttempts', flight.activeAttemptId);
    if (legacy && !legacy.outcome && legacy.expiresAt > now) throw new ConvexError('Another interception is in progress.');
    if (legacy && !legacy.outcome) {
      await finishAttempt(ctx, flight, legacy, 'expired', [false, false, false], now);
      flight = (await ctx.db.get('flights', flight._id))!;
    }
  }
  if (flight.activeEncounterId) {
    const existing = await ctx.db.get('slingshotEncounters', flight.activeEncounterId);
    if (existing && !terminal((await settle(ctx, existing, now)).state)) throw new ConvexError('Another interception is in progress.');
    flight = (await ctx.db.get('flights', flight._id))!;
    if (flight.state !== 'in_flight') throw new ConvexError('This pigeon has already finished its flight.');
  }
  const pouch = await syncPouch(ctx, profile._id, now);
  if (pouch.count === 0) return response(ctx, profile._id, null, now);
  const readyUntil = Math.min(now + 30_000, flight.arrivesAt);
  const encounterId = await ctx.db.insert('slingshotEncounters', { version: GAME_VERSION, flightId: flight._id, catcherId: profile._id, namespace: profile.namespace, preparedAt: now, readyUntil, seed: Math.random() * Math.PI * 2, shotLimit: Math.min(2, pouch.count), shots: [], state: 'ready' });
  await ctx.db.patch('flights', flight._id, { activeEncounterId: encounterId, attemptCount: flight.attemptCount + 1, updatedAt: now, events: [...flight.events, { at: now, label: 'Slingshot encounter started' }] });
  await ctx.scheduler.runAt(readyUntil, internal.slingshot.tick, { encounterId });
  return response(ctx, profile._id, await ctx.db.get('slingshotEncounters', encounterId), now);
} });

export const arm = mutation({ args: { encounterId: v.string(), armedElapsedMs: v.number() }, returns: responseDto, handler: async (ctx, args) => {
  const { profile, encounter, now } = await owned(ctx, args.encounterId);
  if (terminal(encounter.state) || encounter.armedAt !== undefined) return response(ctx, profile._id, encounter, now);
  const armedAt = encounter.preparedAt + args.armedElapsedMs;
  if (!Number.isFinite(armedAt) || armedAt < encounter.preparedAt || armedAt > now + 100 || now - armedAt > 350 || armedAt >= encounter.readyUntil) throw new ConvexError('Aim timing is out of sync. Refresh this encounter.');
  const flight = (await ctx.db.get('flights', encounter.flightId))!;
  const fireUntil = Math.min(armedAt + PLAY_MS, flight.arrivesAt);
  const finishBy = Math.min(fireUntil + FLIGHT_MS, flight.arrivesAt);
  const patch = { state: 'active' as const, armedAt, fireUntil, finishBy };
  await ctx.db.patch('slingshotEncounters', encounter._id, patch);
  await ctx.scheduler.runAt(fireUntil, internal.slingshot.tick, { encounterId: encounter._id });
  await ctx.scheduler.runAt(finishBy, internal.slingshot.tick, { encounterId: encounter._id });
  return response(ctx, profile._id, { ...encounter, ...patch }, now);
} });

export const fire = mutation({ args: { encounterId: v.string(), shotKey: v.string(), releaseElapsedMs: v.number(), direction: point }, returns: responseDto, handler: async (ctx, args) => {
  const { profile, encounter, now } = await owned(ctx, args.encounterId);
  const duplicate = encounter.shots.find(shot => shot.key === args.shotKey);
  if (duplicate) {
    if (duplicate.direction.x !== args.direction.x || duplicate.direction.y !== args.direction.y || duplicate.releasedAt !== encounter.preparedAt + args.releaseElapsedMs) throw new ConvexError('This release key belongs to another shot.');
    return response(ctx, profile._id, encounter, now);
  }
  if (encounter.state !== 'active' || encounter.armedAt === undefined || now >= encounter.fireUntil! || encounter.shots.length >= encounter.shotLimit) throw new ConvexError('This encounter cannot fire another stone.');
  const releasedAt = encounter.preparedAt + args.releaseElapsedMs;
  const magnitude = Math.hypot(args.direction.x, args.direction.y);
  if (!args.shotKey || args.shotKey.length > 100 || !Number.isFinite(magnitude) || Math.abs(magnitude - 1) > 0.000001 || !Number.isFinite(releasedAt) || releasedAt < encounter.armedAt || releasedAt >= encounter.fireUntil! || releasedAt > now + 100 || now - releasedAt > 350) throw new ConvexError('This release is invalid or out of sync.');
  const flight = (await ctx.db.get('flights', encounter.flightId))!;
  if (await areBlocked(ctx, profile._id, flight.senderId) || await areBlocked(ctx, profile._id, flight.recipientId)) throw new ConvexError('This pigeon cannot be intercepted.');
  const pouch = await syncPouch(ctx, profile._id, now);
  if (pouch.count < 1) throw new ConvexError('Your pouch is empty.');
  const trajectory = traceShot(args.releaseElapsedMs, args.direction, encounter.seed);
  const shots = [...encounter.shots, { key: args.shotKey, releasedAt, direction: args.direction, endsAt: Math.min(Math.ceil(releasedAt + trajectory.duration), encounter.finishBy!), hit: trajectory.hit && releasedAt + trajectory.duration < flight.arrivesAt, resolved: false }];
  await changePouch(ctx, profile._id, -1, now);
  await ctx.db.patch('slingshotEncounters', encounter._id, { shots, state: 'projectile' });
  await ctx.scheduler.runAt(shots.at(-1)!.endsAt, internal.slingshot.tick, { encounterId: encounter._id });
  return response(ctx, profile._id, await settle(ctx, { ...encounter, shots, state: 'projectile' }, now), now);
} });

export const end = mutation({ args: { encounterId: v.string() }, returns: responseDto, handler: async (ctx, args) => {
  const { profile, encounter, now } = await owned(ctx, args.encounterId);
  return response(ctx, profile._id, await finish(ctx, encounter, 'abandoned', now), now);
} });

export const tick = internalMutation({ args: { encounterId: v.id('slingshotEncounters') }, returns: v.null(), handler: async (ctx, { encounterId }) => {
  const encounter = await ctx.db.get('slingshotEncounters', encounterId);
  if (encounter) await settle(ctx, encounter, Date.now());
  return null;
} });
