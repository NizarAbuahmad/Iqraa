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
import { avoidSignatures, pooledVariantId, regenerationFields } from '../ai/regeneration.ts';

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

  it('includes a worksheet\u2019s worked example, so a regenerated paper does not hand the same one back', () => {
    const lines = avoidSignatures({
      title: 'ورقة عمل حول الأسس',
      workedExample: { problem: 'حل المعادلة 2^(x+1) = 32 بتوحيد الأساس', steps: ['نكتب 32 = 2^5 أولًا ثم نساوي الأسس'], answer: 'x = 4' },
      sections: [],
    });
    assert.ok(lines.includes('حل المعادلة 2^(x+1) = 32 بتوحيد الأساس'));
    assert.ok(!lines.some(l => l.includes('نكتب 32')), 'working lines are not stems');
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

describe('pooledVariantId', () => {
  it('returns the id of an artifact that came from the shared pool', () => {
    assert.equal(pooledVariantId(QUIZ), 'variant-uuid-1');
  });

  it('returns nothing for an artifact nobody else can be served', () => {
    // A mock-generator fallback, an unreachable pool, or a request carrying the
    // teacher's own material — none of them are in the pool, so offering to
    // withdraw one would be a button that does nothing. A button that does
    // nothing teaches teachers to distrust the ones that do.
    const { variantId, ...notPooled } = QUIZ;
    assert.equal(pooledVariantId(notPooled), undefined);
  });

  it('ignores a variantId that is not a usable string', () => {
    assert.equal(pooledVariantId({ variantId: '' }), undefined);
    assert.equal(pooledVariantId({ variantId: '   ' }), undefined);
    assert.equal(pooledVariantId({ variantId: 42 }), undefined);
  });

  it('survives whatever a failed generation leaves on screen', () => {
    assert.equal(pooledVariantId(null), undefined);
    assert.equal(pooledVariantId(undefined), undefined);
    assert.equal(pooledVariantId('a string'), undefined);
  });
});
