import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LetterApp } from './LetterApp';
import { Notice, Wordmark, s } from './ui';
import { PaperPigeon } from './PaperPigeon';

const deployment = process.env.EXPO_PUBLIC_CONVEX_URL?.trim();
const client = deployment && /^https?:\/\//.test(deployment) ? new ConvexReactClient(deployment, { unsavedChangesWarning: false }) : null;
const secureStorage = { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync };

export default function App() {
  return <SafeAreaProvider>{client && deployment ? <ConvexAuthProvider client={client} storage={Platform.OS === 'web' ? undefined : secureStorage} shouldHandleCode={false}><LetterApp deployment={deployment} /></ConvexAuthProvider> : <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.scroll}><View style={s.page}><Wordmark /><View style={s.illustration}><PaperPigeon size={140} /></View><Text style={s.title}>The post office isn’t connected yet.</Text><Notice>Set EXPO_PUBLIC_CONVEX_URL to your approved isolated backend and restart Expo. No account has been created and no letter has been sent.</Notice><Text style={s.small}>This starter has no default live backend.</Text></View></ScrollView></SafeAreaView>}</SafeAreaProvider>;
}
