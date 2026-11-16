/// <reference types="vite/client" />
import { createHmac } from 'node:crypto';
import { convexTest, type TestConvex } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
import { eventPayload, moneyCents, paymentSnapshot, WHOP_API_VERSION } from './whopProtocol';
import { cityById } from '../src/domain';
import { pointPacks, type CommerceSku } from '../src/shop';

const modules = import.meta.glob('./**/*.ts');
const testKey = 'ws_unit_test_fixture_not_a_real_credential';
const accountId = 'biz_testaccount';
const variantId = 'plan_testaviator';
const checkoutId = 'ch_testcheckout';
const testEnvironment = {
  WHOP_ENVIRONMENT: 'sandbox',
  WHOP_SANDBOX_API_KEY: 'unit-test-api-key', WHOP_SANDBOX_WEBHOOK_SECRET: testKey,
  WHOP_SANDBOX_ACCOUNT_ID: accountId, WHOP_SANDBOX_VARIANT_ID: variantId,
  PIGEON_PUBLIC_ORIGIN: 'https://pigeon.example',
  WHOP_SANDBOX_POINTS_100_VARIANT_ID: 'plan_points100',
  WHOP_SANDBOX_POINTS_550_VARIANT_ID: 'plan_points550',
  WHOP_SANDBOX_POINTS_1200_VARIANT_ID: 'plan_points1200',
  WHOP_SANDBOX_PIGEON_VARIANT_ID: 'plan_pigeon', PIGEON_PRICE_CENTS: '500',
};
const money = (amount: string, currency = 'usd') => ({ amount, currency, decimals: 2, display_decimals: 2 });

async function setup(sku: CommerceSku = 'aviator') {
  const t = convexTest(schema, modules);
  const users = await t.run(async (ctx) => {
    const alice = await ctx.db.insert('users', { email: 'commerce-alice@example.invalid' });
    const bob = await ctx.db.insert('users', { email: 'commerce-bob@example.invalid' });
    const profileId = await ctx.db.insert('profiles', { userId: alice, handle: 'commercealice', cityId: 'london', equipped: 'classic', demo: true, namespace: 'commerce-test' });
    const recipientId = await ctx.db.insert('profiles', { userId: bob, handle: 'commercebob', cityId: 'paris', equipped: 'classic', demo: true, namespace: 'commerce-test' });
    return { alice, bob, profileId, recipientId };
  });
  const alice = t.withIdentity({ subject: `${users.alice}|test-session` });
  const bob = t.withIdentity({ subject: `${users.bob}|test-session` });
  const order = await alice.mutation(internal.commerceData.beginCheckout, { sku, requestKey: 'request-one', intentId: 'opaque-order-one' });
  await alice.mutation(internal.commerceData.attachCheckout, { id: order._id, checkoutId, purchaseUrl: `https://sandbox.whop.com/checkout/${checkoutId}/` });
  return { t, alice, bob, order, profileId: users.profileId, recipientId: users.recipientId };
}

function payment(intentId = 'opaque-order-one') {
  return {
    id: 'pay_testpayment', account_id: accountId, variant_id: variantId,
    checkout_configuration_id: checkoutId, currency: 'usd', status: 'paid', substatus: 'succeeded',
    metadata: { order_id: intentId, environment: 'sandbox' },
    subtotal: money('2.99'), total: money('2.99'), tax_amount: null, tax_behavior: null,
    refunded_amount: money('0.00'),
    line_items: [{ variant_id: variantId, quantity: 1, subtotal: money('2.99') }],
  };
}

function event(data: unknown, id = 'msg_testevent', type = 'payment.succeeded') {
  return { id, type, api_version: 'v1', api_version_date: WHOP_API_VERSION, account_id: accountId, timestamp: new Date().toISOString(), data };
}

