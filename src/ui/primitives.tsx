import React, { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePigeon } from '../client/PigeonProvider';
import { Bird } from './Bird';
import { colors, mono } from './theme';

export function Txt({ children, style, ...props }: TextProps) {
  return <Text {...props} style={[styles.text, style]}>{children}</Text>;
}

export type IconName = 'sky' | 'inbox' | 'nest' | 'shop' | 'arrow' | 'back' | 'close' | 'plus' | 'lock' | 'globe' | 'check' | 'clock' | 'share' | 'chevron' | 'send' | 'heart' | 'shield' | 'settings' | 'logout' | 'flag';
const paths: Record<IconName, string> = {
  sky: 'M3 15c-2-4 3-7 5-4 0-7 10-7 10-1 5-1 6 7 1 7H5M7 21l3-2m5 2 2-2',
  inbox: 'M3 5h18v14H3ZM3 6l9 7 9-7',
  nest: 'm3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7',
  shop: 'M5 8h14l2 13H3ZM8 8V6a4 4 0 0 1 8 0v2',
  arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'M20 12H4m6-6-6 6 6 6', close: 'm6 6 12 12M6 18 18 6',
  plus: 'M12 5v14M5 12h14', lock: 'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  globe: 'M2 12h20M12 2c-7 5-7 15 0 20 7-5 7-15 0-20',
  check: 'm5 12 4 4 10-10', clock: 'M12 6v6l4 2', share: 'M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9',
  chevron: 'm9 5 7 7-7 7', send: 'm3 3 19 9-19 9 4-9ZM7 12h15',
  heart: 'M12 21 3 12C-3 3 8-1 12 6c4-7 15-3 9 6Z',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6ZM8 12l3 3 5-6',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  logout: 'M9 3H3v18h6m5-15 6 6-6 6m-6-6h13', flag: 'M5 22V3h14l-3 5 3 5H5',
};
export function Icon({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24">
    {(name === 'globe' || name === 'clock') && <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.6} fill="none"/>}
    <Path d={paths[name]} stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" fill="none"/>
  </Svg>;
}

export function Button({ label, onPress, variant = 'primary', icon, disabled = false, busy = false, style, small = false }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName;
  disabled?: boolean; busy?: boolean; style?: ViewStyle; small?: boolean;
}) {
  const ink = variant === 'primary' ? colors.white : variant === 'danger' ? '#A13D30' : colors.ink;
  const reduced = useReducedMotion();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} aria-busy={busy} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, small && { minHeight: 44, paddingHorizontal: 16 },
      variant === 'primary' ? { backgroundColor: colors.blue } : variant === 'secondary' ? { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line } : variant === 'danger' ? { backgroundColor: '#FCECE7' } : { backgroundColor: 'transparent' },
      style, (disabled || busy) && { opacity: 0.45 }, pressed && { opacity: 0.8, transform: [{ scale: reduced ? 1 : 0.98 }] }]}>
    {busy ? <ActivityIndicator color={ink} size="small"/> : icon ? <Icon name={icon} size={18} color={ink}/> : null}
    <Txt style={[styles.buttonText, { color: ink }]}>{label}</Txt>
  </Pressable>;
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'blue' | 'green' | 'coral' | 'paper'; icon?: IconName }) {
  const ink = tone === 'blue' ? colors.blue : tone === 'green' ? colors.green : tone === 'coral' ? '#AF4B39' : colors.muted;
  const fill = tone === 'blue' ? '#EDF0FF' : tone === 'green' ? '#E8F3EC' : tone === 'coral' ? '#FBECE6' : tone === 'paper' ? colors.paper : '#F0F3F4';
  return <View style={[styles.badge, { backgroundColor: fill }]}>{icon && <Icon name={icon} size={12} color={ink}/>}<Txt style={{ fontSize: 11, fontWeight: '700', color: ink, letterSpacing: 0.3 }}>{label}</Txt></View>;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: TextProps['style'] }) {
  return <Txt style={[{ fontFamily: mono, fontSize: 10, fontWeight: '500', letterSpacing: 1.7, textTransform: 'uppercase', color: colors.muted }, style]}>{children}</Txt>;
}

