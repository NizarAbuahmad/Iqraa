/**
 * The two refine chips — «حسّن خطة الدرس» and «اجعل الاختبار أصعب».
 *
 * They send an edit instruction that names no new topic, and the chat read the
 * whole sentence as the topic: the saved plan was titled «خطة درس: حسّن الدرس «تركيب
 * الاقترانات» واجعلها أوضح للتنفيذ في الحصة القادمة» and its text said «أين نلتقي
 * بحسّن الدرس …». The quiz chip, «اجعل الاختبار أصعب وأضف سؤالين», has no topic in
 * it at all, so the whole sentence was the topic. English was worse: the router
 * did not know «Improve…» or «Make the quiz harder» for a refinement, so both
 * chips were treated as a request for a NEW material.
 *
 * A refinement edits what is already in the thread. Its topic is that lesson,
 * which the chip carries by id — never something read back out of the sentence
 * (a title does not identify a lesson; see CLAUDE.md). For a typed message there
 * is no id, so the open lesson is used only when the sentence does not itself name
 * another lesson: the router's «أصعب» / «عدل» / «for advanced» markers also match
 * ordinary requests for a NEW material («اختبار قصير عن معدل الوحدة»), and those
 * have to keep naming their own lesson.
 *
 * The prompts are built by `buildLessonSuggestions`, not retyped: the earlier
 * topic fix was tested only against hand-typed asks and missed every string the
 * product actually sends. `decide` below runs the same pieces the chat does
 * (`iqra.tsx`, artifact branch), not a copy of their logic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { refinementTarget, resolveArtifactTopic } from '../ai/artifactTopic.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import {
  emptyChatSessionMemory,
  type ChatSessionMemory,
  type SessionArtifact,
} from '../ai/teachingAssistant.ts';
import { lessonNamedByTopic } from '../kbContext.ts';
import { buildLessonSuggestions } from '../lessonCopilot.ts';
import { getLessonById, KB_LESSONS, type KBLesson } from '../knowledgeBase.ts';

const lesson = getLessonById('kbl-math-s2-nccd-u5_l3')!;
const other = getLessonById('kbl-g5-math-s1-nccd-u1_l5')!;

function chip(l: KBLesson, last: SessionArtifact, id: string, lang: 'ar' | 'en'): string {
  const memory: ChatSessionMemory = {
    ...emptyChatSessionMemory(),
    activeLessonId: l.id,
    activeTopicAr: l.titleAr,
    activeTopicEn: l.titleEn,
    lastGeneratedResource: last,
    generatedResources: [{ type: last, updatedAt: 0 }],
    lessonPin: 'hard',
  };
  const found = buildLessonSuggestions(memory, lang, false).find(s => s.id === id);
  assert.ok(found, `no «${id}» chip after a ${last}`);
  return lang === 'ar' ? found.promptAr : found.promptEn;
}

/**
 * What the chat does with a message: route it, search the sentence's own topic,
 * and ask who the refinement is for. `target` null means the ordinary path.
 */
function decide(
  query: string,
  lang: 'ar' | 'en',
  opts: { pinned?: KBLesson | null; open?: KBLesson | null; preferDocuments?: boolean } = {},
) {
  const { intent } = classifyChatIntent(query, lang);
  const topicForArt = resolveArtifactTopic({
    lang, query, lesson: null,
    activeTopicAr: opts.open?.titleAr ?? null, activeTopicEn: opts.open?.titleEn ?? null,
  });
  const namedLesson = lessonNamedByTopic(topicForArt, lang, null);
  const target = refinementTarget({
    intent,
    query,
    pinnedLesson: opts.pinned ?? null,
    openLesson: opts.open ?? null,
    namedLesson,
    preferDocuments: opts.preferDocuments ?? false,
  });
  const topic = target
    ? resolveArtifactTopic({
      lang, query, lesson: target, refinement: true, activeTopicAr: null, activeTopicEn: null,
    })
    : null;
  return { intent, namedLesson, target, topic };
}

