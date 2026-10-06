/**
 * Which lessons the maths bank has items ABOUT — and which it refuses.
 *
 * Before this, routing read a lesson's whole text (summary and concepts too)
 * through one ordered list of regexes and fell back to a default, so
 * «النسب المثلثية» served circles, Grade 7 proportion served quadratics, and a
 * Grade 1 sorting lesson served addition. A lesson no family is about now
 * returns nothing, and the caller says so.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { elementaryOpsForTitle } from '../elementary.ts';
import { lessonTitleBlob, matchMathFamily, mathBankCovers, takeConcreteMath, takeElementaryMath } from '../index.ts';

const ops = (title: string) => elementaryOpsForTitle(title).join('+') || '-';

describe('primary lessons: the ops come from the title', () => {
  const cases: Array<[string, string]> = [
    ['الْجَمْعُ', 'add'],
    ['الضَّرْبُ في 6 و9', 'mul'],
    ['القسمة على 3', 'div'],
    ['جمع الأعداد الكلية وطرحها', 'add+sub'],
    ['ترتيب الكسور', 'frac_compare'],
    ['مقارنة الأعداد العشرية وترتيبها', 'dec_compare'],
    ['جمع الكسور المتشابهة وطرحها', 'frac+frac_sub'],
    ['ضرب الكسور', 'frac_mul'],
    ['قسمة الكسور', 'frac_div'],
    ['جمع الأعداد العشرية وطرحها', 'dec+dec_sub'],
    ['ضرب الأعداد العشرية وقسمتها', 'dec_mul+dec_div'],
    ['النسبة المئوية من عدد', 'percent'],
    ['القيمة المنزلية ضمن الألوف', 'place'],
    ['الضرب كجمع متكرر', 'add+mul'],
  ];
  for (const [title, expected] of cases) {
    it(`${title} → ${expected}`, () => assert.equal(ops(title), expected));
  }

  // Each of these used to serve some arithmetic anyway.
  const refused = [
    'أضلاع الأشكال المستوية ورؤوسها',   // geometry
    'جمع البيانات',                      // collecting data is not addition
    'الأنماط',
    'التحويل بين الكسور والأعداد العشرية', // matched «كسور» and served fraction addition
    'الكسور والقسمة',                    // a fraction and a division is not dividing fractions
    'الأعداد العشرية',
    'الأعداد الكسرية والكسور غير الفعلية',
    'جمع الأعداد الصحيحة',               // negatives
    'القسمة مع باق (الناتج من رقمين)',   // remainders
    'تقدير ناتج الجمع',                  // estimation
    'خصائص الجمع',                       // properties
    'جمع مضاعفات 10 و100 و1000',
    'الضرب مع إعادة التجميع',            // a two-digit factor, not a times table
    'النسبة المئوية والكسور العادية',    // conversion
  ];
  for (const title of refused) {
    it(`refuses «${title}»`, () => assert.equal(ops(title), '-'));
  }

  it('takeElementaryMath gives a refused lesson no items at all', () => {
    assert.equal(takeElementaryMath('multiple_choice', 'أضلاع الأشكال المستوية', null, 1, 'easy', 'ar', 1, new Set()), null);
  });
});

describe('the new primary items are right', () => {
  const value = (s: string) => {
    const [n, d] = s.split('/').map(Number);
    return d === undefined ? n! : n! / d;
  };
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  function recompute(eq: string): number | null {
    const f = eq.match(/^(\d+)\/(\d+) ([+−×÷]) (\d+)\/(\d+)$/);
    if (f) {
      const [a, b, op, c, d] = [Number(f[1]), Number(f[2]), f[3], Number(f[4]), Number(f[5])];
      const x = a / b, y = c / d;
      return op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;
    }
    const m = eq.match(/^([\d.]+) ([+−×÷]) ([\d.]+)$/);
    if (m) {
      const [x, op, y] = [Number(m[1]), m[2], Number(m[3])];
      return op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;
    }
    return null;
  }

  const TITLES: Array<[string, number]> = [
    ['جمع الكسور المتشابهة وطرحها', 4], ['جمع الكسور', 5], ['طرح الكسور', 6], ['ضرب الكسور', 5], ['قسمة الكسور', 5],
    ['جمع الأعداد العشرية وطرحها', 5], ['ضرب الأعداد العشرية', 6], ['قسمة الأعداد العشرية', 6],
  ];
  for (const [title, grade] of TITLES) {
    it(`${title}: the key is the real answer and no wrong option is worth the same`, () => {
      for (let i = 0; i < 400; i++) {
        const q = takeElementaryMath('multiple_choice', title, null, grade, i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard', 'ar', 1, new Set())!;
        const eq = q.text.split('\n')[0]!.replace(/^[^\d]*/, '').trim();
        const expected = recompute(eq);
        if (expected !== null) {
          assert.ok(near(value(q.answer), expected), `${eq} keyed ${q.answer}, is ${expected}`);
        }
        const all = q.options!.map(value);
        assert.equal(new Set(all.map(v => Math.round(v * 1e9))).size, all.length, `${eq}: two options are equal in value (${q.options!.join(' | ')})`);
        assert.ok(q.options!.includes(q.answer));
        assert.ok(!q.options!.some(o => /\/1$/.test(o) || value(o) < 0), `${eq}: odd option (${q.options!.join(' | ')})`);
      }
    });
  }
});

