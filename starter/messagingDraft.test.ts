import { describe, expect, it } from 'vitest';
import { acknowledgeOpenSkies, editDraft, emptyDraft, restoreDraft, sealDraft } from './letterModel';

describe('selected pigeon and anonymity draft recovery', () => {
  it('persists an immutable bird, anonymity choice and retry key', () => {
    const editable = editDraft(emptyDraft('friend'), { body: 'Hello', pigeonId: 'my-bird', anonymous: true });
    const sealed = sealDraft(acknowledgeOpenSkies(editable, true), false, 'once');
    expect(sealed.pending).toMatchObject({ pigeonId: 'my-bird', anonymous: true, requestKey: 'once' });
    expect(sealDraft(restoreDraft(JSON.stringify(sealed), false), false, 'different')).toEqual(sealed);
    expect(() => editDraft(sealed, { pigeonId: 'other-bird' })).toThrow();
    expect(() => editDraft(sealed, { anonymous: false })).toThrow();
  });

  it('clears consent on recipient removal, bird selection or anonymity changes', () => {
    const draft = acknowledgeOpenSkies(editDraft(emptyDraft('friend'), { body: 'Hello', pigeonId: 'my-bird' }), true);
    for (const change of [{ recipientId: '' }, { pigeonId: 'other-bird' }, { anonymous: true }]) {
      expect(editDraft(draft, change).openAcknowledged).toBe(false);
    }
  });

  it('refuses tampered or invalid saved bird/anonymity fields without rewriting the draft', () => {
    const sealed = sealDraft(acknowledgeOpenSkies(editDraft(emptyDraft('friend'), { body: 'Hello', pigeonId: 'my-bird', anonymous: true }), true), false, 'once');
    for (const change of [{ pigeonId: 'other-bird' }, { pigeonId: '' }, { anonymous: false }, { anonymous: 'yes' }]) {
      expect(() => restoreDraft(JSON.stringify({ ...sealed, ...change }), false)).toThrow();
    }
  });
});
