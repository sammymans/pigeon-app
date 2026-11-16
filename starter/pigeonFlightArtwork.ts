import artwork from './pigeonArtwork.json';
import type { Accessory } from '../src/shop';
import { accessoryOverlay } from './shopArtwork';

type Name = keyof typeof artwork;
export type WingPose = 'up' | 'down';
type Wing = { indices: number[]; pivot: [number, number]; up: number; down: number };
const poses: Record<Name, { remove: number[]; wings: Wing[] }> = {
  Mochi: { remove: [14, 15, 16], wings: [
    { indices: [0, 1, 2], pivot: [426, 174], up: -100, down: -30 },
    { indices: [11, 12, 13], pivot: [110, 174], up: 125, down: 35 },
  ] },
  Pip: { remove: [0, 1, 2, 3, 4, 5], wings: [{ indices: [9, 10, 11], pivot: [233, 263], up: 120, down: 25 }] },
  Button: { remove: [0, 1, 2, 3], wings: [
    { indices: [11, 12, 13], pivot: [86, 182], up: 125, down: 35 },
    { indices: [14, 15, 16], pivot: [426, 182], up: -100, down: -30 },
  ] },
  Noodle: { remove: [0, 1, 2], wings: [
    { indices: [3, 4, 5], pivot: [358, 257], up: -100, down: -30 },
    { indices: [13, 14, 15], pivot: [233, 255], up: 120, down: 25 },
  ] },
  Puddle: { remove: [0, 11, 12], wings: [{ indices: [3, 4, 5], pivot: [320, 220], up: -115, down: -25 }] },
};
const aliases: Record<string, Name> = { Scout: 'Pip', Fern: 'Button', Sunny: 'Noodle', Miso: 'Mochi', Dot: 'Button', Nova: 'Noodle' };
const cache = new Map<string, string>();

// Animate the existing character art, keeping the original faces and fitted accessories.
export function pigeonFlightSvg(name: string, pose: WingPose = 'up', accessory?: Accessory, facingLeft = false) {
  const resolved = name in artwork ? name as Name : aliases[name] ?? 'Mochi';
  const key = `${resolved}:${pose}:${accessory ?? ''}:${facingLeft}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const source = artwork[resolved].replace(/gradienttransform=/g, 'gradientTransform=');
  const defs = source.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
  const elements = source.replace(defs, '').match(/<(?:path|circle|ellipse|rect)\b[^>]*\/>/g) ?? [];
  const config = poses[resolved];
  const body = elements.map((element, index) => {
    if (config.remove.includes(index)) return '';
    const wing = config.wings.find(wing => wing.indices.includes(index));
    if (!wing) return element;
    if (index !== wing.indices[0]) return '';
    return `<g transform="rotate(${wing[pose]} ${wing.pivot.join(' ')})">${wing.indices.map(i => elements[i]).join('')}</g>`;
  }).join('');
  const mirror = facingLeft !== (resolved === 'Puddle');
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -100 730 650">${defs}<g${mirror ? ' transform="translate(512 0) scale(-1 1)"' : ''}><g transform="rotate(15 256 256)">${body}${accessory ? accessoryOverlay(accessory, resolved) : ''}</g></g></svg>`;
  cache.set(key, xml);
  return xml;
}
