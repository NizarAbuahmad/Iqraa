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
   * 33, not 36: the grade has 36 lessons and three of them are the GeoGebra
   * lab lessons (`order === 0`), which are an activity to run rather than a
   * lesson to set questions on, so they get no sheet. Measured by running the
   * catalog builders, not read off a doc.
   */
  it(
    'ships a sheet for every teachable lesson',
    {
      skip:
        sheets.length === 0
          ? 'the manifest is empty until scripts/build-premade-sheets.ts runs with a real OPENAI_API_KEY'
          : false,
    },
    () => {
      assert.ok(sheets.length >= 33, `expected at least 33 sheets, got ${sheets.length}`);
    },
  );

  it('never lists the same lesson twice at one level', () => {
    const seen = new Set<string>();
    for (const sheet of sheets) {
      const slot = `${sheet.lessonId}:${sheet.level}`;
      assert.ok(!seen.has(slot), `${slot} appears twice`);
      seen.add(slot);
    }
  });
});
