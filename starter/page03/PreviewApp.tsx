import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import { a, Copy, Handle, IconButton, PrimaryButton } from './atoms';
import { FlockSheet, HomeSheet, MapScreen, MapSheet, SentSheet, type FlockBird } from './MapScreen';
import { CoopShop } from '../CoopShop';
import { applyShopAction, initialShop, refillStones, wornBy, type ShopState } from '../../src/shop';
import { skyMapData, type Coordinate } from './mapData';
import { sampleFlock } from './previewData';
import { blankPreviewDraft, PreviewMessaging, previewDestination, type PreviewDraft } from './PreviewMessaging';
import type { PreviewLetter } from './previewMail';
import { isUnopened, type MailPerson } from '../mailboxModel';
import { usePreviewInterception, WorldSkySheet } from './PreviewInterception';
import { focusNearby, isNearbyMock } from './nearbyPigeon';

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
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [selectedBird, setSelectedBird] = useState(initialFlock.find(bird => bird.status === 'Ready')?.id ?? '');
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
  const [letters, setLetters] = useState<PreviewLetter[]>([]);
  const [draft, setDraft] = useState<PreviewDraft>(() => ({ ...blankPreviewDraft, pigeonId: initialFlock.find(bird => bird.status === 'Ready')?.id ?? '' }));
  const [lastSent, setLastSent] = useState({ name: '', courier: '' });
  const [now, setNow] = useState(Date.now);
  const interception = usePreviewInterception(refillStones(shop, now).stones, () => { const refilled = refillStones(shopRef.current, Date.now()); updateShop({ ...refilled, stones: Math.max(0, refilled.stones - 1) }); }, letter => setLetters(previous => [...previous, { ...letter, direction: 'incoming', state: 'intercepted', arrivesAt: letter.at, caught: true, opened: false, replyBy: letter.at + 30 * 60_000 }]), () => openStoneShop(), id => setLetters(previous => previous.map(letter => letter.id === id ? { ...letter, opened: true } : letter)));
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(interval); }, []);
  const ready = birds.filter(bird => bird.status === 'Ready').length;
  const unopened = letters.filter(isUnopened).length;
  const sent = flights.filter(flight => flight.role === 'sender').length;
  const incoming = flights.filter(flight => flight.role === 'recipient').length;
  const eggs = birds.filter(bird => bird.egg);
  const hatchery = eggs.length ? `${eggs.length} egg${eggs.length === 1 ? '' : 's'} hatching · ${eggs[0].status}` : 'No eggs hatching';

  function openStoneShop() { interception.clear(); setShopEntry('stones'); setScreen('shop'); }

  function resetNearby() {
    interception.resetNearby();
    updateShop({ ...shopRef.current, stones: Math.max(5, shopRef.current.stones), stoneAt: Date.now() });
    setSelectedFlight(null); setScreen('home');
  }

  function locateNearby(point: Coordinate) {
    interception.relocateNearby(point);
    setSelectedFlight(null);
  }

  function reset() {
    interception.reset();
    updateShop(initialShop(Date.now(), initialFlock[0]?.id)); setBirds(initialFlock); setFlights([]); setSelectedBird(initialFlock.find(bird => bird.status === 'Ready')?.id ?? ''); setSelectedFlight(null); setDraft(blankPreviewDraft); setLetters([]); setScreen('home'); setScope('mine');
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
  const mapFlights = scope === 'world' ? [...interception.worldFlights, ...flights] : [...interception.nearbyFlights, ...flights];
  const selectFlight = (id: string) => { const flight = mapFlights.find(item => item.id === id); if (flight) { setSelectedFlight(id); setScreen('home'); interception.select(flight); } };
  const focusedId = mapFlights.find(flight => flight.id === selectedFlight)?.id ?? null;
  const map = skyMapData(mapFlights, focusedId, now);
  const focusedMap = isNearbyMock(focusedId ?? '') || (scope === 'mine' && !flights.length) ? focusNearby(map, interception.nearby.center, interception.nearby.locationKnown) : map;
  const sheetHeight = interception.sheet && screen === 'home' ? 310 : screen === 'flock' ? 514 : screen === 'sent' ? 250 : screen === 'home' ? scope === 'world' ? 280 : 182 : 360;
  return <MapScreen unopened={unopened} map={focusedMap} onLocationChange={locateNearby} scope={scope} onScope={value => { interception.clear(); setScope(value); setSelectedFlight(value === 'mine' ? flights[0]?.id ?? null : null); setScreen('home'); }} onMenu={() => { interception.clear(); setScreen('settings'); }} onInbox={() => { interception.clear(); setScreen('inbox'); }} onCoop={() => { interception.clear(); setScreen('flock'); }} onSelect={selectFlight} sheetHeight={sheetHeight}>
    {screen === 'home' && (interception.sheet ?? (scope === 'world' ? <WorldSkySheet flights={interception.worldFlights} stones={interception.stones} onGetStones={openStoneShop} onSend={() => setScreen('compose')} onSelect={flight => selectFlight(flight.id)} /> : <HomeSheet title={flights.length ? `${flights.length} flights in your sky` : 'No flights yet'} subtitle={flights.length ? `${sent} sent · ${incoming} on its way to you` : 'Send a little hello to someone.'} ready={`${ready} ready`} action="Send a message" onExpand={() => setScreen('flock')} onSend={() => setScreen('compose')} />))}
    {screen === 'flock' && <FlockSheet birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} selected={selectedBird} summary={`${ready} ready · 5 slots`} hatchery={hatchery} onSelect={setSelectedBird} onClose={() => setScreen('home')} onSend={() => { setDraft(previous => ({ ...previous, pigeonId: selectedBird })); setScreen('compose'); }} onShop={() => { setShopEntry('catalog'); setScreen('shop'); }} onHatchery={() => setScreen('hatchery')} />}
    {screen === 'sent' && <SentSheet pigeon={lastSent.courier} to={`To ${lastSent.name}`} estimate="Preview flight" explanation="Your sample pigeon is on the map. No real letter was sent." onHome={() => setScreen('home')} />}
    {['hatchery', 'settings'].includes(screen) && <MapSheet contentStyle={{ gap: 20 }} handle={<Handle onPress={() => setScreen(screen === 'hatchery' ? 'flock' : 'home')} label="Close panel" />}>
      <View style={a.between}><Text style={a.heading}>{screen === 'hatchery' ? 'Your hatchery' : 'Make yourself at home'}</Text><IconButton name="close" label="Close panel" onPress={() => setScreen(screen === 'hatchery' ? 'flock' : 'home')} /></View>
      {screen === 'hatchery' ? <><View style={[styles.previewCard, a.row, { gap: 20 }]}>{eggs.length > 0 && <View style={styles.egg} />}<View style={{ gap: 8 }}><Text style={[a.heading, { fontSize: 20 }]}>{eggs.length ? 'A new little friend' : 'No eggs just yet'}</Text><Copy>{hatchery}</Copy></View></View><PrimaryButton label="Back to your flock" onPress={() => setScreen('flock')} /></> : <><Copy>This is your Pigeon design playground: a new flock, nearby pigeons, and a real map.</Copy><Copy>No account is needed. The flock resets when the app reloads.</Copy><PrimaryButton label="Reset nearby pigeons" onPress={resetNearby} /><PrimaryButton label={onRestartOnboarding ? "Restart onboarding" : "Reset the preview"} onPress={reset} /></>}
    </MapSheet>}
  </MapScreen>;
}

const styles = StyleSheet.create({
  previewCard: { padding: 20, borderRadius: 22, backgroundColor: '#F4F7FC', gap: 10 },
  egg: { width: 48, height: 62, borderRadius: 26, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#DFE6F3', borderWidth: 2, borderColor: 'white' },
});
