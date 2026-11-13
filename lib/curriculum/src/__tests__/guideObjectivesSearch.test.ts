/**
 * Objectives copied from a teacher guide do not steer a lesson's page search.
 *
 * Found 2026-11-13: the Grade 4 and 5 Islamic objectives were filled from the
 * teacher guides' «نتاجات التعلم» blocks, which the guide reprints verbatim on
 * the lesson's outcome page, its teaching notes and every unit plan. Searching
 * with them sent the four passages to the guide and the student book's own
 * lesson pages stopped reaching them (Grade 5 Islamic 27 → 3 of 37 lessons).
 * A catalog marks `meta.objectives_source: "teacher-guide"`; search then reads
 * its units as it did before they had objectives. The objectives stay in the
 * catalog for everything else (lesson plans, outcomes, reports).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { passagesForUnit } from '../passages.ts';
import { objectivesFromTeacherGuide } from '../catalogs/nccdCatalog.ts';
import { getObjectivesForUnit } from '../objectives.ts';

const ownPage = (ps: { sourceId: string; page: number }[], src: string, from: number, to: number) =>
  ps.some(p => p.sourceId === src && p.page >= from && p.page <= to);

describe('guide-sourced objectives and page search', () => {
  it('the Grade 4 and 5 Islamic catalogs are marked, and still carry their objectives', () => {
    for (const unitId of ['kbu-g4-islamic-s1-nccd-u3', 'kbu-g4-islamic-s2-nccd-u5', 'kbu-g5-islamic-s1-nccd-u2', 'kbu-g5-islamic-s2-nccd-u6']) {
      assert.equal(objectivesFromTeacherGuide(unitId), true, unitId);
      assert.ok(getObjectivesForUnit(unitId).length > 0, `${unitId} lost its objectives`);
    }
  });

  it('a catalog whose objectives come from the student book is not marked', () => {
    assert.equal(objectivesFromTeacherGuide('kbu-g6-islamic-s2-nccd-u6'), false);
    assert.equal(objectivesFromTeacherGuide('kbu-g5-physical-education-s1-nccd-u1'), false);
  });

  it('Grade 5 «السيدة عائشة» reaches its own student-book pages (29-32)', () => {
    const ps = passagesForUnit({ unitId: 'kbu-g5-islamic-s1-nccd-u2', lessonId: 'kbl-g5-islamic-s1-nccd-u2_l2', quotableOnly: true });
    assert.ok(ownPage(ps, 'g5-islamic-s1-student-book', 29, 32), ps.map(p => `${p.sourceId}:${p.page}`).join(', '));
  });
});
