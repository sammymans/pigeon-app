/// <reference types="vite/client" />
import { convexTest, type TestConvex } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { traceShot } from '../starter/game/trajectory';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
type Test = TestConvex<typeof schema>;
async function actor(t: Test, name: string, anonymous = true) {
  const id = await t.run(ctx => ctx.db.insert('users', anonymous ? { isAnonymous: true } : {}));
  const client = t.withIdentity({ subject: `${id}|session` });
  const profile = { handle: name, cityId: 'london' as const, openAcknowledged: true };
  return { client, profile, id };
}
async function room() {
  const t = convexTest(schema, modules);
  const [a, b, c, d] = await Promise.all(['alice', 'bruno', 'cleo', 'dana'].map(name => actor(t, name)));
  await a.client.mutation(api.starterRooms.create, a.profile);
  const token = (await a.client.query(api.starterRooms.status, {}))!.inviteToken!;
  await b.client.mutation(api.starterRooms.join, { ...b.profile, token });
  await c.client.mutation(api.starterRooms.join, { ...c.profile, token });
  const profiles = (await a.client.query(api.starterRooms.status, {}))!.members;
  const launch = (overrides = {}) => a.client.mutation(api.starterRooms.launch, { recipientId: profiles[1].id, body: 'A real letter from A to B.', defense: 'cruise', openAcknowledged: true, requestKey: 'one', ...overrides });
  return { t, a, b, c, d, profiles, token, launch };
}
function aim(seed: number) {
  for (let x = -0.6; x < 0.6; x += 0.01) {
    const direction = { x, y: -Math.sqrt(1 - x * x) };
    if (traceShot(0, direction, seed).hit) return direction;
  }
  throw new Error('No hit trajectory');
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T22:00:00Z')); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('three actual authenticated actors in an isolated room', () => {
  it('requires fresh anonymous auth and explicit consent without moving existing profiles', async () => {
    const t = convexTest(schema, modules);
    const user = await actor(t, 'alice');
    await expect(t.mutation(api.starterRooms.create, user.profile)).rejects.toThrow('fresh anonymous');
    await expect(user.client.mutation(api.starterRooms.create, { ...user.profile, openAcknowledged: false })).rejects.toThrow('Agree to Open Skies');
    expect(await user.client.query(api.profiles.me, {})).toBeNull();
    const normal = await actor(t, 'normal', false);
    await expect(normal.client.mutation(api.starterRooms.create, normal.profile)).rejects.toThrow('fresh anonymous');
    await user.client.mutation(api.starterPair.create, { handle: 'old_pair', cityId: 'london' });
    const before = await user.client.query(api.profiles.me, {});
    await expect(user.client.mutation(api.starterRooms.create, user.profile)).rejects.toThrow('Existing profiles');
    expect(await user.client.query(api.profiles.me, {})).toEqual(before);
    expect(await user.client.query(api.starterRooms.status, {})).toBeNull();
  });

  it('atomically caps membership at three, creates only three consented connections, and deduplicates retries', async () => {
    const t = convexTest(schema, modules);
    const [owner, ...joiners] = await Promise.all(['owner', 'one', 'two', 'three'].map(name => actor(t, name)));
    await Promise.all([owner.client.mutation(api.starterRooms.create, owner.profile), owner.client.mutation(api.starterRooms.create, owner.profile)]);
    const initial = (await owner.client.query(api.starterRooms.status, {}))!;
    const token = initial.inviteToken!;
    const results = await Promise.allSettled(joiners.map(user => user.client.mutation(api.starterRooms.join, { ...user.profile, token })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    const status = (await owner.client.query(api.starterRooms.status, {}))!;
    expect(status).toMatchObject({ capacity: 3, isOwner: true, inviteToken: null });
    expect(status.members).toHaveLength(3);
    for (let i = 0; i < joiners.length; i++) {
      if (results[i].status === 'fulfilled') {
        await joiners[i].client.mutation(api.starterRooms.join, { ...joiners[i].profile, token });
        const joined = (await joiners[i].client.query(api.starterRooms.status, {}))!;
        expect(joined.inviteToken).toBeNull();
        expect(joined.isOwner).toBe(false);
      } else expect(await joiners[i].client.query(api.profiles.me, {})).toBeNull();
    }
    expect(await t.run(ctx => ctx.db.query('connections').take(10))).toHaveLength(3);
    for (const member of status.members) expect(Object.keys(member).sort()).toEqual(['cityId', 'demo', 'equipped', 'handle', 'id']);
    expect(await t.query(api.starterRooms.status, {})).toBeNull();
  });

  it('keeps tokens owner-only and rejects joins at the expiration boundary even before scheduled cleanup', async () => {
    const t = convexTest(schema, modules);
    const a = await actor(t, 'owner'); const b = await actor(t, 'joiner'); const c = await actor(t, 'late');
    await a.client.mutation(api.starterRooms.create, a.profile);
    const room = (await a.client.query(api.starterRooms.status, {}))!;
    await b.client.mutation(api.starterRooms.join, { ...b.profile, token: room.inviteToken! });
    expect((await b.client.query(api.starterRooms.status, {}))!.inviteToken).toBeNull();
    vi.setSystemTime(room.expiresAt);
    await expect(c.client.mutation(api.starterRooms.join, { ...c.profile, token: room.inviteToken! })).rejects.toThrow('expired or unavailable');
    expect(await c.client.query(api.profiles.me, {})).toBeNull();
    await t.mutation(internal.starterRooms.expireInvitation, { roomId: room.roomId });
    expect((await a.client.query(api.starterRooms.status, {}))!.inviteToken).toBeNull();
    await b.client.mutation(api.starterRooms.join, { ...b.profile, token: room.inviteToken! });
  });

  it('requires per-letter acknowledgment, forces Open Skies, and preserves immutable launch retries', async () => {
    const { a, launch } = await room();
    await expect(launch({ openAcknowledged: false })).rejects.toThrow('Acknowledge');
    const result = await launch();
    expect(await launch()).toEqual(result);
    const detail = (await a.client.query(api.flights.detail, result)).flight!;
    expect(detail).toMatchObject({ visibility: 'open', demo: true, defense: 'cruise' });
    expect(detail.arrivesAt - detail.departedAt).toBe(30_000);
    await expect(launch({ body: 'different' })).rejects.toThrow('different letter');
  });

  it('lets C catch A→B once and reveals the body only to A and C, never public or B', async () => {
    const { t, a, b, c, launch } = await room();
    const { id } = await launch();
    const world = await c.client.query(api.flights.list, { scope: 'world', demo: true });
    expect(world.flights.map(flight => flight.id)).toEqual([id]);
    expect(JSON.stringify(world)).not.toContain('A real letter');
    expect((await c.client.query(api.flights.detail, { id })).flight).toMatchObject({ canCatch: true, role: 'public' });
    await expect(a.client.mutation(api.flights.reserve, { flightId: id })).rejects.toThrow('cannot be caught');
    await expect(b.client.mutation(api.flights.reserve, { flightId: id })).rejects.toThrow('cannot be caught');
    await expect(c.client.mutation(api.flights.reserve, { flightId: id })).rejects.toThrow('slingshot');
    const encounter = (await c.client.mutation(api.slingshot.prepare, { flightId: id })).encounter!;
    await c.client.mutation(api.slingshot.arm, { encounterId: encounter.id, armedElapsedMs: 0 });
    const fired = await c.client.mutation(api.slingshot.fire, { encounterId: encounter.id, shotKey: 'first', releaseElapsedMs: 0, direction: aim(encounter.seed) });
    vi.setSystemTime(fired.encounter!.shots[0].endsAt + 1);
    const result = await c.client.mutation(api.slingshot.sync, { flightId: id });
    expect(result.encounter?.state).toBe('caught');
    expect((await c.client.mutation(api.slingshot.end, { encounterId: encounter.id })).encounter).toEqual(result.encounter);
    expect((await a.client.query(api.flights.detail, { id })).flight?.body).toBe('A real letter from A to B.');
    expect((await c.client.query(api.flights.detail, { id })).flight).toMatchObject({ role: 'catcher', body: 'A real letter from A to B.' });
    expect((await b.client.query(api.flights.detail, { id })).flight).toMatchObject({ state: 'intercepted', role: 'recipient' });
    expect((await b.client.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
    expect((await t.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
    const shared = world.flights[0].shareToken!;
    expect((await c.client.query(api.flights.detail, { id: shared })).flight?.body).toBeUndefined();
  });

  it('preserves room isolation, historical sealed privacy, and per-flight blocked eligibility', async () => {
    const { a, b, c, d, token, profiles, launch } = await room();
    await d.client.mutation(api.starterRooms.create, d.profile);
    await expect(d.client.mutation(api.starterRooms.join, { ...d.profile, token })).rejects.toThrow('Existing profiles');
    const { id } = await launch();
    expect((await d.client.query(api.flights.list, { scope: 'world', demo: true })).flights).toEqual([]);
    await expect(d.client.mutation(api.flights.reserve, { flightId: id })).rejects.toThrow('cannot be caught');
    await expect(d.client.mutation(api.starterRooms.launch, { recipientId: profiles[1].id, body: 'No', defense: 'cruise', requestKey: 'outsider', openAcknowledged: true })).rejects.toThrow('member');
    const sealed = await a.client.mutation(api.flights.launch, { recipientId: profiles[1].id, body: 'Legacy sealed.', visibility: 'sealed', defense: 'cruise', demo: true, openAcknowledged: false, requestKey: 'legacy' });
    expect((await c.client.query(api.flights.detail, sealed)).flight).toBeNull();
    await expect(c.client.mutation(api.flights.reserve, { flightId: sealed.id })).rejects.toThrow('cannot be caught');
    await b.client.mutation(api.social.block, { profileId: profiles[2].id });
    expect((await c.client.query(api.flights.detail, { id })).flight?.canCatch).toBe(false);
    await expect(c.client.mutation(api.slingshot.prepare, { flightId: id })).rejects.toThrow('cannot be intercepted');
  });

  it('expires abandoned attempts and delivers at the exact arrival boundary without body access for C', async () => {
    const { t, b, c, launch } = await room();
    const flight = await launch();
    const encounter = (await c.client.mutation(api.slingshot.prepare, { flightId: flight.id })).encounter!;
    await c.client.mutation(api.slingshot.arm, { encounterId: encounter.id, armedElapsedMs: 0 });
    vi.setSystemTime(encounter.preparedAt + 10_000);
    expect((await c.client.mutation(api.slingshot.sync, { flightId: flight.id })).encounter?.state).toBe('escaped');
    expect((await c.client.query(api.flights.detail, flight)).flight?.body).toBeUndefined();
    const detail = (await b.client.query(api.flights.detail, flight)).flight!;
    vi.setSystemTime(detail.arrivesAt);
    await t.mutation(internal.flights.settle, { flightId: flight.id });
    expect((await b.client.query(api.flights.detail, flight)).flight).toMatchObject({ state: 'delivered', body: 'A real letter from A to B.' });
    expect((await c.client.query(api.flights.detail, flight)).flight?.body).toBeUndefined();
  });
});
