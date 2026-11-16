import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Pigeon } from '../Pigeon';
import { font, Icon, palette } from './atoms';
import type { FlockBird } from './MapScreen';

/** The letter's coop shows only couriers that can take this flight. */
export function CoopPicker({ birds, selected, onSelect }: { birds: FlockBird[]; selected: string; onSelect: (id: string) => void }) {
  const { width } = useWindowDimensions();
  const coopWidth = Math.min(width, 480) - 48;
  const scale = coopWidth / 342;
  const ready = birds.filter(bird => bird.status === 'Ready' && !bird.egg);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const index = ready.findIndex(bird => bird.id === selected);
  const page = Math.max(0, Math.floor(index / 2));
  const [visiblePage, setVisiblePage] = useState(page);
  useEffect(() => { scroll.current?.scrollTo({ x: page * (coopWidth - 34 * scale), animated: true }); }, [page, coopWidth, scale]);
  return <View style={{ height: (ready.length ? 198 : 180) * scale }}>
    <Svg pointerEvents="none" aria-hidden width={coopWidth} height={190 * scale} viewBox="0 0 342 190">
      <Rect x="19" y="62" width="304" height="86" fill="#C49A70" />
      <Rect x="33" y="56" width="276" height="92" fill="#F2E1C6" />
      <Path d="M33 92H309M33 122H309" stroke="#D8B58D" strokeWidth="2.5" />
      <Path d="M171 14 44 56H298Z" fill="#FFFDF9" />
      <Path d="M59 51H283" stroke="#E6C69E" strokeWidth="8" />
      <Path d="M13 60 171 8 329 60" fill="none" stroke="#BB8E66" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 67 171 17 320 67" fill="none" stroke="#A87E58" strokeWidth="7" strokeLinejoin="round" />
      <Path d="M171 29C162 19 157 29 171 43C185 29 180 19 171 29Z" fill="#F4E2C9" />
      <Rect x="34" y="159" width="15" height="12" fill="#956E4B" />
      <Rect x="292" y="159" width="15" height="12" fill="#956E4B" />
      <Path d="M11 145H331V156Q331 162 325 162H17Q11 162 11 156Z" fill="#C59A6B" />
      <Path d="M11 146H331" stroke="#E8CAA3" strokeWidth="6" />
      <Path d="M41 155H61M289 155H306" stroke="#A97E55" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
    {ready.length > 0 && <ScrollView ref={scroll} horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} snapToInterval={coopWidth - 34 * scale} decelerationRate="fast" onScroll={event => setVisiblePage(Math.round(event.nativeEvent.contentOffset.x / (coopWidth - 34 * scale)))} scrollEventThrottle={32} accessibilityRole="radiogroup" accessibilityLabel="Choose a pigeon in your coop" style={{ position: 'absolute', top: 49 * scale, left: 17 * scale, right: 17 * scale, height: 149 * scale }}>
      {ready.map(bird => <Pressable key={bird.id} accessibilityRole="radio" accessibilityLabel={`${bird.name}, Ready`} accessibilityHint="Load your letter onto this pigeon" accessibilityState={{ checked: selected === bird.id }} onPress={() => onSelect(bird.id)} style={{ width: (coopWidth - 34 * scale) / 2, alignItems: 'center' }}>
        <Pigeon name={bird.name} accessory={bird.accessory} size={122 * scale} />
        <View style={[styles.name, selected === bird.id && styles.selected]}>{selected === bird.id && <Icon name="check" size={16} color="white" />}<Text numberOfLines={1} style={[styles.nameText, selected === bird.id && { color: 'white' }]}>{bird.name}</Text></View>
      </Pressable>)}
    </ScrollView>}
    {ready.length > 2 && <View pointerEvents="none" style={styles.pages}>{Array.from({ length: Math.ceil(ready.length / 2) }, (_, i) => <View key={i} style={[styles.dot, i === visiblePage && { backgroundColor: palette.blue }]} />)}</View>}
  </View>;
}

const styles = StyleSheet.create({
  name: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '95%', borderRadius: 18, backgroundColor: 'white', paddingHorizontal: 12, height: 27, marginTop: -8 },
  selected: { backgroundColor: palette.blue },
  nameText: { fontFamily: font.system, fontSize: 14, lineHeight: 18, fontWeight: '600', color: palette.ink },
  pages: { position: 'absolute', bottom: -6, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#C7D2DF' },
});
