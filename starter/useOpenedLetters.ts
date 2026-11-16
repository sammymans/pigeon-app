import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

export function useOpenedLetters(deployment: string, profileId: string) {
  const key = `pigeon:opened:${encodeURIComponent(deployment)}:${profileId}`;
  const [opened, setOpened] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const current = useRef<string[]>([]);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    current.current = []; setOpened([]); setLoaded(false);
    void AsyncStorage.getItem(key).then(raw => {
      const values: unknown = raw ? JSON.parse(raw) : [];
      if (active && Array.isArray(values)) {
        current.current = [...new Set([...current.current, ...values.filter((value): value is string => typeof value === 'string')])];
        setOpened(current.current);
      }
    }).catch(() => {}).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [key]);
  function markOpened(id: string) {
    if (!loaded || current.current.includes(id)) return;
    current.current = [...current.current, id];
    setOpened(current.current);
    const value = JSON.stringify(current.current);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, value));
    void writes.current.catch(() => {});
  }
  return { opened, loaded, markOpened };
}
