import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cities, type FlightSummary } from '../../src/domain';
import { MapScreen } from '../page03/MapScreen';

vi.mock('react-native', () => ({ View: 'view', Text: 'text', Pressable: 'pressable', ScrollView: 'scroll', Platform: { OS: 'ios' }, StyleSheet: { create: (styles: unknown) => styles }, PanResponder: { create: () => ({ panHandlers: {} }) } }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
vi.mock('react-native-svg', () => ({ default: 'svg', Defs: 'defs', LinearGradient: 'gradient', Rect: 'rect', Stop: 'stop' }));
vi.mock('../page03/atoms', () => ({ a: {}, font: {}, palette: {}, Copy: 'copy', Handle: 'handle', Icon: 'icon', IconButton: 'icon-button', PrimaryButton: 'primary-button', PageFrame: 'frame', usePageInsets: () => ({ top: 59, bottom: 34 }) }));
vi.mock('../PaperPigeon', () => ({ PaperPigeon: 'bird' }));
vi.mock('./FlightMap', () => ({ FlightMap: 'map' }));

const flight: FlightSummary = { id: 'opaque-flight-id', courier: 'Pip', origin: cities[2], destination: cities[4], visibility: 'sealed', defense: 'cruise', distanceKm: 5570, departedAt: 0, arrivesAt: 100000, state: 'in_flight', outfit: 'classic', demo: true, role: 'sender', attemptCount: 0 };
let renderer: ReactTestRenderer;
let props: ComponentProps<typeof MapScreen>;
const node = (type: string) => renderer.root.findByType(type as never);
const buttons = (label: string) => renderer.root.findAllByType('pressable' as never).filter(item => item.props.accessibilityLabel === label);
async function render(changes: Partial<typeof props> = {}) {
  props = { ...props, ...changes };
  await act(async () => { if (renderer) renderer.update(createElement(MapScreen, props)); else renderer = create(createElement(MapScreen, props)); });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  props = { flights: [flight], selected: null, serverNow: 40000, scope: 'mine', onScope: vi.fn(), onSelect: vi.fn(), onSend: vi.fn(), onOpenLetter: vi.fn() };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined as unknown as ReactTestRenderer; vi.unstubAllGlobals(); });

describe('map selection and sheet boundary', () => {
  it('selects the opaque flight id without opening a letter until requested', async () => {
    await render();
    await act(async () => node('map').props.onSelect(flight.id));
    expect(props.onSelect).toHaveBeenCalledWith(flight.id);
    expect(props.onOpenLetter).not.toHaveBeenCalled();
    await render({ selected: flight.id });
    await act(async () => buttons('Open letter details')[0].props.onPress());
    expect(props.onOpenLetter).toHaveBeenCalledWith(flight.id);
  });

  it('pauses live positions while disconnected or the clock is stale', async () => {
    await render({ connected: false });
    expect(node('map').props.serverNow).toBeNull();
    await render({ connected: true, clockError: true });
    expect(node('map').props.serverNow).toBeNull();
    await render({ clockError: false });
    expect(node('map').props.serverNow).toBe(40000);
  });

  it('clears a selected flight after it leaves the authorized active result', async () => {
    await render({ selected: flight.id });
    await render({ flights: [] });
    expect(props.onSelect).toHaveBeenCalledWith(null);
    expect(node('map').props.selected).toBeNull();
    expect(buttons('Open letter details')).toHaveLength(0);
  });

  it('never opens a private letter view from a World selection', async () => {
    await render({ scope: 'world', selected: flight.id, flights: [{ ...flight, visibility: 'open', role: 'public' }] });
    expect(buttons('Open letter details')).toHaveLength(0);
  });

  it('only requests a refit through the explicit fit control, not clock updates', async () => {
    await render({ selected: flight.id });
    await render({ serverNow: 50000 });
    expect(node('map').props.fitRequest).toBe(0);
    const fit = renderer.root.findAllByType('icon-button' as never).find(item => item.props.label === 'Fit selected flight')!;
    await act(async () => fit.props.onPress());
    expect(node('map').props.fitRequest).toBe(1);
  });

  it('preserves the owning flow’s flock callback and sheet without remounting the map', async () => {
    const onFlock = vi.fn();
    await render({ onFlock });
    await act(async () => buttons('Open your flock')[0].props.onPress());
    expect(onFlock).toHaveBeenCalledOnce();
    const map = node('map');
    await render({ children: createElement('owned-flock-sheet') });
    expect(node('owned-flock-sheet')).toBeTruthy();
    expect(node('map')).toBe(map);
    expect(renderer.root.findAllByType('primary-button' as never)).toHaveLength(0);
  });
});
