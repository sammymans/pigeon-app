import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { CatalogState, CommerceCatalog, CommerceOrder, ReceiptState, SandboxOffer } from './contracts';

export function catalogFromCommerce(catalog: CommerceCatalog): CatalogState {
  return {
    status: 'unconfigured',
    reason: catalog.configured ? 'unverified-catalog' : 'missing-settings',
  };
}

export function receiptFromCommerce(order: CommerceOrder | null): ReceiptState {
  return order ? { status: 'order', order } : { status: 'unavailable' };
}

export function validSandboxOffer(offer: SandboxOffer): boolean {
  return offer.testMode === true && offer.sku === 'aviator' && offer.currency === 'usd'
    && Number.isSafeInteger(offer.amountMinor) && offer.amountMinor > 0;
}

export function sandboxPrice(offer: SandboxOffer): string {
  return `${(offer.amountMinor / 100).toFixed(2)} ${offer.currency.toUpperCase()} · one time`;
}

export function createCommerceAdapter(client: Pick<ConvexReactClient, 'query'>) {
  return {
    async catalog(): Promise<CatalogState> {
      return catalogFromCommerce(await client.query(api.commerce.catalog, {}));
    },
    async receipt(orderId: string): Promise<ReceiptState> {
      return receiptFromCommerce(await client.query(api.commerce.order, { id: orderId }));
    },
    ownership() {
      return client.query(api.commerce.ownership, {});
    },
  };
}
