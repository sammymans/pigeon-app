import React, { useState } from 'react';
import { View } from 'react-native';
import { usePigeon } from '../client/PigeonProvider';
import { ActionFeedback, Button, Field, Notice, Txt, useAction } from './primitives';
import { colors } from './theme';

export function SafetyActions({ profileId, flightId }: { profileId?: string; flightId?: string }) {
  const pigeon = usePigeon();
  const action = useAction();
  const [mode, setMode] = useState<'block' | 'report' | null>(null);
  const [reason, setReason] = useState('');
  if (!pigeon.authenticated) return null;
  return <View style={{ gap: 12, marginTop: 8 }}><View style={{ flexDirection: 'row', gap: 8 }}>
    {profileId && <Button label="Block" icon="shield" small variant="ghost" onPress={() => { action.clear(); setMode(mode === 'block' ? null : 'block'); }}/>}<Button label="Report" icon="flag" small variant="ghost" onPress={() => { action.clear(); setMode(mode === 'report' ? null : 'report'); }}/>
  </View>{mode && <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 20, gap: 16 }}>
    <Txt style={{ fontSize: 16, fontWeight: '600' }}>{mode === 'block' ? 'Close this connection?' : 'Keep the skies kind.'}</Txt>
    {mode === 'block' ? <Txt style={{ color: colors.muted, lineHeight: 22, fontSize: 13 }}>Blocking stops new letters, catches, and connection requests between you. Existing reports and flight outcomes stay on record.</Txt> : <Field label="What happened?" multiline value={reason} onChangeText={setReason} placeholder="Tell us what should be reviewed." maxLength={500} style={{ minHeight: 100, textAlignVertical: 'top' }}/>}
    <Button label={mode === 'block' ? 'Yes, block this person' : 'Send report for review'} variant={mode === 'block' ? 'danger' : 'secondary'} busy={action.busy} disabled={!pigeon.connected || (mode === 'report' && reason.trim().length < 3)} onPress={() => action.run(async () => { if (mode === 'block' && profileId) await pigeon.block(profileId); else await pigeon.report({ profileId, flightId, reason: reason.trim() }); setMode(null); setReason(''); }, mode === 'block' ? 'Blocked. New interactions are now stopped.' : 'Report received for review. Thank you for looking out for the flock.')}/>
    <Button label="Cancel" variant="ghost" small onPress={() => setMode(null)}/>
  </View>}<ActionFeedback action={action}/></View>;
}
