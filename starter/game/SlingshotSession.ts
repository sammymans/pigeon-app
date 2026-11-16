import { ConvexError } from 'convex/values';
import type { CatchTransport, Encounter, GameData } from './contract';
import { pullDirection, SCENE, traceShot, type Point } from './trajectory';

export const isFinished = (state?: Encounter['state']) => state !== undefined && !['ready', 'active', 'projectile'].includes(state);
type Release = { key: string; elapsed: number; direction: Point };
type Snapshot = { data: GameData | null; now: number; drag: Point | null; armed: boolean; busy: boolean; error: string; interrupted: boolean; preview: Encounter['shots'][number] | null; armedAt: number | null };

export class SlingshotSession {
  private snapshot: Snapshot = { data: null, now: 0, drag: null, armed: false, busy: false, error: '', interrupted: false, preview: null, armedAt: null };
  private listeners = new Set<() => void>();
  private anchor: { server: number; mono: number } | null = null;
  private available = false;
  private pending: (() => Promise<void>) | null = null;
  private queued: Release | null = null;
  private seq = 0;
  private loaded = false;
  private syncing = false;
  private nextSync = 0;
  constructor(private flightId: string, private transport: CatchTransport, private clock = () => performance.now()) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()); }
  private time() { return this.anchor ? this.anchor.server + this.clock() - this.anchor.mono : 0; }
  private accept(data: GameData, requested: number, anchor = false) {
    if (!this.anchor || anchor) this.anchor = { server: data.serverTime, mono: (requested + this.clock()) / 2 };
    const previous = this.snapshot.data?.encounter;
    if (previous && isFinished(previous.state) && data.encounter?.id === previous.id) data = { ...data, encounter: previous };
    this.update({ data, now: this.time(), ...(data.encounter?.shots.some(shot => shot.key === this.snapshot.preview?.key) || isFinished(data.encounter?.state) ? { preview: null } : {}) });
  }
  private async perform(operation: (timing: { at: number }) => Promise<GameData>, anchor = false) {
    if (this.snapshot.busy || !this.available) return;
    const run = async () => {
      if (this.snapshot.busy || !this.available) return;
      this.update({ busy: true, error: '' });
      const timing = { at: this.clock() };
      let rejected = false;
      try {
        this.accept(await operation(timing), timing.at, anchor);
        this.pending = null;
      } catch (error) {
        rejected = error instanceof ConvexError;
        this.pending = rejected ? null : run;
        if (rejected) { this.queued = null; this.update({ preview: null, drag: null, armed: false, armedAt: null }); }
        this.update({ error: error instanceof ConvexError && typeof error.data === 'string' ? error.data : 'The server has not confirmed this action. Retry safely; a shot is never charged twice.' });
      } finally { if (!rejected) this.update({ busy: false }); }
      if (rejected && !this.snapshot.interrupted) {
        const requested = this.clock();
        try { this.accept(await this.transport.sync(this.flightId), requested, true); }
        catch { this.update({ error: 'The action was not accepted. Retry to refresh the encounter.' }); }
      }
      if (rejected) this.update({ busy: false });
      if (this.snapshot.interrupted) void this.end();
      else if (!this.pending && this.queued) { const release = this.queued; this.queued = null; void this.fire(release); }
    };
    await run();
  }
  setAvailable(available: boolean) {
    if (!available && this.loaded && !isFinished(this.snapshot.data?.encounter?.state)) {
      this.queued = null;
      this.update({ interrupted: true, drag: null });
      void this.end();
    }
    this.available = available;
    if (available && this.snapshot.interrupted) void this.end();
  }
  async load() {
    if (this.loaded || this.snapshot.busy || !this.available) return;
    this.loaded = true;
    let initial: GameData | null = null;
    await this.perform(async timing => {
      if (!initial) initial = await this.transport.sync(this.flightId);
      if (initial.encounter) {
        if (isFinished(initial.encounter.state)) return initial;
        timing.at = this.clock();
        return this.transport.end(initial.encounter.id);
      }
      if (initial.pouch.count === 0) return initial;
      timing.at = this.clock();
      return this.transport.prepare(this.flightId);
    }, true);
  }
  begin(point: Point) {
    const encounter = this.snapshot.data?.encounter;
    if (!this.available || this.snapshot.busy || this.pending || this.snapshot.preview || this.snapshot.interrupted || !encounter || !['ready', 'active'].includes(encounter.state) || this.time() >= (encounter.fireUntil ?? encounter.readyUntil)) return false;
    if (Math.hypot(point.x - SCENE.fork.x, point.y - SCENE.fork.y) > SCENE.grabRadius) return false;
    this.update({ drag: { x: 0, y: 0 }, armed: false });
    return true;
  }
  move(point: Point) {
    if (!this.snapshot.drag || !this.available || this.snapshot.interrupted) return;
    const drag = { x: point.x - SCENE.fork.x, y: point.y - SCENE.fork.y };
    const armed = this.snapshot.armed || Math.hypot(drag.x, drag.y) >= SCENE.armDistance;
    this.update({ drag, armed });
    const encounter = this.snapshot.data!.encounter!;
    if (armed && encounter.armedAt === null && !this.snapshot.busy && !this.pending) {
      const elapsed = this.time() - encounter.preparedAt;
      this.update({ armedAt: encounter.preparedAt + elapsed });
      void this.perform(() => this.transport.arm(encounter.id, elapsed));
    }
  }
  release() {
    const { drag, armed, data } = this.snapshot;
    this.update({ drag: null, armed: false });
    if (!drag || !armed || Math.hypot(drag.x, drag.y) <= SCENE.cancelDistance || !this.available || this.snapshot.interrupted || !data?.encounter) return;
    const release = { key: `${data.encounter.id}:${++this.seq}`, elapsed: this.time() - data.encounter.preparedAt, direction: pullDirection(drag)! };
    const deadline = data.encounter.fireUntil ?? (this.snapshot.armedAt === null ? 0 : this.snapshot.armedAt + 10_000);
    if (this.time() >= deadline) return;
    const releasedAt = data.encounter.preparedAt + release.elapsed;
    this.update({ preview: { key: release.key, direction: release.direction, releasedAt, endsAt: releasedAt + traceShot(release.elapsed, release.direction, data.encounter.seed).duration, outcome: 'flying' } });
    if (this.snapshot.busy || data.encounter.armedAt === null) this.queued = release;
    else void this.fire(release);
  }
  private async fire(release: Release) {
    const encounter = this.snapshot.data!.encounter!;
    if (this.time() >= encounter.fireUntil! || this.snapshot.interrupted) { this.update({ preview: null }); return; }
    await this.perform(() => this.transport.fire(encounter.id, release.key, release.elapsed, release.direction));
  }
  async retry() {
    if (this.snapshot.interrupted) await this.end();
    else if (this.pending) await this.pending();
    else if (!this.snapshot.data) { this.loaded = false; await this.load(); }
    else await this.perform(() => this.transport.sync(this.flightId));
  }
  async end() {
    this.update({ interrupted: true, drag: null, preview: null });
    this.queued = null;
    const encounter = this.snapshot.data?.encounter;
    if (!encounter || isFinished(encounter.state) || this.syncing) return;
    this.syncing = true;
    try { this.accept(await this.transport.end(encounter.id), this.clock()); }
    catch { this.update({ error: 'Could not confirm the exit yet. The server deadline still applies; reconnect to check the result.' }); }
    finally { this.syncing = false; }
  }
  tick() {
    const now = this.time();
    this.update({ now });
    const encounter = this.snapshot.data?.encounter;
    if (!this.available || isFinished(encounter?.state) || this.snapshot.busy || this.syncing || this.pending || now < this.nextSync) return;
    const due = encounter ? encounter.shots.find(shot => shot.outcome === 'flying')?.endsAt ?? encounter.fireUntil ?? encounter.readyUntil : this.snapshot.data?.pouch.nextRefillAt;
    if (due == null) return;
    if (now < due + 30) return;
    this.nextSync = now + 250;
    this.syncing = true;
    const requested = this.clock();
    void this.transport.sync(this.flightId).then(data => this.accept(data, requested)).catch(() => this.update({ error: 'Waiting for the server result. Reconnect or retry to refresh.' })).finally(() => { this.syncing = false; if (this.snapshot.interrupted) void this.end(); });
  }
}
