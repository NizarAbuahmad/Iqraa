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
import { buildGraphSlide } from './classMedia.ts';

/**
 * Split a generated warm-up into what the class sees and what only the
 * teacher needs.
 *
 * Generated intros are written *at the teacher* — "ابدأ بطرح السؤال: «…»
 * سجّل إجابات الطلاب على السبورة" — and this slide is projected on the class
 * screen. Stage directions up there tell the room what the teacher is about
 * to do instead of giving it something to think about, so the quoted
 * question is projected alone and the full instruction moves to the teacher
 * notes. No quoted question means nothing to lift out: the text projects as
 * it always did rather than leaving the slide blank.
 */
export function splitWarmup(intro: string): { projected: string; notes: string } {
  const quoted = intro.match(/[«"“]\s*([^»"”]*[?؟])\s*[»"”]/u);
  const question = quoted?.[1]?.trim();
  return question ? { projected: question, notes: intro } : { projected: intro, notes: '' };
}

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
  /**
   * GeoGebra commands extracted from the lesson's own text (see
   * `extractGraphCommands`). Non-empty → a live graph slide lands between
   * the rule and the worked examples. Unlike the quick-check deck, which
   * always adds a (possibly blank) calculator for math, this deck follows
   * its own rule — omit rather than pad — so no commands means no slide.
   */
  graphCommands?: string[];
  /**
   * Formative check questions, already generated (see the quick-check
   * generator). The deck places them; it never invents them. Passing none
   * leaves the deck exactly as it was before checks existed.
   */
  checks?: ActivitySlide[];
}

/** Mid-lesson checks, at most. Two interruptions in 45 minutes, not five. */
export const MID_LESSON_CHECK_MAX = 2;
/** Exit-ticket questions, at most. */
export const EXIT_TICKET_MAX = 3;
/**
 * Below this an exit ticket is not one — a single question at the door reads
 * as an afterthought, and that question is worth more mid-lesson where the
 * answer can still change what the teacher does next.
 */
const EXIT_TICKET_MIN = 2;

/**
 * Split generated check questions between the two jobs they do.
 *
 * Mid-lesson checks are diagnostic: the teacher reads the room and decides
 * whether to move on. The exit ticket is summative-ish: it leaves the room on
 * paper and tells the teacher what tomorrow starts with. They must be
 * *different* questions — reusing a mid-lesson question at the door measures
 * whether the class remembers the reveal, not whether it learned.
 *
 * Nothing is padded and nothing is dropped below five: with too few for an
 * exit ticket, the spare question becomes a third mid-lesson check rather
 * than a one-question section pretending to be an exit ticket. At most five
 * are used; a caller that hands over more gets the extras ignored.
 */
export function splitChecks(checks: readonly ActivitySlide[] | undefined): {
  mid: ActivitySlide[];
  exit: ActivitySlide[];
} {
  const usable = (checks ?? []).filter(isCheckSlide);
  const exit = usable.length >= MID_LESSON_CHECK_MAX + EXIT_TICKET_MIN
    ? usable.slice(MID_LESSON_CHECK_MAX, MID_LESSON_CHECK_MAX + EXIT_TICKET_MAX)
    : [];
  const mid = exit.length > 0
    ? usable.slice(0, MID_LESSON_CHECK_MAX)
    : usable.slice(0, MID_LESSON_CHECK_MAX + 1);
  return { mid, exit };
}

/**
 * A slide that can actually function as a check.
 *
 * An MCQ needs real options and a correct index inside them — a `question`
 * slide without those projects four blank choices. An open `challenge` needs
 * a stem. This is what keeps a non-math lesson honest: the generator returns
 * open write-on-your-board questions when it has no verified bank to draw
 * from, and those are real checks, so they are accepted here rather than the
 * whole feature being gated behind `subject === 'mathematics'`.
 */
function isCheckSlide(s: ActivitySlide): boolean {
  if (!nonEmpty(s.content)) return false;
  if (s.type === 'question') {
    const options = s.options ?? [];
    return options.length >= 2
      && typeof s.correctIndex === 'number'
      && s.correctIndex >= 0
      && s.correctIndex < options.length;
  }
  return s.type === 'challenge';
}

/**
 * Re-badge a generated check for its place in this deck.
 *
 * `verified`, `verifiedBy` and `computedAnswer` ride along untouched — they
 * are claims about the answer key that only the verifier may make, and
 * re-deriving them here is exactly the mistake that once shipped items
 * flagged verified that nothing had checked. `questionIndex` is dropped: it
 * indexes a Class Challenge scoring ledger, and this deck has none.
 */
