import { useEffect, useRef, useState } from 'react';
import { AppState, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, SvgXml } from 'react-native-svg';
import { advanceGame, beginAim, cancelAim, createGame, gameDeadline, makeShot, MAX_SHOTS, moveAim, pigeonPosition, releaseShot, shotsRemaining, SLING, stonePosition, type InterceptionGame as Game, type Point } from '../../src/interception';
import { pigeonSvg } from '../Pigeon';
import { PigeonMarker } from './PigeonMarker';
import { a, Copy, font, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';

export function Stone({ size = 16 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 20 20" aria-hidden><Path d="m3 4 8-3 6 5-2 10-9 2-5-8Z" fill={palette.blue} /><Path d="m3 4 8 4 6-2M11 8l-2 10" stroke="#163CD9" strokeWidth={0.8} fill="none" /></Svg>;
}

type Props = {
  pigeon: string;
  stones: number;
  onSpendStone: () => void;
  onCaught: () => void;
  onClose: () => void;
  onOpenLetter: () => void;
};

export function InterceptionGame({ pigeon, stones, onSpendStone, onCaught, onClose, onOpenLetter }: Props) {
  const insets = usePageInsets();
  const [game, setGame] = useState(() => createGame(Date.now(), stones));
  const current = useRef(game);
  const [size, setSize] = useState({ width: 390, height: 500 });
  const layout = useRef(size);
  const callbacks = useRef({ onSpendStone, onCaught });
  callbacks.current = { onSpendStone, onCaught };
  const gestureStart = useRef({ x: 0, y: 0 });

  function update(next: Game) {
    const previous = current.current;
    if (next === previous) return;
    current.current = next;
    setGame(next);
    if (next.shots > previous.shots) callbacks.current.onSpendStone();
    if (next.phase === 'caught' && previous.phase !== 'caught') callbacks.current.onCaught();
  }

  useEffect(() => {
    let frame: number;
    const animate = () => {
      update(advanceGame(current.current, Date.now()));
      if (!['caught', 'escaped'].includes(current.current.phase)) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update(advanceGame(current.current, Date.now()));
      else update(cancelAim(current.current));
    });
    return () => { cancelAnimationFrame(frame); subscription.remove(); };
  }, []);

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: event => {
      const { locationX: x, locationY: y } = event.nativeEvent;
      const { width, height } = layout.current;
      return ['ready', 'miss'].includes(current.current.phase) && shotsRemaining(current.current) > 0
        && Math.abs(x - width * SLING.x) < 76 && Math.abs(y - height * SLING.y) < 80;
    },
    onPanResponderGrant: event => {
      gestureStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      update(beginAim(current.current, Date.now()));
    },
    onPanResponderMove: event => {
      update(moveAim(current.current, {
        x: (event.nativeEvent.pageX - gestureStart.current.x) / layout.current.width,
        y: (event.nativeEvent.pageY - gestureStart.current.y) / layout.current.height,
      }));
    },
    onPanResponderRelease: () => update(releaseShot(current.current, Date.now())),
    onPanResponderTerminate: () => update(cancelAim(current.current)),
    onPanResponderTerminationRequest: () => false,
  })).current;

  const done = game.phase === 'caught' || game.phase === 'escaped';
  const caught = game.phase === 'caught';
  const available = shotsRemaining(game);
  const remaining = Math.max(0, Math.ceil((gameDeadline(game) - game.now) / 1000));
  const time = `0:${String(remaining).padStart(2, '0')}`;
  const canShoot = ['ready', 'miss', 'aiming'].includes(game.phase) && available > 0;
  const status = caught ? `${game.shots === 1 ? 'FIRST' : 'SECOND'} SHOT · RIGHT ON TARGET`
    : game.phase === 'escaped' ? game.shots === MAX_SHOTS ? 'TWO SHOTS USED' : game.escapeReason === 'stones' ? 'POUCH EMPTY' : 'OUT OF TIME'
    : game.phase === 'flight' ? `SHOT ${game.shots} IN FLIGHT` : game.phase === 'aiming' ? `SHOT ${game.shots + 1} OF ${MAX_SHOTS}`
    : game.phase === 'miss' ? available ? 'ONE SHOT LEFT' : 'NO SHOTS LEFT' : available === 1 ? 'ONE SHOT AT THIS PIGEON' : 'TWO SHOTS AT THIS PIGEON';
  const title = game.phase === 'ready' ? 'Pull back.\nAim ahead. Let go.' : game.phase === 'aiming' ? 'Aim where it’s going.' : game.phase === 'flight' ? 'There it goes.' : 'Just behind.';
  const description = game.phase === 'ready' ? 'One hit catches the letter.' : game.phase === 'aiming' ? 'Let the pigeon fly into your shot.' : game.phase === 'flight' ? 'Watch the arc.' : canShoot ? 'Aim a little further ahead.\nYou have one shot left.' : 'That was your last shot.';
  const escapeCopy = game.shots === MAX_SHOTS ? 'Two shots. No catch.' : game.escapeReason === 'stones' ? 'No more stones. No catch.' : 'Time flew. So did the pigeon.';

  // A keyboard/screen-reader alternative uses the same physics and still needs timing.
  function accessibleShot() {
    if (!canShoot) return;
    update(releaseShot(moveAim(beginAim(current.current, Date.now()), { x: 0, y: 0.18 }), Date.now()));
  }

  return <PageFrame style={{ paddingTop: insets.top, backgroundColor: 'white' }}>
    <View style={styles.header}>
      <IconButton name="close" label="Leave interception and return to sky" onPress={onClose} />
      <Text style={styles.navTitle}>{done ? caught ? 'Caught' : 'Escaped' : game.deadline ? time : 'Slingshot'}</Text>
      <View accessibilityLabel={`${game.stones} stones in your pouch`} style={styles.pouch}><Stone size={17} /><Text style={styles.stoneCount}>{game.stones}</Text></View>
    </View>
    <View style={styles.statusRow}>
      <Text accessibilityLiveRegion="polite" style={styles.eyebrow}>{status}</Text>
      {!caught && <View accessible accessibilityLabel={done ? `${game.shots} of ${MAX_SHOTS} shots used` : `${available} of ${MAX_SHOTS} shots remaining`} style={styles.shotDots}>
        {Array.from({ length: MAX_SHOTS }, (_, index) => <View key={index} style={[styles.shotDot, { backgroundColor: !done && index >= game.shots && index < game.shots + available ? palette.blue : '#C8D4E5' }]} />)}
      </View>}
    </View>
    {done ? <View style={[styles.result, { paddingBottom: insets.bottom + 10 }]}>
      <SkyBackground />
      <View style={[styles.resultArt, !caught && styles.escapeArt]}>{caught ? <CaughtArt pigeon={pigeon} /> : <EscapeArt pigeon={pigeon} />}</View>
      <View style={[styles.resultWords, !caught && styles.escapeWords]}>
        <Text accessibilityRole="header" style={styles.resultTitle}>{caught ? 'Letter intercepted.' : 'That pigeon had\nplaces to be.'}</Text>
        <Copy style={styles.resultCopy}>{caught ? 'A stranger’s letter.\nA chance to write back.' : `${escapeCopy}\nThe letter stays sealed.`}</Copy>
        {!caught && <Copy style={styles.pouchNote}>{game.stones > 0 ? `Your other ${game.stones} ${game.stones === 1 ? 'stone is' : 'stones are'} still in your pouch.` : 'Another chance when your pouch refills.'}</Copy>}
      </View>
      <View style={styles.resultActions}>
        <PrimaryButton label={caught ? 'Open letter' : 'Back to sky'} onPress={caught ? onOpenLetter : onClose} />
        <Copy style={styles.footer}>{caught ? `30 minutes to reply before ${pigeon} flies home` : 'Another pigeon. Another chance.'}</Copy>
      </View>
    </View> : <>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[styles.introTitle, (game.phase === 'aiming' || game.phase === 'flight') && styles.activeTitle]}>{title}</Text>
        <Copy style={styles.introCopy}>{description}</Copy>
      </View>
      <View {...responder.panHandlers} style={[styles.arena, Platform.OS === 'web' && { touchAction: 'none', userSelect: 'none' } as object]} onLayout={event => { layout.current = event.nativeEvent.layout; setSize(event.nativeEvent.layout); }}>
        <Arena pigeon={pigeon} game={game} width={size.width} height={size.height} />
        {game.phase === 'ready' && <View pointerEvents="none" style={styles.leaving}><Text style={styles.hintCopy}>Leaving your sky in {time}</Text></View>}
        <View pointerEvents="none" style={[styles.hint, game.phase === 'ready' && styles.readyHint]}>
          {game.phase !== 'ready' && <Text style={styles.hintTitle}>{game.phase === 'aiming' ? 'Let go.' : game.phase === 'flight' ? '−1 stone' : canShoot ? 'One more.' : 'So close.'}</Text>}
          <Text style={styles.hintCopy}>{game.phase === 'aiming' ? '1 stone\nwhen you fire' : game.phase === 'flight' ? `${game.stones} in your pouch` : game.phase === 'miss' ? canShoot ? 'Pull to aim\nyour last shot' : 'Still on the wing' : 'Drag the\nblue stone'}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Fire a straight shot. Time it as the pigeon crosses the center." disabled={!canShoot} onPress={accessibleShot} style={[styles.accessibleShot, { paddingBottom: Math.max(12, insets.bottom / 2) }]}><Text style={[a.small, { fontSize: 10, opacity: canShoot ? 0.8 : 0.4 }]}>Or tap here to fire straight ↑</Text></Pressable>
    </>}
  </PageFrame>;
}

