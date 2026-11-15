import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConvexError } from 'convex/values';
import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { editReturnDraft, prepareReturn, restoreReturnDraft, returnDraftKey, type ReturnDraft } from './returnDraft';
import type { ReturnInput, ReturnReceipt } from './types';

export function useReturnDraft(deployment: string, profileId: string, flightId: string) {
  const key = returnDraftKey(deployment, profileId, flightId);
  const [draft, setDraft] = useState<ReturnDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<ReturnDraft | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const sending = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then((raw) => {
      const restored = restoreReturnDraft(raw, flightId);
      if (active) { current.current = restored; setDraft(restored); setSaved(true); }
    }).catch(() => { if (active) setError('Your saved draft could not be loaded. Close and reopen to retry; nothing was overwritten.'); });
    return () => { active = false; };
  }, [key, flightId]);

  function persist(next: ReturnDraft) {
    current.current = next;
    setDraft(next);
    setSaved(false);
    const sequence = ++revision.current;
    const write = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    queue.current = write;
    void write.then(() => { if (revision.current === sequence) setSaved(true); }).catch(() => setError('The draft could not be saved. Keep this page open and retry saving.'));
    return write;
  }

  function edit(body: string) {
    if (!current.current || current.current.pending || sending.current) return;
    setError('');
    void persist(editReturnDraft(current.current, body)).catch(() => {});
  }

  function acknowledge(value: boolean) {
    if (!current.current || current.current.pending || sending.current) return;
    setError('');
    void persist({ ...current.current, acknowledged: value }).catch(() => {});
  }

  async function send(empty: boolean, launch: (input: ReturnInput) => Promise<ReturnReceipt>) {
    if (!current.current || sending.current) return null;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const next = prepareReturn(current.current, flightId, randomUUID(), empty);
      await persist(next);
      return await launch(next.pending!);
    } catch (cause) {
      setError(cause instanceof ConvexError && typeof cause.data === 'string' ? cause.data : 'The return was not confirmed. Your exact request is saved; retry without changing it.');
      return null;
    } finally { sending.current = false; setBusy(false); }
  }

  return { draft, saved, busy, error, edit, acknowledge, send, saveAgain: () => { if (current.current) void persist(current.current).catch(() => {}); } };
}
