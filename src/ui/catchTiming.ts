import { catchPosition, isHit } from '../domain';

export const ROUND_MS = 2000;
export const CATCH_MS = ROUND_MS * 3;

export function catchFrame(elapsed: number, phases: number[], taps: (number | null)[]) {
  const safeElapsed = Math.max(0, elapsed);
  const round = Math.min(2, Math.floor(safeElapsed / ROUND_MS));
  const finished = safeElapsed >= CATCH_MS;
  return {
    round,
    finished,
    position: catchPosition(Math.min(safeElapsed, CATCH_MS - 1) - round * ROUND_MS, phases[round]),
    remaining: Math.max(0, CATCH_MS - safeElapsed),
    canTap: !finished && taps[round] === null,
    hits: [0, 1, 2].map(index => taps[index] !== null ? isHit(taps[index]! - index * ROUND_MS, phases[index]) : safeElapsed >= (index + 1) * ROUND_MS ? false : null),
  };
}

export function recordTap(taps: (number | null)[], elapsed: number): (number | null)[] {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= CATCH_MS) return taps;
  const round = Math.floor(elapsed / ROUND_MS);
  if (taps[round] !== null) return taps;
  return taps.map((tap, index) => index === round ? Math.floor(elapsed) : tap);
}

export function attemptMonotonicStart(requestStarted: number, responseReceived: number, serverTime: number, startedAt: number) {
  return (requestStarted + responseReceived) / 2 - Math.max(0, serverTime - startedAt);
}
