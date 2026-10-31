/**
 * Where every part of a drawn diagram goes — computed once, drawn three times.
 *
 * The presenter, the PDF and PowerPoint each draw a `DiagramGeometry`: boxes,
 * ellipses and straight connectors, plus text boxes the renderer fills with real
 * text (never rasterised, so Arabic shapes and bidi isolation still apply). One
 * set of positions is why a cycle looks the same projected, printed and in
 * PowerPoint. Units are whatever the caller passes (`DIAGRAM_W` × `DIAGRAM_H`
 * for the screen and the PDF, inches for PowerPoint); the shapes scale with them.
 *
 * `beat` says when a part appears under «نقطة بنقطة»: `ALWAYS` (-1) is drawn
 * from the start (a tree's root, a mind map's centre), 0.. are revealed in
 * order. `diagramBeats` is the count, and `pacedBeats` uses it.
 *
 * Pure and react-free so `node --test` can load it.
 */
import type { ResolvedLayout } from './slideLayout.ts';

export type DiagramLayout = Extract<ResolvedLayout, { kind: 'cycle' | 'tree' | 'venn' | 'mindmap' }>;
export type Paint = 'card' | 'tint' | 'none';
export type Stroke = 'accent' | 'border';
export type DiagramShape =
  | { t: 'box'; x: number; y: number; w: number; h: number; fill: Paint; stroke: Stroke; beat: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: Paint; stroke: Stroke; beat: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; arrow: boolean; beat: number };
export interface DiagramText { x: number; y: number; w: number; h: number; text: string; size: 'lg' | 'md' | 'sm'; bold: boolean; beat: number }
export interface DiagramGeometry { width: number; height: number; shapes: DiagramShape[]; texts: DiagramText[]; beats: number }

export const ALWAYS = -1;
export const DIAGRAM_W = 960;
export const DIAGRAM_H = 430;
/** Font size per text size, in the same units as `DIAGRAM_W`. */
export const DIAGRAM_FONT = { lg: 26, md: 21, sm: 17 } as const;

export function isDiagram(l: ResolvedLayout | null): l is DiagramLayout {
  return !!l && (l.kind === 'cycle' || l.kind === 'tree' || l.kind === 'venn' || l.kind === 'mindmap');
}

export function diagramBeats(l: DiagramLayout): number {
  switch (l.kind) {
    case 'cycle': return l.stages.length;
    case 'tree': return l.branches.length;
    // One beat per set, plus one for the overlap — only when there is an overlap to show.
    case 'venn': return l.sets.length + (l.shared.length ? 1 : 0);
    case 'mindmap': return l.nodes.length;
  }
}

type Pt = { x: number; y: number };
type Half = { hw: number; hh: number; round: boolean };

/** The connector between two shapes, cut back to their outlines plus a small gap. */
function connect(a: Pt, ah: Half, b: Pt, bh: Half, gap: number): { x1: number; y1: number; x2: number; y2: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const exit = (h: Half) => (h.round
    ? 1 / Math.hypot(dx / h.hw, dy / h.hh)
    : Math.min(dx ? h.hw / Math.abs(dx) : Infinity, dy ? h.hh / Math.abs(dy) : Infinity));
  const s1 = exit(ah) + gap / len;
  const s2 = exit(bh) + gap / len;
  return { x1: a.x + dx * s1, y1: a.y + dy * s1, x2: b.x - dx * s2, y2: b.y - dy * s2 };
}

export function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): [number, number][] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const wing = (s: number): [number, number] => [x2 - size * Math.cos(a + s), y2 - size * Math.sin(a + s)];
  return [[x2, y2], wing(0.45), wing(-0.45)];
}