function SkyBackground() {
  return <View pointerEvents="none" style={styles.background}><Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 390 680" aria-hidden>
    <Defs><LinearGradient id="result-sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="white" /><Stop offset="1" stopColor="#EAF1F7" /></LinearGradient></Defs>
    <Rect width={390} height={680} fill="url(#result-sky)" />
  </Svg></View>;
}

function Arena({ pigeon, game, width: w, height: h }: { pigeon: string; game: Game; width: number; height: number }) {
  const p = pigeonPosition(game.now - game.enteredAt);
  // The round Button artwork fills more of its frame than the slender birds.
  const markerSize = pigeon === 'Fern' || pigeon === 'Button' ? 126 : 176;
  const direction = pigeonPosition(game.now - game.enteredAt + 16).x >= p.x ? 1 : -1;
  const flap = Math.sin((game.now - game.enteredAt) / 60);
  const held = { x: SLING.x + game.pull.x, y: SLING.y + game.pull.y };
  const tip = game.shot ? stonePosition(game.shot, game.now) : held;
  const trajectory = game.phase === 'aiming' && game.pull.y > 0.035 ? makeShot(game.pull, game.now) : game.shot;
  const path = (points: Point[]) => points.map((point, index) => `${index ? 'L' : 'M'}${point.x * w} ${point.y * h}`).join(' ');
  const trail = trajectory ? Array.from({ length: 28 }, (_, index) => stonePosition(trajectory, trajectory.firedAt + index / 27 * (game.phase === 'aiming' ? 900 : Math.min(1800, game.now - trajectory.firedAt)))) : [];
  const stoneShape = 'm-8 -5 8-5 9 5-2 10-9 3-8-6Z';
  return <Svg pointerEvents="none" aria-hidden width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
    <Defs><LinearGradient id="game-sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="white" /><Stop offset="1" stopColor="#EDF4F8" /></LinearGradient></Defs>
    <Rect width={w} height={h} fill="url(#game-sky)" />
    <Path d={`M0 3h48m-20 9h36M${w - 62} ${h * 0.36}h62M0 ${h * 0.53}h32`} stroke="#C6D5E8" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    <Path d={`M0 ${h - 10} ${w * 0.15} ${h - 42} ${w * 0.25} ${h - 20} ${w * 0.42} ${h - 46} ${w * 0.56} ${h - 19} ${w * 0.67} ${h - 39} ${w * 0.81} ${h - 8} ${w * 0.92} ${h - 28} ${w} ${h - 8}V${h}H0Z`} fill="#DCE7EF" />
    <G transform={`translate(${p.x * w} ${p.y * h})`}>
      {/* Signed coordinates must not get a second minus: native SVG parsing is strict. */}
      <Path d={`M${-direction * 45} -5h${-direction * 20}m${direction * 6} 10h${direction * 14}`} fill="none" stroke="#8B98AA" strokeWidth={1.7} strokeLinecap="round" />
      <G transform={`translate(${-markerSize / 2} ${-markerSize / 2})`}><PigeonMarker name={pigeon} size={markerSize} facingLeft={direction < 0} pose={flap > 0 ? 'up' : 'down'} /></G>
    </G>
    {trail.length > 0 && <Path d={path(trail)} fill="none" stroke={palette.blue} strokeOpacity={game.phase === 'aiming' ? 0.9 : 0.45} strokeWidth={1.7} strokeDasharray="3 10" strokeLinecap="round" />}
    <Path d={`M${w * 0.5} ${h - 4}V${h * 0.79}M${w * 0.5} ${h * 0.79} ${w * 0.375} ${h * 0.66}M${w * 0.5} ${h * 0.79} ${w * 0.625} ${h * 0.66}`} stroke="#566273" strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {game.phase === 'flight' ? <Path d={`M${w * 0.375} ${h * 0.66}Q${w * 0.5} ${h * 0.61} ${w * 0.625} ${h * 0.66}`} stroke={palette.blue} strokeWidth={4} strokeLinecap="round" fill="none" /> : <Path d={`M${w * 0.375} ${h * 0.66} ${held.x * w} ${held.y * h} ${w * 0.625} ${h * 0.66}`} stroke={palette.blue} strokeWidth={4} strokeLinecap="round" fill="none" />}
    {game.phase === 'ready' && <><Ellipse cx={w * 0.47} cy={h * 0.86} rx={29} ry={28} fill={palette.blue} fillOpacity={0.06} stroke={palette.blue} strokeWidth={1.7} strokeDasharray="3 2" /><Path d={`M${w * 0.5} ${h * 0.74}V${h * 0.8}m-6-6 6 6 6-6`} stroke={palette.blue} strokeWidth={1.7} strokeLinecap="round" fill="none" /></>}
    {game.phase === 'aiming' && <Circle cx={held.x * w} cy={held.y * h} r={29} fill={palette.blue} fillOpacity={0.1} stroke={palette.blue} strokeOpacity={0.5} strokeWidth={1.5} />}
    {(game.phase === 'flight' || shotsRemaining(game) > 0) && <Path d={stoneShape} transform={`translate(${tip.x * w} ${tip.y * h})`} fill={palette.blue} stroke="white" strokeWidth={2.5} />}
  </Svg>;
}

