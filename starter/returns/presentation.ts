import type { ReturnDraft } from './returnDraft';
import type { OpenLetter, TripView } from './types';

export type ReturnScreenProps = {
  trip: TripView;
  letter: OpenLetter | null;
  page: 'letter' | 'compose';
  draft: ReturnDraft | null;
  serverNow: number | null;
  connected: boolean;
  busy: boolean;
  saved: boolean;
  error?: string;
  onClose: () => void;
  onCompose: () => void;
  onRead: () => void;
  onEdit: (body: string) => void;
  onAcknowledge: (value: boolean) => void;
  onSend: (empty: boolean) => void;
  onSave: () => void;
};

export type ReturnPresentation =
  | { state: 'loading' | 'unavailable'; error: string; onClose: () => void }
  | ({ state: 'ready' } & ReturnScreenProps);
