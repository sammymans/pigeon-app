// Web fallback: keep native MapKit imports out of the browser bundle.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { project } from '../../src/ui/flightGeometry';
import { worldLand } from '../../src/ui/worldLand';
import { Icon, palette } from './atoms';
import type { SkyMapProps } from './mapData';
import { PigeonMarker } from './PigeonMarker';

export function SkyMap({ data, onSelect, onLocationChange, topInset, bottomInset }: SkyMapProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [size, setSize] = useState({ width: 390, height: 420 });
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const mounted = useRef(true);
  const locatingNow = useRef(false);
  const locationCallback = useRef(onLocationChange);
  locationCallback.current = onLocationChange;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!onLocationChange || data.userLocation || data.nearby?.locationKnown) return;
    let active = true;
    void Location.getForegroundPermissionsAsync().then(permission => { if (active && permission.granted) void locate(); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function locate() {
    if (locatingNow.current) return;
    locatingNow.current = true; setLocating(true); setLocationError('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) { setLocationError('Location access is off.'); return; }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Location timed out')), 15_000); }),
      ]);
      if (mounted.current) locationCallback.current?.({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch { if (mounted.current) setLocationError('Location unavailable. Try again.'); }
    finally { if (timeout) clearTimeout(timeout); locatingNow.current = false; if (mounted.current) setLocating(false); }
  }

  const projected = (point: { latitude: number; longitude: number }) => {
    const p = project(point.latitude, point.longitude);
    if (data.nearby) { const centerX = project(data.nearby.center.latitude, data.nearby.center.longitude).x; p.x = centerX + ((p.x - centerX + 1500) % 1000) - 500; }
    return p;
  };
  const focus = (data.nearby ? data.focusCoordinates : [...data.focusCoordinates, ...data.markers.map(marker => marker.coordinate)]).map(projected);
  const minX = Math.min(...focus.map(point => point.x)), maxX = Math.max(...focus.map(point => point.x));
  const minY = Math.min(...focus.map(point => point.y)), maxY = Math.max(...focus.map(point => point.y));
  const ratio = size.width / Math.max(1, size.height);
  const width = data.nearby ? Math.max(0.05, (maxX - minX) * 1.24, (maxY - minY) * 1.24 * ratio) : Math.max(100, maxX - minX + 75, (maxY - minY + 75) * ratio);
  const height = width / ratio;
  const left = (minX + maxX - width) / 2;
  const top = (minY + maxY - height) / 2;
  const unit = width / Math.max(1, size.width);
  const path = (coordinates: typeof data.focusCoordinates) => coordinates.map((point, index) => { const p = projected(point); return `${index ? 'L' : 'M'}${p.x} ${p.y}`; }).join(' ');
  const center = data.nearby ? projected(data.nearby.center) : null;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.water }]}><View style={{ position: 'absolute', top: topInset, bottom: bottomInset, left: 0, right: 0, overflow: 'hidden' }} onLayout={event => setSize(event.nativeEvent.layout)}><Svg width="100%" height="100%" viewBox={`${left} ${top} ${width} ${height}`} preserveAspectRatio="none">
    <G fill={palette.land}>{worldLand.map((d, index) => <Path key={index} d={d} />)}</G>
    {data.routes.map(route => <Path key={route.id} d={path(route.coordinates)} stroke="#7D99FF" strokeWidth={unit * 1.5} strokeDasharray={`${unit * 2} ${unit * 2}`} strokeLinecap="butt" fill="none" />)}
    {data.routes.flatMap(route => [route.origin, route.destination].map((city, i) => { const p = projected({ latitude: city.lat, longitude: city.lng }); return <Circle key={`${route.id}:${i}`} cx={p.x} cy={p.y} r={unit * 3} fill={palette.blue} stroke="white" strokeWidth={unit * 1.5} />; }))}
    {center && <Circle cx={center.x} cy={center.y} r={unit * 7} fill={data.nearby?.locationKnown ? palette.blue : '#8597B3'} stroke="white" strokeWidth={unit * 3} />}
  </Svg>
    {data.markers.map(marker => { const p = projected(marker.coordinate); if (p.x < left || p.x > left + width || p.y < top || p.y > top + height) return null; return <Pressable key={marker.id} accessibilityRole="button" accessibilityLabel={marker.label} onPress={() => onSelect?.(marker.id)} style={[styles.marker, { left: (p.x - left) / width * size.width - 30, top: (p.y - top) / height * size.height - 30, zIndex: marker.selected ? 2 : 1 }]}><PigeonMarker name={marker.courier} accessory={marker.accessory} facingLeft={marker.facingLeft} size={60} /></Pressable>; })}
    {!data.nearby && data.routes.flatMap(route => [route.origin, route.destination].map((city, i) => { const p = projected({ latitude: city.lat, longitude: city.lng }); return <Text pointerEvents="none" key={`${route.id}:${i}`} style={[styles.city, { left: (p.x - left) / width * size.width - 50, top: (p.y - top) / height * size.height + 10 }]}>{city.name.toUpperCase()}</Text>; }))}
    {center && <Text pointerEvents="none" style={[styles.city, { left: (center.x - left) / width * size.width - 50, top: (center.y - top) / height * size.height + 12 }]}>{data.nearby?.locationKnown ? 'YOU' : 'NEW YORK'}</Text>}
  </View>
    {!!locationError && <Text accessibilityRole="alert" style={[styles.locationError, { bottom: bottomInset + 76 }]}>{locationError}</Text>}
    {onLocationChange && bottomInset < 400 && screenHeight - topInset - bottomInset >= 88 && <Pressable accessibilityRole="button" accessibilityLabel={locating ? 'Finding your location' : 'Center on my location'} disabled={locating} onPress={() => void locate()} style={[styles.recenter, { bottom: bottomInset + 22 }]}>{locating ? <ActivityIndicator size="small" color={palette.blue} /> : <Icon name="nearby" size={22} />}</Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  locationError: { position: 'absolute', right: 22, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)', color: '#687383', fontSize: 11 },
  recenter: { position: 'absolute', right: 22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(23,33,43,0.12)' },
  marker: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  city: { position: 'absolute', width: 100, textAlign: 'center', fontSize: 8, letterSpacing: 1, fontWeight: '600', color: '#77869B' },
});
