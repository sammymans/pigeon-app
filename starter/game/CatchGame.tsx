import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CatchGameProps, Encounter } from './contract';
import { isFinished, SlingshotSession } from './SlingshotSession';
import { FLIGHT_MS, GAME_VERSION, PLAY_MS, pullDirection, SCENE, sceneTransform, stoneAt, targetAt, traceShot, type Point } from './trajectory';

const BLUE = '#2453FF';
const INK = '#17212B';
const MUTED = '#566273';

export function CatchGame(props: CatchGameProps) { return <Game key={props.flightId} {...props} />; }

function Game({ flightId, connected, transport, onExit, onOpenLetter, flightError, onRetryFlight }: CatchGameProps) {
  const [session] = useState(() => new SlingshotSession(flightId, transport));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [practice, setPractice] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    session.setAvailable(connected);
    void session.load();
    const change = (active: boolean) => { session.setAvailable(connected && active); };
    const listener = AppState.addEventListener('change', state => change(state === 'active'));
    const visibility = () => change(document.visibilityState === 'visible');
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => {
      listener.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
      mounted.current = false;
      queueMicrotask(() => { if (!mounted.current) session.setAvailable(false); });
    };
  }, [session, connected]);
  useEffect(() => {
    let raf = 0;
    const tick = () => { session.tick(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session]);
  if (practice) return <PracticeGame onExit={() => setPractice(false)} />;
  const { data } = snapshot;
  return <Scene encounter={data?.encounter ?? null} now={snapshot.now} count={data?.pouch.count ?? null} nextRefillAt={data?.pouch.nextRefillAt ?? null}
    loading={!data && !snapshot.error} busy={snapshot.busy} drag={snapshot.drag} armed={snapshot.armed} error={snapshot.error || flightError || (!connected ? 'Reconnecting. This attempt cannot resume after an interruption.' : '')}
    onBegin={point => session.begin(point)} onMove={point => session.move(point)} onRelease={() => session.release()}
    onExit={() => { void session.end(); onExit({ flightId, outcome: data?.encounter?.state ?? null }); }}
    onRetry={() => { void session.retry(); onRetryFlight?.(); }}
    onOpenLetter={() => { if (data?.encounter?.state === 'caught') onOpenLetter({ flightId }); }}
    onPractice={() => setPractice(true)} />;
}

type SceneProps = {
  encounter: Encounter | null; now: number; count: number | null; nextRefillAt: number | null;
  drag: Point | null; armed: boolean; busy?: boolean; loading?: boolean; error?: string; practice?: boolean;
  onBegin: (point: Point) => boolean; onMove: (point: Point) => void; onRelease: () => void;
  onExit: () => void; onRetry?: () => void; onOpenLetter?: () => void; onPractice?: () => void;
};

function Scene({ encounter: e, now, count, nextRefillAt, drag, armed, busy, loading, error, practice, onBegin, onMove, onRelease, onExit, onRetry, onOpenLetter, onPractice }: SceneProps) {
  const [size, setSize] = useState({ width: 390, height: 760 });
  const [reduced, setReduced] = useState(false);
  const [help, setHelp] = useState(false);
  const touch = useRef<{ page: Point; logical: Point } | null>(null);
  const transform = sceneTransform(size.width, size.height);
  const { scale } = transform;
  const done = isFinished(e?.state);
  const empty = count === 0 && !e;
  const caught = e?.state === 'caught';
  const shot = e?.shots.find(shot => shot.outcome === 'flying');
  const used = e?.shots.length ?? 0;
  const limit = e?.shotLimit ?? 2;
  const remaining = Math.max(0, limit - used);
  const elapsed = e ? Math.max(0, now - e.preparedAt) : 0;
  const target = targetAt(elapsed, e?.seed ?? 0);
  const direction = drag ? pullDirection(drag) : null;
  const drawLength = drag ? Math.min(96, Math.hypot(drag.x, drag.y)) : 0;
  const loaded = direction ? { x: SCENE.fork.x - direction.x * drawLength, y: SCENE.fork.y - direction.y * drawLength } : SCENE.fork;
  const inFlightPosition = shot ? stoneAt(Math.min(now - shot.releasedAt, shot.endsAt - shot.releasedAt), shot.direction) : null;
  const clock = e?.fireUntil ? Math.max(0, Math.ceil((e.fireUntil - now) / 1000)) : 10;
  const label = practice ? 'Free practice' : caught ? 'Caught' : done ? 'Escaped' : empty ? 'Your stones' : e?.armedAt !== null && e ? `0:${String(clock).padStart(2, '0')}` : 'Slingshot';
  const eyebrow = caught ? `${used === 1 ? 'FIRST' : 'SECOND'} SHOT · RIGHT ON TARGET` : done ? e?.state === 'delivered' ? 'ARRIVAL TAKES PRIORITY' : e?.state === 'abandoned' ? 'ENCOUNTER ENDED' : `${used} SHOT${used === 1 ? '' : 'S'} USED` : empty ? 'YOUR POUCH IS EMPTY' : shot ? `SHOT ${used} IN FLIGHT` : used > 0 ? 'ONE SHOT LEFT' : drag && armed ? `SHOT 1 OF ${limit}` : `${limit === 1 ? 'ONE SHOT' : 'TWO SHOTS'} AT THIS PIGEON`;

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; listener.remove(); };
  }, []);
  useEffect(() => { if (done) AccessibilityInfo.announceForAccessibility(caught ? practice ? 'Practice hit.' : 'Server confirmed: pigeon caught.' : practice ? 'Practice round finished.' : 'Server confirmed: encounter ended without a catch.'); }, [done, caught, practice]);

  function point(event: GestureResponderEvent) {
    return touch.current ? { x: touch.current.logical.x + (event.nativeEvent.pageX - touch.current.page.x) / scale, y: touch.current.logical.y + (event.nativeEvent.pageY - touch.current.page.y) / scale } : SCENE.fork;
  }
  return <SafeAreaView style={styles.safe}><View testID="slingshot-viewport" style={styles.fill} onLayout={event => setSize(event.nativeEvent.layout)}>
    <View style={{ position: 'absolute', left: transform.left, top: transform.top, width: SCENE.width * scale, height: SCENE.height * scale, overflow: 'hidden' }}>
      <View testID="slingshot-scene" style={{ width: SCENE.width, height: SCENE.height, transform: [{ scale }], transformOrigin: 'top left', backgroundColor: '#FFFFFF' }}>
        <View style={styles.sky} /><View style={styles.ground}><View style={styles.hillOne} /><View style={styles.hillTwo} /></View>
        <View style={styles.header}><Button small label="×" accessibilityLabel="Leave encounter" onPress={onExit} /><Text style={styles.nav}>{label}</Text><View style={styles.pouch}><View style={styles.stoneIcon} /><Text style={styles.pouchCount}>{practice ? '∞' : count ?? '—'}</Text></View></View>
        <View style={styles.meta}><Text style={styles.eyebrow}>{eyebrow}</Text><View style={styles.pips}>{Array.from({ length: limit }, (_, index) => <View key={index} style={[styles.pip, { opacity: index < remaining && !done ? 1 : 0.25 }]} />)}</View></View>
        {!done && !empty && <>
          <View style={styles.copy}><Text style={styles.title}>{shot ? 'There it goes.' : used ? 'A little wide.' : drag && armed ? 'Aim where it’s going.' : 'Pull back.\nAim ahead. Let go.'}</Text><Text style={styles.body}>{practice ? 'Free practice. No stones spent. No letters caught.' : shot ? 'Watch the arc.' : used ? 'Lead the pigeon and try your last shot.' : drag && armed ? 'Let the pigeon fly into your shot.' : 'One hit catches the letter.'}</Text></View>
          <View testID="slingshot-target" style={[styles.target, { left: target.x - 29, top: target.y - 29 }]}><View style={styles.speedLine} /><View style={[styles.speedLine, { top: 37, width: 20, left: -27 }]} /></View>
          <Line from={{ x: 145, y: 572 }} to={{ x: 195, y: 636 }} color={MUTED} width={14} /><Line from={{ x: 245, y: 572 }} to={{ x: 195, y: 636 }} color={MUTED} width={14} /><Line from={{ x: 195, y: 636 }} to={{ x: 195, y: 747 }} color={MUTED} width={16} />
          <Line from={{ x: 145, y: 572 }} to={shot ? SCENE.fork : loaded} color={BLUE} width={3} /><Line from={{ x: 245, y: 572 }} to={shot ? SCENE.fork : loaded} color={BLUE} width={3} />
          {direction && armed && !shot && Array.from({ length: 7 }, (_, index) => { const position = stoneAt(index * 32, direction); return <Dot key={index} point={position} size={3} color="#9CB0FF" />; })}
          {shot && Array.from({ length: 12 }, (_, index) => { const position = stoneAt(Math.max(0, now - shot.releasedAt - index * 24), shot.direction); return <Dot key={index} point={position} size={2} color="#A9BBFF" />; })}
          {inFlightPosition ? <Dot point={inFlightPosition} size={16} color={BLUE} testID="slingshot-projectile" /> : <Dot point={loaded} size={16} color={BLUE} testID="slingshot-stone" />}
          <View style={styles.hint}><Text style={styles.hintTitle}>{shot ? '−1 stone' : drag && armed ? 'Let go.' : used ? 'One more.' : 'Drag the blue stone'}</Text><Text style={styles.hintBody}>{shot ? `${count ?? '—'} in your pouch` : drag && armed ? '1 stone when you fire\nReturn to the fork to cancel' : 'Pull back at least 32 pt\nStrength stays fixed'}</Text></View>
          {!e?.armedAt && <Text style={styles.leaving}>{loading ? 'Checking the sky…' : e ? `Leaving your sky in 0:${String(Math.max(0, Math.ceil((e.readyUntil - now) / 1000))).padStart(2, '0')}` : 'Preparing your encounter…'}</Text>}
        </>}
        {caught && <><Text style={styles.bonk}>BONK.</Text><View style={styles.impact}>{Array.from({ length: 10 }, (_, index) => { const angle = index * Math.PI / 5; return <Line key={index} from={{ x: 120 + 52 * Math.cos(angle), y: 120 + 52 * Math.sin(angle) }} to={{ x: 120 + 100 * Math.cos(angle), y: 120 + 100 * Math.sin(angle) }} color={BLUE} width={2} />; })}<Dot point={{ x: 120, y: 120 }} size={58} color={BLUE} /><Text style={styles.envelope}>✉</Text></View><View style={styles.resultCopy}><Text style={styles.title}>{practice ? 'Nice practice shot.' : 'You caught it.'}</Text><Text style={styles.body}>{practice ? 'Same motion. Same collision. No letter or stone changed.' : 'An unexpected letter.\nAnd an unexpected introduction.'}</Text></View><View style={styles.bottom}><Button label={practice ? 'Practice again' : 'Open letter'} onPress={practice ? onPractice! : onOpenLetter!} /><Text style={styles.foot}>{practice ? 'Free every time.' : 'Server-confirmed catch · open your authorized letter'}</Text></View></>}
        {done && !caught && <><View style={styles.escapeArt}>{[0, 1, 2].map(index => <Dot key={index} point={{ x: 170 + index * 40, y: 80 - index * 22 }} size={32 + index * 10} color={index === 2 ? BLUE : '#B3C3EB'} />)}</View><View style={[styles.resultCopy, { top: 414 }]}><Text style={styles.title}>{e?.state === 'delivered' ? 'That pigeon\nmade it home.' : 'That pigeon had\nplaces to be.'}</Text><Text style={styles.body}>{practice ? 'Practice over. Your pouch is unchanged.' : e?.state === 'abandoned' ? 'You left the encounter. Unfired stones cost nothing.' : e?.state === 'delivered' ? 'The intended recipient can read it. Arrival wins.' : `${used} shot${used === 1 ? '' : 's'}. No catch.\nThe letter stays private to its participants.`}</Text><Text style={[styles.body, { marginTop: 20 }]}>{!practice && `Your other ${count ?? '—'} stones are still in your pouch.`}</Text></View><View style={styles.bottom}><Button label={practice ? 'Practice again' : 'Back to sky'} onPress={practice ? onPractice! : onExit} /><Text style={styles.foot}>{practice ? 'No charge. No real pigeon.' : 'Another pigeon. Another chance.'}</Text></View></>}
        {empty && <><View style={styles.copy}><Text style={styles.title}>Out of stones.{'\n'}Still in the game.</Text><Text style={styles.body}>Practice your aim while you refill.</Text></View><View style={styles.bag}><View style={styles.bagTop} /></View><View style={styles.refills}><View style={styles.refillRow}><View><Text style={styles.refillTitle}>Free refill</Text><Text style={styles.body}>Refills up to 3 stones</Text></View><Text style={styles.refillTime}>{nextRefillAt ? `+1 in ${duration(nextRefillAt - now)}` : 'Checking…'}</Text></View><Text style={[styles.body, { marginTop: 24 }]}>Your own pigeon brings +2 after a verified completed round trip. No return is scheduled by this screen.</Text></View><View style={styles.bottom}><Button label="Practice for free" onPress={onPractice!} /><Button secondary label="Get stones" onPress={() => setHelp(true)} /></View></>}
        {help && <View style={styles.help}><Text style={styles.title}>Stones come home.</Text><Text style={styles.body}>Start with 6. Your shared pouch holds 12. Below 3, one stone refills every 20 minutes. A verified completed round trip grants 2, once.</Text><Text style={styles.body}>Stone packs are not available in V1. Practice is always free.</Text><Button label="Back to your pouch" onPress={() => setHelp(false)} /></View>}
        {loading && <ActivityIndicator style={styles.loading} color={BLUE} />}
        {busy && <Text style={styles.status}>Confirming with the server…</Text>}
        {error && <View style={styles.error}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>{onRetry && <Button secondary label="Retry confirmation" onPress={onRetry} />}</View>}
        {reduced && !done && !empty && <Text style={styles.reduced}>Reduced motion · essential target motion stays on</Text>}
      </View>
      {!done && !empty && !help && e && <View testID="slingshot-grab" accessibilityLabel="Drag the blue stone away from the fork, then release to fire. Return to the fork to cancel." style={{ position: 'absolute', left: (SCENE.fork.x - 44) * scale, top: (SCENE.fork.y - 44) * scale, width: 88 * scale, height: 88 * scale }}
        onStartShouldSetResponder={() => !busy && !shot}
        onResponderGrant={event => { event.preventDefault(); const logical = { x: SCENE.fork.x - 44 + event.nativeEvent.locationX / scale, y: SCENE.fork.y - 44 + event.nativeEvent.locationY / scale }; if (onBegin(logical)) touch.current = { page: { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }, logical }; }}
        onResponderMove={event => { event.preventDefault(); if (touch.current) onMove(point(event)); }}
        onResponderTerminationRequest={() => false}
        onResponderRelease={event => { if (touch.current) { onMove(point(event)); onRelease(); touch.current = null; } }}
        onResponderTerminate={() => { touch.current = null; onMove(SCENE.fork); onRelease(); }} />}
    </View>
  </View></SafeAreaView>;
}

