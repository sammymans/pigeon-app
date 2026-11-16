import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { a, Icon, palette } from '../page03/atoms';
import type { FlightMapProps } from './types';

export function FlightMap(_props: FlightMapProps) {
  const [height, setHeight] = useState(300);
  return <View style={styles.fallback} onLayout={event => setHeight(event.nativeEvent.layout.height)}>{height > 230 && <Icon name="phone" size={28} color={palette.muted} />}<Text style={[a.body, styles.text]}>The interactive map lives in the mobile app.</Text>{height > 230 && <Text style={[a.small, styles.text]}>Open on iOS or Android to pan and zoom. Your real flights are still available in the list below.</Text>}</View>;
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.water, padding: 24, gap: 10 },
  text: { textAlign: 'center', maxWidth: 260 },
});
