import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Pigeon } from './Pigeon';
import { ItemArt, type CoopShopEntry } from './CoopShop';
import type { FlockBird } from './page03/MapScreen';
import { a, font, Icon, IconButton, PageFrame, palette, usePageInsets } from './page03/atoms';

type Props = {
  birds: FlockBird[];
  selected: string | null;
  guardUntil?: number;
  now: number | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onSend: (id: string) => void;
  onShop?: (entry?: CoopShopEntry) => void;
  unavailable?: string;
};

export function CoopScreen({ birds, selected, guardUntil = 0, now, onSelect, onClose, onSend, onShop, unavailable }: Props) {
  const insets = usePageInsets();
  const { width } = useWindowDimensions();
  const portraitWidth = Math.max(54, (Math.min(width, 480) - 48 - 32) / 5);
  const homeBirds = birds.filter(item => item.status !== 'Flying');
  const away = birds.length - homeBirds.length;
  const bird = homeBirds.find(item => item.id === selected) ?? homeBirds.find(item => item.status === 'Ready' && !item.egg) ?? homeBirds[0];
  const ready = homeBirds.filter(item => item.status === 'Ready' && !item.egg).length;
  const canSend = bird?.status === 'Ready' && !bird.egg;
  const guarded = now !== null && guardUntil > now;
  const guardMinutes = guarded ? Math.ceil((guardUntil - now) / 60_000) : 0;
  const flockSize = birds.filter(item => !item.egg).length;

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => listener.remove();
  }, [onClose]);

  return <PageFrame style={{ paddingTop: insets.top }}>
    <View style={styles.header}>
      <View style={styles.back}><IconButton name="back" label="Back to my flights" onPress={onClose} /></View>
      <Text accessibilityRole="header" style={styles.headerTitle}>My coop</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="My items" disabled={!onShop} onPress={() => onShop?.({ owned: true })} style={styles.items}><Text style={styles.itemsText}>My items</Text></Pressable>
    </View>
    <ScrollView style={a.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
      <Text accessibilityRole="header" style={styles.title}>Choose your{'\n'}little courier.</Text>
      <Text style={styles.subtitle}>{homeBirds.length ? `Tap a pigeon below · ${ready} ready to fly` : unavailable ?? (away ? 'Your pigeons are out delivering.' : 'A little friend is waiting for you.')}</Text>
      {homeBirds.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled directionalLockEnabled style={[a.horizontalScroll, styles.flock]} contentContainerStyle={styles.flockRow} accessibilityRole="radiogroup" accessibilityLabel="Your coop">
        {homeBirds.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${item.egg ? 'Hatching' : item.status}`} accessibilityState={{ checked: bird?.id === item.id }} onPress={() => onSelect(item.id)} style={[styles.bird, { width: portraitWidth }]}>
          <View style={[styles.portrait, { width: portraitWidth, height: portraitWidth + 4 }, bird?.id === item.id && styles.selectedPortrait]}>
            {item.egg ? <View style={[styles.egg, { backgroundColor: item.color }]} /> : <Pigeon name={item.name} accessory={item.accessory} size={portraitWidth - 4} />}
          </View>
          <Text numberOfLines={1} style={styles.birdName}>{item.name}</Text>
          <Text numberOfLines={1} style={[styles.birdStatus, item.status === 'Ready' && !item.egg && styles.blue]}>{item.egg ? 'Hatching' : item.status}</Text>
        </Pressable>)}
      </ScrollView>}
      {bird ? <View style={styles.card}>
        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroBird}>{bird.egg ? <View style={[styles.egg, styles.heroEgg, { backgroundColor: bird.color }]} /> : <Pigeon name={bird.name} accessory={bird.accessory} size={178} />}</View>
          <View style={styles.heroDetails}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.heroName}>{bird.name}</Text>
            <Text style={[styles.heroStatus, canSend && styles.blue]}>{canSend ? 'Ready to fly' : bird.egg ? 'Hatching soon' : bird.status === 'Flying' ? 'Out delivering' : bird.status}</Text>
          </View>
          {!bird.egg && onShop && <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${bird.name}’s outfit`} onPress={() => onShop({ owned: true, birdId: bird.id })} style={styles.edit}>
            <Svg aria-hidden width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="m15 4 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14Z" /></Svg>
          </Pressable>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={canSend ? `Send with ${bird.name}` : bird.egg ? 'Your egg is still hatching' : `${bird.name} is unavailable`} accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => { if (canSend) onSend(bird.id); }} style={({ pressed }) => [styles.send, !canSend && styles.disabled, pressed && { opacity: 0.8 }]}>
          <Text style={styles.sendText}>{canSend ? `Send with ${bird.name}` : bird.egg ? 'Hatching soon' : 'Back after this flight'}</Text>{canSend && <Icon name="arrow" color="white" size={23} />}
        </Pressable>
      </View> : <View style={styles.empty}><Icon name="coop" size={220} /><Text style={styles.emptyText}>{unavailable ?? (away ? 'They’ll be back in the coop after their flights.' : 'Your coop has room for a little courier.')}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={guarded ? `Flock guard, ${guardMinutes} minutes left` : 'Activate flock guard'} disabled={!onShop} onPress={() => onShop?.({ screen: 'guard' })} style={styles.guard}>
        <ItemArt item="guard" size={44} />
        <View style={styles.guardCopy}><Text style={styles.guardTitle}>Flock guard</Text><Text style={styles.secondary}>{guarded ? `Protecting all ${flockSize} ${flockSize === 1 ? 'pigeon' : 'pigeons'}` : 'A little extra protection'}</Text></View>
        <Text style={styles.guardStatus}>{guarded ? `${guardMinutes}m left` : now === null ? 'Syncing…' : 'Activate'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Visit the coop shop" disabled={!onShop} onPress={() => onShop?.()} style={styles.shop}>
        <View style={styles.shopIcon}><Icon name="shop" size={23} color={palette.blue} /></View>
        <View style={styles.shopCopy}><Text style={styles.shopTitle}>Visit the coop shop</Text><Text style={styles.secondary}>Outfits, treats & little extras</Text></View>
        <Icon name="arrow" size={23} color={palette.blue} />
      </Pressable>
    </ScrollView>
  </PageFrame>;
}

const styles = StyleSheet.create({
  header: { height: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 11 },
  headerTitle: { fontFamily: font.heading, color: palette.ink, fontSize: 20, lineHeight: 26 },
  items: { position: 'absolute', right: 24, minHeight: 44, justifyContent: 'center' },
  itemsText: { fontFamily: font.system, fontSize: 14, color: palette.secondary },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  title: { fontFamily: font.brand, fontSize: 32, lineHeight: 35, letterSpacing: -1.3, color: palette.ink },
  subtitle: { fontFamily: font.system, fontSize: 14, lineHeight: 21, color: palette.secondary, marginTop: 14 },
  flock: { marginTop: 16 },
  flockRow: { gap: 8, paddingBottom: 2 },
  bird: { alignItems: 'center', gap: 5 },
  portrait: { borderWidth: 1, borderColor: palette.line, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selectedPortrait: { borderWidth: 2, borderColor: palette.blue },
  birdName: { fontFamily: font.system, fontSize: 13, lineHeight: 18, fontWeight: '600', color: palette.ink },
  birdStatus: { fontFamily: font.system, fontSize: 11, lineHeight: 17, color: palette.secondary },
  blue: { color: palette.blue },
  egg: { width: 32, height: 42, borderRadius: 21 },
  card: { marginTop: 16, borderRadius: 25, backgroundColor: palette.water, overflow: 'hidden', paddingHorizontal: 16, paddingBottom: 16 },
  hero: { height: 157, marginHorizontal: -16 },
  heroBird: { position: 'absolute', left: -6, top: -11 },
  heroEgg: { width: 82, height: 108, borderRadius: 54, marginLeft: 48, marginTop: 32 },
  heroDetails: { marginLeft: '49%', paddingTop: 26, paddingRight: 16, gap: 6 },
  heroName: { fontFamily: font.heading, fontSize: 27, lineHeight: 34, color: palette.ink, marginRight: 41 },
  heroStatus: { fontFamily: font.system, fontSize: 14, lineHeight: 21, color: palette.secondary },
  edit: { position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  send: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 28, backgroundColor: palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  sendText: { fontFamily: font.system, fontSize: 16, lineHeight: 22, fontWeight: '600', color: 'white', flexShrink: 1, textAlign: 'center' },
  disabled: { backgroundColor: '#91A3C4' },
  empty: { marginTop: 18, borderRadius: 25, backgroundColor: palette.water, alignItems: 'center', padding: 18 },
  emptyText: { fontFamily: font.system, fontSize: 14, lineHeight: 21, color: palette.secondary, textAlign: 'center' },
  guard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, marginTop: 20 },
  guardCopy: { flex: 1, gap: 5 },
  guardTitle: { fontFamily: font.system, fontSize: 15, lineHeight: 21, fontWeight: '600', color: palette.ink },
  secondary: { fontFamily: font.system, fontSize: 13, lineHeight: 19, color: palette.secondary },
  guardStatus: { fontFamily: font.system, fontSize: 13, lineHeight: 19, fontWeight: '600', color: palette.blue },
  shop: { borderTopWidth: 1, borderTopColor: palette.line, marginTop: 26, paddingTop: 27, minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 14 },
  shopIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.pale, alignItems: 'center', justifyContent: 'center' },
  shopCopy: { flex: 1, gap: 4 },
  shopTitle: { fontFamily: font.heading, fontSize: 20, lineHeight: 26, color: palette.ink },
});
