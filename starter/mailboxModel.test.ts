import { describe, expect, it } from 'vitest';
import { cityById, type FlightSummary, type Profile } from '../src/domain';
import { arrivalLabel, canOpenLetter, groupMailboxes, mailboxesFromFlights, nextArrival, replyCountdown, type MailLetter } from './mailboxModel';

const friends: Profile[] = [
  { id: 'sam', handle: 'sammy', displayName: 'Sammy', cityId: 'london', demo: true, equipped: 'classic' },
  { id: 'alex', handle: 'alex', displayName: 'Alex', cityId: 'paris', demo: true, equipped: 'classic' },
];
const flight: FlightSummary = { id: 'first', courier: 'Miso', origin: cityById('london'), destination: cityById('new-york'), visibility: 'open', defense: 'cruise', distanceKm: 5000, departedAt: 1, arrivesAt: 100, state: 'delivered', outfit: 'classic', demo: true, role: 'recipient', senderHandle: 'sammy', recipientHandle: 'ethan', attemptCount: 0 };

describe('people-first mailboxes', () => {
  it('sorts people alphabetically and combines incoming and outgoing letters chronologically', () => {
    const people = mailboxesFromFlights(friends, [{ ...flight, id: 'reply', role: 'sender', senderHandle: 'ethan', recipientHandle: 'sammy', departedAt: 200 }, flight], []);
    expect(people.map(person => person.name)).toEqual(['Alex', 'Sammy']);
    expect(people[1].letters.map(letter => [letter.id, letter.direction])).toEqual([['first', 'incoming'], ['reply', 'outgoing']]);
    expect(people[1].unopened).toBe(1);
    expect(people[0].letters).toEqual([]);
  });
  it('counts only readable incoming letters and clears the count after opening', () => {
    const flights = [flight, { ...flight, id: 'flying', state: 'in_flight' as const }, { ...flight, id: 'caught', role: 'catcher' as const, state: 'intercepted' as const }, { ...flight, id: 'lost', state: 'intercepted' as const }];
    expect(mailboxesFromFlights(friends, flights, [flight.id])[1].unopened).toBe(1);
    expect(mailboxesFromFlights(friends, flights, [flight.id, 'caught'])[1].unopened).toBe(0);
  });
  it('keeps historical conversations without granting send access or copying message bodies', () => {
    const people = mailboxesFromFlights([], [{ ...flight, body: 'private words' } as FlightSummary, { ...flight, id: 'public', role: 'public' }], []);
    expect(people).toHaveLength(1);
    expect(people[0].recipientId).toBeUndefined();
    expect(people[0].name).toBe('sammy');
    expect(people[0].letters[0]).not.toHaveProperty('body');
  });
  it('never opens a pending letter merely because its ETA has passed', () => {
    const letter: MailLetter = { id: 'flying', personId: 'sam', direction: 'incoming', state: 'in_flight', at: 100, arrivesAt: 100, courier: 'Miso', opened: false };
    expect(canOpenLetter(letter)).toBe(false);
    expect(arrivalLabel(nextArrival([letter]), 200)).toBe('Your next letter is landing');
    expect(groupMailboxes([{ id: 'sam', name: 'Sammy', city: 'London' }], [letter])[0].unopened).toBe(0);
    expect(canOpenLetter({ ...letter, state: 'delivered' })).toBe(true);
  });
  it('clamps reply deadlines and uses the earliest incoming arrival', () => {
    expect(replyCountdown(30 * 60_000, 12_000)).toBe('29:48');
    expect(replyCountdown(100, 200)).toBe('0:00');
    expect(arrivalLabel(720_000, 0)).toBe('Another letter arrives in 12 min');
    expect(arrivalLabel(undefined, 0)).toBeNull();
  });
});
