import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLessonById } from '../knowledgeBase.ts';
import { keyTermsField, resolveGeneratorGrounding, scienceKeyTerms } from '../kbContext.ts';
import { buildLessonTeachingRequest, buildWorksheetRequest } from '../generatorRequests.ts';

const WAVES = 'kbl-phys-s2-nccd-u6_l2';
const PROJECTILES = 'kbl-phys-s1-nccd-u2_l2';
const SPECTRUM = 'kbl-chem-s1-nccd-u1_l1';
const MATH = 'kbl-math-s1-nccd-u1_l1';

test('physics sends its book vocabulary, in the content language', () => {
  assert.deepEqual(scienceKeyTerms(getLessonById(PROJECTILES), 'ar'),
    ['المقذوفات', 'أقصى ارتفاع', 'زمن التحليق', 'المدى الأفقي', 'حركة دائرية منتظمة', 'تسارع مركزي']);
  assert.deepEqual(scienceKeyTerms(getLessonById(WAVES), 'en')?.slice(0, 2), ['Wave Reflection', 'Wave Refraction']);
});

test('chemistry sends its terms too', () => {
  assert.ok((scienceKeyTerms(getLessonById(SPECTRUM), 'ar') ?? []).includes('الطيف الذري'));
});

test('maths, no lesson, or a lesson without terms sends nothing', () => {
  assert.equal(scienceKeyTerms(getLessonById(MATH), 'ar'), undefined);
  assert.equal(scienceKeyTerms(null, 'ar'), undefined);
  assert.deepEqual(keyTermsField(undefined), {});
  assert.deepEqual(keyTermsField(['حيود']), { keyTerms: ['حيود'] });
});

const physicsGrounding = () =>
  resolveGeneratorGrounding('خصائص الحركة الموجية', 'ar', { scope: { gradeId: 'grade-10', subjectId: 'physics' }, lessonId: WAVES });

test('the worksheet / homework request carries them', () => {
  const req = buildWorksheetRequest({
    gradeName: 'الصف العاشر', subjectName: 'Physics', topic: 'خصائص الحركة الموجية', lang: 'ar',
    difficulty: 'medium', numQuestions: 8, questionTypes: ['short_answer'], includePriorReview: false,
  }, physicsGrounding());
  assert.equal(req.lessonId, WAVES);
  assert.equal(req.keyTerms?.length, 7);
});

test('the slides explanation request carries them', () => {
  const req = buildLessonTeachingRequest({ gradeName: 'الصف العاشر', subjectName: 'Physics', topic: 'خصائص الحركة الموجية', lang: 'ar' }, physicsGrounding());
  assert.ok(req.keyTerms?.includes('تأثير دوبلر'));
});
