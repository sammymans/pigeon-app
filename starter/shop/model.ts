import { accessoryIds, type AccessoryId, type ItemId, type ShopEntry, type ShopExit, type ShopSnapshot } from '../../src/shop';

export type ShopPage = { screen: 'coop' } | { screen: 'catalog'; ownedOnly: boolean } | { screen: 'item'; itemId: ItemId } | { screen: 'stones' };
export type ShopSession = { entry: ShopEntry; page: ShopPage; selectedBirdId?: string; pointsReturn?: ShopPage };

export function startSession(entry: ShopEntry, snapshot: ShopSnapshot): ShopSession {
  const requested = 'selectedBirdId' in entry ? entry.selectedBirdId : undefined;
  const bird = snapshot.birds.find(b => b.id === requested && b.status === 'ready') ?? snapshot.birds.find(b => b.status === 'ready');
  return { entry, selectedBirdId: bird?.id, page: entry.from === 'sky' ? { screen: 'stones' } : entry.from === 'shop' ? { screen: 'catalog', ownedOnly: entry.ownedOnly ?? false } : entry.from === 'item' ? { screen: 'item', itemId: entry.itemId } : { screen: 'coop' } };
}

export function exitSession(session: ShopSession, snapshot: ShopSnapshot, confirm = false): ShopExit {
  if (confirm) {
    const bird = snapshot.birds.find(b => b.id === session.selectedBirdId);
    if (!bird || bird.status !== 'ready') throw new Error('Choose a ready pigeon first.');
    return { to: 'compose', selectedBirdId: bird.id, confirmed: true, ...(session.entry.from === 'compose' ? { draftKey: session.entry.draftKey } : {}) };
  }
  if (session.entry.from === 'compose') return { to: 'compose', selectedBirdId: session.entry.selectedBirdId, draftKey: session.entry.draftKey, confirmed: false };
  return { to: session.entry.from === 'sky' ? 'sky' : 'home' };
}

export function wornAccessories(snapshot: ShopSnapshot, birdId: string): AccessoryId[] {
  return snapshot.inventory.filter(item => item.quantity > 0 && item.wornBy === birdId && accessoryIds.includes(item.itemId as AccessoryId)).map(item => item.itemId as AccessoryId);
}

export function openPoints(session: ShopSession): ShopSession {
  return session.pointsReturn ? session : { ...session, pointsReturn: session.page };
}

export function leavePoints(session: ShopSession): ShopSession {
  return { ...session, page: session.pointsReturn ?? session.page, pointsReturn: undefined };
}

export function guardRemaining(snapshot: ShopSnapshot): number {
  return Math.max(0, Math.ceil(((snapshot.inventory.find(i => i.itemId === 'flock-guard')?.activeUntil ?? 0) - snapshot.serverNow) / 60000));
}

export function safeCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'sandbox.whop.com' && !url.username && !url.password && !url.port && url.pathname.startsWith('/checkout/');
  } catch { return false; }
}
