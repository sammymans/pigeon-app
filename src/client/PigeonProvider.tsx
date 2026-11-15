import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { ConvexReactClient, useConvexAuth, useConvexConnectionState, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useNetInfo } from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { api } from '../../convex/_generated/api';
import type { Attempt, AttemptResult, CityId, Connection, FlightDetail, FlightSummary, LaunchInput, Order, Outfit, Profile } from '../domain';

type Catalog = { configured: boolean; priceLabel: string; testMode: true };
type SignInInput = { email: string; password: string; signUp?: boolean; handle?: string; cityId?: CityId };
type ReportInput = { profileId?: string; flightId?: string; reason: string };
type Response = 'accept' | 'decline' | 'block';

export type PigeonContextValue = {
  configured: boolean;
  authenticated: boolean;
  loading: boolean;
  connected: boolean;
  profile: Profile | null;
  demo: boolean;
  setDemo: (value: boolean) => void;
  serverNow: number;
  myFlights: FlightSummary[];
  worldFlights: FlightSummary[];
  worldTotal: number;
  connections: Connection[];
  owned: Outfit[];
  orders: Order[];
  catalog: Catalog;
  error: string | null;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (input: { handle: string; cityId: CityId }) => Promise<void>;
  setCity: (cityId: CityId) => Promise<void>;
  launch: (input: LaunchInput) => Promise<{ id: string }>;
  reserve: (flightId: string) => Promise<Attempt>;
  resolve: (attemptId: string, taps: (number | null)[]) => Promise<AttemptResult>;
  requestConnection: (flightId: string) => Promise<{ id: string }>;
  respond: (connectionId: string, response: Response) => Promise<void>;
  block: (profileId: string) => Promise<void>;
  report: (input: ReportInput) => Promise<void>;
  createInvite: () => Promise<{ token: string }>;
  acceptInvite: (token: string) => Promise<void>;
  checkout: (requestKey: string) => Promise<Order>;
  equip: (outfit: Outfit) => Promise<void>;
  resetDemo: () => Promise<void>;
  seedDemo: () => Promise<void>;
  startDemo: () => Promise<void>;
};

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false }) : null;
const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};
const unavailable = async (): Promise<never> => { throw new Error('The post office is not connected yet. No action has been submitted.'); };
const emptyContext: PigeonContextValue = {
  configured: false, authenticated: false, loading: false, connected: false, profile: null,
  demo: false, setDemo: () => {}, serverNow: Date.now(), myFlights: [], worldFlights: [], worldTotal: 0,
  connections: [], owned: ['classic'], orders: [], catalog: { configured: false, priceLabel: '$2.99', testMode: true }, error: null,
  signIn: unavailable, signOut: unavailable, saveProfile: unavailable, setCity: unavailable,
  launch: unavailable, reserve: unavailable, resolve: unavailable, requestConnection: unavailable,
  respond: unavailable, block: unavailable, report: unavailable, createInvite: unavailable,
  acceptInvite: unavailable, checkout: unavailable, equip: unavailable, resetDemo: unavailable, seedDemo: unavailable, startDemo: unavailable,
};
const PigeonContext = createContext<PigeonContextValue>(emptyContext);

function readableError(error: unknown): string {
  if (error instanceof ConvexError) return typeof error.data === 'string' ? error.data : 'The post office could not complete that request.';
  if (error instanceof Error) {
    const message = error.message.replace(/\[CONVEX[^\]]*\]\s*/g, '').replace(/\[Request ID:[^\]]*\]\s*/g, '');
    return message.split('\n')[0].replace(/^Server Error\s*/, '') || 'Please try again.';
  }
  return 'Something went wrong. Your letter is still safe in its draft.';
}

export function PigeonProvider({ children }: { children: ReactNode }) {
  if (!client) return <PigeonContext.Provider value={emptyContext}>{children}</PigeonContext.Provider>;
  return (
    <ConvexAuthProvider client={client} storage={Platform.OS === 'web' ? undefined : secureStorage} shouldHandleCode={false}>
      <ConnectedProvider>{children}</ConnectedProvider>
    </ConvexAuthProvider>
  );
}

