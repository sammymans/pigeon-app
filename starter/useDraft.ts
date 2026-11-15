import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConvexError } from 'convex/values';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LaunchInput } from '../src/domain';
import { draftStorageKey, editDraft, emptyDraft, releaseRejectedDraft, replyDraft, restoreDraft, sealDraft, type Draft } from './letterModel';

export function useDraft(deployment: string, profileId: string, demo: boolean) {
  const key = draftStorageKey(deployment, profileId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const current = useRef<Draft | null>(null);
  const acknowledged = useRef<string | null>(null);
  const sending = useRef(false);
  const mounted = useRef(true);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setError('');
    AsyncStorage.getItem(key).then((raw) => {
      const restored = restoreDraft(raw, demo);
      if (!active) return;
      current.current = restored;
      setDraft(restored);
      setSaved(true);
    }).catch(() => {
      if (active) setError('Your saved draft could not be loaded. Nothing has been overwritten. Retry loading before writing.');
    });
    return () => { active = false; };
  }, [key, demo, loadAttempt]);

  const persist = useCallback((next: Draft) => {
    current.current = next;
    setDraft(next);
    setSaved(false);
    const sequence = ++revision.current;
    const write = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    queue.current = write;
    void write.then(() => {
      if (sequence === revision.current) setSaved(true);
    }).catch(() => {
      setError('This draft is not saved on this device yet. Keep the app open and retry saving before sending.');
    });
    return write;
  }, [key]);

  function edit(changes: Partial<Pick<Draft, 'body' | 'recipientId'>>) {
    if (!current.current || sending.current || acknowledged.current) return;
    setError('');
    void persist(editDraft(current.current, changes)).catch(() => {});
  }

  function startReply(recipientId: string) {
    if (!current.current || sending.current || acknowledged.current) return;
    setError('');
    void persist(replyDraft(current.current, recipientId)).catch(() => {});
  }

  async function send(launch: (input: LaunchInput) => Promise<{ id: string }>): Promise<string | null> {
    if (!current.current || sending.current) return null;
    const freshLaunch = !current.current.pending;
    sending.current = true;
    setBusy(true);
    setError('');
    let stage: 'persist' | 'launch' | 'cleanup' = 'persist';
    try {
      let id = acknowledged.current;
      if (!id) {
        const sealed = sealDraft(current.current, demo, current.current.pending?.requestKey ?? randomUUID());
        await persist(sealed);
        stage = 'launch';
        const result = await launch(sealed.pending!);
        if (!mounted.current) return null;
        id = result.id;
        acknowledged.current = id;
        setReceipt(id);
      }
      stage = 'cleanup';
      await persist(emptyDraft());
      acknowledged.current = null;
      setReceipt(null);
      return id;
    } catch (cause) {
      if (stage === 'cleanup') setError('The server accepted your letter. Local draft cleanup failed; finish cleanup before writing another.');
      else if (stage === 'persist') setError('The sealed draft could not be saved. No new send was attempted. Retry safely with the same letter.');
      else if (cause instanceof ConvexError && typeof cause.data === 'string') {
        if (freshLaunch && current.current) {
          try {
            await persist(releaseRejectedDraft(current.current, true));
            setError(`${cause.data} No flight was created. Your text is kept and can be edited.`);
          } catch {
            setError(`${cause.data} No flight was created, but the editable draft could not be saved. Retry saving before leaving.`);
          }
        } else setError(`${cause.data} A previous send is still uncertain. Your exact payload and key are kept for retry.`);
      }
      else setError('Send confirmation did not arrive. This letter may already be flying. Retry the same sealed letter to confirm, without sending a duplicate.');
      return null;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function retryStorage() {
    if (!current.current) { setLoadAttempt((attempt) => attempt + 1); return; }
    setError('');
    void persist(current.current).catch(() => {});
  }

  return { draft, error, saved, busy, receipt, edit, startReply, send, retryStorage, locked: Boolean(draft?.pending || receipt) };
}
