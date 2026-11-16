import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../convex/_generated/api';
import { cityById, type Profile } from '../src/domain';
import { useServerClock } from './useServerClock';
import { acceptedFriends, exactTime, readableBody } from './letterModel';
import { useDraft } from './useDraft';
import { useOpenedLetters } from './useOpenedLetters';
import { mailboxesFromFlights, type MailLetter, type PersonMailbox } from './mailboxModel';
import { CoopShop } from './CoopShop';
import { useCoop } from './useCoop';
import { wornBy } from '../src/shop';
import { ConnectedComposer } from './ConnectedComposer';
import { FriendInvites } from './MailSetup';
import { visibleFlights } from './presentation';
import { Button, Loading, Notice, colors, s } from './ui';
import { a } from './page03/atoms';
import { FlockSheet, HomeSheet, MapScreen, MapSheet, SentSheet, type FlockBird } from './page03/MapScreen';
import { LetterThread, MailboxGrid, ReadingSheet } from './page03/Messaging';
import { skyMapData } from './page03/mapData';

export function Mailbox({ profile, deployment, connected, initialCompose = false, onCatch, onReturn, onNavigate, onMenu }: { profile: Profile; deployment: string; connected: boolean; initialCompose?: boolean; onCatch?: (flightId: string) => void; onReturn?: (flightId: string) => void; onNavigate: () => void; onMenu?: () => void }) {
  const connections = useQuery(api.social.list, {});
  const account = useQuery(api.onboarding.flock, {});
  const ensureFlock = useMutation(api.onboarding.ensureFlock);
  const [flockError, setFlockError] = useState('');
  const [flockAttempt, setFlockAttempt] = useState(0);
  useEffect(() => {
    if (!connected) return;
    let active = true;
    setFlockError('');
    void ensureFlock({}).catch(() => { if (active) setFlockError('Your flock could not be loaded. Please retry.'); });
    return () => { active = false; };
  }, [connected, ensureFlock, flockAttempt]);
  const flights = useQuery(api.flights.list, { scope: 'mine', demo: profile.demo });
  const pair = useQuery(api.starterPair.status, profile.demo ? {} : 'skip');
  const coop = useCoop();
  const [shopOpen, setShopOpen] = useState(false);
  const launch = useMutation(api.flights.launch);
  const clock = useServerClock(connected);
  const draft = useDraft(deployment, profile.id, profile.demo);
  const read = useOpenedLetters(deployment, profile.id);
  const friends = acceptedFriends(connections ?? []);
  const people = mailboxesFromFlights(friends, flights?.flights ?? [], read.opened);
  const [screen, setScreen] = useState<'home' | 'mailbox' | 'thread'>(initialCompose ? 'mailbox' : 'home');
  const [composing, setComposing] = useState(initialCompose);
  const [replying, setReplying] = useState(false);
  const [personId, setPersonId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'world'>('mine');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBird, setSelectedBird] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [flock, setFlock] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const world = useQuery(api.flights.list, scope === 'world' ? { scope: 'world', demo: profile.demo } : 'skip');
  const mapFlights = visibleFlights((scope === 'mine' ? flights : world)?.flights ?? [], scope);
  const person = people.find(item => item.id === personId);
  const openPerson = people.find(item => item.letters.some(letter => letter.id === openId));
  const openLetter = openPerson?.letters.find(letter => letter.id === openId);
  const sentFlight = flights?.flights.find(flight => flight.id === sentId);
  const unopened = people.reduce((count, item) => count + item.unopened, 0);
  const birds: FlockBird[] = (account?.pigeons ?? []).map((bird, i) => {
    const flying = Boolean(bird.activeFlightId);
    return { ...bird, accessory: coop.state ? wornBy(coop.state, bird.id) : undefined, status: flying ? 'Flying' : 'Ready', color: flying ? '#C8D4E5' : [colors.blue, '#7893DF', '#5D7AD7'][i % 3] };
  });
  useEffect(() => {
    if (draft.draft && !draft.draft.pigeonId && !draft.locked && !draft.busy) {
      const first = account?.pigeons.find(bird => !bird.activeFlightId);
      if (first) draft.edit({ pigeonId: first.id });
    }
  }, [account, draft.draft, draft.locked, draft.busy]);
  const outgoing = flights?.flights.filter(flight => flight.role === 'sender' && flight.state === 'in_flight').length ?? 0;
  const incoming = flights?.flights.filter(flight => flight.role === 'recipient' && flight.state === 'in_flight').length ?? 0;
  const ready = birds.filter(bird => bird.status === 'Ready').length;
  function compose(recipientId?: string) {
    if (!draft.locked && !draft.draft?.body && recipientId) draft.edit({ recipientId });
    setReplyTarget(null); setReplying(false); setComposing(true); onNavigate();
  }
  function reply(recipientId: string) {
    if (draft.draft && !draft.draft.body && !draft.locked) { draft.startReply(recipientId); setReplyTarget(null); }
    else setReplyTarget(recipientId);
    setOpenId(null); setReplying(true); setComposing(true); onNavigate();
  }
  async function send() {
    const id = await draft.send(input => launch(input));
    if (id) { setReplyTarget(null); setComposing(false); setOpenId(null); setSentId(id); setSelected(id); setScope('mine'); setScreen('home'); }
  }
  const notices = <>
    {flockError && <><Notice error>{flockError}</Notice><Button label="Retry loading your flock" secondary onPress={() => setFlockAttempt(value => value + 1)} /></>}
    {!profile.demo && <FriendInvites connected={connected} />}
    {(!connected || clock.syncError) && <Notice>Reconnecting. Letters open and send after the server confirms their status.</Notice>}
    {profile.demo && pair && !pair.partner && <Invitation token={pair.inviteToken} expiresAt={pair.expiresAt} serverNow={clock.serverNow} />}
  </>;
  if (shopOpen && coop.state) return <CoopShop state={coop.state} birds={birds} connected={connected} onBack={() => setShopOpen(false)} onAction={coop.act} />;
  let content;
  if (screen === 'thread' && person) content = <LetterThread person={person} now={clock.serverNow} onBack={() => setScreen('mailbox')} onCompose={person.recipientId ? () => compose(person.recipientId) : undefined} onOpen={letter => { if (letter.caught && onReturn) onReturn(letter.id); else setOpenId(letter.id); }} />;
  else if (screen !== 'home') content = <MailboxGrid people={people} now={clock.serverNow} loading={flights === undefined || connections === undefined || !read.loaded} notice={notices} onBack={() => setScreen('home')} onCompose={() => compose()} onPerson={item => { setPersonId(item.id); setScreen('thread'); }} />;
  else content = <MapScreen map={skyMapData(mapFlights, selected, clock.serverNow)} unopened={unopened} scope={scope} onScope={value => { setScope(value); setSelected(null); setFlock(false); setSentId(null); }} onMenu={onMenu} onCoop={() => { setFlock(true); setSentId(null); }} onInbox={() => { setScreen('mailbox'); setSentId(null); }} onSelect={id => { setSelected(id); if (scope === 'mine') { const owner = people.find(item => item.letters.some(letter => letter.id === id)); if (owner) { setPersonId(owner.id); setScreen('thread'); } } }} sheetHeight={flock ? 514 : sentId ? 250 : 182}>
    {sentId ? <SentSheet pigeon={sentFlight?.courier ?? 'Your pigeon'} to={`To ${sentFlight?.recipientHandle ?? 'your pen pal'}`} estimate="On its way" explanation="Your letter is in the sky. Follow its journey on the map." onHome={() => setSentId(null)} /> : flock ? <FlockSheet birds={birds} selected={selectedBird ?? birds.find(bird => bird.status === 'Ready')?.id ?? birds[0]?.id ?? null} summary={`${ready} ready · ${birds.length} pigeons`} onShop={coop.state ? () => setShopOpen(true) : undefined} onSelect={setSelectedBird} onClose={() => setFlock(false)} onSend={() => { const id = selectedBird ?? birds.find(bird => bird.status === 'Ready')?.id; if (id) draft.edit({ pigeonId: id }); setFlock(false); compose(); }} /> : scope === 'world' ? <MapSheet contentStyle={{ gap: 12 }}><WorldSelection id={selected ?? mapFlights[0]?.id ?? null} connected={connected} onCatch={onCatch} /></MapSheet> : <HomeSheet title={flights === undefined ? 'Finding your flights…' : outgoing + incoming ? `${outgoing + incoming} ${outgoing + incoming === 1 ? 'flight' : 'flights'} in your sky` : 'Your sky is quiet'} subtitle={`${outgoing} sent · ${incoming} on its way to you`} ready={`${ready} ready`} onExpand={() => setFlock(true)} action={draft.locked ? 'Resolve saved send' : draft.draft?.body ? 'Continue your letter' : 'Send a message'} onSend={() => compose()} disabled={connections === undefined} notice={flockError ? <Button label="Retry loading your flock" secondary onPress={() => setFlockAttempt(value => value + 1)} /> : !connected ? <Text style={a.small}>Reconnecting to your sky…</Text> : undefined} />}
  </MapScreen>;
  return <>{content}{openLetter && openPerson && !composing && <ConnectedReader letter={openLetter} person={openPerson} now={clock.serverNow} markOpened={read.markOpened} onClose={() => setOpenId(null)} onReply={reply} />}{composing && <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}><ConnectedComposer profile={profile} friends={friends} birds={birds} controller={draft} connected={connected} replying={replying} replyTarget={replyTarget} onClose={() => setComposing(false)} onKeep={() => { setReplyTarget(null); setReplying(false); }} onReplace={() => { if (replyTarget) draft.startReply(replyTarget); setReplyTarget(null); }} onSend={() => void send()} /></View>}</>;
}

