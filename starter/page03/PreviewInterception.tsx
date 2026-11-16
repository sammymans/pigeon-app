import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import { canIntercept } from '../../src/interception';
import { a, Copy, font, Handle, Icon, IconButton, PageFrame, PageHeader, palette, PrimaryButton, usePageInsets } from './atoms';
import { InterceptionGame, Stone } from './InterceptionGame';
import { PigeonMarker } from './PigeonMarker';

const letters = [
  { id: 'world-wren', courier: 'Wren', from: 'london', to: 'new-york', progress: 0.58, personId: 'alex', name: 'Alex', body: 'I took the long way home today.\n\nFound a tiny bookshop, got caught in the rain, and had the best coffee of my life.\n\nA good reminder that getting a little lost is sometimes the whole point.' },
  { id: 'world-basil', courier: 'Basil', from: 'paris', to: 'chicago', progress: 0.34, personId: 'jules', name: 'Jules', body: 'A small dispatch from Paris:\n\nThe bakery on the corner finally learned my order. I think that means I live here now.\n\nHope something small made you smile today, too.' },
  { id: 'world-pebble', courier: 'Pebble', from: 'san-francisco', to: 'london', progress: 0.55, personId: 'robin', name: 'Robin', body: 'If this reaches a stranger, hello stranger.\n\nWhat’s one thing in your city that you’d miss if you left?\n\nMine is the fog. I know. I’m surprised too.' },
];

export function sampleWorldFlights(now: number): FlightSummary[] {
  return letters.map(letter => ({ id: letter.id, courier: letter.courier, origin: cityById(letter.from), destination: cityById(letter.to), role: 'public', visibility: 'open', defense: 'cruise', outfit: 'classic', state: 'in_flight', demo: true, attemptCount: 0, distanceKm: distanceKm(cityById(letter.from), cityById(letter.to)), departedAt: now - letter.progress * 14_400_000, arrivesAt: now + (1 - letter.progress) * 14_400_000 }));
}

export type PreviewCatch = { id: string; personId: string; body: string; courier: string; at: number };

export function usePreviewInterception(stones: number, onSpendStone: () => void, onCapture: (letter: PreviewCatch) => void, onGetStones?: () => void, onOpened?: (id: string) => void) {
  const [worldFlights, setWorldFlights] = useState(() => sampleWorldFlights(Date.now()));
  const [attempted, setAttempted] = useState<string[]>([]);
  const [selected, setSelected] = useState<FlightSummary | null>(null);
  const [stage, setStage] = useState<'map' | 'game' | 'letter'>('map');
  const [caught, setCaught] = useState<string[]>([]);
  const clear = () => { setSelected(null); setStage('map'); };
  const reset = () => { clear(); setAttempted([]); setCaught([]); setWorldFlights(sampleWorldFlights(Date.now())); };
  const eligible = selected && canIntercept(selected, attempted, stones, Date.now());
  const reason = !selected ? '' : selected.role !== 'public' ? selected.role === 'sender' ? 'This pigeon is carrying your letter.' : 'This pigeon is bringing a letter to you.' : attempted.includes(selected.id) ? 'You already tried this pigeon. Give another one a go.' : stones < 1 ? 'Your pouch is empty. Visit the coop shop for more stones.' : 'Two shots. One hit catches the letter.';
  const start = () => {
    if (!selected || !canIntercept(selected, attempted, stones, Date.now())) return;
    setAttempted(previous => [...previous, selected.id]); setStage('game');
  };
  const letter = letters.find(item => item.id === selected?.id);
  const surface = stage === 'game' && selected ? <InterceptionGame key={selected.id} pigeon={selected.courier} stones={stones} onSpendStone={onSpendStone} onCaught={() => {
    if (!letter || caught.includes(selected.id)) return;
    setCaught(previous => [...previous, selected.id]);
    setWorldFlights(previous => previous.filter(flight => flight.id !== selected.id));
    onCapture({ id: selected.id, personId: letter.personId, body: letter.body, courier: selected.courier, at: Date.now() });
  }} onClose={clear} onOpenLetter={() => { if (letter) { onOpened?.(letter.id); setStage('letter'); } }} /> : stage === 'letter' && letter && selected && caught.includes(selected.id) ? <CaughtPreviewLetter name={letter.name} body={letter.body} pigeon={selected.courier} onClose={clear} /> : null;
  return { worldFlights, stones, selected, select: (flight: FlightSummary) => { setSelected(flight); setStage('map'); }, clear, reset, surface,
    sheet: selected && stage === 'map' ? <FlightInterceptSheet flight={selected} stones={stones} available={Boolean(eligible)} reason={reason} onGetStones={onGetStones} onClose={clear} onIntercept={start} /> : null };
}

