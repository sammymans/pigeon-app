export type AccessoryId = 'sunday-cap' | 'cloud-scarf' | 'flight-goggles';
export type ItemId = AccessoryId | 'tailwind-treat' | 'flock-guard' | 'extra-pigeon' | 'stones';
export type PackId = 'points-100' | 'points-550' | 'points-1200';
export type Bird = { id: string; name: string; appearance: 'mochi' | 'button'; status: 'ready' | 'flying'; returnLabel?: string };
export type InventoryItem = { itemId: ItemId; quantity: number; wornBy?: string; activeUntil?: number };
export type ShopSnapshot = {
  revision: string;
  source: 'server' | 'test-preview';
  birds: readonly Bird[];
  points: number | null;
  inventory: readonly InventoryItem[];
  serverNow: number;
  pendingOrder?: ShopOrder;
  capabilities: { accessories: boolean; boosters: boolean; stones: boolean; checkout: boolean; reason?: string };
};
export type PaymentStatus = 'pending' | 'paid' | 'canceled' | 'failed' | 'disputed' | 'refunded' | 'reconciliation';
export type ShopOrder = { id: string; sku: PackId | 'extra-pigeon'; status: PaymentStatus; purchaseUrl?: string };
export type ShopEntry =
  | { from: 'home'; selectedBirdId?: string }
  | { from: 'shop'; ownedOnly?: boolean; selectedBirdId?: string }
  | { from: 'compose'; selectedBirdId?: string; draftKey: string }
  | { from: 'sky' }
  | { from: 'item'; itemId: ItemId; selectedBirdId?: string };
export type ShopExit =
  | { to: 'home' | 'sky' }
  | { to: 'compose'; selectedBirdId?: string; draftKey?: string; confirmed: boolean };
export type ShopCommand =
  | { kind: 'buy-accessory' | 'equip'; itemId: AccessoryId; birdId: string; expectedWearer?: string }
  | { kind: 'use-treat'; birdId: string }
  | { kind: 'activate-guard' }
  | { kind: 'buy-stones' };
export type ShopGateway = {
  read: () => Promise<ShopSnapshot>;
  subscribe?: (onChange: () => void) => () => void;
  mutate: (input: { command: ShopCommand; requestKey: string; revision: string }) => Promise<ShopSnapshot>;
  checkout: (input: { sku: PackId | 'extra-pigeon'; requestKey: string }) => Promise<ShopOrder>;
  order: (id: string) => Promise<ShopOrder | null>;
  openCheckout: (url: string) => Promise<void>;
};

export class ShopFailure extends Error {
  constructor(public readonly code: 'insufficient' | 'stale' | 'unavailable' | 'rejected', message: string) { super(message); }
}

export const accessoryIds: readonly AccessoryId[] = ['sunday-cap', 'cloud-scarf', 'flight-goggles'];
export const proposedCatalog = {
  'sunday-cap': { title: 'Sunday cap', points: null, description: 'A little shade for a Sunday adventure.' },
  'cloud-scarf': { title: 'Cloud scarf', points: 60, description: 'A little warmth for a long flight.' },
  'flight-goggles': { title: 'Flight goggles', points: null, description: 'For the scenic route home.' },
  'tailwind-treat': { title: 'Tailwind treats', points: 40, description: 'One bird · next flight\n10% faster delivery' },
  'flock-guard': { title: 'Flock guard', points: 100, description: 'All birds · 1 hour\nHarder to intercept' },
  'extra-pigeon': { title: 'One more little friend', dollars: 1, description: 'Add a permanent pigeon' },
  stones: { title: 'A pocketful of stones', points: 50, description: '5 stones · ready for takeoff' },
} as const;
export const proposedPacks: readonly { id: PackId; points: number; dollars: number; caption: string }[] = [
  { id: 'points-100', points: 100, dollars: 1, caption: 'A little top-up' },
  { id: 'points-550', points: 550, dollars: 5, caption: '500 + 50 bonus points' },
  { id: 'points-1200', points: 1200, dollars: 10, caption: '1,000 + 200 bonus points' },
];
