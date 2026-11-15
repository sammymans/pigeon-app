import { defineTable } from 'convex/server';
import { v } from 'convex/values';
import { city, outfit } from './validators';

export const tripStatus = v.union(v.literal('outbound'), v.literal('held'), v.literal('returning'), v.literal('returned'));
export const holderKind = v.union(v.literal('recipient'), v.literal('catcher'));
export const returnKind = v.union(v.literal('reply'), v.literal('empty'));

export const courierTripTables = {
  courierTrips: defineTable({
    ownerId: v.id('profiles'), outboundFlightId: v.id('flights'), currentFlightId: v.id('flights'),
    namespace: v.string(), demo: v.boolean(), status: tripStatus,
    courier: v.object({ key: v.string(), slot: v.number(), name: v.string(), outfit }),
    home: city, ownerHandle: v.string(),
    holderId: v.optional(v.id('profiles')), holderKind: v.optional(holderKind),
    heldAt: v.optional(v.number()), replyDeadline: v.union(v.number(), v.null()), holderCity: v.optional(city),
    returnedAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  }).index('by_ownerId_and_status', ['ownerId', 'status'])
    .index('by_ownerId_and_createdAt', ['ownerId', 'createdAt'])
    .index('by_holderId_and_status', ['holderId', 'status'])
    .index('by_outboundFlightId', ['outboundFlightId'])
    .index('by_namespace', ['namespace']),
  courierReturns: defineTable({
    tripId: v.id('courierTrips'), heldFlightId: v.id('flights'), flightId: v.id('flights'),
    holderId: v.id('profiles'), kind: returnKind, reason: v.union(v.literal('sent'), v.literal('deadline')),
    requestKey: v.optional(v.string()), createdAt: v.number(),
  }).index('by_heldFlightId', ['heldFlightId']).index('by_flightId', ['flightId']),
};
