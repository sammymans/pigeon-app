import { describe, expect, it } from 'vitest';
import { cityById, type FlightSummary } from '../src/domain';
import { advanceGame, beginAim, cancelAim, canIntercept, constrainPull, createGame, gameDeadline, moveAim, releaseShot } from '../src/interception';

const shoot = (game = createGame(0, 6), at = 100, pull = { x: 0.2, y: 0.04 }) => releaseShot(moveAim(beginAim(game, at), pull), at);
const flight: FlightSummary = { id: 'stranger', courier: 'Wren', origin: cityById('london'), destination: cityById('new-york'), role: 'public', visibility: 'open', state: 'in_flight', defense: 'cruise', outfit: 'classic', demo: true, attemptCount: 0, distanceKm: 100, departedAt: 0, arrivesAt: 100_000 };

describe('two-shot slingshot', () => {
  it('spends exactly one stone on release, never on aim, cancel, tap, or duplicate release', () => {
    const aiming = beginAim(createGame(0, 6), 100);
    expect(aiming.stones).toBe(6);
    expect(releaseShot(aiming, 110).stones).toBe(6);
    expect(cancelAim(moveAim(aiming, { x: 0, y: 0.2 })).stones).toBe(6);
    const shot = shoot();
    expect(shot).toMatchObject({ phase: 'flight', stones: 5, shots: 1 });
    expect(releaseShot(shot, 150)).toMatchObject({ stones: 5, shots: 1 });
    expect(beginAim(shot, 150).phase).toBe('flight');
  });

  it('gives a missed first shot one more try and ends after two misses', () => {
    const missed = advanceGame(shoot(), 2000);
    expect(missed).toMatchObject({ phase: 'miss', shots: 1, stones: 5 });
    const second = shoot(missed, 2200);
    const twice = advanceGame(second, 4100);
    const escaped = advanceGame(twice, 5000);
    expect(escaped).toMatchObject({ phase: 'escaped', escapeReason: 'shots', shots: 2, stones: 4 });
    expect(shoot(escaped, 5100)).toBe(escaped);
  });

  it('catches a moving target along the path even when rendering drops frames', () => {
    // At 2.5 seconds, a full straight pull crosses the pigeon on its return pass.
    const shot = shoot(createGame(0, 6), 2500, { x: 0, y: 0.18 });
    const result = advanceGame(shot, 4000);
    expect(result.phase).toBe('caught');
    expect(result.shots).toBe(1);
    expect(advanceGame(result, 90_000)).toBe(result);
  });

  it('uses the 28-second sky window and a 10-second clock from the first pull', () => {
    const game = createGame(0, 6);
    expect(gameDeadline(game)).toBe(28_000);
    expect(advanceGame(game, 28_000)).toMatchObject({ phase: 'escaped', stones: 6, escapeReason: 'time' });
    const aiming = moveAim(beginAim(game, 20_000), { x: 0, y: 0.2 });
    expect(gameDeadline(aiming)).toBe(28_000);
    expect(releaseShot(aiming, 28_000)).toMatchObject({ phase: 'escaped', stones: 6 });
    const early = beginAim(game, 1000);
    expect(gameDeadline(early)).toBe(11_000);
    expect(gameDeadline(beginAim(cancelAim(early), 2000))).toBe(11_000);
  });

  it('does not catch or spend a stone from a stale backgrounded gesture', () => {
    const shot = shoot(createGame(0, 6), 2500, { x: 0, y: 0.18 });
    expect(advanceGame(shot, 30_000).phase).toBe('escaped');
    expect(releaseShot(moveAim(beginAim(createGame(0, 6), 100), { x: 0, y: 0.2 }), 30_000).stones).toBe(6);
  });

  it('ends when the pouch is empty and clamps invalid or excessive pulls', () => {
    expect(createGame(0, 0)).toMatchObject({ phase: 'escaped', stones: 0 });
    expect(createGame(0, -3).stones).toBe(0);
    const missed = advanceGame(shoot(createGame(0, 1)), 2000);
    expect(advanceGame(missed, 3000)).toMatchObject({ phase: 'escaped', escapeReason: 'stones', stones: 0 });
    expect(constrainPull({ x: NaN, y: Infinity })).toEqual({ x: 0, y: 0 });
    expect(Math.hypot(...Object.values(constrainPull({ x: 10, y: 10 })))).toBeCloseTo(0.22);
  });

  it('only offers unattempted, airborne, open letters belonging to strangers', () => {
    expect(canIntercept(flight, [], 1, 10)).toBe(true);
    for (const role of ['sender', 'recipient', 'catcher'] as const) expect(canIntercept({ ...flight, role }, [], 6, 10)).toBe(false);
    expect(canIntercept({ ...flight, visibility: 'sealed' }, [], 6, 10)).toBe(false);
    expect(canIntercept({ ...flight, state: 'intercepted' }, [], 6, 10)).toBe(false);
    expect(canIntercept(flight, [flight.id], 6, 10)).toBe(false);
    expect(canIntercept(flight, [], 0, 10)).toBe(false);
    expect(canIntercept(flight, [], 6, flight.arrivesAt)).toBe(false);
  });
});
