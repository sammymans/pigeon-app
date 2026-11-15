/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isHit } from '../src/domain';
import type { Attempt, LaunchInput } from '../src/domain';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function setup(demo = false) {
  const t = convexTest(schema, modules);
  const userIds = await t.run(async (ctx) => Promise.all(['alice', 'bruno', 'cleo', 'dana'].map((name) => ctx.db.insert('users', { email: `${name}@example.test` }))));
  const sessions = userIds.map((userId) => t.withIdentity({ subject: `${userId}|session`, issuer: 'https://pigeon.test' }));
  const profiles = await Promise.all(sessions.map((session, index) => session.mutation(api.profiles.save, {
    handle: ['alice', 'bruno', 'cleo', 'dana'][index], cityId: ['new-york', 'london', 'chicago', 'tokyo'][index] as 'new-york' | 'london' | 'chicago' | 'tokyo',
  })));
  if (demo) await t.mutation(internal.demo.provision, { namespace: 'test-sky', userIds: userIds.slice(0, 3) });
  const invite = await sessions[0].mutation(api.social.createInvite, {});
  await sessions[1].mutation(api.social.acceptInvite, invite);
  const [alice, bruno, cleo, dana] = sessions;
  const launch = (overrides: Partial<LaunchInput> = {}) => alice.mutation(api.flights.launch, {
    recipientId: profiles[1].id, body: 'The letter is private.', visibility: 'sealed', defense: 'cruise',
    openAcknowledged: false, demo, requestKey: 'letter-1', ...overrides,
  });
  return { t, userIds, profiles, alice, bruno, cleo, dana, launch };
}

function tapsFor(attempt: Attempt, hits = 3) {
  return attempt.phases.map((phase, round) => {
    if (round >= hits) return null;
    for (let time = 0; time < 2000; time++) if (isHit(time, phase)) return round * 2000 + time;
    throw new Error('No timing window found');
  });
}

