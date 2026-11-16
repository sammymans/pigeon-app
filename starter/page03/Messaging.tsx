import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { arrivalLabel, canOpenLetter, isUnopened, nextArrival, replyCountdown, type MailLetter, type MailPerson, type PersonMailbox } from '../mailboxModel';
import { a, Copy, font, Icon, IconButton, PageFrame, palette, PrimaryButton, usePageInsets } from './atoms';
import { Pigeon } from '../Pigeon';
import type { FlockBird } from './MapScreen';

export function MailBackdrop() {
  return <Svg pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none"><Defs><LinearGradient id="mail-water" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.3" stopColor="white" /><Stop offset="1" stopColor="#EAF1F7" /></LinearGradient><LinearGradient id="mail-land" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.4" stopColor="#E2EAF1" stopOpacity="0" /><Stop offset="1" stopColor="#DCE5ED" stopOpacity="0.6" /></LinearGradient></Defs><Rect width="390" height="844" fill="url(#mail-water)" /><Path d="M0 410 45 400 95 434 84 470 115 496 77 536 95 571 61 618 68 656 26 691 14 737 0 727ZM390 459 348 453 336 489 354 519 327 555 352 604 379 612 390 639ZM110 399 160 417 169 451 149 485 125 470Z" fill="url(#mail-land)" /></Svg>;
}

export function MailHeader({ title, subtitle, onBack, onCompose, onMenu, large = false }: { title: string; subtitle?: string; onBack: () => void; onCompose?: () => void; onMenu?: () => void; large?: boolean }) {
  return <View style={m.header}><IconButton name="back" label="Back" onPress={onBack} /><View style={[{ flex: 1, gap: 3 }, !large && { alignItems: 'center' }]}><Text accessibilityRole="header" style={[m.title, large && m.largeTitle]}>{title}</Text>{subtitle && <Copy style={a.small}>{subtitle}</Copy>}</View>{onCompose ? <Pressable accessibilityRole="button" accessibilityLabel="Write a new letter" onPress={onCompose} style={m.composeButton}><Icon name="compose" color="white" /></Pressable> : onMenu ? <IconButton name="more" label="Conversation options" onPress={onMenu} /> : <View style={{ width: 44 }} />}</View>;
}

