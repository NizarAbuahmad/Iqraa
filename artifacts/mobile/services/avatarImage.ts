/**
 * What counts as a profile picture, with no imports.
 *
 * Split from `profilePhoto.ts` for the reason `imageFit.ts` gives: that file
 * reaches for `expo-image-picker`, and the mobile test runner is bare
 * `node --test` with no React Native transform, so it cannot load it at all.
 * The rules worth pinning live here, where tests can reach them.
 */

/**
 * The picture is shown at 88px on the profile header and 40px in a message
 * list. 512 covers both at 3x on the densest phone screen and leaves room to
 * grow the header; past that, every pixel is bytes over a phone connection
 * for detail a circle 88 points wide cannot show.
 */
export const AVATAR_MAX_EDGE = 512;

/**
 * Formats both a browser `<img>` and React Native's `Image` decode.
 *
 * **Must stay in step with `AVATAR_EXTENSION_BY_MIME` in the API's
 * `lib/avatarUpload.ts`** — that list is the one that actually decides, and a
 * type accepted here but not there is a picture the teacher watches upload and
 * then sees refused. Narrower than the lesson-media list on purpose: HEIC off
 * an iPhone is fine to store and cannot be displayed by the web build, which
 * is the build teachers use.
 */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarMime = (typeof AVATAR_MIME_TYPES)[number];

/** The mime of a `data:` URL, or null if that isn't what this string is. */
export function mimeFromDataUrl(dataUrl: string): string | null {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return match ? (match[1] as string) : null;
}

/** Whether this data URL is a picture the server will accept and every client can draw. */
export function isSupportedAvatarDataUrl(dataUrl: string): dataUrl is string {
  const mime = mimeFromDataUrl(dataUrl);
  return !!mime && (AVATAR_MIME_TYPES as readonly string[]).includes(mime);
}
