import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';
import { requireProfile } from './model';
import { eventPayloadValidator, orderValidator, paymentValidator, skuValidator } from './commerceSchema';
import { AVIATOR_CENTS, paymentMismatch, requireSandboxConfig, requireSandboxConnection, WHOP_API_VERSION, type PaymentSnapshot, type EventPayload } from './whopProtocol';
import { approvedShopCatalog } from './shopCatalog';
import type { Order } from '../src/domain';

export function orderDto(order: Doc<'commerceOrders'>): Order {
  return {
    id: order.intentId, sku: order.sku, status: order.status, createdAt: order.createdAt,
    ...(order.status === 'pending' && order.purchaseUrl && !order.checkoutClosed && Date.now() - order.createdAt < 23 * 3600000 ? { purchaseUrl: order.purchaseUrl } : {}),
  };
}

export const beginCheckout = internalMutation({
  args: { requestKey: v.string(), intentId: v.string(), sku: v.optional(skuValidator) }, returns: schema.doc('commerceOrders'),
  handler: async (ctx, { requestKey, intentId, sku = 'aviator' }) => {
    const profile = await requireProfile(ctx);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestKey)) throw new ConvexError('Use a unique checkout request key of 8–128 characters.');
    const existing = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_requestKey', (q) => q.eq('profileId', profile._id).eq('requestKey', requestKey)).unique();
    if (existing) {
      if (existing.sku !== sku) throw new ConvexError('This checkout key belongs to another item.');
      return existing;
    }
    const entitlement = await ctx.db.query('commerceEntitlements').withIndex('by_profileId_and_sku', (q) => q.eq('profileId', profile._id).eq('sku', 'aviator')).unique();
    if (sku === 'aviator' && entitlement?.active) throw new ConvexError('You already own the Aviator Pack.');
    const unresolved = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', (q) => q.eq('profileId', profile._id).eq('status', 'reconciliation')).first();
    if (unresolved) throw new ConvexError('A previous payment needs reconciliation. Contact the demo operator before paying again.');
    const disputed = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', q => q.eq('profileId', profile._id).eq('status', 'disputed')).first();
    if (disputed) throw new ConvexError('Resolve the disputed payment before paying again.');
    const pending = await ctx.db.query('commerceOrders').withIndex('by_profileId_and_status', (q) => q.eq('profileId', profile._id).eq('status', 'pending')).first();
    if (pending) {
      if (pending.sku !== sku) throw new ConvexError('Resolve the pending checkout before choosing a different item.');
      return pending;
    }
    const catalog = approvedShopCatalog();
    const pack = catalog?.packs.find(pack => pack.sku === sku);
    if (sku !== 'aviator' && !pack) throw new ConvexError('This points pack has no approved sandbox catalog mapping. No payment has been started.');
    const config = sku === 'aviator' ? requireSandboxConfig() : requireSandboxConnection();
    const variantId = pack?.variantId ?? requireSandboxConfig().variantId;
    const createdAt = Date.now();
    const id = await ctx.db.insert('commerceOrders', {
      profileId: profile._id, userId: profile.userId, intentId, requestKey, sku,
      status: 'pending', environment: 'sandbox', accountId: config.accountId,
      variantId, currency: 'usd', baseCents: pack?.cents ?? AVIATOR_CENTS, taxBasis: 'exclusive',
      ...(pack ? { productId: pack.productId, pointsCredits: pack.points, catalogRevision: catalog!.revision } : {}),
      redirectUrl: `${config.origin}/checkout-return?order=${encodeURIComponent(intentId)}`,
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

export const expireCheckout = internalMutation({
  args: { id: v.id('commerceOrders') }, returns: orderValidator,
  handler: async (ctx, { id }) => {
    const profile = await requireProfile(ctx);
    const order = await ctx.db.get('commerceOrders', id);
    if (!order || order.profileId !== profile._id) throw new ConvexError('Order unavailable.');
    if (order.status !== 'pending') return orderDto(order);
    await ctx.db.patch('commerceOrders', id, { status: 'reconciliation', updatedAt: Date.now() });
    if (order.sku !== 'aviator' && order.checkoutId) await ctx.scheduler.runAfter(0, internal.whopNode.closeCheckout, { orderId: id });
    return orderDto({ ...order, status: 'reconciliation' });
  },
});

export const orderForVerification = internalQuery({
  args: { intentId: v.string() },
  handler: async (ctx, { intentId }) => ctx.db.query('commerceOrders').withIndex('by_intentId', q => q.eq('intentId', intentId)).unique(),
});

export const replayVerification = internalMutation({
  args: { eventId: v.id('commerceEvents') },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get('commerceEvents', eventId);
    if (!event || event.state !== 'reconciliation' || !['sandbox_payment_lookup_failed', 'checkout_not_attached'].includes(event.reason ?? '')) throw new Error('Only transient verification failures may be replayed.');
    await ctx.db.patch('commerceEvents', eventId, { state: 'queued', attempts: 0, reason: undefined, processedAt: undefined });
    await ctx.scheduler.runAfter(0, internal.whopNode.fulfill, { eventId });
  },
});

export const checkoutForClosing = internalQuery({
  args: { orderId: v.id('commerceOrders') },
  handler: async (ctx, { orderId }) => ctx.db.get('commerceOrders', orderId),
});

export const recordCheckoutClosure = internalMutation({
  args: { orderId: v.id('commerceOrders'), closed: v.boolean() },
  handler: async (ctx, { orderId, closed }) => {
    const order = await ctx.db.get('commerceOrders', orderId);
    if (!order || order.checkoutClosed) return;
    const attempts = (order.closeAttempts ?? 0) + 1;
    await ctx.db.patch('commerceOrders', orderId, { checkoutClosed: closed, closeAttempts: attempts });
    if (!closed && attempts < 5) await ctx.scheduler.runAfter(1000 * 2 ** attempts, internal.whopNode.closeCheckout, { orderId });
  },
});

const handledEvents = new Set(['payment.succeeded', 'payment.failed', 'payment.canceled', 'refund.created', 'refund.updated', 'dispute.created', 'dispute.updated']);

export const ingestEvent = internalMutation({
  args: { eventId: v.string(), payloadHash: v.string(), payload: eventPayloadValidator },
  returns: v.id('commerceEvents'),
  handler: async (ctx, args) => {
    const previous = await ctx.db.query('commerceEvents').withIndex('by_eventId', (q) => q.eq('eventId', args.eventId)).unique();
    if (previous) {
      if (previous.payloadHash !== args.payloadHash) throw new Error('Webhook ID reused with a different payload.');
      return previous._id;
    }
    const config = requireSandboxConnection();
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
      await ctx.db.patch('commerceEvents', eventId, { attempts, state: 'reconciliation', reason: 'sandbox_payment_lookup_failed', processedAt: Date.now() });
      const intentId = event.payload.payment?.intentId;
      const order = intentId ? await ctx.db.query('commerceOrders').withIndex('by_intentId', (q) => q.eq('intentId', intentId)).unique() : event.payload.paymentId ? await ctx.db.query('commerceOrders').withIndex('by_paymentId', q => q.eq('paymentId', event.payload.paymentId!)).unique() : null;
      if (order && (order.status === 'pending' || order.sku !== 'aviator')) await ctx.db.patch('commerceOrders', order._id, { status: 'reconciliation', updatedAt: Date.now() });
    } else {
      await ctx.db.patch('commerceEvents', eventId, { attempts });
      await ctx.scheduler.runAfter(1000 * 2 ** attempts, internal.whopNode.fulfill, { eventId });
    }
    return null;
  },
});

export const processPayment = internalMutation({
  args: { eventId: v.id('commerceEvents'), payment: paymentValidator, sourceEnvironment: v.literal('sandbox'), currentDisputeStatus: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { eventId, payment, sourceEnvironment, currentDisputeStatus }) => {
    const event = await ctx.db.get('commerceEvents', eventId);
    if (!event || event.state !== 'queued') return null;
    const now = Date.now();
    const payload = event.payload;
    const intentId = payload.payment?.intentId ?? payment.intentId;
    const order = intentId ? await ctx.db.query('commerceOrders').withIndex('by_intentId', (q) => q.eq('intentId', intentId)).unique() : null;
    if (order && !order.checkoutId && order.status === 'pending' && payment.intentId === order.intentId && payment.accountId === order.accountId) {
      const attempts = event.attempts + 1;
      await ctx.db.patch('commerceEvents', eventId, { attempts, orderId: order._id, ...(attempts >= 5 ? { state: 'reconciliation' as const, reason: 'checkout_not_attached', processedAt: now } : {}) });
      if (attempts < 5) await ctx.scheduler.runAfter(1000 * 2 ** attempts, internal.whopNode.fulfill, { eventId });
      else await ctx.db.patch('commerceOrders', order._id, { status: 'reconciliation', updatedAt: now });
      return null;
    }
    const reason = !order ? 'unknown_order'
      : sourceEnvironment !== order.environment ? 'wrong_environment'
      : payment.id !== payload.paymentId ? 'wrong_payment'
      : payload.accountId !== order.accountId ? 'wrong_account'
      : paymentMismatch(payment, order)
        ?? (payload.type === 'payment.succeeded' && payload.payment ? paymentMismatch(payload.payment, order) : null);
    if (reason || !order || !payment.id) {
      await ctx.db.patch('commerceEvents', eventId, { state: 'reconciliation', reason: reason ?? 'missing_payment', processedAt: now, ...(order ? { orderId: order._id } : {}) });
      if (order?.status === 'pending') await ctx.db.patch('commerceOrders', order._id, { status: 'reconciliation', updatedAt: now });
      return null;
    }
    const previousPayment = await ctx.db.query('commercePayments').withIndex('by_paymentId', (q) => q.eq('paymentId', payment.id!)).unique();
    if ((previousPayment && previousPayment.orderId !== order._id) || (order.paymentId && order.paymentId !== payment.id)) {
      await ctx.db.patch('commerceEvents', eventId, { state: 'reconciliation', reason: 'payment_already_bound', orderId: order._id, processedAt: now });
      return null;
    }
    if (order.sku !== 'aviator') {
      const profile = await ctx.db.get('profiles', order.profileId);
      if (!profile || profile.userId !== order.userId || !Number.isSafeInteger(order.pointsCredits) || !order.pointsCredits || order.pointsCredits < 0 || !order.productId) {
        await ctx.db.patch('commerceEvents', eventId, { state: 'reconciliation', reason: 'invalid_points_order', orderId: order._id, processedAt: now });
        await ctx.db.patch('commerceOrders', order._id, { status: 'reconciliation', updatedAt: now });
        return null;
      }
      await settlePoints(ctx, order, payment, payload, previousPayment, currentDisputeStatus);
      await ctx.db.patch('commerceEvents', eventId, { state: 'processed', orderId: order._id, processedAt: now });
      return null;
    }
    const entitlement = await ctx.db.query('commerceEntitlements').withIndex('by_profileId_and_sku', (q) => q.eq('profileId', order.profileId).eq('sku', 'aviator')).unique();
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
      if (!entitlement) await ctx.db.insert('commerceEntitlements', { profileId: order.profileId, sku: 'aviator', orderId: order._id, paymentId: payment.id, active: true, updatedAt: now });
      else if (!entitlement.active) await ctx.db.patch('commerceEntitlements', entitlement._id, { orderId: order._id, paymentId: payment.id, active: true, updatedAt: now });
      await ctx.db.patch('commerceOrders', order._id, { status: 'paid', paymentId: payment.id, updatedAt: now });
    } else if (['payment.failed', 'payment.canceled'].includes(payload.type) && payment.status !== 'paid' && order.status === 'pending') {
      await ctx.db.patch('commerceOrders', order._id, { status: 'failed', updatedAt: now });
    }
    await ctx.db.patch('commerceEvents', eventId, { state: 'processed', orderId: order._id, processedAt: now });
    return null;
  },
});

