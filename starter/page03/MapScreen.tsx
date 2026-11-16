import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { FlightSummary } from '../../src/domain';
import { flightStatus } from '../letterModel';
import { FlightMap } from '../map/FlightMap';
import { PaperPigeon } from '../PaperPigeon';
import { a, Copy, font, Handle, Icon, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';

type Props = {
  flights: FlightSummary[];
  selected: string | null;
  serverNow: number | null;
  scope: 'mine' | 'world';
  onScope: (scope: 'mine' | 'world') => void;
  onSelect: (id: string | null) => void;
  onInbox?: () => void;
  onMenu?: () => void;
  onOpenLetter?: (id: string) => void;
  onSend: () => void;
  action?: string;
  sendDisabled?: boolean;
  loading?: boolean;
  connected?: boolean;
  clockError?: boolean;
  title?: string;
  subtitle?: string;
  notice?: ReactNode;
};

export function MapScreen({ flights, selected, serverNow, scope, onScope, onSelect, onInbox, onMenu, onOpenLetter, onSend, action = 'Send a pigeon', sendDisabled, loading = false, connected = true, clockError = false, title, subtitle, notice }: Props) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(Platform.OS === 'web');
  const [height, setHeight] = useState(844);
  const [headerHeight, setHeaderHeight] = useState(200);
  const [sheetHeight, setSheetHeight] = useState(230);
  const [fitRequest, setFitRequest] = useState(0);
  const selectedFlight = flights.find(flight => flight.id === selected);
  const outgoing = flights.filter(flight => flight.role === 'sender').length;
  const incoming = flights.filter(flight => flight.role === 'recipient').length;
  const stale = !connected || clockError;
  const heading = title ?? (loading ? 'Finding your flights…' : flights.length ? `${flights.length} ${flights.length === 1 ? 'flight' : 'flights'} in ${scope === 'mine' ? 'your' : 'the'} sky` : scope === 'mine' ? 'Your sky is quiet' : 'A quiet patch of sky');
  const summary = subtitle ?? (scope === 'mine' ? `${outgoing} sent · ${incoming} on its way to you` : 'Recent Open Skies flights · up to 30 shown');
  const sheetLimit = Math.max(160, height - headerHeight - 110);
  const drag = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => { if (gesture.dy < -20) setExpanded(true); else if (gesture.dy > 20) setExpanded(false); },
  }), []);

  useEffect(() => { if (selected && !selectedFlight && !loading) onSelect(null); }, [selected, selectedFlight, loading, onSelect]);

  function select(id: string) {
    onSelect(id);
    setExpanded(false);
  }

  return <PageFrame style={{ backgroundColor: palette.water }}>
    <View style={styles.screen} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      <View style={[styles.map, { top: headerHeight - 28, bottom: sheetHeight - 28 }]}>
        <FlightMap flights={flights} selected={selectedFlight?.id ?? null} serverNow={stale ? null : serverNow} scope={scope} fitRequest={fitRequest} onSelect={select} />
      </View>
      <View pointerEvents="none" style={[styles.fade, { top: headerHeight - 28 }]}><Svg width="100%" height={58}><Defs><LinearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="white" /><Stop offset="1" stopColor="white" stopOpacity={0} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#mapFade)" /></Svg></View>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top) + 6 }]} onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
        <View style={styles.brandRow}><Text accessibilityLabel="Pigeon" style={styles.brand}>pigeon<Text style={{ color: palette.blue }}>.</Text></Text><IconButton name="more" label="Account and settings" onPress={onMenu} /></View>
        <View style={styles.toolbar}>
          <View accessibilityRole="tablist" style={styles.tabs}>{([['mine', 'My flights'], ['world', 'World']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: scope === value }} onPress={() => { onScope(value); onSelect(null); }} style={[styles.tab, scope === value && styles.activeTab]}><Text style={[a.body, styles.tabText, scope === value && styles.activeTabText]}>{label}</Text></Pressable>)}</View>
          <IconButton name="mail" label="Open your postbox" round onPress={onInbox} />
        </View>
      </View>
      {Platform.OS !== 'web' && <View pointerEvents="box-none" style={[styles.mapTools, { bottom: sheetHeight + 8 }]}>
        <View pointerEvents="none" style={styles.caption}><Text style={styles.captionText}>{stale ? 'Offline · routes only' : serverNow === null && flights.length ? 'Syncing clock · routes only' : 'City routes · not GPS'}</Text></View>
        <IconButton name="nearby" label={selectedFlight ? 'Fit selected flight' : flights.length ? 'Fit all flights' : 'Reset world view'} round onPress={() => setFitRequest(value => value + 1)} />
      </View>}
      <View onLayout={event => setSheetHeight(event.nativeEvent.layout.height)} style={[styles.sheet, { paddingBottom: Math.max(12, insets.bottom), maxHeight: sheetLimit }, expanded && { height: Math.min(sheetLimit, Math.max(320, height * 0.51)) }]}>
        <View {...drag.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse flight list' : 'Expand flight list'} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.handleTarget}><View style={styles.handle} /></Pressable></View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.sheetContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={styles.summaryRow}><View style={styles.summaryText}><Text accessibilityRole="header" style={styles.heading}>{expanded ? heading : selectedFlight ? `${selectedFlight.courier} is on the wing` : heading}</Text>{!selectedFlight || expanded ? <Text style={styles.subtitle}>{summary}</Text> : null}</View><IconButton name={selectedFlight && !expanded ? 'close' : expanded ? 'close' : 'more'} label={selectedFlight && !expanded ? 'Clear selected flight' : expanded ? 'Collapse flight list' : 'Browse flights'} onPress={() => { if (selectedFlight && !expanded) onSelect(null); else setExpanded(value => !value); }} /></View>
          {stale && <Text accessibilityRole="alert" style={styles.status}>Reconnecting. Routes may be out of date; live positions and countdowns are paused.</Text>}
          {notice}
          {selectedFlight && !expanded ? <View style={styles.selection}>
            <View style={styles.routeRow}><View style={styles.bird}><PaperPigeon size={44} /></View><View style={{ flex: 1 }}><Text style={styles.route}>{selectedFlight.origin.name} → {selectedFlight.destination.name}</Text><Text style={styles.subtitle}>{selectedFlight.visibility === 'sealed' ? 'Sealed · private flight' : 'Open Skies'}{selectedFlight.demo ? ' · Demo speed' : ''}</Text></View></View>
            <Text style={styles.status}>{stale || serverNow === null ? 'Waiting for the server clock' : flightStatus(selectedFlight, serverNow)}</Text>
            {scope === 'mine' && onOpenLetter && <Pressable accessibilityRole="button" onPress={() => onOpenLetter(selectedFlight.id)} style={styles.textButton}><Text style={styles.link}>Open letter details</Text><Icon name="arrow" color={palette.blue} size={18} /></Pressable>}
          </View> : expanded ? <>
            {flights.length === 0 && !loading && <Text style={styles.empty}>{scope === 'mine' ? 'No pigeons are flying right now. Send a letter to an accepted friend, or check your postbox for past journeys.' : 'No Open Skies flights are available right now. Private letters never appear here.'}</Text>}
            {flights.map(flight => <Pressable key={flight.id} accessibilityRole="button" accessibilityLabel={`Select ${flight.courier}, ${flight.origin.name} to ${flight.destination.name}`} accessibilityState={{ selected: flight.id === selected }} onPress={() => select(flight.id)} style={[styles.flightRow, flight.id === selected && styles.selectedRow]}><PaperPigeon size={42} /><View style={{ flex: 1 }}><Text style={styles.route}>{flight.origin.name} → {flight.destination.name}</Text><Text style={styles.subtitle}>{flight.courier} · {flight.visibility === 'sealed' ? 'Sealed' : 'Open Skies'}{flight.demo ? ' · Demo speed' : ''}</Text></View><Icon name="arrow" size={17} color={palette.muted} /></Pressable>)}
          </> : null}
        </ScrollView>
        <View style={styles.send}><PrimaryButton label={action} arrow onPress={onSend} disabled={sendDisabled} /></View>
      </View>
    </View>
  </PageFrame>;
}

