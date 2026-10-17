/**
 * A question's frame is its sentence with the numbers and symbols taken out.
 *
 * Measured 2026-10-15: on an offline maths quiz, one frame was on average 58%
 * of the paper, and «الاتجاه من الشمال» gave 20 of 20 questions in the same
 * sentence. Counting frames is how a paper can tell "twelve questions" from
 * "one question twelve times".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sameKind, stemFrame } from '../stemFrame.ts';

describe('stemFrame', () => {
  it('gives two stems that differ only in their numbers the same frame', () => {
    assert.equal(
      stemFrame('حلّ المعادلة x² + 3x − 18 = 0 بالتحليل.'),
      stemFrame('حلّ المعادلة x² − 11x + 28 = 0 بالتحليل.'),
    );
    assert.equal(
      stemFrame('اكتب التوزيع الإلكتروني لذرة الألمنيوم (Z = 13).'),
      stemFrame('اكتب التوزيع الإلكتروني لذرة الألمنيوم (Z = 17).'),
    );
  });

  it('keeps different asks apart', () => {
    assert.notEqual(stemFrame('بسّط المقدار: 2^3 × 2^4'), stemFrame('أوجد حل المعادلة 2^x = 8'));
    assert.notEqual(stemFrame('أوجد قيمة sin 30°.'), stemFrame('حل: 2 cos θ = 1 حيث 0° ≤ θ < 360°.'));
  });

  it('keeps the words of an English stem', () => {
    assert.equal(stemFrame('Solve 2x + 3 = 7.'), stemFrame('Solve 5x − 1 = 9.'));
    assert.notEqual(stemFrame('Solve 2x + 3 = 7.'), stemFrame('Simplify 2x + 3x.'));
  });

  it('ignores vowel marks and Arabic-Indic digits', () => {
    assert.equal(stemFrame('أوجد ناتج: ٢ × ٨'), stemFrame('أوجِد ناتج: 2 × 3'));
  });

  it('only looks at the stem, not the answer a true/false item proposes', () => {
    assert.equal(
      stemFrame('حلّ المعادلة x² − 1 = 0.\n\nالإجابة المقترحة: 1 ، 1\n\nهل الإجابة المقترحة صحيحة؟'),
      stemFrame('حلّ المعادلة x² − 4 = 0.'),
    );
  });

  // Found 2026-10-16: the blank sat inside a word with digits, which became `#`
  // like any number, so a kind that moved the blank was not a new kind.
  it('keeps where the blank is', () => {
    assert.notEqual(stemFrame('أكمل لتحصل على كسرين متكافئين: 2/3 = ؟/12'), stemFrame('أكمل لتحصل على كسرين متكافئين: 2/3 = 8/؟'));
    assert.notEqual(stemFrame('أوجد العدد المجهول: ؟ + 84 = 238'), stemFrame('أوجد العدد المجهول: 84 + ؟ = 238'));
    assert.notEqual(stemFrame('ما الرقم مكان ■ في 39■5؟'), stemFrame('ما الرقم مكان ■ في ■395؟'));
    assert.equal(stemFrame('أوجد العدد المجهول: ؟ + 84 = 238'), stemFrame('أوجد العدد المجهول: ؟ + 7 = 19'));
  });

  it('reads a «؟» that ends a sentence as the question mark, and «…» as no blank', () => {
    assert.equal(stemFrame('ما ناتج 3 + 4؟'), stemFrame('ما ناتج 3 + 4'));
    assert.equal(stemFrame('ما قيمة x؟'), stemFrame('ما قيمة y'));
    assert.equal(stemFrame('حوّل 0.5454… إلى كسر'), stemFrame('حوّل 0.36 إلى كسر'));
    assert.equal(stemFrame('ما الحد التالي: 2، 4، 6، …؟'), stemFrame('ما الحد التالي: 5، 10، 15'));
  });
});

describe('sameKind', () => {
  it('puts one ask written with a word or two swapped into one kind', () => {
    for (const [a, b] of [
      ['ما العدد السابق للعدد 7؟', 'ما العدد التالي للعدد 7؟'],
      ['الساعة الآن 3:00. ما الوقت بعد 4 ساعات؟', 'الساعة الآن 3:00. ما الوقت بعد ساعة واحدة؟'],
      ['فكّرت سلمى في عدد، ثم أضافت إليه 6 فكان الناتج 9. ما العدد الذي فكّرت فيه؟', 'فكّر عمر في عدد، ثم طرح منه 7 فكان الناتج 5. ما العدد الذي فكّر فيه؟'],
      ['اكتب مقدارًا جبريًا يعبّر عن: ناتج جمع العدد x و 7.', 'اكتب مقدارًا جبريًا يعبّر عن: ناتج طرح 8 من العدد x.'],
      ['اكتب مقدارًا جبريًا يعبّر عن: ناتج ضرب العدد x في 7.', 'اكتب مقدارًا جبريًا يعبّر عن: ناتج طرح 8 من العدد x.'],
      // one conversion, asked in both directions
      ['اكتب الفترة (−∞ ، −5] على صورة متباينة.', 'اكتب المتباينة x > 4 على صورة فترة.'],
      ['دُوّرت النقطة (2، 3) حول نقطة الأصل بزاوية 90° باتجاه عقارب الساعة. ما إحداثيات صورتها؟', 'دُوّرت النقطة (2، 3) حول نقطة الأصل بزاوية 90° عكس اتجاه عقارب الساعة. ما إحداثيات صورتها؟'],
    ]) assert.ok(sameKind(stemFrame(a!), stemFrame(b!)), `${a} / ${b}`);
  });

  it('keeps different asks apart', () => {
    for (const [a, b] of [
      ['ما العدد السابق للعدد 7؟', 'ما العدد الذي يقع بين 6 و 8؟'],
      ['حلّ المعادلة x² − 4 = 0.', 'بسّط المقدار: 2^3 × 2^4'],
      ['ما مساحة دائرة نصف قطرها 3 سم؟', 'محيط دائرة 12π سم. ما طول نصف قطرها؟'],
      ['اكتب العدد الكسري 3 1/3 على صورة كسر غير فعلي.', 'اكتب الكسر غير الفعلي 51/10 على صورة عدد كسري.'],
    ]) assert.ok(!sameKind(stemFrame(a!), stemFrame(b!)), `${a} / ${b}`);
  });
});

