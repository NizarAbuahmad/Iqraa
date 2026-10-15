/**
 * The arithmetic behind shrinking a photo, with no imports.
 *
 * Split from `imageDownscale.ts` for the reason `routeGating.ts` gives: that
 * file reaches for `react-native` and the DOM, and `node --test` can load
 * neither. This is the part worth pinning with tests, so it lives where tests
 * can reach it.
 */

/** Long edge, in pixels, after shrinking. Enough to read handwritten digits. */
export const MAX_SCAN_EDGE = 1600;

/**
 * The size an image should become to fit inside `maxEdge`, preserving aspect.
 *
 * An image already smaller than the limit is left alone rather than scaled
 * *up*, which would add bytes to make it blurrier.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return {
    // Never below 1: a very long thin image would otherwise round its short
    // side to zero and produce a canvas nothing can be drawn on.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The one dimension to give the native manipulator; it works out the other. */
export type ResizeArg = { width: number } | { height: number };

/**
 * What to pass `resize()` so a photo's long edge becomes `maxEdge`, or `null`
 * to leave it alone.
 *
 * Exactly one of `width` / `height` is returned. The manipulator derives the
 * other from the image's own aspect ratio, so the result can never be
 * stretched — which matters because the picker's reported width/height may be
 * the stored (unrotated) size of an EXIF-rotated photo. If they are
 * transposed the cap lands on the other axis and the photo ends up a little
 * larger than `maxEdge`, never distorted.
 *
 * `null` covers both «already small enough» and «dimensions unknown»: in
 * neither case is there a safe resize to ask for, and the caller falls back to
 * the photo as it is.
 */
export function resizeArg(width: number, height: number, maxEdge: number): ResizeArg | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (!(width > 0) || !(height > 0)) return null;
  if (Math.max(width, height) <= maxEdge) return null;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}
