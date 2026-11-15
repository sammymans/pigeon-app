import { describe, expect, it } from 'vitest';
import { cityById } from '../../domain';
import { flightProgress, project, routeGeometry, routePoint } from '../flightGeometry';

describe('server-derived sky geometry', () => {
  const route = { origin: cityById('new-york'), destination: cityById('london') };
  it('projects the bounded world without external map services', () => {
    expect(project(90, -180)).toEqual({ x: 0, y: 0 });
    expect(project(-90, 180)).toEqual({ x: 1000, y: 520 });
  });
  it('keeps the curved route attached to its city endpoints', () => {
    const geometry = routeGeometry(route);
    expect(routePoint(route, 0)).toEqual(geometry.start);
    expect(routePoint(route, 1)).toEqual(geometry.end);
    expect(routePoint(route, -1)).toEqual(geometry.start);
    expect(routePoint(route, 2)).toEqual(geometry.end);
    expect(routePoint(route, 0.5).y).toBeLessThan((geometry.start.y + geometry.end.y) / 2);
  });
  it('derives progress only from timestamps and clamps it, including after reload', () => {
    const flight = { departedAt: 1000, arrivesAt: 11000, state: 'in_flight' as const };
    expect(flightProgress(flight, 0)).toBe(0);
    expect(flightProgress(flight, 6000)).toBe(0.5);
    expect(flightProgress(flight, 20000)).toBe(1);
    expect(flightProgress({ ...flight, state: 'delivered' }, 6000)).toBe(1);
  });
  it('freezes an intercepted journey at its authoritative outcome time', () => {
    const flight = { departedAt: 1000, arrivesAt: 11000, state: 'intercepted' as const, events: [{ label: 'Intercepted', at: 4000 }] };
    expect(flightProgress(flight, 8000)).toBe(0.3);
    expect(flightProgress(flight, 20000)).toBe(0.3);
  });
});
