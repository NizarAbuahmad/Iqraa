/**
 * Which routes exist to get a teacher *into* the app.
 *
 * Split out of `_layout.tsx` so it can be unit-tested — that file imports
 * `expo-router` and `react-native` at module scope, which `node:test` cannot
 * load. Same reason `docxOutline.ts` and `deckSlidesHtml.ts` were split out.
 *
 * The boot effect used to send every signed-in cold boot to the tabs. On web
 * a reload *is* a cold boot, so no link into the app survived arriving at it:
 * opening `/admin/dashboard`, refreshing a worksheet, or sharing an
 * evaluation link all dumped the teacher on the home tab. Only an entry route
 * — or a fresh sign-in — should hand them over to the tabs.
 */

/**
 * Routes that belong to someone who is not a teacher and never will be.
 *
 * A student opening an exam link has no account and cannot make one — the link
 * is the identity. Without this the boot effect sends them to a teacher login
 * screen, which is not a smaller problem than a broken link: it is a locked
 * door with someone else's name on it.
 *
 * Kept as a prefix list rather than a regex so adding one is unmistakable, and
 * so a route can never become public by accident of pattern.
 */
const PUBLIC_ROUTES = ['/take'];

export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PUBLIC_ROUTES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** Routes whose whole purpose is to lead somewhere else once you're signed in. */
const ENTRY_ROUTES = ['/login', '/register', '/forgot-password', '/onboarding'];

export function isEntryRoute(pathname: string | null | undefined): boolean {
  // No path yet (first paint) is treated as an entry: there is no destination
  // to preserve, and failing the other way would strand the teacher nowhere.
  if (!pathname || pathname === '/') return true;
  return ENTRY_ROUTES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}
