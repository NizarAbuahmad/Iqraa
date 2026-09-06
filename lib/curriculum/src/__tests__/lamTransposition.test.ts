/**
 * The definite-article transposition check.
 *
 * This defect is the reason the test exists: the physics S1 teacher guide
 * extracted 391,551 characters of Arabic that reads correctly to a skimming
 * eye, passed both existing quality gates, was recorded `ingested`, and was
 * only caught when someone read a line closely enough to notice «الحركة» had
 * become «احلركة». The gate that now catches it is only as good as its
 * threshold, so the threshold is pinned here rather than left to drift.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lamTranspositionRate } from '../../scripts/textQuality.ts';

/** Repeat to clear the 100-sample floor the detector needs before it judges. */
const many = (words: string[]): string => Array.from({ length: 40 }, () => words.join(' ')).join(' ');

describe('lamTranspositionRate', () => {
  it('scores clean Arabic near zero', () => {
    const rate = lamTranspositionRate(many(['الحركة', 'الميكانيكا', 'المعلم', 'المتجهات', 'الجسم']));
    assert.notEqual(rate, null);
    assert.ok(rate! < 0.1, `clean Arabic scored ${rate}`);
  });

  it('scores fully transposed Arabic near one', () => {
    const rate = lamTranspositionRate(many(['احلركة', 'امليكانيكا', 'املعلم', 'املتجهات', 'اجلسم']));
    assert.notEqual(rate, null);
    assert.ok(rate! > 0.9, `transposed Arabic scored ${rate}`);
  });

  it('does not accuse real words that merely look like the defect', () => {
    // The reason a generic ا + consonant + ل probe was rejected: these are
    // ordinary Arabic, and an earlier draft flagged every clean file at
    // 10-15% because of words shaped like them. None of them starts with a
    // pair the detector counts, so they contribute nothing either way — the
    // article words carry the sample count past the floor.
    const rate = lamTranspositionRate(many(['اكتمل', 'اعلم', 'اشتمل', 'استقبل',
      'الحركة', 'الميكانيكا', 'المعلم']));
    assert.notEqual(rate, null);
    assert.ok(rate! < 0.1, `honest Arabic scored ${rate}`);
  });

  it('refuses to judge a sample too small to mean anything', () => {
    // An English or figure-heavy page is not evidence either way. Returning a
    // number here would let one stray word condemn a whole document.
    assert.equal(lamTranspositionRate('الحركة والقوى'), null);
    assert.equal(lamTranspositionRate('Motion and Forces, page 12'), null);
    assert.equal(lamTranspositionRate(''), null);
  });

  it('puts the real corpus on the correct side of the 0.4 cut', () => {
    // Measured values from the 49 documents on file when the gate was written:
    // the clean ones topped out at 12.7% and the corrupted ones started at
    // 42.9%. Anything that narrows that gap means the threshold needs
    // revisiting, not that this test needs relaxing.
    const clean = lamTranspositionRate(many(['المتجهات', 'الحركة', 'المقذوفات', 'الجاذبية', 'المعلم']));
    const corrupt = lamTranspositionRate(many(['املتجهات', 'احلركة', 'املقذوفات', 'اجلاذبية', 'املعلم']));
    assert.ok(clean! < 0.4, `clean side of the cut: ${clean}`);
    assert.ok(corrupt! > 0.4, `corrupt side of the cut: ${corrupt}`);
  });
});
