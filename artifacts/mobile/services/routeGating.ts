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

/**
 * Where a signed-in parent or student is allowed to go.
 *
 * An allowlist, not a list of teacher routes, because the two churn at very
 * different rates: teacher screens are added constantly, non-teacher ones
 * almost never. Naming the small stable set means a screen added tomorrow is
 * teacher-only by default — which is the right default — and the cost of
 * getting it wrong is a parent bounced to Messages, never a teacher route
 * left standing open.
 *
 * This is not the enforcement. Every generation and roster route already
 * rejects these roles server-side (middlewares/auth.ts); the tab bar already
 * hides the tabs (see app/(tabs)/_layout.tsx). This is for arriving *without*
 * the tab bar — a bookmark, a typed URL, a shared link — so the app stops
 * rendering a screen whose every call is going to come back 403.
 */
const NON_TEACHER_ROUTES = ['/notifications', '/messaging', '/curriculum', '/profile'];

/**
 * Teacher-only despite sitting under an allowed prefix: this is the screen
 * that mints a student's claim code, and it reads and writes the roster.
 */
const NON_TEACHER_EXCEPTIONS = ['/messaging/claim'];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

export function isNonTeacherRoute(pathname: string | null | undefined): boolean {
  // Fails closed, like isPublicRoute: an unknown path is not somewhere a
  // non-teacher may be, so they get sent back to Messages.
  if (!pathname) return false;
  return matchesPrefix(pathname, NON_TEACHER_ROUTES) && !matchesPrefix(pathname, NON_TEACHER_EXCEPTIONS);
}

/** Routes whose whole purpose is to lead somewhere else once you're signed in. */
const ENTRY_ROUTES = ['/login', '/register', '/forgot-password', '/onboarding'];

export function isEntryRoute(pathname: string | null | undefined): boolean {
  // No path yet (first paint) is treated as an entry: there is no destination
  // to preserve, and failing the other way would strand the teacher nowhere.
  if (!pathname || pathname === '/') return true;
  return ENTRY_ROUTES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}
