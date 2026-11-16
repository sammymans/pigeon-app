import { describe, expect, it } from 'vitest';
import { cityById, distanceKm } from '../../src/domain';
import { nearbyPigeons } from './nearbyPigeon';
import { nearbyPerson, previewPeople, type PreviewLetter } from './previewMail';
import { previewRoute, senderLocation } from './previewRouting';

it('keeps each captured sender fixed when the device location changes', () => {
  const [scout, fern] = nearbyPigeons({ latitude: 37.7749, longitude: -122.4194 }, 1000);
  const person = { id: 'avery', name: 'Avery', city: 'Nearby' };
  const letters: PreviewLetter[] = [scout, fern].map(flight => ({ id: flight.id, personId: person.id, body: 'Hello', direction: 'incoming', state: 'intercepted', courier: flight.courier, at: 1000, arrivesAt: 1000, opened: true, replyDestination: flight.origin }));
  const origin = senderLocation({ latitude: 37.78, longitude: -122.42 }, true);
  expect(previewRoute(person, origin, letters, scout.id).destination).toEqual(scout.origin);
  expect(previewRoute(person, origin, letters, fern.id).destination).toEqual(fern.origin);
});

describe('pigeon travel time', () => {
  it('uses distance and applies a treat to the next flight', () => {
    const person = { id: 'alex', name: 'Alex', city: 'London' };
    const origin = senderLocation({ latitude: 37.7749, longitude: -122.4194 }, true);
    const normal = previewRoute(person, origin, []);
    const treated = previewRoute(person, origin, [], undefined, true);
    expect(normal.destination).toEqual(cityById('london'));
    expect(normal.durationMs / 1000).toBe(Math.ceil(distanceKm(origin, cityById('london')) / 60 * 3600));
    expect(treated.durationMs).toBe(Math.ceil(normal.durationMs / 1000 * 0.9) * 1000);
  });
  it('sends to someone nearby on a nonzero route near the device', () => {
    const origin = senderLocation({ latitude: 35.6762, longitude: 139.6503 }, true);
    const route = previewRoute(nearbyPerson, origin, []);
    expect(route.distanceKm).toBeCloseTo(2.1);
    expect(route.destination.lat).toBeCloseTo(35.693, 2);
    expect(route.durationMs).toBeGreaterThanOrEqual(120_000);
  });
});


it('calculates the fixed Sammy route with distance / speed and a consistent tailwind', () => {
  const sammy = previewPeople.find(person => person.id === 'sammy')!;
  const route = previewRoute(sammy, cityById('tokyo'), []);
  expect(route.origin).toEqual(cityById('san-francisco'));
  expect(route.destination).toEqual(cityById('vancouver'));
  expect(route.distanceKm).toBeCloseTo(1280.84, 0);
  expect(route.durationMs).toBe(Math.ceil(route.distanceKm / 60 * 3600) * 1000);
  expect(route.estimate).toBe('21h 21m');
  const treated = previewRoute(sammy, cityById('tokyo'), [], undefined, true);
  expect(treated.durationMs).toBe(Math.ceil(route.durationMs / 1000 * 0.9) * 1000);
  expect(treated.estimate).toBe('19h 13m');
});
