/**
 * What this guards: the one set of positions all three renderers draw. A box
 * outside the area is cut off on the projector; two boxes overlapping hide a
 * label; a beat count that disagrees with `pacedBeats` leaves a point hidden.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALWAYS, diagramBeats, diagramGeometry, isDiagram, arrowHead, DIAGRAM_W, DIAGRAM_H, type DiagramLayout, type DiagramShape } from '../diagramGeometry.ts';

const stages = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `مرحلة ${i + 1}`, note: 'ملاحظة' }));
const LAYOUTS: DiagramLayout[] = [
  ...[3, 4, 5, 6].map(n => ({ kind: 'cycle' as const, stages: stages(n) })),
  ...[2, 3, 4].map(n => ({ kind: 'tree' as const, root: 'الجذر', branches: Array.from({ length: n }, (_, i) => ({ label: `فرع ${i}`, leaves: ['أ', 'ب', 'ج', 'د'] })) })),
  { kind: 'venn', sets: [{ label: 'أ', only: ['1', '2', '3', '4'] }, { label: 'ب', only: ['5'] }], shared: ['م'] },
  { kind: 'venn', sets: [{ label: 'أ', only: ['1', '2', '3'] }, { label: 'ب', only: ['4'] }, { label: 'ج', only: ['5'] }], shared: ['م', 'ن'] },
  ...[3, 4, 5, 6].map(n => ({ kind: 'mindmap' as const, center: 'الفكرة', nodes: Array.from({ length: n }, (_, i) => ({ text: `فكرة ${i}`, role: i % 2 ? 'cause' as const : 'effect' as const })) })),
];

type Rect = { x: number; y: number; w: number; h: number };
const rectOf = (s: DiagramShape): Rect | null =>
  s.t === 'box' ? { x: s.x, y: s.y, w: s.w, h: s.h }
  : s.t === 'ellipse' ? { x: s.cx - s.rx, y: s.cy - s.ry, w: 2 * s.rx, h: 2 * s.ry }
  : null;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('diagramGeometry', () => {
  for (const l of LAYOUTS) {
    const tag = `${l.kind}/${JSON.stringify(l).length}`;
    for (const rtl of [false, true]) {
      const g = diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, rtl);
      it(`${tag} rtl=${rtl}: everything inside the area`, () => {
        for (const s of g.shapes) {
          const r = rectOf(s);
          if (!r) continue;
          assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= DIAGRAM_W + 0.01 && r.y + r.h <= DIAGRAM_H + 0.01, JSON.stringify(s));
        }
        for (const t of g.texts) assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= DIAGRAM_W + 0.01 && t.y + t.h <= DIAGRAM_H + 0.01, t.text);
      });
      if (l.kind !== 'venn') {
        it(`${tag} rtl=${rtl}: no two boxes overlap`, () => {
          const rects = g.shapes.map(rectOf).filter((r): r is Rect => !!r);
          for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
            assert.ok(!overlap(rects[i]!, rects[j]!), `${i} overlaps ${j}`);
          }
        });
      }
      it(`${tag} rtl=${rtl}: beats agree with diagramBeats, and every beat has something`, () => {
        assert.equal(g.beats, diagramBeats(l));
        for (let b = 0; b < g.beats; b++) assert.ok(g.texts.some(t => t.beat === b) || g.shapes.some(s => s.beat === b), `beat ${b} empty`);
        for (const x of [...g.texts, ...g.shapes]) assert.ok(x.beat === ALWAYS || (x.beat >= 0 && x.beat < g.beats));
      });
    }
  }

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
});
