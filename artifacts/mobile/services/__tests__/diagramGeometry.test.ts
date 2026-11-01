/**
 * What this guards: the one set of positions all three renderers draw. A box
 * outside the area is cut off on the projector; two boxes overlapping hide a
 * label; a beat count that disagrees with `pacedBeats` leaves a point hidden.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALWAYS, diagramBeats, diagramGeometry, isDiagram, arrowHead, DIAGRAM_W, DIAGRAM_H, DIAGRAM_FONT, type DiagramGeometry, type DiagramLayout, type DiagramShape, type DiagramText } from '../diagramGeometry.ts';

import { MAX_VENN3_ITEM_CHARS } from '../slideLayout.ts';

const stages = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `مرحلة ${i + 1}`, note: 'ملاحظة' }));
const LAYOUTS: DiagramLayout[] = [
  ...[3, 4, 5, 6].map(n => ({ kind: 'cycle' as const, stages: stages(n) })),
  ...[2, 3, 4].map(n => ({ kind: 'tree' as const, root: 'الجذر', branches: Array.from({ length: n }, (_, i) => ({ label: `فرع ${i}`, leaves: ['أ', 'ب', 'ج', 'د'] })) })),
  { kind: 'venn', sets: [{ label: 'أ', only: ['1', '2', '3', '4'] }, { label: 'ب', only: ['5'] }], shared: ['م'] },
  { kind: 'venn', sets: [{ label: 'أ', only: ['1', '2', '3'] }, { label: 'ب', only: ['4'] }, { label: 'ج', only: ['5'] }], shared: ['م', 'ن'] },
  { kind: 'venn', sets: [{ label: 'أ', only: ['1', '2'] }, { label: 'ب', only: ['3'] }], shared: [] },
  { kind: 'venn', sets: [{ label: 'أ', only: ['1'] }, { label: 'ب', only: ['2'] }, { label: 'ج', only: ['3'] }], shared: [] },
  ...[3, 4, 5, 6].map(n => ({ kind: 'mindmap' as const, center: 'الفكرة', nodes: Array.from({ length: n }, (_, i) => ({ text: `فكرة ${i}`, role: i % 2 ? 'cause' as const : 'effect' as const })) })),
];

type Rect = { x: number; y: number; w: number; h: number };
const rectOf = (s: DiagramShape): Rect | null =>
  s.t === 'box' ? { x: s.x, y: s.y, w: s.w, h: s.h }
  : s.t === 'ellipse' ? { x: s.cx - s.rx, y: s.cy - s.ry, w: 2 * s.rx, h: 2 * s.ry }
  : null;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The screen/PDF unit and PowerPoint's inches (a 16:9 slide's diagram area): the geometry must hold at both. */
const SIZES: [number, number][] = [[DIAGRAM_W, DIAGRAM_H], [8.9, 3.99]];

