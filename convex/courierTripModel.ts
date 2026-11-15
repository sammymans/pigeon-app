import { ConvexError } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import { cityById, distanceKm, durationSeconds } from '../src/domain';
import type { TripView } from '../starter/returns/types';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { areBlocked, opaqueToken } from './model';

export const CATCHER_LEASE_MS = 30 * 60_000;

export async function trackDeparture(ctx: MutationCtx, flightId: Id<'flights'>, now: number) {
  const flight = await ctx.db.get('flights', flightId);
  if (!flight || flight.tripId || flight.visibility !== 'open') return;
  const owner = await ctx.db.get('profiles', flight.senderId);
  if (!owner) throw new ConvexError('This courier is unavailable.');
  const busy = (await Promise.all((['outbound', 'held', 'returning'] as const).map((status) =>
    ctx.db.query('courierTrips').withIndex('by_ownerId_and_status', (q) => q.eq('ownerId', owner._id).eq('status', status)).take(3),
  ))).flat();
  const slot = [0, 1, 2].find((value) => !busy.some((trip) => trip.courier.slot === value));
  if (slot === undefined) throw new ConvexError('Your three couriers are away. A courier must return home before flying again.');
  const recent = await ctx.db.query('courierTrips').withIndex('by_ownerId_and_createdAt', (q) => q.eq('ownerId', owner._id)).order('desc').take(3);
  const courier = recent.find((trip) => trip.courier.slot === slot)?.courier ?? {
    key: `${owner._id}:${slot}`, slot, name: flight.courier, outfit: owner.equipped,
  };
  const tripId = await ctx.db.insert('courierTrips', {
    ownerId: owner._id, ownerHandle: owner.handle, outboundFlightId: flightId, currentFlightId: flightId,
    namespace: flight.namespace, demo: flight.demo, status: 'outbound', courier,
    home: flight.origin, replyDeadline: null, createdAt: now, updatedAt: now,
  });
  await ctx.db.patch('flights', flightId, { tripId, tripLeg: 'outbound', courier: courier.name });
}

export async function receiveCourier(ctx: MutationCtx, flight: Doc<'flights'>, holderId: Id<'profiles'>, kind: 'recipient' | 'catcher', now: number) {
  if (!flight.tripId) return;
  const trip = await ctx.db.get('courierTrips', flight.tripId);
  if (!trip || trip.currentFlightId !== flight._id || trip.status === 'returned' || trip.status === 'held') return;
  if (flight.tripLeg !== 'outbound' && kind === 'recipient') {
    if (holderId !== trip.ownerId) throw new ConvexError('Invalid courier destination.');
    await ctx.db.patch('courierTrips', trip._id, { status: 'returned', replyDeadline: null, returnedAt: flight.arrivesAt, updatedAt: now });
    await ctx.scheduler.runAfter(0, makeFunctionReference<'mutation', { tripId: Id<'courierTrips'> }, null>('stones:creditReturn'), { tripId: trip._id });
    return;
  }
  const holder = await ctx.db.get('profiles', holderId);
  if (!holder || holder.namespace !== trip.namespace || holderId === trip.ownerId) throw new ConvexError('Invalid courier holder.');
  const replyDeadline = kind === 'catcher' ? now + CATCHER_LEASE_MS : null;
  await ctx.db.patch('courierTrips', trip._id, {
    status: 'held', holderId, holderKind: kind, heldAt: now, holderCity: kind === 'recipient' ? flight.destination : cityById(holder.cityId),
    replyDeadline, updatedAt: now,
  });
  if (replyDeadline !== null) await ctx.scheduler.runAt(replyDeadline, internal.courierTrips.expire, { tripId: trip._id, heldFlightId: flight._id });
}