function signed(value: unknown, key = testKey, timestamp = Math.floor(Date.now() / 1000).toString()) {
  const body = JSON.stringify(value);
  const id = (value as { id: string }).id;
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { body, headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` } };
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const [name, value] of Object.entries(testEnvironment)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function deliver(t: TestConvex<typeof schema>, value: ReturnType<typeof event>, currentPayment: unknown = value.data) {
  const fetchMock = vi.fn(async (url: string) => {
    expect(url).toMatch(/^https:\/\/sandbox-api\.whop\.com\/api\/v1\/payments\/pay_/);
    return new Response(JSON.stringify(currentPayment), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  const response = await t.action(internal.whopNode.receive, signed(value));
  expect(response.status).toBe(200);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return fetchMock;
}

describe('sandbox commerce authorization and checkout', () => {
  it('requires an authenticated profile for ownership, orders, equip and checkout', async () => {
    const { t } = await setup();
    await expect(t.query(api.commerce.ownership, {})).rejects.toThrow('Sign in');
    await expect(t.query(api.commerce.order, { id: 'opaque-order-one' })).rejects.toThrow('Sign in');
    await expect(t.mutation(api.commerce.equip, { outfit: 'classic' })).rejects.toThrow('Sign in');
    await expect(t.action(api.commerce.checkout, { sku: 'aviator', requestKey: 'request-one' })).rejects.toThrow('Sign in');
  });

  it('never leaks another account order or grants from a checkout return', async () => {
    const { alice, bob } = await setup();
    expect(await bob.query(api.commerce.order, { id: 'opaque-order-one' })).toBeNull();
    expect((await alice.query(api.commerce.order, { id: 'opaque-order-one' }))?.status).toBe('pending');
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    await expect(alice.mutation(api.commerce.equip, { outfit: 'aviator' })).rejects.toThrow('verified');
  });

  it('reuses one pending order for concurrent request retries', async () => {
    const { bob } = await setup();
    const orders = await Promise.all([
      bob.mutation(internal.commerceData.beginCheckout, { requestKey: 'concurrent-request', intentId: 'intent-concurrent-one' }),
      bob.mutation(internal.commerceData.beginCheckout, { requestKey: 'concurrent-request', intentId: 'intent-concurrent-two' }),
    ]);
    expect(orders[0]._id).toBe(orders[1]._id);
    expect((await bob.query(api.commerce.ownership, {})).orders).toHaveLength(1);
  });

  it('creates a server-priced current API hosted checkout with an opaque, stable intent', async () => {
    const { bob } = await setup();
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toMatch(/^https:\/\/sandbox-api\.whop\.com\/api\/v1\//);
      expect((init.headers as Record<string, string>)['Api-Version-Date']).toBe(WHOP_API_VERSION);
      if (url.includes('/variants/')) return Response.json({ id: variantId, account: { id: accountId }, billing_type: 'one_time', initial_price: 2.99, currency: 'usd', tax_type: 'exclusive', adaptive_pricing_enabled: false, allow_multiple_quantity: false });
      const body = JSON.parse(init.body as string);
      expect(body.account_id).toBe(accountId);
      expect(body.variant_id).toBe(variantId);
      expect(body.plan_id).toBeUndefined();
      expect(body.metadata.environment).toBe('sandbox');
      expect(body.metadata.order_id).toMatch(/^[a-f0-9-]{36}$/);
      expect(body.redirect_url).toBe(`https://pigeon.example/?checkout_order=${body.metadata.order_id}`);
      expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(`pigeon-${body.metadata.order_id}`);
      return Response.json({ ...body, id: 'ch_secondcheckout', variant: { id: variantId, billing_type: 'one_time', initial_price: 2.99, currency: 'usd', adaptive_pricing_enabled: false }, purchase_url: 'https://sandbox.whop.com/checkout/ch_secondcheckout/' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const created = await bob.action(api.commerce.checkout, { sku: 'aviator', requestKey: 'second-request' });
    expect(created.status).toBe('pending');
    expect(created.purchaseUrl).toContain('sandbox.whop.com');
    expect(await bob.action(api.commerce.checkout, { sku: 'aviator', requestKey: 'second-request' })).toEqual(created);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await bob.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
  });

  it('rejects a live checkout URL and never converts an API failure into success', async () => {
    const { bob } = await setup();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => url.includes('/variants/')
      ? Response.json({ id: variantId, account: { id: accountId }, billing_type: 'one_time', initial_price: 2.99, currency: 'usd', tax_type: 'exclusive', adaptive_pricing_enabled: false, allow_multiple_quantity: false })
      : Response.json({ ...JSON.parse(init.body as string), id: 'ch_liveurl', variant: { id: variantId, billing_type: 'one_time', initial_price: 2.99, currency: 'usd', adaptive_pricing_enabled: false }, purchase_url: 'https://whop.com/checkout/ch_liveurl/' })));
    await expect(bob.action(api.commerce.checkout, { sku: 'aviator', requestKey: 'live-request' })).rejects.toThrow('sandbox checkout URL');
    expect((await bob.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    await expect(bob.action(api.commerce.checkout, { sku: 'aviator', requestKey: 'live-request' })).rejects.toThrow('401');
    expect((await bob.query(api.commerce.ownership, {})).orders[0].status).toBe('pending');
  });

  it('requires all five valid config values and exposes no secrets', async () => {
    const { t } = await setup();
    expect(await t.query(api.commerce.catalog, {})).toEqual({ configured: true, priceLabel: '$2.99 USD · one time', testMode: true });
    for (const name of ['WHOP_SANDBOX_API_KEY', 'WHOP_SANDBOX_WEBHOOK_SECRET', 'WHOP_SANDBOX_ACCOUNT_ID', 'WHOP_SANDBOX_VARIANT_ID', 'PIGEON_PUBLIC_ORIGIN'] as const) {
      const prior = testEnvironment[name];
      vi.stubEnv(name, '');
      expect((await t.query(api.commerce.catalog, {})).configured).toBe(false);
      vi.stubEnv(name, prior);
    }
    vi.stubEnv('PIGEON_PUBLIC_ORIGIN', 'http://pigeon.example');
    expect((await t.query(api.commerce.catalog, {})).configured).toBe(false);
  });
});

