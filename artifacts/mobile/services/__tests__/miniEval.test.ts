/**
 * The mini-evaluation preset.
 *
 * There is one property here worth a test, and it is not arithmetic: an exit
 * ticket must contain only question types that mark themselves. The failure
 * mode is a helpful edit — someone adds `short_answer` so the tickets "test
 * more than recall" — and nothing breaks. The papers still generate, students
 * still answer, and the teacher discovers that the three-question check they
 * run every lesson now needs marking, thirty times over. Nothing in the UI
 * would say so.
 *
 * The matching guarantee lives on the API side in `miniEvalGraders.test.ts`,
 * where the grader registry actually is. This end pins the list; that end pins
 * that the list still self-marks.
 *
 * Note this is a different feature from `quickCheck.test.ts` next door, which
 * covers the whole-class ABCD classroom activity. The classroom-activity
 * generator owns BOTH obvious names for this thing — `quick-check` and
 * `exit-ticket` are existing `activityType`s — which is why this one is named
 * from the evaluations side instead. Those activities project questions at a
 * room; this one produces a per-student record.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MINI_EVAL_COUNT,
  MINI_EVAL_TYPES,
  isSelfMarking,
} from '../miniEval.ts';

/** The types the server has no deterministic grader for — a teacher marks these by hand. */
const HAND_MARKED = ['short_answer', 'open_ended', 'problem_solving', 'practical_task'] as const;

describe('mini-evaluation preset', () => {
  it('contains no hand-marked question type', () => {
    for (const type of HAND_MARKED) {
      assert.equal(
        MINI_EVAL_TYPES.includes(type),
        false,
        `${type} has no deterministic grader — including it means the teacher marks every quick evaluation by hand`,
      );
    }
  });

  it('is exactly the four self-marking generatable types', () => {
    assert.deepEqual(
      [...MINI_EVAL_TYPES].sort(),
      ['fill_blank', 'matching', 'multiple_choice', 'true_false'],
    );
  });

  it('excludes read_aloud, which cannot be generated', () => {
    // It self-marks, so it would pass the test above. The server refuses to
    // generate it (NOT_AI_GENERATABLE) because its passage has to be vetted
    // text, so asking for it here would produce an evaluation short of questions.
    assert.equal(MINI_EVAL_TYPES.includes('read_aloud'), false);
  });

  it('asks for more than one question, so the objective score has evidence', () => {
    // Note what this does NOT claim. An earlier version of this test asserted
    // the count clears MIN_QUESTIONS_PER_COMPETENCY (2); running it proved
    // otherwise — `allocateQuestions` spreads a paper across the four
    // competencies, so three questions land one apiece and every competency is
    // correctly reported as "not enough evidence".
    //
    // The objective score is the one that matters here: all the questions sit
    // on the single objective the teacher picked, and the objective is what the
    // class mastery rollup aggregates. A count of 1 would leave even that
    // resting on a single item.
    assert.ok(MINI_EVAL_COUNT > 1, 'one question is not evidence about an objective');
    assert.ok(MINI_EVAL_COUNT <= 5, 'a quick evaluation has to fit in the end of a lesson');
  });

  it('isSelfMarking agrees with the list', () => {
    assert.equal(isSelfMarking('multiple_choice'), true);
    assert.equal(isSelfMarking('open_ended'), false);
  });
});
