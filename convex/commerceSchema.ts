import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const outfitValidator = v.union(v.literal('classic'), v.literal('aviator'));
export const packValidator = v.union(v.literal('points-100'), v.literal('points-550'), v.literal('points-1200'));
export const skuValidator = v.union(v.literal('aviator'), packValidator);
export const accessoryValidator = v.union(v.literal('sunday-cap'), v.literal('cloud-scarf'), v.literal('flight-goggles'));
export const orderStatusValidator = v.union(v.literal('pending'), v.literal('paid'), v.literal('failed'), v.literal('canceled'), v.literal('disputed'), v.literal('refunded'), v.literal('reconciliation'));
export const orderValidator = v.object({
  id: v.string(), sku: skuValidator, status: orderStatusValidator,
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
  productId: v.optional(nullableString), lineProductId: v.optional(nullableString),
});
export const eventPayloadValidator = v.object({
  type: v.string(), accountId: nullableString, apiVersion: nullableString,
  apiVersionDate: nullableString, paymentId: nullableString,
  resourceStatus: nullableString, payment: v.union(paymentValidator, v.null()),
  envelopeValid: v.boolean(),
  resourceId: v.optional(nullableString),
});
export const commerceTables = {
  commerceOrders: defineTable({
    profileId: v.id('profiles'), userId: v.id('users'), intentId: v.string(),
    requestKey: v.string(), sku: skuValidator, status: orderStatusValidator,
    environment: v.literal('sandbox'), accountId: v.string(), variantId: v.string(),
    currency: v.literal('usd'), baseCents: v.number(), taxBasis: v.literal('exclusive'), redirectUrl: v.string(),
    checkoutId: v.optional(v.string()), purchaseUrl: v.optional(v.string()),
    paymentId: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(),
    pointsCredits: v.optional(v.number()), productId: v.optional(v.string()), catalogRevision: v.optional(v.string()),
    checkoutClosed: v.optional(v.boolean()), closeAttempts: v.optional(v.number()),
  }).index('by_profileId_and_requestKey', ['profileId', 'requestKey'])
    .index('by_profileId_and_status', ['profileId', 'status'])
    .index('by_profileId_and_createdAt', ['profileId', 'createdAt']).index('by_intentId', ['intentId'])
    .index('by_checkoutId', ['checkoutId']).index('by_paymentId', ['paymentId']),
  commerceWallets: defineTable({
    profileId: v.id('profiles'), balance: v.number(), revision: v.number(),
  }).index('by_profileId', ['profileId']),
  commerceLedger: defineTable({
    profileId: v.id('profiles'), key: v.string(), delta: v.number(),
    kind: v.union(v.literal('purchase'), v.literal('spend'), v.literal('refund'), v.literal('equip')),
    orderId: v.optional(v.id('commerceOrders')), paymentId: v.optional(v.string()),
    payload: v.optional(v.string()), createdAt: v.number(),
  }).index('by_profileId_and_key', ['profileId', 'key']).index('by_orderId', ['orderId']),
  commerceAccessories: defineTable({
    profileId: v.id('profiles'), itemId: accessoryValidator,
    wornBy: v.optional(v.id('pigeons')), acquiredAt: v.number(),
  }).index('by_profileId_and_itemId', ['profileId', 'itemId']).index('by_profileId', ['profileId']),
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
  }).index('by_eventId', ['eventId']).index('by_state', ['state']).index('by_orderId', ['orderId']),
};
