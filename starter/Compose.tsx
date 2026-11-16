import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { cities, cityById, formatDuration, type CityId, type Pigeon, type Profile } from '../src/domain';
import { codepoints, routeEstimate, validDraft } from './letterModel';
import { matchingFriends } from './presentation';
import type { useDraft } from './useDraft';
import { Button, Field, Loading, Notice, s } from './ui';
import { a, font, Icon, IconButton, PageFrame, PageHeader, palette, PrimaryButton, usePageInsets } from './page03/atoms';

export function Compose({ profile, friends, friendsLoading, pigeon, controller, connected, replying, replyTarget, onBack, onChoosePigeon, onKeep, onReplace, onSend, onSetCity, notice }: {
  notice?: string; profile: Profile; friends: Profile[]; friendsLoading: boolean; pigeon?: Pigeon; controller: ReturnType<typeof useDraft>; connected: boolean;
  replying: boolean; replyTarget: string | null; onBack: () => void; onChoosePigeon: () => void; onKeep: () => void; onReplace: () => void; onSend: () => void;
  onSetCity: (cityId: CityId) => Promise<unknown>;
}) {
  const { draft, locked, busy, receipt } = controller;
  const insets = usePageInsets();
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const [inputHeight, setInputHeight] = useState(64);
  const [city, setCity] = useState<CityId | null>(null);
  const [savingCity, setSavingCity] = useState(false);
  const [cityError, setCityError] = useState('');
  const recipient = friends.find(friend => friend.id === draft?.recipientId);
  const estimate = profile.cityId && recipient?.cityId ? routeEstimate(profile, recipient) : null;
  const matches = matchingFriends(friends, search);
  const canSend = Boolean(draft && (receipt || controller.pendingRetry || (pigeon?.ready && profile.cityId && recipient?.cityId && validDraft(draft) && draft.visibility === 'open' && draft.openAcknowledged)));
  const disabled = locked || busy;

  return <PageFrame><KeyboardAvoidingView style={{ flex: 1, paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <PageHeader title={choosing ? 'Who’s it for?' : 'Send a pigeon'} back={choosing} disabled={busy} onClose={() => choosing ? setChoosing(false) : onBack()} />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[c.content, { paddingBottom: insets.bottom + 12 }]}>
      {notice && <Notice error>{notice}</Notice>}
      {!profile.cityId && !locked ? <>
        <Text style={a.heading}>Where will your pigeon fly from?</Text>
        <Text style={a.body}>Choose your departure city to calculate this letter’s route and travel time. We won’t request your location or choose a city for you.</Text>
        {cities.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={`Depart from ${option.name}`} aria-checked={city === option.id} accessibilityState={{ checked: city === option.id, disabled: savingCity }} disabled={savingCity} onPress={() => setCity(option.id)} style={[s.cityOption, city === option.id && s.selected]}><Text style={a.body}>{option.name} · {option.country}</Text></Pressable>)}
        {cityError && <Notice error>{cityError}</Notice>}
        <PrimaryButton label={savingCity ? 'Saving your city…' : 'Use this departure city'} disabled={!city || savingCity || !connected} onPress={() => { if (!city || savingCity) return; setSavingCity(true); setCityError(''); void onSetCity(city).catch(() => setCityError('Your city could not be saved. Reconnect and try again.')).finally(() => setSavingCity(false)); }} />
      </> : choosing ? <>
        <Field label="Find a friend" placeholder="Search by handle or city" autoCapitalize="none" autoCorrect={false} value={search} onChangeText={setSearch} />
        <Text style={a.small}>Only your accepted friends appear here.</Text>
        {friendsLoading ? <Loading label="Loading accepted friends…" /> : matches.length ? matches.map(friend => <Pressable key={friend.id} accessibilityRole="radio" accessibilityLabel={`Write to @${friend.handle}${friend.cityId ? ` in ${cityById(friend.cityId).name}` : ', city not set'}`} aria-checked={draft?.recipientId === friend.id} accessibilityState={{ checked: draft?.recipientId === friend.id, disabled }} disabled={disabled} onPress={() => { controller.edit({ recipientId: friend.id }); setChoosing(false); setSearch(''); }} style={[s.friend, draft?.recipientId === friend.id && s.selected]}><View style={s.avatar}><Text style={a.body}>{friend.handle.charAt(0).toUpperCase()}</Text></View><View style={s.grow}><Text style={s.flightHandle}>@{friend.handle}</Text><Text style={a.small}>{friend.cityId ? cityById(friend.cityId).name : 'City not set'}</Text></View><Icon name="arrow" /></Pressable>) : <Notice>{friends.length ? 'No friends match that search.' : 'No accepted friends are available yet. Invite your partner from the postbox first.'}</Notice>}
      </> : !draft ? <>
        {controller.error ? <Notice error>{controller.error}</Notice> : <Loading label="Restoring your saved draft…" />}
        <Button label="Retry loading draft" secondary onPress={controller.retryStorage} />
      </> : <>
        {replyTarget && <View style={s.card}><Text style={s.subtitle}>You already have a saved letter.</Text><Text style={s.small}>{locked ? 'Confirm the existing send before starting a reply. Its contents and retry key are protected.' : 'Starting a blank reply will replace your unsent draft.'}</Text>{!locked && <Button label="Replace draft with a blank reply" onPress={onReplace} />}<Button label={locked ? 'Resolve saved send first' : 'Keep my current draft'} secondary onPress={onKeep} /></View>}
        <View style={[a.row, { gap: 12, minHeight: 44 }]}>
          <Text style={c.to}>To</Text>
          {draft.recipientId ? <View style={c.chip}><Pressable accessibilityRole="button" accessibilityLabel="Change recipient" disabled={disabled} onPress={() => setChoosing(true)} style={c.chipName}><Text numberOfLines={1} style={c.recipient}>{recipient?.handle ?? 'Saved recipient'}</Text></Pressable><IconButton name="close" label="Remove recipient" disabled={disabled} onPress={() => controller.edit({ recipientId: '' })} /></View> : <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setChoosing(true)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={c.recipient}>Choose a friend</Text></Pressable>}
          <View style={{ flex: 1 }} /><IconButton name="plus" label="Choose a recipient" disabled={disabled} onPress={() => setChoosing(true)} />
        </View>
        {draft.recipientId && !recipient && <Notice>{draft.pending ? 'This recipient is no longer in your friends. Retry to confirm the original send.' : 'Choose an accepted friend before sending.'}</Notice>}
        {recipient && !recipient.cityId && !locked && <Notice>{recipient.handle} hasn’t chosen a city yet. Ask them to set their departure city in Send a pigeon, or choose another friend. Nothing has been sent.</Notice>}
        <View style={c.postcard}>
          <View style={[a.between, { alignItems: 'flex-start', gap: 10 }]}><View style={{ flex: 1 }}><Text style={c.postalHeading}>A little air mail.</Text><Text style={c.route}>{profile.cityId ? cityById(profile.cityId).name : 'Your city'} → {recipient?.cityId ? cityById(recipient.cityId).name : 'Their city'}</Text></View><View accessibilityLabel="Pigeon Post stamp" style={c.stamp}><View style={c.stampDot} /><Text style={c.stampText}>PIGEON{'\n'}POST</Text></View></View>
          <TextInput accessibilityLabel="Your letter" placeholder="Something small you’d tell them…" placeholderTextColor="#9AA3AE" value={draft.body} onChangeText={body => { if (body.length < draft.body.length) setInputHeight(64); controller.edit({ body }); }} multiline scrollEnabled={false} editable={!disabled} onContentSizeChange={event => setInputHeight(Math.max(64, event.nativeEvent.contentSize.height))} style={[c.letter, { minHeight: inputHeight }]} />
          <Text style={c.signature}>— {draft.anonymous ? 'Anonymous' : profile.handle}</Text>
          <View style={{ flex: 1 }} />
          <View style={a.between}><Text accessibilityLiveRegion="polite" style={c.save}>{controller.saved ? 'Saved on this device' : 'Saving…'}</Text><Text accessibilityLabel={`${codepoints(draft.body)} of 280 characters`} style={[c.save, codepoints(draft.body) > 280 && s.errorText]}>{codepoints(draft.body)} / 280</Text></View>
          <View style={c.postalEdge} />
        </View>
        <View style={[a.between, { minHeight: 44 }]}><Text style={c.label}>Send anonymously</Text><Switch style={Platform.OS === 'web' ? { width: 44, height: 26 } : undefined} accessibilityLabel="Send anonymously" value={Boolean(draft.anonymous)} disabled={disabled} onValueChange={anonymous => controller.edit({ anonymous })} trackColor={{ false: '#DCE3EB', true: palette.blue }} thumbColor="white" /></View>
        {draft.anonymous && <Text style={a.small}>Your profile, pigeon name, and signature are hidden. Cities and your words can still identify you. Anonymous letters can’t receive replies.</Text>}
        {draft.visibility === 'sealed' ? <View style={s.tight}><Notice>{controller.legacySealedDraft ? 'This saved draft is Sealed. New letters use Open Skies; convert it only if you accept public interception.' : 'Your saved Sealed send keeps its original private payload.'}</Notice>{controller.legacySealedDraft && <Button label="Convert this draft to Open Skies" secondary disabled={disabled} onPress={controller.convertLegacyToOpenSkies} />}</View> : <Pressable accessibilityRole="checkbox" accessibilityLabel="I understand this letter can be intercepted and read" aria-checked={draft.openAcknowledged} accessibilityState={{ checked: draft.openAcknowledged, disabled }} disabled={disabled} onPress={() => controller.acknowledgeOpenSkies(!draft.openAcknowledged)} style={c.consent}><View style={[c.checkbox, draft.openAcknowledged && { backgroundColor: palette.blue }]}>{draft.openAcknowledged && <Icon name="check" size={17} color="white" />}</View><Text style={[a.small, { flex: 1 }]}>I understand someone may catch and read this message, preventing delivery.{!draft.anonymous ? ' They can also ask to connect with me.' : ''}</Text></Pressable>}
        {locked && !receipt && <Notice>This letter may already be flying. Retry confirms the exact saved letter without a duplicate.</Notice>}
        {receipt && <Notice>The server accepted your letter. Finish local cleanup without launching again.</Notice>}
        {!locked && !pigeon?.ready && <View style={s.tight}><Notice>{pigeon ? `${pigeon.name} is flying. Choose a ready pigeon.` : 'Choose a ready pigeon from your flock.'}</Notice><Button label="Choose another pigeon" secondary onPress={onChoosePigeon} /></View>}
        {controller.error && <><Notice error>{controller.error}</Notice>{!controller.saved && !receipt && <Button label="Retry saving draft" secondary disabled={busy} onPress={controller.retryStorage} />}</>}
        {!connected && !receipt && <Notice>Reconnect before sending. Your saved letter stays here.</Notice>}
        {replying && <Text style={a.small}>A reply is a new flight, not a return trip for the other person’s pigeon.</Text>}
        <View style={c.footer}>
          <View style={[a.between, { gap: 8 }]}><Text style={[c.label, { flexShrink: 1 }]}>{estimate ? `${profile.demo ? 'Demo arrival' : 'Arrives in'} ~${formatDuration(profile.demo ? estimate.demoSeconds : estimate.normalSeconds)}` : 'Choose a destination'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Change pigeon" disabled={disabled} onPress={onChoosePigeon} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={c.withBird}>{pigeon ? `With ${pigeon.name}` : draft.pending ? 'Saved pigeon' : 'Choose pigeon'}</Text></Pressable></View>
          {profile.demo && estimate && <Text style={a.small}>Demo speed · Normal at 60 km/h: {formatDuration(estimate.normalSeconds)}.</Text>}
          <Text style={a.small}>{draft.visibility === 'open' ? 'Open Skies · This pigeon can be intercepted.' : 'Sealed · Only you and the recipient can read it.'}</Text>
          <PrimaryButton label={busy ? 'Confirming your flight…' : receipt ? 'Finish local cleanup' : draft.pending ? 'Retry the same letter' : `Let ${pigeon?.name ?? 'your pigeon'} fly`} arrow={!busy && !receipt && !draft.pending} disabled={busy || (!connected && !receipt) || !canSend || Boolean(replyTarget)} onPress={onSend} />
        </View>
      </>}
    </ScrollView>
  </KeyboardAvoidingView></PageFrame>;
}

const c = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 14, gap: 16 },
  to: { fontSize: 16, color: palette.muted },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, backgroundColor: palette.pale, maxWidth: '76%' },
  chipName: { minHeight: 44, paddingLeft: 14, justifyContent: 'center', flexShrink: 1 },
  recipient: { fontSize: 15, fontWeight: '600', color: palette.blue },
  postcard: { minHeight: 300, borderWidth: 1, borderColor: '#DEE3E9', borderRadius: 18, padding: 22, gap: 14, backgroundColor: 'white', boxShadow: '0 8px 22px rgba(23,33,43,0.025)' },
  postalHeading: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: palette.blue, marginTop: 6 },
  route: { fontSize: 11, lineHeight: 16, letterSpacing: 1, color: palette.muted, textTransform: 'uppercase', marginTop: 4 },
  stamp: { width: 54, height: 66, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#A6B6DD', backgroundColor: palette.pale, alignItems: 'center', justifyContent: 'center', gap: 4 },
  stampDot: { width: 27, height: 27, borderRadius: 14, backgroundColor: palette.blue },
  stampText: { fontSize: 8, lineHeight: 9, letterSpacing: 0.7, fontWeight: '600', textAlign: 'center', color: palette.blue },
  letter: { fontFamily: font.regular, fontSize: 24, lineHeight: 31, color: palette.ink, minHeight: 64, textAlignVertical: 'top', padding: 0 },
  signature: { fontSize: 14, lineHeight: 20, color: palette.secondary },
  save: { fontSize: 10, lineHeight: 14, color: palette.muted },
  postalEdge: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 4, backgroundColor: palette.blue },
  label: { fontSize: 14, lineHeight: 20, color: palette.secondary },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  checkbox: { width: 24, height: 24, borderWidth: 1.5, borderRadius: 6, borderColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 'auto', gap: 8, paddingTop: 10 },
  withBird: { fontSize: 14, fontWeight: '600', color: '#000' },
});
