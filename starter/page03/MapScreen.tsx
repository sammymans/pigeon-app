import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SkyMap } from './SkyMap';
import { Pigeon } from '../Pigeon';
import type { Accessory } from '../../src/shop';
import type { SkyMapData } from './mapData';
import { a, Copy, font, Handle, Icon, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';

export function MapScreen({ map, scope = 'mine', onScope, onInbox, onCoop, onMenu, onSelect, unopened = 0, sheetHeight = 182, children }: { map: SkyMapData; scope?: 'mine' | 'world'; onScope?: (scope: 'mine' | 'world') => void; onInbox?: () => void; onCoop?: () => void; onMenu?: () => void; onSelect?: (id: string) => void; unopened?: number; sheetHeight?: number; children: ReactNode }) {
  const insets = usePageInsets();
  return <PageFrame style={{ backgroundColor: palette.water }}>
    <SkyMap data={map} onSelect={onSelect} topInset={insets.top + 126} bottomInset={sheetHeight + Math.max(0, insets.bottom - 30)} scope={scope} />
    <Svg pointerEvents="none" aria-hidden width="100%" height={insets.top + 224} style={{ position: 'absolute', top: 0 }}><Defs><LinearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="white" /><Stop offset="0.45" stopColor="white" stopOpacity={0.98} /><Stop offset="0.72" stopColor="white" stopOpacity={0.85} /><Stop offset="1" stopColor="white" stopOpacity={0} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#sky-fade)" /></Svg>
    <View pointerEvents="box-none" style={{ paddingTop: insets.top }}>
      <View style={a.header}><Text accessibilityLabel="Pigeon" style={m.brand}>pigeon<Text style={{ color: palette.blue }}>.</Text></Text><IconButton name="more" label="Account and settings" round onPress={onMenu} /></View>
      <View style={m.toolbar}><View accessibilityRole="tablist" style={m.tabs}>{([['mine', 'My flights'], ['world', 'World']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: scope === value }} onPress={() => onScope?.(value)} style={[m.tab, scope === value && { backgroundColor: palette.ink }]}><Text style={[a.body, { fontWeight: scope === value ? '600' : '500', color: scope === value ? 'white' : palette.secondary }]}>{label}</Text></Pressable>)}</View><View style={[a.row, { gap: 6 }]}>{onCoop && <IconButton name="coop" label="Open your coop" round onPress={onCoop} />}<View><IconButton name="mail" label={`Open your mailbox${unopened ? `, ${unopened} unopened` : ''}`} round onPress={onInbox} />{unopened > 0 && <View pointerEvents="none" style={{ position: 'absolute', right: 2, top: -2, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, backgroundColor: palette.blue, borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 10, color: 'white', fontWeight: '600' }}>{unopened}</Text></View>}</View></View></View>
    </View>
    {children}
  </PageFrame>;
}

export function HomeSheet({ title, subtitle, ready, action, onSend, onExpand, disabled, notice }: { title: string; subtitle: string; ready?: string; action: string; onSend: () => void; onExpand?: () => void; disabled?: boolean; notice?: ReactNode }) {
  const { bottom } = usePageInsets();
  return <View style={[a.sheet, { minHeight: 182, paddingBottom: bottom, gap: 16 }]}><Handle onPress={onExpand} /><View style={a.between}><View style={{ gap: 4, flexShrink: 1 }}><Text style={{ fontFamily: font.heading, fontSize: 20, lineHeight: 25, color: '#000' }}>{title}</Text><Copy style={{ fontSize: 12, lineHeight: 17 }}>{subtitle}</Copy></View>{ready && <Pressable accessibilityRole="button" accessibilityLabel="Open your flock" onPress={onExpand} style={[a.row, { gap: 5, minHeight: 44 }]}><View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: palette.blue }} /><Copy style={{ fontSize: 13, lineHeight: 16 }}>{ready}</Copy></Pressable>}</View>{notice}<PrimaryButton label={action} arrow onPress={onSend} disabled={disabled} /></View>;
}

