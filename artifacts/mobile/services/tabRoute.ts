/**
 * The one mapping from a tab's route name to its URL, and back from a URL to
 * "is this tab the one being shown".
 *
 * Expo Router serves the `index` tab at `/`, not at `/index`, which is why a
 * naive `pathname.startsWith('/' + name)` never lit up «اليوم» in the desktop
 * sidebar: the landing page was open and no row was highlighted. The sidebar
 * and the command palette each built the href themselves too; both now read
 * it from here, so a renamed tab cannot leave one of them pointing at the old
 * path.
 *
 * Pure TypeScript so `node --test` can run it.
 */

/** URL for a tab route name: `index` is the landing page `/`. */
export function tabHref(name: string): string {
  return name === 'index' ? '/' : `/${name}`;
}

/**
 * Whether `pathname` is inside the tab `name`. Exact match or a nested path
 * — `/curriculum/…` counts as the curriculum tab, `/curriculum-x` does not.
 * `index` matches only the landing page itself (both spellings the router can
 * report), never everything under `/`.
 */
export function isTabActive(pathname: string, name: string): boolean {
  if (name === 'index') return pathname === '/' || pathname === '/index';
  const href = tabHref(name);
  return pathname === href || pathname.startsWith(`${href}/`);
}
