/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import type { TestConvex } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CityId, LaunchInput } from '../src/domain';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
type Test = TestConvex<typeof schema>;

async function user(t: Test, anonymous = true) {
  const userId = await t.run(async (ctx) => ctx.db.insert('users', anonymous ? { isAnonymous: true } : {}));
  return { userId, client: t.withIdentity({ subject: `${userId}|session`, issuer: 'https://pigeon.test' }) };
}

async function pair(t: Test, prefix = 'pair', origin: CityId = 'new-york', destination: CityId = 'london') {
  const { client: sender, userId: senderUserId } = await user(t);
  const { client: recipient, userId: recipientUserId } = await user(t);
  await sender.mutation(api.starterPair.create, { handle: `${prefix}_sender`, cityId: origin });
  const token = (await sender.query(api.starterPair.status, {}))!.inviteToken!;
  await recipient.mutation(api.starterPair.join, { token, handle: `${prefix}_recipient`, cityId: destination });
  const senderProfile = (await sender.query(api.profiles.me, {}))!;
  const recipientProfile = (await recipient.query(api.profiles.me, {}))!;
  const input: LaunchInput = { recipientId: recipientProfile.id, body: 'Only the recipient may read this after delivery.', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, demo: true, requestKey: `${prefix}-letter` };
  return { sender, recipient, senderUserId, recipientUserId, senderProfile, recipientProfile, token, input };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T18:00:00Z'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('authenticated two-person starter rooms', () => {
  it('requires anonymous Convex Auth identity and refuses normal accounts or caller-supplied ownership', async () => {
    const t = convexTest(schema, modules);
    const create = { handle: 'alice', cityId: 'new-york' as const };
    const join = { ...create, token: 'unavailable' };
    expect(await t.query(api.starterPair.status, {})).toBeNull();
    await expect(t.mutation(api.starterPair.create, create)).rejects.toThrow('anonymous demo provider');
    await expect(t.mutation(api.starterPair.join, join)).rejects.toThrow('anonymous demo provider');
    const normal = await user(t, false);
    await expect(normal.client.mutation(api.starterPair.create, create)).rejects.toThrow('anonymous demo provider');
    await expect(normal.client.mutation(api.starterPair.join, join)).rejects.toThrow('anonymous demo provider');
    const profile = await normal.client.mutation(api.profiles.save, create);
    expect(profile.demo).toBe(false);
    expect(await normal.client.query(api.starterPair.status, {})).toBeNull();
    const anonymous = await user(t);
    await expect(anonymous.client.mutation(api.profiles.save, { ...create, handle: 'bruno' })).rejects.toThrow('isolated demo');
    const spoofed = { ...create, userId: normal.userId };
    await expect(anonymous.client.mutation(api.starterPair.create, spoofed)).rejects.toThrow();
    await expect(t.withIdentity({ subject: 'missing-user|session' }).mutation(api.starterPair.create, create)).rejects.toThrow();
    expect(await anonymous.client.query(api.profiles.me, {})).toBeNull();
    expect(await normal.client.query(api.profiles.me, {})).toEqual(profile);
  });

  it('creates exactly two real members and one accepted friendship without fixtures, letters, or credentials', async () => {
    const t = convexTest(schema, modules);
    const { sender, recipient, senderProfile, recipientProfile, senderUserId, recipientUserId } = await pair(t);
    expect(senderProfile.demo).toBe(true);
    expect(recipientProfile.demo).toBe(true);
    expect(senderProfile.id).not.toBe(recipientProfile.id);
    expect(await sender.query(api.starterPair.status, {})).toEqual({ inviteToken: null, expiresAt: null, partner: recipientProfile });
    expect(await recipient.query(api.starterPair.status, {})).toEqual({ inviteToken: null, expiresAt: null, partner: senderProfile });
    const sent = await sender.query(api.social.list, {});
    const received = await recipient.query(api.social.list, {});
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ profile: recipientProfile, state: 'accepted', direction: 'outgoing' });
    expect(received).toEqual([{ id: sent[0].id, profile: senderProfile, state: 'accepted', direction: 'incoming' }]);
    await t.run(async (ctx) => {
      expect(await ctx.db.query('users').take(10)).toHaveLength(2);
      expect(await ctx.db.query('authAccounts').take(10)).toEqual([]);
      expect(await ctx.db.query('demoNamespaces').take(10)).toEqual([]);
      expect(await ctx.db.query('flights').take(10)).toEqual([]);
      expect(await ctx.db.query('messages').take(10)).toEqual([]);
      const profiles = await ctx.db.query('profiles').take(10);
      expect(profiles).toHaveLength(2);
      expect(new Set(profiles.map((profile) => profile.userId))).toEqual(new Set([senderUserId, recipientUserId]));
      expect(new Set(profiles.map((profile) => profile.namespace)).size).toBe(1);
    });
  });

  it('keeps the private unused invitation owner-only and never accepts it as identity', async () => {
    const t = convexTest(schema, modules);
    const { client: owner } = await user(t);
    const { client: stranger } = await user(t);
    await owner.mutation(api.starterPair.create, { handle: 'owner', cityId: 'paris' });
    const state = (await owner.query(api.starterPair.status, {}))!;
    expect(state.inviteToken).toMatch(/^[a-f0-9]{64}$/);
    expect(state.expiresAt).toBe(await owner.mutation(api.profiles.clock, {}) + 30 * 60_000);
    expect(state.partner).toBeNull();
    expect(await t.query(api.starterPair.status, {})).toBeNull();
    expect(await stranger.query(api.starterPair.status, {})).toBeNull();
    const token = state.inviteToken!;
    await expect(t.mutation(api.starterPair.join, { token, handle: 'intruder', cityId: 'paris' })).rejects.toThrow('anonymous demo provider');
    await expect(stranger.mutation(api.starterPair.join, { token: `${token}wrong`, handle: 'intruder', cityId: 'paris' })).rejects.toThrow('unavailable');
    await expect(stranger.mutation(api.social.acceptInvite, { token })).rejects.toThrow('Sign in');
    const ownerProfile = (await owner.query(api.profiles.me, {}))!;
    expect(JSON.stringify(ownerProfile)).not.toContain(token);
    expect(await owner.query(api.social.list, {})).toEqual([]);
    expect((await owner.query(api.flights.list, { scope: 'mine', demo: true })).flights).toEqual([]);
    expect(await stranger.query(api.profiles.me, {})).toBeNull();
  });

  it('retries create and join atomically without changing profiles, invitations, or blocked friendships', async () => {
    const t = convexTest(schema, modules);
    const { client: owner } = await user(t);
    const { client: member } = await user(t);
    const create = { handle: 'owner', cityId: 'paris' as const };
    await Promise.all([owner.mutation(api.starterPair.create, create), owner.mutation(api.starterPair.create, create)]);
    const before = (await owner.query(api.starterPair.status, {}))!;
    await owner.mutation(api.starterPair.create, { handle: 'different', cityId: 'tokyo' });
    expect(await owner.query(api.starterPair.status, {})).toEqual(before);
    const join = { token: before.inviteToken!, handle: 'member', cityId: 'london' as const };
    await Promise.all([member.mutation(api.starterPair.join, join), member.mutation(api.starterPair.join, join)]);
    const memberProfile = (await member.query(api.profiles.me, {}))!;
    const ownerProfile = (await owner.query(api.profiles.me, {}))!;
    await member.mutation(api.social.block, { profileId: ownerProfile.id });
    vi.setSystemTime(before.expiresAt! + 1);
    await member.mutation(api.starterPair.join, { ...join, handle: 'changed', cityId: 'sydney' });
    await owner.mutation(api.starterPair.create, create);
    expect(await member.query(api.profiles.me, {})).toEqual(memberProfile);
    expect(ownerProfile.handle).toBe('owner');
    expect((await owner.query(api.starterPair.status, {}))!.inviteToken).toBeNull();
    expect(await member.query(api.social.list, {})).toEqual([]);
    await t.run(async (ctx) => {
      expect(await ctx.db.query('profiles').take(10)).toHaveLength(2);
      expect(await ctx.db.query('starterPairs').take(10)).toHaveLength(1);
      const connections = await ctx.db.query('connections').take(10);
      expect(connections).toHaveLength(1);
      expect(connections[0].state).toBe('declined');
    });
  });

  it('allows only one competing join, rejects third members, and does not create a loser profile', async () => {
    const t = convexTest(schema, modules);
    const { client: owner } = await user(t);
    const contenders = [await user(t), await user(t)];
    await owner.mutation(api.starterPair.create, { handle: 'owner', cityId: 'paris' });
    const token = (await owner.query(api.starterPair.status, {}))!.inviteToken!;
    const outcomes = await Promise.allSettled(contenders.map(({ client }, i) => client.mutation(api.starterPair.join, { token, handle: `member_${i}`, cityId: 'tokyo' })));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    const loser = contenders[outcomes.findIndex((outcome) => outcome.status === 'rejected')].client;
    expect(await loser.query(api.profiles.me, {})).toBeNull();
    expect(await loser.query(api.starterPair.status, {})).toBeNull();
    await expect(loser.mutation(api.starterPair.join, { token, handle: 'third', cityId: 'paris' })).rejects.toThrow('unavailable');
    await expect(owner.mutation(api.starterPair.join, { token, handle: 'owner', cityId: 'paris' })).rejects.toThrow('cannot be converted');
  });

  it('enforces expiration at the exact server deadline even before its scheduled state update', async () => {
    const t = convexTest(schema, modules);
    const { client: owner } = await user(t);
    const { client: member } = await user(t);
    await owner.mutation(api.starterPair.create, { handle: 'owner', cityId: 'paris' });
    const state = (await owner.query(api.starterPair.status, {}))!;
    const room = await t.run(async (ctx) => (await ctx.db.query('starterPairs').take(1))[0]);
    await t.mutation(internal.starterPair.expireInvitation, { roomId: room._id });
    expect((await owner.query(api.starterPair.status, {}))!.inviteToken).not.toBeNull();
    vi.setSystemTime(state.expiresAt!);
    await expect(member.mutation(api.starterPair.join, { token: state.inviteToken!, handle: 'member', cityId: 'london' })).rejects.toThrow('expired');
    expect(await member.query(api.profiles.me, {})).toBeNull();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await owner.query(api.starterPair.status, {})).toEqual({ inviteToken: null, expiresAt: state.expiresAt, partner: null });
    await owner.mutation(api.starterPair.create, { handle: 'owner', cityId: 'paris' });
    expect((await owner.query(api.starterPair.status, {}))!.inviteToken).toBeNull();
  });

  it('accepts just before expiration and keeps the joined membership after scheduled expiry', async () => {
    const t = convexTest(schema, modules);
    const { client: owner } = await user(t);
    const { client: member } = await user(t);
    await owner.mutation(api.starterPair.create, { handle: 'owner', cityId: 'paris' });
    const state = (await owner.query(api.starterPair.status, {}))!;
    vi.setSystemTime(state.expiresAt! - 1);
    await member.mutation(api.starterPair.join, { token: state.inviteToken!, handle: 'member', cityId: 'london' });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await owner.query(api.starterPair.status, {}))?.partner?.handle).toBe('member');
    expect((await member.query(api.social.list, {}))[0].state).toBe('accepted');
  });

  it('validates normalized globally unique handles and cities without consuming a failed invitation', async () => {
    const t = convexTest(schema, modules);
    const { client: owner } = await user(t);
    const { client: member } = await user(t);
    const { client: normal } = await user(t, false);
    await normal.mutation(api.profiles.save, { handle: 'taken', cityId: 'london' });
    await expect(owner.mutation(api.starterPair.create, { handle: 'ab', cityId: 'paris' })).rejects.toThrow('3–24');
    await expect(owner.mutation(api.starterPair.create, { handle: '@TAKEN', cityId: 'paris' })).rejects.toThrow('already taken');
    await expect(owner.mutation(api.starterPair.create, { handle: 'owner', cityId: 'atlantis' as CityId })).rejects.toThrow();
    expect(await owner.query(api.profiles.me, {})).toBeNull();
    await owner.mutation(api.starterPair.create, { handle: ' @OWNER ', cityId: 'paris' });
    expect((await owner.query(api.profiles.me, {}))!.handle).toBe('owner');
    const token = (await owner.query(api.starterPair.status, {}))!.inviteToken!;
    await expect(member.mutation(api.starterPair.join, { token, handle: 'owner', cityId: 'london' })).rejects.toThrow('already taken');
    await expect(member.mutation(api.starterPair.join, { token, handle: 'bad!', cityId: 'london' })).rejects.toThrow('3–24');
    expect(await member.query(api.profiles.me, {})).toBeNull();
    await member.mutation(api.starterPair.join, { token, handle: ' @MEMBER ', cityId: 'london' });
    expect((await member.query(api.profiles.me, {}))!.handle).toBe('member');
  });

  it('isolates other rooms and legacy demos without converting, seeding, or resetting either', async () => {
    const t = convexTest(schema, modules);
    const first = await pair(t, 'first');
    const second = await pair(t, 'second');
    const { client: legacy } = await user(t);
    await legacy.mutation(api.demo.start, {});
    const legacyBefore = await legacy.query(api.flights.list, { scope: 'mine', demo: true });
    for (const client of [first.sender, first.recipient]) {
      await expect(client.mutation(api.demo.start, {})).rejects.toThrow('cannot be converted');
      await expect(client.mutation(api.demo.seed, {})).rejects.toThrow('prepared demo');
      await expect(client.mutation(api.demo.reset, {})).rejects.toThrow('prepared demo');
    }
    for (const client of [second.sender, second.recipient, legacy]) {
      await expect(client.mutation(api.starterPair.join, { token: first.token, handle: 'converted', cityId: 'paris' })).rejects.toThrow('cannot be converted');
    }
    await expect(legacy.mutation(api.starterPair.create, { handle: 'converted', cityId: 'paris' })).rejects.toThrow('cannot be converted');
    expect(await legacy.query(api.starterPair.status, {})).toBeNull();
    const invite = await first.sender.mutation(api.social.createInvite, {});
    await expect(second.sender.mutation(api.social.acceptInvite, invite)).rejects.toThrow('isolated demo');
    await expect(first.sender.mutation(api.flights.launch, { ...first.input, recipientId: second.recipientProfile.id })).rejects.toThrow('isolated demo');
    await expect(first.sender.mutation(api.flights.launch, { ...first.input, demo: false })).rejects.toThrow('isolated flight mode');
    const updated = await first.sender.mutation(api.profiles.save, { handle: 'updated', cityId: 'sydney' });
    expect(updated.demo).toBe(true);
    expect((await first.sender.query(api.starterPair.status, {}))!.partner?.id).toBe(first.recipientProfile.id);
    expect(await legacy.query(api.flights.list, { scope: 'mine', demo: true })).toEqual(legacyBefore);
    await legacy.mutation(api.demo.reset, {});
    expect((await first.sender.query(api.social.list, {}))[0].state).toBe('accepted');
    expect((await second.sender.query(api.social.list, {}))[0].state).toBe('accepted');
  });

  it('refuses an anonymous identity that already owns a normal profile', async () => {
    const t = convexTest(schema, modules);
    const paired = await pair(t);
    const existing = await user(t);
    await t.run(async (ctx) => ctx.db.insert('profiles', { userId: existing.userId, handle: 'existing', cityId: 'paris', equipped: 'classic', demo: false, namespace: 'live' }));
    await expect(existing.client.mutation(api.starterPair.create, { handle: 'converted', cityId: 'paris' })).rejects.toThrow('cannot be converted');
    await expect(existing.client.mutation(api.starterPair.join, { token: paired.token, handle: 'converted', cityId: 'paris' })).rejects.toThrow('cannot be converted');
    expect((await existing.client.query(api.profiles.me, {}))!.demo).toBe(false);
  });
});

