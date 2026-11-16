import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LetterApp } from './LetterApp';
import { Mailbox } from './Mailbox';
import { cityById, type FlightDetail } from '../src/domain';

const harness = vi.hoisted(() => ({
  authenticated: true, loading: false, profileLoaded: true,
  status: { status: 'profileRequired', accountId: 'account-a', username: 'account_a', pigeons: [{ id: 'bird-a', name: 'Mochi' }] },
  demo: false,
  detail: null as FlightDetail | null,
  complete: vi.fn(), signOut: vi.fn(), signIn: vi.fn(), sendCode: vi.fn(), ensureFlock: vi.fn().mockResolvedValue({ pigeons: [] }),
  draft: {
    draft: { version: 2, body: 'Keep this draft', recipientId: '', pigeonId: 'bird-a', visibility: 'open', openAcknowledged: false, pending: null },
    locked: false, busy: false, error: '', saved: true, receipt: null, pendingRetry: false, legacySealedDraft: false,
    edit: vi.fn(), send: vi.fn(), startReply: vi.fn(), retryStorage: vi.fn(), acknowledgeOpenSkies: vi.fn(), convertLegacyToOpenSkies: vi.fn(),
  },
}));

vi.mock('@convex-dev/auth/react', () => ({ useAuthActions: () => ({ signIn: harness.signIn, signOut: harness.signOut }) }));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: harness.authenticated, isLoading: harness.loading }),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
  useAction: () => harness.sendCode,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === 'onboarding:ensureFlock' ? harness.ensureFlock : harness.complete,
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === 'skip') return undefined;
    switch (getFunctionName(reference)) {
      case 'onboarding:status': return harness.status;
      case 'profiles:me': return harness.profileLoaded ? { id: `profile-${harness.status.accountId}`, handle: harness.status.username, demo: harness.demo, equipped: 'classic', cityId: 'london' } : undefined;
      case 'social:list': return [];
      case 'flock:list': return [{ id: 'bird-a', name: 'Mochi', ready: true, deliveries: 0 }];
      case 'flights:list': return { flights: [], total: 0, serverTime: 1000 };
      case 'flights:detail': return { flight: harness.detail, serverTime: 1000 };
      case 'starterPair:status': return null;
      default: return undefined;
    }
  },
}));
vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', Switch: 'Switch', Platform: { OS: 'web' }, StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('./Onboarding', () => ({ FlockReady: 'FlockReady', PhoneOnboarding: 'PhoneOnboarding', ProfileOnboarding: 'ProfileOnboarding' }));
vi.mock('./useDraft', () => ({ useDraft: () => harness.draft }));
vi.mock('./useServerClock', () => ({ useServerClock: () => ({ serverNow: 1000, syncError: false }) }));
vi.mock('./PaperPigeon', () => ({ PaperPigeon: 'PaperPigeon' }));
vi.mock('./Pigeon', () => ({ Pigeon: 'Pigeon' }));
vi.mock('./game/CatchGame', () => ({ CatchGame: 'CatchGame' }));
vi.mock('./game/useCatchTransport', () => ({ useCatchTransport: () => ({}) }));
vi.mock('./ui', () => ({
  Button: 'Button', Envelope: 'Envelope', Field: 'Field', Link: 'Link', Loading: 'Loading', Notice: 'Notice',
  PostalCard: 'PostalCard', ScreenHeader: 'ScreenHeader', colors: {}, s: {},
}));
vi.mock('./page03/atoms', () => ({ a: {}, font: {}, palette: {}, PageHeader: 'PageHeader', PrimaryButton: 'PrimaryButton', Icon: 'Icon', IconButton: 'IconButton', PageFrame: 'PageFrame', usePageInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('./page03/MapScreen', () => ({ MapScreen: 'MapScreen', HomeSheet: 'HomeSheet', FlockSheet: 'FlockSheet', atlanticLand: [] }));

let renderer: ReactTestRenderer | undefined;
const node = (type: string) => renderer!.root.findByType(type as never);
const nodes = (type: string) => renderer!.root.findAllByType(type as never);
const app = () => createElement(LetterApp, { deployment: 'https://fixture.convex.cloud' });
async function mount() { await act(async () => { renderer = create(app()); }); }
async function update() { await act(async () => { renderer!.update(app()); }); }
async function finishProfile() {
  await act(async () => { await node('ProfileOnboarding').props.complete({ username: 'account_a' }); });
  await update();
  expect(node('FlockReady').props.username).toBe('account_a');
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  harness.authenticated = true;
  harness.loading = false;
  harness.profileLoaded = true;
  harness.demo = false;
  harness.detail = null;
  harness.status = { status: 'profileRequired', accountId: 'account-a', username: 'account_a', pigeons: [{ id: 'bird-a', name: 'Mochi' }] };
  harness.complete.mockReset().mockImplementation(async () => {
    harness.status = { ...harness.status, status: 'complete' };
    return harness.status;
  });
  harness.signOut.mockReset().mockImplementation(async () => { harness.authenticated = false; });
  harness.draft.edit.mockClear();
  harness.draft.startReply.mockClear();
  harness.draft.send.mockClear();
});

describe('mounted game to Mailbox navigation', () => {
  const flightId = 'caught-flight';
  async function enter() {
    await act(async () => renderer!.root.findByType(Mailbox).props.onCatch!(flightId));
    expect(node('CatchGame').props.flightId).toBe(flightId);
    expect(node('CatchGame').props).not.toHaveProperty('body');
  }
  async function openCaught() {
    harness.detail = {
      id: flightId, courier: 'Mochi', origin: cityById('london'), destination: cityById('paris'),
      visibility: 'open', defense: 'cruise', distanceKm: 300, departedAt: 0, arrivesAt: 20000,
      state: 'intercepted', outfit: 'classic', demo: false, role: 'catcher', attemptCount: 1,
      canCatch: false, canSlingshot: false, canRequest: true, canResend: false, events: [], body: 'SERVER-AUTHORIZED CAUGHT TEXT',
    };
    await act(async () => node('CatchGame').props.onOpenLetter({ flightId }));
  }

  beforeEach(() => { harness.status.status = 'complete'; });

  it('exits the game to the account map without a letter-open intent', async () => {
    await mount(); await enter();
    await act(async () => node('CatchGame').props.onExit({ flightId, outcome: 'abandoned' }));
    expect(node('MapScreen').props.scope).toBe('mine');
    expect(renderer!.root.findByType(Mailbox).props.openFlightId).toBeUndefined();
  });

  it('displays authorized caught text after the game open-letter action', async () => {
    await mount(); await enter(); await openCaught();
    expect(node('ScreenHeader').props.title).toBe('Your letter');
    expect(renderer!.root.findByType(Mailbox).props.openFlightId).toBeUndefined();
    expect(JSON.stringify(renderer!.toJSON())).toContain('SERVER-AUTHORIZED CAUGHT TEXT');
    expect(JSON.stringify(renderer!.toJSON())).toContain('CAUGHT · OPENED FOR YOU');
    expect(JSON.stringify(renderer!.toJSON())).not.toContain('DELIVERED · OPENED FOR YOU');
    expect(nodes('Button').some(button => /Caught letters|Open caught letter|send.*home|return/i.test(button.props.label))).toBe(false);
  });

  it('consumes the letter intent, permits Back, and accepts the same ID again', async () => {
    await mount(); await enter(); await openCaught();
    expect(renderer!.root.findByType(Mailbox).props.openFlightId).toBeUndefined();
    await act(async () => node('ScreenHeader').props.onBack());
    expect(node('MapScreen').props.scope).toBe('mine');
    await update();
    expect(node('MapScreen').props.scope).toBe('mine');
    await enter(); await openCaught();
    expect(node('ScreenHeader').props.title).toBe('Your letter');
  });

  it.each([false, true])('discards the game and stale caught callbacks on an account switch (auth loss=%s)', async authLoss => {
    await mount(); await enter();
    const oldOpen = node('CatchGame').props.onOpenLetter;
    if (authLoss) { harness.authenticated = false; await update(); }
    harness.authenticated = true;
    harness.status = { ...harness.status, accountId: 'account-b', username: 'account_b' };
    await update();
    expect(nodes('CatchGame')).toHaveLength(0);
    expect(node('MapScreen')).toBeDefined();
    await act(async () => oldOpen({ flightId }));
    expect(node('MapScreen')).toBeDefined();
    expect(nodes('ScreenHeader')).toHaveLength(0);
  });
});
afterEach(async () => {
  if (renderer) await act(async () => { renderer!.unmount(); });
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe('mounted account shell with the actual Mailbox and mocked services', () => {
  it('waits for restoration before showing phone entry and resumes profile setup', async () => {
    harness.authenticated = false; harness.loading = true;
    await mount();
    expect(nodes('PhoneOnboarding')).toHaveLength(0);
    expect(node('Loading')).toBeDefined();
    harness.loading = false;
    await update();
    expect(node('PhoneOnboarding')).toBeDefined();
    harness.authenticated = true;
    await update();
    expect(node('ProfileOnboarding')).toBeDefined();
  });

  it.each([false, true])('opens completed accounts directly on My flights (demo=%s)', async demo => {
    harness.demo = demo; harness.status.status = 'complete';
    await mount();
    expect(node('MapScreen').props.scope).toBe('mine');
    expect(nodes('FlockReady')).toHaveLength(0);
    expect(nodes('PhoneOnboarding')).toHaveLength(0);
  });

  it.each([false, true])('discards A ready state when switching to B (auth loss=%s)', async authLoss => {
    await mount(); await finishProfile();
    if (authLoss) {
      harness.authenticated = false;
      await update();
      expect(node('PhoneOnboarding')).toBeDefined();
    }
    harness.authenticated = true;
    harness.status = { status: 'complete', accountId: 'account-b', username: 'account_b', pigeons: [{ id: 'bird-b', name: 'Mochi' }] };
    await update();
    expect(nodes('FlockReady')).toHaveLength(0);
    expect(node('MapScreen').props.scope).toBe('mine');
    await act(async () => node('MapScreen').props.onMenu());
    const text = nodes('Text').map(element => [element.props.children].flat().join('')).join('\n');
    expect(text).toContain('@account_b');
    expect(text).not.toContain('@account_a');
  });

  it('mounts actual compose once after the profile loads and does not replay after settings', async () => {
    await mount(); await finishProfile();
    harness.profileLoaded = false;
    await act(async () => node('FlockReady').props.onCompose());
    expect(node('Loading')).toBeDefined();
    expect(nodes('ScreenHeader')).toHaveLength(0);
    harness.profileLoaded = true;
    await update();
    expect(node('PageHeader').props.title).toBe('Send a pigeon');
    expect(node('TextInput').props.value).toBe('Keep this draft');
    await act(async () => node('PageHeader').props.onClose());
    expect(node('MapScreen').props.scope).toBe('mine');
    await act(async () => node('MapScreen').props.onMenu());
    await act(async () => node('Link').props.onPress());
    expect(node('MapScreen').props.scope).toBe('mine');
    expect(nodes('ScreenHeader')).toHaveLength(0);
    expect(harness.draft.edit).not.toHaveBeenCalled();
    expect(harness.draft.startReply).not.toHaveBeenCalled();
    expect(harness.draft.send).not.toHaveBeenCalled();
  });

  it('clears settings after explicit logout and a different completed login', async () => {
    harness.status.status = 'complete';
    await mount();
    await act(async () => node('MapScreen').props.onMenu());
    await act(async () => node('Button').props.onPress());
    await update();
    expect(node('PhoneOnboarding')).toBeDefined();
    harness.authenticated = true;
    harness.status = { ...harness.status, accountId: 'account-b', username: 'account_b' };
    await update();
    expect(node('MapScreen').props.scope).toBe('mine');
    expect(nodes('Link')).toHaveLength(0);
  });
});
