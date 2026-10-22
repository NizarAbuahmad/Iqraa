/**
 * A header band's gradient: the hero colour, deepening toward the far corner.
 * It only ever deepens, so white text that reads on the hero reads at the
 * other stop too. cornerTheme.test.ts measures both stops for every corner
 * and for the brand teal.
 */
export const BAND_DEEPEN = 0.18;

/** `hex` (#RRGGBB) moved `amount` (0–1, clamped) of the way to black, as upper-case #RRGGBB. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const keep = 1 - Math.min(Math.max(amount, 0), 1);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.round(c * keep));
  return '#' + channels.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The two stops of a band drawn in `hero`. */
export function bandGradient(hero: string): [string, string] {
  return [hero, shade(hero, BAND_DEEPEN)];
}
