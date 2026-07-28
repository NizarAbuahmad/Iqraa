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
  questionTypes?: Array<'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false'>;
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
  type: 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false';
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
  type: 'intro' | 'challenge' | 'reveal' | 'summary';
  title: string;
  content: string;
  hint?: string;
  answer?: string;
  unlockCode?: string;
  /** 0 = no auto-timer (teacher controls pace) */
  durationSeconds: number;
  teacher?: TeacherCompanion;
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

export abstract class AIService {
  abstract generateLessonPlan(req: AIRequest): Promise<LessonPlanOutput>;
  abstract generateWorksheet(req: AIRequest): Promise<WorksheetOutput>;
  abstract generateQuiz(req: AIRequest): Promise<QuizOutput>;
  abstract generateHomework(req: AIRequest): Promise<WorksheetOutput>;
  abstract generateActivity(req: AIRequest): Promise<ActivityOutput>;
  abstract generateClassroomActivity(req: ClassroomActivityRequest): Promise<ClassroomActivity>;
}
