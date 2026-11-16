import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';
import { requireProfile } from './model';
import { environmentValidator, eventPayloadValidator, orderValidator, paymentValidator, skuValidator } from './commerceSchema';
import { paymentMismatch, productFor, requireProductConfig, requireWhopConfig, WHOP_API_VERSION } from './whopProtocol';
import { readCoop, saveCoop } from './coopModel';
import type { Order } from '../src/domain';

export function orderDto(order: Doc<'commerceOrders'>): Order {
  return {
    id: order.intentId, sku: order.sku, status: order.status, createdAt: order.createdAt,
    ...(order.status === 'pending' && order.purchaseUrl ? { purchaseUrl: order.purchaseUrl } : {}),
  };
}

export const beginCheckout = internalMutation({
  args: { sku: v.optional(skuValidator), requestKey: v.string(), intentId: v.string() }, returns: schema.doc('commerceOrders'),
  handler: async (ctx, { sku = 'aviator', requestKey, intentId }) => {
    const profile = await requireProfile(ctx);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestKey)) throw new ConvexError('Use a unique checkout request key of 8–128 characters.');
    const existing = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_requestKey', (q) => q.eq('profileId', profile._id).eq('requestKey', requestKey)).unique();
    const config = requireProductConfig(sku);
    if (existing) {
      if (existing.sku !== sku || existing.environment !== config.environment) throw new ConvexError('This request belongs to another purchase.');
      return existing;
    }
    const entitlement = await ctx.db.query('commerceEntitlements').withIndex('by_profileId_and_sku', (q) => q.eq('profileId', profile._id).eq('sku', 'aviator')).unique();
    if (sku === 'aviator' && entitlement?.active) throw new ConvexError('You already own the Aviator Pack.');
    const unresolved = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', (q) => q.eq('profileId', profile._id).eq('status', 'reconciliation')).filter(q => q.eq(q.field('environment'), config.environment)).first();
    if (unresolved) throw new ConvexError('A previous payment needs review. Contact support before paying again.');
    const pending = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', (q) => q.eq('profileId', profile._id).eq('status', 'pending')).filter(q => q.and(q.eq(q.field('sku'), sku), q.eq(q.field('environment'), config.environment))).first();
    if (pending) return pending;
    const product = productFor(sku);
    const createdAt = Date.now();
    const id = await ctx.db.insert('commerceOrders', {
      profileId: profile._id, userId: profile.userId, intentId, requestKey, sku,
      status: 'pending', environment: config.environment, accountId: config.accountId,
      variantId: config.variantId, currency: 'usd', baseCents: product.cents, points: product.points, taxBasis: 'exclusive',
      redirectUrl: `${config.origin}/?checkout_order=${encodeURIComponent(intentId)}`,
      createdAt, updatedAt: createdAt,
    });
    return (await ctx.db.get('commerceOrders', id))!;
  },
});

export const attachCheckout = internalMutation({
  args: { id: v.id('commerceOrders'), checkoutId: v.string(), purchaseUrl: v.string() }, returns: orderValidator,
  handler: async (ctx, { id, checkoutId, purchaseUrl }) => {
    const profile = await requireProfile(ctx);
    const order = await ctx.db.get('commerceOrders', id);
    if (!order || order.profileId !== profile._id) throw new ConvexError('Order unavailable.');
    if (order.checkoutId && order.checkoutId !== checkoutId) throw new ConvexError('Checkout is already bound to another configuration.');
    const bound = await ctx.db.query('commerceOrders').withIndex('by_checkoutId', (q) => q.eq('checkoutId', checkoutId)).unique();
    if (bound && bound._id !== id) throw new ConvexError('Checkout is already bound to another order.');
    await ctx.db.patch('commerceOrders', id, { checkoutId, purchaseUrl, updatedAt: Date.now() });
    return orderDto({ ...order, checkoutId, purchaseUrl });
  },
});

const handledEvents = new Set(['payment.succeeded', 'payment.failed', 'payment.canceled', 'refund.created', 'refund.updated', 'dispute.created', 'dispute.updated']);

