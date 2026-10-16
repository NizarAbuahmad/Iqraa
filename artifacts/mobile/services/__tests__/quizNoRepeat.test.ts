/**
 * An offline quiz never prints the same question twice.
 *
 * Found 2026-10-15 by generating every maths and chemistry lesson: a 20-question
 * «أوتار الدائرة وأقطارها ومماساتها» quiz asked «دائرة نصف قطرها 10 سم، وفيها
 * وتر طوله 12 سم. ما بُعد الوتر عن مركز الدائرة؟» three times — twice as
 * multiple choice, once as true/false. Two causes: the duplicate check read the
 * true/false item's «الإجابة المقترحة» as part of its stem, and after twelve
 * draws that all repeated, the quiz printed the thirteenth anyway. A lesson whose
 * generator has run out of new numbers now ends that type (the paper says how
 * short it is) rather than repeating one.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import type { AIRequest, QuizOutput } from '../ai/AIService.ts';

const quiz = (topic: string, grade: string, numQuestions: number): Promise<QuizOutput> =>
  aiService.generateQuiz({
    topic, subject: 'الرياضيات', grade, language: 'arabic', totalMarks: 20, duration: 20,
    difficulty: 'medium', numQuestions, questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
  } as AIRequest);

/** The question a student reads, without the answer a true/false item proposes. */
const asked = (text: string) => text.split('\n\nالإجابة المقترحة:')[0]!.trim();

describe('an offline quiz', () => {
  for (const [topic, grade] of [
    ['أوتار الدائرة وأقطارها ومماساتها', 'الصف العاشر'],
    ['الضَّرْبُ في 2', 'الصف الثالث'],
  ] as const) {
    it(`asks each question once — ${topic}`, async () => {
      for (let run = 0; run < 2; run++) {
        const q = await quiz(topic, grade, 20);
        const stems = q.questions.map(x => asked(x.text));
        const repeated = stems.filter((s, i) => stems.indexOf(s) !== i);
        assert.deepEqual(repeated, [], `asked twice: ${repeated.join(' | ')}`);
        if (q.questions.length < 20) {
          assert.deepEqual(q.shortfall, { requested: 20, produced: q.questions.length });
        }
      }
    });
  }
});