export type FlockBird = { id: string; name: string; status: string; color: string; egg?: boolean; speed?: string; deliveries?: string; defense?: string; accessory?: Accessory };
export function FlockSheet({ birds, selected, summary, hatchery, onSelect, onClose, onSend, onShop, onHatchery, unavailable }: { birds: FlockBird[]; selected: string | null; summary: string; hatchery?: string; onSelect: (id: string) => void; onClose: () => void; onSend?: () => void; onShop?: () => void; onHatchery?: () => void; unavailable?: string }) {
  const { bottom } = usePageInsets();
  const bird = birds.find(item => item.id === selected);
  const ready = bird?.status === 'Ready';
  const entrance = useRef(new Animated.Value(40)).current;
  useEffect(() => { Animated.spring(entrance, { toValue: 0, damping: 24, stiffness: 220, mass: 0.8, useNativeDriver: true }).start(); }, [entrance]);
  return <Animated.View style={[a.sheet, { height: 514 + Math.max(0, bottom - 30), maxHeight: '78%', paddingBottom: bottom + 12, paddingTop: 30, gap: 16, transform: [{ translateY: entrance }] }]}>
    <Handle onPress={onClose} label="Collapse your flock" />
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 6 }}>
      <View style={[a.between, { alignItems: 'baseline' }]}><Text style={a.heading}>Your flock</Text><Copy style={{ fontSize: 13, lineHeight: 18 }}>{summary}</Copy></View>
      <View accessibilityRole="radiogroup" style={m.flockRow}>{birds.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${item.status}`} accessibilityState={{ checked: selected === item.id }} onPress={() => onSelect(item.id)} style={m.bird}>
        <View style={[m.birdRing, { borderColor: selected === item.id ? palette.blue : item.egg ? '#9CAABE' : 'transparent', borderStyle: item.egg ? 'dashed' : 'solid', borderWidth: item.egg ? 1 : 2 }]}>{item.egg ? <View style={{ width: 32, height: 42, borderRadius: 21, backgroundColor: item.color }} /> : <Pigeon name={item.name} accessory={item.accessory} size={48} />}</View>
        <Text style={[a.small, { fontWeight: '600', color: '#000', fontSize: 12 }]}>{item.name}</Text><Text style={[a.small, { fontSize: 11, lineHeight: 15 }]}>{item.status}</Text>
      </Pressable>)}</View>
      <View style={m.birdDetails}><View style={a.between}><Copy style={{ color: '#000', fontSize: 16, lineHeight: 22, fontWeight: '600' }}>{bird?.name ?? 'Your pigeons'}</Copy><Copy style={{ fontSize: 12, lineHeight: 18, color: palette.blue }}>{ready ? 'Ready to fly' : bird?.egg ? 'Hatching soon' : bird?.status ?? 'Unavailable'}</Copy></View><View style={a.between}>{bird ? [bird.speed, bird.deliveries, bird.defense].map((value, i) => <Copy key={i} style={{ fontSize: 13, lineHeight: 18 }}>{value}</Copy>) : <Copy style={{ fontSize: 12, lineHeight: 16 }}>{unavailable ?? 'Your flock is empty.'}</Copy>}</View></View>
      <View style={[a.between, { paddingHorizontal: 2 }]}><View style={{ gap: 5 }}><Copy style={{ color: '#000', fontWeight: '600' }}>Hatchery</Copy><Copy style={{ fontSize: 12, lineHeight: 16 }}>{hatchery ?? 'No eggs hatching'}</Copy></View><Pressable accessibilityRole="button" accessibilityLabel="Visit hatchery" disabled={!onHatchery} onPress={onHatchery} hitSlop={10}><Copy style={{ color: onHatchery ? palette.blue : palette.muted, fontWeight: '600' }}>Visit →</Copy></Pressable></View>
      <View style={[a.between, { borderTopWidth: 1, borderColor: '#E8EDF4', paddingTop: 17 }]}><View style={{ gap: 4 }}><Copy style={{ color: palette.ink, fontWeight: '600' }}>Visit the coop shop</Copy><Copy style={a.small}>Outfits, treats & little extras</Copy></View><Pressable accessibilityRole="button" accessibilityLabel="Open shop" disabled={!onShop} onPress={onShop} hitSlop={10}><Copy style={{ color: onShop ? palette.blue : palette.muted, fontWeight: '600' }}>Shop →</Copy></Pressable></View>
    </ScrollView>
    <PrimaryButton label={ready ? `Send with ${bird.name}` : bird?.egg ? 'Your egg is still hatching' : bird ? `${bird.name} is flying` : 'Choose a pigeon'} onPress={onSend} disabled={!ready} />
  </Animated.View>;
}

export function SentSheet({ pigeon = 'Your pigeon', to, estimate, explanation, onHome }: { pigeon?: string; to: string; estimate: string; explanation: string; onHome: () => void }) {
  const { bottom } = usePageInsets();
  return <View style={[a.sheet, { minHeight: 250, paddingBottom: bottom + 12, gap: 12 }]}><Handle /><View style={[a.row, { gap: 9 }]}><Icon name="check" color={palette.blue} size={21} /><Text style={a.heading}>{pigeon}’s on the way.</Text></View><View style={a.between}><Copy>{to}</Copy><Copy style={{ color: '#000', fontWeight: '600' }}>{estimate}</Copy></View><Copy style={{ fontSize: 13, lineHeight: 20, color: palette.muted }}>{explanation}</Copy><PrimaryButton label="Back to my flights" compact onPress={onHome} /></View>;
}

const m = StyleSheet.create({
  brand: { fontFamily: font.brand, fontSize: 38, lineHeight: 46, letterSpacing: -1.9, color: palette.ink },
  toolbar: { paddingHorizontal: 24, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 24, backgroundColor: '#EEF1F5' },
  tab: { height: 36, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center' },
  flockRow: { flexDirection: 'row', minHeight: 92, justifyContent: 'space-between', gap: 4 },
  bird: { alignItems: 'center', flex: 1, gap: 5 },
  birdRing: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  birdDetails: { borderRadius: 18, backgroundColor: '#F4F7FC', paddingVertical: 15, paddingHorizontal: 16, gap: 10 },
});