describe('the Grade 10 families come from the title', () => {
  const cases: Array<[string, string | null]> = [
    ['النسب المثلثية', 'trig'],                      // its summary mentions a hypotenuse
    ['جمع المتجهات وطرحها', 'vectors'],              // its summary mentions a triangle
    ['المتتاليات', 'sequences'],
    ['تقدير ميل المنحنى', 'derivative'],
    ['حل المعادلة الأسية', 'exp_eq'],
    ['حل نظام مكون من معادلة خطية ومعادلة تربيعية', 'linear_quad'],
    ['معمل برمجية جيوجبرا: حل أنظمة المعادلات بيانيا', 'system_graph'],
    ['قانون الجيوب', 'trig_apps'],
    ['احتمالات الحوادث المستقلة', 'stats'],
    ['معادلة الدائرة', 'circle'],
    ['Quadratic Equations', 'algebra'],
    // No items practise these, so there is no family — not «algebra».
    ['أشكال الانتشار', null],
    ['قسمة كثيرات الحدود والاقترانات النسبية', null],
    ['اقترانات كثيرات الحدود', null],
    ['تمثيل الاقترانات المثلثية', null],
    ['مقاييس التشتت للجداول التكرارية ذات الفئات', null],
    ['الزوايا في الدائرة', null],
    ['الاتجاه من الشمال (Bearing)', null],
  ];
  for (const [title, family] of cases) {
    it(`${title} → ${family ?? 'refused'}`, () => assert.equal(matchMathFamily(title, null), family));
  }

  it('serves items about a sequence for a sequence lesson, not compositions', () => {
    for (let i = 0; i < 6; i++) {
      const q = takeConcreteMath('short_answer', 'المتتاليات', null, 'medium', 'ar', 1, new Set(), true)!;
      assert.match(q.text, /متتالية/);
    }
  });

  it('returns nothing for a lesson with no family', () => {
    assert.equal(takeConcreteMath('multiple_choice', 'قسمة كثيرات الحدود', null, 'medium', 'ar', 1, new Set()), null);
  });
});

describe('mathBankCovers', () => {
  it('Grades 7–9 have no bank, whatever the title says', () => {
    for (const g of [7, 8, 9]) assert.equal(mathBankCovers('التناسب', null, g), false);
    assert.equal(mathBankCovers('المعادلات الأسية', null, 9), false);
  });

  it('Grades 1–6 by the title, Grade 10 and typed topics by family', () => {
    assert.equal(mathBankCovers('الجمع', null, 2), true);
    assert.equal(mathBankCovers('تصنيف الأشكال', null, 1), false);
    assert.equal(mathBankCovers('الاشتقاق', null, 10), true);
    assert.equal(mathBankCovers('الاشتقاق', null, null), true);
    assert.equal(mathBankCovers('موضوع حر', null, null), false);
  });

  it('reads the title blob, not the summary', () => {
    const lesson = { id: 'x', titleAr: 'الأنماط', titleEn: 'Patterns', objectives: ['جمع الأعداد'], keyConceptsAr: ['جمع'], keyConceptsEn: [] };
    assert.equal(lessonTitleBlob('الأنماط', lesson).includes('جمع'), false);
    assert.equal(mathBankCovers('الأنماط', lesson, 2), false);
  });
});
