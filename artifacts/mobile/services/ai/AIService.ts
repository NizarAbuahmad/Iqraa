/**
 * AIService – Abstract AI layer.
 *
 * Architecture note: All AI provider calls MUST pass through this service.
 * Controllers and UI components NEVER call AI providers directly.
 * Swap the concrete implementation (currently MockAIService) by changing
 * the factory at the bottom without touching any calling code.
 */

export interface AIRequest {
  grade: string;
  subject: string;
  topic: string;
  duration?: number;
  language?: 'arabic' | 'english';
  additionalContext?: string;
  /**
   * Catalog unit id (`kbu-math-s1-nccd-u2`), when the screen knows it.
   *
   * The server uses it to pull the unit's own textbook pages into the prompt.
   * Optional because it can be recovered from `topic`, but a resolved id beats
   * a title match — see `generatorUnitId` in `services/kbContext.ts`.
   */
  unitId?: string;
  /**
   * Curriculum lesson id (`resolveGeneratorGrounding(...).lesson.id`), when the
   * screen knows it.
   *
   * The server keys the shared artifact pool on this in preference to `topic`.
   * A lesson title does not identify a lesson — CLAUDE.md records
   * `searchKBSemantic(title)` returning a different lesson for 16 of the
   * picker's 63 — and once artifacts are shared between teachers, two lessons
   * whose titles normalise alike would be served each other's worksheets.
   */
  lessonId?: string;
  /**
   * Who wrote `additionalContext`.
   *
   * `'curriculum'` — the app derived it from the KB for this lesson. It is the
   * same text for every teacher who asks the same question, so the artifact can
   * be shared with them. `'teacher'` — it contains material the teacher
   * supplied (a pasted note, an attached document); the artifact is generated
   * fresh and never pooled.
   *
   * Omitted is read by the server as `'teacher'`. Fail closed: a screen that
   * forgets to say gets a cache miss, never someone else's material.
   */
  contextSource?: 'curriculum' | 'teacher';
  /**
   * The teacher asked for a replacement for what is on screen, not another
   * copy of it.
   *
   * The server answers this from the variant pool when it can — free, and
   * guaranteed different — and otherwise steers a fresh generation away from
   * `avoid`. Without it a "regenerate" is a byte-identical request and comes
   * back as the same paper reworded, which is the one thing the button is for.
   */
  regenerate?: boolean;
  /** Question stems and headings already on screen, so a regeneration does not
   *  repeat them. Sent by the screen because it is the only party that knows
   *  what the teacher is actually looking at. */
  avoid?: string[];
  /** `variantId`s from the pool this teacher already holds, echoed back so the
   *  server does not serve them again. */
  excludeVariantIds?: string[];
  // Lesson plan extras
  teachingStyle?: 'direct' | 'inquiry' | 'collaborative';
  objectives?: string;
  /**
   * Free-text notes on prior topics the teacher wants re-explained in class —
   * from earlier lessons or earlier grades — because some students haven't
   * fully grasped them. Lesson-plan only; distinct from `objectives` (this
   * lesson's own learning outcomes) and from `additionalContext` (delivery
   * instructions).
   */
  priorTopicsNotes?: string;
  // Worksheet extras
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  numQuestions?: number;
  questionTypes?: Array<'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem'>;
  /** When true and priorKnowledge is non-empty, prepend a "مراجعة سابقة" warm-up.
   *  Shared by worksheet and lesson-plan generation. */
  includePriorReview?: boolean;
  /** Grounded unit prior-knowledge concepts (never invent when empty). */
  priorKnowledge?: string[];
  // Quiz extras
  totalMarks?: number;
  // Activity extras
  activityType?: 'individual' | 'group' | 'discussion' | 'hands-on' | 'game';
  /**
   * Which slot in the lesson this activity fills.
   *
   * A warm-up is short prior-knowledge retrieval, not a shortened version of
   * the main activity. The lesson flow used to generate both from the same
   * call with only the duration changed, so a teacher got the same four steps
   * and the same three problems twice in one lesson.
   */
  activityVariant?: 'main' | 'warmup';
  /**
   * Continue the concrete-item selection from the previous generation instead
   * of restarting it, so two activities in the same lesson do not pose the
   * same problems. Set by `lessonFlowRunner` on the calls that follow the
   * warm-up; only the deterministic bank honours it.
   */
  continueMathPractice?: boolean;
}

/**
 * A textbook page the server actually attached to the prompt — a citation a
 * teacher can check, not just a lesson match. Mirrors `GroundedSource` in
 * `artifacts/api-server/src/lib/grounding.ts`; present only when
 * `withGrounding` found real book passages for the request.
 */
export interface GroundedSource {
  sourceId: string;
  /** The document as a teacher would name it. */
  titleAr: string;
  /** 1-based page in that document. */
  page: number;
}

