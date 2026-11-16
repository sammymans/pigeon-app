import { describe, expect, it } from 'vitest';
import { cityById, type City } from '../../src/domain';
import { flightCoordinate, routeCoordinates, skyMapData } from './mapData';
import { sampleFlights } from './previewData';

describe('geographic flight routes', () => {
  const ny = cityById('new-york'), london = cityById('london');

  it('starts and ends at the actual city coordinates and clamps progress', () => {
    expect(flightCoordinate(ny, london, -1)).toEqual({ latitude: ny.lat, longitude: ny.lng });
    expect(flightCoordinate(ny, london, 2)).toEqual({ latitude: london.lat, longitude: london.lng });
    const middle = flightCoordinate(ny, london, 0.5);
    expect(middle.latitude).toBeGreaterThan(50);
    expect(middle.longitude).toBeGreaterThan(ny.lng);
    expect(middle.longitude).toBeLessThan(london.lng);
  });

  it('takes the short path across the Pacific rather than through Europe', () => {
    const route = routeCoordinates(cityById('san-francisco'), cityById('tokyo'));
    expect(Math.abs(route[32].longitude)).toBeGreaterThan(160);
    expect(route.every(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))).toBe(true);
  });

  it('handles the same city and antipodal coordinates without invalid map points', () => {
    expect(flightCoordinate(ny, ny, 0.5)).toEqual({ latitude: ny.lat, longitude: ny.lng });
    const origin: City = { ...ny, lat: 0, lng: 0 }, opposite: City = { ...london, lat: 0, lng: 180 };
    const p = flightCoordinate(origin, opposite, 0.5);
    expect(Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).toBe(true);
  });

  it('renders all supplied flights, selects one, and does not reset camera identity on clock ticks', () => {
    const flights = sampleFlights(1000);
    const first = skyMapData(flights, 'nova-flight', 1000);
    const later = skyMapData(flights, 'nova-flight', 2000);
    expect(first.routes).toHaveLength(3);
    expect(first.markers).toHaveLength(3);
    expect(first.routes.filter(route => route.selected).map(route => route.id)).toEqual(['nova-flight']);
    expect(first.focusKey).toBe(later.focusKey);
    expect(first.markers[0].coordinate).not.toEqual(later.markers[0].coordinate);
  });

  it('does not invent flights when given an empty sky', () => {
    const data = skyMapData([], null, null);
    expect(data.routes).toEqual([]);
    expect(data.markers).toEqual([]);
    expect(data.focusCoordinates).toHaveLength(65);
  });
});
