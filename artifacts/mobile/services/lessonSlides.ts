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
  LessonTeachingOutput,
} from './ai/AIService.ts';
import type { KBLesson } from './knowledgeBase.ts';
import { buildChartSlide, buildGraphSlide, referencesShownVisual, scanGraphCommands } from './classMedia.ts';
import { chartForLesson, visualForSlide } from './deckVisuals.ts';
import { type BookFigure, figuresForLesson } from './bookFigures.ts';
import { exerciseReference, exercisesForLesson } from './bookExercises.ts';
import { inlineSteps } from './slideLayout.ts';

/**
 * Split a generated warm-up into what the class sees and what only the
 * teacher needs.
 *
 * Generated intros are written *at the teacher* — "ابدأ بطرح السؤال: «…»
 * سجّل إجابات الطلبة على السبورة" — and this slide is projected on the class
 * screen. Stage directions up there tell the room what the teacher is about
 * to do instead of giving it something to think about, so the question is
 * projected alone and the full instruction moves to the teacher notes.
 *
 * Quoted questions are the clean case. Just as common: an unquoted question
 * introduced by a colon mid-paragraph — "...ثم ينتقل إلى سؤال تمهيدي: كيف
 * يمكن جمع هذه الحدود؟ بعد ذلك يوضح أن..." — with narration continuing
 * straight through the question mark on both sides. A whole-text sentence
 * split can't isolate that (Arabic narration here runs on commas, not
 * periods, until the question itself), so the colon is the anchor: it
 * marks where the question starts, and the following "؟"/"?" marks where it
 * ends. Only when neither pattern is found is anything left to lift out,
 * and the text projects as it always did rather than leaving the slide
 * blank.
 */
export function splitWarmup(intro: string): { projected: string; notes: string } {
  const quoted = intro.match(/[«"“]\s*([^»"”]*[?؟])\s*[»"”]/u);
  if (quoted?.[1]?.trim()) {
    return { projected: quoted[1].trim(), notes: intro };
  }
  const colonIntroduced = intro.match(/:\s*([^:.!]*[?؟])/u);
  if (colonIntroduced?.[1]?.trim()) {
    return { projected: colonIntroduced[1].trim(), notes: intro };
  }
  return { projected: intro, notes: '' };
}

/**
 * Drop one slide from a deck and renumber what is left.
 *
 * Targets the slide *object*, not its position. Deck building is not
 * finished when the outline first renders: photo, video and verification
 * passes land seconds later and `insertVideoSlide` shifts every index after
 * it, so a teacher who deletes slide 9 during that window deletes whatever
 * moved into position 9. Identity survives those passes because they rebuild
 * only the slides they touch.
 */
export function withoutSlide(
  slides: readonly ActivitySlide[],
  target: ActivitySlide,
): ActivitySlide[] {
  return slides
    .filter(s => s !== target)
    .map((s, i) => ({ ...s, slideNumber: i + 1 }));
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
  /**
   * Resolves a book figure to a loadable URI — `bookFigureUri` in the app,
   * a stub in tests. Injected rather than imported because that function
   * reaches into `react-native`, and this module is exercised under
   * `node --test`, where importing it would fail at module scope.
   *
   * Omitted → no figure slides, exactly as before figures existed.
   */
  figureUri?: (figure: BookFigure) => string | null;
  /**
   * The AI-written explanation section (`/generate/lesson-teaching`). Fills
   * what the book data does not carry: a hook question when the plan gave
   * none, the explanation, a worked example when the book has none, and an
   * on-screen practice problem. Omitted → the deck is built from the book
   * and plan alone, exactly as before.
   */
  teaching?: LessonTeachingOutput | null;
}

/** A cleaned `LessonTeachingOutput`: every string trimmed, empties gone. */
export interface UsableTeaching {
  hook: { question: string; teacherNote: string } | null;
  concepts: { title: string; points: string[]; teacherNote: string; misconception: string }[];
  workedExample: { problem: string; steps: string[]; answer: string } | null;
  practice: { problem: string; hint: string; answer: string } | null;
}

/** More than this and the explanation stops being a section of the lesson. */
const TEACHING_CONCEPTS_MAX = 5;

/**
 * Keep only the parts of a generated explanation that can stand on a slide.
 *
 * Model output reaches this untyped in practice, so nothing is trusted: a
 * concept without a title or without a single point is a heading over
 * nothing, a worked example whose problem already contains its answer is the
 * «…=25» slide this call exists to stop, and a bullet the model prefixed with
 * its own "•" would print two. Each part that fails is dropped on its own —
 * one bad field costs one slide, never the section.
 */
export function usableTeaching(raw: LessonTeachingOutput | null | undefined): UsableTeaching {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const lines = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : [])
      .map(x => str(x).replace(/^[•\-*]\s*/u, '').trim())
      .filter(Boolean)
      .slice(0, max);
  const hookQ = str(raw?.hook?.question);
  const concepts = (Array.isArray(raw?.concepts) ? raw!.concepts! : [])
    .map(c => ({
      title: str(c?.title),
      points: lines(c?.points, 4),
      teacherNote: str(c?.teacherNote),
      misconception: str(c?.misconception),
    }))
    .filter(c => c.title && c.points.length > 0)
    .slice(0, TEACHING_CONCEPTS_MAX);
  const problem = str(raw?.workedExample?.problem);
  const answer = str(raw?.workedExample?.answer);
  const steps = lines(raw?.workedExample?.steps, 6);
  // Only an answer long enough to mean something: «4» appears in half the
  // problems that have 4 as their answer, «(x−2)²+(y+3)²=25» in none of them.
  // Three characters is «x=4» — specific enough, and four let it through.
  const squashedAnswer = answer.replace(/\s+/g, '');
  const answerShown = squashedAnswer.length >= 3
    && problem.replace(/\s+/g, '').includes(squashedAnswer);
  const practiceProblem = str(raw?.practice?.problem);
  return {
    hook: hookQ ? { question: hookQ, teacherNote: str(raw?.hook?.teacherNote) } : null,
    concepts,
    workedExample: problem && answer && steps.length > 0 && !answerShown
      ? { problem, steps, answer }
      : null,
    practice: practiceProblem
      ? { problem: practiceProblem, hint: str(raw?.practice?.hint), answer: str(raw?.practice?.answer) }
      : null,
  };
}

