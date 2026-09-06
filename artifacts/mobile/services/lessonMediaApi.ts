/**
 * Server-backed lesson attachments — photos, voice notes, documents a
 * teacher attaches to a specific curriculum lesson, stored in R2.
 *
 * Deliberately separate from `services/lessonMedia.ts` (image/video *URLs*
 * pinned per topic string, on-device only, feeding Class Mode slides). This
 * is a different capability: real files, keyed by the lesson's own KB id
 * (not a free-text topic — see `lib/db/src/schema/lessonMedia.ts`'s header
 * for why), persisted server-side so a reinstall doesn't lose them.
 */
import { apiFetch, apiJson } from './apiClient.ts';

export type LessonMediaKind = 'image' | 'audio' | 'document';

export type LessonMediaItem = {
  id: string;
  lessonId: string;
  kind: LessonMediaKind;
  caption: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** A time-limited signed URL, or null if R2 couldn't sign one right now. */
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
 * Throws with the server's own message (e.g. "too large", "not set up yet")
 * so the caller can show the teacher something actionable, rather than a
 * generic failure.
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

export async function deleteLessonMedia(id: string): Promise<boolean> {
  const res = await apiFetch(`/media/lesson/${id}`, { method: 'DELETE' });
  return res.ok;
}
