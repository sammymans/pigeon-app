import { describe, expect, it } from 'vitest';
import { cityById, type FlightDetail } from '../src/domain';
import { readableBody } from './letterModel';

const caught: FlightDetail = {
  id: 'caught-flight', courier: 'Mochi', origin: cityById('london'), destination: cityById('paris'),
  visibility: 'open', defense: 'cruise', distanceKm: 300, departedAt: 0, arrivesAt: 20000,
  state: 'intercepted', outfit: 'classic', demo: false, role: 'catcher', attemptCount: 1,
  canCatch: false, canRequest: true, canResend: false, events: [], body: 'Authorized caught text',
};

describe('server-authorized caught-letter presentation', () => {
  it('reads only returned Open Skies intercepted text for the catcher', () => {
    expect(readableBody(caught)).toBe('Authorized caught text');
    expect(readableBody({ ...caught, body: undefined })).toBeNull();
  });

  it.each([
    { role: 'recipient', state: 'intercepted', visibility: 'open' },
    { role: 'recipient', state: 'in_flight', visibility: 'open' },
    { role: 'public', state: 'intercepted', visibility: 'open' },
    { role: 'public', state: 'delivered', visibility: 'open' },
    { role: 'catcher', state: 'intercepted', visibility: 'sealed' },
    { role: 'catcher', state: 'in_flight', visibility: 'open' },
    { role: 'catcher', state: 'delivered', visibility: 'open' },
  ] as const)('keeps other authorization states closed: %o', state => {
    expect(readableBody({ ...caught, ...state })).toBeNull();
  });
});
