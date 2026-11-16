import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../convex/_generated/api';
import type { CityId } from '../src/domain';
import { Button, CityPicker, Field, Notice, s } from './ui';

function failure(cause: unknown, fallback: string) {
  return cause instanceof ConvexError && typeof cause.data === 'string' ? cause.data : fallback;
}

export function HomeCity({ cityId, connected, disabled = false }: { cityId?: CityId; connected: boolean; disabled?: boolean }) {
  const save = useMutation(api.profiles.setCity);
  const [value, setValue] = useState(cityId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => setValue(cityId), [cityId]);
  async function submit() {
    if (pending.current || !value || disabled || !connected) return;
    pending.current = true; setBusy(true); setError('');
    try { await save({ cityId: value }); }
    catch (cause) { setError(failure(cause, 'Your city could not be saved. Please try again.')); }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={s.card}>
    <Text style={s.subtitle}>{cityId ? 'Your return address' : 'Where will your letters take off?'}</Text>
    <Text style={s.small}>Choose your home city. The distance to your friend sets each letter’s travel time.</Text>
    <CityPicker value={value} onChange={setValue} disabled={disabled || busy} />
    {error ? <Notice error>{error}</Notice> : null}
    {(!cityId || value !== cityId) && <Button label={busy ? 'Saving your city…' : 'Save my city'} disabled={!connected || disabled || busy || !value} onPress={() => void submit()} />}
  </View>;
}

export function FriendInvites({ connected, onJoined }: { connected: boolean; onJoined?: () => void }) {
  const create = useMutation(api.social.createInvite);
  const accept = useMutation(api.social.acceptInvite);
  const [invitation, setInvitation] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const pending = useRef(false);
  async function submit(join: boolean) {
    if (pending.current || !connected || (join && !token.trim())) return;
    pending.current = true; setBusy(true); setError(''); setJoined(false);
    try {
      if (join) { await accept({ token: token.trim() }); setToken(''); setJoined(true); onJoined?.(); }
      else setInvitation((await create({})).token);
    } catch (cause) { setError(failure(cause, 'The invitation could not be confirmed. Please try again.')); }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={s.card}>
    <Text style={s.subtitle}>A friend to write to</Text>
    <Text style={s.small}>Share a private invitation with someone you know, or paste the one they sent you. Once accepted, you can send each other letters.</Text>
    {invitation ? <><Text selectable accessibilityLabel="Your private friend invitation" style={s.token}>{invitation}</Text><Text style={s.small}>One friend can use this invitation within seven days. Share it privately.</Text><Button secondary label="Hide invitation" onPress={() => setInvitation('')} /></> : <Button secondary label={busy ? 'Please wait…' : 'Create private invitation'} disabled={!connected || busy} onPress={() => void submit(false)} />}
    <Field label="Friend’s invitation" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry editable={!busy} placeholder="Paste their private invitation" />
    <Button label={busy ? 'Please wait…' : 'Accept invitation'} disabled={!connected || busy || !token.trim()} onPress={() => void submit(true)} />
    {joined && <Notice>You’re connected. Your friend is ready to choose as a recipient.</Notice>}
    {error ? <Notice error>{error}</Notice> : null}
  </View>;
}
