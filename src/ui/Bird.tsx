import React, { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Outfit } from '../domain';
import { aviatorArtwork, classicArtwork } from './birdArtwork';

export type BirdProps = { size?: number; outfit?: Outfit; pose?: 'up' | 'down'; facing?: 'left' | 'right'; label?: string };

export function Bird({ size = 80, outfit = 'classic', pose = 'up', facing = 'right', label = 'A little pigeon carrying a letter' }: BirdProps) {
  const xml = useMemo(() => (outfit === 'aviator' ? aviatorArtwork : classicArtwork)
    .replace('translate(-14 -14) rotate(0.0)', `translate(-14 -14) rotate(${pose === 'up' ? 65 : -18})`)
    .replace('translate(12 -16) rotate(4.583662361046586)', `translate(12 -16) rotate(${pose === 'up' ? 25 : -18})`), [outfit, pose]);
  return <View accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size * 0.8, transform: [{ scaleX: facing === 'left' ? -1 : 1 }] }}><SvgXml xml={xml} width={size} height={size * 0.8}/></View>;
}
