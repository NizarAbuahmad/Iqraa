/**
 * Pen ink in resolution-independent units.
 *
 * A stroke is a list of points. They used to be stored as pixels on the canvas
 * they were drawn on, so any change to the stage — fullscreen, a rotated
 * tablet, a resized browser window — left the ink where it was while the
 * slide reflowed beneath it. Points are now stored as fractions of the canvas
 * WIDTH and multiplied back at render time. Width on both axes, not width and
 * height: one uniform scale keeps a drawn circle round when the aspect ratio
 * changes. Text reflow means the ink is not pinned to a word, but it moves
 * with the slide instead of staying behind.
 *
 * Free of react-native so `node --test` can load it.
 */

const usable = (width: number) => Number.isFinite(width) && width > 0;

/**
 * `points` with the pixel position (`x`, `y`) added, stored as fractions of
 * `width`. Returns `points` unchanged while the canvas has no width yet — a
 * touch that lands before layout would otherwise divide by zero.
 */
export function appendInkPoint(points: string, x: number, y: number, width: number): string {
  if (!usable(width)) return points;
  const p = `${Number((x / width).toFixed(5))},${Number((y / width).toFixed(5))}`;
  return points ? `${points} ${p}` : p;
}

/** The stored fractions as pixel coordinates for a canvas `width` wide. */
export function scaleInkPoints(points: string, width: number): string {
  if (!usable(width) || !points) return '';
  return points
    .split(' ')
    .map(pair => {
      const [fx, fy] = pair.split(',').map(Number);
      return `${Number((fx! * width).toFixed(2))},${Number((fy! * width).toFixed(2))}`;
    })
    .join(' ');
}
