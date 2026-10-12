/**
 * Fetchers for homework: the student's and parent's lists
 * (`GET /student/homework`, `GET /parent/homework`), the student's tick
 * (`PUT|DELETE /student/homework/:id/done`) and the teacher's CRUD
 * (`/homework`, `/classes/:id/homework`). Split from `homework.ts` because
 * `apiClient` pulls in react-native and expo-secure-store at module scope, which
 * `node --test` cannot load — the same split as `familyScheduleApi.ts`. No test
 * file: the pure logic is tested in `homework.ts`.
 *
 * Failures other than the two list reads throw `HomeworkError` (status + the
 * server's `code`), the shape of `ScheduleError` / `RosterError`, so a screen
 * chooses its own wording instead of echoing the server's English.
 */
import { apiFetch, apiJson } from './apiClient.ts';
import {
  normalizeFamilyHomework,
  normalizeTeacherHomework,
  type ChildHomework,
  type TeacherHomework,
} from './homework.ts';

export class HomeworkError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'HomeworkError';
    this.status = status;
    this.code = code;
  }

  /** The homework, or the class it belongs to, is gone or was never this account's. */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new HomeworkError(detail || `${action} failed (${res.status})`, res.status, code);
  }
  return (await res.json()) as T;
}

// ─── student / parent ────────────────────────────────────────────────────────

/** A student's own homework, as a one-entry list so the screen treats both roles alike. */
export async function getMyHomework(): Promise<ChildHomework[]> {
  const data = await apiJson<{ homework?: unknown }>('/student/homework');
  return [{ key: 'self', displayName: '', homework: normalizeFamilyHomework(data.homework) }];
}

export async function getChildHomework(): Promise<ChildHomework[]> {
  const data = await apiJson<{ children?: Array<{ key?: unknown; displayName?: unknown; homework?: unknown }> }>(
    '/parent/homework',
  );
  return (data.children ?? []).flatMap(c =>
    typeof c.key === 'string'
      ? [
          {
            key: c.key,
            displayName: typeof c.displayName === 'string' ? c.displayName : '',
            homework: normalizeFamilyHomework(c.homework),
          },
        ]
      : [],
  );
}

/** Idempotent on the server, so a retry after a dropped response is safe. */
export async function setHomeworkDone(id: string, done: boolean): Promise<void> {
  const res = await apiFetch(`/student/homework/${encodeURIComponent(id)}/done`, {
    method: done ? 'PUT' : 'DELETE',
  });
  await readJson(res, 'Saving homework');
}

// ─── teacher ─────────────────────────────────────────────────────────────────

export interface NewHomework {
  classGroupId: string;
  title: string;
  instructions?: string;
  /** YYYY-MM-DD, Asia/Amman. */
  dueDate: string;
  evaluationId?: string;
}

/**
 * `evaluationId: null` detaches the exam. To clear the instructions send `''` —
 * the server rejects `null` for them.
 */
export interface HomeworkPatch {
  title?: string;
  instructions?: string;
  dueDate?: string;
  evaluationId?: string | null;
}

export async function listClassHomework(
  classId: string,
): Promise<{ studentCount: number; homework: TeacherHomework[] }> {
  const res = await apiFetch(`/classes/${encodeURIComponent(classId)}/homework`);
  const data = await readJson<{ studentCount?: unknown; homework?: unknown }>(res, 'Loading homework');
  return {
    studentCount: typeof data.studentCount === 'number' ? data.studentCount : 0,
    homework: normalizeTeacherHomework(data.homework),
  };
}

export async function createHomework(input: NewHomework): Promise<TeacherHomework | null> {
  const res = await apiFetch('/homework', { method: 'POST', body: JSON.stringify(input) });
  const data = await readJson<{ homework?: unknown }>(res, 'Creating homework');
  return normalizeTeacherHomework([data.homework])[0] ?? null;
}

export async function updateHomework(id: string, patch: HomeworkPatch): Promise<TeacherHomework | null> {
  const res = await apiFetch(`/homework/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await readJson<{ homework?: unknown }>(res, 'Saving homework');
  return normalizeTeacherHomework([data.homework])[0] ?? null;
}

export async function archiveHomework(id: string): Promise<void> {
  const res = await apiFetch(`/homework/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await readJson(res, 'Deleting homework');
}
