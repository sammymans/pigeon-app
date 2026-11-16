import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { inputStyles } from '../inputStyles';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { arrivalLabel, canOpenLetter, isUnopened, nextArrival, replyCountdown, type MailLetter, type MailPerson, type PersonMailbox } from '../mailboxModel';
import { a, Copy, font, Icon, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';
import { Pigeon } from '../Pigeon';
import type { FlockBird } from './MapScreen';
import { CoopPicker } from './CoopPicker';

export function MailBackdrop() {
  return <Svg pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none"><Defs><LinearGradient id="mail-water" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.3" stopColor="white" /><Stop offset="1" stopColor="#EAF1F7" /></LinearGradient><LinearGradient id="mail-land" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.4" stopColor="#E2EAF1" stopOpacity="0" /><Stop offset="1" stopColor="#DCE5ED" stopOpacity="0.6" /></LinearGradient></Defs><Rect width="390" height="844" fill="url(#mail-water)" /><Path d="M0 410 45 400 95 434 84 470 115 496 77 536 95 571 61 618 68 656 26 691 14 737 0 727ZM390 459 348 453 336 489 354 519 327 555 352 604 379 612 390 639ZM110 399 160 417 169 451 149 485 125 470Z" fill="url(#mail-land)" /></Svg>;
}

export function MailHeader({ title, subtitle, onBack, onCompose, onMenu, large = false }: { title: string; subtitle?: string; onBack: () => void; onCompose?: () => void; onMenu?: () => void; large?: boolean }) {
  return <View style={m.header}><IconButton name="back" label="Back" onPress={onBack} /><View style={[{ flex: 1, gap: 3 }, !large && { alignItems: 'center' }]}><Text accessibilityRole="header" style={[m.title, large && m.largeTitle]}>{title}</Text>{subtitle && <Copy style={a.small}>{subtitle}</Copy>}</View>{onCompose ? <Pressable accessibilityRole="button" accessibilityLabel="Write a new letter" onPress={onCompose} style={m.composeButton}><Icon name="compose" color="white" /></Pressable> : onMenu ? <IconButton name="more" label="Conversation options" onPress={onMenu} /> : <View style={{ width: 44 }} />}</View>;
}

export function SearchField({ value, onChange, placeholder = 'Find someone', outlined = false }: { value: string; onChange: (value: string) => void; placeholder?: string; outlined?: boolean }) {
  return <View style={[m.search, outlined && m.searchOutlined]}><Icon name="search" size={20} color={palette.muted} /><TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={palette.muted} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={m.searchInput} /></View>;
}

export function MailboxGrid({ people, now, loading, notice, onBack, onCompose, onPerson }: { people: PersonMailbox[]; now: number | null; loading?: boolean; notice?: ReactNode; onBack: () => void; onCompose: () => void; onPerson: (person: PersonMailbox) => void }) {
  const insets = usePageInsets();
  const [search, setSearch] = useState('');
  const matches = people.filter(person => `${person.name} ${person.city}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const unopened = people.reduce((count, person) => count + person.unopened, 0);
  const arriving = arrivalLabel(nextArrival(people.flatMap(person => person.letters)), now);
  return <PageFrame style={{ paddingTop: insets.top }}><MailBackdrop /><MailHeader title="Mailbox" large onBack={onBack} onCompose={onCompose} /><View style={m.searchWrap}><SearchField value={search} onChange={setSearch} /></View><ScrollView style={a.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 }}>
    {notice}<View style={[a.between, { paddingTop: 10, paddingBottom: 24 }]}><Copy style={a.small}>People · A–Z</Copy><Copy style={[a.small, { color: palette.blue }]}>{unopened ? `●  ${unopened} unopened` : 'All caught up'}</Copy></View>
    <View style={m.grid}>{matches.map(person => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`${person.name}, ${person.letters.length} letters, ${person.unopened} unopened`} onPress={() => onPerson(person)} style={({ pressed }) => [m.mailbox, pressed && { opacity: 0.7 }]}>
      <View style={m.mailboxBack} /><View style={m.paperPeek} /><View style={m.miniEnvelope}><EnvelopeArt /></View><View style={m.mailboxFront}><Text numberOfLines={1} style={m.personName}>{person.name}</Text><Copy style={a.small}>{person.letters.length} {person.letters.length === 1 ? 'letter' : 'letters'}</Copy></View>{person.unopened > 0 && <View style={m.badge}><Text style={m.badgeText}>{person.unopened}</Text></View>}
    </Pressable>)}</View>
    {matches.length === 0 && <View style={m.empty}><Icon name="mail" size={38} color={palette.muted} /><Text style={m.title}>{loading ? 'Finding your mailboxes…' : search ? 'No one by that name' : 'A mailbox for every person.'}</Text><Copy style={{ textAlign: 'center', lineHeight: 22 }}>{search ? 'Try another name or city.' : 'Your friends and the letters you share will appear here.'}</Copy>{!loading && !search && <PrimaryButton label="Write your first letter" onPress={onCompose} />}</View>}
  </ScrollView>{arriving && <View style={[m.arrival, { paddingBottom: insets.bottom + 18 }]}><Text style={{ color: '#8DA6DD' }}>•</Text><Copy style={a.small}>{arriving}</Copy></View>}</PageFrame>;
}

export function EnvelopeArt({ highlighted = false }: { highlighted?: boolean }) {
  return <Svg pointerEvents="none" aria-hidden width="100%" height="100%" viewBox="0 0 300 170" preserveAspectRatio="none"><Rect width="300" height="170" rx="5" fill="white" /><Path d="M0 0H300L155 96Q150 100 145 96Z" fill={highlighted ? '#F0F4FF' : '#F5F7FA'} stroke="#E3EAF4" strokeWidth="1" /></Svg>;
}

export function LetterEnvelope({ letter, name, now, onOpen }: { letter: MailLetter; name: string; now: number | null; onOpen: () => void }) {
  const unopened = isUnopened(letter);
  const available = canOpenLetter(letter);
  const time = new Date(letter.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = new Date(letter.at).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const state = letter.state === 'in_flight' ? (now !== null && now >= letter.arrivesAt ? 'Landing' : 'In flight') : unopened ? 'Unopened' : letter.state === 'intercepted' ? 'Caught nearby' : letter.direction === 'outgoing' ? 'Delivered' : '';
  return <View style={[m.threadLetter, { alignSelf: letter.direction === 'outgoing' ? 'flex-end' : 'flex-start' }]}><View style={[a.between, { gap: 8, paddingBottom: 12 }]}><Copy style={[a.small, { fontWeight: '600' }]}>{letter.direction === 'outgoing' ? 'You' : name}</Copy><Copy style={[a.small, { color: unopened ? palette.blue : palette.muted }]}>{state ? `${state} · ` : ''}{unopened ? time : date}</Copy></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${available ? unopened ? 'Open letter' : 'Open again' : 'Letter in flight'} ${letter.direction === 'outgoing' ? 'from you' : `from ${name}`}, ${date}`} accessibilityState={{ disabled: !available }} disabled={!available} onPress={onOpen} style={({ pressed }) => [m.envelope, pressed && { opacity: 0.75 }]}><EnvelopeArt highlighted={unopened} /><View style={[m.seal, unopened && { backgroundColor: palette.blue }]}><Icon name={available ? 'down' : 'lock'} size={16} color={unopened ? 'white' : '#9DADBE'} /></View><Text style={[m.envelopeAction, { color: unopened ? palette.blue : palette.muted }]}>{available ? unopened ? 'Open letter' : 'Open again' : letter.state === 'intercepted' ? 'Intercepted' : 'Still on the wing'}</Text></Pressable>
  </View>;
}

export function LetterThread({ person, now, onBack, onCompose, onOpen, children }: { person: PersonMailbox; now: number | null; onBack: () => void; onCompose?: () => void; onOpen: (letter: MailLetter) => void; children?: ReactNode }) {
  const insets = usePageInsets();
  const arriving = arrivalLabel(nextArrival(person.letters), now);
  const [options, setOptions] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positioned = useRef(false);
  useEffect(() => { positioned.current = false; }, [person.id]);
  let previousDay = '';
  return <PageFrame style={{ paddingTop: insets.top }}><MailBackdrop /><MailHeader title={person.name} subtitle={`${person.city} · ${person.letters.length} ${person.letters.length === 1 ? 'letter' : 'letters'}`} onBack={onBack} onMenu={() => setOptions(!options)} />{options && <View style={{ paddingHorizontal: 24, paddingVertical: 12, gap: 12 }}><Copy>Letters stay folded until you open them.</Copy><PrimaryButton compact label="Back to all mailboxes" onPress={onBack} /></View>}
    <ScrollView style={a.scroll} nestedScrollEnabled ref={scroll} onContentSizeChange={() => { if (!positioned.current) { scroll.current?.scrollToEnd({ animated: false }); positioned.current = true; } }} contentContainerStyle={{ padding: 24, paddingTop: 30, gap: 24, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {person.letters.length === 0 && <View style={m.empty}><Icon name="mail" size={38} color={palette.muted} /><Text style={m.title}>Your first hello starts here.</Text><Copy>Write a little something to {person.name}.</Copy></View>}
      {person.letters.filter(letter => letter.direction === 'outgoing' || letter.state !== 'in_flight').map(letter => { const day = new Date(letter.at).toDateString(); const today = now !== null && day === new Date(now).toDateString(); const showDay = day !== previousDay; previousDay = day; return <View key={letter.id}>{showDay && <Copy style={[a.small, { textAlign: 'center', marginBottom: 20 }]}>{today ? 'Today' : new Date(letter.at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Copy>}<LetterEnvelope letter={letter} name={person.name} now={now} onOpen={() => onOpen(letter)} /></View>; })}
      {arriving && <View style={[a.row, { alignSelf: 'flex-end', gap: 8, paddingVertical: 22 }]}><Icon name="lock" size={15} color="#8D9BAC" /><Copy style={a.small}>{arriving}</Copy></View>}
    </ScrollView><View style={[m.footer, { paddingBottom: insets.bottom + 6 }]}><PrimaryButton label="Write a letter" onPress={onCompose} disabled={!onCompose} /></View>{children}</PageFrame>;
}

export function LetterSheet({ title, subtitle, onClose, children, footer, action, onAction, disabled = false, arrow = false, compose = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; action?: string; onAction?: () => void; disabled?: boolean; arrow?: boolean; compose?: boolean }) {
  const insets = usePageInsets();
  const entrance = useRef(new Animated.Value(28)).current;
  useEffect(() => { Animated.spring(entrance, { toValue: 0, damping: 25, stiffness: 240, useNativeDriver: true }).start(); }, [entrance]);
  return <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent><View style={m.modal}><Pressable accessibilityRole="button" accessibilityLabel="Close letter" onPress={onClose} style={StyleSheet.absoluteFill} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[m.sheetArea, { paddingTop: insets.top + 82 }]} pointerEvents="box-none"><Animated.View accessibilityViewIsModal style={[m.sheet, { paddingBottom: insets.bottom + 6, transform: [{ translateY: entrance }] }]}><View style={m.handle} /><View style={m.sheetHeading}><View style={{ flex: 1, gap: 8 }}><Text accessibilityRole="header" style={m.title}>{title}</Text>{subtitle && <Copy style={a.small}>{subtitle}</Copy>}</View><Pressable accessibilityRole="button" accessibilityLabel="Close letter" onPress={onClose} style={m.close}><Icon name="close" size={18} color={palette.muted} /></Pressable></View><ScrollView style={a.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: compose ? 6 : 38, paddingBottom: 24 }}>{children}</ScrollView>{footer && <View style={m.sheetFooter}>{footer}</View>}{action && <View style={{ paddingHorizontal: 24, paddingTop: 22 }}><PrimaryButton label={action} onPress={onAction} disabled={disabled} arrow={arrow} /></View>}</Animated.View></KeyboardAvoidingView></View></Modal>;
}

export function ReadingSheet({ person, letter, body, signature, now, onClose, onReply, notice }: { person: MailPerson; letter: MailLetter; body: string | null; signature?: string; now: number | null; onClose: () => void; onReply?: () => void; notice?: ReactNode }) {
  const expired = letter.replyBy !== undefined && now !== null && now >= letter.replyBy;
  return <LetterSheet title={letter.direction === 'outgoing' ? `To ${person.name}` : `From ${person.name}`} subtitle={`${letter.caught ? 'Caught near you' : person.city} · ${new Date(letter.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${new Date(letter.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} onClose={onClose} action={onReply ? expired ? `${letter.courier} has flown home` : 'Reply' : undefined} onAction={onReply} disabled={expired || body === null} footer={<Copy style={[a.small, { textAlign: 'center', lineHeight: 20 }]}>{letter.replyBy && now !== null ? expired ? 'This pigeon’s visit has ended.' : <>Reply within <Text style={{ color: palette.blue, fontWeight: '600' }}>{replyCountdown(letter.replyBy, now)}</Text> before {letter.courier} flies home.</> : `Delivered by ${letter.courier}`}</Copy>}>
    {body !== null ? <><Text selectable style={m.letterText}>{body}</Text><Text style={m.signature}>— {signature ?? (letter.direction === 'outgoing' ? 'You' : person.name)}</Text></> : notice ?? <Copy>Opening your letter…</Copy>}
  </LetterSheet>;
}

export function ComposerSheet({ person, replying, body, signature, saved, limit = 500, locked, footer, notice, hideName, onHideName, onChange, onClose, onNext, onRecipient }: { person?: MailPerson; replying?: boolean; body: string; signature: string; saved: boolean; limit?: number; locked?: boolean; footer?: ReactNode; notice?: ReactNode; hideName?: boolean; onHideName?: (value: boolean) => void; onChange: (body: string) => void; onClose: () => void; onNext: () => void; onRecipient?: () => void }) {
  const count = Array.from(body).length;
  return <LetterSheet compose title="Your letter" subtitle="2 of 3 · Write" onClose={onClose} action={replying ? 'Review reply' : 'Choose a pigeon'} arrow onAction={onNext} disabled={!locked && (!body.trim() || count > limit)} footer={<View style={m.composerFooter}>
    {onHideName && <Pressable accessibilityRole="switch" accessibilityLabel="Send anonymously" accessibilityState={{ checked: hideName, disabled: locked }} disabled={locked} onPress={() => onHideName(!hideName)} style={[a.between, { minHeight: 48 }]}><Copy>Send anonymously</Copy><View style={[m.toggle, hideName && { backgroundColor: palette.blue }]}><View style={[m.toggleThumb, hideName && { alignSelf: 'flex-end' }]} /></View></Pressable>}
    <View style={a.between}><View style={{ flex: 1 }}>{footer ?? <Copy style={a.small}>{saved ? 'Saved as a draft' : 'Saving your draft…'}</Copy>}</View><Copy style={[a.small, count > limit && { color: '#AE3046' }]}>{count} / {limit}</Copy></View>
  </View>}>
    <View style={m.composerRecipient}><Text numberOfLines={2} style={m.recipientAddress}>To <Text style={{ fontWeight: '600' }}>{person?.name ?? 'your pen pal'}</Text>{person && <Text style={{ color: palette.muted }}> · {person.city}</Text>}</Text>{onRecipient && !locked && <Pressable accessibilityRole="button" accessibilityLabel="Change recipient" onPress={onRecipient} hitSlop={8} style={{ minHeight: 42, justifyContent: 'center' }}><Copy style={{ color: palette.blue, fontWeight: '600' }}>Change</Copy></Pressable>}</View>
    {notice}<TextInput accessibilityLabel="Your letter" placeholder={person ? `Dear ${person.name},\n\nWrite a little hello…` : 'Write a little hello…'} placeholderTextColor="#9BA6B4" value={body} onChangeText={onChange} multiline scrollEnabled={false} editable={!locked} style={[m.letterText, { minHeight: 64, textAlignVertical: 'top', padding: 0 }]} /><Text style={m.signature}>— {signature}</Text>
  </LetterSheet>;
}

export function RecipientPicker({ people, selected, onSelect, onBack, onNext, nearby, notice, onInvite }: { people: MailPerson[]; selected: string; onSelect: (id: string) => void; onBack: () => void; onNext: () => void; nearby?: MailPerson; notice?: ReactNode; onInvite?: (person: MailPerson) => void }) {
  const insets = usePageInsets();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'Friends' | 'Contacts' | 'Nearby'>(selected === nearby?.id ? 'Nearby' : people.find(person => person.id === selected)?.invited ? 'Contacts' : 'Friends');
  const [showAll, setShowAll] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteCity, setInviteCity] = useState('Vancouver');
  const source = tab === 'Nearby' ? nearby ? [nearby] : [] : people.filter(person => tab === 'Contacts' ? person.invited : !person.invited);
  const matches = source.filter(person => `${person.name} ${person.city}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const visiblePeople = !search && !showAll && matches.length > 3 ? [...matches.slice(0, 3)] : matches;
  const selectedPerson = matches.find(person => person.id === selected);
  if (selectedPerson && !visiblePeople.includes(selectedPerson)) visiblePeople[visiblePeople.length - 1] = selectedPerson;
  const chosen = people.find(person => person.id === selected) ?? (nearby?.id === selected ? nearby : undefined);
  const invite = () => {
    if (!inviteName.trim() || !onInvite) return;
    onInvite({ id: `invite:${inviteName.trim().toLocaleLowerCase()}:${inviteCity}`, name: inviteName.trim(), city: inviteCity, invited: true });
    setSearch(''); setTab('Contacts'); setInviting(false);
  };
  return <PageFrame style={{ paddingTop: insets.top }}><MailBackdrop /><View style={m.flowHeader}><MailHeader title="Who’s it for?" onBack={onBack} /></View><Copy style={m.stepLabel}>1 of 3 · Recipient</Copy>
    <View style={m.recipientSearch}><SearchField value={search} onChange={setSearch} placeholder="Name or phone number" outlined /></View>
    <View accessibilityRole="tablist" style={m.recipientTabs}>{(['Friends', 'Contacts', 'Nearby'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value} accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[m.recipientTab, tab === value && { backgroundColor: palette.ink }]}><Copy style={[{ color: palette.secondary }, tab === value && { color: 'white', fontWeight: '600' }]}>{value}</Copy></Pressable>)}</View>
    <ScrollView style={a.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={m.recipientList}>
      {notice}<Copy style={{ paddingBottom: 10 }}>{tab === 'Friends' ? 'Your Pigeon friends' : tab === 'Contacts' ? 'Invite someone to Pigeon' : 'A little mail for someone nearby'}</Copy>
      {visiblePeople.map(person => <Pressable key={person.id} accessibilityRole="radio" accessibilityLabel={`Write to ${person.name} in ${person.city}`} accessibilityState={{ checked: selected === person.id }} onPress={() => onSelect(person.id)} style={[m.recipient, selected === person.id && m.selected]}><View style={[m.avatar, selected === person.id && { backgroundColor: palette.pale }]}>{person.id === nearby?.id ? <Icon name="nearby" color={palette.muted} /> : <Copy style={selected === person.id ? { color: palette.blue } : undefined}>{person.name[0]?.toUpperCase()}</Copy>}</View><View style={{ flex: 1, gap: 4 }}><Text style={m.personName}>{person.name}</Text><Copy style={a.small}>{person.city}{person.invited ? ' · Invite with letter' : ''}</Copy></View>{selected === person.id && <Selection />}</Pressable>)}
      {!search && matches.length > 3 && <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)} style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 14 }}><Copy style={[a.small, { color: palette.blue }]}>{showAll ? 'Show fewer people' : `See all ${matches.length} people`}</Copy></Pressable>}
      {!matches.length && <Copy style={{ lineHeight: 22, paddingVertical: 12 }}>{tab === 'Contacts' ? onInvite ? 'Add a name or phone number to try an invitation. Device contacts aren’t connected in this preview.' : 'Use a friend invitation to connect before sending a letter.' : tab === 'Nearby' ? 'Nearby recipients aren’t available yet.' : search ? 'No friends match your search.' : 'Your first pen pal is one hello away.'}</Copy>}
      {onInvite && (tab === 'Contacts' || Boolean(search.trim())) && <Pressable accessibilityRole="button" accessibilityLabel="Invite someone new" onPress={() => { setInviteName(search); setInviting(true); }} style={m.recipient}><View style={m.avatar}><Icon name="plus" color={palette.blue} /></View><View style={{ flex: 1, gap: 5 }}><Text style={m.personName}>Invite someone new</Text><Copy style={a.small}>Their first letter starts here</Copy></View><Icon name="arrow" size={18} color={palette.muted} /></Pressable>}
      <View style={{ flex: 1, minHeight: 24 }} /><Copy style={m.recipientHint}>{onInvite ? 'Not on Pigeon? Enter any phone number, or find someone in your contacts.' : 'Choose a Pigeon friend, or invite someone to join your flock.'}</Copy>
    </ScrollView>
    <View style={[m.footer, m.flowFooter, { paddingBottom: insets.bottom + 6 }]}><PrimaryButton label={chosen ? `Write to ${chosen.name}` : 'Write the letter'} arrow onPress={onNext} disabled={!chosen} /></View>
    {inviting && <LetterSheet title="A new pen pal" subtitle="Invite someone with their first letter" onClose={() => setInviting(false)} action="Address this letter" onAction={invite} disabled={!inviteName.trim()}>
      <View style={{ gap: 20 }}><Copy>Who would you like to write to?</Copy><TextInput accessibilityLabel="Friend’s name or phone number" placeholder="Name or phone number" placeholderTextColor={palette.muted} maxLength={40} value={inviteName} onChangeText={setInviteName} style={[m.searchInput, m.inviteInput]} /><Copy>Where will your letter fly?</Copy><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['Vancouver', 'San Francisco', 'New York', 'London', 'Paris', 'Berlin', 'Chicago'].map(city => <Pressable key={city} accessibilityRole="radio" accessibilityLabel={city} accessibilityState={{ checked: city === inviteCity }} onPress={() => setInviteCity(city)} style={[m.cityChoice, city === inviteCity && m.selected]}><Copy style={city === inviteCity ? { color: palette.blue } : undefined}>{city}</Copy></Pressable>)}</View><Copy style={[a.small, { lineHeight: 20 }]}>Try an invitation in this demo. No invitation or message is sent to a real person.</Copy></View>
    </LetterSheet>}
  </PageFrame>;
}

