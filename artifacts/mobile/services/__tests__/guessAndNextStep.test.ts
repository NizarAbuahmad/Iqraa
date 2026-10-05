/**
 * Two follow-ups to «علمني» (#814).
 *
 * Guess, then offer. An explanation ask stopped to ask «هل هذا شرح للمفهوم لأول
 * مرة، أم مراجعة قبل الاختبار؟» — and the two answers differed by one framing
 * sentence. #814 made «علمني» an explanation ask, so a teacher who had just
 * stopped being asked "concept or material?" was asked this instead. Now the
 * explanation comes first, framed as first-time (the likelier case), and the
 * review framing is a follow-up the teacher can tap.
 *
 * Next step from the real state. The header counted this chat's session, the
 * board counted موادي, and the chips read the session only — so a lesson plan
 * saved yesterday showed «1/5» on the board and «حضّر خطة الدرس» on the chips.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrepProgressView,
  buildTeachingAssistantReply,
  defaultTeachingActions,
  detectIntent,
  emptyChatSessionMemory,
  reviewFollowUp,
  type ChatSessionMemory,
} from '../ai/teachingAssistant.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { artifactFromAsk } from '../ai/askVocabulary.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import { buildCurrentLessonView, buildLessonSuggestions, nextStepActions, pinLesson } from '../lessonCopilot.ts';
import { savedPrepArtifacts, type MaterialLike } from '../lessonBoard.ts';

const LESSON_ID = 'kbl-math-s2-nccd-u5_l3';
const lesson = getLessonById(LESSON_ID)!;
const TITLE = 'تركيب الاقترانات';

describe('an explanation ask is answered, not met with "first time or review?"', () => {
  const reply = (query: string) => buildTeachingAssistantReply({
    query, lessons: [lesson], lang: 'ar', mode: 'teacher', memory: emptyChatSessionMemory(),
  });

  it('the lesson exists in the KB', () => assert.equal(lesson.titleAr, TITLE));

  for (const q of ['علمني', 'اشرح تركيب الاقترانات', 'فهمني']) {
    it(`«${q}» explains straight away`, () => {
      const r = reply(q);
      assert.equal(r.needsClarification, false);
      assert.doesNotMatch(r.text, /قبل أن أبدأ/);
      assert.match(r.text, /لأول مرة/, 'says which framing it assumed');
      assert.ok(r.text.includes(lesson.summaryAr), 'carries the lesson itself');
    });
    it(`«${q}» offers the review framing as a follow-up`, () => {
      assert.equal(reply(q).offerReview, true);
    });
  }

  it('no offer when the teacher already said it is a review', () => {
    const r = reply('اشرح تركيب الاقترانات — مراجعة قبل الاختبار');
    assert.equal(r.offerReview ?? false, false);
    assert.match(r.text, /مراجعة قبل الاختبار/);
  });
  it('no offer when the teacher already said first time', () => {
    assert.equal(reply('اشرح تركيب الاقترانات لأول مرة').offerReview ?? false, false);
  });
  it('no offer on a material ask', () => {
    assert.equal(reply('أنشئ ورقة عمل عن تركيب الاقترانات').offerReview ?? false, false);
  });
  it('English too', () => {
    const r = buildTeachingAssistantReply({
      query: 'teach me', lessons: [lesson], lang: 'en', mode: 'teacher', memory: emptyChatSessionMemory(),
    });
    assert.equal(r.needsClarification, false);
    assert.equal(r.offerReview, true);
  });
});

describe('reviewFollowUp', () => {
  it('re-asks the same thing as a review, in the form the reply recognises', () => {
    const f = reviewFollowUp('علمني', 'ar');
    assert.equal(f.prompt, 'علمني — مراجعة قبل الاختبار');
    assert.match(f.label, /مراجعة قبل الاختبار/);
    const r = buildTeachingAssistantReply({
      query: f.prompt, lessons: [lesson], lang: 'ar', mode: 'teacher', memory: emptyChatSessionMemory(),
    });
    assert.match(r.text, /سأعامل هذا كمراجعة قبل الاختبار/);
    assert.equal(r.offerReview ?? false, false, 'and does not offer itself again');
  });
  it('English', () => {
    assert.equal(reviewFollowUp('teach me', 'en').prompt, 'teach me — review before the test');
  });
});

const mat = (id: string, type: string, extra: Partial<MaterialLike> = {}): MaterialLike => ({
  id, type, title: id, topic: TITLE, savedAt: '2026-10-03T10:00:00Z', formState: { lessonId: LESSON_ID }, ...extra,
});

describe('savedPrepArtifacts — what موادي already holds for the lesson, in chat terms', () => {
  it('maps each saved type to the chat artifact it is', () => {
    const got = savedPrepArtifacts([
      mat('a', 'lesson'), mat('b', 'quiz'), mat('c', 'activity'), mat('d', 'slides'), mat('e', 'flow'),
    ], TITLE, LESSON_ID);
    assert.deepEqual([...got].sort(), ['activity', 'lesson-plan', 'quiz']);
  });
  it('a saved homework is homework, not a worksheet', () => {
    const got = savedPrepArtifacts([
      mat('h', 'worksheet', { formState: { lessonId: LESSON_ID, materialKind: 'homework' } as MaterialLike['formState'] }),
    ], TITLE, LESSON_ID);
    assert.deepEqual(got, ['homework']);
  });
  it('a plain worksheet is a worksheet', () => {
    assert.deepEqual(savedPrepArtifacts([mat('w', 'worksheet')], TITLE, LESSON_ID), ['worksheet']);
  });
  it("another lesson's materials do not count — by id, not by title", () => {
    const other = mat('x', 'lesson', { formState: { lessonId: 'kbl-other' } });
    assert.deepEqual(savedPrepArtifacts([other], TITLE, LESSON_ID), []);
  });
});

describe('the chips start from the next missing step', () => {
  const memory: ChatSessionMemory = pinLesson(emptyChatSessionMemory(), lesson, 'hard');
  const ids = (m: ChatSessionMemory, prep?: { saved?: string[]; skipped?: string[] }) =>
    buildLessonSuggestions(m, 'ar', false, prep).map(s => s.id);

  it('nothing made: the plan first', () => {
    assert.equal(ids(memory)[0], 'create-plan');
  });
  it('a plan saved yesterday is not offered again — the next step leads', () => {
    const got = ids(memory, { saved: ['lesson-plan'] });
    assert.ok(!got.includes('create-plan'), got.join());
    assert.equal(got[0], 'create-ws');
  });
  it('the step after a worksheet is a quiz, as the progress card recommends', () => {
    assert.equal(ids(memory, { saved: ['lesson-plan', 'worksheet'] })[0], 'create-quiz');
  });
  it('a row marked «غير مطلوب» is not offered', () => {
    const got = ids(memory, { saved: ['lesson-plan'], skipped: ['worksheet'] });
    assert.ok(!got.includes('create-ws'), got.join());
    assert.equal(got[0], 'create-quiz');
  });
  it('offers two things to make, not the whole list', () => {
    const creates = ids(memory).filter(i => i.startsWith('create-'));
    assert.equal(creates.length, 2);
  });
  it('the session still counts — a quiz made in this chat is not offered', () => {
    const made = { ...memory, discussedArtifacts: ['quiz' as const], lastGeneratedResource: 'quiz' as const };
    const got = ids(made, { saved: ['lesson-plan', 'worksheet'] });
    assert.ok(!got.includes('create-quiz'), got.join());
  });
  it('what was just made gets an improve chip', () => {
    const made = { ...memory, discussedArtifacts: ['quiz' as const], lastGeneratedResource: 'quiz' as const };
    assert.ok(ids(made).includes('harder-quiz'));
  });
  it('everything made: no create chips at all', () => {
    const got = ids(memory, { saved: ['lesson-plan', 'worksheet', 'quiz', 'activity', 'homework'] });
    assert.equal(got.filter(i => i.startsWith('create-')).length, 0, got.join());
  });
  it('every chip carries the lesson id, not just its title', () => {
    for (const s of buildLessonSuggestions(memory, 'ar', false)) assert.equal(s.lessonId, LESSON_ID);
  });
});

describe('the header count reads the same state as the chips', () => {
  const memory = pinLesson(emptyChatSessionMemory(), lesson, 'hard');
  it('a saved plan is done on the header', () => {
    const view = buildCurrentLessonView(memory, [], 'ar', ['lesson-plan'])!;
    assert.equal(view.resources.find(r => r.type === 'lesson-plan')?.done, true);
    assert.equal(view.resources.filter(r => r.done).length, 1);
  });
  it('without saved materials it is the session alone, as before', () => {
    assert.equal(buildCurrentLessonView(memory, [], 'ar')!.resources.filter(r => r.done).length, 0);
  });
});

describe('the follow-ups under a reply start from the next step too', () => {
  const memory = pinLesson(emptyChatSessionMemory(), lesson, 'hard');
  const types = (prep?: { saved?: string[]; skipped?: string[] }, m = memory) =>
    nextStepActions(defaultTeachingActions(), m, prep).map(a => a.type);

  it('nothing made: every material, the plan first', () => {
    const got = types();
    assert.equal(got[0], 'lesson-plan');
    assert.equal(got.length, defaultTeachingActions().length);
  });
  it('drops what موادي already holds, and leads with what comes next', () => {
    const got = types({ saved: ['lesson-plan', 'worksheet'] });
    assert.ok(!got.includes('lesson-plan') && !got.includes('worksheet'), got.join());
    assert.equal(got[0], 'quiz');
  });
  it('drops a row marked «غير مطلوب»', () => {
    assert.ok(!types({ skipped: ['activity'] }).includes('activity'));
  });
  it('drops what this chat already made', () => {
    const made = { ...memory, discussedArtifacts: ['worksheet' as const] };
    assert.ok(!types(undefined, made).includes('worksheet'));
  });
});

// Found driving the web build: tapping «🔁 مراجعة قبل الاختبار» answered with
// the quiz follow-up, ticked the header to 1/5 and dropped the quiz chip, with
// no quiz made. «قبل الاختبار» is when the review happens, not a material asked
// for — but the shared vocabulary read «اختبار» as a quiz ask.
describe('"before the test" is a time, not a quiz ask', () => {
  for (const q of [
    'علمني — مراجعة قبل الاختبار', 'مراجعة قبل الامتحان', 'اشرح الدرس قبل الاختبار',
    'teach me — review before the test', 'review before the exam',
  ]) {
    it(`«${q}» asks for no material`, () => assert.equal(artifactFromAsk(q), null));
  }
  it('the review follow-up stays an explanation all the way through', () => {
    const { prompt } = reviewFollowUp('علمني', 'ar');
    assert.equal(classifyChatIntent(prompt, 'ar').intent, 'teaching');
    assert.equal(detectIntent(prompt), 'explain');
    const r = buildTeachingAssistantReply({
      query: prompt, lessons: [lesson], lang: 'ar', mode: 'teacher', memory: emptyChatSessionMemory(),
    });
    assert.ok(!(r.memoryPatch.discussedArtifacts ?? []).includes('quiz'), 'no quiz counted');
  });
  it('a quiz *for* the test is still a quiz', () => {
    assert.equal(artifactFromAsk('جهّز اختبار قصير قبل الامتحان'), 'quiz');
    assert.equal(artifactFromAsk('اختبار قبل الاختبار النهائي'), 'quiz');
  });
});

// Seen in the web build with a plan saved in موادي: the header read 1/5 and the
// chips skipped the plan, but the progress card under the reply still listed
// «خطة درس» as remaining and recommended «حضّر خطة الدرس».
describe('the progress card reads the same state as the header and chips', () => {
  const explained = { ...pinLesson(emptyChatSessionMemory(), lesson, 'hard'),
    prepLessonId: LESSON_ID, prepCompleted: ['explanation' as const], lastCompletedPrepStep: 'explanation' as const };
  it('a saved plan is done, not remaining, and not recommended', () => {
    const v = buildPrepProgressView(explained, 'ar', ['lesson-plan'])!;
    assert.ok(v.done.some(d => d.id === 'lesson-plan'));
    assert.ok(!v.remaining.some(r => r.id === 'lesson-plan'));
    assert.doesNotMatch(v.recommendation ?? '', /خطة/);
    assert.match(v.recommendation ?? '', /ورقة عمل/);
  });
  it('without saved materials it is the session alone, as before', () => {
    const v = buildPrepProgressView(explained, 'ar')!;
    assert.ok(v.remaining.some(r => r.id === 'lesson-plan'));
  });
});
