import { registerRootComponent } from 'expo';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ShopEntry, ShopExit, ShopGateway, ShopOrder } from '../../src/shop';
import { Page03Fonts, Icon } from '../page03/atoms';
import { SkyMap, atlanticLand } from '../page03/MapScreen';
import { Shop } from './Shop';
import { createPreviewGateway } from './previewGateway';

function Preview() {
  const params = useMemo(() => Platform.OS === 'web' ? new URL(window.location.href).searchParams : new URLSearchParams(), []);
  const fixture = useMemo(() => createPreviewGateway(params.get('balance') === 'low' ? 20 : 120), [params]);
  const [draft, setDraft] = useState({ recipient: 'Sammy', message: 'Meet me for coffee when this finally lands?\n\n— Ethan', anonymous: false });
  const [selectedBirdId, setSelectedBirdId] = useState('preview-mochi');
  const [page, setPage] = useState<'home' | 'compose' | 'shop'>(params.has('screen') ? 'shop' : 'home');
  const [entry, setEntry] = useState<ShopEntry>(() => params.get('screen') === 'scarf' ? { from: 'item', itemId: 'cloud-scarf', selectedBirdId: 'preview-button' } : params.get('screen') === 'owned' ? { from: 'item', itemId: 'sunday-cap', selectedBirdId: 'preview-button' } : params.get('screen') === 'stones' ? { from: 'sky' } : params.get('screen') === 'coop' ? { from: 'home' } : { from: 'shop' });
  const unavailable: ShopGateway = useMemo(() => ({
    scopeKey: 'unavailable-test-preview',
    read: async () => ({ revision: 'unavailable', source: 'server', birds: [], points: null, inventory: [], serverNow: Date.now(), capabilities: { accessories: false, boosters: false, stones: false, checkout: false, reason: 'The canonical flock and approved sandbox catalog are not connected. No payment has been started.' } }),
    mutate: async () => { throw new Error('Unavailable'); }, checkout: async () => { throw new Error('Unavailable'); }, order: async () => null, openCheckout: async () => { throw new Error('Unavailable'); },
  }), []);
  function open(next: ShopEntry) { setEntry(next); setPage('shop'); }
  function exit(result: ShopExit) {
    if (result.to === 'compose') {
      if (result.confirmed && result.selectedBirdId) setSelectedBirdId(result.selectedBirdId);
      setPage('compose');
    } else setPage('home');
  }
  function paymentControls(order: ShopOrder) {
    return order.status === 'pending' ? <View style={{ gap: 8 }}><Text style={styles.small}>TEST ONLY · choose a simulated provider result, then check payment status.</Text><View style={styles.controls}>{(['paid', 'canceled', 'failed', 'reconciliation', 'refunded'] as const).map(status => <Pressable key={status} accessibilityRole="button" accessibilityLabel={`Simulate ${status}`} onPress={() => fixture.settle(order.id, status)} style={styles.simulate}><Text style={styles.small}>{status}</Text></Pressable>)}</View></View> : null;
  }
  return <View style={styles.root}>{page === 'shop' ? <Shop entry={entry} gateway={params.get('screen') === 'setup' ? unavailable : fixture.gateway} onExit={exit} previewPaymentControls={paymentControls} /> : page === 'home' ? <View style={styles.phone}><SkyMap data={{ land: atlanticLand, viewBox: '0 0 390 400', routes: [{ path: 'M70 210 Q180 100 302 125', endpoints: [{ x: 70, y: 210 }, { x: 302, y: 125 }] }], labels: [{ text: 'NEW YORK', x: 24, y: 245 }, { text: 'LONDON', x: 285, y: 100 }, { text: 'ATLANTIC', x: 140, y: 320, ocean: true }], markers: [] }} /><Text style={styles.banner}>TEST PREVIEW · no real flights or payments</Text><View style={styles.wordmark}><Text style={styles.brand}>pigeon<Text style={{ color: '#2453FF' }}>.</Text></Text><Icon name="more" /></View><View style={styles.scope}><Text style={styles.selectedTab}>My flights</Text><Text style={styles.tab}>World</Text></View><View style={styles.shortcuts}><Pressable accessibilityRole="button" accessibilityLabel="Open coop" onPress={() => open({ from: 'home', selectedBirdId })} style={styles.circle}><Text style={{ color: '#2453FF', fontSize: 26 }}>⌂</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Preview mail" onPress={() => setPage('compose')} style={styles.circle}><Icon name="mail" /></Pressable></View><View style={styles.dock}><Text style={styles.heading}>3 flights in your sky</Text><Text style={styles.body}>2 sent · 1 on its way to you · sample data</Text><Pressable accessibilityRole="button" accessibilityLabel="Send a pigeon" onPress={() => setPage('compose')} style={styles.primary}><Text style={styles.buttonText}>Send a pigeon</Text><Icon name="arrow" color="white" /></Pressable><Pressable accessibilityRole="button" onPress={() => open({ from: 'sky' })}><Text style={styles.link}>Preview stone refill →</Text></Pressable></View></View> : <ScrollView contentContainerStyle={styles.composer}><Text style={styles.banner}>TEST PREVIEW · letters stay on this screen</Text><Pressable accessibilityRole="button" onPress={() => setPage('home')}><Icon name="back" /></Pressable><Text style={styles.heading}>New letter</Text><Text style={styles.small}>TO</Text><TextInput accessibilityLabel="Recipient" value={draft.recipient} onChangeText={recipient => setDraft(current => ({ ...current, recipient }))} style={styles.input} /><TextInput accessibilityLabel="Message" multiline value={draft.message} onChangeText={message => setDraft(current => ({ ...current, message }))} style={[styles.input, { minHeight: 200, textAlignVertical: 'top' }]} /><View style={styles.between}><Text style={styles.body}>Send anonymously</Text><Switch accessibilityLabel="Send anonymously" value={draft.anonymous} onValueChange={anonymous => setDraft(current => ({ ...current, anonymous }))} /></View><Text style={styles.heading}>Send with {selectedBirdId === 'preview-button' ? 'Button' : 'Mochi'}</Text><Pressable accessibilityRole="button" accessibilityLabel="View coop" onPress={() => open({ from: 'compose', draftKey: 'preview-letter', selectedBirdId })}><Text style={styles.link}>View coop →</Text></Pressable><Text style={styles.small}>The host owns this draft. Visiting the coop never sends it.</Text></ScrollView>}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E9EEF4' }, phone: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#EAF1F7' },
  banner: { backgroundColor: '#EEF2FF', color: '#3451A8', padding: 6, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 14 },
  wordmark: { paddingHorizontal: 28, paddingTop: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { fontFamily: 'Outfit_800ExtraBold', fontSize: 36, letterSpacing: -1.5 },
  scope: { alignSelf: 'center', backgroundColor: 'white', borderRadius: 30, flexDirection: 'row', marginTop: 24, padding: 4 }, selectedTab: { backgroundColor: '#2453FF', color: 'white', borderRadius: 24, overflow: 'hidden', paddingVertical: 12, paddingHorizontal: 20, fontFamily: 'Inter_600SemiBold' }, tab: { paddingVertical: 12, paddingHorizontal: 20, color: '#566273', fontFamily: 'Inter_400Regular' },
  shortcuts: { position: 'absolute', bottom: 230, right: 24, flexDirection: 'row', gap: 10 }, circle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12 }, heading: { fontFamily: 'Outfit_600SemiBold', fontSize: 27, lineHeight: 34, letterSpacing: -.6 }, body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: '#566273' }, small: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, color: '#566273' },
  primary: { backgroundColor: '#2453FF', borderRadius: 28, padding: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 }, buttonText: { color: 'white', fontFamily: 'Inter_600SemiBold', fontSize: 16 }, link: { color: '#2453FF', fontFamily: 'Inter_600SemiBold', fontSize: 14, paddingVertical: 10 },
  composer: { backgroundColor: 'white', padding: 24, gap: 20, flexGrow: 1, maxWidth: 480, width: '100%', alignSelf: 'center' }, input: { borderWidth: 1, borderColor: '#DEE5EE', borderRadius: 18, padding: 18, color: '#17212B', fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, simulate: { borderWidth: 1, borderColor: '#CAD5EC', borderRadius: 10, padding: 8 },
});

function PreviewRoot() { return <SafeAreaProvider><Page03Fonts><Preview /></Page03Fonts></SafeAreaProvider>; }
registerRootComponent(PreviewRoot);