/** Mid-lesson checks, at most. Two interruptions in 45 minutes, not five. */
export const MID_LESSON_CHECK_MAX = 2;
/**
 * Book figures shown per lesson, at most.
 *
 * Lessons carry up to six (median three). All six would be six slides of
 * looking at pictures in a 45-minute period, so the deck still stops short of
 * that — but two was too few: subjects without a stated "rule" or worked
 * examples (biology, physics, earth science) lean on the book's own diagrams
 * to explain the lesson at all, and two disconnected images could not carry
 * that. Four in book order, the rest left out — the same omit-rather-than-pad
 * rule the graph slide follows.
 */
export const BOOK_FIGURE_MAX = 4;
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
  const usable = (checks ?? []).map(withOwnVisual).filter(isCheckSlide);
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
  // A question that says «في الرسم البياني الظاهر…» and carries no picture is
  // not a hard check, it is an impossible one: the class is asked to read
  // coordinates off something the slide never draws. `withOwnVisual` has
  // already had its chance to plot the question's own equations, so anything
  // still pointing at an absent figure here cannot be rescued and is dropped
  // — the same omit-rather-than-pad rule the rest of this deck follows.
  if (referencesShownVisual(s.content) && !slideShowsVisual(s)) return false;
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
 * Whether this slide actually DRAWS something.
 *
 * `visualForSlide` rather than a length check on `graphCommands`: a command
 * the renderers cannot sample — a circle, a vertical line — leaves the slide
 * as blank as no command at all, and a slide that merely *holds* one must not
 * be able to satisfy a stem that claims a figure is on screen.
 */
function slideShowsVisual(s: ActivitySlide): boolean {
  return visualForSlide(s) !== null;
}

/**
 * Draw the graph a check refers to, when the check itself says what it is.
 *
 * Generated checks are written as if the deck had already put a figure on the
 * slide — «في الرسم البياني الظاهر، يلتقي المستقيمان…» — but a check is a
 * `question` or `challenge` slide, and only a `graph` slide ever carried
 * `graphCommands`, so the picture was never drawn and the sentence was simply
 * false in front of a class.
 *
 * The commands are taken from the check's OWN text and nowhere else. The
 * deck's `graphCommands` come from the lesson's rule and examples, and
 * projecting those beside a question about different lines would put a
 * confident, wrong picture under a sentence claiming it is the right one —
 * worse than the blank slide this is fixing. A check whose text names no
 * plottable function keeps nothing here and `isCheckSlide` drops it.
 */
