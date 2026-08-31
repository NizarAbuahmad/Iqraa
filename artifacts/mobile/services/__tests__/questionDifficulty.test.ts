/**
 * The difficulty picker has to change the questions, not just a label.
 *
 * Before this suite existed, `req.difficulty` was never read by
 * `generateWorksheet` or `generateQuiz`, and the six quiz factories passed the
 * literal `'medium'` — so on the math path an "easy" quiz and a "difficult"
 * quiz drew from the identical medium slice of the concrete bank, and on the
 * non-math path the tier reached only the points number. Both screens showed
 * the picker and both sent the value.
 *
 * Nothing invoked these two generators at all before now; the only references
 * in the suite were stubs in `lessonFlowRunner.test.ts`.
 *
 * Asserting "the outputs differ" would NOT catch a regression here: templates
 * are picked at random, so three tiers produce three different papers even
 * when difficulty is ignored entirely — that is exactly what the measurement
 * showed before the fix. These tests assert tier MEMBERSHIP instead: a
 * question tagged `hard` must never appear on an easy-only paper.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import type { AIRequest, QuizOutput, WorksheetOutput } from '@/services/ai/AIService.ts';

/** A chemistry lesson, so the template path is exercised rather than the
 *  concrete math bank — the two take different routes through the factories. */
const CHEM = { topic: 'الروابط الأيونية', subject: 'الكيمياء', grade: 'الصف العاشر' };
/**
 * An exponential-equations lesson, not «قانون الجيوب».
 *
 * `detectMathFamily` maps the sine rule to `trig_apps`, which holds exactly one
 * bank item per tier — so a six-question quiz exhausts it and
 * `takeConcreteMath` falls back across tiers by design, making easy and hard
 * legitimately overlap. `exp_eq` has 6 easy / 6 medium / 5 hard, enough to see
 * the tier actually being honoured.
 */
const MATH = { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر' };

/**
 * Phrases that only appear in templates tagged `hard` (comparison and
 * analysis stems). If one shows up on an easy-only paper, the tier is being
 * ignored.
 */
const HARD_ONLY_AR = ['ما الفرق الرئيسي بين', 'قارن بين', 'جميع مسائل'];
/** Likewise for templates tagged `easy` — plain definition/recall stems. */
const EASY_ONLY_AR = ['يُعرِّف', 'اشرح بأسلوبك الخاص'];

const worksheetText = (w: WorksheetOutput) =>
  w.sections.flatMap(s => s.questions.map(q => q.text)).join('\n');
const quizText = (q: QuizOutput) => q.questions.map(x => x.text).join('\n');

async function worksheet(base: typeof CHEM, difficulty: AIRequest['difficulty']) {
  return aiService.generateWorksheet({
    ...base, language: 'arabic', difficulty, numQuestions: 8,
    questionTypes: ['multiple_choice', 'short_answer', 'true_false'],
  } as AIRequest);
}

async function quiz(base: typeof CHEM, difficulty: AIRequest['difficulty']) {
  return aiService.generateQuiz({
    ...base, language: 'arabic', difficulty, totalMarks: 20, duration: 20,
    questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
  } as AIRequest);
}

describe('quiz difficulty selects the tier', () => {
  it('an easy quiz never serves a hard-tier question', async () => {
    // Sampled: one paper could miss a hard template by chance even when the
    // tier is ignored. Across many papers it cannot.
    for (let i = 0; i < 12; i++) {
      const text = quizText(await quiz(CHEM, 'easy'));
      for (const phrase of HARD_ONLY_AR) {
        assert.ok(!text.includes(phrase), `easy quiz contained hard-tier stem «${phrase}»:\n${text}`);
      }
    }
  });

  it('a hard quiz never serves an easy-tier question', async () => {
    for (let i = 0; i < 12; i++) {
      const text = quizText(await quiz(CHEM, 'hard'));
      for (const phrase of EASY_ONLY_AR) {
        assert.ok(!text.includes(phrase), `hard quiz contained easy-tier stem «${phrase}»:\n${text}`);
      }
    }
  });

  it('a hard quiz does reach hard-tier questions at all', async () => {
    // Guards the opposite failure: a tier filter that matches nothing and
    // silently falls back would pass the two tests above.
    const texts: string[] = [];
    for (let i = 0; i < 12; i++) texts.push(quizText(await quiz(CHEM, 'hard')));
    const all = texts.join('\n');
    assert.ok(
      HARD_ONLY_AR.some(p => all.includes(p)),
      `no hard-tier stem appeared across 12 hard quizzes:\n${all}`,
    );
  });

  it('on a math lesson, easy and hard draw different bank items', async () => {
    // The regression that mattered most: the quiz factories hard-coded
    // 'medium', and `takeConcreteMath` filters the bank by `item.diff`, so
    // both tiers drew the identical medium slice.
    //
    // One question type only, so the request stays inside the family's
    // per-tier supply and any overlap means the tier was ignored rather than
    // exhausted.
    const one = (difficulty: AIRequest['difficulty']) => aiService.generateQuiz({
      ...MATH, language: 'arabic', difficulty, totalMarks: 10, duration: 15,
      questionTypes: ['multiple_choice'],
    } as AIRequest);

    const easy = new Set<string>();
    const hard = new Set<string>();
    for (let i = 0; i < 8; i++) {
      (await one('easy')).questions.forEach(q => easy.add(q.text));
      (await one('hard')).questions.forEach(q => hard.add(q.text));
    }
    assert.ok(easy.size > 0 && hard.size > 0, 'no math items drawn at all');
    const overlap = [...easy].filter(t => hard.has(t));
    assert.ok(
      overlap.length === 0,
      `easy and hard math quizzes shared ${overlap.length} item(s): ${overlap.slice(0, 3).join(' / ')}`,
    );
  });

  it('mixed spreads tiers across the paper rather than collapsing to medium', async () => {
    const texts: string[] = [];
    for (let i = 0; i < 12; i++) texts.push(quizText(await quiz(CHEM, 'mixed')));
    const all = texts.join('\n');
    assert.ok(HARD_ONLY_AR.some(p => all.includes(p)), 'mixed never produced a hard-tier question');
    assert.ok(EASY_ONLY_AR.some(p => all.includes(p)), 'mixed never produced an easy-tier question');
  });
});

describe('worksheet difficulty shifts the band, keeping the progression', () => {
  const TIER_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

  it('bucket difficulty never decreases across the three sections', async () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const w = await worksheet(CHEM, difficulty);
      const main = w.sections.filter(s => /تمهيدية|صفية|تحدٍّ/.test(s.title));
      assert.equal(main.length, 3, `expected three main sections, got ${main.length}`);
      const tiers = main.map(s => {
        const m = /\((سهل|متوسط|أصعب)\)/.exec(s.title);
        assert.ok(m, `section title does not name its tier: ${s.title}`);
        return { 'سهل': 0, 'متوسط': 1, 'أصعب': 2 }[m![1] as 'سهل'];
      });
      assert.deepEqual(
        [...tiers].sort((a, b) => a - b), tiers,
        `${difficulty}: progression is not non-decreasing — ${main.map(s => s.title).join(' | ')}`,
      );
    }
  });

  it('the requested tier moves the band, and the titles say so', async () => {
    const easy = await worksheet(CHEM, 'easy');
    const hard = await worksheet(CHEM, 'hard');
    const titles = (w: WorksheetOutput) => w.sections.map(s => s.title).join(' | ');
    assert.notEqual(titles(easy), titles(hard), 'section titles identical across easy and hard');
    // The old bug: a "hard" worksheet still headed its first section «سهل».
    assert.ok(!/تمهيدية \(سهل\)/.test(titles(hard)), `hard worksheet still opens with an easy section: ${titles(hard)}`);
    assert.ok(!/تحدٍّ سريع \(أصعب\)/.test(titles(easy)), `easy worksheet still ends with a hard section: ${titles(easy)}`);
  });

  it('an easy worksheet never serves a hard-tier question', async () => {
    for (let i = 0; i < 8; i++) {
      const text = worksheetText(await worksheet(CHEM, 'easy'));
      for (const phrase of HARD_ONLY_AR) {
        assert.ok(!text.includes(phrase), `easy worksheet contained hard-tier stem «${phrase}»`);
      }
    }
  });
});