describe('diagramGeometry', () => {
  for (const [W, H] of SIZES) {
    for (const l of LAYOUTS) {
      const tag = `${W}x${H} ${l.kind}/${JSON.stringify(l).length}`;
      for (const rtl of [false, true]) {
        it(`${tag} rtl=${rtl}: everything inside the area`, () => {
          const g = diagramGeometry(l, W, H, rtl);
          for (const s of g.shapes) {
            const r = rectOf(s);
            if (!r) continue;
            assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W + 0.01 * W / DIAGRAM_W && r.y + r.h <= H + 0.01 * W / DIAGRAM_W, JSON.stringify(s));
          }
          for (const t of g.texts) {
            assert.ok(t.w > 0 && t.h > 0, `${t.text} has no room`);
            assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= W + 0.01 * W / DIAGRAM_W && t.y + t.h <= H + 0.01 * W / DIAGRAM_W, t.text);
          }
        });
        if (l.kind !== 'venn') {
          it(`${tag} rtl=${rtl}: no two boxes overlap`, () => {
            const g = diagramGeometry(l, W, H, rtl);
            const rects = g.shapes.map(rectOf).filter((r): r is Rect => !!r);
            for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
              assert.ok(!overlap(rects[i]!, rects[j]!), `${i} overlaps ${j}`);
            }
          });
        }
        it(`${tag} rtl=${rtl}: beats agree with diagramBeats, and every beat has something`, () => {
          const g = diagramGeometry(l, W, H, rtl);
          assert.equal(g.beats, diagramBeats(l));
          for (let b = 0; b < g.beats; b++) assert.ok(g.texts.some(t => t.beat === b) || g.shapes.some(s => s.beat === b), `beat ${b} empty`);
          for (const x of [...g.texts, ...g.shapes]) assert.ok(x.beat === ALWAYS || (x.beat >= 0 && x.beat < g.beats));
        });
      }
    }
  }

  it('a Venn with nothing shared has no beat for the overlap', () => {
    const l = LAYOUTS.find(x => x.kind === 'venn' && x.shared.length === 0 && x.sets.length === 2)!;
    assert.equal(diagramBeats(l), 2);
    assert.equal(diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, false).beats, 2);
  });

  it('mirrors in RTL: the first stage of a cycle goes the other way round', () => {
    const l = LAYOUTS[0]!;
    const ltr = diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, false);
    const rtl = diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, true);
    const second = (g: typeof ltr) => g.texts.find(t => t.text === 'مرحلة 2')!;
    assert.ok(second(ltr).x > DIAGRAM_W / 2 && second(rtl).x + second(rtl).w < DIAGRAM_W / 2);
  });

  it('puts every label of the layout on the drawing', () => {
    const g = diagramGeometry(LAYOUTS[4]!, DIAGRAM_W, DIAGRAM_H, true);
    const all = g.texts.map(t => t.text).join('\n');
    for (const w of ['الجذر', 'فرع 0', 'أ', 'د']) assert.ok(all.includes(w), w);
  });

  it('points a cause at the centre and an effect away from it', () => {
    const g = diagramGeometry({ kind: 'mindmap', center: 'c', nodes: [{ text: 'a', role: 'cause' }, { text: 'b', role: 'effect' }, { text: 'n' }] }, DIAGRAM_W, DIAGRAM_H, false);
    const lines = g.shapes.filter((s): s is Extract<DiagramShape, { t: 'line' }> => s.t === 'line');
    const dist = (x: number, y: number) => Math.hypot(x - DIAGRAM_W / 2, y - DIAGRAM_H / 2);
    const cause = lines.find(l => l.beat === 0)!;
    const effect = lines.find(l => l.beat === 1)!;
    const plain = lines.find(l => l.beat === 2)!;
    assert.ok(cause.arrow && dist(cause.x2, cause.y2) < dist(cause.x1, cause.y1));
    assert.ok(effect.arrow && dist(effect.x2, effect.y2) > dist(effect.x1, effect.y1));
    assert.equal(plain.arrow, false);
  });

  it('isDiagram knows exactly the four', () => {
    assert.equal(isDiagram(LAYOUTS[0]!), true);
    assert.equal(isDiagram({ kind: 'flow', nodes: ['a', 'b', 'c'], cycle: false }), false);
    assert.equal(isDiagram(null), false);
  });

  it('arrowHead is a triangle whose tip is the line end', () => {
    const pts = arrowHead(0, 0, 100, 0, 12);
    assert.equal(pts.length, 3);
    assert.deepEqual(pts[0], [100, 0]);
    assert.ok(pts[1]![0] < 100 && pts[2]![0] < 100);
  });
  it('mirrors in RTL: a tree puts its first branch on the right', () => {
    const l = LAYOUTS[4]!;
    const cx = (g: DiagramGeometry) => { const t = g.texts.find(x => x.text === 'فرع 0')!; return t.x + t.w / 2; };
    assert.ok(cx(diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, false)) < DIAGRAM_W / 2);
    assert.ok(cx(diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, true)) > DIAGRAM_W / 2);
  });

  it('mirrors in RTL: a Venn puts its first set on the right', () => {
    for (const l of LAYOUTS.filter(x => x.kind === 'venn' && x.shared.length > 0)) {
      const first = (g: DiagramGeometry) => g.shapes.find((s): s is Extract<DiagramShape, { t: 'ellipse' }> => s.t === 'ellipse' && s.beat === 0)!.cx;
      assert.ok(first(diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, false)) < DIAGRAM_W / 2, `${l.kind} ltr`);
      assert.ok(first(diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, true)) > DIAGRAM_W / 2, `${l.kind} rtl`);
    }
  });

  it('mirrors in RTL: a mind map runs the other way round', () => {
    const l = LAYOUTS.find(x => x.kind === 'mindmap')!;
    const second = (g: DiagramGeometry) => { const t = g.texts.find(x => x.text === 'فكرة 1')!; return t.x + t.w / 2; };
    assert.ok(second(diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, false)) > DIAGRAM_W / 2);
    assert.ok(second(diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, true)) < DIAGRAM_W / 2);
  });
});

/**
 * The longest text the gate lets through, in every shape the gate allows. The
 * geometry is a promise that the words fit: a box that is big enough for "ab"
 * and not for a real label cuts text off on the projector.
 */
