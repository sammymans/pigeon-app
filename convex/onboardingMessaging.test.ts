/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T18:00:00Z')); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(ctx => Promise.all(['+14155550101', '+14155550102'].map(phone => ctx.db.insert('users', { phone, phoneVerificationTime: Date.now() }))));
  const [alice, bob] = ids.map(id => t.withIdentity({ subject: `${id}|session` }));
  const flock = await alice.mutation(api.onboarding.complete, { username: 'alice.post' });
  const otherFlock = await bob.mutation(api.onboarding.complete, { username: 'bob.post' });
  const recipient = (await bob.query(api.profiles.me, {}))!;
  const invitation = await alice.mutation(api.social.createInvite, {});
  await bob.mutation(api.social.acceptInvite, invitation);
  const input = { recipientId: recipient.id, pigeonId: flock.pigeons[0].id, body: 'A first hello', visibility: 'open' as const, defense: 'cruise' as const, openAcknowledged: true, demo: false, requestKey: 'first' };
  return { t, alice, bob, flock, otherFlock, input };
}

it('connects new phone profiles, explicit cities, and the owned flock to a delivered letter', async () => {
  const { t, alice, bob, flock, input } = await setup();
  await expect(alice.mutation(api.flights.launch, input)).rejects.toThrow('choose a city');
  await alice.mutation(api.profiles.setCity, { cityId: 'new-york' });
  await expect(alice.mutation(api.flights.launch, input)).rejects.toThrow('choose a city');
  await bob.mutation(api.profiles.setCity, { cityId: 'london' });
  const flight = await alice.mutation(api.flights.launch, input);
  expect((await alice.query(api.onboarding.flock, {})).pigeons[0]).toMatchObject({ id: flock.pigeons[0].id, activeFlightId: flight.id });
  const before = (await bob.query(api.flights.detail, flight))!.flight!;
  expect(before.body).toBeUndefined();
  expect(before.pigeonId).toBeUndefined();
  expect(before.courier).toBe('Mochi');
  await vi.advanceTimersByTimeAsync(before.arrivesAt - Date.now() + 1);
  await t.finishInProgressScheduledFunctions();
  await alice.mutation(api.flights.settleMine, {});
  expect((await bob.query(api.flights.detail, flight)).flight?.body).toBe(input.body);
  expect((await alice.query(api.onboarding.flock, {})).pigeons[0]).not.toHaveProperty('activeFlightId');
});

it('prevents borrowed birds, concurrent reuse, and changed-bird retries', async () => {
  const { alice, bob, flock, otherFlock, input } = await setup();
  await alice.mutation(api.profiles.setCity, { cityId: 'new-york' });
  await bob.mutation(api.profiles.setCity, { cityId: 'london' });
  await expect(alice.mutation(api.flights.launch, { ...input, pigeonId: otherFlock.pigeons[0].id })).rejects.toThrow('own flock');
  const results = await Promise.allSettled(['a', 'b'].map(requestKey => alice.mutation(api.flights.launch, { ...input, requestKey })));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  const key = results[0].status === 'fulfilled' ? 'a' : 'b';
  const first = await alice.mutation(api.flights.launch, { ...input, requestKey: key });
  expect(await alice.mutation(api.flights.launch, { ...input, requestKey: key })).toEqual(first);
  await expect(alice.mutation(api.flights.launch, { ...input, requestKey: key, pigeonId: flock.pigeons[1].id })).rejects.toThrow('different letter');
  const second = await alice.mutation(api.flights.launch, { ...input, pigeonId: flock.pigeons[1].id, requestKey: 'pip' });
  expect((await alice.query(api.flights.detail, second)).flight).toMatchObject({ courier: 'Pip', pigeonId: flock.pigeons[1].id });
});
