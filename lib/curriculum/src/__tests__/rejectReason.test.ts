/**
 * The six gates `extract-text.ts` runs on any candidate text — from
 * pdf-parse or from the OCR fallback alike, which is why this lives beside
 * `lamTranspositionRate` in `textQuality.ts` rather than inside
 * `extract-text.ts` itself (that file ends in a top-level `await main()`;
 * importing anything from it runs a real extraction).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ARABIC_WORDS_TO_JUDGE,
  arabicWordCount,
  lamTranspositionRate,
  rejectReason,
  wordTranspositionRate,
} from '../../scripts/textQuality.ts';

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

  it('rejects letters transposed inside common words, which the article probe misses', () => {
    // The real shape of islamic-s2-student-book: «في»→«يف», «على»→«عىل»,
    // «الله»→«اهلل». It scored 18% on lamTranspositionRate — under that
    // gate's 40% limit — and was marked `ingested` before this check existed.
    const transposed = 'يف عىل اهلل يف عىل اهلل '.repeat(30);
    assert.match(rejectReason(transposed)!, /transposed inside common words/);
  });

  it('does not condemn clean Arabic that uses those words honestly', () => {
    const honest = 'في المدرسة على الطاولة الله أعلم في البيت على الطريق '.repeat(30);
    assert.equal(wordTranspositionRate(honest), 0);
    assert.equal(rejectReason(honest), null);
  });

  it('needs 100 samples before it will judge, like the article probe', () => {
    assert.equal(wordTranspositionRate('يف عىل اهلل'), null);
    assert.equal(rejectReason('يف عىل اهلل ' + CLEAN), null);
  });

  it('matches whole words only — «يفعل» is not evidence of transposition', () => {
    // A prefix probe would read every «يفعل»/«يفهم» as a broken «في».
    assert.equal(wordTranspositionRate('يفعل يفهم يفتح '.repeat(60)), null);
  });

  it('rejects a long Arabic document neither probe can sample at all', () => {
    // The blind spot that let `chem-s1-summary-shawata` through: a wrong font
    // cmap yields Arabic letters that spell nothing, so no «في» survives and no
    // «يف» is created either. Both probes answer `null` for want of samples,
    // `rejectReason` skips a `null`, and the document passed *because* none of
    // its Arabic was readable. Text below is the shape of the real thing.
    const garbled = 'ػذد ١ِّضاد اٌط١ف اٌّشئ ٟ ٣ٔضَ اُؼٞء اُؼبد١ ك٢ اُلؼبء '.repeat(400);
    assert.ok(arabicWordCount(garbled) >= MIN_ARABIC_WORDS_TO_JUDGE);
    assert.equal(lamTranspositionRate(garbled), null, 'probe should find nothing to sample');
    assert.equal(wordTranspositionRate(garbled), null, 'probe should find nothing to sample');
    assert.match(rejectReason(garbled)!, /spell nothing/);
  });

  it('stays silent on a short or English document that is blind for honest reasons', () => {
    // The other half, and the one that decides whether this check is usable.
    // An English coursebook or a worksheet of equations carries too little
    // Arabic to probe, and must not be condemned for it — `math-foundation-lafi`
    // is real: 1,956 Arabic words, mostly equations, and perfectly readable.
    const equations = '٥ ÷ ١٧٠ = \nاجب: \n−𝟖 × 𝟏 = \n'.repeat(200);
    assert.ok(arabicWordCount(equations) < MIN_ARABIC_WORDS_TO_JUDGE);
    assert.equal(rejectReason(equations), null);
    assert.equal(rejectReason('Unit 3: Vectors and Motion. '.repeat(500)), null);
  });

  it('counts Arabic words without the g-flag statefulness bug', () => {
    // `.test` on a `/g/` regex advances `lastIndex`, so a shared one would skip
    // every other token and halve the count — which would quietly disable the
    // gate above by keeping every document under the threshold.
    assert.equal(arabicWordCount('الحركة والقوى في الفضاء'), 4);
    assert.equal(arabicWordCount('الحركة English الفضاء'), 2);
    assert.equal(arabicWordCount('nothing arabic here'), 0);
  });

  it('names the specific corruption when it can, rather than the blindness', () => {
    // The new check is last on purpose: it is the weakest evidence of the six.
    // A file that is both unreadable *and* transposed should be reported as
    // transposed, because that names what to fix.
    const transposed = 'يف عىل اهلل '.repeat(200);
    assert.match(rejectReason(transposed)!, /transposed inside common words/);
  });

  it('does not let one gate mask another — control chars checked before transposition', () => {
    // A document could plausibly fail two gates; the function should still
    // return *a* reason, not throw or silently pass.
    const both = '\x01\x02'.repeat(50) + 'احلركة امليكانيكا '.repeat(30);
    assert.notEqual(rejectReason(both), null);
  });
});
