/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isHit, type LaunchInput } from '../src/domain';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const users = await t.run(ctx => Promise.all(['sender', 'recipient', 'catcher'].map(name => ctx.db.insert('users', { email: `${name}@example.test` }))));
  const sessions = users.map(userId => t.withIdentity({ subject: `${userId}|session` }));
  const profiles = await Promise.all(sessions.map((session, index) => session.mutation(api.profiles.save, { handle: ['sender', 'recipient', 'catcher'][index], cityId: ['new-york', 'london', 'chicago'][index] as 'new-york' | 'london' | 'chicago' })));
  const [sender, recipient, catcher] = sessions;
  const birds = (await sender.mutation(api.onboarding.ensureFlock, {})).pigeons.map(bird => bird.id);
  const otherBird = (await recipient.mutation(api.onboarding.ensureFlock, {})).pigeons[0].id;
  await recipient.mutation(api.social.acceptInvite, await sender.mutation(api.social.createInvite, {}));
  const send = (changes: Partial<LaunchInput> = {}) => sender.mutation(api.flights.launch, { recipientId: profiles[1].id, body: 'A little hello', pigeonId: birds[0], anonymous: false, visibility: 'open', defense: 'cruise', openAcknowledged: true, demo: false, requestKey: 'one-letter', ...changes });
  return { t, sender, recipient, catcher, profiles, birds, otherBird, send };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T18:00:00Z')); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('owned pigeon dispatch', () => {
  it('reads only owned pigeons in canonical slot order with truthful availability and stats', async () => {
    const { sender, recipient, birds, send } = await setup();
    const flock = await sender.query(api.flock.list, {});
    expect(flock.map(bird => bird.name)).toEqual(['Mochi', 'Pip', 'Button', 'Noodle', 'Puddle']);
    expect(flock.every(bird => bird.ready && bird.deliveries === 0)).toBe(true);
    expect(await recipient.query(api.flock.list, {})).toHaveLength(5);
    const { id } = await send();
    expect((await sender.query(api.flock.list, {}))[0]).toMatchObject({ id: birds[0], ready: false, flightId: id, deliveries: 0 });
    const flight = (await sender.query(api.flights.detail, { id })).flight!;
    expect(flight.courier).toBe('Mochi');
    await vi.advanceTimersByTimeAsync(flight.arrivesAt - Date.now());
    await sender.mutation(api.flights.settleMine, {});
    await sender.mutation(api.flights.settleMine, {});
    expect((await sender.query(api.flock.list, {}))[0]).toEqual({ id: birds[0], name: 'Mochi', ready: true, deliveries: 1 });
  });

  it('rejects foreign/unavailable birds, deduplicates double dispatch, and retains the three-flight cap', async () => {
    const { sender, birds, otherBird, send } = await setup();
    await expect(send({ pigeonId: otherBird })).rejects.toThrow('own flock');
    await expect(send({ pigeonId: 'invalid' })).rejects.toThrow('own flock');
    await expect(send({ pigeonId: '' })).rejects.toThrow('own flock');
    const [first, retry] = await Promise.all([send(), send()]);
    expect(first.id).toBe(retry.id);
    await expect(send({ requestKey: 'second-letter' })).rejects.toThrow('unavailable');
    await expect(send({ pigeonId: birds[1] })).rejects.toThrow('different letter');
    await expect(send({ anonymous: true })).rejects.toThrow('different letter');
    await expect(send({ pigeonId: undefined })).rejects.toThrow('different letter');
    await send({ pigeonId: birds[1], requestKey: 'second-letter' });
    await send({ pigeonId: birds[2], requestKey: 'third-letter' });
    expect((await sender.query(api.flock.list, {})).filter(bird => bird.ready)).toHaveLength(2);
    await expect(send({ pigeonId: birds[3], requestKey: 'fourth-letter' })).rejects.toThrow('Three pigeons');
    expect((await send()).id).toBe(first.id);
  });

  it('preserves legacy payload retries without assigning a fictional owned pigeon', async () => {
    const { send, sender } = await setup();
    const first = await send({ pigeonId: undefined, anonymous: undefined });
    const retry = await send({ pigeonId: undefined, anonymous: undefined });
    expect(retry.id).toBe(first.id);
    expect((await sender.query(api.flock.list, {})).every(bird => bird.ready)).toBe(true);
  });

  it('atomically reserves one bird across concurrent distinct request keys', async () => {
    const { send, sender } = await setup();
    const attempts = await Promise.allSettled([send({ requestKey: 'device-one' }), send({ requestKey: 'device-two' })]);
    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(attempt => attempt.status === 'rejected')).toHaveLength(1);
    expect((await sender.query(api.flights.list, { scope: 'mine', demo: false })).flights).toHaveLength(1);
  });

  it('requires configured cities without changing either account and retains a launched route on retry', async () => {
    const { t, sender, recipient, profiles, send } = await setup();
    await t.run(ctx => ctx.db.patch('profiles', profiles[0].id, { cityId: undefined }));
    await expect(send()).rejects.toThrow('departure city');
    await expect(sender.mutation(api.profiles.setCity, { cityId: 'invented-city' as 'london' })).rejects.toThrow();
    expect((await sender.query(api.profiles.me, {}))?.cityId).toBeUndefined();
    await sender.mutation(api.profiles.setCity, { cityId: 'new-york' });
    await t.run(ctx => ctx.db.patch('profiles', profiles[1].id, { cityId: undefined }));
    await expect(send()).rejects.toThrow('friend must choose a city');
    expect((await recipient.query(api.profiles.me, {}))?.cityId).toBeUndefined();
    await recipient.mutation(api.profiles.setCity, { cityId: 'london' });
    const first = await send();
    await t.run(ctx => ctx.db.patch('profiles', profiles[0].id, { cityId: undefined }));
    expect((await send()).id).toBe(first.id);
    expect((await sender.query(api.flights.detail, first)).flight?.origin.name).toBe('New York');
  });
});

