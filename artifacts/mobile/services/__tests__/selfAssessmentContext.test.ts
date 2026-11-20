/**
 * Books that print no outcomes list (Grade 10 civic, history S2, PE) print a
 * self-assessment table instead. The generator context must carry it under its
 * own heading, and never as «النتاجات (من المنهاج الرسمي)»: the catalogs leave
 * `objectives` empty for these books on purpose (their meta.known_gaps), and a
 * self-assessment statement presented as an official outcome would be a claim
 * the book does not make.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveGeneratorGrounding } from '../kbContext.ts';
import { getLessonById as getKbLessonById } from '../knowledgeBase.ts';

const OFFICIAL = 'النتاجات (من المنهاج الرسمي)';
const UNIT_HEADING = 'معايير التقويم الذاتي في كتاب الطالب للوحدة كاملة';
const LESSON_HEADING = 'معايير التقويم الذاتي في كتاب الطالب لهذا الدرس';

function contextFor(lessonId: string, scope: { gradeId: string; subjectId: string }): string {
  const lesson = getKbLessonById(lessonId);
  assert.ok(lesson, `no KB lesson ${lessonId}`);
  const g = resolveGeneratorGrounding(lesson!.titleAr, 'ar', { lessonId, scope });
  assert.ok(g.grounded, `${lessonId} did not ground`);
  assert.equal(g.lesson?.id, lessonId);
  return g.context;
}

describe('self-assessment criteria in the generator context', () => {
  it('carries a civic unit table under its own heading, not as official outcomes', () => {
    const ctx = contextFor('kbl-civ-s1-nccd-u1_l1', { gradeId: 'grade-10', subjectId: 'civic-education' });
    assert.ok(ctx.includes(UNIT_HEADING), ctx);
    assert.ok(ctx.includes('أعتزّ بهويتي الأردنية.'), 'a statement printed in the unit 1 table (p.43)');
    assert.ok(!ctx.includes(OFFICIAL), 'civic objectives stay empty, so nothing is labelled official');
  });

  it('carries the history S2 table for the lesson whose unit printed it', () => {
    const ctx = contextFor('kbl-hist-s2-nccd-u4_l3', { gradeId: 'grade-10', subjectId: 'history' });
    assert.ok(ctx.includes('أبيّن دور زيغريد هونكه في تعريف الغرب بالحضارة العربية الإسلامية.'), ctx);
    assert.ok(!ctx.includes(OFFICIAL));
  });

  it("carries PE's per-lesson box as lesson-level criteria", () => {
    const ctx = contextFor('kbl-pe-s1-nccd-u5_l1', { gradeId: 'grade-10', subjectId: 'physical-education' });
    assert.ok(ctx.includes(LESSON_HEADING), ctx);
    assert.ok(ctx.includes('أحفَظُ رقمَ الطوارِئِ في وطني (911).'));
    assert.ok(!ctx.includes(UNIT_HEADING));
    assert.ok(!ctx.includes(OFFICIAL));
  });

  it('adds nothing for a book that prints real outcomes', () => {
    const ctx = contextFor('kbl-biology-s1-nccd-u1_l1', { gradeId: 'grade-10', subjectId: 'biology' });
    assert.ok(ctx.includes(OFFICIAL), 'biology keeps its official outcomes');
    assert.ok(!ctx.includes('معايير التقويم الذاتي'));
  });
});
