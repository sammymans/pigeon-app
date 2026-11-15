import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useFlight, usePigeon } from '../src/client/PigeonProvider';
import { OPEN_SKIES_DISCLOSURE, cityById, distanceKm, durationSeconds, formatDuration } from '../src/domain';
import { PigeonCharacter } from '../src/animation/PigeonCharacter';
import { ActionFeedback, AuthGate, Badge, Button, EmptyState, Eyebrow, Icon, Loading, Notice, Page, Txt, useAction, useReducedMotion } from '../src/ui/primitives';
import { canLaunch, freshDraft, readDraft, type Draft } from '../src/ui/draft';
import { Postmark } from '../src/ui/postal';
import { LaunchScene } from '../src/ui/LaunchScene';
import { colors, mono } from '../src/ui/theme';

export default function ComposeScreen() {
  const pigeon = usePigeon();
  const params = useLocalSearchParams<{ recipient?: string; resend?: string }>();
  const resend = useFlight(params.resend);
  const [draft, setDraft] = useState<Draft>(() => freshDraft(randomUUID()));
  const [loaded, setLoaded] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const action = useAction();
  const reduced = useReducedMotion();
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const storageKey = pigeon.profile ? `pigeon:draft:${pigeon.profile.id}` : null;
  const demoFlight = pigeon.profile?.demo ?? false;
  const friends = pigeon.connections.filter(connection => connection.state === 'accepted');
  const recipient = friends.find(connection => connection.profile.id === draft.recipientId)?.profile;
  const distance = pigeon.profile && recipient ? distanceKm(cityById(pigeon.profile.cityId), cityById(recipient.cityId)) : null;
  const activeCount = pigeon.myFlights.filter(flight => flight.state === 'in_flight' && flight.role === 'sender').length;
  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    setLoaded(false);
    setLoadedKey(null);
    setStorageError(null);
    AsyncStorage.getItem(storageKey).then(value => { if (!active) return; const restored = readDraft(value, randomUUID()); if (params.recipient && !restored.body && !restored.submitted) restored.recipientId = params.recipient; setDraft(restored); setLoadedKey(storageKey); setLoaded(true); }).catch(() => { if (active) setStorageError('Your draft could not be restored. Nothing has been overwritten. Retry loading it before writing or sending.'); });
    return () => { active = false; };
  }, [storageKey, params.recipient, loadVersion]);
  useEffect(() => {
    if (!loaded || !params.resend || !resend.flight?.canResend || !resend.flight.body || draftRef.current.body) return;
    const friend = friends.find(connection => connection.profile.handle === resend.flight?.recipientHandle);
    if (friend) setDraft(current => ({ ...current, body: resend.flight!.body!, recipientId: friend.profile.id }));
  }, [loaded, params.resend, resend.flight, pigeon.connections]);
  useEffect(() => {
    if (!loaded || !storageKey || loadedKey !== storageKey || launched) return;
    writeQueue.current = writeQueue.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify(draft)));
    writeQueue.current.then(() => setStorageError(null)).catch(() => setStorageError('Your draft is not saved on this device. Please retry saving before you launch.'));
  }, [draft, loaded, loadedKey, storageKey, launched]);
  function update(change: Partial<Draft>) { if (!draft.submitted) setDraft(current => ({ ...current, ...change })); }
  async function launch() {
    if (!storageKey || !recipient || !canLaunch(draft)) return;
    const submitted = { ...draft, submitted: true };
    setDraft(submitted);
    await writeQueue.current.catch(() => {});
    await AsyncStorage.setItem(storageKey, JSON.stringify(submitted));
    const flight = await pigeon.launch({ recipientId: recipient.id, body: submitted.body.trim(), visibility: submitted.visibility, defense: submitted.defense, openAcknowledged: submitted.openAcknowledged, requestKey: submitted.requestKey, demo: demoFlight });
    setLaunched(true);
    await writeQueue.current.catch(() => {});
    await AsyncStorage.removeItem(storageKey).catch(() => {});
    if (!reduced) await new Promise(resolve => setTimeout(resolve, 700));
    router.replace(`/flight/${flight.id}`);
  }
  return <Page narrow back eyebrow="A LITTLE SOMETHING, SENT SLOWLY" title="Put a thought in flight." subtitle="280 characters. One tiny courier. A real journey."><AuthGate>
    {!loaded || loadedKey !== storageKey ? storageError ? <View style={{ gap: 16 }}><Notice tone="error" text={storageError}/><Button label="Retry loading my draft" variant="secondary" onPress={() => setLoadVersion(value => value + 1)}/></View> : <Loading label="Finding your saved draft…"/> : launched ? <LaunchScene outfit={pigeon.profile?.equipped ?? 'classic'}/> : <View style={{ gap: 28 }}>
      <View style={{ gap: 12 }}><Eyebrow>01 / SOMEONE WORTH WRITING TO</Eyebrow>{friends.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{friends.map(({ profile }) => <Pressable key={profile.id} accessibilityRole="radio" aria-checked={draft.recipientId === profile.id} accessibilityState={{ checked: draft.recipientId === profile.id, disabled: draft.submitted }} disabled={draft.submitted} onPress={() => update({ recipientId: profile.id })} style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: draft.recipientId === profile.id ? '#A3B5FA' : colors.line, backgroundColor: draft.recipientId === profile.id ? colors.lavender : colors.white, minHeight: 48, gap: 4 }}><Txt style={{ fontSize: 13, fontWeight: '600', color: draft.recipientId === profile.id ? colors.blue : colors.ink }}>@{profile.handle}</Txt><Txt style={{ fontSize: 10, color: colors.muted }}>{cityById(profile.cityId).name}</Txt></Pressable>)}</View> : <EmptyState title="Find your pen pal." body="Letters travel between connected friends. Invite someone from your Nest first." action={<Button label="Invite a friend" icon="plus" onPress={() => router.push('/nest')}/>}/>}</View>
      <View style={{ gap: 12 }}><Eyebrow>02 / WHAT’S ON YOUR MIND?</Eyebrow><View style={{ borderRadius: 20, borderWidth: 1, borderColor: '#E6DFD1', padding: 24, backgroundColor: colors.paper, overflow: 'hidden' }}><View pointerEvents="none" style={{ position: 'absolute', right: -5, top: 0, opacity: 0.45 }}><Postmark size={80}/></View><Txt style={{ fontSize: 12, fontFamily: mono, color: '#9B8B70', marginBottom: 16 }}>Dear {recipient ? `@${recipient.handle}` : '________'},</Txt><TextInput accessibilityLabel="Your letter" multiline value={draft.body} onChangeText={body => update({ body })} maxLength={280} editable={!draft.submitted && !action.busy} placeholder="Saw something that reminded me of you…" placeholderTextColor="#AAA99C" textAlignVertical="top" style={{ minHeight: 148, fontSize: 18, lineHeight: 29, color: colors.ink, padding: 0 }}/><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20 }}><Txt style={{ fontSize: 11, color: '#9B8B70' }}>Sent with feeling.</Txt><Txt style={{ fontFamily: mono, fontSize: 11, color: draft.body.length >= 280 ? colors.coral : colors.muted }}>{draft.body.length} / 280</Txt></View></View></View>
      <View style={{ gap: 12 }}><Eyebrow>03 / PICK YOUR KIND OF ADVENTURE</Eyebrow><View style={{ flexDirection: 'row', gap: 12 }}>{([{ value: 'sealed', title: 'Sealed', body: 'Just between you two.', icon: 'lock' }, { value: 'open', title: 'Open Skies', body: 'Leave a little to fate.', icon: 'globe' }] as const).map(option => <Pressable key={option.value} accessibilityRole="radio" aria-checked={draft.visibility === option.value} accessibilityState={{ checked: draft.visibility === option.value, disabled: draft.submitted }} disabled={draft.submitted} onPress={() => update({ visibility: option.value, openAcknowledged: false })} style={{ flex: 1, padding: 18, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: draft.visibility === option.value ? '#9DAFFB' : colors.line, backgroundColor: draft.visibility === option.value ? '#F1F3FF' : colors.white }}><Icon name={option.icon} color={draft.visibility === option.value ? colors.blue : colors.muted}/><Txt style={{ fontSize: 15, fontWeight: '600' }}>{option.title}</Txt><Txt style={{ fontSize: 11, color: colors.muted, lineHeight: 17 }}>{option.body}</Txt></Pressable>)}</View>
        {draft.visibility === 'open' ? <Pressable accessibilityRole="checkbox" accessibilityLabel={OPEN_SKIES_DISCLOSURE} aria-checked={draft.openAcknowledged} accessibilityState={{ checked: draft.openAcknowledged, disabled: draft.submitted }} disabled={draft.submitted} onPress={() => update({ openAcknowledged: !draft.openAcknowledged })} style={{ padding: 16, backgroundColor: '#FFF2EB', borderRadius: 12, gap: 12, flexDirection: 'row', alignItems: 'flex-start' }}><View style={{ height: 22, width: 22, marginTop: 2, borderWidth: 1.5, borderRadius: 6, borderColor: draft.openAcknowledged ? colors.blue : '#C0AFA2', backgroundColor: draft.openAcknowledged ? colors.blue : colors.white, alignItems: 'center', justifyContent: 'center' }}>{draft.openAcknowledged && <Icon name="check" color={colors.white} size={14}/>}</View><View style={{ flex: 1, gap: 6 }}><Txt style={{ fontSize: 12, lineHeight: 19 }}>{OPEN_SKIES_DISCLOSURE}</Txt><Txt style={{ fontSize: 10, fontWeight: '700', color: '#A56547' }}>I understand. Let this letter fly in Open Skies.</Txt></View></Pressable> : <Txt style={{ fontSize: 11, lineHeight: 18, color: colors.muted }}>Only you and your recipient can see this flight. Your recipient can read the letter after it arrives. Sealed describes access rules, not end-to-end encryption.</Txt>}
      </View>
      <View style={{ gap: 12 }}><Eyebrow>04 / FLIGHT STYLE · ALWAYS FREE</Eyebrow><View style={{ flexDirection: 'row', gap: 12 }}>{([{ value: 'cruise', title: 'Cruise', body: 'The scenic, sensible route.', badge: '2 hits to catch' }, { value: 'zigzag', title: 'Zigzag', body: '20% longer. A little sneakier.', badge: '3 hits to catch' }] as const).map(option => <Pressable key={option.value} accessibilityRole="radio" aria-checked={draft.defense === option.value} accessibilityState={{ checked: draft.defense === option.value, disabled: draft.submitted }} disabled={draft.submitted} onPress={() => update({ defense: option.value })} style={{ flex: 1, gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: draft.defense === option.value ? '#9DAFFB' : colors.line, backgroundColor: draft.defense === option.value ? '#F1F3FF' : colors.white }}><Txt style={{ fontSize: 14, fontWeight: '600' }}>{option.title}</Txt><Txt style={{ fontSize: 11, color: colors.muted, lineHeight: 17 }}>{option.body}</Txt><Badge label={draft.visibility === 'sealed' ? 'Sealed · no catching' : option.badge}/></Pressable>)}</View></View>
      {distance !== null && <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}><View style={{ gap: 8 }}><Eyebrow>ESTIMATED FLIGHT TIME</Eyebrow><Txt style={{ fontSize: 32, fontWeight: '600', letterSpacing: -1 }}>{formatDuration(durationSeconds(distance, demoFlight, draft.defense))}</Txt><Txt style={{ fontSize: 11, lineHeight: 18, color: colors.muted }}>{Math.round(distance).toLocaleString()} km · {demoFlight ? 'Accelerated demo time' : distance === 0 ? 'Same-city minimum: two minutes' : 'Pigeon time: 60 km/h'}</Txt></View><PigeonCharacter size={105} outfit={pigeon.profile?.equipped ?? 'classic'} motion="idle"/></View>}
      {demoFlight && <Notice text="Demo speed is on. This flight stays in the isolated demo sky, with a clearly labeled accelerated ETA."/>}
      {activeCount >= 3 && <Notice text="All three of your couriers are out. Let a flight finish before launching another."/>}
      {draft.submitted && <View style={{ gap: 12 }}><Notice text="This letter is queued for a safe retry. Its content and launch key are locked, so trying again can’t create a second pigeon."/><Button label="Edit my retained letter" variant="ghost" disabled={action.busy} onPress={() => setConfirmEdit(!confirmEdit)}/>{confirmEdit && <View style={{ gap: 12 }}><Notice text="A lost connection can hide a successful launch. Check your Sent flights before creating a new attempt. Editing keeps your text but uses a new launch key, so an already-sent letter would not be cancelled."/><Button label="Check my sent flights first" variant="secondary" onPress={() => router.push('/inbox?filter=sent')}/><Button label="I checked — edit as a new attempt" variant="secondary" onPress={() => { setDraft(current => ({ ...current, requestKey: randomUUID(), submitted: false, openAcknowledged: false })); setConfirmEdit(false); action.clear(); }}/></View>}</View>}
      {storageError && <><Notice tone="error" text={storageError}/><Button label="Retry saving draft" variant="secondary" onPress={() => { if (storageKey) action.run(async () => { await AsyncStorage.setItem(storageKey, JSON.stringify(draft)); setStorageError(null); }); }}/></>}
      <ActionFeedback action={action}/>
      <Button label={draft.submitted ? 'Retry this launch' : 'Let it fly'} icon="send" busy={action.busy} disabled={!canLaunch(draft) || !recipient || !pigeon.connected || Boolean(storageError) || (!draft.submitted && activeCount >= 3)} onPress={() => action.run(launch)}/>
      <Txt style={{ textAlign: 'center', fontSize: 10, lineHeight: 17, color: colors.muted }}>Your draft stays on this device until your pigeon takes off.</Txt>
    </View>}
  </AuthGate></Page>;
}
