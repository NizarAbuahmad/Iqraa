/**
 * Class Mode — turns prepared material into a projectable deck.
 *
 * Phase-1 classroom model: student phones are banned in Jordanian schools,
 * so the projector IS the interactive surface. Every question slide is
 * answered from the seat (printed أ ب ج د letter cards or mini whiteboards),
 * and the teacher reveals on the screen.
 *
 * Reuses the existing ActivitySlide contract so the presentation screen
 * renders these decks with no changes: 'question' slides already carry
 * options / correctIndex / verified.
 */
import type {
  ActivitySlide,
  ClassroomActivity,
  QuizOutput,
  WorksheetOutput,
} from './ai/AIService.ts';
import type { KBLesson } from './knowledgeBase.ts';

const THINK_SECONDS = 45;

/** Class Challenge gives less thinking time — the timer is part of the game. */
const GAME_THINK_SECONDS = 30;

/** Questions between scoreboard breaks. Every question kills the pace; only at
 *  the end removes the comeback tension that makes the format work. */
const SCOREBOARD_EVERY = 3;

/**
 * Turn one question's verification outcome into slide fields.
 *
 * A missing outcome is not "unverified pending" — it is unverified, full stop,
 * and gets no badge. The projector's badge is the only thing standing between a
 * teacher and asserting to a room that a wrong answer was checked.
 */
function outcomeFields(
  outcome: { verifiedBy: 'symbolic' | 'bank'; computedAnswer?: string } | undefined,
): Pick<ActivitySlide, 'verified' | 'verifiedBy' | 'computedAnswer'> {
  if (!outcome) return { verified: false };
  return {
    verified: true,
    verifiedBy: outcome.verifiedBy,
    ...(outcome.computedAnswer ? { computedAnswer: outcome.computedAnswer } : {}),
  };
}

/** Options are stored display-ready; find the correct one by exact text. */
function indexOfAnswer(options: string[], answer: string): number {
  const i = options.indexOf(answer);
  if (i >= 0) return i;
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
  return Math.max(0, options.findIndex(o => norm(o) === norm(answer)));
}

function introSlide(titleAr: string, lessonTitle: string, isAr: boolean): ActivitySlide {
  return {
    slideNumber: 1,
    type: 'intro',
    title: isAr ? `📚 ${titleAr}` : `📚 ${titleAr}`,
    content: isAr
      ? `${lessonTitle}\n\nالقواعد:\n• يظهر السؤال ويبدأ المؤقت\n• الجميع يفكر بصمت — لا أيدي مرفوعة\n• عند انتهاء الوقت: الكل يرفع بطاقة الحرف معًا\n• ثم نكشف الإجابة ونناقش`
      : `${lessonTitle}\n\nRules:\n• The question appears and the timer starts\n• Everyone thinks silently — no hands up\n• When time ends: everyone raises a letter card together\n• Then we reveal and discuss`,
    durationSeconds: 0,
  };
}

function summarySlide(n: number, lessonTitle: string, isAr: boolean): ActivitySlide {
  return {
    slideNumber: n,
    type: 'summary',
    title: isAr ? '🎉 أحسنتم!' : '🎉 Well done!',
    content: isAr
      ? `أنهينا مراجعة «${lessonTitle}».\n\nناقش مع زميلك:\n• أي سؤال كان الأصعب؟\n• ما الخطأ الذي فهمته الآن؟`
      : `We finished reviewing “${lessonTitle}”.\n\nDiscuss with a partner:\n• Which question was hardest?\n• Which mistake do you now understand?`,
    durationSeconds: 0,
  };
}

