/**
 * The lesson a generator screen was given — tapped in its picker, or carried in
 * by a lesson page, the lesson bar or a saved material — kept for as long as
 * the topic is still that lesson's title.
 *
 * Every Grade 1 English lesson is "Vocabulary & Grammar" or "Listening &
 * Speaking", so a title found the wrong lesson for every one of them: unit 1 in
 * the picked scope, another grade's book without it (a teacher's review,
 * 2026-10-15).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import {
  buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, groundingRequestFields, resolveGeneratorGrounding,
} from '../kbContext.ts';
import { carriedLessonTopic, pickFromDetail, pickedLessonId } from '../pickedLesson.ts';

const G1_EN = { gradeId: 'grade-1', subjectId: 'english' };
const g1English = getUnitsForSubjectGrade('english', 'grade-1').flatMap(u => getLessonsForUnit(u.id));
const bag = g1English.find(l => l.id.endsWith('-u2_l1'))!;

describe('pickedLessonId', () => {
  it('keeps the picked lesson while the topic is its title', () => {
    const picked = pickFromDetail({ lessonId: bag.id, lessonTitle: bag.titleEn });
    assert.equal(pickedLessonId(picked, ' Vocabulary & Grammar ', G1_EN), bag.id);
  });

  it('drops it once the teacher types something else', () => {
    const picked = pickFromDetail({ lessonId: bag.id, lessonTitle: bag.titleEn });
    assert.equal(pickedLessonId(picked, 'Vocabulary', G1_EN), undefined);
    assert.equal(pickedLessonId(picked, '', G1_EN), undefined);
  });

  it("drops it when the pickers move to another grade or subject — never another book's lesson", () => {
    const picked = pickFromDetail({ lessonId: bag.id, lessonTitle: bag.titleEn });
    assert.equal(pickedLessonId(picked, bag.titleEn, { gradeId: 'grade-2', subjectId: 'english' }), undefined);
    assert.equal(pickedLessonId(picked, bag.titleEn, { gradeId: 'grade-1', subjectId: 'mathematics' }), undefined);
    assert.equal(pickedLessonId({ lessonId: 'kbl-nope', topic: bag.titleEn }, bag.titleEn, G1_EN), undefined);
  });

  it('holds nothing for a whole unit or book', () => {
    assert.equal(pickFromDetail({ lessonId: null, lessonTitle: 'My School Bag' }), null);
  });

  it('grounds every Grade 1 English lesson to itself, where its title alone lands on Unit 1', () => {
    let titleWouldDrift = 0;
    for (const lesson of g1English) {
      const picked = pickFromDetail({ lessonId: lesson.id, lessonTitle: lesson.titleEn });
      const lessonId = pickedLessonId(picked, lesson.titleEn, G1_EN);
      assert.equal(resolveGeneratorGrounding(lesson.titleEn, 'en', { lessonId, scope: G1_EN }).lesson?.id, lesson.id);
      if (resolveGeneratorGrounding(lesson.titleEn, 'en', { scope: G1_EN }).lesson?.id !== lesson.id) titleWouldDrift += 1;
    }
    assert.ok(titleWouldDrift >= 15, `${titleWouldDrift}`);
  });
});

// Quiz, game, lesson-flow and the classroom builder used to ground the title
// four times, once per field. The shared pool keys on these fields, so for a
// lesson the title already found they must come out byte-identical.
describe('groundingRequestFields', () => {
  it('equals the four separate lookups for every Grade 10 maths and chemistry lesson', () => {
    let checked = 0;
    for (const subjectId of ['mathematics', 'chemistry']) {
      const scope = { gradeId: 'grade-10', subjectId };
      for (const lesson of getUnitsForSubjectGrade(subjectId, 'grade-10').flatMap(u => getLessonsForUnit(u.id))) {
        const topic = lesson.titleAr.trim();
        assert.deepEqual(groundingRequestFields(resolveGeneratorGrounding(topic, 'ar', { scope })), {
          additionalContext: buildGeneratorContext(topic, 'ar', { scope }),
          unitId: generatorUnitId(topic, 'ar', scope),
          lessonId: generatorLessonId(topic, 'ar', scope),
          bookFigureCount: generatorFigureCount(topic, 'ar', scope),
        }, topic);
        checked += 1;
      }
    }
    assert.ok(checked > 40, `only ${checked} lessons`);
  });

  it('reads every field off the picked lesson, never the title', () => {
    const fields = groundingRequestFields(resolveGeneratorGrounding(bag.titleEn, 'en', { scope: G1_EN, lessonId: bag.id }));
    assert.equal(fields.lessonId, bag.id);
    assert.match(fields.additionalContext, /eraser/);
  });
});

describe('carriedLessonTopic', () => {
  it("names a carried lesson by its own title in the material's language", () => {
    assert.equal(carriedLessonTopic(bag.id, 'en'), bag.titleEn);
    assert.equal(carriedLessonTopic(bag.id, 'ar'), bag.titleAr);
    assert.equal(carriedLessonTopic('kbl-nope', 'en'), undefined);
    assert.equal(carriedLessonTopic(undefined, 'en'), undefined);
  });
});
