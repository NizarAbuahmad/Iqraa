import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lessonHasNoSubstance, resolveGeneratorGrounding } from '../kbContext.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';

// A teacher reported a Grade 4 Arabic worksheet for «السلام الملكي» as not matching
// its lesson. The model was sent the title and a template sentence, nothing else,
// and wrote a passage of its own. 681 of 3,381 lessons are in that state.
const ANTHEM = 'kbl-g4-arabic-s1-nccd-u3_l3';
const ctx = (id: string, lang: 'ar' | 'en' = 'ar', teacherObjectives?: string) => {
  const l = getLessonById(id)!;
  return resolveGeneratorGrounding(lang === 'ar' ? l.titleAr : l.titleEn, lang, { lessonId: id, teacherObjectives }).context;
};

describe('a lesson with nothing but a title says so', () => {
  it('knows the anthem lesson has no substance', () => {
    assert.equal(lessonHasNoSubstance(getLessonById(ANTHEM)!), true);
  });

  it('tells the model not to write a text and pass it off as the book\'s', () => {
    assert.match(ctx(ANTHEM), /تنبيه: نص هذا الدرس ونتاجاته غير متوفّرين/);
    assert.match(ctx(ANTHEM), /لا تؤلّف نصًّا/);
    assert.match(ctx(ANTHEM, 'en'), /not available/i);
  });

  it('adds nothing to a lesson that has outcomes or concepts', () => {
    const rich = 'kbl-g5-science-s1-nccd-u4_l1'; // concepts, a one-line summary
    assert.equal(lessonHasNoSubstance(getLessonById(rich)!), false);
    assert.doesNotMatch(ctx(rich), /غير متوفّرين/);
  });

  it('a teacher\'s own objectives are substance', () => {
    assert.doesNotMatch(ctx(ANTHEM, 'ar', 'أن يقرأ الطالب النشيد قراءة سليمة'), /غير متوفّرين/);
  });

  it('never touches the core lessons (Grade 10 maths and chemistry)', () => {
    const core = (KB_LESSONS as { id: string }[]).filter(l => {
      const b = getBookForLesson(l as never);
      return b?.gradeId === 'grade-10' && (b.subjectId === 'mathematics' || b.subjectId === 'chemistry');
    });
    assert.ok(core.length > 20, 'found the core lessons');
    assert.deepEqual(core.filter(l => lessonHasNoSubstance(l as never)).map(l => l.id), []);
  });
});
