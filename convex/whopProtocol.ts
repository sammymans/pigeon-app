import { ConvexError, type Infer } from 'convex/values';
import { env } from './_generated/server';
import { pointPacks, type CommerceSku } from '../src/shop';
import type { eventPayloadValidator, paymentValidator } from './commerceSchema';

export const WHOP_API_BASE = 'https://sandbox-api.whop.com/api/v1';
export const WHOP_API_VERSION = '2026-11-14-1';
export const AVIATOR_CENTS = 299;
export type PaymentSnapshot = Infer<typeof paymentValidator>;
export type EventPayload = Infer<typeof eventPayloadValidator>;

export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 512 ? value : null;
}

export function moneyCents(value: unknown): number | null {
  const money = record(value);
  if (money.currency !== 'usd' || money.decimals !== 2 || typeof money.amount !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(money.amount)) return null;
  const [whole, fraction = ''] = money.amount.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function paymentSnapshot(value: unknown): PaymentSnapshot {
  const payment = record(value);
  const metadata = record(payment.metadata);
  const items = Array.isArray(payment.line_items) ? payment.line_items : [];
  const item = record(items[0]);
  return {
    id: text(payment.id), accountId: text(payment.account_id), intentId: text(metadata.order_id),
    environment: text(metadata.environment), checkoutId: text(payment.checkout_configuration_id),
    variantId: text(payment.variant_id), currency: text(payment.currency),
    subtotalCents: moneyCents(payment.subtotal), totalCents: moneyCents(payment.total),
    taxCents: payment.tax_amount === null ? 0 : moneyCents(payment.tax_amount),
    taxBehavior: text(payment.tax_behavior),
    refundedCents: payment.refunded_amount === null ? 0 : moneyCents(payment.refunded_amount),
    status: text(payment.status), substatus: text(payment.substatus),
    validLineItem: items.length === 1 && item.variant_id === payment.variant_id && item.quantity === 1 && moneyCents(item.subtotal) !== null && moneyCents(item.subtotal) === moneyCents(payment.subtotal),
  };
}

export function eventPayload(value: unknown, headerId: string): EventPayload {
  const event = record(value);
  const data = record(event.data);
  const type = text(event.type) ?? 'unknown';
  const payment = type.startsWith('payment.') ? paymentSnapshot(data) : null;
  return {
    type, accountId: text(event.account_id), apiVersion: text(event.api_version),
    apiVersionDate: text(event.api_version_date), paymentId: payment?.id ?? text(record(data.payment).id),
    resourceStatus: text(data.status), payment, envelopeValid: event.id === headerId,
  };
}

export type WhopEnvironment = 'sandbox' | 'production';

export function activeEnvironment(): WhopEnvironment | null {
  const value = env.WHOP_ENVIRONMENT ?? 'sandbox';
  return value === 'sandbox' || value === 'production' ? value : null;
}

export function productFor(sku: CommerceSku) {
  if (sku === 'aviator') return { title: 'Aviator Pack', cents: AVIATOR_CENTS, points: 0 };
  if (sku === 'pigeon') {
    const value = env.PIGEON_PRICE_CENTS ?? '500';
    const cents = /^\d+$/.test(value) ? Number(value) : 0;
    return { title: 'One more pigeon', cents: Number.isSafeInteger(cents) && cents >= 50 && cents <= 100000 ? cents : 0, points: 0 };
  }
  const pack = pointPacks.find(pack => pack.sku === sku)!;
  return { title: `${pack.points.toLocaleString('en-US')} points`, cents: pack.cents, points: pack.points };
}

// All credentials are server-only. A typo never falls back to production.
export function whopConfig(environment = activeEnvironment()) {
  if (!environment) return null;
  const live = environment === 'production';
  const apiKey = live ? env.WHOP_LIVE_API_KEY : env.WHOP_SANDBOX_API_KEY;
  const webhookSecret = live ? env.WHOP_LIVE_WEBHOOK_SECRET : env.WHOP_SANDBOX_WEBHOOK_SECRET;
  const accountId = live ? env.WHOP_LIVE_ACCOUNT_ID : env.WHOP_SANDBOX_ACCOUNT_ID;
  const origin = env.PIGEON_PUBLIC_ORIGIN;
  if (!apiKey?.trim() || !webhookSecret?.startsWith('ws_') || !accountId?.match(/^biz_[A-Za-z0-9]+$/) || !origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return { apiKey, webhookSecret, accountId, origin: url.origin, environment };
  } catch { return null; }
}

export function productConfig(sku: CommerceSku) {
  const config = whopConfig();
  if (!config || !productFor(sku).cents) return null;
  const variants = config.environment === 'production' ? {
    aviator: env.WHOP_LIVE_VARIANT_ID, points_100: env.WHOP_LIVE_POINTS_100_VARIANT_ID,
    points_550: env.WHOP_LIVE_POINTS_550_VARIANT_ID, points_1200: env.WHOP_LIVE_POINTS_1200_VARIANT_ID,
    pigeon: env.WHOP_LIVE_PIGEON_VARIANT_ID,
  } : {
    aviator: env.WHOP_SANDBOX_VARIANT_ID, points_100: env.WHOP_SANDBOX_POINTS_100_VARIANT_ID,
    points_550: env.WHOP_SANDBOX_POINTS_550_VARIANT_ID, points_1200: env.WHOP_SANDBOX_POINTS_1200_VARIANT_ID,
    pigeon: env.WHOP_SANDBOX_PIGEON_VARIANT_ID,
  };
  const variantId = variants[sku];
  if (!variantId?.match(/^plan_[A-Za-z0-9]+$/)) return null;
  return { ...config, variantId };
}

export function requireProductConfig(sku: CommerceSku) {
  const config = productConfig(sku);
  if (!config) throw new ConvexError('Whop checkout is not configured for this item. No payment has been started.');
  return config;
}

export function requireWhopConfig(environment: WhopEnvironment) {
  const config = whopConfig(environment);
  if (!config) throw new ConvexError('Whop is not configured for this environment.');
  return config;
}

export async function whopRequest(path: string, apiKey: string, body?: Record<string, unknown>, idempotencyKey?: string, environment: WhopEnvironment = 'sandbox'): Promise<unknown> {
  const base = environment === 'production' ? 'https://api.whop.com/api/v1' : WHOP_API_BASE;
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
      'Api-Version-Date': WHOP_API_VERSION,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000), redirect: 'error',
  });
  if (!response.ok) throw new ConvexError(`Whop request failed (${response.status}). Retry or contact support.`);
  return await response.json() as unknown;
}

export function paymentMismatch(payment: PaymentSnapshot, expected: {
  intentId: string; accountId: string; variantId: string; checkoutId?: string;
  environment: string; currency: string; baseCents: number; taxBasis: 'exclusive';
}): string | null {
  if (payment.accountId !== expected.accountId) return 'wrong_account';
  if (payment.environment !== expected.environment) return 'wrong_environment';
  if (payment.intentId !== expected.intentId) return 'wrong_order';
  if (!expected.checkoutId || payment.checkoutId !== expected.checkoutId) return 'wrong_checkout';
  if (payment.variantId !== expected.variantId) return 'wrong_variant';
  if (payment.currency !== expected.currency) return 'wrong_currency';
  if (!payment.validLineItem || payment.subtotalCents !== expected.baseCents) return 'wrong_base_price';
  if (payment.taxCents === null || payment.totalCents === null || payment.refundedCents === null) return 'invalid_money';
  if (payment.taxBehavior !== expected.taxBasis && (payment.taxBehavior !== null || payment.taxCents > 0)) return 'wrong_tax_basis';
  if (payment.totalCents !== expected.baseCents + payment.taxCents) return 'wrong_total';
  return null;
}
