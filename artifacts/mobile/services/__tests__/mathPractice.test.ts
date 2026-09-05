/**
 * isMathContext — subject-vs-topic gating.
 *
 *   node --experimental-strip-types --test artifacts/mobile/services/__tests__/mathPractice.test.ts
 *
 * The bug: a chemistry lesson on «المعادلة الكيميائية» (chemical *equation*)
 * or a finance lesson mentioning «تراكم أسي» (exponential growth) contains
 * words the maths regex also matches — «معادل», «أسي». The old version only
 * ever appended the caller's subject onto the same blob it ran one regex
 * over, so that text could still out-vote a correctly-passed non-math
 * subject and inject algebra questions into a chemistry worksheet. See
 * CLAUDE.md: "Generators branch on the subject NAME."
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isMathContext } from '../ai/mathPractice.ts';
import { KB_LESSONS } from '../knowledgeBase.ts';

function lesson(id: string) {
  const l = KB_LESSONS.find(l => l.id === id);
  assert.ok(l, `fixture lesson not found: ${id}`);
  return l!;
}

describe('isMathContext — real KB lesson (kb subject is authoritative)', () => {
  it('is false for a chemistry lesson whose text contains a math-regex false positive', () => {
    // «التفاعلات الكيميائية» — its blob contains «معادلة» (chemical equation),
    // which the maths regex also matches via «معادل».
    const chem = lesson('kbl-chem-s2-nccd-u4_l1');
    assert.equal(isMathContext(chem.titleAr, chem), false);
    // Even when a caller mislabels the subject as Mathematics — the kb's own
    // subject wins over a disagreeing caller-supplied string.
    assert.equal(isMathContext(chem.titleAr, chem, 'Mathematics'), false);
  });

  it('is false for a financial-literacy lesson whose text contains a math-regex false positive', () => {
    const finlit = lesson('kbl-finlit-s1-nccd-u2_l4');
    assert.equal(isMathContext(finlit.titleAr, finlit), false);
    assert.equal(isMathContext(finlit.titleAr, finlit, 'Mathematics'), false);
  });

  it('is true for a real mathematics lesson, and a caller mislabelling it as Chemistry cannot suppress it', () => {
    const math = lesson('kbl-math-s1-nccd-u2_l1');
    assert.equal(isMathContext(math.titleAr, math), true);
    // The kb's own subject is checked first, in both directions.
    assert.equal(isMathContext(math.titleAr, math, 'Chemistry'), true);
  });
});

describe('isMathContext — no KB lesson (subject is the only signal)', () => {
  it('falls back to the caller-supplied subject', () => {
    assert.equal(isMathContext('موضوع حر غير موجود في المنهاج', null, 'Mathematics'), true);
    assert.equal(isMathContext('موضوع حر غير موجود في المنهاج', null, 'Chemistry'), false);
  });

  it('falls back to the topic-text heuristic when no subject is given either', () => {
    assert.equal(isMathContext('حل معادلة تربيعية', null), true);
    assert.equal(isMathContext('موضوع حر غير موجود في المنهاج', null), false);
  });
});