async function settlePoints(ctx: MutationCtx, order: Doc<'commerceOrders'>, payment: PaymentSnapshot, payload: EventPayload, previous: Doc<'commercePayments'> | null, disputeStatus?: string) {
  const paymentId = payment.id!;
  const now = Date.now();
  const credit = await ctx.db.query('commerceLedger').withIndex('by_profileId_and_key', q => q.eq('profileId', order.profileId).eq('key', `payment:${paymentId}`)).unique();
  const reversal = await ctx.db.query('commerceLedger').withIndex('by_profileId_and_key', q => q.eq('profileId', order.profileId).eq('key', `refund:${paymentId}`)).unique();
  const refunded = (payment.refundedCents ?? 0) > 0 || ['refunded', 'auto_refunded', 'partially_refunded', 'dispute_lost'].includes(payment.substatus ?? '') || (payload.type.startsWith('refund.') && payload.resourceStatus === 'succeeded') || disputeStatus === 'lost';
  const disputeEvent = payload.type.startsWith('dispute.');
  const clearedDispute = disputeStatus !== undefined && ['won', 'prevented', 'warning_closed'].includes(disputeStatus);
  const suspended = !refunded && (disputeEvent ? !clearedDispute : (payment.substatus ?? '').startsWith('dispute_') && !['dispute_won', 'dispute_warning_closed'].includes(payment.substatus!));
  let status = order.status;
  let delta = 0;
  let key: string | undefined;
  if (refunded || previous?.revoked) {
    status = 'refunded';
    if (credit && !reversal) { delta = -order.pointsCredits!; key = `refund:${paymentId}`; }
  } else if (suspended) status = 'disputed';
  else if (credit) status = 'paid';
  else if (payload.type === 'payment.succeeded' && payment.status === 'paid' && ['succeeded', 'dispute_won', 'dispute_warning_closed'].includes(payment.substatus ?? '') && payload.payment?.status === 'paid' && payload.payment.substatus === 'succeeded') {
    status = 'paid'; delta = order.pointsCredits!; key = `payment:${paymentId}`;
  } else if (payload.type === 'payment.canceled' && payment.status !== 'paid') status = 'canceled';
  else if (payload.type === 'payment.failed' && payment.status !== 'paid') status = 'failed';
  else status = 'reconciliation';
  if (key) {
    const wallet = await ctx.db.query('commerceWallets').withIndex('by_profileId', q => q.eq('profileId', order.profileId)).unique();
    const balance = (wallet?.balance ?? 0) + delta;
    if (!Number.isSafeInteger(balance)) throw new Error('Wallet amount out of range.');
    if (wallet) await ctx.db.patch('commerceWallets', wallet._id, { balance, revision: wallet.revision + 1 });
    else await ctx.db.insert('commerceWallets', { profileId: order.profileId, balance, revision: 1 });
    await ctx.db.insert('commerceLedger', { profileId: order.profileId, key, delta, kind: delta > 0 ? 'purchase' : 'refund', orderId: order._id, paymentId, createdAt: now });
  }
  if (previous) await ctx.db.patch('commercePayments', previous._id, { revoked: previous.revoked || refunded, updatedAt: now });
  else await ctx.db.insert('commercePayments', { paymentId, orderId: order._id, revoked: refunded, updatedAt: now });
  await ctx.db.patch('commerceOrders', order._id, { status, paymentId, updatedAt: now });
  if (order.checkoutId && !order.checkoutClosed && (order.closeAttempts ?? 0) < 5) await ctx.scheduler.runAfter(0, internal.whopNode.closeCheckout, { orderId: order._id });
}