export function SearchField({ value, onChange, placeholder = 'Find someone' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <View style={m.search}><Icon name="search" size={20} color={palette.muted} /><TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={palette.muted} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={m.searchInput} /></View>;
}

export function MailboxGrid({ people, now, loading, notice, onBack, onCompose, onPerson }: { people: PersonMailbox[]; now: number | null; loading?: boolean; notice?: ReactNode; onBack: () => void; onCompose: () => void; onPerson: (person: PersonMailbox) => void }) {
  const insets = usePageInsets();
  const [search, setSearch] = useState('');
  const matches = people.filter(person => `${person.name} ${person.city}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const unopened = people.reduce((count, person) => count + person.unopened, 0);
  const arriving = arrivalLabel(nextArrival(people.flatMap(person => person.letters)), now);
  return <PageFrame style={{ paddingTop: insets.top }}><MailBackdrop /><MailHeader title="Mailbox" large onBack={onBack} onCompose={onCompose} /><View style={m.searchWrap}><SearchField value={search} onChange={setSearch} /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 }}>
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
    <ScrollView ref={scroll} onContentSizeChange={() => { if (!positioned.current) { scroll.current?.scrollToEnd({ animated: false }); positioned.current = true; } }} contentContainerStyle={{ padding: 24, paddingTop: 30, gap: 24, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {person.letters.length === 0 && <View style={m.empty}><Icon name="mail" size={38} color={palette.muted} /><Text style={m.title}>Your first hello starts here.</Text><Copy>Write a little something to {person.name}.</Copy></View>}
      {person.letters.filter(letter => letter.direction === 'outgoing' || letter.state !== 'in_flight').map(letter => { const day = new Date(letter.at).toDateString(); const today = now !== null && day === new Date(now).toDateString(); const showDay = day !== previousDay; previousDay = day; return <View key={letter.id}>{showDay && <Copy style={[a.small, { textAlign: 'center', marginBottom: 20 }]}>{today ? 'Today' : new Date(letter.at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Copy>}<LetterEnvelope letter={letter} name={person.name} now={now} onOpen={() => onOpen(letter)} /></View>; })}
      {arriving && <View style={[a.row, { alignSelf: 'flex-end', gap: 8, paddingVertical: 22 }]}><Icon name="lock" size={15} color="#8D9BAC" /><Copy style={a.small}>{arriving}</Copy></View>}
    </ScrollView><View style={[m.footer, { paddingBottom: insets.bottom + 6 }]}><PrimaryButton label="Write a letter" onPress={onCompose} disabled={!onCompose} /></View>{children}</PageFrame>;
}

export function LetterSheet({ title, subtitle, onClose, children, footer, action, onAction, disabled = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; action?: string; onAction?: () => void; disabled?: boolean }) {
  const insets = usePageInsets();
  const entrance = useRef(new Animated.Value(28)).current;
  useEffect(() => { Animated.spring(entrance, { toValue: 0, damping: 25, stiffness: 240, useNativeDriver: true }).start(); }, [entrance]);
  return <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent><View style={m.modal}><Pressable accessibilityRole="button" accessibilityLabel="Close letter" onPress={onClose} style={StyleSheet.absoluteFill} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[m.sheetArea, { paddingTop: insets.top + 82 }]} pointerEvents="box-none"><Animated.View accessibilityViewIsModal style={[m.sheet, { paddingBottom: insets.bottom + 6, transform: [{ translateY: entrance }] }]}><View style={m.handle} /><View style={m.sheetHeading}><View style={{ flex: 1, gap: 8 }}><Text accessibilityRole="header" style={m.title}>{title}</Text>{subtitle && <Copy style={a.small}>{subtitle}</Copy>}</View><Pressable accessibilityRole="button" accessibilityLabel="Close letter" onPress={onClose} style={m.close}><Icon name="close" size={18} color={palette.muted} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 38, paddingBottom: 24 }}>{children}</ScrollView>{footer && <View style={m.sheetFooter}>{footer}</View>}{action && <View style={{ paddingHorizontal: 24, paddingTop: 22 }}><PrimaryButton label={action} onPress={onAction} disabled={disabled} /></View>}</Animated.View></KeyboardAvoidingView></View></Modal>;
}

export function ReadingSheet({ person, letter, body, signature, now, onClose, onReply, notice }: { person: MailPerson; letter: MailLetter; body: string | null; signature?: string; now: number | null; onClose: () => void; onReply?: () => void; notice?: ReactNode }) {
  const expired = letter.replyBy !== undefined && now !== null && now >= letter.replyBy;
  return <LetterSheet title={letter.direction === 'outgoing' ? `To ${person.name}` : `From ${person.name}`} subtitle={`${letter.caught ? 'Caught near you' : person.city} · ${new Date(letter.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${new Date(letter.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} onClose={onClose} action={onReply ? expired ? `${letter.courier} has flown home` : 'Reply' : undefined} onAction={onReply} disabled={expired || body === null} footer={<Copy style={[a.small, { textAlign: 'center', lineHeight: 20 }]}>{letter.replyBy && now !== null ? expired ? 'This pigeon’s visit has ended.' : <>Reply within <Text style={{ color: palette.blue, fontWeight: '600' }}>{replyCountdown(letter.replyBy, now)}</Text> before {letter.courier} flies home.</> : `Delivered by ${letter.courier}`}</Copy>}>
    {body !== null ? <><Text selectable style={m.letterText}>{body}</Text><Text style={m.signature}>— {signature ?? (letter.direction === 'outgoing' ? 'You' : person.name)}</Text></> : notice ?? <Copy>Opening your letter…</Copy>}
  </LetterSheet>;
}

export function ComposerSheet({ person, replying, body, signature, saved, limit = 500, locked, footer, notice, onChange, onClose, onNext }: { person?: MailPerson; replying?: boolean; body: string; signature: string; saved: boolean; limit?: number; locked?: boolean; footer?: ReactNode; notice?: ReactNode; onChange: (body: string) => void; onClose: () => void; onNext: () => void }) {
  const count = Array.from(body).length;
  return <LetterSheet title={replying && person ? `Reply to ${person.name}` : 'New letter'} subtitle={replying && person ? person.city : 'Draft'} onClose={onClose} action="Next" onAction={onNext} disabled={!locked && (!body.trim() || count > limit)} footer={<View style={a.between}><View style={{ flex: 1 }}>{footer ?? <Copy style={a.small}>{saved ? 'Saved as a draft' : 'Saving your draft…'}</Copy>}</View><Copy style={[a.small, count > limit && { color: '#AE3046' }]}>{count} / {limit}</Copy></View>}>
    {notice}<TextInput accessibilityLabel="Your letter" placeholder="Something small you’d tell them if they were here…" placeholderTextColor="#9BA6B4" value={body} onChangeText={onChange} multiline editable={!locked} style={[m.letterText, { minHeight: 160, textAlignVertical: 'top', padding: 0 }]} /><Text style={m.signature}>— {signature}</Text>
  </LetterSheet>;
}

export function RecipientPicker({ people, selected, onSelect, onBack, onNext, nearby, hideName, onHideName, notice }: { people: MailPerson[]; selected: string; onSelect: (id: string) => void; onBack: () => void; onNext: () => void; nearby?: MailPerson; hideName?: boolean; onHideName?: (value: boolean) => void; notice?: ReactNode }) {
  const insets = usePageInsets(); const [search, setSearch] = useState('');
  const matches = people.filter(person => `${person.name} ${person.city}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <PageFrame style={{ paddingTop: insets.top }}><MailBackdrop /><MailHeader title="Who’s it for?" onBack={onBack} /><View style={[m.searchWrap, { paddingTop: 36 }]}><SearchField value={search} onChange={setSearch} placeholder="Name or city" /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 12, flexGrow: 1 }}>{notice}<Copy style={[a.small, { paddingBottom: 8 }]}>Your people</Copy>{matches.map(person => <Pressable key={person.id} accessibilityRole="radio" accessibilityLabel={`Write to ${person.name} in ${person.city}`} accessibilityState={{ checked: selected === person.id }} onPress={() => onSelect(person.id)} style={[m.recipient, selected === person.id && m.selected]}><View style={[m.avatar, selected === person.id && { backgroundColor: palette.pale }]}><Copy style={selected === person.id ? { color: palette.blue } : undefined}>{person.name[0]?.toUpperCase()}</Copy></View><View style={{ flex: 1, gap: 6 }}><Text style={m.personName}>{person.name}</Text><Copy style={a.small}>{person.city}</Copy></View>{selected === person.id && <Selection />}</Pressable>)}{!matches.length && <Copy>{search ? 'No people match your search.' : 'Add a friend to send your first letter.'}</Copy>}{nearby && !search && <Pressable accessibilityRole="radio" accessibilityLabel="Someone nearby" accessibilityState={{ checked: selected === nearby.id }} onPress={() => onSelect(nearby.id)} style={[m.recipient, { marginTop: 18 }, selected === nearby.id && m.selected]}><Icon name="nearby" color={palette.muted} /><View style={{ flex: 1, gap: 6, marginLeft: 12 }}><Text style={m.personName}>Someone nearby</Text><Copy style={a.small}>A little mail for a stranger</Copy></View>{selected === nearby.id && <Selection />}</Pressable>}</ScrollView>{onHideName && <Pressable accessibilityRole="switch" accessibilityLabel="Hide my name" accessibilityState={{ checked: hideName }} onPress={() => onHideName(!hideName)} style={[a.between, { margin: 24, minHeight: 44 }]}><Copy>Hide my name</Copy><View style={[m.toggle, hideName && { backgroundColor: palette.blue }]}><View style={[m.toggleThumb, hideName && { alignSelf: 'flex-end' }]} /></View></Pressable>}<View style={[m.footer, { paddingBottom: insets.bottom + 6 }]}><PrimaryButton label="Next" onPress={onNext} disabled={!selected} /></View></PageFrame>;
}

function Selection() { return <View style={m.selection}><Icon name="check" size={14} color="white" /></View>; }

export function SendReview({ person, sender, birds, selected, estimate, returning, notice, details, disabled, action, onSelect, onBack, onSend }: { person: MailPerson; sender: string; birds: FlockBird[]; selected: string; estimate: string; returning?: string; notice?: ReactNode; details?: ReactNode; disabled?: boolean; action?: string; onSelect: (id: string) => void; onBack: () => void; onSend: () => void }) {
  const insets = usePageInsets(); const bird = birds.find(item => item.id === selected);
  return <PageFrame style={{ paddingTop: insets.top }}><MailBackdrop /><MailHeader title={returning ? `Send ${returning} home` : 'Ready to fly'} onBack={onBack} /><ScrollView contentContainerStyle={{ padding: 24, gap: 26, flexGrow: 1 }}><View style={[a.between, { marginTop: 18 }]}><Text style={[m.personName, { fontSize: 15 }]}>To {person.name}</Text><Copy style={a.small}>{person.city}</Copy></View><View style={[m.envelope, { aspectRatio: 1.7 }]}><EnvelopeArt /><View style={[m.seal, { backgroundColor: palette.blue, width: 32, height: 32, borderRadius: 16 }]} /><Text style={[m.envelopeAction, { fontSize: 11 }]}>From {sender}</Text></View>
    {returning ? <View style={{ alignItems: 'center', gap: 20, paddingTop: 26 }}><View style={m.returnBird} /><Text style={[m.title, { textAlign: 'center' }]}>{returning} takes it from here.</Text><Copy style={{ textAlign: 'center', lineHeight: 24 }}>Your reply travels back to {person.name}{'\n'}with their pigeon.</Copy><Copy style={{ color: palette.ink, paddingTop: 8 }}>Arrives in {estimate}</Copy></View> : <View style={{ gap: 12, paddingTop: 14 }}><Text style={[m.title, { fontSize: 21, marginBottom: 10 }]}>Send with</Text>{birds.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.name}, ${item.status}`} accessibilityState={{ checked: selected === item.id, disabled: item.status !== 'Ready' }} disabled={item.status !== 'Ready'} onPress={() => onSelect(item.id)} style={[m.birdOption, selected === item.id && m.selected, selected === item.id && { backgroundColor: palette.pale }]}><Pigeon name={item.name} accessory={item.accessory} size={44} /><View style={{ flex: 1, gap: 5 }}><Text style={[m.personName, item.status !== 'Ready' && { color: palette.muted }]}>{item.name}</Text><Copy style={a.small}>{item.status === 'Ready' ? `Arrives in ${estimate}` : item.egg ? 'Still hatching' : 'In flight · on the way home'}</Copy></View>{item.status !== 'Ready' ? <Icon name="lock" size={16} color="#91A0B5" /> : selected === item.id ? <Selection /> : <View style={m.radio} />}</Pressable>)}{!birds.length && <Copy>Your courier will be assigned when you send.</Copy>}</View>}{details}
  </ScrollView><View style={[m.footer, { paddingBottom: insets.bottom + 6, gap: 20 }]}>{notice ?? <Copy style={[a.small, { textAlign: 'center' }]}>{returning ? 'Your reply can be intercepted on the way.' : 'Every pigeon can be intercepted.'}</Copy>}<PrimaryButton label={action ?? (returning ? 'Send reply' : `Let ${bird?.name ?? 'your pigeon'} fly`)} onPress={onSend} disabled={disabled} /></View></PageFrame>;
}

const m = StyleSheet.create({
  header: { height: 76, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 2 },
  title: { fontFamily: font.heading, color: palette.ink, fontSize: 25, lineHeight: 31, letterSpacing: -0.65 },
  largeTitle: { fontFamily: font.brand, fontSize: 32, lineHeight: 40, letterSpacing: -1.1 },
  composeButton: { width: 44, height: 44, borderRadius: 24, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchWrap: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18 },
  search: { minHeight: 46, borderRadius: 13, backgroundColor: '#F3F5F8', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, height: 46, fontSize: 15, fontFamily: font.system, color: palette.ink, minWidth: 0 },
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
  footer: { paddingTop: 16, paddingHorizontal: 24 },
  modal: { flex: 1, backgroundColor: 'rgba(23,33,43,0.10)' },
  sheetArea: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  sheet: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'white', overflow: 'hidden' },
  handle: { height: 4, width: 36, borderRadius: 3, backgroundColor: '#DDE5EE', alignSelf: 'center', marginTop: 12 },
  sheetHeading: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  sheetFooter: { paddingHorizontal: 28, paddingTop: 12 },
  letterText: { fontFamily: font.regular, fontSize: 25, lineHeight: 35, letterSpacing: -0.5, color: palette.ink },
  signature: { fontFamily: font.regular, fontSize: 21, lineHeight: 30, color: palette.secondary, marginTop: 34 },
  recipient: { minHeight: 88, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 14 },
  selected: { borderColor: palette.blue, backgroundColor: 'white' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#DFE8F2', alignItems: 'center', justifyContent: 'center' },
  selection: { width: 19, height: 19, borderRadius: 10, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 40, height: 24, borderRadius: 14, padding: 3, backgroundColor: '#CED9E5' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'white' },
  birdOption: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ECF0F5', backgroundColor: 'white' },
  birdDot: { width: 40, height: 40, borderRadius: 20 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: '#CDDAE8' },
  returnBird: { width: 66, height: 66, borderRadius: 33, backgroundColor: palette.blue, borderWidth: 5, borderColor: 'white', boxShadow: '0 2px 0 #D8E4F2' },
});