describe('anonymous send privacy', () => {
  it('hides sender identity in every projection while keeping the recipient body locked until delivery', async () => {
    const { t, sender, recipient, catcher, send, profiles } = await setup();
    await t.run(ctx => ctx.db.patch('profiles', profiles[0].id, { equipped: 'aviator' }));
    const { id } = await send({ anonymous: true });
    const owner = (await sender.query(api.flights.detail, { id })).flight!;
    expect(owner.senderHandle).toBe('sender');
    expect(owner.courier).toBe('Mochi');
    const views = [
      (await recipient.query(api.flights.detail, { id })).flight!,
      (await catcher.query(api.flights.detail, { id })).flight!,
      (await t.query(api.flights.detail, { id: owner.shareToken! })).flight!,
      ...(await recipient.query(api.flights.list, { scope: 'mine', demo: false })).flights,
      ...(await t.query(api.flights.list, { scope: 'world', demo: false })).flights,
    ];
    for (const view of views) {
      expect(view).toMatchObject({ anonymous: true, courier: 'A pigeon', outfit: 'classic' });
      expect(view).not.toHaveProperty('senderHandle');
      expect(view).not.toHaveProperty('otherProfileId');
      expect(view).not.toHaveProperty('body');
    }
    await vi.advanceTimersByTimeAsync(owner.arrivesAt - Date.now());
    await recipient.mutation(api.flights.settleMine, {});
    const delivered = (await recipient.query(api.flights.detail, { id })).flight!;
    expect(delivered.body).toBe('A little hello');
    expect(delivered.senderHandle).toBeUndefined();
    expect(delivered.otherProfileId).toBeUndefined();
    expect((await catcher.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
  });

  it('allows interception but never reveals an anonymous sender or enables a connection request', async () => {
    const { sender, catcher, recipient, send } = await setup();
    const { id } = await send({ anonymous: true });
    const attempt = await catcher.mutation(api.flights.reserve, { flightId: id });
    const taps = attempt.phases.map((phase, round) => {
      for (let ms = 0; ms < 2000; ms++) if (isHit(ms, phase)) return round * 2000 + ms;
      throw new Error('Missing timing window');
    });
    await vi.advanceTimersByTimeAsync(attempt.startedAt + 6000 - Date.now());
    await catcher.mutation(api.flights.resolve, { attemptId: attempt.id, taps });
    const caught = (await catcher.query(api.flights.detail, { id })).flight!;
    expect(caught).toMatchObject({ state: 'intercepted', body: 'A little hello', canRequest: false, courier: 'A pigeon' });
    expect(caught.senderHandle).toBeUndefined();
    expect(caught.otherProfileId).toBeUndefined();
    await expect(catcher.mutation(api.social.request, { flightId: id })).rejects.toThrow('Anonymous letters');
    expect((await recipient.query(api.flights.detail, { id })).flight?.body).toBeUndefined();
    expect((await sender.query(api.flock.list, {}))[0]).toMatchObject({ ready: true, deliveries: 0 });
  });

  it('requires explicit Open Skies consent even when anonymous', async () => {
    const { send } = await setup();
    await expect(send({ anonymous: true, openAcknowledged: false })).rejects.toThrow('Acknowledge');
  });
});
