import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Component, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../convex/_generated/api';
import type { CityId } from '../src/domain';
import { Mailbox } from './Mailbox';
import { Button, CityPicker, Envelope, Field, Link, Loading, Notice, s } from './ui';

type SetupMode = 'create' | 'join' | 'account';

function failure(cause: unknown, fallback: string): string {
  return cause instanceof ConvexError && typeof cause.data === 'string' ? cause.data : fallback;
}

export function LetterApp({ deployment }: { deployment: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const connection = useConvexConnectionState();
  const [mode, setMode] = useState<SetupMode>('create');
  const [diagnostic, setDiagnostic] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const connected = connection.isWebSocketConnected;

  async function leave() {
    setSigningOut(true);
    setError('');
    try { await signOut(); }
    catch { setError('Sign out did not finish. Please try again.'); }
    finally { setSigningOut(false); }
  }

  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}><View style={s.page}>
    <View style={s.header}><View style={s.grow}><Text style={s.brand}>pigeon.</Text><Text style={s.eyebrow}>A little slower. A little closer.</Text></View><View style={s.row}><View style={[s.dot, !connected && s.disconnected]} /><Text accessibilityLiveRegion="polite" style={s.small}>{connected ? 'Connected' : 'Reconnecting'}</Text></View></View>
    {!connected && <Notice>The post office is reconnecting. Saved drafts stay on this device; delivery waits for the server.</Notice>}
    {diagnostic && <QueryBoundary><Diagnostic connected={connected} /></QueryBoundary>}
    <View style={diagnostic ? { display: 'none' } : undefined}>{isLoading ? <Loading label="Restoring your sign-in…" /> : <QueryBoundary key={isAuthenticated ? 'signed-in' : 'signed-out'}>{isAuthenticated ? <SignedIn deployment={deployment} mode={mode} setMode={setMode} connected={connected} /> : <Welcome mode={mode} setMode={setMode} connected={connected} />}</QueryBoundary>}</View>
    {error ? <Notice error>{error}</Notice> : null}
    <View style={s.divider} />
    <View style={s.between}><Link label={diagnostic ? '← Back to letters' : 'Connection diagnostic'} onPress={() => setDiagnostic(!diagnostic)} />{isAuthenticated && <Link label={signingOut ? 'Signing out…' : 'Sign out'} disabled={signingOut || !connected} onPress={() => void leave()} />}</View>
    {isAuthenticated && <Text style={s.small}>Anonymous demo access belongs to this session. Signing out loses access to that demo identity; it does not switch you to your partner.</Text>}
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Welcome({ mode, setMode, connected }: { mode: SetupMode; setMode: (mode: SetupMode) => void; connected: boolean }) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(false);

  async function enter() {
    if (request.current) return;
    request.current = true;
    setBusy(true);
    setError('');
    try {
      if (mode === 'account') await signIn('password', { email: email.trim(), password, flow: 'signIn' });
      else await signIn('anonymous');
    } catch {
      setError(mode === 'account' ? 'Could not sign in. Check your email and password, then try again.' : 'Could not start an anonymous session. Check your connection and try again.');
    } finally { request.current = false; setBusy(false); }
  }

  return <View style={s.stack}>
    <View style={s.hero}><View style={s.illustration}><Envelope /></View><Text style={s.eyebrow}>PRIVATE LETTERS, REAL DISTANCE</Text><Text style={s.title}>Some things are{ '\n' }worth the wait.</Text><Text style={[s.body, s.muted]}>Send a small, sealed letter. Your pigeon takes the scenic route from your city to theirs.</Text></View>
    <View style={s.card}><ModeTabs mode={mode} setMode={(next) => { setMode(next); setError(''); }} disabled={busy} />
      {mode === 'account' ? <><Text style={s.subtitle}>Welcome back.</Text><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} /><Text style={s.small}>Use an existing Pigeon account. Regular accounts send at normal distance-based speed.</Text></> : <><Text style={s.subtitle}>{mode === 'create' ? 'A pair of pen pals.' : 'An invitation for you.'}</Text><Text style={s.body}>{mode === 'create' ? 'Start an isolated demo, then privately share a one-use invitation with someone on a second device.' : 'Have your partner’s private invitation ready. Joining connects only the two of you.'}</Text><Notice>Demo speed: 30–90 seconds. Normal travel estimates are always shown. No seeded letters or automatic replies.</Notice></>}
      {error ? <Notice error>{error}</Notice> : null}
      <Button label={busy ? 'Connecting…' : mode === 'account' ? 'Sign in' : mode === 'create' ? 'Create a demo pair →' : 'Join a demo pair →'} disabled={!connected || busy || (mode === 'account' && (!email.trim() || !password))} onPress={() => void enter()} />
      {mode !== 'account' && <Text style={s.small}>Your anonymous sign-in is saved on this device. Each partner needs a separate browser profile or device.</Text>}
    </View>
  </View>;
}

