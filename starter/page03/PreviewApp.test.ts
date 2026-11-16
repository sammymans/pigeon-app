import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewApp } from './PreviewApp';
import type { SkyMapData } from './mapData';
import { isNearbyMock } from './nearbyPigeon';

vi.mock('react-native', () => ({ Text: 'text', View: 'view', Modal: 'modal', Pressable: 'pressable', ScrollView: 'scroll', StyleSheet: { create: (value: unknown) => value } }));
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
async function render(initialFlock?: import('./MapScreen').FlockBird[]) { await act(async () => { renderer = create(createElement<NonNullable<Parameters<typeof PreviewApp>[0]>>(PreviewApp, { initialFlock })); }); }
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
    expect(node('home').props.action).toBe('Send a pigeon');
    expect(node('home').props.notice).toBeUndefined();
    expect(node('map').props.unopened).toBe(0);
    expect(mapData().markers).toHaveLength(3);
    expect(mapData().markers.every(marker => isNearbyMock(marker.id))).toBe(true);
    expect(mapData().nearby?.radiusKm).toBe(5);
    await press(() => node('home').props.onExpand());
    expect(node('flock').props.birds).toHaveLength(5);
    expect(node('flock').props.birds.every((bird: { status: string; deliveries: string }) => bird.status === 'Ready' && bird.deliveries === '0 deliveries')).toBe(true);
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
    await press(() => button('Refresh nearby pigeons').props.onPress());
    expect(mapData().markers).toHaveLength(3);
    expect(mapData().markers.every(marker => !before.some(old => old.id === marker.id))).toBe(true);
    expect(mapData().nearby?.center.longitude).toBe(-122.4194);
    await press(() => node('map').props.onInbox());
    const people = node('grid').props.people;
    expect(people).toHaveLength(2);
    const caughtLetters = people.flatMap((person: { letters: unknown[] }) => person.letters);
    expect(caughtLetters.map((letter: { courier: string }) => letter.courier).sort()).toEqual(['Fern', 'Sunny']);
    expect(caughtLetters.every((letter: { caught: boolean; replyBy: number; at: number }) => letter.caught && letter.replyBy - letter.at === 30 * 60_000)).toBe(true);
    expect(new Set(caughtLetters.map((letter: { body: string }) => letter.body)).size).toBe(2);
  });

  it('adds only the letter the user sends and returns to a clean account on full reset', async () => {
    await render();
    await press(() => node('home').props.onSend());
    await press(() => node('recipients').props.onSelect('alex'));
    await press(() => node('recipients').props.onNext());
    await press(() => node('composer').props.onChange('My very first letter.'));
    await press(() => node('composer').props.onNext());
    await press(() => node('review').props.onSend());
    expect(mapData().markers).toHaveLength(4);
    await press(() => node('sent').props.onHome());
    expect(node('home').props.subtitle).toBe('1 sent · 0 on its way to you');
    await press(() => node('map').props.onScope('world'));
    expect(mapData().nearby).toBeUndefined();
    expect(mapData().routes).toHaveLength(4);
    expect(mapData().focusCoordinates).toHaveLength(4 * 65);
    await press(() => node('map').props.onInbox());
    expect(node('grid').props.people[0].letters).toHaveLength(1);
    await press(() => node('grid').props.onBack());
    await press(() => node('map').props.onMenu());
    await press(() => button('Start over').props.onPress());
    expect(node('home').props.title).toBe('No flights yet');
    expect(mapData().markers).toHaveLength(3);
    await press(() => node('map').props.onInbox());
    expect(node('grid').props.people).toEqual([]);
  });

  it('sends from the device location with the same estimate shown at review', async () => {
    await render();
    await press(() => node('map').props.onLocationChange({ latitude: -33.8688, longitude: 151.2093 }));
    await press(() => node('home').props.onSend());
    await press(() => node('recipients').props.onSelect('alex'));
    await press(() => node('recipients').props.onNext());
    await press(() => node('composer').props.onChange('Hello from Sydney!'));
    await press(() => node('composer').props.onNext());
    const estimate = node('review').props.estimate;
    expect(node('review').props.sender).toContain('Your location');
    await press(() => node('review').props.onSend());
    const route = mapData().routes.find(route => route.selected)!;
    expect(route.origin).toMatchObject({ lat: -33.8688, lng: 151.2093 });
    expect(route.destination.name).toBe('London');
    expect(node('sent').props.estimate).toBe(estimate);
  });

  it('replies directly to a caught sender, from the current location to the saved sender location', async () => {
    await render();
    await press(() => node('map').props.onLocationChange({ latitude: 37.7749, longitude: -122.4194 }));
    const target = mapData().routes.find(route => route.id.includes('scout'))!;
    await press(() => node('map').props.onSelect(target.id));
    await press(() => button('Intercept').props.onPress());
    await press(() => node('game').props.onCaught());
    await press(() => node('game').props.onOpenLetter());
    await press(() => button('Reply').props.onPress());
    expect(node('composer').props.person.name).toBe('Avery');
    await press(() => node('composer').props.onChange('I love that garden too.'));
    await press(() => node('composer').props.onNext());
    expect(node('review').props.returning).toBe('Scout');
    await press(() => node('review').props.onSend());
    const route = mapData().routes.find(route => route.selected)!;
    expect(route.origin).toMatchObject({ lat: 37.7749, lng: -122.4194 });
    expect(route.destination).toMatchObject({ lat: target.origin.lat, lng: target.origin.lng });
    expect(route.coordinates[0]).toEqual({ latitude: 37.7749, longitude: -122.4194 });
    expect(route.coordinates.at(-1)).toEqual({ latitude: target.origin.lat, longitude: target.origin.lng });
  });
  it('uses the fixed Vancouver demo route and deduplicates the final send', async () => {
    await render();
    await press(() => node('home').props.onSend());
    expect(renderer.root.findAllByType('composer' as never)).toHaveLength(0);
    await press(() => node('recipients').props.onSelect('sammy'));
    await press(() => node('recipients').props.onNext());
    expect(node('composer').props.person.city).toBe('Vancouver');
    await press(() => node('composer').props.onChange('A hello across the border.'));
    await press(() => node('composer').props.onNext());
    const review = node('review').props;
    expect(review.delivery).toMatchObject({ origin: 'San Francisco', destination: 'Vancouver', demoRoute: true });
    expect(review.estimate).toBe('21h 21m');
    await press(() => { review.onSend(); review.onSend(); });
    expect(mapData().routes.filter(route => route.selected)).toHaveLength(1);
    const route = mapData().routes.find(route => route.selected)!;
    expect(route.origin.name).toBe('San Francisco');
    expect(route.destination.name).toBe('Vancouver');
    expect(node('sent').props.estimate).toBe(review.estimate);
    await press(() => node('sent').props.onHome());
    expect(node('home').props.subtitle).toBe('1 sent · 0 on its way to you');
  });

  it('keeps the letter and review step through the empty-coop shop path', async () => {
    await render([{ id: 'busy', name: 'Mochi', status: 'Flying', color: 'blue' }]);
    await press(() => node('home').props.onSend());
    await press(() => node('recipients').props.onSelect('sammy'));
    await press(() => node('recipients').props.onNext());
    await press(() => node('composer').props.onChange('Keep this letter safe.'));
    await press(() => node('composer').props.onNext());
    expect(node('review').props.disabled).toBe(true);
    await press(() => node('review').props.onSend());
    expect(node('review').props.disabled).toBe(true);
    await press(() => node('review').props.onShop());
    expect(node('shop').props.initialScreen).toBe('pigeon');
    await press(() => node('shop').props.onBack());
    expect(node('review').props.person.name).toBe('Sammy');
    await press(() => node('review').props.onShop());
    await press(() => node('shop').props.onPreviewPigeon());
    expect(node('review').props.disabled).toBe(false);
    expect(node('review').props.birds.find((bird: { id: string }) => bird.id === node('review').props.selected).name).toBe('Clover');
    await press(() => node('review').props.onBack());
    expect(node('composer').props.body).toBe('Keep this letter safe.');
    await press(() => node('composer').props.onNext());
    await press(() => node('review').props.onSend());
    expect(node('sent').props.pigeon).toBe('Clover');
  });

  it('addresses a new invitee before writing and preserves the recipient in the mailbox', async () => {
    await render();
    await press(() => node('home').props.onSend());
    const invitee = { id: 'invite:lee:Paris', name: 'Lee', city: 'Paris', invited: true };
    await press(() => node('recipients').props.onInvite(invitee));
    await press(() => node('recipients').props.onNext());
    expect(node('composer').props.person).toEqual(invitee);
    await press(() => node('composer').props.onChange('Your first pigeon letter!'));
    await press(() => node('composer').props.onRecipient());
    await press(() => node('recipients').props.onNext());
    expect(node('composer').props.body).toBe('Your first pigeon letter!');
    await press(() => node('composer').props.onNext());
    expect(node('review').props.delivery.destination).toBe('Paris');
    await press(() => node('review').props.onSend());
    await press(() => node('sent').props.onHome());
    await press(() => node('map').props.onInbox());
    expect(node('grid').props.people[0].name).toBe('Lee');
    expect(node('grid').props.people[0].letters[0].body).toBe('Your first pigeon letter!');
  });

});
