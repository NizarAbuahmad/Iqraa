/**
 * The hands-on activity is for every subject, not just geometry.
 *
 * The blueprint fixed its equipment at «ruler, protractor, string,
 * calculator» and always ended on «record the measured value, the computed
 * value and the difference», whatever the lesson. A chemistry or English class
 * was told to measure a molecule model with a protractor; a maths lesson on
 * factorising was told to «draw the figure in the problem to scale». The live
 * prompt carried the same maths-shaped rule (activityPrompts.test.ts in the
 * api-server pins its side).
 *
 * What stays constant is the format: students make something physical, then
 * check it against the lesson's rule or the book and explain any mismatch. What
 * varies is the thing they make and the thing they check it against.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildActivityBlueprint, type ActivityBlueprintContext } from '@/services/ai/activityBlueprints.ts';

const GEOMETRIC = { text: 'مثلث فيه الزاوية أ = 40° والضلع ب = 8 سم. جد الضلع المقابل.', answer: '5.14 سم', points: 2 };
const ALGEBRAIC = { text: 'حلّل المقدار س² + 5س + 6', answer: '(س + 2)(س + 3)', points: 2 };
const CHEMICAL = { text: 'احسب الكتلة المولية لجزيء الماء H₂O', answer: '18 g/mol', points: 2 };

const ctx = (over: Partial<ActivityBlueprintContext>): ActivityBlueprintContext => ({
  topic: 'الموضوع', lang: 'ar', math: false, practice: [], kb: null, duration: 30, ...over,
});
const text = (b: ReturnType<typeof buildActivityBlueprint>) =>
  [b.objective, b.groupSize, ...b.materials, ...b.steps.flatMap(s => [s.title, s.description]),
    ...b.teacherTips, b.differentiation, b.assessment].join('\n');
const gear = (b: ReturnType<typeof buildActivityBlueprint>) => b.materials.join(' ');

const MEASURING_AR = /مسطرة|منقلة|خيط|شريط قياس|مقياس رسم/;
const MEASURING_EN = /ruler|protractor|string|tape measure|scale/i;

describe('hands-on: geometry still measures', () => {
  it('maths with a geometric item keeps the measure-and-compare build', () => {
    const b = buildActivityBlueprint('hands-on', ctx({ math: true, subject: 'mathematics', practice: [GEOMETRIC] }));
    assert.match(gear(b), /مسطرة|منقلة/);
    assert.match(text(b), /قِس|قياس/);
    assert.match(text(b), /الفرق/);
  });
});

describe('hands-on: algebra builds with cards, not a protractor', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: no measuring equipment and no drawing-to-scale`, () => {
      const b = buildActivityBlueprint('hands-on', ctx({
        lang, math: true, subject: 'mathematics', practice: [ALGEBRAIC],
        topic: lang === 'ar' ? 'التحليل' : 'Factorising',
      }));
      assert.doesNotMatch(gear(b), lang === 'ar' ? MEASURING_AR : MEASURING_EN);
      assert.doesNotMatch(text(b), lang === 'ar' ? /مقياس رسم|بالمسطرة|بالمنقلة/ : /to scale|with a ruler|protractor/i);
      assert.match(text(b), lang === 'ar' ? /بطاقات/ : /cards/i);
      assert.ok(text(b).includes(ALGEBRAIC.text), 'builds the item it was given');
      assert.ok(text(b).includes(ALGEBRAIC.answer), 'the check names the rule\'s answer');
    });
  }
});

describe('hands-on: a science lesson builds and checks a model', () => {
  for (const [lang, subject] of [['ar', 'chemistry'], ['en', 'Chemistry'], ['ar', 'biology'], ['en', 'Physics']] as const) {
    it(`${lang} / ${subject}: model-building kit, checked against the rule`, () => {
      const b = buildActivityBlueprint('hands-on', ctx({ lang, subject, practice: [CHEMICAL] }));
      assert.doesNotMatch(gear(b), lang === 'ar' ? MEASURING_AR : MEASURING_EN);
      assert.match(gear(b), lang === 'ar' ? /كرات|صلصال/ : /ball|clay/i);
      assert.match(text(b), lang === 'ar' ? /نموذج/ : /model/i);
      assert.ok(text(b).includes(CHEMICAL.answer));
      assert.match(text(b), lang === 'ar' ? /الفرق|اختلاف/ : /gap|differ/i);
    });
  }

  it('without a bank item, it still builds a model of the lesson\'s own concept', () => {
    const b = buildActivityBlueprint('hands-on', ctx({ subject: 'chemistry', topic: 'الروابط الأيونية' }));
    assert.match(text(b), /الروابط الأيونية/);
    assert.doesNotMatch(gear(b), MEASURING_AR);
  });
});

describe('hands-on: a language or humanities lesson sorts and sequences cards', () => {
  for (const [lang, subject] of [['ar', 'arabic'], ['en', 'english'], ['ar', 'history'], ['en', 'Islamic Education']] as const) {
    it(`${lang} / ${subject}: cards, a board and the textbook — no measuring`, () => {
      const b = buildActivityBlueprint('hands-on', ctx({ lang, subject, topic: lang === 'ar' ? 'الجملة الاسمية' : 'The past simple' }));
      assert.doesNotMatch(gear(b), lang === 'ar' ? MEASURING_AR : MEASURING_EN);
      assert.match(gear(b), lang === 'ar' ? /بطاقات|ورق مقوّى/ : /cards|card stock/i);
      assert.match(gear(b), lang === 'ar' ? /الكتاب/ : /textbook/i);
      assert.match(text(b), lang === 'ar' ? /رتّب|ترتيب/ : /sort|sequence|arrange|order/i);
      assert.match(text(b), lang === 'ar' ? /الفرق|اختلف/ : /gap|differ/i);
    });
  }

  it('an unknown subject takes the same path rather than the maths one', () => {
    const b = buildActivityBlueprint('hands-on', ctx({ subject: 'Vocational Education' }));
    assert.doesNotMatch(gear(b), MEASURING_AR);
  });
});

describe('hands-on: whatever the subject, the format holds', () => {
  const CASES: Array<Partial<ActivityBlueprintContext>> = [
    { math: true, subject: 'mathematics', practice: [GEOMETRIC] },
    { math: true, subject: 'mathematics', practice: [ALGEBRAIC] },
    { math: true, subject: 'mathematics' },
    { subject: 'chemistry', practice: [CHEMICAL] },
    { subject: 'physics' },
    { subject: 'arabic' },
    { subject: undefined },
  ];
  for (const [i, c] of CASES.entries()) {
    for (const lang of ['ar', 'en'] as const) {
      it(`case ${i} / ${lang}: four steps summing to the duration, with a record and a comparison`, () => {
        const b = buildActivityBlueprint('hands-on', ctx({ ...c, lang, duration: 40 }));
        assert.equal(b.steps.length, 4);
        assert.equal(b.steps.reduce((s, x) => s + x.durationMin, 0), 40);
        assert.ok(b.materials.length >= 4);
        assert.match(text(b), lang === 'ar' ? /بطاقة التسجيل/ : /record card/i);
        assert.match(text(b), lang === 'ar' ? /الفرق|اختلاف|اختلف/ : /gap|differ/i);
        assert.doesNotMatch(text(b), /\*\*/);
      });
    }
  }
});
