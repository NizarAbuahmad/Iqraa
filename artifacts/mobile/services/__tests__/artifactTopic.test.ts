/**
 * Topic resolution for chat-generated materials.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/artifactTopic.test.ts
 *
 * The topic is not just a generator input — it titles the saved material and
 * heads the first slide when the material is projected. «خطة درس عن تركيب
 * الاقترانات» was resolving to «عن تركيب الاقترانات», so a class saw a slide
 * titled "About Function Composition". Two rules meant to prevent that never
 * fired in Arabic: `^` was anchored against a string that still began with the
 * spaces the verb strip left, and `\\b` is defined by [A-Za-z0-9_], so `\\bعن\\b`
 * cannot match between Arabic letters.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveArtifactTopic } from '../ai/artifactTopic.ts';

const base = {
  lesson: null,
  activeTopicAr: null,
  activeTopicEn: null,
};

const ar = (query: string) => resolveArtifactTopic({ ...base, lang: 'ar', query });
const en = (query: string) => resolveArtifactTopic({ ...base, lang: 'en', query });

describe('resolveArtifactTopic — the preposition the ask leaves behind', () => {
  it('drops عن from an Arabic request', () => {
    assert.equal(ar('حضّر خطة درس عن تركيب الاقترانات'), 'تركيب الاقترانات');
    assert.equal(ar('أنشئ ورقة عمل عن الدائرة'), 'الدائرة');
    assert.equal(ar('جهز اختبار قصير حول المشتقات'), 'المشتقات');
  });

  it('drops it wherever it sits, not only at the start', () => {
    assert.equal(ar('خطة درس كاملة عن المتجهات'), 'المتجهات');
  });

  it('drops the English preposition, and the article it strands', () => {
    assert.equal(en('prepare a lesson plan about function composition'), 'function composition');
    assert.equal(en('create a worksheet for circles'), 'circles');
  });

  it('keeps a topic that is only a topic', () => {
    assert.equal(ar('تركيب الاقترانات'), 'تركيب الاقترانات');
    assert.equal(ar('خطة درس المتجهات'), 'المتجهات');
  });
});

describe('resolveArtifactTopic — sources, in order', () => {
  it('prefers uploaded documents when asked to', () => {
    assert.equal(
      resolveArtifactTopic({
        ...base, lang: 'ar', query: 'خطة درس', docTopic: 'ملف الوحدة الثالثة', preferDocuments: true,
      }),
      'ملف الوحدة الثالثة',
    );
  });

  it('falls back to the active lesson when the ask names no topic', () => {
    assert.equal(
      resolveArtifactTopic({
        ...base, lang: 'ar', query: 'خطة درس', activeTopicAr: 'الاقترانات',
      }),
      'الاقترانات',
    );
  });
});
