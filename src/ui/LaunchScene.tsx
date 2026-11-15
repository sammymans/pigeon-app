import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { Outfit } from '../domain';
import { PigeonCharacter } from '../animation/PigeonCharacter';
import { Envelope } from './postal';
import { Txt, useReducedMotion } from './primitives';
import { colors } from './theme';

export function LaunchScene({ outfit }: { outfit: Outfit }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const motion = Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true });
    motion.start();
    return () => motion.stop();
  }, [reduced, progress]);
  return <View style={{ paddingVertical: 48, alignItems: 'center', gap: 16 }}>
    <View style={{ width: 260, height: 220, alignItems: 'center', justifyContent: 'center' }}>
      {!reduced && <Animated.View style={{ position: 'absolute', bottom: 16, opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.3, 0] }), transform: [{ perspective: 400 }, { rotateX: progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: ['0deg', '65deg', '65deg'] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }] }}><Envelope size={96}/></Animated.View>}
      <Animated.View style={reduced ? undefined : { transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, -4, 28] }) }, { translateY: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [8, 12, -18] }) }, { scaleX: progress.interpolate({ inputRange: [0, 0.15, 0.4, 1], outputRange: [1, 1.05, 0.97, 1] }) }, { scaleY: progress.interpolate({ inputRange: [0, 0.15, 0.4, 1], outputRange: [1, 0.95, 1.03, 1] }) }] }}><PigeonCharacter size={210} outfit={outfit} motion="launch"/></Animated.View>
    </View>
    <Txt accessibilityLiveRegion="polite" style={{ fontSize: 26, fontWeight: '600' }}>And they’re off.</Txt>
    <Txt style={{ color: colors.muted, textAlign: 'center' }}>Your thought has somewhere to be.</Txt>
  </View>;
}
