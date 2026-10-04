/**
 * The reasons a message can be reported for, and how a stored one is shown.
 *
 * The picker sends the reason as its translation key, and every report on
 * record holds one ("reportReasonBullying"). The moderation queue printed that
 * string as-is, so a moderator read a code instead of a reason. Translating at
 * display time fixes the existing rows too, which re-wording the stored value
 * would not. Anything that is not a known key — text from an older client, or
 * a reason typed by hand — is shown as it was written.
 *
 * Split out of the screens so it can be tested under bare `node --test`.
 */
import type { TranslationKey } from './i18n';

export const REPORT_REASON_KEYS = [
  'reportReasonInappropriate',
  'reportReasonBullying',
  'reportReasonSpam',
  'reportReasonOther',
] as const satisfies readonly TranslationKey[];

export type ReportReasonKey = (typeof REPORT_REASON_KEYS)[number];

export function isReportReasonKey(reason: string): reason is ReportReasonKey {
  return (REPORT_REASON_KEYS as readonly string[]).includes(reason);
}

/** The reason in the reader's language when it is a known key; the stored text otherwise. */
export function reportReasonLabel(reason: string, t: (key: ReportReasonKey) => string): string {
  const trimmed = reason.trim();
  return isReportReasonKey(trimmed) ? t(trimmed) : trimmed;
}
