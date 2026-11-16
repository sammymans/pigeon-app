import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ConvexError } from 'convex/values';
import { accessories, GUARD_PRICE, pointPacks, refillStones, STONE_INTERVAL, STONE_PRICE, TREAT_PRICE, wornBy, type Accessory, type ShopAction, type ShopBird, type ShopState } from '../src/shop';
import { Pigeon } from './Pigeon';
import { shopArtwork, type ShopArt } from './shopArtwork';
import { a, Copy, font, Icon, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './page03/atoms';

type Route = { screen: 'catalog' } | { screen: 'accessory'; item: Accessory } | { screen: 'treats' | 'guard' | 'stones' | 'points' | 'pigeon' };
type Props = {
  state: ShopState; birds: ShopBird[]; onBack: () => void;
  onAction: (action: ShopAction) => Promise<void>;
  onPreviewTopUp?: (points: number) => void;
  connected?: boolean; initialOwned?: boolean; initialScreen?: 'catalog' | 'stones';
};

export function ItemArt({ item, size = 128 }: { item: ShopArt; size?: number }) {
  return <View accessible={false}><SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 190">${shopArtwork[item]}</svg>`} width={size} height={size * 0.95} /></View>;
}

function Points({ value, plus = false, onPress }: { value: number | string; plus?: boolean; onPress?: () => void }) {
  const content = <><View style={styles.bolt}><Text style={styles.boltText}>ϟ</Text></View><Text style={[styles.pointsText, plus && { color: palette.ink }]}>{value}</Text>{plus && <Icon name="plus" color={palette.blue} size={15} />}</>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${value} points. Get more points`} onPress={onPress} style={[styles.points, { minHeight: 40 }]}>{content}</Pressable> : <View style={styles.points}>{content}</View>;
}

export function BirdPicker({ birds, selected, onSelect, state, wearing, label = 'Who should wear it?' }: { birds: ShopBird[]; selected: string; onSelect: (id: string) => void; state: ShopState; wearing?: string; label?: string }) {
  return <View style={{ gap: 12 }}><Copy>{label}</Copy><ScrollView horizontal nestedScrollEnabled directionalLockEnabled style={a.horizontalScroll} contentContainerStyle={{ gap: 10, paddingVertical: 3 }}>
    {birds.filter(bird => !bird.egg).map(bird => <Pressable key={bird.id} accessibilityRole="radio" accessibilityLabel={`Choose ${bird.name}${wearing === bird.id ? ', currently wearing' : ''}`} accessibilityState={{ checked: selected === bird.id }} onPress={() => onSelect(bird.id)} style={{ alignItems: 'center', width: 58, gap: 5 }}>
      <View style={[styles.birdThumb, selected === bird.id && { borderColor: palette.blue, borderWidth: 2 }]}><Pigeon name={bird.name} accessory={wornBy(state, bird.id)} size={54} /></View>
      <Text style={[a.small, { color: palette.ink, fontWeight: '600' }]}>{bird.name}</Text>
      <Text style={[a.small, { fontSize: 10, color: selected === bird.id ? palette.blue : palette.muted }]}>{selected === bird.id ? 'Selected' : wearing === bird.id ? 'Wearing' : ' '}</Text>
    </Pressable>)}
  </ScrollView></View>;
}

export function CoopShop({ state: input, birds: allBirds, onBack, onAction, onPreviewTopUp, connected = true, initialOwned = false, initialScreen = 'catalog' }: Props) {
  const [route, setRoute] = useState<Route>({ screen: initialScreen });
  const [pointsReturn, setPointsReturn] = useState<Route>({ screen: 'catalog' });
  const [ownedOnly, setOwnedOnly] = useState(initialOwned);
  const [selected, setSelected] = useState(allBirds.find(bird => !bird.egg)?.id ?? '');
  const [pack, setPack] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const pending = useRef(false);
  const insets = usePageInsets();
  const { width } = useWindowDimensions();
  const birds = allBirds.filter(bird => !bird.egg);
  const bird = birds.find(bird => bird.id === selected) ?? birds[0];
  const state = refillStones(input, now);
  const guarded = state.guardUntil > now;
  const guardMinutes = Math.max(1, Math.ceil((state.guardUntil - now) / 60000));
  const previewSize = Math.min(width - 150, 220);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  function navigate(next: Route) { if (pending.current) return; setMessage(''); setError(''); setRoute(next); }
  function back() {
    if (pending.current) return;
    if (route.screen === 'catalog' || (route.screen === 'stones' && initialScreen === 'stones')) onBack();
    else navigate(route.screen === 'points' ? pointsReturn : { screen: 'catalog' });
  }
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => listener.remove(); });
  function getPoints() { if (route.screen === 'points' || pending.current) return; setPointsReturn(route); navigate({ screen: 'points' }); }
  async function perform(action: ShopAction, success: string) {
    if (pending.current || !connected) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try { await onAction(action); setMessage(success); }
    catch (err) { setError(err instanceof ConvexError ? String(err.data) : onPreviewTopUp && err instanceof Error ? err.message : 'That change could not be confirmed. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  const title = route.screen === 'catalog' ? 'Coop shop' : route.screen === 'accessory' ? state.owned.includes(route.item) ? 'Your accessory' : 'Try it on' : route.screen === 'points' ? 'Get points' : route.screen === 'stones' ? 'Stone shop' : route.screen === 'treats' ? 'Tailwind treats' : route.screen === 'guard' ? 'Flock guard' : 'A little friend';
  let footer: React.ReactNode = null;
  let content: React.ReactNode;
  const unavailable = busy || !connected;
  const buyButton = (price: number, label: string, action: ShopAction, success: string, disabled = false) => <PrimaryButton label={busy ? 'One little moment…' : state.points < price && !disabled ? `Get points · ${price - state.points} more needed` : label} disabled={unavailable || disabled} onPress={state.points < price ? getPoints : () => void perform(action, success)} />;
  const heading = (text: string) => <Text accessibilityRole="header" style={styles.heroTitle}>{text}</Text>;
  const caption = (text: string) => <Copy style={styles.footerCaption}>{text}</Copy>;

  if (route.screen === 'catalog') {
    const capWearer = birds.find(bird => state.equipped.some(entry => entry.item === 'cap' && entry.birdId === bird.id));
    const showCap = !ownedOnly || state.owned.includes('cap');
    content = <>
      <View style={{ gap: 12 }}>{heading('Good things.\nFor your flock.')}<Copy>A little care for your little couriers.</Copy></View>
      <View style={a.between}><Text accessibilityRole="header" style={styles.sectionTitle}>Accessories</Text><Pressable accessibilityRole="button" accessibilityState={{ selected: ownedOnly }} accessibilityLabel={ownedOnly ? 'Show all shop items' : 'Show my items'} onPress={() => setOwnedOnly(!ownedOnly)} style={[styles.filter, ownedOnly && { backgroundColor: palette.pale }]}><Text style={styles.blueText}>{ownedOnly ? 'All items' : 'My items'} {ownedOnly ? '→' : '✓'}</Text></Pressable></View>
      <Copy style={{ marginTop: -13 }}>One accessory, one pigeon at a time.</Copy>
      {showCap && <Pressable accessibilityRole="button" accessibilityLabel="Sunday cap. Manage accessory" onPress={() => navigate({ screen: 'accessory', item: 'cap' })} style={styles.feature}>
        <View style={{ flex: 1, gap: 14, zIndex: 1 }}><Text style={styles.eyebrow}>{state.owned.includes('cap') ? '✓ OWNED' : 'A FLOCK FAVORITE'}</Text><Text style={styles.featureTitle}>Sunday{ '\n' }best.</Text><Copy>{capWearer ? `On ${capWearer.name}` : 'Not worn yet'}</Copy><View style={styles.smallButton}><Text style={styles.smallButtonText}>{state.owned.includes('cap') ? 'Manage' : 'Try it on'}</Text><Icon name="arrow" color="white" size={19} /></View></View>
        <View pointerEvents="none" style={styles.featureBird}><Pigeon name={capWearer?.name ?? 'Mochi'} accessory="cap" size={width < 360 ? 166 : 212} /></View>
      </Pressable>}
      <View style={styles.grid}>{accessories.filter(item => item.id !== 'cap' && (!ownedOnly || state.owned.includes(item.id))).map(item => {
        const owner = birds.find(bird => state.equipped.some(entry => entry.item === item.id && entry.birdId === bird.id));
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}, ${state.owned.includes(item.id) ? 'owned' : `${item.price} points`}`} onPress={() => navigate({ screen: 'accessory', item: item.id })} style={[styles.product, { backgroundColor: item.color }]}>
          {state.owned.includes(item.id) && <View style={styles.ownedCheck}><Icon name="check" color={palette.blue} size={15} /></View>}
          <ItemArt item={item.id} size={120} /><Text style={styles.productTitle}>{item.name}</Text><Copy style={[styles.productNote, state.owned.includes(item.id) && { color: palette.blue }]}>{owner ? `On ${owner.name}` : state.owned.includes(item.id) ? 'Owned · not worn' : `${item.price} points`}</Copy>
        </Pressable>;
      })}</View>
      <View style={{ gap: 10 }}><Text accessibilityRole="header" style={styles.sectionTitle}>Boosters</Text><Copy>A little help for the journey.</Copy></View>
      <View style={styles.grid}>
        {(!ownedOnly || state.treats > 0 || state.treatedBirds.length > 0) && <Pressable accessibilityRole="button" accessibilityLabel="Tailwind treats" onPress={() => navigate({ screen: 'treats' })} style={[styles.product, { backgroundColor: '#F4F2ED' }]}><ItemArt item="treats" size={112} /><Text style={styles.productTitle}>Tailwind treats</Text><Copy style={styles.productNote}>One bird · next flight</Copy><Copy style={styles.productNote}>10% less travel time</Copy><Text style={[styles.blueText, { textAlign: 'center' }]}>{state.treats ? `${state.treats} owned · Use →` : state.treatedBirds.length ? 'Ready for takeoff →' : `${TREAT_PRICE} points →`}</Text></Pressable>}
        {(!ownedOnly || guarded) && <Pressable accessibilityRole="button" accessibilityLabel="Flock guard" onPress={() => navigate({ screen: 'guard' })} style={[styles.product, { backgroundColor: palette.pale }]}><ItemArt item="guard" size={112} /><Text style={styles.productTitle}>Flock guard</Text><Copy style={styles.productNote}>All birds · 1 hour</Copy><Copy style={styles.productNote}>Harder to intercept</Copy><Text style={[styles.blueText, { textAlign: 'center' }]}>{guarded ? `Active · ${guardMinutes}m left` : `${GUARD_PRICE} points →`}</Text></Pressable>}
        {ownedOnly && !state.treats && !state.treatedBirds.length && !guarded && <Copy>No boosters yet. Find a little help in All items.</Copy>}
      </View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>The everyday essentials</Text>
      {!ownedOnly && <Pressable accessibilityRole="button" accessibilityLabel="One more little friend" onPress={() => navigate({ screen: 'pigeon' })} style={styles.essential}><Pigeon name="Mochi" size={48} /><View style={{ flex: 1, gap: 7 }}><Text style={styles.essentialTitle}>One more little friend</Text><Copy style={a.small}>Add a permanent pigeon</Copy></View><Text style={styles.comingSoon}>Soon</Text></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="A pocketful of stones" onPress={() => navigate({ screen: 'stones' })} style={styles.essential}><ItemArt item="stones" size={48} /><View style={{ flex: 1, gap: 7 }}><Text style={styles.essentialTitle}>A pocketful of stones</Text><Copy style={a.small}>{state.stones} in your pouch · get 5 more</Copy></View><Points value="50" /></Pressable>
      {onPreviewTopUp && <Copy style={styles.previewNote}>Design preview · purchases use sample points.</Copy>}
    </>;
  } else if (route.screen === 'accessory') {
    const item = accessories.find(item => item.id === route.item)!;
    const owned = state.owned.includes(item.id);
    const wearer = birds.find(bird => state.equipped.some(entry => entry.item === item.id && entry.birdId === bird.id));
    const wearing = wearer?.id === bird?.id && Boolean(bird);
    content = <>
      <View style={a.between}><Copy>Previewing on</Copy><Text style={styles.essentialTitle}>{bird?.name ?? 'Your pigeon'}</Text></View>
      <View style={styles.preview}><Text style={styles.previewTag}>PREVIEW</Text><Pigeon name={bird?.name ?? 'Button'} accessory={item.id} size={previewSize} /><View style={styles.shadow} /></View>
      <View style={a.between}><Text accessibilityRole="header" style={styles.detailTitle}>{item.name}</Text>{owned ? <Text style={styles.ownedBadge}>✓ Owned</Text> : <Points value={`${item.price} pts`} />}</View>
      <View style={{ gap: 8 }}><Copy>{owned && wearer ? `Currently worn by ${wearer.name}.` : item.description}</Copy><Copy>{owned ? 'Move it to another pigeon whenever you like.' : 'One purchase. One pigeon wears it at a time.'}</Copy></View>
      {birds.length ? <BirdPicker birds={birds} selected={bird.id} onSelect={setSelected} state={state} wearing={wearer?.id} /> : <Copy>Your flock needs a pigeon before you can dress one.</Copy>}
    </>;
    const label = wearing ? `Take off ${bird?.name}` : owned ? wearer ? `Move from ${wearer.name} to ${bird?.name}` : `Put on ${bird?.name}` : `Buy & put on ${bird?.name} · ${item.price} pts`;
    footer = <>{buyButton(owned ? 0 : item.price, label, wearing ? { type: 'remove', item: item.id } : { type: 'accessory', item: item.id, birdId: bird?.id ?? '' }, wearing ? `${item.name} is back in your items.` : `${bird?.name} is wearing the ${item.name.toLowerCase()}.`, !bird)}{caption(owned ? wearing ? 'It stays in My items, ready for another day.' : wearer ? `${wearer.name} will take it off. ${bird?.name} will put it on.` : 'Already yours. No points needed.' : state.points < item.price ? `${item.price - state.points} more points needed.` : `${state.points} points → ${state.points - item.price} points after purchase`)}</>;
  } else if (route.screen === 'points') {
    const chosen = pointPacks[pack];
    content = <>
      {heading('Pocket some\npossibilities.')}<Copy>Outfits, treats, boosts & stones.</Copy>
      <View style={styles.balance}><Text style={styles.balanceLabel}>YOUR BALANCE</Text><View style={[a.row, { gap: 10 }]}><View style={styles.bolt}><Text style={styles.boltText}>ϟ</Text></View><Text style={styles.detailTitle}>{state.points}</Text><Copy>points</Copy></View><Copy style={a.small}>Earn 5 points each time you send a letter.</Copy></View>
      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>{pointPacks.map((item, index) => <Pressable key={item.points} accessibilityRole="radio" accessibilityLabel={`${item.points} points for ${item.price}`} accessibilityState={{ checked: pack === index }} onPress={() => setPack(index)} style={[styles.pack, index === pack && { borderColor: palette.blue, backgroundColor: '#F5F6FF' }]}><View style={[styles.radio, index === pack && { borderColor: palette.blue }]}>{index === pack && <View style={styles.radioDot} />}</View><View style={{ flex: 1, gap: 5 }}><Text style={styles.essentialTitle}>{item.points.toLocaleString()} points</Text><Copy style={a.small}>{item.note}</Copy></View><Text style={styles.essentialTitle}>{item.price}</Text></Pressable>)}</View>
      <View style={a.between}><Copy>Balance after purchase</Copy><Text style={styles.essentialTitle}>{state.points + chosen.points} points</Text></View>
      {!onPreviewTopUp && <Copy>Point top-ups aren’t available yet. You can still earn points by sending letters.</Copy>}
    </>;
    footer = <><PrimaryButton label={onPreviewTopUp ? `Try ${chosen.points} sample points` : 'Top-ups coming soon'} disabled={!onPreviewTopUp || unavailable} onPress={() => { onPreviewTopUp?.(chosen.points); navigate(pointsReturn); setMessage('Sample points added. Confirm your item when you’re ready.'); }} />{caption(onPreviewTopUp ? 'Preview only. No payment or real charge.' : 'One-time purchases will appear here when available.')}</>;
  } else if (route.screen === 'stones') {
    const seconds = Math.max(0, Math.ceil((state.stoneAt + STONE_INTERVAL - now) / 1000));
    content = <>
      {heading('A few more chances\nto say hi.')}<Copy>{state.stones ? `${state.stones} stones in your pouch. Room for a few more.` : 'Your pouch is empty. Let’s fix that.'}</Copy>
      <View style={[styles.preview, { paddingVertical: 30 }]}><ItemArt item="stones" size={210} /><View style={[a.row, { gap: 12 }]}><Text style={styles.detailTitle}>5 stones</Text><Points value="50" /></View><Copy style={{ textAlign: 'center' }}>Five more shots at a chance encounter.</Copy></View>
      <View style={a.between}><View style={{ gap: 6, flex: 1 }}><Text style={styles.essentialTitle}>{state.stones >= 5 ? 'Your pouch is looking good.' : 'Or wait for a free stone'}</Text><Copy style={a.small}>One free stone every 15 min, up to 5.</Copy></View>{state.stones < 5 && <Text style={styles.blueText}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text>}</View>
    </>;
    footer = <>{buyButton(STONE_PRICE, 'Get 5 stones · 50 pts', { type: 'stones' }, 'Five stones added to your pouch.')}{caption(state.points < STONE_PRICE ? `${STONE_PRICE - state.points} more points needed.` : `${state.points} points → ${state.points - STONE_PRICE} points after purchase`)}</>;
  } else if (route.screen === 'treats') {
    const queued = Boolean(bird && state.treatedBirds.includes(bird.id));
    content = <>{heading('A little pick-me-up.')}<Copy>Something good for the journey ahead.</Copy><View style={styles.preview}><ItemArt item="treats" size={180} /><Text style={styles.ownedBadge}>{state.treats} owned</Text></View><Text style={styles.detailTitle}>Tailwind treats</Text><Copy>Give one pigeon a treat to take 10% off its next flight’s travel time. It stays ready until that pigeon takes off.</Copy>{birds.length > 0 && <BirdPicker label="Who gets a little treat?" birds={birds} selected={bird.id} onSelect={setSelected} state={state} />}<Pressable accessibilityRole="button" accessibilityLabel="Buy one tailwind treat" disabled={unavailable} onPress={() => state.points < TREAT_PRICE ? getPoints() : void perform({ type: 'buyTreat' }, 'One more treat in your pocket.')} style={styles.pack}><Text style={[styles.essentialTitle, { flex: 1 }]}>Pick up one more treat</Text><Points value={`${TREAT_PRICE} pts`} /></Pressable></>;
    footer = <><PrimaryButton label={busy ? 'One little moment…' : queued ? `${bird?.name} is ready for takeoff` : state.treats ? `Give a treat to ${bird?.name}` : 'Pick up a treat above'} disabled={unavailable || !bird || queued || state.treats === 0} onPress={() => void perform({ type: 'treat', birdId: bird.id }, `${bird.name}’s next flight has a little tailwind.`)} />{caption('One treat, one bird, one future flight.')}</>;
  } else if (route.screen === 'guard') {
    content = <>{heading('A little peace\nof mind.')}<Copy>Keep your whole flock under one wing.</Copy><View style={styles.preview}><ItemArt item="guard" size={190} /><Text style={styles.ownedBadge}>{guarded ? `Active · ${guardMinutes}m left` : 'ALL YOUR PIGEONS'}</Text></View><Text style={styles.detailTitle}>Flock guard</Text><Copy>For one hour, catching any of your pigeons takes three successful hits instead of two. It covers birds already flying and any that take off while it’s active.</Copy><Copy>Your pigeons can still be intercepted. Every little bit helps.</Copy></>;
    footer = <>{buyButton(GUARD_PRICE, guarded ? `Protecting your flock · ${guardMinutes}m left` : `Activate for 1 hour · ${GUARD_PRICE} pts`, { type: 'guard' }, 'Flock guard is protecting all your pigeons for one hour.', guarded)}{caption(guarded ? 'Already active. You won’t be charged again.' : 'The hour begins when you activate it.')}</>;
  } else {
    content = <>{heading('Room for one\nmore little friend.')}<View style={styles.preview}><Pigeon name="Mochi" size={previewSize} /></View><Copy>A new pigeon to make your flock a little bigger. Permanent pigeon purchases are coming soon.</Copy><Copy>Your existing flock is ready to keep sending hellos.</Copy></>;
    footer = <PrimaryButton label="Back to the coop shop" onPress={() => navigate({ screen: 'catalog' })} />;
  }

  return <PageFrame style={{ paddingTop: insets.top }}>
    <View style={styles.header}><IconButton name="back" label={route.screen === 'stones' && initialScreen === 'stones' ? 'Back to sky' : route.screen === 'catalog' ? 'Back to your flock' : route.screen === 'points' ? 'Back to selected item' : 'Back to coop shop'} onPress={back} disabled={busy} /><Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text><Points value={state.points} plus onPress={getPoints} /></View>
    {!connected && <Text accessibilityRole="alert" style={styles.status}>Reconnect to make changes to your flock.</Text>}
    {error ? <Text accessibilityRole="alert" style={[styles.status, { color: '#AE3046' }]}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text> : null}
    <ScrollView style={a.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" key={`${route.screen}${route.screen === 'accessory' ? route.item : ''}`} contentContainerStyle={[styles.content, { paddingBottom: footer ? 26 : insets.bottom + 20 }]}>{content}</ScrollView>
    {footer && <View style={[styles.footer, { paddingBottom: insets.bottom }]}>{footer}</View>}
  </PageFrame>;
}

