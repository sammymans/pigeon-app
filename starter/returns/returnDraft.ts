import type { ReturnInput } from './types';

export type ReturnDraft = { version: 1; body: string; acknowledged: boolean; pending: ReturnInput | null };
export const emptyReturnDraft = (): ReturnDraft => ({ version: 1, body: '', acknowledged: false, pending: null });
export const returnDraftKey = (deployment: string, profileId: string, flightId: string) => `pigeon.return.v1:${encodeURIComponent(deployment)}:${profileId}:${flightId}`;

export function restoreReturnDraft(raw: string | null, flightId: string): ReturnDraft {
  if (!raw) return emptyReturnDraft();
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('body' in data) || typeof data.body !== 'string' || !('acknowledged' in data) || typeof data.acknowledged !== 'boolean' || !('pending' in data)) throw new Error('The saved return draft could not be read.');
  if (data.pending !== null) {
    const pending = data.pending as ReturnInput;
    if (!pending || pending.flightId !== flightId || typeof pending.requestKey !== 'string' || !pending.requestKey || (pending.body !== undefined && (pending.body !== data.body || !data.acknowledged || pending.openAcknowledged !== true))) throw new Error('The saved return request is invalid.');
  }
  return data as ReturnDraft;
}

export function editReturnDraft(draft: ReturnDraft, body: string): ReturnDraft {
  if (draft.pending || body === draft.body) return draft;
  return { ...draft, body, acknowledged: false };
}

export function prepareReturn(draft: ReturnDraft, flightId: string, requestKey: string, empty: boolean): ReturnDraft {
  if (draft.pending) return draft;
  if (!empty && (!draft.body.trim() || Array.from(draft.body).length > 280 || !draft.acknowledged)) throw new Error('Write 1–280 characters and acknowledge Open Skies, or return without a message.');
  return { ...draft, pending: { flightId, requestKey, ...(!empty ? { body: draft.body, openAcknowledged: true } : {}) } };
}

export function remainingLease(deadline: number | null | undefined, serverNow: number | null) {
  if (deadline == null || serverNow === null) return null;
  const seconds = Math.max(0, Math.ceil((deadline - serverNow) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
