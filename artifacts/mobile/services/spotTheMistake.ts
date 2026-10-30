/**
 * «اكتشف الخطأ» — a challenge slide whose content is a classmate's wrong
 * solution and whose answer is the correction.
 *
 * It is a challenge like a worked example, so anything that treats every
 * challenge as an example must ask this first: the answer key would number it
 * «مثال 2», and the verifier would compare its correction against an equation
 * taken from a solution that is wrong on purpose and could badge the slide.
 *
 * Matched by name, because Prompt Slides' model titles its own slide and has
 * no other way to mark it. A teacher who renames the slide in the editor turns
 * it back into an ordinary challenge.
 */
import type { ActivitySlide } from './ai/AIService.ts';

const SPOT_THE_MISTAKE = /اكتشف الخطأ|spot the mistake/i;

export function isSpotTheMistake(slide: Pick<ActivitySlide, 'type' | 'title'>): boolean {
  return slide.type === 'challenge' && SPOT_THE_MISTAKE.test(slide.title);
}
