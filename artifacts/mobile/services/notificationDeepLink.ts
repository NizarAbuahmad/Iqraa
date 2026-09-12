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
