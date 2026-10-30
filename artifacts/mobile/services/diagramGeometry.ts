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
    case 'venn': return l.sets.length + 1;
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

export function diagramGeometry(l: DiagramLayout, width: number, height: number, rtl: boolean): DiagramGeometry {
  const W = width;
  const H = height;
  const pad = W * 0.025;
  const gap = W * 0.006;
  const shapes: DiagramShape[] = [];
  const texts: DiagramText[] = [];
  const box = (x: number, y: number, w: number, h: number, fill: Paint, stroke: Stroke, beat: number) =>
    shapes.push({ t: 'box', x, y, w, h, fill, stroke, beat });
  const text = (x: number, y: number, w: number, h: number, t: string, size: DiagramText['size'], bold: boolean, beat: number) =>
    texts.push({ x, y, w, h, text: t, size, bold, beat });

  switch (l.kind) {
    case 'cycle': {
      const n = l.stages.length;
      const bw = W * (n >= 5 ? 0.22 : 0.26);
      const bh = H * 0.2;
      const centres = ring(n, W / 2, H / 2, W / 2 - bw / 2 - pad, H / 2 - bh / 2 - pad, rtl);
      const half: Half = { hw: bw / 2, hh: bh / 2, round: false };
      centres.forEach((c, i) => {
        const s = l.stages[i]!;
        const x = c.x - bw / 2;
        const y = c.y - bh / 2;
        box(x, y, bw, bh, 'card', 'accent', i);
        if (s.note) {
          text(x + 6, y + 4, bw - 12, bh * 0.5, s.label, 'md', true, i);
          text(x + 6, y + bh * 0.5, bw - 12, bh * 0.5 - 4, s.note, 'sm', false, i);
        } else {
          text(x + 6, y + 4, bw - 12, bh - 8, s.label, 'md', true, i);
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
      const rootY = pad * 0.5;
      box((W - rootW) / 2, rootY, rootW, rootH, 'tint', 'accent', ALWAYS);
      text((W - rootW) / 2 + 6, rootY + 4, rootW - 12, rootH - 8, l.root, 'lg', true, ALWAYS);
      const bw = (W - 2 * pad - colGap * (n - 1)) / n;
      const bh = H * 0.15;
      const by = H * 0.33;
      const maxLeaves = Math.max(0, ...l.branches.map(b => b.leaves.length));
      const leafTop = by + bh + H * 0.05;
      const leafGap = H * 0.025;
      const leafH = maxLeaves ? Math.min(H * 0.12, (H - pad * 0.5 - leafTop - leafGap * (maxLeaves - 1)) / maxLeaves) : 0;
      l.branches.forEach((b, i) => {
        const col = rtl ? n - 1 - i : i;
        const x = pad + col * (bw + colGap);
        shapes.push({ t: 'line', x1: W / 2, y1: rootY + rootH, x2: x + bw / 2, y2: by, arrow: false, beat: i });
        box(x, by, bw, bh, 'card', 'accent', i);
        text(x + 6, by + 4, bw - 12, bh - 8, b.label, 'md', true, i);
        if (b.leaves.length) shapes.push({ t: 'line', x1: x + bw / 2, y1: by + bh, x2: x + bw / 2, y2: leafTop, arrow: false, beat: i });
        b.leaves.forEach((leaf, j) => {
          const ly = leafTop + j * (leafH + leafGap);
          box(x + bw * 0.08, ly, bw * 0.84, leafH, 'card', 'border', i);
          text(x + bw * 0.08 + 4, ly + 2, bw * 0.84 - 8, leafH - 4, leaf, 'sm', false, i);
        });
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }

    case 'venn': {
      const n = l.sets.length;
      const order = (i: number) => (rtl && n === 2 ? 1 - i : i);
      if (n === 2) {
        const r = Math.min(H / 2 - pad, W * 0.25);
        const cy = H / 2;
        l.sets.forEach((s, i) => {
          const side = order(i) === 0 ? -1 : 1;
          const cx = W / 2 + side * r * 0.62;
          shapes.push({ t: 'ellipse', cx, cy, rx: r, ry: r, fill: 'none', stroke: 'accent', beat: i });
          text(cx - r * 0.75, cy - r * 0.9, r * 1.5, r * 0.3, s.label, 'lg', true, i);
          const ex = cx + side * r * 0.42;
          if (s.only.length) text(ex - r * 0.4, cy - r * 0.45, r * 0.8, r * 1.0, s.only.join('\n'), 'sm', false, i);
        });
        if (l.shared.length) text(W / 2 - r * 0.3, cy - r * 0.45, r * 0.6, r * 1.0, l.shared.join('\n'), 'sm', true, n);
        return { width: W, height: H, shapes, texts, beats: n + 1 };
      }
      const r = H * 0.29;
      const cxs = [W / 2 - r * 0.6, W / 2 + r * 0.6, W / 2];
      const cys = [H / 2 - r * 0.35, H / 2 - r * 0.35, H / 2 + r * 0.62];
      l.sets.forEach((s, i) => {
        const at = rtl && i < 2 ? 1 - i : i;
        const cx = cxs[at]!;
        const cy = cys[at]!;
        shapes.push({ t: 'ellipse', cx, cy, rx: r, ry: r, fill: 'none', stroke: 'accent', beat: i });
        if (at === 2) {
          text(cx - r * 0.45, cy + r * 0.62, r * 0.9, r * 0.28, s.label, 'md', true, i);
          if (s.only.length) text(cx - r * 0.42, cy + r * 0.12, r * 0.84, r * 0.48, s.only.join('\n'), 'sm', false, i);
        } else {
          const side = at === 0 ? -1 : 1;
          text(cx + side * r * 0.5 - r * 0.45, cy - r * 0.85, r * 0.9, r * 0.28, s.label, 'md', true, i);
          if (s.only.length) text(cx + side * r * 0.45 - r * 0.4, cy - r * 0.5, r * 0.8, r * 0.6, s.only.join('\n'), 'sm', false, i);
        }
      });
      if (l.shared.length) text(W / 2 - r * 0.3, H / 2 - r * 0.15, r * 0.6, r * 0.38, l.shared.join('\n'), 'sm', true, n);
      return { width: W, height: H, shapes, texts, beats: n + 1 };
    }

    case 'mindmap': {
      const n = l.nodes.length;
      const crx = W * 0.15;
      const cry = H * 0.17;
      const centre = { x: W / 2, y: H / 2 };
      shapes.push({ t: 'ellipse', cx: centre.x, cy: centre.y, rx: crx, ry: cry, fill: 'tint', stroke: 'accent', beat: ALWAYS });
      text(centre.x - crx * 0.8, centre.y - cry * 0.7, crx * 1.6, cry * 1.4, l.center, 'lg', true, ALWAYS);
      const nw = W * 0.22;
      const nh = H * 0.17;
      const pts = ring(n, centre.x, centre.y, W / 2 - nw / 2 - pad, H / 2 - nh / 2 - pad, rtl);
      const ch: Half = { hw: crx, hh: cry, round: true };
      const nhf: Half = { hw: nw / 2, hh: nh / 2, round: false };
      pts.forEach((p, i) => {
        const node = l.nodes[i]!;
        const seg = node.role === 'cause' ? connect(p, nhf, centre, ch, gap) : connect(centre, ch, p, nhf, gap);
        shapes.push({ t: 'line', ...seg, arrow: !!node.role, beat: i });
        box(p.x - nw / 2, p.y - nh / 2, nw, nh, 'card', 'accent', i);
        text(p.x - nw / 2 + 6, p.y - nh / 2 + 4, nw - 12, nh - 8, node.text, 'md', false, i);
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }
  }
}
