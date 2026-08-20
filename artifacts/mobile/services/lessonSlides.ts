/**
 * Slides Maker — turns a lesson into a projectable teaching deck.
 *
 * The distinction from `classDeck.ts` matters: that file projects *questions*
 * (a quiz or worksheet the class answers together). This one projects the
 * *teaching* — outcomes, vocabulary, the explanation, worked examples, the
 * closing summary. Both emit the same `ClassroomActivity` shape, so
 * `presentation.tsx` renders either one with no changes.
 *
 * Source priority is deliberate. The curriculum book (`KBLesson`) wins over
 * anything generated: its النتاجات, مفردات and أمثلة are what the Ministry
 * actually prescribes, and a teacher projecting them is projecting the real
 * curriculum. A generated `LessonPlanOutput` only fills the pedagogical
 * connective tissue the book does not carry — the hook, the practice
 * instructions, the closure. When neither is present for a section, the
 * section is omitted rather than padded: a projected slide that says nothing
 * costs the class more than a shorter deck does.
 */
import type {
  ActivitySlide,
  ClassroomActivity,
  LessonPlanOutput,
} from './ai/AIService.ts';
import type { KBLesson } from './knowledgeBase.ts';

/** Seconds a class gets to attempt a worked example before the reveal. */
const EXAMPLE_THINK_SECONDS = 60;

export interface LessonDeckOptions {
  /** Curriculum lesson — the authoritative source when present. */
  lesson?: KBLesson | null;
  /** Generated plan, used only for sections the book does not carry. */
  plan?: LessonPlanOutput | null;
  subject?: string;
  grade?: string;
  /** Include worked examples as think-then-reveal slides. */
  includeExamples?: boolean;
  /** Include a practice + homework closing sequence. */
  includePractice?: boolean;
}

