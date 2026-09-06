/**
 * Teacher marking — turning what a teacher typed into a mark and a verdict.
 *
 * Pure on purpose: this is the arithmetic behind a mark a teacher will read
 * out to a parent, so it is testable without a database or a running server.
 *
 * Two rules worth reading before changing anything:
 *
 * 1. **Out-of-range marks are rejected, not clamped.** Silently turning a
 *    typed `50` into the question's max of 5 would show the teacher a mark
 *    they did not enter and give no hint that anything was wrong.
 * 2. **`unanswered` is never derived.** It is a claim about what the student
 *    did, not about the size of the mark — a zero can mean "answered, wrong"
 *    just as easily. A teacher may send it explicitly; nothing infers it.
 */
import type { Verdict } from "@workspace/db";

const VERDICTS: readonly Verdict[] = ["correct", "partial", "incorrect", "unanswered"];

export function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}

/**
 * Returns the mark rounded to two decimals, or null when the input is not a
 * number the question can carry. Accepts a numeric string because `numeric`
 * columns come back as strings and a form sends text.
 */
export function normalizeManualMarks(raw: unknown, maxMarks: number): number | null {
  // `Number("")` is 0, so a blank box would silently award zero rather than
  // being read as "no mark entered".
  const text = typeof raw === "string" ? raw.trim() : null;
  const value = typeof raw === "number" ? raw : text ? Number(text) : NaN;
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > maxMarks) return null;
  return Math.round(value * 100) / 100;
}

export function deriveVerdict(awardedMarks: number, maxMarks: number): Verdict {
  if (maxMarks <= 0 || awardedMarks >= maxMarks) return "correct";
  if (awardedMarks <= 0) return "incorrect";
  return "partial";
}
