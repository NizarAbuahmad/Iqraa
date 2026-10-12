/**
 * The evaluation screen heads each run of one question type with the ministry
 * paper's «السؤال الأول: …» line. It shares its blocks with the quiz exports.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EXAM_TYPE_ORDER, examBlockDirection, examBlockHeading, examBlockMarks, examBlocks } from '../examBlocks.ts';
import { quizBlocks } from '../quizPaper.ts';
import type { QuestionType } from '../evaluations.ts';

const ev = (type: string, marks: string) => ({ type, marks });

describe('examBlocks', () => {
  it('opens a block at each change of type and numbers the questions straight through', () => {
    const paper = [ev('multiple_choice', '2.00'), ev('multiple_choice', '2.00'), ev('true_false', '1.00'), ev('short_answer', '5.00')];
    const blocks = examBlocks(paper, true);
    assert.deepEqual(blocks.map(b => [b.type, b.start, b.questions.length]), [
      ['multiple_choice', 0, 2], ['true_false', 2, 1], ['short_answer', 3, 1],
    ]);
    assert.match(blocks[0]!.heading, /^السؤال الأول: /);
    assert.match(blocks[1]!.heading, /^السؤال الثاني: /);
    assert.match(blocks[2]!.heading, /^السؤال الثالث: /);
  });

  it('does not merge two runs of a type that are not adjacent', () => {
    // A teacher-added question lands at the end: it gets its own block rather
    // than being silently pulled up under a heading it was not placed under.
    const blocks = examBlocks([ev('multiple_choice', '1'), ev('true_false', '1'), ev('multiple_choice', '1')], true);
    assert.equal(blocks.length, 3);
  });

  it('adds up marks given as the strings the API stores', () => {
    const [b] = examBlocks([ev('multiple_choice', '2.00'), ev('multiple_choice', '1.50')], true);
    assert.equal(examBlockMarks(b!, q => q.marks), 3.5);
  });

  it('reads an unusable mark as zero rather than NaN', () => {
    const [b] = examBlocks([ev('multiple_choice', 'x'), ev('multiple_choice', '2')], true);
    assert.equal(examBlockMarks(b!, q => q.marks), 2);
  });

  it('has a paper direction for every evaluation question type, in both languages', () => {
    for (const type of EXAM_TYPE_ORDER) {
      for (const isAr of [true, false]) {
        const d = examBlockDirection(type, isAr);
        assert.ok(d.length > 8, `${type}/${isAr ? 'ar' : 'en'} has no direction`);
        // Only the generic fallback may be shared, and only by the types that really are "answer these".
        if (type !== 'short_answer') {
          assert.notEqual(d, examBlockDirection('short_answer', isAr), `${type} reuses the generic direction`);
        }
      }
    }
  });

  it('names blocks in English and runs past the ordinals without breaking', () => {
    assert.equal(examBlockHeading('true_false', 1, false), 'Question Two: Mark (✓) beside each true statement and (✗) beside each false one');
    assert.match(examBlockHeading('matching', 11, true), /^السؤال 12: /);
  });

  it('keeps the quiz exports on the same blocks', () => {
    const q = { id: 'q', text: 't', correctAnswer: 'a', points: 1, explanation: '' } as const;
    const blocks = quizBlocks([{ ...q, type: 'multiple_choice' }, { ...q, type: 'true_false' }], true);
    assert.deepEqual(blocks.map(b => b.heading), [examBlockHeading('multiple_choice', 0, true), examBlockHeading('true_false', 1, true)]);
  });

  it('covers every type an evaluation can hold', () => {
    const all: QuestionType[] = ['multiple_choice', 'true_false', 'matching', 'fill_blank', 'short_answer', 'open_ended', 'problem_solving', 'practical_task', 'read_aloud', 'dictation'];
    assert.deepEqual([...EXAM_TYPE_ORDER].sort(), [...all].sort());
  });
});
