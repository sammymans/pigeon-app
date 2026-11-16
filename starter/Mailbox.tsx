import { useConvex, useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '../convex/_generated/api';
import { cityById, durationSeconds, formatDuration, OPEN_SKIES_DISCLOSURE, type FlightSummary, type Profile } from '../src/domain';
import { useServerClock } from './useServerClock';
import { acceptedFriends, exactTime, flightStatus, readableBody } from './letterModel';
import { useDraft } from './useDraft';
import { Compose } from './Compose';
import { randomUUID } from 'expo-crypto';
import { Shop } from './shop/Shop';
import { createConvexShopGateway } from './shop/convexGateway';
import type { ShopEntry, ShopExit } from '../src/shop';
import { visibleFlights } from './presentation';
import { Button, Envelope, Loading, Notice, PostalCard, ScreenHeader, s } from './ui';
import { a, PageFrame, usePageInsets } from './page03/atoms';
import { FlockSheet, MapScreen, SentSheet } from './page03/MapScreen';

type Page = { screen: 'postbox' } | { screen: 'compose'; reply?: boolean } | { screen: 'detail' | 'sent'; id: string };

export function Mailbox({ profile, deployment, connected, initialCompose = false, openFlightId, onOpenFlightHandled, onCatch, onReturn, onNavigate, onMenu }: { profile: Profile; deployment: string; connected: boolean; initialCompose?: boolean; openFlightId?: string; onOpenFlightHandled?: () => void; onCatch?: (flightId: string) => void; onReturn?: (flightId: string) => void; onNavigate: () => void; onMenu?: () => void }) {
  const client = useConvex();
  const shopGateway = useMemo(() => createConvexShopGateway(client, profile.id), [client, profile.id]);
  const connections = useQuery(api.social.list, {});
  const flights = useQuery(api.flights.list, { scope: 'mine', demo: profile.demo });
  const pair = useQuery(api.starterPair.status, profile.demo ? {} : 'skip');
  const pigeons = useQuery(api.flock.list, {});
  const ensureFlock = useMutation(api.onboarding.ensureFlock);
  const launch = useMutation(api.flights.launch);
  const setCity = useMutation(api.profiles.setCity);
  const clock = useServerClock(connected);
  const draft = useDraft(deployment, profile.id, profile.demo);
  const friends = acceptedFriends(connections ?? []);
  const [page, setPage] = useState<Page>({ screen: initialCompose ? 'compose' : 'postbox' });
  const [scope, setScope] = useState<'mine' | 'world'>('mine');
  const [tab, setTab] = useState<'recipient' | 'sender' | 'catcher'>('recipient');
  const [selected, setSelected] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [flock, setFlock] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [flockError, setFlockError] = useState('');
  const [shop, setShop] = useState<{ key: string; entry: ShopEntry } | null>(null);
  const [shopError, setShopError] = useState('');
  const activeShop = useRef<string | null>(null);
  const shopState = useRef({ draft, pigeons, connected });
  shopState.current = { draft, pigeons, connected };
  useEffect(() => () => { activeShop.current = null; }, []);
  const insets = usePageInsets();
  const world = useQuery(api.flights.list, scope === 'world' ? { scope: 'world', demo: profile.demo } : 'skip');
  const sentResult = useQuery(api.flights.detail, page.screen === 'sent' ? { id: page.id } : 'skip');
  const mapFlights = visibleFlights((scope === 'mine' ? flights : world)?.flights ?? [], scope);
  const selectedBird = pigeons?.find(bird => bird.id === (picked ?? draft.draft?.pigeonId)) ?? pigeons?.find(bird => bird.ready) ?? pigeons?.[0];
  const draftBird = pigeons?.find(bird => bird.id === draft.draft?.pigeonId);

  const handledFlight = useRef<string | undefined>(undefined);
  const composeEntry = useRef(initialCompose);
  const entryBirdChosen = useRef(false);
  useEffect(() => {
    if (!connected) return;
    let active = true;
    void ensureFlock({}).then(() => { if (active) setFlockError(''); }).catch(() => { if (active) setFlockError('Your flock could not be loaded. Reconnect and retry.'); });
    return () => { active = false; };
  }, [connected, ensureFlock]);
  useEffect(() => {
    if (!openFlightId) { handledFlight.current = undefined; return; }
    if (handledFlight.current === openFlightId || draft.busy) return;
    handledFlight.current = openFlightId;
    setInbox(false);
    setScope('mine');
    setFlock(false);
    setSelected(openFlightId);
    setPage({ screen: 'detail', id: openFlightId });
    onOpenFlightHandled?.();
  }, [openFlightId, draft.busy, onOpenFlightHandled]);

  useEffect(() => {
    if (!composeEntry.current || openFlightId || page.screen !== 'compose' || entryBirdChosen.current || !draft.draft || !pigeons?.length) return;
    entryBirdChosen.current = true;
    if (!draft.locked && !draft.draft.pigeonId) {
      const first = pigeons.find(bird => bird.name === 'Mochi') ?? pigeons[0];
      if (first) draft.edit({ pigeonId: first.id });
    }
  }, [initialCompose, openFlightId, page.screen, draft.draft, draft.locked, pigeons, draft.edit]);

  function openShop(from: 'home' | 'shop' | 'compose' | 'sky') {
    if (draft.busy) return;
    const key = randomUUID();
    const selectedBirdId = from === 'compose' ? draft.draft?.pigeonId : selectedBird?.id;
    const entry: ShopEntry = from === 'compose' ? { from, draftKey: key, selectedBirdId } : from === 'sky' ? { from } : { from, selectedBirdId };
    activeShop.current = key;
    setShopError('');
    setShop({ key, entry });
  }

  function closeShop(key: string, exit: ShopExit) {
    if (activeShop.current !== key || !shop || shop.key !== key) return;
    activeShop.current = null;
    setShop(null);
    const current = shopState.current;
    if (exit.to === 'compose') {
      if (shop.entry.from === 'compose' && exit.draftKey !== key) return;
      if (exit.confirmed) {
        const bird = current.pigeons?.find(bird => bird.id === exit.selectedBirdId && bird.ready);
        if (!bird || !current.connected || !current.draft.draft || current.draft.locked || current.draft.busy) {
          setShopError('Your pigeon choice could not be confirmed. Your saved letter is unchanged.');
          return;
        }
        if (current.draft.draft.pigeonId !== bird.id) current.draft.edit({ pigeonId: bird.id });
        setPicked(bird.id);
      }
      go({ screen: 'compose', reply: replying });
    } else if (exit.to === 'sky') {
      setInbox(false); setFlock(false); setScope('world'); go({ screen: 'postbox' });
    } else home();
  }

  function go(next: Page) {
    setPage(next);
    onNavigate();
  }

  function home() {
    setInbox(false);
    setScope('mine');
    setFlock(false);
    setReplying(false);
    go({ screen: 'postbox' });
  }

  function chooseBird() {
    setInbox(false);
    setScope('mine');
    setFlock(true);
    go({ screen: 'postbox' });
  }

  function beginSend() {
    setReplyTarget(null);
    setReplying(false);
    if (draft.locked) go({ screen: 'compose' });
    else chooseBird();
  }

  async function send() {
    const id = await draft.send(input => launch(input));
    if (id) {
      setReplyTarget(null);
      setSelected(id);
      setInbox(false);
      setScope('mine');
      setFlock(false);
      go({ screen: 'sent', id });
    }
  }

  function reply(recipientId: string) {
    if (draft.draft && !draft.draft.body && !draft.locked) {
      draft.startReply(recipientId);
      setReplyTarget(null);
    } else setReplyTarget(recipientId);
    setReplying(true);
    setPicked(null);
    if (draft.locked) go({ screen: 'compose', reply: true });
    else chooseBird();
  }

  const mine = flights?.flights.filter(flight => flight.role === tab);
  const outgoing = flights?.flights.filter(flight => flight.role === 'sender' && flight.state === 'in_flight').length ?? 0;

  if (shop) return <Shop key={shop.key} entry={shop.entry} gateway={shopGateway} onExit={exit => closeShop(shop.key, exit)} />;

  if (page.screen === 'compose') return <Compose notice={shopError} profile={profile} friends={friends} friendsLoading={connections === undefined} pigeon={draftBird} controller={draft} connected={connected} replying={Boolean(page.reply)} replyTarget={replyTarget} onBack={home} onChoosePigeon={() => openShop('compose')} onKeep={() => setReplyTarget(null)} onReplace={() => { if (replyTarget) { draft.startReply(replyTarget); if (draftBird) draft.edit({ pigeonId: draftBird.id }); } setReplyTarget(null); }} onSend={() => void send()} onSetCity={cityId => setCity({ cityId })} />;

  if (page.screen === 'sent') {
    const flight = sentResult?.flight;
    const sentFlights = flight ? [flight, ...(flights?.flights ?? []).filter(item => item.id !== flight.id)] : flights?.flights ?? [];
    return <MapScreen flights={sentFlights} selected={page.id} serverNow={clock.serverNow} scope="mine" onSelect={setSelected} onScope={value => { home(); setScope(value); }} onMenu={onMenu} onCoop={() => openShop('home')} onInbox={() => { home(); setInbox(true); }} onOpenLetter={id => go({ screen: 'detail', id })} onSend={beginSend} connected={connected} clockError={clock.syncError}>
      {flight ? <SentSheet embedded pigeon={flight.courier} state={flight.state} to={`To ${flight.recipientHandle ?? 'your friend'} · ${flight.destination.name}`} estimate={flight.state === 'in_flight' ? clock.serverNow === null ? 'Syncing ETA…' : clock.serverNow >= flight.arrivesAt ? 'Confirming arrival…' : `~${formatDuration((flight.arrivesAt - clock.serverNow) / 1000)}` : flight.state === 'delivered' ? 'Delivered' : 'Intercepted'} explanation={flight.state === 'in_flight' ? `${flight.demo ? 'Demo speed. ' : ''}Their message stays closed until delivery. ${flight.courier} stays in your flock and becomes ready when this flight ends.` : flight.state === 'delivered' ? 'The server confirmed delivery. Your pigeon is ready for another letter. Replies take a new flight.' : 'This Open Skies letter was caught and did not reach its recipient. Your pigeon is ready again.'} onHome={home} /> : <View style={[a.sheet, { position: 'relative', paddingBottom: insets.bottom, gap: 16 }]}>{sentResult === undefined ? <Loading label="Loading your confirmed flight…" /> : <Notice>This flight is no longer available to this account.</Notice>}<Button label="Back to my flights" onPress={home} /></View>}
    </MapScreen>;
  }

  if (page.screen === 'postbox' && !inbox) return <MapScreen
    flights={mapFlights} selected={selected} serverNow={clock.serverNow} scope={scope}
    onScope={value => { setScope(value); setSelected(null); setFlock(false); }}
    onSelect={id => { setSelected(id); if (id) setFlock(false); }}
    onOpenLetter={id => go({ screen: 'detail', id })}
    onMenu={onMenu} onCoop={() => openShop('home')} onInbox={() => setInbox(true)} onFlock={chooseBird}
    loading={(scope === 'mine' ? flights : world) === undefined}
    connected={connected} clockError={clock.syncError}
    action={draft.locked ? 'Resolve saved send' : draft.draft?.body ? 'Continue your letter' : 'Send a pigeon'}
    onSend={beginSend} sendDisabled={connections === undefined}
    notice={<>
      {shopError && <Notice error>{shopError}</Notice>}
      {!draft.draft && draft.error && <><Notice error>{draft.error}</Notice><Button label="Retry loading draft" secondary onPress={draft.retryStorage} /></>}
      {scope === 'world' && selected && <WorldSelection id={selected} connected={connected} onCatch={onCatch} onShop={() => openShop('sky')} />}
    </>}
  >
    {flock ? <FlockSheet embedded onShop={() => openShop('shop')} birds={(pigeons ?? []).map((bird, index) => ({ id: bird.id, name: bird.name, status: bird.ready ? 'Ready' : 'Flying', color: bird.ready ? ['#2453FF', '#7290DF', '#526AC3'][index % 3] : '#CBD6E4', speed: profile.demo ? 'Demo speed' : '60 km/h', deliveries: `${bird.deliveries} deliveries`, defense: 'No defense' }))} selected={selectedBird?.id ?? null} summary={pigeons !== undefined ? `${pigeons.filter(bird => bird.ready).length} ready · ${pigeons.length} slots` : 'Loading your flock…'} unavailable={pigeons === undefined ? 'Loading your account’s pigeons…' : 'No owned pigeons. Complete account setup to prepare your flock.'} onSelect={setPicked} onClose={() => setFlock(false)} onSend={selectedBird?.ready && connected && draft.draft && !draft.locked && outgoing < 3 ? () => { draft.edit({ pigeonId: selectedBird.id }); setFlock(false); go({ screen: 'compose', reply: replying }); } : undefined} notice={<>{!draft.draft && draft.error && <><Notice error>{draft.error}</Notice><Button label="Retry loading draft" secondary onPress={draft.retryStorage} /></>}{flockError ? <><Notice error>{flockError}</Notice><Button label="Retry loading flock" secondary disabled={!connected} onPress={() => { setFlockError(''); void ensureFlock({}).catch(() => setFlockError('Your flock could not be loaded. Reconnect and retry.')); }} /></> : draft.locked ? <Button label="Resolve saved send" onPress={() => go({ screen: 'compose' })} /> : outgoing >= 3 ? <Text style={a.small}>Three pigeons are already flying. Wait for one to arrive before sending another.</Text> : !connected ? <Text style={a.small}>Reconnect to confirm which pigeons are ready.</Text> : selectedBird && !selectedBird.ready ? <Text style={a.small}>This pigeon is flying. Choose a ready pigeon or wait for the server to confirm arrival.</Text> : undefined}</>} /> : null}
  </MapScreen>;

  return <PageFrame scroll style={{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 24, gap: 20 }}>
    {clock.syncError && <Notice>The server clock or delivery refresh could not be confirmed. Status will update after reconnection; the countdown cannot unlock a letter.</Notice>}
    {page.screen === 'postbox' ? <>
      <ScreenHeader title="Your postbox" onBack={home} />
      {connections !== undefined && friends.length === 0 && <Text style={s.small}>{profile.demo && pair ? 'Your partner will appear after accepting the invitation.' : 'No accepted friends yet. Only your existing accepted connections appear here.'}</Text>}
      {profile.demo && pair === undefined ? <Loading label="Checking your pair…" /> : pair && !pair.partner ? <Invitation token={pair.inviteToken} expiresAt={pair.expiresAt} serverNow={clock.serverNow} /> : pair?.partner ? <Text style={s.small}>@{profile.handle} · {(profile.cityId ? cityById(profile.cityId).name : 'City not set')}{'\n'}Paired with @{pair.partner.handle} · {(pair.partner.cityId ? cityById(pair.partner.cityId).name : 'City not set')}</Text> : null}
      {draft.error && <Notice error>{draft.error}</Notice>}
      <View style={s.between}><Text accessibilityRole="header" style={s.subtitle}>Your postbox</Text><Text style={s.eyebrow}>{mine ? `${mine.length} LETTERS` : 'SYNCING'}</Text></View>
      <View accessibilityRole="tablist" style={s.tabs}>{([['recipient', 'Incoming'], ['sender', 'Sent'], ['catcher', 'Caught']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" aria-selected={tab === value} accessibilityState={{ selected: tab === value }} accessibilityLabel={label} onPress={() => setTab(value)} style={[s.tab, tab === value && s.tabActive]}><Text style={[s.tabText, tab === value && s.tabActiveText]}>{label}</Text></Pressable>)}</View>
      {mine === undefined ? <Loading label="Checking the postbox…" /> : mine.length === 0 ? <View style={s.card}><Envelope small /><Text style={s.subtitle}>{tab === 'catcher' ? 'No caught letters yet.' : tab === 'recipient' ? 'Nothing on the doorstep. Yet.' : 'Your first journey starts here.'}</Text><Text style={s.small}>{tab === 'catcher' ? 'Letters you intercept appear here.' : tab === 'recipient' ? 'Incoming letters remain hidden until the server confirms delivery.' : 'Send to an accepted friend. Every letter has its own route and arrival time.'}</Text></View> : <View>{mine.map(flight => <FlightCard key={flight.id} flight={flight} serverNow={clock.serverNow} onOpen={() => flight.role === 'catcher' && onReturn ? onReturn(flight.id) : go({ screen: 'detail', id: flight.id })} />)}</View>}
    </> : <>
      <ScreenHeader title="Your letter" disabled={draft.busy} onBack={home} />
      <LetterDetail id={page.id} serverNow={clock.serverNow} onReply={reply} />
    </>}
  </PageFrame>;
}
function WorldSelection({ id, connected, onCatch, onShop }: { id: string | null; connected: boolean; onCatch?: (flightId: string) => void; onShop: () => void }) {
  const result = useQuery(api.flights.detail, id ? { id } : 'skip');
  if (!id) return <><Text style={s.subtitle}>A quiet patch of sky.</Text><Text style={s.small}>No Open Skies flights are available here right now. We’ll show real flights as they appear.</Text></>;
  if (result === undefined) return <Loading label="Checking this flight’s availability…" />;
  const flight = result.flight;
  if (!flight || flight.visibility !== 'open' || flight.state !== 'in_flight') return <Notice>This flight is no longer available. Choose another pigeon.</Notice>;
  return <><Text accessibilityRole="header" style={s.subtitle}>A pigeon is passing.</Text><Text style={s.body}>{flight.origin.name} → {flight.destination.name}</Text><Text style={s.small}>{flight.demo ? 'Demo speed · ' : ''}Arrival {exactTime(flight.arrivesAt)}</Text>
    <Button label={onCatch ? 'Try to intercept →' : 'Interception · coming soon'} disabled={!connected || flight.canSlingshot !== true || !onCatch} onPress={() => { if (connected && flight.canSlingshot === true) onCatch?.(flight.id); }} />
    <Button label="Stone shop" secondary onPress={onShop} />
    <Text style={s.small}>{!connected ? 'Reconnect to check whether you can intercept.' : flight.canSlingshot !== true ? 'The server says this flight isn’t eligible for you to catch right now.' : !onCatch ? 'The game is not connected to this build yet.' : 'A catch can reveal this Open Skies letter and stop its delivery.'}</Text></>;
}

function Invitation({ token, expiresAt, serverNow }: { token: string | null; expiresAt: number | null; serverNow: number | null }) {
  const [revealed, setRevealed] = useState(false);
  const expired = expiresAt !== null && serverNow !== null && serverNow >= expiresAt;
  return <View style={s.card}><Text style={s.eyebrow}>ONE NEST, TWO PEN PALS</Text><Text style={s.subtitle}>Invite your other pigeon.</Text><Text style={s.body}>Ask your partner to open this starter on a separate device or browser profile and choose “Join pair.”</Text>
    {expired ? <Notice error>This invitation has expired. To try again, sign out and create a fresh demo pair. Existing data is not changed.</Notice> : token ? <><Text style={s.small}>Private, one-use invitation. Share it only with your partner. Keep it out of screenshots and recordings.</Text>{revealed && <Text selectable accessibilityLabel="Private pairing invitation" style={s.token}>{token}</Text>}<Button label={revealed ? 'Hide private invitation' : 'Reveal private invitation'} secondary onPress={() => setRevealed(!revealed)} />{expiresAt !== null && <Text style={s.small}>Expires {exactTime(expiresAt)}.</Text>}</> : <Notice>Waiting for the pair to update. Your partner will appear as an accepted friend once joining is confirmed.</Notice>}
  </View>;
}

function FlightCard({ flight, serverNow, onOpen }: { flight: FlightSummary; serverNow: number | null; onOpen: () => void }) {
  const handle = flight.role === 'sender' ? flight.recipientHandle : flight.senderHandle;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${flight.role === 'catcher' ? 'Caught letter from' : flight.role === 'sender' ? 'Letter to' : 'Letter from'} ${handle ? `@${handle}` : flight.anonymous ? 'Anonymous' : 'your pen pal'}. ${flightStatus(flight, serverNow)}`} onPress={onOpen} style={({ pressed }) => [s.flightCard, pressed && s.pressed]}><View style={s.row}><Envelope small /><View style={s.grow}><Text style={s.flightHandle}>{flight.role === 'catcher' ? 'Caught from' : flight.role === 'sender' ? 'To' : 'From'} {handle ? `@${handle}` : flight.anonymous ? 'Anonymous' : 'your pen pal'}</Text><Text style={s.small}>{flight.origin.name} → {flight.destination.name}</Text></View><Text style={s.body}>↗</Text></View><View style={s.tight}><Text style={s.badgeText}>{flightStatus(flight, serverNow)} · {flight.visibility === 'sealed' ? 'Sealed' : 'Open Skies'}</Text><Text style={s.small}>Arrival {exactTime(flight.arrivesAt)}{flight.demo ? ' · Demo speed' : ''}</Text></View></Pressable>;
}
function LetterDetail({ id, serverNow, onReply }: { id: string; serverNow: number | null; onReply: (recipientId: string) => void }) {
  const result = useQuery(api.flights.detail, { id });
  if (result === undefined) return <Loading label="Fetching the server-confirmed flight…" />;
  const flight = result.flight;
  if (!flight) return <Notice>This letter is unavailable to this account. No private contents have been loaded.</Notice>;
  const body = readableBody(flight);
  return <View style={s.stack}>
    <View style={s.notice}><View style={s.between}><Text accessibilityLiveRegion="polite" style={s.badgeText}>{flightStatus(flight, serverNow)}</Text><Text style={s.small}>{flight.visibility === 'sealed' ? 'Sealed' : 'Open Skies'}</Text></View><Text style={s.small}>{flight.demo ? 'Demo speed · ' : ''}{flight.origin.name} → {flight.destination.name}</Text></View>
    {body !== null ? <><PostalCard route={`${flight.origin.name} → ${flight.destination.name}`} signature={flight.anonymous ? 'Anonymous' : `@${flight.senderHandle ?? 'your pen pal'}`}><Text style={s.eyebrow}>{flight.role === 'catcher' ? 'CAUGHT · OPENED FOR YOU' : 'DELIVERED · OPENED FOR YOU'}</Text><Text selectable style={s.letterBody}>{body}</Text></PostalCard>{flight.role === 'recipient' && flight.otherProfileId && <><Button label="Write a reply →" onPress={() => onReply(flight.otherProfileId!)} /><Text style={s.small}>No reply deadline. Your reply starts blank and takes a new timed flight.</Text></>}</> : <View style={s.card}><Envelope /><Text style={s.subtitle}>{flight.state === 'intercepted' ? 'This flight was intercepted.' : flight.state === 'delivered' ? 'Letter text is unavailable.' : 'Still on the wing.'}</Text><Text style={s.body}>{flight.state === 'intercepted' ? 'This letter did not reach its destination.' : flight.state === 'delivered' ? 'The server has not returned readable text for this account.' : 'Your recipient’s copy stays closed until the server confirms delivery. A finished countdown never opens it.'}</Text></View>}
    <View style={s.card}><Text style={s.eyebrow}>FLIGHT DETAILS</Text><Text style={s.body}>{flight.origin.name} → {flight.destination.name}</Text><Text style={s.small}>Departed {exactTime(flight.departedAt)}</Text><Text style={s.body}>Arrival {exactTime(flight.arrivesAt)}</Text><Text style={s.small}>{flight.distanceKm.toFixed(1)} km · Travel time {formatDuration((flight.arrivesAt - flight.departedAt) / 1000)}</Text>{flight.demo && <Text style={s.small}>Demo speed is accelerated. Normal travel at 60 km/h: {formatDuration(durationSeconds(flight.distanceKm, false, 'cruise'))}.</Text>}{flight.visibility === 'open' && <Notice>{flight.anonymous ? 'Someone may catch and read this message, preventing delivery. Your profile stays hidden; the cities and your words can still identify you.' : OPEN_SKIES_DISCLOSURE}</Notice>}</View>
  </View>;
}
