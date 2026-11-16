import { SvgXml } from 'react-native-svg';
import type { Accessory } from '../../src/shop';
import { pigeonFlightSvg, type WingPose } from '../pigeonFlightArtwork';

export function PigeonMarker({ size = 44, name = 'Mochi', accessory = 'cap', pose = 'up', facingLeft = false }: { size?: number; name?: string; accessory?: Accessory | null; pose?: WingPose; facingLeft?: boolean }) {
  return <SvgXml xml={pigeonFlightSvg(name, pose, accessory ?? undefined, facingLeft)} width={size} height={size} />;
}
