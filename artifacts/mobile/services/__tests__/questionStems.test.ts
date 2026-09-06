/**
 * Question stems — the wording a student actually reads.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/questionStems.test.ts
 *
 * Every bank item that needs specific wording carries a hand-written Arabic
 * prompt. Only `short_answer` used them; multiple choice, true/false and
 * fill-in-the-blank each built a generic stem out of the raw equation, so a
 * derivative item that reads properly on a worksheet was projected to the
 * class as «ما ناتج / حل: f(x)=x³ − 4x؟». These pin that the good Arabic is
 * what reaches every question type.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  beginMathPracticeSession, takeConcreteMath,
} from '../ai/mathPractice.ts';
import { classifyVerifiableTopic } from '../ai/verifyMathGuards.ts';

/** The stem the shipped code built for a multiple-choice item. */
const RETIRED_STEM = /ما ناتج \/ حل:/;

describe('multiple choice uses the item\'s own wording', () => {
  beforeEach(() => beginMathPracticeSession());

  it('asks a derivative question as a teacher would write it', () => {
    // The draw is random within the family now, so accept any of the bank's
    // own teacher phrasings («أوجد f′(x)…», «ما ميل مماس…») — the assertion
    // is "reads like a teacher wrote it", not "is item d-m1".
    const q = takeConcreteMath('multiple_choice', 'الاشتقاق', null, 'medium', 'ar', 0)!;
    assert.ok(q, 'the bank has a derivative item');
    assert.doesNotMatch(q.text, RETIRED_STEM);
    assert.match(q.text, /أوجد|ما ميل/);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2);
  });

  it('never emits the retired generic stem, for any family', () => {
    const topics = ['الاشتقاق', 'المتجهات', 'الإحصاء', 'الاقترانات', 'حساب المثلثات'];
    for (const topic of topics) {
      beginMathPracticeSession();
      for (let i = 0; i < 4; i++) {
        const q = takeConcreteMath('multiple_choice', topic, null, 'medium', 'ar', 0);
        if (!q) break;
        assert.doesNotMatch(q.text, RETIRED_STEM, `${topic}: ${q.text}`);
      }
    }
  });

  it('asks for a solution only when there is an equation to solve', () => {
    // The algebra fallback bank carries no prompts, so its wording is chosen
    // by what the item is. Every one of those is an equation.
    beginMathPracticeSession();
    for (let i = 0; i < 6; i++) {
      const q = takeConcreteMath('multiple_choice', 'معادلات', null, 'easy', 'ar', 0);
      if (!q) break;
      if (/أوجد حل المعادلة/.test(q.text)) assert.match(q.text, /=/);
      if (/أوجد ناتج/.test(q.text)) assert.doesNotMatch(q.text.split(':')[1] ?? '', /=/);
    }
  });
});

