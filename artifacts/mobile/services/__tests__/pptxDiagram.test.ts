/**
 * What this guards: the PowerPoint drawing is native shapes and text boxes (so
 * a teacher can edit a label), placed where the shared geometry says, inside
 * the 10 × 5.63 in slide.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drawPptxDiagram } from '../pptxDiagram.ts';
import { diagramGeometry, type DiagramLayout } from '../diagramGeometry.ts';

function fakeSlide() {
  const calls: { kind: 'shape' | 'text'; type?: string; text?: string; o: Record<string, unknown> }[] = [];
  return {
    calls,
    addShape(type: string, o: Record<string, unknown>) { calls.push({ kind: 'shape', type, o }); },
    addText(text: string, o: Record<string, unknown>) { calls.push({ kind: 'text', text, o }); },
  };
}
const C = { card: 'FFFFFF', tint: 'E0F0F0', accent: '1E8E8E', border: 'EFDCD4', text: '22303C' };
const OPTS = { x: 0.55, y: 1.35, rtl: true, font: 'Readex Pro' };

function draw(l: DiagramLayout, rtl = true) {
  const s = fakeSlide();
  drawPptxDiagram(s, diagramGeometry(l, 8.9, 3.99, rtl), C, { ...OPTS, rtl });
  return s;
}

describe('drawPptxDiagram', () => {
  const s = draw({ kind: 'mindmap', center: 'التلوث', nodes: [{ text: 'المصانع', role: 'cause' }, { text: 'أمراض', role: 'effect' }, { text: 'حلول' }] });
  it('draws native shapes: one ellipse, three boxes, three lines', () => {
    const types = s.calls.filter(c => c.kind === 'shape').map(c => c.type);
    assert.equal(types.filter(t => t === 'ellipse').length, 1);
    assert.equal(types.filter(t => t === 'roundRect').length, 3);
    assert.equal(types.filter(t => t === 'line').length, 3);
  });
  it('puts an arrowhead only on the cause and the effect', () => {
    const lines = s.calls.filter(c => c.type === 'line');
    assert.equal(lines.filter(l => (l.o.line as { endArrowType?: string }).endArrowType === 'triangle').length, 2);
  });
  it('labels are editable text boxes, right-aligned reading order in Arabic, inside the slide', () => {
    const texts = s.calls.filter(c => c.kind === 'text');
    assert.deepEqual(texts.map(t => t.text).sort(), ['أمراض', 'التلوث', 'المصانع', 'حلول'].sort());
    for (const t of texts) {
      const { x, y, w, h, rtlMode } = t.o as { x: number; y: number; w: number; h: number; rtlMode: boolean };
      assert.equal(rtlMode, true);
      assert.ok(x >= 0 && y >= 0 && x + w <= 10 && y + h <= 5.63);
    }
  });
  it('draws a line with a negative extent as a flipped box, as pptxgenjs needs', () => {
    for (const l of s.calls.filter(c => c.type === 'line')) {
      const o = l.o as { w: number; h: number };
      assert.ok(o.w >= 0 && o.h >= 0);
    }
  });
});

describe('drawPptxDiagram: several items in one text box', () => {
  // pptxgenjs splits a plain string at "\n" into one paragraph per line (its
  // addText says so); the box therefore carries the items as separate lines.
  const venn = draw({
    kind: 'venn',
    sets: [{ label: 'الخلية النباتية', only: ['جدار خلوي', 'بلاستيدات'] }, { label: 'الخلية الحيوانية', only: ['سنتريولات'] }],
    shared: ['غشاء خلوي', 'نواة'],
  });
  it('sends each item as its own line, with no stray empty line', () => {
    const lines = venn.calls.filter(c => c.kind === 'text').map(c => c.text!.split('\n'));
    assert.deepEqual(lines.find(l => l.includes('جدار خلوي')), ['جدار خلوي', 'بلاستيدات']);
    assert.deepEqual(lines.find(l => l.includes('غشاء خلوي')), ['غشاء خلوي', 'نواة']);
    for (const t of venn.calls.filter(c => c.kind === 'text')) {
      assert.ok(!t.text!.startsWith('\n') && !t.text!.endsWith('\n') && !t.text!.includes('\n\n'));
    }
  });
  it('draws only the outlines of the sets (no fill) and keeps every box in the slide', () => {
    const ells = venn.calls.filter(c => c.type === 'ellipse');
    assert.equal(ells.length, 2);
    // No `fill` key: pptxgenjs then writes an explicit <a:noFill/> (a { type: 'none' } writes nothing).
    for (const e of ells) assert.equal('fill' in e.o, false);
    for (const t of venn.calls.filter(c => c.kind === 'text')) {
      const { x, y, w, h } = t.o as { x: number; y: number; w: number; h: number };
      assert.ok(x >= 0 && y >= 0 && x + w <= 10 && y + h <= 5.63);
    }
  });
});

describe('drawPptxDiagram: text insets', () => {
  // The geometry sizes every text box with its own insets. pptxgenjs writes no
  // bodyPr insets unless asked, and PowerPoint then adds 0.1 in either side and
  // 0.05 in top and bottom on top of them, so a full-width label would overflow.
  it('every text box has margin 0, so only the geometry insets apply', () => {
    const calls = [
      ...draw({ kind: 'venn', sets: [{ label: 'أ', only: ['ب'] }, { label: 'ج', only: ['د'] }, { label: 'هـ', only: ['و'] }], shared: ['ز'] }).calls,
      ...draw({ kind: 'cycle', stages: [{ label: 'تبخر', note: 'يصعد' }, { label: 'تكاثف' }, { label: 'هطول' }] }).calls,
      ...draw({ kind: 'tree', root: 'المادة', branches: [{ label: 'نقية', leaves: ['عنصر'] }, { label: 'مخلوط', leaves: [] }] }).calls,
    ].filter(c => c.kind === 'text');
    assert.ok(calls.length >= 10);
    for (const t of calls) assert.equal(t.o.margin, 0);
  });
});

describe('drawPptxDiagram: cycle and tree', () => {
  it('a cycle draws a box and an arrow per stage, the note under its label', () => {
    const c = draw({ kind: 'cycle', stages: [{ label: 'تبخر', note: 'الماء يصعد' }, { label: 'تكاثف' }, { label: 'هطول' }] }, false);
    assert.equal(c.calls.filter(x => x.type === 'roundRect').length, 3);
    const arrows = c.calls.filter(x => x.type === 'line');
    assert.equal(arrows.length, 3);
    for (const a of arrows) assert.equal((a.o.line as { endArrowType?: string }).endArrowType, 'triangle');
    assert.deepEqual(c.calls.filter(x => x.kind === 'text').map(x => x.text), ['تبخر', 'الماء يصعد', 'تكاثف', 'هطول']);
  });
  it('a tree draws plain connectors, and a left-running line is a flipped box', () => {
    const t = draw({ kind: 'tree', root: 'المادة', branches: [{ label: 'نقية', leaves: ['عنصر'] }, { label: 'مخلوط', leaves: [] }] });
    const lines = t.calls.filter(x => x.type === 'line');
    assert.ok(lines.length >= 3);
    for (const l of lines) assert.equal((l.o.line as { endArrowType?: string }).endArrowType, undefined);
    assert.ok(lines.some(l => (l.o as { flipH?: boolean }).flipH === true));
    for (const l of lines) {
      const { x, y, w, h } = l.o as { x: number; y: number; w: number; h: number };
      assert.ok(x >= 0 && y >= 0 && x + w <= 10 && y + h <= 5.63);
    }
  });
});