export async function beginReturn(ctx: MutationCtx, trip: Doc<'courierTrips'>, now: number, input: { body?: string; requestKey?: string; reason: 'sent' | 'deadline' }) {
  if (trip.status !== 'held' || !trip.holderId || !trip.holderCity) throw new ConvexError('This courier is no longer waiting with you.');
  const heldFlight = await ctx.db.get('flights', trip.currentFlightId);
  if (!heldFlight) throw new ConvexError('This letter is unavailable.');
  const kind = input.body === undefined ? 'empty' as const : 'reply' as const;
  const distance = distanceKm(trip.holderCity, trip.home);
  const arrivesAt = now + durationSeconds(distance, trip.demo, heldFlight.defense) * 1000;
  const flightId = await ctx.db.insert('flights', {
    senderId: trip.holderId, recipientId: trip.ownerId, origin: trip.holderCity, destination: trip.home,
    visibility: 'open', defense: heldFlight.defense, distanceKm: distance, departedAt: now, arrivesAt,
    state: 'in_flight', demo: trip.demo, namespace: trip.namespace,
    requestKey: `return:${trip.currentFlightId}`, openAcknowledged: kind === 'reply',
    courier: trip.courier.name, attemptCount: 0, catchOpen: kind === 'reply',
    ...(kind === 'reply' ? { shareToken: opaqueToken() } : {}),
    tripId: trip._id, tripLeg: kind === 'empty' ? 'empty_return' : 'return',
    updatedAt: now, events: [{ at: now, label: input.reason === 'deadline' ? 'Returning home after reply deadline' : kind === 'reply' ? 'Returning home with a reply' : 'Returning home without a message' }],
  });
  if (input.body !== undefined) await ctx.db.insert('messages', { flightId, body: input.body, namespace: trip.namespace });
  await ctx.db.insert('courierReturns', { tripId: trip._id, heldFlightId: trip.currentFlightId, flightId, holderId: trip.holderId, kind, reason: input.reason, ...(input.requestKey ? { requestKey: input.requestKey } : {}), createdAt: now });
  await ctx.db.patch('courierTrips', trip._id, { status: 'returning', currentFlightId: flightId, replyDeadline: null, updatedAt: now });
  const stats = await ctx.db.query('skyStats').withIndex('by_demo', (q) => q.eq('demo', trip.demo)).unique();
  if (stats) await ctx.db.patch('skyStats', stats._id, { active: stats.active + 1, updatedAt: now });
  else await ctx.db.insert('skyStats', { demo: trip.demo, active: 1, updatedAt: now });
  await ctx.scheduler.runAt(arrivesAt, internal.flights.settle, { flightId });
  if (kind === 'reply') await ctx.scheduler.runAt(arrivesAt - 15_000, internal.flights.closeCatchWindow, { flightId });
  return { flightId, kind };
}

export async function tripForFlight(ctx: QueryCtx, flightId: string) {
  const id = ctx.db.normalizeId('flights', flightId);
  const flight = id ? await ctx.db.get('flights', id) : null;
  const trip = flight?.tripId ? await ctx.db.get('courierTrips', flight.tripId) : null;
  return flight && trip ? { flight, trip } : null;
}

export async function projectTrip(ctx: QueryCtx, trip: Doc<'courierTrips'>, flight: Doc<'flights'>, profile: Doc<'profiles'>): Promise<TripView | null> {
  if (profile.namespace !== trip.namespace || (profile._id !== trip.ownerId && profile._id !== trip.holderId)) return null;
  const current = await ctx.db.get('flights', trip.currentFlightId);
  const origin = trip.holderCity ?? flight.destination;
  const distance = distanceKm(origin, trip.home);
  const blocked = trip.holderId ? await areBlocked(ctx, trip.ownerId, trip.holderId) : false;
  return {
    id: trip._id, flightId: flight._id, currentFlightId: trip.currentFlightId, status: trip.status,
    role: profile._id === trip.ownerId ? 'owner' : 'holder', courier: trip.courier,
    ownerHandle: trip.ownerHandle, home: trip.home,
    ...(trip.holderKind ? { holderKind: trip.holderKind } : {}),
    replyDeadline: trip.replyDeadline,
    canReturn: profile._id === trip.holderId && trip.status === 'held' && trip.currentFlightId === flight._id,
    blocked, demo: trip.demo, returnOrigin: origin,
    returnSeconds: durationSeconds(distance, trip.demo, current?.defense ?? flight.defense),
    normalReturnSeconds: durationSeconds(distance, false, current?.defense ?? flight.defense),
    ...((trip.status === 'returning' || trip.status === 'returned') && current ? { departedAt: current.departedAt, arrivesAt: current.arrivesAt, returnKind: current.tripLeg === 'empty_return' ? 'empty' as const : 'reply' as const } : {}),
    ...(trip.returnedAt !== undefined ? { returnedAt: trip.returnedAt } : {}), updatedAt: trip.updatedAt,
  };
}
