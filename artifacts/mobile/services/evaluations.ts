/**
 * Evaluation authoring — thin client over `/api/evaluations/*`.
 *
 * Mirrors `roster.ts`: `apiFetch` never throws on a non-2xx response, so a
 * local `readJson` unwraps the body and throws a typed `EvaluationError`
 * (status + machine-readable `code`) that screens can branch on rather than
 * pattern-matching English strings.
 */
import { apiFetch } from './apiClient.ts';

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'matching'
  | 'fill_blank'
  | 'short_answer'
  | 'open_ended'
  | 'problem_solving'
  | 'practical_task';

export type Difficulty = 'basic' | 'standard' | 'advanced';
export type EvaluationStatus = 'draft' | 'published' | 'closed';

export interface Evaluation {
  id: string;
  /** The class the teacher attached this exam to, or null. */
  classGroupId?: string | null;
  /** Papers with marks on them. Only meaningful for a class-scoped list. */
  markedCount?: number;
  title: string;
  titleAr: string;
  gradeId: string;
  subjectId: string;
  bookId: string;
  objectiveIds: string[];
  difficulty: Difficulty;
  targetQuestionCount: number;
  assessmentTypes: QuestionType[];
  status: EvaluationStatus;
  totalMarks: string;
  createdAt: string;
}

export interface EvaluationQuestion {
  id: string;
  orderIndex: number;
  type: QuestionType;
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  objectiveId: string;
  competencyKey: string;
  difficulty: Difficulty;
  marks: string;
  gradingMode: 'deterministic' | 'math_equivalence' | 'ai_rubric' | 'manual';
  source: 'ai' | 'teacher' | 'ai_edited';
}

export interface EvaluableBook {
  bookId: string;
  titleAr: string;
  objectiveCount: number;
  evaluable: boolean;
}

export interface GenerateResult {
  questions: EvaluationQuestion[];
  totalMarks: number;
  requested: number;
  produced: number;
  unavailableTypes: QuestionType[];
  rejected: { reason: string }[];
  warnings: string[];
}

export class EvaluationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'EvaluationError';
    this.status = status;
    this.code = code;
  }
}

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new EvaluationError(detail || `${action} failed (${res.status})`, res.status, code);
  }
  return (await res.json()) as T;
}

export async function listEvaluableBooks(): Promise<{
  books: EvaluableBook[];
  types: QuestionType[];
  difficulties: Difficulty[];
}> {
  const res = await apiFetch('/evaluations/meta/evaluable');
  return readJson(res, 'Loading evaluable books');
}

/**
 * `classId` scopes the list to one class. Pass `'none'` for the exams that
 * belong to no class yet — what the attach sheet needs, and asking the server
 * rather than filtering client-side is what keeps an exam already attached
 * elsewhere from looking attachable here.
 */
export async function listEvaluations(opts: { classId?: string } = {}): Promise<Evaluation[]> {
  const query = opts.classId ? `?classId=${encodeURIComponent(opts.classId)}` : '';
  const res = await apiFetch(`/evaluations${query}`);
  const data = await readJson<{ evaluations: Evaluation[] }>(res, 'Loading evaluations');
  return data.evaluations;
}

