import { describe, expect, it } from 'vitest';
import { SCENE, FLIGHT_MS, pullDirection, sceneTransform, stoneAt, sweepHit, targetAt, traceShot } from './trajectory';

describe('versioned deterministic slingshot trajectory', () => {
  it('uses 58pt/16pt circle collision and swept overlap without tunneling', () => {
    expect(SCENE.targetRadius + SCENE.stoneRadius).toBe(37);
    expect(sweepHit({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0.315);
    expect(sweepHit({ x: -100, y: 38 }, { x: 100, y: 38 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
    expect(sweepHit({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });
  it('uses fixed strength regardless of drag length and reverses the pull direction', () => {
    expect(pullDirection({ x: 0, y: 32 })).toEqual({ x: -0, y: -1 });
    expect(pullDirection({ x: 0, y: 96 })).toEqual(pullDirection({ x: 0, y: 32 }));
    expect(pullDirection({ x: 0, y: 0 })).toBeNull();
    expect(stoneAt(1000, { x: 0, y: -1 })).toEqual({ x: 195, y: 122 });
  });
  it('keeps target motion deterministic with smooth turns and peak speed 90pt/sec', () => {
    for (let t = 0; t < 20_000; t += 10) {
      const a = targetAt(t, 0.73); const b = targetAt(t + 10, 0.73);
      expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(0.901);
      expect(a.x).toBeGreaterThanOrEqual(58); expect(a.x).toBeLessThanOrEqual(332);
      expect(a.y).toBe(333);
    }
  });
  it('has bounded projectile lifetime, reproducible hits, and no random success roll', () => {
    const seed = -0.3;
    const hit = traceShot(0, { x: 0, y: -1 }, seed);
    expect(hit.hit).toBe(true); expect(hit.duration).toBeLessThan(FLIGHT_MS);
    expect(traceShot(0, { x: 1, y: 0 }, seed).hit).toBe(false);
    expect(traceShot(0, { x: 0, y: -1 }, seed)).toEqual(hit);
  });
  it('scales the entire scene uniformly at 390 and 320 widths without changing logical collisions', () => {
    expect(sceneTransform(390, 760)).toEqual({ scale: 1, left: 0, top: 0 });
    const layout = sceneTransform(320, 700);
    expect(layout.scale).toBeCloseTo(320 / 390);
    expect((SCENE.fork.x * layout.scale + layout.left - layout.left) / layout.scale).toBe(SCENE.fork.x);
  });
  it('counts exact tangent contact but not a gap, including two moving circles', () => {
    expect(sweepHit({ x: -100, y: 37 }, { x: 100, y: 37 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0.5);
    expect(sweepHit({ x: -100, y: 37.001 }, { x: 100, y: 37.001 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
    expect(sweepHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0.315);
  });
});
