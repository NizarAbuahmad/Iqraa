/**
 * Fetchers for the family timetable: `GET /student/schedule` and
 * `GET /parent/schedule`. Split from `familySchedule.ts` because `apiClient`
 * pulls in react-native and expo-secure-store at module scope, which
 * `node --test` cannot load — the same split as routeGating.ts and
 * fetchWithTimeout.ts. No test file: the pure logic is tested in
 * `familySchedule.ts`.
 */
import { apiJson } from './apiClient.ts';
import { normalizeSchedule, type ChildSchedule } from './familySchedule.ts';

/** A student's own timetable, as a one-entry list so the screen treats both roles alike. */
export async function getMySchedule(): Promise<ChildSchedule[]> {
  const data = await apiJson<{ schedule?: unknown }>('/student/schedule');
  return [{ key: 'self', displayName: '', schedule: normalizeSchedule(data.schedule) }];
}

export async function getChildSchedules(): Promise<ChildSchedule[]> {
  const data = await apiJson<{ children?: Array<{ key?: unknown; displayName?: unknown; schedule?: unknown }> }>(
    '/parent/schedule',
  );
  return (data.children ?? []).flatMap(c =>
    typeof c.key === 'string'
      ? [
          {
            key: c.key,
            displayName: typeof c.displayName === 'string' ? c.displayName : '',
            schedule: normalizeSchedule(c.schedule),
          },
        ]
      : [],
  );
}
