/**
 * The colour and icon of each saved-material kind, as pure data.
 *
 * Split out of `materialKind.ts`, which reads the colour scheme from
 * `colors.ts` (react-native) and so cannot be loaded by `node --test`.
 * `services/__tests__/iconSystem.test.ts` pins this file.
 *
 * A material that IS a teaching concept takes its icon and colour from
 * `CONCEPTS` (constants/icons.ts), so a quiz is the same glyph in the same hue
 * on the Tools tab, the prep board, «موادي» and a printed copy. It used to keep
 * a table of its own and disagree: the quiz was `help-circle-outline` in rose,
 * the worksheet a brown (`#8A5A00`, in the amber family that means "now"), the
 * activity a green, the lesson plan the brand teal. `MATERIAL_CONCEPT` names
 * the concept; a kind with no entry (the whiteboard) has a look of its own.
 */
import { conceptOf, type ConceptId, type IconName } from './icons.ts';
import { readableOn } from '../services/readableColor.ts';
import type { MaterialType } from '@/services/workspace';

/** Which concept each kind is. `board` is not one: the whiteboard is a canvas, not a thing a lesson prep needs. */
export const MATERIAL_CONCEPT: Partial<Record<MaterialType, ConceptId>> = {
  lesson: 'lesson-plan',
  worksheet: 'worksheet',
  quiz: 'quiz',
  flow: 'lesson-flow',
  activity: 'activity',
  slides: 'slides',
  'prompt-slides': 'prompt-slides',
};

/** A kind with no concept: slate, the neutral, ≥ 13 CIEDE2000 from every concept colour. */
const OWN_LOOK: Partial<Record<MaterialType, { icon: IconName; color: string }>> = {
  board: { icon: 'easel-outline', color: '#475569' },
};

const KINDS = ['lesson', 'worksheet', 'quiz', 'flow', 'activity', 'slides', 'prompt-slides', 'board'] as const satisfies readonly MaterialType[];

const lookOf = (kind: MaterialType): { icon: IconName; color: string } => {
  const concept = MATERIAL_CONCEPT[kind];
  if (concept) return conceptOf(concept);
  return OWN_LOOK[kind]!;
};

/**
 * The kind's hue. Every one carries white text at 4.5:1 (it is a header band
 * in `workspace/view.tsx`) and is text on white at the same ratio. The printed
 * and projected copies use the same colours (`DOC_ACCENT` in
 * services/exportHtml.ts).
 */
export const MATERIAL_FILL = Object.fromEntries(KINDS.map(k => [k, lookOf(k).color])) as Record<MaterialType, string>;

/** `palette.card` in dark mode (constants/colors.ts). */
export const DARK_CARD = '#111F36';

/**
 * The same hues lifted for the dark card: each ≥ 7:1 there. Derived, not
 * typed, so a concept that moves brings its dark twin with it. The label of a
 * material sits on its own 18% tint of the colour, which costs about a point
 * of contrast, hence 7 and not 4.5.
 */
export const MATERIAL_ON_DARK = Object.fromEntries(KINDS.map(k => [k, readableOn(lookOf(k).color, DARK_CARD, 7)])) as Record<MaterialType, string>;

export const MATERIAL_ICON = Object.fromEntries(KINDS.map(k => [k, lookOf(k).icon])) as Record<MaterialType, IconName>;