function ConnectedReader({ letter, person, now, markOpened, onClose, onReply }: { letter: MailLetter; person: PersonMailbox; now: number | null; markOpened: (id: string) => void; onClose: () => void; onReply: (recipientId: string) => void }) {
  const result = useQuery(api.flights.detail, { id: letter.id });
  const flight = result?.flight;
  const body = flight ? flight.role === 'catcher' && flight.state === 'intercepted' ? flight.body ?? null : readableBody(flight) : null;
  useEffect(() => { if (body !== null) markOpened(letter.id); }, [body, letter.id, markOpened]);
  const canReply = Boolean(body !== null && flight?.role === 'recipient' && flight.otherProfileId && person.recipientId);
  return <ReadingSheet person={person} letter={letter} body={body} now={now} onClose={onClose} onReply={canReply ? () => onReply(flight!.otherProfileId!) : undefined} notice={result === undefined ? <Loading label="Opening your letter…" /> : <Notice>The server has not returned readable text for this letter.</Notice>} />;
}
function WorldSelection({ id, connected, onCatch }: { id: string | null; connected: boolean; onCatch?: (flightId: string) => void }) {
  const result = useQuery(api.flights.detail, id ? { id } : 'skip');
  if (!id) return <><Text style={s.subtitle}>A quiet patch of sky.</Text><Text style={s.small}>No Open Skies flights are available here right now. We’ll show real flights as they appear.</Text></>;
  if (result === undefined) return <Loading label="Checking this flight’s availability…" />;
  const flight = result.flight;
  if (!flight || flight.visibility !== 'open' || flight.state !== 'in_flight') return <Notice>This flight is no longer available. Choose another pigeon.</Notice>;
  return <><Text accessibilityRole="header" style={s.subtitle}>A pigeon is passing.</Text><Text style={s.body}>{flight.origin.name} → {flight.destination.name}</Text><Text style={s.small}>{flight.demo ? 'Demo speed · ' : ''}Arrival {exactTime(flight.arrivesAt)}</Text>
    <Button label={onCatch ? 'Try to intercept →' : 'Interception · coming soon'} disabled={!connected || !flight.canCatch || !onCatch} onPress={() => { if (connected && flight.canCatch) onCatch?.(flight.id); }} />
    <Text style={s.small}>{!connected ? 'Reconnect to check whether you can intercept.' : !flight.canCatch ? 'The server says this flight isn’t eligible for you to catch right now.' : !onCatch ? 'The game is not connected to this build yet.' : 'A catch can reveal this Open Skies letter and stop its delivery.'}</Text></>;
}

