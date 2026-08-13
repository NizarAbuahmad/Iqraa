/**
 * Tier-1 grading for one attempt.
 *
 * Runs the deterministic grader (`questionTypes.ts`'s `grade()`) over every
 * question a teacher entered an answer for, then folds the results through
 * `scoreAttempt`. A question whose type has no `grade()` — the ai_rubric and
 * manual types, until Tier 3 exists — is left out of both the persisted
 * grades and the score entirely, rather than defaulted to zero: an ungraded
 * question is not evidence of a wrong answer, and scoring it as one would be
 * the same "verified from a fallback" mistake CLAUDE.md already warns about.
 * `ungradedQuestionIds` carries them so the caller can mark the result
 * provisional and leave them for manual grading later.
 */
import { moduleFor, type QuestionDraft } from "./questionTypes.ts";
import { scoreAttempt, type AttemptScore, type GradedQuestion, type LevelBandInput } from "./scoring.ts";
import type { CompetencyKey } from "./competency.ts";
import type { Difficulty, QuestionType, Verdict } from "@workspace/db";

export interface AttemptQuestionInput {
  questionId: string;
  type: QuestionType;
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  competencyKey: CompetencyKey;
  objectiveId: string;
  marks: number;
  difficulty: Difficulty;
}

export interface QuestionGradeOutcome {
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  verdict: Verdict;
  rationaleAr: string;
}

export interface AttemptGradeResult {
  graded: QuestionGradeOutcome[];
  /** Questions no deterministic module could mark — excluded from `score`. */
  ungradedQuestionIds: string[];
  score: AttemptScore;
}

const RATIONALE_AR: Record<Verdict, string> = {
  correct: "إجابة صحيحة",
  partial: "إجابة صحيحة جزئيًا",
  incorrect: "إجابة غير صحيحة",
  unanswered: "لم تتم الإجابة عن هذا السؤال",
};

/** Foundational-first ordering for gap tie-breaks — the corpus has no richer
 *  cognitive signal per-question yet, so difficulty stands in for it. */
const BLOOMS_RANK: Record<Difficulty, number> = { basic: 1, standard: 2, advanced: 3 };

export function gradeAttempt(
  questions: readonly AttemptQuestionInput[],
  answers: ReadonlyMap<string, Record<string, unknown>>,
  bands: readonly LevelBandInput[],
): AttemptGradeResult {
  const graded: QuestionGradeOutcome[] = [];
  const ungradedQuestionIds: string[] = [];
  const gradedQuestions: GradedQuestion[] = [];

  for (const q of questions) {
    const mod = moduleFor(q.type);
    if (!mod?.grade) {
      ungradedQuestionIds.push(q.questionId);
      continue;
    }

    const draft: QuestionDraft = { type: q.type, body: q.body, expectedAnswer: q.expectedAnswer };
    const response = answers.get(q.questionId) ?? {};
    const result = mod.grade(draft, response);
    const awardedMarks = Math.round(result.fraction * q.marks * 100) / 100;

    graded.push({
      questionId: q.questionId,
      awardedMarks,
      maxMarks: q.marks,
      verdict: result.status,
      rationaleAr: result.detail ?? RATIONALE_AR[result.status],
    });
    gradedQuestions.push({
      questionId: q.questionId,
      competency: q.competencyKey,
      objectiveId: q.objectiveId,
      awardedMarks,
      maxMarks: q.marks,
      verdict: result.status,
      bloomsRank: BLOOMS_RANK[q.difficulty],
    });
  }

  return { graded, ungradedQuestionIds, score: scoreAttempt(gradedQuestions, bands) };
}
