/**
 * Matching the name written on a photographed paper to a student on the roster.
 *
 * The model only *transcribes* the name; this decides what it means. The roster
 * never goes to the model, so it cannot be steered towards a plausible name —
 * it can only report what is written.
 *
 * Built to under-claim, because a wrong match puts one child's marks on another:
 *
 * - **`confident` only on an exact, unique match** — the normalized name equals
 *   exactly one roster student's normalized name. Two students with the same
 *   name (or a first name shared by single-name rows) can never be confident,
 *   and neither can a name another student's longer name contains («أحمد» when
 *   the roster also holds «أحمد علي»).
 * - Everything else with a plausible candidate is **`confirm`**: the teacher is
 *   shown up to three and taps one. Nothing is assigned without that tap.
 * - A blank, or a name nothing resembles, is **`none`**.
 *
 * "Exact" is after `normalizeArabic` (hamza, ta marbuta, ya, diacritics,
 * digits) and after dropping punctuation and tatweel — the differences between
 * two ways of writing the same name, not between two names.
 */
import { normalizeArabic } from "@workspace/curriculum";

export interface RosterEntry {
  studentId: string;
  displayName: string;
  /** Already has a paper for this exam; the batch will not write into it. */
  hasAttempt: boolean;
}

export interface MatchCandidate {
  studentId: string;
  displayName: string;
  /**
   * 0–1. 1 only for an identical normalized name; a reordered or repeated-word
   * name is capped at `NEAR_MISS_CEILING`, so it can never be `confident`.
   */
  score: number;
  hasAttempt: boolean;
}

export type MatchStatus = "confident" | "confirm" | "none";

export interface StudentMatch {
  status: MatchStatus;
  /** Set only when `status` is `confident`. */
  studentId: string | null;
  candidates: MatchCandidate[];
}

/** Below this a roster name is not offered at all. */
export const MIN_CANDIDATE_SCORE = 0.5;
export const MAX_CANDIDATES = 3;

/**
 * Ceiling for any name that is not identical after normalization. Word-set
 * similarity alone gives 1 to «علي أحمد» against «أحمد علي», which are two
 * different children, so only an identical string may reach 1.
 */
const NEAR_MISS_CEILING = 0.99;

function tokens(name: string): string[] {
  return normalizeArabic(name)
    .replace(/ـ/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Dice coefficient over the sets of name parts: 1 identical, 0 nothing shared. */
function score(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const part of left) if (right.has(part)) common++;
  return (2 * common) / (left.size + right.size);
}

export function matchStudent(
  nameRead: string | null | undefined,
  roster: readonly RosterEntry[],
): StudentMatch {
  const none: StudentMatch = { status: "none", studentId: null, candidates: [] };
  const read = tokens(nameRead ?? "");
  if (read.length === 0 || roster.length === 0) return none;

  const readKey = read.join(" ");
  const scored: MatchCandidate[] = roster.map(r => {
    const parts = tokens(r.displayName);
    const identical = parts.join(" ") === readKey;
    return {
      studentId: r.studentId,
      displayName: r.displayName,
      score: identical ? 1 : Math.min(score(read, parts), NEAR_MISS_CEILING),
      hasAttempt: r.hasAttempt,
    };
  });

  const byBest = (x: MatchCandidate, y: MatchCandidate): number =>
    y.score - x.score || x.displayName.localeCompare(y.displayName, "ar");

  const exact = scored.filter(c => c.score === 1);
  if (exact.length === 1) {
    const only = exact[0]!;
    // «أحمد» read, and the roster holds both «أحمد» and «أحمد علي»: the paper
    // may be the second child's with the family name left off. Any roster name
    // that holds every part read and more besides means a tap, never a pick.
    const longer = scored.filter((c, i) => {
      const parts = tokens(roster[i]!.displayName);
      return parts.length > read.length && read.every(t => parts.includes(t));
    });
    if (longer.length === 0) {
      return { status: "confident", studentId: only.studentId, candidates: [only] };
    }
    return {
      status: "confirm",
      studentId: null,
      candidates: [only, ...longer].sort(byBest).slice(0, MAX_CANDIDATES),
    };
  }

  const candidates = scored
    .filter(c => c.score >= MIN_CANDIDATE_SCORE)
    .sort(byBest)
    .slice(0, MAX_CANDIDATES);

  return candidates.length === 0
    ? none
    : { status: "confirm", studentId: null, candidates };
}
