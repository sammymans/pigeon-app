import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

function Foundation() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>YCCMH</Text>
      <Text>Ready to build your iOS app.</Text>
      <Text style={styles.status}>
        {convex ? 'Convex endpoint configured' : 'Convex endpoint not configured'}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return convex ? (
    <ConvexProvider client={convex}><Foundation /></ConvexProvider>
  ) : <Foundation />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 32, fontWeight: '600' },
  status: { color: '#666' },
});
