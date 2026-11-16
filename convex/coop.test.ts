/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { STONE_INTERVAL } from '../src/shop';
import { isHit } from '../src/domain';
const modules = import.meta.glob('./**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => Promise.all(['alice', 'bob', 'other'].map(name => ctx.db.insert('users', { email: `${name}@example.test` }))));
  const [alice, bob, other] = ids.map(id => t.withIdentity({ subject: `${id}|session` }));
  const [a, b, c] = await Promise.all([alice.mutation(api.profiles.save, { handle: 'alice', cityId: 'london' }), bob.mutation(api.profiles.save, { handle: 'bob', cityId: 'paris' }), other.mutation(api.profiles.save, { handle: 'other', cityId: 'tokyo' })]);
  const { pigeons: birds } = await alice.mutation(api.onboarding.ensureFlock, {});
  const { pigeons: strangers } = await bob.mutation(api.onboarding.ensureFlock, {});
  await bob.mutation(api.social.acceptInvite, await alice.mutation(api.social.createInvite, {}));
  const launch = { recipientId: b.id, pigeonId: birds[0].id, body: 'A hello with a little tailwind.', visibility: 'open' as const, defense: 'cruise' as const, openAcknowledged: true, demo: false, requestKey: 'letter' };
  return { t, alice, bob, other, a, b, c, birds, strangers, launch };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T18:00:00Z')); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('coop purchases and inventory', () => {
  it('isolates wallets and rejects unauthenticated access and foreign pigeons', async () => {
    const { t, alice, bob, strangers } = await setup();
    await expect(t.query(api.coop.mine, {})).rejects.toThrow('Sign in');
    await expect(alice.mutation(api.coop.transact, { requestKey: 'foreign', action: { type: 'accessory', item: 'scarf', birdId: strangers[0].id } })).rejects.toThrow('your flock');
    expect((await alice.query(api.coop.mine, {})).points).toBe(120);
    expect((await bob.query(api.coop.mine, {})).owned).not.toContain('scarf');
  });
  it('deducts once across concurrent retries and moves owned items without charging again', async () => {
    const { alice, birds } = await setup();
    const purchase = { requestKey: 'scarf', action: { type: 'accessory' as const, item: 'scarf' as const, birdId: birds[1].id } };
    await Promise.all([alice.mutation(api.coop.transact, purchase), alice.mutation(api.coop.transact, purchase)]);
    expect((await alice.query(api.coop.mine, {})).points).toBe(60);
    await alice.mutation(api.coop.transact, { requestKey: 'move', action: { ...purchase.action, birdId: birds[0].id } });
    const wallet = await alice.query(api.coop.mine, {});
    expect(wallet.points).toBe(60);
    expect(wallet.equipped).toEqual([{ item: 'scarf', birdId: birds[0].id }]);
    await expect(alice.mutation(api.coop.transact, { ...purchase, action: { type: 'stones' } })).rejects.toThrow('another purchase');
    await alice.mutation(api.coop.transact, { requestKey: 'remove', action: { type: 'remove', item: 'scarf' } });
    expect((await alice.query(api.coop.mine, {})).owned).toContain('scarf');
  });
  it('prevents overspending across concurrent purchases and preserves balances on failure', async () => {
    const { alice } = await setup();
    const results = await Promise.allSettled([0, 1, 2].map(i => alice.mutation(api.coop.transact, { requestKey: `stones-${i}`, action: { type: 'stones' } })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    expect(await alice.query(api.coop.mine, {})).toMatchObject({ points: 20, stones: 15 });
  });
  it('consumes a treat for one selected flight and rewards a launch only once', async () => {
    const { alice, birds, launch } = await setup();
    await alice.mutation(api.coop.transact, { requestKey: 'treat', action: { type: 'treat', birdId: birds[0].id } });
    await expect(alice.mutation(api.coop.transact, { requestKey: 'treat-again', action: { type: 'treat', birdId: birds[0].id } })).rejects.toThrow('already has');
    const treated = await alice.mutation(api.flights.launch, launch);
    await alice.mutation(api.flights.launch, launch);
    const normal = await alice.mutation(api.flights.launch, { ...launch, pigeonId: birds[1].id, requestKey: 'normal' });
    const fastFlight = (await alice.query(api.flights.detail, treated)).flight!;
    const normalFlight = (await alice.query(api.flights.detail, normal)).flight!;
    expect(fastFlight.arrivesAt - fastFlight.departedAt).toBe(Math.ceil((normalFlight.arrivesAt - normalFlight.departedAt) / 1000 * 0.9) * 1000);
    expect(await alice.query(api.coop.mine, {})).toMatchObject({ points: 130, treats: 0, treatedBirds: [] });
  });
  it('charges one stone per reserved attempt and keeps a retry free', async () => {
    const { alice, other, launch } = await setup();
    const { id } = await alice.mutation(api.flights.launch, launch);
    const first = await other.mutation(api.flights.reserve, { flightId: id });
    const retry = await other.mutation(api.flights.reserve, { flightId: id });
    expect(retry.id).toBe(first.id);
    expect((await other.query(api.coop.mine, {})).stones).toBe(4);
    const wallet = await other.query(api.coop.mine, {});
    await vi.advanceTimersByTimeAsync(wallet.stoneAt + STONE_INTERVAL - Date.now());
    expect((await other.query(api.coop.mine, {})).stones).toBe(5);
  });
  it('refuses empty-pouch attempts without consuming a flight attempt', async () => {
    const { t, alice, other, c, launch } = await setup();
    const { id } = await alice.mutation(api.flights.launch, launch);
    const state = await other.query(api.coop.mine, {});
    await t.run(async ctx => ctx.db.insert('coopWallets', { ownerId: ctx.db.normalizeId('profiles', c.id)!, state: { ...state, stones: 0 } }));
    await expect(other.mutation(api.flights.reserve, { flightId: id })).rejects.toThrow('pouch is empty');
    expect((await alice.query(api.flights.detail, { id })).flight?.attemptCount).toBe(0);
  });
  it('covers existing flights with guard, rejects duplicate activation, and expires after an hour', async () => {
    const { alice, other, launch } = await setup();
    const { id } = await alice.mutation(api.flights.launch, launch);
    await alice.mutation(api.coop.transact, { requestKey: 'guard', action: { type: 'guard' } });
    await expect(alice.mutation(api.coop.transact, { requestKey: 'guard-again', action: { type: 'guard' } })).rejects.toThrow('already active');
    const attempt = await other.mutation(api.flights.reserve, { flightId: id });
    expect(attempt.defense).toBe('zigzag');
    const taps = attempt.phases.map((phase, round) => { if (round === 2) return null; for (let ms = 0; ms < 2000; ms++) if (isHit(ms, phase)) return round * 2000 + ms; return null; });
    vi.setSystemTime(attempt.startedAt + 6000);
    expect((await other.mutation(api.flights.resolve, { attemptId: attempt.id, taps })).outcome).toBe('missed');
    vi.setSystemTime(Date.now() + 3_600_000);
    await alice.mutation(api.coop.transact, { requestKey: 'guard-renew', action: { type: 'guard' } });
    expect((await alice.query(api.coop.mine, {})).points).toBe(45);
  });
});
