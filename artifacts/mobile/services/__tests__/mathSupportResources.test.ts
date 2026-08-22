import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupportResourcesContext,
  formatSupportResourcesBlock,
  searchSupportResources,
  supportResourcesStats,
  unitTagsForLesson,
} from '../mathSupportResources.ts';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';

describe('mathSupportResources', () => {
  it('loads math + chemistry catalogs', () => {
    const stats = supportResourcesStats();
    assert.ok(stats.total >= 50);
    assert.ok((stats.bySubject.mathematics ?? 0) >= 30);
    assert.ok((stats.bySubject.chemistry ?? 0) >= 20);
    assert.ok((stats.byType.worksheet ?? 0) >= 1);
    assert.ok((stats.byType.quiz ?? 0) >= 1);
  });

  it('finds circle worksheets by query', () => {
    const hits = searchSupportResources({ query: 'ورقة عمل الدائرة', limit: 5 });
    assert.ok(hits.length > 0);
    assert.ok(hits.some(h => /دائر/.test(h.titleAr)));
  });

  it('finds chemistry Bohr worksheets', () => {
    const hits = searchSupportResources({
      query: 'ورقة عمل نظرية بور كيمياء',
      subjectId: 'chemistry',
      limit: 5,
    });
    assert.ok(hits.length > 0);
    assert.ok(hits.some(h => /بور|كيمياء/.test(h.titleAr)));
  });

  it('formats an Arabic block', () => {
    const hits = searchSupportResources({ query: 'الدائرة', limit: 2 });
    const block = formatSupportResourcesBlock(hits, 'ar');
    assert.match(block, /مواد مساندة/);
  });
});

describe('subject isolation', () => {
  // The catalog holds mathematics and chemistry packs only. A
  // financial-literacy lesson used to come back with three MATHEMATICS files
  // attached — «إجابات الوحدة الأولى (الأسس والمعادلات)» on «المشروع
  // وإدارته» — and since live AI was switched on those go straight into the
  // prompt. Two causes: the subject mismatch was a -6 soft penalty while a
  // colliding unit tag scored +8, and every NCCD unit id matches /nccd-u\d+/
  // so a financial-literacy unit 1 emitted the mathematics tag `s1-u1`.
  const lessonsBySubject = (subjectId: string) =>
    KB_LESSONS.filter(l => getBookForLesson(l)?.subjectId === subjectId);

  it('never attaches a resource from another subject, to any lesson', () => {
    for (const lesson of KB_LESSONS) {
      const subjectId = getBookForLesson(lesson)?.subjectId;
      if (!subjectId) continue;
      for (const hit of searchSupportResources({ query: lesson.titleAr, lesson, limit: 5 })) {
        assert.equal(
          hit.subjectId, subjectId,
          `${lesson.id} (${subjectId}) matched ${hit.subjectId}: ${hit.titleAr}`,
        );
      }
    }
  });

  it('keeps the subject when the widened retry drops the lesson', () => {
    // buildSupportResourcesContext retries without the lesson when the scoped
    // search finds nothing. That retry dropped the subject too, and
    // detectSubjectFromQuery only knows maths and chemistry — so a
    // financial-literacy lesson picked up chemistry activity books here even
    // after the scoring gate was fixed.
    for (const lesson of lessonsBySubject('financial-literacy')) {
      const block = buildSupportResourcesContext(lesson.titleAr, [lesson], 'ar', 3);
      assert.equal(block, '', `${lesson.id} surfaced: ${block}`);
    }
  });

  it('does not emit the mathematics unit tags for another subject', () => {
    for (const lesson of lessonsBySubject('financial-literacy')) {
      for (const tag of unitTagsForLesson(lesson)) {
        assert.ok(!/^s[12]-u\d+$/.test(tag), `${lesson.id} emitted maths tag ${tag}`);
      }
    }
  });

  it('still finds the right packs for the subjects that have them', () => {
    // The gate must not become "match nothing" — maths and chemistry lessons
    // keep the resources they had.
    const withHits = (subjectId: string) =>
      lessonsBySubject(subjectId)
        .filter(l => searchSupportResources({ query: l.titleAr, lesson: l, limit: 3 }).length > 0)
        .length;
    assert.ok(withHits('mathematics') > 0, 'no mathematics lesson matched any pack');
    assert.ok(withHits('chemistry') > 0, 'no chemistry lesson matched any pack');
  });
});
