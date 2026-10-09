/**
 * The type, spacing and radius scales.
 *
 * Measured 2026-10-09: 28 distinct font sizes, 36 corner radii and 34 spacing
 * values across the app, chosen screen by screen. These are the steps the
 * screens already lean on most; new code picks from here, and
 * services/__tests__/designScale.test.ts keeps the count of values outside
 * them from growing while old screens are moved over.
 *
 * Pure data with no imports, so `node --test` can read it.
 */

/** Font sizes. Body is Almarai 15, captions 13, Readex labels 14. */
export const TYPE = {
  micro: 11,
  caption: 13,
  label: 14,
  body: 15,
  bodyLg: 17,
  title: 20,
  headline: 24,
  display: 28,
  hero: 32,
} as const;

/** Padding, margin and gap — a 4-point grid. */
export const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  page: 40,
  hero: 48,
} as const;

/** Corner radii. `colors.radius` (12) stays the default card radius. */
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;
