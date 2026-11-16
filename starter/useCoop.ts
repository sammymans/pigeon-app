import { useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { randomUUID } from 'expo-crypto';
import { api } from '../convex/_generated/api';
import type { ShopAction } from '../src/shop';

export function useCoop() {
  const state = useQuery(api.coop.mine, {});
  const transact = useMutation(api.coop.transact);
  const pending = useRef<{ action: string; key: string } | null>(null);
  async function act(action: ShopAction) {
    const signature = JSON.stringify(action);
    const request = pending.current?.action === signature ? pending.current : { action: signature, key: randomUUID() };
    pending.current = request;
    try { await transact({ action, requestKey: request.key }); pending.current = null; }
    catch (error) { if (error instanceof ConvexError) pending.current = null; throw error; }
  }
  return { state, act };
}
