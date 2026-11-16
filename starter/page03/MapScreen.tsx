import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { a, Copy, font, Handle, Icon, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';

export type SkyMapData = {
  land: string[];
  viewBox: string;
  routes: { path: string; muted?: boolean; endpoints?: { x: number; y: number }[] }[];
  labels: { text: string; x: number; y: number; ocean?: boolean }[];
  markers: { id: string; x: number; y: number; selected?: boolean; color?: string; size?: number; label: string }[];
};

export const atlanticLand = [
  'M-30 18L51 5L92 37L89 68L126 89L104 113L119 144L94 181L70 188L79 226L51 251L45 285L13 264L-10 211Z',
  'M130 1L175 12L185 42L167 75L146 64L137 35Z',
  'M313 19L363 14L405 49L405 250L363 249L348 215L318 208L295 159L316 131L300 111L317 92L309 70L325 49Z',
  'M295 94L304 104L297 125L285 122L288 107Z',
];

export function SkyMap({ data, onSelect }: { data: SkyMapData; onSelect?: (id: string) => void }) {
  return <View style={StyleSheet.absoluteFill}>
    <Svg aria-hidden width="120%" height={580} viewBox={data.viewBox} style={{ position: 'absolute', left: '-10%', top: 130 }}>
      <G fill={palette.land}>{data.land.map((d, i) => <Path key={i} d={d} />)}</G>
      {data.routes.map((route, i) => <G key={i}><Path d={route.path} fill="none" stroke={route.muted ? '#AFBDCE' : palette.blue} strokeWidth={route.muted ? 1.5 : 2.5} strokeLinecap="round" strokeDasharray={route.muted ? '4 7' : '5 7'} />{route.endpoints?.map((p, j) => <Circle key={j} cx={p.x} cy={p.y} r={6} fill={palette.blue} stroke="white" strokeWidth={3} />)}</G>)}
      {data.labels.map((label, i) => <SvgText key={i} x={label.x} y={label.y} fontFamily={label.ocean ? 'Inter_400Regular' : 'Inter_600SemiBold'} fontSize={label.ocean ? 12 : 13} letterSpacing={label.ocean ? 2.3 : 0} fill={label.ocean ? '#7C8DA1' : '#485B72'}>{label.text}</SvgText>)}
    </Svg>
    <Svg pointerEvents="none" aria-hidden width="100%" height={286} style={{ position: 'absolute', top: 0 }}><Defs><LinearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="white" /><Stop offset="0.32" stopColor="white" stopOpacity={0.98} /><Stop offset="0.62" stopColor="white" stopOpacity={0.78} /><Stop offset="1" stopColor="white" stopOpacity={0} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#sky-fade)" /></Svg>
    {data.markers.map(marker => { const size = marker.size ?? (marker.selected ? 54 : 28); return <Pressable key={marker.id} accessibilityRole="button" accessibilityLabel={marker.label} accessibilityState={{ selected: Boolean(marker.selected) }} onPress={() => onSelect?.(marker.id)} disabled={!onSelect} hitSlop={10} style={{ position: 'absolute', left: `${marker.x / 390 * 100}%`, top: marker.y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: size / 2, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: size - (marker.selected ? 14 : 6), height: size - (marker.selected ? 14 : 6), borderRadius: size / 2, backgroundColor: marker.color ?? palette.blue }} /></Pressable>; })}
  </View>;
}

export function MapScreen({ map, scope = 'mine', onScope, onInbox, onMenu, onSelect, children }: { map: SkyMapData; scope?: 'mine' | 'world'; onScope?: (scope: 'mine' | 'world') => void; onInbox?: () => void; onMenu?: () => void; onSelect?: (id: string) => void; children: ReactNode }) {
  const insets = usePageInsets();
  return <PageFrame style={{ backgroundColor: palette.water }}><SkyMap data={map} onSelect={onSelect} /><View style={{ paddingTop: insets.top }}><View style={a.header}><Text accessibilityLabel="Pigeon" style={m.brand}>pigeon<Text style={{ color: palette.blue }}>.</Text></Text><IconButton name="more" label="Account and settings" round onPress={onMenu} /></View><View style={m.toolbar}><View accessibilityRole="tablist" style={m.tabs}>{([['mine', 'My flights'], ['world', 'World']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} aria-selected={scope === value} accessibilityState={{ selected: scope === value }} onPress={() => onScope?.(value)} style={[m.tab, scope === value && { backgroundColor: palette.ink }]}><Text style={[a.body, { fontWeight: scope === value ? '600' : '500', color: scope === value ? 'white' : palette.secondary }]}>{label}</Text></Pressable>)}</View><IconButton name="mail" label="Open your postbox" round onPress={onInbox} /></View></View>{children}</PageFrame>;
}

export function HomeSheet({ title, subtitle, ready, action, onSend, onExpand, disabled, notice }: { title: string; subtitle: string; ready?: string; action: string; onSend: () => void; onExpand?: () => void; disabled?: boolean; notice?: ReactNode }) {
  const { bottom } = usePageInsets();
  return <View style={[a.sheet, { minHeight: 182, paddingBottom: bottom, gap: 16 }]}><Handle onPress={onExpand} /><View style={a.between}><View style={{ gap: 4, flexShrink: 1 }}><Text style={{ fontFamily: font.heading, fontSize: 20, lineHeight: 25, color: '#000' }}>{title}</Text><Copy style={{ fontSize: 12, lineHeight: 17 }}>{subtitle}</Copy></View>{ready && <Pressable accessibilityRole="button" accessibilityLabel="Open your flock" onPress={onExpand} style={[a.row, { gap: 5, minHeight: 44 }]}><View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: palette.blue }} /><Copy style={{ fontSize: 13, lineHeight: 16 }}>{ready}</Copy></Pressable>}</View>{notice}<PrimaryButton label={action} arrow onPress={onSend} disabled={disabled} /></View>;
}

