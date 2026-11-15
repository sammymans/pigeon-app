import { describe, expect, it, vi } from 'vitest';
import type { ConvexReactClient } from 'convex/react';
import { getFunctionName } from 'convex/server';
import { catalogFromCommerce, createCommerceAdapter, receiptFromCommerce, sandboxPrice, validSandboxOffer } from './commerceAdapter';
import { placeholderItems, type CommerceOrder, type SandboxOffer } from './contracts';

describe('placeholder shop commerce boundary', () => {
  it('keeps placeholders separate from purchasable SKUs and prices', () => {
    expect(placeholderItems).toHaveLength(1);
    expect(placeholderItems[0].id).not.toBe('aviator');
    expect(placeholderItems[0]).not.toHaveProperty('price');
    expect(placeholderItems[0]).not.toHaveProperty('sku');
  });

  it('does not treat environment presence or the legacy price label as a verified offer', () => {
    expect(catalogFromCommerce({ configured: true, priceLabel: '$2.99 USD · one time', testMode: true }))
      .toEqual({ status: 'unconfigured', reason: 'unverified-catalog' });
    expect(catalogFromCommerce({ configured: false, priceLabel: '$2.99 USD · one time', testMode: true }))
      .toEqual({ status: 'unconfigured', reason: 'missing-settings' });
  });

  it('performs no request until explicitly read by an integrator', () => {
    const query = vi.fn();
    const adapter = createCommerceAdapter({ query } as unknown as Pick<ConvexReactClient, 'query'>);
    expect(Object.keys(adapter).sort()).toEqual(['catalog', 'ownership', 'receipt']);
    expect(query).not.toHaveBeenCalled();
  });

  it('uses the existing catalog and authenticated order and ownership queries', async () => {
    const query = vi.fn().mockResolvedValueOnce({ configured: true, priceLabel: 'legacy', testMode: true })
      .mockResolvedValueOnce(null).mockResolvedValueOnce({ owned: ['classic'], equipped: 'classic', orders: [] });
    const adapter = createCommerceAdapter({ query } as unknown as Pick<ConvexReactClient, 'query'>);
    expect((await adapter.catalog()).status).toBe('unconfigured');
    expect(await adapter.receipt('account-scoped-order')).toEqual({ status: 'unavailable' });
    expect((await adapter.ownership()).owned).toEqual(['classic']);
    expect(query.mock.calls.map(([ref, args]) => [getFunctionName(ref), args])).toEqual([
      ['commerce:catalog', {}], ['commerce:order', { id: 'account-scoped-order' }], ['commerce:ownership', {}],
    ]);
  });

  it('propagates authentication and network errors without inventing state', async () => {
    const query = vi.fn().mockRejectedValue(new Error('Sign in'));
    const adapter = createCommerceAdapter({ query } as unknown as Pick<ConvexReactClient, 'query'>);
    await expect(adapter.catalog()).rejects.toThrow('Sign in');
    await expect(adapter.receipt('unknown')).rejects.toThrow('Sign in');
    await expect(adapter.ownership()).rejects.toThrow('Sign in');
  });

  it.each<CommerceOrder['status']>(['pending', 'paid', 'failed', 'refunded', 'reconciliation'])
    ('preserves the server order status %s without deriving an entitlement', (status) => {
      const order: CommerceOrder = { id: 'fixture-order', sku: 'aviator', status, createdAt: 1 };
      expect(receiptFromCommerce(order)).toEqual({ status: 'order', order });
      expect(receiptFromCommerce(order)).not.toHaveProperty('owned');
    });

  it('does not interpret a return URL as a confirmed order', async () => {
    const query = vi.fn().mockResolvedValue(null);
    const adapter = createCommerceAdapter({ query } as unknown as Pick<ConvexReactClient, 'query'>);
    const url = 'https://pigeon.example/checkout-return?order=missing&status=paid';
    expect(await adapter.receipt(url)).toEqual({ status: 'unavailable' });
    expect(query.mock.calls[0][1]).toEqual({ id: url });
  });

  it('formats a supplied sandbox amount without inventing a price', () => {
    const offer: SandboxOffer = { sku: 'aviator', amountMinor: 1234, currency: 'usd', testMode: true };
    expect(validSandboxOffer(offer)).toBe(true);
    expect(sandboxPrice(offer)).toBe('12.34 USD · one time');
    for (const override of [{ amountMinor: NaN }, { amountMinor: 0 }, { amountMinor: -5 }, { amountMinor: 1.5 },
      { amountMinor: Number.MAX_SAFE_INTEGER + 1 }, { currency: 'eur' }, { testMode: false }, { sku: 'stones' }]) {
      expect(validSandboxOffer({ ...offer, ...override } as SandboxOffer)).toBe(false);
    }
  });
});