function asCheckSlide(slide: ActivitySlide, title: string): ActivitySlide {
  const { questionIndex: _dropped, ...rest } = slide;
  return { ...rest, title };
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

  const { mid: midChecks, exit: exitChecks } = splitChecks(opts.checks);

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
    const warm = splitWarmup(intro);
    const tip = L('اسأل ثم انتظر بصمت خمس ثوانٍ قبل استقبال أي إجابة.',
      'Ask, then wait five silent seconds before taking any answer.');
    push({
      type: 'intro',
      title: L('✨ تمهيد', '✨ Warm-up'),
      content: warm.projected,
      durationSeconds: 0,
      teacher: {
        expectedAnswer: L('لا توجد إجابة واحدة — الهدف تفعيل المعرفة السابقة.',
          'No single answer — the point is to activate prior knowledge.'),
        teachingTips: warm.notes ? `${warm.notes}\n\n${tip}` : tip,
      },
    });
  }

  // ── 4b. Section divider — a pacing break before the dense part starts ────
  // Everything so far has been short orientation slides; the explanation
  // that follows is where the deck gets read-heavy. A full-bleed "chapter
  // title" moment here is cheap (no content to author, just the topic name)
  // and breaks up what would otherwise be one visually uniform deck from
  // start to finish.
  const concepts = bullets(pickLang(lesson?.keyConceptsAr, lesson?.keyConceptsEn, isAr), 8);
  if (concepts.length > 0) {
    push({
      type: 'divider',
      title,
      content: L('لنبدأ الشرح', "Let's dig in"),
      durationSeconds: 0,
    });
  }

  // ── 5. The explanation, one concept per slide ───────────────────────────
  // One concept per slide rather than a single dense slide: the deck is read
  // from the back row, and it is also the teacher's pacing device — advancing
  // is what marks "this idea is finished".
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

  // ── 6b. Live graph — the concept made draggable ─────────────────────────
  // Between the rule and the examples: the class sees the curve respond to a
  // coefficient change before attempting problems about it. Only when the
  // lesson's own text yielded plottable functions — a blank calculator here
  // would violate this deck's omit-rather-than-pad rule.
  const graphCommands = (opts.graphCommands ?? []).filter(Boolean);
  if (graphCommands.length > 0) {
    push(buildGraphSlide(graphCommands, title, isAr, 0));
  }

  // ── 6c. First check — before anyone has seen a worked example ───────────
  // Placed here on purpose: the class has been told the idea and the rule but
  // has not yet watched the teacher do one. This is the last moment a wrong
  // answer is cheap, and the show of hands decides whether the examples are a
  // demonstration or a re-teach. After the examples it would only measure
  // whether they can copy.
  //
  // With a single check available this point is skipped in favour of the one
  // after the examples — one check is better spent on "can you do it" than on
  // "did you follow me".
  const firstCheckCount = Math.floor(midChecks.length / 2);
  midChecks.slice(0, firstCheckCount).forEach((check, i) => {
    push(asCheckSlide(check, L(`✋ تحقّق سريع ${i + 1}`, `✋ Quick Check ${i + 1}`)));
  });

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

  // ── 7b. Second check — now that they have seen one done ─────────────────
  const laterChecks = midChecks.slice(firstCheckCount);
  laterChecks.forEach((check, i) => {
    push(asCheckSlide(
      check,
      L(`✋ تحقّق سريع ${firstCheckCount + i + 1}`, `✋ Quick Check ${firstCheckCount + i + 1}`),
    ));
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

  // ── 9b. Exit ticket — the last thing before they leave ──────────────────
  // After the summary, not before: the summary is the teacher's closing
  // statement, and the exit ticket is what the class hands back on the way
  // out. Its own divider, because it is a change of mode — the deck stops
  // teaching and starts measuring, and the class needs to be told that.
  if (exitChecks.length > 0) {
    push({
      type: 'divider',
      title,
      content: L('🎫 تذكرة الخروج', '🎫 Exit Ticket'),
      durationSeconds: 0,
    });
    exitChecks.forEach((check, i) => {
      push(asCheckSlide(
        check,
        L(`🎫 تذكرة الخروج ${i + 1}`, `🎫 Exit Ticket ${i + 1}`),
      ));
    });
  }

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
    // Built from the slides rather than from `examples`, so the checks are in
    // it too and there is one rule for what the key contains — the previous
    // shape derived it from the book's example list, which never knew about
    // any slide added after it.
    answerKey: rebuildAnswerKey(slides, isAr),
    printables: [],
    assessment: nonEmpty(plan?.assessment),
    extensionChallenge: '',
    slides,
  };
}

/**
 * Recompute the printable answer key from the slides themselves.
 *
 * The deck's answerKey is derived at build time from the book's examples;
 * once the teacher can edit or delete slides, the stored key would drift
 * from what is actually projected. Rebuilding from the slides keeps the two
 * honest — an edited answer prints as edited, a deleted example drops out.
 *
 * Two kinds of slide carry an answer. Worked examples are numbered as
 * examples, the way they always were. Check questions are keyed by their own
 * title instead, because their number is meaningful only within their section
 * — "تذكرة الخروج 1" is the first exit-ticket question, not the first
 * question in the deck, and renumbering them into one sequence would make the
 * printed key impossible to line up with the projected slides.
 *
 * Open checks carry no `answer` and no options — the generator refuses to
 * fabricate one — so they contribute nothing here rather than an empty row.
 */
export function rebuildAnswerKey(slides: readonly ActivitySlide[], isAr: boolean): string[] {
  const L = (ar: string, en: string) => (isAr ? ar : en);
  let exampleNum = 0;
  const key: string[] = [];
  for (const s of slides) {
    if (s.type === 'challenge' && nonEmpty(s.answer)) {
      exampleNum += 1;
      key.push(L(`مثال ${exampleNum}: ${s.answer}`, `Example ${exampleNum}: ${s.answer}`));
      continue;
    }
    if (s.type === 'question') {
      const answer = (s.options ?? [])[s.correctIndex ?? -1];
      if (nonEmpty(answer)) key.push(`${s.title}: ${answer}`);
    }
  }
  return key;
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