export const navigation = [
  { label: 'Sky', route: '/', icon: 'sky' }, { label: 'Inbox', route: '/inbox', icon: 'inbox' },
  { label: 'Nest', route: '/nest', icon: 'nest' }, { label: 'Shop', route: '/shop', icon: 'shop' },
] as const;

export function Brand() {
  return <Pressable onPress={() => router.push('/')} accessibilityRole="link" accessibilityLabel="Pigeon home" style={styles.brand}>
    <View style={styles.brandMark}><Bird size={43}/></View><Txt style={styles.wordmark}>pigeon<Txt style={{ color: colors.blue }}>.</Txt></Txt>
  </Pressable>;
}

export function AppHeader({ publicView = false }: { publicView?: boolean }) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const pigeon = usePigeon();
  const insets = useSafeAreaInsets();
  return <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), paddingHorizontal: width > 900 ? 48 : 20 }]}>
    <Brand/>
    {width >= 760 && !publicView && <View style={styles.desktopNav}>{navigation.map(item => {
      const active = pathname === item.route;
      return <Pressable key={item.label} accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} onPress={() => router.push(item.route)} style={[styles.navItem, active && { backgroundColor: colors.ink }]}>
        <Icon name={item.icon} color={active ? colors.white : colors.muted} size={17}/><Txt style={{ fontSize: 13, fontWeight: '600', color: active ? colors.white : colors.muted }}>{item.label}</Txt>
      </Pressable>;
    })}</View>}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      {width > 1080 && <Eyebrow style={{ fontSize: 9 }}>GOOD THINGS TAKE FLIGHT</Eyebrow>}
      {pigeon.authenticated && pigeon.profile ? <Pressable onPress={() => router.push('/nest')} accessibilityRole="button" accessibilityLabel="Open your nest" style={styles.avatar}><Txt style={{ color: colors.blue, fontWeight: '700' }}>{pigeon.profile.handle.slice(0, 1).toUpperCase()}</Txt></Pressable>
        : <Button label="Your nest" small variant="secondary" icon="arrow" onPress={() => router.push('/sign-in')}/>}
    </View>
  </View>;
}

export function NetworkNotice() {
  const { configured, connected, error } = usePigeon();
  if (!configured) return <Notice compact text="The post office isn’t connected yet. Explore the sky; sending and sign-in will open once the backend is configured."/>;
  if (!connected) return <Notice compact text="Reconnecting · Your last-known flights are here. New sends and catches are paused."/>;
  return error ? <Notice compact tone="error" text={error}/> : null;
}

