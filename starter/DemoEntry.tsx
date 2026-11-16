import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '../convex/_generated/api';
import { cities, type CityId } from '../src/domain';
import { PageFrame, usePageInsets } from './page03/atoms';
import { Button, Field, Link, Notice, s } from './ui';

export function DemoEntry({ onBack }: { onBack: () => void }) {
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const create = useMutation(api.starterPair.create);
  const join = useMutation(api.starterPair.join);
  const [handle, setHandle] = useState('');
  const [cityId, setCityId] = useState<CityId>();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const insets = usePageInsets();
  async function enter(mode: 'start' | 'create' | 'join') {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (mode === 'start') await signIn('anonymous');
      else if (cityId && mode === 'create') await create({ handle, cityId });
      else if (cityId) await join({ handle, cityId, token: token.trim() });
    } catch { setError('The server could not confirm this demo step. Check the handle, invitation and connection, then retry.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <PageFrame scroll style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingHorizontal: 24, gap: 16 }}>
    <Link label="Back to phone sign-in" disabled={busy} onPress={onBack} />
    <Text style={s.title}>Try demo — no phone verification</Text>
    <Notice>This creates a real anonymous demo session, not a verified phone account. Create an isolated pair or join your partner’s private invitation. Two people can exchange letters; a pair cannot demonstrate third-party interception.</Notice>
    {!isAuthenticated ? <Button label={busy ? 'Starting…' : 'Start real demo session'} disabled={busy} onPress={() => void enter('start')} /> : <>
      <Field label="Demo handle" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Text style={s.subtitle}>Choose your demo departure city</Text>
      <View>{cities.map(city => <Pressable key={city.id} accessibilityRole="radio" accessibilityLabel={`Demo city ${city.name}`} accessibilityState={{ checked: cityId === city.id, disabled: busy }} disabled={busy} onPress={() => setCityId(city.id)} style={[s.cityOption, cityId === city.id && s.selected]}><Text>{city.name}</Text></Pressable>)}</View>
      <Button label="Create a private demo pair" disabled={busy || !cityId || !handle.trim()} onPress={() => void enter('create')} />
      <Field label="Private invitation (to join)" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry editable={!busy} />
      <Button label="Join this private demo pair" disabled={busy || !cityId || !handle.trim() || !token.trim()} onPress={() => void enter('join')} />
    </>}
    {error && <Notice error>{error}</Notice>}
  </PageFrame>;
}
