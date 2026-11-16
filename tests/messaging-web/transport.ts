import { useMemo, useSyncExternalStore } from 'react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { cityById, distanceKm, durationSeconds, type FlightDetail, type LaunchInput, type Pigeon, type Profile } from '../../src/domain';

const params = new URLSearchParams(location.search);
const profile: Profile = { id: 'fixture-owner', handle: 'rowan', equipped: 'classic', demo: false, ...(params.has('noCity') ? {} : { cityId: 'new-york' as const }) };
const friends: Profile[] = [
  { id: 'fixture-friend', handle: 'avery', cityId: 'london', equipped: 'classic', demo: false },
  { id: 'fixture-friend-2', handle: 'jules', cityId: 'paris', equipped: 'classic', demo: false },
  { id: 'fixture-friend-3', handle: 'no_city_yet', equipped: 'classic', demo: false },
];
const birds: Pigeon[] = ['Mochi', 'Pip', 'Button', 'Noodle', 'Puddle'].map((name, slot) => ({ id: `fixture-bird-${slot}`, name, ready: ![2, 3].includes(slot), deliveries: [6, 2, 1, 0, 0][slot] }));
function fixtureFlight(id: string, courier: string): FlightDetail {
  const departedAt = Date.now() - 86400000;
  return { id, courier, origin: cityById('new-york'), destination: cityById('london'), departedAt, arrivesAt: departedAt + 4 * 86400000, distanceKm: 5570, visibility: 'open', defense: 'cruise', state: 'in_flight', outfit: 'classic', demo: false, role: 'sender', senderHandle: 'rowan', recipientHandle: 'avery', attemptCount: 0, canCatch: false, canRequest: false, canResend: false, otherProfileId: 'fixture-friend', events: [] };
}

export const state = JSON.parse(sessionStorage.getItem('messaging-fixture') ?? 'null') ?? {
  profile, friends, birds, connected: true, flights: [fixtureFlight('fixture-flight-2', 'Button'), fixtureFlight('fixture-flight-3', 'Noodle')], calls: [], requests: {},
};
const listeners = new Set<() => void>();
let revision = 0;
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const version = () => revision;
function emit() { sessionStorage.setItem('messaging-fixture', JSON.stringify(state)); revision++; listeners.forEach(listener => listener()); }

export const control = {
  state, handled: 0, openFlight: (_id: string | undefined) => {}, release: () => {},
  refresh: emit,
  unavailable: (id: string) => { state.birds.find((bird: Pigeon) => bird.id === id).ready = false; emit(); },
  disconnect: () => { state.connected = false; emit(); },
  reconnect: () => { state.connected = true; emit(); },
  switchAccount: () => { control.openFlight(undefined); state.profile = { ...state.profile, id: 'fixture-other-account', handle: 'other_account' }; state.birds = []; state.flights = []; emit(); },
};
Object.assign(window, { messagingFixture: control });

export function useQuery(reference: unknown, args: any) {
  useSyncExternalStore(subscribe, version);
  if (args === 'skip') return undefined;
  const name = getFunctionName(reference as never);
  if (name === 'social:list') return state.friends.map((friend: Profile) => ({ id: friend.id, profile: friend, state: 'accepted', direction: 'outgoing' }));
  if (name === 'flock:list') return state.birds;
  if (name === 'starterPair:status') return null;
  if (name === 'flights:list') return { flights: state.flights.map(({ body, ...flight }: FlightDetail) => flight), total: state.flights.length, serverTime: Date.now() };
  if (name === 'flights:detail') return { flight: state.flights.find((flight: FlightDetail) => flight.id === args.id) ?? null, serverTime: Date.now() };
  throw new Error(`Unmocked query: ${name}`);
}

export function useMutation(reference: unknown) {
  const name = getFunctionName(reference as never);
  return useMemo(() => async (args: any) => {
    if (name === 'profiles:clock') return Date.now();
    if (name === 'flights:settleMine') return null;
    if (name === 'onboarding:ensureFlock') return { pigeons: state.birds };
    if (name === 'profiles:setCity') { state.profile = { ...state.profile, cityId: args.cityId }; emit(); return null; }
    if (name !== 'flights:launch') throw new Error(`Unmocked mutation: ${name}`);
    const input = args as LaunchInput;
    state.calls.push(input);
    emit();
    if (params.get('delay') === 'manual') await new Promise<void>(resolve => { control.release = resolve; });
    if (params.get('failure') === 'rejected' && state.calls.length === 1) throw new ConvexError('This pigeon is unavailable. Choose a ready pigeon.');
    let id = state.requests[input.requestKey];
    if (!id) {
      const bird = state.birds.find((entry: Pigeon) => entry.id === input.pigeonId);
      const friend = state.friends.find((entry: Profile) => entry.id === input.recipientId);
      if (!bird?.ready) throw new ConvexError('This pigeon is unavailable.');
      if (!state.profile.cityId || !friend?.cityId) throw new ConvexError('Both people must choose a city.');
      const origin = cityById(state.profile.cityId), destination = cityById(friend.cityId);
      const distance = distanceKm(origin, destination), departedAt = Date.now();
      id = `fixture-dispatch-${state.flights.length}`;
      state.requests[input.requestKey] = id;
      state.flights.unshift({ ...fixtureFlight(id, bird.name), origin, destination, recipientHandle: friend.handle, departedAt, arrivesAt: departedAt + durationSeconds(distance, input.demo, input.defense) * 1000, distanceKm: distance, body: input.body, anonymous: input.anonymous });
      bird.ready = false;
      bird.flightId = id;
      emit();
    }
    if (params.get('failure') === 'ambiguous' && state.calls.length === 1) throw new Error('Fixture dropped acknowledgement');
    return { id };
  }, [name]);
}
