import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import artwork from './coopArtwork.json';
import { Pigeon } from './Pigeon';
import type { FlockBird } from './page03/MapScreen';

/** Keep each bird's perch empty while it is away on a delivery. */
export function CoopIllustration({ birds, width }: { birds: FlockBird[]; width: number }) {
  const scale = width / 360;
  const spacing = 310 / Math.max(5, birds.length);
  const size = Math.min(84, spacing + 22);
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ width, height: 160 * scale }}>
    <SvgXml xml={artwork.back} width={width} height={160 * scale} />
    {birds.map((bird, index) => bird.status === 'Flying' ? null : <View key={bird.id} style={{ position: 'absolute', left: (4 + index * spacing) * scale, top: (143 - size) * scale, width: size * scale, height: size * scale, alignItems: 'center', justifyContent: 'center' }}>
      {bird.egg ? <View style={{ width: 28 * scale, height: 38 * scale, borderRadius: 19 * scale, backgroundColor: bird.color }} /> : <Pigeon name={bird.name} accessory={bird.accessory} size={size * scale} />}
    </View>)}
    <SvgXml xml={artwork.front} width={width} height={160 * scale} style={{ position: 'absolute', top: 0, left: 0 }} />
  </View>;
}
