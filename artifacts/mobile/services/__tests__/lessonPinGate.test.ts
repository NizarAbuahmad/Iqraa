/**
 * The lesson picked in chat is background, not a leash.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/lessonPinGate.test.ts
 *
 * The chat screen used to push the picked lesson into every answer's grounding
 * ahead of this gate, so a teacher who had picked a lesson got every later
 * question answered about it. The screen now defers to `shouldReuseActiveLesson`
 * alone; these pin the cases that change hinges on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { activeLessonReuse, shouldReuseActiveLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory, type ChatSessionMemory } from '../ai/teachingAssistant.ts';
import { isConfidentSingleSubjectHit, searchPointsElsewhere, searchSupportsLesson } from '../kbContext.ts';
import { getBookForLesson, getLessonById, searchKBRanked } from '../knowledgeBase.ts';
import { KB_SUGGEST_SCORE } from '../kbSuggestion.ts';

const hardPinned = {
  ...emptyChatSessionMemory(),
  activeLessonId: 'kbl-math-s2-nccd-u5_l3',
  activeTopicAr: 'تركيب الاقترانات',
  lessonPin: 'hard' as const,
};

describe('shouldReuseActiveLesson with a lesson picked in chat', () => {
  it('lets go when the question clearly matches another lesson', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'teaching',
        query: 'اشرح الروابط التساهمية',
        hasConfidentKbHit: true,
      }),
      false,
    );
  });

  it('lets go when KB points at a different subject, even without a confident hit', () => {
    // Hard-pinned maths lesson; KB found a chemistry lesson above KB_SUGGEST_SCORE.
    // The maths lesson must not be forced back in.
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'teaching',
        query: 'كيف تتكون الأيونات',
        hasConfidentKbHit: false,
        activeLessonSubjectId: 'mathematics',
        topRankedSubjectId: 'chemistry',
      }),
      false,
    );
  });

  it('keeps the lesson for a refinement of the last answer', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'refinement',
        query: 'اجعله أبسط',
        hasConfidentKbHit: true,
      }),
      true,
    );
  });

  it('keeps it for material requested without naming a topic', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'artifact',
        query: 'ورقة عمل',
        hasConfidentKbHit: false,
      }),
      true,
    );
  });
});

/**
 * Reported 2026-11-21: «chat keeps changing the topic I ask for». A lesson
 * picked from the top bar is pinned hard, and the gate used to reuse a hard pin
 * for any teaching question the keyword search was not confident about, so the
 * picked lesson went to the model as the textbook. Measured with the picked
 * lesson «تركيب الاقترانات»: «اشرح لي المتجهات» (vectors scored 35.5, not a
 * confident single-subject hit), «ما هي الدالة الأسية», «اشرح لي المصفوفات»
 * and «كيف أدير صفًا مزعجًا؟» were all answered from «تركيب الاقترانات».
 *
 * The rule now: a message that names a topic of its own gets the picked lesson
 * only when this message's own search points at it (`searchSupportsLesson`).
 * The pin's strength says how sure the teacher is about the lesson, not what
 * every later question is about.
 */
describe('a question that names its own topic is answered about that topic', () => {
  const bar = getLessonById('kbl-math-s2-nccd-u5_l3')!;
  const book = getBookForLesson(bar)!;
  const gate = (
    query: string,
    intent: 'teaching' | 'artifact' = 'teaching',
    memory: ChatSessionMemory = hardPinned,
  ) => {
    const ranked = searchKBRanked(query, 'ar');
    return activeLessonReuse({
      memory,
      intent,
      query,
      hasConfidentKbHit: isConfidentSingleSubjectHit(ranked),
      activeLessonGradeId: book.gradeId,
      activeLessonSubjectId: book.subjectId,
      topRankedSubjectId: ranked[0] && ranked[0].score >= KB_SUGGEST_SCORE
        ? getBookForLesson(ranked[0].lesson)?.subjectId ?? null
        : null,
      searchSupportsActive: searchSupportsLesson(ranked, bar.id),
      searchPointsElsewhere: searchPointsElsewhere(ranked, bar.id),
    });
  };

  // The words point at another lesson: that lesson, not the picked one.
  for (const q of [
    'اشرح لي المتجهات',
    'ما هي الدالة الأسية',
    'سؤال عن الجذور',
  ]) {
    it(`does not answer «${q}» from the picked lesson`, () => {
      assert.equal(gate(q), 'none');
    });
  }

  // Nothing in the curriculum matches: the model is told the lesson as
  // background and answers the question as asked — never handed the lesson as
  // the textbook, which is what made it answer about «تركيب الاقترانات».
  for (const q of ['اشرح لي المصفوفات', 'كيف أدير صفًا مزعجًا؟']) {
    it(`gives «${q}» the picked lesson as background only`, () => {
      assert.equal(gate(q), 'background');
    });
  }

  it('a soft (restored) pin is not even background', () => {
    assert.equal(gate('كيف أدير صفًا مزعجًا؟', 'teaching', { ...hardPinned, lessonPin: 'soft' }), 'none');
  });

  it('does not build «اختبار قصير عن الاحتمالات» on the picked lesson', () => {
    assert.equal(gate('اختبار قصير عن الاحتمالات', 'artifact'), 'none');
  });

  it('a long message that names a topic is not a follow-up because it says «أضف»', () => {
    assert.equal(gate('اشرح المتجهات وأضف أمثلة'), 'none');
  });

  it('still grounds on the picked lesson when the question is about it', () => {
    assert.equal(gate('اشرح تركيب الاقترانات'), 'ground');
  });

  it('still grounds on it for a short follow-up or a bare ask', () => {
    assert.equal(gate('أضف نشاطاً', 'artifact'), 'ground');
    assert.equal(gate('علمني'), 'ground');
    assert.equal(gate('ورقة عمل', 'artifact'), 'ground');
  });
});

