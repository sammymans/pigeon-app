import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cityById, distanceKm, type FlightSummary } from '../../src/domain';
import { canIntercept } from '../../src/interception';
import { a, Copy, font, Handle, Icon, IconButton, PageFrame, PageHeader, palette, PrimaryButton, usePageInsets } from './atoms';
import { MapSheet } from './MapScreen';
import { InterceptionGame, Stone } from './InterceptionGame';
import { PigeonMarker } from './PigeonMarker';
import { isNearbyMock, nearbyPigeons, PREVIEW_CENTER, validCoordinate } from './nearbyPigeon';
import type { Coordinate } from './mapData';

const letters = [
  { id: 'world-wren', courier: 'Wren', from: 'london', to: 'new-york', progress: 0.58, personId: 'alex', name: 'Alex', body: 'I took the long way home today.\n\nFound a tiny bookshop, got caught in the rain, and had the best coffee of my life.\n\nA good reminder that getting a little lost is sometimes the whole point.' },
  { id: 'world-basil', courier: 'Basil', from: 'paris', to: 'chicago', progress: 0.34, personId: 'jules', name: 'Jules', body: 'A small dispatch from Paris:\n\nThe bakery on the corner finally learned my order. I think that means I live here now.\n\nHope something small made you smile today, too.' },
  { id: 'world-pebble', courier: 'Pebble', from: 'san-francisco', to: 'london', progress: 0.55, personId: 'robin', name: 'Robin', body: 'If this reaches a stranger, hello stranger.\n\nWhat’s one thing in your city that you’d miss if you left?\n\nMine is the fog. I know. I’m surprised too.' },
];

const nearbyLetters: Record<string, string> = {
  Scout: 'Hello from a few streets over.\n\nI took a new route home and found a little garden tucked between two buildings.\n\nWhat’s your favorite discovery in the neighborhood?',
  Fern: 'A tiny hello from nearby.\n\nMy windowsill is slowly turning into a jungle. Today the smallest plant grew a new leaf.\n\nWhat’s something small that made your day?',
  Sunny: 'Sending a little sunshine your way.\n\nI’m looking for a new morning ritual. Right now it’s coffee and watching the neighborhood wake up.\n\nHow do you like to start your day?',
};

function nearbySeed(center = PREVIEW_CENTER, serial = 0, at = Date.now()) {
  return { center, serial, at, flights: nearbyPigeons(center, at, serial) };
}

export function sampleWorldFlights(now: number): FlightSummary[] {
  return letters.map(letter => ({ id: letter.id, courier: letter.courier, origin: cityById(letter.from), destination: cityById(letter.to), role: 'public', visibility: 'open', defense: 'cruise', outfit: 'classic', state: 'in_flight', demo: true, attemptCount: 0, distanceKm: distanceKm(cityById(letter.from), cityById(letter.to)), departedAt: now - letter.progress * 14_400_000, arrivesAt: now + (1 - letter.progress) * 14_400_000 }));
}

export type PreviewCatch = { id: string; personId: string; body: string; courier: string; at: number };