describe('a section names the question types it actually holds', () => {
  /**
   * `WorksheetQuestion` carries no `type` field, so read the shape off the
   * question: true/false is a two-option «صح»/«خطأ», multiple choice has more
   * than two options, anything with a blank run is a fill-in, and the rest is
   * short answer.
   */
  const shapeOf = (q: { text: string; options?: string[] }): string => {
    if (q.options && q.options.length === 2) return 'true_false';
    if (q.options && q.options.length > 2) return 'multiple_choice';
    if (/_{4,}/.test(q.text)) return 'fill_blank';
    return 'short_answer';
  };

  it('reports mixed rather than whichever question came last', async () => {
    const w = await worksheet(CHEM, 'medium');
    const main = w.sections.filter(s => /تمهيدية|صفية|تحدٍّ/.test(s.title));
    assert.ok(main.length > 0, 'no main sections generated');
    let sawMixed = false;
    for (const section of main) {
      const shapes = new Set(section.questions.map(shapeOf));
      if (shapes.size > 1) {
        sawMixed = true;
        assert.equal(
          section.type, 'mixed',
          `section "${section.title}" holds ${[...shapes].join('+')} but reports ${section.type}`,
        );
      }
    }
    // Three types were requested across buckets of 2/4/2, so at least one
    // section must be mixed — otherwise this test proves nothing.
    assert.ok(sawMixed, 'expected at least one mixed section with three types requested');
  });

  it('a single-type request produces single-type sections, not mixed', async () => {
    const w = await aiService.generateWorksheet({
      ...CHEM, language: 'arabic', difficulty: 'medium', numQuestions: 8,
      questionTypes: ['multiple_choice'],
    } as AIRequest);
    for (const section of w.sections.filter(s => /تمهيدية|صفية|تحدٍّ/.test(s.title))) {
      assert.equal(section.type, 'multiple_choice', `section "${section.title}" reported ${section.type}`);
    }
  });
});
