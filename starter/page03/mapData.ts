import { cityById, type City, type FlightSummary } from '../../src/domain';
import { flightProgress } from '../../src/ui/flightGeometry';

export type Coordinate = { latitude: number; longitude: number };
export type SkyMapData = {
  focusKey: string;
  focusCoordinates: Coordinate[];
  routes: { id: string; coordinates: Coordinate[]; selected: boolean; origin: City; destination: City }[];
  markers: { id: string; coordinate: Coordinate; selected: boolean; label: string }[];
};
export type SkyMapProps = { data: SkyMapData; onSelect?: (id: string) => void; topInset: number; bottomInset: number; scope: 'mine' | 'world' };

const radians = Math.PI / 180;
const coordinate = (city: City): Coordinate => ({ latitude: city.lat, longitude: city.lng });

// Spherical interpolation keeps long flights on the short route across the Pacific.
export function flightCoordinate(origin: City, destination: City, progress: number): Coordinate {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0) return coordinate(origin);
  if (t === 1) return coordinate(destination);
  const vector = (city: City) => [Math.cos(city.lat * radians) * Math.cos(city.lng * radians), Math.cos(city.lat * radians) * Math.sin(city.lng * radians), Math.sin(city.lat * radians)];
  const a = vector(origin), b = vector(destination);
  const angle = Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, i) => sum + value * b[i], 0))));
  if (angle < 0.000001) return coordinate(origin);
  // A deterministic perpendicular gives antipodal points a finite semicircle.
  let tangent = b.map((value, i) => value - a[i] * Math.cos(angle));
  let length = Math.hypot(...tangent);
  if (length < 0.000001) {
    tangent = Math.abs(a[2]) < 0.9 ? [-a[1], a[0], 0] : [0, -a[2], a[1]];
    length = Math.hypot(...tangent);
  }
  const p = a.map((value, i) => value * Math.cos(t * angle) + tangent[i] / length * Math.sin(t * angle));
  return { latitude: Math.atan2(p[2], Math.hypot(p[0], p[1])) / radians, longitude: Math.atan2(p[1], p[0]) / radians };
}

export function routeCoordinates(origin: City, destination: City) {
  return Array.from({ length: 65 }, (_, index) => flightCoordinate(origin, destination, index / 64));
}

export function skyMapData(flights: FlightSummary[], selected: string | null, now: number | null): SkyMapData {
  const focus = flights.find(flight => flight.id === selected) ?? flights[0];
  const routes = flights.map(flight => ({ id: flight.id, coordinates: routeCoordinates(flight.origin, flight.destination), selected: flight.id === focus?.id, origin: flight.origin, destination: flight.destination }));
  return {
    focusKey: focus ? `${focus.id}:${focus.origin.id}:${focus.destination.id}` : 'atlantic',
    focusCoordinates: routes.find(route => route.selected)?.coordinates ?? routeCoordinates(cityById('new-york'), cityById('london')),
    routes,
    markers: flights.map(flight => ({ id: flight.id, coordinate: flightCoordinate(flight.origin, flight.destination, now === null ? 0 : flightProgress(flight, now)), selected: flight.id === focus?.id, label: `${flight.courier}, pigeon from ${flight.origin.name} to ${flight.destination.name}. Tap for flight details.` })),
  };
}
