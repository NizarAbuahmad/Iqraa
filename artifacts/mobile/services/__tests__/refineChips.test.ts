/**
 * A refinement is not a topic.
 *
 * «✏️ حسّن خطة الدرس» and «🔥 اجعل الاختبار أصعب» ask the chat to change what it
 * just made. Their words are the change, not a lesson — but the chat read the
 * whole message as a topic, because `topicFromQuery` only knows the words of a
 * *creation* ask. «حسّن الدرس «تركيب الاقترانات» واجعلها أوضح للتنفيذ في الحصة
 * القادمة» titled the saved plan, was the topic handed to the generator and
 * opened the reply; «اجعله أبسط» titled one «اجعله أبسط». Three or more
 * characters beat the lesson on the card, so nothing downstream could correct it.
 *
 * In English the same chips were not routed as refinements at all («Improve the
 * current lesson plan…», «Make the quiz harder…» classified as a new artifact),
 * so they also lost a soft-pinned lesson (`shouldReuseActiveLesson` only keeps it
 * for an `artifact` that is a bare shortcut).
 *
 * The strings below are built from the real chips, not retyped.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import { resolveArtifactTopic } from '../ai/artifactTopic.ts';
import { buildLessonSuggestions, pinLesson } from '../lessonCopilot.ts';
import { getLessonById } from '../knowledgeBase.ts';

const lesson = getLessonById('kbl-math-s2-nccd-u5_l3')!;
const pinned = pinLesson(emptyChatSessionMemory(), lesson, 'hard');

/** What a chip sends, for the chat that has just made `made`. */
function chipPrompt(made: 'lesson-plan' | 'quiz', id: string, lang: 'ar' | 'en'): string {
  const memory = { ...pinned, discussedArtifacts: [made], lastGeneratedResource: made };
  const chip = buildLessonSuggestions(memory, lang, false).find(s => s.id === id);
  assert.ok(chip, `no «${id}» chip after a ${made}`);
  return lang === 'ar' ? chip.promptAr : chip.promptEn;
}

const CHIPS = [
  { name: 'refine the plan', made: 'lesson-plan', id: 'refine-plan' },
  { name: 'make the quiz harder', made: 'quiz', id: 'harder-quiz' },
] as const;

const topicOf = (lang: 'ar' | 'en') => (lang === 'ar' ? lesson.titleAr : lesson.titleEn);

/** The chat's own inputs when no lesson has been matched yet (the first call in iqra.tsx). */
const resolve = (lang: 'ar' | 'en', query: string, extra: { lesson?: typeof lesson | null } = {}) =>
  resolveArtifactTopic({
    lang,
    query,
    lesson: extra.lesson ?? null,
    activeTopicAr: lesson.titleAr,
    activeTopicEn: lesson.titleEn,
    refinement: true,
  });

describe('the improve chips are routed as refinements, in both languages', () => {
  for (const chip of CHIPS) {
    for (const lang of ['ar', 'en'] as const) {
      it(`${chip.name} (${lang})`, () => {
        const prompt = chipPrompt(chip.made, chip.id, lang);
        const route = classifyChatIntent(prompt, lang, false, undefined, { activeLessonTitle: topicOf(lang) });
        assert.equal(route.intent, 'refinement', prompt);
      });
    }
  }

  const TYPED: [string, 'ar' | 'en'][] = [
    ['اجعل الاختبار أصعب', 'ar'],
    ['حسّن خطة الدرس', 'ar'],
    ['اجعله أبسط', 'ar'],
    ['Make the quiz harder', 'en'],
    ['make the worksheet easier', 'en'],
    ['Improve the lesson plan', 'en'],
    ['improve my lesson plan', 'en'],
    ['make the lesson plan clearer', 'en'],
  ];
  for (const [ask, lang] of TYPED) {
    it(`typed «${ask}»`, () => {
      assert.equal(classifyChatIntent(ask, lang).intent, 'refinement');
    });
  }

  // "improve" and "harder" are everyday words; only a named material is a refinement.
  const NOT_REFINEMENTS: [string, 'ar' | 'en', string][] = [
    ['how can I improve my teaching?', 'en', 'teaching'],
    ['improve student engagement', 'en', 'teaching'],
    ['make students work harder', 'en', 'teaching'],
    ['make a worksheet for harder topics', 'en', 'artifact'],
  ];
  for (const [ask, lang, intent] of NOT_REFINEMENTS) {
    it(`typed «${ask}» is still ${intent}`, () => {
      assert.equal(classifyChatIntent(ask, lang).intent, intent);
    });
  }
});

