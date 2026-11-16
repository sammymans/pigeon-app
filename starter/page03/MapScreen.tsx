import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SkyMap } from './SkyMap';
import { Pigeon } from '../Pigeon';
import { CoopIllustration } from '../CoopIllustration';
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

export function HomeSheet({ title, subtitle, birds, action, onSend, onExpand, disabled, notice }: { title: string; subtitle: string; birds?: FlockBird[]; action: string; onSend: () => void; onExpand?: () => void; disabled?: boolean; notice?: ReactNode }) {
  const { width } = useWindowDimensions();
  const coopWidth = Math.max(0, Math.min(width, 480) - 48);
  const sendButton = <PrimaryButton label={action} onPress={onSend} disabled={disabled} arrow />;
  if (!onExpand || !birds) return <MapSheet handle={<Handle />} footer={sendButton}><View style={{ gap: 4 }}><Text style={a.heading}>{title}</Text><Copy>{subtitle}</Copy></View>{notice}</MapSheet>;
  const awayCount = birds.filter(bird => bird.status === 'Flying').length;
  const coopSummary = `${birds.length - awayCount} home · ${awayCount} away`;
  return <MapSheet style={m.homeSheet} contentStyle={{ gap: 0, paddingBottom: 0 }} footerStyle={{ paddingTop: 8 }} handle={<>
    <View pointerEvents="none" style={[m.homeBackdrop, { top: 28 + coopWidth * 160 / 360 / 2 }]} />
    <Handle onPress={onExpand} />
  </>} footer={sendButton}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open your coop, ${coopSummary}`} accessibilityHint={`${title}. ${subtitle}`} onPress={onExpand} style={m.homeCoop}>
      <CoopIllustration birds={birds} width={coopWidth} />
      <View style={m.coopDetails}>
        <Text style={m.coopLabel}>My coop</Text>
        <View style={[a.row, { gap: 8 }]}><Text style={m.coopCount}>{coopSummary}</Text><View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="down" size={18} color={palette.secondary} /></View></View>
      </View>
    </Pressable>
    {notice && <View style={{ paddingTop: 8 }}>{notice}</View>}
  </MapSheet>;
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

export function SentSheet({ pigeon = 'Your pigeon', to, estimate, explanation, onHome }: { pigeon?: string; to: string; estimate: string; explanation: string; onHome: () => void }) {
  return <MapSheet handle={<Handle />} contentStyle={{ gap: 12 }} footer={<PrimaryButton label="Back to my flights" compact onPress={onHome} />}><View style={[a.row, { gap: 9 }]}><Icon name="check" color={palette.blue} size={21} /><Text style={a.heading}>{pigeon}’s on the way.</Text></View><View style={a.between}><Copy>{to}</Copy><Copy style={{ color: '#000', fontWeight: '600' }}>{estimate}</Copy></View><Copy style={{ fontSize: 13, lineHeight: 20, color: palette.muted }}>{explanation}</Copy></MapSheet>;
}

const m = StyleSheet.create({
  brand: { fontFamily: font.brand, fontSize: 38, lineHeight: 46, letterSpacing: -1.9, color: '#000' },
  toolbar: { paddingHorizontal: 24, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 6 },
  unopenedBadge: { position: 'absolute', right: 2, top: -2, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, backgroundColor: palette.blue, borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  unopenedCount: { fontSize: 10, color: 'white', fontWeight: '600' },
  homeSheet: { backgroundColor: 'transparent', boxShadow: 'none' },
  homeBackdrop: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'white' },
  homeCoop: { alignItems: 'center' },
  coopDetails: { width: '100%', minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  coopLabel: { fontFamily: font.heading, fontSize: 16, lineHeight: 22, color: palette.ink },
  coopCount: { fontFamily: font.system, fontSize: 14, lineHeight: 20, color: palette.secondary },
  tabs: { flexDirection: 'row', flexShrink: 1, padding: 4, gap: 4, borderRadius: 24, backgroundColor: 'white' },
  tab: { height: 36, flexShrink: 1, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center' },
  flockRow: { flexGrow: 1, minHeight: 92, justifyContent: 'space-between', gap: 8 },
  bird: { alignItems: 'center', minWidth: 58, flexShrink: 0, gap: 5 },
  birdRing: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
});