function storePayment(order: { intentId: string; variantId: string; baseCents: number; environment: string }) {
  const amount = (order.baseCents / 100).toFixed(2);
  return { ...payment(order.intentId), variant_id: order.variantId,
    metadata: { order_id: order.intentId, environment: order.environment },
    subtotal: money(amount), total: money(amount),
    line_items: [{ variant_id: order.variantId, quantity: 1, subtotal: money(amount) }],
  };
}

describe('Coop shop Whop purchases', () => {
  it.each(pointPacks)('credits $points points once for $sku, including its bonus', async pack => {
    const { t, alice, bob, order } = await setup(pack.sku);
    const data = storePayment(order);
    const success = event(data);
    expect((await alice.query(api.coop.mine, {})).points).toBe(120);
    await deliver(t, success);
    await deliver(t, success);
    await deliver(t, event(data, 'msg_duplicatepayment'));
    expect((await alice.query(api.coop.mine, {})).points).toBe(120 + pack.points);
    expect((await bob.query(api.coop.mine, {})).points).toBe(120);
    expect((await alice.query(api.commerce.orders, {}))[0].status).toBe('paid');
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    expect(await t.run(ctx => ctx.db.query('commercePayments').collect())).toHaveLength(1);
  });

  it('keeps different products separate and rejects request-key reuse for another SKU', async () => {
    const { alice, order } = await setup('points_100');
    const retry = await alice.mutation(internal.commerceData.beginCheckout, { sku: 'points_100', requestKey: 'retry-request', intentId: 'retry-intent' });
    const other = await alice.mutation(internal.commerceData.beginCheckout, { sku: 'points_550', requestKey: 'other-request', intentId: 'other-intent' });
    expect(retry._id).toBe(order._id);
    expect(other._id).not.toBe(order._id);
    expect(other.points).toBe(550);
    await expect(alice.mutation(internal.commerceData.beginCheckout, { sku: 'points_550', requestKey: 'request-one', intentId: 'mismatched-intent' })).rejects.toThrow('another purchase');
  });

  it.each(pointPacks)('creates the correct server-priced checkout for $sku', async pack => {
    const { bob } = await setup();
    const variant = `plan_points${pack.points}`;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/variants/')) {
        expect(url).toContain(variant);
        return Response.json({ id: variant, account: { id: accountId }, billing_type: 'one_time', initial_price: pack.cents / 100, currency: 'usd', tax_type: 'exclusive', adaptive_pricing_enabled: false, allow_multiple_quantity: false });
      }
      const body = JSON.parse(init.body as string);
      expect(body.variant_id).toBe(variant);
      return Response.json({ ...body, id: 'ch_points', variant: { id: variant, billing_type: 'one_time', initial_price: pack.cents / 100, currency: 'usd', adaptive_pricing_enabled: false }, purchase_url: 'https://sandbox.whop.com/checkout/ch_points/' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const order = await bob.action(api.commerce.checkout, { sku: pack.sku, requestKey: 'buy-points-request' });
    expect(order.sku).toBe(pack.sku);
    expect(order.purchaseUrl).toBe('https://sandbox.whop.com/checkout/ch_points/');
    expect((await bob.query(api.coop.mine, {})).points).toBe(120);
  });

  it('does not grant on a wrong price, and prevents paying again while it needs review', async () => {
    const { t, alice, order } = await setup('points_550');
    const data = { ...storePayment(order), subtotal: money('1.00'), total: money('1.00') };
    await deliver(t, event(data));
    expect((await alice.query(api.coop.mine, {})).points).toBe(120);
    expect((await alice.query(api.commerce.orders, {}))[0].status).toBe('reconciliation');
    await expect(alice.action(api.commerce.checkout, { sku: 'points_550', requestKey: 'pay-again-request' })).rejects.toThrow('review');
  });

  it('reverses points once, retaining debt when points were already spent', async () => {
    const { t, alice, order } = await setup('points_550');
    const data = storePayment(order);
    await deliver(t, event(data));
    for (let i = 0; i < 24; i++) await alice.mutation(api.coop.transact, { action: { type: 'buyTreat' }, requestKey: `spend-request-${i}` });
    expect((await alice.query(api.coop.mine, {})).points).toBe(70);
    const refund = event({ id: 'rf_points', status: 'succeeded', payment: { id: data.id } }, 'msg_pointsrefund', 'refund.created');
    const refunded = { ...data, refunded_amount: money('5.00'), substatus: 'refunded' };
    await deliver(t, refund, refunded);
    await deliver(t, { ...refund, id: 'msg_otherrefund' }, refunded);
    await deliver(t, event(data, 'msg_stalepoints'));
    expect((await alice.query(api.coop.mine, {})).points).toBe(-480);
    expect((await alice.query(api.commerce.orders, {}))[0].status).toBe('refunded');
  });

  it('never grants points when a reversal arrives before success', async () => {
    const { t, alice, order } = await setup('points_100');
    const data = storePayment(order);
    await deliver(t, event({ id: 'rf_before', status: 'succeeded', payment: { id: data.id } }, 'msg_refundfirst', 'refund.created'), { ...data, refunded_amount: money('1.00'), substatus: 'refunded' });
    await deliver(t, event(data));
    expect((await alice.query(api.coop.mine, {})).points).toBe(120);
    expect((await alice.query(api.commerce.orders, {}))[0].status).toBe('refunded');
  });

  it('adds one permanent pigeon and revokes only that pigeon after a refund', async () => {
    const { t, alice, order } = await setup('pigeon');
    await alice.mutation(api.onboarding.ensureFlock, {});
    const data = storePayment(order);
    await deliver(t, event(data));
    await deliver(t, event(data, 'msg_birdduplicate'));
    const flock = await alice.query(api.onboarding.flock, {});
    expect(flock.pigeons).toHaveLength(6);
    const bird = flock.pigeons[5];
    await alice.mutation(api.coop.transact, { action: { type: 'accessory', item: 'cap', birdId: bird.id }, requestKey: 'dress-new-pigeon' });
    expect(order.baseCents).toBe(500);
    await deliver(t, event({ id: 'rf_bird', status: 'succeeded', payment: { id: data.id } }, 'msg_birdrefund', 'refund.created'), { ...data, refunded_amount: money('5.00'), substatus: 'refunded' });
    await alice.mutation(api.onboarding.ensureFlock, {});
    expect((await alice.query(api.onboarding.flock, {})).pigeons).toHaveLength(5);
    expect((await alice.query(api.coop.mine, {})).equipped.some(entry => entry.birdId === bird.id)).toBe(false);
    await expect(alice.mutation(api.coop.transact, { action: { type: 'treat', birdId: bird.id }, requestKey: 'treat-revoked-pigeon' })).rejects.toThrow('Choose a pigeon');
    await deliver(t, event(data, 'msg_birdstalesuccess'));
    expect((await alice.query(api.onboarding.flock, {})).pigeons).toHaveLength(5);
  });

  it('reports each product readiness without exposing credentials', async () => {
    const { t, bob } = await setup();
    vi.stubEnv('WHOP_SANDBOX_POINTS_550_VARIANT_ID', '');
    vi.stubEnv('PIGEON_PRICE_CENTS', '');
    const catalog = await t.query(api.commerce.storefront, {});
    expect(catalog.products.filter(product => product.configured).map(product => product.sku)).toEqual(['points_100', 'points_1200']);
    expect(JSON.stringify(catalog)).not.toContain('unit-test-api-key');
    await expect(bob.action(api.commerce.checkout, { sku: 'points_550', requestKey: 'not-configured-request' })).rejects.toThrow('not configured');
    expect(await bob.query(api.commerce.orders, {})).toHaveLength(0);
    vi.stubEnv('WHOP_ENVIRONMENT', 'prod');
    expect((await t.query(api.commerce.storefront, {})).products.every(product => !product.configured)).toBe(true);
  });

  it('uses live credentials for live orders and preserves the event environment across a mode switch', async () => {
    for (const [name, value] of Object.entries(testEnvironment)) if (name.startsWith('WHOP_SANDBOX_')) vi.stubEnv(name.replace('SANDBOX', 'LIVE'), value);
    vi.stubEnv('WHOP_LIVE_API_KEY', 'live-test-key');
    vi.stubEnv('WHOP_LIVE_WEBHOOK_SECRET', 'ws_live_test_secret');
    vi.stubEnv('WHOP_ENVIRONMENT', 'production');
    const { t, alice, order } = await setup('points_100');
    const data = storePayment(order);
    const request = signed(event(data), 'ws_live_test_secret');
    expect((await t.fetch('/webhooks/whop/sandbox', { method: 'POST', ...request })).status).toBe(401);
    expect((await t.fetch('/webhooks/whop/production', { method: 'POST', ...request })).status).toBe(200);
    vi.stubEnv('WHOP_ENVIRONMENT', 'sandbox');
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://api.whop.com/api/v1/payments/pay_testpayment');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer live-test-key');
      return Response.json(data);
    });
    vi.stubGlobal('fetch', fetchMock);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect((await alice.query(api.coop.mine, {})).points).toBe(220);
    expect(await alice.query(api.commerce.orders, {})).toHaveLength(0);
    vi.stubEnv('WHOP_ENVIRONMENT', 'production');
    expect((await alice.query(api.commerce.orders, {}))[0].status).toBe('paid');
  });
});

