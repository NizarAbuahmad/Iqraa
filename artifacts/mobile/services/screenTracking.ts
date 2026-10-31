/**
 * Screen names go to analytics as the route pathname. Two screens are never reported:
 *
 * - The parent consent page (`/guardian`): its address carries the approval token in the fragment, and even
 *   without it "a parent opened an approval link" is not something to send to a third party.
 * - A student's homework project (`/homework-project/<id>`, since 2026-10-30): it shows a minor's photos and
 *   note, and replay masking is unverified (STATUS.md, «Screen recording»). Failing closed here keeps it out of
 *   PostHog screen events and Contentsquare pageviews, and the web tag is never loaded on a page that opens there.
 *   It does NOT pause a recording that an earlier screen already started; masking is the only guard then.
 */
const EXCLUDED = ['/guardian', '/homework-project'] as const;

export function shouldTrackScreen(pathname: string): boolean {
  return !EXCLUDED.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