const CHIPS: { last: SessionArtifact; id: string }[] = [
  { last: 'lesson-plan', id: 'refine-plan' },
  { last: 'quiz', id: 'harder-quiz' },
];

describe('the refine chips are refinements, in both languages', () => {
  for (const { last, id } of CHIPS) {
    for (const lang of ['ar', 'en'] as const) {
      it(`${id} (${lang}) routes as a refinement`, () => {
        const prompt = chip(lesson, last, id, lang);
        assert.equal(classifyChatIntent(prompt, lang).intent, 'refinement', prompt);
      });
    }
  }

  it('typed English edits are refinements', () => {
    for (const q of [
      'Improve the lesson plan',
      'improve this quiz',
      'Please improve the current worksheet',
      'Make the quiz harder',
      'can you make the worksheet a bit easier',
      'Make my lesson plan clearer',
    ]) {
      assert.equal(classifyChatIntent(q, 'en').intent, 'refinement', q);
    }
  });

  it('English teaching questions and new-material asks are not edits', () => {
    for (const q of [
      'Make a harder quiz on circles',
      'Make me a worksheet about fractions',
      'Create a lesson plan to improve reading',
      'Improve my classroom management',
      'How can I improve my lesson delivery?',
      'How do I improve the lesson pacing',
      'tips to improve my lessons',
      'improve my planning skills',
      'Improve my lesson delivery',
      'How do I make this topic easier to understand?',
      'make the derivative easier to understand',
      'how can I make the concept clearer for students?',
    ]) {
      assert.notEqual(classifyChatIntent(q, 'en').intent, 'refinement', q);
    }
  });
});

describe('a refine chip keeps the picked lesson as its topic', () => {
  for (const { last, id } of CHIPS) {
    for (const lang of ['ar', 'en'] as const) {
      it(`${id} (${lang}) is titled with the lesson, not the sentence`, () => {
        const d = decide(chip(lesson, last, id, lang), lang, { pinned: lesson });
        assert.equal(d.target?.id, lesson.id);
        assert.equal(d.topic, lang === 'ar' ? lesson.titleAr : lesson.titleEn);
        assert.doesNotMatch(d.topic!, /حسّن|أصعب|اجعل|Improve|harder|clearer/i);
      });
    }
  }

  // The chip names the lesson in quotes, so a test on the sentence also reads the
  // title. «أُنْشِئُ جَدْوَلًا» is a lesson title; stripped of its vowel marks it is
  // the create verb «أنشئ», and the chip stopped being an edit for that lesson.
  it('does not depend on the words in the lesson title', () => {
    assert.match(other.titleAr, /أُنْشِئُ/);
    for (const { last, id } of CHIPS) {
      for (const lang of ['ar', 'en'] as const) {
        const d = decide(chip(other, last, id, lang), lang, { pinned: other });
        assert.equal(d.target?.id, other.id, `${id} ${lang}`);
      }
    }
  });

  it('holds for every lesson in the curriculum, both chips, both languages', () => {
    assert.ok(KB_LESSONS.length > 100, `only ${KB_LESSONS.length} lessons loaded`);
    const wrong: string[] = [];
    for (const l of KB_LESSONS) {
      for (const { last, id } of CHIPS) {
        for (const lang of ['ar', 'en'] as const) {
          // A tapped lesson wins whatever the search says, so skip the search here:
          // it is the slow part, and only the route and the pin are in question.
          const prompt = chip(l, last, id, lang);
          const { intent } = classifyChatIntent(prompt, lang);
          const target = refinementTarget({
            intent, query: prompt, pinnedLesson: l, openLesson: null, namedLesson: null,
            preferDocuments: false,
          });
          if (target?.id !== l.id) wrong.push(`${l.id} ${id} ${lang} → ${intent}`);
        }
      }
    }
    assert.deepEqual(wrong.slice(0, 10), [], `${wrong.length} chips lost their lesson`);
  });
});

