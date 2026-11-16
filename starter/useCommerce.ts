import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { randomUUID } from 'expo-crypto';
import { api } from '../convex/_generated/api';
import type { StoreSku } from '../src/shop';
import { checkoutReturnId } from './commerceModel';

export function useCommerce() {
  const storefront = useQuery(api.commerce.storefront, {});
  const orders = useQuery(api.commerce.orders, {});
  const checkout = useAction(api.commerce.checkout);
  const [returnId, setReturnId] = useState<string | null>(null);
  const returnedOrder = useQuery(api.commerce.order, returnId ? { id: returnId } : 'skip');
  const requests = useRef<Partial<Record<StoreSku, string>>>({});
  const opening = useRef(false);

  useEffect(() => {
    let active = true;
    const accept = (url: string | null) => { const id = checkoutReturnId(url); if (active && id) setReturnId(id); };
    void Linking.getInitialURL().then(url => accept(url ?? null)).catch(() => {});
    const listener = Linking.addEventListener('url', event => accept(event.url));
    return () => { active = false; listener.remove(); };
  }, []);

  async function buy(sku: StoreSku) {
    if (opening.current) return;
    opening.current = true;
    const requestKey = requests.current[sku] ?? randomUUID();
    requests.current[sku] = requestKey;
    try {
      const order = await checkout({ sku, requestKey });
      setReturnId(order.id);
      if (order.status === 'pending' && order.purchaseUrl) await Linking.openURL(order.purchaseUrl);
      delete requests.current[sku];
    } finally { opening.current = false; }
  }

  return { storefront, orders, buy, returnId, returnedOrder };
}