function CaughtArt({ pigeon }: { pigeon: string }) {
  return <Svg width="100%" height="100%" viewBox="0 0 338 350" aria-hidden>
    <Ellipse cx={177} cy={309} rx={112} ry={9} fill="#17212B" fillOpacity={0.05} />
    <G transform="translate(-4 5)"><SvgXml xml={pigeonSvg(pigeon, 'cap')} width={338} height={350} /></G>
    <G transform="translate(217 239) rotate(-8)">
      <Rect y={4} width={88} height={62} rx={5} fill="#17212B" fillOpacity={0.04} />
      <Rect width={88} height={62} rx={5} fill="white" stroke="#C8D4E5" strokeWidth={1.3} />
      <Path d="m3 59 31-27m51 27L54 32" fill="none" stroke="#D5DFED" strokeWidth={1.3} />
      <Path d="m3 4 41 32L85 4" fill="none" stroke="#A8BBD6" strokeWidth={1.3} />
      <Circle cx={44} cy={36} r={7} fill={palette.blue} /><Path d="m41 36 2 2 4-5" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  </Svg>;
}

function EscapeArt({ pigeon }: { pigeon: string }) {
  return <Svg width="100%" height="100%" viewBox="0 0 390 280" preserveAspectRatio="xMidYMin meet" aria-hidden>
    <Path d="M-20 260C118 266 185 142 290 112" stroke="#C3D3EC" strokeWidth={1.8} strokeDasharray="3 11" fill="none" />
    <Path d="m289 88 17-7m14-13 18-8" stroke="#8B98AA" strokeWidth={1.7} strokeLinecap="round" />
    <G transform="translate(252 -34) rotate(-18 88 88)"><PigeonMarker name={pigeon} size={176} pose="up" /></G>
  </Svg>;
}

