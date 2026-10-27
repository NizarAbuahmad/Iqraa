/**
 * The two refine chips — «حسّن خطة الدرس» and «اجعل الاختبار أصعب».
 *
 * They sent a sentence that names no new topic, and the chat read the sentence
 * as the topic: the saved plan was titled «خطة درس: حسّن الدرس «تركيب
 * الاقترانات» واجعلها أوضح للتنفيذ في الحصة القادمة» and its text said «أين نلتقي
 * بحسّن الدرس …». The quiz chip, «اجعل الاختبار أصعب وأضف سؤالين», has no topic in
 * it at all, so the whole sentence was the topic. English was worse: the router
 * did not know «Improve…» or «Make the quiz harder» for a refinement, so both
 * chips were treated as a request for a NEW material.
 *
 * A refinement edits what is already in the thread. Its topic is the lesson in
 * play — the chip carries the lesson's id — never something read back out of the
 * sentence (a title does not identify a lesson; see CLAUDE.md).
 *
 * The prompts are built by `buildLessonSuggestions`, not retyped: the earlier
 * topic fix was tested only against hand-typed asks and missed every string the
 * product actually sends.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { editsLessonInPlay, resolveArtifactTopic } from '../ai/artifactTopic.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import {
  emptyChatSessionMemory,
  type ChatSessionMemory,
  type SessionArtifact,
} from '../ai/teachingAssistant.ts';
import { buildLessonSuggestions } from '../lessonCopilot.ts';
import { getLessonById } from '../knowledgeBase.ts';

const lesson = getLessonById('kbl-math-s2-nccd-u5_l3')!;

function chip(last: SessionArtifact, id: string, lang: 'ar' | 'en'): string {
  const memory: ChatSessionMemory = {
    ...emptyChatSessionMemory(),
    activeLessonId: lesson.id,
    activeTopicAr: lesson.titleAr,
    activeTopicEn: lesson.titleEn,
    lastGeneratedResource: last,
    generatedResources: [{ type: last, updatedAt: 0 }],
    lessonPin: 'hard',
  };
  const found = buildLessonSuggestions(memory, lang, false).find(s => s.id === id);
  assert.ok(found, `no «${id}» chip after a ${last}`);
  return lang === 'ar' ? found.promptAr : found.promptEn;
}

/** What `iqra.tsx` does for the artifact branch: route, then resolve the topic. */
function topicFor(prompt: string, lang: 'ar' | 'en'): string {
  const { intent } = classifyChatIntent(prompt, lang);
  const refinement = editsLessonInPlay(intent, prompt);
  return resolveArtifactTopic({
    lang,
    query: prompt,
    lesson: refinement ? lesson : null,
    refinement,
    activeTopicAr: lesson.titleAr,
    activeTopicEn: lesson.titleEn,
  });
}

const CHIPS: { last: SessionArtifact; id: string }[] = [
  { last: 'lesson-plan', id: 'refine-plan' },
  { last: 'quiz', id: 'harder-quiz' },
];

describe('the refine chips are refinements, in both languages', () => {
  for (const { last, id } of CHIPS) {
    for (const lang of ['ar', 'en'] as const) {
      it(`${id} (${lang}) routes as a refinement`, () => {
        const prompt = chip(last, id, lang);
        assert.equal(classifyChatIntent(prompt, lang).intent, 'refinement', prompt);
      });
    }
  }

  it('does not turn a request for a new material into a refinement', () => {
    for (const q of [
      'Make a harder quiz on circles',
      'Make me a worksheet about fractions',
      'Create a lesson plan to improve reading',
      'Improve my classroom management',
    ]) {
      assert.notEqual(classifyChatIntent(q, 'en').intent, 'refinement', q);
    }
  });
});

describe('a refine chip keeps the picked lesson as its topic', () => {
  for (const { last, id } of CHIPS) {
    it(`${id} (ar) is titled with the lesson, not the sentence`, () => {
      assert.equal(topicFor(chip(last, id, 'ar'), 'ar'), lesson.titleAr);
    });
    it(`${id} (en) is titled with the lesson, not the sentence`, () => {
      assert.equal(topicFor(chip(last, id, 'en'), 'en'), lesson.titleEn);
    });
  }

  it('the title never carries the edit instruction', () => {
    for (const { last, id } of CHIPS) {
      for (const lang of ['ar', 'en'] as const) {
        const topic = topicFor(chip(last, id, lang), lang);
        assert.doesNotMatch(topic, /حسّن|أصعب|اجعل|Improve|harder|clearer/i, topic);
      }
    }
  });

  it('a typed refinement in free wording stays on the lesson too', () => {
    for (const q of ['اجعله أصعب', 'عدّل الاختبار وأضف سؤالين', 'اجعل الخطة أبسط للطلاب الضعفاء']) {
      const { intent } = classifyChatIntent(q, 'ar');
      assert.equal(intent, 'refinement', q);
      assert.equal(
        resolveArtifactTopic({
          lang: 'ar', query: q, lesson, refinement: editsLessonInPlay(intent, q),
          activeTopicAr: null, activeTopicEn: null,
        }),
        lesson.titleAr,
        q,
      );
    }
  });
});

describe('a refinement that is really a new ask keeps its own topic', () => {
  // «أصعب» sends the router to `refinement`, but «أنشئ اختبار أصعب عن الدائرة»
  // asks for a quiz on circles. It named its topic before this change, and
  // must keep naming it rather than snapping back to the open lesson.
  it('a create verb means the message names its own topic', () => {
    for (const q of [
      'أنشئ اختباراً أصعب عن الدائرة',
      'جهّز ورقة عمل أسهل عن المتجهات',
      'Create a harder quiz about circles',
    ]) {
      assert.equal(editsLessonInPlay('refinement', q), false, q);
    }
  });

  it('only a refinement can edit the lesson in play', () => {
    assert.equal(editsLessonInPlay('artifact', 'اجعله أصعب'), false);
    assert.equal(editsLessonInPlay('teaching', 'اجعله أصعب'), false);
    assert.equal(editsLessonInPlay('refinement', 'اجعله أصعب'), true);
  });

  it('and the open lesson does not replace it', () => {
    const topic = resolveArtifactTopic({
      lang: 'ar', query: 'جهّز اختباراً أصعب عن الدائرة', lesson: null, refinement: false,
      activeTopicAr: lesson.titleAr, activeTopicEn: lesson.titleEn,
    });
    assert.match(topic, /الدائرة/);
    assert.notEqual(topic, lesson.titleAr);
  });
});

describe('uploaded documents still win', () => {
  it('a refinement does not override a document topic', () => {
    assert.equal(
      resolveArtifactTopic({
        lang: 'ar', query: 'اجعله أصعب', lesson, refinement: true,
        activeTopicAr: null, activeTopicEn: null,
        docTopic: 'ملف الوحدة الثالثة', preferDocuments: true,
      }),
      'ملف الوحدة الثالثة',
    );
  });
});
