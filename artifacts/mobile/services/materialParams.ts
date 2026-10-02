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
