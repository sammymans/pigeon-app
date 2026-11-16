import { createElement, Fragment } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoopScreen } from './CoopScreen';
import { CoopIllustration } from './CoopIllustration';
import type { FlockBird } from './page03/MapScreen';

vi.mock('react-native', () => ({ BackHandler: { addEventListener: () => ({ remove: vi.fn() }) }, Pressable: 'pressable', ScrollView: 'scroll', StyleSheet: { create: (value: unknown) => value }, Text: 'text', View: 'view', useWindowDimensions: () => ({ width: 390 }) }));
vi.mock('react-native-svg', () => ({ default: 'svg', Path: 'path', SvgXml: 'svg-xml' }));
vi.mock('./Pigeon', () => ({ Pigeon: 'pigeon' }));
vi.mock('./CoopShop', () => ({ ItemArt: 'item-art' }));
vi.mock('./page03/atoms', () => ({ a: {}, font: {}, palette: {}, Icon: 'icon', IconButton: 'icon-button', PageFrame: 'frame', usePageInsets: () => ({ top: 0, bottom: 0 }) }));

let renderer: ReactTestRenderer;
const send = vi.fn();
const flock: FlockBird[] = [{ id: 'mochi', name: 'Mochi', status: 'Ready', color: 'blue' }, { id: 'pip', name: 'Pip', status: 'Ready', color: 'blue' }];
const pigeons = () => renderer.root.findAllByType('pigeon' as never).map(node => node.props.name);
const radioLabels = () => renderer.root.findAllByProps({ accessibilityRole: 'radio' }).map(node => node.props.accessibilityLabel);
async function render(birds: FlockBird[]) {
  const view = createElement(Fragment, null,
    createElement(CoopIllustration, { birds, width: 342 }),
    createElement(CoopScreen, { birds, selected: 'mochi', now: 0, onSelect: vi.fn(), onClose: vi.fn(), onSend: send }),
  );
  await act(async () => { if (renderer) renderer.update(view); else renderer = create(view); });
}

beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks(); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined as unknown as ReactTestRenderer; vi.unstubAllGlobals(); });

describe('birds at home in the coop', () => {
  it('removes a departing bird from both coops, selects a home bird, and shows it again on return', async () => {
    await render(flock);
    expect(radioLabels()).toEqual(['Mochi, Ready', 'Pip, Ready']);
    await render(flock.map(bird => bird.id === 'mochi' ? { ...bird, status: 'Flying' } : bird));
    expect(pigeons()).not.toContain('Mochi');
    expect(radioLabels()).toEqual(['Pip, Ready']);
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Send with Pip' }).props.onPress());
    expect(send).toHaveBeenCalledWith('pip');
    await render(flock);
    expect(pigeons()).toContain('Mochi');
    expect(radioLabels()).toEqual(['Mochi, Ready', 'Pip, Ready']);
  });

  it('leaves an empty coop when every bird is away', async () => {
    await render(flock.map(bird => ({ ...bird, status: 'Flying' })));
    expect(pigeons()).toEqual([]);
    expect(radioLabels()).toEqual([]);
    expect(renderer.root.findAllByType('text' as never).map(node => node.props.children)).toContain('Your pigeons are out delivering.');
  });
});
