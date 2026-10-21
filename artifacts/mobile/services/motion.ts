/**
 * Motion timings, shared by `Entrance` and `PressableScale` (components/ui).
 * Pure data and arithmetic, so `node --test` can read it.
 */
export const MOTION = {
  /** How long a card takes to fade and rise into place. */
  enterMs: 220,
  /** How far below its place a card starts, in px. */
  rise: 8,
  /** The gap between one card starting and the next. */
  staggerMs: 40,
  /** Cards from this position on start together, so a long list does not crawl in. */
  staggerCap: 6,
  /** How far a held card shrinks. */
  pressScale: 0.97,
} as const;

/** When the card at `index` (0-based, in reading order) starts entering, in ms. */
export function entranceDelay(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(Math.floor(index), MOTION.staggerCap) * MOTION.staggerMs;
}
