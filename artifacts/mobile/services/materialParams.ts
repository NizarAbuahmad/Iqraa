/**
 * Route-param readers for a material's saved form state.
 *
 * Kept free of react-native so `node --test` can load it.
 */

/**
 * Is this worksheet-screen visit a homework?
 *
 * The flag arrives two ways. The tool menus and chat send `isHomework: '1'`.
 * A saved material stores a boolean in `formState` (which `continueTeaching`
 * reads as a boolean, so it stays one), and موادي reopens the item by
 * spreading that state into the route, where the boolean becomes the string
 * `'true'`. Reading only `'1'` turned every reopened homework into a
 * worksheet, and the next save demoted it for good.
 */
export function readHomeworkParam(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

/**
 * A saved picker position, read back from the route.
 *
 * Positions arrive from موادي form state and from hand-written URLs. One the
 * option list cannot honour (absent, not a number, negative, past the end)
 * must fall back to the screen's default rather than become `NaN` or index
 * past the array — the same trap CLAUDE.md describes for grade/subject
 * indices, applied to the smaller pickers.
 */
export function readIndexParam(value: string | undefined, length: number, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0 || n >= length) return fallback;
  return n;
}

/**
 * A saved on/off toggle, read back from the route.
 *
 * `formState` holds booleans, and spreading it into route params turns them
 * into the strings `'true'` / `'false'`. Anything else (absent, hand-written)
 * keeps the screen's own default rather than flipping it.
 */
export function readFlagParam(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}
