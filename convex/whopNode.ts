'use node';

import { createHash } from 'node:crypto';
import { unwrapWebhook } from '@whop/sdk/helpers';
import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { eventPayload, paymentSnapshot, record, requireSandboxConnection, sandboxConnection, whopRequest } from './whopProtocol';

export const receive = internalAction({
  args: { body: v.string(), headers: v.record(v.string(), v.string()) },
  returns: v.object({ status: v.number() }),
  handler: async (ctx, { body, headers }) => {
    const config = sandboxConnection();
    if (!config) return { status: 503 };
    let event: unknown;
    try {
      event = unwrapWebhook<unknown>(body, { headers, key: config.webhookSecret });
    } catch {
      return { status: 401 };
    }
    const eventId = headers['webhook-id'];
    if (!eventId || eventId.length > 200) return { status: 400 };
    await ctx.runMutation(internal.commerceData.ingestEvent, {
      eventId, payloadHash: createHash('sha256').update(body).digest('hex'),
      payload: eventPayload(event, eventId),
    });
    return { status: 200 };
  },
});

export const fulfill = internalAction({
  args: { eventId: v.id('commerceEvents') }, returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const event: Doc<'commerceEvents'> | null = await ctx.runQuery(internal.commerceData.eventForProcessing, { eventId });
    if (!event || event.state !== 'queued' || !event.payload.paymentId) return null;
    try {
      const config = requireSandboxConnection();
      let payment = paymentSnapshot(await whopRequest(`/payments/${encodeURIComponent(event.payload.paymentId)}`, config.apiKey));
      let currentDisputeStatus: string | undefined;
      let verificationVersion: number | undefined;
      const order = payment.intentId ? await ctx.runQuery(internal.commerceData.orderForVerification, { intentId: payment.intentId }) : null;
      if (order && order.sku !== 'aviator') {
        verificationVersion = order.verificationVersion ?? 0;
        payment = paymentSnapshot(await whopRequest(`/payments/${encodeURIComponent(event.payload.paymentId)}`, config.apiKey));
        if (event.payload.type.startsWith('dispute.')) {
          const resourceId = event.payload.resourceId;
          if (!resourceId || !/^dspt_[A-Za-z0-9]+$/.test(resourceId)) throw new Error('Missing dispute identity.');
          const dispute = record(await whopRequest(`/disputes/${encodeURIComponent(resourceId)}`, config.apiKey));
          if (dispute.id !== resourceId || dispute.account_id !== order.accountId || record(dispute.payment).id !== payment.id || typeof dispute.status !== 'string') throw new Error('Dispute identity mismatch.');
          currentDisputeStatus = dispute.status;
        }
      }
      await ctx.runMutation(internal.commerceData.processPayment, { eventId, payment, sourceEnvironment: 'sandbox', ...(currentDisputeStatus ? { currentDisputeStatus } : {}), ...(verificationVersion !== undefined ? { verificationVersion } : {}) });
    } catch {
      await ctx.runMutation(internal.commerceData.retryEvent, { eventId });
    }
    return null;
  },
});

export const closeCheckout = internalAction({
  args: { orderId: v.id('commerceOrders') }, returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.runQuery(internal.commerceData.checkoutForClosing, { orderId });
    if (!order || order.sku === 'aviator' || !order.checkoutId || order.checkoutClosed || order.status === 'pending' || (order.closeAttempts ?? 0) >= 5) return null;
    let closed = false;
    try {
      const config = requireSandboxConnection();
      if (order.accountId !== config.accountId) throw new Error('Sandbox account changed.');
      const result = record(await whopRequest(`/checkout_configurations/${encodeURIComponent(order.checkoutId)}`, config.apiKey, undefined, undefined, 'DELETE'));
      closed = result.id === order.checkoutId && result.deleted === true;
    } catch {}
    await ctx.runMutation(internal.commerceData.recordCheckoutClosure, { orderId, closed });
    return null;
  },
});
