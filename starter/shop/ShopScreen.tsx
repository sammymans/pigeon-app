import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sandboxPrice, validSandboxOffer } from './commerceAdapter';
import { placeholderItems, type CatalogState, type CheckoutSku, type PlaceholderItem, type ReceiptState } from './contracts';

function Button({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress?: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, disabled && s.disabled, pressed && !disabled && s.pressed]}>
    <Text style={[s.buttonText, secondary && s.secondaryText, disabled && s.disabledText]}>{label}</Text>
  </Pressable>;
}

function PigeonPreview({ large = false }: { large?: boolean }) {
  return <View style={[s.preview, large && s.largePreview]}>
    <Image source={require('./assets/pip.png')} style={{ width: large ? 150 : 116, height: large ? 184 : 142 }}
      accessibilityLabel="Existing Pip pigeon artwork. No new cosmetic is shown." resizeMode="contain" />
    <Text style={s.previewLabel}>EXISTING PIGEON · NO OUTFIT APPLIED</Text>
  </View>;
}

export function SandboxCheckout({ catalog, onCheckout, onRetry }: {
  catalog: CatalogState; onCheckout?: (sku: CheckoutSku) => void; onRetry?: () => void;
}) {
  const ready = catalog.status === 'ready' && validSandboxOffer(catalog.offer);
  let copy = 'Sandbox checkout isn’t connected. You can preview the placeholder for free.';
  if (catalog.status === 'loading') copy = 'Checking the sandbox catalog. No checkout has been started.';
  if (catalog.status === 'error') copy = 'The sandbox catalog couldn’t be loaded. Previewing still works.';
  if (catalog.status === 'empty') copy = 'There are no sandbox items to check out yet.';
  if (catalog.status === 'unconfigured' && catalog.reason === 'unverified-catalog') copy = 'Server settings are present, but a sandbox item and price haven’t been verified. Checkout stays off.';
  if (catalog.status === 'unconfigured' && catalog.reason === 'missing-settings') copy = 'Sandbox setup is incomplete. Nothing is for sale here yet.';
  if (catalog.status === 'ready') copy = ready
    ? 'A separate configured sandbox item, not the placeholder above. Hosted Whop checkout only; tax may be added there.'
    : 'The sandbox item could not be validated. Checkout stays off.';
  return <View style={s.sandbox}>
    <Text style={s.eyebrow}>WHOP SANDBOX · TEST MODE</Text>
    <Text style={s.sectionTitle}>{ready ? 'Sandbox checkout' : 'Checkout, later.'}</Text>
    {catalog.status === 'loading' && <ActivityIndicator color="#2453FF" accessibilityLabel="Loading sandbox catalog" />}
    <Text accessibilityLiveRegion="polite" style={s.small}>{copy}</Text>
    {catalog.status === 'ready' && ready && <Text style={s.price}>{sandboxPrice(catalog.offer)}</Text>}
    {ready && !onCheckout && <Text style={s.small}>Checkout navigation hasn’t been connected yet.</Text>}
    <Button label={ready ? 'Open sandbox checkout' : 'Sandbox checkout unavailable'} disabled={!ready || !onCheckout}
      onPress={() => { if (catalog.status === 'ready' && validSandboxOffer(catalog.offer)) onCheckout?.(catalog.offer.sku); }} />
    {catalog.status === 'error' && onRetry && <Button label="Retry catalog" onPress={onRetry} secondary />}
  </View>;
}

export function ShopScreen({ catalog = { status: 'unconfigured', reason: 'not-connected' }, onBack, onCheckout, onRetry }: {
  catalog?: CatalogState; onBack: () => void; onCheckout?: (sku: CheckoutSku) => void; onRetry?: () => void;
}) {
  const [selected, setSelected] = useState<PlaceholderItem | null>(null);
  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.page}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={selected ? 'Back to shop' : 'Back to pigeons'}
            onPress={() => selected ? setSelected(null) : onBack()} style={s.back}>
            <Text style={s.backText}>← {selected ? 'Shop' : 'Back'}</Text>
          </Pressable>
          <Text style={s.wordmark}>pigeon.</Text>
        </View>
        {selected ? <>
          <Text style={s.eyebrow}>FREE PREVIEW · PLACEHOLDER</Text>
          <Text accessibilityRole="header" style={s.title}>Just trying{ '\n' }things on.</Text>
          <PigeonPreview large />
          <View style={s.stack}>
            <Text style={s.sectionTitle}>{selected.title}</Text>
            <Text style={s.body}>{selected.description}</Text>
            <Text style={s.price}>Price to be decided</Text>
            <Text style={s.small}>This preview doesn’t buy, unlock or equip anything. Your pigeon and gameplay stay exactly as they are.</Text>
          </View>
          <Button label="Done previewing" onPress={() => setSelected(null)} secondary />
        </> : <>
          <View style={s.stack}>
            <Text style={s.eyebrow}>THE LITTLE SHOP</Text>
            <Text accessibilityRole="header" style={s.title}>A little more{ '\n' }you.</Text>
            <Text style={s.body}>A home for future pigeon cosmetics.{ '\n' }For now, just a look around.</Text>
          </View>
          {placeholderItems.map((item) => <View key={item.id} style={s.card}>
            <View style={s.cardTop}><Text style={s.badge}>PLACEHOLDER</Text><Text style={s.small}>01 / a future cosmetic</Text></View>
            <PigeonPreview />
            <View style={s.cardBody}>
              <Text style={s.sectionTitle}>{item.title}</Text>
              <Text style={s.small}>Final item & design coming later.</Text>
              <Text style={s.price}>Price to be decided</Text>
              <Button label="Preview for free" onPress={() => setSelected(item)} secondary />
            </View>
          </View>)}
        </>}
        <SandboxCheckout catalog={catalog} onCheckout={onCheckout} onRetry={onRetry} />
        <Text style={s.footnote}>Cosmetics only. No stones, boosts or game advantages.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

