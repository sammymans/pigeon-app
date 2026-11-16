import { v } from 'convex/values';

export const cityId = v.union(v.literal('san-francisco'), v.literal('los-angeles'), v.literal('new-york'), v.literal('chicago'), v.literal('london'), v.literal('paris'), v.literal('berlin'), v.literal('tokyo'), v.literal('seoul'), v.literal('singapore'), v.literal('sydney'), v.literal('sao-paulo'));
export const city = v.object({ id: cityId, name: v.string(), country: v.string(), lat: v.number(), lng: v.number() });
export const outfit = v.union(v.literal('classic'), v.literal('aviator'));
export const visibility = v.union(v.literal('sealed'), v.literal('open'));
export const defense = v.union(v.literal('cruise'), v.literal('zigzag'));
export const flightState = v.union(v.literal('in_flight'), v.literal('delivered'), v.literal('intercepted'));
export const connectionState = v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined'));
export const outcome = v.union(v.literal('caught'), v.literal('missed'), v.literal('expired'), v.literal('delivered'));
export const event = v.object({ at: v.number(), label: v.string() });
export const profileDto = v.object({ id: v.string(), handle: v.string(), displayName: v.optional(v.string()), cityId: v.optional(cityId), equipped: outfit, demo: v.boolean() });
export const summaryDto = v.object({
  id: v.string(), courier: v.string(), origin: city, destination: city,
  visibility, defense, distanceKm: v.number(), departedAt: v.number(), arrivesAt: v.number(),
  state: flightState, outfit, demo: v.boolean(),
  role: v.union(v.literal('sender'), v.literal('recipient'), v.literal('catcher'), v.literal('public')),
  shareToken: v.optional(v.string()), senderHandle: v.optional(v.string()), recipientHandle: v.optional(v.string()),
  attemptCount: v.number(),
  anonymous: v.optional(v.boolean()),
});
export const detailDto = summaryDto.extend({
  body: v.optional(v.string()), canCatch: v.boolean(), canRequest: v.boolean(), canResend: v.boolean(),
  otherProfileId: v.optional(v.string()), events: v.array(event),
});
export const attemptDto = v.object({
  id: v.string(), flightId: v.string(), phases: v.array(v.number()), startedAt: v.number(),
  expiresAt: v.number(), serverTime: v.number(), defense,
});
export const resultDto = v.object({ outcome, hits: v.array(v.boolean()), flightId: v.string() });
export const connectionDto = v.object({
  id: v.string(), profile: profileDto, state: connectionState,
  direction: v.union(v.literal('incoming'), v.literal('outgoing')),
});