/** Objectives slide from the real curriculum book (النتاجات), when available. */
export function objectivesSlide(
  lesson: KBLesson | null,
  lessonTitle: string,
  isAr: boolean,
  slideNumber = 2,
): ActivitySlide | null {
  const objectives = lesson?.objectives ?? [];
  if (objectives.length === 0) return null;
  return {
    slideNumber,
    type: 'intro',
    title: isAr ? '🎯 نتاجات التعلم' : '🎯 Learning Outcomes',
    content: `${lessonTitle}\n\n${objectives.map(o => `• ${o}`).join('\n')}`,
    durationSeconds: 0,
  };
}

/**
 * Quiz → projectable deck. Multiple-choice questions become whole-class
 * response slides; open-ended ones become think-and-write prompts.
 */
export function buildDeckFromQuiz(
  quiz: QuizOutput,
  lessonTitle: string,
  isAr: boolean,
  opts?: {
    lesson?: KBLesson | null;
    /**
     * Whole-deck claim. Kept for callers that genuinely vouch for every key.
     * Prefer `outcomes`: a quiz mixes items the verifier can prove with ones it
     * cannot, so one boolean is wrong in one direction or the other — `true`
     * vouches for keys nobody checked, `false` hides the ones that were.
     */
    verified?: boolean;
    /** Per-question provenance, positionally aligned with quiz.questions. */
    outcomes?: (
      | { verifiedBy: 'symbolic' | 'bank'; computedAnswer?: string }
      | undefined
    )[];
  },
): ClassroomActivity {
  const slides: ActivitySlide[] = [introSlide(quiz.title, lessonTitle, isAr)];
  const objSlide = objectivesSlide(opts?.lesson ?? null, lessonTitle, isAr, slides.length + 1);
  if (objSlide) slides.push(objSlide);

  quiz.questions.forEach((q, i) => {
    const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
    slides.push({
      slideNumber: slides.length + 1,
      type: hasOptions ? 'question' : 'challenge',
      title: isAr ? `سؤال ${i + 1}` : `Question ${i + 1}`,
      content: q.text,
      ...(hasOptions
        ? {
            options: q.options,
            correctIndex: indexOfAnswer(q.options!, q.correctAnswer),
            // Per-question outcome wins when supplied. `verifiedBy: 'bank'`
            // still shows a badge — it says the answer came from the reviewed
            // bank, which is a claim about provenance, not about proof.
            ...(opts?.outcomes
              ? outcomeFields(opts.outcomes[i])
              : { verified: opts?.verified === true }),
          }
        : { answer: q.correctAnswer }),
      durationSeconds: THINK_SECONDS,
      teacher: {
        expectedAnswer: q.correctAnswer,
        teachingTips: isAr
          ? 'الكل يجيب معًا عند انتهاء المؤقت — اقرأ توزيع الإجابات قبل الكشف.'
          : 'Everyone answers together when the timer ends — read the spread before revealing.',
        ...(q.explanation ? { commonMisconceptions: q.explanation } : {}),
      },
    });
  });

  slides.push(summarySlide(slides.length + 1, lessonTitle, isAr));

  return {
    activityName: quiz.title,
    activityType: 'class-mode-quiz',
    grade: isAr ? 'الصف العاشر' : 'Grade 10',
    subject: '',
    lesson: lessonTitle,
    duration: quiz.duration || 15,
    difficulty: 'standard',
    groupType: 'whole-class',
    learningObjective: isAr
      ? `مراجعة «${lessonTitle}» بإجابة كل الطلاب على كل سؤال`
      : `Review “${lessonTitle}” with every student answering every question`,
    materials: isAr
      ? ['بطاقات الحروف أ ب ج د (أو ألواح صغيرة)', 'شاشة عرض']
      : ['A B C D letter cards (or mini whiteboards)', 'Projector'],
    teacherPreparation: isAr
      ? 'اعرض الشاشة، شغّل المؤقت، والجميع يجيب من مقاعدهم.'
      : 'Project the screen, run the timer, everyone answers from their seat.',
    teacherNotes: [],
    answerKey: quiz.questions.map((q, i) =>
      isAr ? `سؤال ${i + 1}: ${q.correctAnswer}` : `Q${i + 1}: ${q.correctAnswer}`,
    ),
    printables: [],
    assessment: isAr
      ? 'توزيع الإجابات هو التقييم: أي خيار خاطئ يرتفع كثيرًا يحدد ما يجب إعادة شرحه.'
      : 'The spread of answers is the assessment: a frequent wrong option shows what to re-teach.',
    extensionChallenge: '',
    slides,
  };
}

