import { describe, expect, it } from 'vitest';
import { exitSession, guardRemaining, leavePoints, openPoints, safeCheckoutUrl, startSession, wornAccessories } from './model';
import { createPreviewGateway } from './previewGateway';

describe('shop host navigation contract', () => {
  it('selects the first ready pigeon without inventing birds', async () => {
    const snapshot = await createPreviewGateway().gateway.read();
    const birds = [snapshot.birds[1], snapshot.birds[2], snapshot.birds[0]];
    expect(startSession({ from: 'home' }, { ...snapshot, birds }).selectedBirdId).toBe('preview-button');
    expect(startSession({ from: 'home' }, { ...snapshot, birds: [] }).selectedBirdId).toBeUndefined();
  });
  it('leaves the selected bird and entire host-owned draft intact on Back', async () => {
    const snapshot = await createPreviewGateway().gateway.read();
    const draft = Object.freeze({ recipient: 'sammy', message: 'A private draft', anonymous: true, selectedBirdId: 'preview-mochi' });
    const session = startSession({ from: 'compose', draftKey: 'saved-draft', selectedBirdId: draft.selectedBirdId }, snapshot);
    const result = exitSession({ ...session, selectedBirdId: 'preview-button' }, snapshot);
    expect(result).toEqual({ to: 'compose', selectedBirdId: 'preview-mochi', draftKey: 'saved-draft', confirmed: false });
    expect(draft).toEqual({ recipient: 'sammy', message: 'A private draft', anonymous: true, selectedBirdId: 'preview-mochi' });
  });
  it('commits only the selected ready bird and returns to the same draft', async () => {
    const snapshot = await createPreviewGateway().gateway.read();
    const session = startSession({ from: 'compose', draftKey: 'saved-draft', selectedBirdId: 'preview-mochi' }, snapshot);
    expect(exitSession({ ...session, selectedBirdId: 'preview-button' }, snapshot, true)).toEqual({ to: 'compose', selectedBirdId: 'preview-button', draftKey: 'saved-draft', confirmed: true });
    expect(() => exitSession({ ...session, selectedBirdId: 'preview-pip' }, snapshot, true)).toThrow('ready');
  });
  it('retains the item and chosen bird through top-up and cancellation', async () => {
    const snapshot = await createPreviewGateway().gateway.read();
    const session = startSession({ from: 'item', itemId: 'cloud-scarf', selectedBirdId: 'preview-button' }, snapshot);
    expect(leavePoints(openPoints(openPoints(session)))).toEqual({ ...session, pointsReturn: undefined });
    expect(exitSession(startSession({ from: 'sky' }, snapshot), snapshot)).toEqual({ to: 'sky' });
  });
  it('derives the same worn accessories and guard duration for all views', async () => {
    const snapshot = await createPreviewGateway().gateway.read();
    expect(wornAccessories(snapshot, 'preview-mochi')).toEqual(['sunday-cap']);
    expect(wornAccessories(snapshot, 'preview-button')).toEqual([]);
    expect(guardRemaining(snapshot)).toBe(42);
    expect(guardRemaining({ ...snapshot, serverNow: snapshot.serverNow + 43 * 60000 })).toBe(0);
  });
  it('opens only explicit sandbox hosted checkout URLs', () => {
    expect(safeCheckoutUrl('https://sandbox.whop.com/checkout/ch_test/')).toBe(true);
    for (const url of ['https://whop.com/checkout/ch_test/', 'http://sandbox.whop.com/checkout/a', 'https://sandbox.whop.com.evil.test/checkout/a', 'https://secret@sandbox.whop.com/checkout/a', 'javascript:alert(1)', 'https://sandbox.whop.com:444/checkout/a']) expect(safeCheckoutUrl(url)).toBe(false);
  });
});