export function PracticeGame({ onExit }: { onExit: () => void }) {
  const [round, setRound] = useState(0);
  return <Practice key={round} onExit={onExit} restart={() => setRound(round + 1)} />;
}

function Practice({ onExit, restart }: { onExit: () => void; restart: () => void }) {
  const [e, setEncounter] = useState<Encounter>(() => ({ id: 'practice', flightId: '', version: GAME_VERSION, preparedAt: performance.now(), readyUntil: Infinity, seed: 0.8, armedAt: null, fireUntil: null, finishBy: null, shotLimit: 2, shots: [], state: 'ready', endedAt: null }));
  const [now, setNow] = useState(performance.now());
  const [drag, setDrag] = useState<Point | null>(null);
  const dragRef = useRef<Point | null>(null);
  const armed = useRef(false);
  const current = useRef(e);
  current.current = e;
  function update(next: Encounter) { current.current = next; setEncounter(next); }
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now(); setNow(now);
      const value = current.current;
      const shot = value.shots.find(shot => shot.outcome === 'flying');
      if (shot && now >= shot.endsAt) {
        const hit = traceShot(shot.releasedAt - value.preparedAt, shot.direction, value.seed).hit;
        update({ ...value, shots: value.shots.map(item => item === shot ? { ...item, outcome: hit ? 'caught' : 'missed' } : item), state: hit ? 'caught' : value.shots.length === 2 || now >= value.fireUntil! ? 'escaped' : 'active' });
      } else if (!shot && value.fireUntil && now >= value.fireUntil && !isFinished(value.state)) update({ ...value, state: 'escaped' });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') update({ ...current.current, state: 'abandoned' }); });
    return () => { cancelAnimationFrame(raf); listener.remove(); };
  }, []);
  function move(point: Point) {
    if (!dragRef.current) return;
    const pull = { x: point.x - SCENE.fork.x, y: point.y - SCENE.fork.y };
    dragRef.current = pull; setDrag(pull);
    if (Math.hypot(pull.x, pull.y) >= 32) {
      armed.current = true;
      const value = current.current;
      if (value.armedAt === null) { const now = performance.now(); update({ ...value, armedAt: now, fireUntil: now + PLAY_MS, finishBy: now + PLAY_MS + FLIGHT_MS, state: 'active' }); }
    }
  }
  return <Scene practice encounter={e} now={now} count={null} nextRefillAt={null} drag={drag} armed={armed.current} onExit={onExit} onPractice={restart}
    onBegin={() => { if (isFinished(e.state) || e.state === 'projectile') return false; dragRef.current = { x: 0, y: 0 }; setDrag(dragRef.current); armed.current = false; return true; }} onMove={move}
    onRelease={() => { const pull = dragRef.current; dragRef.current = null; setDrag(null); const value = current.current; const at = performance.now(); if (!pull || !armed.current || Math.hypot(pull.x, pull.y) <= 24 || at >= value.fireUntil! || isFinished(value.state)) return; const direction = pullDirection(pull)!; const trace = traceShot(at - value.preparedAt, direction, value.seed); update({ ...value, state: 'projectile', shots: [...value.shots, { key: String(value.shots.length), direction, releasedAt: at, endsAt: at + trace.duration, outcome: 'flying' }] }); }} />;
}

