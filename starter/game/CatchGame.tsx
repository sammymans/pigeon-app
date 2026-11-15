import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONNECTION_REQUEST } from '../../src/domain';
import { CatchSession, catchError, sessionFrame } from './CatchSession';
import type { CatchGameProps } from './contract';

export function CatchGame(props: CatchGameProps) {
  return <Game key={props.flightId} {...props} />;
}

function Game({ flightId, flight: incoming, connected, transport, onExit, flightError, onRetryFlight, onRequestConnection }: CatchGameProps) {
  const flight = incoming?.id === flightId ? incoming : incoming ? undefined : incoming;
  const [session] = useState(() => new CatchSession(flightId, transport));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [reduced, setReduced] = useState(false);
  const [laneWidth, setLaneWidth] = useState(0);
  const [requestState, setRequestState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [requestError, setRequestError] = useState('');
  const requestBusy = useRef(false);
  const frame = sessionFrame(state);
  const { result, attempt } = state;
  const available = connected && active;
  const eligible = Boolean(flight?.canCatch && flight.visibility === 'open' && flight.state === 'in_flight');
  const canRead = result?.outcome === 'caught' && flight?.role === 'catcher' && flight.state === 'intercepted' && flight.body !== undefined;

  useEffect(() => {
    const listener = AppState.addEventListener('change', next => {
      const foreground = next === 'active';
      if (!foreground) session.setAvailable(false);
      setActive(foreground);
    });
    function visibility() {
      const foreground = document.visibilityState === 'visible';
      if (!foreground) session.setAvailable(false);
      setActive(foreground);
    }
    if (Platform.OS === 'web') {
      visibility();
      document.addEventListener('visibilitychange', visibility);
    }
    return () => {
      listener.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
    };
  }, [session]);

  useEffect(() => {
    session.setAvailable(available);
    return () => session.setAvailable(false);
  }, [session, available]);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; listener.remove(); };
  }, []);

  useEffect(() => {
    if (!attempt || result || !active) return;
    let raf = 0;
    const tick = () => { session.tick(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session, attempt, result, active]);

  useEffect(() => {
    if (result) AccessibilityInfo.announceForAccessibility(result.outcome === 'caught' ? 'Server confirmed: pigeon caught.' : result.outcome === 'delivered' ? 'Server confirmed: pigeon delivered.' : 'Server confirmed: no catch.');
  }, [result]);

  async function requestConnection() {
    if (!onRequestConnection || requestBusy.current || !connected || !canRead || !flight?.canRequest) return;
    requestBusy.current = true;
    setRequestState('sending');
    setRequestError('');
    try { await onRequestConnection(); setRequestState('sent'); }
    catch (error) { setRequestState('idle'); setRequestError(catchError(error, 'Request not confirmed. You can retry the same fixed invitation.')); }
    finally { requestBusy.current = false; }
  }

  const title = !result ? 'Catch a pigeon.' : result.outcome === 'caught' ? 'Special delivery.\nWrong person.' : result.outcome === 'delivered' ? 'Just made it home.' : 'Outflew you.';
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.scroll}><View style={s.page}>
    <View style={s.header}><Text style={s.brand}>pigeon.</Text><Text style={s.tag}>CATCH / PLACEHOLDER</Text></View>
    <View style={s.stack}><Text accessibilityRole="header" style={s.title}>{title}</Text><Text style={s.body}>A timing game for Open Skies letters. Final game art and slingshot design are still to come.</Text></View>
    <View style={s.route}><Text style={s.routeTitle}>{flight ? `${flight.courier} → ${flight.destination.name}` : 'Selected flight'}</Text><Text style={s.small}>{flight?.demo ? 'Demo speed · ' : ''}{(attempt?.defense ?? flight?.defense) === 'zigzag' ? 'Zigzag · 3 hits needed' : 'Cruise · 2 hits needed'}</Text></View>
    {!connected && <Notice>Connection lost. No new taps or attempts. An unfinished attempt expires as a miss; reconnect to confirm its result.</Notice>}
    {!active && <Notice>The game was interrupted. Its timer does not pause.</Notice>}
    {reduced && <Text style={s.small}>Reduced motion: no decorative animation. The target still moves at its true scoring position.</Text>}
    {result ? <View style={s.stack}>
      <Text style={s.confirmed}>SERVER CONFIRMED · {result.hits.filter(Boolean).length}/3 HITS</Text>
      <Text style={s.body}>{result.outcome === 'caught' ? 'This letter will not reach its intended recipient.' : result.outcome === 'delivered' ? 'Arrival takes priority. The intended recipient can now read the letter.' : result.outcome === 'expired' ? 'The reservation expired without a catch. The original arrival time was not changed.' : 'No catch this time. The pigeon keeps its original journey.'}</Text>
      {result.outcome === 'caught' && (canRead ? <View style={s.letter}><Text style={s.tag}>INTERCEPTED LETTER</Text><Text selectable style={s.letterBody}>{flight!.body}</Text><Text style={s.small}>From @{flight!.senderHandle}</Text></View> : <Notice>The catch is confirmed. Waiting for your authorized letter view to refresh.</Notice>)}
      {canRead && onRequestConnection && <View style={s.stack}>
        {requestState === 'sent' ? <Notice>Connection request sent. Letters can be exchanged only after acceptance.</Notice> : flight?.canRequest ? <><Text style={s.body}>{CONNECTION_REQUEST}</Text><Action label={requestState === 'sending' ? 'Sending request…' : 'Ask to connect'} disabled={!connected || requestState === 'sending'} onPress={() => void requestConnection()} /></> : <Text style={s.small}>No new connection request is available for this sender.</Text>}
        {requestError ? <Notice error>{requestError}</Notice> : null}
      </View>}
    </View> : !attempt ? <View style={s.stack}>
      {incoming === undefined && !flightError ? <View style={s.loading}><ActivityIndicator color="#2453FF" /><Text style={s.body}>Checking this flight…</Text></View> : flight === null ? <Notice>This flight is private, finished, or unavailable.</Notice> : <>
        <View style={s.instructions}><Text style={s.instructionTitle}>Three rounds. Two seconds each.</Text><Text style={s.body}>Tap Catch once per round when the center dot is inside the net. Cruise needs two hits; Zigzag needs all three.</Text><Text style={s.small}>Starting uses your one attempt on this flight. Leaving or losing connection does not restart it.</Text></View>
        {!eligible && state.phase !== 'reserve-error' && <Notice>This flight cannot be caught right now. It may be protected, reserved, already attempted, or within 15 seconds of arrival.</Notice>}
        <Action label={state.phase === 'reserving' ? 'Reserving flight…' : state.phase === 'reserve-error' ? 'Retry reservation' : 'Start catch'} disabled={!available || Boolean(flightError) || state.phase === 'reserving' || (!eligible && state.phase !== 'reserve-error')} onPress={() => void session.reserve()} />
      </>}
    </View> : frame && <View style={s.stack}>
      <View style={s.between}><Text style={s.round}>{frame.finished ? 'THREE ROUNDS COMPLETE' : `ROUND ${frame.round + 1} / 3`}</Text><Text style={s.timer}>{frame.finished ? '0.0s' : `${((2000 - state.elapsed % 2000) / 1000).toFixed(1)}s`}</Text></View>
      <View style={s.arena}><Text style={s.targetLabel}>PIGEON TARGET · PLACEHOLDER</Text><View testID="catch-lane" style={s.lane} onLayout={event => setLaneWidth(event.nativeEvent.layout.width)}>
        <View style={s.track} />
        <View testID="catch-net" style={s.net}><Text style={s.netLabel}>NET</Text></View>
        <View testID="catch-target" accessibilityLabel="Pigeon center dot; tap when inside the net" style={[s.target, { left: laneWidth * frame.position - 16 }]}><View style={s.targetDot} /></View>
      </View><Text style={s.small}>The center dot decides the hit.</Text></View>
      <View style={s.rounds}>{frame.hits.map((hit, index) => <View key={index} style={[s.roundCell, hit === true && s.hit, hit === false && s.miss]}><Text style={s.small}>{index + 1}</Text><Text accessibilityLiveRegion="polite" style={s.hitText}>{hit === true ? 'Hit' : hit === false ? 'Miss' : index === frame.round && !frame.finished ? 'Ready' : '—'}</Text></View>)}</View>
      <Action large label={state.abandoned ? 'Interrupted · waiting for expiry' : frame.finished ? 'Confirming result…' : !frame.canTap ? 'Tap recorded' : 'Catch'} disabled={!available || state.abandoned || !frame.canTap || state.phase !== 'playing'} onPress={() => session.tap()} />
      <Text style={s.small}>Hit feedback is provisional. Only the server confirms a catch.</Text>
      {state.abandoned && <Notice>This attempt cannot resume. Its 10-second lease will expire; we will retrieve the server result when connected.</Notice>}
      {state.phase === 'resolve-error' && <Action label="Retry result confirmation" disabled={!available} onPress={() => void session.confirm()} />}
    </View>}
    {state.error ? <Notice error>{state.error}</Notice> : null}
    {flightError ? <Notice error>{flightError}</Notice> : null}
    {flightError && onRetryFlight && <Action label="Retry flight status" disabled={!connected} onPress={onRetryFlight} />}
    {flight && <View style={s.event} accessibilityLiveRegion="polite"><Text style={s.tag}>LATEST FLIGHT STATUS{!connected ? ' · LAST KNOWN' : ''}</Text><Text style={s.body}>{flight.state === 'in_flight' ? 'In flight' : flight.state === 'intercepted' ? 'Intercepted' : 'Delivered'}{flight.events.at(-1) ? ` · ${flight.events.at(-1)!.label}` : ''}</Text></View>}
    <Action secondary label={result ? 'Back to the map' : attempt || state.phase === 'reserving' || state.phase === 'reserve-error' ? 'Leave catch · attempt still counts' : 'Back to the map'} onPress={() => { session.setAvailable(false); onExit({ flightId, result }); }} />
  </View></ScrollView></SafeAreaView>;
}

