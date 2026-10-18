/**
 * What this guards: the one list of question types, and the inputs of the
 * repeat rule, which the quiz (`generationShape.ts`) and the evaluation
 * validator (`validator.ts`) both build on.
 *
 * The quiz list is pinned as a literal on purpose. `normalizeQuiz` silently
 * drops any question whose type is not in it, so a wrong list would lose
 * questions without an error anywhere.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sameKind } from '@workspace/math-practice';
import {
  EXAM_TYPE_ORDER,
  MAX_WORDS_CHANGED,
  QUIZ_TYPES,
  QUIZ_TYPE_ORDER,
  hasSentence,
  inPaperOrder,
  sameAsk,
} from '../index.ts';

describe('the type lists', () => {
  it('keeps the exam order exactly as the ministry paper has it', () => {
    assert.deepEqual([...EXAM_TYPE_ORDER], [
      'multiple_choice', 'true_false', 'matching', 'fill_blank',
      'short_answer', 'open_ended', 'problem_solving', 'practical_task',
      'read_aloud', 'dictation',
    ]);
  });

  it('has no type twice', () => {
    assert.equal(new Set(EXAM_TYPE_ORDER).size, EXAM_TYPE_ORDER.length);
  });

  it('pins the quiz types to the four it has always had', () => {
    assert.deepEqual([...QUIZ_TYPES], ['multiple_choice', 'true_false', 'fill_blank', 'short_answer']);
  });

  it('derives the quiz order from the exam order, so the two cannot disagree', () => {
    assert.deepEqual([...QUIZ_TYPE_ORDER], EXAM_TYPE_ORDER.filter(t => (QUIZ_TYPES as readonly string[]).includes(t)));
    assert.deepEqual([...QUIZ_TYPE_ORDER], ['multiple_choice', 'true_false', 'fill_blank', 'short_answer']);
  });

  it('only offers a quiz type that is also an exam type', () => {
    for (const t of QUIZ_TYPES) assert.ok(EXAM_TYPE_ORDER.includes(t), `${t} is not an exam type`);
  });
});

describe('inPaperOrder', () => {
  const q = (id: string, type: string) => ({ id, type });
  const ids = (xs: { id: string }[]) => xs.map(x => x.id).join(',');

  it('groups a mixed paper into ministry blocks', () => {
    const paper = [q('a', 'short_answer'), q('b', 'multiple_choice'), q('c', 'fill_blank'), q('d', 'true_false')];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), 'b,d,c,a');
  });

  it('is stable inside a type, so the generator\'s own sequence survives', () => {
    const paper = [q('1', 'true_false'), q('2', 'multiple_choice'), q('3', 'true_false'), q('4', 'multiple_choice')];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), '2,4,1,3');
  });

  it('sorts a type it does not know last, not first', () => {
    const paper = [q('x', 'mystery'), q('a', 'dictation'), q('b', 'multiple_choice')];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), 'b,a,x');
  });

  it('does not touch its input', () => {
    const paper = [q('a', 'short_answer'), q('b', 'multiple_choice')];
    inPaperOrder(paper, x => x.type);
    assert.equal(ids(paper), 'a,b');
  });
});

describe('the repeat rule\'s inputs', () => {
  const words = (n: number, changed: number) => {
    const base = Array.from({ length: n }, (_, i) => `w${i}`);
    const other = base.map((w, i) => (i < changed ? `x${i}` : w));
    return [base.join(' '), other.join(' ')] as const;
  };

  it('caps the words a reworded ask may change at three', () => {
    assert.equal(MAX_WORDS_CHANGED, 3);
  });

  it('calls two identical frames one ask', () => {
    assert.equal(sameAsk('ما العدد الأكبر', 'ما العدد الأكبر'), true);
  });

  it('allows three changed words in a long stem and no more', () => {
    // 30 words: the 37% allowance is 11, so only the cap of 3 decides.
    const [a3, b3] = words(30, 3);
    const [a4, b4] = words(30, 4);
    assert.equal(sameAsk(a3, b3), true);
    assert.equal(sameAsk(a4, b4), false);
    // The cap is what makes this different from `sameKind` uncapped.
    assert.equal(sameKind(a4, b4), true);
  });

  it('agrees with sameKind at the cap on every pair of a small corpus', () => {
    const frames = ['ما العدد الأكبر بين', 'ما العدد الأصغر بين', 'أوجد الكتلة المولية لـ', 'عرّف المتوسط', '# + # = ؟'];
    for (const x of frames) for (const y of frames) {
      assert.equal(sameAsk(x, y), sameKind(x, y, 3), `${x} / ${y}`);
    }
  });

  it('says a stem has a sentence only when it has a letter', () => {
    assert.equal(hasSentence('ما العدد الأكبر'), true);
    assert.equal(hasSentence('what is'), true);
    assert.equal(hasSentence('# + # = ؟'), false);
    assert.equal(hasSentence(''), false);
  });
});
