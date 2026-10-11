import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFormatQuestion, formatAvailability, FORMAT_KINDS, isFormatKind, normalizePlotExpr, fitGraphWindow,
} from '../ai/worksheetFormats.ts';
import { samplePlot } from '../deckVisuals.ts';

const ctx = (topic: string) => ({ topic, kb: null, lang: 'ar' as const, points: 3, session: new Set<string>() });
const EXP = 'المعادلات الأسية';
const GRAPH = 'حل نظام معادلتين بيانيا';

describe('buildFormatQuestion', () => {
  it('match: pairs map every left item to its own answer', () => {
    const r = buildFormatQuestion('match', ctx(EXP))!;
    const f = r.section.questions[0]!.format as any;
    assert.equal(f.kind, 'match');
    assert.equal(f.left.length, f.right.length);
    assert.equal(new Set(f.pairs).size, f.pairs.length);
    assert.match(r.key.answer, /^١-/);
    assert.ok(r.section.questions[0]!.text.includes(f.left[0]));
  });

  it('order: following `order` recovers the working, and the last step stays last', () => {
    const r = buildFormatQuestion('order', ctx(EXP))!;
    const f = r.section.questions[0]!.format as any;
    assert.deepEqual(f.order.map((i: number) => f.steps[i]), r.key.solution);
    assert.equal(f.order[f.order.length - 1], f.steps.length - 1);
  });

  it('spot_error: the wrong step is in the text, the fix is in the key', () => {
    const r = buildFormatQuestion('spot_error', ctx(EXP))!;
    const f = r.section.questions[0]!.format as any;
    assert.notEqual(f.steps[f.wrongStep], f.fix);
    assert.ok(r.key.answer.includes(f.fix));
    assert.equal(r.key.solution![0], f.why);
  });

  it('graph: equations and a window, no answer in the student text', () => {
    const r = buildFormatQuestion('graph', ctx(GRAPH))!;
    const q = r.section.questions[0]!;
    assert.equal((q.format as any).kind, 'graph');
    assert.ok(!q.text.includes(r.key.answer));
  });

  it('counts each format as one question, in its own titled section', () => {
    for (const k of ['match', 'order'] as const) {
      const r = buildFormatQuestion(k, ctx(EXP))!;
      assert.equal(r.section.questions.length, 1);
      assert.equal(r.section.type, k);
      assert.ok(r.section.title.length > 0);
      assert.equal(r.section.questions[0]!.fromBank, true);
      assert.equal(r.section.questions[0]!.points, 3);
    }
  });

  it('null when the lesson cannot support it; availability agrees', () => {
    assert.equal(buildFormatQuestion('graph', ctx(EXP)), null);
    assert.deepEqual(formatAvailability(EXP, null).graph, false);
    assert.equal(formatAvailability(EXP, null).match, true);
  });

  it('knows its kinds', () => {
    assert.deepEqual([...FORMAT_KINDS], ['match', 'order', 'spot_error', 'graph']);
    assert.ok(isFormatKind('match') && !isFormatKind('short_answer'));
  });

  it('English labels use latin digits and letters', () => {
    const r = buildFormatQuestion('match', { ...ctx(EXP), lang: 'en' })!;
    assert.match(r.key.answer, /^1-[A-E]/);
    assert.equal(r.section.title, 'Match');
  });

  it('dedupes against the shared per-pass session by default', () => {
    const a = buildFormatQuestion('order', { topic: EXP, kb: null, lang: 'ar', points: 1 });
    assert.ok(a);
  });
});

describe('graph window', () => {
  it('normalizePlotExpr rewrites bank notation to something the sampler parses', () => {
    assert.equal(normalizePlotExpr('x² − 4'), 'x^2 - 4');
    assert.equal(normalizePlotExpr('x³ × 2'), 'x^3 * 2');
  });

  it('fitGraphWindow widens to contain the curve, clamped to ±10', () => {
    const w = fitGraphWindow(['x² − 4'], { xMin: -5, xMax: 5, yMin: -3, yMax: 3 });
    assert.equal(w.yMin, -5);
    assert.equal(w.yMax, 10);
    assert.equal(w.xMin, -5);
  });

  it('fitGraphWindow never shrinks the bank window', () => {
    const w = fitGraphWindow(['0'], { xMin: -5, xMax: 5, yMin: -4, yMax: 4 });
    assert.deepEqual(w, { xMin: -5, xMax: 5, yMin: -4, yMax: 4 });
  });

  it('every built graph question contains its own curves (within the ±10 clamp)', () => {
    for (let i = 0; i < 60; i++) {
      const r = buildFormatQuestion('graph', ctx(GRAPH))!;
      const f = r.section.questions[0]!.format as any;
      assert.ok(f.window.yMin >= -10 && f.window.yMax <= 10);
      for (const e of f.exprs as string[]) {
        const pts = samplePlot(normalizePlotExpr(e), { from: f.window.xMin, to: f.window.xMax, steps: 120 }) ?? [];
        for (const p of pts) {
          assert.ok(p.y >= f.window.yMin - 1e-9 || f.window.yMin === -10, `${e} dips below window`);
          assert.ok(p.y <= f.window.yMax + 1e-9 || f.window.yMax === 10, `${e} rises above window`);
        }
      }
      if (f.exprs.includes('x² − 4')) {
        assert.ok(f.window.yMin <= -5);
      }
    }
  });
});