export function ShopReceipt({ receipt, onBack, onRefresh }: {
  receipt: ReceiptState; onBack: () => void; onRefresh?: () => void;
}) {
  let title = 'Checking your order';
  let copy = 'Waiting for the authenticated server record. Returning from checkout is not proof of payment.';
  if (receipt.status === 'error') { title = 'Couldn’t check this order'; copy = 'Refresh to try again. No purchase or ownership is assumed.'; }
  if (receipt.status === 'unavailable') { title = 'Order unavailable'; copy = 'This order was not found for your signed-in account.'; }
  if (receipt.status === 'order') {
    const status = receipt.order.status;
    if (status === 'pending') { title = 'Waiting for confirmation'; copy = 'You can leave this screen. A canceled or closed checkout may still show pending until the server receives an update.'; }
    if (status === 'paid') { title = 'Sandbox payment confirmed'; copy = 'The server confirmed this test payment. Equipping still requires a current server-verified entitlement.'; }
    if (status === 'failed') { title = 'Checkout didn’t complete'; copy = 'The server reports a failed or canceled payment. Refresh the order before trying checkout again.'; }
    if (status === 'refunded') { title = 'Payment reversed'; copy = 'The server reports this test payment as reversed. This receipt doesn’t grant an outfit.'; }
    if (status === 'reconciliation') { title = 'Order needs a closer look'; copy = 'The server is reconciling this payment. Don’t pay again; contact the demo operator.'; }
  }
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.scroll}><View style={s.page}>
    <Text style={s.wordmark}>pigeon.</Text>
    <Text style={s.eyebrow}>WHOP SANDBOX · TEST MODE</Text>
    <Text accessibilityRole="header" style={s.title}>{title}</Text>
    {receipt.status === 'loading' && <ActivityIndicator color="#2453FF" accessibilityLabel="Loading order" />}
    <Text accessibilityLiveRegion="polite" style={s.body}>{copy}</Text>
    {receipt.status === 'order' && <Text style={s.small}>Order reference: {receipt.order.id}</Text>}
    {onRefresh && receipt.status !== 'loading' && <Button label="Refresh order" onPress={onRefresh} />}
    <Button label="Back to shop" onPress={onBack} secondary />
  </View></ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  page: { width: '100%', maxWidth: 440, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back: { minHeight: 44, minWidth: 60, justifyContent: 'center' },
  backText: { fontSize: 15, color: '#2453FF', fontWeight: '600' },
  wordmark: { fontSize: 30, fontWeight: '800', letterSpacing: -1.6, color: '#2453FF' },
  eyebrow: { fontSize: 11, lineHeight: 17, letterSpacing: 1.5, color: '#2453FF', fontWeight: '700' },
  title: { fontSize: 40, lineHeight: 44, letterSpacing: -1.5, color: '#17212B', fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, color: '#445164' },
  small: { fontSize: 13, lineHeight: 20, color: '#536176' },
  stack: { gap: 12 },
  card: { borderWidth: 1, borderColor: '#DAE3F1', borderRadius: 20, overflow: 'hidden' },
  cardTop: { padding: 16, paddingBottom: 0, gap: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F2F6FF' },
  badge: { fontSize: 10, lineHeight: 16, letterSpacing: 1, fontWeight: '700', color: '#2453FF', backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  preview: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, backgroundColor: '#F2F6FF' },
  largePreview: { borderRadius: 20, paddingVertical: 24 },
  previewLabel: { fontSize: 9, lineHeight: 15, letterSpacing: 0.7, textAlign: 'center', color: '#536176' },
  cardBody: { padding: 18, gap: 10 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: '#17212B', letterSpacing: -0.4 },
  price: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: '#17212B' },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2453FF' },
  buttonText: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  secondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCD9FF' },
  secondaryText: { color: '#2453FF' },
  disabled: { backgroundColor: '#EBEFF5' },
  disabledText: { color: '#657185' },
  pressed: { opacity: 0.7 },
  sandbox: { gap: 12, paddingTop: 4 },
  footnote: { fontSize: 11, lineHeight: 18, color: '#657185', textAlign: 'center' },
});