async function advanceTo(time: number) {
  await vi.advanceTimersByTimeAsync(Math.max(0, time - Date.now()));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T18:00:00Z'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('authenticated profiles and private delivery', () => {
  it('requires real identity, normalizes unique handles, and does not accept self-issued demo membership', async () => {
    const { t, alice, dana, profiles } = await setup();
    expect(await t.query(api.profiles.me, {})).toBeNull();
    await expect(t.mutation(api.profiles.save, { handle: 'stranger', cityId: 'london' })).rejects.toThrow('Sign in');
    await expect(t.query(api.flights.list, { scope: 'mine', demo: false })).rejects.toThrow('Sign in');
    await expect(t.mutation(api.social.createInvite, {})).rejects.toThrow('Sign in');
    await expect(dana.mutation(api.profiles.save, { handle: 'ALICE', cityId: 'london' })).rejects.toThrow('already taken');
    expect((await alice.mutation(api.profiles.save, { handle: '@Alice', cityId: 'new-york' })).id).toBe(profiles[0].id);
    expect((await alice.query(api.profiles.me, {}))?.demo).toBe(false);
    await expect(alice.mutation(api.demo.seed, {})).rejects.toThrow('prepared demo');
    await expect(alice.mutation(api.demo.reset, {})).rejects.toThrow('prepared demo');
  });

  it('delivers across independent sessions only after scheduled settlement and snapshots cities', async () => {
    const { t, alice, bruno, cleo, launch } = await setup(true);
    const { id } = await launch();
    const sender = (await alice.query(api.flights.detail, { id })).flight!;
    expect(sender.body).toBe('The letter is private.');
    expect(sender.arrivesAt - sender.departedAt).toBe(90_000);
    expect((await bruno.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
    expect((await cleo.query(api.flights.detail, { id })).flight).toBeNull();
    expect((await t.query(api.flights.detail, { id })).flight).toBeNull();
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).flights).toEqual([]);
    await alice.mutation(api.profiles.setCity, { cityId: 'sydney' });
    await bruno.mutation(api.profiles.setCity, { cityId: 'paris' });
    await advanceTo(sender.arrivesAt);
    await t.finishInProgressScheduledFunctions();
    const delivered = (await bruno.query(api.flights.detail, { id })).flight!;
    expect(delivered.state).toBe('delivered');
    expect(delivered.body).toBe('The letter is private.');
    expect(delivered.origin.id).toBe('new-york');
    expect(delivered.destination.id).toBe('london');
    expect(delivered.arrivesAt).toBe(sender.arrivesAt);
    expect(delivered.events.at(-1)?.label).toBe('Delivered');
  });

  it('uses normal distance time and rejects empty, oversized, unconnected and unacknowledged letters', async () => {
    const { alice, profiles, launch } = await setup();
    await expect(launch({ body: ' ' })).rejects.toThrow('280');
    await expect(launch({ body: 'a'.repeat(281) })).rejects.toThrow('280');
    await expect(launch({ recipientId: profiles[2].id })).rejects.toThrow('Connect by invite');
    await expect(launch({ visibility: 'open' })).rejects.toThrow('Acknowledge');
    await expect(launch({ demo: true })).rejects.toThrow('isolated flight mode');
    const flight = await launch();
    const details = (await alice.query(api.flights.detail, flight)).flight!;
    expect(details.arrivesAt - details.departedAt).toBeGreaterThan(90 * 3600_000);
    expect(details.visibility).toBe('sealed');
  });

  it('deduplicates retries, rejects changed payloads, and atomically caps concurrent launches at three', async () => {
    const { alice, launch } = await setup();
    const retries = await Promise.all([launch(), launch()]);
    expect(retries[0].id).toBe(retries[1].id);
    await expect(launch({ body: 'Different message' })).rejects.toThrow('different letter');
    const results = await Promise.allSettled([2, 3, 4, 5].map((n) => launch({ requestKey: `letter-${n}` })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(2);
    expect((await alice.query(api.flights.list, { scope: 'mine', demo: false })).flights).toHaveLength(3);
    expect((await launch()).id).toBe(retries[0].id);
  });

  it('settles overdue flights on reconnect and releases the active cap without altering timestamps', async () => {
    const { alice, launch } = await setup(true);
    await Promise.all([1, 2, 3].map((n) => launch({ requestKey: `flight-${n}` })));
    const before = await alice.query(api.flights.list, { scope: 'mine', demo: true });
    vi.setSystemTime(Math.max(...before.flights.map((flight) => flight.arrivesAt)));
    await alice.mutation(api.flights.settleMine, {});
    const flights = (await alice.query(api.flights.list, { scope: 'mine', demo: true })).flights;
    expect(flights.every((flight) => flight.state === 'delivered')).toBe(true);
    await expect(launch({ requestKey: 'flight-4' })).resolves.toHaveProperty('id');
  });
});

describe('public-safe sky and transactional catch game', () => {
  it('keeps public lists and share links anonymous even for signed-in participants and reflects equipped cosmetics', async () => {
    const { t, alice, profiles, launch } = await setup();
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const world = await alice.query(api.flights.list, { scope: 'world', demo: false });
    expect(world.total).toBe(1);
    expect(world.flights[0].role).toBe('public');
    expect(world.flights[0].senderHandle).toBeUndefined();
    expect(world.flights[0].recipientHandle).toBeUndefined();
    expect(JSON.stringify(world)).not.toContain('alice');
    expect(JSON.stringify(world)).not.toContain('bruno');
    expect(JSON.stringify(world)).not.toContain('The letter');
    const shared = (await alice.query(api.flights.detail, { id: world.flights[0].shareToken! })).flight!;
    expect(shared.body).toBeUndefined();
    expect(shared.senderHandle).toBeUndefined();
    expect(shared.recipientHandle).toBeUndefined();
    expect(shared.otherProfileId).toBeUndefined();
    const anonymous = (await t.query(api.flights.detail, { id })).flight!;
    expect(anonymous.senderHandle).toBeUndefined();
    expect(anonymous.recipientHandle).toBeUndefined();
    expect(anonymous.body).toBeUndefined();
    await t.run(async (ctx) => ctx.db.patch('profiles', profiles[0].id, { equipped: 'aviator' }));
    expect((await t.query(api.flights.detail, { id })).flight?.outfit).toBe('aviator');
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).total).toBe(0);
  });

  it('excludes unauthenticated, sealed, sender, recipient, and blocked catchers', async () => {
    const { t, alice, bruno, cleo, dana, profiles, launch } = await setup();
    const sealed = await launch();
    await expect(cleo.mutation(api.flights.reserve, { flightId: sealed.id })).rejects.toThrow('cannot be caught');
    const open = await launch({ requestKey: 'open', visibility: 'open', openAcknowledged: true });
    await expect(t.mutation(api.flights.reserve, { flightId: open.id })).rejects.toThrow('Sign in');
    await expect(alice.mutation(api.flights.reserve, { flightId: open.id })).rejects.toThrow('cannot be caught');
    await expect(bruno.mutation(api.flights.reserve, { flightId: open.id })).rejects.toThrow('cannot be caught');
    await bruno.mutation(api.social.block, { profileId: profiles[2].id });
    await expect(cleo.mutation(api.flights.reserve, { flightId: open.id })).rejects.toThrow('cannot be caught');
    await dana.mutation(api.social.block, { profileId: profiles[0].id });
    await expect(dana.mutation(api.flights.reserve, { flightId: open.id })).rejects.toThrow('cannot be caught');
  });

  it('allows exactly one concurrent reservation and one immutable resolution', async () => {
    const { t, alice, bruno, cleo, dana, launch } = await setup();
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const reservations = await Promise.allSettled([cleo.mutation(api.flights.reserve, { flightId: id }), dana.mutation(api.flights.reserve, { flightId: id })]);
    expect(reservations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winnerIndex = reservations.findIndex((result) => result.status === 'fulfilled');
    const winner = [cleo, dana][winnerIndex];
    const loser = [cleo, dana][1 - winnerIndex];
    const reserved = reservations[winnerIndex];
    if (reserved.status !== 'fulfilled') throw new Error('No reservation');
    const attempt = reserved.value;
    expect((await winner.mutation(api.flights.reserve, { flightId: id })).id).toBe(attempt.id);
    await expect(loser.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt) })).rejects.toThrow('unavailable');
    await expect(winner.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt) })).rejects.toThrow('Finish all three');
    await advanceTo(attempt.startedAt + 6000);
    const results = await Promise.all([
      winner.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt, 2) }),
      winner.mutation(api.flights.resolve, { attemptId: attempt.id, taps: [null, null, null] }),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].outcome).toBe('caught');
    const caught = (await winner.query(api.flights.detail, { id })).flight!;
    expect(caught.body).toBe('The letter is private.');
    expect(caught.senderHandle).toBe('alice');
    expect(caught.recipientHandle).toBeUndefined();
    expect(caught.canRequest).toBe(true);
    expect((await bruno.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
    expect((await alice.query(api.flights.detail, { id })).flight?.body).toBe('The letter is private.');
    expect((await loser.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
    const publicCatch = (await winner.query(api.flights.detail, { id: caught.shareToken! })).flight!;
    expect(publicCatch.body).toBeUndefined();
    expect(publicCatch.senderHandle).toBeUndefined();
    expect(publicCatch.recipientHandle).toBeUndefined();
    expect(publicCatch.otherProfileId).toBeUndefined();
    expect((await t.query(api.flights.list, { scope: 'world', demo: false })).total).toBe(0);
  });

  it('allows a three-hit Zigzag win and free resend while preserving the original outcome and tap record', async () => {
    const { t, alice, cleo, launch } = await setup();
    const original = await launch({ visibility: 'open', openAcknowledged: true, defense: 'zigzag' });
    const attempt = await cleo.mutation(api.flights.reserve, { flightId: original.id });
    const taps = tapsFor(attempt);
    await advanceTo(attempt.startedAt + 6000);
    expect((await cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps })).outcome).toBe('caught');
    const record = await t.run(async (ctx) => ctx.db.get('catchAttempts', ctx.db.normalizeId('catchAttempts', attempt.id)!));
    expect(record?.taps).toEqual(taps);
    const originalDetails = (await alice.query(api.flights.detail, original)).flight!;
    expect(originalDetails.canResend).toBe(true);
    const resend = await launch({ requestKey: 'resend', visibility: 'sealed' });
    expect(resend.id).not.toBe(original.id);
    expect((await alice.query(api.flights.detail, original)).flight?.state).toBe('intercepted');
    expect((await alice.query(api.flights.detail, resend)).flight?.state).toBe('in_flight');
  });

  it('reclaims an expired lease transactionally even if the scheduled expiry has not run', async () => {
    const { t, cleo, dana, launch } = await setup();
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const first = await cleo.mutation(api.flights.reserve, { flightId: id });
    vi.setSystemTime(first.expiresAt);
    const second = await dana.mutation(api.flights.reserve, { flightId: id });
    expect(second.id).not.toBe(first.id);
    const expired = await cleo.mutation(api.flights.resolve, { attemptId: first.id, taps: tapsFor(first) });
    expect(expired.outcome).toBe('expired');
    const flight = await t.run(async (ctx) => ctx.db.get('flights', id));
    expect(flight?.attemptCount).toBe(2);
    expect(flight?.activeAttemptId).toBe(second.id);
  });

  it('requires three Zigzag hits, validates round boundaries, and enforces catcher cooldown', async () => {
    const { alice, cleo, launch } = await setup();
    const first = await launch({ visibility: 'open', openAcknowledged: true, defense: 'zigzag' });
    const second = await launch({ requestKey: 'second', visibility: 'open', openAcknowledged: true });
    const attempt = await cleo.mutation(api.flights.reserve, { flightId: first.id });
    const details = (await alice.query(api.flights.detail, first)).flight!;
    expect((details.arrivesAt - details.departedAt) / 1000).toBe(Math.ceil(Math.ceil(details.distanceKm / 60 * 3600) * 1.2));
    await advanceTo(attempt.startedAt + 6000);
    await expect(cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: [2000, 2000, 4000] })).rejects.toThrow('elapsed timestamp');
    await expect(cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: [null, null] })).rejects.toThrow('elapsed timestamp');
    expect((await cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt, 2) })).outcome).toBe('missed');
    await expect(cleo.mutation(api.flights.reserve, { flightId: second.id })).rejects.toThrow('30 seconds');
    await advanceTo(attempt.startedAt + 30_000);
    await expect(cleo.mutation(api.flights.reserve, { flightId: second.id })).resolves.toHaveProperty('id');
    await expect(cleo.mutation(api.flights.reserve, { flightId: first.id })).rejects.toThrow('already tried');
  });

  it('counts abandoned attempts, releases the lease on schedule, and limits attempts to two', async () => {
    const { t, alice, cleo, dana, launch } = await setup();
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const first = await cleo.mutation(api.flights.reserve, { flightId: id });
    await advanceTo(first.expiresAt);
    await t.finishInProgressScheduledFunctions();
    const expired = await cleo.mutation(api.flights.resolve, { attemptId: first.id, taps: tapsFor(first) });
    expect(expired.outcome).toBe('expired');
    const second = await dana.mutation(api.flights.reserve, { flightId: id });
    await advanceTo(second.expiresAt);
    await t.finishInProgressScheduledFunctions();
    expect((await dana.mutation(api.flights.resolve, { attemptId: second.id, taps: tapsFor(second) })).outcome).toBe('expired');
    const otherUser = await t.run(async (ctx) => ctx.db.insert('users', { email: 'extra@example.test' }));
    const extra = t.withIdentity({ subject: `${otherUser}|session` });
    await extra.mutation(api.profiles.save, { handle: 'extra', cityId: 'london' });
    await expect(extra.mutation(api.flights.reserve, { flightId: id })).rejects.toThrow('two attempts');
    expect((await alice.query(api.flights.detail, { id })).flight?.attemptCount).toBe(2);
  });

  it('closes the last-15-second window on schedule and rejects the boundary directly', async () => {
    const { t, cleo, launch } = await setup(true);
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const details = (await cleo.query(api.flights.detail, { id })).flight!;
    await advanceTo(details.arrivesAt - 15_000);
    await t.finishInProgressScheduledFunctions();
    expect((await cleo.query(api.flights.detail, { id })).flight?.canCatch).toBe(false);
    await expect(cleo.mutation(api.flights.reserve, { flightId: id })).rejects.toThrow('too close');
  });

  it('gives delivery priority at arrival and makes later submissions idempotent', async () => {
    const { t, bruno, cleo, launch } = await setup(true);
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const attempt = await cleo.mutation(api.flights.reserve, { flightId: id });
    await t.run(async (ctx) => ctx.db.patch('flights', id, { arrivesAt: attempt.startedAt + 6000 }));
    vi.setSystemTime(attempt.startedAt + 6000);
    const result = await cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt) });
    expect(result.outcome).toBe('delivered');
    expect(await cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: [] })).toEqual(result);
    expect((await bruno.query(api.flights.detail, { id })).flight?.body).toBe('The letter is private.');
    expect((await cleo.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
  });

  it('rechecks block status at resolution, never granting body access after a mid-game block', async () => {
    const { bruno, cleo, profiles, launch } = await setup();
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const attempt = await cleo.mutation(api.flights.reserve, { flightId: id });
    await bruno.mutation(api.social.block, { profileId: profiles[2].id });
    await advanceTo(attempt.startedAt + 6000);
    expect((await cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt) })).outcome).toBe('missed');
    expect((await cleo.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
  });
});

