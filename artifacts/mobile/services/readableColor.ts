/**
 * Category colours (activity cards, game teams, question types) are picked for
 * hue, not contrast: sky, amber and emerald at their stock values are 2.5–2.9:1
 * as text on white and worse on the dark card. `readableOn` keeps the hue and
 * moves it toward black on a light surface, or white on a dark one, just far
 * enough to reach WCAG AA.
 */
type RGB = [number, number, number];

const parse = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
};
const toHex = (c: RGB) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const luminance = (c: RGB) =>
  c.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);

export function contrast(a: string, b: string): number {
  const x = luminance(parse(a)), y = luminance(parse(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** `hex`, darkened or lightened just enough to be ≥ `min`:1 on `surface`. */
export function readableOn(hex: string, surface: string, min = 4.5): string {
  if (contrast(hex, surface) >= min) return hex.toUpperCase();
  const towards: RGB = luminance(parse(surface)) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  const c = parse(hex);
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mixed = c.map((v, i) => v + (towards[i]! - v) * t) as RGB;
    if (contrast(toHex(mixed), surface) >= min) return toHex(mixed);
  }
  return toHex(towards);
}

/** White or ink — whichever reads better on a solid `fill`. */
export function textOn(fill: string): string {
  return contrast('#FFFFFF', fill) >= contrast('#0B1B33', fill) ? '#FFFFFF' : '#0B1B33';
}
