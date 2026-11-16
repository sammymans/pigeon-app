import type { City } from '../../src/domain';
import type { MailLetter, MailPerson } from '../mailboxModel';

export const previewPeople: MailPerson[] = [
  { id: 'alex', recipientId: 'alex', name: 'Alex', city: 'London' },
  { id: 'dad', recipientId: 'dad', name: 'Dad', city: 'Chicago' },
  { id: 'jules', recipientId: 'jules', name: 'Jules', city: 'Paris' },
  { id: 'nina', recipientId: 'nina', name: 'Nina', city: 'Berlin' },
  { id: 'robin', recipientId: 'robin', name: 'Robin', city: 'San Francisco' },
  { id: 'sammy', recipientId: 'sammy', name: 'Sammy', city: 'Vancouver' },
];
export const nearbyPerson: MailPerson = { id: 'nearby', recipientId: 'nearby', name: 'Someone nearby', city: 'Nearby' };
export type PreviewLetter = MailLetter & { body: string; signature?: string; person?: MailPerson; replyDestination?: City };

export function sampleLetters(now: number): PreviewLetter[] {
  const counts = [4, 12, 6, 9, 3, 8];
  return previewPeople.flatMap((person, index) => Array.from({ length: counts[index] }, (_, i) => {
    const last = i === counts[index] - 1;
    const incoming = last || i % 2 === 0;
    const fresh = last && ['alex', 'sammy'].includes(person.id);
    const arriving = person.id === 'sammy' && i === counts[index] - 2;
    const at = arriving ? now + 12 * 60_000 : last ? now - 120_000 : now - (counts[index] - i) * 86_400_000;
    return { id: `${person.id}-${i}`, personId: person.id, direction: incoming || arriving ? 'incoming' : 'outgoing', state: arriving ? 'in_flight' : 'delivered', at, arrivesAt: at, courier: person.id === 'alex' ? 'Dot' : 'Miso', opened: !fresh, ...(fresh && person.id === 'alex' ? { caught: true, replyBy: now + 30 * 60_000 } : {}), body: fresh ? person.id === 'sammy' ? 'Found a place with a very serious croissant.\n\nSame time tomorrow?' : 'Does anyone else miss getting lost?\n\nI took the long way home today.' : incoming ? 'A little hello from here.\n\nThis made me think of you. Hope your day has a little room for something good.' : 'I’m keeping a little time for our next catch-up.\n\nTell me everything when this lands.' } as PreviewLetter;
  }));
}