describe('consent, invitations, moderation and isolated demo controls', () => {
  it('allows only the catcher to request, only the sender to answer, and no repeat request after decline', async () => {
    const { t, alice, bruno, cleo, launch } = await setup();
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    await expect(cleo.mutation(api.social.request, { flightId: id })).rejects.toThrow('successful catcher');
    const attempt = await cleo.mutation(api.flights.reserve, { flightId: id });
    await advanceTo(attempt.startedAt + 6000);
    await cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt) });
    const request = await cleo.mutation(api.social.request, { flightId: id });
    expect(await cleo.mutation(api.social.request, { flightId: id })).toEqual(request);
    await expect(bruno.mutation(api.social.respond, { connectionId: request.id, response: 'accept' })).rejects.toThrow('unavailable');
    await expect(cleo.mutation(api.social.respond, { connectionId: request.id, response: 'accept' })).rejects.toThrow('unavailable');
    await alice.mutation(api.social.respond, { connectionId: request.id, response: 'decline' });
    await cleo.mutation(api.social.request, { flightId: id });
    expect((await cleo.query(api.social.list, {}))[0].state).toBe('declined');
    expect((await cleo.query(api.flights.detail, { id })).flight?.canRequest).toBe(false);
    await expect(alice.mutation(api.social.respond, { connectionId: request.id, response: 'accept' })).rejects.toThrow('already been answered');
    const count = await t.run(async (ctx) => (await ctx.db.query('connections').withIndex('by_flightId', (q) => q.eq('flightId', id)).take(10)).length);
    expect(count).toBe(1);
  });

  it('acceptance creates mutual timed messaging; block prevents further contact and report is private', async () => {
    const { t, alice, cleo, profiles, launch } = await setup();
    const { id } = await launch({ visibility: 'open', openAcknowledged: true });
    const attempt = await cleo.mutation(api.flights.reserve, { flightId: id });
    await advanceTo(attempt.startedAt + 6000);
    await cleo.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt) });
    const request = await cleo.mutation(api.social.request, { flightId: id });
    await alice.mutation(api.social.respond, { connectionId: request.id, response: 'accept' });
    const sendArgs = { recipientId: profiles[0].id, body: 'A slow reply.', visibility: 'sealed' as const, defense: 'cruise' as const, openAcknowledged: false, demo: false, requestKey: 'reply' };
    const reply = await cleo.mutation(api.flights.launch, sendArgs);
    expect((await alice.query(api.flights.detail, reply)).flight?.body).toBeUndefined();
    await cleo.mutation(api.social.report, { flightId: id, profileId: profiles[0].id, reason: 'Unwanted letter' });
    const reports = await t.run(async (ctx) => ctx.db.query('reports').withIndex('by_reporterId', (q) => q.eq('reporterId', profiles[2].id)).take(10));
    expect(reports).toHaveLength(1);
    await alice.mutation(api.social.block, { profileId: profiles[2].id });
    await expect(cleo.mutation(api.flights.launch, { ...sendArgs, requestKey: 'blocked' })).rejects.toThrow('unavailable');
    await expect(cleo.mutation(api.social.request, { flightId: id })).rejects.toThrow('unavailable');
    expect(await cleo.query(api.social.list, {})).toEqual([]);
  });

  it('invite acceptance is explicit, one-use, namespace-bound, and never grants access to other inboxes', async () => {
    const { t, alice, cleo, dana, launch } = await setup();
    const sealed = await launch();
    const invite = await alice.mutation(api.social.createInvite, {});
    expect((await cleo.query(api.social.list, {}))).toEqual([]);
    await cleo.mutation(api.social.acceptInvite, invite);
    await cleo.mutation(api.social.acceptInvite, invite);
    expect((await cleo.query(api.social.list, {}))[0].state).toBe('accepted');
    expect((await cleo.query(api.flights.detail, sealed)).flight).toBeNull();
    await expect(dana.mutation(api.social.acceptInvite, invite)).rejects.toThrow('unavailable');
    await expect(t.mutation(api.social.acceptInvite, invite)).rejects.toThrow('Sign in');
  });

  it('restricts trusted provisioning and keeps seed/reset inside one namespace without touching live flights or accounts', async () => {
    const { t, alice, bruno, cleo, dana, profiles, userIds } = await setup(true);
    await expect(t.mutation(internal.demo.provision, { namespace: 'another-demo', userIds: userIds.slice(0, 3) })).rejects.toThrow('another demo');
    const liveUser = await t.run(async (ctx) => ctx.db.insert('users', { email: 'live@example.test' }));
    const live = t.withIdentity({ subject: `${liveUser}|session` });
    const liveProfile = await live.mutation(api.profiles.save, { handle: 'livefriend', cityId: 'paris' });
    const liveInvite = await dana.mutation(api.social.createInvite, {});
    await expect(cleo.mutation(api.social.acceptInvite, liveInvite)).rejects.toThrow('isolated demo');
    await live.mutation(api.social.acceptInvite, liveInvite);
    const liveFlight = await dana.mutation(api.flights.launch, { recipientId: liveProfile.id, body: 'Keep this live flight.', visibility: 'open', defense: 'cruise', openAcknowledged: true, demo: false, requestKey: 'live' });
    await alice.mutation(api.demo.seed, {});
    await bruno.mutation(api.demo.seed, {});
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).total).toBe(2);
    expect((await t.query(api.flights.list, { scope: 'world', demo: false })).total).toBe(1);
    await expect(dana.mutation(api.demo.reset, {})).rejects.toThrow('prepared demo');
    await cleo.mutation(api.demo.reset, {});
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).total).toBe(0);
    expect((await dana.query(api.flights.detail, liveFlight)).flight?.body).toBe('Keep this live flight.');
    expect((await alice.query(api.profiles.me, {}))?.id).toBe(profiles[0].id);
    expect((await cleo.query(api.profiles.me, {}))?.demo).toBe(true);
    await alice.mutation(api.demo.seed, {});
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).total).toBe(2);
    const demoFlights = await t.query(api.flights.list, { scope: 'world', demo: true });
    await advanceTo(Math.max(...demoFlights.flights.map((flight) => flight.arrivesAt)));
    await t.finishInProgressScheduledFunctions();
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).total).toBe(0);
  });
});

