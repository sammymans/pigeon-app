import type { FlightSummary } from '../../src/domain';
import { flightProgress, project, routeGeometry, routePoint } from '../../src/ui/flightGeometry';
import { worldLand } from '../../src/ui/worldLand';
import { atlanticLand, type SkyMapData } from './MapScreen';

export function skyMapData(flights: FlightSummary[], selected: string | null, now: number | null): SkyMapData {
  const focus = flights.find(flight => flight.id === selected) ?? flights[0];
  if (!focus) return { land: atlanticLand, viewBox: '0 0 390 338', routes: [], labels: [{ text: 'NEW YORK', x: 40, y: 207 }, { text: 'LONDON', x: 268, y: 151 }, { text: 'ATLANTIC', x: 146, y: 233, ocean: true }], markers: [] };
  const atlantic = [focus.origin.name, focus.destination.name].sort().join('|') === 'London|New York';
  if (atlantic) {
    const progress = now === null ? 0 : flightProgress(focus, now);
    const t = focus.origin.name === 'New York' ? progress : 1 - progress;
    const x = (1 - t) ** 3 * 91 + 3 * (1 - t) ** 2 * t * 134 + 3 * (1 - t) * t ** 2 * 248 + t ** 3 * 291;
    const y = (1 - t) ** 3 * 178 + 3 * (1 - t) ** 2 * t * 60 + 3 * (1 - t) * t ** 2 * 54 + t ** 3 * 117;
    return { ...skyMapData([], null, now), routes: [{ path: 'M91 178C134 60 248 54 291 117', endpoints: [{ x: 91, y: 178 }, { x: 291, y: 117 }] }], markers: [{ id: focus.id, x: -39 + x * 1.2, y: 217.2 + y * 1.2, selected: true, label: `Open flight from ${focus.origin.name} to ${focus.destination.name}` }] };
  }
  const geometry = routeGeometry(focus);
  const width = Math.max(180, Math.abs(geometry.end.x - geometry.start.x) + 120);
  const scale = 390 / width;
  const height = 338 / scale;
  const left = (geometry.start.x + geometry.end.x - width) / 2;
  const top = (Math.min(geometry.control.y, geometry.start.y, geometry.end.y) + Math.max(geometry.start.y, geometry.end.y) - height) / 2;
  const point = (p: { x: number; y: number }) => ({ x: (p.x - left) * scale, y: (p.y - top) * scale });
  const start = point(geometry.start), end = point(geometry.end), control = point(geometry.control);
  const transformed = worldLand.map(path => path.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(Number(x) - left) * scale} ${(Number(y) - top) * scale}`));
  return { land: transformed, viewBox: '0 0 390 338', routes: [{ path: `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`, endpoints: [start, end] }], labels: [focus.origin, focus.destination].map(city => { const p = point(project(city.lat, city.lng)); return { text: city.name.toUpperCase(), x: Math.max(36, Math.min(255, p.x - 32)), y: p.y + 25 }; }), markers: flights.flatMap(flight => { const p = point(routePoint(flight, now === null ? 0 : flightProgress(flight, now))); const x = -39 + p.x * 1.2, y = 217.2 + p.y * 1.2; return x < 0 || x > 390 || y < 190 || y > 650 ? [] : [{ id: flight.id, x, y, selected: flight.id === focus.id, color: flight.id === focus.id ? '#2453FF' : '#95ACE5', label: `Open flight from ${flight.origin.name} to ${flight.destination.name}` }]; }) };
}
