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

/**
 * «الدرس جاهز»: what to do with the latest read of the prep board. The hook
 * keeps `nextPrev` as its baseline and fires when `fire` is true.
 *
 * - `authoritative` is false when the saved materials did not come from the
 *   server (a failed or timed-out read falls back to the device list). Such a
 *   board is never a baseline: it would read 0 of 5, and the next good read at
 *   5 of 5 would then look like a crossing. The baseline is dropped instead.
 * - `skipsReady` is false until the «غير مطلوب» choices have been read for
 *   this very lesson; judging earlier uses another lesson's list. Nothing is
 *   judged and the baseline stays as it was.
 */
export function prepCrossing(
  prev: Progress | null,
  read: { authoritative: boolean; skipsReady: boolean; key: string; complete: boolean },
): { fire: boolean; nextPrev: Progress | null } {
  if (!read.authoritative) return { fire: false, nextPrev: null };
  if (!read.skipsReady) return { fire: false, nextPrev: prev };
  const next: Progress = { key: read.key, complete: read.complete };
  return { fire: justCompleted(prev, next), nextPrev: next };
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
