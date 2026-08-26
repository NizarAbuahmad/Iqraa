/**
 * The lesson the teacher picks is the lesson they get.
 *
 *   node --experimental-strip-types --test artifacts/mobile/services/__tests__/lessonPickFidelity.test.ts
 *
 * The reported bug: change the lesson in chat, pick a different subject, press
 * «ابدأ الحصة» — and the projector shows the previous selection. Two
 * independent causes, one test file:
 *
 *  1. The change-lesson sheet threw away the KB id it had and re-derived the
 *     lesson by searching the KB for its title. For a whole set of titles the
 *     top hit is a *neighbouring* lesson, so the pick silently moved.
 *  2. «ابدأ الحصة» built its deck without a subject, and `buildClassDeck`
 *     defaults to Mathematics. `isMathContext` reads that subject name, so a
 *     chemistry lesson was served maths questions from the concrete bank.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCurrentLessonView,
  pinLesson,
  resolvePickedLesson,
  seedDefaultLessonMemory,
} from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';
import {
  getBookForLesson,
  getLessonById,
  getLessonsForUnit,
  getUnitsForSubjectGrade,
  searchKBSemantic,
} from '../knowledgeBase.ts';
import { getPickerSubjects } from '../curriculumData.ts';
import { MockAIService } from '../ai/generators.ts';

const CHEM_LESSON = 'kbl-chem-s1-nccd-u1_lab';   // تجربة استهلالية: الطيف الذري
const MATH_LESSON = 'kbl-math-s2-nccd-u5_l3';    // تركيب الاقترانات (demo default)

/** Every lesson the chat's change-lesson sheet can offer, with its subject. */
function pickerLessons(): { lessonId: string; titleAr: string; subjectId: string }[] {
  const out: { lessonId: string; titleAr: string; subjectId: string }[] = [];
  for (const subject of getPickerSubjects()) {
    for (const unit of getUnitsForSubjectGrade(subject.id, 'grade-10')) {
      for (const lesson of getLessonsForUnit(unit.id)) {
        out.push({ lessonId: lesson.id, titleAr: lesson.titleAr, subjectId: subject.id });
      }
    }
  }
  return out;
}

describe('resolvePickedLesson', () => {
  it('returns the lesson the picker actually reported', () => {
    const lesson = resolvePickedLesson('تجربة استهلالية: الطيف الذري', { lessonId: CHEM_LESSON }, 'ar');
    assert.equal(lesson?.id, CHEM_LESSON);
  });

  it('resolves every picker lesson to itself — the title search does not', () => {
    const drifted: string[] = [];
    for (const entry of pickerLessons()) {
      const byId = resolvePickedLesson(entry.titleAr, { lessonId: entry.lessonId }, 'ar');
      assert.equal(byId?.id, entry.lessonId, `id-based pick moved for «${entry.titleAr}»`);
      if (searchKBSemantic(entry.titleAr, 'ar')[0]?.id !== entry.lessonId) drifted.push(entry.titleAr);
    }
    // Guards the reason the id is threaded through at all: were the title
    // search enough, this list would be empty and the fix pointless.
    assert.ok(
      drifted.length > 0,
      'expected at least one title whose top KB hit is a different lesson',
    );
  });

  it('falls back to the KB search when there is no id (entire-unit, free text)', () => {
    const lesson = resolvePickedLesson('تركيب الاقترانات', undefined, 'ar');
    assert.equal(lesson?.id, MATH_LESSON);
  });

  it('ignores an id the KB does not know and searches instead', () => {
    const lesson = resolvePickedLesson('تركيب الاقترانات', { lessonId: 'kbl-nope' }, 'ar');
    assert.equal(lesson?.id, MATH_LESSON);
  });

  it('returns null for an empty topic with no id', () => {
    assert.equal(resolvePickedLesson('   ', undefined, 'ar'), null);
  });
});