describe('verified durable fulfillment', () => {
  it('serves the mounted HTTP endpoint without trusting return parameters', async () => {
    const { t, alice } = await setup();
    const request = signed(event(payment()));
    const rejected = await t.fetch('/webhooks/whop?status=succeeded', { method: 'POST', body: request.body });
    expect(rejected.status).toBe(401);
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    const accepted = await t.fetch('/webhooks/whop', { method: 'POST', ...request });
    expect(accepted.status).toBe(200);
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    await deliver(t, event(payment()));
    expect((await alice.query(api.commerce.ownership, {})).owned).toContain('aviator');
  });

  it('rejects invalid signatures, altered raw bodies, missing headers, and expired timestamps without recording an event', async () => {
    const { t } = await setup();
    const value = event(payment());
    const valid = signed(value);
    for (const request of [signed(value, 'wrong-key'), { ...valid, body: `${valid.body} ` }, { body: valid.body, headers: {} }, signed(value, testKey, String(Math.floor(Date.now() / 1000) - 600))]) {
      expect((await t.action(internal.whopNode.receive, request)).status).toBe(401);
    }
    expect(await t.run(async (ctx) => await ctx.db.query('commerceEvents').take(10))).toHaveLength(0);
  });

  it('persists before acknowledgement, then grants once and allows authenticated equip', async () => {
    const { t, alice, bob, profileId } = await setup();
    expect((await t.action(internal.whopNode.receive, signed(event(payment())))).status).toBe(200);
    expect((await t.run(async (ctx) => await ctx.db.query('commerceEvents').take(10)))[0].state).toBe('queued');
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    await deliver(t, event(payment()));
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic', 'aviator']);
    await alice.mutation(api.commerce.equip, { outfit: 'aviator' });
    expect((await t.run(async (ctx) => await ctx.db.get('profiles', profileId)))?.equipped).toBe('aviator');
    await expect(bob.mutation(api.commerce.equip, { outfit: 'aviator' })).rejects.toThrow('verified');
    await expect(alice.mutation(internal.commerceData.beginCheckout, { requestKey: 'new-request', intentId: 'new-intent' })).rejects.toThrow('already own');
  });

  it('deduplicates repeated event IDs and separate events for the same payment', async () => {
    const { t, alice } = await setup();
    const first = event(payment());
    await deliver(t, first);
    const duplicateFetch = await deliver(t, first);
    expect(duplicateFetch).not.toHaveBeenCalled();
    await deliver(t, event(payment(), 'msg_duplicatepayment'));
    expect(await t.run(async (ctx) => await ctx.db.query('commerceEntitlements').take(10))).toHaveLength(1);
    expect(await t.run(async (ctx) => await ctx.db.query('commercePayments').take(10))).toHaveLength(1);
    expect((await alice.query(api.commerce.order, { id: 'opaque-order-one' }))?.status).toBe('paid');
  });

  it('reconciles an extra distinct charge for a fulfilled order without a second grant', async () => {
    const { t, alice } = await setup();
    await deliver(t, event(payment()));
    await deliver(t, event({ ...payment(), id: 'pay_secondcharge' }, 'msg_secondcharge'));
    expect(await t.run(async (ctx) => await ctx.db.query('commerceEntitlements').take(10))).toHaveLength(1);
    const events = await t.run(async (ctx) => await ctx.db.query('commerceEvents').take(10));
    expect(events.find((entry) => entry.eventId === 'msg_secondcharge')?.reason).toBe('payment_already_bound');
    expect((await alice.query(api.commerce.ownership, {})).owned).toContain('aviator');
  });

  it('rejects altered payloads reusing the same verified event ID', async () => {
    const { t } = await setup();
    await deliver(t, event(payment()));
    await expect(t.action(internal.whopNode.receive, signed(event({ ...payment(), total: money('9.99') })))).rejects.toThrow('different payload');
    expect(await t.run(async (ctx) => await ctx.db.query('commerceEvents').take(10))).toHaveLength(1);
  });

  it.each([
    ['unknown order', { metadata: { order_id: 'unknown', environment: 'sandbox' } }],
    ['wrong environment', { metadata: { order_id: 'opaque-order-one', environment: 'production' } }],
    ['wrong account', { account_id: 'biz_otheraccount' }],
    ['wrong checkout', { checkout_configuration_id: 'ch_wrongcheckout' }],
    ['wrong variant', { variant_id: 'plan_wrongvariant' }],
    ['wrong currency', { currency: 'eur', total: money('2.99', 'eur') }],
    ['wrong subtotal', { subtotal: money('0.01') }],
    ['discounted total', { total: money('0.01') }],
    ['wrong tax basis', { tax_behavior: 'inclusive', tax_amount: money('0.30') }],
    ['multiple items', { line_items: [] }],
    ['unconfirmed payment', { status: 'pending', substatus: 'pending' }],
  ])('reconciles %s without granting', async (_label, changes) => {
    const { t, alice } = await setup();
    const changed = { ...payment(), ...changes };
    await deliver(t, event(changed));
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    expect((await t.run(async (ctx) => await ctx.db.query('commerceEvents').take(10)))[0].state).toBe('reconciliation');
  });

  it('checks the signed order against the fresh sandbox payment rather than trusting either alone', async () => {
    const { t, alice, bob } = await setup();
    await bob.mutation(internal.commerceData.beginCheckout, { requestKey: 'bob-order', intentId: 'bob-intent' });
    await deliver(t, event(payment('bob-intent')), payment());
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    expect((await bob.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    expect((await t.run(async (ctx) => await ctx.db.query('commerceEvents').take(10)))[0].reason).toBe('wrong_order');
  });

  it('checks exclusive tax separately from the 299-cent catalog base', async () => {
    const { t, alice } = await setup();
    await deliver(t, event({ ...payment(), tax_behavior: 'exclusive', tax_amount: money('0.30'), total: money('3.29') }));
    expect((await alice.query(api.commerce.ownership, {})).owned).toContain('aviator');
  });

  it.each(['payment.failed', 'payment.canceled'])('%s never grants and late failure never downgrades a paid order', async (type) => {
    const { t, alice } = await setup();
    const failed = { ...payment(), status: 'void', substatus: 'canceled' };
    await deliver(t, event(failed, 'msg_failed', type));
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    expect((await alice.query(api.commerce.order, { id: 'opaque-order-one' }))?.status).toBe('failed');
    await deliver(t, event(payment(), 'msg_paid'));
    await deliver(t, event(failed, 'msg_latefailure', type), payment());
    expect((await alice.query(api.commerce.order, { id: 'opaque-order-one' }))?.status).toBe('paid');
  });

  it('revokes a refunded purchase, falls back to Classic, and does not regrant from a stale success', async () => {
    const { t, alice } = await setup();
    await deliver(t, event(payment()));
    await alice.mutation(api.commerce.equip, { outfit: 'aviator' });
    await deliver(t, event({ id: 'rf_testrefund', status: 'succeeded', payment: { id: 'pay_testpayment' } }, 'msg_refund', 'refund.updated'), { ...payment(), refunded_amount: money('2.99'), substatus: 'refunded' });
    const ownership = await alice.query(api.commerce.ownership, {});
    expect(ownership.owned).toEqual(['classic']);
    expect(ownership.equipped).toBe('classic');
    expect(ownership.orders[0].status).toBe('refunded');
    await deliver(t, event(payment(), 'msg_stalesuccess'), payment());
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    await expect(alice.mutation(api.commerce.equip, { outfit: 'aviator' })).rejects.toThrow('verified');
  });

  it('projects equip and refund fallback onto an already-flying public pigeon', async () => {
    const { t, alice, profileId, recipientId } = await setup();
    await t.run(async (ctx) => await ctx.db.insert('flights', {
      senderId: profileId, recipientId, origin: cityById('london'), destination: cityById('paris'),
      visibility: 'open', defense: 'cruise', distanceKm: 344, departedAt: Date.now(), arrivesAt: Date.now() + 90000,
      state: 'in_flight', demo: true, namespace: 'commerce-test', requestKey: 'cosmetic-flight', courier: 'Pip',
      attemptCount: 0, catchOpen: true, updatedAt: Date.now(), events: [{ at: Date.now(), label: 'Launched' }],
    }));
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).flights[0].outfit).toBe('classic');
    await deliver(t, event(payment()));
    await alice.mutation(api.commerce.equip, { outfit: 'aviator' });
    const dressed = (await t.query(api.flights.list, { scope: 'world', demo: true })).flights[0];
    expect(dressed.outfit).toBe('aviator');
    expect(dressed.role).toBe('public');
    expect(dressed.recipientHandle).toBeUndefined();
    await deliver(t, event({ id: 'rf_publicrefund', status: 'succeeded', payment: { id: 'pay_testpayment' } }, 'msg_publicrefund', 'refund.created'), { ...payment(), refunded_amount: money('2.99'), substatus: 'refunded' });
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).flights[0].outfit).toBe('classic');
  });

  it('handles a reversal arriving before the payment event', async () => {
    const { t, alice } = await setup();
    await deliver(t, event({ id: 'dspt_test', status: 'lost', payment: { id: 'pay_testpayment' } }, 'msg_dispute', 'dispute.updated'), { ...payment(), substatus: 'dispute_lost' });
    await deliver(t, event(payment(), 'msg_latesuccess'));
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    expect((await alice.query(api.commerce.ownership, {})).orders[0].status).toBe('refunded');
  });

  it('retries failed sandbox verification durably, then reconciles without granting', async () => {
    const { t, alice } = await setup();
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await t.action(internal.whopNode.receive, signed(event(payment())))).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
    expect((await t.run(async (ctx) => await ctx.db.query('commerceEvents').take(10)))[0]).toMatchObject({ state: 'reconciliation', reason: 'payment_lookup_failed' });
  });

  it('reconciles unknown accounts and wrong API versions before any outbound request', async () => {
    const { t, alice } = await setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await t.action(internal.whopNode.receive, signed({ ...event(payment()), account_id: 'biz_other' }));
    await t.action(internal.whopNode.receive, signed({ ...event(payment(), 'msg_oldversion'), api_version_date: '2026-01-01' }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await alice.query(api.commerce.ownership, {})).owned).toEqual(['classic']);
  });
});

describe('documented payment payload normalization', () => {
  it('uses exact decimal strings and fails closed on malformed money', () => {
    expect(moneyCents(money('2.99'))).toBe(299);
    expect(moneyCents(money('2.999'))).toBeNull();
    expect(moneyCents({ amount: 2.99, currency: 'usd', decimals: 2 })).toBeNull();
    expect(moneyCents(money('-2.99'))).toBeNull();
    expect(moneyCents(money('2.99', 'eur'))).toBeNull();
    expect(paymentSnapshot({}).validLineItem).toBe(false);
    expect(eventPayload({}, 'msg_missing').envelopeValid).toBe(false);
  });
});
