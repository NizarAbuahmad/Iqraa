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
  pickedSubjectInGrade,
  refinementFreeTopic,
} from '../ai/chatArtifactRoute.ts';
import { durationFromAsk } from '../ai/examAsk.ts';
import { topicFromQuery } from '../ai/artifactTopic.ts';
import { resolveArtifactScope } from '../ai/artifactScope.ts';
import {
  chooseArtifactLesson,
  inAskScope,
  lessonsInAskScope,
  rankedInAskScope,
  shouldAskWhichLesson,
  topHitHoldsTopic,
} from '../kbSuggestion.ts';
import { getBookForLesson, searchKBRanked, type KBLesson } from '../knowledgeBase.ts';
import {
  artifactGuessRanked,
  detectSubjectAmbiguity,
  isConfidentSingleSubjectHit,
  resolveGeneratorGrounding,
  ungroundedGeneratorNote,
} from '../kbContext.ts';
import { extractQueryGradeId, extractQuerySubjectId, pinLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';
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
  /** What «which lesson?» is given for an ask in `gradeId`, as the screen builds it. */
  const guessFor = (q: string, gradeId: string) => {
    const ranked = searchKBRanked(q, 'ar');
    return artifactGuessRanked({
      query: q,
      topic: freeArtifactTopic(q),
      lang: 'ar',
      ranked,
      confidentHit: isConfidentSingleSubjectHit(ranked),
      scope: { gradeId },
      teaches: teachesAll,
    });
  };
  const asks = (ranked: ReturnType<typeof guessFor>) => shouldAskWhichLesson({
    intent: 'artifact',
    hasHardContext: false,
    hasDocuments: false,
    isSoftBareArtifact: false,
    ranked,
  });

  it('«which lesson?» offers only grade 6 lessons for the grade 6 ask', () => {
    const guess = asks(guessFor(GRADE6_ASK, 'grade-6'));
    // It still asks: grade 6 has lexical near-misses (social studies 12,
    // «التربية الإعلامية» 11 on «التربية»). The screen adds «على موضوعي كما
    // كتبته» to these chips, so the question is never a dead end.
    assert.equal(guess.ask, true);
    assert.ok(guess.ask && guess.candidates.length > 0);
    assert.ok(guess.ask && guess.candidates.every(c => gradeOf(c) === 'grade-6'));
    assert.ok(guess.ask && !guess.candidates.some(c => c.titleAr.includes('الفندق')));
  });

  it('a confident whole-KB hit with a named grade does not ask (the topic search decides)', () => {
    // Scoping the whole-message list here once offered grade 10 English «طرق
    // العمل» (it matches «ورقة عمل») as the first chip.
    assert.deepEqual(guessFor('ورقة عمل عن محيط الدائرة للصف العاشر', 'grade-10'), []);
  });

  it('an in-scope hit that holds the topic does not ask', () => {
    assert.deepEqual(guessFor('نشاط عن الماء للصف الرابع', 'grade-4'), []);
  });

  it('a real choice in scope is still asked', () => {
    const guess = asks(guessFor('خطة درس عن الكسور للصف السادس', 'grade-6'));
    assert.equal(guess.ask, true);
    assert.ok(guess.ask && guess.candidates.every(c => gradeOf(c) === 'grade-6'));
    assert.ok(guess.ask && guess.candidates.some(c => c.titleAr.includes('الكُسورِ')));
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

  it('chat\'s «no lesson» note is the generator\'s ungrounded note', () => {
    // Sent as-is when chat decided there is no lesson: re-grounding «الصداقة»
    // by its words found grade 2 Islamic «الصَّداقَة» for a grade 5 worksheet.
    assert.ok(resolveGeneratorGrounding('الصداقة', 'ar', { scope: { gradeId: 'grade-5' } }).grounded);
    assert.match(ungroundedGeneratorNote('ar'), /غير موجود في المنهاج/);
    assert.equal(ungroundedGeneratorNote('en'), resolveGeneratorGrounding('zzqq no such topic', 'en').ungroundedNote);
  });

  it('the generator\'s own grounding calls it ungrounded in the grade', () => {
    assert.equal(resolveGeneratorGrounding(topic, 'ar', { scope: { gradeId: 'grade-6' } }).grounded, false);
    assert.match(
      resolveGeneratorGrounding(topic, 'ar', { scope: { gradeId: 'grade-6' } }).ungroundedNote,
      /غير موجود في المنهاج/,
    );
  });
});

describe('the lesson a material is built on', () => {
  const lesson = (id: string) => ({ id, titleAr: id, titleEn: id }) as unknown as KBLesson;
  const base = {
    pinned: null,
    asTyped: false,
    topicRanked: [] as { lesson: KBLesson; score: number }[],
    strong: false,
    results: [] as KBLesson[],
    inScope: () => true,
    typedTopic: '',
    documentsFirst: false,
    softLesson: null,
  };

  it('a tapped lesson, always; none when the teacher chose the typed topic', () => {
    const tapped = lesson('tapped');
    assert.equal(chooseArtifactLesson({ ...base, pinned: tapped, strong: true, topicRanked: [{ lesson: lesson('x'), score: 50 }] }), tapped);
    assert.equal(chooseArtifactLesson({ ...base, asTyped: true, strong: true, topicRanked: [{ lesson: lesson('x'), score: 50 }] }), null);
  });

  it('a whole-message hit the topic search does not find is no lesson («اختبار عن الخلية»)', () => {
    // Grade 10 picked: the whole-message search kept maths «الاقتران العكسي»
    // (it matched «اختبار»), and the quiz was going to be a maths one titled «الخلية».
    const q = 'اختبار عن الخلية';
    const maths = searchKBRanked(q, 'ar').map(r => r.lesson).find(l => gradeOf(l) === 'grade-10')!;
    assert.ok(maths, 'the whole-message search has a grade 10 hit');
    const topicRanked = searchKBRanked(freeArtifactTopic(q), 'ar', { gradeId: 'grade-10' });
    assert.equal(chooseArtifactLesson({
      ...base,
      topicRanked,
      strong: isConfidentSingleSubjectHit(topicRanked) || topHitHoldsTopic(topicRanked, l => l.unitId),
      results: [maths],
      typedTopic: freeArtifactTopic(q),
    }), null);
  });

  it('a whole-message hit is kept when the topic search finds it too, or no topic was typed', () => {
    const hit = lesson('hit');
    assert.equal(chooseArtifactLesson({ ...base, results: [hit], typedTopic: 'x', topicRanked: [{ lesson: hit, score: 6 }] }), hit);
    assert.equal(chooseArtifactLesson({ ...base, results: [hit] }), hit);
  });

  it('never a hit outside the scope; the card\'s lesson for a bare ask; uploads first', () => {
    const out = lesson('out');
    const soft = lesson('soft');
    assert.equal(chooseArtifactLesson({ ...base, results: [out], inScope: () => false }), null);
    assert.equal(chooseArtifactLesson({ ...base, results: [out], inScope: () => false, softLesson: soft }), soft);
    assert.equal(chooseArtifactLesson({ ...base, results: [out], documentsFirst: true }), null);
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

  it('minutes that are the lesson are neither a length nor taken out of the topic', () => {
    // Grade 2 maths «الْوَقْتُ لِأَقْرَبِ 5 دَقائِق», typed without vowels.
    assert.equal(topicFromQuery('ورقة عمل عن الوقت لأقرب 5 دقائق'), 'الوقت لأقرب 5 دقائق');
    assert.equal(durationFromAsk('ورقة عمل عن الوقت لأقرب 5 دقائق'), null);
    assert.equal(durationFromAsk('ورقة عمل عن الوقت لأقرب 15 دقيقة'), null);
    assert.equal(topicFromQuery('ورقة عمل عن تحويل 120 دقيقة إلى ساعات'), 'تحويل 120 دقيقة إلى ساعات');
    assert.equal(durationFromAsk('ورقة عمل عن تحويل 120 دقيقة إلى ساعات'), null);
    assert.equal(topicFromQuery('worksheet on Time to the Nearest 5 Minutes'), 'Time to the Nearest 5 Minutes');
    assert.equal(durationFromAsk('worksheet on Time to the Nearest 5 Minutes'), null);
    // …while a length next to them is still read.
    assert.equal(durationFromAsk('نشاط 20 دقيقة عن الوقت لأقرب 5 دقائق'), 20);
  });

  it('English "fun" and "interactive" stay in a topic', () => {
    assert.equal(topicFromQuery('activity about fun facts of space'), 'fun facts of space');
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

  it('not for a question, or with no material to make', () => {
    assert.equal(isFreeTopicArtifactAsk({ ...base, intent: 'teaching' }), false);
    assert.equal(isFreeTopicArtifactAsk({ ...base, hasArtifactType: false }), false);
  });

  it('a change to a material built on a typed topic keeps that topic', () => {
    // «اجعله أقصر» went back to the card's lesson, or with none asked «أي درس؟».
    const last = 'لو كنت وزير التربية ليوم واحد';
    assert.equal(refinementFreeTopic('اجعله أقصر', last), last);
    assert.equal(isFreeTopicArtifactAsk({ ...base, intent: 'refinement', typedTopic: refinementFreeTopic('اجعله أقصر', last) }), true);
    // A quoted lesson names its own topic; no free topic, none to keep.
    assert.equal(refinementFreeTopic('حسّن خطة الدرس عن «الدائرة»', last), '');
    assert.equal(refinementFreeTopic('اجعله أقصر', null), '');
  });

  it('pinning a lesson forgets the free topic', () => {
    const lesson = searchKBRanked('الدائرة', 'ar')[0]!.lesson;
    const memory = { ...emptyChatSessionMemory(), freeTopic: 'لو كنت وزير التربية' };
    assert.equal(pinLesson(memory, lesson, 'hard').freeTopic, null);
  });
});

describe('the subject a free topic is labelled with', () => {
  it('the picked lesson\'s only when it is in the request\'s grade', () => {
    const maths10 = { gradeId: 'grade-10', subjectId: 'mathematics' };
    const arabic6 = { gradeId: 'grade-6', subjectId: 'arabic' };
    // A grade 10 maths card does not make a grade 6 activity maths.
    assert.equal(pickedSubjectInGrade('grade-6', [maths10, null]), null);
    assert.equal(pickedSubjectInGrade('grade-6', [maths10, arabic6]), 'arabic');
    assert.equal(pickedSubjectInGrade('grade-10', [maths10]), 'mathematics');
    assert.equal(pickedSubjectInGrade(null, [maths10]), 'mathematics');
    assert.equal(pickedSubjectInGrade('grade-6', []), null);
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
