import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cities, type CityId } from '../src/domain';

export const colors = { paper: '#FFFFFF', card: '#FFFFFF', ink: '#17212B', muted: '#566273', blue: '#2453FF', line: '#E3E8EF', pale: '#EDF2FF', orange: '#9B5320', red: '#AE3046', water: '#EAF1F7', land: '#DCE5ED' };

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
  return <View style={s.loading}><ActivityIndicator color={colors.blue} /><Text style={s.small}>{label}</Text></View>;
}

export function CityPicker({ value, onChange, disabled = false }: { value: CityId; onChange: (cityId: CityId) => void; disabled?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={s.field}><Text style={s.fieldLabel}>Your home city</Text><Pressable accessibilityRole="button" accessibilityLabel={`Home city: ${cities.find((city) => city.id === value)?.name}. Choose city`} accessibilityState={{ expanded, disabled }} disabled={disabled} onPress={() => setExpanded(!expanded)} style={s.input}><Text style={s.body}>{cities.find((city) => city.id === value)?.name} <Text style={s.muted}>⌄</Text></Text></Pressable>{expanded && <View style={s.cityList}>{cities.map((city) => <Pressable key={city.id} accessibilityRole="radio" aria-checked={value === city.id} accessibilityState={{ checked: value === city.id }} accessibilityLabel={city.name} onPress={() => { onChange(city.id); setExpanded(false); }} style={[s.cityOption, value === city.id && s.selected]}><Text style={s.body}>{city.name} <Text style={s.muted}>· {city.country}</Text></Text></Pressable>)}</View>}</View>;
}

export function Envelope({ small = false }: { small?: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.envelope, small && s.envelopeSmall]}><View style={s.envelopeFlap} /><View style={s.seal}><Text style={s.sealText}>p</Text></View></View>;
}

export function Wordmark() {
  return <Text accessibilityLabel="Pigeon" style={s.brand}>pigeon<Text style={{ color: colors.blue }}>.</Text></Text>;
}

export function ScreenHeader({ title, onBack, disabled = false, backLabel = 'Back to my flights' }: { title: string; onBack: () => void; disabled?: boolean; backLabel?: string }) {
  return <View style={s.screenHeader}><Pressable accessibilityRole="button" accessibilityLabel={backLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onBack} style={s.iconButton}><Text style={s.backIcon}>‹</Text></Pressable><Text accessibilityRole="header" style={[s.subtitle, s.grow]}>{title}</Text></View>;
}

export function PostalCard({ route, signature, children, footer }: { route: string; signature: string; children: ReactNode; footer?: ReactNode }) {
  return <View style={s.postalCard}><View style={s.postalHeader}><View style={s.grow}><Text style={s.postalTitle}>A little air mail.</Text><Text style={s.postalRoute}>{route}</Text></View><View accessible={false} importantForAccessibility="no-hide-descendants" style={s.stamp}><View style={s.stampDot} /><Text style={s.stampText}>PIGEON{'\n'}POST</Text></View></View>{children}<View style={s.between}><Text style={[s.small, { flexShrink: 1 }]}>— {signature}</Text>{footer}</View></View>;
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30 },
  page: { width: '100%', maxWidth: 480, flexGrow: 1, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10 },
  brand: { fontSize: 36, letterSpacing: -2, fontWeight: '900', color: colors.ink },
  eyebrow: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 2, color: colors.muted, textTransform: 'uppercase' },
  title: { fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 23, lineHeight: 29, fontWeight: '700', color: colors.ink, letterSpacing: -0.7 },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontSize: 13, lineHeight: 20, color: colors.muted },
  muted: { color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  grow: { flex: 1, minWidth: 0 },
  stack: { gap: 20 },
  tight: { gap: 6 },
  hero: { paddingTop: 8, paddingBottom: 8, gap: 16 },
  illustration: { backgroundColor: colors.pale, borderRadius: 100, width: 174, height: 174, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginVertical: 10 },
  card: { padding: 20, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 18, gap: 16 },
  divider: { height: 1, backgroundColor: colors.line },
  button: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 30, backgroundColor: colors.blue, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.card, fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: colors.line, borderWidth: 1 },
  secondaryButtonText: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 10 },
  linkText: { color: colors.blue, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  input: { minHeight: 52, backgroundColor: '#F3F5F8', paddingHorizontal: 16, paddingVertical: 14, borderColor: colors.line, borderWidth: 1, borderRadius: 16, color: colors.ink, fontSize: 16, lineHeight: 24 },
  letterInput: { minHeight: 154, textAlignVertical: 'top', fontSize: 23, lineHeight: 32, color: colors.ink, padding: 0, paddingTop: 4 },
  notice: { padding: 16, borderRadius: 16, backgroundColor: colors.pale },
  errorBox: { backgroundColor: '#FFF0F2' },
  errorText: { color: colors.red },
  loading: { paddingVertical: 28, gap: 12, alignItems: 'center' },
  cityList: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' },
  cityOption: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 },
  selected: { backgroundColor: colors.pale },
  tab: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 24 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#EEF1F5', borderRadius: 28 },
  tabText: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  tabActive: { backgroundColor: colors.ink },
  tabActiveText: { color: colors.card },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: colors.pale },
  badgeText: { color: colors.blue, fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.blue },
  disconnected: { backgroundColor: colors.orange },
  envelope: { width: 112, height: 76, backgroundColor: colors.card, borderWidth: 1.5, borderColor: '#9AADE8', borderRadius: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  envelopeSmall: { width: 50, height: 36, borderRadius: 4 },
  envelopeFlap: { position: 'absolute', top: '-74%', width: '100%', height: '140%', borderWidth: 1, borderColor: '#9AADE8', backgroundColor: colors.pale, transform: [{ rotate: '45deg' }] },
  seal: { width: 22, height: 22, borderRadius: 13, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  sealText: { color: colors.card, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  flightCard: { gap: 13, paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.line },
  flightHandle: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  route: { borderLeftWidth: 2, borderColor: colors.line, paddingLeft: 14, gap: 14, marginVertical: 4 },
  letterBody: { fontSize: 23, lineHeight: 33, color: colors.ink },
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#F4F6F9' },
  backIcon: { fontSize: 30, lineHeight: 36, color: colors.ink },
  postalCard: { padding: 22, paddingBottom: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomWidth: 4, borderBottomColor: colors.blue, borderRadius: 18, gap: 22 },
  postalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  postalTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.blue },
  postalRoute: { fontSize: 11, lineHeight: 17, letterSpacing: 0.8, color: colors.muted, textTransform: 'uppercase', marginTop: 4 },
  stamp: { width: 54, minHeight: 66, padding: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#A5B4EA', backgroundColor: colors.pale, alignItems: 'center', gap: 4 },
  stampDot: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.blue },
  stampText: { fontSize: 8, lineHeight: 10, color: colors.blue, textAlign: 'center', fontWeight: '600' },
  recipientChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.pale, gap: 10, maxWidth: '100%' },
  recipientName: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.blue, flexShrink: 1 },
  friend: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F3F7', alignItems: 'center', justifyContent: 'center' },
  dock: { backgroundColor: colors.card, borderRadius: 26, padding: 20, gap: 14, borderWidth: 1, borderColor: colors.line },
  handle: { width: 40, height: 4, borderRadius: 4, alignSelf: 'center', backgroundColor: '#C7D0DA', marginBottom: 4 },
  token: { color: colors.ink, fontSize: 14, lineHeight: 24, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  counter: { fontSize: 48, fontWeight: '600', textAlign: 'center', color: colors.ink },
});