export function usePreviewInterception(stones: number, onSpendStone: () => void, onCapture: (letter: PreviewCatch) => void, onGetStones?: () => void, onOpened?: (id: string) => void) {
  const [distantFlights, setDistantFlights] = useState(() => sampleWorldFlights(Date.now()));
  const [nearby, setNearby] = useState(() => ({ ...nearbySeed(), locationKnown: false }));
  const [attempted, setAttempted] = useState<string[]>([]);
  const [selected, setSelected] = useState<FlightSummary | null>(null);
  const [stage, setStage] = useState<'map' | 'game' | 'letter'>('map');
  const [caught, setCaught] = useState<string[]>([]);
  const clear = () => { setSelected(null); setStage('map'); };
  const reset = () => { clear(); setAttempted([]); setCaught([]); setDistantFlights(sampleWorldFlights(Date.now())); setNearby({ ...nearbySeed(), locationKnown: false }); };
  const resetNearby = () => {
    clear();
    setNearby(previous => ({ ...nearbySeed(previous.center, previous.serial + 1), locationKnown: previous.locationKnown }));
    setAttempted(previous => previous.filter(id => !isNearbyMock(id)));
  };
  const relocateNearby = (point: Coordinate) => {
    if (!validCoordinate(point)) return;
    const seed = nearbySeed(point, nearby.serial, nearby.at);
    setNearby({ ...seed, locationKnown: true });
    setSelected(previous => seed.flights.find(flight => flight.id === previous?.id) ?? previous);
  };
  const nearbyFlights = nearby.flights.filter(flight => !caught.includes(flight.id));
  const availableNearbyFlights = nearbyFlights.filter(flight => canIntercept(flight, attempted, stones, Date.now()));
  const worldFlights = [...nearbyFlights, ...distantFlights];
  const eligible = selected && canIntercept(selected, attempted, stones, Date.now());
  const reason = !selected ? '' : selected.role !== 'public' ? selected.role === 'sender' ? 'This pigeon is carrying your letter.' : 'This pigeon is bringing a letter to you.' : attempted.includes(selected.id) ? isNearbyMock(selected.id) ? `${selected.courier} got away. Try another nearby pigeon or reset to try again.` : 'You already tried this pigeon. Give another one a go.' : stones < 1 ? 'Your pouch is empty. Visit the coop shop for more stones.' : isNearbyMock(selected.id) ? `A mock pigeon within 5 km. Catch ${selected.courier} to open a practice letter.` : 'Two shots. One hit catches the letter.';
  const start = () => {
    if (!selected || !canIntercept(selected, attempted, stones, Date.now())) return;
    setAttempted(previous => [...previous, selected.id]); setStage('game');
  };
  const letter = selected && isNearbyMock(selected.id) ? { personId: 'nearby', name: 'Someone nearby', body: nearbyLetters[selected.courier] } : letters.find(item => item.id === selected?.id);
  const surface = stage === 'game' && selected ? <InterceptionGame key={selected.id} pigeon={selected.courier} stones={stones} onSpendStone={onSpendStone} onCaught={() => {
    if (!letter || caught.includes(selected.id)) return;
    setCaught(previous => [...previous, selected.id]);
    setDistantFlights(previous => previous.filter(flight => flight.id !== selected.id));
    onCapture({ id: selected.id, personId: letter.personId, body: letter.body, courier: selected.courier, at: Date.now() });
  }} onClose={clear} onOpenLetter={() => { if (letter) { onOpened?.(selected.id); setStage('letter'); } }} /> : stage === 'letter' && letter && selected && caught.includes(selected.id) ? <CaughtPreviewLetter name={letter.name} body={letter.body} pigeon={selected.courier} onClose={clear} /> : null;
  return { worldFlights, nearby, nearbyFlights, availableNearbyFlights, resetNearby, relocateNearby, stones, selected, select: (flight: FlightSummary) => { setSelected(flight); setStage('map'); }, clear, reset, surface,
    sheet: selected && stage === 'map' ? <FlightInterceptSheet flight={selected} stones={stones} available={Boolean(eligible)} reason={reason} onGetStones={onGetStones} onClose={clear} onIntercept={start} /> : null };
}

export function FlightInterceptSheet({ flight, stones, available, reason, onClose, onIntercept, onGetStones }: { flight: FlightSummary; stones: number; available: boolean; reason: string; onClose: () => void; onIntercept: () => void; onGetStones?: () => void }) {
  return <MapSheet handle={<Handle label="Close pigeon details" onPress={onClose} />}>
    <View style={a.between}><View style={[a.row, { gap: 12 }]}><View style={styles.pigeon}><PigeonMarker size={32} /></View><View style={{ gap: 4 }}><Text style={[a.heading, { fontSize: 24 }]}>{flight.courier}’s passing by.</Text><Text style={styles.eyebrow}>{isNearbyMock(flight.id) ? 'MOCK PIGEON · NEARBY' : flight.role === 'public' ? 'A STRANGER’S PIGEON' : 'IN YOUR SKY'}</Text></View></View><IconButton name="close" label="Close pigeon details" onPress={onClose} /></View>
    <View style={a.between}><Copy style={{ fontSize: 12, flex: 1 }}>{isNearbyMock(flight.id) ? 'A little flight around the neighborhood' : `${flight.origin.name} → ${flight.destination.name}`}</Copy><View style={[a.row, { gap: 6 }]}><Stone size={14} /><Copy style={{ fontSize: 12 }}>{stones} stones</Copy></View></View>
    <Copy>{reason}</Copy>
    <PrimaryButton label={flight.role === 'public' ? 'Intercept' : 'Back to sky'} disabled={flight.role === 'public' && !available} onPress={flight.role === 'public' ? onIntercept : onClose} />
    {stones < 1 && onGetStones && <PrimaryButton label="Get more stones" onPress={onGetStones} />}
    {flight.role === 'public' && <Copy style={{ fontSize: 11, textAlign: 'center' }}>1 stone per shot · the letter stays closed until you catch it</Copy>}
  </MapSheet>;
}

