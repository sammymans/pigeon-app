import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { FlightSummary } from '../src/domain';
import { flightProgress, routeGeometry, routePoint } from '../src/ui/flightGeometry';
import { worldLand } from '../src/ui/worldLand';
import { PaperPigeon } from './PaperPigeon';
import { colors, s } from './ui';

export function FlightMap({ flights, selected, serverNow, onSelect }: { flights: FlightSummary[]; selected: string | null; serverNow: number | null; onSelect: (id: string) => void }) {
  const [width, setWidth] = useState(342);
  const focus = flights.find((flight) => flight.id === selected) ?? flights[0];
  const geometry = focus ? routeGeometry(focus) : null;
  const mapWidth = geometry ? Math.max(320, Math.abs(geometry.end.x - geometry.start.x) + 180) : 1000;
  const mapHeight = mapWidth * 320 / width;
  const left = geometry ? (geometry.start.x + geometry.end.x - mapWidth) / 2 : 0;
  const top = geometry ? (Math.min(geometry.control.y, geometry.start.y, geometry.end.y) + Math.max(geometry.start.y, geometry.end.y) - mapHeight) / 2 : (520 - mapHeight) / 2;
  const scale = width / mapWidth;

  return <View style={styles.map} onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}>
    <Svg aria-hidden width="100%" height={320} viewBox={`${left} ${top} ${mapWidth} ${mapHeight}`}>
      <Rect x={left} y={top} width={mapWidth} height={mapHeight} fill={colors.water} />
      <G fill={colors.land}>{worldLand.map((path, index) => <Path key={index} d={path} />)}</G>
      {geometry && <G><Path d={geometry.path} fill="none" stroke={colors.blue} strokeWidth={2 / scale} strokeDasharray={`${5 / scale} ${7 / scale}`} /><Circle cx={geometry.start.x} cy={geometry.start.y} r={5 / scale} fill={colors.blue} stroke="white" strokeWidth={3 / scale} /><Circle cx={geometry.end.x} cy={geometry.end.y} r={5 / scale} fill={colors.blue} stroke="white" strokeWidth={3 / scale} /></G>}
    </Svg>
    {flights.map((flight) => {
      const point = routePoint(flight, serverNow === null ? 0 : flightProgress(flight, serverNow));
      const x = (point.x - left) * scale;
      const y = (point.y - top) * scale;
      if (x < 0 || x > width || y < 0 || y > 320) return null;
      return <Pressable key={flight.id} accessibilityRole="button" accessibilityLabel={`Select flight from ${flight.origin.name} to ${flight.destination.name}`} aria-pressed={flight.id === focus?.id} accessibilityState={{ selected: flight.id === focus?.id }} onPress={() => onSelect(flight.id)} style={[styles.marker, { left: Math.max(0, Math.min(width - 56, x - 28)), top: Math.max(0, Math.min(264, y - 28)) }, flight.id === focus?.id && styles.markerSelected]}><PaperPigeon size={48} /></Pressable>;
    })}
    {focus && <View pointerEvents="none" style={styles.route}><Text style={[s.small, styles.routeText]}>{focus.origin.name} → {focus.destination.name}</Text></View>}
    <View pointerEvents="none" style={styles.caption}><Text style={styles.captionText}>City routes · not GPS{serverNow === null ? ' · syncing clock' : ''}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  map: { height: 320, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.water },
  marker: { position: 'absolute', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFFD9', borderWidth: 2, borderColor: '#FFFFFF' },
  markerSelected: { borderColor: colors.blue, backgroundColor: '#FFFFFF' },
  route: { position: 'absolute', top: 18, left: 18, right: 18, alignItems: 'center' },
  routeText: { textAlign: 'center', color: colors.ink, fontWeight: '600', backgroundColor: '#FFFFFFD9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  caption: { position: 'absolute', bottom: 20, left: 16, right: 16, alignItems: 'center' },
  captionText: { fontSize: 11, lineHeight: 16, color: colors.muted, backgroundColor: colors.water },
});
