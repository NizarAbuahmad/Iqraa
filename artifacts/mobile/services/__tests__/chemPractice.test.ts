/**
 * A chemistry quiz must not be built from the subject-blind templates.
 *
 * This is the end-to-end half of the chemistry bank: `chemistry.test.ts` in
 * `lib/math-practice` pins the bank's own invariants, and this pins that the
 * generator actually reaches it. The two are separate because the bank cannot
 * import the knowledge base, so only this side can exercise the real
 * `isChemContext` with a resolved lesson.
 *
 * The failure it guards against is silent: before 2026-09-16 every one of
 * these produced a well-formed quiz. The questions just had nothing to do with
 * chemistry — «أيّ مما يلي يُعرِّف {الموضوع} بشكل صحيح؟» with «لا شيء مما ذُكر»
 * among the options — so nothing threw and no test failed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();

/**
 * Phrases that only the generic template list produces. Any of them in a
 * chemistry paper means the bank was not reached.
 */
const TEMPLATE_TELLS = [
  'لا شيء مما ذُكر',
  'وصف لظاهرة أخرى',
  'مفهوم يختلف عن',
  'التحليل المنهجي خطوة بخطوة',
  'لا يحتاج إلى تدريب سابق',
  'تحديد المعطيات والمطلوب بدقة',
];

const CHEM_REQ = {
  grade: '10',
  subject: 'Chemistry',
  language: 'arabic',
  difficulty: 'medium',
  totalMarks: 20,
  duration: 20,
  questionTypes: ['multiple_choice'],
} satisfies Partial<AIRequest>;

describe('a chemistry quiz draws on the chemistry bank', () => {
  const TOPICS = [
    'المول والكتلة المولية',
    'التفاعلات الكيميائية',
    'الروابط الكيميائية وأنواعها',
    'التوزيع الإلكتروني للذرات',
    'تغيرات الطاقة في التفاعلات الكيميائية',
  ];

  for (const topic of TOPICS) {
    it(`«${topic}» — no template phrasing survives`, async () => {
      const quiz = await service.generateQuiz({ ...CHEM_REQ, topic } as AIRequest);
      assert.ok(quiz.questions.length > 0, 'no questions produced');

      for (const q of quiz.questions) {
        const haystack = [q.text, ...(q.options ?? [])].join(' ');
        for (const tell of TEMPLATE_TELLS) {
          assert.ok(
            !haystack.includes(tell),
            `template question served for a chemistry lesson: «${tell}» in ${q.text}`,
          );
        }
      }
    });
  }

  it('gives a key that is one of the options, so the paper can mark itself', async () => {
    const quiz = await service.generateQuiz({
      ...CHEM_REQ,
      topic: 'المول والكتلة المولية',
    } as AIRequest);

    for (const q of quiz.questions) {
      if (!q.options?.length) continue;
      // `correctAnswer`, not `answer` — QuizQuestion renames it on the way out
      // of the factory, and the evaluation path reads this field.
      assert.ok(
        q.options.includes(q.correctAnswer),
        `key «${q.correctAnswer}» is not among the options of «${q.text}»`,
      );
    }
  });

  it('asks about chemistry, not about the topic word', async () => {
    const quiz = await service.generateQuiz({
      ...CHEM_REQ,
      topic: 'التفاعلات الكيميائية',
    } as AIRequest);

    // A bank stem carries a formula, a coefficient or a quantity. A template
    // stem is prose with the topic substituted into it and nothing else.
    const concrete = quiz.questions.filter(q => /[A-Za-z₀-₉⁰-⁹]|\d/.test(q.text));
    assert.ok(
      concrete.length > 0,
      `no question carried a formula or a number:\n${quiz.questions.map(q => q.text).join('\n')}`,
    );
  });
});

describe('the maths path is untouched', () => {
  it('still builds a maths quiz from the maths bank', async () => {
    const quiz = await service.generateQuiz({
      ...CHEM_REQ,
      subject: 'Mathematics',
      topic: 'حل المعادلات الأسية',
    } as AIRequest);

    assert.ok(quiz.questions.length > 0);
    for (const q of quiz.questions) {
      const haystack = [q.text, ...(q.options ?? [])].join(' ');
      for (const tell of TEMPLATE_TELLS) {
        assert.ok(!haystack.includes(tell), `maths fell back to a template: ${q.text}`);
      }
    }
  });

  it('leaves a subject with no bank on the templates, rather than serving chemistry', async () => {
    // Biology has no bank. The templates are the correct answer for it — the
    // wrong answer would be a chemistry item bleeding into a biology paper.
    const quiz = await service.generateQuiz({
      ...CHEM_REQ,
      subject: 'Biology',
      topic: 'الخلية ووظائفها',
    } as AIRequest);

    assert.ok(quiz.questions.length > 0);
    const text = quiz.questions.map(q => [q.text, ...(q.options ?? [])].join(' ')).join('\n');
    assert.ok(
      !/الكتلة المولية|وازن المعادلة|التوزيع الإلكتروني/.test(text),
      `a chemistry item reached a biology paper:\n${text}`,
    );
  });
});