const fill = (tag: string, n: number) => (tag + 'ع'.repeat(n)).slice(0, n);
const items = (tag: string, count: number, n: number) => Array.from({ length: count }, (_, i) => fill(`${tag}${i}`, n));
const WORST: DiagramLayout[] = [
  ...[3, 4, 5, 6].map(n => ({ kind: 'cycle' as const, stages: Array.from({ length: n }, (_, i) => ({ label: fill(`س${i}`, 24), note: fill(`ن${i}`, 60) })) })),
  ...[2, 3, 4].map(n => ({ kind: 'tree' as const, root: fill('جذر', 32), branches: Array.from({ length: n }, (_, i) => ({ label: fill(`ف${i}`, 24), leaves: items(`و${i}`, 4, 24) })) })),
  { kind: 'venn', sets: [{ label: fill('مجموعة١', 24), only: items('أ', 4, 32) }, { label: fill('مجموعة٢', 24), only: items('ب', 4, 32) }], shared: items('م', 4, 32) },
  { kind: 'venn', sets: [{ label: fill('مجموعة١', 24), only: items('أ', 3, MAX_VENN3_ITEM_CHARS) }, { label: fill('مجموعة٢', 24), only: items('ب', 3, MAX_VENN3_ITEM_CHARS) }, { label: fill('مجموعة٣', 24), only: items('ج', 3, MAX_VENN3_ITEM_CHARS) }], shared: items('م', 2, MAX_VENN3_ITEM_CHARS) },
  ...[3, 4, 5, 6].map(n => ({ kind: 'mindmap' as const, center: fill('مركز', 40), nodes: Array.from({ length: n }, (_, i) => ({ text: fill(`ع${i}`, 40), role: i % 3 === 0 ? undefined : i % 3 === 1 ? 'cause' as const : 'effect' as const })) })),
];

/** Lines the text needs in a box of this width: average glyph 0.55 em, wrapped on characters. */
function linesNeeded(text: string, width: number, font: number): number {
  const perLine = Math.max(1, Math.floor(width / (0.55 * font)));
  return text.split('\n').reduce((n, para) => n + Math.max(1, Math.ceil([...para].length / perLine)), 0);
}
const textRect = (t: DiagramText): Rect => ({ x: t.x, y: t.y, w: t.w, h: t.h });
const inRect = (a: Rect, b: Rect, eps: number) => a.x >= b.x - eps && a.y >= b.y - eps && a.x + a.w <= b.x + b.w + eps && a.y + a.h <= b.y + b.h + eps;
type Ell = Extract<DiagramShape, { t: 'ellipse' }>;
/** Nine-by-nine sample points over a rectangle, edges included. */
const samples = (r: Rect): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) out.push([r.x + (r.w * i) / 8, r.y + (r.h * j) / 8]);
  return out;
};
const inEll = (e: Ell, x: number, y: number) => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;

describe('diagramGeometry: the longest text the gate allows', () => {
  for (const [W, H] of SIZES) {
    const u = W / DIAGRAM_W;
    for (const l of WORST) {
      const tag = `${W}x${H} ${l.kind} ${l.kind === 'cycle' ? l.stages.length : l.kind === 'tree' ? l.branches.length : l.kind === 'mindmap' ? l.nodes.length : l.sets.length}`;
      for (const rtl of [false, true]) {
        it(`${tag} rtl=${rtl}: every text fits its box`, () => {
          const g = diagramGeometry(l, W, H, rtl);
          for (const t of g.texts) {
            const font = DIAGRAM_FONT[t.size] * u;
            const need = linesNeeded(t.text, t.w, font) * 1.25 * font;
            assert.ok(need <= t.h + 1e-6, `${t.text.slice(0, 6)}… needs ${need.toFixed(3)} in ${t.h.toFixed(3)}`);
          }
        });
        it(`${tag} rtl=${rtl}: no two text boxes overlap`, () => {
          const g = diagramGeometry(l, W, H, rtl);
          for (let i = 0; i < g.texts.length; i++) for (let j = i + 1; j < g.texts.length; j++) {
            assert.ok(!overlap(textRect(g.texts[i]!), textRect(g.texts[j]!)), `${g.texts[i]!.text.slice(0, 6)} overlaps ${g.texts[j]!.text.slice(0, 6)}`);
          }
        });
        it(`${tag} rtl=${rtl}: each text sits inside its shape`, () => {
          const g = diagramGeometry(l, W, H, rtl);
          const eps = 1e-6;
          if (l.kind !== 'venn') {
            for (const t of g.texts) {
              const ok = g.shapes.some(s => (s.t === 'box' || s.t === 'ellipse') && s.beat === t.beat && (s.t === 'box'
                ? inRect(textRect(t), rectOf(s)!, eps)
                : samples(textRect(t)).every(([x, y]) => inEll(s, x, y))));
              assert.ok(ok, `${t.text.slice(0, 6)} is not inside a shape of its beat`);
            }
            return;
          }
          // A Venn: a set's own words sit in its circle and in no other; the shared words in all of them.
          const circles = g.shapes.filter((s): s is Ell => s.t === 'ellipse');
          const labels = new Set(l.sets.map(s => s.label));
          for (const t of g.texts) {
            if (labels.has(t.text)) continue;
            const pts = samples(textRect(t));
            if (t.beat === l.sets.length) {
              for (const c of circles) assert.ok(pts.every(([x, y]) => inEll(c, x, y)), `${t.text.slice(0, 6)} (shared) leaves a circle`);
            } else {
              circles.forEach((c, i) => {
                const inside = pts.map(([x, y]) => inEll(c, x, y));
                if (i === t.beat) assert.ok(inside.every(Boolean), `${t.text.slice(0, 6)} leaves its own circle`);
                else assert.ok(!inside.some(Boolean), `${t.text.slice(0, 6)} spills into circle ${i}`);
              });
            }
          }
        });
      }
    }
  }
});
