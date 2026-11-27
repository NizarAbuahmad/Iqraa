/**
 * A parent's read of their children's homework projects: `GET /parent/homework/:id/submissions` (api-server
 * `routes/homeworkSubmissions.ts`, `readForParent`). The server answers one entry per child of this account who is in
 * the homework's class, each with the child's grouping key (the same key «المدرسة» picks a child by) and their
 * HANDED-IN project only: a draft is never sent, so a child who has not handed in reads as status `none`, no photos.
 *
 * Dependencies are injected so `node --test` can load this file (the real `apiFetch` lives in `apiClient`, which pulls
 * in react-native at module scope). The bound instance is `parentProjectApi.default.ts`; import that from screens, and
 * this file from tests.
 *
 * Every failure throws `ParentProjectError` (status + the server's `code`), so a screen picks its own wording through
 * `apiErrorKey` instead of echoing English. A 404 means «not a project homework of any of your children» (or archived).
 */
import { normalizeSubmission, type SubmissionView } from './homeworkSubmission.ts';

export class ParentProjectError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ParentProjectError';
    this.status = status;
    this.code = code;
  }
}

export interface ChildProject {
  key: string;
  displayName: string;
  submission: SubmissionView;
}

export interface ParentProjectApiDeps {
  apiFetch: (path: string, init?: { method?: string; body?: string; timeoutMs?: number }) => Promise<Response>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The children of a 2xx body, or null when it is not one (a proxy's page, an empty body): that must not read as
 * «nobody handed in». An entry with no key or no `submission` object is dropped rather than shown blank.
 */
export function normalizeChildProjects(json: unknown): ChildProject[] | null {
  if (!isRecord(json) || !Array.isArray(json['children'])) return null;
  const out: ChildProject[] = [];
  for (const c of json['children']) {
    if (!isRecord(c) || typeof c['key'] !== 'string' || c['key'] === '' || !isRecord(c['submission'])) continue;
    out.push({
      key: c['key'],
      displayName: typeof c['displayName'] === 'string' ? c['displayName'] : '',
      submission: normalizeSubmission(c['submission']),
    });
  }
  return out;
}

/**
 * Which children the screen shows: the one «المدرسة» opened it for, when that child is in the answer; otherwise all
 * of them (a link from elsewhere, or a key that no longer matches), so a parent never sees an empty screen for a
 * project that is there.
 */
export function childrenToShow(children: readonly ChildProject[], key: string | null | undefined): ChildProject[] {
  const picked = key ? children.filter(c => c.key === key) : [];
  return picked.length > 0 ? picked : [...children];
}

export function makeParentProjectApi(deps: ParentProjectApiDeps) {
  return {
    async get(homeworkId: string): Promise<ChildProject[]> {
      const res = await deps.apiFetch(`/parent/homework/${encodeURIComponent(homeworkId)}/submissions`);
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        /* not JSON: the status is all we have */
      }
      if (!res.ok) {
        const json = isRecord(body) ? body : {};
        throw new ParentProjectError(
          typeof json['error'] === 'string' && json['error'] ? json['error'] : `Loading the project failed (${res.status})`,
          res.status,
          typeof json['code'] === 'string' ? json['code'] : undefined,
        );
      }
      const children = normalizeChildProjects(body);
      if (!children) throw new ParentProjectError('Unexpected response', res.status);
      return children;
    },
  };
}
