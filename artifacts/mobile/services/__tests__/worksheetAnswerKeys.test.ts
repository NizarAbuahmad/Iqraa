/**
 * A generated worksheet never ships a blank answer key.
 *
 * `definitionAr` is often an empty string rather than absent — 8 of the 36
 * Grade 10 maths lessons have one, «المعادلة الأسية» and «قانون جيب التمام»
 * among them. `??` does not fire on `''`, so the multiple-choice factory's
 * `correct0` evaluated to the empty string, was placed among the options as the
 * *correct* one, and landed in `answerKey` as a blank entry. A teacher printing
 * that sheet got a question with no answer, and nothing failed — the worksheet
 * was structurally perfect.
 *
 * Two things shape this test:
 *
 * - **It targets the lessons that carry the defect**, found by the same
 *   condition the factories trip over, rather than sweeping all 36. A full
 *   sweep at every difficulty is ~650 generations and takes over ten minutes,
 *   which is a test nobody runs.
 * - **It repeats.** The factories pick their phrasing at random, so the
 *   affected template appeared in only about half of runs. A single pass would
 *   be a coin flip; `PASSES` makes a miss vanishingly unlikely across the set.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import { getUnitsForSubjectGrade, getLessonsForUnit } from '../knowledgeBase.ts';
import type { KBLesson } from '../knowledgeBase.ts';

const PASSES = 4;

function grade10MathLessons(): KBLesson[] {
  return getUnitsForSubjectGrade('mathematics', 'grade-10').flatMap(unit =>
    getLessonsForUnit(unit.id),
  );
}

/**
 * Lessons whose first key term has no usable Arabic definition — the exact
 * input that produced a blank key. Derived, not hard-coded: if the curriculum
 * gains or loses a definition this test follows it.
 */
function lessonsWithBlankFirstDefinition(): KBLesson[] {
  return grade10MathLessons().filter(lesson => {
    const definition = lesson.keyTerms?.[0]?.definitionAr;
    return definition !== undefined && !definition.trim();
  });
}

async function sheetFor(service: MockAIService, lesson: KBLesson, types: string[]) {
  return service.generateWorksheet({
    grade: 'الصف العاشر',
    subject: 'الرياضيات',
    topic: lesson.titleAr,
    language: 'arabic',
    difficulty: 'medium',
    numQuestions: 10,
    questionTypes: types,
    contextSource: 'curriculum',
  } as never);
}

describe('generated worksheet answer keys', () => {
  it('finds the lessons that used to produce blank keys', () => {
    // If this ever hits zero the test above stops proving anything, so say so
    // rather than passing vacuously.
    assert.ok(
      lessonsWithBlankFirstDefinition().length > 0,
      'no lesson has a blank first definition any more — this suite is now vacuous',
    );
  });

  it('are never blank on the lessons whose definitions are missing', async () => {
    const service = new MockAIService();
    const blanks: string[] = [];

    for (const lesson of lessonsWithBlankFirstDefinition()) {
      for (let pass = 0; pass < PASSES; pass += 1) {
        const sheet = await sheetFor(service, lesson, [
          'short_answer',
          'multiple_choice',
          'fill_blank',
        ]);
        for (const entry of sheet.answerKey) {
          if (!entry.answer.trim()) blanks.push(`${lesson.id} q${entry.num}`);
        }
      }
    }

    assert.deepEqual(blanks, [], `blank answer keys: ${blanks.slice(0, 8).join(', ')}`);
  });

  it('never offers a blank multiple-choice option', async () => {
    const service = new MockAIService();
    const blanks: string[] = [];

    for (const lesson of lessonsWithBlankFirstDefinition()) {
      for (let pass = 0; pass < PASSES; pass += 1) {
        const sheet = await sheetFor(service, lesson, ['multiple_choice']);
        for (const question of sheet.sections.flatMap(section => section.questions)) {
          for (const option of question.options ?? []) {
            if (!option.trim()) blanks.push(`${lesson.id}: ${question.text.slice(0, 40)}`);
          }
        }
      }
    }

    assert.deepEqual(blanks, [], `blank options: ${blanks.slice(0, 8).join(', ')}`);
  });
});