export interface LessonPlanOutput {
  title: string;
  grade: string;
  subject: string;
  duration: number;
  objectives: string[];
  materials: string[];
  /** Plan for a short warm-up reviewing prior material — present only when
   *  the teacher asked for it via `priorTopicsNotes` or `includePriorReview`. */
  priorReview?: string;
  introduction: string;
  mainActivity: string;
  guidedPractice: string;
  independentPractice: string;
  closure: string;
  assessment: string;
  differentiation: string;
  homework: string;
  sources?: GroundedSource[];
  variantId?: string;
}

export interface WorksheetOutput {
  title: string;
  instructions: string;
  sections: WorksheetSection[];
  answerKey: WorksheetAnswerKeyItem[];
  sources?: GroundedSource[];
  variantId?: string;
}

export interface WorksheetSection {
  /**
   * The question type this section contains, or `'mixed'` when it holds more
   * than one.
   *
   * Sections are grouped by DIFFICULTY, not by type, so a section genuinely
   * can be mixed — the generator rotates through the teacher's selected types
   * within each difficulty bucket. This field used to be set to whichever type
   * happened to come last in the bucket, so a section of 2 MCQs and 2 short
   * answers reported `short_answer`.
   *
   * Server-generated worksheets are shaped by the model against the prompt in
   * `artifacts/api-server/src/lib/prompts.ts`, which does not yet offer
   * `'mixed'` — so a live-generated mixed section can still carry a single
   * type. Fix that there if this field ever gains a consumer.
   */
  type: 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem' | 'mixed';
  title: string;
  questions: WorksheetQuestion[];
}

export interface WorksheetQuestion {
  text: string;
  options?: string[];
  answer?: string;
  points: number;
}

export interface WorksheetAnswerKeyItem {
  num: number;
  answer: string;
}

export interface QuizOutput {
  title: string;
  duration: number;
  totalPoints: number;
  questions: QuizQuestion[];
  sources?: GroundedSource[];
  variantId?: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  text: string;
  options?: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
}

export interface ActivityStep {
  stepNumber: number;
  title: string;
  description: string;
  durationMin: number;
}

export interface ActivityOutput {
  title: string;
  activityType: string;
  totalDuration: number;
  objective: string;
  groupSize: string;
  materials: string[];
  steps: ActivityStep[];
  teacherTips: string[];
  differentiation: string;
  assessment: string;
  sources?: GroundedSource[];
  variantId?: string;
}

// ─── Interactive Classroom Engine ────────────────────────────────────────────

export interface TeacherCompanion {
  expectedAnswer: string;
  commonMisconceptions?: string;
  teachingTips?: string;
  suggestedQuestions?: string[];
  differentiationTips?: string;
}

export interface ActivitySlide {
  slideNumber: number;
  type: 'intro' | 'challenge' | 'reveal' | 'summary' | 'bingo-call' | 'relay-problem' | 'question' | 'graph' | 'media' | 'scoreboard' | 'podium' | 'divider';
  title: string;
  content: string;
  hint?: string;
  answer?: string;
  unlockCode?: string;
  /** 0 = no auto-timer (teacher controls pace) */
  durationSeconds: number;
  teacher?: TeacherCompanion;
  /**
   * Whole-class MCQ payload — only for type 'question'.
   * Options are display-ready (already shuffled); wrong options are built
   * from real misconception distractors so the show of hands tells the
   * teacher WHICH mistake the class is making.
   */
  options?: string[];
  correctIndex?: number;
  /** True when the answer key passed its correctness check. */
  verified?: boolean;
  /**
   * HOW the answer was checked — the badge must not overclaim.
   *  'symbolic' — SymPy proved it (re-derived and compared). Only the
   *               derivative slice supports this today.
   *  'bank'     — hand-authored item from the reviewed question bank.
   *               Correct, but nobody "verified it mathematically".
   */
  verifiedBy?: 'symbolic' | 'bank';
  /** The answer SymPy computed on its own — the projected evidence. */
  computedAnswer?: string;
  /**
   * GeoGebra commands for type 'graph' — e.g. ['f(x)=x^2', 'g(x)=x+1'].
   * The class screen embeds them on web and opens GeoGebra on native, so
   * the teacher can drag/zoom the curve live in front of the class.
   */
  graphCommands?: string[];
  /**
   * A drawable visual — a plot, a chart, and later flows and figures.
   *
   * Data rather than an embed on purpose: the deck has three renderers and
   * only data survives all three. `graphCommands` predates this and is a
   * GeoGebra iframe, which is why both exports could only print the equation
   * as text. `visualForSlide` in services/deckVisuals.ts derives a plot from
   * those commands when no explicit visual is set, so older saved decks gain
   * the picture too.
   */
  visual?: import('../deckVisuals.ts').VisualBlock;
  /** Media payload for type 'media' — projected image or video. */
  mediaKind?: 'image' | 'video';
  /**
   * Image URL / data URI, or a YouTube watch/share link.
   * Also doubles as a full-bleed background photo on the title slide
   * (index 0) and on 'divider' slides — those types render `content` as
   * a big centered label over the image with a dark gradient, not as a
   * dedicated media slide.
   */
  mediaUrl?: string;
  mediaCaption?: string;
  /**
   * Position of this question in the game's scoring ledger (Class Challenge).
   *
   * Deliberately NOT the same as slideNumber: intro, scoreboard and podium
   * slides sit between questions, so "question 3" and "slide 3" diverge
   * immediately. Awarding points keys off this, so a wrong value credits the
   * wrong question and corrupts every streak after it.
   */
  questionIndex?: number;
}