/** Worksheet → projectable deck (same rules; sections are flattened). */
export function buildDeckFromWorksheet(
  ws: WorksheetOutput,
  lessonTitle: string,
  isAr: boolean,
  opts?: {
    lesson?: KBLesson | null;
    /**
     * Whole-deck claim. Kept for callers that genuinely vouch for every key.
     * Prefer `outcomes` — see buildDeckFromQuiz's doc for why a single
     * boolean is wrong in one direction or the other.
     */
    verified?: boolean;
    /**
     * Per-question provenance, positionally aligned with the flattened
     * `sections[].questions[]` list — the same order `verifyWorksheetAnswers`
     * returns and the answer key below already uses.
     */
    outcomes?: (
      | { verifiedBy: 'symbolic' | 'bank'; computedAnswer?: string }
      | undefined
    )[];
  },
): ClassroomActivity {
  const slides: ActivitySlide[] = [introSlide(ws.title, lessonTitle, isAr)];
  const objSlide = objectivesSlide(opts?.lesson ?? null, lessonTitle, isAr, slides.length + 1);
  if (objSlide) slides.push(objSlide);

  // A worksheet question carries no answer of its own — the generator only
  // ever fills in the top-level answerKey, keyed by 1-based position across
  // this same flattened section/question order.
  const answerByPosition = new Map(ws.answerKey.map(a => [a.num, a.answer]));

  let qNum = 0;
  const answers: string[] = [];
  for (const section of ws.sections ?? []) {
    for (const q of section.questions ?? []) {
      qNum += 1;
      const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
      const answer = answerByPosition.get(qNum) ?? '';
      answers.push(isAr ? `سؤال ${qNum}: ${answer}` : `Q${qNum}: ${answer}`);
      slides.push({
        slideNumber: slides.length + 1,
        type: hasOptions ? 'question' : 'challenge',
        title: isAr ? `سؤال ${qNum}` : `Question ${qNum}`,
        content: q.text,
        ...(hasOptions
          ? {
              options: q.options,
              correctIndex: indexOfAnswer(q.options!, answer),
              // Per-question outcome wins when supplied — same rule as
              // buildDeckFromQuiz: 'bank' still shows a badge, since that's a
              // claim about provenance (came from the reviewed bank), not a
              // claim that anything checked it.
              ...(opts?.outcomes
                ? outcomeFields(opts.outcomes[qNum - 1])
                : { verified: opts?.verified === true }),
            }
          : answer
            ? { answer }
            : {}),
        durationSeconds: THINK_SECONDS,
        ...(answer
          ? {
              teacher: {
                expectedAnswer: answer,
                teachingTips: isAr
                  ? 'الكل يجيب معًا عند انتهاء المؤقت.'
                  : 'Everyone answers together when the timer ends.',
              },
            }
          : {}),
      });
    }
  }

  slides.push(summarySlide(slides.length + 1, lessonTitle, isAr));

  return {
    activityName: ws.title,
    activityType: 'class-mode-worksheet',
    grade: isAr ? 'الصف العاشر' : 'Grade 10',
    subject: '',
    lesson: lessonTitle,
    duration: 15,
    difficulty: 'standard',
    groupType: 'whole-class',
    learningObjective: isAr
      ? `حل تمارين «${lessonTitle}» جماعيًا على الشاشة`
      : `Work through “${lessonTitle}” exercises together on screen`,
    materials: isAr
      ? ['بطاقات الحروف أ ب ج د (أو ألواح صغيرة)', 'شاشة عرض']
      : ['A B C D letter cards (or mini whiteboards)', 'Projector'],
    teacherPreparation: isAr
      ? 'يمكن عرض الورقة نفسها التي وزّعتها على الطلاب.'
      : 'Project the same worksheet you handed out.',
    teacherNotes: [],
    answerKey: answers,
    printables: [],
    assessment: isAr ? 'راقب توزيع الإجابات عند كل كشف.' : 'Watch the spread of answers at each reveal.',
    extensionChallenge: '',
    slides,
  };
}

