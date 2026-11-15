import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import type { api } from '../../convex/_generated/api';

export type CommerceCatalog = FunctionReturnType<typeof api.commerce.catalog>;
export type CommerceOrder = NonNullable<FunctionReturnType<typeof api.commerce.order>>;
export type CommerceOwnership = FunctionReturnType<typeof api.commerce.ownership>;
export type CheckoutSku = FunctionArgs<typeof api.commerce.checkout>['sku'];

export type SandboxOffer = {
  sku: CheckoutSku;
  amountMinor: number;
  currency: 'usd';
  testMode: true;
};

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'unconfigured'; reason: 'not-connected' | 'missing-settings' | 'unverified-catalog' }
  | { status: 'ready'; offer: SandboxOffer };

export type ReceiptState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unavailable' }
  | { status: 'order'; order: CommerceOrder };

export type PlaceholderItem = {
  id: 'cosmetic-placeholder';
  title: string;
  description: string;
};

export const placeholderItems: readonly PlaceholderItem[] = [{
  id: 'cosmetic-placeholder',
  title: 'A little something for your pigeon',
  description: 'A space for a future cosmetic. The item, artwork and price haven’t been chosen yet.',
}];
