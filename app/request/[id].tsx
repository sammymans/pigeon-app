import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePigeon } from '../../src/client/PigeonProvider';
import { cityById, CONNECTION_REQUEST } from '../../src/domain';
import { PigeonCharacter } from '../../src/animation/PigeonCharacter';
import { ActionFeedback, AuthGate, Badge, Button, EmptyState, Page, Txt, useAction } from '../../src/ui/primitives';
import { SafetyActions } from '../../src/ui/SafetyActions';
import { colors } from '../../src/ui/theme';

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pigeon = usePigeon();
  const request = pigeon.connections.find(connection => connection.id === id);
  const action = useAction();
  return <Page narrow back eyebrow="AN UNEXPECTED INTRODUCTION" title="The start of a little correspondence."><AuthGate>{!request ? <EmptyState title="This introduction isn’t available." body="It may have been removed or belong to another account. Your inbox has your current requests." action={<Button label="Open my inbox" onPress={() => router.replace('/inbox')}/>}/> : <View style={{ gap: 24 }}><View style={{ backgroundColor: colors.paper, padding: 32, borderRadius: 20, alignItems: 'center', gap: 16 }}><PigeonCharacter size={150} outfit={request.profile.equipped} motion="idle"/><Txt style={{ fontSize: 27, fontWeight: '700' }}>@{request.profile.handle}</Txt><Txt style={{ color: colors.muted, fontSize: 12 }}>{cityById(request.profile.cityId).name}</Txt><Badge label={request.state === 'accepted' ? 'Connected · pen pals' : request.state === 'declined' ? 'Request declined' : request.direction === 'outgoing' ? 'Waiting for their answer' : 'Would like to connect'} tone={request.state === 'accepted' ? 'green' : 'neutral'}/><Txt style={{ fontSize: 19, lineHeight: 29, textAlign: 'center', paddingTop: 8 }}>“{CONNECTION_REQUEST}”</Txt></View>
    <Txt style={{ color: colors.muted, fontSize: 12, lineHeight: 21 }}>Accepting lets you send each other distance-timed letters. This is not an instant-message inbox. No email, phone number, or intended recipient is shared.</Txt><ActionFeedback action={action}/>
    {request.state === 'pending' && request.direction === 'incoming' && <View style={{ gap: 12 }}><Button label="Let’s exchange letters" icon="heart" busy={action.busy} disabled={!pigeon.connected} onPress={() => action.run(() => pigeon.respond(id, 'accept'), 'You’re connected. Your first letter is ready to take flight.')}/><Button label="No, thank you" variant="secondary" busy={action.busy} disabled={!pigeon.connected} onPress={() => action.run(() => pigeon.respond(id, 'decline'), 'Request declined. This introduction cannot be sent again.')}/><Button label="Block this request" variant="ghost" busy={action.busy} disabled={!pigeon.connected} onPress={() => action.run(() => pigeon.respond(id, 'block'), 'Blocked. New interactions are now stopped.')}/></View>}
    {request.state === 'accepted' && <Button label="Write a little hello" icon="send" onPress={() => router.push(`/compose?recipient=${encodeURIComponent(request.profile.id)}`)}/>}
    <SafetyActions profileId={request.profile.id}/>
  </View>}</AuthGate></Page>;
}
