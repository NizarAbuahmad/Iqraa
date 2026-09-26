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
/**
 * `/legal` is here for a different reason than `/take`: not because its
 * visitor has no account, but because a store reviewer opens the privacy
 * policy URL cold, in a browser with no session, and both listings require
 * that to work. Bouncing them to a login screen fails the review.
 *
 * `/play` is the free, no-account mini-games hub — a top-of-funnel link
 * meant to be shared and opened cold, same reasoning as `/take`.
 *
 * `/curriculum/english` is the English corner, linked from `/play` for the same
 * reason. It calls no API: the words ship in the bundle, the audio is in the
 * public bucket, and progress stays on the device. Only this subtree is public;
 * the rest of `/curriculum` still needs an account.
 */
const PUBLIC_ROUTES = ['/take', '/legal', '/play', '/curriculum/english'];

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
const NON_TEACHER_ROUTES = ['/notifications', '/messaging', '/curriculum', '/profile', '/join-class', '/claim-required'];

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
const ENTRY_ROUTES = ['/login', '/register', '/onboarding', '/forgot-password'];

export function isEntryRoute(pathname: string | null | undefined): boolean {
  // No path yet (first paint) is treated as an entry: there is no destination
  // to preserve, and failing the other way would strand the teacher nowhere.
  if (!pathname || pathname === '/') return true;
  return ENTRY_ROUTES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** The one screen a signed-in parent/student with no roster link may reach. */
export const CLAIM_REQUIRED_ROUTE = '/claim-required';

/**
 * A parent or student account with zero roster links has nothing to do in
 * the app yet — every data-serving endpoint scopes by rosterLinks.userId, so
 * an unlinked account sees empty everywhere. This is the client-side gate
 * that routes them to the mandatory claim screen before that empty app
 * renders, on first signup, on every login, and on every app boot.
 */
export function needsRosterClaim(
  user: { role: string; hasRosterLink?: boolean } | null | undefined,
): boolean {
  if (!user) return false;
  // `=== false`, not falsy: `undefined` means "not applicable" (a teacher) or
  // "not yet answered" (an older cached shape) — either must not trigger the
  // gate. Only an explicit false, from a server that has actually checked, does.
  return (user.role === 'parent' || user.role === 'student') && user.hasRosterLink === false;
}

/** The mandatory screen a brand-new teacher picks their grades/subjects on. */
export const TEACHER_SETUP_ROUTE = '/setup-subjects';

/**
 * A teacher account with no grades or subjects picked yet has never chosen
 * what the curriculum browser should default to — see `getVisibleGrades`/
 * `getSubjectsForGrade` callers in `app/(tabs)/curriculum.tsx`, which fall
 * back to the full catalog until this is set. Scoped to `role === 'teacher'`
 * only: a school/system admin is not teaching a grade, so there is nothing
 * for them to pick.
 *
 * Both arrays empty is the "never set up" signal, same shape as a fresh
 * account straight out of `/auth/register` or `/auth/verify-email` — a
 * teacher who deliberately clears every selection from the edit screen would
 * re-trigger this gate, which is the same trade-off `needsRosterClaim` makes
 * with an unlinked account.
 */
export function needsTeacherSetup(
  user: { role: string; gradeIds?: string[]; subjectIds?: string[] } | null | undefined,
): boolean {
  if (!user || user.role !== 'teacher') return false;
  return (user.gradeIds?.length ?? 0) === 0 && (user.subjectIds?.length ?? 0) === 0;
}
