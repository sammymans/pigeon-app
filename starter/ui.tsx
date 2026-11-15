import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cities, type CityId } from '../src/domain';

export const colors = { paper: '#F5F1E8', card: '#FFFCF5', ink: '#273E38', muted: '#65716A', green: '#375D4D', line: '#D9DCCE', pale: '#E7EBDD', orange: '#A3472A', red: '#A13729' };

export function Button({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondaryButton, disabled && s.disabled, pressed && s.pressed]}><Text style={[s.buttonText, secondary && s.secondaryButtonText]}>{label}</Text></Pressable>;
}

export function Link({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => [s.link, disabled && s.disabled, pressed && s.pressed]}><Text style={s.linkText}>{label}</Text></Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted} style={[s.input, props.style]} /></View>;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <View style={[s.notice, error && s.errorBox]}><Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[s.small, error && s.errorText]}>{children}</Text></View>;
}

export function Loading({ label = 'Opening the post office…' }: { label?: string }) {
  return <View style={s.loading}><ActivityIndicator color={colors.green} /><Text style={s.small}>{label}</Text></View>;
}

export function CityPicker({ value, onChange, disabled = false }: { value: CityId; onChange: (cityId: CityId) => void; disabled?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={s.field}><Text style={s.fieldLabel}>Your home city</Text><Pressable accessibilityRole="button" accessibilityLabel={`Home city: ${cities.find((city) => city.id === value)?.name}. Choose city`} accessibilityState={{ expanded, disabled }} disabled={disabled} onPress={() => setExpanded(!expanded)} style={s.input}><Text style={s.body}>{cities.find((city) => city.id === value)?.name} <Text style={s.muted}>⌄</Text></Text></Pressable>{expanded && <View style={s.cityList}>{cities.map((city) => <Pressable key={city.id} accessibilityRole="radio" accessibilityState={{ checked: value === city.id }} accessibilityLabel={city.name} onPress={() => { onChange(city.id); setExpanded(false); }} style={[s.cityOption, value === city.id && s.selected]}><Text style={s.body}>{city.name} <Text style={s.muted}>· {city.country}</Text></Text></Pressable>)}</View>}</View>;
}

export function Envelope({ small = false }: { small?: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.envelope, small && s.envelopeSmall]}><View style={s.envelopeFlap} /><View style={s.seal}><Text style={s.sealText}>p</Text></View></View>;
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 },
  page: { width: '100%', maxWidth: 440, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10 },
  brand: { fontSize: 30, letterSpacing: -1.5, fontWeight: '800', color: colors.ink },
  eyebrow: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 2, color: colors.muted, textTransform: 'uppercase' },
  title: { fontSize: 34, lineHeight: 40, letterSpacing: -1, fontWeight: '500', color: colors.ink, fontFamily: Platform.OS === 'ios' ? 'Georgia' : Platform.OS === 'web' ? 'Georgia, serif' : 'serif' },
  subtitle: { fontSize: 22, lineHeight: 28, fontWeight: '600', color: colors.ink, letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontSize: 13, lineHeight: 20, color: colors.muted },
  muted: { color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  grow: { flex: 1 },
  stack: { gap: 14 },
  tight: { gap: 6 },
  hero: { paddingTop: 8, paddingBottom: 8, gap: 16 },
  illustration: { backgroundColor: colors.pale, borderRadius: 90, width: 174, height: 156, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginVertical: 10, transform: [{ rotate: '-6deg' }] },
  card: { padding: 20, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 18, gap: 16 },
  divider: { height: 1, backgroundColor: colors.line },
  button: { minHeight: 50, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 13, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.card, fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: colors.line, borderWidth: 1 },
  secondaryButtonText: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 10 },
  linkText: { color: colors.green, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  input: { minHeight: 50, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 13, borderColor: colors.line, borderWidth: 1, borderRadius: 10, color: colors.ink, fontSize: 16, lineHeight: 24 },
  letterInput: { minHeight: 192, textAlignVertical: 'top', lineHeight: 28, paddingTop: 16 },
  notice: { padding: 14, borderRadius: 12, backgroundColor: colors.pale },
  errorBox: { backgroundColor: '#F6E5DC' },
  errorText: { color: colors.red },
  loading: { paddingVertical: 28, gap: 12, alignItems: 'center' },
  cityList: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' },
  cityOption: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 },
  selected: { backgroundColor: colors.pale },
  tab: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 10 },
  tabs: { flexDirection: 'row', gap: 5, padding: 4, backgroundColor: '#EAE8DD', borderRadius: 12 },
  tabText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  tabActive: { backgroundColor: colors.card },
  badge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 7, backgroundColor: colors.pale },
  badgeText: { color: colors.green, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  disconnected: { backgroundColor: colors.orange },
  envelope: { width: 112, height: 76, backgroundColor: colors.card, borderWidth: 1.5, borderColor: '#C4CABB', borderRadius: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  envelopeSmall: { width: 50, height: 36, borderRadius: 4 },
  envelopeFlap: { position: 'absolute', top: '-74%', width: '100%', height: '140%', borderWidth: 1, borderColor: '#C4CABB', backgroundColor: '#F2EFE3', transform: [{ rotate: '45deg' }] },
  seal: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  sealText: { color: colors.card, fontSize: 17, lineHeight: 23, fontFamily: 'serif', fontWeight: '700' },
  flightCard: { gap: 13, paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.line },
  flightHandle: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  route: { borderLeftWidth: 2, borderColor: colors.line, paddingLeft: 14, gap: 14, marginVertical: 4 },
  letterBody: { fontSize: 19, lineHeight: 31, color: colors.ink, fontFamily: Platform.OS === 'ios' ? 'Georgia' : Platform.OS === 'web' ? 'Georgia, serif' : 'serif' },
  token: { color: colors.ink, fontSize: 14, lineHeight: 24, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  counter: { fontSize: 48, fontWeight: '600', textAlign: 'center', color: colors.ink },
});
