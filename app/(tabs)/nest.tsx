import React, { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { shareUrl, usePigeon } from '../../src/client/PigeonProvider';
import { cityById, type CityId, type Outfit } from '../../src/domain';
import { PigeonCharacter } from '../../src/animation/PigeonCharacter';
import { ActionFeedback, AuthGate, Badge, Button, EmptyState, Eyebrow, Icon, Page, Txt, useAction } from '../../src/ui/primitives';
import { Bird } from '../../src/ui/Bird';
import { CityPicker } from '../../src/ui/CityPicker';
import { Postmark } from '../../src/ui/postal';
import { shareLink } from '../../src/ui/sharing';
import { colors } from '../../src/ui/theme';

export default function NestScreen() {
  const pigeon = usePigeon();
  const { width } = useWindowDimensions();
  const [settings, setSettings] = useState(false);
  const [city, setCity] = useState<CityId>('san-francisco');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const action = useAction();
  useEffect(() => { if (pigeon.profile) setCity(pigeon.profile.cityId); }, [pigeon.profile?.cityId]);
  return <Page eyebrow="HOME IS WHERE YOUR BIRD IS" title="A cozy little headquarters." subtitle="Your courier, your corner of the world, your favorite people." right={<Button label="Settings" icon="settings" variant="secondary" small onPress={() => setSettings(!settings)}/>}><AuthGate>
    <View style={{ flexDirection: width > 880 ? 'row' : 'column', gap: 24 }}>
      <View style={{ flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#E9E0CF', borderRadius: 20, padding: 32, alignItems: 'center', gap: 20 }}>
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow>PIGEON PASSPORT</Eyebrow><Badge label={pigeon.profile?.demo ? 'Demo account' : 'Officially yours'} tone="paper"/></View>
        <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 200 }}><PigeonCharacter size={230} outfit={pigeon.profile?.equipped ?? 'classic'} motion="idle"/></View>
        <View style={{ alignItems: 'center', gap: 8 }}><Txt style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.8 }}>@{pigeon.profile?.handle}</Txt><View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name="nest" size={14} color={colors.muted}/><Txt style={{ color: colors.muted, fontSize: 12 }}>{pigeon.profile ? cityById(pigeon.profile.cityId).name : ''}</Txt></View></View>
        <View style={{ height: 1, width: '100%', borderStyle: 'dashed', borderTopWidth: 1, borderColor: '#D9CFB9', marginTop: 8 }}/>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' }}><View style={{ gap: 8 }}><Eyebrow>ON DUTY IN</Eyebrow><Txt style={{ fontSize: 14, fontWeight: '600' }}>{pigeon.profile?.equipped === 'aviator' ? 'Aviator Pack' : 'The original feathers'}</Txt></View><Postmark size={70}/></View>
      </View>
      <View style={{ flex: 1, gap: 24 }}>
        <View style={{ gap: 16, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt style={{ fontSize: 19, fontWeight: '600' }}>The wardrobe</Txt><Eyebrow>{pigeon.owned.length} OWNED</Eyebrow></View><Txt style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>A new look. Same delightfully questionable navigation.</Txt>
          {(['classic', 'aviator'] as Outfit[]).map(outfit => { const owned = pigeon.owned.includes(outfit); const equipped = pigeon.profile?.equipped === outfit; return <View key={outfit} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 }}><Bird size={63} outfit={outfit}/><View style={{ flex: 1, gap: 5 }}><Txt style={{ fontSize: 13, fontWeight: '600' }}>{outfit === 'aviator' ? 'Aviator Pack' : 'Classic pigeon'}</Txt><Txt style={{ fontSize: 10, color: colors.muted }}>{owned ? 'Yours, permanently' : 'Hat + blue contrail'}</Txt></View><Button label={equipped ? 'Equipped' : owned ? 'Equip' : 'Preview'} small variant="secondary" disabled={equipped || (owned && !pigeon.connected)} busy={action.busy} onPress={() => owned ? action.run(() => pigeon.equip(outfit), 'Outfit equipped. Your active birds have a new look, too.') : router.push('/shop')}/></View>; })}
        </View>
        <View style={{ padding: 24, backgroundColor: '#EFF3ED', borderRadius: 20, gap: 16 }}><Icon name="heart" color={colors.green} size={25}/><Txt style={{ fontSize: 20, fontWeight: '600' }}>Good mail needs good company.</Txt><Txt style={{ fontSize: 12, lineHeight: 21, color: colors.muted }}>Invite a friend to your little corner of the sky. When they accept, you can send each other letters.</Txt><Button label="Invite a pen pal" variant="secondary" icon="share" busy={action.busy} disabled={!pigeon.connected} onPress={() => action.run(async () => { const { token } = await pigeon.createInvite(); const url = shareUrl(`/invite/${token}`); setInviteUrl(url); await shareLink(url, `Be my pen pal on Pigeon. — @${pigeon.profile?.handle}`); })}/>{inviteUrl && <Txt selectable style={{ fontSize: 11, color: colors.blue, lineHeight: 18 }}>{inviteUrl}</Txt>}</View>
      </View>
    </View>
    <View style={{ gap: 16, marginTop: 24 }}><ActionFeedback action={action}/>
      {pigeon.connections.filter(connection => connection.state === 'accepted').length > 0 && <View style={{ padding: 24, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 16 }}><Txt style={{ fontSize: 18, fontWeight: '600' }}>Your pen pals</Txt>{pigeon.connections.filter(connection => connection.state === 'accepted').map(connection => <Pressable key={connection.id} onPress={() => router.push(`/request/${connection.id}`)} accessibilityRole="button" accessibilityLabel={`View ${connection.profile.handle}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, minHeight: 44 }}><View style={{ gap: 4 }}><Txt style={{ fontWeight: '600', fontSize: 14 }}>@{connection.profile.handle}</Txt><Txt style={{ fontSize: 11, color: colors.muted }}>{cityById(connection.profile.cityId).name}</Txt></View><Icon name="chevron" size={17} color={colors.muted}/></Pressable>)}</View>}
      {settings && <View style={{ gap: 20, padding: 24, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }}><Txt style={{ fontSize: 21, fontWeight: '600' }}>Nest settings</Txt><CityPicker value={city} onChange={setCity}/><Button label="Save home city" variant="secondary" disabled={!pigeon.connected || city === pigeon.profile?.cityId} busy={action.busy} onPress={() => action.run(() => pigeon.setCity(city), 'Home city updated. Flights already in the sky keep their original route.')}/><Txt style={{ fontSize: 11, lineHeight: 18, color: colors.muted }}>Changing cities affects new letters only. Existing routes and arrival times never move.</Txt>
        {pigeon.profile?.demo && <View style={{ gap: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.line }}><Badge label="Isolated demo controls" tone="paper"/><Txt style={{ fontSize: 12, lineHeight: 20, color: colors.muted }}>Demo birds are labeled and separated from the regular sky. Reset only your authorized demo data.</Txt><Button label="Prepare demo flights" variant="secondary" busy={action.busy} disabled={!pigeon.connected} onPress={() => action.run(() => pigeon.seedDemo(), 'Demo fixtures are ready in the isolated demo sky.')}/><Button label={resetConfirm ? 'Confirm reset of demo data' : 'Reset demo data'} variant="danger" disabled={!pigeon.connected} busy={action.busy} onPress={() => { if (!resetConfirm) setResetConfirm(true); else action.run(async () => { await pigeon.resetDemo(); setResetConfirm(false); }, 'Demo data reset. Normal flights were not changed.'); }}/></View>}
        <Button label="Sign out" icon="logout" variant="ghost" busy={action.busy} onPress={() => action.run(async () => { await pigeon.signOut(); router.replace('/'); })}/>
      </View>}
    </View>
  </AuthGate></Page>;
}