function Invitation({ token, expiresAt, serverNow }: { token: string | null; expiresAt: number | null; serverNow: number | null }) {
  const [revealed, setRevealed] = useState(false);
  const expired = expiresAt !== null && serverNow !== null && serverNow >= expiresAt;
  return <View style={s.card}><Text style={s.eyebrow}>ONE NEST, TWO PEN PALS</Text><Text style={s.subtitle}>Invite your other pigeon.</Text><Text style={s.body}>Ask your partner to open this starter on a separate device or browser profile and choose “Join pair.”</Text>
    {expired ? <Notice error>This invitation has expired. To try again, sign out and create a fresh demo pair. Existing data is not changed.</Notice> : token ? <><Text style={s.small}>Private, one-use invitation. Share it only with your partner. Keep it out of screenshots and recordings.</Text>{revealed && <Text selectable accessibilityLabel="Private pairing invitation" style={s.token}>{token}</Text>}<Button label={revealed ? 'Hide private invitation' : 'Reveal private invitation'} secondary onPress={() => setRevealed(!revealed)} />{expiresAt !== null && <Text style={s.small}>Expires {exactTime(expiresAt)}.</Text>}</> : <Notice>Waiting for the pair to update. Your partner will appear as an accepted friend once joining is confirmed.</Notice>}
  </View>;
}
