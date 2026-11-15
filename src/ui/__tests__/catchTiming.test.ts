import { describe, expect, it } from 'vitest';
import { catchPosition } from '../../domain';
import { attemptMonotonicStart, catchFrame, recordTap } from '../catchTiming';

describe('six-second monotonic catch', () => {
  it('uses three exact two-second rounds and the server-provided phases', () => {
    const phases = [0, Math.PI / 2, Math.PI];
    const taps = [null, null, null];
    expect(catchFrame(1999, phases, taps).round).toBe(0);
    expect(catchFrame(2000, phases, taps).round).toBe(1);
    expect(catchFrame(4000, phases, taps).round).toBe(2);
    expect(catchFrame(2345, phases, taps).position).toBe(catchPosition(345, phases[1]));
    expect(catchFrame(5999, phases, taps).canTap).toBe(true);
    expect(catchFrame(6000, phases, taps)).toMatchObject({ finished: true, remaining: 0, canTap: false });
  });
  it('records only one tap per round and never overwrites a timestamp', () => {
    const first = recordTap([null, null, null], 123.8);
    expect(first).toEqual([123, null, null]);
    expect(recordTap(first, 1400)).toBe(first);
    const second = recordTap(first, 2000);
    expect(second).toEqual([123, 2000, null]);
    expect(recordTap(second, 5999.9)).toEqual([123, 2000, 5999]);
  });
  it('rejects taps before the attempt and at or after the deadline', () => {
    const taps = [null, null, null];
    for (const value of [-1, NaN, Infinity, 6000, 10000]) expect(recordTap(taps, value)).toBe(taps);
  });
  it('scores a central 24% net while showing untapped completed rounds as misses', () => {
    const phases = [0, 0, 0];
    expect(catchFrame(2000, phases, [0, null, null]).hits).toEqual([true, null, null]);
    expect(catchFrame(4500, phases, [400, null, 4000]).hits).toEqual([false, false, true]);
    expect(catchFrame(7000, phases, [null, null, null]).hits).toEqual([false, false, false]);
  });
  it('accounts for reservation round-trip and server start offset without a wall clock', () => {
    expect(attemptMonotonicStart(1000, 1200, 500010, 500000)).toBe(1090);
    expect(attemptMonotonicStart(1000, 1200, 500000, 500000)).toBe(1100);
    expect(catchFrame(9000, [0, 0, 0], [null, null, null]).remaining).toBe(0);
  });
});
