/**
 * Pure checks for scripts/src/library-upload.ts — no network, no disk, so they
 * can be tested. The API (routes/library.ts + lib/libraryResource.ts) stays the
 * authority and re-validates everything; this copy only lets a bad manifest row
 * fail before any upload starts.
 *
 * ponytail: the allowlist and caps are copied from lib/libraryResource.ts
 * (scripts can't import across packages under rootDir=src). If the server's list
 * grows, this one just under-accepts until it is updated.
 */

export const LIBRARY_CATEGORIES = [
  "infographic",
  "image",
  "video",
  "audio",
  "game",
  "worksheet",
  "template",
  "presentation",
  "document",
] as const;

export const MAX_LIBRARY_FILE_BYTES = 25 * 1024 * 1024;

export const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export interface ManifestEntry {
  /** Path relative to the manifest. Exactly one of `file` / `url`. */
  file?: string;
  url?: string;
  gradeId: string;
  subjectId: string;
  lessonId?: string;
  category: string;
  titleAr: string;
  description?: string;
  semester?: 1 | 2;
  thumbnailUrl?: string;
  /** Written back by the uploader once published; an entry with an id is skipped. */
  id?: string;
}

export type Checked =
  | { ok: true; kind: "file"; mime: string }
  | { ok: true; kind: "link" }
  | { ok: false; error: string };

/** `sizeBytes` is the file's size on disk; pass it for file entries. */
export function checkEntry(entry: ManifestEntry, sizeBytes?: number): Checked {
  const fail = (error: string): Checked => ({ ok: false, error });
  if (!/^grade-\d{1,2}$/.test(entry.gradeId ?? "")) return fail("gradeId must look like grade-5");
  if (!/^[a-z][a-z0-9-]*$/.test(entry.subjectId ?? "")) return fail("subjectId is required");
  if (entry.lessonId && !entry.lessonId.startsWith("kbl-")) return fail("lessonId must be a kbl-* lesson id");
  if (!(LIBRARY_CATEGORIES as readonly string[]).includes(entry.category)) {
    return fail(`category must be one of ${LIBRARY_CATEGORIES.join(", ")}`);
  }
  if (!entry.titleAr?.trim()) return fail("titleAr is required");
  if (entry.semester !== undefined && entry.semester !== 1 && entry.semester !== 2) return fail("semester must be 1 or 2");
  if (entry.thumbnailUrl && !/^https:\/\//.test(entry.thumbnailUrl)) return fail("thumbnailUrl must be https");
  if (!entry.file === !entry.url) return fail("give exactly one of file or url");

  if (entry.url) {
    return /^https:\/\//.test(entry.url) ? { ok: true, kind: "link" } : fail("url must be an https link");
  }

  const dot = entry.file!.lastIndexOf(".");
  const mime = dot < 0 ? undefined : MIME_BY_EXTENSION[entry.file!.slice(dot).toLowerCase()];
  if (!mime) return fail(`unsupported file type: ${entry.file}`);
  if (sizeBytes === 0) return fail("the file is empty");
  if (sizeBytes !== undefined && sizeBytes > MAX_LIBRARY_FILE_BYTES) {
    return fail("file is over 25 MB; publish it as a link instead");
  }
  return { ok: true, kind: "file", mime };
}

/** Same grade + lesson + category + title = the same item, for skipping re-uploads. */
export function dedupeKey(e: { gradeId: string; lessonId?: string | null; category: string; titleAr: string }): string {
  return [e.gradeId, e.lessonId ?? "", e.category, e.titleAr.trim()].join("|");
}

/** Query string for POST /library/file (the body is the file itself). */
export function fileQuery(e: ManifestEntry): string {
  const q = new URLSearchParams({
    gradeId: e.gradeId,
    subjectId: e.subjectId,
    category: e.category,
    titleAr: e.titleAr,
  });
  if (e.lessonId) q.set("lessonId", e.lessonId);
  if (e.description) q.set("description", e.description);
  if (e.semester) q.set("semester", String(e.semester));
  if (e.thumbnailUrl) q.set("thumbnailUrl", e.thumbnailUrl);
  return q.toString();
}

/** JSON body for POST /library/link. */
export function linkBody(e: ManifestEntry): Record<string, unknown> {
  const { file: _file, id: _id, ...rest } = e;
  return rest;
}
