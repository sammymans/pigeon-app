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
vi.mock('react-native-svg', () => ({ default: 'svg', SvgXml: 'svg-xml', Circle: 'circle', Ellipse: 'ellipse', Defs: 'defs', G: 'g', LinearGradient: 'gradient', Path: 'path', Rect: 'rect', Stop: 'stop' }));
vi.mock('./atoms', () => ({ a: {}, font: {}, palette: { blue: 'blue' }, Copy: 'copy', IconButton: 'icon-button', PageFrame: 'frame', PrimaryButton: 'button', usePageInsets: () => ({ top: 0, bottom: 0 }) }));

let renderer: ReactTestRenderer;
let frame: FrameRequestCallback;
const spend = vi.fn();
const caught = vi.fn();
const close = vi.fn();
const openLetter = vi.fn();
const arena = () => renderer.root.findAllByType('view' as never).find(node => node.props.onPanResponderGrant)!;
const event = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y, locationX: x, locationY: y } });
const perform = async (action: () => void) => { await act(async () => action()); };
async function tick(at: number) { vi.setSystemTime(at); await perform(() => frame(at)); }
async function render(stones = 6) {
  await act(async () => { renderer = create(createElement(InterceptionGame, { pigeon: 'Scout', stones, onSpendStone: spend, onCaught: caught, onClose: close, onOpenLetter: openLetter })); });
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
  spend.mockClear(); caught.mockClear(); close.mockClear(); openLetter.mockClear(); native.remove.mockClear();
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
    // Check leftward motion too; this previously rendered a double minus.
    await tick(1600);
    expectValidPaths();
    await perform(() => arena().props.onPanResponderRelease());
    expect(spend).toHaveBeenCalledTimes(1);
    await perform(() => arena().props.onPanResponderRelease());
    expect(spend).toHaveBeenCalledTimes(1);
    for (let at = 1700; at <= 3500; at += 100) { await tick(at); expectValidPaths(); }
  });

  it('shows one shot left, blocks both controls after two misses, and preserves the pouch', async () => {
    await render();
    for (const at of [100, 2200]) {
      await tick(at);
      await perform(() => arena().props.onPanResponderGrant(event(195, 380)));
      await perform(() => arena().props.onPanResponderMove(event(273, 400)));
      await perform(() => arena().props.onPanResponderRelease());
      await tick(at + 1900);
      if (at === 100) {
        expect(JSON.stringify(renderer.toJSON())).toContain('ONE SHOT LEFT');
        expect(JSON.stringify(renderer.toJSON())).toContain('1 of 2 shots remaining');
      }
    }
    expect(caught).not.toHaveBeenCalled();
    expect(spend).toHaveBeenCalledTimes(2);
    expect(arena().props.onStartShouldSetPanResponder(event(195, 380))).toBe(false);
    await perform(() => arena().props.onPanResponderGrant(event(195, 380)));
    await perform(() => arena().props.onPanResponderMove(event(273, 400)));
    await perform(() => arena().props.onPanResponderRelease());
    const fire = renderer.root.findByType('pressable' as never);
    expect(fire.props.disabled).toBe(true);
    await perform(() => fire.props.onPress());
    expect(spend).toHaveBeenCalledTimes(2);
    await tick(5000);
    expect(JSON.stringify(renderer.toJSON())).toContain('TWO SHOTS USED');
    expect(JSON.stringify(renderer.toJSON())).toContain('Your other 4 stones are still in your pouch.');
    const back = renderer.root.findByType('button' as never);
    expect(back.props.label).toBe('Back to sky');
    await perform(() => back.props.onPress());
    expect(close).toHaveBeenCalledOnce();
    expect(openLetter).not.toHaveBeenCalled();
    expectValidPaths();
  });

  it('shows the caught letter and opens it only after a successful final shot', async () => {
    await render();
    await tick(100);
    await perform(() => arena().props.onPanResponderGrant(event(195, 380)));
    await perform(() => arena().props.onPanResponderMove(event(273, 400)));
    await perform(() => arena().props.onPanResponderRelease());
    await tick(2000);
    await tick(2900);
    await perform(() => renderer.root.findByType('pressable' as never).props.onPress());
    await tick(4700);
    expect(spend).toHaveBeenCalledTimes(2);
    expect(caught).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer.toJSON())).toContain('SECOND SHOT · RIGHT ON TARGET');
    expect(JSON.stringify(renderer.toJSON())).toContain('Letter intercepted.');
    expect(JSON.stringify(renderer.toJSON())).toContain('30 minutes to reply before Scout flies home');
    const open = renderer.root.findByType('button' as never);
    expect(open.props.label).toBe('Open letter');
    await perform(() => open.props.onPress());
    expect(openLetter).toHaveBeenCalledOnce();
    await tick(6000);
    expect(caught).toHaveBeenCalledOnce();
    expectValidPaths();
  });

  it('shows only one available shot when the pouch has one stone', async () => {
    await render(1);
    expect(JSON.stringify(renderer.toJSON())).toContain('ONE SHOT AT THIS PIGEON');
    expect(JSON.stringify(renderer.toJSON())).toContain('1 of 2 shots remaining');
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