function ConnectedProvider({ children }: { children: ReactNode }) {
  const convex = client!;
  const auth = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const connection = useConvexConnectionState();
  const network = useNetInfo();
  const [browserOnline, setBrowserOnline] = useState(() => Platform.OS !== 'web' || typeof navigator === 'undefined' || navigator.onLine);
  const online = browserOnline && network.isConnected !== false && network.isInternetReachable !== false;
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState(Date.now());
  const [clockReady, setClockReady] = useState(false);
  const clock = useRef({ server: Date.now(), monotonic: performance.now() });
  const profile = useQuery(api.profiles.me, isAuthenticated ? {} : 'skip');
  const ready = isAuthenticated && profile != null;
  const mine = useQuery(api.flights.list, ready ? { scope: 'mine', demo } : 'skip');
  const world = useQuery(api.flights.list, { scope: 'world', demo });
  const connections = useQuery(api.social.list, ready ? {} : 'skip');
  const ownership = useQuery(api.commerce.ownership, ready ? {} : 'skip');
  const catalog = useQuery(api.commerce.catalog, {});
  const connected = connection.isWebSocketConnected && clockReady && online;

  useEffect(() => { if (profile) setDemo(profile.demo); }, [profile?.id, profile?.demo]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setBrowserOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (!connection.isWebSocketConnected || !online) return;
    let live = true;
    let inFlight = false;
    const sync = async () => {
      if (inFlight || AppState.currentState === 'background') return;
      inFlight = true;
      const started = performance.now();
      try {
        const time = await convex.mutation(api.profiles.clock, {});
        if (!live) return;
        const ended = performance.now();
        clock.current = { server: time + (ended - started) / 2, monotonic: ended };
        setClockReady(true);
        setServerNow(clock.current.server);
        if (ready) await convex.mutation(api.flights.settleMine, {});
      } catch {
        if (live) setClockReady(false);
      } finally { inFlight = false; }
    };
    void sync();
    const timer = setInterval(() => void sync(), 5000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void sync(); });
    return () => { live = false; clearInterval(timer); listener.remove(); };
  }, [convex, connection.isWebSocketConnected, ready, online]);

  useEffect(() => {
    const timer = setInterval(() => setServerNow(clock.current.server + performance.now() - clock.current.monotonic), 250);
    return () => clearInterval(timer);
  }, []);

  const execute = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (!online || !convex.connectionState().isWebSocketConnected) throw new Error('Reconnecting. Your draft is saved; try again when the post office is back.');
    setError(null);
    try { return await operation(); }
    catch (cause) { const message = readableError(cause); setError(message); throw new Error(message); }
  }, [convex, online]);

  const value: PigeonContextValue = {
    configured: true, authenticated: isAuthenticated, loading: isLoading || (isAuthenticated && profile === undefined),
    connected, profile: profile ?? null, demo, setDemo, serverNow,
    myFlights: mine?.flights ?? [], worldFlights: world?.flights ?? [], worldTotal: world?.total ?? 0,
    connections: connections ?? [], owned: ownership?.owned ?? ['classic'], orders: ownership?.orders ?? [],
    catalog: catalog ?? emptyContext.catalog, error,
    signIn: async ({ email, password, signUp, handle, cityId }) => {
      await execute(async () => {
        await auth.signIn('password', { email, password, flow: signUp ? 'signUp' : 'signIn', ...(signUp ? { handle, cityId } : {}) });
      });
    },
    signOut: async () => { await auth.signOut(); setDemo(false); setError(null); },
    saveProfile: async (input) => { await execute(() => convex.mutation(api.profiles.save, input)); },
    setCity: async (cityId) => { await execute(() => convex.mutation(api.profiles.setCity, { cityId })); },
    launch: (input) => execute(() => convex.mutation(api.flights.launch, input)),
    reserve: (flightId) => execute(() => convex.mutation(api.flights.reserve, { flightId })),
    resolve: (attemptId, taps) => execute(() => convex.mutation(api.flights.resolve, { attemptId, taps })),
    requestConnection: (flightId) => execute(() => convex.mutation(api.social.request, { flightId })),
    respond: async (connectionId, response) => { await execute(() => convex.mutation(api.social.respond, { connectionId, response })); },
    block: async (profileId) => { await execute(() => convex.mutation(api.social.block, { profileId })); },
    report: async (input) => { await execute(() => convex.mutation(api.social.report, input)); },
    createInvite: () => execute(() => convex.mutation(api.social.createInvite, {})),
    acceptInvite: async (token) => { await execute(() => convex.mutation(api.social.acceptInvite, { token })); },
    checkout: (requestKey) => execute(() => convex.action(api.commerce.checkout, { sku: 'aviator', requestKey })),
    equip: async (outfit) => { await execute(() => convex.mutation(api.commerce.equip, { outfit })); },
    resetDemo: async () => { await execute(() => convex.mutation(api.demo.reset, {})); },
    seedDemo: async () => { await execute(() => convex.mutation(api.demo.seed, {})); },
    startDemo: async () => {
      await execute(async () => {
        if (isAuthenticated && profile && !profile.demo) throw new Error('Sign out before opening a separate demo nest. Your real account will stay unchanged.');
        if (!isAuthenticated) {
          await auth.signIn('anonymous');
          await new Promise<void>((resolve, reject) => {
            const watch = convex.watchQuery(api.auth.isAuthenticated, {});
            let unsubscribe = () => {};
            const timer = setTimeout(() => { unsubscribe(); reject(new Error('Your demo sign-in is still connecting. Please try again.')); }, 15000);
            const check = () => {
              try {
                if (watch.localQueryResult()) { clearTimeout(timer); unsubscribe(); resolve(); }
              } catch { clearTimeout(timer); unsubscribe(); reject(new Error('Could not confirm your demo session.')); }
            };
            unsubscribe = watch.onUpdate(check);
            check();
          });
        }
        await convex.mutation(api.demo.start, {});
        setDemo(true);
      });
    },
  };
  return <PigeonContext.Provider value={value}>{children}</PigeonContext.Provider>;
}

