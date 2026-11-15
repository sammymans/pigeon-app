import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

export const whopWebhook = httpAction(async (ctx, request) => {
  if (Number(request.headers.get('content-length') ?? 0) > 262144) return new Response('Payload too large', { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 262144) return new Response('Payload too large', { status: 413 });
  const result: { status: number } = await ctx.runAction(internal.whopNode.receive, {
    body, headers: {
      'webhook-id': request.headers.get('webhook-id') ?? '',
      'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': request.headers.get('webhook-signature') ?? '',
    },
  });
  return new Response(result.status === 200 ? 'OK' : 'Webhook rejected', { status: result.status });
});
