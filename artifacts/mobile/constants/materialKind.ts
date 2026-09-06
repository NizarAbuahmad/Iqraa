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

export const MATERIAL_COLOR: Record<MaterialType, string> = {
  lesson: '#1B6B62',
  worksheet: '#8B5CF6',
  quiz: '#F59E0B',
  flow: '#00A99D',
  activity: '#EC4899',
  // Matches the Slides Maker screen's accent, so a saved deck is the same
  // colour in the workspace as the tool that produced it.
  slides: '#0EA5E9',
  // The «تبسيط الشرح» screen's accent, so the handout is the same colour in
  // موادي as the tool that produced it.
  explainer: '#00A99D',
};

export const MATERIAL_ICON: Record<MaterialType, keyof typeof Ionicons.glyphMap> = {
  lesson: 'document-text-outline',
  worksheet: 'list-outline',
  quiz: 'help-circle-outline',
  flow: 'git-branch-outline',
  activity: 'game-controller-outline',
  slides: 'tv-outline',
  explainer: 'bulb-outline',
};

export const MATERIAL_LABEL_KEY: Record<MaterialType, TranslationKey> = {
  lesson: 'lessonType',
  worksheet: 'worksheetType',
  quiz: 'quizType',
  flow: 'flowType',
  activity: 'activityType',
  slides: 'slidesType',
  explainer: 'explainerType',
};

/**
 * Which generator screen reopens this kind for editing.
 *
 * `slides` has no form-driven editor — the deck is built from a saved lesson —
 * so it is absent rather than pointed at a screen that cannot rebuild it.
 */
export const MATERIAL_EDIT_ROUTE: Partial<Record<MaterialType, string>> = {
  lesson: '/ai-tools/lesson-plan',
  worksheet: '/ai-tools/worksheet',
  quiz: '/ai-tools/quiz',
  flow: '/ai-tools/lesson-flow',
  activity: '/ai-tools/activity',
  // Partial, so the compiler will NOT catch a missing entry here — the other
  // three maps are exhaustive and will.
  explainer: '/ai-tools/simplify',
};
