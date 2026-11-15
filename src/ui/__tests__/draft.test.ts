import { describe, expect, it } from 'vitest';
import { canLaunch, freshDraft, readDraft } from '../draft';

describe('retained private letter draft', () => {
  it('starts sealed with no consent and a caller-generated idempotency key', () => {
    expect(freshDraft('uuid')).toEqual({ recipientId: '', body: '', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, requestKey: 'uuid', submitted: false });
    expect(canLaunch(freshDraft('uuid'))).toBe(false);
  });
  it('requires an accepted recipient selection, nonblank text, and Open Skies acknowledgment', () => {
    const valid = { ...freshDraft('uuid'), recipientId: 'friend', body: 'A thought' };
    expect(canLaunch(valid)).toBe(true);
    expect(canLaunch({ ...valid, body: ' ' })).toBe(false);
    expect(canLaunch({ ...valid, body: 'a'.repeat(281) })).toBe(false);
    expect(canLaunch({ ...valid, visibility: 'open' })).toBe(false);
    expect(canLaunch({ ...valid, visibility: 'open', openAcknowledged: true })).toBe(true);
  });
  it('preserves submitted drafts and the exact retry key after a reload', () => {
    const retained = { ...freshDraft('original-key'), body: 'Still here', recipientId: 'friend', submitted: true };
    expect(readDraft(JSON.stringify(retained), 'new-key')).toEqual(retained);
  });
  it('fails closed on corrupt storage and unknown privacy options', () => {
    expect(readDraft('{', 'new')).toEqual(freshDraft('new'));
    expect(readDraft('null', 'new')).toEqual(freshDraft('new'));
    expect(readDraft(JSON.stringify({ ...freshDraft('key'), visibility: 'everyone', defense: 'paid', openAcknowledged: true }), 'new')).toMatchObject({ visibility: 'sealed', defense: 'cruise', openAcknowledged: false });
  });
});
