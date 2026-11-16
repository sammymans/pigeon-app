/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert('users', { phone: '+14155550123', phoneVerificationTime: Date.now() }));
  return { t, id, session: t.withIdentity({ subject: `${id}|session` }) };
}

describe('phone onboarding', () => {
  it('ensures legacy and paired-demo flocks without replacing inventory or identity', async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.onboarding.ensureFlock, {})).rejects.toThrow('Sign in');
    for (const demo of [false, true]) {
      const userId = await t.run(ctx => ctx.db.insert('users', demo ? { isAnonymous: true } : { email: 'legacy@example.test' }));
      const session = t.withIdentity({ subject: `${userId}|session` });
      await expect(session.mutation(api.onboarding.ensureFlock, {})).rejects.toThrow('choose a handle');
      if (demo) await session.mutation(api.starterPair.create, { handle: 'demo_owner', cityId: 'london' });
      else await session.mutation(api.profiles.save, { handle: 'legacy_owner', cityId: 'london' });
      const before = await t.run(ctx => ctx.db.query('profiles').withIndex('by_userId', q => q.eq('userId', userId)).unique());
      const pairBefore = await t.run(ctx => ctx.db.query('starterPairs').collect());
      const birdId = await t.run(ctx => ctx.db.insert('pigeons', { ownerId: before!._id, name: 'My Mochi', slot: 0 }));
      const extraId = await t.run(ctx => ctx.db.insert('pigeons', { ownerId: before!._id, name: 'Extra', slot: 9 }));
      const [first, retry] = await Promise.all([1, 2].map(() => session.mutation(api.onboarding.ensureFlock, {})));
      expect(first).toEqual(retry);
      expect(first.pigeons).toHaveLength(6);
      expect(first.pigeons[0]).toEqual({ id: birdId, name: 'My Mochi' });
      expect(first.pigeons[5]).toEqual({ id: extraId, name: 'Extra' });
      expect(await session.query(api.onboarding.flock, {})).toEqual(first);
      expect((await session.query(api.onboarding.status, {})).status).toBe('complete');
      expect(await t.run(ctx => ctx.db.query('profiles').withIndex('by_userId', q => q.eq('userId', userId)).unique())).toEqual(before);
      expect(await t.run(ctx => ctx.db.query('starterPairs').collect())).toEqual(pairBefore);
    }
  });
  it('does not let the legacy save endpoint skip the verified-phone flock grant', async () => {
    const { t, session } = await setup();
    await session.mutation(api.profiles.save, { handle: 'phone_user', cityId: 'london' });
    expect((await session.query(api.onboarding.status, {})).pigeons).toHaveLength(5);
    await session.mutation(api.profiles.save, { handle: 'phone_user', cityId: 'paris' });
    expect(await t.run(ctx => ctx.db.query('pigeons').collect())).toHaveLength(5);
    const unverified = await t.run(ctx => ctx.db.insert('users', { phone: '+14155550999' }));
    await expect(t.withIdentity({ subject: `${unverified}|session` }).mutation(api.profiles.save, { handle: 'unverified', cityId: 'london' })).rejects.toThrow('Verify');
  });
  it('resumes incomplete profiles and atomically provisions one ordered private flock', async () => {
    const { t, id, session } = await setup();
    expect((await t.query(api.onboarding.status, {})).status).toBe('signedOut');
    expect((await session.query(api.onboarding.status, {})).status).toBe('profileRequired');
    expect(await session.query(api.onboarding.usernameAvailable, { username: ' Ethan.Post ' })).toEqual({ username: 'ethan.post', available: true });
    await expect(session.query(api.onboarding.usernameAvailable, { username: '.ethan' })).rejects.toThrow('do not start');
    const [first, retry] = await Promise.all([1, 2].map(() => session.mutation(api.onboarding.complete, { username: ' @Alice ', displayName: ' Alice ' })));
    expect(first).toEqual(retry);
    expect(first.username).toBe('alice');
    expect(first.displayName).toBe('Alice');
    expect(first.pigeons.map(p => p.name)).toEqual(['Mochi', 'Pip', 'Button', 'Noodle', 'Puddle']);
    expect(await session.query(api.onboarding.status, {})).toEqual(first);
    expect(JSON.stringify(first)).not.toContain('+14155550123');
    const profile = await t.run(ctx => ctx.db.query('profiles').withIndex('by_userId', q => q.eq('userId', id)).unique());
    expect(profile?.cityId).toBeUndefined();
    const otherId = await t.run(ctx => ctx.db.insert('users', { phone: '+14155550456', phoneVerificationTime: Date.now() }));
    const other = t.withIdentity({ subject: `${otherId}|session` });
    expect((await other.query(api.onboarding.status, {})).pigeons).toEqual([]);
    expect(await other.query(api.onboarding.usernameAvailable, { username: 'ALICE' })).toEqual({ username: 'alice', available: false });
    await expect(other.mutation(api.onboarding.complete, { username: '@Alice' })).rejects.toThrow('already taken');
    expect(await t.run(ctx => ctx.db.query('pigeons').collect())).toHaveLength(5);
  });

  it('rejects unverified/anonymous users and invalid profiles without partial writes', async () => {
    const { t, session } = await setup();
    await expect(session.mutation(api.onboarding.complete, { username: 'a' })).rejects.toThrow('3–24');
    await expect(session.mutation(api.onboarding.complete, { username: 'alice', displayName: 'a'.repeat(51) })).rejects.toThrow('50');
    for (const user of [{ phone: '+14155550678' }, { isAnonymous: true }]) {
      const id = await t.run(ctx => ctx.db.insert('users', user));
      await expect(t.withIdentity({ subject: `${id}|session` }).mutation(api.onboarding.complete, { username: 'alice' })).rejects.toThrow('Verify');
    }
    expect(await t.run(ctx => ctx.db.query('profiles').collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query('pigeons').collect())).toHaveLength(0);
  });

  it('bypasses legacy complete profiles without changing their location or handle', async () => {
    const { t, id, session } = await setup();
    await t.run(ctx => ctx.db.insert('profiles', { userId: id, handle: 'legacy', cityId: 'london', equipped: 'classic', demo: false, namespace: 'live' }));
    expect((await session.query(api.onboarding.status, {})).status).toBe('complete');
    expect((await session.query(api.onboarding.status, {})).pigeons).toHaveLength(0);
    expect((await session.mutation(api.onboarding.complete, { username: 'newname' })).username).toBe('legacy');
    expect((await session.query(api.profiles.me, {}))?.cityId).toBe('london');
  });
});
