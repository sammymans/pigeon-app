import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PigeonProvider } from '../src/client/PigeonProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PigeonProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFF8E8' } }} />
      </PigeonProvider>
    </SafeAreaProvider>
  );
}
