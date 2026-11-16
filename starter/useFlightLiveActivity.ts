import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { FlightSummary } from '../src/domain';
import { liveActivityError, reconcileFlightActivity, startFlightActivity } from './flightLiveActivity';

export function useFlightLiveActivity(scope: string, flights: FlightSummary[] | undefined, mode: 'connected' | 'preview', sentId?: string | null) {
  const [error, setError] = useState('');
  const latest = useRef(flights);
  latest.current = flights;
  const started = useRef<string | null>(null);
  const sent = flights?.find(flight => flight.id === sentId);

  useEffect(() => {
    if (!sent || sent.id === started.current) return;
    started.current = sent.id;
    setError('');
    void startFlightActivity(sent, scope, mode).catch(error => setError(liveActivityError(error)));
  }, [sent, scope, mode]);

  useEffect(() => {
    if (AppState.currentState !== 'background') void reconcileFlightActivity(scope, flights).catch(() => {});
  }, [scope, flights]);

  useEffect(() => {
    const refresh = () => { if (AppState.currentState === 'active') void reconcileFlightActivity(scope, latest.current).catch(() => {}); };
    const listener = AppState.addEventListener('change', refresh);
    // Refresh terminal states only; the countdown itself is rendered by iOS.
    const interval = setInterval(refresh, 5000);
    return () => { listener.remove(); clearInterval(interval); };
  }, [scope]);
  return error;
}
