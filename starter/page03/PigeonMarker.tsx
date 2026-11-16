import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from './atoms';

// A tiny, legible pigeon silhouette, shared by native and web flight markers.
export function PigeonMarker({ size = 30, color = palette.blue }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <Path d="M8 23 2 18l7 1c0-3 1-5 4-6L9 3c6 1 10 5 11 9 2-3 5-3 7-1l1 3 3 2-4 1c-1 6-7 10-13 8l-6 3Z" fill={color} />
    <Path d="m12 17 6 3 4-2" fill="none" stroke="white" strokeOpacity={0.65} strokeWidth={1.3} strokeLinecap="round" />
    <Circle cx={24.5} cy={13} r={1} fill="white" />
  </Svg>;
}
