import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommerce } from './useCommerce';
import { checkoutReturnId } from './commerceModel';

const mocks = vi.hoisted(() => ({ checkout: vi.fn(), openURL: vi.fn(), initialURL: vi.fn(), uuid: vi.fn(), query: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.uuid }));
vi.mock('react-native', () => ({ Linking: { openURL: mocks.openURL, getInitialURL: mocks.initialURL, addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('convex/react', () => ({ useAction: () => mocks.checkout, useQuery: mocks.query }));

let renderer: ReactTestRenderer;
let commerce: ReturnType<typeof useCommerce>;
function Probe() { commerce = useCommerce(); return null; }
const pendingOrder = { id: 'order-test-100', sku: 'points_100', status: 'pending', createdAt: 0, purchaseUrl: 'https://sandbox.whop.com/checkout/ch_test/' };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.resetAllMocks();
  mocks.initialURL.mockResolvedValue(null); mocks.uuid.mockReturnValue('unique-request-key');
  mocks.checkout.mockResolvedValue(pendingOrder); mocks.openURL.mockResolvedValue(undefined);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });
async function render() { await act(async () => { renderer = create(createElement(Probe)); }); }

describe('connected checkout handoff', () => {
  it('opens the server checkout URL and keeps the request key after a transport failure', async () => {
    mocks.checkout.mockRejectedValueOnce(new Error('offline'));
    await render();
    await expect(commerce.buy('points_100')).rejects.toThrow('offline');
    await act(async () => commerce.buy('points_100'));
    expect(mocks.checkout.mock.calls.map(call => call[0])).toEqual([
      { sku: 'points_100', requestKey: 'unique-request-key' }, { sku: 'points_100', requestKey: 'unique-request-key' },
    ]);
    expect(mocks.uuid).toHaveBeenCalledOnce();
    expect(mocks.openURL).toHaveBeenCalledExactlyOnceWith(pendingOrder.purchaseUrl);
    expect(commerce.returnId).toBe(pendingOrder.id);
  });

  it('reads server status on return and never treats a URL success flag as payment', async () => {
    mocks.initialURL.mockResolvedValue('https://pigeon.example/?checkout_order=order-test-100&status=paid');
    mocks.query.mockImplementation((ref, args) => getFunctionName(ref) === 'commerce:order' && args !== 'skip' ? { ...pendingOrder, status: 'pending' } : undefined);
    await render();
    expect(commerce.returnedOrder?.status).toBe('pending');
    expect(mocks.checkout).not.toHaveBeenCalled();
    expect(mocks.openURL).not.toHaveBeenCalled();
  });

  it('does not reopen a completed order as another charge', async () => {
    mocks.checkout.mockResolvedValue({ ...pendingOrder, status: 'paid', purchaseUrl: undefined });
    await render();
    await act(async () => commerce.buy('points_100'));
    expect(mocks.openURL).not.toHaveBeenCalled();
  });

  it('accepts current and legacy return IDs and rejects malformed values', () => {
    expect(checkoutReturnId('https://pigeon.example/?checkout_order=opaque-order-one')).toBe('opaque-order-one');
    expect(checkoutReturnId('https://pigeon.example/checkout-return?order=opaque-order-one')).toBe('opaque-order-one');
    for (const url of [null, 'invalid', 'https://pigeon.example/?status=paid', 'https://pigeon.example/?checkout_order=%3Cscript%3E']) expect(checkoutReturnId(url)).toBeNull();
  });
});
