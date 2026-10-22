/**
 * When a moment of real progress is celebrated, and how its confetti falls.
 * Pure, so `node --test` pins it (services/__tests__/celebration.test.ts);
 * components/ui/Celebrate.tsx draws it.
 *
 * A celebration fires on the CROSSING, never on the state: opening Today at
 * 5 of 5, switching to a lesson that is already ready, or reloading a finished
 * homework list is not a moment. The subject (`key`) must be the same on both
 * sides, so a change of lesson, child or round cannot read as a crossing.
 */
import { CORNERS, CORNER_IDS } from '../constants/corners.ts';

export type Progress = { key: string; complete: boolean };

export function justCompleted(prev: Progress | null, next: Progress): boolean {
  return prev !== null && prev.key === next.key && !prev.complete && next.complete;
}

/** Brand teal and each corner's light primary. Never amber: amber means "now". */
export const CONFETTI_COLORS: readonly string[] = ['#006D65', ...CORNER_IDS.map(id => CORNERS[id].light.primary)];

export type ConfettiPiece = {
  /** Start position across the screen, 0–1. */
  x: number;
  /** ms before it starts falling. */
  delay: number;
  /** Sideways travel while falling, px (signed). */
  drift: number;
  /** Turns while falling (signed). */
  spin: number;
  /** Edge length, px. */
  size: number;
  color: string;
};

/** mulberry32: a tiny seeded PRNG, so a burst's layout is reproducible in tests. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function confettiPieces(count: number, seed: number, colors: readonly string[] = CONFETTI_COLORS): ConfettiPiece[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: r(),
    delay: Math.round(r() * 300),
    drift: Math.round((r() - 0.5) * 120),
    spin: Math.round((r() - 0.5) * 4 * 10) / 10,
    size: 6 + Math.round(r() * 6),
    color: colors[i % colors.length],
  }));
}