describe('a typed refinement', () => {
  it('stays on the open lesson when the sentence names no other', () => {
    for (const q of ['اجعله أصعب', 'عدّل الاختبار وأضف سؤالين', 'اجعل الخطة أبسط للطلاب الضعفاء']) {
      const d = decide(q, 'ar', { open: lesson });
      assert.equal(d.intent, 'refinement', q);
      assert.equal(d.target?.id, lesson.id, q);
      assert.equal(d.topic, lesson.titleAr, q);
    }
    assert.equal(decide('Make the quiz harder', 'en', { open: lesson }).target?.id, lesson.id);
  });

  // The edit words match the curriculum: «عدّل الاختبار وأضف سؤالين» scores 11 on
  // «الاقتران العكسي», so a confident search hit is not proof the sentence names a
  // lesson. Before this, such a message was built on that unrelated lesson.
  it('is not moved to a lesson its edit words happen to match', () => {
    const q = 'عدّل الاختبار وأضف سؤالين';
    const d = decide(q, 'ar', { open: lesson });
    assert.ok(d.namedLesson, 'premise: the search is confident about some lesson');
    assert.notEqual(d.namedLesson!.id, lesson.id, 'premise: and it is not the open one');
    assert.equal(d.target?.id, lesson.id);
  });

  it('is not an edit with no lesson open and none tapped', () => {
    assert.equal(decide('اجعله أصعب', 'ar').target, null);
  });
});

describe('a new-material ask that the router calls a refinement keeps its own lesson', () => {
  // «أصعب», «عدل» (inside «معدل»), «another quiz», «for struggling» all send these
  // to `refinement`. Each names a lesson of its own, which the open one must not
  // replace.
  const open = lesson;
  for (const [q, lang] of [
    ['اختبار قصير عن معدل الوحدة', 'ar'],
    ['أريد اختباراً أصعب عن الدائرة', 'ar'],
    ['أعدّ اختبارًا أسهل عن الأسس', 'ar'],
    ['Give me another quiz on vectors', 'en'],
    ['Make me a lesson plan for struggling students on vectors', 'en'],
  ] as const) {
    it(`«${q}»`, () => {
      const d = decide(q, lang, { open });
      assert.equal(d.intent, 'refinement', 'premise: the router calls this a refinement');
      assert.ok(d.namedLesson, 'premise: the sentence names a lesson of its own');
      assert.notEqual(d.namedLesson!.id, open.id);
      assert.equal(d.target, null, 'must run the ordinary path');
    });
  }

  it('unless the lesson was tapped this turn', () => {
    const d = decide('أريد اختباراً أصعب عن الدائرة', 'ar', { open, pinned: other });
    assert.equal(d.target?.id, other.id);
  });
});

describe('what a refinement does not touch', () => {
  it('a message that is not a refinement', () => {
    for (const q of ['جهّز اختباراً قصيراً عن: الدائرة', 'اشرح لي المشتقات']) {
      assert.equal(decide(q, 'ar', { open: lesson, pinned: lesson }).target, null, q);
    }
  });

  it('uploaded documents that outrank the lesson', () => {
    assert.equal(
      decide('اجعله أصعب', 'ar', { open: lesson, pinned: lesson, preferDocuments: true }).target,
      null,
    );
    assert.equal(
      resolveArtifactTopic({
        lang: 'ar', query: 'اجعله أصعب', lesson, refinement: true,
        activeTopicAr: null, activeTopicEn: null,
        docTopic: 'ملف الوحدة الثالثة', preferDocuments: true,
      }),
      'ملف الوحدة الثالثة',
    );
  });

  it('a topic read from an ordinary ask', () => {
    assert.equal(
      resolveArtifactTopic({
        lang: 'ar', query: 'حضّر خطة درس عن الدائرة', lesson: null,
        activeTopicAr: lesson.titleAr, activeTopicEn: lesson.titleEn,
      }),
      'الدائرة',
    );
  });
});
