import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePigeon } from '../client/PigeonProvider';
import { formatDuration } from '../domain';
import { ActionFeedback, AppHeader, Badge, Button, Eyebrow, Icon, NetworkNotice, Txt, useAction } from './primitives';
import { Envelope, Postmark, Segments } from './postal';
import { WorldMap } from './WorldMap';
import { Bird } from './Bird';
import { colors, mono, shadow } from './theme';

export function SkyScreen({ publicView = false }: { publicView?: boolean }) {
  const pigeon = usePigeon();
  const { demo: demoParam } = useLocalSearchParams<{ demo?: string }>();
  const { width } = useWindowDimensions();
  const large = width >= 900;
  const [scope, setScope] = useState<'mine' | 'world'>(publicView || !pigeon.authenticated ? 'world' : 'mine');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const demoAction = useAction();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (publicView) pigeon.setDemo(demoParam === '1'); }, [publicView, demoParam, pigeon.profile?.id]);
  const flights = (scope === 'world' || publicView ? pigeon.worldFlights : pigeon.myFlights).filter(flight => flight.state === 'in_flight');
  const selected = flights.find(flight => flight.id === selectedId);
  const total = scope === 'world' || publicView ? pigeon.worldTotal : flights.length;
  const send = () => router.push(pigeon.authenticated ? '/compose' : '/sign-in?next=compose');
  return <View style={styles.page}><AppHeader publicView={publicView}/><NetworkNotice/>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}>
      <View style={[styles.body, { paddingHorizontal: large ? 48 : 20 }]}>
        <View style={[styles.intro, !large && { paddingTop: 28, paddingBottom: 24 }]}>
          <View style={{ gap: 12 }}><Eyebrow style={{ color: colors.blue, fontSize: 9 }}>A VERY PERSONAL POSTAL SERVICE</Eyebrow><Txt accessibilityRole="header" style={[styles.headline, !large && { fontSize: 35, lineHeight: 40, letterSpacing: -1.4 }]}>Little thoughts.{'\n'}<Txt style={[styles.headline, { color: '#718D9A' }, !large && { fontSize: 35, lineHeight: 40, letterSpacing: -1.4 }]}>Great distances.</Txt></Txt></View>
          {large ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 36 }}><Txt style={{ color: colors.muted, fontSize: 13, lineHeight: 22, maxWidth: 235 }}>Send a thought. Watch it cross the world.{'\n'}Hope it gets there.</Txt><Postmark size={97}/></View> : <Txt style={{ color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 12 }}>A little less instant. A little more worth the wait.</Txt>}
        </View>
        {!pigeon.authenticated && <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', justifyContent: 'space-between', gap: 16, padding: large ? 20 : 16, marginBottom: 20, backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: '#ECE3D1' }}><View style={{ flex: large ? 1 : undefined, gap: 6 }}><Txt style={{ fontSize: 15, fontWeight: '600' }}>Less explaining. More pigeon.</Txt><Txt style={{ fontSize: 11, lineHeight: 18, color: colors.muted }}>Try a real temporary account with sample pen pals and accelerated flights. No password. No pretend purchases.</Txt></View><Button label="Try the isolated demo" icon="sky" busy={demoAction.busy} disabled={!pigeon.configured || !pigeon.connected || pigeon.loading} onPress={() => demoAction.run(async () => { await pigeon.startDemo(); router.replace('/'); })}/></View>}
        {(demoAction.error || demoAction.message) && <View style={{ marginBottom: 16 }}><ActionFeedback action={demoAction}/></View>}
        <View style={[styles.map, { height: large ? Math.min(570, Math.max(460, width * 0.36)) : 470 }]}>
          <View style={[StyleSheet.absoluteFill, !large && { top: 50, bottom: 125, left: -75, right: -75 }]}>
            <WorldMap flights={flights} now={pigeon.serverNow} selected={selected?.id} onSelect={flight => setSelectedId(flight.id)} illustrative={!pigeon.configured}/>
          </View>
          <View pointerEvents="box-none" style={[styles.mapTop, !large && { padding: 16 }]}>
            <View style={{ gap: 12 }}>{publicView ? <Badge label="The public sky · read-only" icon="globe"/> : <Segments items={[{ label: 'My flights', value: 'mine' }, { label: 'World', value: 'world' }]} value={scope} onChange={value => { setScope(value); setSelectedId(null); }}/>}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 4 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: pigeon.configured && pigeon.connected ? colors.green : colors.faint }}/><Txt style={{ color: colors.muted, fontSize: 10 }}>{!pigeon.configured ? 'Illustration · not live traffic' : pigeon.loading ? 'Looking for pigeons…' : !pigeon.connected ? 'Reconnecting · last-known sky' : `${total} ${total === 1 ? 'pigeon' : 'pigeons'} in the ${scope === 'mine' ? 'personal' : 'public'} sky`}</Txt></View></View>
            {large && <View pointerEvents="none" style={{ alignItems: 'flex-end', gap: 9 }}><Eyebrow style={{ fontSize: 9 }}>THE WORLD, AT PIGEON PACE</Eyebrow><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="globe" size={12} color={colors.muted}/><Txt style={{ fontSize: 10, color: colors.muted }}>City-to-city. Never your live location.</Txt></View></View>}
          </View>
          {!pigeon.configured && large && <View pointerEvents="none" style={{ position: 'absolute', top: '40%', left: '41%', transform: [{ rotate: '-5deg' }], backgroundColor: '#FFFFFFD9', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 }}><Txt style={{ fontSize: 9, color: colors.muted, fontFamily: mono }}>taking the scenic route</Txt></View>}
          <View pointerEvents="box-none" style={[styles.mapBottom, !large && { padding: 16, gap: 12, flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={[styles.postcard, !large && { width: '100%', padding: 16 }, shadow]}>
              <View style={styles.airmail}/>
              {selected ? <><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Bird size={57} outfit={selected.outfit}/><View style={{ flex: 1, gap: 5 }}><Txt style={{ fontSize: 16, fontWeight: '600' }}>{selected.courier}</Txt><Txt style={{ fontSize: 11, color: colors.muted }}>{selected.origin.name} → {selected.destination.name}</Txt></View><Badge label={selected.defense === 'zigzag' ? 'Zigzag' : 'Cruise'} tone="paper"/></View><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14 }}><Txt style={{ fontFamily: mono, fontSize: 11, color: colors.muted }}>{selected.demo ? 'Demo · ' : ''}{pigeon.serverNow >= selected.arrivesAt ? 'Confirming arrival' : `${formatDuration((selected.arrivesAt - pigeon.serverNow) / 1000)} to go`}</Txt><Pressable accessibilityRole="button" onPress={() => router.push(publicView && selected.shareToken ? `/f/${selected.shareToken}` : `/flight/${selected.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}><Txt style={{ color: colors.blue, fontSize: 12, fontWeight: '600' }}>Track flight</Txt><Icon name="arrow" size={14} color={colors.blue}/></Pressable></View></>
                : <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}><Envelope size={58}/><View style={{ flex: 1, gap: 5 }}><Txt style={{ fontSize: 15, fontWeight: '600' }}>{scope === 'mine' && !pigeon.authenticated ? 'Your sky is waiting.' : flights.length ? 'Every bird has a story.' : 'No birds up yet.'}</Txt><Txt style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{scope === 'mine' && !pigeon.authenticated ? 'Make a nest to follow your own letters.' : flights.length ? 'Tap a pigeon. See where it’s headed.' : 'Start some drama. Send a little hello.'}</Txt></View></View>}
            </View>
            <Button label="Send a pigeon" icon="plus" onPress={send} style={{ minHeight: 56, borderRadius: 16, paddingHorizontal: 26, ...shadow }}/>
          </View>
          {pigeon.demo && <View pointerEvents="none" style={{ position: 'absolute', top: large ? 78 : 80, right: 18 }}><Badge label="Demo speed · isolated sky" tone="paper"/></View>}
        </View>
        <View style={[styles.below, !large && { flexDirection: 'column', alignItems: 'flex-start', gap: 24 }]}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={13} color="#9B8D6B"/></View><Txt style={{ fontSize: 11, color: colors.muted }}>Not everything needs to get there right now.</Txt></View>
          <View style={{ flexDirection: 'row', gap: large ? 30 : 18 }}>{[{ n: '01', text: 'Write a little' }, { n: '02', text: 'Let it fly' }, { n: '03', text: 'See what happens' }].map(step => <View key={step.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Txt style={{ fontSize: 9, fontFamily: mono, color: '#A0ADAE' }}>{step.n}</Txt><Txt style={{ fontSize: 10, color: colors.muted }}>{step.text}</Txt></View>)}</View>
        </View>
        {!publicView && pigeon.authenticated && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}><Txt style={{ fontSize: 11, color: colors.muted }}>{pigeon.demo ? 'Demo time is accelerated, never disguised.' : 'Real distances. Real anticipation.'}</Txt><Pressable accessibilityRole="switch" aria-checked={pigeon.demo} accessibilityState={{ checked: pigeon.demo }} onPress={() => pigeon.setDemo(!pigeon.demo)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44 }}><Txt style={{ fontSize: 11, color: colors.muted }}>Demo time</Txt><View style={{ width: 30, height: 18, backgroundColor: pigeon.demo ? colors.blue : '#D3DDDF', borderRadius: 9, padding: 3, alignItems: pigeon.demo ? 'flex-end' : 'flex-start' }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.white }}/></View></Pressable></View>}
        {!publicView && pigeon.authenticated && pigeon.profile?.demo && <View style={{ gap: 12, marginTop: 12 }}><Button label="Reset demo flights" icon="clock" variant="secondary" small busy={demoAction.busy} disabled={!pigeon.connected} onPress={() => setConfirmReset(!confirmReset)} style={{ alignSelf: 'flex-start' }}/>{confirmReset && <View style={{ padding: 20, backgroundColor: colors.paper, borderRadius: 16, gap: 16 }}><Txt style={{ fontSize: 13, lineHeight: 21 }}>Reset only your isolated demo flights and prepare fresh sample pigeons? This does not touch normal accounts, normal letters, or verified purchases. Existing demo catches and letters will be cleared.</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Reset my isolated demo" busy={demoAction.busy} disabled={!pigeon.connected} onPress={() => demoAction.run(async () => { await pigeon.resetDemo(); await pigeon.seedDemo(); pigeon.setDemo(true); setSelectedId(null); setConfirmReset(false); }, 'Fresh sample pigeons are in your isolated demo sky.')}/><Button label="Keep my flights" variant="ghost" onPress={() => setConfirmReset(false)}/></View></View>}</View>}
        {publicView && <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><Txt style={{ fontSize: 11, color: colors.muted }}>{pigeon.demo ? 'Accelerated, isolated demo flights only.' : 'Normal-speed public flights only.'}</Txt><Segments value={pigeon.demo ? 'demo' : 'normal'} items={[{ label: 'Live sky', value: 'normal' }, { label: 'Demo sky', value: 'demo' }]} onChange={value => { pigeon.setDemo(value === 'demo'); router.setParams({ demo: value === 'demo' ? '1' : '0' }); setSelectedId(null); }}/></View><Txt style={{ fontSize: 11, lineHeight: 19, color: colors.muted }}>Only explicitly shared Open Skies routes appear here. Letters, recipients, and Sealed flights stay private.</Txt></View>}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, body: { maxWidth: 1536, width: '100%', alignSelf: 'center' },
  intro: { paddingTop: 34, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  headline: { fontSize: 49, lineHeight: 53, fontWeight: '700', letterSpacing: -2.2 },
  map: { borderRadius: 24, backgroundColor: colors.sky, borderWidth: 1, borderColor: '#DCEAF2', overflow: 'hidden' },
  mapTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 24 },
  mapBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 },
  postcard: { width: 350, backgroundColor: '#FFFEF9', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E4E8DE', overflow: 'hidden' },
  airmail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#A8BCEE' },
  below: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 24 },
});
