/**
 * How each saved-material kind looks and reads.
 *
 * Lived inline in `app/workspace/index.tsx`, where the label function ended in
 * `return t('quizType')` — so an activity and a deck both rendered as "اختبار
 * قصير". Two screens now show materials, and a colour/icon/label that drifts
 * between them is worse than the duplication that caused it. One map.
 */
import type { MaterialType } from '@/services/workspace';
import type { TranslationKey } from '@/services/i18n';
import { scheme } from './colors';
import { MATERIAL_FILL, MATERIAL_ICON, MATERIAL_ON_DARK } from './materialKindData';

// The colours and icons are pure data in `materialKindData.ts` (so a test can
// load them); a kind that is a teaching concept takes both from `CONCEPTS`.
export { MATERIAL_FILL, MATERIAL_ICON };

/** Icon and text colour on a card. Fills that carry white text use MATERIAL_FILL. */
export const MATERIAL_COLOR = scheme === 'dark' ? MATERIAL_ON_DARK : MATERIAL_FILL;

export const MATERIAL_LABEL_KEY: Record<MaterialType, TranslationKey> = {
  lesson: 'lessonType',
  worksheet: 'worksheetType',
  quiz: 'quizType',
  flow: 'flowType',
  activity: 'activityType',
  slides: 'slidesType',
  'prompt-slides': 'promptSlidesType',
  board: 'boardType',
};

/**
 * Which generator screen reopens this kind for editing.
 *
 * Both deck kinds reopen their saved deck, not just a form: `savedId` makes
 * the screen load the stored slides (`services/savedDeck.ts`), and the spread
 * `formState` restores what each was built from — gradeIdx/subjectIdx/topic
 * for `slides`, prompt/mode/slide count for `prompt-slides`. Neither screen can
 * take the other's item: their form states are different shapes.
 * A board reopens in the whiteboard: `savedId` makes the screen load the stored pages.
 */
export const MATERIAL_EDIT_ROUTE: Partial<Record<MaterialType, string>> = {
  lesson: '/ai-tools/lesson-plan',
  worksheet: '/ai-tools/worksheet',
  quiz: '/ai-tools/quiz',
  flow: '/ai-tools/lesson-flow',
  activity: '/ai-tools/activity',
  slides: '/ai-tools/slides',
  'prompt-slides': '/ai-tools/prompt-slides',
  board: '/ai-tools/whiteboard',
};
