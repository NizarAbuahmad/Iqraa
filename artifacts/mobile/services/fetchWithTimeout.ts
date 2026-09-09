/**
 * `fetch` with a deadline. Every API call in the app goes through it.
 *
 * Nothing here had one. A socket that died while the app was asleep leaves
 * `fetch` pending forever, and the Messages screen clears its spinner only in a
 * `finally` — so reopening the app after Android had killed it showed a header,
 * a tab bar, and a small spinner that never stopped. The 20s poller could not
 * rescue it either: `refreshAccessToken`'s single-flight latch is reset in its
 * own `finally`, so one hanging `POST /auth/refresh` wedged every later retry
 * behind a dead promise. Both are the same missing deadline.
 *
 * Split into its own file so `node:test` can load it — `apiClient.ts` reaches
 * `react-native` through `./secureStorage`, which that runner cannot transform.
 * Same reason `routeGating.ts`, `docxOutline.ts` and `deckSlidesHtml.ts` were
 * split out.
 */

/**
 * Render's free tier took 31-51s to wake a sleeping service and Cloud Run takes
 * 4.59s, which is why the API moved — see the note in `render.yaml`. 15s clears
 * that comfortably, and is the same number `services/ai/verifyMath.ts` already
 * picked for the same reason.
 */
export const API_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
): Promise<Response> {
  // A caller that brought its own signal already owns the deadline, and both
  // that do are generation paths: `RemoteAIService.postJSON` (45s, and it
  // forwards the teacher's Cancel into the same controller) and `verifyMath`.
  // A second, shorter timer here would cut generation off at 15s.
  if (init.signal) return fetch(url, init);

  // Deliberately not `AbortSignal.timeout`: React Native polyfills
  // `AbortController`/`AbortSignal` from abort-controller@3
  // (Libraries/Core/setUpXHR.js), which has no such static. It resolves to the
  // real browser global under react-native-web and is `undefined` on Hermes —
  // a native-only crash that Expo web dev would never show.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // ponytail: clearing on resolve is enough on native, where `fetch` is
    // XHR-backed and does not resolve until the body is in. A response whose
    // body then stalls mid-stream is only reachable on web; give the timer to
    // the body read if that ever shows up.
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
