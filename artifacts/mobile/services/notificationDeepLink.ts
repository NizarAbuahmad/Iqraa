/**
 * Pure extraction, split out of pushTokens.ts so it can be unit-tested — that
 * file imports expo-notifications at module scope, which node:test cannot
 * load (see CLAUDE.md).
 */
export function threadIdFromNotificationData(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const threadId = (data as Record<string, unknown>).threadId;
  return typeof threadId === 'string' ? threadId : null;
}

/**
 * Where a tapped push should land. A thread wins; otherwise `data.screen` is
 * looked up in a whitelist — never pushed as a raw path, since the route it
 * names must still be one we meant to expose.
 */
const SCREEN_ROUTES: Record<string, string> = {
  'artifact-reports': '/admin/artifact-reports',
};

export function routeFromNotificationData(data: unknown): string | null {
  const threadId = threadIdFromNotificationData(data);
  if (threadId) return `/messaging/${threadId}`;
  if (typeof data !== 'object' || data === null) return null;
  const screen = (data as Record<string, unknown>).screen;
  return typeof screen === 'string' && Object.hasOwn(SCREEN_ROUTES, screen) ? SCREEN_ROUTES[screen] : null;
}
