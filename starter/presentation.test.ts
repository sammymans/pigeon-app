import { describe, expect, it } from 'vitest';
import { cities, type FlightSummary, type Profile } from '../src/domain';
import { matchingFriends, visibleFlights } from './presentation';

const flight: FlightSummary = { id: 'flight', courier: 'Pigeon', origin: cities[0], destination: cities[4], visibility: 'sealed', defense: 'cruise', distanceKm: 100, departedAt: 1000, arrivesAt: 2000, state: 'in_flight', outfit: 'classic', demo: true, role: 'sender', attemptCount: 0 };

describe('map presentation', () => {
  it('never places a Sealed flight in World, even if mixed into the response', () => {
    const flights: FlightSummary[] = [flight, { ...flight, id: 'public', visibility: 'open', role: 'public' }, { ...flight, id: 'arrived', visibility: 'open', state: 'delivered' }];
    expect(visibleFlights(flights, 'world').map((entry) => entry.id)).toEqual(['public']);
  });

  it('shows only active authorized personal roles in My flights', () => {
    const flights: FlightSummary[] = [flight, { ...flight, id: 'incoming', role: 'recipient' }, { ...flight, id: 'stranger', role: 'public' }, { ...flight, id: 'arrived', state: 'delivered' }, { ...flight, id: 'caught', state: 'intercepted' }];
    expect(visibleFlights(flights, 'mine').map((entry) => entry.id)).toEqual(['flight', 'incoming']);
    expect(visibleFlights([], 'mine')).toEqual([]);
  });
});

describe('recipient presentation', () => {
  const friends: Profile[] = [{ id: 'one', handle: 'rowan', cityId: 'london', equipped: 'classic', demo: true }, { id: 'two', handle: 'mira', cityId: 'new-york', equipped: 'classic', demo: true }];

  it('searches only supplied friends by handle or home city', () => {
    expect(matchingFriends(friends, ' @RoW ').map((profile) => profile.id)).toEqual(['one']);
    expect(matchingFriends(friends, 'New York').map((profile) => profile.id)).toEqual(['two']);
    expect(matchingFriends(friends, '555-1234')).toEqual([]);
    expect(matchingFriends([], 'rowan')).toEqual([]);
    expect(matchingFriends(friends, '')).toEqual(friends);
  });
});
