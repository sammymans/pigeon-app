import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SkyMap } from './SkyMap';
import { Pigeon } from '../Pigeon';
import type { Accessory } from '../../src/shop';
import type { Coordinate, SkyMapData } from './mapData';
import { a, Copy, font, Handle, Icon, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';

const SheetLayout = createContext<((event: LayoutChangeEvent) => void) | undefined>(undefined);

export function MapSheet({ children, footer, handle, style, contentStyle, footerStyle }: { children: ReactNode; footer?: ReactNode; handle?: ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; footerStyle?: StyleProp<ViewStyle> }) {
  const { bottom } = usePageInsets();
  const onLayout = useContext(SheetLayout);
  return <View onLayout={onLayout} style={[a.sheet, { maxHeight: '78%', paddingBottom: bottom }, style]}>
    {handle}
    <ScrollView style={{ flexShrink: 1, flexGrow: 0, minHeight: 0 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={[{ gap: 16, paddingBottom: 4 }, contentStyle]}>{children}</ScrollView>
    {footer && <View style={[{ paddingTop: 16, flexShrink: 0 }, footerStyle]}>{footer}</View>}
  </View>;
}

export function MapScreen({ map, scope = 'mine', onScope, onInbox, onShop, onMenu, onSelect, onLocationChange, unopened = 0, sheetHeight = 214, children }: { map: SkyMapData; scope?: 'mine' | 'world'; onScope?: (scope: 'mine' | 'world') => void; onInbox?: () => void; onShop?: () => void; onMenu?: () => void; onSelect?: (id: string) => void; onLocationChange?: (point: Coordinate) => void; unopened?: number; sheetHeight?: number; children: ReactNode }) {
  const insets = usePageInsets();
  const { width } = useWindowDimensions();
  const [measuredSheet, setMeasuredSheet] = useState(0);
  const fadeHeight = insets.top + 184;
  const bottomInset = measuredSheet || sheetHeight + Math.max(0, insets.bottom - 30);
  return <PageFrame style={{ backgroundColor: palette.water }}>
    <SkyMap data={map} onSelect={onSelect} onLocationChange={onLocationChange} topInset={insets.top + 126} bottomInset={bottomInset} scope={scope} />
    <Svg pointerEvents="none" aria-hidden width="100%" height={fadeHeight} style={{ position: 'absolute', top: 0 }}>
      <Defs>
        <LinearGradient id="sky-fade" gradientUnits="userSpaceOnUse" x1={0} y1={insets.top} x2={0} y2={fadeHeight}>
          <Stop offset="0" stopColor="white" stopOpacity={1} />
          <Stop offset="0.2" stopColor="white" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="white" stopOpacity={0.65} />
          <Stop offset="0.6" stopColor="white" stopOpacity={0.35} />
          <Stop offset="0.8" stopColor="white" stopOpacity={0.1} />
          <Stop offset="1" stopColor="white" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sky-fade)" />
    </Svg>
    <View pointerEvents="box-none" style={{ paddingTop: insets.top }}>
      <View style={a.header}>
        <Text accessibilityLabel="Pigeon" style={m.brand}>pigeon<Text style={{ color: palette.blue }}>.</Text></Text>
        <IconButton name="more" label="Account and settings" round onPress={onMenu} />
      </View>
      <View style={m.toolbar}>
        <View accessibilityRole="tablist" style={m.tabs}>{([['mine', 'My flights'], ['world', 'World']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: scope === value }} onPress={() => onScope?.(value)} style={[m.tab, width < 360 && { paddingHorizontal: 10 }, scope === value && { backgroundColor: palette.ink }]}><Text numberOfLines={1} style={[a.body, { fontWeight: scope === value ? '600' : '500', color: scope === value ? 'white' : palette.secondary }]}>{label}</Text></Pressable>)}</View>
        <View style={m.toolbarActions}>
          <View>
            <IconButton name="mail" label={`Open your mailbox${unopened ? `, ${unopened} unopened` : ''}`} round onPress={onInbox} />
            {unopened > 0 && <View pointerEvents="none" style={m.unopenedBadge}><Text style={m.unopenedCount}>{unopened}</Text></View>}
          </View>
          {onShop && <IconButton name="shop" label="Open shop" round onPress={onShop} />}
        </View>
      </View>
    </View>
    <SheetLayout.Provider value={event => setMeasuredSheet(event.nativeEvent.layout.height)}>{children}</SheetLayout.Provider>
  </PageFrame>;
}

export function HomeSheet({ title, subtitle, ready, coopCount, action, onSend, onExpand, disabled, notice }: { title: string; subtitle: string; ready?: string; coopCount?: number; action: string; onSend: () => void; onExpand?: () => void; disabled?: boolean; notice?: ReactNode }) {
  const { width } = useWindowDimensions();
  const { bottom } = usePageInsets();
  const coopWidth = Math.min(150, Math.max(96, width - 240));
  return <MapSheet style={{ paddingBottom: bottom + 10 }} footerStyle={{ paddingTop: 6 }} handle={<Handle onPress={onExpand} />} footer={<View style={m.homeActions}>
    {onExpand && coopCount !== undefined && <Pressable accessibilityRole="button" accessibilityLabel={`Open your coop, ${coopCount} pigeons`} onPress={onExpand} style={[m.homeCoop, { width: coopWidth }]}>
      <Icon name="coop" size={coopWidth} />
      <Text style={m.coopLabel}>My coop<Text style={m.coopCount}> · {coopCount}</Text></Text>
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel={action} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onSend} style={({ pressed }) => [a.button, m.homeSend, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}>
      <Text style={[a.buttonText, m.homeSendLabel, width < 360 && { fontSize: 14 }]}>{action}</Text><Icon name="arrow" size={18} color="white" />
    </Pressable>
  </View>}><View style={a.between}><View style={{ gap: 4, flexShrink: 1 }}><Text style={{ fontFamily: font.heading, fontSize: 20, lineHeight: 25, color: '#000' }}>{title}</Text><Copy style={{ fontSize: 12, lineHeight: 17 }}>{subtitle}</Copy></View>{ready && <Pressable accessibilityRole="button" accessibilityLabel="Open your flock" onPress={onExpand} style={[a.row, { gap: 5, minHeight: 44 }]}><View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: palette.blue }} /><Copy style={{ fontSize: 13, lineHeight: 16 }}>{ready}</Copy></Pressable>}</View>{notice}</MapSheet>;
}