describe('explicit in-memory preview gateway (not backend money evidence)', () => {
  it('buys and equips once, and exact retries never debit twice', async () => {
    const { gateway } = createPreviewGateway();
    const input = { command: { kind: 'buy-accessory' as const, itemId: 'cloud-scarf' as const, birdId: 'preview-button' }, requestKey: 'request-one', revision: '0' };
    const [first, retry] = await Promise.all([gateway.mutate(input), gateway.mutate(input)]);
    expect(first.points).toBe(60); expect(retry.points).toBe(60);
    expect(retry.inventory.find(i => i.itemId === 'cloud-scarf')).toEqual({ itemId: 'cloud-scarf', quantity: 1, wornBy: 'preview-button' });
    await expect(gateway.mutate({ ...input, requestKey: 'new-request', revision: retry.revision })).rejects.toThrow('already own');
    await expect(gateway.mutate({ ...input, command: { ...input.command, birdId: 'preview-mochi' } })).rejects.toThrow('another action');
  });
  it('requires fresh confirmation when concurrent commands race', async () => {
    const { gateway } = createPreviewGateway(60);
    const results = await Promise.allSettled([
      gateway.mutate({ command: { kind: 'buy-accessory', itemId: 'cloud-scarf', birdId: 'preview-button' }, requestKey: 'first', revision: '0' }),
      gateway.mutate({ command: { kind: 'buy-stones' }, requestKey: 'second', revision: '0' }),
    ]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    expect((await gateway.read()).points).toBe(0);
  });
  it('moves a single accessory without repurchasing and rejects stale wearers', async () => {
    const { gateway } = createPreviewGateway();
    const next = await gateway.mutate({ command: { kind: 'equip', itemId: 'sunday-cap', birdId: 'preview-button', expectedWearer: 'preview-mochi' }, requestKey: 'move', revision: '0' });
    expect(next.points).toBe(120);
    expect(wornAccessories(next, 'preview-mochi')).toEqual([]);
    expect(wornAccessories(next, 'preview-button')).toEqual(['sunday-cap']);
    await expect(gateway.mutate({ command: { kind: 'equip', itemId: 'sunday-cap', birdId: 'preview-mochi', expectedWearer: 'preview-mochi' }, requestKey: 'stale-move', revision: next.revision })).rejects.toThrow('moved');
  });
  it('never consumes a treat twice and does not add a real flight effect', async () => {
    const { gateway } = createPreviewGateway();
    const input = { command: { kind: 'use-treat' as const, birdId: 'preview-button' }, requestKey: 'treat', revision: '0' };
    await gateway.mutate(input);
    const next = await gateway.mutate(input);
    expect(next.inventory.find(i => i.itemId === 'tailwind-treat')?.quantity).toBe(0);
    expect(next.birds.find(b => b.id === 'preview-button')?.status).toBe('ready');
  });
  it('never credits a balance from creating, opening or dismissing checkout', async () => {
    const { gateway, settle } = createPreviewGateway(20);
    const order = await gateway.checkout({ sku: 'points-550', requestKey: 'checkout' });
    expect(order.status).toBe('pending'); expect(order.purchaseUrl).toBeUndefined();
    expect((await gateway.read()).points).toBe(20);
    expect(await gateway.checkout({ sku: 'points-550', requestKey: 'checkout' })).toEqual(order);
    await expect(gateway.openCheckout('anything')).rejects.toThrow('never opens');
    settle(order.id, 'paid'); settle(order.id, 'paid');
    expect((await gateway.read()).points).toBe(570);
  });
  it.each(['canceled', 'failed', 'refunded', 'reconciliation'] as const)('keeps %s payment state distinct without credits', async status => {
    const { gateway, settle } = createPreviewGateway();
    const order = await gateway.checkout({ sku: 'points-100', requestKey: 'checkout' });
    settle(order.id, status);
    expect((await gateway.order(order.id))?.status).toBe(status);
    expect((await gateway.read()).points).toBe(120);
  });
  it('rejects an insufficient balance without partial ownership', async () => {
    const { gateway } = createPreviewGateway(20);
    await expect(gateway.mutate({ command: { kind: 'buy-accessory', itemId: 'cloud-scarf', birdId: 'preview-button' }, requestKey: 'buy', revision: '0' })).rejects.toThrow('Not enough');
    expect((await gateway.read()).inventory.some(i => i.itemId === 'cloud-scarf')).toBe(false);
  });
});
