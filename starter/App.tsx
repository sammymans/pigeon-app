import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ConvexProvider, ConvexReactClient, useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';

const client = new ConvexReactClient('https://helpful-kudu-864.convex.cloud');
const read = makeFunctionReference<'query', Record<string, never>, number>('starterDemo:read');
const increment = makeFunctionReference<'mutation', Record<string, never>, number>('starterDemo:increment');

function Demo() {
  const value = useQuery(read, {});
  const change = useMutation(increment);
  const connection = useConvexConnectionState();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const connected = connection.isWebSocketConnected;

  async function onIncrement() {
    setPending(true);
    setError('');
    try { await change({}); }
    catch { setError('Could not update. Check your connection and try again.'); }
    finally { setPending(false); }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.label}>EXPO + CONVEX</Text>
        <Text style={styles.title}>One shared counter.</Text>
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {connected ? 'Connected to cloud Convex' : 'Connecting to cloud Convex…'}
        </Text>
        {value === undefined ? <ActivityIndicator size="large" /> : <Text accessibilityLiveRegion="polite" style={styles.value}>{value}</Text>}
        <Pressable accessibilityRole="button" disabled={!connected || pending || value === undefined} onPress={onIncrement}
          style={({ pressed }) => [styles.button, (!connected || pending || value === undefined) && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{pending ? 'Updating…' : 'Increment +1'}</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.hint}>Open this demo on a second device. Tap once here and watch both values update.</Text>
        <Text style={styles.note}>Public demo counter only. No account or private app data.</Text>
      </View>
    </View>
  );
}

export default function App() {
  return <ConvexProvider client={client}><Demo /></ConvexProvider>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6fb', padding: 24, paddingTop: 64, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 440, gap: 20, padding: 28, borderRadius: 24, backgroundColor: '#fff' },
  label: { color: '#4155b5', fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  title: { fontSize: 30, fontWeight: '700', color: '#172033' },
  status: { color: '#48566e', fontSize: 15 },
  value: { fontSize: 80, fontWeight: '600', textAlign: 'center', color: '#172033' },
  button: { backgroundColor: '#3149c4', borderRadius: 12, padding: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  hint: { fontSize: 16, lineHeight: 24, color: '#48566e' },
  note: { fontSize: 12, lineHeight: 18, color: '#637089' },
  error: { color: '#b42318', lineHeight: 22 },
});
