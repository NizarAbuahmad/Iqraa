/**
 * Screen names go to analytics as the route pathname. The parent consent page must never be one of them: its
 * address carries the approval token in the fragment, and even without it "a parent opened an approval link"
 * is not something to send to a third party.
 */
export function shouldTrackScreen(pathname: string): boolean {
  return !(pathname === '/guardian' || pathname.startsWith('/guardian/'));
}