describe('the correct option is not identifiable by its shape', () => {
  beforeEach(() => beginMathPracticeSession());

  const labelled = (s: string) => /^[^\s=]{1,12}\s*=/.test(s);

  it('never leaves the key as the only labelled option', () => {
    // The bank stores answers labelled and distractors bare — `f'(x) = 3x² − 4`
    // against `3x²`, `x² − 4`, `3x − 4`. Projected, the only option shaped
    // differently was the right one, and a student could pick it without doing
    // any maths. Whatever else a distractor is for, it cannot be eliminable
    // on sight.
    const topics = ['الاشتقاق', 'المتجهات', 'الإحصاء', 'الاقترانات', 'حساب المثلثات', 'معادلات'];
    let checked = 0;
    for (const topic of topics) {
      beginMathPracticeSession();
      for (let i = 0; i < 5; i++) {
        const q = takeConcreteMath('multiple_choice', topic, null, 'medium', 'ar', 0);
        if (!q?.options?.length) break;
        checked += 1;
        // The property is not that every option looks alike — «لا قيم حرجة»
        // beside «x = 3» is a fair spread of real answers. It is that the
        // KEY must never be the only one of its shape.
        const key = labelled(q.answer);
        const wrongs = q.options.filter(o => o !== q.answer);
        assert.ok(
          wrongs.some(w => labelled(w) === key),
          `key is the only ${key ? 'labelled' : 'bare'} option in «${q.text}»: ${JSON.stringify(q.options)}`,
        );
      }
    }
    assert.ok(checked >= 10, `only ${checked} items reached`);
  });

  it('keeps the key equal to the option shown, so the reveal cannot disagree', () => {
    const topics = ['الاشتقاق', 'المتجهات', 'الإحصاء', 'معادلات'];
    for (const topic of topics) {
      beginMathPracticeSession();
      for (let i = 0; i < 4; i++) {
        const q = takeConcreteMath('multiple_choice', topic, null, 'medium', 'ar', 0);
        if (!q?.options?.length) break;
        assert.ok(q.options.includes(q.answer), `${q.answer} not among ${JSON.stringify(q.options)}`);
      }
    }
  });

  it('leaves a consistently labelled set alone', () => {
    // `x = 6` against `x = 5`, `x = 11`, `x = 7` is already uniform, and the
    // `x =` is what makes those answers readable.
    beginMathPracticeSession();
    let sawLabelledSet = false;
    for (let i = 0; i < 8; i++) {
      const q = takeConcreteMath('multiple_choice', 'معادلات أسية', null, 'easy', 'ar', 0);
      if (!q?.options?.length) break;
      if (q.options.every(labelled)) sawLabelledSet = true;
    }
    assert.ok(sawLabelledSet, 'the bank still has fully labelled option sets');
  });

  it('does not slice an answer whose = is not a label', () => {
    // «متعامدان (الضرب القياسي = 0)» and «قيم حرجة عند x = ±1» both contain
    // an `=` that is part of the sentence. A naive split leaves «0)».
    beginMathPracticeSession();
    for (let i = 0; i < 6; i++) {
      const q = takeConcreteMath('multiple_choice', 'المتجهات', null, 'hard', 'ar', 0);
      if (!q?.options?.length) break;
      assert.ok(!q.options.some(o => /^\s*[)\]]/.test(o)), JSON.stringify(q.options));
      assert.ok(q.options.every(o => o.trim().length > 0));
    }
  });
});

describe('true/false states a claim to judge', () => {
  beforeEach(() => beginMathPracticeSession());

  it('poses the question, the proposed answer, then the judgement', () => {
    const q = takeConcreteMath('true_false', 'الاشتقاق', null, 'medium', 'ar', 0)!;
    assert.match(q.text, /الإجابة المقترحة:/);
    assert.match(q.text, /هل الإجابة المقترحة صحيحة؟/);
    assert.deepEqual(q.options, ['صح', 'خطأ']);
    assert.ok(q.answer === 'صح' || q.answer === 'خطأ');
  });

  it('carries the item wording, not a rebuilt equation', () => {
    const q = takeConcreteMath('true_false', 'الاشتقاق', null, 'medium', 'ar', 0)!;
    assert.doesNotMatch(q.text, /حل \/ ناتج/);
  });
});

describe('fill in the blank keeps the question and adds the blank', () => {
  beforeEach(() => beginMathPracticeSession());

  it('does not restate the item as an «إذا كان … فإن» sentence', () => {
    const q = takeConcreteMath('fill_blank', 'الاشتقاق', null, 'medium', 'ar', 0)!;
    assert.match(q.text, /الإجابة: _+/);
    assert.doesNotMatch(q.text, /فإن الإجابة هي/);
  });
});

