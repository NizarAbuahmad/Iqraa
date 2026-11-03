/**
 * A figure as a standalone SVG string. The app draws with react-native-svg; this
 * is for places with no React: the pregenerate review files an admin looks at
 * before approving an explanation, and any later HTML/PDF export.
 */
import { figureAltText } from './alt.ts';
import { layoutFigure, type Pt } from './geometry.ts';
import type { Figure } from './types.ts';
import { gridTicks, toPx } from './viewport.ts';

const COLORS = ['#2563EB', '#DC2626', '#15803D'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => v.toFixed(1);

export function figureSvg(figure: Figure, opts: { lang?: 'ar' | 'en'; width?: number; height?: number } = {}): string {
  const w = opts.width ?? 480;
  const h = opts.height ?? 320;
  const lang = opts.lang ?? 'en';
  const lay = layoutFigure(figure, { w, h });
  const vp = lay.viewport;
  const { xs, ys } = gridTicks(vp);
  const o = toPx(vp, 0, 0);
  const axisX = o.x >= 0 && o.x <= w ? o.x : null;
  const axisY = o.y >= 0 && o.y <= h ? o.y : null;
  const color = (i: number) => COLORS[i % COLORS.length]!;
  const text = (p: Pt, s: string, fill: string, size = 13, anchor = 'start') =>
    `<text x="${n(p.x)}" y="${n(p.y)}" fill="${fill}" font-size="${size}" font-family="sans-serif" text-anchor="${anchor}">${esc(s)}</text>`;

  // The layout puts curve points far outside the box on purpose (steep branches
  // climb off-canvas), so everything is clipped to the box twice over: the root
  // `overflow="hidden"` and a clipPath on the drawing group.
  const clipId = `fig-clip-${w}x${h}`;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" overflow="hidden" role="img" aria-label="${esc(figureAltText(figure, lang))}">`);
  out.push(`<defs><clipPath id="${clipId}"><rect width="${w}" height="${h}"/></clipPath></defs>`);
  out.push(`<g clip-path="url(#${clipId})">`);
  out.push(`<rect width="${w}" height="${h}" fill="#ffffff"/>`);
  for (const t of xs) out.push(`<line x1="${n(t.px)}" y1="0" x2="${n(t.px)}" y2="${h}" stroke="#e5e7eb"/>`);
  for (const t of ys) out.push(`<line x1="0" y1="${n(t.px)}" x2="${w}" y2="${n(t.px)}" stroke="#e5e7eb"/>`);
  if (axisX !== null) out.push(`<line x1="${n(axisX)}" y1="0" x2="${n(axisX)}" y2="${h}" stroke="#6b7280" stroke-width="1.5"/>`);
  if (axisY !== null) out.push(`<line x1="0" y1="${n(axisY)}" x2="${w}" y2="${n(axisY)}" stroke="#6b7280" stroke-width="1.5"/>`);
  const labelY = Math.min(h - 4, Math.max(14, (axisY ?? h) + 14));
  const labelX = Math.min(w - 28, Math.max(4, (axisX ?? 0) + 5));
  for (const t of xs) if (t.value !== 0) out.push(text({ x: t.px, y: labelY }, String(t.value), '#6b7280', 10, 'middle'));
  for (const t of ys) if (t.value !== 0) out.push(text({ x: labelX, y: t.px - 3 }, String(t.value), '#6b7280', 10));
  if (axisY !== null) out.push(text({ x: w - 14, y: axisY - 5 }, lang === 'ar' ? 'س' : 'x', '#374151'));
  if (axisX !== null) out.push(text({ x: axisX + 6, y: 14 }, lang === 'ar' ? 'ص' : 'y', '#374151'));

  for (const c of lay.curves) {
    for (const s of c.segments) {
      out.push(`<polyline points="${s.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="none" stroke="${color(c.colorIndex)}" stroke-width="2"/>`);
    }
    if (c.label && c.labelAt) out.push(text(c.labelAt, c.label, color(c.colorIndex)));
  }
  for (const p of lay.points) {
    out.push(`<circle cx="${n(p.at.x)}" cy="${n(p.at.y)}" r="4" fill="${color(p.colorIndex)}"/>`);
    out.push(text(p.labelAt, p.label, color(p.colorIndex)));
  }
  for (const c of lay.components) {
    out.push(`<line x1="${n(c.from.x)}" y1="${n(c.from.y)}" x2="${n(c.to.x)}" y2="${n(c.to.y)}" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 3"/>`);
  }
  for (const a of lay.arrows) {
    out.push(`<line x1="${n(a.from.x)}" y1="${n(a.from.y)}" x2="${n(a.to.x)}" y2="${n(a.to.y)}" stroke="${color(a.colorIndex)}" stroke-width="2"/>`);
    out.push(`<polygon points="${a.head.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="${color(a.colorIndex)}"/>`);
    if (a.label && a.labelAt) out.push(text(a.labelAt, a.label, color(a.colorIndex)));
  }
  out.push('</g>');
  out.push('</svg>');
  return out.join('');
}
