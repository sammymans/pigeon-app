import { useAuthActions } from '@convex-dev/auth/react';
import { useAction, useConvexAuth, useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { api } from '../convex/_generated/api';
import { Mailbox } from './Mailbox';
import { HomeCity } from './MailSetup';
import { FlockReady, PhoneOnboarding, ProfileOnboarding } from './Onboarding';
import { onboardingRoute } from './onboardingModel';
import { Button, Link, Loading, Notice, s } from './ui';
import { PageFrame, usePageInsets } from './page03/atoms';

export function LetterApp(props: { deployment: string; onCatch?: (flightId: string) => void; onReturn?: (flightId: string) => void }) {
  return <QueryBoundary><AuthGate {...props} /></QueryBoundary>;
}

type RoutingProps = { deployment: string; onCatch?: (flightId: string) => void; onReturn?: (flightId: string) => void };
type AccountStatus = Exclude<FunctionReturnType<typeof api.onboarding.status>, { status: 'signedOut' }>;

function AuthGate(props: RoutingProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const sendCode = useAction(api.phoneAuth.sendCode);
  const status = useQuery(api.onboarding.status, isAuthenticated ? {} : 'skip');
  const route = onboardingRoute(isLoading, isAuthenticated, status?.status);
  if (route === 'loading') return <View style={s.safe}><Loading label="Restoring your nest…" /></View>;
  if (route === 'phone' || !status || status.status === 'signedOut') return <PhoneOnboarding sendCode={phone => sendCode({ phone })} verifyCode={(phone, code) => signIn('phone', { phone, code })} />;
  return <AccountRouter key={status.accountId} status={status} {...props} />;
}

function AccountRouter({ deployment, onCatch, onReturn, status }: RoutingProps & { status: AccountStatus }) {
  const { signOut } = useAuthActions();
  const connection = useConvexConnectionState();
  const complete = useMutation(api.onboarding.complete);
  const [username, setUsername] = useState('');
  const availability = useQuery(api.onboarding.usernameAvailable, username ? { username } : 'skip');
  const [ready, setReady] = useState<{ name: string; pigeons: { name: string }[] } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [compose, setCompose] = useState(false);
  const [settings, setSettings] = useState(false);
  const profile = useQuery(api.profiles.me, settings ? {} : 'skip');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const insets = usePageInsets();

  async function leave() {
    if (busy) return;
    setBusy(true); setError('');
    try { await signOut(); setReady(null); setCompose(false); setSettings(false); setUsername(''); }
    catch { setError('Sign out did not finish. Please try again.'); }
    finally { setBusy(false); }
  }

  if (finishing && status.status === 'complete') return <View style={s.safe}><Loading label="Restoring your nest…" /></View>;
  if (status.status === 'profileRequired') return <><ProfileOnboarding availability={availability} checkUsername={setUsername} onBack={() => void leave()} complete={async values => {
    setFinishing(true);
    try { const result = await complete(values); setReady({ name: values.displayName?.trim() || result.username!, pigeons: result.pigeons }); }
    finally { setFinishing(false); }
  }} />{error ? <Notice error>{error}</Notice> : null}</>;
  if (ready) return <FlockReady {...ready} onCompose={() => { setCompose(true); setReady(null); }} />;
  if (settings) return <PageFrame scroll style={{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 24, gap: 20 }}><Link label="Back to my flights" onPress={() => setSettings(false)} /><Text style={s.title}>Your account</Text><Text style={s.body}>@{(status?.status === 'complete' ? status.username : '')}</Text><HomeCity cityId={profile?.cityId} connected={connection.isWebSocketConnected} /><Text style={s.small}>Your sign-in is saved on this device. Sign in again with the same verified number to return to your flock.</Text><Button label={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={() => void leave()} />{error ? <Notice error>{error}</Notice> : null}</PageFrame>;
  return <Home deployment={deployment} connected={connection.isWebSocketConnected} initialCompose={compose} consumeCompose={setCompose} onCatch={onCatch} onReturn={onReturn} onMenu={() => setSettings(true)} />;
}

function Home({ consumeCompose, ...props }: { deployment: string; connected: boolean; initialCompose: boolean; consumeCompose: (value: boolean) => void; onCatch?: (flightId: string) => void; onReturn?: (flightId: string) => void; onMenu: () => void }) {
  const profile = useQuery(api.profiles.me, {});
  useEffect(() => { if (profile && props.initialCompose) consumeCompose(false); }, [profile, props.initialCompose, consumeCompose]);
  if (profile === undefined) return <Loading label="Finding your nest…" />;
  if (!profile) return <Notice error>Your profile could not be loaded. Please reopen the app to retry.</Notice>;
  return <Mailbox key={profile.id} profile={profile} {...props} onNavigate={() => {}} />;
}

class QueryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <View style={[s.safe, { padding: 24, justifyContent: 'center', gap: 20 }]}><Notice error>The post office could not load this view. Check your connection and try again.</Notice><Button label="Retry loading" secondary onPress={() => this.setState({ failed: false })} /></View>;
    return this.props.children;
  }
}
