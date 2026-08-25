/**
 * Pure transforms behind quiz editing.
 *
 * Extracted from the screen because the risk here is not in the tapping, it is
 * in what the edit does to the answer key. `QuizQuestion.correctAnswer` stores
 * the option's **text**, not its index, so rewriting the correct option without
 * carrying the key along leaves a question that looks completely normal and has
 * no right answer — the kind of fault a teacher only discovers while marking.
 *
 * Kept free of React so it can be tested directly.
 */
import type { QuizOutput, QuizQuestion } from './ai/AIService.ts';

/**
 * Marks must stay a positive whole number. Returns null when they wouldn't.
 *
 * Accepts Arabic-Indic digits, because the keyboard a teacher is typing on is
 * Arabic and ٥ is what comes out when they type five. Rejecting it would look
 * like the field simply refusing to take a number.
 */
export function parsePoints(input: string): number | null {
  const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
  const normalized = input.replace(/[٠-٩]/g, d => String(ARABIC_INDIC.indexOf(d)));
  const digits = normalized.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A paper's total is the sum of its questions; it cannot lag behind an edit. */
export function totalPointsOf(questions: readonly QuizQuestion[]): number {
  return questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
}

/**
 * Rewrite one option, carrying the answer key if that option was the answer.
 */
export function applyOptionEdit(
  question: QuizQuestion,
  optionIndex: number,
  next: string,
): QuizQuestion {
  const options = (question.options ?? []).map((o, i) => (i === optionIndex ? next : o));
  const wasCorrect = (question.options ?? [])[optionIndex] === question.correctAnswer;
  return {
    ...question,
    options,
    correctAnswer: wasCorrect ? next : question.correctAnswer,
  };
}

/** Patch a question by index and keep the paper's total in step. */
export function applyQuestionEdit(
  quiz: QuizOutput,
  index: number,
  patch: Partial<QuizQuestion>,
): QuizOutput {
  const questions = quiz.questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
  return { ...quiz, questions, totalPoints: totalPointsOf(questions) };
}

/** Remove a question and keep the paper's total in step. */
export function removeQuestionAt(quiz: QuizOutput, index: number): QuizOutput {
  const questions = quiz.questions.filter((_, i) => i !== index);
  return { ...quiz, questions, totalPoints: totalPointsOf(questions) };
}

/**
 * What an option's answer marker may show while the answer key is hidden.
 *
 * "Hide answers" is what a teacher taps before turning the laptop towards the
 * class, so every tell has to go, not just the obvious one. The row tint and
 * the explanation were gated on the toggle; the picker that sets the key was
 * not, so it kept rendering a green `checkmark-circle` against the right
 * option — the answer stayed on screen with the highlight removed, which reads
 * as the toggle being broken.
 *
 * The marker is an editing control, so hiding the key hides it entirely rather
 * than drawing every option unselected: a picker that showed nothing selected
 * would invite a tap that silently rewrites the key.
 */
export function optionMarkerState(
  showAnswers: boolean,
  option: string,
  correctAnswer: string,
): 'hidden' | 'selected' | 'unselected' {
  if (!showAnswers) return 'hidden';
  return option === correctAnswer ? 'selected' : 'unselected';
}
