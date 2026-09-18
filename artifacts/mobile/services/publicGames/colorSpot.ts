/**
 * "Spot the different square" game. One grid, one square rendered at a
 * slightly different lightness — the gap shrinks as the round number rises,
 * which is the entire difficulty curve.
 */
export const GRID_SIZE = 9;
/** Never below this many lightness points apart — below it the two are
 *  indistinguishable on a phone screen, which is a broken round, not a hard one. */
const MIN_DELTA = 4;
const START_DELTA = 20;
const DELTA_STEP = 2;

export interface ColorGrid {
  /** hsl() strings — one per square, all but `oddIndex` identical. */
  colors: string[];
  oddIndex: number;
}

/** How far apart (in lightness points) the odd square is, for a given round. */
export function deltaForRound(round: number): number {
  return Math.max(MIN_DELTA, START_DELTA - round * DELTA_STEP);
}

export function buildColorGrid(round: number, rng: () => number = Math.random): ColorGrid {
  const hue = Math.floor(rng() * 360);
  const sat = 55 + Math.floor(rng() * 25); // 55-80%
  const base = 45 + Math.floor(rng() * 15); // 45-60% lightness, room to shift either way
  const delta = deltaForRound(round);
  const odd = base + (rng() < 0.5 ? -delta : delta);

  const oddIndex = Math.floor(rng() * GRID_SIZE);
  const colors = Array.from({ length: GRID_SIZE }, (_, i) =>
    `hsl(${hue}, ${sat}%, ${i === oddIndex ? odd : base}%)`,
  );
  return { colors, oddIndex };
}
