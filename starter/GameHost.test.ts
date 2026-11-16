import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LetterApp } from './LetterApp';
import { Mailbox } from './Mailbox';
import { draftStorageKey, emptyDraft } from './letterModel';

const harness = vi.hoisted(() => ({
  accountId: 'account-a', authenticated: true,
  storage: new Map<string, string>(), writes: [] as (() => void)[], delay: false,
  getItem: vi.fn(), setItem: vi.fn(), ensureFlock: vi.fn().mockResolvedValue({ pigeons: [] }),
}));
vi.mock('@convex-dev/auth/react', () => ({ useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock('convex/react', () => ({
  useConvex: () => ({}),
  useConvexAuth: () => ({ isAuthenticated: harness.authenticated, isLoading: false }),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
  useAction: () => vi.fn(), useMutation: () => harness.ensureFlock,
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === 'skip') return undefined;
    switch (getFunctionName(reference)) {
      case 'onboarding:status': return { status: 'complete', accountId: harness.accountId, username: harness.accountId, pigeons: [] };
      case 'profiles:me': return { id: harness.accountId, handle: harness.accountId, demo: false, equipped: 'classic', cityId: 'london' };
      case 'social:list': return [];
      case 'flock:list': return [{ id: 'bird-a', name: 'Mochi', ready: true, deliveries: 0 }];
      case 'flights:list': return { flights: [], total: 0, serverTime: 1000 };
      default: return undefined;
    }
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: harness.getItem, setItem: harness.setItem } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'immutable-request-key' }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', Switch: 'Switch', Platform: { OS: 'web' }, StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('./Onboarding', () => ({ FlockReady: 'FlockReady', PhoneOnboarding: 'PhoneOnboarding', ProfileOnboarding: 'ProfileOnboarding' }));
vi.mock('./useServerClock', () => ({ useServerClock: () => ({ serverNow: 1000, syncError: false }) }));
vi.mock('./PaperPigeon', () => ({ PaperPigeon: 'PaperPigeon' }));
vi.mock('./Pigeon', () => ({ Pigeon: 'Pigeon' }));
vi.mock('./shop/Shop', () => ({ Shop: 'Shop' }));
vi.mock('./shop/convexGateway', () => ({ createConvexShopGateway: () => ({ scopeKey: 'fixture' }) }));
vi.mock('./game/CatchGame', () => ({ CatchGame: 'CatchGame' }));
vi.mock('./game/useCatchTransport', () => ({ useCatchTransport: () => ({}) }));
vi.mock('./ui', () => ({ Button: 'Button', Envelope: 'Envelope', Field: 'Field', Link: 'Link', Loading: 'Loading', Notice: 'Notice', PostalCard: 'PostalCard', ScreenHeader: 'ScreenHeader', colors: {}, s: {} }));
vi.mock('./page03/atoms', () => ({ a: {}, font: {}, palette: {}, PageHeader: 'PageHeader', PrimaryButton: 'PrimaryButton', Icon: 'Icon', IconButton: 'IconButton', PageFrame: 'PageFrame', usePageInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('./page03/MapScreen', () => ({ MapScreen: 'MapScreen', HomeSheet: 'HomeSheet', FlockSheet: 'FlockSheet', atlanticLand: [] }));

const deployment = 'https://fixture.convex.cloud';
let renderer: ReactTestRenderer;
const node = (type: string) => renderer.root.findByType(type as never);
const app = () => createElement(LetterApp, { deployment });
async function mount() { await act(async () => { renderer = create(app()); }); }
async function update() { await act(async () => { renderer.update(app()); }); }
async function enter() { await act(async () => renderer.root.findByType(Mailbox).props.onCatch!('opaque-flight')); }
async function exit() { await act(async () => node('CatchGame').props.onExit({ flightId: 'opaque-flight', outcome: 'abandoned' })); }
async function compose() {
  await act(async () => node('MapScreen').props.onSend());
  const flock = renderer.root.findAllByType('FlockSheet' as never)[0];
  if (flock) await act(async () => flock.props.onSend());
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  harness.accountId = 'account-a'; harness.authenticated = true; harness.delay = false; harness.writes = []; harness.storage.clear();
  harness.getItem.mockReset().mockImplementation(async (key: string) => harness.storage.get(key) ?? null);
  harness.setItem.mockReset().mockImplementation((key: string, value: string) => new Promise<void>(resolve => {
    const finish = () => { harness.storage.set(key, value); resolve(); };
    if (harness.delay) harness.writes.push(finish); else finish();
  }));
});
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });

describe('mounted game host with real Mailbox and useDraft', () => {
  it('preserves the newest draft while a storage write spans game entry and exit', async () => {
    const key = draftStorageKey(deployment, 'account-a');
    harness.storage.set(key, JSON.stringify({ ...emptyDraft(), body: 'Older saved text' }));
    await mount(); await compose();
    expect(node('TextInput').props.value).toBe('Older saved text');
    harness.delay = true;
    await act(async () => node('TextInput').props.onChangeText('Newest unsaved text'));
    await act(async () => node('PageHeader').props.onClose());
    const mailbox = renderer.root.findByType(Mailbox);
    await enter();
    expect(renderer.root.findByType(Mailbox)).toBe(mailbox);
    const hidden = renderer.root.findByProps({ testID: 'mailbox-host' }).props;
    expect(hidden.style.display).toBe('none'); expect(hidden.pointerEvents).toBe('none');
    expect(hidden.accessibilityElementsHidden).toBe(true); expect(hidden.importantForAccessibility).toBe('no-hide-descendants'); expect(hidden['aria-hidden']).toBe(true);
    await exit();
    await act(async () => harness.writes.shift()!());
    harness.delay = false;
    await compose();
    expect(node('TextInput').props.value).toBe('Newest unsaved text');
    expect(JSON.parse(harness.storage.get(key)!).body).toBe('Newest unsaved text');
    expect(harness.getItem).toHaveBeenCalledTimes(1);
    harness.delay = false;
    await act(async () => node('TextInput').props.onChangeText('Newest unsaved text, continued'));
    expect(JSON.parse(harness.storage.get(key)!).body).toBe('Newest unsaved text, continued');
    const visible = renderer.root.findByProps({ testID: 'mailbox-host' }).props;
    expect(visible.style.display).toBe('flex'); expect(visible.pointerEvents).toBe('auto'); expect(visible['aria-hidden']).toBe(false);
  });
  it('keeps an unresolved send immutable across the game without rereading storage', async () => {
    const pending = { recipientId: 'friend', body: 'Possibly sent', demo: false, requestKey: 'saved-key', visibility: 'open', defense: 'cruise', openAcknowledged: true };
    harness.storage.set(draftStorageKey(deployment, 'account-a'), JSON.stringify({ ...emptyDraft('friend'), body: pending.body, openAcknowledged: true, pending }));
    await mount(); await enter(); await exit(); await compose();
    expect(node('TextInput').props.value).toBe('Possibly sent'); expect(node('TextInput').props.editable).toBe(false);
    expect(harness.getItem).toHaveBeenCalledTimes(1); expect(harness.setItem).not.toHaveBeenCalled();
  });
  it('still unmounts account A and ignores its pending writes after switching to B', async () => {
    await mount(); await compose(); harness.delay = true;
    await act(async () => node('TextInput').props.onChangeText('Account A private draft'));
    await act(async () => node('PageHeader').props.onClose()); await enter();
    harness.accountId = 'account-b'; await update();
    expect(renderer.root.findAllByType('CatchGame' as never)).toHaveLength(0);
    await act(async () => harness.writes.shift()!());
    expect(harness.storage.has(draftStorageKey(deployment, 'account-b'))).toBe(false);
    harness.delay = false;
    await compose(); expect(node('TextInput').props.value).toBe('');
    expect(JSON.parse(harness.storage.get(draftStorageKey(deployment, 'account-b'))!).body).toBe('');
  });
});
