import { cityById, distanceKm, durationSeconds, formatDuration, LETTER_CHARACTER_LIMIT, type Connection, type FlightDetail, type FlightSummary, type LaunchInput, type Profile } from '../src/domain';

export type Draft = {
  version: 2;
  recipientId: string;
  pigeonId?: string;
  body: string;
  visibility: 'open' | 'sealed';
  openAcknowledged: boolean;
  pending: LaunchInput | null;
};

export function emptyDraft(recipientId = ''): Draft {
  return { version: 2, recipientId, body: '', visibility: 'open', openAcknowledged: false, pending: null };
}

export function draftStorageKey(deployment: string, profileId: string): string {
  return `pigeon:first-letter:${encodeURIComponent(deployment)}:${profileId}`;
}

export function codepoints(body: string): number {
  return Array.from(body).length;
}

export function acceptedFriends(connections: Connection[]): Profile[] {
  return connections.filter((connection) => connection.state === 'accepted').map((connection) => connection.profile);
}

export function validDraft(draft: Draft): boolean {
  return Boolean(draft.recipientId && draft.body.trim() && codepoints(draft.body) <= LETTER_CHARACTER_LIMIT);
}

export function sealDraft(draft: Draft, demo: boolean, requestKey: string): Draft {
  if (draft.pending) return draft;
  if (!validDraft(draft) || !requestKey) throw new Error('Choose a friend and write 1–500 characters.');
  if (draft.visibility !== 'open') throw new Error('Convert this saved draft to Open Skies before starting a new flight.');
  if (!draft.openAcknowledged) throw new Error('Acknowledge that another eligible player can catch and read this letter and prevent its delivery.');
  return { ...draft, pending: { recipientId: draft.recipientId, ...(draft.pigeonId ? { pigeonId: draft.pigeonId } : {}), body: draft.body, demo, requestKey, visibility: 'open', defense: 'cruise', openAcknowledged: true } };
}

export function editDraft(draft: Draft, changes: Partial<Pick<Draft, 'body' | 'recipientId' | 'pigeonId'>>): Draft {
  if (draft.pending) throw new Error('Confirm the existing send before editing this letter.');
  const next = { ...draft, ...changes };
  return next.body === draft.body && next.recipientId === draft.recipientId && next.pigeonId === draft.pigeonId ? draft : { ...next, openAcknowledged: false };
}

export function convertLegacyToOpenSkies(draft: Draft): Draft {
  if (draft.pending) throw new Error('Confirm the existing send before converting this draft.');
  return { ...draft, visibility: 'open', openAcknowledged: false };
}

export function acknowledgeOpenSkies(draft: Draft, acknowledged: boolean): Draft {
  if (draft.pending) throw new Error('Confirm the existing send before changing its acknowledgment.');
  if (draft.visibility !== 'open') throw new Error('Explicitly convert the saved sealed draft before acknowledging Open Skies.');
  return { ...draft, openAcknowledged: acknowledged };
}

export function releaseRejectedDraft(draft: Draft, freshLaunch: boolean): Draft {
  return freshLaunch ? { ...draft, pending: null, openAcknowledged: false } : draft;
}

export function replyDraft(draft: Draft, recipientId: string): Draft {
  if (draft.pending) throw new Error('Confirm the existing send before starting a reply.');
  return emptyDraft(recipientId);
}

export function restoreDraft(raw: string | null, demo: boolean): Draft {
  if (raw === null) return emptyDraft();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('This saved draft could not be read.');
  const draft = value as Partial<Omit<Draft, 'version'>> & { version?: number };
  if ((draft.version !== 1 && draft.version !== 2) || typeof draft.body !== 'string' || typeof draft.recipientId !== 'string' || !(draft.pending === null || (draft.pending && typeof draft.pending === 'object'))) {
    throw new Error('This saved draft could not be read.');
  }
  const visibility = draft.version === 1 ? 'sealed' : draft.visibility;
  const openAcknowledged = draft.version === 1 ? false : draft.openAcknowledged;
  if ((visibility !== 'open' && visibility !== 'sealed') || typeof openAcknowledged !== 'boolean' || (visibility === 'sealed' && openAcknowledged)) {
    throw new Error('This saved draft has an invalid visibility acknowledgment.');
  }
  if (draft.pigeonId !== undefined && (typeof draft.pigeonId !== 'string' || !draft.pigeonId)) throw new Error('This saved pigeon could not be read.');
  const restored: Draft = { version: 2, body: draft.body, recipientId: draft.recipientId, ...(draft.pigeonId ? { pigeonId: draft.pigeonId } : {}), visibility, openAcknowledged, pending: null };
  if (draft.pending) {
    const pending = draft.pending;
    if (pending.pigeonId !== draft.pigeonId || pending.body !== draft.body || pending.recipientId !== draft.recipientId || pending.demo !== demo || pending.visibility !== visibility || pending.defense !== 'cruise' || pending.openAcknowledged !== openAcknowledged || (visibility === 'open' && !openAcknowledged) || typeof pending.requestKey !== 'string' || !pending.requestKey || !validDraft(restored)) {
      throw new Error('The saved send could not be verified. It has not been changed.');
    }
    return { ...restored, pending: { body: pending.body, recipientId: pending.recipientId, ...(pending.pigeonId ? { pigeonId: pending.pigeonId } : {}), demo: pending.demo, visibility, defense: 'cruise', openAcknowledged, requestKey: pending.requestKey } };
  }
  return restored;
}

export function routeEstimate(sender: Profile, recipient: Profile) {
  const distance = distanceKm(cityById(sender.cityId), cityById(recipient.cityId));
  return { distance, normalSeconds: durationSeconds(distance, false, 'cruise'), demoSeconds: durationSeconds(distance, true, 'cruise') };
}

export function flightStatus(flight: FlightSummary, serverNow: number | null): string {
  if (flight.state === 'delivered') return 'Delivered';
  if (flight.state === 'intercepted') return 'Intercepted';
  if (serverNow === null) return 'In flight · syncing clock';
  if (serverNow >= flight.arrivesAt) return 'Awaiting server confirmation';
  return `In flight · ${formatDuration((flight.arrivesAt - serverNow) / 1000)} left`;
}

export function readableBody(flight: FlightDetail): string | null {
  return flight.state === 'delivered' && (flight.role === 'sender' || flight.role === 'recipient') && typeof flight.body === 'string' ? flight.body : null;
}

export function exactTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
}
