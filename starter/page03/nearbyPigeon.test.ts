import { describe, expect, it } from 'vitest';
import { cityById, distanceKm } from '../../src/domain';
import { canIntercept } from '../../src/interception';
import { isLandCoordinate } from '../../src/ui/landGeometry';
import { flightCoordinate, skyMapData, type Coordinate } from './mapData';
import { focusNearby, isNearbyMock, nearbyPigeons, NEARBY_RADIUS_KM, offsetCoordinate, PREVIEW_CENTER, validCoordinate } from './nearbyPigeon';

const kmBetween = (a: Coordinate, b: Coordinate) => distanceKm({ ...cityById('new-york'), lat: a.latitude, lng: a.longitude }, { ...cityById('new-york'), lat: b.latitude, lng: b.longitude });

describe('nearby passing pigeons', () => {
  it.each([
    ['New York', PREVIEW_CENTER],
    ['San Francisco', { latitude: 37.7749, longitude: -122.4194 }],
    ['Tokyo', { latitude: 35.6762, longitude: 139.6503 }],
    ['high latitude', { latitude: 85, longitude: 30 }],
    ['date line', { latitude: 5, longitude: 179.999 }],
  ])('keeps the pigeon near %s with both endpoints on land', (_, center) => {
    const flights = nearbyPigeons(center, 1000);
    expect(flights.length).toBeGreaterThan(0);
    expect(flights.length).toBeLessThanOrEqual(3);
    for (const flight of flights) {
      expect(flight.distanceKm).toBeGreaterThan(2);
      expect(isLandCoordinate({ latitude: flight.origin.lat, longitude: flight.origin.lng })).toBe(true);
      expect(isLandCoordinate({ latitude: flight.destination.lat, longitude: flight.destination.lng })).toBe(true);
      for (let index = 0; index <= 64; index++) {
        expect(validCoordinate(flightCoordinate(flight.origin, flight.destination, index / 64))).toBe(true);
      }
    }
    const data = focusNearby(skyMapData(flights, flights[0].id, 1000), center, true);
    for (const marker of data.markers) {
      expect(kmBetween(center, marker.coordinate)).toBeGreaterThan(1);
      expect(kmBetween(center, marker.coordinate)).toBeLessThan(NEARBY_RADIUS_KM);
      for (const other of data.markers.filter(other => other.id !== marker.id)) expect(kmBetween(marker.coordinate, other.coordinate)).toBeGreaterThan(2);
    }
    expect(data.focusCoordinates.every(point => Math.abs(kmBetween(center, point) - 5) < 0.001)).toBe(true);
  });

  it.each([
    ['New York', PREVIEW_CENTER],
    ['San Francisco', { latitude: 37.7749, longitude: -122.4194 }],
    ['Los Angeles', { latitude: 34.0522, longitude: -118.2437 }],
    ['Sydney', { latitude: -33.8688, longitude: 151.2093 }],
  ])('preserves route angles, passing positions and interception time around %s after refreshes', (_, center) => {
    const headings = [62, 148, 256], bearings = [292, 24, 157], distances = [1.4, 3.2, 2.7];
    const bearingTo = (a: Coordinate, b: Coordinate) => {
      const radians = Math.PI / 180, delta = (b.longitude - a.longitude) * radians;
      return (Math.atan2(Math.sin(delta) * Math.cos(b.latitude * radians),
        Math.cos(a.latitude * radians) * Math.sin(b.latitude * radians)
        - Math.sin(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.cos(delta)) / radians + 360) % 360;
    };
    for (const serial of [0, 1, 6, 18, 32]) {
      const flights = nearbyPigeons(center, 1000, serial);
      expect(flights).toHaveLength(3);
      flights.forEach((flight, index) => {
        const passage = offsetCoordinate(center, distances[index], bearings[index] + serial * 11);
        const origin = { latitude: flight.origin.lat, longitude: flight.origin.lng };
        const destination = { latitude: flight.destination.lat, longitude: flight.destination.lng };
        expect(isLandCoordinate(origin)).toBe(true);
        expect(isLandCoordinate(destination)).toBe(true);
        expect(bearingTo(passage, origin)).toBeCloseTo((headings[index] + 180) % 360, 5);
        expect(bearingTo(passage, destination)).toBeCloseTo(headings[index], 5);
        const progress = (1000 - flight.departedAt) / (flight.arrivesAt - flight.departedAt);
        expect(kmBetween(passage, flightCoordinate(flight.origin, flight.destination, progress))).toBeLessThan(0.001);
        expect(flight.arrivesAt - 1000).toBeGreaterThanOrEqual(23 * 60_000 - 1);
      });
    }
  });

  it('is interceptable, with a new identity for each reset', () => {
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
    expect(first.markers[0].label).toContain('nearby pigeon. Tap to intercept.');
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
