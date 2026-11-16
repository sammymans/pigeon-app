import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterceptionGame } from './InterceptionGame';

const native = vi.hoisted(() => ({ onAppState: null as null | ((state: string) => void), remove: vi.fn() }));
vi.mock('react-native', () => ({
  Text: 'text', View: 'view', Pressable: 'pressable', Platform: { OS: 'ios' },
  StyleSheet: { create: (styles: unknown) => styles },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
  AppState: { addEventListener: (_: string, callback: (state: string) => void) => { native.onAppState = callback; return { remove: native.remove }; } },
}));
vi.mock('react-native-svg', () => ({ default: 'svg', Circle: 'circle', Defs: 'defs', G: 'g', LinearGradient: 'gradient', Path: 'path', Rect: 'rect', Stop: 'stop' }));
vi.mock('./atoms', () => ({ a: {}, font: {}, palette: { blue: 'blue' }, Copy: 'copy', IconButton: 'icon-button', PageFrame: 'frame', PrimaryButton: 'button', usePageInsets: () => ({ top: 0, bottom: 0 }) }));

let renderer: ReactTestRenderer;
let frame: FrameRequestCallback;
const spend = vi.fn();
const caught = vi.fn();
const arena = () => renderer.root.findAllByType('view' as never).find(node => node.props.onPanResponderGrant)!;
const event = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y, locationX: x, locationY: y } });
const perform = async (action: () => void) => { await act(async () => action()); };
async function tick(at: number) { vi.setSystemTime(at); await perform(() => frame(at)); }
async function render() {
  await act(async () => { renderer = create(createElement(InterceptionGame, { pigeon: 'Scout', stones: 5, onSpendStone: spend, onCaught: caught, onClose: vi.fn(), onOpenLetter: vi.fn() })); });
}

// Check the numeric grammar and command arity of the actual rendered SVG paths.
// Native SVG parsing can abort the app on malformed data, outside React's error handling.
function expectValidPaths() {
  const arity: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const token = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|[MmLlHhVvCcSsQqTtAaZz]/g;
  for (const path of renderer.root.findAllByType('path' as never)) {
    const d = path.props.d as string;
    expect(d.replace(token, '').replace(/[\s,]/g, ''), d).toBe('');
    const tokens = d.match(token)!;
    expect(tokens[0].toLowerCase()).toBe('m');
    let index = 0;
    while (index < tokens.length) {
      const command = tokens[index++].toLowerCase();
      const start = index;
      while (index < tokens.length && Number.isFinite(Number(tokens[index]))) index++;
      const count = index - start;
      if (arity[command] === 0) expect(count, d).toBe(0);
      else { expect(count, d).toBeGreaterThan(0); expect(count % arity[command], d).toBe(0); }
    }
  }
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers(); vi.setSystemTime(0);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  spend.mockClear(); caught.mockClear(); native.remove.mockClear();
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('slingshot rendering and gestures', () => {
  it('keeps SVG paths valid when pulling, turning left, and releasing a shot', async () => {
    await render();
    expectValidPaths();
    await tick(1000);
    expect(arena().props.onStartShouldSetPanResponder(event(195, 380))).toBe(true);
    await perform(() => arena().props.onPanResponderGrant(event(195, 380)));
    await perform(() => arena().props.onPanResponderMove(event(180, 460)));
    expect(spend).not.toHaveBeenCalled();
    // The pigeon reverses at ~1.4 seconds; this previously rendered a double minus.
    await tick(1600);
    expectValidPaths();
    await perform(() => arena().props.onPanResponderRelease());
    expect(spend).toHaveBeenCalledTimes(1);
    await perform(() => arena().props.onPanResponderRelease());
    expect(spend).toHaveBeenCalledTimes(1);
    for (let at = 1700; at <= 3500; at += 100) { await tick(at); expectValidPaths(); }
  });

  it('renders both flight directions for the full idle window without malformed paths', async () => {
    await render();
    for (let at = 0; at <= 28_000; at += 100) { await tick(at); expectValidPaths(); }
    expect(spend).not.toHaveBeenCalled();
  });

  it('cancels a backgrounded pull without firing or spending a stone', async () => {
    await render();
    await perform(() => arena().props.onPanResponderGrant(event(195, 380)));
    await perform(() => arena().props.onPanResponderMove(event(195, 470)));
    await perform(() => native.onAppState?.('background'));
    await perform(() => arena().props.onPanResponderRelease());
    expect(spend).not.toHaveBeenCalled();
    expectValidPaths();
  });
});
