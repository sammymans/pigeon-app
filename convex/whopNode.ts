'use node';

import { createHash } from 'node:crypto';
import { unwrapWebhook } from '@whop/sdk/helpers';
import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { eventPayload, paymentSnapshot, requireWhopConfig, whopConfig, whopRequest } from './whopProtocol';
import { environmentValidator } from './commerceSchema';

export const receive = internalAction({
  args: { body: v.string(), headers: v.record(v.string(), v.string()), environment: v.optional(environmentValidator) },
  returns: v.object({ status: v.number() }),
  handler: async (ctx, { body, headers, environment }) => {
    const config = whopConfig(environment);
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
      payload: eventPayload(event, eventId), environment: config.environment,
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
      const config = requireWhopConfig(event.environment ?? 'sandbox');
      const payment = paymentSnapshot(await whopRequest(`/payments/${encodeURIComponent(event.payload.paymentId)}`, config.apiKey, undefined, undefined, config.environment));
      await ctx.runMutation(internal.commerceData.processPayment, { eventId, payment, sourceEnvironment: config.environment });
    } catch {
      await ctx.runMutation(internal.commerceData.retryEvent, { eventId });
    }
    return null;
  },
});
