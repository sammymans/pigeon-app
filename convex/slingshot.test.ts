/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { traceShot, type Point } from '../starter/game/trajectory';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(ctx => Promise.all(['a', 'b', 'c', 'd'].map(() => ctx.db.insert('users', {}))));
  const clients = ids.map(id => t.withIdentity({ subject: `${id}|session` }));
  const profiles = await Promise.all(clients.map((client, i) => client.mutation(api.profiles.save, { handle: `actor_${i}`, cityId: 'london' })));
  const invite = await clients[0].mutation(api.social.createInvite, {});
  await clients[1].mutation(api.social.acceptInvite, invite);
  const flight = await clients[0].mutation(api.flights.launch, { recipientId: profiles[1].id, body: 'Actual test letter', visibility: 'open', defense: 'cruise', openAcknowledged: true, demo: false, requestKey: 'first' });
  return { t, a: clients[0], b: clients[1], c: clients[2], d: clients[3], profiles, flight };
}
function aim(seed: number, elapsed: number): Point {
  for (let x = -0.6; x <= 0.6; x += 0.01) { const direction = { x, y: -Math.sqrt(1 - x * x) }; if (traceShot(elapsed, direction, seed).hit) return direction; }
  throw new Error('No reachable target');
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T22:00:00Z')); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('server-authoritative slingshot encounter', () => {
  it('keeps V1 eligibility separate from the legacy cutoff and revalidates privacy and prior attempts', async () => {
    const { t, a, b, c, d, profiles, flight } = await setup();
    expect((await c.query(api.flights.detail, flight)).flight?.canSlingshot).toBe(true);
    expect((await a.query(api.flights.detail, flight)).flight?.canSlingshot).toBe(false);
    expect((await b.query(api.flights.detail, flight)).flight?.canSlingshot).toBe(false);
    expect((await t.query(api.flights.detail, flight)).flight?.canSlingshot).toBe(false);
    await expect(a.mutation(api.slingshot.prepare, { flightId: flight.id })).rejects.toThrow('cannot be intercepted');
    await expect(b.mutation(api.slingshot.prepare, { flightId: flight.id })).rejects.toThrow('cannot be intercepted');
    await t.run(ctx => ctx.db.patch('profiles', profiles[3].id, { namespace: 'isolated:other' }));
    expect((await d.query(api.flights.detail, flight)).flight?.canSlingshot).toBe(false);
    await expect(d.mutation(api.slingshot.prepare, { flightId: flight.id })).rejects.toThrow('cannot be intercepted');
    await t.run(ctx => ctx.db.patch('flights', flight.id, { catchOpen: false, arrivesAt: Date.now() + 14_000 }));
    const detail = (await c.query(api.flights.detail, flight)).flight!;
    expect(detail.canCatch).toBe(false); expect(detail.canSlingshot).toBe(true);
    const game = await c.mutation(api.slingshot.prepare, { flightId: flight.id });
    expect((await c.query(api.flights.detail, flight)).flight?.canSlingshot).toBe(false);
    await c.mutation(api.slingshot.end, { encounterId: game.encounter!.id });
    expect((await c.query(api.flights.detail, flight)).flight?.canSlingshot).toBe(false);
    await expect(c.mutation(api.flights.reserve, { flightId: flight.id })).rejects.toThrow('already attempted');
  });
  it('rejects a release exactly at the deadline without spending and settles arrival without a client poll', async () => {
    const { t, c, flight } = await setup();
    const e = (await c.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter!;
    await c.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 0 });
    vi.setSystemTime(e.preparedAt + 10_000);
    await expect(c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'too-late', releaseElapsedMs: 10_000, direction: { x: 0, y: -1 } })).rejects.toThrow('cannot fire');
    expect((await c.query(api.stones.status, {})).count).toBe(6);
    await t.run(ctx => ctx.db.patch('flights', flight.id, { arrivesAt: Date.now() }));
    await t.mutation(internal.flights.settle, { flightId: flight.id });
    const stored = await t.run(ctx => ctx.db.get('flights', flight.id));
    expect(stored?.activeEncounterId).toBeUndefined();
    expect((await c.query(api.slingshot.state, { flightId: flight.id })).encounter?.state).toBe('delivered');
  });
  it('reserves once across concurrent catchers and keeps old/new catch engines mutually exclusive', async () => {
    const { c, d, flight } = await setup();
    const results = await Promise.allSettled([c.mutation(api.slingshot.prepare, { flightId: flight.id }), d.mutation(api.slingshot.prepare, { flightId: flight.id })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const winner = results[0].status === 'fulfilled' ? c : d; const loser = winner === c ? d : c;
    await expect(loser.mutation(api.flights.reserve, { flightId: flight.id })).rejects.toThrow('in progress');
    const first = await winner.mutation(api.slingshot.prepare, { flightId: flight.id });
    expect((await winner.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter?.id).toBe(first.encounter?.id);
    await winner.mutation(api.slingshot.end, { encounterId: first.encounter!.id });
    expect((await winner.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter?.state).toBe('abandoned');
  });
  it('charges neither prepare nor arm, fires once idempotently, and awards only computed overlap', async () => {
    const { c, b, a, t, flight } = await setup();
    const initial = await c.mutation(api.slingshot.prepare, { flightId: flight.id }); const e = initial.encounter!;
    expect(initial.pouch.count).toBe(6);
    expect((await c.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 0 })).pouch.count).toBe(6);
    const args = { encounterId: e.id, shotKey: 'one', releaseElapsedMs: 0, direction: aim(e.seed, 0) };
    const [one, retry] = await Promise.all([c.mutation(api.slingshot.fire, args), c.mutation(api.slingshot.fire, args)]);
    expect(one).toEqual(retry); expect(one.pouch.count).toBe(5); expect(one.encounter?.state).toBe('projectile');
    await expect(c.mutation(api.slingshot.fire, { ...args, direction: { x: 1, y: 0 } })).rejects.toThrow('another shot');
    await expect(c.mutation(api.slingshot.fire, { ...args, shotKey: 'two' })).rejects.toThrow('cannot fire');
    vi.setSystemTime(one.encounter!.shots[0].endsAt + 1);
    const result = await c.mutation(api.slingshot.sync, { flightId: flight.id });
    expect(result.encounter?.state).toBe('caught'); expect(result.pouch.count).toBe(5);
    expect((await c.query(api.flights.detail, flight)).flight?.body).toBe('Actual test letter');
    expect((await a.query(api.flights.detail, flight)).flight?.body).toBe('Actual test letter');
    expect((await b.query(api.flights.detail, flight)).flight?.body).toBeUndefined();
    expect((await t.query(api.flights.detail, flight)).flight?.body).toBeUndefined();
    expect((await c.mutation(api.slingshot.fire, args)).encounter?.state).toBe('caught');
  });
  it('enforces two shots, one projectile, deterministic misses and no debit for rejected releases', async () => {
    const { c, flight } = await setup(); const e = (await c.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter!;
    await c.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 0 });
    await expect(c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'invalid', releaseElapsedMs: 0, direction: { x: 5, y: 0 } })).rejects.toThrow('invalid');
    const first = await c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'one', releaseElapsedMs: 0, direction: { x: 1, y: 0 } });
    vi.setSystemTime(first.encounter!.shots[0].endsAt + 1);
    expect((await c.mutation(api.slingshot.sync, { flightId: flight.id })).encounter?.state).toBe('active');
    const second = await c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'two', releaseElapsedMs: Date.now() - e.preparedAt, direction: { x: -1, y: 0 } });
    vi.setSystemTime(second.encounter!.shots[1].endsAt + 1);
    const result = await c.mutation(api.slingshot.sync, { flightId: flight.id });
    expect(result.encounter?.state).toBe('escaped'); expect(result.pouch.count).toBe(4);
    await expect(c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'three', releaseElapsedMs: Date.now() - e.preparedAt, direction: { x: 0, y: -1 } })).rejects.toThrow('cannot fire');
  });
  it('uses one shot with one stone and lets an accepted pre-deadline projectile finish, but arrival always wins', async () => {
    const { t, c, b, profiles, flight } = await setup();
    await t.run(ctx => ctx.db.insert('stonePouches', { profileId: profiles[2].id, count: 1, nextRefillAt: Date.now() + 1_200_000 }));
    const e = (await c.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter!; expect(e.shotLimit).toBe(1);
    await c.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 0 });
    vi.setSystemTime(e.preparedAt + 9999);
    const fired = await c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'last', releaseElapsedMs: 9999, direction: aim(e.seed, 9999) });
    vi.setSystemTime(e.preparedAt + 10_001);
    expect((await c.mutation(api.slingshot.sync, { flightId: flight.id })).encounter?.state).toBe('projectile');
    await t.run(ctx => ctx.db.patch('flights', flight.id, { arrivesAt: fired.encounter!.shots[0].endsAt }));
    vi.setSystemTime(fired.encounter!.shots[0].endsAt);
    const result = await c.mutation(api.slingshot.sync, { flightId: flight.id });
    expect(result.encounter?.state).toBe('delivered'); expect(result.pouch.count).toBe(0);
    expect((await b.query(api.flights.detail, flight)).flight?.body).toBe('Actual test letter');
    expect((await c.query(api.flights.detail, flight)).flight?.body).toBeUndefined();
  });
  it('ends on exit without charging unfired stones and rejects stale/future/foreign releases', async () => {
    const { c, d, flight } = await setup(); const e = (await c.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter!;
    await expect(d.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 0 })).rejects.toThrow('unavailable');
    await expect(c.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 101 })).rejects.toThrow('out of sync');
    await c.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 0 });
    vi.setSystemTime(e.preparedAt + 1000);
    await expect(c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'stale', releaseElapsedMs: 0, direction: { x: 0, y: -1 } })).rejects.toThrow('out of sync');
    const ended = await c.mutation(api.slingshot.end, { encounterId: e.id }); expect(ended.pouch.count).toBe(6); expect(ended.encounter?.state).toBe('abandoned');
  });
  it('rechecks blocks before confirming a trajectory hit', async () => {
    const { c, b, profiles, flight } = await setup(); const e = (await c.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter!;
    await c.mutation(api.slingshot.arm, { encounterId: e.id, armedElapsedMs: 0 });
    const fired = await c.mutation(api.slingshot.fire, { encounterId: e.id, shotKey: 'one', releaseElapsedMs: 0, direction: aim(e.seed, 0) });
    await b.mutation(api.social.block, { profileId: profiles[2].id });
    vi.setSystemTime(fired.encounter!.shots[0].endsAt + 1);
    expect((await c.mutation(api.slingshot.sync, { flightId: flight.id })).encounter?.state).toBe('active');
    expect((await c.query(api.flights.detail, flight)).flight?.body).toBeUndefined();
  });
});

