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
  // Lesson plan extras
  teachingStyle?: 'direct' | 'inquiry' | 'collaborative';
  objectives?: string;
  // Worksheet extras
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  numQuestions?: number;
  questionTypes?: Array<'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem'>;
  /** When true and priorKnowledge is non-empty, prepend a "مراجعة سابقة" warm-up. */
  includePriorReview?: boolean;
  /** Grounded unit prior-knowledge concepts (never invent when empty). */
  priorKnowledge?: string[];
  // Quiz extras
  totalMarks?: number;
  // Activity extras
  activityType?: 'individual' | 'group' | 'discussion' | 'hands-on' | 'game';
}

export interface LessonPlanOutput {
  title: string;
  grade: string;
  subject: string;
  duration: number;
  objectives: string[];
  materials: string[];
  introduction: string;
  mainActivity: string;
  guidedPractice: string;
  independentPractice: string;
  closure: string;
  assessment: string;
  differentiation: string;
  homework: string;
}

export interface WorksheetOutput {
  title: string;
  instructions: string;
  sections: WorksheetSection[];
  answerKey: WorksheetAnswerKeyItem[];
}

export interface WorksheetSection {
  type: 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem';
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
  type: 'intro' | 'challenge' | 'reveal' | 'summary' | 'bingo-call' | 'relay-problem' | 'question' | 'graph' | 'media';
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
  /** True when the answer key is correct by construction / verifier-checked. */
  verified?: boolean;
  /**
   * GeoGebra commands for type 'graph' — e.g. ['f(x)=x^2', 'g(x)=x+1'].
   * The class screen embeds them on web and opens GeoGebra on native, so
   * the teacher can drag/zoom the curve live in front of the class.
   */
  graphCommands?: string[];
  /** Media payload for type 'media' — projected image or video. */
  mediaKind?: 'image' | 'video';
  /** Image URL / data URI, or a YouTube watch/share link. */
  mediaUrl?: string;
  mediaCaption?: string;
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
  additionalContext?: string;
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

export abstract class AIService {
  abstract generateLessonPlan(req: AIRequest): Promise<LessonPlanOutput>;
  abstract generateWorksheet(req: AIRequest): Promise<WorksheetOutput>;
  abstract generateQuiz(req: AIRequest): Promise<QuizOutput>;
  abstract generateHomework(req: AIRequest): Promise<WorksheetOutput>;
  abstract generateActivity(req: AIRequest): Promise<ActivityOutput>;
  abstract generateClassroomActivity(req: ClassroomActivityRequest): Promise<ClassroomActivity>;
}