export function WorldSkySheet({ flights, stones, onSelect, onGetStones, onSend }: { flights: FlightSummary[]; stones: number; onSelect: (flight: FlightSummary) => void; onGetStones?: () => void; onSend: () => void }) {
  return <MapSheet contentStyle={{ gap: 12 }} footer={<PrimaryButton label="Send a message" arrow onPress={onSend} />}>
    <View style={a.between}><Text style={[a.heading, { fontSize: 23 }]}>A little world of hellos</Text><View style={[a.row, { gap: 6 }]}><Stone size={14} /><Copy>{stones}</Copy>{onGetStones && <Pressable accessibilityRole="button" accessibilityLabel="Get more stones" onPress={onGetStones} hitSlop={10}><Icon name="plus" color={palette.blue} size={18} /></Pressable>}</View></View>
    <Copy style={{ fontSize: 12 }}>Tap a pigeon on the map. See where chance takes you.</Copy>
    <ScrollView horizontal nestedScrollEnabled directionalLockEnabled style={a.horizontalScroll} contentContainerStyle={{ gap: 10 }}>{flights.map(flight => <Pressable key={flight.id} accessibilityRole="button" accessibilityLabel={`Meet ${flight.courier}, a pigeon you can intercept`} onPress={() => onSelect(flight)} style={styles.flightChip}><PigeonMarker size={24} /><Text style={[a.body, { color: palette.blue, fontWeight: '600' }]}>{flight.courier}</Text><Icon name="arrow" size={15} color={palette.blue} /></Pressable>)}</ScrollView>
    {!flights.length && <Copy>All caught up. Your unexpected hellos are in your postbox.</Copy>}
  </MapSheet>;
}

function CaughtPreviewLetter({ name, body, pigeon, onClose }: { name: string; body: string; pigeon: string; onClose: () => void }) {
  const insets = usePageInsets();
  return <PageFrame style={{ paddingTop: insets.top }}><PageHeader title="An unexpected hello" onClose={onClose} /><ScrollView style={a.scroll} nestedScrollEnabled contentContainerStyle={{ padding: 26, paddingBottom: insets.bottom, gap: 26 }}><Text style={styles.eyebrow}>CAUGHT LETTER · DELIVERED BY {pigeon.toUpperCase()}</Text><View style={styles.letter}><Text selectable style={styles.letterBody}>{body}</Text><Text style={[styles.letterBody, { color: palette.blue }]}>— {name}</Text></View><Copy>This letter is saved in your postbox. You can reply from there.</Copy><PrimaryButton label="Back to sky" onPress={onClose} /><Copy style={{ fontSize: 11, textAlign: 'center' }}>Sample letter · design preview</Copy></ScrollView></PageFrame>;
}

const styles = StyleSheet.create({
  pigeon: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.pale, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: font.system, fontSize: 9, fontWeight: '600', letterSpacing: 1.2, color: palette.muted },
  flightChip: { minHeight: 46, paddingHorizontal: 13, backgroundColor: '#F0F4FF', borderRadius: 23, flexDirection: 'row', alignItems: 'center', gap: 7 },
  letter: { borderRadius: 22, backgroundColor: '#F5F7FB', padding: 26, gap: 24 },
  letterBody: { fontFamily: font.regular, fontSize: 23, lineHeight: 34, color: palette.ink },
});