export function FlightInterceptSheet({ flight, stones, available, reason, onClose, onIntercept, onGetStones }: { flight: FlightSummary; stones: number; available: boolean; reason: string; onClose: () => void; onIntercept: () => void; onGetStones?: () => void }) {
  const insets = usePageInsets();
  return <View style={[a.sheet, { paddingBottom: insets.bottom, gap: 16 }]}>
    <Handle label="Close pigeon details" onPress={onClose} />
    <View style={a.between}><View style={[a.row, { gap: 12 }]}><View style={styles.pigeon}><PigeonMarker size={32} /></View><View style={{ gap: 4 }}><Text style={[a.heading, { fontSize: 24 }]}>{flight.courier}’s passing by.</Text><Text style={styles.eyebrow}>{flight.role === 'public' ? 'A STRANGER’S PIGEON' : 'IN YOUR SKY'}</Text></View></View><IconButton name="close" label="Close pigeon details" onPress={onClose} /></View>
    <View style={a.between}><Copy style={{ fontSize: 12 }}>{flight.origin.name} → {flight.destination.name}</Copy><View style={[a.row, { gap: 6 }]}><Stone size={14} /><Copy style={{ fontSize: 12 }}>{stones} stones</Copy></View></View>
    <Copy>{reason}</Copy>
    <PrimaryButton label={flight.role === 'public' ? 'Intercept' : 'Back to sky'} disabled={flight.role === 'public' && !available} onPress={flight.role === 'public' ? onIntercept : onClose} />
    {stones < 1 && onGetStones && <PrimaryButton label="Get more stones" onPress={onGetStones} />}
    {flight.role === 'public' && <Copy style={{ fontSize: 11, textAlign: 'center' }}>1 stone per shot · the letter stays closed until you catch it</Copy>}
  </View>;
}

export function WorldSkySheet({ flights, stones, onSelect, onGetStones }: { flights: FlightSummary[]; stones: number; onSelect: (flight: FlightSummary) => void; onGetStones?: () => void }) {
  const insets = usePageInsets();
  return <View style={[a.sheet, { paddingBottom: insets.bottom, gap: 12 }]}>
    <View style={a.between}><Text style={[a.heading, { fontSize: 23 }]}>A little world of hellos</Text><View style={[a.row, { gap: 6 }]}><Stone size={14} /><Copy>{stones}</Copy>{onGetStones && <Pressable accessibilityRole="button" accessibilityLabel="Get more stones" onPress={onGetStones} hitSlop={10}><Icon name="plus" color={palette.blue} size={18} /></Pressable>}</View></View>
    <Copy style={{ fontSize: 12 }}>Tap a pigeon on the map. See where chance takes you.</Copy>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{flights.map(flight => <Pressable key={flight.id} accessibilityRole="button" accessibilityLabel={`Meet ${flight.courier}, a pigeon you can intercept`} onPress={() => onSelect(flight)} style={styles.flightChip}><PigeonMarker size={24} /><Text style={[a.body, { color: palette.blue, fontWeight: '600' }]}>{flight.courier}</Text><Icon name="arrow" size={15} color={palette.blue} /></Pressable>)}</ScrollView>
    {!flights.length && <Copy>All caught up. Your unexpected hellos are in your postbox.</Copy>}
  </View>;
}

function CaughtPreviewLetter({ name, body, pigeon, onClose }: { name: string; body: string; pigeon: string; onClose: () => void }) {
  const insets = usePageInsets();
  return <PageFrame style={{ paddingTop: insets.top }}><PageHeader title="An unexpected hello" onClose={onClose} /><ScrollView contentContainerStyle={{ padding: 26, paddingBottom: insets.bottom, gap: 26 }}><Text style={styles.eyebrow}>CAUGHT LETTER · DELIVERED BY {pigeon.toUpperCase()}</Text><View style={styles.letter}><Text selectable style={styles.letterBody}>{body}</Text><Text style={[styles.letterBody, { color: palette.blue }]}>— {name}</Text></View><Copy>This letter is saved in your postbox. You can reply from there.</Copy><PrimaryButton label="Back to sky" onPress={onClose} /><Copy style={{ fontSize: 11, textAlign: 'center' }}>Sample letter · design preview</Copy></ScrollView></PageFrame>;
}

const styles = StyleSheet.create({
  pigeon: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.pale, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: font.system, fontSize: 9, fontWeight: '600', letterSpacing: 1.2, color: palette.muted },
  flightChip: { minHeight: 46, paddingHorizontal: 13, backgroundColor: '#F0F4FF', borderRadius: 23, flexDirection: 'row', alignItems: 'center', gap: 7 },
  letter: { borderRadius: 22, backgroundColor: '#F5F7FB', padding: 26, gap: 24 },
  letterBody: { fontFamily: font.regular, fontSize: 23, lineHeight: 34, color: palette.ink },
});
