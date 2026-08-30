/**
 * Shared gates deciding whether a question may CLAIM symbolic verification.
 *
 * These moved out of the mobile app because the exam generator runs on the
 * **server**: `POST /evaluations/:id/generate` has to decide whether a
 * model-written answer key is checkable before it inserts the question, and a
 * second copy of that decision on the server would be two definitions of one
 * correctness control — the mistake this repo already made once with
 * `sanitizeQuestionForStudent` and had to undo.
 */
export * from './guards.ts';
export * from './answerKey.ts';
