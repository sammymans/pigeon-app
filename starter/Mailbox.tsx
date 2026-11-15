import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '../convex/_generated/api';
import { cityById, durationSeconds, formatDuration, type FlightSummary, type Profile } from '../src/domain';
import { useServerClock } from './useServerClock';
import { acceptedFriends, codepoints, exactTime, flightStatus, readableBody, routeEstimate, validDraft } from './letterModel';
import { useDraft } from './useDraft';
import { Button, Envelope, Field, Link, Loading, Notice, s } from './ui';

type Page = { screen: 'postbox' } | { screen: 'compose' } | { screen: 'detail'; id: string };
type DraftController = ReturnType<typeof useDraft>;

export function Mailbox({ profile, deployment, connected }: { profile: Profile; deployment: string; connected: boolean }) {
  const connections = useQuery(api.social.list, {});
  const flights = useQuery(api.flights.list, { scope: 'mine', demo: profile.demo });
  const pair = useQuery(api.starterPair.status, profile.demo ? {} : 'skip');
  const launch = useMutation(api.flights.launch);
  const clock = useServerClock(connected);
  const draft = useDraft(deployment, profile.id, profile.demo);
  const friends = acceptedFriends(connections ?? []);
  const [page, setPage] = useState<Page>({ screen: 'postbox' });
  const [tab, setTab] = useState<'recipient' | 'sender'>('recipient');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);

  async function send() {
    const id = await draft.send((input) => launch(input));
    if (id) { setReplyTarget(null); setPage({ screen: 'detail', id }); }
  }

  function reply(recipientId: string) {
    if (draft.draft && !draft.draft.body && !draft.locked) {
      draft.startReply(recipientId);
      setReplyTarget(null);
    } else setReplyTarget(recipientId);
    setPage({ screen: 'compose' });
  }

  const mine = flights?.flights.filter((flight) => flight.visibility === 'sealed' && flight.role === tab);

  return <View style={s.stack}>
    <View style={s.between}><View style={s.tight}><Text style={s.eyebrow}>THE NEST OF @{profile.handle}</Text><Text style={s.small}>{cityById(profile.cityId).name}</Text></View><View style={s.badge}><Text style={s.badgeText}>{profile.demo ? 'DEMO SPEED · 30–90s' : 'NORMAL SPEED'}</Text></View></View>
    {clock.syncError && <Notice>The server clock or delivery refresh could not be confirmed. Status will update after reconnection; the countdown cannot unlock a letter.</Notice>}
    {page.screen !== 'postbox' && <Link label="← Back to postbox" disabled={draft.busy} onPress={() => setPage({ screen: 'postbox' })} />}
    {page.screen === 'postbox' ? <>
      <View style={s.tight}><Text style={s.title}>A note worth{ '\n' }waiting for.</Text><Text style={[s.body, s.muted]}>A few words. A real journey.</Text></View>
      {profile.demo && pair === undefined ? <Loading label="Checking your pair…" /> : pair && !pair.partner ? <Invitation token={pair.inviteToken} expiresAt={pair.expiresAt} serverNow={clock.serverNow} /> : pair?.partner ? <Notice>Paired with @{pair.partner.handle} in {cityById(pair.partner.cityId).name}. Only the two of you share this demo.</Notice> : profile.demo ? <Notice>This is an older demo session, not an isolated pair. Sign out to create or join a fresh paired demo.</Notice> : null}
      <Button label={draft.locked ? 'Resolve saved send →' : draft.draft?.body ? 'Continue your letter →' : 'Write a letter →'} disabled={connections === undefined || (friends.length === 0 && !draft.locked)} onPress={() => { setReplyTarget(null); setPage({ screen: 'compose' }); }} />
      {connections !== undefined && friends.length === 0 && <Text style={s.small}>{profile.demo && pair ? 'Your partner will appear here after accepting the invitation.' : 'No accepted friends yet. This slice uses your existing accepted connections; it never adds fictional pen pals.'}</Text>}
      {draft.error && <Notice error>{draft.error}</Notice>}
      <View style={s.between}><Text style={s.subtitle}>Your sealed postbox</Text><Text style={s.eyebrow}>{flights ? `${flights.flights.filter((flight) => flight.visibility === 'sealed' && (flight.role === 'sender' || flight.role === 'recipient')).length} LETTERS` : 'SYNCING'}</Text></View>
      <View accessibilityRole="tablist" style={s.tabs}>{([['recipient', 'Incoming'], ['sender', 'Sent']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} accessibilityLabel={label} onPress={() => setTab(value)} style={[s.tab, tab === value && s.tabActive]}><Text style={s.tabText}>{label}</Text></Pressable>)}</View>
      {mine === undefined ? <Loading label="Checking the postbox…" /> : mine.length === 0 ? <View style={s.card}><Envelope small /><Text style={s.subtitle}>{tab === 'recipient' ? 'Nothing on the doorstep. Yet.' : 'Your first journey starts here.'}</Text><Text style={s.small}>{tab === 'recipient' ? 'When your friend sends a letter, its route appears here. The words stay sealed until the server confirms delivery.' : 'Write to an accepted friend. Your sent letters will appear here with their server-confirmed route and arrival time.'}</Text></View> : <View>{mine.map((flight) => <FlightCard key={flight.id} flight={flight} serverNow={clock.serverNow} onOpen={() => setPage({ screen: 'detail', id: flight.id })} />)}</View>}
    </> : page.screen === 'compose' ? <Compose profile={profile} friends={friends} friendsLoading={connections === undefined} controller={draft} connected={connected} replyTarget={replyTarget} onKeep={() => setReplyTarget(null)} onReplace={() => { if (replyTarget) draft.startReply(replyTarget); setReplyTarget(null); }} onSend={() => void send()} /> : <LetterDetail id={page.id} serverNow={clock.serverNow} onReply={reply} />}
  </View>;
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
  return <Pressable accessibilityRole="button" accessibilityLabel={`${flight.role === 'sender' ? 'Letter to' : 'Letter from'} ${handle ? `@${handle}` : 'your pen pal'}. ${flightStatus(flight, serverNow)}`} onPress={onOpen} style={({ pressed }) => [s.flightCard, pressed && s.pressed]}><View style={s.row}><Envelope small /><View style={s.grow}><Text style={s.flightHandle}>{flight.role === 'sender' ? 'To' : 'From'} {handle ? `@${handle}` : 'your pen pal'}</Text><Text style={s.small}>{flight.origin.name} → {flight.destination.name}</Text></View><Text style={s.body}>↗</Text></View><View style={s.tight}><Text style={s.badgeText}>{flightStatus(flight, serverNow)}</Text><Text style={s.small}>Arrival {exactTime(flight.arrivesAt)}{flight.demo ? ' · Demo speed' : ''}</Text></View></Pressable>;
}

