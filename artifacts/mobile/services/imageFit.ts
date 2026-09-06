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
