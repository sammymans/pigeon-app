import { useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import type { FlightSummary } from '../../src/domain';
import { a, Handle, IconButton, PrimaryButton } from './atoms';
import { FlockSheet, HomeSheet, MapScreen, MapSheet, SentSheet, type FlockBird } from './MapScreen';
import { CoopShop } from '../CoopShop';
import { applyShopAction, initialShop, refillStones, wornBy, type ShopState } from '../../src/shop';
import { skyMapData, type Coordinate } from './mapData';
import { sampleFlock } from './previewData';
import { blankPreviewDraft, PreviewMessaging, type PreviewDraft } from './PreviewMessaging';
import type { PreviewLetter } from './previewMail';
import { isUnopened, type MailPerson } from '../mailboxModel';
import { usePreviewInterception, WorldSkySheet } from './PreviewInterception';
import { focusNearby, isNearbyMock } from './nearbyPigeon';
import { previewRoute, senderLocation } from './previewRouting';

type Screen = 'home' | 'flock' | 'compose' | 'sent' | 'shop' | 'inbox' | 'settings';

// Local design sandbox. No account, cloud mutations, or real messages are created.
export function PreviewApp({ senderName = 'You', initialScreen = 'home', initialFlock = sampleFlock, onRestartOnboarding }: { senderName?: string; initialScreen?: 'home' | 'compose'; initialFlock?: FlockBird[]; onRestartOnboarding?: () => void } = {}) {
  const [shop, setShop] = useState(() => initialShop(Date.now(), initialFlock[0]?.id));
  const shopRef = useRef(shop);
  const updateShop = (value: ShopState) => { shopRef.current = value; setShop(value); };
  const [shopEntry, setShopEntry] = useState<'catalog' | 'stones'>('catalog');
  const [messageShop, setMessageShop] = useState(false);
  const sending = useRef(false);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [shopReturn, setShopReturn] = useState<Screen>('home');
  const [scope, setScope] = useState<'mine' | 'world'>('mine');
  const [birds, setBirds] = useState<FlockBird[]>(initialFlock);
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [selectedBird, setSelectedBird] = useState(initialFlock.find(bird => bird.status === 'Ready')?.id ?? '');
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
  const [letters, setLetters] = useState<PreviewLetter[]>([]);
  const [draft, setDraft] = useState<PreviewDraft>(() => ({ ...blankPreviewDraft, pigeonId: initialFlock.find(bird => bird.status === 'Ready')?.id ?? '' }));
  const [lastSent, setLastSent] = useState({ name: '', courier: '', estimate: '' });
  const [replyRequest, setReplyRequest] = useState<string | undefined>();
  const [now, setNow] = useState(Date.now);
  const interception = usePreviewInterception(refillStones(shop, now).stones, () => { const refilled = refillStones(shopRef.current, Date.now()); updateShop({ ...refilled, stones: Math.max(0, refilled.stones - 1) }); }, letter => setLetters(previous => [...previous, { ...letter, direction: 'incoming', state: 'intercepted', arrivesAt: letter.at, caught: true, opened: false, replyBy: letter.at + 30 * 60_000 }]), () => openStoneShop(), id => setLetters(previous => previous.map(letter => letter.id === id ? { ...letter, opened: true } : letter)), replyToCaught);
  const origin = senderLocation(interception.nearby.center, interception.nearby.locationKnown);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (screen === 'compose' || screen === 'inbox') sending.current = false; }, [screen]);
  const ready = birds.filter(bird => bird.status === 'Ready').length;
  const unopened = letters.filter(isUnopened).length;
  const sent = flights.filter(flight => flight.role === 'sender').length;
  const incoming = flights.filter(flight => flight.role === 'recipient').length;

  function openShop() { interception.clear(); setShopReturn(screen); setShopEntry('catalog'); setScreen('shop'); }

  function openStoneShop() { interception.clear(); setShopReturn('home'); setShopEntry('stones'); setScreen('shop'); }

  function replyToCaught(id: string) {
    const letter = letters.find(item => item.id === id);
    if (!letter) return;
    setReplyRequest(draft.body.trim() ? id : undefined);
    if (!draft.body.trim()) setDraft({ ...blankPreviewDraft, recipientId: letter.personId, replyId: id });
    interception.clear(); setScreen('compose');
  }

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
    updateShop(initialShop(Date.now(), initialFlock[0]?.id)); setBirds(initialFlock); setFlights([]); setSelectedBird(initialFlock.find(bird => bird.status === 'Ready')?.id ?? ''); setSelectedFlight(null); setDraft(blankPreviewDraft); setLetters([]); setReplyRequest(undefined); setScreen('home'); setScope('mine');
    onRestartOnboarding?.();
  }

  function sendPreview(person: MailPerson, courier: string, pigeonId?: string) {
    if (sending.current || !draft.body.trim() || Array.from(draft.body).length > 500) return;
    if (pigeonId && !birds.some(bird => bird.id === pigeonId && bird.status === 'Ready' && !bird.egg)) return;
    if (!pigeonId && !draft.replyId) return;
    const at = Date.now();
    const reply = letters.find(letter => letter.id === draft.replyId);
    if (reply?.replyBy && at >= reply.replyBy) return;
    sending.current = true;
    const route = previewRoute(person, origin, letters, draft.replyId, Boolean(pigeonId && shop.treatedBirds.includes(pigeonId)));
    const { destination } = route;
    const flight: FlightSummary = { id: `preview-${at}`, pigeonId, courier, origin: route.origin, destination, role: 'sender', visibility: 'open', defense: 'cruise', outfit: 'classic', state: 'in_flight', demo: true, attemptCount: 0, distanceKm: route.distanceKm, departedAt: at, arrivesAt: at + route.durationMs };
    updateShop({ ...shopRef.current, points: shopRef.current.points + 5, treatedBirds: shopRef.current.treatedBirds.filter(id => id !== pigeonId) });
    setFlights(previous => [flight, ...previous]);
    setLetters(previous => [...previous.map(letter => letter.id === draft.replyId ? { ...letter, replyBy: at } : letter), { id: flight.id, personId: person.id, person, replyDestination: destination, direction: 'outgoing', state: 'in_flight', at, arrivesAt: flight.arrivesAt, courier, opened: true, body: draft.body, signature: draft.hideName ? 'Someone' : senderName }]);
    if (pigeonId) setBirds(previous => previous.map(item => item.id === pigeonId ? { ...item, status: 'Flying', color: '#C8D4E5' } : item));
    setLastSent({ name: person.name, courier, estimate: route.estimate });
    setReplyRequest(undefined);
    setSelectedFlight(flight.id); setNow(at); setDraft(blankPreviewDraft); setScope('mine'); setScreen('sent');
  }

  if (screen === 'shop') return <CoopShop initialScreen={shopEntry} state={shop} birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} onBack={() => setScreen(shopReturn)} onAction={async action => { updateShop(applyShopAction(shopRef.current, action, birds, Date.now())); if (action.type === 'stones' && shopEntry === 'stones') setScreen('home'); }} onPreviewTopUp={points => updateShop({ ...shopRef.current, points: shopRef.current.points + points })} />;

  if (screen === 'inbox' || screen === 'compose') return <View style={{ flex: 1 }}><PreviewMessaging senderName={senderName} origin={origin} treatedBirds={shop.treatedBirds} replyRequest={replyRequest} letters={letters} birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} draft={draft} now={now} initialCompose={screen === 'compose'} onDraft={setDraft} onOpened={id => setLetters(previous => previous.map(letter => letter.id === id ? { ...letter, opened: true } : letter))} onClose={() => { setReplyRequest(undefined); setScreen('home'); }} onSend={sendPreview} onShop={() => setMessageShop(true)} />{messageShop && <Modal visible animationType="slide" onRequestClose={() => setMessageShop(false)}><CoopShop initialScreen="pigeon" state={shop} birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} onBack={() => setMessageShop(false)} onAction={async action => updateShop(applyShopAction(shopRef.current, action, birds, Date.now()))} onPreviewTopUp={points => updateShop({ ...shopRef.current, points: shopRef.current.points + points })} onPreviewPigeon={() => { const id = `pigeon-${Date.now()}`; setBirds(previous => [...previous, { id, name: 'Clover', status: 'Ready', color: '#2453FF', speed: '60 km/h', deliveries: '0 deliveries' }]); setDraft(previous => ({ ...previous, pigeonId: id })); setMessageShop(false); }} /></Modal>}</View>;

  if (interception.surface) return interception.surface;
  const mapFlights = scope === 'world' ? [...interception.worldFlights, ...flights] : [...interception.nearbyFlights, ...flights];
  const selectFlight = (id: string) => { const flight = mapFlights.find(item => item.id === id); if (flight) { setSelectedFlight(id); setScreen('home'); interception.select(flight); } };
  const focusedId = mapFlights.find(flight => flight.id === selectedFlight)?.id ?? null;
  const map = skyMapData(mapFlights, focusedId, now);
  map.markers = map.markers.map(marker => {
    const flight = flights.find(flight => flight.id === marker.id);
    return { ...marker, accessory: flight?.pigeonId ? wornBy(shop, flight.pigeonId) ?? null : 'cap' };
  });
  const focusedMap = { ...(isNearbyMock(focusedId ?? '') || (scope === 'mine' && !flights.length) ? focusNearby(map, interception.nearby.center, interception.nearby.locationKnown) : map), userLocation: interception.nearby.locationKnown ? interception.nearby.center : undefined };
  const sheetHeight = interception.sheet && screen === 'home' ? 310 : screen === 'flock' ? 450 : screen === 'sent' ? 250 : screen === 'home' ? scope === 'world' ? 280 : 214 : 360;
  return <MapScreen unopened={unopened} map={focusedMap} onLocationChange={locateNearby} scope={scope} onScope={value => { interception.clear(); setScope(value); setSelectedFlight(value === 'mine' ? flights[0]?.id ?? null : null); setScreen('home'); }} onMenu={() => { interception.clear(); setScreen('settings'); }} onInbox={() => { interception.clear(); setScreen('inbox'); }} onShop={openShop} onSelect={selectFlight} sheetHeight={sheetHeight}>
    {screen === 'home' && (interception.sheet ?? (scope === 'world' ? <WorldSkySheet flights={interception.worldFlights} stones={interception.stones} onGetStones={openStoneShop} onSend={() => setScreen('compose')} onSelect={flight => selectFlight(flight.id)} /> : <HomeSheet title={flights.length ? `${flights.length} ${flights.length === 1 ? 'flight' : 'flights'} in your sky` : 'No flights yet'} subtitle={flights.length ? `${sent} sent · ${incoming} on its way to you` : 'Send a little hello to someone.'} ready={`${ready} ready`} coopCount={birds.length} action="Send a pigeon" onExpand={() => setScreen('flock')} onSend={() => setScreen('compose')} />))}
    {screen === 'flock' && <FlockSheet birds={birds.map(item => ({ ...item, accessory: wornBy(shop, item.id) }))} selected={selectedBird} summary={`${ready} ready · ${birds.length} pigeons`} onSelect={setSelectedBird} onShop={openShop} onClose={() => setScreen('home')} onSend={() => { setDraft(previous => ({ ...previous, pigeonId: selectedBird })); setScreen('compose'); }} />}
    {screen === 'sent' && <SentSheet pigeon={lastSent.courier} to={`To ${lastSent.name}`} estimate={lastSent.estimate} explanation="At the speed of pigeon." onHome={() => setScreen('home')} />}
    {screen === 'settings' && <MapSheet contentStyle={{ gap: 20 }} handle={<Handle onPress={() => setScreen('home')} label="Close panel" />}>
      <View style={a.between}><Text style={a.heading}>Settings</Text><IconButton name="close" label="Close panel" onPress={() => setScreen('home')} /></View>
      <PrimaryButton label="Refresh nearby pigeons" onPress={resetNearby} /><PrimaryButton label={onRestartOnboarding ? "Restart onboarding" : "Start over"} onPress={reset} />
    </MapSheet>}
  </MapScreen>;
}
