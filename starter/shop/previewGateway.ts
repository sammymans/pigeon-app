import { proposedCatalog, proposedPacks, ShopFailure, type ShopGateway, type ShopOrder, type ShopSnapshot } from '../../src/shop';

export function createPreviewGateway(initialPoints = 120) {
  let snapshot: ShopSnapshot = {
    revision: '0', source: 'test-preview', points: initialPoints, serverNow: Date.now(),
    birds: [
      { id: 'preview-mochi', name: 'Mochi', appearance: 'mochi', status: 'ready' },
      { id: 'preview-pip', name: 'Pip', appearance: 'mochi', status: 'flying', returnLabel: '18m home' },
      { id: 'preview-button', name: 'Button', appearance: 'button', status: 'ready' },
      { id: 'preview-noodle', name: 'Noodle', appearance: 'mochi', status: 'flying', returnLabel: 'To Sam' },
      { id: 'preview-puddle', name: 'Puddle', appearance: 'button', status: 'flying', returnLabel: '1h home' },
    ],
    inventory: [
      { itemId: 'sunday-cap', quantity: 1, wornBy: 'preview-mochi' },
      { itemId: 'flight-goggles', quantity: 1 },
      { itemId: 'tailwind-treat', quantity: 1 },
      { itemId: 'flock-guard', quantity: 0, activeUntil: Date.now() + 42 * 60000 },
    ],
    capabilities: { accessories: true, boosters: true, stones: true, checkout: true },
  };
  const listeners = new Set<() => void>();
  const requests = new Map<string, { payload: string }>();
  const orders = new Map<string, ShopOrder>();
  const checkoutKeys = new Map<string, string>();
  const changed = () => listeners.forEach(listener => listener());
  const copy = () => structuredClone(snapshot);
  const gateway: ShopGateway = {
    read: async () => copy(),
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    mutate: async ({ command, requestKey, revision }) => {
      const payload = JSON.stringify(command);
      const previous = requests.get(requestKey);
      if (previous) {
        if (previous.payload !== payload) throw new Error('This request key belongs to another action.');
        return copy();
      }
      if (revision !== snapshot.revision) throw new ShopFailure('stale', 'Your coop changed. Refresh and confirm again.');
      const next = copy();
      const inventory = [...next.inventory];
      const bird = 'birdId' in command ? next.birds.find(b => b.id === command.birdId) : undefined;
      if ('birdId' in command && !bird) throw new Error('That pigeon is not in your coop.');
      if ((command.kind === 'buy-accessory' || command.kind === 'equip') && bird?.status !== 'ready') throw new Error('Wait until this pigeon is home to change accessories.');
      const debit = (points: number) => {
        if (next.points === null || next.points < points) throw new ShopFailure('insufficient', 'Not enough points.');
        next.points -= points;
      };
      if (command.kind === 'buy-accessory' || command.kind === 'equip') {
        const index = inventory.findIndex(i => i.itemId === command.itemId && i.quantity > 0);
        if (command.kind === 'buy-accessory') {
          if (index >= 0) throw new Error('You already own this accessory. Move it without buying again.');
          const price = proposedCatalog[command.itemId].points;
          if (price === null) throw new ShopFailure('unavailable', 'No proposed price is available for this item.');
          debit(price);
          inventory.push({ itemId: command.itemId, quantity: 1, wornBy: command.birdId });
        } else {
          if (index < 0) throw new Error('You do not own this accessory.');
          if (inventory[index].wornBy !== command.expectedWearer) throw new Error('This accessory moved. Refresh and confirm again.');
          const wearer = next.birds.find(b => b.id === inventory[index].wornBy);
          if (wearer?.status === 'flying') throw new Error('Wait until the current wearer is home.');
          inventory[index] = { ...inventory[index], wornBy: command.birdId };
        }
      } else if (command.kind === 'use-treat') {
        if (bird?.status !== 'ready') throw new Error('Choose a ready pigeon for its next flight.');
        const index = inventory.findIndex(i => i.itemId === 'tailwind-treat' && i.quantity > 0);
        if (index < 0) throw new Error('No treats left.');
        inventory[index] = { ...inventory[index], quantity: inventory[index].quantity - 1 };
      } else if (command.kind === 'activate-guard') {
        const index = inventory.findIndex(i => i.itemId === 'flock-guard');
        if (index < 0 || inventory[index].quantity < 1) throw new Error('No flock guard available.');
        if ((inventory[index].activeUntil ?? 0) > next.serverNow) throw new Error('Your flock guard is already active.');
        inventory[index] = { ...inventory[index], quantity: inventory[index].quantity - 1, activeUntil: next.serverNow + 3600000 };
      } else {
        debit(proposedCatalog.stones.points);
        const index = inventory.findIndex(i => i.itemId === 'stones');
        if (index < 0) inventory.push({ itemId: 'stones', quantity: 5 });
        else inventory[index] = { ...inventory[index], quantity: inventory[index].quantity + 5 };
      }
      snapshot = { ...next, inventory, revision: String(Number(next.revision) + 1) };
      requests.set(requestKey, { payload });
      changed();
      return copy();
    },
    checkout: async ({ sku, requestKey }) => {
      const existingId = checkoutKeys.get(requestKey);
      const existing = existingId ? orders.get(existingId) : undefined;
      if (existing) {
        if (existing.sku !== sku) throw new Error('This request key belongs to another checkout.');
        return { ...existing };
      }
      const pending = [...orders.values()].find(order => order.status === 'pending');
      if (pending) {
        if (pending.sku !== sku) throw new Error('Resolve your pending checkout before choosing a different pack.');
        return { ...pending };
      }
      const order: ShopOrder = { id: `preview-order-${orders.size + 1}`, sku, status: 'pending' };
      orders.set(order.id, order);
      checkoutKeys.set(requestKey, order.id);
      return { ...order };
    },
    order: async id => orders.has(id) ? { ...orders.get(id)! } : null,
    openCheckout: async () => { throw new Error('Test preview never opens a payment provider.'); },
  };
  return {
    gateway,
    settle: (id: string, status: ShopOrder['status']) => {
      const order = orders.get(id);
      if (!order) throw new Error('Unknown preview order.');
      if (order.status === status) return;
      if (order.status !== 'pending') throw new Error('This preview order is already settled.');
      if (status === 'paid') {
        const pack = proposedPacks.find(p => p.id === order.sku);
        if (!pack) throw new Error('Extra pigeon provisioning belongs to the shared flock, not this preview.');
        snapshot = { ...snapshot, points: (snapshot.points ?? 0) + pack.points, revision: String(Number(snapshot.revision) + 1) };
      }
      orders.set(id, { ...order, status });
      changed();
    },
  };
}
