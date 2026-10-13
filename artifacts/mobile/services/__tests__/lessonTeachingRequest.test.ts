import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLessonById as getBrowserLessonById, getPickerGrades, getPickerSubjects } from '../curriculumData.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import {
  buildGeneratorContext,
  generatorLessonId,
  generatorUnitId,
  resolveGeneratorGrounding,
} from '../kbContext.ts';
import { buildLessonTeachingRequest } from '../generatorRequests.ts';
import { regenerationFields } from '../ai/regeneration.ts';

const grade = getPickerGrades().find(g => g.nameAr === 'الصف العاشر')!;
const subject = getPickerSubjects().find(s => s.name === 'Mathematics')!;

function* grade10MathTopics(): Generator<string> {
  for (const unit of getUnitsForSubjectGrade(subject.id, grade.id)) {
    for (const lesson of getLessonsForUnit(unit.id)) yield lesson.titleAr.trim();
  }
}

// The pool reuses a stored artifact only when the whole request hashes the
// same. Slides Maker used to build this body inline; the builder replaced it,
// so any difference here silently orphans every explanation teachers have
// already stored.
test('the builder sends exactly what Slides Maker used to build inline', () => {
  let checked = 0;
  for (const topic of grade10MathTopics()) {
    const legacy = {
      grade: grade.nameAr,
      subject: subject.name,
      topic,
      language: 'arabic',
      additionalContext: buildGeneratorContext(topic, 'ar'),
      unitId: generatorUnitId(topic, 'ar'),
      lessonId: generatorLessonId(topic, 'ar'),
      contextSource: 'curriculum',
    };
    const built = buildLessonTeachingRequest(
      { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' },
      resolveGeneratorGrounding(topic, 'ar'),
    );
    assert.deepEqual(built, legacy, topic);
    checked++;
  }
  assert.ok(checked >= 20, `expected a real lesson list, got ${checked}`);
});

test('regeneration fields are merged last, as the screen spread them', () => {
  const topic = [...grade10MathTopics()][0]!;
  const grounding = resolveGeneratorGrounding(topic, 'ar');
  const form = { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' as const };
  const regen = regenerationFields(true, undefined);
  const plain = buildLessonTeachingRequest(form, grounding);
  assert.deepEqual(buildLessonTeachingRequest(form, grounding, regen), { ...plain, ...regen });
});

test('an English request is keyed English and carries the same lesson id', () => {
  const topic = [...grade10MathTopics()][0]!;
  const ar = buildLessonTeachingRequest(
    { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' },
    resolveGeneratorGrounding(topic, 'ar'),
  );
  const en = buildLessonTeachingRequest(
    { gradeName: grade.name, subjectName: subject.name, topic, lang: 'en' },
    resolveGeneratorGrounding(topic, 'en'),
  );
  assert.equal(en.language, 'english');
  assert.equal(ar.language, 'arabic');
});

// The student endpoint looks rows up by the id the lesson page holds
// (`getLessonById` from the curriculum browser) while the pool stores the id
// the generator grounded to (the KB's). They must be one id space.
test('a KB lesson id resolves through the curriculum browser the lesson page uses', () => {
  for (const topic of grade10MathTopics()) {
    const id = resolveGeneratorGrounding(topic, 'ar').lesson?.id;
    if (!id) continue;
    assert.equal(getBrowserLessonById(id)?.id, id, topic);
  }
});
