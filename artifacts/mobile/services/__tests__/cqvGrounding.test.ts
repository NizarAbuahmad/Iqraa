/**
 * The content-QA batch grounds each lesson in Grade 10 Mathematics, and tells
 * the API when nothing grounds a topic (`grounding: 'none'`), like every other
 * request builder since the API stopped attaching a book by title for those.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cqvGroundingFields, CQV_SCOPE } from '../cqv/grounding.ts';
import { getCqvLessons } from '../cqv/catalog.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';
import { getBookForLesson } from '../knowledgeBase.ts';

describe('cqvGroundingFields', () => {
  it('a QA lesson that grounds does so in Grade 10 Mathematics, with no flag', () => {
    const lessons = getCqvLessons();
    assert.ok(lessons.length > 0);
    let grounded = 0;
    for (const l of lessons) {
      const g = resolveGeneratorGrounding(l.lessonNameAr, 'ar', { scope: CQV_SCOPE });
      const fields = cqvGroundingFields(l.lessonNameAr);
      if (g.grounded) {
        grounded += 1;
        const book = getBookForLesson(g.lesson!);
        assert.equal(book?.gradeId, 'grade-10', l.lessonNameAr);
        assert.equal(book?.subjectId, 'mathematics', l.lessonNameAr);
        assert.ok(!('grounding' in fields), `${l.lessonNameAr}: a grounded request gained the flag`);
        assert.equal(fields.additionalContext, g.context);
      } else {
        assert.equal(fields.grounding, 'none', `${l.lessonNameAr}: ungrounded without the flag`);
      }
    }
    assert.ok(grounded > lessons.length / 2, `only ${grounded} of ${lessons.length} QA lessons ground`);
  });

  it('a topic no lesson is about carries the note and the flag', () => {
    const fields = cqvGroundingFields('لو كنت وزير التربية ليوم واحد');
    assert.equal(fields.grounding, 'none');
    assert.match(fields.additionalContext, /غير موجود في المنهاج/);
  });
});
