import { describe, expect, it } from 'vitest';
import { formatPhoneNumber, onboardingRoute, phoneNumber, resendSeconds, smsCode, usernameValue, validUsername } from './onboardingModel';

describe('phone onboarding inputs', () => {
  it('formats typing and backspacing without leaving trailing separators', () => {
    let value = '';
    const expected = ['(4', '(41', '(415', '(415) 5', '(415) 55', '(415) 555', '(415) 555-0', '(415) 555-01', '(415) 555-012', '(415) 555-0126'];
    for (const [index, digit] of [...'4155550126'].entries()) {
      value = formatPhoneNumber('+1', value + digit);
      expect(value).toBe(expected[index]);
    }
    for (let index = expected.length - 2; index >= -1; index--) {
      value = formatPhoneNumber('+1', value.slice(0, -1));
      expect(value).toBe(expected[index] ?? '');
    }
  });
  it('formats pasted numbers and submits the original digits only once', () => {
    for (const value of ['4155550126', '(415) 555-0126', '+1 (415) 555-0126', '1-415-555-0126']) {
      const formatted = formatPhoneNumber('+1', value);
      expect(formatted).toBe('(415) 555-0126');
      expect(phoneNumber('+1', formatted)).toBe('+14155550126');
    }
    expect(formatPhoneNumber('+1', '41555501267')).toBe('(415) 555-0126');
    expect(formatPhoneNumber('+1', '(415) 555-9126')).toBe('(415) 555-9126');
    expect(formatPhoneNumber('+1', '')).toBe('');
  });
  it('preserves other national numbers without applying the +1 mask', () => {
    expect(formatPhoneNumber('+44', '7700 900123')).toBe('7700900123');
    expect(formatPhoneNumber('+44', '+44 7700 900123')).toBe('7700900123');
    expect(formatPhoneNumber('+44', '(415) 555-0126')).toBe('4155550126');
  });
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