describe('buildCurrentLessonView subject', () => {
  it('reports the active lesson’s own subject, not the maths default', () => {
    const seeded = seedDefaultLessonMemory(emptyChatSessionMemory());
    const chem = getLessonById(CHEM_LESSON)!;
    const view = buildCurrentLessonView(pinLesson(seeded, chem, 'hard'), [], 'ar');
    assert.equal(view?.subjectId, 'chemistry');
    assert.equal(view?.subjectName, 'Chemistry');
    assert.equal(view?.lessonId, CHEM_LESSON);
    assert.equal(view?.topic, chem.titleAr);
  });

  it('still reports maths for a maths lesson', () => {
    const seeded = seedDefaultLessonMemory(emptyChatSessionMemory());
    const view = buildCurrentLessonView(seeded, [], 'ar');
    assert.equal(view?.subjectId, 'mathematics');
    assert.equal(view?.subjectName, 'Mathematics');
  });

  it('follows the lesson when the teacher switches subject mid-session', () => {
    const seeded = seedDefaultLessonMemory(emptyChatSessionMemory());
    const before = buildCurrentLessonView(seeded, [], 'ar');
    const after = buildCurrentLessonView(
      pinLesson(seeded, getLessonById(CHEM_LESSON)!, 'hard'),
      [],
      'ar',
    );
    assert.equal(before?.subjectId, 'mathematics');
    assert.equal(after?.subjectId, 'chemistry');
    assert.notEqual(after?.topic, before?.topic);
  });

  it('every picker lesson reports the subject it was picked under', () => {
    const seeded = seedDefaultLessonMemory(emptyChatSessionMemory());
    for (const entry of pickerLessons()) {
      const lesson = getLessonById(entry.lessonId)!;
      const view = buildCurrentLessonView(pinLesson(seeded, lesson, 'hard'), [], 'ar');
      assert.equal(view?.subjectId, entry.subjectId, `wrong subject for «${entry.titleAr}»`);
      assert.equal(getBookForLesson(lesson)?.subjectId, entry.subjectId);
    }
  });
});

describe('the subject a deck is generated under', () => {
  const questionText = (a: { slides: { type: string; content: string }[] }) =>
    a.slides.filter(s => s.type === 'question').map(s => s.content).join('\n');

  // Why the wrong subject was visible rather than cosmetic: the generator
  // branches on it. Announce a chemistry lesson as Mathematics and the class
  // used to get algebra questions with the chemistry title on top.
  //
  // `isMathContext` now derives the subject from the topic's own KB lesson
  // first (`getBookForLesson(kb)?.subjectId`) rather than trusting a
  // caller-supplied subject string that may disagree with it — a mislabelled
  // subject can no longer override a lesson's real one.
  it('never serves math content for a topic that resolves to a real chemistry lesson, even mislabelled', async () => {
    const svc = new MockAIService();
    const req = {
      grade: '10',
      topic: 'تجربة استهلالية: الطيف الذري', // a real chemistry KB lesson
      activityType: 'quick-check',
      duration: 15,
      difficulty: 'standard',
      groupType: 'whole-class',
      teachingGoal: 'warm-up',
      language: 'arabic',
    } as const;

    const mislabelledAsMaths = await svc.generateClassroomActivity({ ...req, subject: 'Mathematics' } as any);
    const asChem = await svc.generateClassroomActivity({ ...req, subject: 'Chemistry' } as any);

    assert.doesNotMatch(questionText(mislabelledAsMaths), /y\s*=|x²/);
    assert.doesNotMatch(questionText(asChem), /y\s*=|x²/);
  });

  // No KB lesson exists to derive a subject from, so the caller-supplied
  // subject is the only signal left — this is the path that must keep
  // branching on `subject`, unlike the case above.
  it('falls back to the caller-supplied subject when the topic matches no KB lesson', async () => {
    const svc = new MockAIService();
    const req = {
      grade: '10',
      topic: 'موضوع حر غير موجود في المنهج',
      activityType: 'quick-check',
      duration: 15,
      difficulty: 'standard',
      groupType: 'whole-class',
      teachingGoal: 'warm-up',
      language: 'arabic',
    } as const;

    const asMaths = await svc.generateClassroomActivity({ ...req, subject: 'Mathematics' } as any);
    const asChem = await svc.generateClassroomActivity({ ...req, subject: 'Chemistry' } as any);

    // The maths reading pulls x/y algebra items a chemistry-labelled request never gets.
    assert.match(questionText(asMaths), /y\s*=|x²/);
    assert.doesNotMatch(questionText(asChem), /y\s*=|x²/);
  });
});
