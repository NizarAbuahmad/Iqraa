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

export async function listEvaluations(): Promise<Evaluation[]> {
  const res = await apiFetch('/evaluations');
  const data = await readJson<{ evaluations: Evaluation[] }>(res, 'Loading evaluations');
  return data.evaluations;
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

export async function publishEvaluation(id: string): Promise<Evaluation> {
  const res = await apiFetch(`/evaluations/${id}/publish`, { method: 'POST' });
  const data = await readJson<{ evaluation: Evaluation }>(res, 'Publishing evaluation');
  return data.evaluation;
}
