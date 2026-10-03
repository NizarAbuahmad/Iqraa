/**
 * A quiz is one paper read top to bottom, so a question served twice is the
 * same question printed twice. The worksheet generator already forbids repeats
 * (`allowRepeat: false`); the quiz factories did not, and measured across every
 * maths and chemistry lesson, 84% of chemistry quizzes and 10% of maths quizzes
 * carried a repeated stem — 100% for the small families, worst case three
 * distinct questions out of six.
 *
 * Lessons are picked by FAMILY rather than by id, so the test keeps testing the
 * small families if a catalog renumbers or a lesson moves.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import { KB_LESSONS, getBookForLesson, getUnitForLesson } from '../knowledgeBase.ts';
import { detectMathFamily } from '../ai/mathPractice.ts';
import { detectChemFamily } from '../ai/chemPractice.ts';

const svc = new MockAIService();
// The mock sleeps 1–2s per call to imitate a network; irrelevant to this.
(svc as unknown as { delay: () => Promise<void> }).delay = async () => {};

const norm = (s: string) =>
  s.replace(/\n\n(?:الإجابة|Answer|مساحة العمل|Work space)[\s\S]*$/u, '').replace(/\s+/g, ' ').trim();

const SUBJECT: Record<string, string> = { mathematics: 'Mathematics', chemistry: 'Chemistry' };

function lessonIn(subjectId: 'mathematics' | 'chemistry', family: string) {
  const hit = KB_LESSONS.find(l => {
    if (getBookForLesson(l)?.subjectId !== subjectId) return false;
    const f = subjectId === 'chemistry'
      ? detectChemFamily(`${l.titleAr} ${l.id}`)
      : detectMathFamily(l.titleAr, l);
    return f === family;
  });
  assert.ok(hit, `no ${subjectId} lesson resolves to family «${family}» — the catalog changed`);
  return hit;
}

const request = (lesson: (typeof KB_LESSONS)[number], numQuestions?: number) => ({
  grade: 'Grade 10',
  subject: SUBJECT[getBookForLesson(lesson)!.subjectId]!,
  topic: lesson.titleAr,
  language: 'arabic' as const,
  lessonId: lesson.id,
  unitId: getUnitForLesson(lesson)?.id,
  numQuestions,
});

// The small families were the worst offenders; `algebra` is the large pool that
// never repeated, kept as the control that the fix did not break it.
const CASES: Array<['mathematics' | 'chemistry', string]> = [
  ['mathematics', 'trig_apps'],
  ['mathematics', 'functions'],
  ['mathematics', 'vectors'],
  ['mathematics', 'stats'],
  ['mathematics', 'circle'],
  ['mathematics', 'algebra'],
  ['chemistry', 'thermochem'],
  ['chemistry', 'redox'],
  ['chemistry', 'bonding'],
];

describe('a quiz never prints the same question twice', () => {
  for (const [subjectId, family] of CASES) {
    it(`${subjectId} / ${family}`, async () => {
      const lesson = lessonIn(subjectId, family);
      // The generator is random and a repeat is a matter of which items get
      // drawn, so one clean quiz proves little. 12 draws each.
      for (let i = 0; i < 12; i++) {
        const quiz = await svc.generateQuiz(request(lesson) as never);
        const stems = quiz.questions.map(q => norm(q.text));
        assert.equal(
          new Set(stems).size, stems.length,
          `draw ${i} repeated a stem in «${lesson.titleAr}»:\n${stems.join('\n')}`,
        );
      }
    });
  }

  it('still delivers the number of questions that was asked for', async () => {
    // The trade for no repeats is a topic-template question in a spent
    // family's slot — never a shorter quiz.
    const lesson = lessonIn('mathematics', 'trig_apps');
    for (const n of [4, 6, 8, 10]) {
      const quiz = await svc.generateQuiz(request(lesson, n) as never);
      assert.equal(quiz.questions.length, n, `asked for ${n}`);
    }
  });

  it('keeps the points summing to the total, as before', async () => {
    const lesson = lessonIn('chemistry', 'redox');
    const quiz = await svc.generateQuiz(request(lesson) as never);
    assert.equal(
      quiz.questions.reduce((s, q) => s + q.points, 0), quiz.totalPoints,
    );
  });
});

describe('a worksheet still never prints the same question twice (#595)', () => {
  // Guard for the sibling fix this one mirrors: if the worksheet's
  // `allowRepeat: false` is ever dropped, this is the test that says so.
  for (const [subjectId, family] of [
    ['mathematics', 'trig_apps'], ['chemistry', 'thermochem'],
  ] as const) {
    it(`${subjectId} / ${family}`, async () => {
      const lesson = lessonIn(subjectId, family);
      for (let i = 0; i < 12; i++) {
        const ws = await svc.generateWorksheet(request(lesson) as never);
        const stems = ws.sections.flatMap(s => s.questions.map(q => norm(q.text)));
        assert.equal(new Set(stems).size, stems.length, `draw ${i}:\n${stems.join('\n')}`);
      }
    });
  }
});
