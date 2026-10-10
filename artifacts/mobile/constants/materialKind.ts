/**
 * How each saved-material kind looks and reads.
 *
 * Lived inline in `app/workspace/index.tsx`, where the label function ended in
 * `return t('quizType')` — so an activity and a deck both rendered as "اختبار
 * قصير". Two screens now show materials, and a colour/icon/label that drifts
 * between them is worse than the duplication that caused it. One map.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { MaterialType } from '@/services/workspace';
import type { TranslationKey } from '@/services/i18n';
import { scheme } from './colors';

/**
 * One hue per kind, deep enough to carry white text (≥ 5.2:1) and to be text
 * on white or paper (≥ 4.8:1). These were stock Tailwind values — quiz amber
 * was 2.15:1 on white, and two kinds were the same violet. No purple: the
 * site's DESIGN.md rules it out. The printed and projected copies use the same
 * four (`DOC_ACCENT` in services/exportHtml.ts). Both deck kinds share blue;
 * the icon tells them apart.
 */
export const MATERIAL_FILL: Record<MaterialType, string> = {
  lesson: '#006D65',
  worksheet: '#8A5A00',
  quiz: '#B0284F',
  flow: '#44506A',
  activity: '#3F7A1E',
  slides: '#1F5FA8',
  'prompt-slides': '#1F5FA8',
  board: '#9A3F12',
};

/** The same hues lifted for the dark card (#111F36): each ≥ 7.1:1 there. */
const ON_DARK: Record<MaterialType, string> = {
  lesson: '#2DD4BF',
  worksheet: '#E2B25C',
  quiz: '#F28BA8',
  flow: '#AAB6CC',
  activity: '#9BCB6A',
  slides: '#7DB4F2',
  'prompt-slides': '#7DB4F2',
  board: '#F2A671',
};

/** Icon and text colour on a card. Fills that carry white text use MATERIAL_FILL. */
export const MATERIAL_COLOR = scheme === 'dark' ? ON_DARK : MATERIAL_FILL;

export const MATERIAL_ICON: Record<MaterialType, keyof typeof Ionicons.glyphMap> = {
  lesson: 'document-text-outline',
  worksheet: 'list-outline',
  quiz: 'help-circle-outline',
  flow: 'git-branch-outline',
  activity: 'game-controller-outline',
  slides: 'tv-outline',
  'prompt-slides': 'sparkles-outline',
  board: 'easel-outline',
};

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
