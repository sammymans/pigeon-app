import type { FlightSummary } from './domain';

export type Point = { x: number; y: number };
export type GamePhase = 'ready' | 'aiming' | 'flight' | 'miss' | 'caught' | 'escaped';
export type Shot = { origin: Point; velocity: Point; firedAt: number; checkedAt: number };
export type InterceptionGame = {
  phase: GamePhase;
  enteredAt: number;
  deadline: number | null;
  now: number;
  shots: number;
  stones: number;
  pull: Point;
  shot: Shot | null;
  missedAt: number | null;
  escapeReason?: 'time' | 'stones' | 'shots';
};

export const SLING = { x: 0.5, y: 0.70 };
export const SKY_WINDOW_MS = 28_000;
export const AIM_WINDOW_MS = 10_000;
export const MAX_SHOTS = 2;
const GRAVITY = 0.72;
const POWER = 7;

export function canIntercept(flight: FlightSummary, attempted: readonly string[], stones: number, now: number) {
  return flight.role === 'public' && flight.visibility === 'open' && flight.state === 'in_flight'
    && flight.arrivesAt > now && !attempted.includes(flight.id) && stones > 0;
}

export function createGame(now: number, stones: number): InterceptionGame {
  return { phase: stones > 0 ? 'ready' : 'escaped', enteredAt: now, deadline: null, now, shots: 0,
    stones: Math.max(0, Math.floor(stones)), pull: { x: 0, y: 0 }, shot: null, missedAt: null,
    ...(stones <= 0 ? { escapeReason: 'stones' as const } : {}) };
}

export function pigeonPosition(elapsedMs: number): Point {
  // A full crossing takes about 1.25 seconds. Lead the bird instead of chasing it.
  return { x: 0.5 + 0.33 * Math.sin(elapsedMs / 400 + 0.5), y: 0.18 + 0.06 * Math.sin(elapsedMs / 250) };
}

export function shotsRemaining(game: InterceptionGame) {
  return Math.max(0, Math.min(MAX_SHOTS - game.shots, game.stones));
}

export function constrainPull(pull: Point): Point {
  if (!Number.isFinite(pull.x) || !Number.isFinite(pull.y)) return { x: 0, y: 0 };
  const x = Math.max(-0.2, Math.min(0.2, pull.x));
  const y = Math.max(0, Math.min(0.2, pull.y));
  const length = Math.hypot(x, y);
  const scale = length > 0.22 ? 0.22 / length : 1;
  return { x: x * scale, y: y * scale };
}

export function makeShot(pull: Point, now: number): Shot {
  return { origin: { x: SLING.x + pull.x, y: SLING.y + pull.y }, velocity: { x: -pull.x * POWER, y: -pull.y * POWER }, firedAt: now, checkedAt: now };
}

export function stonePosition(shot: Shot, now: number): Point {
  const t = Math.max(0, now - shot.firedAt) / 1000;
  return { x: shot.origin.x + shot.velocity.x * t, y: shot.origin.y + shot.velocity.y * t + GRAVITY * t * t / 2 };
}

export function gameDeadline(game: InterceptionGame) {
  return Math.min(game.enteredAt + SKY_WINDOW_MS, game.deadline ?? Infinity);
}

export function advanceGame(game: InterceptionGame, now: number): InterceptionGame {
  if (game.phase === 'caught' || game.phase === 'escaped') return game;
  const next = { ...game, now };
  // Expiration wins after backgrounding; a stale frame cannot catch a pigeon.
  if (now >= gameDeadline(game)) return { ...next, phase: 'escaped', escapeReason: 'time', pull: { x: 0, y: 0 } };
  if (game.phase === 'flight' && game.shot) {
    const shot = game.shot;
    const end = Math.min(now, shot.firedAt + 1800);
    // Sweep the trajectory so a dropped animation frame cannot skip a collision.
    for (let at = shot.checkedAt; at <= end; at += 8) {
      const stone = stonePosition(shot, at);
      const pigeon = pigeonPosition(at - game.enteredAt);
      if (Math.hypot((stone.x - pigeon.x) / 0.05, (stone.y - pigeon.y) / 0.038) <= 1) {
        return { ...next, phase: 'caught', now: at };
      }
    }
    const position = stonePosition(shot, now);
    if (now - shot.firedAt >= 1800 || position.x < -0.08 || position.x > 1.08 || position.y < -0.15 || position.y > 1.1) {
      return { ...next, phase: 'miss', missedAt: now, shot: null };
    }
    return { ...next, shot: { ...shot, checkedAt: end } };
  }
  if (game.phase === 'miss' && game.missedAt !== null && now - game.missedAt >= 850 && shotsRemaining(game) === 0) {
    return { ...next, phase: 'escaped', escapeReason: game.shots >= MAX_SHOTS ? 'shots' : 'stones' };
  }
  return next;
}

export function beginAim(game: InterceptionGame, now: number): InterceptionGame {
  const current = advanceGame(game, now);
  if (!['ready', 'miss'].includes(current.phase) || shotsRemaining(current) === 0) return current;
  return { ...current, phase: 'aiming', deadline: current.deadline ?? now + AIM_WINDOW_MS, pull: { x: 0, y: 0 } };
}

export function moveAim(game: InterceptionGame, pull: Point): InterceptionGame {
  return game.phase === 'aiming' ? { ...game, pull: constrainPull(pull) } : game;
}

export function cancelAim(game: InterceptionGame): InterceptionGame {
  return game.phase === 'aiming' ? { ...game, phase: game.shots ? 'miss' : 'ready', pull: { x: 0, y: 0 } } : game;
}

export function releaseShot(game: InterceptionGame, now: number): InterceptionGame {
  const current = advanceGame(game, now);
  if (current.phase !== 'aiming' || shotsRemaining(current) === 0) return current;
  // Tapping, dragging upward, or cancelling does not spend a stone.
  if (current.pull.y < 0.035) return cancelAim(current);
  return { ...current, phase: 'flight', shot: makeShot(current.pull, now), shots: current.shots + 1, stones: current.stones - 1, pull: { x: 0, y: 0 } };
}
