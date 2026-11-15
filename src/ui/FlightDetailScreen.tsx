import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { shareUrl, useFlight, usePigeon } from '../client/PigeonProvider';
import { CONNECTION_REQUEST, formatDuration } from '../domain';
import { PigeonCharacter } from '../animation/PigeonCharacter';
import { ActionFeedback, Badge, Button, EmptyState, Eyebrow, Loading, Notice, Page, Txt, useAction } from './primitives';
import { Envelope, FlightStateBadge, Postmark } from './postal';
import { WorldMap } from './WorldMap';
import { flightProgress } from './flightGeometry';
import { shareLink } from './sharing';
import { SafetyActions } from './SafetyActions';
import { colors, mono } from './theme';

export function FlightDetailScreen({ id, publicView = false }: { id?: string; publicView?: boolean }) {
  const pigeon = usePigeon();
  const { flight, loading, serverNow } = useFlight(id);
  const { width } = useWindowDimensions();
  const action = useAction();
  const [shared, setShared] = useState<string | null>(null);
  if (loading) return <Page narrow back><Loading label="Looking for your little courier…"/></Page>;
  if (!flight || (publicView && flight.visibility !== 'open')) return <Page narrow back publicView={publicView}><EmptyState title="This pigeon is out of view." body="This flight may be private, finished, or unavailable. A link never grants access to someone else’s letter." action={<Button label="Back to the sky" icon="arrow" onPress={() => router.replace(publicView ? '/sky' : '/')}/>}/></Page>;
  const progress = flightProgress(flight, serverNow);
  const readableBody = publicView ? undefined : flight.body;
  const friend = pigeon.connections.find(connection => connection.state === 'accepted' && connection.profile.id === flight.otherProfileId);
  return <Page back publicView={publicView} eyebrow={publicView ? 'A POSTCARD FROM THE PUBLIC SKY' : 'EVERY LITTLE THOUGHT HAS A JOURNEY'} title={flight.courier} subtitle={`${flight.origin.name} → ${flight.destination.name}`} right={<FlightStateBadge flight={flight}/>}>
    <View style={{ flexDirection: width > 900 ? 'row' : 'column', gap: 24 }}>
      <View style={{ flex: 1.2, gap: 24 }}><View style={{ height: width > 900 ? 330 : 260, backgroundColor: colors.sky, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#DCEAF2' }}><WorldMap flights={[flight]} selected={flight.id} now={serverNow} compact/><View style={{ position: 'absolute', left: 20, top: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><Badge label={flight.visibility === 'sealed' ? 'Sealed' : 'Open Skies'} icon={flight.visibility === 'sealed' ? 'lock' : 'globe'} tone="paper"/>{flight.demo && <Badge label="Demo speed" tone="paper"/>}</View></View>
        <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 24, gap: 20 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}><View style={{ flex: 1, gap: 8 }}><Eyebrow>FROM</Eyebrow><Txt style={{ fontSize: 18, fontWeight: '600' }}>{flight.origin.name}</Txt><Txt style={{ fontSize: 11, color: colors.muted }}>{flight.origin.country}</Txt></View><View style={{ flex: 1, gap: 8, alignItems: 'flex-end' }}><Eyebrow>TO</Eyebrow><Txt style={{ fontSize: 18, fontWeight: '600', textAlign: 'right' }}>{flight.destination.name}</Txt><Txt style={{ fontSize: 11, color: colors.muted }}>{flight.destination.country}</Txt></View></View>
          <View accessibilityRole="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} accessibilityLabel="Flight journey progress" style={{ height: 5, borderRadius: 3, backgroundColor: '#EEF1F2' }}><View style={{ height: 5, borderRadius: 3, width: `${progress * 100}%`, backgroundColor: flight.state === 'intercepted' ? colors.coral : colors.blue }}/></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}><View style={{ gap: 7 }}><Eyebrow>{flight.state === 'in_flight' ? 'TIME UNTIL TOUCHDOWN' : 'JOURNEY OUTCOME'}</Eyebrow><Txt style={{ fontSize: 28, fontWeight: '600', letterSpacing: -0.8 }}>{flight.state === 'in_flight' ? serverNow >= flight.arrivesAt ? 'Confirming arrival' : formatDuration((flight.arrivesAt - serverNow) / 1000) : flight.state === 'delivered' ? 'Safely delivered.' : 'A scenic detour.'}</Txt><Txt style={{ fontSize: 11, lineHeight: 18, color: colors.muted }}>{flight.state === 'in_flight' ? new Date(flight.arrivesAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : flight.state === 'intercepted' ? 'Intercepted. The letter did not reach its recipient.' : 'Arrival confirmed by the post office.'}</Txt></View></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Badge label={`${Math.round(flight.distanceKm).toLocaleString()} km`}/><Badge label={flight.defense === 'zigzag' ? 'Zigzag · 3 hits to catch' : 'Cruise · 2 hits to catch'}/><Badge label={flight.outfit === 'aviator' ? 'Aviator outfit' : 'Classic outfit'}/></View>
        </View>
      </View>
      <View style={{ flex: 1, gap: 20 }}>
        {readableBody !== undefined ? <View style={{ backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: '#E7DECB', padding: 28, minHeight: 260, gap: 24, overflow: 'hidden' }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow>ONE LITTLE THOUGHT</Eyebrow><Envelope size={48} open/></View><Txt selectable style={{ fontSize: 21, lineHeight: 34, letterSpacing: -0.3 }}>{readableBody}</Txt><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt style={{ fontSize: 12, color: '#8E8066' }}>{flight.senderHandle ? `With feeling, @${flight.senderHandle}` : 'Sent with feeling.'}</Txt><Postmark size={75}/></View></View>
          : <View style={{ backgroundColor: colors.paper, padding: 28, borderRadius: 20, alignItems: 'center', gap: 16 }}><Envelope size={96}/><Txt style={{ fontSize: 19, fontWeight: '600', textAlign: 'center' }}>{publicView || flight.role === 'public' ? 'The journey is public. The thought isn’t.' : flight.state === 'intercepted' ? 'This letter took a wrong turn.' : 'Some things are worth waiting for.'}</Txt><Txt style={{ fontSize: 12, lineHeight: 21, color: colors.muted, textAlign: 'center' }}>{publicView || flight.role === 'public' ? 'Public flight links show the route, never the letter or intended recipient.' : flight.state === 'intercepted' ? 'Another player caught this Open Skies pigeon. Its message is not available to the intended recipient.' : 'Your letter stays sealed until the server confirms arrival. Go make a cup of tea.'}</Txt></View>}
        {!publicView && flight.canCatch && <View style={{ gap: 12 }}><Txt style={{ fontSize: 12, lineHeight: 20, color: colors.muted }}>An Open Skies pigeon. A small opportunity for mischief. {flight.defense === 'zigzag' ? 'Three' : 'Two'} hits in three rounds to catch it.</Txt><Button label="Try to catch" icon="sky" disabled={!pigeon.connected || !pigeon.authenticated} onPress={() => router.push(`/catch/${flight.id}`)}/></View>}
        {!publicView && flight.canRequest && <View style={{ gap: 12 }}><Notice text={CONNECTION_REQUEST}/><Button label="Ask to exchange letters" icon="heart" disabled={!pigeon.connected} busy={action.busy} onPress={() => action.run(async () => { const result = await pigeon.requestConnection(flight.id); router.push(`/request/${result.id}`); })}/><Txt style={{ fontSize: 10, lineHeight: 17, color: colors.muted }}>One fixed request. No automatic connection, and no repeat after a decline.</Txt></View>}
        {!publicView && friend && flight.state === 'delivered' && flight.role === 'recipient' && <Button label="Send one back" icon="send" onPress={() => router.push(`/compose?recipient=${encodeURIComponent(friend.profile.id)}`)}/>}
        {!publicView && flight.canResend && <Button label="Resend for free" icon="send" onPress={() => router.push(`/compose?resend=${encodeURIComponent(flight.id)}`)}/>}
        {flight.visibility === 'open' && flight.shareToken && <Button label="Share this little journey" icon="share" variant="secondary" busy={action.busy} onPress={() => action.run(async () => { const url = shareUrl(`/f/${flight.shareToken}`); setShared(url); await shareLink(url, `${flight.courier}: ${flight.origin.name} to ${flight.destination.name}.${flight.demo ? ' Demo speed.' : ''} A thought in flight on Pigeon.`); })}/>}
        {shared && <Txt selectable style={{ color: colors.blue, fontSize: 11 }}>{shared}</Txt>}
        {publicView && <Button label="Send your own little thought" icon="send" onPress={() => router.push(pigeon.authenticated ? '/compose' : '/sign-in')}/>}
        <ActionFeedback action={action}/>
        {!publicView && readableBody !== undefined && <SafetyActions flightId={flight.id} profileId={flight.otherProfileId}/>}
      </View>
    </View>
    <View style={{ marginTop: 32, padding: 24, borderTopWidth: 1, borderTopColor: colors.line, gap: 20 }}><Eyebrow>THE POSTAL RECORD</Eyebrow>{flight.events.map((event, i) => <View key={`${event.at}:${i}`} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}><View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: i === flight.events.length - 1 ? colors.blue : '#D3DCDE' }}/><View style={{ gap: 6, flex: 1 }}><Txt style={{ fontSize: 13 }}>{event.label}</Txt><Txt style={{ fontSize: 10, fontFamily: mono, color: colors.muted }}>{new Date(event.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</Txt></View></View>)}</View>
  </Page>;
}
