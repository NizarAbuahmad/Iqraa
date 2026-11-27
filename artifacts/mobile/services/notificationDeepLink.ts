/**
 * Pure extraction, split out of pushTokens.ts so it can be unit-tested — that
 * file imports expo-notifications at module scope, which node:test cannot
 * load (see CLAUDE.md).
 */
import { classLinkRequestsQueryKey, linkRequestSummaryQueryKey } from './rosterQueryKeys.ts';
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
  // Someone joined the waitlist on iqrra.com (lib/adminNotify.ts).
  'admin-signups': '/admin/signups',
  // A chat message was reported (lib/messageReportAlert.ts).
  moderation: '/admin/moderation',
  // A provider refused the AI account, or spend reached 80%/100% (lib/aiAlerts.ts).
  'ai-costs': '/admin/ai-costs',
  // A teacher released an exam's results (lib/resultsReleaseNotify.ts).
  'my-exams': '/my-exams',
  // Homework posted, the day-before reminder, an exam date (spec Part 4).
  school: '/school',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function routeFromNotificationData(data: unknown): string | null {
  const threadId = threadIdFromNotificationData(data);
  if (threadId) return `/messaging/${threadId}`;
  if (typeof data !== 'object' || data === null) return null;
  const screen = (data as Record<string, unknown>).screen;
  // A student's class-code pick waits for the teacher (api-server
  // lib/joinRequestNotify.ts): open that class, whose Students tab — the one it
  // opens on — carries the «طلبات الانضمام» banner. Only a real id goes into the
  // path; anything else falls back to the class list.
  if (screen === 'class-link-requests') {
    const classId = (data as Record<string, unknown>).classGroupId;
    return typeof classId === 'string' && UUID.test(classId) ? `/classes/${classId}` : '/classes';
  }
  return typeof screen === 'string' && Object.hasOwn(SCREEN_ROUTES, screen) ? SCREEN_ROUTES[screen] : null;
}

/**
 * Which cached queries a push makes stale the moment it ARRIVES, tapped or not.
 * A join request (api-server lib/joinRequestNotify.ts) changes the bell's count
 * and that class's banner; without this they caught up only on their next poll,
 * up to a minute behind the banner the phone itself had just shown.
 */
export function queryKeysToRefresh(data: unknown): readonly (readonly unknown[])[] {
  if (typeof data !== 'object' || data === null) return [];
  const d = data as Record<string, unknown>;
  if (d.screen !== 'class-link-requests') return [];
  const classId = d.classGroupId;
  return typeof classId === 'string' && UUID.test(classId)
    ? [linkRequestSummaryQueryKey, classLinkRequestsQueryKey(classId)]
    : [linkRequestSummaryQueryKey];
}
