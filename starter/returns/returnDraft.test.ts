import { describe, expect, it } from 'vitest';
import { editReturnDraft, emptyReturnDraft, prepareReturn, remainingLease, restoreReturnDraft, returnDraftKey } from './returnDraft';

describe('return draft recovery', () => {
  it('keeps ambiguous returns immutable across reload and binds consent to the exact body', () => {
    const draft = { ...emptyReturnDraft(), body: 'Hello', acknowledged: true };
    expect(editReturnDraft(draft, 'Changed').acknowledged).toBe(false);
    expect(editReturnDraft(draft, 'Hello').acknowledged).toBe(true);
    const saved = prepareReturn(draft, 'flight', 'same-key', false);
    const restored = restoreReturnDraft(JSON.stringify(saved), 'flight');
    expect(prepareReturn(restored, 'flight', 'new-key', true)).toEqual(saved);
    expect(editReturnDraft(restored, 'Different')).toEqual(saved);
    expect(() => restoreReturnDraft(JSON.stringify(saved), 'other-flight')).toThrow('invalid');
  });

  it('represents empty return explicitly rather than a blank message', () => {
    const saved = prepareReturn(emptyReturnDraft(), 'flight', 'key', true);
    expect(saved.pending).toEqual({ flightId: 'flight', requestKey: 'key' });
    expect(() => prepareReturn(emptyReturnDraft(), 'flight', 'key', false)).toThrow('280');
    expect(() => prepareReturn({ ...emptyReturnDraft(), body: '🕊'.repeat(281), acknowledged: true }, 'flight', 'key', false)).toThrow('280');
    expect(prepareReturn({ ...emptyReturnDraft(), body: '🕊'.repeat(280), acknowledged: true }, 'flight', 'key', false).pending?.body).toHaveLength(560);
  });

  it('isolates saved requests by deployment, identity and flight, and preserves malformed storage for recovery', () => {
    expect(returnDraftKey('https://a.test', 'a', 'flight')).not.toBe(returnDraftKey('https://a.test', 'b', 'flight'));
    expect(returnDraftKey('https://a.test', 'a', 'flight')).not.toBe(returnDraftKey('https://b.test', 'a', 'flight'));
    expect(() => restoreReturnDraft('{broken', 'flight')).toThrow();
    expect(() => restoreReturnDraft(JSON.stringify({ ...emptyReturnDraft(), pending: { flightId: 'flight', requestKey: 'x', body: 'changed' } }), 'flight')).toThrow();
  });

  it('uses the synchronized deadline only, with no invented recipient countdown', () => {
    expect(remainingLease(undefined, 0)).toBeNull();
    expect(remainingLease(null, 0)).toBeNull();
    expect(remainingLease(1800_000, null)).toBeNull();
    expect(remainingLease(1800_000, 12_000)).toBe('29:48');
    expect(remainingLease(1800_000, 1800_000)).toBe('0:00');
    expect(remainingLease(1800_000, 1900_000)).toBe('0:00');
  });
});
