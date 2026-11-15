import { describe, expect, it } from 'vitest';
import { motionValue } from '../src/animation/contract';

describe('cosmetic Rive state contract', () => {
  it('maps confirmed presentation states without game callbacks', () => {
    expect(['idle', 'fly', 'launch', 'caught', 'delivered'].map((motion) => motionValue(motion as 'idle', false))).toEqual([0, 1, 2, 3, 4]);
  });
  it('never animates reduced-motion outcomes', () => {
    expect(['idle', 'fly', 'launch', 'caught', 'delivered'].map((motion) => motionValue(motion as 'idle', true))).toEqual([5, 5, 5, 6, 7]);
  });
});
