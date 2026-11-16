import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ConvexError } from 'convex/values';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { IconButton, PrimaryButton, font, palette } from './page03/atoms';
import { Pigeon } from './Pigeon';
import { formatPhoneNumber, phoneNumber, resendSeconds, smsCode, usernameValue, validUsername } from './onboardingModel';

type SendCode = (phone: string) => Promise<{ retryAt: number }>;
type VerifyCode = (phone: string, code: string) => Promise<unknown>;
const usernameGuidance = 'Use 3–24 letters (a–z), numbers, dots, or underscores. Don’t start with a dot.';

function failure(cause: unknown, fallback: string): string {
  return cause instanceof ConvexError && typeof cause.data === 'string' ? cause.data : fallback;
}

export function OnboardingFrame({ step, back, children, footer }: { step?: number; back?: () => void; children: ReactNode | ((compact: boolean, tight: boolean) => ReactNode); footer: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const compact = height > 0 && height < 700;
  const tight = height > 0 && height < 540;
  return <KeyboardAvoidingView style={o.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={[o.page, { paddingTop: Math.max(insets.top, compact ? 16 : 62), paddingBottom: tight ? 8 : Math.max(insets.bottom, compact ? 12 : 26) }]}>
    <View style={[o.header, compact && { marginBottom: tight ? 4 : 12 }]}>{back ? <View style={{ marginLeft: -12 }}><IconButton name="back" label="Go back" onPress={back} /></View> : <Text accessibilityLabel="Pigeon" style={[o.brand, !step && { color: palette.blue }]}>pigeon<Text style={{ color: palette.blue }}>.</Text></Text>}{step && <Text style={o.small}>{step} of 3</Text>}</View>
    {typeof children === 'function' ? children(compact, tight) : children}<View style={[o.footer, compact && { paddingTop: tight ? 8 : 16 }]}>{footer}</View>
  </View></KeyboardAvoidingView>;
}

function WelcomeArt({ compact }: { compact: boolean }) {
  const [height, setHeight] = useState(214);
  return <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={[o.welcomeArt, compact && { marginTop: 8, marginBottom: 8 }]}><View style={[o.welcomeScene, { transform: [{ scale: Math.min(1, height / 214) }] }]}><View style={o.halo} /><Pigeon /><View style={o.envelope}><Svg width={60} height={43} viewBox="0 0 60 43"><Rect x={2} y={2} width={56} height={39} rx={5} fill="white" stroke="#AFBDCE" strokeWidth={1.5} /><Path d="m4 5 25 20c1 1 2 1 3 0L56 5M4 37l19-17m33 17L38 21" fill="none" stroke="#AFBDCE" strokeWidth={1.5} /><Rect x={44} y={7} width={8} height={9} rx={1} fill={palette.blue} /></Svg></View></View></View>;
}

function ErrorMessage({ children }: { children: string }) {
  return children ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={o.error}>{children}</Text> : null;
}

export function PhoneOnboarding({ sendCode, verifyCode, unavailable = false, preview = false }: { sendCode: SendCode; verifyCode: VerifyCode; unavailable?: boolean; preview?: boolean }) {
  const [country, setCountry] = useState('+1');
  const [number, setNumber] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const remaining = resendSeconds(retryAt, now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  function changeNumber() { if (!pending.current) { setSentTo(null); setCode(''); setError(''); setNotice(''); } }

  async function send() {
    if (pending.current || remaining > 0) return;
    const phone = sentTo ?? (preview ? `${country} ${number}`.trim() || '+1' : phoneNumber(country, number));
    if (!phone) { setError('Enter a valid phone number, including its country code.'); return; }
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await sendCode(phone);
      setRetryAt(result.retryAt); setNow(Date.now()); setSentTo(phone); setCode(''); setNotice(preview ? '' : 'A new code is on its way.');
    } catch (cause) { setError(failure(cause, 'We couldn’t send a code. Check your number and connection, then try again.')); setRetryAt(Date.now() + 60_000); setNow(Date.now()); }
    finally { pending.current = false; setBusy(false); }
  }

  async function verify() {
    if (pending.current || !sentTo || (!preview && code.length !== 6)) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try { await verifyCode(sentTo, code); }
    catch (cause) { setError(failure(cause, 'We couldn’t verify that code. It may be incorrect or expired. Try again, or send a new code.')); setCode(''); input.current?.focus(); }
    finally { pending.current = false; setBusy(false); }
  }

  if (sentTo) return <OnboardingFrame step={2} back={busy ? undefined : changeNumber} footer={<PrimaryButton label={busy ? 'Please wait…' : 'Verify & continue'} disabled={busy || (!preview && code.length !== 6)} onPress={() => void verify()} />}>
    {(compact, tight) => <><Text accessibilityRole="header" style={[o.title, compact && o.compactTitle, tight && { display: 'none' }]}>Check your{'\n'}messages.</Text>
    <Text style={o.body}>{preview ? 'Enter your verification code for' : 'Enter the 6-digit code we sent to'}</Text><View style={o.numberLine}><Text style={[o.body, { color: palette.ink }]}>{sentTo}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={changeNumber}><Text style={o.link}>Change</Text></Pressable></View>
    <View style={[o.codeArea, compact && { marginTop: 16 }]}><View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={o.codeBoxes}>{Array.from({ length: 6 }, (_, i) => <View key={i} style={[o.codeBox, i === Math.min(code.length, 5) && { borderColor: palette.blue, borderWidth: 2 }, Boolean(error) && { borderColor: '#A33246' }]}><Text style={o.digit}>{code[i] ?? ''}</Text></View>)}</View><TextInput ref={input} accessibilityLabel={preview ? 'Verification code' : 'Six-digit SMS code'} value={code} onChangeText={value => { setCode(preview ? value.slice(0, 6) : smsCode(value)); setError(''); }} keyboardType="number-pad" inputMode="numeric" autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} textContentType="oneTimeCode" autoFocus maxLength={12} editable={!busy} caretHidden style={o.codeInput} onSubmitEditing={() => void verify()} /></View>
    <ErrorMessage>{error}</ErrorMessage>{notice ? <Text accessibilityLiveRegion="polite" style={o.small}>{notice}</Text> : null}
    {remaining > 0 ? <Text style={o.small}>Resend code in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Text> : <Pressable accessibilityRole="button" disabled={busy} onPress={() => void send()} style={o.textButton}><Text style={o.link}>Send a new code</Text></Pressable>}
    </>}
  </OnboardingFrame>;

  return <OnboardingFrame step={1} footer={<><PrimaryButton label={busy ? 'Sending…' : 'Send code'} disabled={busy || unavailable || remaining > 0} onPress={() => void send()} />{!preview && <LegalLinks />}</>}>
    {(compact, tight) => <><Text accessibilityRole="header" style={[o.title, compact && o.compactTitle, tight && { display: 'none' }]}>Good things{'\n'}take flight.</Text><Text style={o.body}>A slower way to say hello.</Text>
    <WelcomeArt compact={compact} />
    <Text style={o.label}>Your phone number</Text><View style={[o.phoneField, Boolean(error) && { borderColor: '#A33246' }]}><TextInput accessibilityLabel="Country calling code" value={country} onChangeText={value => { setCountry(value); setNumber(formatPhoneNumber(value, number)); setError(''); }} keyboardType="phone-pad" maxLength={4} editable={!busy} style={[o.inputText, { width: 64 }]} /><View style={o.separator} /><TextInput accessibilityLabel="Your phone number" value={number} onChangeText={value => { setNumber(formatPhoneNumber(country, value)); setError(''); }} placeholder={country.trim() === '+1' ? '(415) 555-0126' : 'Phone number'} placeholderTextColor="#8C95A2" keyboardType="phone-pad" autoComplete="tel-national" textContentType="telephoneNumber" editable={!busy} maxLength={24} style={[o.inputText, { flex: 1, minWidth: 0 }]} onSubmitEditing={() => void send()} /></View>
    <ErrorMessage>{unavailable ? 'Phone sign-in is not configured in this build yet.' : error}</ErrorMessage>{remaining > 0 && <Text style={o.small}>Please wait {remaining}s before requesting another code.</Text>}
    </>}
  </OnboardingFrame>;
}

function LegalLinks() {
  const terms = process.env.EXPO_PUBLIC_TERMS_URL;
  const privacy = process.env.EXPO_PUBLIC_PRIVACY_URL;
  const [error, setError] = useState('');
  async function open(url?: string) {
    if (!url || !/^https:\/\//.test(url)) { setError('The legal links are not available yet.'); return; }
    try { await Linking.openURL(url); } catch { setError('Could not open this link. Please try again.'); }
  }
  const hasTerms = Boolean(terms && /^https:\/\//.test(terms));
  const hasPrivacy = Boolean(privacy && /^https:\/\//.test(privacy));
  return <View><Text style={[o.small, o.legal]}>By continuing, you agree to our <Text accessibilityRole={hasTerms ? 'link' : undefined} style={hasTerms ? o.legalLink : undefined} onPress={hasTerms ? () => void open(terms) : undefined}>Terms</Text>{'\n'}and <Text accessibilityRole={hasPrivacy ? 'link' : undefined} style={hasPrivacy ? o.legalLink : undefined} onPress={hasPrivacy ? () => void open(privacy) : undefined}>Privacy Policy</Text>.</Text>{(!hasTerms || !hasPrivacy) && <Text style={[o.small, o.legal]}>Legal links are not configured in this build.</Text>}<ErrorMessage>{error}</ErrorMessage></View>;
}

export function ProfileOnboarding({ availability, checkUsername, complete, onBack, preview = false }: { availability: { available: boolean; username: string } | undefined; checkUsername: (value: string) => void; complete: (value: { username: string; displayName?: string }) => Promise<unknown>; onBack: () => void; preview?: boolean }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const normalized = usernameValue(username);
  const valid = validUsername(username);
  const currentAvailability = availability?.username === normalized ? availability : undefined;
  const taken = !preview && currentAvailability?.available === false;
  const usernameError = username && !valid ? usernameGuidance : taken ? 'That username is taken. Try another.' : '';
  useEffect(() => { if (preview) return; const timer = setTimeout(() => checkUsername(valid ? normalized : ''), 250); return () => clearTimeout(timer); }, [normalized, valid, checkUsername, preview]);
  async function submit() {
    if (pending.current || !valid || taken) return;
    pending.current = true; setBusy(true); setError('');
    try { await complete({ username: normalized, displayName: name.trim() || undefined }); }
    catch (cause) { setError(failure(cause, 'We couldn’t save your profile. Check your connection and try again.')); }
    finally { pending.current = false; setBusy(false); }
  }
  return <OnboardingFrame step={3} back={busy ? undefined : onBack} footer={<PrimaryButton label={busy ? 'Making your flock…' : 'Meet my pigeons'} disabled={busy || !valid || taken} onPress={() => void submit()} />}>
    {(compact, tight) => <><Text accessibilityRole="header" style={[o.title, compact && o.compactTitle, tight && { display: 'none' }]}>What should{'\n'}we call you?</Text>
    <View style={[o.profileFields, compact && { marginTop: tight ? 8 : 12 }]}><Text style={[o.label, tight && { marginBottom: 6 }]}>Username</Text><View style={[o.phoneField, tight && { minHeight: 50 }, { borderColor: usernameError ? '#A33246' : palette.blue, borderWidth: 2 }]}><Text style={o.body}>@</Text><TextInput accessibilityLabel="Username" value={username} onChangeText={value => { setUsername(value); setError(''); }} placeholder="your.username" autoCapitalize="none" autoCorrect={false} autoComplete="username-new" editable={!busy} maxLength={25} style={[o.inputText, { flex: 1, minWidth: 0 }]} /></View>
      {usernameError ? <ErrorMessage>{usernameError}</ErrorMessage> : <Text style={[o.small, { marginTop: 10 }]}>{usernameGuidance}</Text>}
      <Text style={[o.label, { marginTop: tight ? 8 : compact ? 12 : 36 }, tight && { marginBottom: 6 }]}>Name <Text style={o.small}>(optional)</Text></Text><TextInput accessibilityLabel="Name (optional)" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" editable={!busy} maxLength={50} style={[o.phoneField, o.inputText, tight && { minHeight: 50 }]} />
    </View><ErrorMessage>{error}</ErrorMessage>
    </>}
  </OnboardingFrame>;
}

export function FlockReady({ name, pigeons, onOpenMap }: { name: string; pigeons: { name: string }[]; onOpenMap: () => void }) {
  const featured = pigeons.find(bird => bird.name === 'Mochi') ?? pigeons[0] ?? { name: 'Mochi' };
  return <OnboardingFrame footer={<PrimaryButton label="Explore the map" onPress={onOpenMap} />}>
    {(compact, tight) => <><Text accessibilityRole="header" style={[o.title, compact && o.compactTitle, tight && { display: 'none' }]}>Your flock{'\n'}is ready.</Text><Text style={o.body}>Five little couriers. All yours, {name}.</Text>
    <View style={[o.readyArt, compact && { height: 164, marginTop: 12 }]}><Pigeon name={featured.name} size={compact ? 126 : 182} /><Text style={o.label}>{featured.name}</Text></View><View style={o.flock}>{pigeons.filter(bird => bird.name !== featured.name).map(bird => <View key={bird.name} style={o.bird}><Pigeon name={bird.name} size={70} /><Text style={o.small}>{bird.name}</Text></View>)}</View>
    </>}
  </OnboardingFrame>;
}

const o = StyleSheet.create({
  root: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'white' },
  page: { flex: 1, minHeight: 0, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 24 },
  header: { flexShrink: 0, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  brand: { fontFamily: font.brand, fontSize: 29, letterSpacing: -1.4, color: palette.ink },
  title: { fontFamily: font.heading, fontSize: 36, lineHeight: 38, letterSpacing: -1.5, color: palette.ink, marginBottom: 16 },
  compactTitle: { fontSize: 30, lineHeight: 32, marginBottom: 12 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, color: palette.secondary },
  small: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20, color: palette.secondary },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: palette.ink, marginBottom: 10 },
  inputText: { fontFamily: 'Inter_400Regular', fontSize: 18, color: palette.ink, paddingVertical: 0, outlineWidth: 0 },
  phoneField: { flexDirection: 'row', alignItems: 'center', minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 16, gap: 10 },
  separator: { height: 24, width: 1, backgroundColor: palette.line, marginRight: 4 },
  welcomeArt: { height: 214, flexShrink: 1, minHeight: 0, overflow: 'hidden', marginTop: 24, marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  welcomeScene: { width: '100%', height: 214, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 180, height: 160, borderRadius: 100, backgroundColor: '#EAF1F7', top: 25 },
  envelope: { position: 'absolute', top: 140, left: '65%', transform: [{ rotate: '9deg' }] },
  footer: { marginTop: 'auto', paddingTop: 32, gap: 12 },
  legal: { textAlign: 'center', marginTop: 4 },
  legalLink: { color: palette.ink, textDecorationLine: 'underline' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: '#A33246', marginTop: 10 },
  link: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, color: palette.blue },
  numberLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  codeArea: { height: 62, marginTop: 40, marginBottom: 16 },
  codeBoxes: { flexDirection: 'row', gap: 6, height: 62 },
  codeBox: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: 'Inter_400Regular', fontSize: 27, color: palette.ink },
  codeInput: { position: 'absolute', inset: 0, color: 'transparent', backgroundColor: 'transparent', outlineWidth: 0, outlineStyle: 'solid', outlineColor: 'transparent', fontSize: 24 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  profileFields: { marginTop: 40 },
  readyArt: { alignItems: 'center', marginTop: 24, height: 220 },
  flock: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  bird: { alignItems: 'center' },
});