function withOwnVisual(slide: ActivitySlide): ActivitySlide {
  if (slideShowsVisual(slide) || !referencesShownVisual(slide.content)) return slide;
  const { commands, unplottable } = scanGraphCommands(slide.content);
  // All of the figure, or none of it. «x² + y² = 5 و x − y = 1» gives one
  // drawable line and one circle this build cannot plot; drawing the line
  // alone under a sentence describing both is a picture that contradicts its
  // own caption, so the check keeps nothing and `isCheckSlide` drops it.
  if (unplottable.length > 0 || commands.length === 0) return slide;
  return { ...slide, graphCommands: commands };
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

/**
 * «كتاب الطالب · الفصل الأول · صفحة ٢١» — book, semester and page.
 *
 * The page is the point: it is the one thing that lets a teacher put the
 * projected figure next to the printed one and confirm they match. Arabic
 * digits at display time only, per the repo's convention — `pdfPage` stays a
 * latin number everywhere else.
 */
export function bookFigureCaption(figure: BookFigure, isAr: boolean): string {
  const semester = figure.sourceId.includes('-s2-')
    ? (isAr ? 'الفصل الثاني' : 'Semester 2')
    : (isAr ? 'الفصل الأول' : 'Semester 1');
  const page = isAr
    ? String(figure.pdfPage).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
    : String(figure.pdfPage);
  return isAr
    ? `كتاب الطالب · ${semester} · صفحة ${page}`
    : `Student Book · ${semester} · page ${page}`;
}

/**
 * A lesson's book figures as media slides, ready to splice into any deck.
 *
 * The slide-side twin of `bookFigureRefsForLesson()` (`bookFigureUri.ts`),
 * which does the same three-step lookup for the document exports. This one
 * lives here rather than there because `bookFigureUri.ts` imports
 * `react-native` to resolve an asset, and every deck builder that needs these
 * (`buildLessonDeck` here, `buildDeckFromQuiz`/`buildDeckFromWorksheet` in
 * `classDeck.ts`) is exercised under `node --test`. Hence the injected
 * `figureUri` rather than an import — the same shape `buildLessonDeck` already
 * took for it.
 *
 * Extracted because it had exactly one caller while three deck builders needed
 * it: a quiz or worksheet projected through Class Mode showed no figure at
 * all, and a lesson deck built from chat showed none either, purely because
 * this loop lived inline in the one builder that had it.
 *
 * `slideNumber` is left to the caller — `buildLessonDeck` pushes through its
 * own counter and `assembleDeckSlides` renumbers the whole deck at the end.
 *
 * Omitting `figureUri` yields nothing, exactly as before figures existed.
 */
export function bookFigureSlides(
  kbLessonId: string | null | undefined,
  isAr: boolean,
  figureUri?: (figure: BookFigure) => string | null,
  max: number = BOOK_FIGURE_MAX,
): Omit<ActivitySlide, 'slideNumber'>[] {
  if (!figureUri) return [];
  const out: Omit<ActivitySlide, 'slideNumber'>[] = [];
  for (const figure of figuresForLesson(kbLessonId).slice(0, max)) {
    const uri = figureUri(figure);
    if (!uri) continue;
    const caption = bookFigureCaption(figure, isAr);
    out.push({
      type: 'media',
      title: isAr ? 'من كتاب الطالب' : 'From the Student Book',
      content: caption,
      mediaKind: 'image',
      mediaUrl: uri,
      mediaCaption: caption,
      durationSeconds: 0,
    });
  }
  return out;
}

export function buildLessonDeck(
  lessonTitle: string,
  isAr: boolean,
  opts: LessonDeckOptions = {},
): ClassroomActivity {
  const { lesson = null, plan = null } = opts;
  const teaching = usableTeaching(opts.teaching);
  // Whether any generated part reached the deck — the teacher is told which
  // slides the book did not write (see teacherPreparation).
  let aiWritten = false;
  const includeExamples = opts.includeExamples !== false;
  const includePractice = opts.includePractice !== false;
  // One language per deck. English-subject decks used to carry bilingual
  // headings («مفردات الدرس · Key Vocabulary»); they are now built in English
  // end to end (`contentLang`), so the caller's `isAr` alone decides.
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
  // Subject and grade only. The book summary used to sit here too, which for
  // a maths lesson put a paragraph of formulas on the cover — the whole lesson
  // stated before it began. It closes the deck instead (§9).
  const summary = nonEmpty(pickLang(lesson?.summaryAr, lesson?.summaryEn, isAr));
  push({
    type: 'intro',
    title,
    content: subject && grade ? `${subject} · ${grade}` : subject || grade,
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

  // ── 3. Hook / introduction ──────────────────────────────────────────────
  // (Vocabulary is §4c, after the section break — see there.)
  const intro = nonEmpty(plan?.introduction);
  const warm = intro ? splitWarmup(intro) : null;
  // splitWarmup only lifts a clean line when the model quoted a question or
  // introduced one with a colon (notes non-empty then). Anything else — a
  // narrated "ابدأ بسؤال عن…" — is the teacher's own planning text, same
  // failure as guidedPractice/independentPractice below, so it never projects.
  //
  // With no question to lift there is no slide. It used to project «لنبدأ
  // بسؤال يهيّئنا لموضوع اليوم.» — announcing a question and then asking none,
  // on the one slide meant to catch the room's attention.
  //
  // The plan's own question wins when it has one — it belongs to the plan the
  // teacher is following. The generated hook, written for the screen, covers
  // the case that used to leave the deck without a warm-up at all.
  const hook = warm && warm.notes.length > 0
    ? { question: warm.projected, notes: warm.notes, generated: false }
    : teaching.hook
      ? { question: teaching.hook.question, notes: teaching.hook.teacherNote, generated: true }
      : null;
  if (hook) {
    if (hook.generated) aiWritten = true;
    const tip = L('اسأل ثم انتظر بصمت خمس ثوانٍ قبل استقبال أي إجابة.',
      'Ask, then wait five silent seconds before taking any answer.');
    push({
      type: 'intro',
      title: L('✨ تمهيد', '✨ Warm-up'),
      content: hook.question,
      durationSeconds: 0,
      ...(hook.generated ? { aiWritten: true } : {}),
      teacher: {
        expectedAnswer: L('لا توجد إجابة واحدة — الهدف تفعيل المعرفة السابقة.',
          'No single answer — the point is to activate prior knowledge.'),
        teachingTips: [hook.notes, tip].filter(Boolean).join('\n\n'),
      },
    });
  }

  // ── 4b. Section divider — a pacing break before the dense part starts ────
  // Everything so far has been short orientation slides (title, outcomes,
  // warm-up); the vocabulary and explanation that follow are where the deck
  // gets read-heavy. A full-bleed "chapter
  // title" moment here is cheap (no content to author, just the topic name)
  // and breaks up what would otherwise be one visually uniform deck from
  // start to finish.
  // `keyConceptsAr/En` sometimes carry nothing but the curriculum's bare
  // vocabulary list (index terms with no extracted definition — the G9 NCCD
  // data does this deliberately rather than invent one). A concept slide for
  // one of those projects a heading and nothing else, so it is dropped here:
  // it is already shown in the vocabulary slide below, and this file's own
  // rule is that an empty slide costs the class more than a shorter deck.
  // A concept with a real definition attached gets it appended below; a
  // concept that matches no `keyTerms` entry at all is assumed to already be
  // real explanatory text (a rule, a formula, a defined phrase) and is kept
  // as-is.
  const termFor = (concept: string) =>
    (lesson?.keyTerms ?? []).find(t => (isAr ? t.ar : t.en) === concept);
  // A concept the rule slide (§6) already states word for word is dropped
  // here: «معادلة الدائرة» projected the same formula as «الفكرة 1» and again
  // two slides later as the rule. Compared without whitespace, since the book
  // data spaces formulas inconsistently.
  const squash = (s: string) => s.replace(/\s+/g, '');
  const ruleTexts = bullets(pickLang(lesson?.rulesAr, lesson?.rulesEn, isAr), 5).map(squash);
  const concepts = bullets(pickLang(lesson?.keyConceptsAr, lesson?.keyConceptsEn, isAr), 8)
    .filter(concept => {
      const term = termFor(concept);
      return !term || nonEmpty(isAr ? term.definitionAr : term.definitionEn);
    })
    .filter(concept => !ruleTexts.some(rule => rule.includes(squash(concept))));
  if (concepts.length > 0 || teaching.concepts.length > 0) {
    // The section name is the big line and the lesson the small one. It was the
    // other way round, so the lesson title filled the screen a second time three
    // slides after the cover and «لنبدأ الشرح» was a caption under it — a chapter
    // break that did not say which chapter it was. The exit-ticket divider (§9b)
    // follows the same shape.
    push({
      type: 'divider',
      title: L('لنبدأ الشرح', "Let's dig in"),
      content: title,
      durationSeconds: 0,
    });
  }

  // ── 4c. Vocabulary (المفردات) ───────────────────────────────────────────
  // After the warm-up and the section break, not before them. The terms are the
  // explanation's own vocabulary: shown first they were definitions handed to a
  // class that had not yet been asked anything. And with the section break
  // after them, the deck said "orientation" for three slides, "now we begin",
  // and then went on defining terms — the break sat in the middle of the
  // preamble instead of at the end of it.
  const terms = (lesson?.keyTerms ?? []).slice(0, 6);
  if (terms.length >= 2) {
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
  } else if (terms.length === 1) {
    // One term is not a vocabulary list — a heading over a single bullet. With
    // a definition it is a concept like any other and gets a slide titled by
    // its name; without one there is nothing to show. Skipped when the concept
    // loop below already draws it under that name.
    const word = isAr ? terms[0]!.ar : terms[0]!.en;
    const def = nonEmpty(isAr ? terms[0]!.definitionAr : terms[0]!.definitionEn);
    const drawnAsConcept = teaching.concepts.length === 0 && concepts.includes(word);
    if (def && !drawnAsConcept) {
      push({ type: 'intro', title: word, content: def, durationSeconds: 0 });
    }
  }

  // ── 5. The explanation ──────────────────────────────────────────────────
  // A concept that names itself gets its own slide, titled by that name: a
  // defined term («الجذر» → its definition) or a labelled statement
  // («الصورة العامة: x²+y²+Dx+Ey+F=0»). One per slide because advancing is
  // the teacher's pacing device — it marks "this idea is finished".
  //
  // A bare one-liner has no name to title it with. Those used to get a slide
  // each under «الفكرة 1», «الفكرة 2»… — a label that says nothing, over a
  // single line, four times running. They now share one bulleted slide, at
  // the first one's place — split around a titled slide they came out as two
  // single-bullet slides, which is the thinness this replaced.
  const LABEL_MAX = 40;
  const bareConcepts: string[] = [];
  const conceptSlides: (Omit<ActivitySlide, 'slideNumber'> | 'bare')[] = [];
  for (const concept of concepts) {
    const term = termFor(concept);
    const definition = term ? nonEmpty(isAr ? term.definitionAr : term.definitionEn) : '';
    const colon = concept.search(/[:：]/);
    const label = colon > 0 ? concept.slice(0, colon).trim() : '';
    const rest = colon > 0 ? concept.slice(colon + 1).trim() : '';
    if (definition) {
      conceptSlides.push({ type: 'intro', title: concept, content: definition, durationSeconds: 0 });
    } else if (label && rest && label.length <= LABEL_MAX) {
      conceptSlides.push({ type: 'intro', title: label, content: rest, durationSeconds: 0 });
    } else {
      if (bareConcepts.length === 0) conceptSlides.push('bare');
      bareConcepts.push(concept);
    }
  }
  //
  // A generated explanation replaces these. The book's key concepts are terse
  // index lines, and they were in the context the explanation was written
  // from; the rule, figures, examples, outcomes and vocabulary — the parts
  // that ARE the book's wording — are all still projected verbatim around it.
  for (const c of teaching.concepts) {
    aiWritten = true;
    push({
      aiWritten: true,
      type: 'intro',
      title: c.title,
      content: c.points.map(p => `• ${p}`).join('\n'),
      durationSeconds: 0,
      // The panel always prints the expected answer; for a concept slide that
      // is the idea stated precisely, which is what its title is.
      teacher: {
        expectedAnswer: c.title,
        ...(c.teacherNote ? { teachingTips: c.teacherNote } : {}),
        ...(c.misconception ? { commonMisconceptions: c.misconception } : {}),
      },
    });
  }
  for (const slide of teaching.concepts.length > 0 ? [] : conceptSlides) {
    if (slide !== 'bare') {
      push(slide);
      continue;
    }
    for (let i = 0; i < bareConcepts.length; i += 4) {
      push({
        type: 'intro',
        title: L('💡 أفكار الدرس', '💡 Key Ideas'),
        content: bareConcepts.slice(i, i + 4).map(c => `• ${c}`).join('\n'),
        durationSeconds: 0,
      });
    }
  }

  // ── 6. Rules / formulas ─────────────────────────────────────────────────
  //
  // The book's own diagram of the rule rides ALONGSIDE it when the lesson has
  // one, rather than following as a separate slide. Every content slide in
  // this deck was a single column, so «العمود النازل من المركز ينصّف الوتر»
  // and the picture of that exact fact were a click apart — the class read
  // the sentence, then looked at the drawing, and had to hold one in their
  // head to understand the other.
  //
  // Only the first figure, and only onto this slide: the rule is the one
  // piece of prose in the deck a diagram is *about*. The rest stay standalone
  // (§6a) because they illustrate the lesson generally, not one sentence.
  const figures = bookFigureSlides(lesson?.id, isAr, opts.figureUri);
  const rules = bullets(pickLang(lesson?.rulesAr, lesson?.rulesEn, isAr), 5);
  const ruleFigure = rules.length > 0 ? figures.shift() : undefined;
  if (rules.length > 0) {
    // One rule that is a procedure written on a single line («الخطوات: 1) …
    // 2) … 3) …») is a sequence, and the numbered-steps layout shows it as
    // one. Not when a figure sits beside the rule: the layout branch comes
    // before that column in every renderer and would cost the slide its image.
    const procedure = rules.length === 1 && !ruleFigure?.mediaUrl ? inlineSteps(rules[0]!) : null;
    push({
      type: 'intro',
      title: L('📐 القاعدة', '📐 The Rule'),
      content: (procedure ?? rules).map(r => `• ${r}`).join('\n'),
      ...(procedure ? { layout: 'steps' as const } : {}),
      durationSeconds: 0,
      ...(ruleFigure?.mediaUrl
        ? {
            sideImageUrl: ruleFigure.mediaUrl,
            sideImageCaption: ruleFigure.mediaCaption,
          }
        : {}),
    });
  }

  // ── 6a. The book's own figures ──────────────────────────────────────────
  // The diagrams the students have open in front of them. Shown after the
  // rule and before the interactive graph so the sequence reads: here is the
  // rule, here is how your book draws it, now watch it move.
  //
  // Every figure is captioned with its book and page, because a picture on a
  // projector with no provenance is indistinguishable from one the AI made up
  // — and these are the opposite of that, cut straight out of the ministry's
  // student book. The caption is what lets a teacher check one against the
  // page on the desk.
  //
  // `figureUri` returning null means the figure exists in the index but was
  // never bundled; the slide is dropped rather than rendered broken.
  //
  // Whatever the rule slide above did not take. With no rule slide — a lesson
  // whose book states none — nothing was taken and this is every figure, so
  // the deck is exactly what it was.
  for (const slide of figures) push(slide);

  // ── 6b. Live graph — the concept made draggable ─────────────────────────
  // Between the rule and the examples: the class sees the curve respond to a
  // coefficient change before attempting problems about it. Only when the
  // lesson's own text yielded plottable functions — a blank calculator here
  // would violate this deck's omit-rather-than-pad rule.
  const graphCommands = (opts.graphCommands ?? []).filter(Boolean);
  if (graphCommands.length > 0) {
    push(buildGraphSlide(graphCommands, title, isAr, 0));
  }

  // A chart when the lesson's own text states a dataset — a budget split, a
  // set of shares, a frequency table. Beside the graph rather than instead of
  // it: a graph is a function, a chart is data, and a statistics lesson can
  // legitimately want both.
  //
  // Start Class has done this since it was written (`startClass.ts`); this
  // builder never has, so the *same lesson* produced a chart when a teacher
  // pressed «ابدأ الحصة» and no chart when they generated slides for it — the
  // Slides Maker had no reference to `chart` anywhere. Financial literacy and
  // statistics were the subjects that lost most: their lessons carry the
  // labelled quantities this reads and no plottable function at all, so the
  // equation-driven graph slide above could never fire for them.
  //
  // `chartForLesson` refuses far more than it accepts — a bare list of numbers
  // in a mean-and-median exercise is not a dataset — so most lessons still get
  // nothing here, which is the intended outcome. An invented chart is a claim
  // about data that nothing checked.
  const chartVisual = chartForLesson(
    [
      ...(pickLang(lesson?.examplesAr, lesson?.examplesEn, isAr) ?? []),
      ...(pickLang(lesson?.keyConceptsAr, lesson?.keyConceptsEn, isAr) ?? []),
      nonEmpty(pickLang(lesson?.summaryAr, lesson?.summaryEn, isAr)),
      plan?.mainActivity ?? '',
      plan?.guidedPractice ?? '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  if (chartVisual) push(buildChartSlide(chartVisual, title, isAr, 0));

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
    push(asCheckSlide(check, L(`✋ تحقّق سريع ${i + 1}`, `Quick Check ${i + 1}`)));
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

  // The generated example only when the book offers none — the book's own
  // examples are the ones the students have in front of them. Same
  // attempt-then-reveal slide; the steps go to the teacher, who works them.
  const generatedExample = includeExamples && examples.length === 0 ? teaching.workedExample : null;
  if (generatedExample) {
    aiWritten = true;
    push({
      aiWritten: true,
      type: 'challenge',
      title: L('مثال 1', 'Example 1'),
      content: generatedExample.problem,
      durationSeconds: EXAMPLE_THINK_SECONDS,
      answer: generatedExample.answer,
      teacher: {
        expectedAnswer: generatedExample.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        teachingTips: L('اتركهم يحاولون أولًا — اكشف الحل بعد انتهاء المؤقت.',
          'Let them attempt it first — reveal only after the timer ends.'),
      },
    });
  }

  // ── 7b. Second check — now that they have seen one done ─────────────────
  const laterChecks = midChecks.slice(firstCheckCount);
  laterChecks.forEach((check, i) => {
    push(asCheckSlide(
      check,
      L(`✋ تحقّق سريع ${firstCheckCount + i + 1}`, `Quick Check ${firstCheckCount + i + 1}`),
    ));
  });

  // ── 8. Practice ─────────────────────────────────────────────────────────
  // plan.guidedPractice/independentPractice are the teacher's facilitation
  // notes — LESSON_STYLE_RULES_AR/EN in prompts.ts write them as pedagogy
  // ("swap boards, then answer in front of the class"), never as a line meant
  // for a student to read off a screen. This used to push that narration
  // straight into `content`, so the class saw the teacher's own script.
  // The class gets a plain, static prompt; the narration moves to the teacher
  // panel, same split already used for the hook and the worked examples.
  if (includePractice) {
    const guided = nonEmpty(plan?.guidedPractice);
    // A generated practice problem gives this slide something to project: the
    // problem itself, worked together, with the plan's facilitation notes and
    // the answer in the teacher panel. Not a reveal slide — the answer key
    // numbers every revealed challenge as an example.
    if (teaching.practice) {
      const { problem, hint, answer } = teaching.practice;
      aiWritten = true;
      push({
        aiWritten: true,
        type: 'intro',
        title: L('🤝 تدريب موجّه', '🤝 Guided Practice'),
        content: problem,
        durationSeconds: 0,
        teacher: {
          expectedAnswer: answer || L('راجع حلول الطلبة خطوة بخطوة.', "Check the class's working step by step."),
          teachingTips: [hint && L(`تلميح: ${hint}`, `Hint: ${hint}`), guided].filter(Boolean).join('\n\n')
            || L('حلّوها معًا: اطلب الخطوة الأولى من الصف قبل أن تكتبها.',
              'Solve it together: ask the class for the first step before you write it.'),
        },
      });
    } else if (guided) {
      push({
        type: 'intro',
        title: L('🤝 تدريب موجّه', '🤝 Guided Practice'),
        content: L('لنحلّ هذا معًا خطوة بخطوة.', "Let's work through this together, step by step."),
        durationSeconds: 0,
        // The prompt above is the whole slide, by design. Say so, or the
        // teacher meets a blank wall and reads it as a bug — the same reason
        // `graphEmptyHint` exists on the graph slide.
        teacherLed: true,
        teacher: {
          expectedAnswer: L('لا توجد إجابة واحدة ثابتة — راقب تنفيذ الطلبة ووجّههم أثناء العمل.',
            'There is no single fixed answer — monitor the class and guide them as they work.'),
          teachingTips: guided,
        },
      });
    }
    const independent = nonEmpty(plan?.independentPractice);
    if (independent) {
      push({
        type: 'intro',
        title: L('✍️ تدريب مستقل', '✍️ Independent Practice'),
        content: L('حان دوركم — حاولوا بمفردكم.', "Now it's your turn — try it on your own."),
        durationSeconds: 0,
        teacherLed: true,
        teacher: {
          expectedAnswer: L('تختلف الإجابات باختلاف النظام أو المسألة المطروحة — راجعها بعد وقت العمل الفردي.',
            'Answers vary with the system or problem given — review them after independent work time.'),
          teachingTips: independent,
        },
      });
    }
  }

  // ── 9. Closure ──────────────────────────────────────────────────────────
  // plan.closure carries the same risk as guidedPractice/independentPractice
  // and introduction's fallback above: nothing tells the model it is writing
  // for a projector rather than a teacher's plan. The synthesized summary is
  // always safe to project; the model's own closing text — if any — goes to
  // the teacher panel instead of standing in for it.
  //
  // The book's own summary comes first when it says at least two things: it is
  // what the lesson established, whereas the outcomes are what it set out to
  // do — and the outcomes were already projected verbatim on slide 2. The
  // split keeps "2.5" whole: a sentence break needs whitespace after the stop.
  const closure = nonEmpty(plan?.closure);
  const takeaways = summary
    .split(/(?<=[.!?؟])\s+/u)
    .map(s => s.trim().replace(/[.。]$/u, '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const closureSummary = takeaways.length >= 2
    ? takeaways.map(s => `• ${s}`).join('\n')
    : objectives.length > 0
    ? L(`راجعنا اليوم:\n${objectives.map(o => `• ${o}`).join('\n')}`,
        `Today we covered:\n${objectives.map(o => `• ${o}`).join('\n')}`)
    : L(`أنهينا درس «${title}».`, `We finished “${title}”.`);
  push({
    type: 'summary',
    title: L('🎉 ملخص الدرس', '🎉 Lesson Summary'),
    content: closureSummary,
    durationSeconds: 0,
    teacher: closure ? {
      expectedAnswer: L('لا حاجة لإجابة محددة هنا — راجع الأهداف مع الصف.',
        'No specific answer needed — walk the class through the objectives.'),
      teachingTips: closure,
    } : undefined,
  });

  // ── 9b. Exit ticket — the last thing before they leave ──────────────────
  // After the summary, not before: the summary is the teacher's closing
  // statement, and the exit ticket is what the class hands back on the way
  // out. Its own divider, because it is a change of mode — the deck stops
  // teaching and starts measuring, and the class needs to be told that.
  if (exitChecks.length > 0) {
    push({
      type: 'divider',
      title: L('تذكرة الخروج', 'Exit Ticket'),
      content: title,
      durationSeconds: 0,
    });
    exitChecks.forEach((check, i) => {
      push(asCheckSlide(
        check,
        L(`🎫 تذكرة الخروج ${i + 1}`, `Exit Ticket ${i + 1}`),
      ));
    });
  }

  // ── 10. Homework, only when there is one ────────────────────────────────
  // The book's real exercises go on this slide when the ministry prints any
  // for this lesson — «تمارين ١-١٧، صفحة ١١», read out of the exercise book
  // rather than generated. It is attributed to the book on its own line
  // precisely because the generated homework above it may contain a reference
  // the model invented, and a teacher has to be able to tell which is which.
  const bookExercises = includePractice ? exercisesForLesson(lesson?.id) : null;
  const bookLine = bookExercises
    ? `📖 ${L('من كتاب التمارين', 'From the exercise book')}: `
      + exerciseReference(bookExercises, isAr)
    : '';
  const homework = includePractice ? nonEmpty(plan?.homework) : '';
  if (homework || bookLine) {
    push({
      type: 'intro',
      title: L('🏠 الواجب', '🏠 Homework'),
      content: [homework, bookLine].filter(Boolean).join('\n\n'),
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
    teacherPreparation: grounded && aiWritten
      ? L('الشرائح مبنية على كتاب المنهاج، أما التمهيد والشرح والمثال والتدريب فكتبها الذكاء الاصطناعي من الكتاب — راجعها قبل الحصة وعدّل ما يلزم.',
          'Slides are built from the curriculum book; the warm-up, explanation, example and practice were written by AI from it — review and adjust before class.')
      : grounded
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
 * Where a `givens: solution` example turns into its solution, or -1.
 *
 * The text after the colon must look like working — an '=' or an arrow — so a
 * definition («الفاعل: اسم مرفوع») is never hidden behind a reveal, and the text
 * before it must hold givens (a number or symbol), so «حل: x² = 9 → x = ±3»
 * keeps its equation on the slide. A colon needs a space after it, which keeps
 * ratios like 3:4 intact.
 */
function lastSolutionColon(text: string): number {
  const found = [...text.matchAll(/[:：](?=\s)/g)];
  for (let i = found.length - 1; i >= 0; i--) {
    const at = found[i]!.index!;
    const before = text.slice(0, at).trim();
    const after = text.slice(at + 1).trim();
    // The part before must itself hold givens — a number or a symbol. A bare
    // instruction («حل:», «Solve:») is a label on the problem, not its givens.
    if (before && after && /[\d=<>⟨√²³]/.test(before) && /[=→⇒]|=>/.test(after)) return at;
  }
  return -1;
}

/**
 * Split a stored example into problem and answer.
 *
 * Book examples arrive as a single string, in three conventions:
 *   - `problem الجواب: answer` — an explicit label;
 *   - `givens: working → … → answer` — a colon after the givens. Everything
 *     after the LAST colon is the solution and stays behind the reveal, so a
 *     chain of steps is not projected as part of the question;
 *   - `problem → answer` — an arrow, split at the last one so
 *     `2x + 3 = 11 → x = 4` keeps its own '=' in the problem.
 * A bare `x + 1 = 5` is not split: it is a problem as often as it is a fact.
 */
export function splitExample(example: string): [problem: string, answer: string] {
  const text = (example ?? '').trim();
  // An explicit "الجواب: …" / "Answer: …" label wins over any other separator.
  const labelled = text.match(/^([\s\S]+?)[\s]*(?:الجواب|الحل|Answer|Solution)\s*[:：]\s*([\s\S]+)$/);
  if (labelled) return [labelled[1].trim(), labelled[2].trim()];
  const colon = lastSolutionColon(text);
  if (colon > 0) return [text.slice(0, colon).trim(), text.slice(colon + 1).trim()];
  const arrow = Math.max(text.lastIndexOf('→'), text.lastIndexOf('=>'), text.lastIndexOf('⇒'));
  if (arrow > 0) {
    const sepLen = text.slice(arrow).startsWith('=>') ? 2 : 1;
    return [text.slice(0, arrow).trim(), text.slice(arrow + sepLen).trim()];
  }
  return [text, ''];
}
