import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFlight, usePigeon } from '../../src/client/PigeonProvider';
import type { Attempt, AttemptResult } from '../../src/domain';
import { PigeonCharacter } from '../../src/animation/PigeonCharacter';
import { ActionFeedback, AuthGate, Badge, Button, EmptyState, Eyebrow, Loading, Notice, Page, Txt, useAction, useReducedMotion } from '../../src/ui/primitives';
import { Bird } from '../../src/ui/Bird';
import { attemptMonotonicStart, catchFrame, recordTap, CATCH_MS } from '../../src/ui/catchTiming';
import { colors, mono } from '../../src/ui/theme';

export default function CatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pigeon = usePigeon();
  const { flight, loading } = useFlight(id);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [taps, setTaps] = useState<(number | null)[]>([null, null, null]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [laneWidth, setLaneWidth] = useState(0);
  const [active, setActive] = useState(true);
  const [abandoned, setAbandoned] = useState(false);
  const start = useRef(0);
  const tapsRef = useRef<(number | null)[]>([null, null, null]);
  const submitted = useRef(false);
  const action = useAction();
  const reduced = useReducedMotion();
  const frame = attempt ? catchFrame(elapsed, attempt.phases, taps) : null;
  useEffect(() => { if (attempt && !pigeon.connected && !result) setAbandoned(true); }, [attempt, pigeon.connected, result]);
  useEffect(() => { const listener = AppState.addEventListener('change', state => setActive(state === 'active')); return () => listener.remove(); }, []);
  useEffect(() => {
    if (!attempt || result || !active) return;
    let raf = 0;
    const tick = () => { const current = performance.now() - start.current; setElapsed(current); if (current < attempt.expiresAt - attempt.startedAt + 200) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [attempt, result, active]);
  useEffect(() => {
    if (!attempt || elapsed < (abandoned ? attempt.expiresAt - attempt.startedAt + 100 : CATCH_MS + 100) || submitted.current || result || !pigeon.connected || !active) return;
    submitted.current = true;
    void action.run(async () => { const resolved = await pigeon.resolve(attempt.id, tapsRef.current); setResult(resolved); AccessibilityInfo.announceForAccessibility(resolved.outcome === 'caught' ? 'Pigeon caught. Special delivery, wrong person.' : resolved.outcome === 'delivered' ? 'The pigeon reached its recipient.' : 'Outflew you. The server confirmed this attempt did not catch the pigeon.'); });
  }, [attempt, elapsed, result, pigeon.connected, active, abandoned]);
  async function reserve() {
    const requestStarted = performance.now();
    const reserved = await pigeon.reserve(id);
    start.current = attemptMonotonicStart(requestStarted, performance.now(), reserved.serverTime, reserved.startedAt);
    tapsRef.current = [null, null, null]; submitted.current = false;
    setTaps(tapsRef.current); setElapsed(performance.now() - start.current); setAttempt(reserved);
  }
  function tap() {
    if (!attempt || abandoned || !pigeon.connected) return;
    const next = recordTap(tapsRef.current, performance.now() - start.current);
    tapsRef.current = next; setTaps(next); setElapsed(performance.now() - start.current);
  }
  return <Page narrow back eyebrow="A LITTLE FRIENDLY AIR PIRACY" title={result ? result.outcome === 'caught' ? 'Special delivery. Wrong person.' : result.outcome === 'delivered' ? 'Just made it home.' : 'Outflew you.' : 'Right bird. Right moment.'} subtitle={result ? 'The post office has confirmed the outcome.' : 'Three rounds. Six seconds. One extremely unbothered pigeon.'}><AuthGate>
    {loading && !attempt ? <Loading/> : !flight && !attempt ? <EmptyState title="This flight is out of reach." body="It may be private, finished, or unavailable. No catch attempt has been started."/> : result ? <View style={{ gap: 24, alignItems: 'center' }}><PigeonCharacter size={220} outfit={flight?.outfit ?? 'classic'} motion={result.outcome === 'caught' ? 'caught' : 'fly'}/><Badge label={`${result.hits.filter(Boolean).length} of 3 hits · Server confirmed`} tone={result.outcome === 'caught' ? 'green' : 'neutral'}/><Txt style={{ color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 23 }}>{result.outcome === 'caught' ? 'A wrong turn brought a little thought your way. The intended recipient won’t receive this letter.' : result.outcome === 'delivered' ? 'Arrival takes priority. This pigeon reached its recipient before the catch could finish.' : result.outcome === 'expired' ? 'The reservation expired. The courier kept its original journey and arrival time.' : 'A very respectable effort. This courier gets to keep flying.'}</Txt>{result.outcome === 'caught' && flight?.body !== undefined && <View style={{ backgroundColor: colors.paper, borderRadius: 20, padding: 28, alignSelf: 'stretch', gap: 16 }}><Eyebrow>A LETTER FOUND YOU</Eyebrow><Txt selectable style={{ fontSize: 20, lineHeight: 32 }}>{flight.body}</Txt><Txt style={{ fontSize: 12, color: colors.muted }}>With feeling, @{flight.senderHandle}</Txt></View>}<Button label={result.outcome === 'caught' ? 'Open the letter & say hello' : 'Back to the flight'} icon="arrow" onPress={() => router.replace(`/flight/${result.flightId}`)}/></View>
      : !attempt ? <View style={{ gap: 24 }}><View style={{ alignItems: 'center', backgroundColor: colors.sky, borderRadius: 20, padding: 24, gap: 16 }}><PigeonCharacter size={160} outfit={flight?.outfit ?? 'classic'} motion="fly"/><Badge label={flight?.defense === 'zigzag' ? 'Zigzag · 3 hits to catch' : 'Cruise · 2 hits to catch'} tone="paper"/><Txt style={{ fontSize: 13, textAlign: 'center', lineHeight: 23, color: colors.muted }}>Tap Catch once per round, when the pigeon’s center is inside the net. A missed tap or a tap outside the net counts as a miss.</Txt></View><Notice text="The flight is reserved only when you start. You get one attempt on this bird; leaving the game or disconnecting doesn’t pause its six-second timer."/>{reduced && <Notice text="Reduced motion is on: decorative motion is off. The timing lane still moves because its position is the game; you can skip the catch and keep exploring."/>}<ActionFeedback action={action}/><Button label="Ready. Let’s catch a pigeon." icon="sky" busy={action.busy} disabled={!flight?.canCatch || !pigeon.connected} onPress={() => action.run(reserve)}/>{!flight?.canCatch && <Notice text="This pigeon can’t be caught right now. It may be too close to arrival, reserved, protected, or already attempted."/>}</View>
      : frame && <View style={{ gap: 24 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Eyebrow>{frame.finished ? 'AWAITING THE POST OFFICE' : `ROUND ${frame.round + 1} OF 3`}</Eyebrow><Txt style={{ fontFamily: mono, fontSize: 22, fontWeight: '600' }}>{(frame.remaining / 1000).toFixed(1)}s</Txt></View>
        <View style={{ borderRadius: 20, backgroundColor: colors.sky, borderWidth: 1, borderColor: '#D9E8F0', paddingHorizontal: 32, paddingVertical: 36 }}><View style={{ height: 128 }} onLayout={event => setLaneWidth(event.nativeEvent.layout.width)}><View style={{ position: 'absolute', left: 0, right: 0, height: 1, top: 70, backgroundColor: '#BCD0DE' }}/><View style={{ position: 'absolute', left: '38%', width: '24%', top: 8, bottom: 8, borderRadius: 14, backgroundColor: '#D7E9DF', borderWidth: 1.5, borderColor: '#8FB69D', borderStyle: 'dashed' }}><View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 }}><Txt style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.green }}>THE NET</Txt></View></View><View pointerEvents="none" style={{ position: 'absolute', left: laneWidth * frame.position - 32, top: 34 }}><Bird size={64} outfit={flight?.outfit ?? 'classic'} pose="up" label="Timing target pigeon"/></View></View></View>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 12 }}>{frame.hits.map((hit, index) => <View key={index} style={{ flex: 1, padding: 16, alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: hit === true ? '#A6CCB7' : hit === false ? '#EDC2B8' : colors.line, backgroundColor: hit === true ? '#EBF5EF' : hit === false ? '#FCF0EB' : colors.white }}><Txt style={{ fontSize: 10, color: colors.muted }}>ROUND {index + 1}</Txt><Txt style={{ fontSize: 14, fontWeight: '600', color: hit === true ? colors.green : hit === false ? '#B15342' : colors.muted }}>{hit === true ? 'Hit!' : hit === false ? 'Miss' : index === frame.round && !frame.finished ? 'Ready…' : '—'}</Txt></View>)}</View>
        <Button label={abandoned ? 'Connection interrupted. Confirming…' : frame.finished ? 'Confirming the catch…' : !frame.canTap ? 'Tap recorded. Next round…' : 'Catch!'} onPress={tap} disabled={!frame.canTap || !active || abandoned || !pigeon.connected} style={{ minHeight: 80, borderRadius: 20 }} icon="sky"/>
        <Txt style={{ textAlign: 'center', fontSize: 11, color: colors.muted }}>{attempt.defense === 'zigzag' ? 'All three hits needed' : 'Two hits needed'} · One tap per round · Final outcome is server-confirmed</Txt><ActionFeedback action={action}/>
        {frame.finished && action.error && <Button label="Retry result confirmation" variant="secondary" disabled={!pigeon.connected} busy={action.busy} onPress={() => action.run(async () => { const resolved = await pigeon.resolve(attempt.id, tapsRef.current); setResult(resolved); })}/>}
        {!pigeon.connected && <Notice text="Connection lost. The timer continues and the reservation will expire; we’ll confirm the outcome when the post office reconnects."/>}
      </View>}
  </AuthGate></Page>;
}