export const ingestEvent = internalMutation({
  args: { eventId: v.string(), payloadHash: v.string(), payload: eventPayloadValidator, environment: environmentValidator },
  returns: v.id('commerceEvents'),
  handler: async (ctx, args) => {
    const previous = await ctx.db.query('commerceEvents').withIndex('by_eventId', (q) => q.eq('eventId', args.eventId)).unique();
    if (previous) {
      if (previous.payloadHash !== args.payloadHash || (previous.environment ?? 'sandbox') !== args.environment) throw new Error('Webhook ID reused with a different payload or environment.');
      return previous._id;
    }
    const config = requireWhopConfig(args.environment);
    const payload = args.payload;
    let reason: string | undefined;
    if (!payload.envelopeValid) reason = 'event_id_mismatch';
    else if (payload.apiVersion !== 'v1' || payload.apiVersionDate !== WHOP_API_VERSION) reason = 'wrong_api_version';
    else if (payload.accountId !== config.accountId) reason = 'wrong_account';
    else if (handledEvents.has(payload.type) && (!payload.paymentId || !/^pay_[A-Za-z0-9]+$/.test(payload.paymentId))) reason = 'missing_payment';
    const state = reason ? 'reconciliation' as const : handledEvents.has(payload.type) ? 'queued' as const : 'ignored' as const;
    const id = await ctx.db.insert('commerceEvents', { ...args, state, ...(reason ? { reason } : {}), attempts: 0, receivedAt: Date.now() });
    if (state === 'queued') await ctx.scheduler.runAfter(0, internal.whopNode.fulfill, { eventId: id });
    return id;
  },
});

export const eventForProcessing = internalQuery({
  args: { eventId: v.id('commerceEvents') }, returns: v.union(schema.doc('commerceEvents'), v.null()),
  handler: async (ctx, { eventId }) => await ctx.db.get('commerceEvents', eventId),
});

export const retryEvent = internalMutation({
  args: { eventId: v.id('commerceEvents') }, returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get('commerceEvents', eventId);
    if (!event || event.state !== 'queued') return null;
    const attempts = event.attempts + 1;
    if (attempts >= 5) {
      await ctx.db.patch('commerceEvents', eventId, { attempts, state: 'reconciliation', reason: 'payment_lookup_failed', processedAt: Date.now() });
      const intentId = event.payload.payment?.intentId;
      const order = intentId ? await ctx.db.query('commerceOrders').withIndex('by_intentId', (q) => q.eq('intentId', intentId)).unique() : null;
      if (order?.status === 'pending' && order.environment === (event.environment ?? 'sandbox')) await ctx.db.patch('commerceOrders', order._id, { status: 'reconciliation', updatedAt: Date.now() });
    } else {
      await ctx.db.patch('commerceEvents', eventId, { attempts });
      await ctx.scheduler.runAfter(1000 * 2 ** attempts, internal.whopNode.fulfill, { eventId });
    }
    return null;
  },
});

