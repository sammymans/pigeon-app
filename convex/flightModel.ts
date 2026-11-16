import { ConvexError } from 'convex/values';
import { cityById, distanceKm, durationSeconds } from '../src/domain';
import type { LaunchInput } from '../src/domain';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { areBlocked, opaqueToken, pairKey, requireSameNamespace } from './model';

export async function changeSkyCount(ctx: MutationCtx, demo: boolean, delta: number, now: number) {
  const stats = await ctx.db.query('skyStats').withIndex('by_demo', (q) => q.eq('demo', demo)).unique();
  if (stats) await ctx.db.patch('skyStats', stats._id, { active: Math.max(0, stats.active + delta), updatedAt: now });
  else await ctx.db.insert('skyStats', { demo, active: Math.max(0, delta), updatedAt: now });
}

export async function settleFlight(ctx: MutationCtx, flight: Doc<'flights'>, now: number): Promise<Doc<'flights'>> {
  if (flight.state !== 'in_flight' || flight.arrivesAt > now) return flight;
  if (flight.activeAttemptId) {
    const attempt = await ctx.db.get('catchAttempts', flight.activeAttemptId);
    if (attempt && !attempt.outcome) await ctx.db.patch('catchAttempts', attempt._id, { outcome: 'delivered', hits: [false, false, false] });
  }
  const patch = {
    state: 'delivered' as const, catchOpen: false, activeAttemptId: undefined, updatedAt: now,
    events: [...flight.events, { at: flight.arrivesAt, label: 'Delivered' }],
  };
  await ctx.db.patch('flights', flight._id, patch);
  if (flight.visibility === 'open') await changeSkyCount(ctx, flight.demo, -1, now);
  return { ...flight, ...patch };
}

export async function finishAttempt(ctx: MutationCtx, flight: Doc<'flights'>, attempt: Doc<'catchAttempts'>, outcome: 'caught' | 'missed' | 'expired', hits: boolean[], now: number, taps?: (number | null)[]) {
  await ctx.db.patch('catchAttempts', attempt._id, { outcome, hits, ...(taps ? { taps } : {}) });
  if (flight.activeAttemptId !== attempt._id) return;
  const caught = outcome === 'caught';
  await ctx.db.patch('flights', flight._id, {
    activeAttemptId: undefined, updatedAt: now,
    ...(caught ? { state: 'intercepted' as const, catcherId: attempt.catcherId, catchOpen: false } : {}),
    events: [...flight.events, { at: now, label: caught ? 'Intercepted' : outcome === 'expired' ? 'Catch attempt expired' : 'Outflew a catch attempt' }],
  });
  if (caught) await changeSkyCount(ctx, flight.demo, -1, now);
}

