import { ConvexError, v } from 'convex/values';
import type { OpenLetter, ReturnReceipt, TripView } from '../starter/returns/types';
import { internalMutation, mutation, query } from './_generated/server';
import { beginReturn, projectTrip, tripForFlight } from './courierTripModel';
import { settleFlight } from './flightModel';
import { areBlocked, requireProfile } from './model';

export const status = query({
  args: { flightId: v.string() },
  handler: async (ctx, args): Promise<TripView | null> => {
    const profile = await requireProfile(ctx);
    const found = await tripForFlight(ctx, args.flightId);
    return found ? projectTrip(ctx, found.trip, found.flight, profile) : null;
  },
});

export const availability = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireProfile(ctx);
    const trips = (await Promise.all((['outbound', 'held', 'returning'] as const).map((state) =>
      ctx.db.query('courierTrips').withIndex('by_ownerId_and_status', (q) => q.eq('ownerId', profile._id).eq('status', state)).take(3),
    ))).flat();
    return { available: Math.max(0, 3 - trips.length), away: trips.map((trip) => ({ id: trip._id, name: trip.courier.name, status: trip.status, awaitingRecipient: trip.status === 'held' && trip.holderKind === 'recipient' })) };
  },
});

export const open = mutation({
  args: { flightId: v.string() },
  handler: async (ctx, args): Promise<OpenLetter | null> => {
    const profile = await requireProfile(ctx);
    let found = await tripForFlight(ctx, args.flightId);
    if (!found || profile.namespace !== found.trip.namespace) return null;
    if (profile._id !== found.trip.ownerId && profile._id !== found.trip.holderId && profile._id !== found.flight.recipientId) return null;
    const now = Date.now();
    await settleFlight(ctx, found.flight, now);
    found = (await tripForFlight(ctx, args.flightId))!;
    if (found.trip.status === 'held' && found.trip.replyDeadline !== null && now >= found.trip.replyDeadline) {
      await beginReturn(ctx, found.trip, now, { reason: 'deadline' });
      found = (await tripForFlight(ctx, args.flightId))!;
    }
    const view = await projectTrip(ctx, found.trip, found.flight, profile);
    if (!view) return null;
    const isSender = found.flight.senderId === profile._id;
    const isRecipient = found.flight.recipientId === profile._id && found.flight.state === 'delivered';
    const isCatcher = found.trip.status === 'held' && found.trip.currentFlightId === found.flight._id && found.trip.holderId === profile._id && found.trip.holderKind === 'catcher';
    const message = isSender || isRecipient || isCatcher ? await ctx.db.query('messages').withIndex('by_flightId', (q) => q.eq('flightId', found!.flight._id)).unique() : null;
    const author = await ctx.db.get('profiles', found.flight.senderId);
    return { trip: view, ...(message ? { body: message.body } : {}), authorHandle: author?.handle ?? found.trip.ownerHandle, origin: found.flight.origin, serverTime: now };
  },
});

export const returnHome = mutation({
  args: { flightId: v.string(), requestKey: v.string(), body: v.optional(v.string()), openAcknowledged: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<ReturnReceipt> => {
    const profile = await requireProfile(ctx);
    const found = await tripForFlight(ctx, args.flightId);
    if (!found || found.trip.namespace !== profile.namespace) throw new ConvexError('This courier is unavailable.');
    const { flight, trip } = found;
    const prior = await ctx.db.query('courierReturns').withIndex('by_heldFlightId', (q) => q.eq('heldFlightId', flight._id)).unique();
    if (prior) {
      if (prior.holderId !== profile._id) throw new ConvexError('This courier is unavailable.');
      const message = await ctx.db.query('messages').withIndex('by_flightId', (q) => q.eq('flightId', prior.flightId)).unique();
      if (prior.reason !== 'deadline' && (prior.requestKey !== args.requestKey || message?.body !== args.body || (prior.kind === 'reply' && args.openAcknowledged !== true))) throw new ConvexError('This courier has already left. Retry the original return unchanged.');
      return { tripId: trip._id, flightId: prior.flightId, status: trip.status === 'returned' ? 'returned' : 'returning', kind: prior.kind, expired: prior.reason === 'deadline' };
    }
    if (trip.status !== 'held' || trip.currentFlightId !== flight._id || trip.holderId !== profile._id) throw new ConvexError('This courier is no longer waiting with you.');
    const now = Date.now();
    if (trip.replyDeadline !== null && now >= trip.replyDeadline) {
      const result = await beginReturn(ctx, trip, now, { reason: 'deadline' });
      return { tripId: trip._id, ...result, status: 'returning', expired: true };
    }
    if (!args.requestKey.trim() || args.requestKey.length > 128) throw new ConvexError('A valid return request key is required.');
    if (args.body !== undefined) {
      if (!args.body.trim() || Array.from(args.body).length > 280) throw new ConvexError('Write a reply between 1 and 280 characters, or return without a message.');
      if (args.openAcknowledged !== true) throw new ConvexError('Acknowledge that this return letter can be intercepted.');
      if (await areBlocked(ctx, trip.ownerId, profile._id)) throw new ConvexError('This connection is unavailable. You can still return the courier without a message.');
    }
    const result = await beginReturn(ctx, trip, now, { body: args.body, requestKey: args.requestKey, reason: 'sent' });
    return { tripId: trip._id, ...result, status: 'returning', expired: false };
  },
});

export const expire = internalMutation({
  args: { tripId: v.id('courierTrips'), heldFlightId: v.id('flights') }, returns: v.null(),
  handler: async (ctx, args) => {
    const trip = await ctx.db.get('courierTrips', args.tripId);
    const now = Date.now();
    if (trip?.status === 'held' && trip.currentFlightId === args.heldFlightId && trip.replyDeadline !== null && now >= trip.replyDeadline) await beginReturn(ctx, trip, now, { reason: 'deadline' });
    return null;
  },
});
