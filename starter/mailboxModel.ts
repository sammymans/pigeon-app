import { cityById, type FlightSummary, type Profile } from '../src/domain';

export type MailPerson = { id: string; name: string; city: string; recipientId?: string; invited?: boolean };
export type MailLetter = { id: string; personId: string; direction: 'incoming' | 'outgoing'; state: 'in_flight' | 'delivered' | 'intercepted'; at: number; arrivesAt: number; courier: string; opened: boolean; caught?: boolean; replyBy?: number };
export type PersonMailbox = MailPerson & { letters: MailLetter[]; unopened: number };

export function personName(profile: Profile) { return profile.displayName || profile.handle; }

// Summaries deliberately contain no message bodies. Only opening a letter loads its contents.
export function mailboxesFromFlights(friends: Profile[], flights: FlightSummary[], opened: readonly string[]): PersonMailbox[] {
  const people: MailPerson[] = friends.map(friend => ({ id: friend.id, recipientId: friend.id, name: personName(friend), city: friend.cityId ? cityById(friend.cityId).name : 'City not chosen' }));
  const letters: MailLetter[] = [];
  for (const flight of flights) {
    if (flight.role === 'public') continue;
    const outgoing = flight.role === 'sender';
    const handle = outgoing ? flight.recipientHandle : flight.senderHandle;
    const friend = friends.find(person => person.handle === handle);
    const id = friend?.id ?? (handle ? `handle:${handle}` : `unknown:${flight.id}`);
    if (!people.some(person => person.id === id)) people.push({ id, name: handle || 'Your pen pal', city: (outgoing ? flight.destination : flight.origin).name });
    letters.push({ id: flight.id, personId: id, direction: outgoing ? 'outgoing' : 'incoming', state: flight.state, at: outgoing ? flight.departedAt : flight.arrivesAt, arrivesAt: flight.arrivesAt, courier: flight.courier, opened: opened.includes(flight.id), caught: flight.role === 'catcher' });
  }
  return groupMailboxes(people, letters);
}

export function groupMailboxes(people: MailPerson[], letters: MailLetter[]): PersonMailbox[] {
  return people.map(person => {
    const thread = letters.filter(letter => letter.personId === person.id).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    return { ...person, letters: thread, unopened: thread.filter(isUnopened).length };
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function isUnopened(letter: MailLetter) {
  return letter.direction === 'incoming' && !letter.opened && (letter.state === 'delivered' || (letter.caught && letter.state === 'intercepted'));
}

export function canOpenLetter(letter: MailLetter) {
  return letter.state === 'delivered' || Boolean(letter.caught && letter.state === 'intercepted');
}

export function nextArrival(letters: MailLetter[]) {
  return letters.filter(letter => letter.direction === 'incoming' && letter.state === 'in_flight').sort((a, b) => a.arrivesAt - b.arrivesAt)[0]?.arrivesAt;
}

export function arrivalLabel(arrivesAt: number | undefined, now: number | null) {
  if (arrivesAt === undefined) return null;
  if (now === null) return 'Your next letter is on its way';
  if (arrivesAt <= now) return 'Your next letter is landing';
  const minutes = Math.ceil((arrivesAt - now) / 60_000);
  return `Another letter arrives in ${minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`}`;
}

export function replyCountdown(deadline: number, now: number) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
