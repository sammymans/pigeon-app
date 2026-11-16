import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SendReview } from './Messaging';

vi.mock('react-native', () => ({ Animated: {}, KeyboardAvoidingView: 'keyboard', Modal: 'modal', Platform: { OS: 'web' }, Pressable: 'pressable', ScrollView: 'scroll', StyleSheet: { create: (value: unknown) => value }, Text: 'text', TextInput: 'input', View: 'view' }));
vi.mock('react-native-svg', () => ({ default: 'svg', Defs: 'defs', LinearGradient: 'gradient', Path: 'path', Rect: 'rect', Stop: 'stop' }));
vi.mock('./atoms', () => ({ a: {}, font: {}, palette: {}, Copy: 'copy', Icon: 'icon', IconButton: 'icon-button', PageFrame: 'frame', PrimaryButton: 'primary', usePageInsets: () => ({ top: 62, bottom: 30 }) }));
vi.mock('../Pigeon', () => ({ Pigeon: 'pigeon' }));
vi.mock('./CoopPicker', () => ({ CoopPicker: 'coop' }));

let renderer: ReactTestRenderer;
const send = vi.fn();
const shop = vi.fn();
const save = vi.fn();
const primary = () => renderer.root.findByType('primary' as never);
const props = { person: { id: 'sammy', name: 'Sammy', city: 'London' }, sender: 'Ethan · New York', birds: [{ id: 'mochi', name: 'Mochi', status: 'Flying', color: 'blue' }], selected: 'mochi', estimate: '2d 22h', onSelect: vi.fn(), onBack: vi.fn(), onSend: send, onShop: shop, onSave: save };
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks(); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

describe('loading a letter onto a pigeon', () => {
  it('opens the shop from an empty coop even though sending is disabled', async () => {
    await act(async () => { renderer = create(createElement(SendReview, { ...props, disabled: true, pigeonPrice: '$1' })); });
    expect(primary().props.label).toBe('Add a pigeon · $1');
    expect(primary().props.disabled).toBe(false);
    await act(async () => primary().props.onPress());
    expect(shop).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Save this letter for later' }).props.onPress());
    expect(save).toHaveBeenCalledOnce();
  });

  it('keeps an unconfirmed send on its retry action when its pigeon is away', async () => {
    await act(async () => { renderer = create(createElement(SendReview, { ...props, action: 'Retry the same letter' })); });
    expect(primary().props.label).toBe('Retry the same letter');
    await act(async () => primary().props.onPress());
    expect(send).toHaveBeenCalledOnce();
    expect(shop).not.toHaveBeenCalled();
  });

  it('allows a returning courier to carry a reply when the owned coop is empty', async () => {
    await act(async () => { renderer = create(createElement(SendReview, { ...props, returning: 'Scout' })); });
    expect(primary().props.label).toBe('Send with Scout');
    expect(primary().props.disabled).toBeFalsy();
    await act(async () => primary().props.onPress());
    expect(send).toHaveBeenCalledOnce();
    expect(shop).not.toHaveBeenCalled();
  });
});
