/**
 * A student's project for a homework that asks for one: the five calls over
 * `/student/homework/:id/submission` (api-server `routes/homeworkSubmissions.ts`).
 *
 * Dependencies are injected so `node --test` can load this file: the real `apiFetch` lives in `apiClient`,
 * which pulls in react-native and secure storage at module scope. The bound instance is
 * `homeworkSubmissionApi.default.ts`; import that from screens, and this file from tests.
 *
 * Every failure throws `SubmissionError` (status + the server's `code`, the shape of `HomeworkError`), so a
 * screen picks its own wording through `apiErrorKey` instead of echoing the server's English.
 */
import {
  noteChanged,
  normalizeSubmission,
  photoDataUrlOk,
  type SubmissionPhoto,
  type SubmissionView,
} from './homeworkSubmission.ts';

/** A photo is a data URL of up to ~6 MB: far past the 15 s default on a slow phone connection. */
export const UPLOAD_TIMEOUT_MS = 45_000;

export class SubmissionError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'SubmissionError';
    this.status = status;
    this.code = code;
  }
}

export interface SubmissionApiDeps {
  apiFetch: (path: string, init?: { method?: string; body?: string; timeoutMs?: number }) => Promise<Response>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The parsed body, or a `SubmissionError` carrying the status and the server's `code` (undefined if the body was not JSON). */
async function readJson(res: Response, action: string): Promise<Record<string, unknown>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON: the status is all we have */
  }
  const json = isRecord(body) ? body : {};
  if (!res.ok) {
    throw new SubmissionError(
      typeof json['error'] === 'string' && json['error'] ? json['error'] : `${action} failed (${res.status})`,
      res.status,
      typeof json['code'] === 'string' ? json['code'] : undefined,
    );
  }
  return json;
}

/**
 * The `submission` of a 2xx body, or a `SubmissionError` when there is none. A 2xx that does not hold one
 * (a proxy's page, an empty body) must not read as a blank project or as «not handed in»: the screen
 * shows an error with a retry instead.
 */
function viewOf(json: Record<string, unknown>, status: number): SubmissionView {
  if (!isRecord(json['submission'])) throw new SubmissionError('Unexpected response', status);
  return normalizeSubmission(json['submission']);
}

export function makeHomeworkSubmissionApi(deps: SubmissionApiDeps) {
  const base = (homeworkId: string) => `/student/homework/${encodeURIComponent(homeworkId)}/submission`;

  const api = {
    async get(homeworkId: string): Promise<{ submission: SubmissionView; dueDate: string }> {
      const res = await deps.apiFetch(base(homeworkId));
      const json = await readJson(res, 'Loading your project');
      const dueDate = json['dueDate'];
      if (typeof dueDate !== 'string' || dueDate === '') throw new SubmissionError('Unexpected response', res.status);
      return { submission: viewOf(json, res.status), dueDate };
    },

    async uploadPhoto(homeworkId: string, photoDataUrl: string): Promise<{ photo: SubmissionPhoto; photoCount: number }> {
      // The server would refuse these too; saying so here spares a 6 MB upload that cannot succeed.
      if (!photoDataUrlOk(photoDataUrl)) throw new SubmissionError('Unsupported photo', 400, 'unsupported_type');
      const res = await deps.apiFetch(`${base(homeworkId)}/photos`, {
        method: 'POST',
        body: JSON.stringify({ photoDataUrl }),
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
      const json = await readJson(res, 'Saving your photo');
      // A 2xx that does not hold a photo must not read as a saved one.
      const photo = normalizeSubmission({ photos: [json['photo']] }).photos[0];
      if (!photo) throw new SubmissionError('Unexpected response', res.status);
      return { photo, photoCount: typeof json['photoCount'] === 'number' ? json['photoCount'] : 1 };
    },

    async removePhoto(homeworkId: string, photoId: string): Promise<void> {
      await readJson(
        await deps.apiFetch(`${base(homeworkId)}/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' }),
        'Removing your photo',
      );
    },

    async saveNote(homeworkId: string, note: string): Promise<SubmissionView> {
      const res = await deps.apiFetch(base(homeworkId), { method: 'PUT', body: JSON.stringify({ note }) });
      return viewOf(await readJson(res, 'Saving your note'), res.status);
    },

    async submit(homeworkId: string): Promise<SubmissionView> {
      const res = await deps.apiFetch(`${base(homeworkId)}/submit`, { method: 'POST' });
      return viewOf(await readJson(res, 'Handing in your project'), res.status);
    },

    /** Saves the note first only when `noteChanged(saved, note)`, then hands in. A failed save hands nothing in. */
    async handIn(homeworkId: string, savedNote: string, note: string): Promise<SubmissionView> {
      if (noteChanged(savedNote, note)) await api.saveNote(homeworkId, note);
      return api.submit(homeworkId);
    },
  };
  return api;
}
