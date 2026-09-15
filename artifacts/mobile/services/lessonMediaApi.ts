/**
 * The teacher's media library — photos, voice notes, documents and saved video
 * links they can attach to a lesson, drop into a deck, or send to a student.
 *
 * Two kinds of item, one shape (see `routes/lessonMedia.ts`): an UPLOAD, whose
 * bytes live in R2 and whose `url` is signed and expires in an hour, and a
 * LINK (`isLink: true`) to something already on the web, whose `url` is just
 * the URL and never expires. Callers render `url` either way; only code that
 * *stores* a url has to care, and that is handled once by `refreshDeckMedia`
 * in `services/classMedia.ts`.
 *
 * Deliberately separate from `services/lessonMedia.ts` (image/video *URLs*
 * pinned per topic string, on-device only, feeding Class Mode slides). That is
 * a different capability that predates this one and is still distinct.
 */
import { apiFetch, apiJson } from './apiClient.ts';

export type LessonMediaKind = 'image' | 'video' | 'audio' | 'document';

export type LessonMediaItem = {
  id: string;
  /** Null for a library-only item that was never pinned to a lesson. */
  lessonId: string | null;
  kind: LessonMediaKind;
  caption: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /** True for a saved link — `url` is permanent and needs no refreshing. */
  isLink: boolean;
  /** Signed and short-lived for an upload; the plain source for a link. Null if R2 couldn't sign. */
  url: string | null;
};

/** Empty on any failure (offline, R2/schema not set up) — "nothing attached yet", not a crash. */
export async function listLessonMedia(lessonId: string): Promise<LessonMediaItem[]> {
  if (!lessonId.trim()) return [];
  try {
    return await apiJson<LessonMediaItem[]>(`/media/lesson?lessonId=${encodeURIComponent(lessonId)}`);
  } catch {
    return [];
  }
}

/**
 * Everything this teacher has, newest first — the cross-lesson view.
 *
 * Empty on failure for the same reason `listLessonMedia` is: an empty library
 * and an unreachable one look the same to a teacher who is mid-lesson-plan,
 * and the picker has other tabs that still work.
 */
export async function listLibrary(
  opts: { q?: string; kind?: LessonMediaKind } = {},
): Promise<LessonMediaItem[]> {
  const params = new URLSearchParams();
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  if (opts.kind) params.set('kind', opts.kind);
  const query = params.toString();
  try {
    return await apiJson<LessonMediaItem[]>(`/media/library${query ? `?${query}` : ''}`);
  } catch {
    return [];
  }
}

/**
 * Throws with the server's own message (e.g. "too large", "not set up yet")
 * so the caller can show the teacher something actionable, rather than a
 * generic failure.
 *
 * `lessonId` is optional: pass it to pin the upload to a lesson as well as
 * filing it in the library, omit it for a library-only item.
 */
export async function uploadLessonMedia(
  lessonId: string,
  dataUrl: string,
  caption: string,
): Promise<LessonMediaItem> {
  return apiJson<LessonMediaItem>('/media/lesson', {
    method: 'POST',
    body: JSON.stringify({ lessonId, dataUrl, caption }),
  });
}

/**
 * Save a link — a YouTube video, an Unsplash photo — as a library item.
 *
 * Nothing is uploaded. The point is that a teacher who found a good video once
 * can reach for that exact video again, rather than re-running a search that
 * may rank something else first.
 *
 * Classify the URL with `classifyMediaUrl` (services/classMedia.ts) before
 * calling: the server takes `kind` on trust and only checks it is https and a
 * known kind.
 */
export async function saveLibraryLink(input: {
  sourceUrl: string;
  kind: LessonMediaKind;
  caption: string;
  lessonId?: string;
}): Promise<LessonMediaItem> {
  return apiJson<LessonMediaItem>('/media/lesson', {
    method: 'POST',
    body: JSON.stringify({
      sourceUrl: input.sourceUrl,
      kind: input.kind,
      caption: input.caption,
      lessonId: input.lessonId ?? '',
    }),
  });
}

export async function deleteLessonMedia(id: string): Promise<boolean> {
  const res = await apiFetch(`/media/lesson/${id}`, { method: 'DELETE' });
  return res.ok;
}
