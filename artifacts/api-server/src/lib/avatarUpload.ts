/**
 * Pure validation for `routes/auth.ts`'s avatar endpoints — split out for the
 * same reason as `lessonMediaUpload.ts`: unit-testable without a live DB.
 *
 * Deliberately its own, narrower table rather than reusing
 * `lessonMediaUpload.ts`'s `EXTENSION_BY_MIME`: a profile picture is always
 * an image, and the client already downscales to a JPEG on web before
 * upload, so there is no reason to accept audio/PDF here the way lesson
 * attachments do.
 */

export const MAX_AVATAR_DATA_URL_LENGTH = 4_000_000;

const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function extensionForAvatarMime(mime: string): string | null {
  return AVATAR_EXTENSION_BY_MIME[mime] ?? null;
}
