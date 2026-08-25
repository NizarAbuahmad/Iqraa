/**
 * How an activity's type reads to a teacher.
 *
 * `ActivityOutput.activityType` is stored as the id the form sent — `group`,
 * `hands-on` — and both the Activity screen's result view and the workspace
 * viewer printed it raw, so an otherwise fully Arabic activity had the word
 * "group" in its meta row. The generator forms already had the translations;
 * nothing carried them back to the output.
 */
import type { TranslationKey } from '@/services/i18n';

export const ACTIVITY_TYPE_IDS = ['individual', 'group', 'discussion', 'hands-on', 'game'] as const;

export type ActivityTypeId = typeof ACTIVITY_TYPE_IDS[number];

export const ACTIVITY_TYPE_LABEL_KEY: Record<ActivityTypeId, TranslationKey> = {
  individual: 'activityTypeIndividual',
  group: 'activityTypeGroup',
  discussion: 'activityTypeDiscussion',
  'hands-on': 'activityTypeHandsOn',
  game: 'activityTypeGame',
};

/**
 * The label for a stored activity type.
 *
 * Falls back to the raw value rather than to a placeholder: with live AI the
 * generator can return a type the form never offered, and showing what it
 * actually said beats showing "—" or, worse, silently calling it a group
 * activity. Empty input gives an empty string, so callers can skip the row.
 */
export function activityTypeLabel(
  activityType: string | null | undefined,
  t: (key: TranslationKey, ...args: any[]) => string,
): string {
  const raw = (activityType ?? '').trim();
  if (!raw) return '';
  const key = ACTIVITY_TYPE_LABEL_KEY[raw as ActivityTypeId];
  return key ? t(key) : raw;
}
