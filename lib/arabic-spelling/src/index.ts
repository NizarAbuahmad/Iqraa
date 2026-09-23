/**
 * Arabic spelling (إملاء) for the Jordanian curriculum, grades 2–7.
 *
 * A hand-authored bank of rules and words, and a deterministic generator that
 * turns them into questions the assessment registry already understands.
 *
 * It lives in `lib/` rather than in the app for the reason `math-practice`
 * does: the evaluation generator on the API server needs it, and a self-marking
 * question requires a known answer that the server cannot ask a model for.
 */
export type { SpellingRule, SpellingWord, VariantClass } from "./rules.ts";
export { SPELLING_RULES, ruleById, rulesForGrade, rulesForLesson, wordsForGrade } from "./rules.ts";

export type { SpellingItem, SpellingItemKind, TakeOptions } from "./items.ts";
export { takeSpellingItems, spellingRulesForLesson, orthographicVariants } from "./items.ts";
