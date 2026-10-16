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
import { stemFrame } from '../stemFrame.ts';

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
});
