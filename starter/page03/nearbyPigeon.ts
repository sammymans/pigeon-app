import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import { isLandCoordinate } from '../../src/ui/landGeometry';
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

// Move endpoints along the same great circle, keeping the passing birds and
// their headings in place. Leave a coastal inset for the simplified land data.
function landEndpoint(passage: Coordinate, preferredKm: number, bearing: number) {
  const candidate = (km: number) => {
    const point = offsetCoordinate(passage, km, bearing);
    return isLandCoordinate(point)
      && [0, 45, 90, 135, 180, 225, 270, 315].every(direction => isLandCoordinate(offsetCoordinate(point, 1, direction)))
      ? { point, km } : null;
  };
  for (let adjustment = 0; adjustment <= 100; adjustment += 0.5) {
    const shorter = preferredKm - adjustment;
    if (shorter >= 1) {
      const endpoint = candidate(shorter);
      if (endpoint) return endpoint;
    }
    if (adjustment > 0) {
      const endpoint = candidate(preferredKm + adjustment);
      if (endpoint) return endpoint;
    }
  }
  // Offshore device locations may need a longer flight to reach either coast.
  for (let km = preferredKm + 105; km < 10_000; km += 5) {
    const endpoint = candidate(km);
    if (endpoint) return endpoint;
  }
  return null;
}

export function nearbyPigeons(center: Coordinate, now: number, serial = 0): FlightSummary[] {
  const passages = [
    { courier: 'Scout', km: 1.4, bearing: 292, heading: 62, before: 18, after: 34, from: 'Westbrook', to: 'East Bay' },
    { courier: 'Fern', km: 3.2, bearing: 24, heading: 148, before: 42, after: 23, from: 'Cedar Grove', to: 'South Point' },
    { courier: 'Sunny', km: 2.7, bearing: 157, heading: 256, before: 12, after: 57, from: 'River Park', to: 'Hillside' },
  ];
  return passages.flatMap<FlightSummary>(({ courier, km, bearing, heading, before, after, from, to }) => {
    const passage = offsetCoordinate(center, km, bearing + serial * 11);
    const start = landEndpoint(passage, before, heading + 180);
    const end = landEndpoint(passage, after, heading);
    if (!start || !end) return [];
    const city = cityById('new-york');
    const origin = { ...city, name: from, lat: start.point.latitude, lng: start.point.longitude };
    const destination = { ...city, name: to, lat: end.point.latitude, lng: end.point.longitude };
    // Match progress to the adjusted distances and retain time to intercept.
    const millisecondsPerKm = Math.max(60_000, after * 60_000 / end.km);
    return { id: `${MOCK_PREFIX}${courier.toLowerCase()}-${serial}`, courier, origin, destination,
      role: 'public', visibility: 'open', state: 'in_flight', defense: 'cruise', outfit: 'classic', demo: true,
      attemptCount: 0, distanceKm: distanceKm(origin, destination), departedAt: now - start.km * millisecondsPerKm, arrivesAt: now + end.km * millisecondsPerKm };
  });
}

export function focusNearby(map: SkyMapData, center: Coordinate, locationKnown: boolean): SkyMapData {
  return { ...map, focusKey: `nearby:${map.focusKey}:${center.latitude}:${center.longitude}`,
    focusCoordinates: [0, 90, 180, 270].map(bearing => offsetCoordinate(center, NEARBY_RADIUS_KM, bearing)),
    nearby: { center, radiusKm: NEARBY_RADIUS_KM, locationKnown },
    markers: map.markers.map(marker => isNearbyMock(marker.id) ? { ...marker, label: `${marker.label.split(',')[0]}, nearby pigeon. Tap to intercept.` } : marker) };
}
