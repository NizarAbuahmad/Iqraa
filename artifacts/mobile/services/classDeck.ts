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
  opts?: { lesson?: KBLesson | null; verified?: boolean },
): ClassroomActivity {
  const slides: ActivitySlide[] = [introSlide(ws.title, lessonTitle, isAr)];
  const objSlide = objectivesSlide(opts?.lesson ?? null, lessonTitle, isAr, slides.length + 1);
  if (objSlide) slides.push(objSlide);

  let qNum = 0;
  const answers: string[] = [];
  for (const section of ws.sections ?? []) {
    for (const q of section.questions ?? []) {
      qNum += 1;
      const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
      const answer = q.answer ?? '';
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
              verified: opts?.verified === true,
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
    ...tail,
    ...(parts.media ?? []),
    ...(summary ? [summary] : []),
  ].map((s, i) => ({ ...s, slideNumber: i + 1 }));
}