function ModeTabs({ mode, setMode, disabled }: { mode: SetupMode; setMode: (mode: SetupMode) => void; disabled: boolean }) {
  return <View accessibilityRole="tablist" style={s.tabs}>{([['create', 'Create pair'], ['join', 'Join pair'], ['account', 'Sign in']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: mode === value, disabled }} disabled={disabled} style={[s.tab, mode === value && s.tabActive]} onPress={() => setMode(value)}><Text style={s.tabText}>{label}</Text></Pressable>)}</View>;
}

function SignedIn({ deployment, mode, setMode, connected }: { deployment: string; mode: SetupMode; setMode: (mode: SetupMode) => void; connected: boolean }) {
  const profile = useQuery(api.profiles.me, {});
  if (profile === undefined) return <Loading label="Finding your nest…" />;
  if (profile === null) return <ProfileSetup mode={mode} setMode={setMode} connected={connected} />;
  return <Mailbox key={profile.id} profile={profile} deployment={deployment} connected={connected} />;
}

function ProfileSetup({ mode, setMode, connected }: { mode: SetupMode; setMode: (mode: SetupMode) => void; connected: boolean }) {
  const create = useMutation(api.starterPair.create);
  const join = useMutation(api.starterPair.join);
  const save = useMutation(api.profiles.save);
  const [handle, setHandle] = useState('');
  const [cityId, setCityId] = useState<CityId>('san-francisco');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const validHandle = /^[a-z0-9_]{3,24}$/.test(handle.trim().replace(/^@/, '').toLowerCase());

  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (mode === 'join') await join({ handle, cityId, token: token.trim() });
      else if (mode === 'create') await create({ handle, cityId });
      else await save({ handle, cityId });
      setToken('');
    } catch (cause) { setError(failure(cause, 'Setup could not be confirmed. Your inputs are kept; retry the same request.')); }
    finally { pending.current = false; setBusy(false); }
  }

  return <View style={s.stack}><Text style={s.eyebrow}>YOUR RETURN ADDRESS</Text><Text style={s.title}>{mode === 'join' ? 'Meet your pen pal.' : 'Make a little nest.'}</Text><Text style={s.body}>Choose a handle and home city. City distance sets the pace of every letter.</Text><View style={s.card}>
    <ModeTabs mode={mode} setMode={setMode} disabled={busy} />
    <Field label="Your handle" placeholder="e.g. little_pigeon" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={25} />
    <Text style={s.small}>3–24 letters, numbers, or underscores. No need to use your real name.</Text>
    <CityPicker value={cityId} onChange={setCityId} disabled={busy} />
    {mode === 'join' && <><Field label="Private invitation" placeholder="Paste your partner’s invitation" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} /><Text style={s.small}>Joining accepts a demo friendship with the person who invited you. Invitations expire and can be used by one partner only.</Text></>}
    {mode === 'account' && <Notice>This completes a regular account profile only. An anonymous session must create or join a demo pair instead.</Notice>}
    {error ? <Notice error>{error}</Notice> : null}
    <Button label={busy ? 'Saving your nest…' : mode === 'join' ? 'Accept invitation & join' : mode === 'create' ? 'Create my pair' : 'Save regular profile'} disabled={!connected || busy || !validHandle || (mode === 'join' && !token.trim())} onPress={() => void submit()} />
  </View></View>;
}

function Diagnostic({ connected }: { connected: boolean }) {
  const value = useQuery(api.starterDemo.read, {});
  const increment = useMutation(api.starterDemo.increment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function change() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try { await increment({}); }
    catch { setError('The counter update was not confirmed. Check the displayed value before trying again.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <View style={s.card}><Text style={s.eyebrow}>CONNECTION DIAGNOSTIC</Text><Text style={s.subtitle}>One shared counter.</Text><Text style={s.small}>Open this diagnostic in a second session to watch the same public test value update.</Text>{value === undefined ? <Loading /> : <Text accessibilityLiveRegion="polite" style={s.counter}>{value}</Text>}<Button label={busy ? 'Updating…' : 'Increment +1'} disabled={!connected || busy || value === undefined} onPress={() => void change()} />{error ? <Notice error>{error}</Notice> : null}<Text style={s.small}>This counter is public. It is separate from private letters and pairing.</Text></View>;
}

class QueryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <View style={s.stack}><Notice error>The post office could not load this view. No delivery or send has been confirmed.</Notice><Button label="Retry loading" secondary onPress={() => this.setState({ failed: false })} /></View>;
    return this.props.children;
  }
}
