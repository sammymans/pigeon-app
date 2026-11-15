import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePigeon } from '../src/client/PigeonProvider';
import type { CityId } from '../src/domain';
import { PigeonCharacter } from '../src/animation/PigeonCharacter';
import { CityPicker } from '../src/ui/CityPicker';
import { ActionFeedback, Button, Field, Page, Txt, useAction } from '../src/ui/primitives';
import { Postmark, Segments } from '../src/ui/postal';
import { colors } from '../src/ui/theme';

export default function SignInScreen() {
  const pigeon = usePigeon();
  const { next, token } = useLocalSearchParams<{ next?: string; token?: string }>();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [cityId, setCityId] = useState<CityId>('san-francisco');
  const action = useAction();
  const ready = pigeon.authenticated && pigeon.profile;
  const onboarding = pigeon.authenticated && !pigeon.profile;
  function continueHome() {
    if (next === 'compose') router.replace('/compose');
    else if (next === 'invite' && token) router.replace(`/invite/${encodeURIComponent(token)}`);
    else router.replace('/');
  }
  return <Page narrow back eyebrow="YOUR VERY OWN POST OFFICE" title={ready ? 'Welcome to the flock.' : onboarding ? 'Give your pigeon a home.' : 'Good letters start here.'} subtitle="A handle, a home city, and someone worth writing to.">
    <View style={{ backgroundColor: colors.paper, borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}><View style={{ flex: 1, gap: 8 }}><Txt style={{ fontSize: 20, fontWeight: '600' }}>A tiny bird. A big hello.</Txt><Txt style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>No feeds. No read receipts.{'\n'}Just a thought with somewhere to go.</Txt></View><PigeonCharacter size={120} outfit="classic" motion="idle"/></View>
    {!pigeon.authenticated && <View style={{ gap: 12, marginBottom: 28 }}><Button label="Try the isolated demo" icon="sky" busy={action.busy} disabled={!pigeon.configured || !pigeon.connected || pigeon.loading} onPress={() => action.run(async () => { await pigeon.startDemo(); router.replace('/'); })}/><Txt style={{ textAlign: 'center', fontSize: 11, lineHeight: 18, color: colors.muted }}>A real temporary account, sample pen pals, and accelerated flights. No password needed. No pretend purchases.</Txt><ActionFeedback action={action}/><View style={{ height: 1, backgroundColor: colors.line, marginTop: 12 }}/><Txt style={{ textAlign: 'center', fontSize: 11, color: colors.muted }}>Or make a permanent home below.</Txt></View>}
    <View style={{ gap: 20 }}>
      {ready ? <><Txt style={{ lineHeight: 24 }}>You’re signed in as @{pigeon.profile?.handle}. Your nest is ready.</Txt><Button label="Back to the sky" icon="arrow" onPress={continueHome}/></> : <>
        {!onboarding && <><Segments items={[{ value: 'signup', label: 'Make a nest' }, { value: 'signin', label: 'Welcome back' }]} value={mode} onChange={setMode}/><Field label="Email" value={email} onChangeText={setEmail} placeholder="you@somewhere.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!action.busy}/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} editable={!action.busy}/></>}
        {(onboarding || mode === 'signup') && <><Field label="Your handle" value={handle} onChangeText={text => setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={24} placeholder="earlybird" autoCapitalize="none" hint="3–24 letters, numbers, or underscores. Friends will know you by this." editable={!action.busy}/><CityPicker value={cityId} onChange={setCityId} disabled={action.busy}/></>}
        <ActionFeedback action={action}/>
        <Button label={onboarding ? 'Open my nest' : mode === 'signup' ? 'Create my account' : 'Sign in'} icon="arrow" busy={action.busy} disabled={!pigeon.configured || !pigeon.connected || (onboarding ? handle.length < 3 : !email.trim() || password.length < 8 || (mode === 'signup' && handle.length < 3))} onPress={() => action.run(async () => {
          if (onboarding) { await pigeon.saveProfile({ handle, cityId }); continueHome(); }
          else { await pigeon.signIn({ email: email.trim(), password, signUp: mode === 'signup' }); setPassword(''); }
        })}/>
        <Txt style={{ color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' }}>Letters are Sealed by default. Sharing a letter with Open Skies is always your choice.</Txt>
      </>}
    </View>
  </Page>;
}
