import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import artwork from './pigeonArtwork.json';

export type PigeonName = keyof typeof artwork;

export function Pigeon({ name = 'Mochi', size = 180 }: { name?: string; size?: number }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants"><SvgXml xml={artwork[name as PigeonName] ?? artwork.Mochi} width={size} height={size} /></View>;
}
