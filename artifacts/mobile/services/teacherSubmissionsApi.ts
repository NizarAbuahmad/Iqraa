/**
 * The teacher's calls over a homework's project submissions (api-server `routes/homeworkSubmissions.ts`):
 * the roster list, one student's project, and clearing it.
 *
 * Dependencies are injected so `node --test` can load this file (the real `apiFetch` lives in `apiClient`, which
 * pulls in react-native at module scope). The bound instance is `teacherSubmissionsApi.default.ts`; import that
 * from screens, and this file from tests.
 *
 * Every failure throws `TeacherSubmissionsError` (status + the server's `code` when it sent one; the teacher
 * routes' 404s send none), so a screen picks its own wording through `apiErrorKey` instead of echoing English.
 */
import {
  normalizeTeacherSubmissionDetail,
  normalizeTeacherSubmissionList,
  type TeacherSubmissionDetail,
  type TeacherSubmissionList,
} from './teacherSubmissions.ts';

export class TeacherSubmissionsError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'TeacherSubmissionsError';
    this.status = status;
    this.code = code;
  }
}

export interface TeacherSubmissionsApiDeps {
  apiFetch: (path: string, init?: { method?: string; body?: string; timeoutMs?: number }) => Promise<Response>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The parsed body, or a `TeacherSubmissionsError` carrying the status and the server's `code` (undefined if the body was not JSON). */
async function readJson(res: Response, action: string): Promise<Record<string, unknown>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON: the status is all we have */
  }
  const json = isRecord(body) ? body : {};
  if (!res.ok) {
    throw new TeacherSubmissionsError(
      typeof json['error'] === 'string' && json['error'] ? json['error'] : `${action} failed (${res.status})`,
      res.status,
      typeof json['code'] === 'string' ? json['code'] : undefined,
    );
  }
  return json;
}

export function makeTeacherSubmissionsApi(deps: TeacherSubmissionsApiDeps) {
  const base = (homeworkId: string) => `/homework/${encodeURIComponent(homeworkId)}/submissions`;

  return {
    async list(homeworkId: string): Promise<TeacherSubmissionList> {
      const res = await deps.apiFetch(base(homeworkId));
      const json = await readJson(res, 'Loading submissions');
      // A 2xx that is not a list (a proxy's page, an empty body) must not read as «nobody handed in».
      if (!isRecord(json['homework']) || !Array.isArray(json['submissions'])) {
        throw new TeacherSubmissionsError('Unexpected response', res.status);
      }
      return normalizeTeacherSubmissionList(json);
    },

    async detail(homeworkId: string, studentId: string): Promise<TeacherSubmissionDetail> {
      const res = await deps.apiFetch(`${base(homeworkId)}/${encodeURIComponent(studentId)}`);
      const detail = normalizeTeacherSubmissionDetail(await readJson(res, 'Loading the project'));
      if (!detail) throw new TeacherSubmissionsError('Unexpected response', res.status);
      return detail;
    },

    async clear(homeworkId: string, studentId: string): Promise<void> {
      const res = await deps.apiFetch(`${base(homeworkId)}/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
      const json = await readJson(res, 'Clearing the project');
      // A 2xx that does not say `cleared` must not read as a project that was removed.
      if (json['cleared'] !== true) throw new TeacherSubmissionsError('Unexpected response', res.status);
    },
  };
}