describe('self-service authenticated anonymous demo', () => {
  it('requires anonymous authentication and refuses converting existing live profiles', async () => {
    const { t, alice } = await setup();
    await expect(t.mutation(api.demo.start, {})).rejects.toThrow('anonymous demo provider');
    await expect(alice.mutation(api.demo.start, {})).rejects.toThrow('anonymous demo provider');
    const anonymousId = await t.run(async (ctx) => ctx.db.insert('users', { isAnonymous: true }));
    const anonymous = t.withIdentity({ subject: `${anonymousId}|session` });
    await expect(anonymous.mutation(api.profiles.save, { handle: 'anonymous_live', cityId: 'london' })).rejects.toThrow('isolated demo');
    await t.run(async (ctx) => ctx.db.insert('profiles', { userId: anonymousId, handle: 'preexisting_live', cityId: 'london', demo: false, namespace: 'live', equipped: 'classic' }));
    await expect(anonymous.mutation(api.demo.start, {})).rejects.toThrow('cannot be converted');
    expect((await anonymous.query(api.profiles.me, {}))?.demo).toBe(false);
  });

  it('starts idempotently, creates no fixture login credentials, and delivers a genuine sealed hello', async () => {
    const t = convexTest(schema, modules);
    const anonymousId = await t.run(async (ctx) => ctx.db.insert('users', { isAnonymous: true }));
    const player = t.withIdentity({ subject: `${anonymousId}|session` });
    await Promise.all([player.mutation(api.demo.start, {}), player.mutation(api.demo.start, {})]);
    const profile = (await player.query(api.profiles.me, {}))!;
    expect(profile.demo).toBe(true);
    expect(profile.handle).toMatch(/^demo_you_/);
    const friends = await player.query(api.social.list, {});
    expect(friends).toHaveLength(1);
    expect(friends[0].profile.handle).toMatch(/^demo_pip_/);
    const world = await player.query(api.flights.list, { scope: 'world', demo: true });
    expect(world.total).toBe(2);
    expect(world.flights.every((flight) => flight.demo && flight.role === 'public')).toBe(true);
    expect((await player.query(api.flights.detail, { id: world.flights[0].id })).flight?.canCatch).toBe(true);
    const inbox = await player.query(api.flights.list, { scope: 'mine', demo: true });
    expect(inbox.flights).toHaveLength(1);
    const hello = inbox.flights[0];
    expect(hello.visibility).toBe('sealed');
    expect(hello.arrivesAt - hello.departedAt).toBe(30_000);
    expect((await player.query(api.flights.detail, { id: hello.id })).flight?.body).toBeUndefined();
    const fixtureCounts = await t.run(async (ctx) => {
      const owner = await ctx.db.get('profiles', profile.id);
      const members = await ctx.db.query('profiles').withIndex('by_namespace', (q) => q.eq('namespace', owner!.namespace)).take(10);
      let accounts = 0;
      for (const member of members) {
        if (member.userId === anonymousId) continue;
        const user = await ctx.db.get('users', member.userId);
        expect(user?.name).toContain('fictional sample pen pal');
        accounts += (await ctx.db.query('authAccounts').withIndex('userIdAndProvider', (q) => q.eq('userId', member.userId)).take(10)).length;
      }
      return { members: members.length, accounts };
    });
    expect(fixtureCounts).toEqual({ members: 3, accounts: 0 });
    await advanceTo(hello.arrivesAt);
    await t.finishInProgressScheduledFunctions();
    expect((await player.query(api.flights.detail, { id: hello.id })).flight?.body).toContain('sample pen pal');
    const reply = await player.mutation(api.flights.launch, { recipientId: friends[0].profile.id, body: 'Hello, sample Pip.', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, demo: true, requestKey: 'reply' });
    expect((await player.query(api.flights.detail, reply)).flight?.state).toBe('in_flight');
  });

  it('separates visitors and scopes reset/reseed without changing normal accounts or public totals', async () => {
    const { t, alice, launch } = await setup();
    const normal = await launch({ visibility: 'open', openAcknowledged: true });
    const users = await t.run(async (ctx) => Promise.all([ctx.db.insert('users', { isAnonymous: true }), ctx.db.insert('users', { isAnonymous: true })]));
    const [first, second] = users.map((userId) => t.withIdentity({ subject: `${userId}|session` }));
    await first.mutation(api.demo.start, {});
    await second.mutation(api.demo.start, {});
    const firstSky = await first.query(api.flights.list, { scope: 'world', demo: true });
    const secondSky = await second.query(api.flights.list, { scope: 'world', demo: true });
    expect(firstSky.total).toBe(2);
    expect(secondSky.total).toBe(2);
    expect(firstSky.flights.some((flight) => secondSky.flights.some((other) => other.id === flight.id))).toBe(false);
    await expect(first.mutation(api.flights.reserve, { flightId: secondSky.flights[0].id })).rejects.toThrow('cannot be caught');
    const invite = await first.mutation(api.social.createInvite, {});
    await expect(second.mutation(api.social.acceptInvite, invite)).rejects.toThrow('isolated demo');
    await first.mutation(api.demo.reset, {});
    await first.mutation(api.demo.seed, {});
    expect((await first.query(api.flights.list, { scope: 'world', demo: true })).total).toBe(2);
    expect((await second.query(api.flights.list, { scope: 'world', demo: true })).flights.map((flight) => flight.id)).toEqual(secondSky.flights.map((flight) => flight.id));
    expect((await alice.query(api.flights.detail, normal)).flight?.state).toBe('in_flight');
    expect((await t.query(api.flights.list, { scope: 'world', demo: false })).total).toBe(1);
    expect((await t.query(api.flights.list, { scope: 'world', demo: true })).total).toBe(4);
  });

  it('scores the real catch game and never auto-accepts requests to a sample character', async () => {
    const t = convexTest(schema, modules);
    const anonymousId = await t.run(async (ctx) => ctx.db.insert('users', { isAnonymous: true }));
    const player = t.withIdentity({ subject: `${anonymousId}|session` });
    await player.mutation(api.demo.start, {});
    const world = await player.query(api.flights.list, { scope: 'world', demo: true });
    const flight = world.flights.find((entry) => entry.defense === 'zigzag')!;
    const attempt = await player.mutation(api.flights.reserve, { flightId: flight.id });
    await advanceTo(attempt.startedAt + 6000);
    expect((await player.mutation(api.flights.resolve, { attemptId: attempt.id, taps: tapsFor(attempt) })).outcome).toBe('caught');
    const detail = (await player.query(api.flights.detail, { id: flight.id })).flight!;
    expect(detail.canRequest).toBe(true);
    expect(detail.body).toContain('fictional pen pal');
    const request = await player.mutation(api.social.request, { flightId: flight.id });
    const pending = (await player.query(api.social.list, {})).find((connection) => connection.id === request.id)!;
    expect(pending.state).toBe('pending');
    expect(pending.profile.handle).toMatch(/^demo_coo_/);
    await expect(player.mutation(api.social.respond, { connectionId: request.id, response: 'accept' })).rejects.toThrow('unavailable');
    await player.mutation(api.demo.seed, {});
    expect((await player.query(api.social.list, {})).find((connection) => connection.id === request.id)?.state).toBe('pending');
  });
});
