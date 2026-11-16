import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { commerceTables } from './commerceSchema';
import { coopTables } from './coopSchema';
import { city, cityId, connectionState, defense, event, flightState, outcome, outfit, visibility } from './validators';

export default defineSchema({
  phoneLimits: defineTable({ key: v.string(), windowStart: v.number(), count: v.number(), retryAt: v.number() }).index('by_key', ['key']),
  pigeons: defineTable({ ownerId: v.id('profiles'), name: v.string(), slot: v.number() }).index('by_ownerId', ['ownerId']),
  starterDemo: defineTable({ key: v.literal('shared'), value: v.number() }).index('by_key', ['key']),
  starterPairs: defineTable({
    ownerId: v.id('profiles'), partnerId: v.optional(v.id('profiles')), namespace: v.string(),
    inviteToken: v.string(), expiresAt: v.number(), inviteOpen: v.boolean(),
  }).index('by_ownerId', ['ownerId']).index('by_partnerId', ['partnerId']).index('by_inviteToken', ['inviteToken']),
  ...authTables,
  ...commerceTables,
  ...coopTables,
  profiles: defineTable({
    userId: v.id('users'), handle: v.string(), cityId: v.optional(cityId), equipped: outfit, demo: v.boolean(),
    displayName: v.optional(v.string()), onboardingCompletedAt: v.optional(v.number()),
    namespace: v.string(), catchCooldownUntil: v.optional(v.number()), catchCoolingDown: v.optional(v.boolean()),
  }).index('by_userId', ['userId']).index('by_handle', ['handle']).index('by_namespace', ['namespace']),
  flights: defineTable({
    pigeonId: v.optional(v.id('pigeons')),
    senderId: v.id('profiles'), recipientId: v.id('profiles'), origin: city, destination: city,
    visibility, defense, distanceKm: v.number(), departedAt: v.number(), arrivesAt: v.number(),
    state: flightState, demo: v.boolean(), namespace: v.string(), requestKey: v.string(), openAcknowledged: v.optional(v.boolean()),
    courier: v.string(), shareToken: v.optional(v.string()), attemptCount: v.number(), catchOpen: v.boolean(),
    catcherId: v.optional(v.id('profiles')), activeAttemptId: v.optional(v.id('catchAttempts')),
    updatedAt: v.number(), events: v.array(event),
  }).index('by_senderId_and_requestKey', ['senderId', 'requestKey'])
    .index('by_senderId_and_demo', ['senderId', 'demo'])
    .index('by_recipientId_and_demo', ['recipientId', 'demo'])
    .index('by_catcherId_and_demo', ['catcherId', 'demo'])
    .index('by_senderId_and_state', ['senderId', 'state'])
    .index('by_recipientId_and_state', ['recipientId', 'state'])
    .index('by_demo_and_visibility_and_state', ['demo', 'visibility', 'state'])
    .index('by_namespace_and_visibility_and_state', ['namespace', 'visibility', 'state'])
    .index('by_shareToken', ['shareToken']),
  messages: defineTable({ flightId: v.id('flights'), body: v.string(), namespace: v.string() })
    .index('by_flightId', ['flightId']).index('by_namespace', ['namespace']),
  catchAttempts: defineTable({
    flightId: v.id('flights'), catcherId: v.id('profiles'), namespace: v.string(), phases: v.array(v.number()),
    startedAt: v.number(), expiresAt: v.number(), guarded: v.optional(v.boolean()), outcome: v.optional(outcome), hits: v.optional(v.array(v.boolean())),
    taps: v.optional(v.array(v.union(v.number(), v.null()))),
  }).index('by_flightId_and_catcherId', ['flightId', 'catcherId'])
    .index('by_namespace', ['namespace']),
  connections: defineTable({
    pairKey: v.string(), requesterId: v.id('profiles'), targetId: v.id('profiles'), state: connectionState,
    flightId: v.optional(v.id('flights')), namespace: v.string(), createdAt: v.number(), updatedAt: v.number(),
  }).index('by_pairKey', ['pairKey']).index('by_requesterId', ['requesterId'])
    .index('by_targetId', ['targetId']).index('by_flightId', ['flightId']).index('by_namespace', ['namespace']),
  blocks: defineTable({ blockerId: v.id('profiles'), blockedId: v.id('profiles'), namespace: v.string(), createdAt: v.number() })
    .index('by_blockerId_and_blockedId', ['blockerId', 'blockedId']).index('by_namespace', ['namespace']),
  reports: defineTable({ reporterId: v.id('profiles'), profileId: v.optional(v.id('profiles')), flightId: v.optional(v.id('flights')), reason: v.string(), namespace: v.string(), createdAt: v.number() })
    .index('by_reporterId', ['reporterId']).index('by_namespace', ['namespace']),
  invites: defineTable({ token: v.string(), inviterId: v.id('profiles'), namespace: v.string(), createdAt: v.number(), expiresAt: v.number(), acceptedBy: v.optional(v.id('profiles')) })
    .index('by_token', ['token']).index('by_inviterId', ['inviterId']).index('by_namespace', ['namespace']),
  skyStats: defineTable({ demo: v.boolean(), active: v.number(), updatedAt: v.number() }).index('by_demo', ['demo']),
  demoNamespaces: defineTable({ namespace: v.string(), members: v.array(v.id('profiles')), seeded: v.boolean(), selfServiceOwnerId: v.optional(v.id('users')) })
    .index('by_namespace', ['namespace']),
});
