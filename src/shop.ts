export const accessories = [
  { id: 'cap', name: 'Sunday cap', price: 80, description: 'A little shade. A lot of personality.', color: '#EAF1F7' },
  { id: 'scarf', name: 'Cloud scarf', price: 60, description: 'A little warmth for a long flight.', color: '#F2EFF8' },
  { id: 'goggles', name: 'Flight goggles', price: 90, description: 'For the very serious business of saying hello.', color: '#EEF1FF' },
] as const;
export type Accessory = typeof accessories[number]['id'];
export type ShopBird = { id: string; name: string; egg?: boolean };
export type ShopState = {
  points: number; stones: number; stoneAt: number; owned: Accessory[];
  equipped: { item: Accessory; birdId: string }[];
  treats: number; treatedBirds: string[]; guardUntil: number;
};
export type ShopAction =
  | { type: 'accessory'; item: Accessory; birdId: string }
  | { type: 'remove'; item: Accessory }
  | { type: 'treat'; birdId: string }
  | { type: 'buyTreat' }
  | { type: 'guard' }
  | { type: 'stones' };
export const TREAT_PRICE = 25;
export const GUARD_PRICE = 40;
export const STONE_PRICE = 50;
export const STONE_INTERVAL = 15 * 60 * 1000;
export const pointPacks = [
  { points: 100, price: '$1', note: 'A little top-up' },
  { points: 550, price: '$5', note: '500 + 50 bonus points' },
  { points: 1200, price: '$10', note: '1,000 + 200 bonus points' },
] as const;

export function initialShop(now: number, firstBird?: string): ShopState {
  return { points: 120, stones: 5, stoneAt: now, owned: ['cap', 'goggles'], equipped: firstBird ? [{ item: 'cap', birdId: firstBird }] : [], treats: 1, treatedBirds: [], guardUntil: 0 };
}

export function refillStones(state: ShopState, now: number): ShopState {
  if (state.stones >= 5) return { ...state, stoneAt: now };
  const elapsed = Math.max(0, Math.floor((now - state.stoneAt) / STONE_INTERVAL));
  const stones = Math.min(5, state.stones + elapsed);
  return { ...state, stones, stoneAt: stones >= 5 ? now : state.stoneAt + elapsed * STONE_INTERVAL };
}

// One shared set of rules for the local preview and atomic server transactions.
export function applyShopAction(input: ShopState, action: ShopAction, birds: ShopBird[], now: number): ShopState {
  let state = refillStones(input, now);
  const spend = (amount: number) => {
    if (state.points < amount) throw new Error('You need more points for this.');
    state = { ...state, points: state.points - amount };
  };
  if ('birdId' in action && !birds.some(bird => bird.id === action.birdId && !bird.egg)) throw new Error('Choose a pigeon from your flock.');
  switch (action.type) {
    case 'accessory': {
      const item = accessories.find(item => item.id === action.item);
      if (!item) throw new Error('This accessory is unavailable.');
      if (!state.owned.includes(item.id)) { spend(item.price); state = { ...state, owned: [...state.owned, item.id] }; }
      return { ...state, equipped: [...state.equipped.filter(entry => entry.item !== item.id && entry.birdId !== action.birdId), { item: item.id, birdId: action.birdId }] };
    }
    case 'remove': return { ...state, equipped: state.equipped.filter(entry => entry.item !== action.item) };
    case 'buyTreat': spend(TREAT_PRICE); return { ...state, treats: state.treats + 1 };
    case 'treat':
      if (state.treatedBirds.includes(action.birdId)) throw new Error('This pigeon already has a treat for its next flight.');
      if (state.treats < 1) throw new Error('Pick up a treat first.');
      return { ...state, treats: state.treats - 1, treatedBirds: [...state.treatedBirds, action.birdId] };
    case 'guard':
      if (state.guardUntil > now) throw new Error('Your flock guard is already active.');
      spend(GUARD_PRICE); return { ...state, guardUntil: now + 3_600_000 };
    case 'stones': spend(STONE_PRICE); return { ...state, stones: state.stones + 5 };
  }
}

export function wornBy(state: ShopState, birdId: string) { return state.equipped.find(entry => entry.birdId === birdId)?.item; }
