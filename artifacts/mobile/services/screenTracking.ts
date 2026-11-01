/**
 * Screen names go to analytics as the route pathname. Three screens are never reported:
 *
 * - The parent consent page (`/guardian`): its address carries the approval token in the fragment, and even
 *   without it "a parent opened an approval link" is not something to send to a third party.
 * - A student's homework project (`/homework-project/<id>`, since 2026-10-30): it shows a minor's photos and
 *   note, and replay masking is unverified (STATUS.md, «Screen recording»). Failing closed here keeps it out of
 *   PostHog screen events and Contentsquare pageviews, and the web tag is never loaded on a page that opens there.
 *   It does NOT pause a recording that an earlier screen already started; masking is the only guard then.
 * - A teacher's view of those projects (`/homework-submissions/<homework>` and `/<homework>/<student>`, since
 *   2026-10-31): the detail screen shows the same minors' photos and notes, and its path carries the student's id.
 *   The whole prefix is excluded (the list too), for the same reason and with the same limit.
 */
const EXCLUDED = ['/guardian', '/homework-project', '/homework-submissions'] as const;

export function shouldTrackScreen(pathname: string): boolean {
  return !EXCLUDED.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
