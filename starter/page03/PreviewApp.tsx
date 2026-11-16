import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import { a, Copy, Handle, IconButton, PrimaryButton, usePageInsets } from './atoms';
import { FlockSheet, HomeSheet, MapScreen, SentSheet, type FlockBird } from './MapScreen';
import { CoopShop } from '../CoopShop';
import { applyShopAction, initialShop, refillStones, wornBy, type ShopState } from '../../src/shop';
import { skyMapData } from './mapData';
import { sampleFlights, sampleFlock } from './previewData';
import { blankPreviewDraft, PreviewMessaging, previewDestination, type PreviewDraft } from './PreviewMessaging';
import { sampleLetters } from './previewMail';
import { isUnopened, type MailPerson } from '../mailboxModel';
import { usePreviewInterception, WorldSkySheet } from './PreviewInterception';

type Screen = 'home' | 'flock' | 'compose' | 'sent' | 'hatchery' | 'shop' | 'inbox' | 'settings';

// Local design sandbox. No account, cloud mutations, or real messages are created.
export function PreviewApp({ senderName = 'You', initialScreen = 'home', initialFlock = sampleFlock, onRestartOnboarding }: { senderName?: string; initialScreen?: 'home' | 'compose'; initialFlock?: FlockBird[]; onRestartOnboarding?: () => void } = {}) {
  const [shop, setShop] = useState(() => initialShop(Date.now(), initialFlock[0]?.id));
  const shopRef = useRef(shop);
  const updateShop = (value: ShopState) => { shopRef.current = value; setShop(value); };
  const [shopEntry, setShopEntry] = useState<'catalog' | 'stones'>('catalog');
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [scope, setScope] = useState<'mine' | 'world'>('mine');
  const [birds, setBirds] = useState<FlockBird[]>(initialFlock);
  const [flights, setFlights] = useState(() => sampleFlights(Date.now()));
  const [selectedBird, setSelectedBird] = useState(initialFlock.find(bird => bird.status === 'Ready')?.id ?? '');
  const [selectedFlight, setSelectedFlight] = useState<string | null>('dot-flight');
  const [letters, setLetters] = useState(() => sampleLetters(Date.now()));
  const [draft, setDraft] = useState<PreviewDraft>(() => ({ ...blankPreviewDraft, pigeonId: initialFlock.find(bird => bird.status === 'Ready')?.id ?? '' }));
  const [lastSent, setLastSent] = useState({ name: '', courier: '' });
  const [now, setNow] = useState(Date.now);
  const interception = usePreviewInterception(refillStones(shop, now).stones, () => { const refilled = refillStones(shopRef.current, Date.now()); updateShop({ ...refilled, stones: Math.max(0, refilled.stones - 1) }); }, letter => setLetters(previous => [...previous, { ...letter, direction: 'incoming', state: 'intercepted', arrivesAt: letter.at, caught: true, opened: false, replyBy: letter.at + 30 * 60_000 }]), () => openStoneShop(), id => setLetters(previous => previous.map(letter => letter.id === id ? { ...letter, opened: true } : letter)));
  const insets = usePageInsets();
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(interval); }, []);
  const ready = birds.filter(bird => bird.status === 'Ready').length;
  const unopened = letters.filter(isUnopened).length;
  const sent = flights.filter(flight => flight.role === 'sender').length;
  const incoming = flights.filter(flight => flight.role === 'recipient').length;

  function openStoneShop() { interception.clear(); setShopEntry('stones'); setScreen('shop'); }

  function reset() {
    interception.reset();
    updateShop(initialShop(Date.now(), initialFlock[0]?.id)); setBirds(initialFlock); setFlights(sampleFlights(Date.now())); setSelectedBird(initialFlock.find(bird => bird.status === 'Ready')?.id ?? ''); setSelectedFlight('dot-flight'); setDraft(blankPreviewDraft); setLetters(sampleLetters(Date.now())); setScreen('home'); setScope('mine');
    onRestartOnboarding?.();
  }

  function sendPreview(person: MailPerson, courier: string, pigeonId?: string) {
    if (!draft.body.trim() || Array.from(draft.body).length > 500) return;
    const origin = cityById('new-york');
    const at = Date.now();
    const destination = previewDestination(person);
    const flight: FlightSummary = { id: `preview-${at}`, courier, origin, destination, role: 'sender', visibility: 'open', defense: 'cruise', outfit: 'classic', state: 'in_flight', demo: true, attemptCount: 0, distanceKm: distanceKm(origin, destination), departedAt: at, arrivesAt: at + 14_400_000 * (pigeonId && shop.treatedBirds.includes(pigeonId) ? 0.9 : 1) };
    updateShop({ ...shopRef.current, points: shopRef.current.points + 5, treatedBirds: shopRef.current.treatedBirds.filter(id => id !== pigeonId) });
    setFlights(previous => [flight, ...previous]);
    setLetters(previous => [...previous.map(letter => letter.id === draft.replyId ? { ...letter, replyBy: at } : letter), { id: flight.id, personId: person.id, direction: 'outgoing', state: 'in_flight', at, arrivesAt: flight.arrivesAt, courier, opened: true, body: draft.body, signature: draft.hideName ? 'Someone' : senderName }]);
    if (pigeonId) setBirds(previous => previous.map(item => item.id === pigeonId ? { ...item, status: 'Flying', color: '#C8D4E5' } : item));
    setLastSent({ name: person.name, courier });
    setSelectedFlight(flight.id); setNow(at); setDraft(blankPreviewDraft); setScope('mine'); setScreen('sent');
  }

  if (screen === 'shop') return <CoopShop initialScreen={shopEntry} state={shop} birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} onBack={() => setScreen(shopEntry === 'stones' ? 'home' : 'flock')} onAction={async action => { updateShop(applyShopAction(shopRef.current, action, birds, Date.now())); if (action.type === 'stones' && shopEntry === 'stones') setScreen('home'); }} onPreviewTopUp={points => updateShop({ ...shopRef.current, points: shopRef.current.points + points })} />;

  if (screen === 'inbox' || screen === 'compose') return <PreviewMessaging senderName={senderName} letters={letters} birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} draft={draft} now={now} initialCompose={screen === 'compose'} onDraft={setDraft} onOpened={id => setLetters(previous => previous.map(letter => letter.id === id ? { ...letter, opened: true } : letter))} onClose={() => setScreen('home')} onSend={sendPreview} />;

  if (interception.surface) return interception.surface;
  const mapFlights = scope === 'world' ? interception.worldFlights : flights;
  const selectFlight = (id: string) => { const flight = mapFlights.find(item => item.id === id); if (flight) { setSelectedFlight(id); setScreen('home'); interception.select(flight); } };
  const sheetHeight = interception.sheet && screen === 'home' ? 300 : screen === 'flock' ? 514 : screen === 'sent' ? 250 : screen === 'home' ? scope === 'world' ? 210 : 182 : 360;
  return <MapScreen unopened={unopened} map={skyMapData(mapFlights, selectedFlight, now)} scope={scope} onScope={value => { interception.clear(); setScope(value); setSelectedFlight(null); setScreen('home'); }} onMenu={() => { interception.clear(); setScreen('settings'); }} onInbox={() => { interception.clear(); setScreen('inbox'); }} onCoop={() => { interception.clear(); setScreen('flock'); }} onSelect={selectFlight} sheetHeight={sheetHeight}>
    {screen === 'home' && (interception.sheet ?? (scope === 'world' ? <WorldSkySheet flights={interception.worldFlights} stones={interception.stones} onGetStones={openStoneShop} onSelect={flight => selectFlight(flight.id)} /> : <HomeSheet title={`${flights.length} flights in your sky`} subtitle={`${sent} sent · ${incoming} on its way to you`} ready={`${ready} ready`} action="Send a pigeon" onExpand={() => setScreen('flock')} onSend={() => setScreen('flock')} />))}
    {screen === 'flock' && <FlockSheet birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} selected={selectedBird} summary={`${ready} ready · 5 slots`} hatchery="1 egg hatching · 18 min" onSelect={setSelectedBird} onClose={() => setScreen('home')} onSend={() => { setDraft(previous => ({ ...previous, pigeonId: selectedBird })); setScreen('compose'); }} onShop={() => { setShopEntry('catalog'); setScreen('shop'); }} onHatchery={() => setScreen('hatchery')} />}
    {screen === 'sent' && <SentSheet pigeon={lastSent.courier} to={`To ${lastSent.name}`} estimate="Preview flight" explanation="Your sample pigeon is on the map. No real letter was sent." onHome={() => setScreen('home')} />}
    {['hatchery', 'settings'].includes(screen) && <View style={[a.sheet, { height: 360, paddingBottom: insets.bottom, gap: 20 }]}>
      <Handle onPress={() => setScreen(screen === 'hatchery' ? 'flock' : 'home')} label="Close panel" />
      <View style={a.between}><Text style={a.heading}>{screen === 'hatchery' ? 'Your hatchery' : 'Make yourself at home'}</Text><IconButton name="close" label="Close panel" onPress={() => setScreen(screen === 'hatchery' ? 'flock' : 'home')} /></View>
      {screen === 'hatchery' ? <><View style={[styles.previewCard, a.row, { gap: 20 }]}><View style={styles.egg} /><View style={{ gap: 8 }}><Text style={[a.heading, { fontSize: 20 }]}>A new little friend</Text><Copy>1 egg hatching · 18 min</Copy><Copy style={a.small}>Sample hatchery</Copy></View></View><PrimaryButton label="Back to your flock" onPress={() => setScreen('flock')} /></> : <><Copy>This is your Pigeon design playground: sample birds, sample flights, and a real map.</Copy><Copy>No account is needed. The flock resets when the app reloads.</Copy><PrimaryButton label={onRestartOnboarding ? "Restart onboarding" : "Reset the preview"} onPress={reset} /></>}
    </View>}
  </MapScreen>;
}

const styles = StyleSheet.create({
  previewCard: { padding: 20, borderRadius: 22, backgroundColor: '#F4F7FC', gap: 10 },
  egg: { width: 48, height: 62, borderRadius: 26, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#DFE6F3', borderWidth: 2, borderColor: 'white' },
});
