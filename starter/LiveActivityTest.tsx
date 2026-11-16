import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { a, PrimaryButton } from './page03/atoms';
import { liveActivityError, liveActivityUnavailable, reconcileFlightActivity, startTestFlightActivity, stopFlightActivity } from './flightLiveActivity';

export function LiveActivityTest() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const unavailable = liveActivityUnavailable();
  useEffect(() => {
    const refresh = () => { if (AppState.currentState === 'active') void reconcileFlightActivity('test').catch(() => {}); };
    const listener = AppState.addEventListener('change', refresh);
    const interval = setInterval(refresh, 1000);
    return () => { listener.remove(); clearInterval(interval); };
  }, []);
  async function start() {
    setBusy(true); setMessage('');
    try { await startTestFlightActivity(); setMessage('Clover is flying! Lock your iPhone or leave Pigeon to see the 90-second arrival countdown.'); }
    catch (error) { setMessage(liveActivityError(error)); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={a.small}>{unavailable ?? 'Try a 90-second pigeon flight on your Lock Screen and Dynamic Island.'}</Text>
    <PrimaryButton label={busy ? 'Starting flight…' : 'Test Live Activity · 90 sec'} disabled={busy || Boolean(unavailable)} onPress={() => void start()} />
    {!unavailable && <PrimaryButton label="Stop Live Activity" disabled={busy} onPress={() => {
      setBusy(true);
      void stopFlightActivity().then(() => setMessage('Live Activity stopped.')).catch(error => setMessage(liveActivityError(error))).finally(() => setBusy(false));
    }} />}
    {message ? <Text accessibilityRole="status" style={a.small}>{message}</Text> : null}
  </View>;
}