describe('word problems are not invented', () => {
  beforeEach(() => beginMathPracticeSession());

  it('asks for the working instead of wrapping the equation in a fake story', () => {
    // This used to read «مسألة: يحتاج طالب إلى حل «…» ضمن تمرين صفي» — a
    // story about a student doing an exercise, which is the exercise with a
    // sentence in front of it, not a word problem.
    let sawFallback = false;
    for (let i = 0; i < 8; i++) {
      const q = takeConcreteMath('word_problem', 'معادلات', null, 'easy', 'ar', 0);
      if (!q) break;
      assert.doesNotMatch(q.text, /يحتاج طالب إلى حل/);
      if (/اكتب الحل موضّحًا الخطوات/.test(q.text)) sawFallback = true;
    }
    assert.ok(sawFallback, 'items with no real context ask for the working');
  });
});

describe('the stems still reach the verifier', () => {
  beforeEach(() => beginMathPracticeSession());

  it('classifies every derivative MCQ as a derivative, not as an equation', () => {
    // Shipped, none of these reached the derivative prover. The stem said
    // «ما ناتج / حل: f(x)=x³ − 4x؟», which carries no derivative marker, so
    // the classifier read `f(x)=…` as an equation to solve and SymPy rejected
    // it. It failed closed — nothing false was claimed — but the badge that
    // proves the maths never appeared on the questions built to carry it.
    for (const [topic, expected] of [
      ['الاشتقاق', 'derivative_polynomial'],
    ] as const) {
      beginMathPracticeSession();
      const q = takeConcreteMath('multiple_choice', topic, null, 'easy', 'ar', 0)!;
      assert.equal(classifyVerifiableTopic(q.text)?.topic, expected, q.text);
    }
  });

  it('recognises the prime the Arabic bank actually writes', () => {
    // U+2032, not the ASCII apostrophe. «أوجد f′(x) إذا كان f(x) = x³ − 4x.»
    // carries no «مشتق», so this character is the only marker there is.
    const stem = 'أوجد f′(x) إذا كان f(x) = x³ − 4x.';
    const match = classifyVerifiableTopic(stem);
    assert.equal(match?.topic, 'derivative_polynomial');
    assert.equal(match?.payload, 'x^3-4x', 'the function, not the f′(x) label');
  });

  it('hands SymPy an answer it can parse', () => {
    // `f'(x) = 2x` is a syntax error to the verifier — the apostrophe opens
    // a string literal there — so an answer carrying the prefix could never
    // be proved. Levelling the option shapes removed it.
    beginMathPracticeSession();
    const q = takeConcreteMath('multiple_choice', 'الاشتقاق', null, 'easy', 'ar', 0)!;
    assert.doesNotMatch(q.answer, /f['′]\s*\(x\)/);
  });

  it('leaves an unprovable item alone rather than mislabelling it', () => {
    // A tangent-slope answer is a number, not an expression the derivative
    // slice can compare. It must stay unclassified-as-derivative and end up
    // on the honest bank label.
    const stem = 'ما ميل مماس منحنى y = x² عند x = 3؟';
    assert.notEqual(classifyVerifiableTopic(stem)?.topic, 'derivative_polynomial');
  });
});

describe('a family stays on-topic when a lesson needs more items than it has', () => {
  beforeEach(() => beginMathPracticeSession());

  it('never drifts a function-composition lesson into unrelated algebra', () => {
    // «تركيب الاقترانات» only has 5 concrete bank items (family `functions`).
    // A worksheet or quiz asking for more than that used to fall straight
    // through to the generic `algebra` family the moment the family's own
    // items ran out — a teacher who picked this exact lesson got a
    // quadratic-formula or linear-equation item with no connection to it.
    // Every draw here must still carry the functions family's own notation
    // (f(x)/g(x)/a_n), never a bare algebra-only equation like the fallback
    // bank's «2x + 5 = 17».
    for (let i = 0; i < 8; i++) {
      const q = takeConcreteMath('short_answer', 'تركيب الاقترانات', null, 'medium', 'ar', 0);
      assert.ok(q, `draw ${i + 1} returned nothing`);
      assert.match(q!.text, /f\(x\)|g\(x\)|a_n/, `draw ${i + 1} left the functions family: ${q!.text}`);
    }
  });
});
