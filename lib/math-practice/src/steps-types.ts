/**
 * The working for one bank item, in both languages.
 *
 * Kept beside the bank rather than on `ConcreteItem` so the 158 items stay
 * readable and so authoring can be split by family without touching the same
 * lines. It is keyed by the item's id, and `steps.test.ts` fails when a key
 * names no item, so the two cannot drift apart silently.
 *
 * Variables are latin (`x`, `f(x)`) exactly as in `eq` and `promptAr` — the app
 * converts to «س» and Arabic digits at display time, never here. Each entry is
 * one line of working, in order; the last line states the item's own `answer`
 * verbatim, so a worked example and the answer key can never disagree.
 */
export interface SolutionSteps {
  /** Arabic working, one line per step. */
  ar: string[];
  /** English working, the same steps in the same order. */
  en: string[];
}
