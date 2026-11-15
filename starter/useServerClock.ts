import { useMutation } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../convex/_generated/api';

export function useServerClock(connected: boolean) {
  const syncClock = useMutation(api.profiles.clock);
  const settle = useMutation(api.flights.settleMine);
  const [serverNow, setServerNow] = useState<number | null>(null);
  const [syncError, setSyncError] = useState(false);
  const anchor = useRef<{ server: number; elapsed: number } | null>(null);

  useEffect(() => {
    anchor.current = null;
    setServerNow(null);
    if (!connected) return;
    let active = true;
    let syncing = false;
    async function sync() {
      if (syncing || AppState.currentState === 'background') return;
      syncing = true;
      const started = performance.now();
      try {
        const time = await syncClock({});
        if (!active) return;
        const ended = performance.now();
        anchor.current = { server: time + (ended - started) / 2, elapsed: ended };
        setServerNow(anchor.current.server);
        await settle({});
        if (active) setSyncError(false);
      } catch { if (active) setSyncError(true); }
      finally { syncing = false; }
    }
    void sync();
    const clockTimer = setInterval(() => {
      if (anchor.current) setServerNow(anchor.current.server + performance.now() - anchor.current.elapsed);
    }, 1000);
    const syncTimer = setInterval(() => void sync(), 5000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void sync(); });
    return () => { active = false; clearInterval(clockTimer); clearInterval(syncTimer); listener.remove(); };
  }, [connected, syncClock, settle]);

  return { serverNow, syncError };
}
