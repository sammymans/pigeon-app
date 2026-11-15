import { useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api } from '../../convex/_generated/api';
import { useServerClock } from '../useServerClock';
import type { ReturnPresentation } from './presentation';
import type { OpenLetter } from './types';
import { useReturnDraft } from './useReturnDraft';

type Props = { deployment: string; profileId: string; flightId: string; onClose: () => void; render: (state: ReturnPresentation) => ReactNode };

export function ReturnFlow(props: Props) {
  return <ConnectedReturn key={`${props.profileId}:${props.flightId}`} {...props} />;
}

function ConnectedReturn({ deployment, profileId, flightId, onClose, render }: Props) {
  const trip = useQuery(api.courierTrips.status, { flightId });
  const open = useMutation(api.courierTrips.open);
  const send = useMutation(api.courierTrips.returnHome);
  const connected = useConvexConnectionState().isWebSocketConnected;
  const { serverNow, syncError } = useServerClock(connected);
  const draft = useReturnDraft(deployment, profileId, flightId);
  const [letter, setLetter] = useState<OpenLetter | null>(null);
  const [page, setPage] = useState<'letter' | 'compose'>('letter');
  const [readError, setReadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const expired = trip?.replyDeadline != null && serverNow !== null && serverNow >= trip.replyDeadline;

  useEffect(() => {
    if (!connected) return;
    let active = true;
    async function read() {
      try {
        const result = await open({ flightId });
        if (active) { setLetter(result); setReadError(''); }
      } catch { if (active) { setLetter(null); setReadError('Could not open the authorized letter. Close and reopen to retry.'); } }
    }
    void read();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void read(); else setLetter(null); });
    return () => { active = false; listener.remove(); };
  }, [connected, flightId, open, trip?.updatedAt, expired, refresh]);

  if (!trip) return render({ state: trip === undefined ? 'loading' : 'unavailable', error: readError, onClose });
  const readingEnded = trip.role === 'holder' && trip.holderKind === 'catcher' && (!trip.canReturn || expired || serverNow === null);
  const visibleLetter = letter && readingEnded ? { ...letter, body: undefined } : letter;
  return render({ state: 'ready', trip, letter: visibleLetter, page, draft: draft.draft, serverNow, connected: connected && !syncError, busy: draft.busy, saved: draft.saved, error: draft.error || readError, onClose, onCompose: () => setPage('compose'), onRead: () => setPage('letter'), onEdit: draft.edit, onAcknowledge: draft.acknowledge, onSave: draft.saveAgain, onSend: (empty) => {
    if (!connected || syncError || !trip.canReturn || expired || (trip.replyDeadline !== null && serverNow === null) || !draft.saved) return;
    void draft.send(empty, send).then((result) => { if (result) setRefresh((value) => value + 1); });
  } });
}
