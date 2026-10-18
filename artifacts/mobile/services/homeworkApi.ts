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
  normalizeChildHomework,
  normalizeFamilyHomework,
  normalizeTeacherHomework,
  normalizeTeacherList,
  type ChildHomework,
  type TeacherHomework,
  type TeacherHomeworkList,
} from './homework.ts';
import type { SavedMaterial } from './workspace.ts';

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
  return [{ key: 'self', displayName: '', canTrack: true, homework: normalizeFamilyHomework(data.homework) }];
}

export async function getChildHomework(): Promise<ChildHomework[]> {
  const data = await apiJson<{ children?: unknown }>('/parent/homework');
  return normalizeChildHomework(data.children);
}

/**
 * A teacher's saved material attached to a homework, read-only and without its
 * answers (the server strips them). Shaped as a `SavedMaterial` so the workspace
 * viewer draws it; null when the server answers 404 — not this family's, or no
 * longer attached.
 */
export async function getHomeworkMaterial(
  homeworkId: string,
  materialId: string,
  role: 'student' | 'parent',
): Promise<SavedMaterial | null> {
  const res = await apiFetch(
    `/${role}/homework/${encodeURIComponent(homeworkId)}/materials/${encodeURIComponent(materialId)}`,
  );
  if (res.status === 404) return null;
  const { material: m } = await readJson<{ material: Omit<SavedMaterial, 'isFavorite' | 'formState'> }>(res, 'Opening attachment');
  return { ...m, language: m.language === 'en' ? 'en' : 'ar', isFavorite: false, formState: {} };
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
  /** Bodies as the class shelf's POST takes them (`addBodyFor` / `resourceBody`). */
  resources?: object[];
  /** Also leave a line in the class's group chat. */
  shareToChat?: boolean;
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
  /** The whole list: replaces what is attached. */
  resources?: object[];
}

export async function listClassHomework(classId: string): Promise<TeacherHomeworkList> {
  const res = await apiFetch(`/classes/${encodeURIComponent(classId)}/homework`);
  return normalizeTeacherList(await readJson<unknown>(res, 'Loading homework'));
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

/** Leaves the homework's line in its class's group chat. */
export async function shareHomework(id: string): Promise<void> {
  const res = await apiFetch(`/homework/${encodeURIComponent(id)}/share`, { method: 'POST' });
  await readJson(res, 'Sharing homework');
}

export async function archiveHomework(id: string): Promise<void> {
  const res = await apiFetch(`/homework/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await readJson(res, 'Deleting homework');
}
