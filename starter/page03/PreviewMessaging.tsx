import { useState } from 'react';
import { Text, View } from 'react-native';
import { cityById } from '../../src/domain';
import { groupMailboxes, replyCountdown, type MailLetter, type MailPerson } from '../mailboxModel';
import { a, Copy, palette, PrimaryButton } from './atoms';
import type { FlockBird } from './MapScreen';
import { ComposerSheet, LetterSheet, LetterThread, MailboxGrid, ReadingSheet, RecipientPicker, SendReview } from './Messaging';
import { nearbyPerson, previewPeople, type PreviewLetter } from './previewMail';

export type PreviewDraft = { body: string; recipientId: string; pigeonId: string; hideName: boolean; replyId?: string };
export const blankPreviewDraft: PreviewDraft = { body: '', recipientId: '', pigeonId: '', hideName: false };

export function PreviewMessaging({ senderName = 'You', letters, birds, draft, now, initialCompose, onDraft, onOpened, onClose, onSend }: { senderName?: string; letters: PreviewLetter[]; birds: FlockBird[]; draft: PreviewDraft; now: number; initialCompose?: boolean; onDraft: (draft: PreviewDraft) => void; onOpened: (id: string) => void; onClose: () => void; onSend: (person: MailPerson, courier: string, pigeonId?: string) => void }) {
  const people = groupMailboxes([...previewPeople, ...(letters.some(letter => letter.personId === 'nearby') ? [nearbyPerson] : [])], letters);
  const [personId, setPersonId] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [step, setStep] = useState<'browse' | 'compose' | 'recipient' | 'review'>(initialCompose ? 'compose' : 'browse');
  const [replaceReply, setReplaceReply] = useState<MailLetter | null>(null);
  const person = people.find(item => item.id === personId);
  const recipient = [...previewPeople, nearbyPerson].find(item => item.id === draft.recipientId);
  const opened = letters.find(letter => letter.id === reading);
  const reply = letters.find(letter => letter.id === draft.replyId);
  const replyExpired = Boolean(reply?.replyBy && now >= reply.replyBy);
  const edit = (changes: Partial<PreviewDraft>) => onDraft({ ...draft, ...changes });
  const begin = () => { if (!draft.body) edit({ recipientId: person?.id ?? '', replyId: undefined }); setStep('compose'); };
  function startReply(letter: MailLetter) {
    if (draft.body.trim()) { setReplaceReply(letter); return; }
    onDraft({ ...blankPreviewDraft, recipientId: letter.personId, replyId: letter.id }); setReading(null); setStep('compose');
  }
  function review() {
    if (!draft.pigeonId || birds.find(bird => bird.id === draft.pigeonId)?.status !== 'Ready') edit({ pigeonId: birds.find(bird => bird.status === 'Ready')?.id ?? '' });
    setStep('review');
  }
  if (step === 'recipient') return <RecipientPicker people={previewPeople} selected={draft.recipientId} onSelect={recipientId => edit({ recipientId })} nearby={nearbyPerson} hideName={draft.hideName} onHideName={hideName => edit({ hideName })} onBack={() => setStep('compose')} onNext={review} />;
  if (step === 'review' && recipient) return <SendReview person={recipient} sender={`${draft.hideName ? 'Someone' : senderName} · New York`} birds={birds} selected={draft.pigeonId} estimate={recipient.city === 'New York' ? '~2 min' : '~2d 22h'} returning={reply?.courier} onSelect={pigeonId => edit({ pigeonId })} onBack={() => setStep(reply ? 'compose' : 'recipient')} onSend={() => { if (replyExpired) return; const bird = birds.find(item => item.id === draft.pigeonId); if (!reply && bird?.status !== 'Ready') return; onSend(recipient, reply?.courier ?? bird!.name, reply ? undefined : bird!.id); }} disabled={replyExpired || (!reply && birds.find(bird => bird.id === draft.pigeonId)?.status !== 'Ready')} notice={<Copy style={[a.small, { textAlign: 'center' }]}>{replyExpired ? `${reply?.courier} has flown home. This reply can no longer fly.` : 'Every pigeon can be intercepted.\nDesign preview · no real letter will be sent.'}</Copy>} />;
  const readingPerson = opened ? people.find(item => item.id === opened.personId) : undefined;
  return <>
    {person ? <LetterThread person={person} now={now} onBack={() => setPersonId(null)} onCompose={begin} onOpen={letter => { onOpened(letter.id); setReading(letter.id); }} /> : <MailboxGrid people={people} now={now} onBack={onClose} onCompose={begin} onPerson={selected => setPersonId(selected.id)} />}
    {opened && readingPerson && step === 'browse' && !replaceReply && <ReadingSheet person={readingPerson} letter={opened} body={opened.body} signature={opened.signature ?? (opened.direction === 'outgoing' ? senderName : undefined)} now={now} onClose={() => { setReading(null); setReplaceReply(null); }} onReply={opened.direction === 'incoming' ? () => startReply(opened) : undefined} />}
    {replaceReply && <LetterSheet title="You have a saved letter" subtitle="Your draft is still here" onClose={() => setReplaceReply(null)} action="Replace with a blank reply" onAction={() => { onDraft({ ...blankPreviewDraft, recipientId: replaceReply.personId, replyId: replaceReply.id }); setReplaceReply(null); setReading(null); setStep('compose'); }}><Copy style={{ marginBottom: 24 }}>Close to keep your draft, or start a blank reply instead.</Copy><Text style={{ fontSize: 20, lineHeight: 30 }}>{draft.body}</Text></LetterSheet>}
    {step === 'compose' && <ComposerSheet person={recipient} replying={Boolean(reply)} body={draft.body} signature={draft.hideName ? 'Someone' : senderName} saved onChange={body => edit({ body })} onClose={() => setStep('browse')} onNext={() => reply ? review() : setStep('recipient')} notice={replyExpired ? <View style={{ gap: 12, marginBottom: 24 }}><Copy>This pigeon has flown home. You can keep your words and send them with one of your own pigeons.</Copy><PrimaryButton compact label="Send as a new letter" onPress={() => edit({ replyId: undefined })} /></View> : undefined} footer={reply?.replyBy ? <Copy style={a.small}>{replyExpired ? `${reply.courier} has flown home` : <>{reply.courier} flies home in <Text style={{ color: palette.blue, fontWeight: '600' }}>{replyCountdown(reply.replyBy, now)}</Text></>}</Copy> : undefined} />}
  </>;
}

export function previewDestination(person: MailPerson) {
  const cities: Record<string, string> = { London: 'london', Chicago: 'chicago', Paris: 'paris', Berlin: 'berlin', 'San Francisco': 'san-francisco' };
  return cityById(cities[person.city] ?? 'new-york');
}
