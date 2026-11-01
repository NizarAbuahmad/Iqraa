/**
 * A drawn diagram for the PDF: the shapes as inline SVG, the labels as HTML
 * text over them. Text stays text — the print engine shapes Arabic and wraps
 * a long label inside its box, which SVG <text> would do neither of.
 *
 * Sized for the A4-landscape deck slide (`.deck-slide` is 297mm wide, the body
 * pads 48px a side): the drawing is `PX_W` pixels wide, and every position and
 * font size is the geometry's own unit scaled by `PX_W / width`.
 *
 * The PDF is a printout, so every beat is drawn: nothing is held back for a
 * «نقطة بنقطة» build. Each text box is centred, vertically and horizontally,
 * in its own box (the geometry sizes a box for the longest wrap, so a short
 * label leaves air around it).
 *
 * Pure and react-free so `node --test` can load it.
 */
import { arrowHead, DIAGRAM_FONT, type DiagramGeometry, type Paint } from './diagramGeometry.ts';

export interface DiagramColors { card: string; tint: string; accent: string; border: string; text: string }

const PX_W = 1000;

export function diagramHtml(g: DiagramGeometry, c: DiagramColors, rtl: boolean, escape: (s: string) => string): string {
  const k = PX_W / g.width;
  const pxH = Math.round(g.height * k);
  const fill = (p: Paint) => (p === 'none' ? 'none' : p === 'tint' ? c.tint : c.card);
  const stroke = (s: 'accent' | 'border') => (s === 'accent' ? c.accent : c.border);
  const n = (v: number) => (v * k).toFixed(1);
  const shapes = g.shapes.map(s => {
    if (s.t === 'box') {
      return `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.w)}" height="${n(s.h)}" rx="${n(10)}" fill="${fill(s.fill)}" stroke="${stroke(s.stroke)}" stroke-width="2.5"/>`;
    }
    if (s.t === 'ellipse') {
      return `<ellipse cx="${n(s.cx)}" cy="${n(s.cy)}" rx="${n(s.rx)}" ry="${n(s.ry)}" fill="${fill(s.fill)}" stroke="${stroke(s.stroke)}" stroke-width="3"/>`;
    }
    const line = `<line x1="${n(s.x1)}" y1="${n(s.y1)}" x2="${n(s.x2)}" y2="${n(s.y2)}" stroke="${c.accent}" stroke-width="3"/>`;
    if (!s.arrow) return line;
    const pts = arrowHead(s.x1 * k, s.y1 * k, s.x2 * k, s.y2 * k, 14).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return `${line}<polygon points="${pts}" fill="${c.accent}"/>`;
  }).join('');
  const labels = g.texts.map(t => `<div class="deck-diagram-text" style="left:${n(t.x)}px;top:${n(t.y)}px;width:${n(t.w)}px;height:${n(t.h)}px;font-size:${n(DIAGRAM_FONT[t.size])}px;font-weight:${t.bold ? 700 : 400};color:${c.text};direction:${rtl ? 'rtl' : 'ltr'}"><span class="deck-diagram-lines">${t.text.split('\n').map(line => escape(line)).join('<br>')}</span></div>`).join('');
  return `<div class="deck-diagram" style="width:${PX_W}px;height:${pxH}px"><svg width="${PX_W}" height="${pxH}" viewBox="0 0 ${PX_W} ${pxH}">${shapes}</svg>${labels}</div>`;
}