function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : undefined} style={[s.notice, error && s.error]}>{children}</Text>;
}

function Action({ label, onPress, disabled = false, secondary = false, large = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; large?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, large && s.large, disabled && s.disabled, pressed && !disabled && s.pressed]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, padding: 24 },
  page: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  brand: { color: '#2453FF', fontSize: 26, fontWeight: '800' },
  tag: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  stack: { gap: 14 },
  title: { color: '#17212B', fontSize: 32, fontWeight: '700', lineHeight: 38 },
  body: { color: '#475569', fontSize: 15, lineHeight: 22 },
  small: { color: '#475569', fontSize: 12, lineHeight: 18 },
  route: { borderLeftWidth: 3, borderLeftColor: '#2453FF', paddingLeft: 12, gap: 4 },
  routeTitle: { color: '#17212B', fontSize: 17, fontWeight: '600' },
  instructions: { backgroundColor: '#F3F6FC', padding: 20, borderRadius: 20, gap: 12 },
  instructionTitle: { color: '#17212B', fontSize: 18, fontWeight: '600' },
  notice: { color: '#34455A', fontSize: 13, lineHeight: 20, backgroundColor: '#F3F6FC', padding: 14, borderRadius: 12 },
  error: { color: '#963B29', backgroundColor: '#FFF1ED' },
  loading: { flexDirection: 'row', gap: 12, paddingVertical: 20 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  round: { color: '#17212B', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  timer: { color: '#2453FF', fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '600' },
  arena: { borderRadius: 20, backgroundColor: '#F3F6FC', padding: 16, gap: 10 },
  targetLabel: { color: '#475569', fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  lane: { height: 100 },
  track: { position: 'absolute', left: 0, right: 0, top: 44, height: 2, backgroundColor: '#CED8EA' },
  net: { position: 'absolute', left: '38%', width: '24%', top: 0, bottom: 0, backgroundColor: '#E0E9FF', borderWidth: 1, borderStyle: 'dashed', borderColor: '#2453FF', borderRadius: 12, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  netLabel: { color: '#2453FF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  target: { position: 'absolute', top: 29, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#17212B', justifyContent: 'center', alignItems: 'center' },
  targetDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  rounds: { flexDirection: 'row', gap: 8 },
  roundCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F6FC', gap: 2 },
  hit: { backgroundColor: '#E5F3EA' },
  miss: { backgroundColor: '#FFF1ED' },
  hitText: { fontSize: 15, color: '#17212B', fontWeight: '600' },
  button: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: '#2453FF', borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  large: { minHeight: 72 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondary: { backgroundColor: '#F3F6FC' },
  secondaryText: { color: '#2453FF' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  confirmed: { color: '#2453FF', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  letter: { backgroundColor: '#F3F6FC', borderRadius: 20, padding: 20, gap: 16 },
  letterBody: { fontSize: 20, lineHeight: 30, color: '#17212B' },
  event: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16, gap: 6 },
});