export type FlockBird = { id: string; name: string; status: string; color: string; egg?: boolean; speed?: string; deliveries?: string; defense?: string };
export function FlockSheet({ birds, selected, summary, hatchery, onSelect, onClose, onSend, onShop, onHatchery, unavailable }: { birds: FlockBird[]; selected: string | null; summary: string; hatchery?: string; onSelect: (id: string) => void; onClose: () => void; onSend?: () => void; onShop?: () => void; onHatchery?: () => void; unavailable?: string }) {
  const { bottom } = usePageInsets();
  const bird = birds.find(item => item.id === selected);
  return <View style={[a.sheet, { height: 514 + Math.max(0, bottom - 30), maxHeight: '78%', paddingBottom: bottom }]}><Handle onPress={onClose} label="Collapse your flock" /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 16 }}><View style={[a.between, { alignItems: 'baseline' }]}><Text style={a.heading}>Your flock</Text><Copy style={{ fontSize: 13, lineHeight: 16 }}>{summary}</Copy></View><View style={m.flockRow}>{birds.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${item.status}`} accessibilityState={{ checked: selected === item.id }} onPress={() => onSelect(item.id)} style={m.bird}><View style={[m.birdRing, { borderColor: selected === item.id ? palette.blue : item.egg ? '#9CAABE' : 'transparent', borderStyle: item.egg ? 'dashed' : 'solid', borderWidth: item.egg ? 1 : 2 }]}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: item.color }} /></View><Text style={[a.small, { fontWeight: '600', color: '#000' }]}>{item.name}</Text><Text style={[a.small, { fontSize: 10, lineHeight: 12 }]}>{item.status}</Text></Pressable>)}</View><View style={m.birdDetails}><View style={a.between}><Copy style={{ color: '#000', fontSize: 16, lineHeight: 20, fontWeight: '600' }}>{bird?.name ?? 'Your pigeons'}</Copy><Copy style={{ fontSize: 12, lineHeight: 16, color: palette.blue }}>{bird?.status === 'Ready' ? 'Ready to fly' : bird?.status ?? 'Unavailable'}</Copy></View><View style={a.between}>{bird ? [bird.speed, bird.deliveries, bird.defense].map((value, i) => <Copy key={i} style={{ fontSize: 13, lineHeight: 16 }}>{value}</Copy>) : <Copy style={{ fontSize: 12, lineHeight: 16 }}>{unavailable ?? 'Flock data is not connected to this build.'}</Copy>}</View></View><View style={[a.between, { paddingHorizontal: 2 }]}><View style={{ gap: 5 }}><Copy style={{ color: '#000', fontWeight: '600' }}>Hatchery</Copy><Copy style={{ fontSize: 12, lineHeight: 16 }}>{hatchery ?? 'Not available in this build'}</Copy></View><Pressable accessibilityRole="button" accessibilityLabel="Visit hatchery" accessibilityState={{ disabled: !onHatchery }} disabled={!onHatchery} onPress={onHatchery}><Copy style={{ color: onHatchery ? palette.blue : palette.muted, fontWeight: '600' }}>Visit →</Copy></Pressable></View><View style={[a.between, { borderTopWidth: 1, borderColor: '#E8EDF4', paddingTop: 14 }]}><Copy>Pigeons & defenses</Copy><Pressable accessibilityRole="button" accessibilityLabel="Open shop" accessibilityState={{ disabled: !onShop }} disabled={!onShop} onPress={onShop}><Copy style={{ color: onShop ? palette.blue : palette.muted, fontWeight: '600' }}>Shop →</Copy></Pressable></View><PrimaryButton label={bird ? `Send with ${bird.name}` : 'Send a pigeon'} compact onPress={onSend} /></ScrollView></View>;
}

export function SentSheet({ pigeon = 'Your pigeon', to, estimate, explanation, onHome }: { pigeon?: string; to: string; estimate: string; explanation: string; onHome: () => void }) {
  const { bottom } = usePageInsets();
  return <View style={[a.sheet, { minHeight: 250, paddingBottom: bottom + 12, gap: 12 }]}><Handle /><View style={[a.row, { gap: 9 }]}><Icon name="check" color={palette.blue} size={21} /><Text style={a.heading}>{pigeon}’s on the way.</Text></View><View style={a.between}><Copy>{to}</Copy><Copy style={{ color: '#000', fontWeight: '600' }}>{estimate}</Copy></View><Copy style={{ fontSize: 13, lineHeight: 20, color: palette.muted }}>{explanation}</Copy><PrimaryButton label="Back to my flights" compact onPress={onHome} /></View>;
}

const m = StyleSheet.create({
  flockRow: { flexDirection: 'row', minHeight: 92, justifyContent: 'space-between', gap: 4 },
  bird: { alignItems: 'center', flex: 1, gap: 5 },
  birdRing: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  birdDetails: { borderRadius: 18, backgroundColor: '#F4F7FC', paddingVertical: 15, paddingHorizontal: 16, gap: 10 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { position: 'absolute', left: 0, right: 0 },
  fade: { position: 'absolute', height: 58, left: 0, right: 0 },
  header: { backgroundColor: 'white', paddingHorizontal: 24, paddingBottom: 28 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  brand: { fontFamily: font.brand, fontSize: 40, lineHeight: 48, letterSpacing: -2, color: palette.ink },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, gap: 12 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 28, backgroundColor: '#EEF1F5' },
  tab: { minHeight: 44, paddingHorizontal: 17, borderRadius: 24, justifyContent: 'center' },
  activeTab: { backgroundColor: palette.ink },
  tabText: { fontSize: 15, fontWeight: '500' },
  activeTabText: { color: 'white', fontWeight: '600' },
  mapTools: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  caption: { backgroundColor: '#FFFFFFE8', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 9, flexShrink: 1 },
  captionText: { color: palette.secondary, fontSize: 11, lineHeight: 15 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'white', boxShadow: '0 -4px 24px rgba(23,33,43,0.05)' },
  handleTarget: { height: 44, justifyContent: 'center', alignItems: 'center' },
  handle: { height: 4, width: 40, borderRadius: 3, backgroundColor: '#C5CDD7' },
  sheetContent: { paddingHorizontal: 24, gap: 10, paddingBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  summaryText: { flex: 1, gap: 4 },
  heading: { fontFamily: font.heading, fontSize: 21, lineHeight: 26, letterSpacing: -0.3, color: palette.ink },
  subtitle: { fontSize: 12, lineHeight: 18, color: palette.muted },
  status: { fontSize: 12, lineHeight: 18, color: palette.secondary },
  empty: { fontSize: 14, lineHeight: 21, color: palette.muted, paddingVertical: 12 },
  selection: { gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bird: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.pale, alignItems: 'center', justifyContent: 'center' },
  route: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: palette.ink },
  textButton: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: palette.blue },
  flightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, borderRadius: 12 },
  selectedRow: { backgroundColor: palette.pale },
  send: { paddingHorizontal: 24, paddingTop: 12 },
});
