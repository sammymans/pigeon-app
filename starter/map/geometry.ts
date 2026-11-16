import type { FlightSummary } from '../../src/domain';

export type Coordinate = { latitude: number; longitude: number };
export type MapRegion = Coordinate & { latitudeDelta: number; longitudeDelta: number };
type Route = Pick<FlightSummary, 'origin' | 'destination'>;
const radians = Math.PI / 180;
export const worldRegion: MapRegion = { latitude: 24, longitude: -30, latitudeDelta: 110, longitudeDelta: 150 };

export function wrapLongitude(longitude: number) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

export function flightCoordinate(flight: Route, progress: number): Coordinate {
  const t = Math.max(0, Math.min(1, progress));
  const vector = (lat: number, lng: number) => [Math.cos(lat * radians) * Math.cos(lng * radians), Math.cos(lat * radians) * Math.sin(lng * radians), Math.sin(lat * radians)];
  const start = vector(flight.origin.lat, flight.origin.lng);
  const end = vector(flight.destination.lat, flight.destination.lng);
  const angle = Math.acos(Math.max(-1, Math.min(1, start.reduce((dot, value, i) => dot + value * end[i], 0))));
  if (Math.abs(Math.sin(angle)) < 0.000001) return {
    latitude: Math.max(-85, Math.min(85, flight.origin.lat + (flight.destination.lat - flight.origin.lat) * t)),
    longitude: wrapLongitude(flight.origin.lng + wrapLongitude(flight.destination.lng - flight.origin.lng) * t),
  };
  const a = Math.sin((1 - t) * angle) / Math.sin(angle);
  const b = Math.sin(t * angle) / Math.sin(angle);
  const [x, y, z] = start.map((value, i) => a * value + b * end[i]);
  return { latitude: Math.max(-85, Math.min(85, Math.atan2(z, Math.hypot(x, y)) / radians)), longitude: Math.atan2(y, x) / radians };
}

export function routeCoordinates(flight: Route) {
  return Array.from({ length: 65 }, (_, i) => flightCoordinate(flight, i / 64));
}

export function splitAtDateline(coordinates: Coordinate[]) {
  const segments: Coordinate[][] = [];
  let segment: Coordinate[] = [];
  for (const point of coordinates) {
    const previous = segment.at(-1);
    if (previous && Math.abs(point.longitude - previous.longitude) > 180) {
      const unwrapped = previous.longitude + wrapLongitude(point.longitude - previous.longitude);
      const edge = previous.longitude > 0 ? 180 : -180;
      const latitude = previous.latitude + (point.latitude - previous.latitude) * (edge - previous.longitude) / (unwrapped - previous.longitude);
      segment.push({ latitude, longitude: edge });
      segments.push(segment);
      segment = [{ latitude, longitude: -edge }];
    }
    segment.push(point);
  }
  if (segment.length) segments.push(segment);
  return segments;
}

export function fitRegion(coordinates: Coordinate[], width: number, height: number): MapRegion {
  if (!coordinates.length) return worldRegion;
  const longitudes = coordinates.map(point => (wrapLongitude(point.longitude) + 360) % 360).sort((a, b) => a - b);
  let largestGap = -1;
  let start = longitudes[0];
  for (let i = 0; i < longitudes.length; i++) {
    const next = longitudes[(i + 1) % longitudes.length] + (i === longitudes.length - 1 ? 360 : 0);
    if (next - longitudes[i] > largestGap) {
      largestGap = next - longitudes[i];
      start = next % 360;
    }
  }
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * radians / 2));
  const inverse = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / radians;
  const ys = coordinates.map(point => mercator(point.latitude));
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const spanX = Math.max(0.8 * radians, (360 - largestGap) * radians);
  const spanY = Math.max(0.8 * radians, Math.max(...ys) - Math.min(...ys));
  const scale = Math.max(spanX / Math.max(1, width - 100), spanY / Math.max(1, height - 120));
  const halfY = Math.min(Math.PI, scale * Math.max(1, height) / 2);
  const north = Math.min(85, inverse(centerY + halfY));
  const south = Math.max(-85, inverse(centerY - halfY));
  return {
    latitude: (north + south) / 2,
    longitude: wrapLongitude(start + (360 - largestGap) / 2),
    latitudeDelta: Math.min(160, north - south),
    longitudeDelta: Math.min(350, scale * Math.max(1, width) / radians),
  };
}