/**
 * Deck order for Start Class: intro → objectives → [graph] → questions →
 * [teacher's media] → summary.
 *
 * Every part except the intro is optional, and the order is the point: the
 * class sees what it is meant to learn before it sees a question about it.
 * This lived inline in the home screen, where it could not be tested and did
 * not survive that screen being retired.
 */
export function assembleDeckSlides(parts: {
  activitySlides: ActivitySlide[];
  objectives?: ActivitySlide | null;
  graph?: ActivitySlide | null;
  chart?: ActivitySlide | null;
  media?: ActivitySlide[];
}): ActivitySlide[] {
  const [intro, ...rest] = parts.activitySlides;
  if (!intro) return [];

  // A trailing summary is moved to the end so appended media does not land
  // after "Well done!". Only a trailing one — a summary mid-deck is a
  // deliberate section break and stays put.
  const tail = [...rest];
  const summary =
    tail.length && tail[tail.length - 1]!.type === 'summary' ? tail.pop()! : null;

  return [
    intro,
    ...(parts.objectives ? [parts.objectives] : []),
    ...(parts.graph ? [parts.graph] : []),
    ...(parts.chart ? [parts.chart] : []),
    ...tail,
    ...(parts.media ?? []),
    ...(summary ? [summary] : []),
  ].map((s, i) => ({ ...s, slideNumber: i + 1 }));
}

/**
 * Quiz → Class Challenge deck (the team game).
 *
 * Same phone-free answering routine as `buildDeckFromQuiz` — every student
 * answers on their أ ب ج د card — but the reveal is followed by the teacher
 * awarding teams, and the deck carries scoreboard breaks and a podium.
 *
 * Only multiple-choice questions become scoreable. An open-ended question has
 * no whole-class response a teacher can adjudicate at a glance, so scoring it
 * would mean judging 30 written answers mid-game; those questions are dropped
 * from a game deck rather than becoming un-scoreable slides that break the
 * rhythm. `questionCount` therefore counts the surviving questions, not the
 * quiz's — the ledger and the deck must agree or every streak after the first
 * dropped question is credited to the wrong slide.
 */
