/**
 * Chat asks for a game, slides, a test or a dictation → a button to that screen.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/chatToolAsk.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { toolAskFromQuery, toolAskReply } from '../chatToolAsk.ts';

describe('toolAskFromQuery', () => {
  const asks: Array<[string, string]> = [
    ['أعطني لعبة لهذا الدرس', 'game'],
    ['بدي مسابقة للطلاب', 'game'],
    ['make a game for this lesson', 'game'],
    ['اعمل عرض شرائح عن الدرس', 'slides'],
    ['جهّز عرض تقديمي', 'slides'],
    ['بوربوينت', 'slides'],
    ['create slides for the lesson', 'slides'],
    ['جهّز امتحان شهري', 'test'],
    ['أريد اختبار نهائي للوحدة', 'test'],
    ['إملاء', 'dictation'],
    ['اعمل إملاء للصف الثالث', 'dictation'],
    ['make a dictation test', 'dictation'],
  ];
  for (const [q, kind] of asks) {
    it(`«${q}» → ${kind}`, () => assert.equal(toolAskFromQuery(q), kind));
  }

  const notAsks = [
    'ما أنواع التقييم في المنهاج الأردني؟',   // a question about assessment
    'أنشئ اختبار قصير عن المشتقات',          // quiz: generated inline
    'اشرح قانون جيب التمام',
    'كيف أستخدم الألعاب التعليمية في تدريس الكسور بشكل فعّال؟', // pedagogy question
  ];
  for (const q of notAsks) {
    it(`leaves «${q}» alone`, () => assert.equal(toolAskFromQuery(q), null));
  }
});

describe('toolAskReply', () => {
  it('names the lesson when there is one', () => {
    assert.match(toolAskReply('game', 'ar', 'الكسور'), /على درس «الكسور»/);
  });
  it('reads cleanly without one', () => {
    assert.doesNotMatch(toolAskReply('slides', 'ar', null), /درس «/);
  });
  it('tells the teacher where the dictation button is', () => {
    assert.match(toolAskReply('dictation', 'ar'), /أضِف إملاء/);
  });
});

// Found 2026-11-01 on app.iqrra.com: «How can I prepare students for the exam» came
// back as «Tests are built in Evaluations…» with a button. "prepare" is the
// teacher's own verb in a how-to question, not a request for the builder.
describe('a how-to question is advice, not a request for a tool screen', () => {
  for (const q of [
    'How can I prepare students for the exam',
    'How do I write a good exam',
    'How should I make an exam fair',
    'كيف أعد الطلاب للامتحان',
    'كيف أحضّر الطلاب للامتحان',
  ]) {
    it(`«${q}» opens no screen`, () => {
      assert.equal(toolAskFromQuery(q), null);
    });
  }
  // A request, or a how-question that speaks to the assistant, still gets its screen.
  for (const [q, want] of [
    ['prepare an exam', 'test'],
    ['make me a test', 'test'],
    ['جهز امتحان', 'test'],
    ['How can you make me an exam please', 'test'],
    ['create a slides deck', 'slides'],
  ] as const) {
    it(`«${q}» still opens ${want}`, () => {
      assert.equal(toolAskFromQuery(q), want);
    });
  }
});
