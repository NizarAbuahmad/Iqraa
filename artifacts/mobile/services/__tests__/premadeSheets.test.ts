/**
 * The frozen sheets stay renderable (`@workspace/curriculum/premade`).
 *
 * A pre-made sheet is printed by `buildWorksheetHTML`, which takes a
 * `WorksheetOutput`. But the manifest lives in `lib/curriculum`, which may not
 * import from `artifacts/`, so its `PremadeWorksheetContent` is a structural
 * copy of that type rather than the type itself.
 *
 * Two copies of a shape drift, and this one drifts silently: add a field to
 * `WorksheetOutput` that the renderer starts relying on and every frozen sheet
 * quietly prints without it. The compile-time guard below is where that is
 * caught — it fails `tsc`, not at runtime on a teacher's printout.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allPremade, type PremadeWorksheetContent } from '@workspace/curriculum/premade';
import type { WorksheetOutput } from '../ai/AIService.ts';
import { repeatedStems, stemOf } from '../premadeStems.ts';

/**
 * Compile-time assignability. If `PremadeWorksheetContent` stops satisfying
 * `WorksheetOutput`, this resolves to `never` and the assignment below is a
 * type error — which is the point. The runtime assertion only keeps the
 * constant referenced.
 */
type AssignableToWorksheetOutput = PremadeWorksheetContent extends WorksheetOutput ? true : never;
const guard: AssignableToWorksheetOutput = true;

describe('the frozen sheet shape', () => {
  it('is still assignable to what the renderer takes', () => {
    assert.equal(guard, true);
  });
});

describe('coverage of Grade 10 mathematics', () => {
  const sheets = allPremade().filter(
    sheet => sheet.gradeId === 'grade-10' && sheet.subjectId === 'mathematics',
  );

  /**
   * 24, arrived at by subtraction and measured rather than read off a doc:
   *
   *   36 lessons in Grade 10 maths
   *   −3 GeoGebra lab lessons (`order === 0`) — an activity to run, not a
   *      lesson to set questions on
   *   −5 held back in `scripts/build-premade-sheets.ts` because
   *      `detectMathFamily` picks the wrong branch of maths for them and the
   *      sheet comes out about the wrong subject
   *   −4 the offline generator has no question bank for
   *      (`NoQuestionBankError`: trig graphs, 3D problems, polynomial functions,
   *      polynomial division). They used to ship a sheet built before the
   *      generator stopped repeating itself; the build now refuses the lesson
   *      and drops that sheet rather than keep a repeating one.
   *   = 24
   *
   * Raise this as banks are authored in `lib/math-practice` or entries leave
   * `HELD_BACK`; the ceiling is 33.
   */
  it(
    'ships a sheet for every lesson not held back',
    {
      skip:
        sheets.length === 0
          ? 'the manifest is empty until scripts/build-premade-sheets.ts has been run'
          : false,
    },
    () => {
      assert.ok(sheets.length >= 24, `expected at least 24 sheets, got ${sheets.length}`);
      assert.ok(sheets.length <= 33, `more sheets than there are teachable lessons: ${sheets.length}`);
    },
  );

  it('never ships a blank answer', () => {
    for (const sheet of sheets) {
      for (const entry of sheet.content.answerKey) {
        assert.ok(entry.answer.trim(), `${sheet.id} q${entry.num} has a blank answer`);
      }
    }
  });

  it('never lists the same lesson twice at one level', () => {
    const seen = new Set<string>();
    for (const sheet of sheets) {
      const slot = `${sheet.lessonId}:${sheet.level}`;
      assert.ok(!seen.has(slot), `${slot} appears twice`);
      seen.add(slot);
    }
  });
});

/**
 * A printed sheet must not ask the same question twice.
 *
 * Found 2026-10-10 from the library: 27 of the 28 frozen sheets re-asked one
 * bank item under a different question type («أوجد الاقتران العكسي لـ f(x) = 2x − 6»
 * three times on one ten-question page; the worst sheets repeated 7 of 10).
 * They were built on 2026-09-16, before `generateWorksheet` learned to stop at a
 * spent bank (`BankSpentError`) instead of drawing the same item again — today's
 * generator returns a shorter sheet for the same lesson. The manifest is frozen
 * output, so nothing re-ran it, and nothing checked it either.
 *
 * Compared by the stem: the text up to the first blank line, with the
 * answer-space padding gone. That is stricter than the generator's own
 * `questionStemKey`, which keeps a word problem's instruction line — two word
 * problems that open with the same problem are one problem.
 */
describe('a frozen sheet never repeats a question', () => {
  const sheets = allPremade();

  for (const sheet of sheets) {
    it(`${sheet.id} asks each question once`, () => {
      const repeats = repeatedStems(sheet.content);
      assert.deepEqual(repeats, [], `${sheet.id}: ${repeats.length} repeated question(s)`);
    });
  }

  it('has sheets to check', () => {
    // An empty manifest would make the loop above vacuously pass.
    assert.ok(sheets.length > 0, 'no premade sheets loaded');
  });

  it('counts the same question as short-answer and as multiple-choice as one', () => {
    // The shape of the real defect: one bank item, re-asked in another format.
    const sheet = {
      sections: [
        { questions: [{ text: 'أوجد f(3).\n\nالإجابة:\n____' }] },
        { questions: [{ text: 'أوجد   f(3).' }] },
      ],
    };
    assert.equal(stemOf('أوجد   f(3).\n\nالإجابة:\n____'), 'أوجد f(3).');
    assert.equal(repeatedStems(sheet).length, 1);
  });

  it('counts the worked example as already asked', () => {
    const sheet = {
      sections: [{ questions: [{ text: 'حلّ س + 1 = 3.' }] }],
      workedExample: { problem: 'حلّ س + 1 = 3.' },
    };
    assert.equal(repeatedStems(sheet).length, 1);
  });
});
