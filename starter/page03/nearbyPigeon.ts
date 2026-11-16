import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import { type Coordinate, type SkyMapData } from './mapData';

export const NEARBY_RADIUS_KM = 5;
export const PREVIEW_CENTER: Coordinate = { latitude: 40.7128, longitude: -74.006 };
const MOCK_PREFIX = 'nearby-mock-';
export const isNearbyMock = (id: string) => id.startsWith(MOCK_PREFIX);

export function validCoordinate(point: Coordinate) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

// Geodesic offsets keep routes consistent at any latitude.
export function offsetCoordinate(center: Coordinate, km: number, bearingDegrees: number): Coordinate {
  const radians = Math.PI / 180;
  const angularDistance = km / 6371;
  const bearing = bearingDegrees * radians;
  const latitude = center.latitude * radians;
  const longitude = center.longitude * radians;
  const lat = Math.asin(Math.sin(latitude) * Math.cos(angularDistance) + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing));
  const lng = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude), Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(lat));
  return { latitude: lat / radians, longitude: ((lng / radians + 540) % 360) - 180 };
}

export function nearbyPigeons(center: Coordinate, now: number, serial = 0): FlightSummary[] {
  const passages = [
    { courier: 'Scout', km: 1.4, bearing: 292, heading: 62, before: 18, after: 34, from: 'Westbrook', to: 'East Bay' },
    { courier: 'Fern', km: 3.2, bearing: 24, heading: 148, before: 42, after: 23, from: 'Cedar Grove', to: 'South Point' },
    { courier: 'Sunny', km: 2.7, bearing: 157, heading: 256, before: 12, after: 57, from: 'River Park', to: 'Hillside' },
  ];
  return passages.map(({ courier, km, bearing, heading, before, after, from, to }) => {
    const passage = offsetCoordinate(center, km, bearing + serial * 11);
    const start = offsetCoordinate(passage, before, heading + 180);
    const end = offsetCoordinate(passage, after, heading);
    const city = cityById('new-york');
    const origin = { ...city, name: from, lat: start.latitude, lng: start.longitude };
    const destination = { ...city, name: to, lat: end.latitude, lng: end.longitude };
    return { id: `${MOCK_PREFIX}${courier.toLowerCase()}-${serial}`, courier, origin, destination,
      role: 'public', visibility: 'open', state: 'in_flight', defense: 'cruise', outfit: 'classic', demo: true,
      attemptCount: 0, distanceKm: distanceKm(origin, destination), departedAt: now - before * 60_000, arrivesAt: now + after * 60_000 };
  });
}

export function focusNearby(map: SkyMapData, center: Coordinate, locationKnown: boolean): SkyMapData {
  return { ...map, focusKey: `nearby:${map.focusKey}:${center.latitude}:${center.longitude}`,
    focusCoordinates: [0, 90, 180, 270].map(bearing => offsetCoordinate(center, NEARBY_RADIUS_KM, bearing)),
    nearby: { center, radiusKm: NEARBY_RADIUS_KM, locationKnown },
    markers: map.markers.map(marker => isNearbyMock(marker.id) ? { ...marker, label: `${marker.label.split(',')[0]}, nearby pigeon. Tap to intercept.` } : marker) };
}