const styles = StyleSheet.create({
  header: { flexShrink: 0, height: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontFamily: font.heading, color: '#080B0F', fontSize: 20, flex: 1, textAlign: 'center', marginLeft: -2 },
  content: { paddingHorizontal: 24, paddingTop: 22, gap: 20 },
  heroTitle: { fontFamily: font.heading, fontSize: 34, lineHeight: 39, letterSpacing: -1.4, color: '#05070A' },
  sectionTitle: { fontFamily: font.heading, fontSize: 23, lineHeight: 29, letterSpacing: -0.5, color: palette.ink },
  detailTitle: { fontFamily: font.heading, fontSize: 29, lineHeight: 35, letterSpacing: -0.8, color: '#05070A', flexShrink: 1 },
  filter: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20 },
  blueText: { fontFamily: font.system, fontSize: 13, lineHeight: 19, fontWeight: '600', color: palette.blue },
  points: { alignSelf: 'center', paddingVertical: 7, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, backgroundColor: palette.pale },
  pointsText: { fontFamily: font.system, fontSize: 13, fontWeight: '600', color: palette.blue },
  bolt: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  boltText: { fontSize: 17, lineHeight: 18, fontWeight: '800', color: 'white' },
  feature: { minHeight: 230, padding: 22, borderRadius: 25, backgroundColor: palette.water, overflow: 'hidden', justifyContent: 'center' },
  featureTitle: { fontFamily: font.heading, fontSize: 29, lineHeight: 32, letterSpacing: -0.9, color: '#05070A' },
  featureBird: { position: 'absolute', right: -23, bottom: 0 },
  eyebrow: { fontFamily: font.system, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, color: palette.blue },
  smallButton: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', backgroundColor: palette.blue, borderRadius: 24, paddingHorizontal: 18, height: 43, marginTop: 10 },
  smallButtonText: { fontFamily: font.system, color: 'white', fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  product: { flexGrow: 1, flexBasis: '44%', paddingHorizontal: 10, paddingVertical: 18, borderRadius: 20, alignItems: 'center', gap: 12, minWidth: 130 },
  productTitle: { fontFamily: font.system, fontWeight: '600', fontSize: 14, lineHeight: 20, textAlign: 'center', color: palette.ink },
  productNote: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  ownedCheck: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  essential: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 86, paddingBottom: 20, borderBottomWidth: 1, borderColor: '#E8EDF4' },
  essentialTitle: { fontFamily: font.system, fontSize: 15, lineHeight: 21, fontWeight: '600', color: palette.ink },
  comingSoon: { fontFamily: font.system, fontSize: 12, color: palette.muted, borderRadius: 18, backgroundColor: '#F4F6F9', padding: 10 },
  preview: { borderRadius: 26, backgroundColor: palette.water, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16, overflow: 'hidden' },
  previewTag: { position: 'absolute', top: 18, left: 18, zIndex: 1, borderRadius: 15, backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 6, fontFamily: font.system, fontSize: 9, fontWeight: '600', letterSpacing: 1.4, color: palette.muted },
  shadow: { marginTop: -17, width: '65%', height: 13, borderRadius: '50%', backgroundColor: '#DCE6EF' },
  ownedBadge: { fontFamily: font.system, fontSize: 12, lineHeight: 18, fontWeight: '600', color: palette.blue, backgroundColor: palette.pale, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  birdThumb: { width: 58, height: 58, borderRadius: 17, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  footer: { flexShrink: 0, paddingHorizontal: 24, paddingTop: 12, gap: 12, backgroundColor: 'white' },
  footerCaption: { fontSize: 11, lineHeight: 16, color: palette.muted, textAlign: 'center' },
  balance: { backgroundColor: palette.water, borderRadius: 24, padding: 22, gap: 14 },
  balanceLabel: { fontFamily: font.system, fontWeight: '600', fontSize: 10, letterSpacing: 1.5, color: palette.muted },
  pack: { minHeight: 76, padding: 16, borderWidth: 1.5, borderColor: palette.line, borderRadius: 20, flexDirection: 'row', gap: 14, alignItems: 'center' },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: '#B4C3D5', padding: 3 },
  radioDot: { flex: 1, backgroundColor: palette.blue, borderRadius: 8 },
  status: { fontFamily: font.system, fontSize: 12, lineHeight: 18, paddingHorizontal: 24, paddingVertical: 10, color: palette.blue, backgroundColor: '#F4F6FF' },
  previewNote: { fontSize: 11, lineHeight: 16, color: palette.muted, textAlign: 'center' },
});
