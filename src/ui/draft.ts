import type { Defense, Visibility } from '../domain';

export type Draft = {
  recipientId: string;
  body: string;
  visibility: Visibility;
  defense: Defense;
  openAcknowledged: boolean;
  requestKey: string;
  submitted: boolean;
};

export function freshDraft(requestKey: string): Draft {
  return { recipientId: '', body: '', visibility: 'sealed', defense: 'cruise', openAcknowledged: false, requestKey, submitted: false };
}

export function readDraft(value: string | null, requestKey: string): Draft {
  if (!value) return freshDraft(requestKey);
  try {
    const stored = JSON.parse(value);
    if (!stored || typeof stored.body !== 'string' || typeof stored.recipientId !== 'string' || typeof stored.requestKey !== 'string' || !stored.requestKey) return freshDraft(requestKey);
    return {
      recipientId: stored.recipientId,
      body: stored.body.slice(0, 280),
      visibility: stored.visibility === 'open' ? 'open' : 'sealed',
      defense: stored.defense === 'zigzag' ? 'zigzag' : 'cruise',
      openAcknowledged: stored.visibility === 'open' && stored.openAcknowledged === true,
      requestKey: stored.requestKey,
      submitted: stored.submitted === true,
    };
  } catch { return freshDraft(requestKey); }
}

export function canLaunch(draft: Draft) {
  return Boolean(draft.recipientId && draft.body.trim() && draft.body.length <= 280 && (draft.visibility === 'sealed' || draft.openAcknowledged));
}
