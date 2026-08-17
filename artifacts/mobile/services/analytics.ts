/**
 * Teacher usage analytics — PostHog, one SDK across native and Expo web.
 *
 * Disabled by default: with no `EXPO_PUBLIC_POSTHOG_API_KEY` every export
 * below is a silent no-op — a pilot device with nothing configured behaves
 * identically to one with analytics on, just without the event. Same shape
 * as Unsplash's "no server key" path.
 *
 * The client loads lazily inside the functions that use it, never at module
 * scope. `posthog-react-native` pulls in `react-native`, and a module-scope
 * import here would make every file that imports this module (workspace.ts,
 * share.ts) untestable under plain `node --test` — the exact trap the
 * OpenAI client hit (see CLAUDE.md: "Import it lazily inside the function
 * that calls a model").
 */
import type PostHog from 'posthog-react-native';

/** Kept narrow (no `unknown`/nested objects) so it always satisfies PostHog's JSON property type. */
export type AnalyticsProps = Record<string, string | number | boolean>;

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/** `undefined` = not yet attempted; `null` = attempted and unavailable/disabled. */
let client: PostHog | null | undefined;

async function getClient(): Promise<PostHog | null> {
  if (client !== undefined) return client;
  if (!POSTHOG_KEY) {
    client = null;
    return client;
  }
  try {
    const { default: PostHogClient } = await import('posthog-react-native');
    client = new PostHogClient(POSTHOG_KEY, { host: POSTHOG_HOST });
  } catch {
    client = null;
  }
  return client;
}

/** Call once at app start. Establishes the client without blocking the first screen. */
export function initAnalytics(): void {
  void getClient();
}

/** A named product event — tool opened, material saved/exported, class started. Never throws. */
export function trackEvent(event: string, props?: AnalyticsProps): void {
  void (async () => {
    try {
      (await getClient())?.capture(event, props);
    } catch {
      // Analytics must never break the feature it's watching.
    }
  })();
}

/** A screen view — the route pathname doubles as the screen name. */
export function trackScreen(name: string, props?: AnalyticsProps): void {
  void (async () => {
    try {
      (await getClient())?.screen(name, props);
    } catch {
      // Analytics must never break the feature it's watching.
    }
  })();
}

/** Ties events to one teacher across sessions/devices once they're signed in. */
export function identifyUser(userId: string, props?: AnalyticsProps): void {
  void (async () => {
    try {
      (await getClient())?.identify(userId, props);
    } catch {
      // Analytics must never break the feature it's watching.
    }
  })();
}

/** Clears the identified teacher on sign-out — later events attach to a fresh anonymous id. */
export function resetAnalyticsIdentity(): void {
  void (async () => {
    try {
      (await getClient())?.reset();
    } catch {
      // Analytics must never break the feature it's watching.
    }
  })();
}
