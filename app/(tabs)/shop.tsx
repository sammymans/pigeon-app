import React, { useRef, useState } from 'react';
import { Linking, View, useWindowDimensions } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { usePigeon } from '../../src/client/PigeonProvider';
import { PigeonCharacter } from '../../src/animation/PigeonCharacter';
import { ActionFeedback, Badge, Button, Eyebrow, Icon, Notice, Page, Txt, useAction } from '../../src/ui/primitives';
import { Postmark } from '../../src/ui/postal';
import { colors, mono } from '../../src/ui/theme';

export default function ShopScreen() {
  const pigeon = usePigeon();
  const { width } = useWindowDimensions();
  const action = useAction();
  const requestKey = useRef(randomUUID());
  const [preview, setPreview] = useState(true);
  const owned = pigeon.owned.includes('aviator');
  const equipped = pigeon.profile?.equipped === 'aviator';
  const pending = pigeon.orders.find(order => order.status === 'pending' || order.status === 'reconciliation');
  async function checkout() {
    const order = await pigeon.checkout(requestKey.current);
    if (!order.purchaseUrl || !/^https:\/\//.test(order.purchaseUrl)) throw new Error('Checkout has not returned a secure payment link. No outfit has been unlocked.');
    await Linking.openURL(order.purchaseUrl);
    router.push(`/checkout-return?orderId=${encodeURIComponent(order.id)}`);
  }
  return <Page eyebrow="THE PIGEON OUTFITTERS" title="Big personality. Tiny hat." subtitle="A little something for the most important bird in your life." right={<Badge label="Whop · Test mode" tone="paper"/>}>
    <View style={{ flexDirection: width > 900 ? 'row' : 'column', gap: 40, alignItems: 'stretch' }}>
      <View style={{ flex: 1.2, backgroundColor: '#EAF2F8', borderRadius: 24, borderWidth: 1, borderColor: '#DDE7ED', minHeight: width > 900 ? 475 : 330, padding: 24, justifyContent: 'space-between', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow>FLIGHT CLUB COLLECTION / 001</Eyebrow><Badge label="The Aviator" tone="paper"/></View>
        <View pointerEvents="none" style={{ position: 'absolute', width: 320, height: 320, borderWidth: 1, borderColor: '#D6E3EB', borderRadius: 160, alignSelf: 'center', top: 72 }}/><View pointerEvents="none" style={{ position: 'absolute', width: 400, height: 400, borderWidth: 1, borderColor: '#DCE7ED', borderRadius: 200, alignSelf: 'center', top: 32 }}/>
        <View style={{ alignSelf: 'center', paddingVertical: 20 }}><PigeonCharacter size={width > 900 ? 310 : 230} outfit={preview ? 'aviator' : 'classic'} motion="fly"/></View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}><View style={{ gap: 10 }}><Txt style={{ fontSize: 11, fontFamily: mono, color: '#7894A6' }}>CERTIFIED TO LOOK THE PART.</Txt><Button label={preview ? 'See the original' : 'Try on the hat'} small variant="secondary" onPress={() => setPreview(!preview)}/></View><Postmark size={86} text="CLEARED FOR TAKEOFF"/></View>
      </View>
      <View style={{ flex: 1, gap: 24, justifyContent: 'center' }}>
        <View style={{ gap: 12 }}><Eyebrow style={{ color: colors.blue }}>MORE FLAIR. SAME AIRSPEED.</Eyebrow><Txt style={{ fontSize: 40, fontWeight: '700', letterSpacing: -1.5 }}>The Aviator Pack</Txt><Txt style={{ color: colors.muted, fontSize: 14, lineHeight: 24 }}>For the bird who has absolutely no idea where they’re going, but would like to look very qualified.</Txt></View>
        <View style={{ gap: 16 }}>{[{ title: 'One very official pilot hat', text: 'Goggles included. Flying lessons not included.' }, { title: 'A signature blue contrail', text: 'Leave a little color across the shared sky.' }, { title: 'Yours, for every flight', text: 'One-time unlock. Equip on active and future birds.' }].map(feature => <View key={feature.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><View style={{ backgroundColor: '#EDF2EA', borderRadius: 8, padding: 6 }}><Icon name="check" size={14} color={colors.green}/></View><View style={{ flex: 1, gap: 4 }}><Txt style={{ fontSize: 13, fontWeight: '600' }}>{feature.title}</Txt><Txt style={{ fontSize: 11, color: colors.muted, lineHeight: 18 }}>{feature.text}</Txt></View></View>)}</View>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24, gap: 16 }}><View style={{ gap: 8 }}><Txt style={{ fontSize: 30, fontWeight: '600', letterSpacing: -1 }}>{pigeon.catalog.priceLabel}</Txt><Txt style={{ fontSize: 12, color: colors.muted }}>Test purchase · final total shown at checkout</Txt></View>
          <ActionFeedback action={action}/>
          {!pigeon.authenticated ? <Button label="Sign in to dress your pigeon" icon="arrow" onPress={() => router.push('/sign-in')}/> : owned ? <Button label={equipped ? 'Looking good. Currently equipped.' : 'Equip my Aviator Pack'} icon="check" disabled={equipped || !pigeon.connected} busy={action.busy} onPress={() => action.run(() => pigeon.equip('aviator'), 'Your pigeon has drip. Active and future birds now wear the Aviator Pack.')}/> : <Button label={pigeon.catalog.configured ? 'Get the Aviator Pack' : 'Checkout not configured yet'} icon="shop" busy={action.busy} disabled={!pigeon.catalog.configured || !pigeon.connected} onPress={() => action.run(checkout)}/>}
          <Txt style={{ fontSize: 10, lineHeight: 17, color: colors.muted }}>Secure hosted checkout by Whop. This is a sandbox purchase: no real money moves. Your outfit unlocks only after the payment is verified.</Txt>
          {!pigeon.catalog.configured && <Notice text="Try on the look, free. The payment service still needs its sandbox configuration; no purchase can be completed yet."/>}
        </View>
      </View>
    </View>
    <View style={{ backgroundColor: colors.paper, borderRadius: 16, padding: 20, marginTop: 32, flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name="heart" size={18} color="#9A886A"/><Txt style={{ flex: 1, fontSize: 12, lineHeight: 20, color: '#82775F' }}>A better-dressed pigeon, never a better chance. Outfits don’t change speed, catch odds, message access, or the three-flight limit.</Txt></View>
    {pending && <View style={{ marginTop: 20 }}><Button label="Check my pending purchase" icon="clock" variant="secondary" onPress={() => router.push(`/checkout-return?orderId=${encodeURIComponent(pending.id)}`)}/></View>}
  </Page>;
}
