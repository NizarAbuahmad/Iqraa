/**
 * «علمني» with a lesson open got «وضّح لي أكثر: هل تريد شرح مفهوم، أم تحضير
 * مادة؟» — reported from the app, with «تركيب الاقترانات» on the lesson card.
 *
 * Two gaps. The router had no word for "teach me" (only شرح / وضّح / ما هو), so
 * a one-word ask fell to the short-token clarify. And it never saw the lesson
 * card: the clarify is decided before any lesson context is applied, so the
 * question was asked as if nothing were open. Routing it to teaching was not
 * enough on its own either — a soft-pinned lesson is not reused for a teaching
 * ask, so the pipeline would have searched the curriculum for the word «علمني».
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isBareTeachAsk, isTeachMeAsk } from '../ai/askVocabulary.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import { detectIntent, emptyChatSessionMemory, type ChatSessionMemory } from '../ai/teachingAssistant.ts';
import { shouldReuseActiveLesson } from '../lessonCopilot.ts';

const LESSON = 'تركيب الاقترانات';

describe('isTeachMeAsk — "teach me" is a teaching ask, in any spelling', () => {
  const yes = [
    'علمني', 'علّمني', 'عَلِّمْني', 'فهمني', 'فهّمني', 'درسني', 'درّسني', 'علمنا',
    'علمني الاقترانات', 'فهمني تركيب الاقترانات', 'ممكن تعلمني المشتقات',
    'teach me', 'Teach me composition of functions', 'help me understand vectors',
  ];
  for (const q of yes) it(`«${q}»`, () => assert.equal(isTeachMeAsk(q), true));

  const no = ['المعلم', 'معلمين الصف العاشر', 'العلوم', 'علم الكيمياء', 'teacher notes', 'teaching strategies'];
  for (const q of no) it(`not «${q}»`, () => assert.equal(isTeachMeAsk(q), false));
});

describe('isBareTeachAsk — a teach/continue verb with no topic of its own', () => {
  const bare = [
    'علمني', 'علّمني', 'فهمني', 'علمني الدرس', 'اشرح', 'اشرحه', 'اشرح لي', 'اشرحلي',
    'اشرح الدرس', 'شرح', 'الشرح', 'ابدأ', 'ابدا', 'يلا نبدأ', 'خلينا نبدأ', 'كمل', 'كمّل',
    'تابع', 'علمني من البداية', 'علمني لو سمحت', 'علمني!',
    'teach me', 'explain', 'explain it', 'explain this lesson', 'start', "let's start",
    'continue', 'go on', 'teach me please',
  ];
  for (const q of bare) it(`«${q}»`, () => assert.equal(isBareTeachAsk(q), true));

  // A topic in the message is a topic to search, not the lesson on the card.
  const topical = [
    'علمني الاقترانات', 'اشرح المشتقات', 'فهمني قانون الجيوب', 'teach me vectors',
    'explain derivatives', 'ابدأ الحصة بنشاط', 'خطة درس', 'المعلم',
  ];
  for (const q of topical) it(`not «${q}»`, () => assert.equal(isBareTeachAsk(q), false));
});

describe('the router reads "teach me" as teaching', () => {
  it('«علمني الاقترانات» — two words used to be a clarify', () => {
    assert.equal(classifyChatIntent('علمني الاقترانات', 'ar').intent, 'teaching');
  });
  it('«teach me vectors»', () => {
    assert.equal(classifyChatIntent('teach me vectors', 'en').intent, 'teaching');
  });
});

describe('with a lesson open, a bare ask is about that lesson', () => {
  for (const q of ['علمني', 'علّمني', 'فهمني', 'ابدأ', 'كمل', 'اشرح']) {
    it(`«${q}» teaches the open lesson instead of asking`, () => {
      const r = classifyChatIntent(q, 'ar', false, undefined, { activeLessonTitle: LESSON });
      assert.equal(r.intent, 'teaching');
      assert.equal(r.useTeachingPipeline, true);
    });
  }
  it('English too', () => {
    const r = classifyChatIntent('teach me', 'en', false, undefined, { activeLessonTitle: 'Composition of Functions' });
    assert.equal(r.intent, 'teaching');
  });

  it('a clarify that still happens names the lesson, not "a concept"', () => {
    const r = classifyChatIntent('نعم', 'ar', false, undefined, { activeLessonTitle: LESSON });
    assert.equal(r.intent, 'ambiguous');
    assert.match(r.socialReply ?? '', /تركيب الاقترانات/);
    assert.doesNotMatch(r.socialReply ?? '', /شرح مفهوم/);
  });
  it('…in English', () => {
    const r = classifyChatIntent('yes', 'en', false, undefined, { activeLessonTitle: 'Composition of Functions' });
    assert.match(r.socialReply ?? '', /Composition of Functions/);
  });

  it('does not reach past greetings, small talk or questions about Iqrra', () => {
    const o = { activeLessonTitle: LESSON };
    assert.equal(classifyChatIntent('مرحبا', 'ar', false, undefined, o).intent, 'greeting');
    assert.equal(classifyChatIntent('شكرا', 'ar', false, undefined, o).intent, 'small_talk');
    assert.equal(classifyChatIntent('من انت', 'ar', false, undefined, o).intent, 'about');
  });
});

describe('with no lesson open, a bare ask asks which lesson', () => {
  it('«علمني» asks what to learn — not "concept or material?", and not a KB search for the verb', () => {
    const r = classifyChatIntent('علمني', 'ar');
    assert.equal(r.intent, 'ambiguous');
    assert.equal(r.useTeachingPipeline, false);
    assert.match(r.socialReply ?? '', /درس/);
    assert.doesNotMatch(r.socialReply ?? '', /شرح مفهوم/);
  });
  it('«teach me» likewise', () => {
    const r = classifyChatIntent('teach me', 'en');
    assert.equal(r.intent, 'ambiguous');
    assert.match(r.socialReply ?? '', /lesson|topic/i);
  });
  it('after a clarify it still goes on to teaching — never a dead end', () => {
    assert.equal(classifyChatIntent('علمني', 'ar', true).intent, 'teaching');
  });
  it('the old generic clarify is unchanged without a lesson', () => {
    assert.match(classifyChatIntent('نعم', 'ar').socialReply ?? '', /شرح مفهوم/);
  });
});

describe('the reuse gate keeps a soft-pinned lesson for a bare ask', () => {
  const soft: ChatSessionMemory = {
    ...emptyChatSessionMemory(),
    activeLessonId: 'kbl-math-s2-nccd-u5_l3',
    activeTopicAr: LESSON,
    lessonPin: 'soft',
  };
  const reuse = (query: string, memory = soft) => shouldReuseActiveLesson({
    memory, intent: 'teaching', query, hasConfidentKbHit: false,
  });

  it('«علمني» reuses it', () => assert.equal(reuse('علمني'), true));
  it('«ابدأ» reuses it', () => assert.equal(reuse('ابدأ'), true));
  it('«teach me» reuses it', () => assert.equal(reuse('teach me'), true));
  it('a named topic still does not — the soft pin is background, not a leash', () => {
    assert.equal(reuse('علمني المشتقات'), false);
  });
  // Measured: searchKBRanked('start') ranks «تأسيس مشروع تجاري» at 92, and
  // «علمني» ranks «أسس علم التصنيف» — a verb's search hits are noise, not
  // evidence of another subject.
  it('a KB hit in another subject does not overrule it — the verb names no subject', () => {
    assert.equal(shouldReuseActiveLesson({
      memory: soft, intent: 'teaching', query: 'start', hasConfidentKbHit: false,
      activeLessonSubjectId: 'mathematics', topRankedSubjectId: 'entrepreneurship',
    }), true);
  });
  it('uploaded documents still come first under a soft pin', () => {
    assert.equal(shouldReuseActiveLesson({
      memory: soft, intent: 'teaching', query: 'علمني', hasConfidentKbHit: false, hasDocuments: true,
    }), false);
  });
  it('a lesson the teacher left (pin none) is not dragged back', () => {
    assert.equal(reuse('علمني', { ...soft, lessonPin: 'none' }), false);
  });
});

describe('detectIntent explains on "teach me"', () => {
  for (const q of ['علمني', 'فهمني تركيب الاقترانات', 'teach me']) {
    it(`«${q}»`, () => assert.equal(detectIntent(q), 'explain'));
  }
});
