import { describe, expect, it } from 'vitest';
import { onboardingRoute, phoneNumber, resendSeconds, smsCode, usernameValue, validUsername } from './onboardingModel';

describe('phone onboarding inputs', () => {
  it('normalizes a calling code and formatted national number without accepting ambiguous text', () => {
    expect(phoneNumber('+1', '(415) 555-0126')).toBe('+14155550126');
    expect(phoneNumber('+44', '7700 900123')).toBe('+447700900123');
    for (const [country, number] of [['1', '4155550126'], ['+0', '4155550126'], ['+1', '123'], ['+1', 'call4155550126'], ['+1', '+14155550126'], ['+1', '1234567890123456']]) expect(phoneNumber(country, number)).toBeNull();
  });
  it('supports six-digit paste and keeps leading zeroes', () => {
    expect(smsCode('012345')).toBe('012345');
    expect(smsCode('012 345')).toBe('012345');
    expect(smsCode('1234567')).toBe('123456');
  });
  it('calculates cooldown from elapsed time, including app suspension', () => {
    expect(resendSeconds(61000, 1000)).toBe(60);
    expect(resendSeconds(61000, 60999)).toBe(1);
    expect(resendSeconds(61000, 100000)).toBe(0);
  });
  it('normalizes usernames and supports the design’s dotted username', () => {
    expect(usernameValue(' @Ethan.Post ')).toBe('ethan.post');
    expect(validUsername('ethan.post')).toBe(true);
    expect(validUsername('ethan_123')).toBe(true);
    for (const username of ['ab', '.ethan', 'ethan post', 'a'.repeat(25)]) expect(validUsername(username)).toBe(false);
  });
});

describe('returning and interrupted account routing', () => {
  it('waits for session restoration before showing phone entry', () => {
    expect(onboardingRoute(true, false)).toBe('loading');
    expect(onboardingRoute(false, true)).toBe('loading');
    expect(onboardingRoute(false, false)).toBe('phone');
  });
  it('resumes an incomplete verified account and bypasses completed onboarding', () => {
    expect(onboardingRoute(false, true, 'profileRequired')).toBe('profile');
    expect(onboardingRoute(false, true, 'complete')).toBe('home');
    expect(onboardingRoute(false, true, 'signedOut')).toBe('phone');
  });
});
