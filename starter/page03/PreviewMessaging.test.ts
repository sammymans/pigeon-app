import { createElement, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewMessaging, blankPreviewDraft, type PreviewDraft } from './PreviewMessaging';
import { sampleLetters } from './previewMail';
import { sampleFlock } from './previewData';

vi.mock('react-native', () => ({ Text: 'text', View: 'view' }));
vi.mock('./atoms', () => ({ a: {}, Copy: 'copy', PrimaryButton: 'button', palette: { blue: 'blue' } }));
vi.mock('./Messaging', () => ({ ComposerSheet: 'composer', LetterSheet: 'conflict', LetterThread: 'thread', MailboxGrid: 'grid', ReadingSheet: 'reader', RecipientPicker: 'recipients', SendReview: 'review' }));
let renderer: ReactTestRenderer;
const send = vi.fn();
const now = 1_800_000_000_000;
const node = (type: string) => renderer.root.findByType(type as never);
function Harness({ at = now, initial = blankPreviewDraft }: { at?: number; initial?: PreviewDraft }) {
  const [draft, setDraft] = useState(initial);
  const [letters, setLetters] = useState(() => sampleLetters(now));
  return createElement(PreviewMessaging, { letters, birds: sampleFlock, draft, now: at, onDraft: setDraft, onOpened: id => setLetters(previous => previous.map(letter => letter.id === id ? { ...letter, opened: true } : letter)), onClose: vi.fn(), onSend: send });
}
async function render(initial?: PreviewDraft) { await act(async () => { renderer = create(createElement(Harness, { initial })); }); }
async function open(name: string) {
  await act(async () => node('grid').props.onPerson(node('grid').props.people.find((person: { name: string }) => person.name === name)));
  const letter = node('thread').props.person.letters.find((item: { opened: boolean }) => !item.opened);
  await act(async () => node('thread').props.onOpen(letter));
}
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); send.mockClear(); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

describe('mailbox navigation and replies', () => {
  it('opens one letter and returns to the same thread with the unread badge cleared', async () => {
    await render(); await open('Sammy');
    expect(node('reader').props.body).toContain('croissant');
    expect(node('thread').props.person.unopened).toBe(0);
    await act(async () => node('reader').props.onClose());
    expect(node('thread').props.person.name).toBe('Sammy');
    expect(renderer.root.findAllByType('reader' as never)).toHaveLength(0);
  });
  it('keeps a composed draft when closing and reopening its sheet', async () => {
    await render(); await act(async () => node('grid').props.onCompose());
    await act(async () => node('recipients').props.onSelect('sammy'));
    await act(async () => node('recipients').props.onNext());
    await act(async () => node('composer').props.onChange('Meet me for coffee?'));
    await act(async () => node('composer').props.onClose());
    await act(async () => node('grid').props.onCompose());
    expect(node('recipients').props.selected).toBe('sammy');
    await act(async () => node('recipients').props.onNext());
    expect(node('composer').props.body).toBe('Meet me for coffee?');
  });
  it('requires explicit replacement before a reply can overwrite a saved draft', async () => {
    await render({ ...blankPreviewDraft, body: 'Keep these words', recipientId: 'dad' }); await open('Sammy');
    await act(async () => node('reader').props.onReply());
    expect(node('conflict').props.action).toBe('Replace with a blank reply');
    await act(async () => node('conflict').props.onClose());
    await act(async () => node('reader').props.onReply());
    await act(async () => node('conflict').props.onAction());
    expect(node('composer').props.body).toBe('');
    expect(node('composer').props.person.name).toBe('Sammy');
  });
  it('rechecks the caught-letter deadline on the final send screen', async () => {
    await render(); await open('Alex');
    await act(async () => node('reader').props.onReply());
    await act(async () => node('composer').props.onChange('Hello from New York!'));
    await act(async () => node('composer').props.onNext());
    expect(node('review').props.returning).toBe('Dot');
    await act(async () => renderer.update(createElement(Harness, { at: now + 30 * 60_000 })));
    expect(node('review').props.disabled).toBe(true);
    await act(async () => node('review').props.onSend());
    expect(send).not.toHaveBeenCalled();
  });
});