function Selection() { return <View style={m.selection}><Icon name="check" size={14} color="white" /></View>; }

export type DeliveryDetails = { origin: string; destination: string; distanceKm: number; arrivesAt: number; treated?: boolean; demoRoute?: boolean };
export function SendReview({ person, sender, birds, selected, estimate, delivery, returning, notice, details, disabled, action, pigeonPrice, onSelect, onBack, onSend, onShop, onSave }: { person: MailPerson; sender: string; birds: FlockBird[]; selected: string; estimate: string; delivery?: DeliveryDetails; returning?: string; notice?: ReactNode; details?: ReactNode; disabled?: boolean; action?: string; pigeonPrice?: string; onSelect: (id: string) => void; onBack: () => void; onSend: () => void; onShop?: () => void; onSave?: () => void }) {
  const insets = usePageInsets();
  const bird = birds.find(item => item.id === selected);
  const ready = birds.filter(item => item.status === 'Ready' && !item.egg).length;
  const available = Boolean(returning || (bird?.status === 'Ready' && !bird.egg));
  const empty = !returning && ready === 0;
  const away = birds.some(item => item.status === 'Flying');
  const courier = returning ?? bird?.name;
  const canShop = empty && onShop && !action;
  const [showFlightDetails, setShowFlightDetails] = useState(false);
  return <PageFrame style={{ paddingTop: insets.top }}><MailBackdrop /><View style={m.flowHeader}><MailHeader title="Load your letter" onBack={onBack} /></View><Copy style={m.stepLabel}>3 of 3 · Pigeon</Copy>
    <ScrollView style={a.scroll} nestedScrollEnabled contentContainerStyle={m.reviewContent}>
      <View style={[a.between, { gap: 16 }]}><Text numberOfLines={1} style={[m.personName, { flexShrink: 1, fontSize: 15 }]}>To {person.name}</Text><Copy style={a.small}>{person.city}{person.city === 'Vancouver' ? ', Canada' : person.city === 'London' ? ', UK' : ''}</Copy></View>
      <View style={m.loadedEnvelope}><Svg pointerEvents="none" aria-hidden width="100%" height="100%" viewBox="0 0 342 96" preserveAspectRatio="none"><Path d="M51 0H291L171 68Z" fill="#F5F7FA" stroke="#E3EAF4" strokeWidth="0.7" /></Svg><View style={m.loadedSeal} /><Copy style={m.envelopeSender}>From {sender}</Copy></View>
      {person.invited && <Copy style={[a.small, { color: palette.blue, marginTop: 10 }]}>Invitation preview · their first letter</Copy>}
      <View style={m.coopSection}><View style={a.between}><Text style={m.coopTitle}>{returning ? 'Your returning pigeon' : 'Your coop'}</Text>{!returning && <Copy style={{ color: palette.blue }}>{ready} ready</Copy>}</View><Copy style={{ marginTop: 6, lineHeight: 21 }}>{returning ? `${returning} is ready to take your reply home.` : empty ? away ? 'All your pigeons are on a job.' : birds.length ? 'Your pigeons aren’t ready to fly yet.' : 'A little room for your first pigeon.' : 'Tap a pigeon to load your letter.'}</Copy>
        <View style={{ marginTop: 18 }}>{returning ? <View style={{ alignItems: 'center', height: 198 }}><Pigeon name={returning} size={170} /></View> : <CoopPicker birds={birds} selected={selected} onSelect={onSelect} />}</View>
        {empty && <Copy style={{ textAlign: 'center', marginTop: -4 }}>{away ? 'Your pigeons will be back soon.' : birds.length ? 'Your letter can wait until they’re ready.' : 'Your letter is waiting for a little courier.'}</Copy>}
      </View>
      <View style={m.readyMessage}><Text style={m.readyTitle}>{empty ? 'A new pigeon, ready for this letter.' : available ? `Your letter is ready for ${courier}.` : 'Choose a pigeon for your letter.'}</Text><Pressable accessibilityRole={delivery && !empty ? 'button' : undefined} accessibilityLabel={delivery && !empty ? `Flight time ${estimate}. View flight details` : undefined} accessibilityState={delivery && !empty ? { expanded: showFlightDetails } : undefined} disabled={!delivery || empty} onPress={() => setShowFlightDetails(!showFlightDetails)} hitSlop={8}><Text style={[a.body, { textAlign: 'center', lineHeight: 22 }]}>{empty ? 'One-time purchase · yours to keep' : `Estimated arrival · ${estimate}`}</Text></Pressable></View>
      {delivery && !empty && showFlightDetails && <View style={[m.deliveryCard, { marginTop: 16 }]}><Copy>{delivery.origin} → {delivery.destination}</Copy><Copy style={a.small}>{Math.round(delivery.distanceKm).toLocaleString()} km · 60 km/h{delivery.treated ? ' · 10% tailwind boost' : ''}</Copy><Copy style={[a.small, { lineHeight: 20 }]}>Arrives {new Date(delivery.arrivesAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(delivery.arrivesAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Copy>{delivery.demoRoute && <Copy style={a.small}>Demo route · San Francisco to Vancouver</Copy>}</View>}
      {details && <View style={{ marginTop: 24 }}>{details}</View>}
    </ScrollView>
    <View style={[m.footer, m.reviewFooter, { paddingBottom: insets.bottom + 6 }]}>{empty && onSave && !action ? <Pressable accessibilityRole="button" accessibilityLabel="Save this letter for later" onPress={onSave} style={{ minHeight: 32, justifyContent: 'center' }}><Copy style={[a.small, { textAlign: 'center' }]}>Save this letter for later</Copy></Pressable> : notice ?? <Copy style={[a.small, { textAlign: 'center' }]}>{returning ? 'Your reply can be intercepted on the way.' : 'Every pigeon can be intercepted.'}</Copy>}<PrimaryButton label={action ?? (canShop ? `Add a pigeon${pigeonPrice ? ` · ${pigeonPrice}` : ''}` : available ? `Send with ${courier}` : ready ? 'Choose a pigeon' : 'Waiting for a pigeon')} arrow={!action && available} onPress={canShop ? onShop : onSend} disabled={canShop ? false : disabled || (!action && !available)} /></View>
  </PageFrame>;
}

const m = StyleSheet.create({
  flowHeader: { height: 60, justifyContent: 'center' },
  stepLabel: { fontFamily: font.system, fontSize: 13, lineHeight: 20, textAlign: 'center', color: palette.muted, marginTop: 4, marginBottom: 10 },
  searchOutlined: { minHeight: 50, borderWidth: 1, borderColor: palette.line, borderRadius: 12, backgroundColor: 'white', paddingHorizontal: 16 },
  recipientSearch: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  recipientTabs: { flexDirection: 'row', marginHorizontal: 24, backgroundColor: '#EDF2F6', borderRadius: 24, padding: 4, marginBottom: 14 },
  recipientTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 32, borderRadius: 20 },
  recipientList: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24, gap: 8 },
  recipientHint: { fontSize: 14, lineHeight: 21, paddingBottom: 10 },
  flowFooter: { paddingTop: 18 },
  composerRecipient: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, marginBottom: 28 },
  recipientAddress: { flex: 1, fontFamily: font.system, fontSize: 15, lineHeight: 22, color: palette.ink },
  composerFooter: { gap: 28, paddingBottom: 4 },
  reviewContent: { paddingHorizontal: 24, paddingTop: 2, paddingBottom: 12 },
  loadedEnvelope: { height: 96, marginTop: 14, borderRadius: 6, backgroundColor: 'white', boxShadow: '0 5px 18px rgba(23,33,43,0.035)' },
  loadedSeal: { position: 'absolute', top: 48, alignSelf: 'center', width: 24, height: 24, borderRadius: 12, backgroundColor: palette.blue },
  envelopeSender: { position: 'absolute', bottom: 6, left: 16, right: 16, fontSize: 11, lineHeight: 16, color: palette.muted },
  coopSection: { marginTop: 28 },
  coopTitle: { fontFamily: font.heading, fontSize: 23, lineHeight: 30, letterSpacing: -0.5, color: palette.ink },
  readyMessage: { gap: 10, marginTop: 28, alignItems: 'center' },
  readyTitle: { fontFamily: font.system, fontSize: 16, lineHeight: 23, fontWeight: '600', textAlign: 'center', color: palette.blue },
  reviewFooter: { gap: 20, paddingTop: 12 },
  inviteInput: { flex: 0, borderWidth: 1, borderColor: palette.line, borderRadius: 12, paddingHorizontal: 14 },
  cityChoice: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: palette.line },
  deliveryCard: { padding: 22, borderRadius: 20, backgroundColor: 'white', gap: 10 },
  header: { flexShrink: 0, height: 76, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 2 },
  title: { fontFamily: font.heading, color: palette.ink, fontSize: 23, lineHeight: 31, letterSpacing: -0.65 },
  largeTitle: { fontFamily: font.brand, fontSize: 32, lineHeight: 40, letterSpacing: -1.1 },
  composeButton: { width: 44, height: 44, borderRadius: 24, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchWrap: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18 },
  search: { minHeight: 46, borderRadius: 13, backgroundColor: '#F3F5F8', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchInput: { ...inputStyles.singleLine, flex: 1, height: 46, fontSize: 15, fontFamily: font.system, color: palette.ink, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 24 },
  mailbox: { width: '47.5%', height: 146, marginTop: 10 },
  mailboxBack: { position: 'absolute', top: 12, bottom: 0, left: 0, right: 0, backgroundColor: '#E3EAF2', borderRadius: 17 },
  paperPeek: { position: 'absolute', top: 0, width: '72%', height: 70, left: '14%', borderRadius: 3, backgroundColor: '#F8FAFC', transform: [{ rotate: '-5deg' }] },
  miniEnvelope: { position: 'absolute', top: 12, width: '81%', height: 96, left: '9.5%' },
  mailboxFront: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 82, borderRadius: 5, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: '#EFF3F7', padding: 16, justifyContent: 'center', gap: 7, boxShadow: '0 3px 0 rgba(217,226,236,0.35)' },
  personName: { fontSize: 17, lineHeight: 22, color: palette.ink, fontWeight: '600', fontFamily: font.system },
  badge: { position: 'absolute', top: 1, right: 10, backgroundColor: palette.blue, borderRadius: 12, minWidth: 21, height: 21, paddingHorizontal: 4, borderWidth: 2, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontFamily: font.system, fontSize: 11, fontWeight: '600', color: 'white' },
  empty: { flex: 1, justifyContent: 'center', gap: 20, paddingVertical: 48 },
  arrival: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', paddingTop: 12 },
  threadLetter: { width: '69%' },
  envelope: { width: '100%', aspectRatio: 2.05, borderRadius: 5, backgroundColor: 'white', boxShadow: '0 5px 15px rgba(23,33,43,0.025)' },
  seal: { position: 'absolute', top: '49%', alignSelf: 'center', width: 30, height: 30, borderRadius: 15, backgroundColor: '#ECF1F6', alignItems: 'center', justifyContent: 'center' },
  envelopeAction: { position: 'absolute', bottom: 12, left: 14, fontFamily: font.system, fontSize: 12, color: palette.muted },
  footer: { flexShrink: 0, paddingTop: 16, paddingHorizontal: 24 },
  modal: { flex: 1, backgroundColor: 'rgba(23,33,43,0.10)' },
  sheetArea: { flex: 1, minHeight: 0, width: '100%', maxWidth: 480, alignSelf: 'center' },
  sheet: { flex: 1, minHeight: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'white', overflow: 'hidden' },
  handle: { height: 4, width: 36, borderRadius: 3, backgroundColor: '#DDE5EE', alignSelf: 'center', marginTop: 12 },
  sheetHeading: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  sheetFooter: { paddingHorizontal: 28, paddingTop: 12 },
  letterText: { fontFamily: font.regular, fontSize: 24, lineHeight: 33, letterSpacing: -0.5, color: palette.ink },
  signature: { fontFamily: font.regular, fontSize: 21, lineHeight: 30, color: palette.secondary, marginTop: 34 },
  recipient: { minHeight: 68, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 14 },
  selected: { borderColor: palette.blue, backgroundColor: 'white' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#DFE8F2', alignItems: 'center', justifyContent: 'center' },
  selection: { width: 19, height: 19, borderRadius: 10, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 40, height: 24, borderRadius: 14, padding: 3, backgroundColor: '#CED9E5' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'white' },
});