const styles = StyleSheet.create({
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  navTitle: { fontFamily: font.heading, fontSize: 20, color: palette.ink },
  pouch: { flexDirection: 'row', alignItems: 'center', width: 44, justifyContent: 'flex-end', gap: 7 },
  stoneCount: { fontFamily: font.system, fontSize: 15, fontWeight: '500', color: palette.ink },
  statusRow: { height: 38, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, gap: 8 },
  eyebrow: { flexShrink: 1, fontFamily: font.system, fontSize: 11, letterSpacing: 1.2, color: palette.secondary, fontWeight: '600' },
  shotDots: { flexDirection: 'row', gap: 7 },
  shotDot: { width: 9, height: 9, borderRadius: 5 },
  intro: { height: 146, flexShrink: 0, paddingHorizontal: 28, paddingTop: 27, gap: 14 },
  introTitle: { fontFamily: font.brand, fontSize: 35, lineHeight: 41, letterSpacing: -1.3, color: palette.ink },
  activeTitle: { fontFamily: font.heading, fontSize: 29, lineHeight: 35, letterSpacing: -1 },
  introCopy: { fontSize: 14, lineHeight: 23, color: palette.secondary },
  resultTitle: { fontFamily: font.brand, fontSize: 37, lineHeight: 43, letterSpacing: -1.4, color: palette.ink },
  resultCopy: { fontSize: 15, lineHeight: 27, color: palette.secondary },
  arena: { flex: 1, minHeight: 180, overflow: 'hidden' },
  leaving: { position: 'absolute', top: '33%', left: 28 },
  hint: { position: 'absolute', top: '78%', left: '65%', right: 12, gap: 14 },
  readyHint: { top: '83%', left: '57%' },
  hintTitle: { fontFamily: font.heading, fontSize: 23, lineHeight: 28, color: palette.blue },
  hintCopy: { fontFamily: font.system, fontSize: 12, lineHeight: 23, color: palette.secondary },
  accessibleShot: { alignItems: 'center', paddingTop: 8, backgroundColor: '#DCE7EF' },
  background: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  result: { flex: 1, paddingHorizontal: 28 },
  resultArt: { flex: 1, minHeight: 160 },
  escapeArt: { marginHorizontal: -28, maxHeight: 280 },
  resultWords: { gap: 14, paddingBottom: 30 },
  escapeWords: { flex: 1, gap: 18, paddingBottom: 20 },
  pouchNote: { fontSize: 13, lineHeight: 21, color: palette.secondary, marginTop: 4 },
  resultActions: { gap: 23 },
  footer: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: palette.secondary },
});
