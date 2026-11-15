import { describe, expect, it } from 'vitest';
import { cityById, type Connection, type FlightDetail, type Profile } from '../src/domain';
import { acceptedFriends, codepoints, draftStorageKey, editDraft, emptyDraft, flightStatus, readableBody, releaseRejectedDraft, replyDraft, restoreDraft, routeEstimate, sealDraft, validDraft } from './letterModel';

const sender: Profile = { id: 'a', handle: 'alice', cityId: 'san-francisco', demo: true, equipped: 'classic' };
const recipient: Profile = { ...sender, id: 'b', handle: 'bob', cityId: 'los-angeles' };
const flight: FlightDetail = { id: 'flight', courier: 'Pip', origin: cityById(sender.cityId), destination: cityById(recipient.cityId), visibility: 'sealed', defense: 'cruise', distanceKm: 559, departedAt: 1000, arrivesAt: 31000, state: 'in_flight', outfit: 'classic', demo: true, role: 'recipient', attemptCount: 0, canCatch: false, canRequest: false, canResend: false, events: [], otherProfileId: sender.id };

describe('sealed drafts', () => {
  it('allows editing after a fresh definitive rejection but preserves every uncertain retry', () => {
    const pending = sealDraft({ ...emptyDraft('b'), body: 'keep this text' }, true, 'rejected');
    const editable = releaseRejectedDraft(pending, true);
    expect(editable).toEqual({ ...pending, pending: null });
    expect(restoreDraft(JSON.stringify(editable), true)).toEqual(editable);
    expect(editDraft(editable, { recipientId: 'c' }).recipientId).toBe('c');
    expect(sealDraft(editable, true, 'new-key').pending?.requestKey).toBe('new-key');
    expect(releaseRejectedDraft(pending, false)).toBe(pending);
    expect(releaseRejectedDraft(restoreDraft(JSON.stringify(pending), true), false).pending).toEqual(pending.pending);
  });

  it('counts codepoints rather than UTF-16 code units', () => {
    expect(codepoints('🐦'.repeat(280))).toBe(280);
    expect(validDraft({ ...emptyDraft('b'), body: '🐦'.repeat(280) })).toBe(true);
    expect(validDraft({ ...emptyDraft('b'), body: '🐦'.repeat(281) })).toBe(false);
    expect(validDraft({ ...emptyDraft('b'), body: ' \n ' })).toBe(false);
  });

  it('keeps the exact payload and request key through failures and reloads', () => {
    const draft = sealDraft({ ...emptyDraft('b'), body: ' A letter 🐦\n' }, true, 'once');
    const restored = restoreDraft(JSON.stringify(draft), true);
    expect(sealDraft(restored, true, 'different-key')).toEqual(draft);
    expect(restored.pending).toEqual({ recipientId: 'b', body: ' A letter 🐦\n', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, demo: true, requestKey: 'once' });
    expect(() => editDraft(restored, { body: 'second letter' })).toThrow();
    expect(() => replyDraft(restored, 'a')).toThrow();
  });

  it('does not silently replace unreadable or mismatched saved sends', () => {
    expect(() => restoreDraft('{broken', true)).toThrow();
    const draft = sealDraft({ ...emptyDraft('b'), body: 'hello' }, true, 'once');
    expect(() => restoreDraft(JSON.stringify(draft), false)).toThrow();
    expect(() => restoreDraft(JSON.stringify({ ...draft, body: 'changed' }), true)).toThrow();
    expect(restoreDraft(null, true)).toEqual(emptyDraft());
  });

  it('separates profiles and deployments and begins replies blank', () => {
    expect(draftStorageKey('local', 'a')).not.toBe(draftStorageKey('local', 'b'));
    expect(draftStorageKey('local', 'a')).not.toBe(draftStorageKey('other', 'a'));
    const reply = replyDraft({ ...emptyDraft('b'), body: 'old draft' }, 'a');
    expect(reply).toEqual(emptyDraft('a'));
    expect(sealDraft({ ...reply, body: 'new reply' }, true, 'reply-key').pending?.requestKey).toBe('reply-key');
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