describe('shared stone pouch refill', () => {
  it('starts at six, regenerates only below three, never banks time above three, and caps at three', async () => {
    const { t, c, profiles } = await setup();
    expect((await c.mutation(api.stones.sync, {})).count).toBe(6);
    vi.setSystemTime(Date.now() + 5_000_000); expect((await c.mutation(api.stones.sync, {})).count).toBe(6);
    const at = Date.now();
    await t.run(async ctx => { const pouch = await ctx.db.query('stonePouches').withIndex('by_profileId', q => q.eq('profileId', profiles[2].id)).unique(); await ctx.db.patch('stonePouches', pouch!._id, { count: 0, nextRefillAt: at + 1_200_000 }); });
    vi.setSystemTime(at + 1_199_999); expect((await c.mutation(api.stones.sync, {})).count).toBe(0);
    vi.setSystemTime(at + 1_200_000); expect((await c.mutation(api.stones.sync, {})).count).toBe(1);
    vi.setSystemTime(at + 12_000_000); const full = await c.mutation(api.stones.sync, {}); expect(full.count).toBe(3); expect(full.nextRefillAt).toBeNull();
    await t.mutation(internal.stones.refill, { profileId: profiles[2].id }); expect((await c.query(api.stones.status, {})).count).toBe(3);
  });
});
