/**
 * Rules for the resources library (routes/library.ts): which categories exist,
 * which files may be uploaded, and what a valid item looks like. Pure, so the
 * decisions are testable without a database or a bucket.
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
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

export function isLibraryCategory(value: unknown): value is LibraryCategory {
  return typeof value === "string" && (LIBRARY_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 25 MB. Cloud Run refuses any request body over 32 MiB before it reaches
 * Express, so the ceiling has to sit under that; anything longer (a full
 * lesson video) goes in as a link instead.
 */
export const MAX_LIBRARY_FILE_BYTES = 25 * 1024 * 1024;

/**
 * What may be uploaded, and the extension its key gets. SVG and HTML are left
 * out on purpose: both can carry script, and these are served to every teacher.
 */
export const LIBRARY_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

export interface LibraryMeta {
  gradeId: string;
  subjectId: string;
  lessonId: string | null;
  category: LibraryCategory;
  titleAr: string;
  description: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates the fields every item carries. Returns the cleaned meta or an error message. */
export function parseLibraryMeta(input: Record<string, unknown>): LibraryMeta | { error: string } {
  const gradeId = str(input.gradeId, 40);
  const subjectId = str(input.subjectId, 60);
  const lessonId = str(input.lessonId, 120) || null;
  const titleAr = str(input.titleAr, 200);
  const description = str(input.description, 1000);
  if (!/^grade-\d{1,2}$/.test(gradeId)) return { error: "gradeId must look like grade-5" };
  if (!/^[a-z][a-z0-9-]*$/.test(subjectId)) return { error: "subjectId is required" };
  if (lessonId && !lessonId.startsWith("kbl-")) return { error: "lessonId must be a kbl-* lesson id" };
  if (!isLibraryCategory(input.category)) return { error: `category must be one of ${LIBRARY_CATEGORIES.join(", ")}` };
  if (!titleAr) return { error: "titleAr is required" };
  return { gradeId, subjectId, lessonId, category: input.category, titleAr, description };
}

/** A link item's URL: https only, so a teacher's tap never lands on plain http or a javascript: URL. */
export function parseLibraryLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
