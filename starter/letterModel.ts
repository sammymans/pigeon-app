import { cityById, distanceKm, durationSeconds, formatDuration, type Connection, type FlightDetail, type FlightSummary, type LaunchInput, type Profile } from '../src/domain';

export type Draft = {
  version: 1;
  recipientId: string;
  body: string;
  pending: LaunchInput | null;
};

export function emptyDraft(recipientId = ''): Draft {
  return { version: 1, recipientId, body: '', pending: null };
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
  return Boolean(draft.recipientId && draft.body.trim() && codepoints(draft.body) <= 280);
}

export function sealDraft(draft: Draft, demo: boolean, requestKey: string): Draft {
  if (draft.pending) return draft;
  if (!validDraft(draft) || !requestKey) throw new Error('Choose a friend and write 1–280 characters.');
  return { ...draft, pending: { recipientId: draft.recipientId, body: draft.body, demo, requestKey, visibility: 'sealed', defense: 'cruise', openAcknowledged: false } };
}

export function editDraft(draft: Draft, changes: Partial<Pick<Draft, 'body' | 'recipientId'>>): Draft {
  if (draft.pending) throw new Error('Confirm the existing send before editing this letter.');
  return { ...draft, ...changes };
}

export function replyDraft(draft: Draft, recipientId: string): Draft {
  if (draft.pending) throw new Error('Confirm the existing send before starting a reply.');
  return emptyDraft(recipientId);
}

export function restoreDraft(raw: string | null, demo: boolean): Draft {
  if (raw === null) return emptyDraft();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('This saved draft could not be read.');
  const draft = value as Partial<Draft>;
  if (draft.version !== 1 || typeof draft.body !== 'string' || typeof draft.recipientId !== 'string' || !(draft.pending === null || (draft.pending && typeof draft.pending === 'object'))) {
    throw new Error('This saved draft could not be read.');
  }
  if (draft.pending) {
    const pending = draft.pending;
    if (pending.body !== draft.body || pending.recipientId !== draft.recipientId || pending.demo !== demo || pending.visibility !== 'sealed' || pending.defense !== 'cruise' || pending.openAcknowledged !== false || typeof pending.requestKey !== 'string' || !pending.requestKey || !validDraft(draft as Draft)) {
      throw new Error('The saved send could not be verified. It has not been changed.');
    }
    return { version: 1, body: draft.body, recipientId: draft.recipientId, pending: { body: pending.body, recipientId: pending.recipientId, demo: pending.demo, visibility: 'sealed', defense: 'cruise', openAcknowledged: false, requestKey: pending.requestKey } };
  }
  return { version: 1, body: draft.body, recipientId: draft.recipientId, pending: null };
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
