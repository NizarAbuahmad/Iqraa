/**
 * A drawn diagram in PowerPoint: native ellipses, rounded boxes and lines, and
 * a text box per label, so a teacher can move a stage or fix a word. Positions
 * come from `diagramGeometry`, built in inches for the area this draws into.
 *
 * Kept apart from `exportPptx.ts` (which imports react-native and expo) so the
 * bare `node --test` runner can check it with a fake slide.
 *
 * A line in pptxgenjs is a box from (x, y) of size (w, h) drawn corner to
 * corner; a line that runs left or up is the same box flipped (`flipH`/`flipV`).
 *
 * A text with several items (a Venn region) arrives joined by "\n". pptxgenjs
 * splits a plain string at "\n" into one paragraph per line (its `addText`
 * documents `'line1\n line2'`), so the string goes through as it is.
 */
import type { DiagramGeometry, Paint } from './diagramGeometry.ts';

export interface PptxSlideLike {
  addShape(type: string, o: Record<string, unknown>): unknown;
  addText(text: string, o: Record<string, unknown>): unknown;
}
export interface PptxDiagramColors { card: string; tint: string; accent: string; border: string; text: string }

/** Points per text size; the slide is 10 in wide, the drawing 8.9. */
const PT = { lg: 16, md: 13, sm: 11 } as const;

export function drawPptxDiagram(
  s: PptxSlideLike,
  g: DiagramGeometry,
  c: PptxDiagramColors,
  opts: { x: number; y: number; rtl: boolean; font: string },
): void {
  const fill = (p: Paint) => (p === 'none' ? { type: 'none' } : { color: p === 'tint' ? c.tint : c.card });
  for (const sh of g.shapes) {
    if (sh.t === 'box') {
      s.addShape('roundRect', {
        x: opts.x + sh.x, y: opts.y + sh.y, w: sh.w, h: sh.h, rectRadius: 0.12,
        fill: fill(sh.fill), line: { color: sh.stroke === 'accent' ? c.accent : c.border, width: 1.75 },
      });
    } else if (sh.t === 'ellipse') {
      s.addShape('ellipse', {
        x: opts.x + sh.cx - sh.rx, y: opts.y + sh.cy - sh.ry, w: 2 * sh.rx, h: 2 * sh.ry,
        fill: fill(sh.fill), line: { color: sh.stroke === 'accent' ? c.accent : c.border, width: 2.25 },
      });
    } else {
      const x = Math.min(sh.x1, sh.x2);
      const y = Math.min(sh.y1, sh.y2);
      s.addShape('line', {
        x: opts.x + x, y: opts.y + y, w: Math.abs(sh.x2 - sh.x1), h: Math.abs(sh.y2 - sh.y1),
        flipH: sh.x2 < sh.x1, flipV: sh.y2 < sh.y1,
        line: { color: c.accent, width: 2, ...(sh.arrow ? { endArrowType: 'triangle' } : {}) },
      });
    }
  }
  for (const t of g.texts) {
    s.addText(t.text, {
      x: opts.x + t.x, y: opts.y + t.y, w: t.w, h: t.h, align: 'center', valign: 'middle',
      fontSize: PT[t.size], bold: t.bold, color: c.text, fontFace: opts.font, rtlMode: opts.rtl, fit: 'shrink',
    });
  }
}
