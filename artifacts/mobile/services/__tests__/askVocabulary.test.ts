/**
 * The words teachers use for each material, through both places the chat reads
 * them: the intent router and the teaching assistant. Measured 2026-09-28, 41
 * of these 63 asks were not recognised as the material they name.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyChatIntent } from '../ai/intentRouter.ts';
import { artifactFromQuery } from '../ai/teachingAssistant.ts';
import { buildLessonSuggestions, mergeScopeReply, ordinalChoice, pinLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';
import { getLessonById } from '../knowledgeBase.ts';

const ASKS: Record<string, string[]> = {
  'lesson-plan': [
    'خطة', 'خطة درس', 'خطة الدرس', 'حضر خطة', 'حضّر خطة الدرس', 'جهز لي خطة', 'بدي خطة',
    'أريد خطة دراسية', 'خطة تدريس', 'خطة يومية', 'تحضير درس', 'تحضير', 'حضّر الدرس', 'جهز الدرس',
    'lesson plan', 'study plan', 'teaching plan', 'plan', 'make a plan', 'prepare the lesson',
    'prepare a lesson', 'daily plan', 'give me study plan for english', 'حضّر خطة الدرس للعربي',
  ],
  worksheet: [
    'ورقة عمل', 'ورقه عمل', 'اوراق عمل', 'أوراق عمل', 'تمارين', 'ورقة تمارين',
    'worksheet', 'exercises', 'practice sheet', 'practice',
  ],
  quiz: [
    'اختبار', 'اختبار قصير', 'امتحان', 'كويز', 'أسئلة', 'اسئلة', 'بنك أسئلة',
    'quiz', 'test', 'exam', 'questions', 'quiz on the business plan',
  ],
  homework: ['واجب', 'واجب بيتي', 'واجب منزلي', 'وظيفة', 'وظيفة بيتية', 'homework', 'assignment'],
  activity: ['نشاط', 'نشاط صفي', 'لعبة', 'لعبة تعليمية', 'activity', 'game', 'class activity'],
};

// Material words used about content, not as an ask.
const NOT_ASKS = [
  'ما وظيفة الكبد؟', 'ما هي خطة التنمية؟', 'what is a test tube', 'تمارين محلولة',
  'how do I explain fractions?', 'مرحبا', 'الصف العاشر',
];

const langOf = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en') as 'ar' | 'en';

describe('every phrasing of a material is that material', () => {
  for (const [want, qs] of Object.entries(ASKS)) {
    for (const q of qs) {
      it(`${want}: ${JSON.stringify(q)}`, () => {
        assert.equal(classifyChatIntent(q, langOf(q)).intent, 'artifact');
        assert.equal(artifactFromQuery(q), want);
      });
    }
  }
});

describe('material words about content are not an ask', () => {
  for (const q of NOT_ASKS) {
    it(JSON.stringify(q), () => {
      assert.equal(artifactFromQuery(q), null);
      assert.notEqual(classifyChatIntent(q, langOf(q)).intent, 'artifact');
    });
  }
});

// Reported 2026-09-28: «حضّر خطة الدرس للعربي» → «أي درس من اللغة العربية
// للصف الرابع؟» → «الصف العاشر» → «وضّح لي أكثر…». The answer lost the ask.
describe('an answer to "which lesson?" joins the ask', () => {
  const ask = 'حضّر خطة الدرس للعربي';

  it('a grade joins, and replaces a grade the ask named', () => {
    assert.equal(mergeScopeReply(ask, 'الصف العاشر'), `${ask} الصف العاشر`);
    assert.equal(mergeScopeReply('study plan for english for grade 4', 'grade 10'), 'study plan for english grade 10');
  });

  it('a lesson title or a repeat of the ask joins', () => {
    assert.equal(mergeScopeReply(ask, 'الجملة الاسمية'), `${ask} الجملة الاسمية`);
    assert.equal(mergeScopeReply(ask, 'خطة درس'), `${ask} خطة درس`);
  });

  it('a new ask, a topic switch or another subject stands alone', () => {
    assert.equal(mergeScopeReply(ask, 'اختبار عن الكسور في الرياضيات'), 'اختبار عن الكسور في الرياضيات');
    assert.equal(mergeScopeReply(ask, 'خلينا نتكلم عن الأحياء'), 'خلينا نتكلم عن الأحياء');
    assert.equal(mergeScopeReply(ask, 'english'), 'english');
  });

  it('nothing pending leaves the message alone', () => {
    assert.equal(mergeScopeReply(null, 'الصف العاشر'), 'الصف العاشر');
  });

  // Found 2026-10-02: with «جهّز اختباراً قصيراً» pending, «اشرح لي المشتقات»
  // was glued onto it and classified as an artifact — the teacher asked for an
  // explanation and got a quiz. Only a scope fragment (a grade, a subject, a
  // lesson title, an ordinal) answers the question; a question of its own,
  // an explain ask, or small talk is a new turn.
  it('a question, an explain ask, or small talk stands alone', () => {
    const pending = 'جهّز اختباراً قصيراً';
    for (const r of [
      'اشرح لي المشتقات',
      'ما هو الاقتران العكسي؟',
      'كيف أدير صفاً مزعجاً؟',
      'explain derivatives',
      'شكراً',
      'اجعله أبسط',
      // A question about the assistant itself is never a scope fragment.
      'من انت',
      'ماذا تستطيع ان تفعل',
      'what can you do',
    ]) {
      assert.equal(mergeScopeReply(pending, r), r);
    }
  });
});

// Reported 2026-09-28: «أي درس من اللغة العربية للصف العاشر؟» → «الثاني» →
// «وضّح لي أكثر». A bare ordinal answers the question with the nth option.
describe('an ordinal picks the offered lesson', () => {
  const cases: Array<[string, number | null]> = [
    ['الثاني', 2], ['الأول', 1], ['الاول', 1], ['الدرس الثالث', 3], ['رقم ٢', 2], ['2', 2],
    ['second', 2], ['the second one', 2], ['2nd', 2], ['الرابع', 4],
    ['الصف الثاني', null], ['الجملة الاسمية', null], ['خطة درس', null],
  ];
  for (const [reply, want] of cases) {
    it(JSON.stringify(reply), () => assert.equal(ordinalChoice(reply), want));
  }
});

// Found 2026-10-06: the chat's own create chips ask «جهّز اختباراً قصيراً عن: …»
// and «أنشئ واجباً منزلياً عن: …». `normaliseAsk` strips the tanween, leaving
// «اختبارا» — and the word-end guard read that accusative alif as more word,
// so the chip the chat offered for a quiz got a prose answer instead of one.
describe('every create chip the chat offers asks for its own material', () => {
  const lesson = getLessonById('kbl-math-s2-nccd-u5_l4')!;
  const memory = pinLesson(emptyChatSessionMemory(), lesson, 'hard');
  const all = ['lesson-plan', 'worksheet', 'quiz', 'activity', 'homework'];
  for (const want of all) {
    // Mark every other step as made, so this one is the chip offered.
    const prep = { saved: all.filter(a => a !== want) };
    for (const lang of ['ar', 'en'] as const) {
      it(`${want} (${lang})`, () => {
        const chip = buildLessonSuggestions(memory, lang, false, prep).find(s => s.toolType === want);
        assert.ok(chip, `no ${want} chip offered`);
        const prompt = lang === 'ar' ? chip.promptAr : chip.promptEn;
        assert.equal(artifactFromQuery(prompt), want, `«${prompt}» was not read as ${want}`);
        assert.equal(classifyChatIntent(prompt, lang).intent, 'artifact');
      });
    }
  }

  it('an accusative a teacher types, with or without the tanween mark', () => {
    for (const q of ['جهز اختباراً', 'جهز اختبارا قصيرا', 'اقترح نشاطاً', 'اعطني واجباً']) {
      assert.notEqual(artifactFromQuery(q), null, q);
    }
    assert.equal(artifactFromQuery('جهز اختبارا قصيرا'), 'quiz');
    assert.equal(artifactFromQuery('اعطني واجباً'), 'homework');
  });
});
