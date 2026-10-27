/**
 * The words on the chat's first screen and in its working states.
 *
 * Copy is not testable for taste, but four things about it were wrong in ways
 * a test can hold:
 *   - the pitch listed three vague activities («التخطيط، اقتراح الأفكار») and
 *     closed on a stock «كيف أدعمك اليوم؟» instead of naming what can be asked;
 *   - the placeholder was an instruction with no example — and an example is
 *     only a kindness if the router handles it, so it is run through the same
 *     `isBareArtifactShortcut` the chat uses;
 *   - the assistant spoke as «أنا» in its answers and as a third person
 *     («يراجع إقرأ طلبك…», «يجري تجهيز المادة…») in its status lines;
 *   - the failure line blamed «العملية», which a teacher never started.
 * `getT` is a plain function, so both languages run without a React tree.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getT, type Lang } from '../i18n.ts';
import { isBareArtifactShortcut } from '../lessonCopilot.ts';

const LANGS: Lang[] = ['ar', 'en'];

/** What the first screen's chips and the prep board make: the pitch has to name them. */
const MATERIALS: Record<Lang, RegExp[]> = {
  ar: [/خطة درس/, /ورقة عمل/, /اختبار/, /نشاط/],
  en: [/lesson plan/i, /worksheet/i, /quiz/i, /activity/i],
} as Record<Lang, RegExp[]>;

describe('the chat pitch names what can be asked', () => {
  for (const lang of LANGS) {
    const pitch = getT(lang)('iqraAgentPitch');

    it(`${lang}: names every material the chips offer`, () => {
      for (const material of MATERIALS[lang]) assert.match(pitch, material);
    });

    it(`${lang}: does not close on a stock customer-service line`, () => {
      assert.doesNotMatch(pitch, /كيف أدعمك|What do you need today|How can I help/i);
    });
  }
});

describe('the composer placeholder teaches a request the chat understands', () => {
  const EXAMPLE: Record<Lang, RegExp> = {
    ar: /مثل:\s*(.+)$/,
    en: /e\.g\.\s*(.+)$/i,
  } as Record<Lang, RegExp>;

  for (const lang of LANGS) {
    const placeholder = getT(lang)('iqraPlaceholder');

    it(`${lang}: carries an example`, () => {
      assert.match(placeholder, EXAMPLE[lang]);
    });

    // The web composer is one row. Measured on a 390px phone, its 248px field
    // holds about 39 characters of this font before the placeholder wraps; a
    // narrower phone holds fewer, so keep well inside that.
    it(`${lang}: is short enough to stay on one line on a phone`, () => {
      assert.ok(placeholder.length <= 34, `${placeholder.length} characters: «${placeholder}»`);
    });

    it(`${lang}: the example asks about the picked lesson, not a lesson of that name`, () => {
      const example = placeholder.match(EXAMPLE[lang])![1]!;
      assert.equal(
        isBareArtifactShortcut(example),
        true,
        `«${example}» would be read as a topic, so the chat would look for a lesson called that`,
      );
    });
  }
});

describe('the assistant speaks as «I» while it works', () => {
  const STATUS = ['iqraTyping', 'iqraGeneratingLessonPlan', 'iqraGeneratingArtifact'] as const;

  it('ar: each status line opens with a first-person verb, not the product name', () => {
    const t = getT('ar');
    for (const key of STATUS) {
      const line = t(key);
      assert.match(line, /^أ/, `${key}: «${line}»`);
      assert.doesNotMatch(line, /إقرأ|يجري/, `${key}: «${line}»`);
    }
  });

  it('en: no status line names the product in the third person', () => {
    const t = getT('en');
    for (const key of STATUS) assert.doesNotMatch(t(key), /Iqrra is/, key);
  });
});

describe('the failure line says what to do', () => {
  it('ar: no «العملية», and a way forward', () => {
    const line = getT('ar')('iqraChatError');
    assert.doesNotMatch(line, /العملية/);
    assert.match(line, /حاول مرة أخرى/);
  });

  it('en: a way forward', () => {
    assert.match(getT('en')('iqraChatError'), /try again/i);
  });
});