describe('a refinement names no topic of its own', () => {
  for (const chip of CHIPS) {
    for (const lang of ['ar', 'en'] as const) {
      it(`${chip.name} (${lang}): the topic is the lesson on the card, not the sentence`, () => {
        const prompt = chipPrompt(chip.made, chip.id, lang);
        assert.equal(resolve(lang, prompt), topicOf(lang), prompt);
      });

      it(`${chip.name} (${lang}): once a lesson is matched, its title wins`, () => {
        const prompt = chipPrompt(chip.made, chip.id, lang);
        assert.equal(resolve(lang, prompt, { lesson }), topicOf(lang), prompt);
      });
    }
  }

  const TYPED: [string, 'ar' | 'en'][] = [
    ['اجعله أبسط', 'ar'],
    ['اجعل الاختبار أصعب', 'ar'],
    ['اجعل ورقة العمل أسهل للضعفاء', 'ar'],
    ['حسّن خطة الدرس', 'ar'],
    ['Make the quiz harder', 'en'],
    ['Improve the lesson plan', 'en'],
    ['make it harder', 'en'],
  ];
  for (const [ask, lang] of TYPED) {
    it(`typed «${ask}» does not title the material`, () => {
      assert.equal(resolve(lang, ask), topicOf(lang));
    });
  }

  // The chip fences its topic in quotes, and so can a teacher. That is the one
  // way a refinement can name a lesson, so it is honoured.
  it('a topic the teacher fences in quotes is the topic', () => {
    assert.equal(resolve('ar', 'حسّن خطة الدرس عن «الدائرة» واجعلها أوضح للتنفيذ'), 'الدائرة');
    assert.equal(resolve('ar', 'اجعل الاختبار عن «الدائرة» أصعب'), 'الدائرة');
    assert.equal(resolve('en', 'Improve the lesson plan for "circles" and make it clearer'), 'circles');
    assert.equal(resolve('en', 'Improve the lesson plan for “circles” and make it clearer'), 'circles');
  });

  // With no lesson open the chip says «الدرس الحالي» — a pointer, not a name.
  it('a quoted pointer at the current lesson is not a topic', () => {
    assert.equal(resolve('ar', 'حسّن خطة الدرس عن «الدرس الحالي» واجعلها أوضح للتنفيذ في الحصة القادمة'), lesson.titleAr);
    assert.equal(resolve('en', 'Improve the current lesson plan for "the current lesson" and make it clearer'), lesson.titleEn);
  });

  it('a creation ask is untouched: its words still carry the topic', () => {
    const create = (lang: 'ar' | 'en', query: string) =>
      resolveArtifactTopic({
        lang, query, lesson: null, activeTopicAr: lesson.titleAr, activeTopicEn: lesson.titleEn,
      });
    assert.equal(create('ar', 'جهّز ورقة عمل صفية عن: الدائرة'), 'الدائرة');
    assert.equal(create('en', 'Create a short quiz about: circles'), 'circles');
    // …and a quote in one is left to `topicFromQuery`, as before.
    assert.equal(create('ar', 'جهّز اختباراً قصيراً عن الدائرة'), 'الدائرة');
  });
});

describe('the chat tells resolveArtifactTopic when the ask is a refinement', () => {
  // iqra.tsx cannot be loaded here (it imports react-native), and it resolves the
  // topic twice — once to rank lessons, once for the title. A second call that
  // forgot the flag would bring the sentence back as the title.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const source = readFileSync(join(root, 'app', '(tabs)', 'iqra.tsx'), 'utf8');

  it('every resolveArtifactTopic call in the chat passes it', () => {
    const calls = source.match(/resolveArtifactTopic\(\{/g) ?? [];
    const flags = source.match(/refinement: route\.intent === 'refinement'/g) ?? [];
    assert.ok(calls.length >= 2, `expected the chat to resolve the topic twice, found ${calls.length}`);
    assert.equal(flags.length, calls.length, 'a resolveArtifactTopic call without the refinement flag');
  });
});
