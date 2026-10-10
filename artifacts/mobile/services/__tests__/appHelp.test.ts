/**
 * "Where do I find X?" is answered from the app's own map.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/appHelp.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { answerAppHelp, findAppPlaces, isAppHelpQuery } from '../appHelp.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';

const top = (q: string) => findAppPlaces(q)[0]?.id;

describe('isAppHelpQuery', () => {
  const help = [
    'وين ألاقي الاختبارات؟',
    'أين أجد المواد المحفوظة',
    'كيف أفتح الإعدادات',
    'وين الشعب تبعتي',
    'where can I find my saved materials?',
    'how do I open settings',
    'وين الزر اللي بغير اللغة',
  ];
  for (const q of help) {
    it(`claims «${q}»`, () => assert.equal(isAppHelpQuery(q), true));
  }

  const notHelp = [
    'أين تقع البتراء؟',           // geography, nothing app-shaped
    'اشرح قانون جيب التمام',
    'أنشئ ورقة عمل عن المشتقات',
    'ما هو الجدول الدوري؟',       // «جدول» without a where-phrase
    'where is the vertex of a parabola?',
  ];
  for (const q of notHelp) {
    it(`leaves «${q}» alone`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

describe('findAppPlaces', () => {
  const cases: Array<[string, string]> = [
    ['وين ألاقي الاختبارات؟', 'tool:evaluations'],
    ['أين أجد المواد المحفوظة', 'workspace'],
    ['وين الشعب تبعتي', 'classes'],
    ['وين جدول الحصص', 'schedule'],
    ['وين خطط التدريس', 'teaching-plans'],
    ['كيف أفتح الإعدادات', 'settings'],
    ['وين ألاقي ورقة العمل', 'tool:worksheet'],
    ['وين أعمل عرض شرائح', 'tool:slides'],
    ['وين الرسائل', 'notifications'],
    ['where can I find my saved materials?', 'workspace'],
  ];
  for (const [q, id] of cases) {
    it(`«${q}» → ${id}`, () => assert.equal(top(q), id));
  }

  it('prefers the longer phrase: «اختبار قصير» is the quiz, not a test', () => {
    assert.equal(top('وين الاختبار القصير'), 'tool:quiz');
  });

  it('does not match inside a longer word', () => {
    assert.equal(findAppPlaces('وين الجداول الإحصائية').some(p => p.id === 'schedule'), false);
  });
});

describe('answerAppHelp', () => {
  const t = (k: string) => `<${k}>`;

  it('names the path to the place and offers it as a button', () => {
    const a = answerAppHelp('وين ألاقي الاختبارات؟', 'ar', t);
    assert.equal(a.places[0]!.id, 'tool:evaluations');
    assert.match(a.text, /<tabTools> ← <toolsAfterClass> ← <evaluations>/);
  });

  it('falls back to the FAQ when nothing matched', () => {
    const a = answerAppHelp('وين الزر اللي بغير اللغة يا ترى في التطبيق', 'ar', t);
    // «اللغة» is a settings keyword; drop it to exercise the fallback.
    const b = answerAppHelp('وين الزر في التطبيق', 'ar', t);
    assert.equal(a.places[0]!.id, 'settings');
    assert.deepEqual(b.places.map(p => p.id), ['faq']);
  });
});

describe('"how do I" questions about the app', () => {
  const t = (k: string) => `<${k}>`;

  const how = [
    'how to add more clases',                        // the typo that was actually typed
    'now i teach grade 10 how to add grade 8',
    'كيف أضيف شعبة جديدة؟',
    'كيف أضيف صف ثامن',
    'how do I export my lesson plan',
    'how do I start the class on the projector',
    'كيف أغيّر الدرس',
    'كيف أستخدم التطبيق؟',
  ];
  for (const q of how) {
    it(`claims «${q}»`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q).intent, 'app_help');
    });
  }

  const teaching = [
    'كيف أجمع الكسور',
    'how to add fractions',
    'كيف أشرح الاقترانات',
    'كيف أبسّط الكسر',
    'how do I use the quadratic formula',
    'how can I explain grade 10 functions',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => assert.equal(isAppHelpQuery(q), false));
  }

  it('«how to add more clases» gives the add-class steps and opens /classes', () => {
    const a = answerAppHelp('how to add more clases', 'en', t);
    assert.equal(a.text, '<howAddClass>');
    assert.deepEqual(a.places.map(p => [p.id, p.route]), [['classes', '/classes']]);
  });

  it('«how to add grade 8» gives the add-grade steps and opens the subject editor', () => {
    const a = answerAppHelp('now i teach grade 10 how to add grade 8', 'en', t);
    assert.equal(a.text, '<howAddGrade>');
    assert.deepEqual(a.places.map(p => [p.id, p.route, p.routeParams?.mode]), [['subjects', '/setup-subjects', 'edit']]);
  });

  it('reuses the FAQ answers for start-class, change-lesson and export', () => {
    assert.equal(answerAppHelp('how do I start the class on the projector', 'en', t).text, '<faqA7>');
    assert.equal(answerAppHelp('كيف أغيّر الدرس', 'ar', t).text, '<faqA2>');
    assert.equal(answerAppHelp('how do I export to pdf', 'en', t).text, '<faqA4>');
  });

  it('a "where" question about the same place still lists the path, not the steps', () => {
    const a = answerAppHelp('وين الشعب تبعتي', 'ar', t);
    assert.match(a.text, /<tabProfile> ← <myClasses>/);
  });

  it('a grade named inside another ask does not turn into the subject editor', () => {
    assert.notEqual(top('how do I export a grade 10 quiz'), 'subjects');
  });
});

// Reported 2026-10-10 from the web chat: «where i can add more classes to my
// account» came back as «سؤالك قد يخص أكثر من مادة. أيّ مادة تقصد؟». The gate
// only knew «where can / is / are / do», so the order people actually type
// («where i can …», «where to …») and the plain yes/no form («can i add …»)
// never reached the app map, fell through to the teaching pipeline, and ended
// in a subject question about a sentence that had no subject in it.
describe('natural English phrasings of a where / can-I question', () => {
  const help = [
    'where i can add more classes to my account',   // the one that was reported
    'where i can find my saved materials',
    'where we can change the language',
    'where to change the language',
    'where should i go to add a class',
    'can i add more classes to my account',
    'can I export my lesson plan',
  ];
  for (const q of help) {
    it(`claims «${q}»`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, 'en').intent, 'app_help');
    });
  }

  it('«where i can add more classes to my account» points at My classes', () => {
    const t = (k: string) => `<${k}>`;
    const ans = answerAppHelp('where i can add more classes to my account', 'en', t);
    assert.equal(ans.places[0]?.id, 'classes');
    assert.equal(ans.places[0]?.route, '/classes');
  });

  // The same words with a teaching object name no place and no app noun. The
  // «can we create a quiz …» line is a request to the assistant, not a question
  // about the app, even though «quiz» and «students» are both place keywords.
  const teaching = [
    'where i can use the quadratic formula',
    'where to find the vertex of a parabola',
    'where should i start with fractions',
    'can i add fractions with different denominators',
    'can we create a quiz for the students to solve',
    'can I save time by factoring first',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

describe('classifyChatIntent routes app questions before artifacts', () => {
  it('«وين ألاقي ورقة العمل» asks for the tool, not a worksheet', () => {
    assert.equal(classifyChatIntent('وين ألاقي ورقة العمل؟').intent, 'app_help');
  });
  it('«أنشئ ورقة عمل» still generates', () => {
    assert.equal(classifyChatIntent('أنشئ ورقة عمل').intent, 'artifact');
  });
});
