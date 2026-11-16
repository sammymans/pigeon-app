import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import artwork from './pigeonArtwork.json';
import type { Accessory } from '../src/shop';
import { accessoryOverlay } from './shopArtwork';

export type PigeonName = keyof typeof artwork;

export function pigeonSvg(name: string, accessory?: Accessory) {
  const aliases: Record<string, PigeonName> = { Scout: 'Pip', Fern: 'Button', Sunny: 'Noodle', Miso: 'Mochi', Dot: 'Button', Nova: 'Noodle' };
  const resolved = name in artwork ? name as PigeonName : aliases[name] ?? 'Mochi';
  return artwork[resolved].replace(/<rect[^>]*fill="#FFFFFF[A-Fa-f0-9]*"[^>]*\/>/g, '').replace(/ style="[^"]*"/, '')
    .replace(/gradienttransform=/g, 'gradientTransform=')
    .replace('viewBox="0 0 512 512"', 'viewBox="-25 -65 562 600"')
    .replace('</svg>', `${accessory ? accessoryOverlay(accessory, resolved) : ''}</svg>`);
}

export function Pigeon({ name = 'Mochi', size = 180, accessory }: { name?: string; size?: number; accessory?: Accessory }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants"><SvgXml xml={pigeonSvg(name, accessory)} width={size} height={size} /></View>;
}
