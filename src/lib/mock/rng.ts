// Deterministic PRNG (mulberry32) so server and client render identical mock
// data — Math.random() would cause hydration mismatches.
export function createRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randFloat(rng: () => number, min: number, max: number, decimals = 1): number {
  const v = rng() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

// "Today" for every mock timestamp — keeps generated dates on or before the
// app's stated current date instead of drifting into the future.
export const MOCK_TODAY = new Date("2026-08-12T12:00:00Z");

export function randomPastDate(rng: () => number, maxDaysAgo: number, minDaysAgo = 0): string {
  const daysAgo = randInt(rng, minDaysAgo, maxDaysAgo);
  const d = new Date(MOCK_TODAY);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}
