import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoopShop } from './CoopShop';
import { initialShop, pointPacks } from '../src/shop';

vi.mock('react-native', () => ({
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Pressable: 'pressable', ScrollView: 'scroll', Text: 'text', View: 'view',
  StyleSheet: { create: (value: unknown) => value }, useWindowDimensions: () => ({ width: 390 }),
}));
vi.mock('react-native-svg', () => ({ SvgXml: 'svg' }));
vi.mock('./Pigeon', () => ({ Pigeon: 'pigeon' }));
vi.mock('./page03/atoms', () => ({
  a: {}, Copy: 'copy', font: {}, Icon: 'icon', IconButton: 'icon-button',
  PageFrame: 'frame', palette: {}, PrimaryButton: 'button', usePageInsets: () => ({ top: 0, bottom: 0 }),
}));

let renderer: ReactTestRenderer;
const button = () => renderer.root.findByType('button' as never);
const storefront = { testMode: true, products: pointPacks.map(pack => ({ ...pack, title: `${pack.points} points`, configured: true })) };
async function render(props: Partial<ComponentProps<typeof CoopShop>> = {}) {
  const checkout = vi.fn().mockResolvedValue(undefined);
  await act(async () => { renderer = create(createElement(CoopShop, {
    state: initialShop(0), birds: [{ id: 'mochi', name: 'Mochi' }], onBack: vi.fn(), onAction: vi.fn(),
    onCheckout: checkout, storefront, ...props,
  })); });
  return checkout;
}
async function points() { await act(async () => renderer.root.findByProps({ accessibilityLabel: '120 points. Get more points' }).props.onPress()); }

beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Whop shop controls', () => {
  it('buys the selected pack and does not locally increase the balance', async () => {
    const checkout = await render(); await points();
    expect(button().props.label).toBe('Buy 550 points · $5');
    await act(async () => button().props.onPress());
    expect(checkout).toHaveBeenCalledExactlyOnceWith('points_550');
    expect(renderer.root.findByProps({ accessibilityLabel: '120 points. Get more points' })).toBeTruthy();
    await act(async () => renderer.root.findByProps({ accessibilityLabel: '1200 points for $10' }).props.onPress());
    await act(async () => button().props.onPress());
    expect(checkout).toHaveBeenLastCalledWith('points_1200');
  });

  it.each([{ storefront: undefined }, { storefront: { ...storefront, products: [] } }, { connected: false }])('blocks checkout while unavailable: %j', async props => {
    const checkout = await render(props); await points();
    expect(button().props.disabled).toBe(true);
    await act(async () => button().props.onPress());
    expect(checkout).not.toHaveBeenCalled();
  });

  it('deduplicates taps while checkout opens and displays an opening failure', async () => {
    let fail!: (error: Error) => void;
    const checkout = vi.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
    await render({ onCheckout: checkout }); await points();
    await act(async () => { button().props.onPress(); button().props.onPress(); });
    expect(checkout).toHaveBeenCalledOnce();
    expect(button().props.disabled).toBe(true);
    await act(async () => fail(new Error('browser blocked')));
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('could not be opened');
    expect(button().props.disabled).toBe(false);
  });

  it('keeps preview top-ups local', async () => {
    const topUp = vi.fn();
    const checkout = await render({ onPreviewTopUp: topUp }); await points();
    expect(button().props.label).toBe('Add 550 points');
    await act(async () => button().props.onPress());
    expect(topUp).toHaveBeenCalledExactlyOnceWith(550);
    expect(checkout).not.toHaveBeenCalled();
  });

  it('shows a verified purchase status and can resume a pending order', async () => {
    const order = { id: 'order-points-100', sku: 'points_100' as const, status: 'pending' as const, createdAt: 0 };
    const checkout = await render({ orders: [order], returnedOrder: order });
    expect(button().props.label).toBe('Resume checkout');
    await act(async () => button().props.onPress());
    expect(checkout).toHaveBeenCalledWith('points_100');
    expect(renderer.root.findAllByProps({ accessibilityLiveRegion: 'polite' })[0].props.children).toContain('waiting for payment confirmation');
  });
});
