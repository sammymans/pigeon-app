import { describe, expect, it, vi } from 'vitest';
import { catchPosition, isHit } from '../../src/domain';
import { CatchSession, sessionFrame } from './CatchSession';
import type { Attempt, AttemptResult } from './contract';

function setup(options: Partial<Attempt> = {}) {
  let now = 100;
  const attempt: Attempt = { id: 'attempt', flightId: 'flight', phases: [0, Math.PI / 2, Math.PI], defense: 'cruise', startedAt: 1_000_000, serverTime: 1_000_000, expiresAt: 1_010_000, ...options };
  const result: AttemptResult = { flightId: 'flight', hits: [false, false, false], outcome: 'missed' };
  const reserve = vi.fn(async () => attempt);
  const resolve = vi.fn(async () => result);
  const session = new CatchSession('flight', { reserve, resolve }, () => now);
  session.setAvailable(true);
  return { session, reserve, resolve, attempt, time: (time: number) => { now = time; }, result };
}

describe('interception session', () => {
  it('uses the existing round-local sine, exact boundaries, and one monotonic tap per round', async () => {
    const { session, time, resolve, attempt } = setup();
    await session.reserve();
    time(100); session.tap();
    time(500); session.tap();
    expect(session.getSnapshot().taps).toEqual([0, null, null]);
    time(2099); session.tick(); expect(sessionFrame(session.getSnapshot())?.round).toBe(0);
    time(2100); session.tap(); expect(sessionFrame(session.getSnapshot())?.round).toBe(1);
    time(4445.9); session.tap();
    const frame = sessionFrame(session.getSnapshot())!;
    expect(frame.position).toBe(catchPosition(345, attempt.phases[2]));
    expect(frame.hits).toEqual([true, false, isHit(345, attempt.phases[2])]);
    expect(session.getSnapshot().taps).toEqual([0, 2000, 4345]);
    time(6100); session.tap(); session.tick();
    expect(sessionFrame(session.getSnapshot())?.canTap).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
    time(6150); session.tick();
    await Promise.resolve();
    expect(resolve).toHaveBeenCalledExactlyOnceWith('attempt', [0, 2000, 4345]);
    expect(session.getSnapshot().result?.outcome).toBe('missed');
  });

  it('aligns rendering to the server phase but waits conservatively before resolving under asymmetric latency', async () => {
    const { session, reserve, time, resolve, attempt } = setup();
    reserve.mockImplementationOnce(async () => { time(1100); return attempt; });
    await session.reserve();
    expect(session.getSnapshot().elapsed).toBe(500);
    time(6600); session.tick();
    expect(sessionFrame(session.getSnapshot())?.finished).toBe(true);
    expect(resolve).not.toHaveBeenCalled();
    time(7150); session.tick(); await Promise.resolve();
    expect(resolve).toHaveBeenCalledExactlyOnceWith('attempt', [null, null, null]);
  });

  it('locks concurrent reservation and confirmation calls and never awards a local win', async () => {
    const { session, reserve, resolve, time } = setup({ phases: [0, 0, 0] });
    await Promise.all([session.reserve(), session.reserve()]);
    expect(reserve).toHaveBeenCalledTimes(1);
    for (const at of [100, 2100, 4100]) { time(at); session.tap(); }
    expect(sessionFrame(session.getSnapshot())?.hits).toEqual([true, true, true]);
    expect(session.getSnapshot().result).toBeNull();
    time(6150);
    await Promise.all([session.confirm(), session.confirm(), session.reserve()]);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().result?.outcome).toBe('missed');
  });

  it('does not restart or reuse taps after a disconnect, even if the connection recovers immediately', async () => {
    const { session, time, resolve } = setup();
    await session.reserve();
    session.tap();
    session.setAvailable(false);
    time(200); session.tap(); session.setAvailable(true);
    time(6150); session.tick();
    expect(resolve).not.toHaveBeenCalled();
    expect(session.getSnapshot().abandoned).toBe(true);
    time(10150); session.tick(); await Promise.resolve();
    expect(resolve).toHaveBeenCalledExactlyOnceWith('attempt', [null, null, null]);
  });

  it('remains unavailable while offline and catches up after a background interruption', async () => {
    const { session, time, resolve } = setup();
    await session.reserve(); session.setAvailable(false);
    time(20_000); session.tick(); expect(resolve).not.toHaveBeenCalled();
    session.setAvailable(true); session.tick(); await Promise.resolve();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().elapsed).toBe(19_900);
  });

  it('retries the identical submitted payload and trusts an immutable server result after a lost response', async () => {
    const { session, time, resolve } = setup();
    resolve.mockRejectedValueOnce(new Error('response lost'));
    await session.reserve(); session.tap(); time(6150); await session.confirm();
    expect(session.getSnapshot().phase).toBe('resolve-error');
    session.tick(); expect(resolve).toHaveBeenCalledTimes(1);
    session.setAvailable(false); session.setAvailable(true); time(10150);
    await session.confirm();
    expect(resolve.mock.calls).toEqual([['attempt', [0, null, null]], ['attempt', [0, null, null]]]);
    expect(session.getSnapshot().phase).toBe('result');
  });

  it('recovers a lost reservation response without restarting its server lease', async () => {
    const { session, reserve, time, resolve, attempt } = setup();
    reserve.mockRejectedValueOnce(new Error('response lost'));
    await session.reserve(); expect(session.getSnapshot().phase).toBe('reserve-error');
    time(1100); reserve.mockResolvedValueOnce({ ...attempt, serverTime: attempt.startedAt + 1000 });
    await session.reserve();
    expect(session.getSnapshot()).toMatchObject({ elapsed: 1000, abandoned: true });
    session.tap(); expect(session.getSnapshot().taps).toEqual([null, null, null]);
    time(10150); session.tick(); await Promise.resolve();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('marks a pending reservation interrupted and ignores taps until it is confirmed', async () => {
    const { session, reserve, attempt } = setup();
    let finish!: (attempt: Attempt) => void;
    reserve.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = session.reserve();
    session.tap(); session.setAvailable(false); session.setAvailable(true); finish(attempt);
    await pending;
    expect(session.getSnapshot()).toMatchObject({ abandoned: true, taps: [null, null, null] });
  });
});
