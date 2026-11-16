import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LetterApp } from './LetterApp';
import { Page03Fonts } from './page03/atoms';
import { PhoneOnboarding } from './Onboarding';

const deployment = process.env.EXPO_PUBLIC_CONVEX_URL?.trim();
const client = deployment && /^https?:\/\//.test(deployment) ? new ConvexReactClient(deployment, { unsavedChangesWarning: false }) : null;
const secureStorage = { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync };

export default function App() {
  return <SafeAreaProvider><Page03Fonts>{client && deployment ? <ConvexAuthProvider client={client} storage={Platform.OS === 'web' ? undefined : secureStorage} shouldHandleCode={false}><LetterApp deployment={deployment} /></ConvexAuthProvider> : <PhoneOnboarding unavailable sendCode={async () => { throw new Error('Not configured'); }} verifyCode={async () => { throw new Error('Not configured'); }} />}</Page03Fonts></SafeAreaProvider>;
}
