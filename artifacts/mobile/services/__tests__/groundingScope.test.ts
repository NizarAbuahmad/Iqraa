/**
 * A title does not identify a lesson (CLAUDE.md). 107 Arabic titles are
 * shared across books: «النسب المثلثية» is a Grade 10 S1 maths lesson AND a
 * Grade 9 S2 maths lesson. Resolving on the title alone returned whichever
 * ranked first, so a Grade 10 quiz could be built from the Grade 9 lesson's
 * objectives and sent with the Grade 9 lesson id — and a maths title that
 * physics also uses was refused as "belongs to physics".
 *
 * The scope is a tie-break only: it picks among exact-title matches and never
 * promotes a lesson whose title does not match.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getBookForLesson, KB_LESSONS, resolveGroundedKbLesson } from '../knowledgeBase.ts';
import { groundedSubjectConflict } from '../lessonPrep.ts';

/** A title that two books of different grades share, found from the data. */
function duplicatedTitle(): { title: string; grades: string[]; subjectId: string } | null {
  const byTitle = new Map<string, Set<string>>();
  const subjectOf = new Map<string, string>();
  for (const lesson of KB_LESSONS) {
    const book = getBookForLesson(lesson);
    if (!book) continue;
    const key = lesson.titleAr.trim();
    if (!byTitle.has(key)) byTitle.set(key, new Set());
    byTitle.get(key)!.add(book.gradeId);
    subjectOf.set(`${key}|${book.gradeId}`, book.subjectId);
  }
  for (const [title, grades] of byTitle) {
    if (grades.size < 2) continue;
    const [g1, g2] = [...grades];
    if (subjectOf.get(`${title}|${g1}`) === subjectOf.get(`${title}|${g2}`)) {
      return { title, grades: [g1!, g2!], subjectId: subjectOf.get(`${title}|${g1}`)! };
    }
  }
  return null;
}

describe('resolveGroundedKbLesson with a scope', () => {
  it('resolves a title shared across grades to the lesson in the scoped grade', () => {
    const dup = duplicatedTitle();
    assert.ok(dup, 'the KB no longer has a title shared across grades — this guard may be retired');
    for (const gradeId of dup.grades) {
      const lesson = resolveGroundedKbLesson(dup.title, 'ar', { gradeId, subjectId: dup.subjectId });
      assert.ok(lesson, `${dup.title} did not resolve for ${gradeId}`);
      assert.equal(lesson.titleAr.trim(), dup.title);
      assert.equal(getBookForLesson(lesson)?.gradeId, gradeId);
    }
  });

  it('still resolves without a scope, and never promotes a non-matching title', () => {
    const dup = duplicatedTitle();
    assert.ok(dup);
    const unscoped = resolveGroundedKbLesson(dup.title, 'ar');
    assert.ok(unscoped);
    assert.equal(unscoped.titleAr.trim(), dup.title);
    // A scope the title does not exist in falls back to the title match
    // rather than inventing a lesson from that scope.
    const elsewhere = resolveGroundedKbLesson(dup.title, 'ar', { gradeId: 'grade-1', subjectId: 'arabic' });
    assert.ok(elsewhere);
    assert.equal(elsewhere.titleAr.trim(), dup.title);
  });

  it('does not report a subject conflict when the picked subject has the lesson too', () => {
    // «جمع المتجهات وطرحها» is both Grade 10 maths and physics. Picked as
    // maths, it must not be refused as physics.
    const title = 'جمع المتجهات وطرحها';
    const inMaths = resolveGroundedKbLesson(title, 'ar', { subjectId: 'mathematics' });
    if (!inMaths) return; // title moved; nothing to assert
    assert.equal(getBookForLesson(inMaths)?.subjectId, 'mathematics');
    assert.equal(groundedSubjectConflict(title, 'ar', 'mathematics'), null);
  });
});