describe('searchSupportsLesson', () => {
  const barId = 'kbl-math-s2-nccd-u5_l3';
  it('is false when the words point at another lesson', () => {
    assert.equal(searchSupportsLesson(searchKBRanked('اشرح لي المتجهات', 'ar'), barId), false);
  });
  it('is true when the words point at the lesson itself', () => {
    assert.equal(searchSupportsLesson(searchKBRanked('اشرح تركيب الاقترانات', 'ar'), barId), true);
  });
  it('is false when a confident hit is another lesson, even if this one scored', () => {
    // «الاقتران العكسي» 135.5 is the answer; «تركيب الاقترانات» scores on the shared word.
    assert.equal(searchSupportsLesson(searchKBRanked('أعطني أمثلة على الاقتران العكسي', 'ar'), barId), false);
  });
});

describe('a follow-up that points back keeps the conversation’s lesson', () => {
  // The conversation moved to «قانون جيب التمام»; «عليه» alone matches «موسى
  // عليه السلام» (Islamic education, 12), which used to read as another
  // subject and drop the lesson.
  const cosine = getLessonById('kbl-math-s1-nccd-u4_l3')!;
  const memory: ChatSessionMemory = {
    ...emptyChatSessionMemory(),
    activeLessonId: cosine.id,
    activeTopicAr: cosine.titleAr,
    lessonPin: 'hard',
  };
  for (const [q, intent] of [
    ['أعطني أمثلة عليه', 'teaching'],
    ['حل مثال عليه', 'teaching'],
    ['مثال آخر', 'teaching'],
    ['ورقة عمل عليه', 'artifact'],
  ] as const) {
    it(`«${q}»`, () => {
      const ranked = searchKBRanked(q, 'ar');
      assert.equal(activeLessonReuse({
        memory,
        intent,
        query: q,
        hasConfidentKbHit: isConfidentSingleSubjectHit(ranked),
        activeLessonGradeId: 'grade-10',
        activeLessonSubjectId: 'mathematics',
        topRankedSubjectId: ranked[0] && ranked[0].score >= KB_SUGGEST_SCORE
          ? getBookForLesson(ranked[0].lesson)?.subjectId ?? null
          : null,
        searchSupportsActive: searchSupportsLesson(ranked, cosine.id),
        searchPointsElsewhere: searchPointsElsewhere(ranked, cosine.id),
      }), 'ground');
    });
  }
});

describe('background is only for the lesson the teacher picked', () => {
  it('a lesson the conversation moved to is not background for an unrelated question', () => {
    const q = 'كيف أدير صفًا مزعجًا؟';
    const ranked = searchKBRanked(q, 'ar');
    const opts = {
      memory: { ...hardPinned, activeLessonId: 'kbl-math-s1-nccd-u4_l3', activeTopicAr: 'قانون جيب التمام' },
      intent: 'teaching',
      query: q,
      hasConfidentKbHit: isConfidentSingleSubjectHit(ranked),
      searchSupportsActive: false,
      searchPointsElsewhere: searchPointsElsewhere(ranked, 'kbl-math-s1-nccd-u4_l3'),
    };
    assert.equal(activeLessonReuse({ ...opts, isSelectedLesson: false }), 'none');
    assert.equal(activeLessonReuse(opts), 'background');
  });
});
