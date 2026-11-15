import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const encounterState = v.union(v.literal('ready'), v.literal('active'), v.literal('projectile'), v.literal('caught'), v.literal('escaped'), v.literal('expired'), v.literal('delivered'), v.literal('abandoned'));
export const point = v.object({ x: v.number(), y: v.number() });
export const shot = v.object({ key: v.string(), releasedAt: v.number(), direction: point, endsAt: v.number(), hit: v.boolean(), resolved: v.boolean() });
export const slingshotTables = {
  slingshotEncounters: defineTable({
    version: v.literal('slingshot-v1'), flightId: v.id('flights'), catcherId: v.id('profiles'),
    namespace: v.string(), preparedAt: v.number(), readyUntil: v.number(), seed: v.number(),
    armedAt: v.optional(v.number()), fireUntil: v.optional(v.number()), finishBy: v.optional(v.number()),
    shotLimit: v.number(), shots: v.array(shot), state: encounterState, endedAt: v.optional(v.number()),
  }).index('by_flightId_and_catcherId', ['flightId', 'catcherId']),
  stonePouches: defineTable({ profileId: v.id('profiles'), count: v.number(), nextRefillAt: v.optional(v.number()) }).index('by_profileId', ['profileId']),
  stoneReturns: defineTable({ tripId: v.string(), profileId: v.id('profiles'), creditedAt: v.number() }).index('by_tripId', ['tripId']),
};
