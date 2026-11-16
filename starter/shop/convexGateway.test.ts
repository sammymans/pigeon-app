import type { ConvexReactClient } from 'convex/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConvexShopGateway } from './convexGateway';
import { createPreviewGateway } from './previewGateway';

const platform = vi.hoisted(() => ({ OS: 'web', open: vi.fn(async () => {}) }));
vi.mock('react-native', () => ({ Platform: platform, Linking: { openURL: platform.open } }));
afterEach(() => { platform.OS = 'web'; platform.open.mockClear(); });

describe('native and provider boundary', () => {
  it.each(['ios', 'android'])('does not expose paid goods or open checkout on %s', async os => {
    platform.OS = os;
    const query = vi.fn(async () => ({ ...await createPreviewGateway().gateway.read(), source: 'server' }));
    const action = vi.fn(); const mutation = vi.fn();
    const gateway = createConvexShopGateway({ query, action, mutation } as unknown as ConvexReactClient, 'authenticated-account');
    const state = await gateway.read();
    expect(state.points).toBeNull(); expect(state.inventory).toEqual([]); expect(state.capabilities.checkout).toBe(false);
    await expect(gateway.checkout({ sku: 'points-100', requestKey: 'request' })).rejects.toThrow('not enabled');
    await expect(gateway.mutate({ command: { kind: 'buy-accessory', itemId: 'cloud-scarf', birdId: 'bird' }, requestKey: 'request', revision: '0' })).rejects.toThrow('not enabled');
    await expect(gateway.openCheckout('https://sandbox.whop.com/checkout/ch_example/')).rejects.toThrow('web sandbox');
    expect(action).not.toHaveBeenCalled(); expect(mutation).not.toHaveBeenCalled(); expect(platform.open).not.toHaveBeenCalled();
  });
  it('rejects production and malformed payment destinations before opening a browser', async () => {
    const gateway = createConvexShopGateway({} as ConvexReactClient, 'authenticated-account');
    for (const url of ['https://whop.com/checkout/example', 'https://sandbox.whop.com.evil.test/checkout/example', 'javascript:alert(1)']) await expect(gateway.openCheckout(url)).rejects.toThrow('sandbox');
    expect(platform.open).not.toHaveBeenCalled();
    await gateway.openCheckout('https://sandbox.whop.com/checkout/ch_example/');
    expect(platform.open).toHaveBeenCalledOnce();
  });
  it('never sends unapproved gameplay or extra-pigeon commands to the backend', async () => {
    const mutation = vi.fn(); const action = vi.fn();
    const gateway = createConvexShopGateway({ mutation, action } as unknown as ConvexReactClient, 'authenticated-account');
    await expect(gateway.mutate({ command: { kind: 'buy-stones' }, requestKey: 'request', revision: '0' })).rejects.toThrow('not enabled');
    await expect(gateway.checkout({ sku: 'extra-pigeon', requestKey: 'request' })).rejects.toThrow('not enabled');
    expect(action).not.toHaveBeenCalled(); expect(mutation).not.toHaveBeenCalled();
  });
});