describe('first-letter flight engine contract', () => {
  it('denies pending sealed bodies in every projection and foreign client, then settles and sends a real timed reply', async () => {
    const t = convexTest(schema, modules);
    const { sender, recipient, senderProfile, recipientProfile, input } = await pair(t);
    const foreign = await pair(t, 'foreign');
    const { client: normal } = await user(t, false);
    await normal.mutation(api.profiles.save, { handle: 'normal', cityId: 'paris' });
    const { id } = await sender.mutation(api.flights.launch, input);
    const pending = (await recipient.query(api.flights.detail, { id })).flight!;
    expect(pending.state).toBe('in_flight');
    expect(pending).not.toHaveProperty('body');
    expect(pending).not.toHaveProperty('shareToken');
    expect(pending.otherProfileId).toBe(senderProfile.id);
    expect((await sender.query(api.flights.detail, { id })).flight!.body).toBe(input.body);
    for (const client of [sender, recipient, foreign.sender, foreign.recipient, normal]) {
      for (const demo of [false, true]) {
        for (const scope of ['mine', 'world'] as const) {
          const list = await client.query(api.flights.list, { scope, demo });
          expect(JSON.stringify(list)).not.toContain(input.body);
          expect(list.flights.every((flight) => !('body' in flight))).toBe(true);
          if (scope === 'world' || (client !== sender && client !== recipient) || !demo) expect(list.flights).toEqual([]);
        }
      }
      expect(JSON.stringify(await client.query(api.social.list, {}))).not.toContain(input.body);
      expect(JSON.stringify(await client.query(api.starterPair.status, {}))).not.toContain(input.body);
      expect(JSON.stringify(await client.query(api.profiles.me, {}))).not.toContain(input.body);
    }
    for (const client of [t, foreign.sender, foreign.recipient, normal]) {
      expect(await client.query(api.flights.detail, { id })).toEqual({ flight: null, serverTime: 0 });
    }
    for (const demo of [false, true]) expect((await t.query(api.flights.list, { scope: 'world', demo })).flights).toEqual([]);
    await expect(t.query(api.flights.list, { scope: 'mine', demo: true })).rejects.toThrow('Sign in');
    await expect(t.mutation(api.flights.settleMine, {})).rejects.toThrow('Sign in');
    await expect(t.mutation(api.flights.launch, input)).rejects.toThrow('Sign in');
    await sender.mutation(api.profiles.setCity, { cityId: 'sydney' });
    await recipient.mutation(api.profiles.setCity, { cityId: 'paris' });
    await vi.advanceTimersByTimeAsync(pending.arrivesAt - Date.now() - 1);
    await t.finishInProgressScheduledFunctions();
    await recipient.mutation(api.flights.settleMine, {});
    expect((await recipient.query(api.flights.detail, { id })).flight).not.toHaveProperty('body');
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    const delivered = (await recipient.query(api.flights.detail, { id })).flight!;
    expect(delivered.state).toBe('delivered');
    expect(delivered.body).toBe(input.body);
    expect(delivered.origin.id).toBe('new-york');
    expect(delivered.destination.id).toBe('london');
    expect(delivered.arrivesAt).toBe(pending.arrivesAt);
    expect(delivered.events.at(-1)).toEqual({ at: pending.arrivesAt, label: 'Delivered' });
    expect((await recipient.query(api.flights.list, { scope: 'mine', demo: true })).flights[0]).not.toHaveProperty('body');
    for (const client of [t, foreign.sender, normal]) expect((await client.query(api.flights.detail, { id })).flight).toBeNull();
    expect((await recipient.query(api.flights.list, { scope: 'mine', demo: true })).flights).toHaveLength(1);
    const replyTime = await recipient.mutation(api.profiles.clock, {});
    const reply = await recipient.mutation(api.flights.launch, { ...input, recipientId: delivered.otherProfileId!, body: 'A reply composed by the second person.', requestKey: 'reply' });
    expect(reply.id).not.toBe(id);
    const replyPending = (await sender.query(api.flights.detail, reply)).flight!;
    expect(replyPending.state).toBe('in_flight');
    expect(replyPending).not.toHaveProperty('body');
    expect(replyPending.otherProfileId).toBe(recipientProfile.id);
    expect(replyPending.departedAt).toBe(replyTime);
    expect(replyPending.arrivesAt).toBeGreaterThan(replyPending.departedAt);
    expect(replyPending.origin.id).toBe('paris');
    expect(replyPending.destination.id).toBe('sydney');
    await vi.advanceTimersByTimeAsync(replyPending.arrivesAt - Date.now());
    await t.finishInProgressScheduledFunctions();
    expect((await sender.query(api.flights.detail, reply)).flight).toMatchObject({ state: 'delivered', body: 'A reply composed by the second person.' });
  });

  it('never treats a local countdown or query as delivery and recovers overdue state exactly once on reconnect', async () => {
    const t = convexTest(schema, modules);
    const { sender, recipient, input } = await pair(t);
    const foreign = await pair(t, 'foreign');
    const result = await sender.mutation(api.flights.launch, input);
    const pending = (await recipient.query(api.flights.detail, result)).flight!;
    vi.setSystemTime(pending.arrivesAt + 60_000);
    expect((await recipient.query(api.flights.detail, result)).flight).toMatchObject({ state: 'in_flight' });
    expect((await recipient.query(api.flights.detail, result)).flight).not.toHaveProperty('body');
    await foreign.sender.mutation(api.flights.settleMine, {});
    expect((await recipient.query(api.flights.detail, result)).flight).not.toHaveProperty('body');
    await recipient.mutation(api.flights.settleMine, {});
    const delivered = (await recipient.query(api.flights.detail, result)).flight!;
    expect(delivered).toMatchObject({ state: 'delivered', body: input.body, departedAt: pending.departedAt, arrivesAt: pending.arrivesAt });
    await recipient.mutation(api.flights.settleMine, {});
    await sender.mutation(api.flights.settleMine, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await recipient.query(api.flights.detail, result)).flight!.events.filter((event) => event.label === 'Delivered')).toEqual([{ at: pending.arrivesAt, label: 'Delivered' }]);
  });

  it.each([
    ['san-francisco', 'san-francisco', 0, 120, 30],
    ['san-francisco', 'los-angeles', 559.1205770615533, 33548, 30],
    ['san-francisco', 'new-york', 4129.08616505731, 247746, 69],
    ['new-york', 'london', 5570.222179737958, 334214, 90],
  ] as const)('uses exact normal and demo cruise times from %s to %s', async (origin, destination, distance, normalSeconds, demoSeconds) => {
    const t = convexTest(schema, modules);
    const demo = await pair(t, 'demo', origin, destination);
    const demoFlight = await demo.sender.mutation(api.flights.launch, demo.input);
    const demoDetails = (await demo.sender.query(api.flights.detail, demoFlight)).flight!;
    expect(demoDetails.distanceKm).toBeCloseTo(distance, 8);
    expect(demoDetails.arrivesAt - demoDetails.departedAt).toBe(demoSeconds * 1000);
    const { client: sender } = await user(t, false);
    const { client: recipient } = await user(t, false);
    await sender.mutation(api.profiles.save, { handle: 'normal_sender', cityId: origin });
    const recipientProfile = await recipient.mutation(api.profiles.save, { handle: 'normal_recipient', cityId: destination });
    const invite = await sender.mutation(api.social.createInvite, {});
    await recipient.mutation(api.social.acceptInvite, invite);
    const normalInput = { ...demo.input, recipientId: recipientProfile.id, demo: false };
    const normalFlight = await sender.mutation(api.flights.launch, normalInput);
    const normalDetails = (await sender.query(api.flights.detail, normalFlight)).flight!;
    expect(normalDetails.demo).toBe(false);
    expect(normalDetails.distanceKm).toBeCloseTo(distance, 8);
    expect(normalDetails.arrivesAt - normalDetails.departedAt).toBe(normalSeconds * 1000);
    expect(normalDetails.departedAt).toBe(await sender.mutation(api.profiles.clock, {}));
    await expect(sender.mutation(api.flights.launch, { ...normalInput, demo: true })).rejects.toThrow('isolated flight mode');
  });

  it('enforces 1–500 Unicode code points, preserves exact text, and rejects unconnected recipients', async () => {
    const t = convexTest(schema, modules);
    const { sender, input } = await pair(t);
    for (const body of ['', ' \n\t', 'a'.repeat(501), '🕊'.repeat(501), 'e\u0301'.repeat(251)]) {
      await expect(sender.mutation(api.flights.launch, { ...input, body })).rejects.toThrow('500');
    }
    const { client: waiting } = await user(t);
    await waiting.mutation(api.starterPair.create, { handle: 'waiting', cityId: 'paris' });
    const waitingProfile = (await waiting.query(api.profiles.me, {}))!;
    await expect(waiting.mutation(api.flights.launch, { ...input, recipientId: waitingProfile.id })).rejects.toThrow('accepted friend');
    const body = '🕊'.repeat(500);
    const result = await sender.mutation(api.flights.launch, { ...input, body });
    expect((await sender.query(api.flights.detail, result)).flight!.body).toBe(body);
    expect((await sender.query(api.flights.list, { scope: 'mine', demo: true })).flights).toHaveLength(1);
  });

  it('keeps the complete request payload immutable and deduplicates exact retries before and after settlement', async () => {
    const t = convexTest(schema, modules);
    const { sender, recipient, input } = await pair(t);
    const foreign = await pair(t, 'foreign');
    const launches = await Promise.all([sender.mutation(api.flights.launch, input), sender.mutation(api.flights.launch, input)]);
    expect(launches[0]).toEqual(launches[1]);
    const original = (await sender.query(api.flights.detail, launches[0])).flight!;
    const changes: Partial<LaunchInput>[] = [
      { body: `${input.body} ` }, { recipientId: foreign.recipientProfile.id },
      { visibility: 'open', openAcknowledged: true }, { defense: 'zigzag' }, { openAcknowledged: true },
    ];
    for (const change of changes) await expect(sender.mutation(api.flights.launch, { ...input, ...change })).rejects.toThrow('different letter');
    await expect(sender.mutation(api.flights.launch, { ...input, demo: false })).rejects.toThrow('isolated flight mode');
    await sender.mutation(api.profiles.setCity, { cityId: 'sydney' });
    await recipient.mutation(api.profiles.setCity, { cityId: 'paris' });
    expect(await sender.mutation(api.flights.launch, input)).toEqual(launches[0]);
    expect((await sender.query(api.flights.detail, launches[0])).flight).toEqual(original);
    vi.setSystemTime(original.arrivesAt);
    await recipient.mutation(api.flights.settleMine, {});
    expect(await sender.mutation(api.flights.launch, input)).toEqual(launches[0]);
    await expect(sender.mutation(api.flights.launch, { ...input, body: 'Edited after an ambiguous response' })).rejects.toThrow('different letter');
    expect((await sender.query(api.flights.list, { scope: 'mine', demo: true })).flights).toHaveLength(1);
  });

  it('retains idempotent retries for preexisting flights without the additive acknowledgement field', async () => {
    const t = convexTest(schema, modules);
    const { sender, input } = await pair(t);
    const result = await sender.mutation(api.flights.launch, input);
    await t.run(async (ctx) => {
      const id = ctx.db.normalizeId('flights', result.id)!;
      await ctx.db.patch('flights', id, { openAcknowledged: undefined });
    });
    expect(await sender.mutation(api.flights.launch, input)).toEqual(result);
    await expect(sender.mutation(api.flights.launch, { ...input, body: 'different' })).rejects.toThrow('different letter');
  });
});