function Dot({ point, size, color, testID }: { point: Point; size: number; color: string; testID?: string }) { return <View testID={testID} pointerEvents="none" style={{ position: 'absolute', left: point.x - size / 2, top: point.y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />; }
function Line({ from, to, color, width }: { from: Point; to: Point; color: string; width: number }) { const length = Math.hypot(to.x - from.x, to.y - from.y); return <View pointerEvents="none" style={{ position: 'absolute', left: from.x, top: from.y - width / 2, width: length, height: width, borderRadius: width, backgroundColor: color, transformOrigin: 'left center', transform: [{ rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad` }] }} />; }
function Button({ label, onPress, secondary, small, accessibilityLabel }: { label: string; onPress: () => void; secondary?: boolean; small?: boolean; accessibilityLabel?: string }) { return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={[styles.button, secondary && styles.secondary, small && styles.close]}><Text style={[styles.buttonText, (secondary || small) && { color: INK }]}>{label}</Text></Pressable>; }
function duration(ms: number) { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' }, fill: { flex: 1 },
  sky: { position: 'absolute', left: 0, right: 0, top: 400, bottom: 0, backgroundColor: '#F3F8FB' },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, overflow: 'hidden', backgroundColor: '#EAF2F7' },
  hillOne: { position: 'absolute', top: 26, left: -20, width: 250, height: 90, backgroundColor: '#DBE7EF', transform: [{ rotate: '-23deg' }] },
  hillTwo: { position: 'absolute', top: 26, right: -30, width: 250, height: 90, backgroundColor: '#DBE7EF', transform: [{ rotate: '23deg' }] },
  header: { position: 'absolute', left: 24, right: 24, top: 8, height: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nav: { fontSize: 20, fontWeight: '600', color: INK, fontVariant: ['tabular-nums'] },
  pouch: { width: 66, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pouchCount: { fontSize: 15, fontWeight: '600', color: INK }, stoneIcon: { width: 12, height: 12, borderRadius: 4, backgroundColor: BLUE, transform: [{ rotate: '20deg' }] },
  meta: { position: 'absolute', left: 24, right: 24, top: 68, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 0.7, fontWeight: '600', color: MUTED }, pips: { flexDirection: 'row', gap: 7 }, pip: { width: 9, height: 9, borderRadius: 5, backgroundColor: BLUE },
  copy: { position: 'absolute', left: 28, right: 28, top: 126, gap: 12 }, title: { fontSize: 32, fontWeight: '700', letterSpacing: -1, lineHeight: 37, color: INK }, body: { fontSize: 14, lineHeight: 21, color: MUTED },
  target: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: BLUE }, speedLine: { position: 'absolute', left: -36, top: 25, width: 25, height: 2, backgroundColor: '#B2BCCB' },
  hint: { position: 'absolute', left: 254, top: 640, width: 120, gap: 8 }, hintTitle: { fontSize: 17, fontWeight: '600', color: BLUE }, hintBody: { fontSize: 12, lineHeight: 18, color: MUTED },
  leaving: { position: 'absolute', left: 28, top: 411, fontSize: 13, color: MUTED },
  bonk: { position: 'absolute', left: 30, top: 112, color: BLUE, fontSize: 76, fontWeight: '900', letterSpacing: -3, transform: [{ rotate: '-8deg' }] },
  impact: { position: 'absolute', left: 75, top: 220, width: 240, height: 240 }, envelope: { position: 'absolute', left: 150, top: 160, fontSize: 65, color: BLUE, transform: [{ rotate: '15deg' }] },
  resultCopy: { position: 'absolute', left: 28, right: 28, top: 492, gap: 14 }, bottom: { position: 'absolute', left: 24, right: 24, bottom: 18, gap: 14 }, foot: { fontSize: 11, lineHeight: 16, color: MUTED, textAlign: 'center' },
  escapeArt: { position: 'absolute', left: 0, top: 188, width: 390, height: 180 },
  bag: { position: 'absolute', left: 140, top: 297, width: 110, height: 90, borderRadius: 36, borderColor: '#A1B0CC', borderWidth: 2, backgroundColor: '#EFF3FF' }, bagTop: { position: 'absolute', left: 23, top: -24, width: 62, height: 30, borderRadius: 12, borderColor: '#A1B0CC', borderWidth: 2, backgroundColor: '#EFF3FF' },
  refills: { position: 'absolute', left: 28, right: 28, top: 440 }, refillRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, refillTitle: { fontSize: 15, fontWeight: '600', color: INK }, refillTime: { fontSize: 14, color: BLUE, fontWeight: '600' },
  help: { position: 'absolute', left: 16, right: 16, top: 200, padding: 24, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DBE7EF', gap: 24 },
  button: { minHeight: 56, padding: 15, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE }, buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }, secondary: { backgroundColor: '#FFFFFF' }, close: { width: 44, minHeight: 44, padding: 0, backgroundColor: '#FFFFFF' },
  loading: { position: 'absolute', left: 180, top: 450 }, status: { position: 'absolute', left: 28, top: 454, color: BLUE, fontSize: 12 }, error: { position: 'absolute', left: 20, right: 20, top: 400, padding: 12, borderRadius: 12, backgroundColor: '#FFF1ED', gap: 8 }, errorText: { color: '#963B29', fontSize: 12, lineHeight: 18 }, reduced: { position: 'absolute', left: 28, top: 480, fontSize: 10, color: MUTED },
});
