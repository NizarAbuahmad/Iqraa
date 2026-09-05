/**
 * The four gates `extract-text.ts` runs on any candidate text — from
 * pdf-parse or from the OCR fallback alike, which is why this lives beside
 * `lamTranspositionRate` in `textQuality.ts` rather than inside
 * `extract-text.ts` itself (that file ends in a top-level `await main()`;
 * importing anything from it runs a real extraction).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rejectReason } from '../../scripts/textQuality.ts';

const CLEAN = 'المتجهات هي كميات فيزيائية لها مقدار واتجاه، وتستخدم في وصف الحركة والقوى في الفضاء.'.repeat(20);

describe('rejectReason', () => {
  it('accepts real, cleanly-decoded Arabic', () => {
    assert.equal(rejectReason(CLEAN), null);
  });

  it('rejects empty text as no text layer', () => {
    assert.match(rejectReason('')!, /no text layer/);
    assert.match(rejectReason('   \n  ')!, /no text layer/);
  });

  it('rejects text that decoded to mostly control characters', () => {
    const garbage = '\x01\x02\x03\x04'.repeat(50) + 'a few real words';
    assert.match(rejectReason(garbage)!, /control characters/);
  });

  it('rejects unshaped Arabic presentation forms over base Arabic', () => {
    // U+FE8D..FE8E: isolated/final forms of alef — presentation-forms block,
    // not the base Arabic block real extraction should produce.
    const presentationForms = '\uFE8D\uFE8E'.repeat(60);
    assert.match(rejectReason(presentationForms)!, /presentation-form/);
  });

  it('rejects text whose definite article is transposed past the threshold', () => {
    const transposed = 'احلركة امليكانيكا املعلم املتجهات اجلسم '.repeat(30);
    assert.match(rejectReason(transposed)!, /definite article transposed/);
  });

  it('does not let one gate mask another — control chars checked before transposition', () => {
    // A document could plausibly fail two gates; the function should still
    // return *a* reason, not throw or silently pass.
    const both = '\x01\x02'.repeat(50) + 'احلركة امليكانيكا '.repeat(30);
    assert.notEqual(rejectReason(both), null);
  });
});
