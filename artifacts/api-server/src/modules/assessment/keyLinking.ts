/**
 * Is the answer the verifier checked the answer this question is GRADED against?
 *
 * A generated question carries its key twice. The student and the grader use
 * `expectedAnswer` — the correct option, the accepted blanks, the model answer,
 * in the Arabic the class reads. The verifier is sent `check.answer`, a second
 * statement of the key in Latin notation that the model wrote separately.
 * Nothing compared them, so a question could be stored `verified: true` because
 * the verifier agreed with `check.answer` while the key the teacher and the
 * grader actually use said something else.
 *
 * `linkCheck` closes that gap. A check is linked when its answer, read in the
 * same notation, IS the graded key:
 *   - a multiple-choice question or a one-blank fill-in: the key is a short
 *     text, so it has to equal the checked answer;
 *   - a model answer written as prose («المشتقة هي ٣س² − ٤»): it has to contain
 *     the checked answer;
 *   - every other type has no key that can be set beside a symbolic answer.
 * Anything else is `key_unlinked` — kept in the paper, never marked verified.
 */
import type { GeneratedQuestion } from "./mockGenerator.ts";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const FRACTIONS: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3" };
/** The letters Jordanian maths writes where a textbook in English writes x, y, f, g. */
const VARIABLES: Record<string, string> = { "س": "x", "ص": "y", "ق": "f", "ك": "g" };

/**
 * One notation for comparing keys: Latin digits and letters, ASCII operators,
 * exponents as `^n`. Deliberately not NFKC — that turns «x²» into «x2» and
 * loses the exponent.
 */
export function toLatinMath(input: string): string {
  let s = input.normalize("NFC");
  s = s.replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));
  s = s.replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/٫/g, ".").replace(/٬/g, "").replace(/،/g, ",");
  s = s.replace(/[−–—‒﹣]/g, "-").replace(/[×·⋅∙]/g, "*").replace(/÷/g, "/");
  s = s.replace(/[½¼¾⅓⅔]/g, f => FRACTIONS[f] ?? f);
  // «x¹⁰» and «x⁻²» are runs, not one digit each.
  s = s.replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, run =>
    "^" + [...run].map(c => (c === "⁻" ? "-" : String(SUPERSCRIPTS.indexOf(c)))).join(""));
  s = s.replace(/√\(/g, "sqrt(").replace(/√([0-9]+|[a-z])/gi, "sqrt($1)");
  s = s.replace(/[سصقك]/g, c => VARIABLES[c] ?? c);
  return s.toLowerCase();
}

/** The comparison form: no spaces, no «*» between a number and a letter, no «x =» label. */
export function squashMath(input: string): string {
  let s = toLatinMath(input).replace(/\s+/g, "");
  s = s.replace(/\*(?=[a-z(])/g, "").replace(/(?<=[a-z)])\*/g, "");
  // «x = 4» and «4» are the same answer.
  s = s.replace(/^[a-z][a-z0-9']*(?:\([a-z]\))?=/, "");
  return s;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Is `needle` in `haystack` as a whole expression — «5» is not found in «15». */
function containsExpression(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(?<![a-z0-9.^])${escapeRe(needle)}(?![a-z0-9.^])`).test(haystack);
}

type GradedKey =
  | { kind: "exact"; texts: string[] }
  | { kind: "prose"; text: string }
  | { kind: "none"; why: string };

/** What this question is actually graded against, as text. */
export function gradedKey(q: Pick<GeneratedQuestion, "type" | "body" | "expectedAnswer">): GradedKey {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  switch (q.type) {
    case "multiple_choice": {
      if (q.body["multiSelect"] === true) return { kind: "none", why: "a multi-select has several correct options" };
      const ids = Array.isArray(q.expectedAnswer["optionIds"]) ? (q.expectedAnswer["optionIds"] as unknown[]).map(str) : [];
      const options = Array.isArray(q.body["options"]) ? (q.body["options"] as Array<Record<string, unknown>>) : [];
      const texts = options.filter(o => ids.includes(str(o?.["id"]))).map(o => str(o?.["text"])).filter(Boolean);
      return texts.length === 1 ? { kind: "exact", texts } : { kind: "none", why: "the correct option could not be read" };
    }
    case "fill_blank": {
      const blanks = Array.isArray(q.expectedAnswer["blanks"]) ? (q.expectedAnswer["blanks"] as Array<Record<string, unknown>>) : [];
      if (blanks.length !== 1) return { kind: "none", why: "the check covers one answer and this question has several blanks" };
      const accept = Array.isArray(blanks[0]?.["accept"]) ? (blanks[0]!["accept"] as unknown[]).map(str).filter(Boolean) : [];
      return accept.length > 0 ? { kind: "exact", texts: accept } : { kind: "none", why: "the blank accepts no answer" };
    }
    case "short_answer":
    case "problem_solving":
    case "open_ended": {
      const model = str(q.expectedAnswer["modelAnswer"]);
      return model ? { kind: "prose", text: model } : { kind: "none", why: "there is no model answer" };
    }
    default:
      return { kind: "none", why: `a ${q.type} question has no key a symbolic answer can be compared with` };
  }
}

export type KeyLink = { linked: true } | { linked: false; why: string };

/** Whether `question.check.answer` is the key `question` is graded against. */
export function linkCheck(question: GeneratedQuestion): KeyLink {
  const check = question.check;
  if (!check) return { linked: false, why: "no check" };
  const target = squashMath(check.answer);
  if (!target) return { linked: false, why: "the checked answer is empty" };

  const key = gradedKey(question);
  if (key.kind === "none") return { linked: false, why: key.why };
  if (key.kind === "exact") {
    return key.texts.some(t => squashMath(t) === target)
      ? { linked: true }
      : { linked: false, why: "the answer key is not the answer that was checked" };
  }
  return containsExpression(squashMath(key.text), target)
    ? { linked: true }
    : { linked: false, why: "the model answer does not state the answer that was checked" };
}
