import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cityById, formatDuration, OPEN_SKIES_DISCLOSURE, type Profile } from '../src/domain';
import { codepoints, routeEstimate, validDraft } from './letterModel';
import { personName, type MailPerson } from './mailboxModel';
import type { useDraft } from './useDraft';
import { Button, Loading, Notice, s } from './ui';
import { FriendInvites, HomeCity } from './MailSetup';
import { a, Copy, Icon, palette } from './page03/atoms';
import type { FlockBird } from './page03/MapScreen';
import { ComposerSheet, RecipientPicker, SendReview } from './page03/Messaging';

type Controller = ReturnType<typeof useDraft>;
export function ConnectedComposer({ profile, friends, birds, controller, connected, replying, replyTarget, onClose, onKeep, onReplace, onSend, onShop }: { profile: Profile; friends: Profile[]; birds: FlockBird[]; controller: Controller; connected: boolean; replying: boolean; replyTarget: string | null; onClose: () => void; onKeep: () => void; onReplace: () => void; onSend: () => void; onShop?: () => void }) {
  const { draft, busy, locked, receipt } = controller;
  const [step, setStep] = useState<'write' | 'recipient' | 'review'>(locked ? 'review' : replying ? 'write' : 'recipient');
  useEffect(() => { if (locked) setStep('review'); }, [locked]);
  const people: MailPerson[] = friends.map(friend => ({ id: friend.id, recipientId: friend.id, name: personName(friend), city: friend.cityId ? cityById(friend.cityId).name : 'City not chosen' }));
  const recipient = friends.find(friend => friend.id === draft?.recipientId);
  const person = people.find(friend => friend.id === draft?.recipientId);
  const estimate = recipient?.cityId && profile.cityId ? routeEstimate(profile, recipient) : null;
  const selectedBird = birds.find(bird => bird.id === draft?.pigeonId);
  const canSend = Boolean(draft && (receipt || controller.pendingRetry || (recipient?.cityId && profile.cityId && validDraft(draft) && draft.visibility === 'open' && draft.openAcknowledged && selectedBird?.status === 'Ready')));
  const close = () => { if (!busy) onClose(); };
  const error = controller.error ? <Notice error>{controller.error}</Notice> : null;
  const conflict = replyTarget ? <View style={{ gap: 12, marginBottom: 24 }}><Text style={s.subtitle}>You have a saved letter.</Text><Copy>{locked ? 'Confirm your saved send before starting this reply.' : 'Keep your draft, or replace it with a blank reply.'}</Copy>{!locked && <Button label="Replace with a blank reply" onPress={onReplace} />}<Button label={locked ? 'Resolve saved send' : 'Keep my draft'} secondary onPress={onKeep} /></View> : null;
  function review() {
    if (!locked && (!draft?.pigeonId || birds.find(bird => bird.id === draft.pigeonId)?.status !== 'Ready')) controller.edit({ pigeonId: birds.find(bird => bird.status === 'Ready')?.id });
    setStep('review');
  }
  if (!draft) return <ComposerSheet body="" signature={personName(profile)} saved={false} onChange={() => {}} onClose={close} onNext={() => {}} notice={<View style={{ gap: 16 }}>{error ?? <Loading label="Restoring your saved draft…" />}<Button label="Retry loading draft" onPress={controller.retryStorage} /></View>} />;
  if (step === 'recipient') return <RecipientPicker people={people} selected={draft.recipientId} onSelect={recipientId => controller.edit({ recipientId })} onBack={close} onNext={() => { if (person) setStep('write'); }} notice={<View style={{ gap: 16 }}>{!profile.cityId && <HomeCity connected={connected} disabled={locked || busy} />}{!profile.demo && <FriendInvites connected={connected} />}</View>} />;
  if (step === 'review') return <SendReview onSave={close} person={person ?? { id: draft.recipientId, name: 'Your pen pal', city: 'Saved destination' }} sender={`${personName(profile)}${profile.cityId ? ` · ${cityById(profile.cityId).name}` : ''}`} birds={birds} selected={draft.pigeonId ?? ''} estimate={estimate ? `~${formatDuration(profile.demo ? estimate.demoSeconds : estimate.normalSeconds)}${profile.demo ? ' · demo speed' : ''}` : 'calculated at launch'} onSelect={pigeonId => { if (!locked && !busy) controller.edit({ pigeonId }); }} onBack={() => { if (!busy) setStep('write'); }} onSend={onSend} onShop={locked || busy ? undefined : onShop} disabled={busy || (!connected && !receipt) || !canSend || Boolean(replyTarget)} action={busy ? 'Confirming your flight…' : receipt ? 'Finish local cleanup' : draft.pending ? 'Retry the same letter' : undefined} details={<View style={{ gap: 14 }}>
    {conflict}{!profile.cityId && <HomeCity connected={connected} disabled={locked || busy} />}{!recipient?.cityId && !locked && <Notice>Choose a friend with a home city before sending.</Notice>}
    {draft.visibility === 'sealed' ? <><Notice>{controller.legacySealedDraft ? 'This saved draft was written as Sealed. Convert it to Open Skies to start a new flight.' : 'Your original Sealed send is saved exactly for retry.'}</Notice>{controller.legacySealedDraft && <Button label="Convert this draft to Open Skies" secondary onPress={controller.convertLegacyToOpenSkies} />}</> : <View style={{ gap: 10 }}><Copy style={{ lineHeight: 21 }}>{OPEN_SKIES_DISCLOSURE}</Copy>{!locked && <Pressable accessibilityRole="checkbox" accessibilityLabel="I understand this letter can be intercepted and read" accessibilityState={{ checked: draft.openAcknowledged, disabled: busy }} disabled={busy} onPress={() => controller.acknowledgeOpenSkies(!draft.openAcknowledged)} style={[a.row, { minHeight: 48, gap: 12 }]}><View style={{ width: 24, height: 24, borderWidth: 1.5, borderColor: palette.blue, borderRadius: 6, backgroundColor: draft.openAcknowledged ? palette.blue : 'white', alignItems: 'center', justifyContent: 'center' }}>{draft.openAcknowledged && <Icon name="check" size={16} color="white" />}</View><Copy style={{ flex: 1, lineHeight: 20 }}>I understand this letter can be intercepted and read.</Copy></Pressable>}</View>}
    {locked && !receipt && <Notice>Your letter may already be flying. Retry confirms the same letter without sending a duplicate.</Notice>}{receipt && <Notice>The server accepted your letter. Finish saving locally to open its flight.</Notice>}{error}{controller.error && !controller.saved && !receipt && <Button label="Retry saving draft" secondary onPress={controller.retryStorage} />}{!connected && <Notice>Reconnect to send your letter.</Notice>}
  </View>} />;
  return <ComposerSheet person={person} replying={replying} body={draft.body} signature={personName(profile)} saved={controller.saved} locked={locked || busy} onChange={body => controller.edit({ body })} onClose={close} onRecipient={!replying && !locked && !busy ? () => setStep('recipient') : undefined} onNext={() => { if (busy || replyTarget) return; if (locked || recipient) review(); else setStep('recipient'); }} notice={<>{conflict}{error}{codepoints(draft.body) > 500 && <Notice error>Keep your letter to 500 characters.</Notice>}</>} />;
}
