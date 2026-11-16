import { describe, expect, it } from 'vitest';
import { cities } from '../../src/domain';
import { fitRegion, flightCoordinate, routeCoordinates, splitAtDateline, worldRegion, wrapLongitude } from './geometry';

const atlantic = { origin: cities[2], destination: cities[4] };
const pacific = { origin: cities[0], destination: cities[7] };

describe('georeferenced flight paths', () => {
  it('uses city snapshots as exact endpoints and clamps progress', () => {
    expect(flightCoordinate(atlantic, -1).latitude).toBeCloseTo(atlantic.origin.lat);
    expect(flightCoordinate(atlantic, -1).longitude).toBeCloseTo(atlantic.origin.lng);
    expect(flightCoordinate(atlantic, 2).latitude).toBeCloseTo(atlantic.destination.lat);
    expect(flightCoordinate(atlantic, 2).longitude).toBeCloseTo(atlantic.destination.lng);
  });

  it('places the moving bird on the same great-circle curve as its route', () => {
    const route = routeCoordinates(atlantic);
    expect(route).toHaveLength(65);
    expect(route[32]).toEqual(flightCoordinate(atlantic, 0.5));
    expect(route[32].latitude).toBeGreaterThan(50);
  });

  it('crosses the Pacific, not Europe, and splits the dateline without a world-spanning segment', () => {
    const route = routeCoordinates(pacific);
    expect(Math.abs(flightCoordinate(pacific, 0.5).longitude)).toBeGreaterThan(150);
    const segments = splitAtDateline(route);
    expect(segments).toHaveLength(2);
    expect(Math.abs(segments[0].at(-1)!.longitude)).toBe(180);
    expect(segments[0].at(-1)!.latitude).toBeCloseTo(segments[1][0].latitude);
    for (const segment of segments) for (let i = 1; i < segment.length; i++) expect(Math.abs(segment[i].longitude - segment[i - 1].longitude)).toBeLessThanOrEqual(180);
  });

  it('handles same-city and antipodal routes without NaN or unbounded latitude', () => {
    for (const destination of [cities[0], { ...cities[0], lat: -cities[0].lat, lng: cities[0].lng + 180 }]) {
      for (const point of routeCoordinates({ origin: cities[0], destination })) {
        expect(Number.isFinite(point.latitude)).toBe(true);
        expect(Number.isFinite(point.longitude)).toBe(true);
        expect(Math.abs(point.latitude)).toBeLessThanOrEqual(85);
      }
    }
  });
});

describe('flight framing', () => {
  it('uses a neutral world view when the sky is empty', () => {
    expect(fitRegion([], 390, 400)).toEqual(worldRegion);
  });

  it('fits a dateline-crossing route around the Pacific', () => {
    const region = fitRegion(routeCoordinates(pacific), 390, 500);
    expect(Math.abs(region.longitude)).toBeGreaterThan(150);
    expect(region.longitudeDelta).toBeLessThan(150);
    for (const point of routeCoordinates(pacific)) expect(Math.abs(wrapLongitude(point.longitude - region.longitude))).toBeLessThan(region.longitudeDelta / 2);
  });

  it('keeps same-city and tiny viewport framing finite and within safe world bounds', () => {
    for (const [width, height] of [[390, 400], [320, 160], [0, 0]]) {
      const region = fitRegion(routeCoordinates({ origin: cities[0], destination: cities[0] }), width, height);
      expect(region.latitudeDelta).toBeGreaterThan(0);
      expect(region.longitudeDelta).toBeGreaterThan(0);
      expect(region.latitudeDelta).toBeLessThanOrEqual(160);
      expect(region.longitudeDelta).toBeLessThanOrEqual(350);
    }
  });

  it('fits a global set without requesting a region beyond either pole', () => {
    const points = cities.flatMap((origin, i) => routeCoordinates({ origin, destination: cities[(i + 4) % cities.length] }));
    const region = fitRegion(points, 393, 448);
    expect(region.latitude + region.latitudeDelta / 2).toBeLessThanOrEqual(85);
    expect(region.latitude - region.latitudeDelta / 2).toBeGreaterThanOrEqual(-85);
    for (const point of points) expect(Math.abs(point.latitude - region.latitude)).toBeLessThan(region.latitudeDelta / 2);
  });
});