/** Positions on an ellipse starting at 12 o'clock, clockwise LTR, counter-clockwise RTL. */
function ring(n: number, cx: number, cy: number, rx: number, ry: number, rtl: boolean): Pt[] {
  const dir = rtl ? -1 : 1;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (dir * 2 * Math.PI * i) / n;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/**
 * Every fixed size below is a fraction of the area, or of `u` — the area's width
 * over `DIAGRAM_W` — so the same drawing comes out at 960 × 430 on the screen and
 * at 8.9 × 3.99 inches in PowerPoint. The text boxes are sized for the longest
 * text the gate lets through (`diagramGeometry.test.ts` wraps it at 0.55 em a
 * glyph and checks it fits), so a short label simply leaves some air.
 */
export function diagramGeometry(l: DiagramLayout, width: number, height: number, rtl: boolean): DiagramGeometry {
  const W = width;
  const H = height;
  const u = W / DIAGRAM_W;
  const pad = W * 0.025;
  const vpad = H * 0.012;
  const gap = W * 0.006;
  const sx = 6 * u; // text inset, sides
  const sy = 2 * u; // text inset, top and bottom
  const shapes: DiagramShape[] = [];
  const texts: DiagramText[] = [];
  const box = (x: number, y: number, w: number, h: number, fill: Paint, stroke: Stroke, beat: number) =>
    shapes.push({ t: 'box', x, y, w, h, fill, stroke, beat });
  const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: Paint, beat: number) =>
    shapes.push({ t: 'ellipse', cx, cy, rx, ry, fill, stroke: 'accent', beat });
  const text = (x: number, y: number, w: number, h: number, t: string, size: DiagramText['size'], bold: boolean, beat: number) =>
    texts.push({ x, y, w, h, text: t, size, bold, beat });

  switch (l.kind) {
    case 'cycle': {
      const n = l.stages.length;
      const bw = W * (n === 3 ? 0.3 : n === 4 ? 0.27 : 0.26);
      // Tall enough for a two-line label over a three-line note.
      const bh = H * 0.285;
      const centres = ring(n, W / 2, H / 2, W / 2 - bw / 2 - pad, H / 2 - bh / 2 - vpad, rtl);
      const half: Half = { hw: bw / 2, hh: bh / 2, round: false };
      const labelH = 54 * u;
      centres.forEach((c, i) => {
        const s = l.stages[i]!;
        const x = c.x - bw / 2;
        const y = c.y - bh / 2;
        box(x, y, bw, bh, 'card', 'accent', i);
        if (s.note) {
          text(x + sx, y + sy, bw - 2 * sx, labelH, s.label, 'md', true, i);
          text(x + sx, y + sy + labelH, bw - 2 * sx, bh - 2 * sy - labelH, s.note, 'sm', false, i);
        } else {
          text(x + sx, y + sy, bw - 2 * sx, bh - 2 * sy, s.label, 'md', true, i);
        }
        const next = centres[(i + 1) % n]!;
        shapes.push({ t: 'line', ...connect(c, half, next, half, gap), arrow: true, beat: i === n - 1 ? n - 1 : i + 1 });
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }

    case 'tree': {
      const n = l.branches.length;
      const colGap = W * 0.02;
      const rootW = W * 0.34;
      const rootH = H * 0.17;
      const rootY = H * 0.01;
      box((W - rootW) / 2, rootY, rootW, rootH, 'tint', 'accent', ALWAYS);
      text((W - rootW) / 2 + sx, rootY + sy, rootW - 2 * sx, rootH - 2 * sy, l.root, 'lg', true, ALWAYS);
      const bw = (W - 2 * pad - colGap * (n - 1)) / n;
      const bh = H * 0.14;
      const by = H * 0.27;
      const maxLeaves = Math.max(0, ...l.branches.map(b => b.leaves.length));
      const leafTop = by + bh + H * 0.04;
      const leafGap = H * 0.02;
      const leafH = maxLeaves ? Math.min(H * 0.125, (H - vpad - leafTop - leafGap * (maxLeaves - 1)) / maxLeaves) : 0;
      l.branches.forEach((b, i) => {
        const col = rtl ? n - 1 - i : i;
        const x = pad + col * (bw + colGap);
        shapes.push({ t: 'line', x1: W / 2, y1: rootY + rootH, x2: x + bw / 2, y2: by, arrow: false, beat: i });
        box(x, by, bw, bh, 'card', 'accent', i);
        text(x + sx, by + sy, bw - 2 * sx, bh - 2 * sy, b.label, 'md', true, i);
        if (b.leaves.length) shapes.push({ t: 'line', x1: x + bw / 2, y1: by + bh, x2: x + bw / 2, y2: leafTop, arrow: false, beat: i });
        b.leaves.forEach((leaf, j) => {
          const ly = leafTop + j * (leafH + leafGap);
          box(x + bw * 0.06, ly, bw * 0.88, leafH, 'card', 'border', i);
          text(x + bw * 0.06 + 4 * u, ly + sy, bw * 0.88 - 8 * u, leafH - 2 * sy, leaf, 'sm', false, i);
        });
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }

    case 'venn': {
      const n = l.sets.length;
      const beats = n + (l.shared.length ? 1 : 0);
      if (n === 2) {
        // Two wide ellipses, labels in a strip above them, the words in the three regions.
        const rx = W * 0.3125;
        const d = W * 0.1625;
        const cy = H * 0.55;
        const ry = H * 0.435;
        const labelW = W * 0.31;
        const bodyY = cy - H * 0.2;
        const bodyH = H * 0.4;
        l.sets.forEach((s, i) => {
          const side = (rtl ? 1 - i : i) === 0 ? -1 : 1;
          const cx = W / 2 + side * d;
          ellipse(cx, cy, rx, ry, 'none', i);
          const crescent = W / 2 + side * rx; // the middle of this set's own crescent
          text(crescent - labelW / 2, H * 0.01, labelW, H * 0.09, s.label, 'md', true, i);
          if (s.only.length) {
            const bx = side < 0 ? W * 0.0646 : W - W * 0.0646 - W * 0.279;
            text(bx, bodyY, W * 0.279, bodyH, s.only.join('\n'), 'sm', false, i);
          }
        });
        if (l.shared.length) text(W * 0.389, bodyY, W * 0.223, bodyH, l.shared.join('\n'), 'sm', true, n);
        return { width: W, height: H, shapes, texts, beats };
      }
      // Three wide ellipses, set 0 and 1 on top and set 2 below. Everything is placed in
      // 960 × 430 units and scaled by `u`: the three "only" regions and the triple overlap
      // are small, and each box below is the largest that fits wholly inside one region
      // (found by search, and held there by the fit test in diagramGeometry.test.ts).
      const rx = 310 * u;
      const ry = 135 * u;
      const cxs = [W / 2 - 150 * u, W / 2 + 150 * u, W / 2];
      const cys = [139 * u, 139 * u, 289 * u];
      l.sets.forEach((s, i) => {
        const at = rtl && i < 2 ? 1 - i : i;
        ellipse(cxs[at]!, cys[at]!, rx, ry, 'none', i);
        if (at === 2) {
          // The lower set has the widest room: a one-line label, then its words.
          const x = W / 2 - 141 * u;
          const ly = 294 * u;
          const lh = 28 * u;
          text(x, ly, 282 * u, lh, s.label, 'md', true, i);
          if (s.only.length) text(x, ly + lh, 282 * u, 64 * u, s.only.join('\n'), 'sm', false, i);
        } else {
          // The two upper sets: a two-line label, then its words, in the outer part of the ellipse.
          const x = at === 0 ? 106 * u : W - 106 * u - 192 * u;
          const ly = 54 * u;
          const lh = 54 * u;
          text(x, ly, 192 * u, lh, s.label, 'md', true, i);
          if (s.only.length) text(x, ly + lh, 192 * u, 64 * u, s.only.join('\n'), 'sm', false, i);
        }
      });
      if (l.shared.length) text(W / 2 - 96 * u, 168 * u, 192 * u, 44 * u, l.shared.join('\n'), 'sm', true, n);
      return { width: W, height: H, shapes, texts, beats };
    }

    case 'mindmap': {
      const n = l.nodes.length;
      const crx = W * 0.19;
      const cry = H * 0.18;
      const centre = { x: W / 2, y: H / 2 };
      ellipse(centre.x, centre.y, crx, cry, 'tint', ALWAYS);
      // The largest box a 40-character centre needs (three lines) that still sits inside the ellipse.
      const tw = crx * 1.5;
      const th = H * 0.228;
      text(centre.x - tw / 2, centre.y - th / 2, tw, th, l.center, 'lg', true, ALWAYS);
      const nw = W * 0.22;
      const nh = H * 0.195;
      const pts = ring(n, centre.x, centre.y, W / 2 - nw / 2 - pad, H / 2 - nh / 2 - vpad, rtl);
      const ch: Half = { hw: crx, hh: cry, round: true };
      const nhf: Half = { hw: nw / 2, hh: nh / 2, round: false };
      pts.forEach((p, i) => {
        const node = l.nodes[i]!;
        const seg = node.role === 'cause' ? connect(p, nhf, centre, ch, gap) : connect(centre, ch, p, nhf, gap);
        shapes.push({ t: 'line', ...seg, arrow: !!node.role, beat: i });
        box(p.x - nw / 2, p.y - nh / 2, nw, nh, 'card', 'accent', i);
        text(p.x - nw / 2 + sx, p.y - nh / 2 + sy, nw - 2 * sx, nh - 2 * sy, node.text, 'md', false, i);
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }
  }
}