export async function launchFor(ctx: MutationCtx, sender: Doc<'profiles'>, input: LaunchInput): Promise<Id<'flights'>> {
  const now = Date.now();
  if (!input.requestKey.trim() || input.requestKey.length > 128) throw new ConvexError('A valid launch request key is required.');
  if (!input.body.trim() || Array.from(input.body).length > 280) throw new ConvexError('Write a letter between 1 and 280 characters.');
  if (input.visibility === 'open' && !input.openAcknowledged) throw new ConvexError('Acknowledge the Open Skies disclosure first.');
  if (input.demo !== sender.demo) throw new ConvexError('Use your account’s isolated flight mode.');
  const recipientId = ctx.db.normalizeId('profiles', input.recipientId);
  if (!recipientId || recipientId === sender._id) throw new ConvexError('Choose an accepted friend.');
  const existing = await ctx.db.query('flights').withIndex('by_senderId_and_requestKey', (q) => q.eq('senderId', sender._id).eq('requestKey', input.requestKey)).unique();
  if (existing) {
    const message = await ctx.db.query('messages').withIndex('by_flightId', (q) => q.eq('flightId', existing._id)).unique();
    if (existing.recipientId !== recipientId || existing.visibility !== input.visibility || existing.defense !== input.defense || existing.demo !== input.demo || existing.pigeonId !== input.pigeonId || Boolean(existing.anonymous) !== Boolean(input.anonymous) || (existing.openAcknowledged !== undefined && existing.openAcknowledged !== input.openAcknowledged) || message?.body !== input.body) throw new ConvexError('That request key belongs to a different letter.');
    return existing._id;
  }
  const recipient = await ctx.db.get('profiles', recipientId);
  if (!recipient) throw new ConvexError('Choose an accepted friend.');
  requireSameNamespace(sender, recipient);
  if (await areBlocked(ctx, sender._id, recipient._id)) throw new ConvexError('This connection is unavailable.');
  const connection = await ctx.db.query('connections').withIndex('by_pairKey', (q) => q.eq('pairKey', pairKey(sender._id, recipient._id))).unique();
  if (connection?.state !== 'accepted') throw new ConvexError('Connect by invite or accepted request before sending a letter.');
  if (!sender.cityId) throw new ConvexError('Choose your departure city before sending a letter.');
  if (!recipient.cityId) throw new ConvexError('Your friend must choose a city before receiving a letter.');
  const active = await ctx.db.query('flights').withIndex('by_senderId_and_state', (q) => q.eq('senderId', sender._id).eq('state', 'in_flight')).take(4);
  let count = 0;
  for (const flight of active) if ((await settleFlight(ctx, flight, now)).state === 'in_flight') count++;
  if (count >= 3) throw new ConvexError('Three pigeons are already flying. Wait for one to arrive.');
  const pigeonId = input.pigeonId ? ctx.db.normalizeId('pigeons', input.pigeonId) : null;
  const pigeon = pigeonId ? await ctx.db.get('pigeons', pigeonId) : null;
  if (input.pigeonId !== undefined && (!pigeon || pigeon.ownerId !== sender._id)) throw new ConvexError('Choose a pigeon from your own flock.');
  if (pigeon && active.some(flight => flight.pigeonId === pigeon._id && flight.arrivesAt > now)) throw new ConvexError('This pigeon is unavailable. Choose a ready pigeon from your flock.');
  const origin = cityById(sender.cityId);
  const destination = cityById(recipient.cityId);
  const distance = distanceKm(origin, destination);
  const arrivesAt = now + durationSeconds(distance, input.demo, input.defense) * 1000;
  const id = await ctx.db.insert('flights', {
    senderId: sender._id, recipientId, origin, destination, visibility: input.visibility, defense: input.defense,
    distanceKm: distance, departedAt: now, arrivesAt, state: 'in_flight', demo: input.demo,
    namespace: sender.namespace, requestKey: input.requestKey, openAcknowledged: input.openAcknowledged, courier: pigeon?.name ?? 'Mochi',
    ...(pigeon ? { pigeonId: pigeon._id } : {}), anonymous: input.anonymous ?? false,
    ...(input.visibility === 'open' ? { shareToken: opaqueToken() } : {}),
    attemptCount: 0, catchOpen: input.visibility === 'open', updatedAt: now, events: [{ at: now, label: 'Launched' }],
  });
  await ctx.db.insert('messages', { flightId: id, body: input.body, namespace: sender.namespace });
  await ctx.scheduler.runAt(arrivesAt, internal.flights.settle, { flightId: id });
  if (input.visibility === 'open') {
    await changeSkyCount(ctx, input.demo, 1, now);
    await ctx.scheduler.runAt(arrivesAt - 15_000, internal.flights.closeCatchWindow, { flightId: id });
  }
  return id;
}

export async function catchEligible(ctx: QueryCtx, flight: Doc<'flights'>, profile: Doc<'profiles'> | null) {
  if (!profile || flight.state !== 'in_flight' || flight.visibility !== 'open' || !flight.catchOpen || flight.activeAttemptId || flight.attemptCount >= 2 || profile.catchCoolingDown) return false;
  if (flight.senderId === profile._id || flight.recipientId === profile._id || flight.namespace !== profile.namespace) return false;
  if (await areBlocked(ctx, profile._id, flight.senderId) || await areBlocked(ctx, profile._id, flight.recipientId)) return false;
  return !(await ctx.db.query('catchAttempts').withIndex('by_flightId_and_catcherId', (q) => q.eq('flightId', flight._id).eq('catcherId', profile._id)).unique());
}

export async function summaryProjection(ctx: QueryCtx, flight: Doc<'flights'>, viewer: Doc<'profiles'> | null) {
  const role = !viewer ? 'public' as const : viewer._id === flight.senderId ? 'sender' as const : viewer._id === flight.recipientId ? 'recipient' as const : viewer._id === flight.catcherId ? 'catcher' as const : 'public' as const;
  const sender = await ctx.db.get('profiles', flight.senderId);
  const recipient = role === 'sender' || role === 'recipient' ? await ctx.db.get('profiles', flight.recipientId) : null;
  const hiddenSender = Boolean(flight.anonymous) && role !== 'sender';
  return {
    id: flight._id, courier: hiddenSender ? 'A pigeon' : flight.courier, origin: flight.origin, destination: flight.destination,
    visibility: flight.visibility, defense: flight.defense, distanceKm: flight.distanceKm,
    departedAt: flight.departedAt, arrivesAt: flight.arrivesAt, state: flight.state,
    outfit: hiddenSender ? 'classic' as const : sender?.equipped ?? 'classic' as const, demo: flight.demo, role, attemptCount: flight.attemptCount, anonymous: flight.anonymous ?? false,
    ...(flight.shareToken ? { shareToken: flight.shareToken } : {}),
    ...(role !== 'public' && sender && !hiddenSender ? { senderHandle: sender.handle } : {}),
    ...(recipient ? { recipientHandle: recipient.handle } : {}),
  };
}
