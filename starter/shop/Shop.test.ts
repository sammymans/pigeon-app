import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopEntry, ShopGateway, ShopOrder } from '../../src/shop';
import { Shop } from './Shop';
import { createPreviewGateway } from './previewGateway';

vi.mock('react-native', () => ({ View: 'view', Text: 'text', Pressable: 'pressable', ScrollView: 'scroll', ActivityIndicator: 'activity', Platform: { OS: 'web' }, StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('../page03/atoms', () => ({ Icon: 'icon' }));
vi.mock('./art', () => ({ DressedBird: 'bird', ShopArt: 'art' }));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
function button(label: string) { return renderer.root.findAllByType('pressable' as never).find(node => node.props.accessibilityLabel === label)!; }
async function press(label: string) {
  const node = button(label);
  expect(node, `Missing control: ${label}`).toBeTruthy();
  expect(node.props.disabled, `Disabled control: ${label}`).not.toBe(true);
  await act(async () => { node.props.onPress(); });
}
async function render(gateway: ShopGateway, entry: ShopEntry = { from: 'item', itemId: 'cloud-scarf', selectedBirdId: 'preview-button' }) {
  const onExit = vi.fn();
  await act(async () => { renderer = create(createElement(Shop, { entry, gateway, onExit })); });
  return onExit;
}
beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

describe('rendered shop interactions with explicit fixture state', () => {
  it('buys, equips and honestly shows owned without a second purchase button', async () => {
    const { gateway } = createPreviewGateway();
    await render(gateway);
    await press('Buy & put on Button · 60 pts');
    expect(button('Buy & put on Button · 60 pts')).toBeUndefined();
    expect(button('Worn by Button').props.disabled).toBe(true);
    expect(button('Get points, balance 60')).toBeTruthy();
    expect(text()).toContain('Cloud scarf is owned and worn by Button');
  });
  it('moves owned accessories without repurchase and preserves the selected target', async () => {
    const { gateway } = createPreviewGateway();
    await render(gateway, { from: 'item', itemId: 'sunday-cap', selectedBirdId: 'preview-button' });
    await press('Move from Mochi to Button');
    expect(button('Get points, balance 120')).toBeTruthy();
    expect(button('Worn by Button').props.disabled).toBe(true);
    expect((await gateway.read()).inventory.find(i => i.itemId === 'sunday-cap')?.wornBy).toBe('preview-button');
  });
  it('returns from insufficient points to the same item/bird without auto-spending', async () => {
    const fixture = createPreviewGateway(20);
    await render(fixture.gateway);
    await press('Get points to make it yours');
    expect(text()).toContain('Pocket some');
    await press('Continue with Whop · $5');
    expect((await fixture.gateway.read()).points).toBe(20);
    await act(async () => fixture.settle('preview-order-1', 'paid'));
    expect(text()).toContain('Points confirmed');
    await press('Return to your selection');
    expect(button('Buy & put on Button · 60 pts')).toBeTruthy();
    expect((await fixture.gateway.read()).points).toBe(570);
    expect((await fixture.gateway.read()).inventory.some(i => i.itemId === 'cloud-scarf')).toBe(false);
  });
  it.each(['canceled', 'failed', 'refunded', 'reconciliation'] as const)('keeps %s status honest and returns without granting', async status => {
    const fixture = createPreviewGateway(20);
    await render(fixture.gateway);
    await press('Get points to make it yours'); await press('Continue with Whop · $5');
    await act(async () => fixture.settle('preview-order-1', status));
    expect(text()).toContain(status === 'reconciliation' ? 'Payment needs review' : `Payment ${status}`);
    await press('Back to your selection');
    expect(button('Get points to make it yours')).toBeTruthy();
    expect((await fixture.gateway.read()).points).toBe(20);
  });
  it('retries an uncertain mutation with the identical key, command and revision', async () => {
    const fixture = createPreviewGateway();
    const mutate = vi.fn(fixture.gateway.mutate).mockRejectedValueOnce(new Error('Connection lost'));
    await render({ ...fixture.gateway, mutate });
    await press('Buy & put on Button · 60 pts');
    expect(button('Back').props.disabled).toBe(true);
    expect(button('Mochi, ready').props.disabled).toBe(true);
    await press('Retry the same action');
    expect(mutate.mock.calls[0][0]).toEqual(mutate.mock.calls[1][0]);
    expect((await fixture.gateway.read()).points).toBe(60);
  });
  it('does not clear host draft selection on Back but commits Send with explicitly', async () => {
    const fixture = createPreviewGateway();
    const onExit = await render(fixture.gateway, { from: 'compose', draftKey: 'letter-with-recipient-message-anonymous', selectedBirdId: 'preview-mochi' });
    await press('Button, ready'); await press('Back');
    expect(onExit).toHaveBeenLastCalledWith({ to: 'compose', selectedBirdId: 'preview-mochi', draftKey: 'letter-with-recipient-message-anonymous', confirmed: false });
    await press('Send with Button');
    expect(onExit).toHaveBeenLastCalledWith({ to: 'compose', selectedBirdId: 'preview-button', draftKey: 'letter-with-recipient-message-anonymous', confirmed: true });
  });
  it('filters My items to owned entries instead of implying unowned items are owned', async () => {
    await render(createPreviewGateway().gateway, { from: 'shop', ownedOnly: true });
    expect(button('Cloud scarf')).toBeUndefined();
    expect(button('Flight goggles')).toBeTruthy();
    expect(button('One more little friend')).toBeUndefined();
  });
  it('has an honest unavailable state with no invented balance or ownership', async () => {
    const fixture = createPreviewGateway();
    const gateway: ShopGateway = { ...fixture.gateway, read: async () => ({ revision: '0', source: 'server', birds: [], points: null, inventory: [], serverNow: 0, capabilities: { accessories: false, boosters: false, stones: false, checkout: false, reason: 'Not configured' } }) };
    await render(gateway);
    expect(text()).toContain('Connect your flock');
    expect(button('Get points, balance —')).toBeTruthy();
    await press('Get points, balance —');
    expect(button('Continue with Whop · $5').props.disabled).toBe(true);
    expect(text()).toContain('Not configured');
    expect(text()).not.toContain('TEST PREVIEW');
  });
  it('never opens a deferred checkout after the shop has unmounted', async () => {
    const fixture = createPreviewGateway(20);
    let finish!: (order: ShopOrder) => void;
    const openCheckout = vi.fn(async () => {});
    const gateway = { ...fixture.gateway, checkout: () => new Promise<ShopOrder>(resolve => { finish = resolve; }), openCheckout };
    await render(gateway); await press('Get points to make it yours'); await press('Continue with Whop · $5');
    await act(async () => renderer.unmount());
    await act(async () => finish({ id: 'deferred', sku: 'points-550', status: 'pending', purchaseUrl: 'https://sandbox.whop.com/checkout/ch_deferred/' }));
    expect(openCheckout).not.toHaveBeenCalled();
  });
  it('resets the visit when its draft identity or account scope changes', async () => {
    const fixture = createPreviewGateway();
    const onExit = await render(fixture.gateway, { from: 'compose', draftKey: 'old-draft', selectedBirdId: 'preview-mochi' });
    await act(async () => renderer.update(createElement(Shop, { entry: { from: 'compose', draftKey: 'new-draft', selectedBirdId: 'preview-button' }, gateway: { ...fixture.gateway, scopeKey: 'another-account' }, onExit })));
    await press('Back');
    expect(onExit).toHaveBeenLastCalledWith({ to: 'compose', draftKey: 'new-draft', selectedBirdId: 'preview-button', confirmed: false });
  });
  it('does not let an older subscription read overwrite a newer paid confirmation', async () => {
    const fixture = createPreviewGateway(20);
    let changed!: () => void;
    let finishOld!: (order: ShopOrder) => void;
    const pending: ShopOrder = { id: 'preview-order-1', sku: 'points-550', status: 'pending' };
    const readOrder = vi.fn<ShopGateway['order']>().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce({ ...pending, status: 'paid' });
    await render({ ...fixture.gateway, subscribe: callback => { changed = callback; return () => {}; }, order: readOrder });
    await press('Get points to make it yours'); await press('Continue with Whop · $5');
    await act(async () => changed());
    await press('Check payment status');
    expect(text()).toContain('Points confirmed');
    await act(async () => finishOld(pending));
    expect(text()).toContain('Points confirmed');
    expect(text()).not.toContain('Payment pending');
  });
  it('uses a new request key only after a confirmed canceled checkout', async () => {
    const fixture = createPreviewGateway(20);
    const checkout = vi.fn(fixture.gateway.checkout);
    await render({ ...fixture.gateway, checkout });
    await press('Get points to make it yours'); await press('Continue with Whop · $5');
    await act(async () => fixture.settle('preview-order-1', 'canceled'));
    await press('Try a new checkout'); await press('Continue with Whop · $5');
    expect(checkout.mock.calls[0][0].requestKey).not.toBe(checkout.mock.calls[1][0].requestKey);
  });
});
