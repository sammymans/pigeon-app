import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewApp } from './PreviewApp';
import type { SkyMapData } from './mapData';
import { isNearbyMock } from './nearbyPigeon';

vi.mock('react-native', () => ({ Text: 'text', View: 'view', Pressable: 'pressable', ScrollView: 'scroll', StyleSheet: { create: (value: unknown) => value } }));
vi.mock('./atoms', () => ({ a: {}, font: {}, palette: {}, Copy: 'copy', Handle: 'handle', Icon: 'icon', IconButton: 'icon-button', PrimaryButton: 'button', PageFrame: 'frame', PageHeader: 'header', usePageInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('./MapScreen', () => ({ MapScreen: 'map', MapSheet: 'map-sheet', HomeSheet: 'home', FlockSheet: 'flock', SentSheet: 'sent' }));
vi.mock('../CoopShop', () => ({ CoopShop: 'shop' }));
vi.mock('./InterceptionGame', () => ({ InterceptionGame: 'game', Stone: 'stone' }));
vi.mock('./PigeonMarker', () => ({ PigeonMarker: 'pigeon' }));
vi.mock('./Messaging', () => ({ ComposerSheet: 'composer', LetterSheet: 'conflict', LetterThread: 'thread', MailboxGrid: 'grid', ReadingSheet: 'reader', RecipientPicker: 'recipients', SendReview: 'review' }));

let renderer: ReactTestRenderer;
const node = (type: string) => renderer.root.findByType(type as never);
const button = (label: string) => renderer.root.findAllByType('button' as never).find(item => item.props.label === label)!;
const mapData = () => node('map').props.map as SkyMapData;
const press = async (action: () => void) => { await act(async () => action()); };
async function render() { await act(async () => { renderer = create(createElement(PreviewApp)); }); }
async function catchBird(name: string) {
  const marker = mapData().markers.find(marker => marker.label.startsWith(`${name},`))!;
  await press(() => node('map').props.onSelect(marker.id));
  expect(button('Intercept').props.disabled).toBe(false);
  await press(() => button('Intercept').props.onPress());
  expect(node('game').props.pigeon).toBe(name);
  await press(() => node('game').props.onSpendStone());
  await press(() => node('game').props.onCaught());
  await press(() => node('game').props.onClose());
  expect(mapData().markers.some(item => item.id === marker.id)).toBe(false);
}
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

describe('new-user preview and seeded interception', () => {
  it('starts with only nearby stranger flights, a ready welcome flock, and an empty mailbox', async () => {
    await render();
    expect(node('home').props.title).toBe('No flights yet');
    expect(node('map').props.unopened).toBe(0);
    expect(mapData().markers).toHaveLength(3);
    expect(mapData().markers.every(marker => isNearbyMock(marker.id))).toBe(true);
    expect(mapData().nearby?.radiusKm).toBe(5);
    await press(() => node('map').props.onCoop());
    expect(node('flock').props.birds).toHaveLength(5);
    expect(node('flock').props.birds.every((bird: { status: string; deliveries: string }) => bird.status === 'Ready' && bird.deliveries === '0 deliveries')).toBe(true);
    expect(node('flock').props.hatchery).toBe('No eggs hatching');
    await press(() => node('flock').props.onClose());
    await press(() => node('map').props.onInbox());
    expect(node('grid').props.people).toEqual([]);
  });

  it('moves all nearby birds together, catches each independently, and keeps caught mail on a nearby reset', async () => {
    await render();
    const before = mapData().markers;
    await press(() => node('map').props.onLocationChange({ latitude: 37.7749, longitude: -122.4194 }));
    expect(mapData().markers.map(marker => marker.id)).toEqual(before.map(marker => marker.id));
    expect(mapData().markers.every((marker, index) => marker.coordinate.longitude !== before[index].coordinate.longitude)).toBe(true);
    await catchBird('Fern');
    expect(mapData().markers).toHaveLength(2);
    await catchBird('Sunny');
    expect(mapData().markers).toHaveLength(1);
    expect(node('map').props.unopened).toBe(2);
    expect(node('home').props.title).toBe('No flights yet');
    await press(() => node('map').props.onMenu());
    await press(() => button('Reset nearby pigeons').props.onPress());
    expect(mapData().markers).toHaveLength(3);
    expect(mapData().markers.every(marker => !before.some(old => old.id === marker.id))).toBe(true);
    expect(mapData().nearby?.center.longitude).toBe(-122.4194);
    await press(() => node('map').props.onInbox());
    const person = node('grid').props.people[0];
    expect(person.letters.map((letter: { courier: string }) => letter.courier)).toEqual(['Fern', 'Sunny']);
    expect(person.letters.every((letter: { caught: boolean; replyBy: number; at: number }) => letter.caught && letter.replyBy - letter.at === 30 * 60_000)).toBe(true);
    expect(new Set(person.letters.map((letter: { body: string }) => letter.body)).size).toBe(2);
  });

  it('adds only the letter the user sends and returns to a clean account on full reset', async () => {
    await render();
    await press(() => node('home').props.onSend());
    await press(() => node('composer').props.onChange('My very first letter.'));
    await press(() => node('composer').props.onNext());
    await press(() => node('recipients').props.onSelect('alex'));
    await press(() => node('recipients').props.onNext());
    await press(() => node('review').props.onSend());
    expect(mapData().markers).toHaveLength(4);
    await press(() => node('sent').props.onHome());
    expect(node('home').props.subtitle).toBe('1 sent · 0 on its way to you');
    await press(() => node('map').props.onInbox());
    expect(node('grid').props.people[0].letters).toHaveLength(1);
    await press(() => node('grid').props.onBack());
    await press(() => node('map').props.onMenu());
    await press(() => button('Reset the preview').props.onPress());
    expect(node('home').props.title).toBe('No flights yet');
    expect(mapData().markers).toHaveLength(3);
    await press(() => node('map').props.onInbox());
    expect(node('grid').props.people).toEqual([]);
  });
});
