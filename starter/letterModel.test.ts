import { describe, expect, it } from 'vitest';
import { cityById, type Connection, type FlightDetail, type Profile } from '../src/domain';
import { acceptedFriends, acknowledgeOpenSkies, codepoints, convertLegacyToOpenSkies, draftStorageKey, editDraft, emptyDraft, flightStatus, readableBody, releaseRejectedDraft, replyDraft, restoreDraft, routeEstimate, sealDraft, validDraft } from './letterModel';

const sender: Profile = { id: 'a', handle: 'alice', cityId: 'san-francisco', demo: true, equipped: 'classic' };
const recipient: Profile = { ...sender, id: 'b', handle: 'bob', cityId: 'los-angeles' };
const flight: FlightDetail = { id: 'flight', courier: 'Pip', origin: cityById(sender.cityId), destination: cityById(recipient.cityId), visibility: 'sealed', defense: 'cruise', distanceKm: 559, departedAt: 1000, arrivesAt: 31000, state: 'in_flight', outfit: 'classic', demo: true, role: 'recipient', attemptCount: 0, canCatch: false, canRequest: false, canResend: false, events: [], otherProfileId: sender.id };

function legacySend(body: string) {
  return { version: 1, recipientId: 'b', body, pending: { recipientId: 'b', body, visibility: 'sealed', defense: 'cruise', openAcknowledged: false, demo: true, requestKey: 'once' } };
}

describe('sealed drafts', () => {
  it('counts codepoints rather than UTF-16 code units', () => {
    expect(codepoints('🐦'.repeat(500))).toBe(500);
    expect(validDraft({ ...emptyDraft('b'), body: '🐦'.repeat(500) })).toBe(true);
    expect(validDraft({ ...emptyDraft('b'), body: '🐦'.repeat(501) })).toBe(false);
    expect(validDraft({ ...emptyDraft('b'), body: ' \n ' })).toBe(false);
  });

  it('keeps the exact payload and request key through failures and reloads', () => {
    const draft = restoreDraft(JSON.stringify(legacySend(' A letter 🐦\n')), true);
    const restored = restoreDraft(JSON.stringify(draft), true);
    expect(sealDraft(restored, true, 'different-key')).toEqual(draft);
    expect(restored.pending).toEqual({ recipientId: 'b', body: ' A letter 🐦\n', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, demo: true, requestKey: 'once' });
    expect(() => editDraft(restored, { body: 'second letter' })).toThrow();
    expect(() => replyDraft(restored, 'a')).toThrow();
  });

  it('does not silently replace unreadable or mismatched saved sends', () => {
    expect(() => restoreDraft('{broken', true)).toThrow();
    const draft = restoreDraft(JSON.stringify(legacySend('hello')), true);
    expect(() => restoreDraft(JSON.stringify(draft), false)).toThrow();
    expect(() => restoreDraft(JSON.stringify({ ...draft, body: 'changed' }), true)).toThrow();
    expect(restoreDraft(null, true)).toEqual(emptyDraft());
  });

  it('separates profiles and deployments and begins replies blank', () => {
    expect(draftStorageKey('local', 'a')).not.toBe(draftStorageKey('local', 'b'));
    expect(draftStorageKey('local', 'a')).not.toBe(draftStorageKey('other', 'a'));
    const reply = replyDraft({ ...emptyDraft('b'), body: 'old draft' }, 'a');
    expect(reply).toEqual(emptyDraft('a'));
    expect(sealDraft(acknowledgeOpenSkies({ ...reply, body: 'new reply' }, true), true, 'reply-key').pending?.requestKey).toBe('reply-key');
  });
});

