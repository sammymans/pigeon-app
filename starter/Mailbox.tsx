import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../convex/_generated/api';
import { cityById, durationSeconds, formatDuration, OPEN_SKIES_DISCLOSURE, type FlightSummary, type Profile } from '../src/domain';
import { useServerClock } from './useServerClock';
import { acceptedFriends, codepoints, exactTime, flightStatus, readableBody, routeEstimate, validDraft } from './letterModel';
import { useDraft } from './useDraft';
import { FlightMap } from './FlightMap';
import { PaperPigeon } from './PaperPigeon';
import { matchingFriends, visibleFlights } from './presentation';
import { Button, Envelope, Field, Link, Loading, Notice, PostalCard, ScreenHeader, colors, s } from './ui';

type Page = { screen: 'postbox' } | { screen: 'compose'; reply?: boolean } | { screen: 'detail'; id: string; sent?: boolean };
type DraftController = ReturnType<typeof useDraft>;

export function Mailbox({ profile, deployment, connected, onCatch, onReturn, onNavigate }: { profile: Profile; deployment: string; connected: boolean; onCatch?: (flightId: string) => void; onReturn?: (flightId: string) => void; onNavigate: () => void }) {
  const connections = useQuery(api.social.list, {});
  const flights = useQuery(api.flights.list, { scope: 'mine', demo: profile.demo });
  const pair = useQuery(api.starterPair.status, profile.demo ? {} : 'skip');
  const launch = useMutation(api.flights.launch);
  const clock = useServerClock(connected);
  const draft: DraftController = useDraft(deployment, profile.id, profile.demo);
  const friends = acceptedFriends(connections ?? []);
  const [page, setPage] = useState<Page>({ screen: 'postbox' });
  const [scope, setScope] = useState<'mine' | 'world'>('mine');
  const [tab, setTab] = useState<'recipient' | 'sender' | 'catcher'>('recipient');
  const [selected, setSelected] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const world = useQuery(api.flights.list, scope === 'world' ? { scope: 'world', demo: profile.demo } : 'skip');
  const mapFlights = visibleFlights((scope === 'mine' ? flights : world)?.flights ?? [], scope);
  const selectedFlight = mapFlights.find((flight) => flight.id === selected) ?? mapFlights[0];

  function go(next: Page) {
    setPage(next);
    onNavigate();
  }

  async function send() {
    const id = await draft.send((input) => launch(input));
    if (id) { setReplyTarget(null); go({ screen: 'detail', id, sent: true }); }
  }

  function reply(recipientId: string) {
    if (draft.draft && !draft.draft.body && !draft.locked) {
      draft.startReply(recipientId);
      setReplyTarget(null);
    } else setReplyTarget(recipientId);
    go({ screen: 'compose', reply: true });
  }

  const mine = flights?.flights.filter((flight) => flight.role === tab);
  const outgoing = flights?.flights.filter((flight) => flight.role === 'sender' && flight.state === 'in_flight').length ?? 0;
  const incoming = flights?.flights.filter((flight) => flight.role === 'recipient' && flight.state === 'in_flight').length ?? 0;

  return <View style={s.stack}>
    {clock.syncError && <Notice>The server clock or delivery refresh could not be confirmed. Status will update after reconnection; the countdown cannot unlock a letter.</Notice>}
    {page.screen === 'postbox' ? <>
      <View style={s.between}><View accessibilityRole="tablist" style={[s.tabs, s.grow]}>{([['mine', 'My flights'], ['world', 'World']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" aria-selected={scope === value} accessibilityState={{ selected: scope === value }} accessibilityLabel={label} onPress={() => { setScope(value); setSelected(null); }} style={[s.tab, scope === value && s.tabActive]}><Text style={[s.tabText, scope === value && s.tabActiveText]}>{label}</Text></Pressable>)}</View></View>
      <View style={s.tight}><FlightMap flights={mapFlights} selected={selectedFlight?.id ?? null} serverNow={clock.serverNow} onSelect={setSelected} />
        <View style={[s.dock, { marginTop: -20 }]}><View accessible={false} style={s.handle} />
          {(scope === 'mine' ? flights : world) === undefined ? <Loading label="Finding flights in the sky…" /> : scope === 'world' ? <WorldSelection id={selectedFlight?.id ?? null} connected={connected} onCatch={onCatch} /> : <>
            <View style={s.between}><Text accessibilityRole="header" style={s.subtitle}>Your sky</Text><Text style={s.badgeText}>{profile.demo ? 'Demo speed' : '60 km/h'}</Text></View>
            <Text style={s.small}>{outgoing} sent · {incoming} on the way to you · {outgoing}/3 active sends</Text>
            {selectedFlight && <Pressable accessibilityRole="button" accessibilityLabel="Open selected flight" onPress={() => go({ screen: 'detail', id: selectedFlight.id })} style={{ minHeight: 44, justifyContent: 'center', gap: 4 }}><Text style={s.body}>{selectedFlight.origin.name} → {selectedFlight.destination.name}</Text><Text style={s.badgeText}>{flightStatus(selectedFlight, clock.serverNow)} ↗</Text></Pressable>}
            <Button label={draft.locked ? 'Resolve saved send →' : draft.draft?.body ? 'Continue your letter →' : 'Send a pigeon →'} disabled={connections === undefined || (friends.length === 0 && !draft.locked)} onPress={() => { setReplyTarget(null); go({ screen: 'compose' }); }} />
          </>}
        </View>
      </View>
      {scope === 'world' && <Text style={s.small}>Only Open Skies flights appear here. These are shared city routes, not anyone’s real location. Letter text and recipient identity stay off the map.</Text>}
      {mapFlights.length > 1 && <View style={s.row}>{mapFlights.map((flight, index) => <Pressable key={flight.id} accessibilityRole="button" accessibilityLabel={`Select flight ${index + 1}: ${flight.origin.name} to ${flight.destination.name}`} aria-pressed={selectedFlight?.id === flight.id} accessibilityState={{ selected: selectedFlight?.id === flight.id }} onPress={() => setSelected(flight.id)} style={[s.recipientChip, selectedFlight?.id !== flight.id && { backgroundColor: '#F3F5F8' }]}><Text style={s.recipientName}>Flight {index + 1}</Text></Pressable>)}</View>}
      {scope === 'mine' && <>
        {connections !== undefined && friends.length === 0 && <Text style={s.small}>{profile.demo && pair ? 'Your partner will appear after accepting the invitation.' : 'No accepted friends yet. Only your existing accepted connections appear here.'}</Text>}
        {profile.demo && pair === undefined ? <Loading label="Checking your pair…" /> : pair && !pair.partner ? <Invitation token={pair.inviteToken} expiresAt={pair.expiresAt} serverNow={clock.serverNow} /> : pair?.partner ? <Text style={s.small}>@{profile.handle} · {cityById(profile.cityId).name}{'\n'}Paired with @{pair.partner.handle} · {cityById(pair.partner.cityId).name}</Text> : null}
        {draft.error && <Notice error>{draft.error}</Notice>}
        <View style={s.between}><Text accessibilityRole="header" style={s.subtitle}>Your postbox</Text><Text style={s.eyebrow}>{mine ? `${mine.length} LETTERS` : 'SYNCING'}</Text></View>
        <View accessibilityRole="tablist" style={s.tabs}>{([['recipient', 'Incoming'], ['sender', 'Sent'], ['catcher', 'Caught']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" aria-selected={tab === value} accessibilityState={{ selected: tab === value }} accessibilityLabel={label} onPress={() => setTab(value)} style={[s.tab, tab === value && s.tabActive]}><Text style={[s.tabText, tab === value && s.tabActiveText]}>{label}</Text></Pressable>)}</View>
        {mine === undefined ? <Loading label="Checking the postbox…" /> : mine.length === 0 ? <View style={s.card}><Envelope small /><Text style={s.subtitle}>{tab === 'catcher' ? 'No caught letters yet.' : tab === 'recipient' ? 'Nothing on the doorstep. Yet.' : 'Your first journey starts here.'}</Text><Text style={s.small}>{tab === 'catcher' ? 'Letters you intercept appear here. Choose one to open its caught-letter flow.' : tab === 'recipient' ? 'Incoming letters appear here. Their words remain hidden until the server confirms delivery.' : 'Send to an accepted friend. Every letter has its own route and arrival time.'}</Text></View> : <View>{mine.map((flight) => <FlightCard key={flight.id} flight={flight} serverNow={clock.serverNow} onOpen={() => flight.role === 'catcher' && onReturn ? onReturn(flight.id) : go({ screen: 'detail', id: flight.id })} />)}</View>}
      </>}
    </> : page.screen === 'compose' ? <Compose profile={profile} friends={friends} friendsLoading={connections === undefined} controller={draft} connected={connected} replying={Boolean(page.reply)} replyTarget={replyTarget} onBack={() => go({ screen: 'postbox' })} onNavigate={onNavigate} onKeep={() => setReplyTarget(null)} onReplace={() => { if (replyTarget) draft.startReply(replyTarget); setReplyTarget(null); }} onSend={() => void send()} /> : <>
      <ScreenHeader title={page.sent ? 'On its way' : 'Your letter'} disabled={draft.busy} onBack={() => go({ screen: 'postbox' })} />
      <LetterDetail id={page.id} serverNow={clock.serverNow} justSent={Boolean(page.sent)} onReply={reply} onReturn={onReturn} onHome={() => go({ screen: 'postbox' })} />
    </>}
  </View>;
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

function FlightCard({ flight, serverNow, onOpen }: { flight: FlightSummary; serverNow: number | null; onOpen: () => void }) {
  const handle = flight.role === 'sender' ? flight.recipientHandle : flight.senderHandle;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${flight.role === 'catcher' ? 'Caught letter from' : flight.role === 'sender' ? 'Letter to' : 'Letter from'} ${handle ? `@${handle}` : 'your pen pal'}. ${flightStatus(flight, serverNow)}`} onPress={onOpen} style={({ pressed }) => [s.flightCard, pressed && s.pressed]}><View style={s.row}><Envelope small /><View style={s.grow}><Text style={s.flightHandle}>{flight.role === 'catcher' ? 'Caught from' : flight.role === 'sender' ? 'To' : 'From'} {handle ? `@${handle}` : 'your pen pal'}</Text><Text style={s.small}>{flight.origin.name} → {flight.destination.name}</Text></View><Text style={s.body}>↗</Text></View><View style={s.tight}><Text style={s.badgeText}>{flightStatus(flight, serverNow)} · {flight.visibility === 'sealed' ? 'Sealed' : 'Open Skies'}</Text><Text style={s.small}>Arrival {exactTime(flight.arrivesAt)}{flight.demo ? ' · Demo speed' : ''}</Text></View></Pressable>;
}

function Compose({ profile, friends, friendsLoading, controller, connected, replying, replyTarget, onBack, onNavigate, onKeep, onReplace, onSend }: { profile: Profile; friends: Profile[]; friendsLoading: boolean; controller: DraftController; connected: boolean; replying: boolean; replyTarget: string | null; onBack: () => void; onNavigate: () => void; onKeep: () => void; onReplace: () => void; onSend: () => void }) {
  const { draft, locked, busy, receipt } = controller;
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const [inputHeight, setInputHeight] = useState(154);
  const recipient = friends.find((friend) => friend.id === draft?.recipientId);
  const estimate = recipient ? routeEstimate(profile, recipient) : null;
  const visibility = draft?.visibility;
  const acknowledged = Boolean(draft?.openAcknowledged);
  const legacySealed = controller.legacySealedDraft;
  const canSend = draft && (receipt || controller.pendingRetry || (recipient && validDraft(draft) && visibility === 'open' && acknowledged));
  const matches = matchingFriends(friends, search);

  if (choosing) return <View style={s.stack}>
    <ScreenHeader title="Who’s it for?" backLabel="Back to your letter" onBack={() => { setChoosing(false); onNavigate(); }} />
    <Field label="Find a friend" placeholder="Search by handle or city" autoCapitalize="none" autoCorrect={false} value={search} onChangeText={setSearch} />
    <Text style={s.small}>A little hello to someone you know. Only your accepted friends are shown.</Text>
    <Text style={s.eyebrow}>YOUR FRIENDS</Text>
    {friendsLoading ? <Loading label="Loading accepted friends…" /> : matches.length === 0 ? <Notice>{friends.length ? 'No friends match that search.' : 'No accepted friends are available yet.'}</Notice> : matches.map((friend) => <Pressable key={friend.id} accessibilityRole="radio" accessibilityLabel={`Write to @${friend.handle} in ${cityById(friend.cityId).name}`} aria-checked={draft?.recipientId === friend.id} accessibilityState={{ checked: draft?.recipientId === friend.id, disabled: locked || busy }} disabled={locked || busy} onPress={() => { controller.edit({ recipientId: friend.id }); setChoosing(false); setSearch(''); onNavigate(); }} style={[s.friend, draft?.recipientId === friend.id && s.selected]}><View style={s.avatar}><Text style={s.body}>{friend.handle.charAt(0).toUpperCase()}</Text></View><View style={s.grow}><Text style={s.flightHandle}>@{friend.handle}</Text><Text style={s.small}>{cityById(friend.cityId).name}</Text></View><Text style={s.body}>→</Text></Pressable>)}
  </View>;

  return <View style={s.stack}>
    <ScreenHeader title={replying ? 'Send a little reply' : 'Send a pigeon'} disabled={busy} onBack={onBack} />
    {replyTarget && <View style={s.card}><Text style={s.subtitle}>You already have a saved letter.</Text><Text style={s.small}>{locked ? 'Confirm the existing send before starting a reply. Its exact contents and retry key are protected.' : 'A reply is a new, blank letter with its own timed journey. Starting it will replace your unsent draft.'}</Text>{!locked && <Button label="Replace draft with a blank reply" onPress={onReplace} />}<Button label={locked ? 'Resolve saved send first' : 'Keep my current draft'} secondary onPress={onKeep} /></View>}
    {!draft ? <>{controller.error ? <Notice error>{controller.error}</Notice> : <Loading label="Restoring your saved draft…" />}<Button label="Retry loading draft" secondary onPress={controller.retryStorage} /></> : <>
      <View style={s.row}><Text style={[s.body, s.muted]}>To</Text><Pressable accessibilityRole="button" accessibilityLabel={recipient ? `Change recipient, currently @${recipient.handle}` : 'Choose a friend'} accessibilityState={{ disabled: locked || busy }} disabled={locked || busy} onPress={() => { setChoosing(true); onNavigate(); }} style={[s.recipientChip, { flexShrink: 1 }]}><Text style={s.recipientName}>{recipient ? `@${recipient.handle}` : draft.recipientId ? 'Saved recipient' : 'Choose a friend'}</Text><Text style={s.recipientName}>＋</Text></Pressable></View>
      {draft.recipientId && !recipient && <Notice>The saved recipient is no longer in your accepted friends. {draft.pending ? 'Retrying will ask the server to confirm the original send.' : 'Choose an accepted friend before sending.'}</Notice>}
      <PostalCard route={`${cityById(profile.cityId).name} → ${recipient ? cityById(recipient.cityId).name : 'Their city'}`} signature={`@${profile.handle}`} footer={<Text accessibilityLabel={`${codepoints(draft.body)} of 280 characters`} style={[s.small, codepoints(draft.body) > 280 && s.errorText]}>{codepoints(draft.body)} / 280</Text>}>
        <TextInput accessibilityLabel="Your letter" placeholder="Something small you’d tell them if they were here…" placeholderTextColor={colors.muted} value={draft.body} onChangeText={(body) => controller.edit({ body })} multiline scrollEnabled={false} editable={!locked && !busy} onContentSizeChange={(event) => setInputHeight(Math.max(154, event.nativeEvent.contentSize.height))} style={[s.letterInput, { minHeight: inputHeight }]} />
      </PostalCard>
      <Text accessibilityLiveRegion="polite" style={s.small}>{controller.saved ? 'Saved on this device' : 'Saving on this device…'}</Text>
      {estimate && recipient && <View style={s.tight}><View style={s.between}><Text style={s.body}>{profile.demo ? 'Demo speed' : 'Estimated journey'}</Text><Text style={[s.body, { fontWeight: '600' }]}>~{formatDuration(profile.demo ? estimate.demoSeconds : estimate.normalSeconds)}</Text></View><Text style={s.small}>{estimate.distance.toFixed(1)} km · Normal at 60 km/h: {formatDuration(estimate.normalSeconds)}. The server confirms the exact arrival.</Text></View>}
      {visibility === 'sealed' ? <View style={s.stack}><Notice>{legacySealed ? 'This saved draft was written as Sealed. New letters use Open Skies. Choose to convert it, then acknowledge the interception risk before sending.' : 'Saved Sealed send. Only you and the recipient can read this historical letter; its original retry payload is preserved.'}</Notice>{legacySealed && <Button label="Convert this draft to Open Skies" secondary disabled={busy || locked} onPress={() => controller.convertLegacyToOpenSkies()} />}</View> : <View style={s.notice}><Text style={[s.body, { fontWeight: '600', color: colors.blue }]}>Open Skies</Text><Text style={s.small}>{OPEN_SKIES_DISCLOSURE}</Text>{!locked && <Pressable accessibilityRole="checkbox" accessibilityLabel="I understand this letter can be intercepted and read" aria-checked={acknowledged} accessibilityState={{ checked: acknowledged, disabled: busy }} disabled={busy} onPress={() => controller.acknowledgeOpenSkies(!acknowledged)} style={[s.row, { minHeight: 48, paddingVertical: 10 }]}><View style={{ width: 24, height: 24, borderWidth: 1.5, borderColor: colors.blue, borderRadius: 6, backgroundColor: acknowledged ? colors.blue : colors.card, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.card }}>{acknowledged ? '✓' : ''}</Text></View><Text style={[s.small, s.grow]}>I understand this letter can be intercepted and read.</Text></Pressable>}</View>}
      {locked && !receipt && <Notice>This letter is locked for sending or retry. It may already be flying. Retrying confirms the exact same letter without a duplicate.</Notice>}
      {receipt && <Notice>The server accepted your letter. Finish local cleanup to open its flight; this will not launch another letter.</Notice>}
      {controller.error ? <><Notice error>{controller.error}</Notice>{!controller.saved && !receipt && <Button label="Retry saving draft" secondary disabled={busy} onPress={controller.retryStorage} />}</> : null}
      <Button label={busy ? 'Confirming your flight…' : receipt ? 'Finish local cleanup' : draft.pending ? 'Retry the same letter' : replying ? 'Let your reply fly →' : 'Let it fly →'} disabled={busy || (!connected && !receipt) || !canSend || Boolean(replyTarget)} onPress={onSend} />
      {replying && <Text style={s.small}>A reply is a new flight with its own travel time. Nothing is sent automatically.</Text>}
    </>}
  </View>;
}

function LetterDetail({ id, serverNow, justSent, onReply, onReturn, onHome }: { id: string; serverNow: number | null; justSent: boolean; onReply: (recipientId: string) => void; onReturn?: (flightId: string) => void; onHome: () => void }) {
  const result = useQuery(api.flights.detail, { id });
  if (result === undefined) return <Loading label="Fetching the server-confirmed flight…" />;
  const flight = result.flight;
  if (!flight) return <Notice>This letter is unavailable to this account. No private contents have been loaded.</Notice>;
  const body = readableBody(flight);
  return <View style={s.stack}>
    {flight.role === 'catcher' && flight.state === 'intercepted' && <Button label={onReturn ? 'Open caught letter →' : 'Caught letters · coming soon'} disabled={!onReturn} onPress={() => onReturn?.(flight.id)} />}
    {justSent && <View style={s.dock}><View style={{ alignSelf: 'center' }}><PaperPigeon size={108} /></View><Text style={s.subtitle}>Your pigeon’s on the way.</Text><Text style={s.body}>To @{flight.recipientHandle ?? 'your pen pal'} · {flight.destination.name}</Text><Text style={s.small}>The server accepted your letter. Its journey continues even when you close the app.</Text><Button label="Back to my flights" secondary onPress={onHome} /></View>}
    <View style={s.notice}><View style={s.between}><Text accessibilityLiveRegion="polite" style={s.badgeText}>{flightStatus(flight, serverNow)}</Text><Text style={s.small}>{flight.visibility === 'sealed' ? 'Sealed' : 'Open Skies'}</Text></View><Text style={s.small}>{flight.demo ? 'Demo speed · ' : ''}{flight.origin.name} → {flight.destination.name}</Text></View>
    {body !== null ? <><PostalCard route={`${flight.origin.name} → ${flight.destination.name}`} signature={`@${flight.senderHandle ?? 'your pen pal'}`}><Text style={s.eyebrow}>DELIVERED · OPENED FOR YOU</Text><Text selectable style={s.letterBody}>{body}</Text></PostalCard>{flight.role === 'recipient' && flight.otherProfileId && <><Button label="Write a reply →" onPress={() => onReply(flight.otherProfileId!)} /><Text style={s.small}>No reply deadline. Your reply starts blank and takes a new timed flight.</Text></>}</> : <View style={s.card}><Envelope /><Text style={s.subtitle}>{flight.state === 'intercepted' ? 'This flight was intercepted.' : flight.state === 'delivered' ? 'Letter text is unavailable.' : 'Still on the wing.'}</Text><Text style={s.body}>{flight.state === 'intercepted' ? 'This letter did not reach its destination.' : flight.state === 'delivered' ? 'The server has not returned readable text for this account.' : 'Your recipient’s copy stays closed until the server confirms delivery. A finished countdown never opens it.'}</Text></View>}
    <View style={s.card}><Text style={s.eyebrow}>FLIGHT DETAILS</Text><Text style={s.body}>{flight.origin.name} → {flight.destination.name}</Text><Text style={s.small}>Departed {exactTime(flight.departedAt)}</Text><Text style={s.body}>Arrival {exactTime(flight.arrivesAt)}</Text><Text style={s.small}>{flight.distanceKm.toFixed(1)} km · Travel time {formatDuration((flight.arrivesAt - flight.departedAt) / 1000)}</Text>{flight.demo && <Text style={s.small}>Demo speed is accelerated. Normal travel at 60 km/h: {formatDuration(durationSeconds(flight.distanceKm, false, 'cruise'))}.</Text>}{flight.visibility === 'open' && <Notice>{OPEN_SKIES_DISCLOSURE}</Notice>}</View>
  </View>;
}