function Compose({ profile, friends, friendsLoading, controller, connected, replyTarget, onKeep, onReplace, onSend }: { profile: Profile; friends: Profile[]; friendsLoading: boolean; controller: DraftController; connected: boolean; replyTarget: string | null; onKeep: () => void; onReplace: () => void; onSend: () => void }) {
  const { draft, locked, busy, receipt } = controller;
  const recipient = friends.find((friend) => friend.id === draft?.recipientId);
  const estimate = recipient ? routeEstimate(profile, recipient) : null;
  const canSend = draft && (receipt || draft.pending || (recipient && validDraft(draft)));

  return <View style={s.stack}><Text style={s.eyebrow}>SEALED, ALWAYS</Text><Text style={s.title}>A little piece{ '\n' }of your day.</Text><Text style={s.small}>Only you and your recipient can read this letter. Their copy stays sealed until delivery.</Text>
    {replyTarget && <View style={s.card}><Text style={s.subtitle}>You already have a saved letter.</Text><Text style={s.small}>{locked ? 'Confirm the existing send before starting a reply. Its exact contents and retry key are protected.' : 'A reply is a new, blank letter with its own timed journey. Starting it will replace your unsent draft.'}</Text>{!locked && <Button label="Replace draft with a blank reply" onPress={onReplace} />}<Button label={locked ? 'Resolve saved send first' : 'Keep my current draft'} secondary onPress={onKeep} /></View>}
    {!draft ? <>{controller.error ? <Notice error>{controller.error}</Notice> : <Loading label="Restoring your saved draft…" />}<Button label="Retry loading draft" secondary onPress={controller.retryStorage} /></> : <>
      <View style={s.card}><Text style={s.fieldLabel}>To</Text>{friendsLoading ? <Loading label="Loading accepted friends…" /> : friends.length === 0 ? <Text style={s.small}>No accepted friends are available.</Text> : friends.map((friend) => <Pressable key={friend.id} accessibilityRole="radio" accessibilityLabel={`Write to @${friend.handle} in ${cityById(friend.cityId).name}`} accessibilityState={{ checked: draft.recipientId === friend.id, disabled: locked || busy }} disabled={locked || busy} onPress={() => controller.edit({ recipientId: friend.id })} style={[s.cityOption, draft.recipientId === friend.id && s.selected]}><Text style={s.body}>{draft.recipientId === friend.id ? '● ' : '○ '}@{friend.handle}</Text><Text style={s.small}>{cityById(friend.cityId).name}</Text></Pressable>)}
        {draft.recipientId && !recipient && <Notice>The saved recipient is no longer in your accepted friends. {draft.pending ? 'Retrying will ask the server to confirm the original send.' : 'Choose an accepted friend before sending.'}</Notice>}
        <View style={s.divider} /><Field label="Your letter" placeholder="Something small you’d tell them if they were here…" value={draft.body} onChangeText={(body) => controller.edit({ body })} multiline editable={!locked && !busy} style={s.letterInput} /><View style={s.between}><Text accessibilityLiveRegion="polite" style={s.small}>{controller.saved ? 'Saved on this device' : 'Saving on this device…'}</Text><Text style={[s.small, codepoints(draft.body) > 280 && s.errorText]}>{codepoints(draft.body)} / 280</Text></View>
      </View>
      {estimate && recipient && <View style={s.card}><Text style={s.eyebrow}>THE JOURNEY · ESTIMATE</Text><Text style={s.body}>{cityById(profile.cityId).name} → {cityById(recipient.cityId).name}</Text><Text style={s.small}>{estimate.distance.toFixed(1)} km · Normal travel: {formatDuration(estimate.normalSeconds)}</Text>{profile.demo && <Notice>Demo speed: about {formatDuration(estimate.demoSeconds)} instead of {formatDuration(estimate.normalSeconds)}. This isolated account always uses demo time.</Notice>}<Text style={s.small}>The server fixes the route and exact arrival time when it accepts your letter.</Text></View>}
      {locked && !receipt && <Notice>This letter is sealed for sending or retry. It may already be flying. Editing is locked until the server acknowledges this exact letter; retrying uses the same request key.</Notice>}
      {receipt && <Notice>The server accepted your letter. Finish local cleanup to open its flight; this will not launch another letter.</Notice>}
      {controller.error ? <><Notice error>{controller.error}</Notice>{!controller.saved && !receipt && <Button label="Retry saving draft" secondary disabled={busy} onPress={controller.retryStorage} />}</> : null}
      <Button label={busy ? 'Confirming with the post office…' : receipt ? 'Finish local cleanup' : draft.pending ? 'Retry the same sealed letter' : 'Seal & send →'} disabled={busy || (!connected && !receipt) || !canSend || Boolean(replyTarget)} onPress={onSend} />
      <Text style={s.small}>No instant delivery. No automatic replies. Just your words, carried a little farther.</Text>
    </>}
  </View>;
}