describe('Open Skies draft migration and consent', () => {
  it('releases only a fresh authoritatively rejected launch, preserving text and resetting consent', () => {
    const draft = sealDraft(acknowledgeOpenSkies(editDraft(emptyDraft('b'), { body: 'keep these words' }), true), true, 'rejected');
    const editable = releaseRejectedDraft(draft, true);
    expect(editable).toMatchObject({ body: draft.body, recipientId: 'b', pending: null, openAcknowledged: false });
    expect(restoreDraft(JSON.stringify(editable), true)).toEqual(editable);
    expect(editDraft(editable, { recipientId: 'c' }).recipientId).toBe('c');
    expect(() => sealDraft(editable, true, 'fresh-key')).toThrow(/Acknowledge/);
    expect(sealDraft(acknowledgeOpenSkies(editable, true), true, 'fresh-key').pending?.requestKey).toBe('fresh-key');
    expect(releaseRejectedDraft(draft, false)).toBe(draft);
    const legacy = restoreDraft(JSON.stringify(legacySend('uncertain legacy')), true);
    expect(releaseRejectedDraft(legacy, false).pending).toEqual(legacy.pending);
  });

  it('starts new letters and replies open without silently acknowledging the risk', () => {
    const draft = editDraft(emptyDraft('b'), { body: 'hello' });
    expect(draft.visibility).toBe('open');
    expect(draft.openAcknowledged).toBe(false);
    expect(() => sealDraft(draft, true, 'new')).toThrow(/Acknowledge/);
    const pending = sealDraft(acknowledgeOpenSkies(draft, true), true, 'new');
    expect(pending.pending).toEqual({ recipientId: 'b', body: 'hello', visibility: 'open', defense: 'cruise', openAcknowledged: true, demo: true, requestKey: 'new' });
    const reply = replyDraft(acknowledgeOpenSkies(draft, true), 'a');
    expect(reply).toEqual(emptyDraft('a'));
    expect(reply.openAcknowledged).toBe(false);
  });

  it('binds consent to the exact body and recipient and persists that state on reload', () => {
    const original = editDraft(emptyDraft('b'), { body: 'hello' });
    expect(restoreDraft(JSON.stringify(original), true).openAcknowledged).toBe(false);
    const accepted = acknowledgeOpenSkies(original, true);
    const restored = restoreDraft(JSON.stringify(accepted), true);
    expect(restored).toEqual(accepted);
    expect(editDraft(restored, { body: 'changed' }).openAcknowledged).toBe(false);
    expect(editDraft(restored, { recipientId: 'c' }).openAcknowledged).toBe(false);
    expect(editDraft(restored, { body: 'hello' }).openAcknowledged).toBe(true);
    expect(acknowledgeOpenSkies(restored, false).openAcknowledged).toBe(false);
    expect(() => sealDraft(editDraft(restored, { body: 'changed' }), true, 'new')).toThrow(/Acknowledge/);
  });

  it('keeps an unsent legacy sealed draft until explicit conversion and fresh acknowledgment', () => {
    const old = { version: 1, recipientId: 'b', body: 'saved private words', pending: null };
    const restored = restoreDraft(JSON.stringify(old), true);
    expect(restored).toMatchObject({ visibility: 'sealed', openAcknowledged: false, body: old.body, recipientId: old.recipientId, pending: null });
    expect(() => sealDraft(restored, true, 'new')).toThrow(/Convert/);
    expect(() => acknowledgeOpenSkies(restored, true)).toThrow(/Explicitly convert/);
    const converted = convertLegacyToOpenSkies(restored);
    expect(converted).toMatchObject({ visibility: 'open', openAcknowledged: false, body: old.body, recipientId: old.recipientId, pending: null });
    expect(() => sealDraft(converted, true, 'new')).toThrow(/Acknowledge/);
    expect(sealDraft(acknowledgeOpenSkies(converted, true), true, 'new-open-key').pending?.requestKey).toBe('new-open-key');
  });

  it('never converts an ambiguous legacy sealed send or changes its saved request key', () => {
    const old = legacySend('possibly already sent');
    const restored = restoreDraft(JSON.stringify(old), true);
    expect(restored.pending).toEqual(old.pending);
    expect(() => convertLegacyToOpenSkies(restored)).toThrow();
    expect(() => acknowledgeOpenSkies(restored, true)).toThrow();
    expect(() => editDraft(restored, { recipientId: 'c' })).toThrow();
    expect(() => replyDraft(restored, 'c')).toThrow();
    expect(sealDraft(restoreDraft(JSON.stringify(restored), true), true, 'different').pending).toEqual(old.pending);
  });

  it('retries a pending open send exactly and rejects mismatched persisted consent', () => {
    const draft = sealDraft(acknowledgeOpenSkies(editDraft(emptyDraft('b'), { body: 'open hello' }), true), true, 'open-once');
    const restored = restoreDraft(JSON.stringify(draft), true);
    expect(sealDraft(restored, true, 'other').pending).toEqual(draft.pending);
    expect(() => acknowledgeOpenSkies(restored, false)).toThrow();
    expect(() => convertLegacyToOpenSkies(restored)).toThrow();
    expect(() => restoreDraft(JSON.stringify({ ...draft, openAcknowledged: false }), true)).toThrow();
    expect(() => restoreDraft(JSON.stringify({ ...draft, pending: { ...draft.pending, openAcknowledged: false } }), true)).toThrow();
    expect(() => restoreDraft(JSON.stringify({ ...draft, visibility: 'sealed' }), true)).toThrow();
    expect(() => restoreDraft(JSON.stringify({ ...draft, body: 'changed' }), true)).toThrow();
  });
});

describe('server-authoritative delivery', () => {
  it('does not reveal an early body, even after the client countdown reaches zero', () => {
    expect(readableBody({ ...flight, body: 'must stay hidden' })).toBeNull();
    expect(flightStatus(flight, 999999)).toBe('Awaiting server confirmation');
    expect(flightStatus(flight, null)).toBe('In flight · syncing clock');
    expect(readableBody({ ...flight, state: 'delivered' })).toBeNull();
    expect(readableBody({ ...flight, state: 'delivered', body: 'arrived' })).toBe('arrived');
    expect(readableBody({ ...flight, role: 'public', state: 'delivered', body: 'hidden' })).toBeNull();
  });

  it('offers only accepted friends and uses the shared distance formula', () => {
    const connections = ['pending', 'accepted', 'declined'].map((state, i) => ({ id: String(i), profile: { ...recipient, id: String(i) }, state, direction: 'outgoing' })) as Connection[];
    expect(acceptedFriends(connections).map((profile) => profile.id)).toEqual(['1']);
    const estimate = routeEstimate(sender, recipient);
    expect(estimate.normalSeconds).toBe(Math.max(120, Math.ceil(estimate.distance / 60 * 3600)));
    expect(estimate.demoSeconds).toBe(30);
    expect(routeEstimate(sender, { ...recipient, cityId: 'tokyo' }).demoSeconds).toBe(90);
    expect(routeEstimate(sender, sender).normalSeconds).toBe(120);
  });
});

it('persists the selected pigeon with the immutable retry payload', () => {
  const draft = { ...emptyDraft('friend'), body: 'Hello', pigeonId: 'owned-bird', openAcknowledged: true };
  const pending = sealDraft(draft, false, 'bird-send');
  expect(pending.pending?.pigeonId).toBe('owned-bird');
  expect(restoreDraft(JSON.stringify(pending), false)).toEqual(pending);
  expect(() => restoreDraft(JSON.stringify({ ...pending, pigeonId: 'another-bird' }), false)).toThrow('could not be verified');
  expect(() => editDraft(pending, { pigeonId: 'another-bird' })).toThrow('Confirm');
  expect(editDraft(draft, { pigeonId: 'another-bird' }).openAcknowledged).toBe(false);
});
