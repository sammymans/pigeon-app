import { ConvexError, type Infer } from 'convex/values';
import { env } from './_generated/server';
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
    validLineItem: items.length === 1 && item.variant_id === payment.variant_id && item.quantity === 1 && moneyCents(item.subtotal) === AVIATOR_CENTS,
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

export function sandboxConfig() {
  const apiKey = env.WHOP_SANDBOX_API_KEY;
  const webhookSecret = env.WHOP_SANDBOX_WEBHOOK_SECRET;
  const accountId = env.WHOP_SANDBOX_ACCOUNT_ID;
  const variantId = env.WHOP_SANDBOX_VARIANT_ID;
  const origin = env.PIGEON_PUBLIC_ORIGIN;
  if (!apiKey?.trim() || !webhookSecret?.startsWith('ws_') || !accountId?.match(/^biz_[A-Za-z0-9]+$/) || !variantId?.match(/^plan_[A-Za-z0-9]+$/) || !origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return { apiKey, webhookSecret, accountId, variantId, origin: url.origin };
  } catch {
    return null;
  }
}

export function requireSandboxConfig() {
  const config = sandboxConfig();
  if (!config) throw new ConvexError('Whop sandbox is not configured. No payment has been started.');
  return config;
}

export async function whopRequest(path: string, apiKey: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<unknown> {
  const response = await fetch(`${WHOP_API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
      'Api-Version-Date': WHOP_API_VERSION,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
  });
  if (!response.ok) throw new ConvexError(`Whop sandbox request failed (${response.status}). Retry or contact the demo operator.`);
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