export interface ClassroomActivity {
  activityName: string;
  activityType: string;
  grade: string;
  subject: string;
  lesson: string;
  duration: number;
  difficulty: 'easy' | 'standard' | 'advanced';
  groupType: 'individual' | 'pairs' | 'groups' | 'whole-class';
  learningObjective: string;
  materials: string[];
  teacherPreparation: string;
  slides: ActivitySlide[];
  teacherNotes: string[];
  answerKey: string[];
  printables: string[];
  assessment: string;
  extensionChallenge: string;
  /** The pool variant this deck came from — see `AIRequest.regenerate`. */
  variantId?: string;
  /**
   * Present only on Class Challenge decks. Its presence is what switches the
   * presentation screen into game mode (scoreboard strip, award row on reveal,
   * podium), so a normal deck can never accidentally start scoring.
   */
  game?: ClassGameConfig;
}

export interface ClassGameConfig {
  teamCount: number;
  /** Scoreable questions in the deck — the ledger's upper bound. */
  questionCount: number;
}

export interface ClassroomActivityRequest {
  grade: string;
  subject: string;
  topic: string;
  activityType: string;
  duration: number;
  difficulty: 'easy' | 'standard' | 'advanced';
  groupType: 'individual' | 'pairs' | 'groups' | 'whole-class';
  teachingGoal: 'warm-up' | 'practice' | 'revision' | 'assessment' | 'critical-thinking';
  language: 'arabic' | 'english';
  /**
   * Whether the room has a projector for the deck, or only a board. Decides
   * whether the activity asks the teacher to print what the slides already
   * show — see applyClassroomSetup in classroomRouting.ts.
   */
  classroomSetup?: 'screen' | 'board';
  additionalContext?: string;
  /** Catalog unit id, so the server can ground the prompt — see `AIRequest.unitId`. */
  unitId?: string;
  /** See the identically named fields on `AIRequest` — same meaning, same
   *  reasons; this request type predates the shared one and has never been
   *  merged with it. */
  lessonId?: string;
  contextSource?: 'curriculum' | 'teacher';
  regenerate?: boolean;
  avoid?: string[];
  excludeVariantIds?: string[];
  /**
   * How many questions to generate. Honoured by 'quick-check', which defaults
   * to 4 — the size of a standalone whole-class check. Slides Maker asks for
   * more because it splits them across the lesson: two checks mid-lesson and
   * a three-question exit ticket need five distinct items, and reusing a
   * mid-lesson question as an exit-ticket question would measure nothing.
   */
  numQuestions?: number;
}

// ─── Lesson Flow Engine ──────────────────────────────────────────────────────

/**
 * A complete, coherent lesson journey generated in one tap.
 * Each field is the output of an individual generator, aligned to the same
 * topic, grade, and duration.
 */
export interface LessonFlowOutput {
  topic: string;
  grade: string;
  subject: string;
  duration: number;
  /** Learning objectives extracted from the lesson plan generator. */
  objectives: string[];
  /** 10-min warm-up activity to open the lesson. */
  warmup: ActivityOutput;
  /** Main interactive classroom activity. */
  activity: ActivityOutput;
  /** Teacher-led guided practice notes (rich text). */
  guidedPractice: string;
  /** Student worksheet for independent practice. */
  worksheet: WorksheetOutput;
  /** 3-question exit ticket to close the lesson. */
  exitTicket: QuizOutput;
}

/**
 * Per-call options every generator accepts.
 *
 * `signal` exists so a teacher who presses Cancel actually stops the request
 * rather than only stopping the spinner. That distinction matters more here
 * than in most apps: live generation is metered against `AI_BUDGET_USD`, so a
 * cancel that abandoned the UI while the request ran on would keep spending
 * against a cap the teacher thinks they just protected.
 */
export interface GenerateOptions {
  signal?: AbortSignal;
}

export abstract class AIService {
  abstract generateLessonPlan(req: AIRequest, opts?: GenerateOptions): Promise<LessonPlanOutput>;
  abstract generateWorksheet(req: AIRequest, opts?: GenerateOptions): Promise<WorksheetOutput>;
  abstract generateQuiz(req: AIRequest, opts?: GenerateOptions): Promise<QuizOutput>;
  abstract generateHomework(req: AIRequest, opts?: GenerateOptions): Promise<WorksheetOutput>;
  abstract generateActivity(req: AIRequest, opts?: GenerateOptions): Promise<ActivityOutput>;
  abstract generateClassroomActivity(req: ClassroomActivityRequest, opts?: GenerateOptions): Promise<ClassroomActivity>;
}