export function buildGameDeckFromQuiz(
  quiz: QuizOutput,
  lessonTitle: string,
  isAr: boolean,
  opts: { teamCount: number; lesson?: KBLesson | null; verified?: boolean },
): ClassroomActivity {
  const teamCount = Math.max(2, Math.min(6, Math.floor(opts.teamCount) || 2));
  const scoreable = quiz.questions.filter(q => Array.isArray(q.options) && q.options.length >= 2);

  const slides: ActivitySlide[] = [{
    slideNumber: 1,
    type: 'intro',
    title: isAr ? `🏆 تحدي الصف — ${quiz.title}` : `🏆 Class Challenge — ${quiz.title}`,
    content: isAr
      ? `${lessonTitle}\n\nالقواعد:\n• الصف مقسوم إلى ${teamCount} فرق\n• يظهر السؤال ويبدأ المؤقت\n• الجميع يفكر بصمت — لا أيدي مرفوعة\n• عند انتهاء الوقت: كل فريق يرفع بطاقة الحرف معًا\n• الفريق المصيب يأخذ ١٠٠ نقطة — والإجابات المتتالية تعطي نقاطًا إضافية`
      : `${lessonTitle}\n\nRules:\n• The class is split into ${teamCount} teams\n• The question appears and the timer starts\n• Everyone thinks silently — no hands up\n• When time ends: each team raises its letter card together\n• A correct team scores 100 points — consecutive answers earn a bonus`,
    durationSeconds: 0,
  }];

  const objSlide = objectivesSlide(opts.lesson ?? null, lessonTitle, isAr, slides.length + 1);
  if (objSlide) slides.push(objSlide);

  scoreable.forEach((q, i) => {
    slides.push({
      slideNumber: slides.length + 1,
      type: 'question',
      title: isAr ? `سؤال ${i + 1}` : `Question ${i + 1}`,
      content: q.text,
      options: q.options,
      correctIndex: indexOfAnswer(q.options!, q.correctAnswer),
      verified: opts.verified === true,
      questionIndex: i,
      durationSeconds: GAME_THINK_SECONDS,
      teacher: {
        expectedAnswer: q.correctAnswer,
        teachingTips: isAr
          ? 'اكشف الإجابة أولًا، ثم اضغط على الفرق التي أصابت.'
          : 'Reveal the answer first, then tap the teams that were right.',
        ...(q.explanation ? { commonMisconceptions: q.explanation } : {}),
      },
    });

    // Break for the board — but never immediately before the podium, which
    // shows the same standings one slide later.
    const isLast = i === scoreable.length - 1;
    if (!isLast && (i + 1) % SCOREBOARD_EVERY === 0) {
      slides.push({
        slideNumber: slides.length + 1,
        type: 'scoreboard',
        title: isAr ? '📊 الترتيب الحالي' : '📊 Standings',
        content: isAr
          ? `بعد ${i + 1} من ${scoreable.length} أسئلة`
          : `After ${i + 1} of ${scoreable.length} questions`,
        durationSeconds: 0,
      });
    }
  });

  slides.push({
    slideNumber: slides.length + 1,
    type: 'podium',
    title: isAr ? '🏆 النتيجة النهائية' : '🏆 Final Result',
    content: isAr ? `تحدي «${lessonTitle}»` : `“${lessonTitle}” challenge`,
    durationSeconds: 0,
  });

  return {
    activityName: isAr ? `تحدي الصف — ${quiz.title}` : `Class Challenge — ${quiz.title}`,
    activityType: 'class-game',
    grade: isAr ? 'الصف العاشر' : 'Grade 10',
    subject: '',
    lesson: lessonTitle,
    duration: Math.max(10, scoreable.length * 2),
    difficulty: 'standard',
    groupType: 'groups',
    learningObjective: isAr
      ? `مراجعة «${lessonTitle}» كمنافسة بين الفرق مع إجابة كل الطلاب`
      : `Review “${lessonTitle}” as a team contest with every student answering`,
    materials: isAr
      ? ['بطاقات الحروف أ ب ج د لكل طالب', 'شاشة عرض', 'تقسيم الصف إلى فرق']
      : ['A B C D letter cards for every student', 'Projector', 'Class split into teams'],
    teacherPreparation: isAr
      ? `قسّم الصف إلى ${teamCount} فرق قبل البدء، ووزّع بطاقات الحروف.`
      : `Split the class into ${teamCount} teams before starting and hand out the letter cards.`,
    teacherNotes: [],
    answerKey: scoreable.map((q, i) =>
      isAr ? `سؤال ${i + 1}: ${q.correctAnswer}` : `Q${i + 1}: ${q.correctAnswer}`,
    ),
    printables: [],
    assessment: isAr
      ? 'النتيجة تقيس الفريق، لكن توزيع البطاقات المرفوعة هو ما يكشف الخطأ الشائع — انظر إليه قبل الكشف.'
      : 'The score measures the team, but the spread of raised cards is what exposes the common error — read it before revealing.',
    extensionChallenge: '',
    game: { teamCount, questionCount: scoreable.length },
    slides,
  };
}
