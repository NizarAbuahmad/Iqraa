/**
 * lessonFlowRunner
 *
 * Pure, injectable step-runner for the Lesson Flow engine.
 * UI components call runLessonFlowFrom(); they never touch AI directly.
 * Tests inject a mock RunnerAIService to verify failure-recovery behaviour.
 */

import type {
  AIRequest,
  LessonPlanOutput,
  ActivityOutput,
  WorksheetOutput,
  QuizOutput,
} from './AIService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepKey =
  | 'objectives'
  | 'warmup'
  | 'activity'
  | 'guided'
  | 'worksheet'
  | 'exitTicket';

export const STEP_ORDER: readonly StepKey[] = [
  'objectives',
  'warmup',
  'activity',
  'guided',
  'worksheet',
  'exitTicket',
];

/** All partial results accumulated across steps (including the raw plan for guided reuse). */
export interface LessonFlowPrior {
  plan?: LessonPlanOutput;
  objectives?: string[];
  warmup?: ActivityOutput;
  activity?: ActivityOutput;
  guidedPractice?: string;
  worksheet?: WorksheetOutput;
  exitTicket?: QuizOutput;
}

/** Minimal AI interface required by the runner (subset of AIService). */
export interface RunnerAIService {
  generateLessonPlan(req: AIRequest): Promise<LessonPlanOutput>;
  generateActivity(req: AIRequest): Promise<ActivityOutput>;
  generateWorksheet(req: AIRequest): Promise<WorksheetOutput>;
  generateQuiz(req: AIRequest): Promise<QuizOutput>;
}

export interface StepCallbacks {
  onStepStart(key: StepKey): void;
  onStepDone(key: StepKey, partial: Partial<LessonFlowPrior>): void;
  onScroll?(): void;
}

// ─── Error class ──────────────────────────────────────────────────────────────

/**
 * Thrown when a specific step fails.
 * Carries the stepKey so the caller can mark exactly that step as errored
 * without disturbing steps that already completed.
 */
export class LessonFlowStepError extends Error {
  readonly stepKey: StepKey;
  constructor(stepKey: StepKey, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'LessonFlowStepError';
    this.stepKey = stepKey;
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Runs (or resumes) the 6-step lesson flow starting from `startKey`.
 *
 * - Steps whose results are already in `prior` are skipped.
 * - On failure, throws `LessonFlowStepError` so callers can mark just that
 *   step as errored and offer a retry from that position.
 * - Returns the accumulated `LessonFlowPrior` containing all results so far.
 */
export async function runLessonFlowFrom(
  startKey: StepKey,
  req: AIRequest,
  aiService: RunnerAIService,
  prior: LessonFlowPrior,
  callbacks: StepCallbacks,
): Promise<LessonFlowPrior> {
  const acc: LessonFlowPrior = { ...prior };
  const startIdx = STEP_ORDER.indexOf(startKey);

  for (let i = startIdx; i < STEP_ORDER.length; i++) {
    const key = STEP_ORDER[i];
    callbacks.onStepStart(key);
    try {
      switch (key) {
        case 'objectives': {
          const plan = await aiService.generateLessonPlan(req);
          acc.plan = plan;
          acc.objectives = plan.objectives;
          callbacks.onStepDone(key, { plan, objectives: plan.objectives });
          break;
        }
        case 'warmup': {
          const warmup = await aiService.generateActivity({
            ...req,
            duration: 10,
            activityType: 'hands-on',
          });
          acc.warmup = warmup;
          callbacks.onStepDone(key, { warmup });
          break;
        }
        case 'activity': {
          const activity = await aiService.generateActivity({
            ...req,
            activityType: 'game',
          });
          acc.activity = activity;
          callbacks.onStepDone(key, { activity });
          break;
        }
        case 'guided': {
          if (!acc.plan) {
            throw new Error('Lesson plan not available — cannot derive guided practice');
          }
          const guidedPractice = acc.plan.guidedPractice;
          acc.guidedPractice = guidedPractice;
          callbacks.onStepDone(key, { guidedPractice });
          break;
        }
        case 'worksheet': {
          const worksheet = await aiService.generateWorksheet({
            ...req,
            numQuestions: 5,
          });
          acc.worksheet = worksheet;
          callbacks.onStepDone(key, { worksheet });
          break;
        }
        case 'exitTicket': {
          const exitTicket = await aiService.generateQuiz({
            ...req,
            numQuestions: 3,
          });
          acc.exitTicket = exitTicket;
          callbacks.onStepDone(key, { exitTicket });
          break;
        }
      }
      callbacks.onScroll?.();
    } catch (err) {
      // Re-wrap as LessonFlowStepError unless already one
      if (err instanceof LessonFlowStepError) throw err;
      throw new LessonFlowStepError(key, err);
    }
  }

  return acc;
}