export function usePigeon() { return useContext(PigeonContext); }

export function useFlight(id: string | undefined) {
  const { authenticated, profile, serverNow } = usePigeon();
  const viewer = profile?.id ?? (authenticated ? 'onboarding' : 'anonymous');
  const [result, setResult] = useState<{ id: string; viewer: string; flight: FlightDetail | null } | null>(null);
  useEffect(() => {
    if (!client || !id) return;
    setResult(null);
    const watch = client.watchQuery(api.flights.detail, { id });
    const update = () => {
      try { const data = watch.localQueryResult(); if (data !== undefined) setResult({ id, viewer, flight: data.flight }); }
      catch { setResult({ id, viewer, flight: null }); }
    };
    const unsubscribe = watch.onUpdate(update);
    update();
    return unsubscribe;
  }, [id, viewer]);
  const current = result && result.id === id && result.viewer === viewer;
  return { flight: current ? result.flight : null, loading: Boolean(client && id && !current), serverNow };
}

export function useOrder(id: string | undefined) {
  const { authenticated, profile } = usePigeon();
  const viewer = profile?.id;
  const [result, setResult] = useState<{ id: string; viewer: string; order: Order | null } | null>(null);
  useEffect(() => {
    if (!client || !id || !authenticated || !viewer) return;
    setResult(null);
    let live = true;
    const watch = client.watchQuery(api.commerce.order, { id });
    const update = () => {
      try { const order = watch.localQueryResult(); if (order !== undefined) setResult({ id, viewer, order }); }
      catch { setResult({ id, viewer, order: null }); }
    };
    const unsubscribe = watch.onUpdate(update);
    update();
    let polls = 0;
    const timer = setInterval(() => {
      if (++polls >= 15) clearInterval(timer);
      void client!.query(api.commerce.order, { id }).then((order) => { if (live) setResult({ id, viewer, order }); }).catch(() => {});
    }, 2000);
    return () => { live = false; unsubscribe(); clearInterval(timer); };
  }, [id, authenticated, viewer]);
  const current = authenticated && result && result.id === id && result.viewer === viewer;
  return { order: current ? result.order : null, loading: Boolean(client && authenticated && id && !current) };
}

export function shareUrl(path: string): string {
  const configured = process.env.EXPO_PUBLIC_WEB_ORIGIN;
  const origin = configured ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null);
  if (!origin || !/^https:\/\//.test(origin)) throw new Error('Public sharing needs a configured HTTPS sky address.');
  return `${origin.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
