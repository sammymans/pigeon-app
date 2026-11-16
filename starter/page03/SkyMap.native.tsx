import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Icon, palette } from './atoms';
import { PigeonMarker } from './PigeonMarker';
import type { SkyMapProps } from './mapData';

export function SkyMap(props: SkyMapProps) {
  const { data, onSelect, bottomInset, scope } = props;
  const map = useRef<MapView>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const locatingNow = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const initialCity = useRef(data.routes.find(route => route.selected)?.origin);
  const focusKey = `${scope}:${data.focusKey}`;
  const previousFocus = useRef(focusKey);
  const initiallyFitted = useRef(false);
  const fit = useCallback((animated: boolean) => {
    const current = latest.current;
    map.current?.fitToCoordinates(current.data.focusCoordinates, {
      edgePadding: { top: current.topInset + 44, right: 48, bottom: 52, left: 48 },
      animated,
    });
  }, []);

  // Show the pigeons on first load; clock ticks leave the user's camera alone.
  useEffect(() => {
    if (ready && (!initiallyFitted.current || previousFocus.current !== focusKey)) {
      previousFocus.current = focusKey;
      fit(initiallyFitted.current);
      initiallyFitted.current = true;
    }
  }, [ready, focusKey, fit]);

  async function locate() {
    if (!ready || locatingNow.current) return;
    locatingNow.current = true;
    setLocating(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) {
        Alert.alert('Location access is off', 'Allow location access to center the map near you.', permission.canAskAgain ? [{ text: 'OK' }] : [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings().catch(() => Alert.alert('Open Settings', 'Enable location access for Pigeon in your device settings.')); } },
        ]);
        return;
      }
      if (!await Location.hasServicesEnabledAsync()) {
        if (mounted.current) Alert.alert('Location Services are off', 'Turn on Location Services in your device settings, then try again.');
        return;
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Location timed out')), 15_000); }),
      ]);
      if (!mounted.current) return;
      const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(coordinate);
      map.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 650);
    } catch {
      if (mounted.current) Alert.alert('Location unavailable', 'We couldn’t find your location. Try again in a moment.');
    } finally {
      if (timeout) clearTimeout(timeout);
      locatingNow.current = false;
      if (mounted.current) setLocating(false);
    }
  }

  return <View style={StyleSheet.absoluteFill}>
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: initialCity.current?.lat ?? 40.7128, longitude: initialCity.current?.lng ?? -74.006, latitudeDelta: 0.16, longitudeDelta: 0.12 }}
      mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      userInterfaceStyle="light"
      showsPointsOfInterests={false}
      showsBuildings={false}
      showsTraffic={false}
      showsCompass={false}
      showsScale={false}
      showsMyLocationButton={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      mapPadding={{ top: 0, right: 0, bottom: bottomInset + 8, left: 0 }}
      legalLabelInsets={{ top: 0, right: 8, bottom: bottomInset + 8, left: 8 }}
      onMapReady={() => setReady(true)}
      accessibilityLabel="Flight map. Drag to explore and pinch to zoom."
    >
      {userLocation && <Marker coordinate={userLocation} title="Your location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={20}><View style={styles.userLocation} /></Marker>}
      {data.routes.map(route => <Polyline key={route.id} coordinates={route.coordinates} geodesic strokeColor={route.selected ? palette.blue : '#93A9D0'} strokeWidth={route.selected ? 3 : 2} lineDashPattern={route.selected ? [6, 9] : [4, 9]} lineCap="round" />)}
      {data.routes.filter(route => route.selected).flatMap(route => [route.origin, route.destination].map(city => <Marker key={city.id} coordinate={{ latitude: city.lat, longitude: city.lng }} title={city.name} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}><View style={styles.endpoint} /></Marker>))}
      {data.markers.map(marker => <Marker key={`${marker.id}:${marker.selected}`} coordinate={marker.coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={marker.selected ? 10 : 5} accessibilityLabel={marker.label} onPress={() => onSelect?.(marker.id)}><View style={[styles.marker, marker.selected && styles.selected]}><PigeonMarker size={marker.selected ? 32 : 27} color={marker.selected ? 'white' : palette.blue} /></View></Marker>)}
    </MapView>
    {bottomInset < 400 && <Pressable accessibilityRole="button" accessibilityLabel={locating ? 'Finding your location' : 'Center on my location'} accessibilityState={{ disabled: !ready || locating, busy: locating }} disabled={!ready || locating} onPress={() => void locate()} style={[styles.recenter, { bottom: bottomInset + 34 }]}>{locating ? <ActivityIndicator size="small" color={palette.blue} /> : <Icon name="nearby" size={22} />}</Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  userLocation: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: 'white', backgroundColor: palette.blue },
  endpoint: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: 'white', backgroundColor: palette.blue },
  marker: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'white', backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center' },
  selected: { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.blue },
  recenter: { position: 'absolute', right: 22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(23,33,43,0.12)' },
});
