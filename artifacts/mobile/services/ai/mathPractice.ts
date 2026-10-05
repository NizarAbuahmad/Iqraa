/**
 * Concrete math practice — moved to `@workspace/math-practice` on 2026-09-13.
 *
 * The bank now lives in `lib/` because the evaluation generator on the API
 * server needs it: a self-marking question requires a known answer, and a
 * template can only ever produce a question. Everything real is there; this
 * file stays so the app's existing call sites and tests keep their import path.
 *
 * The one thing that could not move is the knowledge-base lookup. The bank
 * takes a lesson's subject id as a parameter now, and resolving it from a
 * `KBLesson` means `getBookForLesson`, which means `knowledgeBase.ts` and the
 * 3,000 lines of catalogs behind it — exactly what the server cannot have. So
 * that resolution happens here, on the side that already pays for it, and
 * `isMathContext` keeps the three-argument shape its callers use.
 */
import { getBookForLesson, type KBLesson } from '../knowledgeBase.ts';
import {
  isMathContext as isMathContextWithSubject,
  mathBankCovers,
  takeConcreteMath as takeBankMath,
  takeElementaryMath,
  takeSolvedMath as takeBankSolved,
  type SolvedItem,
  type DiffTier,
  type Lang,
  type PracticeWQ,
  type QType,
} from '@workspace/math-practice';

export {
  beginMathPracticeSession,
  lessonTextBlob,
  detectMathFamily,
  matchMathFamily,
  completionSplit,
  subjectIdFromName,
} from '@workspace/math-practice';

export type { Lang, QType, DiffTier, PracticeWQ, PracticeLesson } from '@workspace/math-practice';

/** 1–6 for a primary-grade lesson, else null (the bank serves it). */
/** The catalog grade (1–12) of a lesson's book, or null for a free-typed topic. */
function bookGrade(kb: KBLesson | null): number | null {
  const m = kb ? getBookForLesson(kb)?.gradeId?.match(/^grade-(\d+)$/) : null;
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 12 ? n : null;
}

/**
 * Does the maths bank have items that are ABOUT this lesson? See
 * `mathBankCovers`: a lesson it has nothing for is refused, not handed the
 * grade's default arithmetic or the Grade 10 bank.
 */
export function hasMathBank(topic: string, kb: KBLesson | null): boolean {
  return mathBankCovers(topic, kb, bookGrade(kb));
}

function primaryGrade(kb: KBLesson | null): number | null {
  const m = kb ? getBookForLesson(kb)?.gradeId?.match(/^grade-(\d+)$/) : null;
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 6 ? n : null;
}

/**
 * The bank is Grade 10; a Grade 1–6 lesson gets arithmetic sized to its grade
 * instead of the bank's `algebra` fallback («x² = 49» on a Grade 2 addition
 * quiz). Same signature, so every caller — quiz, worksheet, activity, deck —
 * picks it up without changing.
 */
export function takeConcreteMath(
  type: QType,
  topic: string,
  kb: KBLesson | null,
  diff: DiffTier,
  lang: Lang,
  points: number,
  session?: Set<string>,
  allowRepeat: boolean = true,
): PracticeWQ | null {
  const grade = primaryGrade(kb);
  if (grade) return takeElementaryMath(type, topic, kb, grade, diff, lang, points, session);
  // Grades 7–9 have no bank; the Grade 10 one is not theirs.
  const book = bookGrade(kb);
  if (book !== null && book >= 7 && book <= 9) return null;
  return takeBankMath(type, topic, kb, diff, lang, points, session, allowRepeat);
}

/**
 * A solved maths item, under the same grade rules as `takeConcreteMath`: a
 * Grade 1–6 lesson is generated arithmetic with no authored working, and a
 * Grade 7–9 lesson has no bank, so both get nothing rather than a Grade 10
 * example that is not theirs.
 */
export function takeSolvedMath(
  topic: string,
  kb: KBLesson | null,
  diff: DiffTier,
  lang: Lang,
  session?: Set<string>,
): SolvedItem | null {
  if (primaryGrade(kb)) return null;
  const book = bookGrade(kb);
  if (book !== null && book >= 7 && book <= 9) return null;
  return takeBankSolved(topic, kb, diff, lang, session);
}

/** Same as the bank's batch, through the grade-aware `takeConcreteMath`. */
export function takeConcreteMathBatch(
  count: number,
  topic: string,
  kb: KBLesson | null,
  lang: Lang,
  diff: DiffTier = 'medium',
): PracticeWQ[] {
  const out: PracticeWQ[] = [];
  for (let i = 0; i < count; i++) {
    const tier: DiffTier = i === 0 ? 'easy' : i === count - 1 ? 'hard' : diff;
    const q = takeConcreteMath('short_answer', topic, kb, tier, lang, 4);
    if (q) out.push(q);
  }
  return out;
}

/**
 * Unchanged behaviour: a resolved KB lesson's own subject decides, and only an
 * ungrounded topic falls back to the text heuristic. The subject id is now
 * resolved here and handed to the shared implementation.
 */
export function isMathContext(topic: string, kb: KBLesson | null, subject?: string): boolean {
  return isMathContextWithSubject(
    topic,
    kb,
    subject,
    kb ? getBookForLesson(kb)?.subjectId : undefined,
  );
}
