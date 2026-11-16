import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { accessoryIds, proposedCatalog, proposedPacks, ShopFailure, type AccessoryId, type ItemId, type PackId, type ShopCommand, type ShopEntry, type ShopExit, type ShopGateway, type ShopOrder, type ShopSnapshot } from '../../src/shop';
import { Icon } from '../page03/atoms';
import { DressedBird, ShopArt } from './art';
import { exitSession, guardRemaining, leavePoints, openPoints, safeCheckoutUrl, startSession, wornAccessories, type ShopPage, type ShopSession } from './model';

type Props = { entry: ShopEntry; gateway: ShopGateway; onExit: (exit: ShopExit) => void; previewPaymentControls?: (order: ShopOrder) => ReactNode };
type PendingCommand = { command: ShopCommand; requestKey: string; revision: string };
const money = (value: number | null) => value === null ? '—' : value.toLocaleString('en-US');

export function Shop({ entry, gateway, onExit, previewPaymentControls }: Props) {
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<ShopSnapshot>();
  const [session, setSession] = useState<ShopSession>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>();
  const [packId, setPackId] = useState<PackId>('points-550');
  const [order, setOrder] = useState<ShopOrder>();
  const request = useRef(false);
  const readVersion = useRef(0);
  const checkoutRequest = useRef<{ sku: PackId | 'extra-pigeon'; requestKey: string } | undefined>(undefined);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  async function refresh() {
    const version = ++readVersion.current;
    try {
      const next = await gateway.read();
      if (version !== readVersion.current) return;
      setSnapshot(next);
      setSession(current => current ?? startSession(entry, next));
    } catch { setError('Your coop could not be refreshed. Nothing has been purchased. Try again.'); }
  }

  useEffect(() => {
    void refresh();
    const unsubscribe = gateway.subscribe?.(() => { void refresh(); });
    return () => { readVersion.current++; unsubscribe?.(); };
  }, [gateway]);

  function go(page: ShopPage) {
    if (busy || pendingCommand) return;
    setSession(current => current && { ...current, page, pointsReturn: undefined });
    setError(''); setNotice('');
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function points() {
    if (busy || pendingCommand) return;
    setSession(current => current && openPoints(current));
    setError(''); setNotice('');
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function back() {
    if (!session || !snapshot || busy || pendingCommand) return;
    setError(''); setNotice('');
    if (session.pointsReturn) setSession(leavePoints(session));
    else if (session.page.screen === 'coop' || session.entry.from === 'sky' || (session.entry.from === 'item' && session.page.screen === 'item')) onExit(exitSession(session, snapshot));
    else if (session.page.screen === 'catalog') go({ screen: 'coop' });
    else go({ screen: 'catalog', ownedOnly: false });
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function mutate(command: ShopCommand, success: string) {
    if (!snapshot || request.current) return;
    request.current = true; setBusy(true); setError(''); setNotice('');
    const input = pendingCommand ?? { command, requestKey: Crypto.randomUUID(), revision: snapshot.revision };
    setPendingCommand(input);
    try {
      const next = await gateway.mutate(input);
      readVersion.current++;
      setSnapshot(next); setPendingCommand(undefined); setNotice(success);
    } catch (cause) {
      if (cause instanceof ShopFailure) {
        setPendingCommand(undefined);
        if (cause.code === 'insufficient') setSession(current => current && openPoints(current));
        if (cause.code === 'stale') await refresh();
        setError(cause.message);
      } else setError('Confirmation did not arrive. Retry this same action to check it without purchasing twice.');
    } finally { request.current = false; setBusy(false); }
  }

  async function checkout(sku: PackId | 'extra-pigeon') {
    if (!snapshot || request.current || !snapshot.capabilities.checkout || (snapshot.source === 'server' && Platform.OS !== 'web')) return;
    request.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (order && ['pending', 'reconciliation'].includes(order.status)) {
        if (order.sku !== sku) throw new ShopFailure('rejected', 'Resolve the existing checkout before choosing a different item.');
      }
      checkoutRequest.current ??= { sku, requestKey: Crypto.randomUUID() };
      if (checkoutRequest.current.sku !== sku) throw new ShopFailure('rejected', 'Check the earlier checkout before changing the selection.');
      const next = await gateway.checkout(checkoutRequest.current);
      setOrder(next);
      if (next.status === 'pending' && next.purchaseUrl) {
        if (!safeCheckoutUrl(next.purchaseUrl)) throw new ShopFailure('unavailable', 'The server did not return an approved sandbox checkout URL.');
        await gateway.openCheckout(next.purchaseUrl);
      } else if (next.status === 'paid') await refresh();
      else if (next.status === 'pending' && snapshot.source === 'server') setNotice('Checkout is being prepared. Check its status before trying again.');
    } catch (cause) {
      setError(cause instanceof ShopFailure ? cause.message : 'Checkout could not be confirmed. Retry the same checkout; no points have been granted here.');
    } finally { request.current = false; setBusy(false); }
  }

  async function checkPayment() {
    if (!order || request.current) return;
    request.current = true; setBusy(true); setError('');
    try {
      const next = await gateway.order(order.id);
      if (!next) throw new Error('Order unavailable');
      setOrder(next);
      if (next.status === 'paid') await refresh();
    } catch { setError('Payment status could not be checked. Your balance has not been changed by this screen.'); }
    finally { request.current = false; setBusy(false); }
  }

  if (!snapshot || !session) return <View style={s.loading}><ActivityIndicator color={BLUE} /><Text style={s.body}>{error || 'Finding your flock…'}</Text>{error && <Action label="Retry loading" onPress={() => void refresh()} />}</View>;
  const selectedBird = snapshot.birds.find(b => b.id === session.selectedBirdId);
  const isPreview = snapshot.source === 'test-preview';
  const locked = busy || Boolean(pendingCommand);
  const page = session.page;
  const topup = Boolean(session.pointsReturn);
  const itemId = page.screen === 'item' ? page.itemId : undefined;
  const accessory = accessoryIds.includes(itemId as AccessoryId) ? itemId as AccessoryId : undefined;
  const price = accessory ? proposedCatalog[accessory].points : null;
  const owned = snapshot.inventory.find(i => i.itemId === itemId && i.quantity > 0);
  const wearer = snapshot.birds.find(b => b.id === owned?.wornBy);
  const title = topup ? 'Get points' : page.screen === 'coop' ? 'My coop' : page.screen === 'catalog' ? page.ownedOnly ? 'My items' : 'Coop shop' : page.screen === 'stones' ? 'Stone shop' : accessory ? owned ? 'Your accessory' : 'Try it on' : itemId ? proposedCatalog[itemId].title : 'Coop shop';
  const ready = snapshot.birds.filter(b => b.status === 'ready').length;
  const guard = guardRemaining(snapshot);
  const pack = proposedPacks.find(p => p.id === packId)!;
  const canCheckout = snapshot.capabilities.checkout && (isPreview || Platform.OS === 'web');
  const setupReason = snapshot.capabilities.reason ?? 'Proposed purchases are not enabled. No payment will be started.';

  function picker(onlyReady: boolean) {
    return <View style={s.birdRow}>{snapshot!.birds.map(bird => {
      const disabled = locked || (onlyReady && bird.status !== 'ready');
      const selected = bird.id === session!.selectedBirdId;
      return <Pressable key={bird.id} accessibilityRole="radio" accessibilityLabel={`${bird.name}, ${bird.status === 'ready' ? 'ready' : bird.returnLabel ?? 'in flight'}`} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => { setSession(current => current && { ...current, selectedBirdId: bird.id }); setNotice(''); }} style={[s.birdOption, selected && s.birdSelected, disabled && !selected && { opacity: .55 }]}><DressedBird bird={bird} accessories={wornAccessories(snapshot!, bird.id)} size={52} /><Text style={s.birdName}>{bird.name}</Text><Text style={[s.birdStatus, selected && { color: BLUE }]}>{selected ? 'Selected' : owned?.wornBy === bird.id ? 'Wearing' : bird.status === 'ready' ? 'Ready' : bird.returnLabel ?? 'In flight'}</Text></Pressable>;
    })}</View>;
  }

  function itemVisible(id: ItemId) {
    return page.screen !== 'catalog' || !page.ownedOnly || snapshot!.inventory.some(i => i.itemId === id && (i.quantity > 0 || (i.activeUntil ?? 0) > snapshot!.serverNow));
  }

  function paymentState() {
    if (!order) return null;
    const statusCopy: Record<ShopOrder['status'], string> = {
      pending: 'Waiting for Whop confirmation. Closing checkout does not cancel or complete a payment.',
      paid: 'Payment confirmed by the server. Review your item before spending points.',
      canceled: 'Payment canceled. No points were added.',
      failed: 'Payment was declined or failed. No points were added.',
      refunded: 'Payment reversed. Check your current balance; contact support if you need help.',
      reconciliation: 'This payment needs review. Do not pay again; contact support with your order reference.',
    };
    return <View style={s.payment} testID="payment-status"><Text style={s.subheading}>{order.status === 'paid' ? 'Points confirmed' : order.status === 'pending' ? 'Payment pending' : order.status === 'reconciliation' ? 'Payment needs review' : `Payment ${order.status}`}</Text><Text accessibilityLiveRegion="polite" style={s.body}>{statusCopy[order.status]}</Text><Text selectable style={s.small}>Order {order.id}</Text>
      {isPreview && previewPaymentControls?.(order)}
      {['pending', 'reconciliation'].includes(order.status) && <Action label="Check payment status" secondary disabled={busy} onPress={() => void checkPayment()} />}
      {['failed', 'canceled'].includes(order.status) && <Action label="Try a new checkout" secondary disabled={busy} onPress={() => { setOrder(undefined); checkoutRequest.current = undefined; }} />}
      {order.status === 'paid' && topup && <Action label="Return to your selection" onPress={() => { setSession(leavePoints(session!)); setOrder(undefined); checkoutRequest.current = undefined; }} />}
    </View>;
  }

  return <View style={s.frame}>
    {isPreview && <View style={s.previewBanner}><Text style={s.previewText}>TEST PREVIEW · no real payments or gameplay</Text></View>}
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: isPreview ? 24 : Math.max(insets.top, 44), paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
      <View style={s.nav}><Pressable accessibilityRole="button" accessibilityLabel={topup ? 'Back to your selection' : 'Back'} accessibilityState={{ disabled: locked }} disabled={locked} onPress={back} style={s.back}><Icon name="back" size={20} /></Pressable><Text accessibilityRole="header" style={s.navTitle}>{title}</Text>{page.screen === 'coop' && !topup ? <Pressable accessibilityRole="button" disabled={locked} onPress={() => go({ screen: 'catalog', ownedOnly: true })} style={s.navEnd}><Text style={s.link}>My items</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={`Get points, balance ${money(snapshot.points)}`} disabled={locked || topup} onPress={points} style={s.wallet}><Text style={s.coin}>ϟ</Text><Text style={s.walletValue}>{money(snapshot.points)}</Text><Text style={s.link}>+</Text></Pressable>}</View>
      <View style={s.content}>
        {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        {notice && <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
        {pendingCommand && <Action label={busy ? 'Confirming…' : 'Retry the same action'} disabled={busy} onPress={() => void mutate(pendingCommand.command, 'Confirmed. Your coop is up to date.')} />}

        {topup ? <>
          <Heading title={'Pocket some\npossibilities.'} subtitle="Outfits, treats, boosts & stones." />
          <View style={s.balance}><Text style={s.eyebrow}>YOUR BALANCE</Text><Text style={s.balanceNumber}><Text style={{ color: BLUE }}>ϟ </Text>{money(snapshot.points)}<Text style={s.body}> points</Text></Text><Text style={s.small}>Points and pack prices shown below are proposals.</Text></View>
          <View style={{ gap: 12 }}>{proposedPacks.map(packOption => <Pressable key={packOption.id} accessibilityRole="radio" accessibilityLabel={`${packOption.points} points for $${packOption.dollars}`} accessibilityState={{ checked: packOption.id === packId, disabled: busy || Boolean(order) || Boolean(checkoutRequest.current) }} disabled={busy || Boolean(order) || Boolean(checkoutRequest.current)} onPress={() => setPackId(packOption.id)} style={[s.pack, packOption.id === packId && s.packSelected]}><View style={[s.radio, packOption.id === packId && { borderColor: BLUE }]}>{packOption.id === packId && <View style={s.radioDot} />}</View><View style={{ flex: 1 }}><Text style={s.itemTitle}>{money(packOption.points)} points</Text><Text style={s.small}>{packOption.caption}</Text></View><Text style={s.packPrice}>${packOption.dollars}</Text></Pressable>)}</View>
          <View style={s.summary}><Text style={s.body}>Balance after purchase</Text><Text style={s.itemTitle}>{snapshot.points === null ? '—' : money(snapshot.points + pack.points)} points</Text></View>
          {paymentState()}
          {(!order || order.status === 'pending') && <Action label={busy ? 'Preparing checkout…' : order ? 'Resume the same Whop checkout' : `Continue with Whop · $${pack.dollars}`} disabled={busy || !canCheckout} onPress={() => void checkout(packId)} />}
          <Text style={s.centerSmall}>{isPreview ? 'Simulated one-time purchase. No money changes hands.' : canCheckout ? 'Sandbox checkout only. No subscription.' : Platform.OS !== 'web' ? 'Native purchasing is unavailable pending storefront approval.' : setupReason}</Text>
        </> : page.screen === 'coop' ? <>
          <Heading title={'Choose your\nlittle courier.'} subtitle={`Tap a pigeon below · ${ready} ready to fly`} />
          {snapshot.birds.length ? picker(false) : <Text style={s.body}>Your flock is not connected yet. No sample birds are shown in your account.</Text>}
          {selectedBird && <View style={s.selectedCard}><View style={s.selectedTop}><DressedBird bird={selectedBird} accessories={wornAccessories(snapshot, selectedBird.id)} size={150} /><View style={{ flex: 1 }}><Text style={s.birdTitle}>{selectedBird.name}</Text><Text style={s.body}>{selectedBird.status === 'ready' ? 'Ready to fly' : selectedBird.returnLabel ?? 'On a journey'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Customize ${selectedBird.name}`} disabled={locked} onPress={() => go({ screen: 'catalog', ownedOnly: true })} style={s.customize}><Text style={{ fontSize: 23, color: BLUE }}>✎</Text></Pressable></View><Action label={`Send with ${selectedBird.name}`} disabled={locked || selectedBird.status !== 'ready'} onPress={() => onExit(exitSession(session, snapshot, true))} /></View>}
          {guard > 0 && <View style={s.guardRow}><ShopArt name="flock-guard" width={44} height={44} /><View style={{ flex: 1 }}><Text style={s.itemTitle}>Flock guard</Text><Text style={s.small}>Protecting all {snapshot.birds.length} pigeons{isPreview ? ' · preview' : ''}</Text></View><Text style={s.link}>{guard}m left</Text></View>}
          <Pressable accessibilityRole="button" disabled={locked} onPress={() => go({ screen: 'catalog', ownedOnly: false })} style={s.visit}><View style={s.shopMark}><Text style={{ color: BLUE, fontSize: 24 }}>⌂</Text></View><View style={{ flex: 1 }}><Text style={s.subheading}>Visit the coop shop</Text><Text style={s.body}>Outfits, treats & little extras</Text></View><Icon name="arrow" color={BLUE} /></Pressable>
        </> : page.screen === 'catalog' ? <>
          <Heading title={page.ownedOnly ? 'Little things.\nAlready yours.' : 'Good things.\nFor your flock.'} subtitle={page.ownedOnly ? 'Your accessories, treats & little extras.' : 'New shop items, thoughtfully picked.'} />
          <View style={s.filterRow}><Filter label="Shop" selected={!page.ownedOnly} onPress={() => go({ screen: 'catalog', ownedOnly: false })} /><Filter label="My items" selected={page.ownedOnly} onPress={() => go({ screen: 'catalog', ownedOnly: true })} /></View>
          <Section title="Accessories" subtitle="One accessory, one pigeon at a time." />
          {itemVisible('sunday-cap') && <Pressable accessibilityRole="button" accessibilityLabel="Manage Sunday cap" onPress={() => go({ screen: 'item', itemId: 'sunday-cap' })} style={s.featured}><View style={s.featureCopy}><Text style={s.ownedLabel}>{snapshot.inventory.some(i => i.itemId === 'sunday-cap' && i.quantity > 0) ? '✓ OWNED' : 'PROPOSED'}</Text><Text style={s.featureTitle}>{'Sunday\nbest.'}</Text><Text style={s.body}>{snapshot.birds.find(b => b.id === snapshot.inventory.find(i => i.itemId === 'sunday-cap')?.wornBy)?.name ? `On ${snapshot.birds.find(b => b.id === snapshot.inventory.find(i => i.itemId === 'sunday-cap')?.wornBy)?.name}` : 'A little shade for the journey'}</Text></View><View style={s.featureBird}><DressedBird bird={{ appearance: 'mochi' }} accessories={['sunday-cap']} size={188} /></View><View style={s.manage}><Text style={s.buttonText}>Manage</Text><Icon name="arrow" color="white" size={20} /></View></Pressable>}
          <View style={s.grid}>{(['cloud-scarf', 'flight-goggles'] as const).filter(itemVisible).map(id => { const inv = snapshot.inventory.find(i => i.itemId === id && i.quantity > 0); const name = snapshot.birds.find(b => b.id === inv?.wornBy)?.name; return <Pressable key={id} accessibilityRole="button" accessibilityLabel={proposedCatalog[id].title} onPress={() => go({ screen: 'item', itemId: id })} style={[s.tile, { backgroundColor: id === 'cloud-scarf' ? '#F2F0F8' : '#EEF2FF' }]}>{inv && <View style={s.check}><Icon name="check" color={BLUE} size={13} /></View>}<View style={s.tileArt}><ShopArt name={id} width={110} height={90} /></View><Text style={s.itemTitle}>{proposedCatalog[id].title}</Text><Text style={[s.small, inv && { color: BLUE }]}>{inv ? name ? `On ${name}` : 'Owned · not worn' : proposedCatalog[id].points === null ? 'Preview · price pending' : `${proposedCatalog[id].points} points`}</Text></Pressable>; })}</View>
          <Section title="Boosters" subtitle="A little help for the journey." />
          <View style={s.grid}>{(['tailwind-treat', 'flock-guard'] as const).filter(itemVisible).map(id => { const quantity = snapshot.inventory.find(i => i.itemId === id)?.quantity ?? 0; return <Pressable key={id} accessibilityRole="button" accessibilityLabel={proposedCatalog[id].title} onPress={() => go({ screen: 'item', itemId: id })} style={[s.tile, s.booster, { backgroundColor: id === 'tailwind-treat' ? '#F4F2ED' : '#EEF2FF' }]}><ShopArt name={id} width={96} height={76} /><Text style={s.itemTitle}>{proposedCatalog[id].title}</Text><Text style={s.effect}>{proposedCatalog[id].description}</Text><Text style={s.tileLink}>{id === 'flock-guard' && guard ? `Active · ${guard}m left` : quantity ? `${quantity} owned · Use →` : 'Proposed · view details'}</Text></Pressable>; })}</View>
          <Section title="The everyday essentials" />
          {itemVisible('extra-pigeon') && <Pressable accessibilityRole="button" accessibilityLabel="One more little friend" onPress={() => go({ screen: 'item', itemId: 'extra-pigeon' })} style={s.essential}><DressedBird bird={{ appearance: 'mochi' }} size={46} /><View style={{ flex: 1 }}><Text style={s.itemTitle}>One more little friend</Text><Text style={s.small}>Add a permanent pigeon</Text></View><Text style={s.pricePill}>$1</Text></Pressable>}
          {itemVisible('stones') && <Pressable accessibilityRole="button" accessibilityLabel="A pocketful of stones" onPress={() => go({ screen: 'stones' })} style={s.essential}><ShopArt name="stones" width={46} /><View style={{ flex: 1 }}><Text style={s.itemTitle}>A pocketful of stones</Text><Text style={s.small}>5 stones · ready for takeoff</Text></View><Text style={s.pricePill}>ϟ 50</Text></Pressable>}
          {page.ownedOnly && !snapshot.inventory.some(i => i.quantity > 0 || (i.activeUntil ?? 0) > snapshot.serverNow) && <Text style={s.body}>No items yet. Browse the shop to try something on.</Text>}
        </> : accessory ? <>
          <View style={s.previewing}><Text style={s.body}>Previewing on</Text><Text style={s.itemTitle}>{selectedBird?.name ?? 'Choose a pigeon'}⌄</Text></View>
          <View style={s.fitting}><Text style={s.previewBadge}>PREVIEW</Text><View style={s.birdShadow} />{selectedBird ? <DressedBird bird={selectedBird} accessories={[...wornAccessories(snapshot, selectedBird.id).filter(id => id !== accessory), accessory]} size={226} /> : <Text style={s.body}>Connect your flock to try this on.</Text>}</View>
          <View style={s.itemHeading}><Text style={s.detailTitle}>{proposedCatalog[accessory].title}</Text><Text style={s.pricePill}>{owned ? '✓ Owned' : price === null ? 'Preview' : `${price} pts`}</Text></View>
          <Text style={s.description}>{owned ? wearer ? `Currently worn by ${wearer.name}.\nMove it to another pigeon whenever you like.` : 'Owned, and waiting for a little adventure.\nChoose a pigeon to put it on.' : `${proposedCatalog[accessory].description}\nOne purchase. One pigeon wears it at a time.`}</Text>
          <Text style={s.itemTitle}>Who should wear it?</Text>{picker(true)}
          <Action label={owned ? owned.wornBy === selectedBird?.id ? `Worn by ${selectedBird?.name}` : wearer ? `Move from ${wearer.name} to ${selectedBird?.name ?? '…'}` : `Put on ${selectedBird?.name ?? '…'}` : snapshot.points !== null && price !== null && snapshot.points < price ? 'Get points to make it yours' : `Buy & put on ${selectedBird?.name ?? '…'} · ${proposedCatalog[accessory].points} pts`} disabled={locked || !selectedBird || selectedBird.status !== 'ready' || owned?.wornBy === selectedBird?.id || !snapshot.capabilities.accessories || (!owned && price === null)} onPress={() => {
            if (!selectedBird) return;
            if (!owned && price !== null && (snapshot.points ?? 0) < price) { points(); return; }
            void mutate({ kind: owned ? 'equip' : 'buy-accessory', itemId: accessory, birdId: selectedBird.id, ...(owned?.wornBy ? { expectedWearer: owned.wornBy } : {}) }, `${proposedCatalog[accessory].title} is owned and worn by ${selectedBird.name}.`);
          }} />
          <Text style={s.centerSmall}>{!snapshot.capabilities.accessories ? setupReason : !owned && price === null ? 'A price has not been proposed for this accessory.' : owned ? wearer && wearer.id !== selectedBird?.id ? `${wearer.name} will take it off. ${selectedBird?.name ?? 'Your pigeon'} will put it on.` : 'Already yours. No points will be spent.' : snapshot.points !== null && price !== null && snapshot.points >= price ? `${money(snapshot.points)} points → ${money(snapshot.points - price)} points after purchase` : 'Top up, then return here to confirm your purchase.'}</Text>
        </> : page.screen === 'stones' ? <>
          <Heading title={'A few more chances\nto say hi.'} subtitle="A little something for your next encounter." />
          <View style={[s.fitting, { height: 260 }]}><ShopArt name="stones" width={124} /><Text style={s.detailTitle}>5 stones</Text><Text style={s.pricePill}>ϟ 50</Text></View><Text style={s.centerSmall}>Five more shots at a chance encounter.</Text>
          <View style={s.balance}><Text style={s.subheading}>Or wait for a free stone</Text><Text style={s.body}>Your sky keeps the authoritative refill timer.</Text></View>
          <Action label="Get 5 stones · 50 pts" disabled={locked || !snapshot.capabilities.stones} onPress={() => { if ((snapshot.points ?? 0) < 50) points(); else void mutate({ kind: 'buy-stones' }, 'Test pouch refilled. Return to the sky when you’re ready.'); }} />
          <Text style={s.centerSmall}>{snapshot.capabilities.stones ? `${money(snapshot.points)} points → ${money(Math.max(0, (snapshot.points ?? 0) - 50))} points after purchase` : 'Paid stones are not enabled. Your current pouch is unchanged.'}</Text>
          <Action secondary label={session.entry.from === 'sky' ? 'Return to the sky' : 'Back to the shop'} disabled={locked} onPress={back} />
        </> : itemId === 'tailwind-treat' || itemId === 'flock-guard' ? <>
          <Heading title={proposedCatalog[itemId].title} subtitle={itemId === 'tailwind-treat' ? 'A little boost for one little courier.' : 'A little peace of mind for the whole coop.'} />
          <View style={[s.fitting, { height: 190, backgroundColor: itemId === 'tailwind-treat' ? '#F4F2ED' : '#EEF2FF' }]}><ShopArt name={itemId} width={150} height={120} /></View><Text style={s.subheading}>{owned?.quantity ?? 0} owned{itemId === 'flock-guard' && guard ? ` · Active for ${guard}m` : ''}</Text>
          <Text style={s.description}>{itemId === 'tailwind-treat' ? 'Proposed effect: this pigeon’s next flight arrives 10% sooner. Confirming uses one treat, once. It does not change a flight already in the air.' : 'Proposed effect: protection for every pigeon in your coop for 1 hour, making interception harder. Confirming uses one flock guard.'}</Text>
          {itemId === 'tailwind-treat' && <><Text style={s.itemTitle}>Who gets the treat?</Text>{picker(true)}</>}
          <Action label={itemId === 'tailwind-treat' ? `Use 1 treat on ${selectedBird?.name ?? '…'}` : guard ? 'Flock guard is active' : 'Protect my whole coop · 1 hour'} disabled={locked || !snapshot.capabilities.boosters || !owned?.quantity || (itemId === 'tailwind-treat' && (!selectedBird || selectedBird.status !== 'ready')) || (itemId === 'flock-guard' && guard > 0)} onPress={() => void mutate(itemId === 'tailwind-treat' ? { kind: 'use-treat', birdId: selectedBird!.id } : { kind: 'activate-guard' }, isPreview ? 'Simulated activation confirmed. No real flight was changed.' : 'Activation confirmed.')} />
          <Text style={s.centerSmall}>{isPreview ? 'Test-only consumption. No real flight is sped up or protected.' : 'Paid gameplay effects are not enabled.'}</Text>
        </> : itemId === 'extra-pigeon' ? <>
          <Heading title={'One more\nlittle friend.'} subtitle="A permanent place in your flock." /><View style={s.fitting}><DressedBird bird={{ appearance: 'mochi' }} size={226} /></View><Text style={s.description}>A proposed $1 one-time purchase, fulfilled through Whop. New pigeons must be added by the shared flock service, never by this screen.</Text>{paymentState()}<Action label="Continue with Whop · $1" disabled onPress={() => {}} /><Text style={s.centerSmall}>This proposed purchase is not enabled.</Text>
        </> : null}
        <Text style={s.disclosure}>Design preview · prices, effects and weekly releases are proposals, not approved offers.</Text>
      </View>
    </ScrollView>
  </View>;
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) { return <View style={s.heading}><Text accessibilityRole="header" style={s.title}>{title}</Text><Text style={s.body}>{subtitle}</Text></View>; }
function Section({ title, subtitle }: { title: string; subtitle?: string }) { return <View style={s.section}><Text accessibilityRole="header" style={s.subheading}>{title}</Text>{subtitle && <Text style={s.small}>{subtitle}</Text>}</View>; }
function Filter({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[s.filter, selected && { backgroundColor: '#EDF2FF' }]}><Text style={[s.small, selected && { color: BLUE }]}>{label}</Text></Pressable>; }
function Action({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, secondary && { backgroundColor: '#EDF2FF' }, disabled && { opacity: .45 }, pressed && { opacity: .8 }]}><Text style={[s.buttonText, secondary && { color: BLUE }]}>{label}</Text></Pressable>; }

const BLUE = '#2453FF';
const s = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: 'white' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  previewBanner: { backgroundColor: '#EEF2FF', paddingVertical: 6, paddingHorizontal: 12 },
  previewText: { color: '#3451A8', fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, height: 52, marginBottom: 20 },
  back: { width: 36, height: 44, justifyContent: 'center', flexShrink: 0 },
  navTitle: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 20, lineHeight: 24, color: '#000', textAlign: 'center' },
  navEnd: { minWidth: 70, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  wallet: { minHeight: 36, borderRadius: 20, backgroundColor: '#EEF2FF', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  coin: { color: 'white', backgroundColor: BLUE, borderRadius: 9, overflow: 'hidden', width: 15, height: 15, textAlign: 'center', lineHeight: 15, fontWeight: '700' },
  walletValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#17212B' },
  content: { paddingHorizontal: 24, gap: 12 },
  heading: { gap: 8, paddingBottom: 6 },
  title: { fontFamily: 'Outfit_600SemiBold', fontSize: 34, lineHeight: 36, letterSpacing: -1.2, color: '#000' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: '#566273' },
  small: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#566273' },
  centerSmall: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#566273', textAlign: 'center' },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 20, color: BLUE },
  section: { gap: 4, paddingTop: 14, paddingBottom: 2 },
  subheading: { fontFamily: 'Outfit_600SemiBold', fontSize: 22, lineHeight: 28, letterSpacing: -.5, color: '#17212B' },
  itemTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 20, color: '#17212B' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filter: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 16 },
  featured: { height: 222, backgroundColor: '#EAF1F7', borderRadius: 24, overflow: 'hidden' },
  featureCopy: { position: 'absolute', top: 22, left: 20, width: 135, gap: 8 },
  featureTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 28, lineHeight: 29, letterSpacing: -1, color: '#000' },
  featureBird: { position: 'absolute', right: 0, top: 25 },
  ownedLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 14, color: BLUE, letterSpacing: .8 },
  manage: { position: 'absolute', left: 20, bottom: 20, borderRadius: 22, backgroundColor: BLUE, height: 42, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  tile: { flex: 1, minWidth: 0, minHeight: 172, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 8, gap: 3, alignItems: 'center' },
  tileArt: { height: 92, justifyContent: 'center', alignItems: 'center' },
  check: { position: 'absolute', top: 9, right: 9, width: 21, height: 21, borderRadius: 11, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  booster: { minHeight: 200, paddingTop: 10, paddingBottom: 16, gap: 5 },
  effect: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 18, color: '#566273', textAlign: 'center' },
  tileLink: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 20, color: BLUE, textAlign: 'center', marginTop: 5 },
  essential: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E5EAF0', paddingVertical: 10 },
  pricePill: { overflow: 'hidden', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EEF2FF', color: BLUE, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  birdRow: { flexDirection: 'row', gap: 5, justifyContent: 'space-between', marginVertical: 6 },
  birdOption: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 8, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 16, gap: 3 },
  birdSelected: { borderColor: BLUE, backgroundColor: '#F1F4FF' },
  birdName: { fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 16, color: '#17212B' },
  birdStatus: { fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 14, color: '#687383', textAlign: 'center' },
  selectedCard: { backgroundColor: '#EAF1F7', borderRadius: 24, padding: 16, gap: 6 },
  selectedTop: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -8, marginTop: -6 },
  birdTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 28, lineHeight: 34, color: '#17212B', letterSpacing: -.8 },
  customize: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'white' },
  guardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#E5EAF0' },
  shopMark: { width: 44, height: 44, backgroundColor: '#EEF2FF', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  previewing: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fitting: { height: 282, borderRadius: 26, backgroundColor: '#EAF1F7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', gap: 10 },
  previewBadge: { position: 'absolute', top: 18, left: 18, borderRadius: 14, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'white', fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 12, color: '#566273', letterSpacing: 1 },
  birdShadow: { position: 'absolute', bottom: 19, width: 182, height: 18, borderRadius: 100, backgroundColor: '#DCE5ED' },
  itemHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 },
  detailTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 28, lineHeight: 36, letterSpacing: -.6, color: '#17212B' },
  description: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21, color: '#566273', marginBottom: 6 },
  action: { minHeight: 56, borderRadius: 28, backgroundColor: BLUE, paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: 'white', textAlign: 'center' },
  balance: { padding: 20, backgroundColor: '#F5F7FB', borderRadius: 20, gap: 10, marginVertical: 6 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1, color: '#687383' },
  balanceNumber: { fontFamily: 'Outfit_600SemiBold', fontSize: 40, lineHeight: 48, color: '#17212B' },
  pack: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 78, borderRadius: 18, borderColor: '#E5EAF0', borderWidth: 1.5, padding: 16 },
  packSelected: { backgroundColor: '#F4F6FF', borderColor: BLUE },
  radio: { width: 20, height: 20, borderWidth: 1.5, borderColor: '#BCC6D5', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },
  packPrice: { fontFamily: 'Outfit_600SemiBold', fontSize: 24, lineHeight: 30, color: '#17212B' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginVertical: 8 },
  payment: { backgroundColor: '#F5F7FB', borderRadius: 18, padding: 16, gap: 12 },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: '#AE3046', paddingVertical: 8 },
  notice: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: '#245843', paddingVertical: 8 },
  disclosure: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, color: '#687383', marginTop: 18, textAlign: 'center' },
});
