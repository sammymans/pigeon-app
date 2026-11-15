import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const outfitValidator = v.union(v.literal('classic'), v.literal('aviator'));
export const orderStatusValidator = v.union(v.literal('pending'), v.literal('paid'), v.literal('failed'), v.literal('refunded'), v.literal('reconciliation'));
export const orderValidator = v.object({
  id: v.string(), sku: v.literal('aviator'), status: orderStatusValidator,
  purchaseUrl: v.optional(v.string()), createdAt: v.number(),
});
const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
export const paymentValidator = v.object({
  id: nullableString, accountId: nullableString, intentId: nullableString,
  environment: nullableString, checkoutId: nullableString, variantId: nullableString,
  currency: nullableString, subtotalCents: nullableNumber, totalCents: nullableNumber,
  taxCents: nullableNumber, taxBehavior: nullableString, refundedCents: nullableNumber,
  status: nullableString, substatus: nullableString, validLineItem: v.boolean(),
});
export const eventPayloadValidator = v.object({
  type: v.string(), accountId: nullableString, apiVersion: nullableString,
  apiVersionDate: nullableString, paymentId: nullableString,
  resourceStatus: nullableString, payment: v.union(paymentValidator, v.null()),
  envelopeValid: v.boolean(),
});
export const commerceTables = {
  commerceOrders: defineTable({
    profileId: v.id('profiles'), userId: v.id('users'), intentId: v.string(),
    requestKey: v.string(), sku: v.literal('aviator'), status: orderStatusValidator,
    environment: v.literal('sandbox'), accountId: v.string(), variantId: v.string(),
    currency: v.literal('usd'), baseCents: v.number(), taxBasis: v.literal('exclusive'), redirectUrl: v.string(),
    checkoutId: v.optional(v.string()), purchaseUrl: v.optional(v.string()),
    paymentId: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(),
  }).index('by_profileId_and_requestKey', ['profileId', 'requestKey'])
    .index('by_profileId_and_status', ['profileId', 'status'])
    .index('by_profileId_and_createdAt', ['profileId', 'createdAt']).index('by_intentId', ['intentId'])
    .index('by_checkoutId', ['checkoutId']),
  commerceEntitlements: defineTable({
    profileId: v.id('profiles'), sku: v.literal('aviator'),
    orderId: v.id('commerceOrders'), paymentId: v.string(),
    active: v.boolean(), updatedAt: v.number(),
  }).index('by_profileId_and_sku', ['profileId', 'sku']),
  commercePayments: defineTable({
    paymentId: v.string(), orderId: v.id('commerceOrders'),
    revoked: v.boolean(), updatedAt: v.number(),
  }).index('by_paymentId', ['paymentId']),
  commerceEvents: defineTable({
    eventId: v.string(), payloadHash: v.string(), payload: eventPayloadValidator,
    state: v.union(v.literal('queued'), v.literal('processed'), v.literal('ignored'), v.literal('reconciliation')),
    reason: v.optional(v.string()), orderId: v.optional(v.id('commerceOrders')),
    attempts: v.number(), receivedAt: v.number(), processedAt: v.optional(v.number()),
  }).index('by_eventId', ['eventId']).index('by_state', ['state']),
};
