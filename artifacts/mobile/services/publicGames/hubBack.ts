/**
 * Whether the /play hub draws its back arrow.
 *
 * The hub used to hide it always, on the idea that it is an entry point opened
 * cold from a shared link. It is also opened from inside the app — the Tools
 * tab's «الألعاب» card, a «ما الجديد» entry, the help search — and there a
 * teacher landed on a full-screen page with no way out. So: show it whenever
 * there is somewhere to go. With history that is the previous screen; a
 * signed-in user with none (a refreshed tab) goes to `/`, their own landing
 * tab (`goBack()`). Only an anonymous visitor on a cold link has nowhere —
 * `/` would bounce them to sign-in — so only they get no arrow.
 */
export function hubShowsBack({ canGoBack, signedIn }: { canGoBack: boolean; signedIn: boolean }): boolean {
  return canGoBack || signedIn;
}
