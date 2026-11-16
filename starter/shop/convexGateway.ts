import type { ConvexReactClient } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Linking, Platform } from 'react-native';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { ShopFailure, type ShopGateway } from '../../src/shop';
import { safeCheckoutUrl } from './model';

export function createConvexShopGateway(client: ConvexReactClient, accountId: string): ShopGateway {
  return {
    scopeKey: accountId,
    read: async () => {
      const snapshot = await client.query(api.shop.snapshot, {});
      return Platform.OS === 'web' ? snapshot : { ...snapshot, points: null, inventory: [], pendingOrder: undefined, capabilities: { accessories: false, boosters: false, stones: false, checkout: false, reason: 'Native paid goods are unavailable pending a storefront and distribution decision.' } };
    },
    subscribe: onChange => client.watchQuery(api.shop.snapshot, {}).onUpdate(onChange),
    mutate: async ({ command, requestKey, revision }) => {
      if (Platform.OS !== 'web') throw new ShopFailure('unavailable', 'Native paid goods are not enabled.');
      if (command.kind !== 'buy-accessory' && command.kind !== 'equip') throw new ShopFailure('unavailable', 'Paid gameplay is not enabled. Your pouch and flights are unchanged.');
      try {
        return await client.mutation(api.shop.mutate, { kind: command.kind, itemId: command.itemId, birdId: command.birdId as Id<'pigeons'>, ...(command.expectedWearer ? { expectedWearer: command.expectedWearer as Id<'pigeons'> } : {}), requestKey, revision });
      } catch (cause) {
        if (cause instanceof ConvexError && typeof cause.data === 'object' && cause.data !== null && 'code' in cause.data && 'message' in cause.data && ['insufficient', 'stale', 'unavailable', 'rejected'].includes(String(cause.data.code))) throw new ShopFailure(cause.data.code as ShopFailure['code'], String(cause.data.message));
        throw cause;
      }
    },
    checkout: async input => {
      if (Platform.OS !== 'web' || input.sku === 'extra-pigeon') throw new ShopFailure('unavailable', 'This purchase is not enabled.');
      const order = await client.action(api.commerce.checkout, { ...input, sku: input.sku });
      if (order.sku === 'aviator') throw new ShopFailure('unavailable', 'The legacy outfit is not a points pack.');
      return { ...order, sku: order.sku };
    },
    order: async id => {
      const order = await client.query(api.commerce.order, { id });
      return order && order.sku !== 'aviator' ? { ...order, sku: order.sku } : null;
    },
    openCheckout: async url => {
      if (Platform.OS !== 'web' || !safeCheckoutUrl(url)) throw new ShopFailure('unavailable', 'Only approved web sandbox checkout is supported.');
      await Linking.openURL(url);
    },
  };
}
