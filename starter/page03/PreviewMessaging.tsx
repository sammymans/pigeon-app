import { useState } from 'react';
import { Text, View } from 'react-native';
import { cityById, type City } from '../../src/domain';
import { groupMailboxes, replyCountdown, type MailLetter, type MailPerson } from '../mailboxModel';
import { a, Copy, palette, PrimaryButton } from './atoms';
import type { FlockBird } from './MapScreen';
import { ComposerSheet, LetterSheet, LetterThread, MailboxGrid, ReadingSheet, RecipientPicker, SendReview } from './Messaging';
import { nearbyPerson, previewPeople, type PreviewLetter } from './previewMail';
import { previewRoute } from './previewRouting';

export type PreviewDraft = { body: string; recipientId: string; pigeonId: string; hideName: boolean; replyId?: string; invitee?: MailPerson };
export const blankPreviewDraft: PreviewDraft = { body: '', recipientId: '', pigeonId: '', hideName: false };

export function PreviewMessaging({ senderName = 'You', origin = cityById('new-york'), treatedBirds = [], replyRequest, letters, birds, draft, now, initialCompose, onDraft, onOpened, onClose, onSend, onShop }: { senderName?: string; origin?: City; treatedBirds?: string[]; replyRequest?: string; letters: PreviewLetter[]; birds: FlockBird[]; draft: PreviewDraft; now: number; initialCompose?: boolean; onDraft: (draft: PreviewDraft) => void; onOpened: (id: string) => void; onClose: () => void; onSend: (person: MailPerson, courier: string, pigeonId?: string) => void; onShop?: () => void }) {
  const contacts = [...new Map([...previewPeople, ...(draft.invitee ? [draft.invitee] : []), nearbyPerson, ...letters.flatMap(letter => letter.person ? [letter.person] : [])].map(person => [person.id, person])).values()];
  const people = groupMailboxes(contacts, letters).filter(person => person.letters.length > 0);
  const [personId, setPersonId] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [step, setStep] = useState<'browse' | 'compose' | 'recipient' | 'review'>(replyRequest ? 'browse' : initialCompose ? draft.replyId ? 'compose' : 'recipient' : 'browse');
  const [replaceReply, setReplaceReply] = useState<MailLetter | null>(() => letters.find(letter => letter.id === replyRequest) ?? null);
  const person = people.find(item => item.id === personId);
  const recipient = contacts.find(item => item.id === draft.recipientId);
  const opened = letters.find(letter => letter.id === reading);
  const reply = letters.find(letter => letter.id === draft.replyId);
  const replyExpired = Boolean(reply?.replyBy && now >= reply.replyBy);
  const edit = (changes: Partial<PreviewDraft>) => onDraft({ ...draft, ...changes });
  const begin = () => { if (!draft.body && !draft.replyId) edit({ recipientId: person?.id ?? '', replyId: undefined }); setStep(draft.replyId ? 'compose' : 'recipient'); };
  function startReply(letter: MailLetter) {
    if (draft.body.trim()) { setReplaceReply(letter); return; }
    onDraft({ ...blankPreviewDraft, recipientId: letter.personId, replyId: letter.id }); setReading(null); setStep('compose');
  }
  function review() {
    if (!draft.pigeonId || birds.find(bird => bird.id === draft.pigeonId)?.status !== 'Ready' || birds.find(bird => bird.id === draft.pigeonId)?.egg) edit({ pigeonId: birds.find(bird => bird.status === 'Ready' && !bird.egg)?.id ?? '' });
    setStep('review');
  }
  const route = recipient ? previewRoute(recipient, origin, letters, draft.replyId, !reply && treatedBirds.includes(draft.pigeonId)) : null;
  if (step === 'recipient') return <RecipientPicker people={contacts.filter(person => person.id !== nearbyPerson.id).sort((a, b) => a.id === 'sammy' ? -1 : b.id === 'sammy' ? 1 : a.name.localeCompare(b.name))} selected={draft.recipientId} onSelect={recipientId => edit({ recipientId, replyId: undefined })} onInvite={invitee => edit({ invitee, recipientId: invitee.id, replyId: undefined })} nearby={nearbyPerson} hideName={draft.hideName} onHideName={hideName => edit({ hideName })} onBack={() => initialCompose ? onClose() : setStep('browse')} onNext={() => { if (recipient) setStep('compose'); }} />;
  if (step === 'review' && recipient && route) return <SendReview person={recipient} sender={`${draft.hideName ? 'Someone' : senderName} · ${route.origin.name}`} birds={birds} selected={draft.pigeonId} estimate={route.estimate} delivery={{ origin: route.origin.name, destination: route.destination.name, distanceKm: route.distanceKm, arrivesAt: now + route.durationMs, demoRoute: route.demoRoute, treated: route.treated }} returning={reply?.courier} onSelect={pigeonId => { if (birds.some(bird => bird.id === pigeonId && bird.status === 'Ready' && !bird.egg)) edit({ pigeonId }); }} onBack={() => setStep('compose')} onShop={onShop} onSend={() => { if (replyExpired || !draft.body.trim() || Array.from(draft.body).length > 500) return; const bird = birds.find(item => item.id === draft.pigeonId); if (!reply && (bird?.status !== 'Ready' || bird.egg)) return; onSend(recipient, reply?.courier ?? bird!.name, reply ? undefined : bird!.id); }} disabled={replyExpired || (!reply && (birds.find(bird => bird.id === draft.pigeonId)?.status !== 'Ready' || Boolean(birds.find(bird => bird.id === draft.pigeonId)?.egg)))} notice={<Copy style={[a.small, { textAlign: 'center' }]}>{replyExpired ? `${reply?.courier} has flown home. This reply can no longer fly.` : 'Every pigeon can be intercepted.'}</Copy>} />;
  const readingPerson = opened ? people.find(item => item.id === opened.personId) : undefined;
  return <>
    {person ? <LetterThread person={person} now={now} onBack={() => setPersonId(null)} onCompose={begin} onOpen={letter => { onOpened(letter.id); setReading(letter.id); }} /> : <MailboxGrid people={people} now={now} onBack={onClose} onCompose={begin} onPerson={selected => setPersonId(selected.id)} />}
    {opened && readingPerson && step === 'browse' && !replaceReply && <ReadingSheet person={readingPerson} letter={opened} body={opened.body} signature={opened.signature ?? (opened.direction === 'outgoing' ? senderName : undefined)} now={now} onClose={() => { setReading(null); setReplaceReply(null); }} onReply={opened.direction === 'incoming' ? () => startReply(opened) : undefined} />}
    {replaceReply && <LetterSheet title="You have a saved letter" subtitle="Your draft is still here" onClose={() => setReplaceReply(null)} action="Replace with a blank reply" onAction={() => { onDraft({ ...blankPreviewDraft, recipientId: replaceReply.personId, replyId: replaceReply.id }); setReplaceReply(null); setReading(null); setStep('compose'); }}><Copy style={{ marginBottom: 24 }}>Close to keep your draft, or start a blank reply instead.</Copy><Text style={{ fontSize: 20, lineHeight: 30 }}>{draft.body}</Text></LetterSheet>}
    {step === 'compose' && <ComposerSheet person={recipient} replying={Boolean(reply)} body={draft.body} signature={draft.hideName ? 'Someone' : senderName} saved onChange={body => edit({ body })} onClose={() => setStep('browse')} onNext={() => { if (recipient) review(); else setStep('recipient'); }} onRecipient={!reply ? () => setStep('recipient') : undefined} notice={replyExpired ? <View style={{ gap: 12, marginBottom: 24 }}><Copy>This pigeon flew home. Send with yours instead.</Copy><PrimaryButton compact label="Send as a new letter" onPress={() => edit({ replyId: undefined })} /></View> : undefined} footer={reply?.replyBy ? <Copy style={a.small}>{replyExpired ? `${reply.courier} has flown home` : <>{reply.courier} flies home in <Text style={{ color: palette.blue, fontWeight: '600' }}>{replyCountdown(reply.replyBy, now)}</Text></>}</Copy> : undefined} />}
  </>;
}
