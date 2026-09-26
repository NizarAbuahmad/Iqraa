/**
 * The resources library API (api-server routes/library.ts). Staff upload;
 * everyone signed in reads.
 */
import { apiFetch, apiJson } from './apiClient.ts';

export const LIBRARY_CATEGORIES = [
  'infographic',
  'image',
  'video',
  'audio',
  'game',
  'worksheet',
  'template',
  'presentation',
  'document',
] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

export type LibraryItem = {
  id: string;
  gradeId: string;
  subjectId: string;
  lessonId: string | null;
  category: LibraryCategory;
  titleAr: string;
  description: string;
  mimeType: string | null;
  sizeBytes: number | null;
  isLink: boolean;
  /** Null only if the server can't compose a public URL right now. */
  url: string | null;
  /** 1 or 2 when the resource covers one semester only; null = whole book. */
  semester: 1 | 2 | null;
  /** Optional cover image URL (set by admin or auto-derived from YouTube). */
  thumbnailUrl: string | null;
  createdAt: string;
};

export type LibraryMeta = {
  gradeId: string;
  subjectId: string;
  lessonId?: string | null;
  semester?: 1 | 2 | null;
  category: LibraryCategory;
  titleAr: string;
  description?: string;
  thumbnailUrl?: string | null;
};

/** Must match the server's MAX_LIBRARY_FILE_BYTES; checked here so a big file fails before it uploads. */
export const MAX_LIBRARY_FILE_BYTES = 25 * 1024 * 1024;

/** Empty on any failure — an unreachable library reads as an empty one, not a broken screen. */
export async function listLibrary(gradeId: string): Promise<LibraryItem[]> {
  if (!gradeId) return [];
  try {
    return await apiJson<LibraryItem[]>(`/library?gradeId=${encodeURIComponent(gradeId)}`);
  } catch {
    return [];
  }
}

export function addLibraryLink(meta: LibraryMeta, url: string): Promise<LibraryItem> {
  return apiJson<LibraryItem>('/library/link', { method: 'POST', body: JSON.stringify({ ...meta, url }) });
}

/** Sends the file as the raw body; metadata rides in the query string. */
export function uploadLibraryFile(meta: LibraryMeta, file: Blob, mimeType: string): Promise<LibraryItem> {
  const query = new URLSearchParams({
    gradeId: meta.gradeId,
    subjectId: meta.subjectId,
    lessonId: meta.lessonId ?? '',
    semester: meta.semester != null ? String(meta.semester) : '',
    category: meta.category,
    titleAr: meta.titleAr,
    description: meta.description ?? '',
    thumbnailUrl: meta.thumbnailUrl ?? '',
  });
  return apiJson<LibraryItem>(`/library/file?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': mimeType },
    body: file,
    timeoutMs: 180_000,
  });
}

export async function deleteLibraryItem(id: string): Promise<boolean> {
  const res = await apiFetch(`/library/${id}`, { method: 'DELETE' });
  return res.ok;
}
