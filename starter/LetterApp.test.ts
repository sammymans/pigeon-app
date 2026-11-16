import { createElement, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { LetterApp } from './LetterApp';

const state = vi.hoisted(() => ({
  authenticated: true, loading: false,
  account: { status: 'profileRequired', accountId: 'a', username: 'alice', pigeons: [{ id: 'mochi-a', name: 'Mochi' }] },
  profileLoaded: true,
}));

vi.mock('@convex-dev/auth/react', () => ({ useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: state.loading }),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
  useAction: () => vi.fn(),
  useMutation: () => async () => { state.account = { ...state.account, status: 'complete' }; return state.account; },
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(reference);
    if (name === 'onboarding:status') return state.account;
    if (name === 'profiles:me') return state.profileLoaded ? { id: state.account.accountId, handle: state.account.username, demo: false } : undefined;
    return undefined;
  },
}));
vi.mock('react-native', () => ({ View: 'view', Text: 'text' }));
vi.mock('./ui', () => ({ CityPicker: 'city-picker', Button: 'button', Link: 'link', Loading: 'loading', Notice: 'notice', s: {} }));
vi.mock('./page03/atoms', () => ({ PageFrame: 'frame', usePageInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('./Onboarding', () => ({ FlockReady: 'ready', PhoneOnboarding: 'phone', ProfileOnboarding: 'profile' }));
vi.mock('./Mailbox', () => ({ Mailbox: (props: { initialCompose: boolean; profile: { id: string } }) => {
  const [screen] = useState(props.initialCompose ? 'compose' : 'home');
  return createElement('mailbox', { ...props, screen });
} }));

let renderer: ReactTestRenderer;
const root = () => renderer.root;
const node = (type: string) => root().findByType(type as never);
async function render() { await act(async () => { renderer = create(createElement(LetterApp, { deployment: 'https://test.invalid' })); }); }
async function update() { await act(async () => { renderer.update(createElement(LetterApp, { deployment: 'https://test.invalid' })); }); }
async function finish() {
  await act(async () => { await node('profile').props.complete({ username: 'alice', displayName: 'Alice' }); });
  await update();
  expect(node('ready').props.name).toBe('Alice');
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  state.authenticated = true; state.loading = false; state.profileLoaded = true;
  state.account = { status: 'profileRequired', accountId: 'a', username: 'alice', pigeons: [{ id: 'mochi-a', name: 'Mochi' }] };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

describe('account-scoped onboarding navigation', () => {
  it('waits for session restoration and resumes an interrupted profile', async () => {
    state.loading = true; state.authenticated = false;
    await render(); expect(node('loading')).toBeTruthy();
    state.loading = false; await update(); expect(node('phone')).toBeTruthy();
    state.authenticated = true; await update(); expect(node('profile')).toBeTruthy();
  });

  it('discards the old ready screen across auth loss and a different completed account', async () => {
    await render(); await finish();
    state.authenticated = false; await update(); expect(node('phone')).toBeTruthy();
    state.authenticated = true; state.account = { ...state.account, accountId: 'b', username: 'bob' };
    await update(); expect(node('mailbox').props.profile.id).toBe('b');
    expect(root().findAllByType('ready' as never)).toHaveLength(0);
  });

  it('isolates direct account switches even without an unauthenticated render', async () => {
    await render(); await finish();
    state.account = { ...state.account, accountId: 'b', username: 'bob' };
    await update(); expect(node('mailbox').props.profile.id).toBe('b');
    expect(node('mailbox').props.screen).toBe('home');
  });

  it('consumes first-compose only after profile loading and does not replay it after settings', async () => {
    await render(); await finish(); state.profileLoaded = false;
    await act(async () => node('ready').props.onCompose()); expect(node('loading')).toBeTruthy();
    state.profileLoaded = true; await update(); expect(node('mailbox').props.screen).toBe('compose');
    await act(async () => node('mailbox').props.onMenu());
    await act(async () => node('link').props.onPress());
    expect(node('mailbox').props.screen).toBe('home');
    expect(node('mailbox').props.profile.id).toBe('a');
  });

  it('opens home for an already-completed account', async () => {
    state.account = { ...state.account, status: 'complete' };
    await render(); expect(node('mailbox').props.screen).toBe('home');
    await update(); expect(node('mailbox').props.screen).toBe('home');
  });
});