function LetterDetail({ id, serverNow, onReply }: { id: string; serverNow: number | null; onReply: (recipientId: string) => void }) {
  const result = useQuery(api.flights.detail, { id });
  if (result === undefined) return <Loading label="Fetching the server-confirmed flight…" />;
  const flight = result.flight;
  if (!flight) return <Notice>This letter is unavailable to this account. No private contents have been loaded.</Notice>;
  const body = readableBody(flight);
  return <View style={s.stack}><Text style={s.eyebrow}>{flight.demo ? 'DEMO SPEED · SEALED LETTER' : 'NORMAL SPEED · SEALED LETTER'}</Text><Text style={s.title}>{flight.state === 'delivered' ? 'A little closer.' : 'Good things take flight.'}</Text><View style={s.card}><View style={s.between}><Envelope small /><Text accessibilityLiveRegion="polite" style={s.badgeText}>{flightStatus(flight, serverNow)}</Text></View><Text style={s.body}>From @{flight.senderHandle ?? 'your pen pal'} to @{flight.recipientHandle ?? 'your pen pal'}</Text><View style={s.route}><View><Text style={s.eyebrow}>FROM</Text><Text style={s.body}>{flight.origin.name}</Text></View><View><Text style={s.eyebrow}>TO</Text><Text style={s.body}>{flight.destination.name}</Text></View></View><Text style={s.small}>{flight.distanceKm.toFixed(1)} km · Courier {flight.courier}</Text><View style={s.divider} /><Text style={s.small}>Departed {exactTime(flight.departedAt)}</Text><Text style={s.body}>Arrival {exactTime(flight.arrivesAt)}</Text><Text style={s.small}>Server travel time: {formatDuration((flight.arrivesAt - flight.departedAt) / 1000)}</Text>{flight.demo && <Notice>Demo speed is accelerated. Normal travel for this route: {formatDuration(durationSeconds(flight.distanceKm, false, 'cruise'))}.</Notice>}</View>
    {body !== null ? <View style={s.card}><Text style={s.eyebrow}>DELIVERED · OPENED FOR YOU</Text><Text selectable style={s.letterBody}>{body}</Text><Text style={s.small}>With a little patience, from @{flight.senderHandle ?? 'your pen pal'}.</Text></View> : <View style={s.card}><Text style={s.subtitle}>{flight.state === 'delivered' ? 'Letter text is unavailable.' : 'Still sealed.'}</Text><Text style={s.body}>{flight.state === 'delivered' ? 'The server has not returned readable text for this account.' : 'The words stay tucked inside until the server confirms delivery. A finished countdown never opens the envelope.'}</Text></View>}
    {body !== null && flight.role === 'recipient' && flight.otherProfileId && <><Button label="Write a timed reply →" onPress={() => onReply(flight.otherProfileId!)} /><Text style={s.small}>Your reply begins blank and makes a new trip back. It is never sent automatically.</Text></>}
  </View>;
}
