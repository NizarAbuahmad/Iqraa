/**
 * Handing a worksheet a solved item to study, and a second to finish.
 *
 * `takeSolvedMath` / `takeSolvedChem` pick from the same bank, the same family
 * routing and the same per-pass `session` set the practice questions use, so a
 * paper never studies an item and then asks it again two sections later. They
 * return only items a person wrote and checked working for — never a derived
 * or invented solution — and null when the lesson has none left.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { takeConcreteChem, takeSolvedChem, takeSolvedMath } from '../index.ts';
import { completionSplit, solvedItemIds, stepsFor } from '../steps.ts';

const MOLE = 'المول والكتلة المولية';

describe('takeSolvedChem', () => {
  it('returns a problem, its working and its answer', () => {
    const s = takeSolvedChem(MOLE, null, 'easy', 'ar', new Set())!;
    assert.ok(s, 'the mole family has solved items');
    assert.ok(s.problem.trim().length > 0);
    assert.ok(s.steps.length >= 2);
    assert.ok(s.answer.trim().length > 0);
    assert.ok(solvedItemIds().includes(s.id));
  });

  it('prefers the tier asked for', () => {
    assert.equal(takeSolvedChem(MOLE, null, 'easy', 'ar', new Set())!.diff, 'easy');
    assert.equal(takeSolvedChem(MOLE, null, 'hard', 'ar', new Set())!.diff, 'hard');
  });

  it('gives the English working, the same length, with no Arabic letters in it', () => {
    const en = takeSolvedChem(MOLE, null, 'easy', 'en', new Set())!;
    assert.equal(en.steps.length, stepsFor(en.id)!.ar.length);
    assert.ok(en.steps.every(l => !/[ء-ي]/.test(l)), 'English working has Arabic letters');
  });

  it('never returns an item twice within one pass, and runs out honestly', () => {
    const session = new Set<string>();
    const seen = new Set<string>();
    let taken = 0;
    for (let i = 0; i < 40; i++) {
      const s = takeSolvedChem(MOLE, null, 'medium', 'ar', session);
      if (!s) break;
      assert.ok(!seen.has(s.id), `${s.id} served twice`);
      seen.add(s.id);
      taken += 1;
    }
    assert.equal(taken, 7, 'the mole family holds seven solved items');
    assert.equal(takeSolvedChem(MOLE, null, 'medium', 'ar', session), null);
  });

  it('spends the item so a practice question cannot repeat it', () => {
    const session = new Set<string>();
    const solved = takeSolvedChem(MOLE, null, 'easy', 'ar', session)!;
    for (let i = 0; i < 12; i++) {
      const q = takeConcreteChem('short_answer', MOLE, null, 'easy', 'ar', 4, session, false);
      if (!q) break;
      assert.notEqual(q.text, solved.problem, 'the studied item came back as a practice question');
    }
  });
});

describe('takeConcreteChem carries the working alongside the answer', () => {
  it('attaches steps to a practice question whose item has them', () => {
    const q = takeConcreteChem('short_answer', MOLE, null, 'easy', 'ar', 4, new Set())!;
    assert.ok(Array.isArray(q.steps) && q.steps.length >= 2);
  });

  it('attaches steps whatever the question type', () => {
    for (const type of ['multiple_choice', 'true_false', 'fill_blank', 'word_problem'] as const) {
      const q = takeConcreteChem(type, MOLE, null, 'easy', 'ar', 4, new Set())!;
      assert.ok(q.steps && q.steps.length >= 2, type);
    }
  });
});

describe('takeSolvedMath', () => {
  it('serves an exponential-equations lesson', () => {
    const s = takeSolvedMath('المعادلات الأسية', null, 'easy', 'ar', new Set())!;
    assert.ok(s && s.steps.length >= 2 && s.problem.length > 0);
  });

  it('serves nothing for a topic the maths bank has no family for', () => {
    assert.equal(takeSolvedMath('الخلية ووظائفها', null, 'easy', 'ar', new Set()), null);
  });
});

describe('completionSplit', () => {
  const cases: Array<[number, number]> = [[2, 1], [3, 1], [4, 2], [5, 2], [6, 3]];
  for (const [n, given] of cases) {
    it(`${n} steps: ${given} given, ${n - given} for the student`, () => {
      const lines = Array.from({ length: n }, (_, i) => `s${i}`);
      const split = completionSplit(lines);
      assert.deepEqual(split.given, lines.slice(0, given));
      assert.equal(split.remaining, n - given);
    });
  }

  it('always leaves the last line, the result, for the student', () => {
    for (let n = 2; n <= 6; n++) {
      const lines = Array.from({ length: n }, (_, i) => `s${i}`);
      assert.ok(!completionSplit(lines).given.includes(lines.at(-1)!));
    }
  });
});