export const processPayment = internalMutation({
  args: { eventId: v.id('commerceEvents'), payment: paymentValidator, sourceEnvironment: environmentValidator },
  returns: v.null(),
  handler: async (ctx, { eventId, payment, sourceEnvironment }) => {
    const event = await ctx.db.get('commerceEvents', eventId);
    if (!event || event.state !== 'queued') return null;
    const now = Date.now();
    const payload = event.payload;
    const intentId = payload.payment?.intentId ?? payment.intentId;
    const order = intentId ? await ctx.db.query('commerceOrders').withIndex('by_intentId', (q) => q.eq('intentId', intentId)).unique() : null;
    const reason = !order ? 'unknown_order'
      : sourceEnvironment !== order.environment || sourceEnvironment !== (event.environment ?? 'sandbox') ? 'wrong_environment'
      : payment.id !== payload.paymentId ? 'wrong_payment'
      : payload.accountId !== order.accountId ? 'wrong_account'
      : paymentMismatch(payment, order)
        ?? (payload.type === 'payment.succeeded' && payload.payment ? paymentMismatch(payload.payment, order) : null);
    if (reason || !order || !payment.id) {
      await ctx.db.patch('commerceEvents', eventId, { state: 'reconciliation', reason: reason ?? 'missing_payment', processedAt: now, ...(order ? { orderId: order._id } : {}) });
      if (order?.status === 'pending' && order.environment === sourceEnvironment && order.accountId === payload.accountId) await ctx.db.patch('commerceOrders', order._id, { status: 'reconciliation', updatedAt: now });
      return null;
    }
    const previousPayment = await ctx.db.query('commercePayments').withIndex('by_paymentId', (q) => q.eq('paymentId', payment.id!)).unique();
    const entitlement = order.sku === 'aviator' ? await ctx.db.query('commerceEntitlements').withIndex('by_profileId_and_sku', (q) => q.eq('profileId', order.profileId).eq('sku', 'aviator')).unique() : null;
    if ((previousPayment && previousPayment.orderId !== order._id) || (order.paymentId && order.paymentId !== payment.id)) {
      await ctx.db.patch('commerceEvents', eventId, { state: 'reconciliation', reason: 'payment_already_bound', orderId: order._id, processedAt: now });
      return null;
    }
    const refunded = (payment.refundedCents ?? 0) > 0 || ['refunded', 'auto_refunded', 'partially_refunded', 'dispute_lost', 'dispute_closed'].includes(payment.substatus ?? '');
    const disputed = (payment.substatus ?? '').startsWith('dispute_') && !['dispute_won', 'dispute_warning_closed'].includes(payment.substatus!);
    const reversalEvent = (payload.type.startsWith('refund.') && payload.resourceStatus === 'succeeded') || (payload.type.startsWith('dispute.') && !['won', 'warning_closed'].includes(payload.resourceStatus ?? ''));
    const revoke = previousPayment?.revoked || refunded || disputed || reversalEvent;
    if (revoke) {
      if (previousPayment) await ctx.db.patch('commercePayments', previousPayment._id, { revoked: true, updatedAt: now });
      else await ctx.db.insert('commercePayments', { paymentId: payment.id, orderId: order._id, revoked: true, updatedAt: now });
      await ctx.db.patch('commerceOrders', order._id, { status: 'refunded', paymentId: payment.id, updatedAt: now });
      if (entitlement?.paymentId === payment.id && entitlement.active) {
        await ctx.db.patch('commerceEntitlements', entitlement._id, { active: false, updatedAt: now });
        const profile = await ctx.db.get('profiles', order.profileId);
        if (profile?.equipped === 'aviator') await ctx.db.patch('profiles', profile._id, { equipped: 'classic' });
      }
      const profile = await ctx.db.get('profiles', order.profileId);
      if (profile && order.pointsGranted && !order.pointsReversed && order.points) {
        const wallet = await readCoop(ctx, profile, now);
        // Keep spent refunded points as debt so spending before a refund cannot mint free points.
        await saveCoop(ctx, profile, { ...wallet, points: wallet.points - order.points });
        await ctx.db.patch('commerceOrders', order._id, { pointsReversed: order.points });
      }
      if (order.pigeonId) {
        const pigeon = await ctx.db.get('pigeons', order.pigeonId);
        if (pigeon && pigeon.ownerId === order.profileId) await ctx.db.patch('pigeons', pigeon._id, { commerceRevoked: true });
        if (profile) {
          const wallet = await readCoop(ctx, profile, now);
          await saveCoop(ctx, profile, { ...wallet, equipped: wallet.equipped.filter(item => item.birdId !== order.pigeonId), treatedBirds: wallet.treatedBirds.filter(id => id !== order.pigeonId) });
        }
      }
    } else if (payload.type === 'payment.succeeded') {
      if (payment.status !== 'paid' || payment.substatus !== 'succeeded' || payload.payment?.status !== 'paid' || payload.payment.substatus !== 'succeeded') {
        await ctx.db.patch('commerceEvents', eventId, { state: 'reconciliation', reason: 'payment_not_succeeded', orderId: order._id, processedAt: now });
        if (order.status === 'pending') await ctx.db.patch('commerceOrders', order._id, { status: 'reconciliation', updatedAt: now });
        return null;
      }
      const profile = await ctx.db.get('profiles', order.profileId);
      if (!profile || profile.userId !== order.userId || (entitlement?.active && entitlement.paymentId !== payment.id)) {
        await ctx.db.patch('commerceEvents', eventId, { state: 'reconciliation', reason: 'owner_or_entitlement_conflict', orderId: order._id, processedAt: now });
        return null;
      }
      if (!previousPayment) await ctx.db.insert('commercePayments', { paymentId: payment.id, orderId: order._id, revoked: false, updatedAt: now });
      if (order.sku === 'aviator') {
        if (!entitlement) await ctx.db.insert('commerceEntitlements', { profileId: order.profileId, sku: 'aviator', orderId: order._id, paymentId: payment.id, active: true, updatedAt: now });
        else if (!entitlement.active) await ctx.db.patch('commerceEntitlements', entitlement._id, { orderId: order._id, paymentId: payment.id, active: true, updatedAt: now });
      } else if (order.sku === 'pigeon' && !order.pigeonId) {
        const birds = await ctx.db.query('pigeons').withIndex('by_ownerId', q => q.eq('ownerId', profile._id)).collect();
        const slot = Math.max(4, ...birds.map(bird => bird.slot)) + 1;
        const pigeonId = await ctx.db.insert('pigeons', { ownerId: profile._id, slot, name: `Peep ${slot - 4}` });
        await ctx.db.patch('commerceOrders', order._id, { pigeonId });
      } else if (order.sku.startsWith('points_') && !order.pointsGranted && order.points) {
        const wallet = await readCoop(ctx, profile, now);
        await saveCoop(ctx, profile, { ...wallet, points: wallet.points + order.points });
        await ctx.db.patch('commerceOrders', order._id, { pointsGranted: true });
      }
      await ctx.db.patch('commerceOrders', order._id, { status: 'paid', paymentId: payment.id, updatedAt: now });
    } else if (['payment.failed', 'payment.canceled'].includes(payload.type) && payment.status !== 'paid' && order.status === 'pending') {
      await ctx.db.patch('commerceOrders', order._id, { status: 'failed', updatedAt: now });
    }
    await ctx.db.patch('commerceEvents', eventId, { state: 'processed', orderId: order._id, processedAt: now });
    return null;
  },
});
