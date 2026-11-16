// Web fallback: keep native MapKit imports out of the browser bundle.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { project } from '../../src/ui/flightGeometry';
import { worldLand } from '../../src/ui/worldLand';
import { palette } from './atoms';
import type { SkyMapProps } from './mapData';
import { PigeonMarker } from './PigeonMarker';

export function SkyMap({ data, onSelect, topInset, bottomInset }: SkyMapProps) {
  const [size, setSize] = useState({ width: 390, height: 420 });
  const focus = [...data.focusCoordinates, ...data.markers.map(marker => marker.coordinate)].map(point => project(point.latitude, point.longitude));
  const minX = Math.min(...focus.map(point => point.x)), maxX = Math.max(...focus.map(point => point.x));
  const minY = Math.min(...focus.map(point => point.y)), maxY = Math.max(...focus.map(point => point.y));
  const ratio = size.width / Math.max(1, size.height);
  const width = Math.max(100, maxX - minX + 75, (maxY - minY + 75) * ratio);
  const height = width / ratio;
  const left = (minX + maxX - width) / 2;
  const top = (minY + maxY - height) / 2;
  const path = (coordinates: typeof data.focusCoordinates) => coordinates.map((point, index) => { const p = project(point.latitude, point.longitude); return `${index ? 'L' : 'M'}${p.x} ${p.y}`; }).join(' ');
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.water }]}><View style={{ position: 'absolute', top: topInset, bottom: bottomInset, left: 0, right: 0 }} onLayout={event => setSize(event.nativeEvent.layout)}><Svg width="100%" height="100%" viewBox={`${left} ${top} ${width} ${height}`} preserveAspectRatio="none">
    <G fill={palette.land}>{worldLand.map((d, index) => <Path key={index} d={d} />)}</G>
    {data.routes.map(route => <Path key={route.id} d={path(route.coordinates)} stroke={route.selected ? palette.blue : '#95ACE5'} strokeWidth={2} strokeDasharray="4 6" fill="none" />)}
    {data.routes.filter(route => route.selected).flatMap(route => [route.origin, route.destination].map((city, i) => { const p = project(city.lat, city.lng); return <Circle key={`${route.id}:${i}`} cx={p.x} cy={p.y} r={3} fill={palette.blue} stroke="white" strokeWidth={1.5} />; }))}
  </Svg>
    {data.markers.map(marker => { const p = project(marker.coordinate.latitude, marker.coordinate.longitude); return <Pressable key={marker.id} accessibilityRole="button" accessibilityLabel={marker.label} onPress={() => onSelect?.(marker.id)} style={[styles.marker, { left: (p.x - left) / width * size.width - 24, top: (p.y - top) / height * size.height - 24, backgroundColor: marker.selected ? palette.blue : 'white', zIndex: marker.selected ? 2 : 1 }]}><PigeonMarker size={30} color={marker.selected ? 'white' : palette.blue} /></Pressable>; })}
    {data.routes.filter(route => route.selected).flatMap(route => [route.origin, route.destination].map((city, i) => { const p = project(city.lat, city.lng); return <Text pointerEvents="none" key={`${route.id}:${i}`} style={[styles.city, { left: (p.x - left) / width * size.width - 50, top: (p.y - top) / height * size.height + 10 }]}>{city.name.toUpperCase()}</Text>; }))}
  </View></View>;
}

const styles = StyleSheet.create({
  marker: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 14px rgba(36,83,255,0.18)' },
  city: { position: 'absolute', width: 100, textAlign: 'center', fontSize: 8, letterSpacing: 1, fontWeight: '600', color: '#77869B' },
});
