/**
 * The slide-count field on Prompt Slides.
 *
 * It kept only latin 0-9, so «١٠» typed on the Arabic keyboard every teacher
 * here uses came out as an empty field and an "Auto" deck. The digit
 * conversion is `parsePoints`'s (quizEdits.ts) — one place that knows ٥ is
 * five, not two drifting copies.
 *
 * Free of react-native so `node --test` can load it.
 */
import { parsePoints } from './quizEdits.ts';

export const MAX_SLIDE_COUNT = 20;

/** What the field shows after a keystroke: latin digits, at most two, '' for Auto. */
export function normalizeSlideCountText(input: string): string {
  const n = parsePoints(input);
  return n === null ? '' : String(n).slice(0, 2);
}

/** The request's `slideCount`: undefined for Auto, else clamped to the maximum. */
export function slideCountFromText(text: string): number | undefined {
  const n = parsePoints(text);
  return n === null ? undefined : Math.min(MAX_SLIDE_COUNT, n);
}
