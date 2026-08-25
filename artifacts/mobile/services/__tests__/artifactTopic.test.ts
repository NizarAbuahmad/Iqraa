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

  /**
   * The strings the product actually sends.
   *
   * Every chip prompt in `iqra.tsx` and `lessonCopilot.ts` is built as
   * `«…عن: ${topic}»` — colon included. Tapping a chip is the most common way
   * a material gets generated, so these are the cases that decide what a saved
   * material is called and what heads its first projected slide. The earlier
   * fix was tested only against hand-typed asks and missed every one of them.
   */
  it('handles the colon the app’s own chips send', () => {
    const topic = 'تركيب الاقترانات';
    for (const prompt of [
      `حضّر خطة درس كاملة عن: ${topic}`,
      `أنشئ ورقة عمل صفية عن: ${topic}`,
      `أنشئ واجباً منزلياً عن: ${topic}`,
      `جهّز اختباراً قصيراً عن: ${topic}`,
      `اقترح نشاطاً صفياً عن: ${topic}`,
    ]) {
      assert.equal(ar(prompt), topic, `chip prompt kept its preposition: ${prompt}`);
    }
  });

  it('handles the English chips the same way', () => {
    assert.equal(en('Prepare a full lesson plan about: Function Composition'), 'Function Composition');
    assert.equal(en('Create a short quiz about: Circles'), 'Circles');
  });

  /**
   * The Arabic the chips are actually written in.
   *
   * «واجباً», «اختباراً», «نشاطاً» arrive inflected while the strip list holds
   * bare stems, so matching the stem alone left the accusative tail behind as
   * its own word — «أنشئ واجباً منزلياً عن: الدائرة» became «اً منزلياً الدائرة».
   */
  it('strips an inflected noun whole, tail included', () => {
    assert.equal(ar('أنشئ واجباً منزلياً عن: الدائرة'), 'الدائرة');
    assert.equal(ar('جهّز اختباراً قصيراً عن: الدائرة'), 'الدائرة');
    assert.equal(ar('اقترح نشاطاً صفياً عن: الدائرة'), 'الدائرة');
  });

  it('strips what describes the artifact, not the topic', () => {
    // «صفية» describes the worksheet. It only becomes a leading word once
    // «ورقة عمل» in front of it is gone, which is why removal repeats.
    assert.equal(ar('أنشئ ورقة عمل صفية عن: الدائرة'), 'الدائرة');
    assert.equal(en('Prepare a full lesson plan about: Circles'), 'Circles');
    assert.equal(en('Create an in-class worksheet about: Circles'), 'Circles');
  });

  it('leaves real curriculum topics untouched', () => {
    // The strip is a word blacklist, so the risk it carries is eating a topic.
    for (const topic of [
      'تركيب الاقترانات', 'الدائرة', 'المتجهات', 'حساب المثلثات',
      'الإحصاء والاحتمالات', 'كثيرات الحدود', 'المشتقات', 'قانون الجيوب',
      'الاقتران الجذري', 'الأسس والمعادلات',
    ]) {
      assert.equal(ar(topic), topic, `ate part of a bare topic: ${topic}`);
    }
    // 'class' is deliberately not a qualifier — it would strip this to
    // "Management".
    assert.equal(en('Class Management'), 'Class Management');
  });

  it('never leaves a stranded separator at the front', () => {
    for (const prompt of ['خطة درس: الدائرة', 'خطة درس — الدائرة', 'خطة درس عن : الدائرة']) {
      const out = ar(prompt);
      assert.ok(!/^[:：،,\-–—]/.test(out), `left a separator: "${out}" from "${prompt}"`);
    }
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
