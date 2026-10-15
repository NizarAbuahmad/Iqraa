import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickForFormat, formatSupported } from '../formatsBank.ts';
import { stepsFor } from '../steps.ts';
import { beginMathPracticeSession, currentSession, takeSolvedMath } from '../index.ts';

const EXP = 'المعادلات الأسية';          // a Grade-10 lesson whose family (exp_eq) has many solved items
const GRAPH = 'حل نظام معادلتين بيانيا'; // routes to system_graph (the tanwin form «بيانيًا» does not match the keyword)

describe('pickForFormat', () => {
  it('match: 4–5 distinct short answers, none reused', () => {
    const used = new Set<string>();
    const p = pickForFormat('match', EXP, null, 'ar', used) as any;
    assert.ok(p && p.pairs.length >= 4 && p.pairs.length <= 5);
    assert.equal(new Set(p.pairs.map((x: any) => x.answer)).size, p.pairs.length);
    assert.equal(used.size, p.pairs.length);
  });

  it('order: the steps are an item\'s real working, 3–6 lines', () => {
    const p = pickForFormat('order', EXP, null, 'ar', new Set()) as any;
    assert.ok(p && p.steps.length >= 3 && p.steps.length <= 6);
  });

  it('spot_error: exactly one step differs from the real working, and never the last', () => {
    const used = new Set<string>();
    const p = pickForFormat('spot_error', EXP, null, 'ar', used) as any;
    assert.ok(p);
    const real = stepsFor([...used][0]!)!.ar;
    const diffs = p.steps.map((s: string, i: number) => s !== real[i]).filter(Boolean).length;
    assert.equal(diffs, 1);
    assert.equal(p.steps[p.wrongStep] === real[p.wrongStep], false);
    assert.equal(p.correctLine, real[p.wrongStep]);
    assert.ok(p.wrongStep < p.steps.length - 1);
  });

  it('graph: equations and a window containing the answer points', () => {
    const p = pickForFormat('graph', GRAPH, null, 'ar', new Set()) as any;
    assert.ok(p && p.exprs.length >= 1 && !p.exprs[0].startsWith('y'));
    assert.ok(p.window.xMin < p.window.xMax && p.window.yMin < p.window.yMax);
  });

  it('returns null, and formatSupported says false, when the lesson cannot support it', () => {
    assert.equal(formatSupported('graph', EXP, null), false);
    assert.equal(pickForFormat('graph', EXP, null, 'ar', new Set()), null);
    assert.equal(formatSupported('spot_error', 'الروابط الكيميائية', null, 'Chemistry'), false);
  });

  it('formatSupported consumes nothing: availability is unchanged after a real pick', () => {
    assert.equal(formatSupported('match', EXP, null), true);
    assert.ok(pickForFormat('match', EXP, null, 'ar', new Set()));
    assert.equal(formatSupported('match', EXP, null), true);
  });
});

describe('currentSession', () => {
  it('is the module-level set that takeSolvedMath spends from, and beginMathPracticeSession clears it', () => {
    beginMathPracticeSession();
    assert.equal(currentSession().size, 0);
    const item = takeSolvedMath(EXP, null, 'easy', 'ar');
    assert.ok(item);
    assert.ok(currentSession().size >= 1);
    beginMathPracticeSession();
    assert.equal(currentSession().size, 0);
  });
});
