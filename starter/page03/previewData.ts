import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import type { FlockBird } from './MapScreen';

export const sampleFlock: FlockBird[] = ['Mochi', 'Pip', 'Button', 'Noodle', 'Puddle'].map(name => ({
  id: name.toLowerCase(), name, status: 'Ready', color: '#2453FF', speed: '60 km/h', deliveries: '0 deliveries', defense: 'No defense',
}));

export const sampleFriends = [
  { id: 'rowan', handle: 'rowan', city: cityById('london') },
  { id: 'mira', handle: 'mira', city: cityById('paris') },
  { id: 'leo', handle: 'leo', city: cityById('san-francisco') },
];

export function sampleFlights(now: number): FlightSummary[] {
  return [
    { id: 'dot-flight', courier: 'Dot', from: 'new-york', to: 'london', progress: 0.52, role: 'sender' as const },
    { id: 'nova-flight', courier: 'Nova', from: 'new-york', to: 'paris', progress: 0.22, role: 'sender' as const },
    { id: 'incoming-flight', courier: 'Clover', from: 'london', to: 'new-york', progress: 0.22, role: 'recipient' as const },
  ].map(flight => ({
    id: flight.id, courier: flight.courier, origin: cityById(flight.from), destination: cityById(flight.to), role: flight.role,
    visibility: 'open', defense: 'cruise', outfit: 'classic', state: 'in_flight', demo: true, attemptCount: 0,
    distanceKm: distanceKm(cityById(flight.from), cityById(flight.to)),
    departedAt: now - flight.progress * 14_400_000, arrivesAt: now + (1 - flight.progress) * 14_400_000,
  }));
}
