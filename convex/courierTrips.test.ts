/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { v } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { durationSeconds, isHit } from '../src/domain';
import type { Attempt, LaunchInput } from '../src/domain';
import { api, internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';
import { CATCHER_LEASE_MS } from './courierTripModel';
import { launchFor } from './flightModel';
import { requireProfile } from './model';
import schema from './schema';
import { defense, visibility } from './validators';

const completion = vi.fn();
const modules = {
  ...import.meta.glob('./**/*.ts'),
  './returnTestHarness.ts': async () => ({ launch: mutation({
    args: { recipientId: v.string(), body: v.string(), visibility, defense, openAcknowledged: v.boolean(), demo: v.boolean(), requestKey: v.string() },
    handler: async (ctx, input) => ({ id: await launchFor(ctx, await requireProfile(ctx), input, { trackCourier: true }) }),
  }) }),
  './stones.ts': async () => ({ creditReturn: internalMutation({
    args: { tripId: v.id('courierTrips') },
    handler: async (ctx, { tripId }) => {
      const trip = await ctx.db.get('courierTrips', tripId);
      expect(trip?.status).toBe('returned');
      expect(trip?.returnedAt).toBeTypeOf('number');
      completion(tripId, trip?.ownerId);
      return null;
    },
  }) }),
};
const launchApi = makeFunctionReference<'mutation', LaunchInput, { id: string }>('returnTestHarness:launch');

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => Promise.all(['owner', 'recipient', 'catcher', 'outsider'].map((handle) => ctx.db.insert('users', { email: `${handle}@example.test` }))));
  const [a, b, c, d] = ids.map((id) => t.withIdentity({ subject: `${id}|session`, issuer: 'https://returns.test' }));
  const profiles = await Promise.all([a, b, c, d].map((client, i) => client.mutation(api.profiles.save, { handle: ['owner', 'recipient', 'catcher', 'outsider'][i], cityId: (['new-york', 'london', 'paris', 'tokyo'] as const)[i] })));
  await t.mutation(internal.demo.provision, { namespace: 'returns-test', userIds: ids.slice(0, 3) });
  await b.mutation(api.social.acceptInvite, await a.mutation(api.social.createInvite, {}));
  const launch = (requestKey = 'outbound') => a.mutation(launchApi, { recipientId: profiles[1].id, body: 'An actual original letter.', visibility: 'open', defense: 'cruise', openAcknowledged: true, demo: true, requestKey });
  return { t, a, b, c, d, profiles, launch };
}

