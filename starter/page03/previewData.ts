import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import type { FlockBird } from './MapScreen';

export const sampleFlock: FlockBird[] = [
  { id: 'pip', name: 'Pip', status: 'Ready', color: '#2453FF', speed: '80 km/h', deliveries: '6 deliveries', defense: 'No defense' },
  { id: 'miso', name: 'Miso', status: 'Ready', color: '#6F8BE5', speed: '72 km/h', deliveries: '12 deliveries', defense: 'No defense' },
  { id: 'dot', name: 'Dot', status: 'Flying', color: '#C8D4E5', speed: '85 km/h', deliveries: '9 deliveries', defense: 'No defense' },
  { id: 'nova', name: 'Nova', status: 'Flying', color: '#C8D4E5', speed: '90 km/h', deliveries: '18 deliveries', defense: 'No defense' },
  { id: 'egg', name: 'Egg', status: '18 min', color: '#F1F3F8', egg: true, speed: 'A little surprise', deliveries: 'On its way', defense: '1 egg' },
];

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
