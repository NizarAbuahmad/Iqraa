/**
 * The rules for a student's project submission that need no database: reading
 * a note and a photo, and deciding what state a submission is in. Pure on
 * purpose, like rules.ts, so `node --test` loads it without `DATABASE_URL`.
 *
 * A photo arrives as a `data:` URL, one per request. The declared type is
 * checked against the first bytes, not trusted: this is a minor's upload that a
 * teacher and a parent will open, and a file that is not the image it says it
 * is must never be stored under an image key.
 */
import { parseDataUrl } from "../../lib/lessonMediaUpload.ts";

export const PHOTOS_MAX = 6;
export const NOTE_MAX = 2000;
/** Decoded bytes per photo. The app downscales first, so a real photo is far below this; it is the server's own backstop. */
export const PHOTO_BYTES_MAX = 4 * 1024 * 1024;
/** Base64 of PHOTO_BYTES_MAX is about 5.6M characters; refuse an absurd body before decoding it. */
const PHOTO_DATA_URL_MAX = 6_000_000;

export type SubmissionStatus = "none" | "submitted" | "late";
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

const EXTENSION = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as const;
type PhotoMime = keyof typeof EXTENSION;

export interface PhotoUpload {
  mime: PhotoMime;
  extension: string;
  buffer: Buffer;
}

function fail(error: string, code: string): { ok: false; error: string; code: string } {
  return { ok: false, error, code };
}

/** The image type the first bytes say it is, or null. */
export function sniffImageMime(buf: Buffer): PhotoMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function parsePhotoUpload(body: unknown): Parsed<PhotoUpload> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>)["photoDataUrl"] : undefined;
  if (typeof raw !== "string" || raw === "") return fail("photoDataUrl is required", "missing_fields");
  if (raw.length > PHOTO_DATA_URL_MAX) return fail("That photo is too large.", "file_too_large");
  const parsed = parseDataUrl(raw);
  if (!parsed) return fail("photoDataUrl must be a data: URL", "bad_data_url");
  if (!(parsed.mime in EXTENSION)) {
    return fail(`Unsupported photo type: ${parsed.mime}. HEIC must be converted on the device.`, "unsupported_type");
  }
  if (parsed.buffer.length > PHOTO_BYTES_MAX) return fail("That photo is too large.", "file_too_large");
  const sniffed = sniffImageMime(parsed.buffer);
  if (sniffed === null || sniffed !== parsed.mime) return fail("The file is not a valid image", "bad_image");
  return { ok: true, value: { mime: sniffed, extension: EXTENSION[sniffed], buffer: parsed.buffer } };
}

export function parseNote(body: unknown): Parsed<string> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>)["note"] : undefined;
  if (typeof raw !== "string") return fail("note must be text", "invalid");
  const note = raw.trim();
  if (note.length > NOTE_MAX) return fail(`note must be at most ${NOTE_MAX} characters`, "too_long");
  return { ok: true, value: note };
}

/** `late` is computed, never stored: it is `submitted_at` against the due day's last millisecond. */
export function submissionStatus(input: { submittedAt: Date | null; dueAt: Date }): SubmissionStatus {
  if (!input.submittedAt) return "none";
  return input.submittedAt.getTime() > input.dueAt.getTime() ? "late" : "submitted";
}

/** A handed-in project can be replaced until the due day ends. A draft is never locked. */
export function isLocked(input: { submittedAt: Date | null; dueAt: Date; now: Date }): boolean {
  return input.submittedAt !== null && input.now.getTime() > input.dueAt.getTime();
}

export function canSubmit(input: { photoCount: number; note: string }): boolean {
  return input.photoCount > 0 || input.note.trim() !== "";
}
