import type { FlightSummary } from '../domain';

export function project(lat: number, lng: number) {
  return { x: (lng + 180) / 360 * 1000, y: (90 - lat) / 180 * 520 };
}

export function flightProgress(flight: Pick<FlightSummary, 'departedAt' | 'arrivesAt' | 'state'> & { events?: { at: number; label: string }[] }, now: number) {
  if (flight.state === 'delivered') return 1;
  const endedAt = flight.state === 'intercepted' ? flight.events?.find(event => event.label === 'Intercepted')?.at : undefined;
  return Math.max(0, Math.min(1, ((endedAt ?? now) - flight.departedAt) / Math.max(1, flight.arrivesAt - flight.departedAt)));
}

export function routeGeometry(flight: Pick<FlightSummary, 'origin' | 'destination'>) {
  const start = project(flight.origin.lat, flight.origin.lng);
  const end = project(flight.destination.lat, flight.destination.lng);
  const control = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - Math.min(110, Math.abs(start.x - end.x) * 0.22 + 24) };
  return { start, end, control, path: `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}` };
}

export function routePoint(flight: Pick<FlightSummary, 'origin' | 'destination'>, progress: number) {
  const { start, end, control } = routeGeometry(flight);
  const t = Math.max(0, Math.min(1, progress));
  return { x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x, y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y };
}
