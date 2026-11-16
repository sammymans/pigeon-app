import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileOnboarding } from './Onboarding';

vi.mock('react-native', () => ({
  KeyboardAvoidingView: 'keyboard-view', ScrollView: 'scroll', View: 'view', Text: 'text', TextInput: 'input', Pressable: 'pressable',
  Linking: {}, Platform: { OS: 'web' }, StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('react-native-svg', () => ({ default: 'svg', Path: 'path', Rect: 'rect' }));
vi.mock('./page03/atoms', () => ({ IconButton: 'icon-button', PrimaryButton: 'button', font: {}, palette: {} }));
vi.mock('./Pigeon', () => ({ Pigeon: 'pigeon' }));

let renderer: ReactTestRenderer;
const button = () => renderer.root.findByType('button' as never);
const alerts = () => renderer.root.findAllByProps({ accessibilityRole: 'alert' });
async function enter(value: string) {
  await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Username' }).props.onChangeText(value));
}
async function render(props: Partial<ComponentProps<typeof ProfileOnboarding>> = {}) {
  const complete = vi.fn().mockResolvedValue(undefined);
  const checkUsername = vi.fn();
  await act(async () => { renderer = create(createElement(ProfileOnboarding, { availability: undefined, onBack: vi.fn(), complete, checkUsername, ...props })); });
  return { complete, checkUsername };
}

beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('username onboarding validation', () => {
  it.each([true, false])('requires a valid username before continuing (preview: %s)', async preview => {
    const { complete, checkUsername } = await render({ preview });
    expect(button().props.disabled).toBe(true);
    for (const value of ['', '   ', '@', 'ab', '.ethan', 'ethan post', 'ethan-post', 'ethan!', 'éthan', 'ethan🐦', 'a'.repeat(25)]) {
      await enter(value);
      expect(button().props.disabled).toBe(true);
      if (value) expect(alerts()[0].props.children).toContain('3–24');
      await act(async () => button().props.onPress());
    }
    expect(complete).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(250); });
    if (!preview) expect(checkUsername).toHaveBeenLastCalledWith('');

    for (const value of ['abc', 'a'.repeat(24), 'ethan_123', ' @Ethan.Post ']) {
      await enter(value);
      expect(button().props.disabled).toBe(false);
      expect(alerts()).toHaveLength(0);
    }
    await act(async () => { vi.advanceTimersByTime(250); });
    if (preview) expect(checkUsername).not.toHaveBeenCalled();
    else expect(checkUsername).toHaveBeenLastCalledWith('ethan.post');
    await act(async () => button().props.onPress());
    expect(complete).toHaveBeenCalledExactlyOnceWith({ username: 'ethan.post', displayName: undefined });
  });

  it('blocks a taken username and clears stale availability when the username changes', async () => {
    const { complete } = await render({ availability: { username: 'ethan.post', available: false } });
    await enter('@Ethan.Post');
    expect(button().props.disabled).toBe(true);
    expect(alerts()[0].props.children).toContain('taken');
    await act(async () => button().props.onPress());
    expect(complete).not.toHaveBeenCalled();
    await enter('ethan.other');
    expect(button().props.disabled).toBe(false);
    expect(alerts()).toHaveLength(0);
  });
});
