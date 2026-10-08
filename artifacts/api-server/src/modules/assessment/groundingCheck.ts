/**
 * Is a generated answer in the book it claims to teach from?
 *
 * The structural validator asks whether a question is well formed and SymPy asks
 * whether a maths key is arithmetically right. Neither asks the question that
 * catches a fluent invention in chemistry or social studies: does the textbook
 * say this at all?
 *
 * This is a *signal*, never a gate — `weak` is reported and nothing is removed.
 * Retrieval returns three pages, a correct answer is often a paraphrase, and a
 * check that deleted questions on "I did not find it" would be the failure
 * `keyVerification.ts` rule 1 exists to prevent. What it buys is ranking: out of
 * thirty questions, these four are the ones worth a person's time.
 *
 * Computed answers (numbers, symbols) are not judged — a worked result is not
 * in the book and should not be — so only word tokens count, and a claim with
 * fewer than `MIN_WORDS` of them is `uncheckable`, not `weak`.
 */
import { normalizeArabic } from "@workspace/curriculum";
import type { GeneratedQuestion } from "./mockGenerator.ts";

export type GroundingStatus = "supported" | "weak" | "uncheckable";

export interface GroundingVerdict {
  index: number;
  status: GroundingStatus;
  /** Share of the answer's word tokens found in the source, 0–1. Absent when uncheckable. */
  support?: number;
}

const MIN_WORDS = 2;
/** Below this, most of the answer's vocabulary is absent from every page we hold. */
export const WEAK_BELOW = 0.5;

function words(text: string): string[] {
  return normalizeArabic(text)
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .map(w => w.replace(/^ال/, ""))
    .filter(w => w.length > 2);
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The text of what the key says is right — not the stem, not the distractors. */
export function claimText(q: GeneratedQuestion): string {
  const { body, expectedAnswer: key } = q;

  const correctIds = new Set(list(key["optionIds"]).map(str));
  if (correctIds.size > 0) {
    return list(body["options"])
      .map(o => o as Record<string, unknown>)
      .filter(o => correctIds.has(str(o["id"])))
      .map(o => str(o["text"]))
      .join(" ");
  }

  if (typeof key["value"] === "boolean") return key["value"] ? str(body["statement"]) : "";

  const blanks = list(key["blanks"]).map(b => str(list((b as Record<string, unknown>)["accept"])[0]));
  if (blanks.length > 0) return blanks.join(" ");

  return str(key["modelAnswer"]) || str(key["text"]);
}

/** The source's vocabulary, built once so a whole deck or exam reuses it. */
export function sourceWordSet(sourceText: string): Set<string> {
  return new Set(words(sourceText));
}

/**
 * Share of `claim`'s distinct word tokens found in the source, 0–1; `null`
 * when the claim is too short to judge or there is no source to judge against.
 * Shared by the exam check below and `lib/deckChecks.ts`.
 */
export function supportIn(claim: string, source: ReadonlySet<string>): number | null {
  const claimWords = [...new Set(words(claim))];
  if (claimWords.length < MIN_WORDS || source.size === 0) return null;
  return claimWords.filter(w => source.has(w)).length / claimWords.length;
}

export function checkGrounding(
  questions: readonly GeneratedQuestion[],
  sourceText: string,
): GroundingVerdict[] {
  const source = sourceWordSet(sourceText);
  return questions.map((q, index) => {
    const support = supportIn(claimText(q), source);
    if (support === null) return { index, status: "uncheckable" };
    return { index, status: support < WEAK_BELOW ? "weak" : "supported", support };
  });
}
