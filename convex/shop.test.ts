import { createHmac } from 'node:crypto';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { eventPayload, paymentSnapshot, WHOP_API_VERSION } from './whopProtocol';

const modules = import.meta.glob('./**/*.ts');
const secret = 'ws_shop_unit_test_not_a_credential';
const account = 'biz_shopfixture';
const variant = 'plan_points100';
const product = 'prod_points';
const catalog = JSON.stringify({ revision: 'fixture-v1', cloudScarfPoints: 60, packs: [{ sku: 'points-100', variantId: variant, productId: product, cents: 100, points: 100 }, { sku: 'points-550', variantId: 'plan_points550', productId: product, cents: 500, points: 550 }] });
const money = (amount: string) => ({ amount, currency: 'usd', decimals: 2 });

beforeEach(() => {
  vi.useFakeTimers();
  for (const [key, value] of Object.entries({ WHOP_SANDBOX_API_KEY: 'shop-unit-test-key', WHOP_SANDBOX_WEBHOOK_SECRET: secret, WHOP_SANDBOX_ACCOUNT_ID: account, PIGEON_PUBLIC_ORIGIN: 'https://pigeon.example', PIGEON_SHOP_CHANNEL: 'standalone-web-sandbox', PIGEON_SHOP_SANDBOX_CATALOG: catalog })) vi.stubEnv(key, value);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup() {
  const t = convexTest(schema, modules);
  const data = await t.run(async ctx => {
    const user = await ctx.db.insert('users', { isAnonymous: true });
    const otherUser = await ctx.db.insert('users', { isAnonymous: true });
    const profileId = await ctx.db.insert('profiles', { userId: user, handle: 'shopfixture', equipped: 'classic', demo: true, namespace: 'shop-test' });
    const otherProfile = await ctx.db.insert('profiles', { userId: otherUser, handle: 'othershopfixture', equipped: 'classic', demo: true, namespace: 'shop-test' });
    return { user, otherUser, profileId, otherProfile };
  });
  const alice = t.withIdentity({ subject: `${data.user}|fixture` });
  const bob = t.withIdentity({ subject: `${data.otherUser}|fixture` });
  const birds = (await alice.mutation(api.onboarding.ensureFlock, {})).pigeons;
  const others = (await bob.mutation(api.onboarding.ensureFlock, {})).pigeons;
  return { t, alice, bob, birds, others, ...data };
}

type Fixture = Awaited<ReturnType<typeof setup>>;
function payment(intentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_shoppayment', account_id: account, product_id: product, variant_id: variant, checkout_configuration_id: 'ch_shopfixture', currency: 'usd', status: 'paid', substatus: 'succeeded',
    metadata: { order_id: intentId, environment: 'sandbox' }, subtotal: money('1.00'), total: money('1.00'), tax_amount: null, tax_behavior: null, refunded_amount: money('0.00'),
    line_items: [{ product_id: product, variant_id: variant, quantity: 1, subtotal: money('1.00') }], ...overrides,
  };
}
function signedEvent(data: unknown, id = 'msg_shopfixture', type = 'payment.succeeded') {
  const body = JSON.stringify({ id, type, api_version: 'v1', api_version_date: WHOP_API_VERSION, account_id: account, data });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { body, headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` } };
}
async function begin(f: Fixture, attach = true, keepExpiry = false) {
  const order = await f.alice.mutation(internal.commerceData.beginCheckout, { sku: 'points-100', requestKey: 'fixture-checkout', intentId: 'fixture-intent' });
  if (!keepExpiry && order.expiryJobId) await f.t.run(ctx => ctx.scheduler.cancel(order.expiryJobId!));
  if (attach) await f.alice.mutation(internal.commerceData.attachCheckout, { id: order._id, checkoutId: 'ch_shopfixture', purchaseUrl: 'https://sandbox.whop.com/checkout/ch_shopfixture/' });
  return order;
}
async function deliver(f: Fixture, value: ReturnType<typeof payment>, options: { id?: string; type?: string; data?: unknown; disputeStatus?: string; closeFails?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toMatch(/^https:\/\/sandbox-api\.whop\.com\/api\/v1\//);
    if (init?.method === 'DELETE') return options.closeFails ? new Response('', { status: 503 }) : Response.json({ id: 'ch_shopfixture', deleted: true });
    if (url.includes('/disputes/')) return Response.json({ id: 'dspt_shopfixture', account_id: account, payment: { id: value.id }, status: options.disputeStatus ?? 'under_review' });
    return Response.json(value);
  });
  vi.stubGlobal('fetch', fetchMock);
  expect((await f.t.action(internal.whopNode.receive, signedEvent(options.data ?? value, options.id, options.type))).status).toBe(200);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  return fetchMock;
}
async function funded() {
  const f = await setup();
  const order = await begin(f);
  await deliver(f, payment(order.intentId));
  return { ...f, order };
}

describe('approved sandbox shop catalog and authenticated checkout', () => {
  it('uses canonical birds without provisioning its own flock or synthetic ownership', async () => {
    const f = await setup();
    const state = await f.alice.query(api.shop.snapshot, {});
    expect(state.birds.map(b => b.id)).toEqual(f.birds.map(b => b.id));
    expect(state.birds).toHaveLength(5);
    expect(state.points).toBe(0); expect(state.inventory).toEqual([]);
    expect(state.capabilities.boosters).toBe(false); expect(state.capabilities.stones).toBe(false);
    await expect(f.t.query(api.shop.snapshot, {})).rejects.toThrow('Sign in');
    expect(await f.alice.query(api.onboarding.flock, {})).toEqual({ pigeons: f.birds });
  });
  it('fails closed without explicit approval even when credentials are shaped correctly', async () => {
    const f = await setup();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const [key, value] of [['PIGEON_SHOP_CHANNEL', 'native'], ['PIGEON_SHOP_SANDBOX_CATALOG', '{}'], ['PIGEON_SHOP_SANDBOX_CATALOG', catalog.replace('"cents":100', '"cents":1')]]) {
      vi.stubEnv('PIGEON_SHOP_CHANNEL', 'standalone-web-sandbox'); vi.stubEnv('PIGEON_SHOP_SANDBOX_CATALOG', catalog); vi.stubEnv(key, value);
      expect((await f.alice.query(api.shop.snapshot, {})).capabilities.checkout).toBe(false);
      await expect(f.alice.action(api.commerce.checkout, { sku: 'points-100', requestKey: 'disabled-checkout' })).rejects.toThrow('approved');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('validates current product/variant/price and persists one stable user-owned checkout', async () => {
    const f = await setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['Api-Version-Date']).toBe(WHOP_API_VERSION);
      if (url.includes('/variants/')) return Response.json({ id: variant, account: { id: account }, product: { id: product }, billing_type: 'one_time', initial_price: 1, currency: 'usd', tax_type: 'exclusive', adaptive_pricing_enabled: false, allow_multiple_quantity: false, release_method: 'buy_now', visibility: 'visible', expiration_days: null });
      const body = JSON.parse(init?.body as string);
      expect(body.variant_id).toBe(variant); expect(body.plan_id).toBeUndefined();
      expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe(`pigeon-${body.metadata.order_id}`);
      return Response.json({ ...body, id: 'ch_shopfixture', variant: { id: variant, billing_type: 'one_time', initial_price: 1, currency: 'usd', adaptive_pricing_enabled: false }, purchase_url: 'https://sandbox.whop.com/checkout/ch_shopfixture/' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const order = await f.alice.action(api.commerce.checkout, { sku: 'points-100', requestKey: 'test-checkout' });
    expect(order.status).toBe('pending'); expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await f.alice.action(api.commerce.checkout, { sku: 'points-100', requestKey: 'test-checkout' })).toEqual(order);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await f.bob.query(api.commerce.order, { id: order.id })).toBeNull();
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(0);
    await expect(f.alice.action(api.commerce.checkout, { sku: 'points-550', requestKey: 'test-checkout' })).rejects.toThrow('another item');
  });
  it('deduplicates the original request key and rejects competing pending keys', async () => {
    const f = await setup();
    const results = await Promise.all([f.alice.mutation(internal.commerceData.beginCheckout, { sku: 'points-100', requestKey: 'concurrent-one', intentId: 'intent-one' }), f.alice.mutation(internal.commerceData.beginCheckout, { sku: 'points-100', requestKey: 'concurrent-one', intentId: 'intent-two' })]);
    expect(results[0]._id).toBe(results[1]._id);
    await expect(f.alice.mutation(internal.commerceData.beginCheckout, { sku: 'points-100', requestKey: 'different-key', intentId: 'third' })).rejects.toThrow('original request key');
    await expect(f.alice.mutation(internal.commerceData.beginCheckout, { sku: 'points-550', requestKey: 'different-pack', intentId: 'third' })).rejects.toThrow('pending');
  });
  it('does not recreate ambiguous checkouts beyond provider idempotency retention', async () => {
    const f = await setup(); const pending = await begin(f, false);
    await f.t.run(ctx => ctx.db.patch('commerceOrders', pending._id, { createdAt: Date.now() - 23 * 3600000 - 1000 }));
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const order = await f.alice.action(api.commerce.checkout, { sku: 'points-100', requestKey: 'fixture-checkout' });
    expect(order.status).toBe('reconciliation'); expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('server-authoritative wallet and accessory transactions', () => {
  it('credits verified payment exactly once and closes the reusable checkout', async () => {
    const f = await funded();
    await deliver(f, payment(f.order.intentId), { id: 'msg_secondconfirmation' });
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(100);
    const ledger = await f.t.run(ctx => ctx.db.query('commerceLedger').collect());
    expect(ledger).toHaveLength(1); expect(ledger[0].delta).toBe(100);
    expect((await f.t.run(ctx => ctx.db.get('commerceOrders', f.order._id)))?.checkoutClosed).toBe(true);
  });
  it.each([
    ['product', { product_id: 'prod_other' }],
    ['line product', { line_items: [{ product_id: 'prod_other', variant_id: variant, quantity: 1, subtotal: money('1.00') }] }],
    ['price', { subtotal: money('0.01') }],
    ['quantity', { line_items: [{ product_id: product, variant_id: variant, quantity: 2, subtotal: money('1.00') }] }],
    ['environment', { metadata: { order_id: 'fixture-intent', environment: 'production' } }],
  ])('rejects wrong %s without a ledger credit', async (_label, changes) => {
    const f = await setup(); const order = await begin(f);
    await deliver(f, payment(order.intentId, changes));
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(0);
    expect(await f.t.run(ctx => ctx.db.query('commerceLedger').collect())).toEqual([]);
  });
  it('atomically debits, grants and equips; concurrent spends and retries never duplicate', async () => {
    const f = await funded();
    const state = await f.alice.query(api.shop.snapshot, {});
    const input = { kind: 'buy-accessory' as const, itemId: 'cloud-scarf' as const, birdId: f.birds[0].id, revision: state.revision, requestKey: 'buy-scarf-one' };
    const result = await Promise.allSettled([f.alice.mutation(api.shop.mutate, input), f.alice.mutation(api.shop.mutate, { ...input, birdId: f.birds[2].id, requestKey: 'buy-scarf-two' })]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const next = await f.alice.mutation(api.shop.mutate, input);
    expect(next.points).toBe(40); expect(next.inventory).toEqual([{ itemId: 'cloud-scarf', quantity: 1, wornBy: f.birds[0].id }]);
    const ledger = await f.t.run(ctx => ctx.db.query('commerceLedger').collect());
    expect(ledger.filter(row => row.kind === 'spend')).toHaveLength(1);
    await expect(f.alice.mutation(api.shop.mutate, { ...input, birdId: f.birds[2].id })).rejects.toThrow('different action');
  });
  it('moves one owned accessory without repurchase and verifies both ownership and wearer', async () => {
    const f = await funded();
    const bought = await f.alice.mutation(api.shop.mutate, { kind: 'buy-accessory', itemId: 'cloud-scarf', birdId: f.birds[0].id, revision: '1', requestKey: 'buy-scarf' });
    await expect(f.alice.mutation(api.shop.mutate, { kind: 'equip', itemId: 'cloud-scarf', birdId: f.others[0].id, revision: bought.revision, expectedWearer: f.birds[0].id, requestKey: 'foreign-bird' })).rejects.toThrow('not in your coop');
    const moved = await f.alice.mutation(api.shop.mutate, { kind: 'equip', itemId: 'cloud-scarf', birdId: f.birds[2].id, revision: bought.revision, expectedWearer: f.birds[0].id, requestKey: 'move-scarf' });
    expect(moved.points).toBe(40); expect(moved.inventory[0].wornBy).toBe(f.birds[2].id);
    await expect(f.alice.mutation(api.shop.mutate, { kind: 'equip', itemId: 'cloud-scarf', birdId: f.birds[0].id, revision: moved.revision, expectedWearer: f.birds[0].id, requestKey: 'stale-wearer' })).rejects.toThrow('moved');
    expect((await f.bob.query(api.shop.snapshot, {})).inventory).toEqual([]);
  });
  it('rejects insufficient points without ownership or ledger side effects', async () => {
    const f = await setup();
    await expect(f.alice.mutation(api.shop.mutate, { kind: 'buy-accessory', itemId: 'cloud-scarf', birdId: f.birds[0].id, revision: '0', requestKey: 'no-balance' })).rejects.toThrow('Not enough points');
    expect((await f.alice.query(api.shop.snapshot, {})).inventory).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.query('commerceLedger').collect())).toEqual([]);
  });
  it('records refund debt after spending, pauses accessories, and resists stale success', async () => {
    const f = await funded();
    await f.alice.mutation(api.shop.mutate, { kind: 'buy-accessory', itemId: 'cloud-scarf', birdId: f.birds[0].id, revision: '1', requestKey: 'spend-then-refund' });
    const refunded = payment(f.order.intentId, { refunded_amount: money('1.00'), substatus: 'refunded' });
    await deliver(f, refunded, { id: 'msg_shoprefund', type: 'refund.updated', data: { id: 'rf_shopfixture', status: 'succeeded', payment: { id: refunded.id } } });
    await deliver(f, payment(f.order.intentId), { id: 'msg_stalesuccess' });
    const state = await f.alice.query(api.shop.snapshot, {});
    expect(state.points).toBe(0); expect(state.capabilities.accessories).toBe(false); expect(state.inventory[0].wornBy).toBeUndefined();
    expect((await f.t.run(ctx => ctx.db.query('commerceWallets').first()))?.balance).toBe(-60);
    expect((await f.t.run(ctx => ctx.db.query('commerceLedger').collect())).filter(row => row.kind === 'refund')).toHaveLength(1);
  });
  it('suspends an open dispute and uses fresh won status over stale dispute events', async () => {
    const f = await funded();
    const data = { id: 'dspt_shopfixture', status: 'under_review', payment: { id: 'pay_shoppayment' } };
    await deliver(f, payment(f.order.intentId, { substatus: 'dispute_needs_response' }), { id: 'msg_disputeopen', type: 'dispute.updated', data });
    expect((await f.alice.query(api.shop.snapshot, {})).capabilities.accessories).toBe(false);
    const lookup = await deliver(f, payment(f.order.intentId, { substatus: 'dispute_won' }), { id: 'msg_oldopen', type: 'dispute.updated', data, disputeStatus: 'won' });
    expect(lookup.mock.calls.some(([url]) => String(url).includes('/disputes/dspt_shopfixture'))).toBe(true);
    const state = await f.alice.query(api.shop.snapshot, {});
    expect(state.capabilities.accessories).toBe(true); expect(state.points).toBe(100);
  });
  it('quarantines partial refunds without inventing a points proration rule', async () => {
    const f = await funded();
    await deliver(f, payment(f.order.intentId, { refunded_amount: money('0.50'), substatus: 'partially_refunded' }), { id: 'msg_partialrefund', type: 'refund.updated', data: { id: 'rf_partial', status: 'succeeded', payment: { id: 'pay_shoppayment' } } });
    await deliver(f, payment(f.order.intentId), { id: 'msg_staleafterpartial' });
    const state = await f.alice.query(api.shop.snapshot, {});
    expect(state.points).toBe(100); expect(state.capabilities.accessories).toBe(false);
    expect((await f.alice.query(api.commerce.order, { id: f.order.intentId }))?.status).toBe('reconciliation');
    expect((await f.t.run(ctx => ctx.db.query('commerceLedger').collect())).filter(row => row.kind === 'refund')).toHaveLength(0);
  });
  it.each([['payment.canceled', 'canceled'], ['payment.failed', 'failed']] as const)('shows %s honestly without crediting', async (type, expected) => {
    const f = await setup(); const order = await begin(f);
    await deliver(f, payment(order.intentId, { status: 'void', substatus: 'canceled' }), { type });
    expect((await f.alice.query(api.commerce.order, { id: order.intentId }))?.status).toBe(expected);
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(0);
  });
  it('reconciles a second charge for the same checkout without crediting twice', async () => {
    const f = await funded();
    await deliver(f, payment(f.order.intentId, { id: 'pay_duplicatecharge' }), { id: 'msg_duplicatecharge' });
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(100);
    expect((await f.t.run(ctx => ctx.db.query('commerceEvents').withIndex('by_eventId', q => q.eq('eventId', 'msg_duplicatecharge')).unique()))?.reason).toBe('payment_already_bound');
  });
  it('recovers a webhook-before-attachment race through restricted operator replay', async () => {
    const f = await setup(); const order = await begin(f, false);
    await deliver(f, payment(order.intentId));
    const event = (await f.t.run(ctx => ctx.db.query('commerceEvents').first()))!;
    expect(event.reason).toBe('checkout_not_attached');
    await f.alice.mutation(internal.commerceData.attachCheckout, { id: order._id, checkoutId: 'ch_shopfixture', purchaseUrl: 'https://sandbox.whop.com/checkout/ch_shopfixture/' });
    await f.t.mutation(internal.commerceData.replayVerification, { eventId: event._id });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(100);
  });
  it('does not roll back verified credit when checkout deletion needs recovery', async () => {
    const f = await setup(); const order = await begin(f);
    await deliver(f, payment(order.intentId), { closeFails: true });
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(100);
    const saved = await f.t.run(ctx => ctx.db.get('commerceOrders', order._id));
    expect(saved?.checkoutClosed).toBe(false); expect(saved?.closeAttempts).toBe(5);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'ch_shopfixture', deleted: true })));
    await f.t.mutation(internal.commerceData.retryCheckoutClosure, { orderId: order._id });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await f.t.run(ctx => ctx.db.get('commerceOrders', order._id)))?.checkoutClosed).toBe(true);
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(100);
  });
  it('does not terminate a currently pending charge from an old failure event', async () => {
    const f = await setup(); const order = await begin(f);
    await deliver(f, payment(order.intentId, { status: 'pending', substatus: 'pending' }), { type: 'payment.failed', data: payment(order.intentId, { status: 'void', substatus: 'failed' }) });
    expect((await f.alice.query(api.commerce.order, { id: order.intentId }))?.status).toBe('pending');
    expect((await f.t.run(ctx => ctx.db.get('commerceOrders', order._id)))?.checkoutClosed).toBeUndefined();
    await expect(f.alice.action(api.commerce.checkout, { sku: 'points-100', requestKey: 'new-while-processing' })).rejects.toThrow('pending');
  });
  it('does not bind a failed attempt over a later verified captured payment', async () => {
    const f = await setup(); const order = await begin(f);
    await deliver(f, payment(order.intentId, { id: 'pay_failedattempt', status: 'void', substatus: 'failed' }), { id: 'msg_attemptfailed', type: 'payment.failed' });
    expect((await f.t.run(ctx => ctx.db.get('commerceOrders', order._id)))?.paymentId).toBeUndefined();
    await deliver(f, payment(order.intentId), { id: 'msg_capturedattempt' });
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(100);
  });
  it('treats a prevented dispute as a reversal, as Whop documents', async () => {
    const f = await funded();
    await deliver(f, payment(f.order.intentId, { substatus: 'dispute_closed' }), { id: 'msg_prevented', type: 'dispute.updated', disputeStatus: 'prevented', data: { id: 'dspt_shopfixture', status: 'prevented', payment: { id: 'pay_shoppayment' } } });
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(0);
    expect((await f.alice.query(api.commerce.order, { id: f.order.intentId }))?.status).toBe('refunded');
  });
  it('credits once after a won dispute when the original success was held', async () => {
    const f = await setup(); const order = await begin(f);
    await deliver(f, payment(order.intentId, { substatus: 'dispute_under_review' }), { data: payment(order.intentId) });
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(0);
    const options = { type: 'dispute.updated', disputeStatus: 'won', data: { id: 'dspt_shopfixture', status: 'won', payment: { id: 'pay_shoppayment' } } };
    await deliver(f, payment(order.intentId, { substatus: 'dispute_won' }), { ...options, id: 'msg_wonfirst' });
    await deliver(f, payment(order.intentId, { substatus: 'dispute_won' }), { ...options, id: 'msg_wonagain' });
    expect((await f.alice.query(api.shop.snapshot, {})).points).toBe(100);
    expect((await f.t.run(ctx => ctx.db.query('commerceLedger').collect())).filter(row => row.kind === 'purchase')).toHaveLength(1);
  });
  it('rejects an old verification version and ordinary success cannot clear a dispute hold', async () => {
    const f = await funded();
    const before = (await f.t.run(ctx => ctx.db.get('commerceOrders', f.order._id)))!;
    const raw = JSON.parse(signedEvent(payment(f.order.intentId), 'msg_racedsuccess').body);
    const eventId = await f.t.mutation(internal.commerceData.ingestEvent, { eventId: raw.id, payloadHash: 'fixture-race', payload: eventPayload(raw, raw.id) });
    await deliver(f, payment(f.order.intentId, { substatus: 'dispute_under_review' }), { id: 'msg_currentdispute', type: 'dispute.updated', data: { id: 'dspt_shopfixture', status: 'under_review', payment: { id: 'pay_shoppayment' } } });
    const laterRaw = JSON.parse(signedEvent(payment(f.order.intentId), 'msg_oldverifiedsnapshot').body);
    const later = await f.t.mutation(internal.commerceData.ingestEvent, { eventId: laterRaw.id, payloadHash: 'fixture-later', payload: eventPayload(laterRaw, laterRaw.id) });
    await f.t.mutation(internal.commerceData.processPayment, { eventId: later, payment: paymentSnapshot(payment(f.order.intentId)), sourceEnvironment: 'sandbox', verificationVersion: before.verificationVersion ?? 0 });
    expect((await f.t.run(ctx => ctx.db.get('commerceEvents', later)))?.state).toBe('queued');
    expect((await f.alice.query(api.shop.snapshot, {})).capabilities.accessories).toBe(false);
    const current = (await f.t.run(ctx => ctx.db.get('commerceOrders', f.order._id)))!;
    await f.t.mutation(internal.commerceData.processPayment, { eventId: later, payment: paymentSnapshot(payment(f.order.intentId)), sourceEnvironment: 'sandbox', verificationVersion: current.verificationVersion ?? 0 });
    expect((await f.alice.query(api.commerce.order, { id: f.order.intentId }))?.status).toBe('disputed');
    expect((await f.t.run(ctx => ctx.db.get('commerceEvents', eventId)))?.state).toBe('processed');
  });
  it('schedules expiry independently of another client visit and closes the saved URL', async () => {
    const f = await setup(); const order = await begin(f, true, true);
    const job = await f.t.run(ctx => ctx.db.system.get(order.expiryJobId!));
    expect(job?.scheduledTime).toBeGreaterThanOrEqual(order.createdAt + 23 * 3600000);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'ch_shopfixture', deleted: true })));
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    const next = await f.t.run(ctx => ctx.db.get('commerceOrders', order._id));
    expect(next?.status).toBe('reconciliation'); expect(next?.checkoutClosed).toBe(true);
  });
});