/** Trim, drop empties, and cap — projected bullets stop being readable past 6. */
function bullets(items: readonly string[] | undefined, max = 6): string[] {
  return (items ?? [])
    .map(s => (s ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function nonEmpty(s: string | undefined | null): string {
  return (s ?? '').trim();
}

/**
 * Language-correct field pick. KBLesson carries parallel ar/en arrays rather
 * than one localized field, so every read has to branch — centralised here so
 * a missed branch cannot ship an English concept list into an Arabic deck.
 */
function pickLang<T>(ar: T | undefined, en: T | undefined, isAr: boolean): T | undefined {
  return isAr ? ar : en;
}

export function buildLessonDeck(
  lessonTitle: string,
  isAr: boolean,
  opts: LessonDeckOptions = {},
): ClassroomActivity {
  const { lesson = null, plan = null } = opts;
  const includeExamples = opts.includeExamples !== false;
  const includePractice = opts.includePractice !== false;
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const title = nonEmpty(lessonTitle)
    || nonEmpty(pickLang(lesson?.titleAr, lesson?.titleEn, isAr))
    || nonEmpty(plan?.title)
    || L('الدرس', 'Lesson');

  const subject = nonEmpty(opts.subject) || nonEmpty(plan?.subject);
  const grade = nonEmpty(opts.grade) || nonEmpty(plan?.grade) || L('الصف العاشر', 'Grade 10');

  const slides: ActivitySlide[] = [];
  const push = (slide: Omit<ActivitySlide, 'slideNumber'>) => {
    slides.push({ ...slide, slideNumber: slides.length + 1 } as ActivitySlide);
  };

  // ── 1. Title ────────────────────────────────────────────────────────────
  const summary = nonEmpty(pickLang(lesson?.summaryAr, lesson?.summaryEn, isAr));
  push({
    type: 'intro',
    title,
    content: [subject && grade ? `${subject} · ${grade}` : subject || grade, summary]
      .filter(Boolean)
      .join('\n\n'),
    durationSeconds: 0,
  });

  // ── 2. Learning outcomes (النتاجات) ─────────────────────────────────────
  // Straight from the book when the curriculum has them. This is the slide
  // teachers are required to show, so it never gets invented from the plan
  // silently — if it came from the generator the deck says so in `groundedIn`.
  // `??` is wrong here: a curriculum lesson with no النتاجات carries an empty
  // array, not undefined, so nullish-coalescing would keep the empty book list
  // and silently drop the plan's objectives — the outcomes slide would vanish
  // for exactly the lessons that most need a generated fallback.
  const bookObjectives = bullets(lesson?.objectives);
  const objectives = bookObjectives.length > 0 ? bookObjectives : bullets(plan?.objectives);
  if (objectives.length > 0) {
    push({
      type: 'intro',
      title: L('🎯 نتاجات التعلم', '🎯 Learning Outcomes'),
      content: objectives.map(o => `• ${o}`).join('\n'),
      durationSeconds: 0,
    });
  }

  // ── 3. Vocabulary (المفردات) ────────────────────────────────────────────
  const terms = (lesson?.keyTerms ?? []).slice(0, 6);
  if (terms.length > 0) {
    push({
      type: 'intro',
      title: L('📖 مفردات الدرس', '📖 Key Vocabulary'),
      content: terms
        .map(term => {
          const word = isAr ? term.ar : term.en;
          const def = isAr ? term.definitionAr : term.definitionEn;
          return def ? `• ${word} — ${def}` : `• ${word}`;
        })
        .join('\n'),
      durationSeconds: 0,
    });
  }

  // ── 4. Hook / introduction ──────────────────────────────────────────────
  const intro = nonEmpty(plan?.introduction);
  if (intro) {
    push({
      type: 'intro',
      title: L('✨ تمهيد', '✨ Warm-up'),
      content: intro,
      durationSeconds: 0,
      teacher: {
        expectedAnswer: L('لا توجد إجابة واحدة — الهدف تفعيل المعرفة السابقة.',
          'No single answer — the point is to activate prior knowledge.'),
        teachingTips: L('اسأل ثم انتظر بصمت خمس ثوانٍ قبل استقبال أي إجابة.',
          'Ask, then wait five silent seconds before taking any answer.'),
      },
    });
  }

  // ── 5. The explanation, one concept per slide ───────────────────────────
  // One concept per slide rather than a single dense slide: the deck is read
  // from the back row, and it is also the teacher's pacing device — advancing
  // is what marks "this idea is finished".
  const concepts = bullets(pickLang(lesson?.keyConceptsAr, lesson?.keyConceptsEn, isAr), 8);
  concepts.forEach((concept, i) => {
    push({
      type: 'intro',
      title: L(`الفكرة ${i + 1}`, `Idea ${i + 1}`),
      content: concept,
      durationSeconds: 0,
    });
  });

  // ── 6. Rules / formulas ─────────────────────────────────────────────────
  const rules = bullets(pickLang(lesson?.rulesAr, lesson?.rulesEn, isAr), 5);
  if (rules.length > 0) {
    push({
      type: 'intro',
      title: L('📐 القاعدة', '📐 The Rule'),
      content: rules.map(r => `• ${r}`).join('\n'),
      durationSeconds: 0,
    });
  }

  // ── 7. Worked examples — attempted before they are shown ────────────────
  // A worked example projected already-solved is a slide students copy. Giving
  // it a timer first makes the same content an attempt, which is why these are
  // 'challenge' slides with the answer behind a reveal.
  const examples = includeExamples
    ? bullets(pickLang(lesson?.examplesAr, lesson?.examplesEn, isAr), 4)
    : [];
  examples.forEach((example, i) => {
    // Examples in the book are stored as "problem = answer" or "problem → answer"
    // when an answer is present; splitting keeps the answer out of view until
    // the reveal instead of projecting it with the question.
    const [problem, answer] = splitExample(example);
    push({
      type: 'challenge',
      title: L(`مثال ${i + 1}`, `Example ${i + 1}`),
      content: problem,
      durationSeconds: EXAMPLE_THINK_SECONDS,
      ...(answer ? { answer } : {}),
      teacher: {
        expectedAnswer: answer || L('اعرض الحل خطوة بخطوة على السبورة.',
          'Work the solution step by step on the board.'),
        teachingTips: L('اتركهم يحاولون أولًا — اكشف الحل بعد انتهاء المؤقت.',
          'Let them attempt it first — reveal only after the timer ends.'),
      },
    });
  });

  // ── 8. Practice ─────────────────────────────────────────────────────────
  if (includePractice) {
    const guided = nonEmpty(plan?.guidedPractice);
    if (guided) {
      push({
        type: 'intro',
        title: L('🤝 تدريب موجّه', '🤝 Guided Practice'),
        content: guided,
        durationSeconds: 0,
      });
    }
    const independent = nonEmpty(plan?.independentPractice);
    if (independent) {
      push({
        type: 'intro',
        title: L('✍️ تدريب مستقل', '✍️ Independent Practice'),
        content: independent,
        durationSeconds: 0,
      });
    }
  }

  // ── 9. Closure ──────────────────────────────────────────────────────────
  const closure = nonEmpty(plan?.closure);
  push({
    type: 'summary',
    title: L('🎉 ملخص الدرس', '🎉 Lesson Summary'),
    content: closure || (objectives.length > 0
      ? L(`راجعنا اليوم:\n${objectives.map(o => `• ${o}`).join('\n')}`,
          `Today we covered:\n${objectives.map(o => `• ${o}`).join('\n')}`)
      : L(`أنهينا درس «${title}».`, `We finished “${title}”.`)),
    durationSeconds: 0,
  });

  // ── 10. Homework, only when there is one ────────────────────────────────
  const homework = includePractice ? nonEmpty(plan?.homework) : '';
  if (homework) {
    push({
      type: 'intro',
      title: L('🏠 الواجب', '🏠 Homework'),
      content: homework,
      durationSeconds: 0,
    });
  }

  const grounded = (lesson?.objectives?.length ?? 0) > 0 || concepts.length > 0;

  return {
    activityName: title,
    activityType: 'lesson-slides',
    grade,
    subject,
    lesson: title,
    duration: plan?.duration ?? 45,
    difficulty: 'standard',
    groupType: 'whole-class',
    learningObjective: objectives[0]
      ?? L(`شرح درس «${title}» على الشاشة`, `Teach “${title}” on screen`),
    materials: bullets(plan?.materials).length > 0
      ? bullets(plan?.materials)
      : [L('شاشة عرض', 'Projector')],
    teacherPreparation: grounded
      ? L('الشرائح مبنية على كتاب المنهاج — راجعها قبل الحصة وعدّل ما يلزم.',
          'Slides are built from the curriculum book — review and adjust before class.')
      : L('الشرائح مولّدة وليست مأخوذة من كتاب المنهاج — راجع المحتوى قبل عرضه.',
          'Slides are generated, not taken from the curriculum book — review before projecting.'),
    teacherNotes: bullets(plan?.differentiation ? [plan.differentiation] : []),
    answerKey: examples
      .map(splitExample)
      .map(([, answer], i) => (answer ? L(`مثال ${i + 1}: ${answer}`, `Example ${i + 1}: ${answer}`) : ''))
      .filter(Boolean),
    printables: [],
    assessment: nonEmpty(plan?.assessment),
    extensionChallenge: '',
    slides,
  };
}

/**
 * Split a stored example into problem and answer.
 *
 * Book examples arrive as a single string; when they carry their answer it is
 * after the last '=' or an arrow. Splitting on the LAST separator is what makes
 * this safe for maths — `2x + 3 = 11 → x = 4` must split at the arrow, not at
 * the first '=' which is part of the equation itself.
 */
export function splitExample(example: string): [problem: string, answer: string] {
  const text = (example ?? '').trim();
  const arrow = Math.max(text.lastIndexOf('→'), text.lastIndexOf('=>'), text.lastIndexOf('⇒'));
  if (arrow > 0) {
    const sepLen = text.slice(arrow).startsWith('=>') ? 2 : 1;
    return [text.slice(0, arrow).trim(), text.slice(arrow + sepLen).trim()];
  }
  // A trailing "الجواب: …" / "Answer: …" is the other convention in the bank.
  const labelled = text.match(/^([\s\S]+?)[\s]*(?:الجواب|الحل|Answer|Solution)\s*[:：]\s*([\s\S]+)$/);
  if (labelled) return [labelled[1].trim(), labelled[2].trim()];
  return [text, ''];
}
