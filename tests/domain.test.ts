import { describe, expect, it } from 'vitest';
import { catchPosition, cityById, distanceKm, durationSeconds, formatDuration, isHit } from '../src/domain';

describe('Pigeon rules shared by the server and client', () => {
  it('uses great-circle distances and the specified real and demo formulas', () => {
    const distance = distanceKm(cityById('new-york'), cityById('london'));
    expect(distance).toBeCloseTo(5570.22, 1);
    expect(durationSeconds(distance, false, 'cruise')).toBe(Math.ceil(distance / 60 * 3600));
    expect(durationSeconds(distance, true, 'cruise')).toBe(90);
    expect(durationSeconds(distance, true, 'zigzag')).toBe(108);
    expect(durationSeconds(0, false, 'cruise')).toBe(120);
    expect(durationSeconds(0, true, 'cruise')).toBe(30);
    expect(durationSeconds(2400, true, 'zigzag')).toBe(48);
  });

  it('keeps the net at the central 24% and the period at 1600ms', () => {
    expect(catchPosition(0, 0)).toBe(0.5);
    expect(catchPosition(400, 0)).toBeCloseTo(0.95);
    expect(catchPosition(1200, 0)).toBeCloseTo(0.05);
    expect(catchPosition(1600, 0)).toBeCloseTo(0.5);
    expect(isHit(0, 0)).toBe(true);
    expect(isHit(400, 0)).toBe(false);
    expect(isHit(0, Math.asin(0.12 / 0.45))).toBe(true);
    expect(isHit(0, Math.asin(0.121 / 0.45))).toBe(false);
  });

  it('formats long journeys without making them instant', () => {
    expect(formatDuration(92 * 3600 + 50 * 60)).toBe('3d 20h');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(-5)).toBe('0s');
  });
});
