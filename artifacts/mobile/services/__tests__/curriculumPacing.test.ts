/**
 * Pacing tests — every maths lesson has a period count, every unit a total.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/curriculumPacing.test.ts
 *
 * `periods` and `total_periods` come from the «عدد الحصص» column of the
 * teacher guides' مخطط الوحدة tables. They were mostly right already — six of
 * the eight units matched the guide exactly — but two units carried no total
 * at all and two lessons no count, and a null here is invisible: a pacing plan
 * simply omits the lesson rather than failing.
 *
 * The arithmetic check below is the interesting one. A unit's printed total is
 * always MORE than its lessons sum to, because the guide counts the unit's
 * lab, project and end-of-unit test in the same column. Those extras are
 * small and consistent, so a gap that is large or negative means a lesson's
 * count is wrong — not that the book is unusual.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import sem1 from '../../../../lib/curriculum/src/data/iqra_curriculum_g10_math_sem1.json' with { type: 'json' };
import sem2 from '../../../../lib/curriculum/src/data/iqra_curriculum_g10_math_sem2.json' with { type: 'json' };

type Lesson = { id: string; periods?: number | null };
type Unit = {
  id: string;
  total_periods?: number | null;
  pacing_note?: string;
  lessons: Lesson[];
};

const UNITS: Unit[] = [
  ...(sem1 as { units: Unit[] }).units,
  ...(sem2 as { units: Unit[] }).units,
];

/**
 * The largest gap between a unit's printed total and its lessons' sum that is
 * explained by the unit's own extras.
 *
 * Six units sit at exactly 3 (project 1 + end-of-unit test 2) and one at 4.
 * Unit 2 is at 7 and is excluded by name: the teacher guide's unit 2 lists
 * five lessons and a GeoGebra lab where this curriculum carries four lessons
 * and no lab, so its total covers work these lessons do not contain. That
 * divergence is recorded on the unit as `pacing_note`.
 */
const MAX_EXTRAS = 4;
const STRUCTURE_DIFFERS = new Set(['u2']);

describe('maths pacing', () => {
  it('covers all eight units', () => {
    assert.equal(UNITS.length, 8);
  });

  it('gives every lesson a period count', () => {
    for (const unit of UNITS) {
      for (const lesson of unit.lessons) {
        assert.ok(
          typeof lesson.periods === 'number' && lesson.periods > 0,
          `${lesson.id} has no period count`,
        );
      }
    }
  });

  it('gives every unit a total', () => {
    for (const unit of UNITS) {
      assert.ok(
        typeof unit.total_periods === 'number' && unit.total_periods > 0,
        `${unit.id} has no total_periods`,
      );
    }
  });

  it("never lets a unit's total fall below the work inside it", () => {
    for (const unit of UNITS) {
      const sum = unit.lessons.reduce((n, l) => n + (l.periods ?? 0), 0);
      assert.ok(
        unit.total_periods! >= sum,
        `${unit.id}: total ${unit.total_periods} is less than its lessons' ${sum}`,
      );
    }
  });

  it('explains the whole gap by the unit lab, project and test', () => {
    for (const unit of UNITS) {
      if (STRUCTURE_DIFFERS.has(unit.id)) continue;
      const sum = unit.lessons.reduce((n, l) => n + (l.periods ?? 0), 0);
      const gap = unit.total_periods! - sum;
      assert.ok(
        gap <= MAX_EXTRAS,
        `${unit.id}: ${gap} periods unaccounted for — more than a lab, a project and a test`,
      );
    }
  });

  it('says in the data why unit 2 is excluded, rather than only here', () => {
    // A skipped check that is explained only in the test is a check nobody
    // maintaining the curriculum data will ever see.
    const u2 = UNITS.find(u => u.id === 'u2');
    assert.ok(u2?.pacing_note, 'unit 2 carries a note explaining its gap');
    assert.match(u2!.pacing_note!, /دليل المعلم/);
  });
});
