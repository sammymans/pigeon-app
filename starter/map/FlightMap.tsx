import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { flightProgress } from '../../src/ui/flightGeometry';
import { a, palette } from '../page03/atoms';
import { fitRegion, flightCoordinate, routeCoordinates, splitAtDateline, worldRegion } from './geometry';
import type { FlightMapProps } from './types';

const calmStyle = [
  { elementType: 'geometry', stylers: [{ color: '#DCE5ED' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#566B80' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#EAF1F7' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#EAF1F7' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F6F8FB' }] },
];

export function FlightMap({ flights, selected, serverNow, scope, fitRequest, onSelect }: FlightMapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const lastFit = useRef({ scope, request: -1, hadFlights: false });
  const routes = useMemo(() => flights.map(flight => ({ id: flight.id, coordinates: routeCoordinates(flight) })), [flights]);
  const configured = Platform.OS !== 'android' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.expoConfig?.extra?.mapsAndroidConfigured === true;

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [ready, attempt]);

  useEffect(() => {
    if (!ready || !size.width || !size.height) return;
    const previous = lastFit.current;
    const requested = previous.request !== fitRequest;
    const changedScope = previous.scope !== scope;
    if (!requested && !changedScope && (previous.hadFlights || !flights.length)) return;
    const targets = requested && selected ? routes.filter(route => route.id === selected) : routes;
    const region = fitRegion(targets.flatMap(route => route.coordinates), size.width, size.height);
    map.current?.animateToRegion(region, 450);
    lastFit.current = { scope, request: fitRequest, hadFlights: flights.length > 0 };
  }, [ready, size, scope, fitRequest, selected, flights.length, routes]);

  if (!configured) return <View style={styles.message}><Text style={a.body}>The Android basemap isn’t configured.</Text><Text style={a.small}>Use the flight list below, or open this build in Expo Go. A standalone Android build needs a restricted Google Maps key.</Text></View>;

  return <View style={styles.container} onLayout={event => setSize(event.nativeEvent.layout)}>
    <MapView
      key={attempt}
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={worldRegion}
      mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      customMapStyle={Platform.OS === 'android' ? calmStyle : undefined}
      userInterfaceStyle="light"
      minZoomLevel={1}
      maxZoomLevel={12}
      cameraZoomRange={{ minCenterCoordinateDistance: 8000, maxCenterCoordinateDistance: 40000000 }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      showsBuildings={false}
      showsTraffic={false}
      showsCompass={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      zoomEnabled
      scrollEnabled
      mapPadding={{ top: 30, left: 12, right: 12, bottom: 38 }}
      legalLabelInsets={{ top: 0, left: 12, right: 12, bottom: 38 }}
      onMapReady={() => { setReady(true); setSlow(false); }}
    >
      {routes.flatMap(route => splitAtDateline(route.coordinates).map((coordinates, index) => <Polyline key={`${route.id}-${index}`} coordinates={coordinates} strokeColor={selected === null || route.id === selected ? palette.blue : '#91A8D2'} strokeWidth={route.id === selected ? 3 : 2} lineDashPattern={[5, 8]} />))}
      {flights.flatMap(flight => flight.id === selected ? [flight.origin, flight.destination].map((city, index) => <Marker key={`${flight.id}-endpoint-${index}`} coordinate={{ latitude: city.lat, longitude: city.lng }} anchor={{ x: 0.5, y: 0.5 }} image={require('./assets/endpoint.png')} tappable={false} />) : [])}
      {serverNow !== null && flights.map(flight => <Marker
        key={flight.id}
        identifier={flight.id}
        coordinate={flightCoordinate(flight, flightProgress(flight, serverNow))}
        anchor={{ x: 0.5, y: 0.5 }}
        image={flight.id === selected ? require('./assets/pigeon-selected.png') : require('./assets/pigeon.png')}
        title={`${flight.courier}: ${flight.origin.name} to ${flight.destination.name}`}
        accessibilityLabel={`Select ${flight.courier}, ${flight.origin.name} to ${flight.destination.name}`}
        zIndex={flight.id === selected ? 2 : 1}
        onPress={event => { event.stopPropagation(); onSelect(flight.id); }}
      />)}
    </MapView>
    {!ready && <View pointerEvents="box-none" style={styles.loading}><View style={styles.loadingCard}><ActivityIndicator color={palette.blue} /><Text style={a.small}>{slow ? 'Basemap taking longer than expected. Check your connection; the flight list still works.' : 'Opening the map…'}</Text>{slow && <Pressable accessibilityRole="button" onPress={() => { setSlow(false); setAttempt(value => value + 1); lastFit.current.request = -1; }} style={styles.retry}><Text style={styles.retryText}>Retry basemap</Text></Pressable>}</View></View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.water },
  message: { flex: 1, padding: 24, justifyContent: 'center', gap: 8, backgroundColor: palette.water },
  loading: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingCard: { padding: 16, borderRadius: 20, gap: 8, backgroundColor: '#FFFFFFEB', maxWidth: 290 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { color: palette.blue, fontWeight: '600' },
});
