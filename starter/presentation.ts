import { cityById, type FlightSummary, type Profile } from '../src/domain';

export function visibleFlights(flights: FlightSummary[], scope: 'mine' | 'world') {
  return flights.filter((flight) => flight.state === 'in_flight' && (scope === 'world' ? flight.visibility === 'open' : flight.role === 'sender' || flight.role === 'recipient' || flight.role === 'catcher'));
}

export function matchingFriends(friends: Profile[], search: string) {
  const term = search.trim().replace(/^@/, '').toLocaleLowerCase();
  return friends.filter((friend) => `${friend.handle} ${cityById(friend.cityId).name}`.toLocaleLowerCase().includes(term));
}
