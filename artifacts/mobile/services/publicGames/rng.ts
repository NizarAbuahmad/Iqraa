/**
 * Seedable RNG and shuffle for the public games.
 *
 * Plain `Math.random()` would make every round untestable — split out so
 * tests can pass a fixed seed and assert a specific, reproducible shuffle.
 */

/** Mulberry32 — small, fast, good enough for game shuffling (not crypto). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, using the given RNG (defaults to Math.random for real play). */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick `count` distinct items from `items`, shuffled. */
export function sample<T>(items: T[], count: number, rng: () => number = Math.random): T[] {
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}
