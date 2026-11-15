import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePigeon } from '../../src/client/PigeonProvider';
import { CONNECTION_REQUEST, cityById } from '../../src/domain';
import { AuthGate, Badge, Button, EmptyState, Icon, Page, Txt } from '../../src/ui/primitives';
import { FlightCard, Segments } from '../../src/ui/postal';
import { colors } from '../../src/ui/theme';

export default function InboxScreen() {
  const pigeon = usePigeon();
  const { filter: initialFilter } = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<'incoming' | 'sent' | 'requests'>('incoming');
  useEffect(() => { if (initialFilter === 'sent' || initialFilter === 'requests' || initialFilter === 'incoming') setFilter(initialFilter); }, [initialFilter]);
  const requests = pigeon.connections.filter(connection => connection.state === 'pending');
  const flights = pigeon.myFlights.filter(flight => filter === 'sent' ? flight.role === 'sender' : flight.role === 'recipient' || flight.role === 'catcher').sort((a, b) => b.departedAt - a.departedAt);
  return <Page eyebrow="LETTERS, NOT NOTIFICATIONS" title="You’ve got a little mail." subtitle="Some thoughts are still crossing oceans. Good things are worth the wait."><AuthGate>
    <View style={{ gap: 24 }}><Segments items={[{ label: 'Incoming', value: 'incoming' }, { label: 'Sent', value: 'sent' }, { label: 'Requests', value: 'requests', count: requests.filter(request => request.direction === 'incoming').length }]} value={filter} onChange={setFilter}/>
      {filter === 'requests' ? requests.length ? <View style={{ gap: 12 }}>{requests.map(request => <Pressable key={request.id} accessibilityRole="button" accessibilityLabel={`Connection request ${request.direction === 'incoming' ? 'from' : 'to'} ${request.profile.handle}`} onPress={() => router.push(`/request/${request.id}`)} style={{ padding: 24, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#E7DFCF', borderRadius: 20, gap: 12 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><Txt style={{ fontSize: 17, fontWeight: '600' }}>@{request.profile.handle}</Txt><Badge label={request.direction === 'incoming' ? 'Wants to connect' : 'Request sent'} tone={request.direction === 'incoming' ? 'blue' : 'neutral'}/></View><Txt style={{ fontSize: 13, lineHeight: 21, color: colors.muted }}>{CONNECTION_REQUEST}</Txt><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Txt style={{ fontSize: 11, color: colors.muted }}>{cityById(request.profile.cityId).name}</Txt><Icon name="arrow" size={17} color={colors.blue}/></View></Pressable>)}</View> : <EmptyState title="No introductions just yet." body="Sometimes a wrong turn leads to the right pen pal. Connection requests from caught pigeons land here." icon="heart"/>
        : flights.length ? <View style={{ gap: 12 }}>{flights.map(flight => <FlightCard key={flight.id} flight={flight} now={pigeon.serverNow}/>)}</View> : <EmptyState title={filter === 'sent' ? 'Your first hello is waiting.' : 'An empty inbox. A quiet kind of nice.'} body={filter === 'sent' ? 'Send a thought on a journey. You can follow every little wingbeat from here.' : 'Your incoming and caught letters will land here. Until then, put something good in the sky.'} action={<Button label="Send a pigeon" icon="send" onPress={() => router.push('/compose')}/>}/>}
    </View>
  </AuthGate></Page>;
}
