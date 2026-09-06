/**
 * Pure parsing/validation for `routes/lessonMedia.ts`, split out so it's
 * unit-testable without a live DB — the route file imports `@workspace/db`
 * at module scope, which throws without `DATABASE_URL` set, so nothing that
 * imports it directly is reachable from `node --test`. Same reasoning as
 * `classroomPrompts.ts` being pulled out of `generate.ts`.
 */

export type LessonMediaKind = "image" | "audio" | "document";

export const MAX_DATA_URL_LENGTH = 8_000_000;

export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "application/pdf": ".pdf",
};

const KIND_BY_MIME_PREFIX: Record<string, LessonMediaKind> = {
  image: "image",
  audio: "audio",
};

export function kindForMime(mime: string): LessonMediaKind {
  const prefix = mime.split("/")[0] ?? "";
  return KIND_BY_MIME_PREFIX[prefix] ?? "document";
}

/** Parses `data:<mime>;base64,<data>` into its parts, or null if malformed. */
export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] as string;
  try {
    return { mime, buffer: Buffer.from(match[2] as string, "base64") };
  } catch {
    return null;
  }
}