/** Attach an exam to a class, or pass null to detach it. */
export async function setEvaluationClass(
  evaluationId: string,
  classGroupId: string | null,
): Promise<Evaluation> {
  const res = await apiFetch(`/evaluations/${evaluationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ classGroupId }),
  });
  const data = await readJson<{ evaluation: Evaluation }>(res, 'Attaching the exam');
  return data.evaluation;
}

export async function createEvaluation(input: {
  bookId: string;
  objectiveIds: string[];
  assessmentTypes: QuestionType[];
  targetQuestionCount: number;
  difficulty: Difficulty;
  titleAr?: string;
}): Promise<Evaluation> {
  const res = await apiFetch('/evaluations', { method: 'POST', body: JSON.stringify(input) });
  const data = await readJson<{ evaluation: Evaluation }>(res, 'Creating evaluation');
  return data.evaluation;
}

export async function getEvaluation(
  id: string,
): Promise<{ evaluation: Evaluation; questions: EvaluationQuestion[] }> {
  const res = await apiFetch(`/evaluations/${id}`);
  return readJson(res, 'Loading evaluation');
}

export async function generateEvaluation(id: string): Promise<GenerateResult> {
  const res = await apiFetch(`/evaluations/${id}/generate`, { method: 'POST' });
  return readJson(res, 'Generating questions');
}

/** One row of a paper exam: what the question is worth and what it measures. */
export interface PaperQuestionInput {
  marks: number | string;
  objectiveId: string;
  competencyKey: CompetencyKey;
  difficulty?: Difficulty;
}

/**
 * Replace a draft's questions with a paper-exam grid — an exam the teacher set
 * themselves, so the app holds no question text, only what each one is worth
 * and what it measures. Replaces rather than appends, so sending it twice does
 * not double the paper.
 */
export async function setPaperQuestions(
  evaluationId: string,
  questions: PaperQuestionInput[],
): Promise<{ questions: EvaluationQuestion[]; totalMarks: number }> {
  const res = await apiFetch(`/evaluations/${evaluationId}/questions/paper`, {
    method: 'PUT',
    body: JSON.stringify({ questions }),
  });
  return readJson(res, 'Saving the paper');
}

export async function publishEvaluation(id: string): Promise<Evaluation> {
  const res = await apiFetch(`/evaluations/${id}/publish`, { method: 'POST' });
  const data = await readJson<{ evaluation: Evaluation }>(res, 'Publishing evaluation');
  return data.evaluation;
}

// ─── Attempts (teacher answer entry) ────────────────────────────────────────

export type AttemptStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'grading'
  | 'graded'
  | 'needs_review'
  | 'abandoned';

export type Verdict = 'correct' | 'partial' | 'incorrect' | 'unanswered';
export type LevelKey = 'beginner' | 'developing' | 'proficient' | 'advanced';
export type CompetencyKey = 'knowledge' | 'understanding' | 'application' | 'critical_thinking';

export type Grader = 'deterministic' | 'math_verifier' | 'ai' | 'teacher';

export interface Attempt {
  id: string;
  evaluationId: string;
  studentId: string;
  status: AttemptStatus;
  /** The teacher's note on the sitting as a whole. */
  teacherComment: string;
  questionSnapshot: EvaluationQuestion[];
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
}

export interface AttemptListRow {
  id: string;
  studentId: string;
  studentName: string;
  status: AttemptStatus;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  result: AttemptResult | null;
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  response: Record<string, unknown>;
}

export interface AttemptQuestionGrade {
  questionId: string;
  awardedMarks: string | number;
  maxMarks: string | number;
  verdict: Verdict;
  /** Who produced this mark — drives the badge next to it. Never inferred. */
  grader: Grader;
  /** The teacher's comment on this answer, or the grader's rationale. */
  rationaleAr?: string;
}

export interface CompetencyScore {
  earned: number;
  total: number;
  percent: number | null;
  questionCount: number;
  sufficient: boolean;
}

export interface AttemptResult {
  attemptId: string;
  earnedMarks: string;
  totalMarks: string;
  percent: string;
  competencyScores: Record<CompetencyKey, CompetencyScore>;
  levelKey: LevelKey | null;
  isProvisional: boolean;
}

export type RecommendationKind = 'review' | 'practice' | 'activity' | 'reassess';

/**
 * What to do next about one objective, derived from the marks. `generatedBy`
 * says whether a rule or a model produced it — the same reason a mark carries
 * `grader`, and the reason the two must never be rendered identically.
 */
export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  objectiveId: string | null;
  generatedBy: 'rule' | 'ai';
  payload: {
    objectiveTitle: string;
    objectiveTitleAr: string;
    percent: number;
    marksLost: number;
    questionCount: number;
  };
}

/** The exam's curriculum scope, so a generator can open already pointed at it. */
export interface AttemptEvaluationSummary {
  id: string;
  title: string;
  titleAr: string;
  gradeId: string;
  subjectId: string;
  bookId: string;
}

/** One objective, summed across every student who has been marked. */
export interface ClassObjectiveScore {
  objectiveId: string;
  title: string;
  titleAr: string;
  earned: number;
  total: number;
  percent: number;
  marksLost: number;
  /** How many marked students fell below the gap line on this objective. */
  studentsBelowGap: number;
  studentCount: number;
}

export interface ClassInsights {
  studentCount: number;
  earnedMarks: number;
  totalMarks: number;
  percent: number;
  objectiveScores: ClassObjectiveScore[];
}

/**
 * What the class as a whole missed. Only marked attempts are counted — an
 * unmarked one would drag the class percentage down and read as a bad cohort
 * rather than as unfinished marking.
 */
export async function getClassInsights(evaluationId: string): Promise<{
  insights: ClassInsights;
  recommendations: Recommendation[];
  scope: { gradeId: string; subjectId: string; bookId: string };
}> {
  const res = await apiFetch(`/evaluations/${evaluationId}/insights`);
  return readJson(res, 'Loading class insights');
}

export async function listAttempts(evaluationId: string): Promise<AttemptListRow[]> {
  const res = await apiFetch(`/evaluations/${evaluationId}/attempts`);
  const data = await readJson<{ attempts: AttemptListRow[] }>(res, 'Loading attempts');
  return data.attempts;
}

/** Find-or-create: safe to call every time a teacher opens a student's entry screen. */
export async function startAttempt(evaluationId: string, studentId: string): Promise<Attempt> {
  const res = await apiFetch(`/evaluations/${evaluationId}/attempts`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
  const data = await readJson<{ attempt: Attempt }>(res, 'Starting attempt');
  return data.attempt;
}

export async function getAttempt(attemptId: string): Promise<{
  attempt: Attempt;
  evaluation: AttemptEvaluationSummary;
  student: { id: string; displayName: string };
  questions: EvaluationQuestion[];
  answers: AttemptAnswer[];
  grades: AttemptQuestionGrade[];
  result: AttemptResult | null;
  recommendations: Recommendation[];
}> {
  const res = await apiFetch(`/attempts/${attemptId}`);
  return readJson(res, 'Loading attempt');
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  response: Record<string, unknown>,
): Promise<AttemptAnswer> {
  const res = await apiFetch(`/attempts/${attemptId}/answers/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify({ response }),
  });
  const data = await readJson<{ answer: AttemptAnswer }>(res, 'Saving answer');
  return data.answer;
}

