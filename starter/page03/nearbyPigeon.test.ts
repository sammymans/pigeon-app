import { describe, expect, it } from 'vitest';
import { cityById, distanceKm } from '../../src/domain';
import { canIntercept } from '../../src/interception';
import { flightCoordinate, skyMapData, type Coordinate } from './mapData';
import { focusNearby, isNearbyMock, nearbyPigeons, NEARBY_RADIUS_KM, offsetCoordinate, PREVIEW_CENTER, validCoordinate } from './nearbyPigeon';

const kmBetween = (a: Coordinate, b: Coordinate) => distanceKm({ ...cityById('new-york'), lat: a.latitude, lng: a.longitude }, { ...cityById('new-york'), lat: b.latitude, lng: b.longitude });

describe('nearby practice pigeon', () => {
  it.each([
    ['New York', PREVIEW_CENTER],
    ['San Francisco', { latitude: 37.7749, longitude: -122.4194 }],
    ['Tokyo', { latitude: 35.6762, longitude: 139.6503 }],
    ['high latitude', { latitude: 85, longitude: 30 }],
    ['date line', { latitude: 5, longitude: 179.999 }],
  ])('keeps the entire mock route inside 5 km of %s', (_, center) => {
    const flights = nearbyPigeons(center, 1000);
    for (const flight of flights) {
      for (let index = 0; index <= 64; index++) {
        const point = flightCoordinate(flight.origin, flight.destination, index / 64);
        expect(validCoordinate(point)).toBe(true);
        expect(kmBetween(center, point)).toBeLessThan(NEARBY_RADIUS_KM);
      }
    }
    const data = focusNearby(skyMapData(flights, flights[0].id, 1000), center, true);
    for (const marker of data.markers) {
      expect(kmBetween(center, marker.coordinate)).toBeGreaterThan(1);
      for (const other of data.markers.filter(other => other.id !== marker.id)) expect(kmBetween(marker.coordinate, other.coordinate)).toBeGreaterThan(2);
    }
    expect(data.focusCoordinates.every(point => Math.abs(kmBetween(center, point) - 5) < 0.001)).toBe(true);
  });

  it('is an interceptable mock, with a new identity for each reset', () => {
    const [first] = nearbyPigeons(PREVIEW_CENTER, 1000);
    const [next] = nearbyPigeons(PREVIEW_CENTER, 2000, 1);
    expect(isNearbyMock(first.id)).toBe(true);
    expect(first).toMatchObject({ courier: 'Scout', role: 'public', visibility: 'open', demo: true });
    expect(canIntercept(first, [], 5, 1000)).toBe(true);
    expect(canIntercept(first, [first.id], 5, 1000)).toBe(false);
    expect(canIntercept(next, [first.id], 5, 2000)).toBe(true);
    expect(next.id).not.toBe(first.id);
  });

  it('frames the nearby area without jumping on clock ticks and recenters on reset', () => {
    const [flight] = nearbyPigeons(PREVIEW_CENTER, 1000);
    const first = focusNearby(skyMapData([flight], flight.id, 1000), PREVIEW_CENTER, false);
    const tick = focusNearby(skyMapData([flight], flight.id, 2000), PREVIEW_CENTER, false);
    const [reset] = nearbyPigeons(PREVIEW_CENTER, 2000, 1);
    const resetMap = focusNearby(skyMapData([reset], reset.id, 2000), PREVIEW_CENTER, false);
    expect(first.focusKey).toBe(tick.focusKey);
    expect(first.focusKey).not.toBe(resetMap.focusKey);
    expect(first.nearby).toMatchObject({ locationKnown: false, radiusKm: 5 });
    expect(first.markers[0].label).toContain('mock pigeon within 5 km');
    const moved = focusNearby(first, offsetCoordinate(PREVIEW_CENTER, 100, 90), true);
    expect(moved.focusKey).not.toBe(first.focusKey);
    expect(moved.nearby?.locationKnown).toBe(true);
  });

  it('rejects invalid device locations', () => {
    expect(validCoordinate({ latitude: NaN, longitude: 0 })).toBe(false);
    expect(validCoordinate({ latitude: 0, longitude: Infinity })).toBe(false);
    expect(validCoordinate({ latitude: 91, longitude: 0 })).toBe(false);
    expect(validCoordinate({ latitude: 0, longitude: -181 })).toBe(false);
    expect(validCoordinate({ latitude: 0, longitude: 0 })).toBe(true);
  });
});
