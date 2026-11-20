/**
 * An ask for material on a topic the curriculum does not have.
 *
 * Reported on app.iqrra.com, 2026-11-20: «نشاط صفي 15 دقيقة للصف السادس: لو كنت
 * وزير التربية ليوم واحد» got chips for grade 10 English «يوم في الفندق», grade 4
 * English and grade 10 civics; a chip re-sent the ask pinned to that lesson, the
 * grade filter dropped it, and the teacher was asked «عن أي درس؟» — a loop. With
 * a lesson already picked, the dead end came at once. «نشاط صفي لو كنت وزير تعليم
 * ليوم واحد» with a grade 8 Arabic lesson picked asked «الكيمياء أم التربية
 * المهنية أم اللغة الإنجليزية؟».
 *
 * The screen (`iqra.tsx`) cannot be rendered here; these pin the pure pieces it
 * now decides with, on the real curriculum data where the bug lived in it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AS_TYPED_CHOICE,
  asTypedChoiceLabel,
  chatArtifactLeadIn,
  freeArtifactTopic,
  isFreeTopicArtifactAsk,
} from '../ai/chatArtifactRoute.ts';
import { durationFromAsk } from '../ai/examAsk.ts';
import { topicFromQuery } from '../ai/artifactTopic.ts';
import { resolveArtifactScope } from '../ai/artifactScope.ts';
import {
  inAskScope,
  lessonsInAskScope,
  rankedInAskScope,
  shouldAskWhichLesson,
  topHitHoldsTopic,
} from '../kbSuggestion.ts';
import { getBookForLesson, searchKBRanked, type KBLesson } from '../knowledgeBase.ts';
import {
  detectSubjectAmbiguity,
  isConfidentSingleSubjectHit,
  resolveGeneratorGrounding,
} from '../kbContext.ts';
import { extractQueryGradeId, extractQuerySubjectId } from '../lessonCopilot.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import { artifactFromQuery } from '../ai/teachingAssistant.ts';

const GRADE6_ASK = 'نشاط صفي 15 دقيقة للصف السادس: لو كنت وزير التربية ليوم واحد';
const MINISTER_ASK = 'نشاط صفي لو كنت وزير تعليم ليوم واحد';

const bookOf = (l: KBLesson) => getBookForLesson(l);
const teachesAll = () => true;
const gradeOf = (l: KBLesson) => getBookForLesson(l)?.gradeId;

describe('the reported asks, as the chat reads them', () => {
  it('are asks for an activity, in grade 6 / no grade, naming no subject', () => {
    assert.equal(classifyChatIntent(GRADE6_ASK).intent, 'artifact');
    assert.equal(classifyChatIntent(MINISTER_ASK).intent, 'artifact');
    assert.equal(artifactFromQuery(GRADE6_ASK), 'activity');
    assert.equal(extractQueryGradeId(GRADE6_ASK), 'grade-6');
    assert.equal(extractQueryGradeId(MINISTER_ASK), null);
    assert.equal(extractQuerySubjectId(GRADE6_ASK), null);
  });

  it('the whole-KB search still ranks other grades first (why scoping matters)', () => {
    const ranked = searchKBRanked(GRADE6_ASK, 'ar');
    assert.notEqual(gradeOf(ranked[0]!.lesson), 'grade-6');
    assert.equal(isConfidentSingleSubjectHit(ranked), false);
  });
});

describe('chips come from the ask\'s own grade and subject', () => {
  it('«which lesson?» offers no lesson outside grade 6 for a grade 6 ask', () => {
    const ranked = searchKBRanked(GRADE6_ASK, 'ar');
    const scoped = rankedInAskScope(ranked, { gradeId: 'grade-6' }, bookOf, teachesAll);
    assert.ok(scoped.length > 0, 'grade 6 has some lexical hits, so the filter is exercised');
    assert.ok(scoped.every(r => gradeOf(r.lesson) === 'grade-6'));
    const guess = shouldAskWhichLesson({
      intent: 'artifact',
      hasHardContext: false,
      hasDocuments: false,
      isSoftBareArtifact: false,
      ranked: scoped,
    });
    if (guess.ask) {
      assert.ok(guess.candidates.every(c => gradeOf(c) === 'grade-6'));
      assert.ok(!guess.candidates.some(c => c.titleAr.includes('الفندق')));
    }
  });

  it('the unscoped guess is the reported bug: grade 10 English on the word «يوم»', () => {
    const guess = shouldAskWhichLesson({
      intent: 'artifact',
      hasHardContext: false,
      hasDocuments: false,
      isSoftBareArtifact: false,
      ranked: searchKBRanked(GRADE6_ASK, 'ar'),
    });
    assert.equal(guess.ask, true);
    assert.ok(guess.ask && guess.candidates.some(c => gradeOf(c) !== 'grade-6'));
  });

  it('«which subject?» has nothing to ask in the picked grade 8 for the minister ask', () => {
    const results = searchKBRanked(MINISTER_ASK, 'ar').slice(0, 3).map(r => r.lesson);
    // What the screen asked: three subjects, none of them grade 8.
    assert.ok(detectSubjectAmbiguity(results));
    const askable = lessonsInAskScope(results, { gradeId: 'grade-8' }, bookOf, teachesAll);
    assert.deepEqual(askable, []);
    assert.equal(detectSubjectAmbiguity(askable), null);
  });

  it('a subject the teacher does not teach is not offered, even with nothing taught left', () => {
    const results = searchKBRanked(MINISTER_ASK, 'ar').slice(0, 3).map(r => r.lesson);
    const teachesArabic8 = (subjectId: string, gradeId: string) => subjectId === 'arabic' && gradeId === 'grade-8';
    assert.deepEqual(lessonsInAskScope(results, {}, bookOf, teachesArabic8), []);
  });

  it('an unknown part of the scope does not narrow', () => {
    const l = searchKBRanked(GRADE6_ASK, 'ar')[0]!.lesson;
    assert.equal(inAskScope(l, {}, bookOf), true);
    assert.equal(inAskScope(l, { gradeId: null, subjectId: null }, bookOf), true);
    assert.equal(inAskScope(l, { gradeId: gradeOf(l) }, bookOf), true);
    assert.equal(inAskScope(l, { gradeId: 'grade-6' }, bookOf), false);
  });
});

describe('a topic search in the grade grounds only a real topic', () => {
  const topic = freeArtifactTopic(GRADE6_ASK);

  for (const gradeId of ['grade-6', 'grade-8']) {
    it(`common words do not make a ${gradeId} lesson the activity's lesson`, () => {
      const inGrade = searchKBRanked(topic, 'ar', { gradeId });
      // The old gate: any score >= 10. It took one of these silently.
      assert.ok((inGrade[0]?.score ?? 0) >= 10);
      assert.equal(isConfidentSingleSubjectHit(inGrade), false);
      assert.equal(topHitHoldsTopic(inGrade, l => l.unitId), false);
    });
  }

  it('a tie inside one unit is still that unit', () => {
    const lesson = (id: string, unitId: string) => ({ id, unitId }) as unknown as KBLesson;
    const ranked = [
      { lesson: lesson('a', 'u1'), score: 20 },
      { lesson: lesson('b', 'u1'), score: 19 },
      { lesson: lesson('c', 'u2'), score: 6 },
    ];
    assert.equal(topHitHoldsTopic(ranked, l => l.unitId), true);
    ranked[1] = { lesson: lesson('b', 'u3'), score: 19 };
    assert.equal(topHitHoldsTopic(ranked, l => l.unitId), false);
    assert.equal(topHitHoldsTopic([{ lesson: lesson('a', 'u1'), score: 9 }], l => l.unitId), false);
  });

  it('the generator\'s own grounding calls it ungrounded in the grade', () => {
    assert.equal(resolveGeneratorGrounding(topic, 'ar', { scope: { gradeId: 'grade-6' } }).grounded, false);
    assert.match(
      resolveGeneratorGrounding(topic, 'ar', { scope: { gradeId: 'grade-6' } }).ungroundedNote,
      /غير موجود في المنهاج/,
    );
  });
});

describe('the topic and the length the ask names', () => {
  it('keeps the topic and drops the grade and the length', () => {
    assert.equal(freeArtifactTopic(GRADE6_ASK), 'لو كنت وزير التربية ليوم واحد');
    assert.equal(freeArtifactTopic(MINISTER_ASK), 'لو كنت وزير تعليم ليوم واحد');
  });

  it('«لو» opens a topic; «لو سمحت» is only polite', () => {
    assert.equal(topicFromQuery('نشاط لو سمحت عن الدائرة'), 'الدائرة');
    assert.equal(topicFromQuery('ورقة عمل عن الكسور لو سمحت'), 'الكسور');
    assert.equal(topicFromQuery('نشاط: لو كنت قطرة ماء'), 'لو كنت قطرة ماء');
  });

  it('a length is not topic', () => {
    assert.equal(topicFromQuery('نشاط 20 دقيقة عن الكسور'), 'الكسور');
    assert.equal(topicFromQuery('نشاط لمدة ١٠ دقائق عن الكسور'), 'الكسور');
    assert.equal(topicFromQuery('نشاط ربع ساعة عن الكسور'), 'الكسور');
    assert.equal(topicFromQuery('a 15-minute activity about fractions'), 'fractions');
    assert.equal(topicFromQuery('an activity on fractions for 20 minutes'), 'fractions');
  });

  it('a subject is scope, not topic', () => {
    assert.equal(freeArtifactTopic('نشاط في اللغة العربية: لو كنت وزير التربية'), 'لو كنت وزير التربية');
  });

  it('an ask that names only how the activity runs names no topic', () => {
    assert.equal(freeArtifactTopic('نشاط ممتع'), '');
    assert.equal(freeArtifactTopic('نشاط صفي تفاعلي'), '');
    assert.equal(freeArtifactTopic('نشاط'), '');
    assert.equal(freeArtifactTopic('خطة درس لهذا الدرس'), '');
  });

  it('reads the length in minutes', () => {
    assert.equal(durationFromAsk(GRADE6_ASK), 15);
    assert.equal(durationFromAsk('نشاط لمدة ٢٠ دقيقة'), 20);
    assert.equal(durationFromAsk('نشاط 10 دقائق'), 10);
    assert.equal(durationFromAsk('نشاط نصف ساعة'), 30);
    assert.equal(durationFromAsk('نشاط ربع ساعة'), 15);
    assert.equal(durationFromAsk('a 25-minute activity'), 25);
    assert.equal(durationFromAsk('activity for 40 mins'), 40);
  });

  it('names no length when there is none, or none a class runs to', () => {
    assert.equal(durationFromAsk(MINISTER_ASK), null);
    assert.equal(durationFromAsk('نشاط للصف 10'), null);
    assert.equal(durationFromAsk('اختبار من 10 أسئلة'), null);
    assert.equal(durationFromAsk('نشاط 2 دقيقة'), null);
    assert.equal(durationFromAsk('نشاط 500 دقيقة'), null);
  });
});

describe('when chat builds on the typed topic', () => {
  const base = {
    intent: 'artifact',
    hasArtifactType: true,
    hasKBMatch: false,
    hasDocuments: false,
    isSoftBareArtifact: false,
    typedTopic: 'لو كنت وزير التربية ليوم واحد',
  };

  it('an ask for material with a topic and no lesson in scope', () => {
    assert.equal(isFreeTopicArtifactAsk(base), true);
  });

  it('not when something else grounds it, or there is no topic', () => {
    assert.equal(isFreeTopicArtifactAsk({ ...base, hasKBMatch: true }), false);
    assert.equal(isFreeTopicArtifactAsk({ ...base, hasDocuments: true }), false);
    assert.equal(isFreeTopicArtifactAsk({ ...base, isSoftBareArtifact: true }), false);
    assert.equal(isFreeTopicArtifactAsk({ ...base, typedTopic: '' }), false);
  });

  it('not for a question or a change to the last material', () => {
    assert.equal(isFreeTopicArtifactAsk({ ...base, intent: 'teaching' }), false);
    assert.equal(isFreeTopicArtifactAsk({ ...base, intent: 'refinement' }), false);
    assert.equal(isFreeTopicArtifactAsk({ ...base, hasArtifactType: false }), false);
  });
});

describe('the material says it is not from the book', () => {
  it('says so when no lesson grounds it', () => {
    const ar = chatArtifactLeadIn({ topic: 'لو كنت وزير التربية', isAr: true, fromSoftPin: false, fromDocuments: false, inCurriculum: false });
    assert.match(ar, /لم أجد هذا الموضوع درسًا في المنهاج/);
    assert.doesNotMatch(ar, /لدرس «/);
    const en = chatArtifactLeadIn({ topic: 'x', isAr: false, fromSoftPin: false, fromDocuments: false, inCurriculum: false });
    assert.match(en, /no curriculum lesson/);
  });

  it('a grounded lesson keeps its line, an upload its own', () => {
    assert.match(
      chatArtifactLeadIn({ topic: 'الدائرة', isAr: true, fromSoftPin: false, fromDocuments: false, inCurriculum: true }),
      /^المادة جاهزة لدرس «الدائرة»/,
    );
    assert.match(
      chatArtifactLeadIn({ topic: 'ملف', isAr: true, fromSoftPin: false, fromDocuments: true, inCurriculum: false }),
      /الملفات التي رفعتها/,
    );
  });

  it('a free topic with no subject known is labelled «عام», not maths', () => {
    assert.deepEqual(
      resolveArtifactScope(null, { gradeId: 'grade-6' }, 'ar', { freeTopic: true }).subject,
      'عام',
    );
    assert.equal(resolveArtifactScope(null, { gradeId: 'grade-6', subjectId: 'arabic' }, 'ar', { freeTopic: true }).subject, 'اللغة العربية');
    // The upload path keeps its historical default.
    assert.equal(resolveArtifactScope(null, null, 'ar').subject, 'الرياضيات');
  });

  it('the as-typed chip has an id no lesson has, and a label', () => {
    const ranked = searchKBRanked(GRADE6_ASK, 'ar');
    assert.ok(!ranked.some(r => r.lesson.id === AS_TYPED_CHOICE));
    assert.equal(asTypedChoiceLabel('ar'), 'على موضوعي كما كتبته');
  });
});