/**
 * Mark one question by hand. `note` is the teacher's comment on that answer;
 * the verdict is derived from the mark unless one is passed.
 */
export async function setQuestionGrade(
  attemptId: string,
  questionId: string,
  input: { awardedMarks: number | string; note?: string; verdict?: Verdict },
): Promise<{
  grade: AttemptQuestionGrade;
  attempt: Attempt;
  result: AttemptResult;
  recommendations: Recommendation[];
}> {
  const res = await apiFetch(`/attempts/${attemptId}/grades/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return readJson(res, 'Saving the mark');
}

export async function setTeacherComment(attemptId: string, teacherComment: string): Promise<Attempt> {
  const res = await apiFetch(`/attempts/${attemptId}`, {
    method: 'PATCH',
    body: JSON.stringify({ teacherComment }),
  });
  const data = await readJson<{ attempt: Attempt }>(res, 'Saving the comment');
  return data.attempt;
}

export async function submitAttempt(attemptId: string): Promise<{
  attempt: Attempt;
  grades: AttemptQuestionGrade[];
  ungradedQuestionIds: string[];
  result: AttemptResult;
  recommendations: Recommendation[];
}> {
  const res = await apiFetch(`/attempts/${attemptId}/submit`, { method: 'POST' });
  return readJson(res, 'Submitting attempt');
}