async function catchFlight(client: Awaited<ReturnType<typeof setup>>['c'], flightId: string) {
  const attempt: Attempt = await client.mutation(api.flights.reserve, { flightId });
  const taps = attempt.phases.map((phase, round) => {
    for (let at = 0; at < 2000; at++) if (isHit(at, phase)) return round * 2000 + at;
    throw new Error('No hit window');
  });
  vi.setSystemTime(attempt.startedAt + 6000);
  expect((await client.mutation(api.flights.resolve, { attemptId: attempt.id, taps })).outcome).toBe('caught');
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T20:00:00Z')); completion.mockClear(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('courier custody and return trips', () => {
  it('authorizes a caught-letter return without befriending, preserves its owner, and emits one completion', async () => {
    const { t, a, b, c, d, profiles, launch } = await setup();
    const { id } = await launch();
    expect(await c.mutation(api.courierTrips.open, { flightId: id })).toBeNull();
    await catchFlight(c, id);
    const caught = (await c.mutation(api.courierTrips.open, { flightId: id }))!;
    expect(caught.body).toBe('An actual original letter.');
    expect(caught.trip).toMatchObject({ status: 'held', holderKind: 'catcher', replyDeadline: Date.now() + CATCHER_LEASE_MS, canReturn: true });
    expect((await c.query(api.flights.detail, { id })).flight).not.toHaveProperty('body');
    for (const outsider of [b, d]) {
      expect(await outsider.query(api.courierTrips.status, { flightId: id })).toBeNull();
      expect(await outsider.mutation(api.courierTrips.open, { flightId: id })).toBeNull();
      await expect(outsider.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'steal' })).rejects.toThrow();
    }
    expect(completion).not.toHaveBeenCalled();
    const input = { flightId: id, requestKey: 'return-1', body: 'A detour. Sending your pigeon home!', openAcknowledged: true };
    const [first, duplicate] = await Promise.all([c.mutation(api.courierTrips.returnHome, input), c.mutation(api.courierTrips.returnHome, input)]);
    expect(duplicate).toEqual(first);
    expect((await c.query(api.social.list, {})).some((item) => item.profile.id === profiles[0].id)).toBe(false);
    await expect(c.mutation(api.flights.launch, { recipientId: profiles[0].id, body: 'Unrestricted DM', visibility: 'open', defense: 'cruise', openAcknowledged: true, demo: true, requestKey: 'not-a-return' })).rejects.toThrow('Connect');
    const returning = (await a.query(api.flights.detail, { id: first.flightId })).flight!;
    expect(returning).not.toHaveProperty('body');
    expect(returning.arrivesAt - returning.departedAt).toBe(durationSeconds(returning.distanceKm, true, 'cruise') * 1000);
    expect((await c.mutation(api.courierTrips.open, { flightId: id }))!).not.toHaveProperty('body');
    vi.setSystemTime(returning.arrivesAt);
    await a.mutation(api.flights.settleMine, {});
    await a.mutation(api.flights.settleMine, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await a.mutation(api.courierTrips.open, { flightId: first.flightId }))?.body).toBe(input.body);
    expect(completion.mock.calls).toEqual([[caught.trip.id, profiles[0].id]]);
    expect((await a.query(api.courierTrips.availability, {})).available).toBe(3);
    await expect(c.mutation(api.courierTrips.returnHome, { ...input, body: 'changed' })).rejects.toThrow('unchanged');
  });

  it('delivers to the intended recipient without a deadline or a fabricated owner countdown', async () => {
    const { t, a, b, launch } = await setup();
    const { id } = await launch();
    const flight = (await a.query(api.flights.detail, { id })).flight!;
    vi.setSystemTime(flight.arrivesAt);
    const delivered = (await b.mutation(api.courierTrips.open, { flightId: id }))!;
    expect(delivered.trip).toMatchObject({ status: 'held', holderKind: 'recipient' });
    expect(delivered.trip.replyDeadline).toBeNull();
    expect((await a.query(api.courierTrips.availability, {}))).toMatchObject({ available: 2, away: [{ awaitingRecipient: true }] });
    vi.setSystemTime(Date.now() + 7 * 86400_000);
    expect((await b.mutation(api.courierTrips.open, { flightId: id }))?.body).toBe('An actual original letter.');
    expect(completion).not.toHaveBeenCalled();
    const sent = await b.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'late-reply', body: 'No deadline.', openAcknowledged: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await a.query(api.flights.detail, { id: sent.flightId })).flight?.body).toBe('No deadline.');
    expect(completion).toHaveBeenCalledTimes(1);
  });

  it.each(['before', 'at', 'after'] as const)('resolves a reply %s the lease boundary transactionally', async (boundary) => {
    const { t, a, c, launch } = await setup();
    const { id } = await launch();
    await catchFlight(c, id);
    const view = (await c.mutation(api.courierTrips.open, { flightId: id }))!;
    vi.setSystemTime(view.trip.replyDeadline! + (boundary === 'before' ? -1 : boundary === 'at' ? 0 : 1));
    const [sent] = await Promise.all([
      c.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'race', body: 'On the boundary', openAcknowledged: true }),
      t.mutation(internal.courierTrips.expire, { tripId: view.trip.id as never, heldFlightId: id as never }),
    ]);
    expect(sent.kind).toBe(boundary === 'before' ? 'reply' : 'empty');
    expect(sent.expired).toBe(boundary !== 'before');
    expect((await c.mutation(api.courierTrips.open, { flightId: id }))!).not.toHaveProperty('body');
    expect(await t.run(async (ctx) => (await ctx.db.query('courierReturns').take(10)).length)).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(completion).toHaveBeenCalledTimes(1);
    const landed = (await a.query(api.flights.detail, { id: sent.flightId })).flight!;
    expect(landed.body).toBe(boundary === 'before' ? 'On the boundary' : undefined);
  });

  it('returns empty while everyone is offline, denies empty catches, and never inserts a blank message', async () => {
    const { t, b, c, launch } = await setup();
    const { id } = await launch();
    await catchFlight(c, id);
    const caught = (await c.mutation(api.courierTrips.open, { flightId: id }))!;
    vi.setSystemTime(caught.trip.replyDeadline!);
    await t.mutation(internal.courierTrips.expire, { tripId: caught.trip.id as never, heldFlightId: id as never });
    const status = (await c.query(api.courierTrips.status, { flightId: id }))!;
    await expect(b.mutation(api.flights.reserve, { flightId: status.currentFlightId })).rejects.toThrow('cannot be caught');
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(completion).toHaveBeenCalledTimes(1);
    expect((await c.query(api.courierTrips.status, { flightId: id }))?.returnKind).toBe('empty');
    const messages = await t.run((ctx) => ctx.db.query('messages').take(10));
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe('An actual original letter.');
  });

  it('keeps recaptured reply legs on the same root and rewards only the original owner', async () => {
    const { t, a, b, c, launch, profiles } = await setup();
    const { id } = await launch();
    await catchFlight(c, id);
    const root = (await c.query(api.courierTrips.status, { flightId: id }))!;
    const reply = await c.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'first', body: 'Catchable return', openAcknowledged: true });
    await catchFlight(b, reply.flightId);
    const recaught = (await b.mutation(api.courierTrips.open, { flightId: reply.flightId }))!;
    expect(recaught.body).toBe('Catchable return');
    expect(recaught.trip.id).toBe(root.id);
    expect(recaught.trip.ownerHandle).toBe('owner');
    expect(recaught.trip.courier).toEqual(root.courier);
    expect(recaught.trip.replyDeadline).toBe(Date.now() + CATCHER_LEASE_MS);
    await b.mutation(api.courierTrips.returnHome, { flightId: reply.flightId, requestKey: 'second' });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(completion.mock.calls).toEqual([[root.id, profiles[0].id]]);
    expect((await a.query(api.courierTrips.status, { flightId: id }))?.status).toBe('returned');
    expect(await t.run(async (ctx) => (await ctx.db.query('courierTrips').take(10)).length)).toBe(1);
  });

  it('enforces 280 code points, consent, blocking and public projection privacy', async () => {
    const { t, a, c, profiles, launch } = await setup();
    const { id } = await launch();
    await catchFlight(c, id);
    for (const body of ['', '  ', '🕊'.repeat(281)]) await expect(c.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'invalid', body, openAcknowledged: true })).rejects.toThrow('280');
    await expect(c.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'invalid', body: 'Hello' })).rejects.toThrow('Acknowledge');
    const world = await c.query(api.flights.list, { scope: 'world', demo: true });
    expect(JSON.stringify(world)).not.toMatch(/actual original|recipientHandle|recipientId|ownerHandle/);
    await t.run(async (ctx) => ctx.db.insert('blocks', { blockerId: profiles[0].id as never, blockedId: profiles[2].id as never, namespace: 'returns-test', createdAt: Date.now() }));
    await expect(c.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'blocked', body: 'Hello', openAcknowledged: true })).rejects.toThrow('connection is unavailable');
    const result = await c.mutation(api.courierTrips.returnHome, { flightId: id, requestKey: 'empty' });
    expect(result.kind).toBe('empty');
    expect((await a.query(api.courierTrips.availability, {})).available).toBe(2);
  });

  it('holds three new-path courier slots until home without changing old launch semantics', async () => {
    const { a, b, launch, profiles } = await setup();
    for (let i = 0; i < 3; i++) {
      const { id } = await launch(`slot-${i}`);
      const flight = (await a.query(api.flights.detail, { id })).flight!;
      vi.setSystemTime(flight.arrivesAt);
      await b.mutation(api.courierTrips.open, { flightId: id });
    }
    await expect(launch('fourth')).rejects.toThrow('three couriers are away');
    expect((await a.query(api.courierTrips.availability, {})).available).toBe(0);
    await expect(a.mutation(api.flights.launch, { recipientId: profiles[1].id, body: 'Historical path', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, demo: true, requestKey: 'legacy' })).resolves.toHaveProperty('id');
  });
});
