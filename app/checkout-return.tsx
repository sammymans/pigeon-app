import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrder, usePigeon } from '../src/client/PigeonProvider';
import { PigeonCharacter } from '../src/animation/PigeonCharacter';
import { ActionFeedback, AuthGate, Badge, Button, EmptyState, Loading, Notice, Page, Txt, useAction } from '../src/ui/primitives';
import { colors } from '../src/ui/theme';

function OrderConfirmation({ id }: { id: string }) {
  const pigeon = usePigeon();
  const { order, loading } = useOrder(id);
  const [timedOut, setTimedOut] = useState(false);
  const action = useAction();
  useEffect(() => { const timer = setTimeout(() => setTimedOut(true), 30000); return () => clearTimeout(timer); }, [id]);
  if (loading) return <Loading label="Finding your secure order…"/>;
  if (!order) return <EmptyState title="We couldn’t find that order." body="It may belong to another account, or checkout may not have created it. Returning here never unlocks an outfit." action={<Button label="Back to the outfitters" onPress={() => router.replace('/shop')}/>}/>;
  const verified = order.status === 'paid' && pigeon.owned.includes('aviator');
  return <View style={{ alignItems: 'center', gap: 24, paddingVertical: 32 }}><Badge label="Whop sandbox · Test mode" tone="paper"/><PigeonCharacter size={210} outfit={verified ? 'aviator' : 'classic'} motion={verified ? 'celebrate' : 'idle'}/>
    <Txt style={{ fontSize: 30, fontWeight: '700', textAlign: 'center', letterSpacing: -1 }}>{verified ? 'Your pigeon has drip.' : order.status === 'failed' ? 'That payment didn’t land.' : order.status === 'refunded' ? 'This purchase was refunded.' : order.status === 'reconciliation' ? 'A human needs to check this one.' : timedOut ? 'Still waiting for the all-clear.' : 'Confirming your purchase.'}</Txt>
    <Txt style={{ maxWidth: 410, textAlign: 'center', color: colors.muted, fontSize: 14, lineHeight: 23 }}>{verified ? 'Payment verified. The Aviator Pack is permanently yours, ready for its first flight.' : order.status === 'failed' || order.status === 'refunded' ? 'No Aviator entitlement is granted by this order. You can return to the shop or keep flying Classic.' : order.status === 'reconciliation' ? 'The payment details need review. We haven’t unlocked anything, and you don’t need to pay again.' : 'We’re checking the server for Whop’s verified payment. A checkout return is not a payment receipt; your outfit stays locked until confirmation.'}</Txt>
    <ActionFeedback action={action}/>
    {verified && <Button label={pigeon.profile?.equipped === 'aviator' ? 'Back to the sky' : 'Equip the Aviator Pack'} icon="check" busy={action.busy} disabled={!pigeon.connected} onPress={() => action.run(async () => { if (pigeon.profile?.equipped !== 'aviator') await pigeon.equip('aviator'); router.replace('/'); })}/>}
    {!verified && (order.status === 'pending' || order.status === 'paid') && !timedOut && <Loading label="Checking every two seconds…"/>}
    {timedOut && !verified && <Notice text="You can refresh below or come back later. Don’t pay again while an order is still pending."/>}
    <Button label="Back to the outfitters" variant="secondary" onPress={() => router.replace('/shop')}/>
  </View>;
}

export default function CheckoutReturnScreen() {
  const params = useLocalSearchParams<{ orderId?: string; order?: string; id?: string }>();
  const id = params.orderId ?? params.order ?? params.id;
  const [refresh, setRefresh] = useState(0);
  return <Page narrow back eyebrow="A NOTE FROM THE OUTFITTERS" title="A little wardrobe update."><AuthGate>{id ? <><OrderConfirmation key={`${id}:${refresh}`} id={id}/><Button label="Refresh payment status" variant="ghost" icon="clock" onPress={() => setRefresh(value => value + 1)}/></> : <EmptyState title="No order was attached." body="Open your pending purchase from the Shop to check its real status. A success parameter in a link never grants an outfit." action={<Button label="Open the shop" onPress={() => router.replace('/shop')}/>}/>}</AuthGate></Page>;
}
