import { ConvexError } from 'convex/values';
import { attemptMonotonicStart, catchFrame, CATCH_MS, recordTap } from '../../src/ui/catchTiming';
import type { Attempt, AttemptResult, CatchTransport } from './contract';

type Phase = 'ready' | 'reserving' | 'playing' | 'confirming' | 'reserve-error' | 'resolve-error' | 'result';
type Snapshot = {
  phase: Phase;
  attempt: Attempt | null;
  result: AttemptResult | null;
  elapsed: number;
  taps: (number | null)[];
  abandoned: boolean;
  error: string;
};

export function catchError(error: unknown, fallback: string) {
  return error instanceof ConvexError && typeof error.data === 'string' ? error.data : fallback;
}

export class CatchSession {
  private snapshot: Snapshot = { phase: 'ready', attempt: null, result: null, elapsed: 0, taps: [null, null, null], abandoned: false, error: '' };
  private listeners = new Set<() => void>();
  private start = 0;
  private resolveAfter = Infinity;
  private expireAfter = Infinity;
  private available = false;
  private inFlight = false;
  private submittedTaps: (number | null)[] | null = null;

  constructor(private flightId: string, private transport: CatchTransport, private now = () => performance.now()) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }

  setAvailable(available: boolean) {
    this.available = available;
    if (!available && !this.snapshot.result && (this.snapshot.attempt || this.snapshot.phase === 'reserving')) {
      this.update({ abandoned: true });
    }
  }

  async reserve() {
    if (!this.available || this.inFlight || this.snapshot.attempt) return;
    this.inFlight = true;
    this.update({ phase: 'reserving', error: '' });
    const requested = this.now();
    try {
      const attempt = await this.transport.reserve(this.flightId);
      const received = this.now();
      const age = Math.max(0, attempt.serverTime - attempt.startedAt);
      this.start = attemptMonotonicStart(requested, received, attempt.serverTime, attempt.startedAt);
      this.resolveAfter = received + Math.max(0, CATCH_MS - age) + 50;
      this.expireAfter = received + Math.max(0, attempt.expiresAt - attempt.serverTime) + 50;
      this.update({
        phase: 'playing', attempt, elapsed: Math.max(0, Math.floor(received - this.start)),
        abandoned: this.snapshot.abandoned || !this.available || age > 0,
      });
    } catch (error) {
      this.update({ phase: 'reserve-error', error: catchError(error, 'Could not confirm a reservation. Retry to recover it; an existing attempt never restarts.') });
    } finally {
      this.inFlight = false;
    }
  }

  tick() {
    const { attempt, result, phase, abandoned } = this.snapshot;
    if (!attempt || result) return;
    const now = this.now();
    this.update({ elapsed: Math.max(0, Math.floor(now - this.start)) });
    if (phase === 'playing' && this.available && now >= (abandoned ? this.expireAfter : this.resolveAfter)) void this.confirm();
  }

  tap() {
    const { attempt, phase, abandoned, taps } = this.snapshot;
    if (!attempt || !this.available || abandoned || phase !== 'playing') return;
    const elapsed = Math.max(0, Math.floor(this.now() - this.start));
    this.update({ elapsed, taps: recordTap(taps, elapsed) });
  }

  async confirm() {
    const { attempt, result, abandoned } = this.snapshot;
    if (!attempt || result || !this.available || this.inFlight || this.now() < (abandoned ? this.expireAfter : this.resolveAfter)) return;
    this.inFlight = true;
    this.submittedTaps ??= abandoned ? [null, null, null] : [...this.snapshot.taps];
    this.update({ phase: 'confirming', error: '' });
    try {
      const result = await this.transport.resolve(attempt.id, [...this.submittedTaps]);
      this.update({ phase: 'result', result });
    } catch (error) {
      this.update({ phase: 'resolve-error', error: catchError(error, 'Result not confirmed. Retry this same attempt; no new catch is started.') });
    } finally {
      this.inFlight = false;
    }
  }
}

export function sessionFrame(snapshot: Snapshot) {
  return snapshot.attempt ? catchFrame(snapshot.elapsed, snapshot.attempt.phases, snapshot.taps) : null;
}