export function Page({ children, title, eyebrow, subtitle, back = false, narrow = false, right, publicView = false }: {
  children: ReactNode; title?: string; eyebrow?: string; subtitle?: string; back?: boolean; narrow?: boolean; right?: ReactNode; publicView?: boolean;
}) {
  const { width } = useWindowDimensions();
  return <View style={styles.page}><AppHeader publicView={publicView}/><NetworkNotice/><ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
    <View style={[styles.pageBody, { maxWidth: narrow ? 720 : 1248, paddingHorizontal: width > 760 ? 48 : 20 }]}>
      {back && <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, marginBottom: 16 }}><Icon name="back" size={16}/><Txt style={{ fontSize: 12 }}>Back to the sky</Txt></Pressable>}
      {title && <View style={{ flexDirection: width >= 760 ? 'row' : 'column', alignItems: width >= 760 ? 'center' : 'stretch', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>{width < 760 && right}<View style={{ flex: width >= 760 ? 1 : undefined, gap: 12 }}>{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<Txt accessibilityRole="header" style={[styles.title, width < 760 && { fontSize: 32, lineHeight: 39 }]}>{title}</Txt>{subtitle && <Txt style={styles.subtitle}>{subtitle}</Txt>}</View>{width >= 760 && right}</View>}
      {children}
    </View>
  </ScrollView></View>;
}

export function Notice({ text, tone = 'info', compact = false }: { text: string; tone?: 'info' | 'error' | 'success'; compact?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: compact ? 20 : 16, paddingVertical: compact ? 10 : 16, backgroundColor: tone === 'error' ? '#FCEDE8' : tone === 'success' ? '#EAF4EC' : colors.paper, borderRadius: compact ? 0 : 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
    <Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'flag' : 'inbox'} size={15} color={tone === 'error' ? '#A13D30' : colors.muted}/>
    <Txt style={{ color: tone === 'error' ? '#A13D30' : colors.muted, fontSize: compact ? 11 : 13, lineHeight: compact ? 17 : 20, flex: 1 }}>{text}</Txt>
  </View>;
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={{ gap: 8 }}><Txt style={styles.label}>{label}</Txt><TextInput accessibilityLabel={label} placeholderTextColor={colors.faint} {...props} style={[styles.input, props.style]}/>{hint && <Txt style={{ fontSize: 11, color: colors.muted, lineHeight: 17 }}>{hint}</Txt>}</View>;
}

export function EmptyState({ title, body, action, icon = 'inbox' }: { title: string; body: string; action?: ReactNode; icon?: IconName }) {
  return <View style={styles.empty}><View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.paper, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}><Icon name={icon} size={28} color={colors.muted}/></View><Txt style={{ fontSize: 21, fontWeight: '600', textAlign: 'center' }}>{title}</Txt><Txt style={{ fontSize: 14, lineHeight: 23, color: colors.muted, textAlign: 'center', maxWidth: 380 }}>{body}</Txt>{action && <View style={{ marginTop: 8 }}>{action}</View>}</View>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { authenticated, loading, profile } = usePigeon();
  if (loading) return <Loading/>;
  if (!authenticated || !profile) return <EmptyState title="Every pigeon needs a home." body="Make a nest to send little thoughts, meet your mail, and collect some very well-traveled friends." action={<Button label={authenticated ? 'Finish your profile' : 'Make yourself at home'} icon="arrow" onPress={() => router.push('/sign-in')}/>}/>;
  return <>{children}</>;
}

export function Loading({ label = 'Checking the post…' }: { label?: string }) {
  return <View accessibilityLiveRegion="polite" style={{ padding: 48, alignItems: 'center', gap: 16 }}><ActivityIndicator color={colors.blue}/><Txt style={{ fontSize: 13, color: colors.muted }}>{label}</Txt></View>;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  return reduced;
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lock = React.useRef(false);
  async function run(action: () => Promise<void>, success?: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setMessage(null);
    try { await action(); if (success) setMessage(success); }
    catch (e) { setError(e instanceof Error ? e.message : 'The post hit a snag. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, error, message, run, clear: () => { setError(null); setMessage(null); } };
}

export function ActionFeedback({ action }: { action: ReturnType<typeof useAction> }) {
  return action.error ? <Notice tone="error" text={action.error}/> : action.message ? <Notice tone="success" text={action.message}/> : null;
}

const styles = StyleSheet.create({
  text: { fontSize: 15, color: colors.ink, fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' : undefined },
  button: { minHeight: 52, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  buttonText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 28, fontWeight: '800', letterSpacing: -1.7 },
  header: { minHeight: 88, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.background },
  desktopNav: { flexDirection: 'row', padding: 5, gap: 3, backgroundColor: '#EFF2F0', borderRadius: 16 },
  navItem: { minHeight: 38, borderRadius: 12, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 42, height: 42, backgroundColor: '#EBEEFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, backgroundColor: colors.background },
  pageBody: { width: '100%', alignSelf: 'center', paddingTop: 40, paddingBottom: 48 },
  title: { fontSize: 40, fontWeight: '700', letterSpacing: -1.5, lineHeight: 48 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 23, maxWidth: 520 },
  label: { fontSize: 12, fontWeight: '600', color: colors.ink, letterSpacing: 0.1 },
  input: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#DCE3E5', borderRadius: 12, backgroundColor: colors.white, color: colors.ink, fontSize: 15 },
  empty: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 48, borderRadius: 20, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 },
});
