import { describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import type { CatchTransport, GameData } from './contract';
import { SlingshotSession } from './SlingshotSession';
import { SCENE } from './trajectory';

function setup() {
  let time = 100;
  let data: GameData = { serverTime: 1_000_000, pouch: { count: 6, capacity: 12, nextRefillAt: null }, encounter: { id: 'encounter', flightId: 'flight', version: 'slingshot-v1', preparedAt: 1_000_000, readyUntil: 1_030_000, armedAt: null, fireUntil: null, finishBy: null, shotLimit: 2, seed: 1, state: 'ready', endedAt: null, shots: [] } };
  const transport = {
    sync: vi.fn(async (): Promise<GameData> => ({ ...data, encounter: null })),
    prepare: vi.fn(async () => data),
    arm: vi.fn(async (_id: string, elapsed: number) => { data = { ...data, encounter: { ...data.encounter!, armedAt: 1_000_000 + elapsed, fireUntil: 1_010_000 + elapsed, finishBy: 1_011_600 + elapsed, state: 'active' } }; return data; }),
    fire: vi.fn(async (_id: string, key: string, elapsed: number, direction: { x: number; y: number }) => { data = { ...data, pouch: { ...data.pouch, count: 5 }, encounter: { ...data.encounter!, state: 'projectile', shots: [{ key, releasedAt: 1_000_000 + elapsed, direction, endsAt: 1_001_600 + elapsed, outcome: 'flying' }] } }; return data; }),
    end: vi.fn(async () => { data = { ...data, encounter: { ...data.encounter!, state: 'abandoned', endedAt: 1_000_000 + time - 100 } }; return data; }),
  } satisfies CatchTransport;
  const session = new SlingshotSession('flight', transport, () => time);
  session.setAvailable(true);
  const move = (x: number, y: number) => session.move({ x: SCENE.fork.x + x, y: SCENE.fork.y + y });
  return { session, transport, move, time: (value: number) => { time = value; }, data: () => data };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('monotonic slingshot gesture and submission controller', () => {
  it('arms at 32 points once and cancelling within 24 costs nothing without resetting the clock', async () => {
    const { session, transport, move } = setup(); await session.load();
    expect(session.begin(SCENE.fork)).toBe(true);
    move(0, 31.9); expect(transport.arm).not.toHaveBeenCalled();
    move(0, 32); await flush(); move(0, 60); await flush();
    expect(transport.arm).toHaveBeenCalledTimes(1);
    move(0, 24); session.release(); await flush();
    expect(transport.fire).not.toHaveBeenCalled(); expect(session.getSnapshot().data?.pouch.count).toBe(6);
    session.begin(SCENE.fork); move(0, 60); session.release(); await flush();
    expect(transport.arm).toHaveBeenCalledTimes(1); expect(transport.fire).toHaveBeenCalledTimes(1);
  });
  it('accepts the 88-point grab area, rejects outside, and uses opposite fixed direction after hysteresis', async () => {
    const { session, transport, move } = setup(); await session.load();
    expect(session.begin({ x: SCENE.fork.x + 44.1, y: SCENE.fork.y })).toBe(false);
    expect(session.begin({ x: SCENE.fork.x + 44, y: SCENE.fork.y })).toBe(true);
    move(0, 50); await flush(); move(0, 30); session.release(); await flush();
    expect(transport.fire.mock.calls[0][3]).toEqual({ x: -0, y: -1 });
    expect(session.begin(SCENE.fork)).toBe(false);
  });
  it('queues an actual release behind its arm acknowledgment without accepting another stone', async () => {
    const { session, transport, move, data } = setup(); await session.load();
    let acknowledge!: (value: GameData) => void;
    transport.arm.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    session.begin(SCENE.fork); move(0, 50); session.release();
    expect(transport.fire).not.toHaveBeenCalled();
    acknowledge({ ...data(), encounter: { ...data().encounter!, armedAt: 1_000_000, fireUntil: 1_010_000, finishBy: 1_011_600, state: 'active' } });
    await flush(); expect(transport.fire).toHaveBeenCalledTimes(1);
  });
  it('retries the exact accepted release key and payload after a lost reply', async () => {
    const { session, transport, move } = setup(); await session.load();
    transport.fire.mockRejectedValueOnce(new Error('lost reply'));
    session.begin(SCENE.fork); move(0, 80); await flush(); session.release(); await flush();
    expect(session.getSnapshot().error).not.toBe('');
    await session.retry();
    expect(transport.fire.mock.calls[0]).toEqual(transport.fire.mock.calls[1]);
    expect(session.getSnapshot().data?.pouch.count).toBe(5);
  });
  it('does not fire after the clock ends or after backgrounding while arming', async () => {
    const { session, transport, move, time } = setup(); await session.load();
    session.begin(SCENE.fork); move(0, 80); await flush(); time(10_100); session.release(); await flush();
    expect(transport.fire).not.toHaveBeenCalled();
    session.setAvailable(false); await flush();
    expect(transport.end).toHaveBeenCalledTimes(1);
    session.setAvailable(true); session.begin(SCENE.fork); move(0, 80); session.release(); await flush();
    expect(transport.fire).not.toHaveBeenCalled();
  });
  it('never resumes a previously started encounter on remount', async () => {
    const { session, transport, data } = setup();
    transport.sync.mockImplementationOnce(async () => data());
    await session.load();
    expect(transport.prepare).not.toHaveBeenCalled(); expect(transport.end).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().data?.encounter?.state).toBe('abandoned');
  });
  it('anchors the prepare response to its own round trip, excluding the initial sync', async () => {
    const { session, transport, data, time } = setup();
    transport.sync.mockImplementationOnce(async () => { time(500); return { ...data(), encounter: null, serverTime: 1_000_200 }; });
    transport.prepare.mockImplementationOnce(async () => { time(700); return { ...data(), serverTime: 1_000_500 }; });
    await session.load();
    expect(session.getSnapshot().now).toBe(1_000_600);
  });
  it('retries only preparation after its reply is lost, rather than abandoning its own encounter', async () => {
    const { session, transport } = setup();
    transport.prepare.mockRejectedValueOnce(new Error('lost prepare reply'));
    await session.load(); await session.retry();
    expect(transport.sync).toHaveBeenCalledTimes(1);
    expect(transport.prepare).toHaveBeenCalledTimes(2);
    expect(transport.end).not.toHaveBeenCalled();
    expect(session.getSnapshot().data?.encounter?.state).toBe('ready');
  });
  it('refreshes after a definitive rejection instead of replaying invalid timing forever', async () => {
    const { session, transport, move, data } = setup(); await session.load();
    transport.arm.mockRejectedValueOnce(new ConvexError('Aim timing is out of sync.'));
    transport.sync.mockImplementationOnce(async () => data());
    session.begin(SCENE.fork); move(0, 50); await flush();
    expect(session.getSnapshot().drag).toBeNull();
    expect(transport.sync).toHaveBeenCalledTimes(2);
    await session.retry();
    expect(transport.arm).toHaveBeenCalledTimes(1);
    expect(transport.fire).not.toHaveBeenCalled();
  });
  it('finishes a background interruption after an already-running result refresh', async () => {
    const { session, transport, move, time, data } = setup(); await session.load();
    session.begin(SCENE.fork); move(0, 50); await flush(); session.release(); await flush();
    let finish!: (value: GameData) => void;
    transport.sync.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    time(2000); session.tick(); session.setAvailable(false);
    finish({ ...data(), encounter: { ...data().encounter!, state: 'active', shots: data().encounter!.shots.map(shot => ({ ...shot, outcome: 'missed' })) } });
    await flush();
    expect(transport.end).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().data?.encounter?.state).toBe('abandoned');
  });
  it('shows immediate predicted flight without debiting before server acceptance', async () => {
    const { session, transport, move, data } = setup(); await session.load();
    let accept!: (value: GameData) => void;
    transport.fire.mockImplementationOnce(() => new Promise(resolve => { accept = resolve; }));
    session.begin(SCENE.fork); move(0, 70); await flush(); session.release();
    const preview = session.getSnapshot().preview!;
    expect(preview.direction).toEqual({ x: -0, y: -1 });
    expect(session.getSnapshot().data?.pouch.count).toBe(6);
    expect(session.begin(SCENE.fork)).toBe(false);
    accept({ ...data(), pouch: { ...data().pouch, count: 5 }, encounter: { ...data().encounter!, state: 'projectile', shots: [preview] } });
    await flush();
    expect(session.getSnapshot().preview).toBeNull();
    expect(session.getSnapshot().data?.pouch.count).toBe(5);
  });
  it('blocks another gesture while a definitive rejection is being reconciled', async () => {
    const { session, transport, move, data } = setup(); await session.load();
    let recover!: (value: GameData) => void;
    transport.arm.mockRejectedValueOnce(new ConvexError('Timing rejected.'));
    transport.sync.mockImplementationOnce(() => new Promise(resolve => { recover = resolve; }));
    session.begin(SCENE.fork); move(0, 50); await flush();
    expect(session.getSnapshot().busy).toBe(true);
    expect(session.begin(SCENE.fork)).toBe(false);
    recover(data()); await flush();
    expect(session.getSnapshot().busy).toBe(false);
    expect(session.begin(SCENE.fork)).toBe(true);
  });
});
