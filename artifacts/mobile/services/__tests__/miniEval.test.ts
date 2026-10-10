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
  groupObjectivesByLesson,
  isSelfMarking,
  miniEvalPreset,
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

describe('miniEvalPreset', () => {
  const lookup = (id: string) => (id === 'o1' ? { bookId: 'book-chem-10' } : undefined);
  it('opens on the objective and its book when the book is on offer', () => {
    assert.deepEqual(miniEvalPreset('o1', ['book-chem-10', 'book-math-10'], lookup), { bookId: 'book-chem-10', objectiveId: 'o1' });
  });
  it('presets nothing for an unknown objective, an absent one, or a book the class does not offer', () => {
    assert.equal(miniEvalPreset('nope', ['book-chem-10'], lookup), null);
    assert.equal(miniEvalPreset(undefined, ['book-chem-10'], lookup), null);
    assert.equal(miniEvalPreset('o1', ['book-math-10'], lookup), null);
  });
});

describe('groupObjectivesByLesson', () => {
  // The picker is a flat list of a whole book's objectives. A teacher cannot
  // tell which lesson a quiz is for unless the lesson is shown, and the lesson
  // is what the mastery gate unlocks.
  const o = (id: string, lessonId: string, unitId: string) => ({
    id,
    lessonId,
    lessonTitle: `lesson ${lessonId}`,
    lessonTitleAr: `درس ${lessonId}`,
    unitId,
    unitName: `unit ${unitId}`,
    unitNameAr: `وحدة ${unitId}`,
  });

  it('puts the objectives of one lesson in one group, in catalog order', () => {
    const groups = groupObjectivesByLesson([o('a', 'l1', 'u1'), o('b', 'l1', 'u1'), o('c', 'l2', 'u1')]);
    assert.deepEqual(groups.map(g => g.lessonId), ['l1', 'l2']);
    assert.deepEqual(groups[0]!.objectives.map(x => x.id), ['a', 'b']);
    assert.deepEqual(groups[1]!.objectives.map(x => x.id), ['c']);
  });

  it('lists every objective exactly once, even if a lesson reappears later in the list', () => {
    const groups = groupObjectivesByLesson([o('a', 'l1', 'u1'), o('b', 'l2', 'u1'), o('c', 'l1', 'u1')]);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0]!.objectives.map(x => x.id), ['a', 'c']);
    assert.equal(groups.flatMap(g => g.objectives).length, 3);
  });

  it('carries the unit and lesson names, so the heading needs no second lookup', () => {
    const [g] = groupObjectivesByLesson([o('a', 'l1', 'u1')]);
    assert.equal(g!.unitName, 'unit u1');
    assert.equal(g!.unitNameAr, 'وحدة u1');
    assert.equal(g!.lessonTitle, 'lesson l1');
    assert.equal(g!.lessonTitleAr, 'درس l1');
  });

  it('keeps lessons of different units apart and in order', () => {
    const groups = groupObjectivesByLesson([o('a', 'l1', 'u1'), o('b', 'l9', 'u2')]);
    assert.deepEqual(groups.map(g => g.unitId), ['u1', 'u2']);
  });

  it('answers an empty list with no groups', () => {
    assert.deepEqual(groupObjectivesByLesson([]), []);
  });
});
