/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPKCS8, generateKeyPair } from 'jose';
import { api, internal } from './_generated/api';
import { normalizePhone } from './phoneProtocol';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const phone = '+14155550123';
beforeEach(() => {
  vi.stubEnv('PHONE_AUTH_ENABLED', 'true');
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC_test');
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-only-token');
  vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', 'VA_test');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('phone verification boundary', () => {
  it('normalizes E.164 and fails closed without configured SMS', async () => {
    expect(normalizePhone('+1 (415) 555-0123')).toBe(phone);
    expect(() => normalizePhone('4155550123')).toThrow('country code');
    vi.stubEnv('PHONE_AUTH_ENABLED', 'false');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const t = convexTest(schema, modules);
    await expect(t.action(api.phoneAuth.sendCode, { phone })).rejects.toThrow('not available');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends real Verify requests without creating users and enforces cooldown server-side', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'pending', to: phone })));
    vi.stubGlobal('fetch', fetch);
    const t = convexTest(schema, modules);
    expect((await t.action(api.phoneAuth.sendCode, { phone })).retryAt).toBeGreaterThan(Date.now());
    expect(fetch.mock.calls[0][0]).toContain('/Verifications');
    expect(fetch.mock.calls[0][1].body).toContain('Channel=sms');
    expect(await t.run(ctx => ctx.db.query('users').collect())).toHaveLength(0);
    await expect(t.action(api.phoneAuth.sendCode, { phone })).rejects.toThrow('wait');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects incorrect, mismatched and replayed codes without creating accounts', async () => {
    const t = convexTest(schema, modules);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const response of [
      new Response(JSON.stringify({ status: 'pending', to: phone })),
      new Response(JSON.stringify({ status: 'approved', to: '+14155550999' })),
      new Response('{}', { status: 404 }),
    ]) {
      fetch.mockResolvedValueOnce(response);
      await expect(t.action(api.auth.signIn, { provider: 'phone', params: { phone, code: '123456' } })).rejects.toThrow('Invalid or expired');
    }
    await expect(t.action(api.auth.signIn, { provider: 'phone', params: { phone, code: '12345' } })).rejects.toThrow('six-digit');
    expect(await t.run(ctx => ctx.db.query('users').collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query('authAccounts').collect())).toHaveLength(0);
  });

  it('creates only after approval and links returning verified phones, not the caller session', async () => {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true });
    vi.stubEnv('JWT_PRIVATE_KEY', await exportPKCS8(privateKey));
    vi.stubEnv('CONVEX_SITE_URL', 'https://pigeon.test');
    const t = convexTest(schema, modules);
    const existing = await t.run(ctx => ctx.db.insert('users', { phone, phoneVerificationTime: Date.now() }));
    const anonymous = await t.run(ctx => ctx.db.insert('users', { isAnonymous: true }));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: 'approved', to: phone }))));
    const caller = t.withIdentity({ subject: `${anonymous}|session` });
    await caller.action(api.auth.signIn, { provider: 'phone', params: { phone, code: '123456' } });
    await t.action(api.auth.signIn, { provider: 'phone', params: { phone, code: '654321' } });
    const accounts = await t.run(ctx => ctx.db.query('authAccounts').collect());
    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId).toBe(existing);
    expect(await t.run(ctx => ctx.db.query('users').collect())).toHaveLength(2);
    const newPhone = '+14155550789';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'approved', to: newPhone }))));
    await t.action(api.auth.signIn, { provider: 'phone', params: { phone: newPhone, code: '123456' } });
    const users = await t.run(ctx => ctx.db.query('users').collect());
    expect(users).toHaveLength(3);
    expect(users.find(user => user.phone === newPhone)?.phoneVerificationTime).toBeDefined();
  });

  it('caps verification attempts and daily global SMS spend independently of clients', async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 5; i++) await t.mutation(internal.phoneAuth.consumeLimit, { phone, kind: 'verify' });
    await expect(t.mutation(internal.phoneAuth.consumeLimit, { phone, kind: 'verify' })).rejects.toThrow('Too many');
    await t.run(ctx => ctx.db.insert('phoneLimits', { key: 'send:global', windowStart: Date.now(), count: 100, retryAt: 0 }));
    await expect(t.action(api.phoneAuth.sendCode, { phone: '+14155550456' })).rejects.toThrow('Too many');
  });
});