export type FlockBird = { id: string; name: string; status: string; color: string; speed?: string; deliveries?: string; defense?: string };
export function FlockSheet({ birds, selected, summary, onSelect, onClose, onSend, unavailable, notice }: { birds: FlockBird[]; selected: string | null; summary: string; onSelect: (id: string) => void; onClose: () => void; onSend?: () => void; unavailable?: string; notice?: ReactNode }) {
  const { bottom } = usePageInsets();
  const bird = birds.find(item => item.id === selected);
  return <View style={[a.sheet, { height: 514 + Math.max(0, bottom - 30), maxHeight: '80%', paddingBottom: bottom }]}>
    <Handle onPress={onClose} label="Collapse your flock" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 16 }}>
      <View style={[a.between, { alignItems: 'baseline' }]}><Text accessibilityRole="header" style={a.heading}>Your flock</Text><Copy style={{ fontSize: 13, lineHeight: 16 }}>{summary}</Copy></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" contentContainerStyle={m.flockRow}>{birds.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${item.status}`} aria-checked={selected === item.id} accessibilityState={{ checked: selected === item.id }} onPress={() => onSelect(item.id)} style={m.bird}><View style={[m.birdRing, { borderColor: selected === item.id ? palette.blue : 'transparent', borderWidth: 2 }]}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: item.color }} /></View><Text style={[a.small, { fontWeight: '600', color: '#000' }]}>{item.name}</Text><Text style={[a.small, { fontSize: 10, lineHeight: 12 }]}>{item.status}</Text></Pressable>)}</ScrollView>
      <View style={m.birdDetails}><View style={a.between}><Copy style={{ color: '#000', fontSize: 16, lineHeight: 20, fontWeight: '600' }}>{bird?.name ?? 'Your pigeons'}</Copy><Copy style={{ fontSize: 12, lineHeight: 16, color: palette.blue }}>{bird?.status === 'Ready' ? 'Ready to fly' : bird?.status ?? 'Loading'}</Copy></View><View style={a.between}>{bird ? [bird.speed, bird.deliveries, bird.defense].map((value, i) => <Copy key={i} style={{ fontSize: 13, lineHeight: 16 }}>{value}</Copy>) : <Copy style={{ fontSize: 12, lineHeight: 16 }}>{unavailable ?? 'Loading your flock…'}</Copy>}</View></View>
      <View style={[a.between, { paddingHorizontal: 2, minHeight: 48 }]}><View style={{ gap: 5 }}><Copy style={{ color: '#000', fontWeight: '600' }}>Hatchery</Copy><Copy style={{ fontSize: 12, lineHeight: 16 }}>Not available in this build</Copy></View><Copy style={{ fontSize: 12 }}>Coming soon</Copy></View>
      <View style={[a.between, { borderTopWidth: 1, borderColor: palette.line, paddingTop: 14, minHeight: 32, marginTop: -8 }]}><Copy>Pigeons &amp; defenses</Copy><Copy style={{ fontSize: 12 }}>Shop · coming soon</Copy></View>
      {notice}
      <PrimaryButton label={bird ? `Send with ${bird.name}` : 'Choose a pigeon'} compact disabled={bird?.status !== 'Ready'} onPress={onSend} />
    </ScrollView>
  </View>;
}

export function SentSheet({ pigeon, state = 'in_flight', to, estimate, explanation, onHome }: { pigeon: string; state?: 'in_flight' | 'delivered' | 'intercepted'; to: string; estimate: string; explanation: string; onHome: () => void }) {
  const { bottom } = usePageInsets();
  return <View style={[a.sheet, { minHeight: 250, maxHeight: '70%', paddingBottom: bottom, gap: 12 }]}>
    <Handle />
    <ScrollView contentContainerStyle={{ gap: 12 }}>
      <View style={[a.row, { gap: 9 }]}><Icon name="check" color={palette.blue} size={21} /><Text accessibilityRole="header" style={[a.heading, { flexShrink: 1 }]}>{state === 'in_flight' ? `${pigeon}’s on the way.` : state === 'delivered' ? `${pigeon} has arrived.` : `${pigeon} was intercepted.`}</Text></View>
      <View style={[a.between, { gap: 12 }]}><Copy style={{ flex: 1 }}>{to}</Copy><Copy style={{ color: '#000', fontWeight: '600', maxWidth: '42%' }}>{estimate}</Copy></View>
      <Copy style={{ fontSize: 13, lineHeight: 20, color: palette.muted }}>{explanation}</Copy>
      <PrimaryButton label="Back to my flights" compact onPress={onHome} />
    </ScrollView>
  </View>;
}

const m = StyleSheet.create({
  brand: { fontFamily: font.brand, fontSize: 38, lineHeight: 46, letterSpacing: -1.9, color: palette.ink },
  toolbar: { paddingHorizontal: 24, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 24, backgroundColor: '#EEF1F5' },
  tab: { height: 36, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center' },
  flockRow: { flexDirection: 'row', flexGrow: 1, minHeight: 92, justifyContent: 'space-between', gap: 4 },
  bird: { alignItems: 'center', flex: 1, minWidth: 54, gap: 5 },
  birdRing: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  birdDetails: { borderRadius: 18, backgroundColor: '#F4F7FC', paddingVertical: 15, paddingHorizontal: 16, gap: 10 },
});
