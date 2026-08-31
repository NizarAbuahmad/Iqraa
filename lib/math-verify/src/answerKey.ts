/**
 * The machine-checkable half of a generated question.
 *
 * A question is written for a student in Arabic; SymPy cannot read that. The
 * verifier is latin-only, and an Arabic key does not merely fail — with
 * implicit multiplication on, «الإجابة سبعة» parses as a *product of
 * letter-symbols*, compares unequal, and looks exactly like a wrong answer.
 * On a check whose verdict deletes a teacher's question, that is the one
 * mistake that must be impossible.
 *
 * So a model that wants its key checked states it separately, in latin: the
 * stem stays Arabic for the class, `check` is the canonical form for the
 * machine. This mirrors the repo's standing rule — compute in latin `x`,
 * convert to `س` and Arabic digits only at display time.
 */
import type { VerifiableTopic } from './guards.ts';

/** Topics the verifier can prove — the only values a `check` may name. */
export const VERIFIABLE_TOPICS: readonly VerifiableTopic[] = [
  'derivative_polynomial',
  'derivative_at_point',
  'circle_center',
  'circle_radius',
  'equation_linear',
  'equation_quadratic',
  'equation_exponential',
];

export interface AnswerKeyCheck {
  topic: VerifiableTopic;
  /** The payload the topic's solver expects, e.g. `x^3-4x` or `x^4@2`. */
  question: string;
  /** The key as the model claims it, in latin notation. */
  answer: string;
}

/** Arabic script blocks — mirrors the Python gate in `relate_answer_key`. */
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/**
 * Latin maths only, and non-empty. Deliberately a rejection rather than a
 * transliteration: guessing that «ق(س)» means `f(x)` would be inventing the
 * very thing being checked.
 */
export function isLatinMath(text: string): boolean {
  const value = text.trim();
  return value.length > 0 && value.length <= 200 && !ARABIC.test(value);
}

/**
 * Read a model-supplied `check`, or null when it is absent or unusable.
 *
 * Null is not a failure — most questions have no symbolic key, and they are
 * simply never checked. Only a *present but malformed* check is worth a word
 * to the caller, and even then the question survives unverified.
 */
export function parseAnswerKeyCheck(raw: unknown): AnswerKeyCheck | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const topic = String(record['topic'] ?? '');
  if (!VERIFIABLE_TOPICS.includes(topic as VerifiableTopic)) return null;

  const question = String(record['question'] ?? '');
  const answer = String(record['answer'] ?? '');
  if (!isLatinMath(question) || !isLatinMath(answer)) return null;

  return { topic: topic as VerifiableTopic, question: question.trim(), answer: answer.trim() };
}

/**
 * The subject id maths papers carry. An **id**, never a display name.
 *
 * `isMathContext` matching on the subject's *name* is in CLAUDE.md as a repeat
 * offender: a label localises, an id does not. Both sides of the app ask this
 * question — the server to decide whether to press the model for a checkable
 * key, the app to decide whether "nothing was checked" is worth explaining —
 * so they share one answer rather than two literals that can drift apart.
 */
export const MATHEMATICS_SUBJECT_ID = 'mathematics';

export function isMathematicsSubject(subjectId: string | null | undefined): boolean {
  return subjectId === MATHEMATICS_SUBJECT_ID;
}
