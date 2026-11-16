import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { registerRootComponent } from 'expo';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Mailbox } from '../../starter/Mailbox';
import { Page03Fonts } from '../../starter/page03/atoms';
import { control, state, subscribe, version } from './transport';

function Fixture() {
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><Page03Fonts><FixtureMailbox /></Page03Fonts></SafeAreaProvider>;
}

function FixtureMailbox() {
  useSyncExternalStore(subscribe, version);
  const [entry, setEntry] = useState<string | undefined>();
  const [initialCompose, setInitialCompose] = useState(new URLSearchParams(location.search).has('initialCompose'));
  useEffect(() => { setInitialCompose(false); }, []);
  control.openFlight = setEntry;
  return <>
    <Text style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', fontSize: 9, letterSpacing: 0.4, color: '#566273', zIndex: 20, pointerEvents: 'none' }}>LOCAL TEST FIXTURE · NO LIVE MESSAGES</Text>
    <Mailbox key={state.profile.id} profile={state.profile} deployment="local-messaging-fixture" connected={state.connected} initialCompose={initialCompose} openFlightId={entry} onOpenFlightHandled={() => { control.handled++; setEntry(undefined); }} onNavigate={() => {}} />
  </>;
}

registerRootComponent(Fixture);
