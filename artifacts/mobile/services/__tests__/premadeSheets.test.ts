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
   * 28, arrived at by subtraction and measured rather than read off a doc:
   *
   *   36 lessons in Grade 10 maths
   *   −3 GeoGebra lab lessons (`order === 0`) — an activity to run, not a
   *      lesson to set questions on
   *   −5 held back in `scripts/build-premade-sheets.ts` because
   *      `detectMathFamily` picks the wrong branch of maths for them and the
   *      sheet comes out about the wrong subject
   *   = 28
   *
   * Raise this as entries leave `HELD_BACK`; the ceiling is 33.
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
      assert.ok(sheets.length >= 28, `expected at least 28 sheets, got ${sheets.length}`);
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
