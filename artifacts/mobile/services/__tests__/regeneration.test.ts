/**
 * What the screen sends back when a teacher presses "regenerate".
 *
 * The button used to re-run the same request, and the same prompt came back as
 * the same questions reworded. These two fields are what make it a different
 * request: the stems on screen, so a fresh generation can be steered off them,
 * and the pool variant on screen, so a shared one is never handed back.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { avoidSignatures, regenerationFields } from '../ai/regeneration.ts';

const QUIZ = {
  title: 'اختبار في كثيرات الحدود',
  variantId: 'variant-uuid-1',
  questions: [
    { id: 'q1', text: 'حلّل كثيرة الحدود التالية إلى عواملها', options: ['أ', 'ب'], points: 2 },
    { id: 'q2', text: 'جد ناتج قسمة كثيرة الحدود على العامل', points: 2 },
  ],
};

describe('avoidSignatures', () => {
  it('collects the stems a teacher is looking at', () => {
    const lines = avoidSignatures(QUIZ);
    assert.ok(lines.includes('حلّل كثيرة الحدود التالية إلى عواملها'));
    assert.ok(lines.includes('جد ناتج قسمة كثيرة الحدود على العامل'));
  });

  it('reaches into a worksheet’s nested sections', () => {
    // One walk for six artifact shapes. A per-shape extractor would fail by
    // finding nothing to avoid, which looks exactly like a good regeneration.
    const lines = avoidSignatures({
      title: 'ورقة عمل حول المشتقات',
      sections: [{ title: 'القسم الأول', questions: [{ text: 'اشتق الاقتران بالنسبة إلى س' }] }],
    });
    assert.ok(lines.includes('اشتق الاقتران بالنسبة إلى س'));
  });

  it('skips short labels every artifact of a kind shares', () => {
    assert.deepEqual(avoidSignatures({ title: 'الأسئلة' }), []);
  });

  it('leaves option text alone — the question is what must not repeat', () => {
    assert.ok(!avoidSignatures(QUIZ).includes('أ'));
  });

  it('survives whatever the mock generator or a failed parse hands it', () => {
    assert.deepEqual(avoidSignatures(null), []);
    assert.deepEqual(avoidSignatures(undefined), []);
    assert.deepEqual(avoidSignatures([]), []);
  });
});

describe('regenerationFields', () => {
  it('adds nothing on a first generation', () => {
    // The common path must send byte-for-byte what it sent before any of this
    // existed, so the server runs the neutral prompt the generators were
    // tuned against.
    assert.deepEqual(regenerationFields(false, QUIZ), {});
    assert.deepEqual(regenerationFields(true, null), {});
  });

  it('sends the flag, the stems and the variant on screen', () => {
    const fields = regenerationFields(true, QUIZ);
    assert.equal(fields.regenerate, true);
    assert.deepEqual(fields.excludeVariantIds, ['variant-uuid-1']);
    assert.ok((fields.avoid ?? []).length >= 2);
  });

  it('still varies a result that came from the mock generator', () => {
    // MockAIService output carries no variantId — RemoteAIService falls back to
    // it on any failure. The stems are still there, so the regeneration is
    // steered even when there is no pool variant to exclude.
    const { variantId, ...noVariant } = QUIZ;
    const fields = regenerationFields(true, noVariant);
    assert.equal(fields.regenerate, true);
    assert.equal(fields.excludeVariantIds, undefined);
    assert.ok((fields.avoid ?? []).length >= 2);
  });
});
