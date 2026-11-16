import { useState } from 'react';
import { Text } from 'react-native';
import { a } from './atoms';
import { MapScreen } from './MapScreen';

export function LandingScreen({ onStart }: { onStart?: () => void }) {
  const [scope, setScope] = useState<'mine' | 'world'>('mine');
  const [unavailable, setUnavailable] = useState(false);
  function start() { if (onStart) onStart(); else setUnavailable(true); }
  return <MapScreen flights={[]} selected={null} serverNow={null} onSelect={() => {}} scope={scope} onScope={setScope} onMenu={start} onInbox={start} title={scope === 'mine' ? 'Your sky starts here' : 'A quiet patch of sky'} subtitle={scope === 'mine' ? 'Send a little air mail to someone you know.' : 'Sign in to see real Open Skies flights.'} onSend={start} notice={unavailable ? <Text accessibilityRole="alert" style={a.small}>The post office isn’t connected in this build. No account or flight has been created.</Text> : undefined} />;
}