export type FlockBird = { id: string; name: string; status: string; color: string; egg?: boolean; speed?: string; deliveries?: string; defense?: string; accessory?: Accessory };
/** Shared coop portraits; send review only allows birds that are ready. */
export function FlockSelection({ birds, selected, onSelect, readyOnly = false }: { birds: FlockBird[]; selected: string | null; onSelect: (id: string) => void; readyOnly?: boolean }) {
  return <ScrollView horizontal nestedScrollEnabled directionalLockEnabled style={a.horizontalScroll} contentContainerStyle={m.flockRow} accessibilityRole="radiogroup" accessibilityLabel="Your coop">
    {birds.map(item => {
      const unavailable = readyOnly && (item.status !== 'Ready' || Boolean(item.egg));
      return <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${item.egg ? 'Hatching' : item.status}`} accessibilityState={{ checked: selected === item.id, disabled: unavailable }} disabled={unavailable} onPress={() => onSelect(item.id)} style={[m.bird, unavailable && { opacity: 0.5 }]}>
        <View style={[m.birdRing, { borderColor: selected === item.id ? palette.blue : item.egg ? '#9CAABE' : 'transparent', borderStyle: item.egg ? 'dashed' : 'solid', borderWidth: item.egg ? 1 : 2 }]}>{item.egg ? <View style={{ width: 32, height: 42, borderRadius: 21, backgroundColor: item.color }} /> : <Pigeon name={item.name} accessory={item.accessory} size={48} />}</View>
        <Text style={[a.small, { fontWeight: '600', color: '#000', fontSize: 12 }]}>{item.name}</Text><Text style={[a.small, { fontSize: 11, lineHeight: 15 }]}>{item.egg ? 'Hatching' : item.status}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

export function FlockSheet({ birds, selected, summary, onSelect, onClose, onSend, onShop, unavailable }: { birds: FlockBird[]; selected: string | null; summary: string; onSelect: (id: string) => void; onClose: () => void; onSend?: () => void; onShop?: () => void; unavailable?: string }) {
  const { top, bottom } = usePageInsets();
  const { height } = useWindowDimensions();
  const onLayout = useContext(SheetLayout);
  const bird = birds.find(item => item.id === selected);
  const ready = bird?.status === 'Ready';
  const entrance = useRef(new Animated.Value(40)).current;
  useEffect(() => { Animated.spring(entrance, { toValue: 0, damping: 24, stiffness: 220, mass: 0.8, useNativeDriver: true }).start(); }, [entrance]);
  return <Animated.View onLayout={onLayout} style={[a.sheet, { height: 450 + Math.max(0, bottom - 30), maxHeight: Math.max(0, height - top - 126), paddingBottom: bottom + 12, paddingTop: 30, gap: 16, transform: [{ translateY: entrance }] }]}>
    <Handle onPress={onClose} label="Collapse your flock" />
    <ScrollView style={a.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18, paddingBottom: 6 }}>
      <View style={[a.between, { alignItems: 'baseline' }]}><Text style={a.heading}>Your flock</Text><Copy style={{ fontSize: 13, lineHeight: 18 }}>{summary}</Copy></View>
      <FlockSelection birds={birds} selected={selected} onSelect={onSelect} />
      <View style={m.birdDetails}><View style={a.between}><Copy style={{ color: '#000', fontSize: 16, lineHeight: 22, fontWeight: '600' }}>{bird?.name ?? 'Your pigeons'}</Copy><Copy style={{ fontSize: 12, lineHeight: 18, color: palette.blue }}>{ready ? 'Ready to fly' : bird?.egg ? 'Hatching soon' : bird?.status ?? 'Unavailable'}</Copy></View><View style={a.between}>{bird ? [bird.speed, bird.deliveries, bird.defense].map((value, i) => <Copy key={i} style={{ fontSize: 13, lineHeight: 18 }}>{value}</Copy>) : <Copy style={{ fontSize: 12, lineHeight: 16 }}>{unavailable ?? 'Your flock is empty.'}</Copy>}</View></View>
    </ScrollView>
    {onShop && <Pressable accessibilityRole="button" accessibilityLabel="Visit the coop shop" onPress={onShop} style={m.coopShop}><Icon name="shop" size={20} color={palette.blue} /><Copy style={{ flex: 1, color: palette.ink, fontWeight: '600' }}>Visit the coop shop</Copy><Icon name="arrow" size={18} color={palette.blue} /></Pressable>}
    <PrimaryButton label={ready ? `Send with ${bird.name}` : bird?.egg ? 'Your egg is still hatching' : bird ? `${bird.name} is flying` : 'Choose a pigeon'} onPress={onSend} disabled={!ready} />
  </Animated.View>;
}

export function SentSheet({ pigeon = 'Your pigeon', to, estimate, explanation, onHome }: { pigeon?: string; to: string; estimate: string; explanation: string; onHome: () => void }) {
  return <MapSheet handle={<Handle />} contentStyle={{ gap: 12 }} footer={<PrimaryButton label="Back to my flights" compact onPress={onHome} />}><View style={[a.row, { gap: 9 }]}><Icon name="check" color={palette.blue} size={21} /><Text style={a.heading}>{pigeon}’s on the way.</Text></View><View style={a.between}><Copy>{to}</Copy><Copy style={{ color: '#000', fontWeight: '600' }}>{estimate}</Copy></View><Copy style={{ fontSize: 13, lineHeight: 20, color: palette.muted }}>{explanation}</Copy></MapSheet>;
}

const m = StyleSheet.create({
  brand: { fontFamily: font.brand, fontSize: 38, lineHeight: 46, letterSpacing: -1.9, color: '#000' },
  toolbar: { paddingHorizontal: 24, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 6 },
  unopenedBadge: { position: 'absolute', right: 2, top: -2, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, backgroundColor: palette.blue, borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  unopenedCount: { fontSize: 10, color: 'white', fontWeight: '600' },
  homeActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  homeCoop: { alignItems: 'center', gap: 4 },
  coopLabel: { fontFamily: font.heading, fontSize: 14, lineHeight: 18, color: palette.ink },
  coopCount: { fontFamily: font.regular, color: palette.muted },
  homeSend: { flex: 1, paddingHorizontal: 16, gap: 10 },
  homeSendLabel: { flexShrink: 1, fontSize: 16, lineHeight: 20 },
  coopShop: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, flexShrink: 0, paddingHorizontal: 14, borderRadius: 14, backgroundColor: palette.pale },
  tabs: { flexDirection: 'row', flexShrink: 1, padding: 4, gap: 4, borderRadius: 24, backgroundColor: '#EEF1F5' },
  tab: { height: 36, flexShrink: 1, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center' },
  flockRow: { flexGrow: 1, minHeight: 92, justifyContent: 'space-between', gap: 8 },
  bird: { alignItems: 'center', minWidth: 58, flexShrink: 0, gap: 5 },
  birdRing: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  birdDetails: { borderRadius: 18, backgroundColor: '#F4F7FC', paddingVertical: 15, paddingHorizontal: 16, gap: 10 },
});
