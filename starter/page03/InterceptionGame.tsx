import { useEffect, useRef, useState } from 'react';
import { AppState, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { advanceGame, beginAim, cancelAim, createGame, gameDeadline, makeShot, MAX_SHOTS, moveAim, pigeonPosition, releaseShot, SLING, stonePosition, type InterceptionGame as Game, type Point } from '../../src/interception';
import { a, Copy, font, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';

export function Stone({ size = 16 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 20 20" aria-hidden><Path d="m3 4 8-3 6 5-2 10-9 2-5-8Z" fill={palette.blue} /></Svg>;
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
      return ['ready', 'miss'].includes(current.current.phase) && current.current.shots < MAX_SHOTS && current.current.stones > 0
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
  const remaining = Math.max(0, Math.ceil((gameDeadline(game) - game.now) / 1000));
  const time = `0:${String(remaining).padStart(2, '0')}`;
  const canShoot = ['ready', 'miss', 'aiming'].includes(game.phase) && game.shots < MAX_SHOTS && game.stones > 0;
  const status = game.phase === 'caught' ? `${game.shots === 1 ? 'FIRST' : 'SECOND'} SHOT · RIGHT ON TARGET`
    : game.phase === 'escaped' ? game.escapeReason === 'shots' ? 'TWO SHOTS USED' : game.escapeReason === 'stones' ? 'POUCH EMPTY' : 'OUT OF TIME'
    : game.phase === 'flight' ? `SHOT ${game.shots} IN FLIGHT` : game.phase === 'aiming' ? `SHOT ${game.shots + 1} OF 2`
    : game.phase === 'miss' ? game.shots < 2 && game.stones > 0 ? 'ONE SHOT LEFT' : 'NO SHOTS LEFT' : 'TWO SHOTS AT THIS PIGEON';
  const title = game.phase === 'ready' ? 'Pull back.\nAim ahead. Let go.' : game.phase === 'aiming' ? 'Aim where it’s going.' : game.phase === 'flight' ? 'There it goes.' : 'Just behind.';
  const description = game.phase === 'ready' ? 'One hit catches the letter.' : game.phase === 'aiming' ? 'Let the pigeon fly into your shot.' : game.phase === 'flight' ? 'Watch the arc.' : canShoot ? 'Aim a little further ahead.\nYou have one shot left.' : 'That was your last stone at this pigeon.';

  // A keyboard/screen-reader alternative uses the same physics and still needs timing.
  function accessibleShot() {
    if (!canShoot) return;
    update(releaseShot(moveAim(beginAim(current.current, Date.now()), { x: 0, y: 0.18 }), Date.now()));
  }

  return <PageFrame style={{ paddingTop: insets.top, backgroundColor: '#F6F9FC' }}>
    <View style={styles.header}>
      <IconButton name="close" label="Leave interception and return to sky" onPress={onClose} />
      <Text style={styles.navTitle}>{done ? game.phase === 'caught' ? 'Caught' : 'Escaped' : game.deadline ? time : 'Slingshot'}</Text>
      <View accessibilityLabel={`${game.stones} stones in your pouch`} style={[a.row, { width: 44, justifyContent: 'flex-end', gap: 6 }]}><Stone size={15} /><Text style={styles.stoneCount}>{game.stones}</Text></View>
    </View>
    <View style={styles.statusRow}><Text accessibilityLiveRegion="polite" style={styles.eyebrow}>{status}</Text><View accessibilityLabel={`${done ? 0 : Math.max(0, 2 - game.shots)} shots left`} style={[a.row, { gap: 7 }]}>{[0, 1].map(index => <View key={index} style={[styles.shotDot, { backgroundColor: done || index < game.shots ? '#CAD5E7' : palette.blue }]} />)}</View></View>
    {done ? <View style={[styles.result, { paddingBottom: insets.bottom }]}>
      <View style={styles.resultArt}>{game.phase === 'caught' ? <><Text style={styles.bonk}>BONK.</Text><View style={{ flex: 1 }}><CaughtArt /></View></> : <EscapeArt />}</View>
      <View style={{ gap: 14, marginBottom: 28 }}><Text accessibilityRole="header" style={styles.resultTitle}>{game.phase === 'caught' ? 'You caught it.' : 'That pigeon had\nplaces to be.'}</Text><Copy style={styles.resultCopy}>{game.phase === 'caught' ? 'A stranger’s letter.\nAnd a very unexpected introduction.' : `${game.escapeReason === 'shots' ? 'Two shots. No catch.' : game.escapeReason === 'stones' ? 'No more stones. No catch.' : 'Time flew. So did the pigeon.'}\nThe letter stays sealed.`}</Copy>{game.phase === 'escaped' && <Copy style={[a.small, { marginTop: 12 }]}>{game.stones > 0 ? `Your other ${game.stones} ${game.stones === 1 ? 'stone is' : 'stones are'} still in your pouch.` : 'Your pouch is empty. Time for a little break.'}</Copy>}</View>
      <PrimaryButton label={game.phase === 'caught' ? 'Open letter' : 'Back to sky'} onPress={game.phase === 'caught' ? onOpenLetter : onClose} />
      <Copy style={styles.footer}>{game.phase === 'caught' ? `${pigeon} brought you a very unexpected hello.` : 'Another pigeon. Another chance.'}</Copy>
    </View> : <>
      <View style={styles.intro}><Text accessibilityRole="header" style={[styles.resultTitle, game.phase !== 'ready' && { fontSize: 28, lineHeight: 33 }]}>{title}</Text><Copy style={styles.resultCopy}>{description}</Copy></View>
      <View {...responder.panHandlers} style={[styles.arena, Platform.OS === 'web' && { touchAction: 'none', userSelect: 'none' } as object]} onLayout={event => { layout.current = event.nativeEvent.layout; setSize(event.nativeEvent.layout); }}>
        <Arena game={game} width={size.width} height={size.height} />
        <View pointerEvents="none" style={{ position: 'absolute', top: '40%', left: 26 }}><Text style={[a.small, { fontSize: 11 }]}>{game.phase === 'ready' ? `Leaving your sky in ${time}` : ''}</Text></View>
        <View pointerEvents="none" style={{ position: 'absolute', top: '79%', left: '69%', right: 14, gap: 5 }}><Text style={styles.hintTitle}>{game.phase === 'aiming' ? 'Let go.' : game.phase === 'flight' ? '−1 stone' : game.phase === 'miss' ? canShoot ? 'One more.' : 'So close.' : ''}</Text><Text style={[a.small, { fontSize: 11, lineHeight: 16 }]}>{game.phase === 'aiming' ? '1 stone\nwhen you fire' : game.phase === 'flight' ? `${game.stones} in your pouch` : game.phase === 'miss' ? canShoot ? 'Pull to aim\nyour last shot' : 'Still on the wing' : 'Drag the\nblue stone'}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Fire a straight shot. Time it as the pigeon crosses the center." disabled={!canShoot} onPress={accessibleShot} style={[styles.accessibleShot, { paddingBottom: Math.max(12, insets.bottom / 2) }]}><Text style={[a.small, { fontSize: 10, opacity: canShoot ? 0.8 : 0.4 }]}>Or tap here to fire straight ↑</Text></Pressable>
    </>}
  </PageFrame>;
}

function Arena({ game, width: w, height: h }: { game: Game; width: number; height: number }) {
  const p = pigeonPosition(game.now - game.enteredAt);
  const direction = Math.cos((game.now - game.enteredAt) / 1300 + 0.5) >= 0 ? 1 : -1;
  const held = { x: SLING.x + game.pull.x, y: SLING.y + game.pull.y };
  const tip = game.shot ? stonePosition(game.shot, game.now) : held;
  const trajectory = game.phase === 'aiming' && game.pull.y > 0.035 ? makeShot(game.pull, game.now) : game.shot;
  const path = (points: Point[]) => points.map((point, index) => `${index ? 'L' : 'M'}${point.x * w} ${point.y * h}`).join(' ');
  const trail = trajectory ? Array.from({ length: 28 }, (_, index) => stonePosition(trajectory, trajectory.firedAt + index / 27 * (game.phase === 'aiming' ? 900 : Math.min(1800, game.now - trajectory.firedAt)))) : [];
  const stoneShape = 'm-8 -5 8-5 9 5-2 10-9 3-8-6Z';
  return <Svg pointerEvents="none" aria-hidden width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
    <Defs><LinearGradient id="game-sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="white" /><Stop offset="1" stopColor="#EDF4F8" /></LinearGradient></Defs>
    <Rect width={w} height={h} fill="url(#game-sky)" />
    <Path d={`M0 3h48m-20 9h36M${w - 62} ${h * 0.42}h62M0 ${h * 0.6}h32`} stroke="#C6D5E8" strokeWidth={1.5} fill="none" />
    <Path d={`M0 ${h - 22} ${w * 0.15} ${h - 52} ${w * 0.25} ${h - 30} ${w * 0.42} ${h - 56} ${w * 0.56} ${h - 29} ${w * 0.67} ${h - 49} ${w * 0.81} ${h - 18} ${w * 0.92} ${h - 38} ${w} ${h - 18}V${h}H0Z`} fill="#DCE7EF" />
    <G transform={`translate(${p.x * w} ${p.y * h})`}>
      {/* Keep signed coordinates separate: a literal minus before a negative value crashes the native SVG parser. */}
      <Path d={`M${-direction * 35} -5h${-direction * 20}m${direction * 3} 10h${direction * 15}M${direction * 32} -15h${direction * 12}m${-direction * 4} -4 ${direction * 4} 4 ${-direction * 4} 4`} fill="none" stroke="#8597B3" strokeWidth={1.5} />
      <Circle r={26} fill={palette.blue} stroke="white" strokeWidth={3} />
    </G>
    {trail.length > 0 && <Path d={path(trail)} fill="none" stroke={palette.blue} strokeOpacity={game.phase === 'aiming' ? 0.8 : 0.5} strokeWidth={1.5} strokeDasharray="3 8" />}
    <Path d={`M${w * 0.5} ${h - 12}V${h * 0.84}M${w * 0.5} ${h * 0.84} ${w * 0.37} ${h * 0.72}M${w * 0.5} ${h * 0.84} ${w * 0.63} ${h * 0.72}`} stroke="#596679" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {game.phase === 'flight' ? <Path d={`M${w * 0.37} ${h * 0.72}Q${w * 0.5} ${h * 0.68} ${w * 0.63} ${h * 0.72}`} stroke={palette.blue} strokeWidth={4} fill="none" /> : <Path d={`M${w * 0.37} ${h * 0.72} ${held.x * w} ${held.y * h} ${w * 0.63} ${h * 0.72}`} stroke={palette.blue} strokeWidth={4} fill="none" />}
    {game.phase === 'ready' && <><Circle cx={w * 0.5} cy={h * 0.76} r={29} fill={palette.blue} fillOpacity={0.04} stroke={palette.blue} strokeWidth={1} strokeDasharray="3 3" /><Path d={`M${w * 0.5} ${h * 0.76 + 20}v34m-5-5 5 5 5-5`} stroke={palette.blue} strokeWidth={1.3} fill="none" /></>}
    {game.phase === 'aiming' && <Circle cx={held.x * w} cy={held.y * h} r={29} fill={palette.blue} fillOpacity={0.08} stroke={palette.blue} strokeOpacity={0.5} />}
    <Path d={stoneShape} transform={`translate(${tip.x * w} ${tip.y * h})`} fill={palette.blue} stroke="white" strokeWidth={2} />
  </Svg>;
}

function CaughtArt() {
  return <Svg width="100%" height="100%" viewBox="0 0 330 250" aria-hidden>
    <Path d="m165 24 17 49 42-32-11 55 57-4-42 36 52 24-59 7 13 56-42-36-25 50-17-52-42 31 7-51-54 4 39-36-43-30 55 4-6-55 35 35Z" fill="#EDF2FF" stroke={palette.blue} strokeWidth={1.5} />
    <Circle cx={166} cy={124} r={34} fill={palette.blue} stroke="white" strokeWidth={4} />
    <G transform="translate(188 183) rotate(12)"><Rect width={68} height={45} rx={5} fill="white" stroke="#91A8FF" /><Path d="m2 4 32 22 32-22M2 43l24-21m40 21L42 22" fill="none" stroke={palette.blue} strokeWidth={1.5} /></G>
    <Path d="m108 25 4 12 12 4-12 4-4 12-4-12-12-4 12-4Zm156 168 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill={palette.blue} />
  </Svg>;
}

function EscapeArt() {
  return <Svg width="100%" height="100%" viewBox="0 0 330 250" aria-hidden><Path d="M-30 238C100 240 180 155 300 56" stroke="#A8BDF8" strokeDasharray="3 10" fill="none" /><Circle cx={235} cy={116} r={17} fill="#DCE5F8" /><Circle cx={269} cy={95} r={22} fill="#A7BAE9" /><Circle cx={310} cy={75} r={28} fill={palette.blue} /><Path d="m325 32 8-8m3 39h10" stroke={palette.blue} /></Svg>;
}

const styles = StyleSheet.create({
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, backgroundColor: 'white' },
  navTitle: { fontFamily: font.heading, fontSize: 19, color: palette.ink },
  stoneCount: { fontFamily: font.system, fontSize: 14, color: palette.ink },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, paddingTop: 14, paddingBottom: 20, backgroundColor: 'white' },
  eyebrow: { fontFamily: font.system, fontSize: 10, letterSpacing: 1.1, color: '#435576', fontWeight: '600' },
  shotDot: { width: 8, height: 8, borderRadius: 4 },
  intro: { minHeight: 135, paddingHorizontal: 28, paddingTop: 18, paddingBottom: 12, gap: 12, backgroundColor: 'white' },
  resultTitle: { fontFamily: font.heading, fontSize: 34, lineHeight: 36, letterSpacing: -1.1, color: palette.ink },
  resultCopy: { fontSize: 14, lineHeight: 23, color: '#5B6B83' },
  arena: { flex: 1, minHeight: 220, overflow: 'hidden' },
  hintTitle: { fontFamily: font.heading, fontSize: 20, color: palette.blue },
  accessibleShot: { alignItems: 'center', paddingTop: 8, backgroundColor: '#DCE7EF' },
  result: { flex: 1, paddingHorizontal: 26 },
  resultArt: { flex: 1, minHeight: 180, marginBottom: 18, position: 'relative' },
  bonk: { fontFamily: font.brand, fontSize: 82, lineHeight: 98, letterSpacing: -5, color: palette.blue, transform: [{ rotate: '-7deg' }], zIndex: 1 },
  footer: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 18 },
});
