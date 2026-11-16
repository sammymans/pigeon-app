import { type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import Svg, { Circle, Path, Rect, SvgXml } from 'react-native-svg';
import coopArtwork from '../coopArtwork.json';

export const palette = { blue: '#2453FF', ink: '#17212B', muted: '#687383', secondary: '#566273', pale: '#EDF2FF', water: '#EAF1F7', land: '#DCE5ED', line: '#DEE5EE' };
export const font = { regular: 'Outfit_400Regular', heading: 'Outfit_600SemiBold', brand: 'Outfit_800ExtraBold', system: Platform.OS === 'web' ? 'system-ui' : undefined };

export function Page03Fonts({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({ Outfit_400Regular, Outfit_600SemiBold, Outfit_800ExtraBold, Inter_400Regular, Inter_600SemiBold });
  if (error) return <View style={a.loading}><Text style={a.body}>The design fonts could not load. Reopen the app to try again.</Text></View>;
  return loaded ? children : <View style={a.loading}><ActivityIndicator color={palette.blue} /></View>;
}

export function usePageInsets() {
  const insets = useSafeAreaInsets();
  return { top: Math.max(62, insets.top), bottom: Math.max(30, insets.bottom) };
}

export function PageFrame({ children, scroll = false, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={a.frame}>{scroll ? <ScrollView style={a.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[{ flexGrow: 1 }, style]}>{children}</ScrollView> : <View style={[a.content, style]}>{children}</View>}</View>;
}

export type IconName = 'close' | 'back' | 'arrow' | 'plus' | 'mail' | 'more' | 'check' | 'search' | 'phone' | 'nearby' | 'lock' | 'compose' | 'down' | 'coop' | 'shop';
export function Icon({ name, size = 22, color = palette.ink }: { name: IconName; size?: number; color?: string }) {
  // Original Paper artwork: Outfits → Wooden coop, node 7O5-0 (360 × 160).
  // Nested SVG viewports are flattened to equivalent groups for native rendering.
  if (name === 'coop') return <SvgXml aria-hidden xml={coopArtwork.back.replace('</svg>', coopArtwork.front.replace(/^<svg[^>]*>/, ''))} width={size} height={size * 160 / 360} />;
  const paths: Partial<Record<IconName, string>> = { compose: 'M13 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M15 3l3-3 4 4-3 3M9 10l6-7 4 4-7 6-4 1Z', down: 'm7 10 5 5 5-5', close: 'm6 6 12 12M18 6 6 18', back: 'm14 6-6 6 6 6', arrow: 'M5 12h14m-5-5 5 5-5 5', plus: 'M12 5v14M5 12h14', check: 'm5 12 4 4 10-10', search: 'm16 16 4 4', nearby: 'M12 2v3m0 14v3M2 12h3m14 0h3', lock: 'M8 10V7a4 4 0 0 1 8 0v3' };
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {paths[name] && <Path d={paths[name]} />}
    {name === 'shop' && <Path d="M6 7h12l2 14H4L6 7ZM9 8V6a3 3 0 0 1 6 0v2" />}
    {name === 'mail' && <><Rect x={3} y={5} width={18} height={14} rx={3} /><Path d="m3 7 9 6 9-6" /></>}
    {name === 'more' && [5, 12, 19].map(x => <Circle key={x} cx={x} cy={12} r={1} />)}
    {name === 'search' && <Circle cx={10.5} cy={10.5} r={6.5} />}
    {name === 'nearby' && <Circle cx={12} cy={12} r={7} />}
    {name === 'phone' && <><Rect x={7} y={2} width={10} height={20} rx={2} /><Path d="M11 18h2" /></>}
    {name === 'lock' && <Rect x={6} y={10} width={12} height={11} rx={2} />}
  </Svg>;
}

export function IconButton({ name, label, onPress, disabled = false, round = false }: { name: IconName; label: string; onPress?: () => void; disabled?: boolean; round?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || !onPress }} disabled={disabled || !onPress} onPress={onPress} hitSlop={4} style={[a.iconButton, round && { backgroundColor: 'white', borderRadius: 22 }]}><Icon name={name} size={name === 'coop' ? 40 : 22} color={disabled ? palette.muted : palette.ink} /></Pressable>;
}

export function PageHeader({ title, onClose, back = false, disabled = false }: { title: string; onClose: () => void; back?: boolean; disabled?: boolean }) {
  return <View style={[a.header, back && { justifyContent: 'flex-start', gap: 5 }]}><View style={{ marginLeft: -11 }}><IconButton name={back ? 'back' : 'close'} label={back ? 'Back to your letter' : 'Back to my flights'} onPress={onClose} disabled={disabled} /></View><Text accessibilityRole="header" style={[a.heading, back ? { fontSize: 28, lineHeight: 34 } : { flex: 1, textAlign: 'center' }]}>{title}</Text>{!back && <View style={{ width: 33 }} />}</View>;
}

export function PrimaryButton({ label, onPress, disabled = false, arrow = false, compact = false }: { label: string; onPress?: () => void; disabled?: boolean; arrow?: boolean; compact?: boolean }) {
  const unavailable = disabled || !onPress;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={onPress} style={({ pressed }) => [a.button, compact && { height: 54 }, unavailable && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}><Text style={[a.buttonText, compact && { fontSize: 16, lineHeight: 20 }]}>{label}</Text>{arrow && <Icon name="arrow" size={20} color="white" />}</Pressable>;
}

export function Copy({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) { return <Text style={[a.body, style]}>{children}</Text>; }
export function Handle({ onPress, label = 'Expand your flock' }: { onPress?: () => void; label?: string }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress} style={a.handleTarget}><View style={a.handle} /></Pressable>; }
export function InlineMessage({ children, error = false }: { children: ReactNode; error?: boolean }) { return <Text accessibilityRole={error ? 'alert' : undefined} style={[a.body, { marginHorizontal: 24, marginVertical: 8, color: error ? '#AE3046' : palette.muted }]}>{children}</Text>; }

export const a = StyleSheet.create({
  content: { flex: 1, minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  horizontalScroll: { flexGrow: 0, flexShrink: 0, minWidth: 0 },
  frame: { flex: 1, minHeight: 0, overflow: 'hidden', width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: 'white' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'white' },
  header: { height: 70, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  heading: { fontFamily: font.heading, fontSize: 26, lineHeight: 32, letterSpacing: -0.78, color: '#000' },
  body: { fontFamily: font.system, fontSize: 14, lineHeight: 18, color: palette.secondary },
  small: { fontFamily: font.system, fontSize: 12, lineHeight: 16, color: palette.muted },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  button: { height: 56, flexShrink: 0, borderRadius: 28, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  buttonText: { fontFamily: font.system, fontSize: 17, lineHeight: 22, fontWeight: '600', color: 'white', textAlign: 'center' },
  handleTarget: { position: 'absolute', top: 0, height: 28, left: 0, right: 0, alignItems: 'center', paddingTop: 10 },
  handle: { height: 4, width: 40, backgroundColor: '#C5CDD7', borderRadius: 3 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 28, paddingHorizontal: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'white', boxShadow: '0 -4px 24px rgba(23,33,43,0.03)' },
});
