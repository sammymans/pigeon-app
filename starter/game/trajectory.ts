export const GAME_VERSION = 'slingshot-v1' as const;
export const SCENE = { width: 390, height: 760, fork: { x: 195, y: 592 }, targetRadius: 29, stoneRadius: 8, armDistance: 32, cancelDistance: 24, grabRadius: 44 };
export const FLIGHT_MS = 1600;
export const PLAY_MS = 10_000;
export type Point = { x: number; y: number };

export function targetAt(elapsed: number, seed: number): Point {
  return { x: 195 + 137 * Math.sin(elapsed / 1000 * (90 / 137) + seed), y: 333 };
}

export function stoneAt(elapsed: number, direction: Point): Point {
  const t = Math.max(0, elapsed) / 1000;
  return { x: SCENE.fork.x + direction.x * 680 * t, y: SCENE.fork.y + direction.y * 680 * t + 210 * t * t };
}

export function pullDirection(pull: Point): Point | null {
  const length = Math.hypot(pull.x, pull.y);
  return length > 0 ? { x: -pull.x / length, y: -pull.y / length } : null;
}

export function sweepHit(a: Point, b: Point, targetA: Point, targetB: Point, radius = SCENE.targetRadius + SCENE.stoneRadius) {
  const x = a.x - targetA.x;
  const y = a.y - targetA.y;
  const dx = b.x - targetB.x - x;
  const dy = b.y - targetB.y - y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const aa = dx * dx + dy * dy;
  if (aa === 0) return null;
  const bb = 2 * (x * dx + y * dy);
  const discriminant = bb * bb - 4 * aa * c;
  if (discriminant < 0) return null;
  const fraction = (-bb - Math.sqrt(discriminant)) / (2 * aa);
  return fraction >= 0 && fraction <= 1 ? fraction : null;
}

export function traceShot(releaseElapsed: number, direction: Point, seed: number) {
  let previous = stoneAt(0, direction);
  let target = targetAt(releaseElapsed, seed);
  for (let elapsed = 4; elapsed <= FLIGHT_MS; elapsed += 4) {
    const current = stoneAt(elapsed, direction);
    const nextTarget = targetAt(releaseElapsed + elapsed, seed);
    const fraction = sweepHit(previous, current, target, nextTarget);
    if (fraction !== null) return { duration: elapsed - 4 + fraction * 4, hit: true };
    if (current.x < -8 || current.x > SCENE.width + 8 || current.y < -8 || current.y > SCENE.height + 8) return { duration: elapsed, hit: false };
    previous = current;
    target = nextTarget;
  }
  return { duration: FLIGHT_MS, hit: false };
}

export function sceneTransform(width: number, height: number) {
  const scale = Math.min(width / SCENE.width, height / SCENE.height);
  return { scale, left: (width - SCENE.width * scale) / 2, top: (height - SCENE.height * scale) / 2 };
}
