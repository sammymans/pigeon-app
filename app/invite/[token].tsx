import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePigeon } from '../../src/client/PigeonProvider';
import { PigeonCharacter } from '../../src/animation/PigeonCharacter';
import { ActionFeedback, Button, Page, Txt, useAction } from '../../src/ui/primitives';
import { colors } from '../../src/ui/theme';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const pigeon = usePigeon();
  const action = useAction();
  return <Page narrow back publicView eyebrow="YOU’VE BEEN INVITED" title="Someone thinks you’re worth the wait." subtitle="A little bird told us you’d make a very good pen pal."><View style={{ backgroundColor: colors.paper, padding: 32, borderRadius: 20, alignItems: 'center', gap: 24 }}><PigeonCharacter size={210} outfit="classic" motion="idle"/><Txt style={{ fontSize: 17, lineHeight: 28, textAlign: 'center' }}>Letters that cross cities. Thoughts that take their time. A friend at the other end.</Txt><Txt style={{ color: colors.muted, fontSize: 12, lineHeight: 21, textAlign: 'center' }}>Accept this invitation to become mutual connections with the person who shared it. It never opens anyone’s inbox or gives access to existing letters.</Txt><ActionFeedback action={action}/>{!pigeon.authenticated || !pigeon.profile ? <Button label="Make a nest to accept" icon="arrow" onPress={() => router.push(`/sign-in?next=invite&token=${encodeURIComponent(token)}`)}/> : <Button label="Accept & become pen pals" icon="heart" disabled={!pigeon.connected || !token} busy={action.busy} onPress={() => action.run(async () => { await pigeon.acceptInvite(token); router.replace('/nest'); })}/>}</View></Page>;
}
