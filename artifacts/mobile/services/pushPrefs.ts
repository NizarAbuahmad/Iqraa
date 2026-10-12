/**
 * The account's school-notification switches (homework, exam dates, results),
 * as `GET|PUT /auth/me/push-preferences` returns them. Pure, so it is tested;
 * the fetchers are in pushPrefsApi.ts (apiClient pulls in react-native).
 *
 * A missing or malformed switch reads as ON — the server's own rule
 * (api-server modules/notifications/pushPrefs.ts): these are opt-outs.
 */
import type { TranslationKey } from './i18n.ts';

export type PushPrefCategory = 'homework' | 'exams' | 'results';
export type PushPrefs = Record<PushPrefCategory, boolean>;

export const PUSH_PREF_ROWS: readonly { category: PushPrefCategory; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  { category: 'homework', labelKey: 'pushPrefHomework', hintKey: 'pushPrefHomeworkHint' },
  { category: 'exams', labelKey: 'pushPrefExams', hintKey: 'pushPrefExamsHint' },
  { category: 'results', labelKey: 'pushPrefResults', hintKey: 'pushPrefResultsHint' },
];

export function normalizePushPrefs(raw: unknown): PushPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const prefs = (raw as { preferences?: unknown }).preferences;
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return null;
  const p = prefs as Record<string, unknown>;
  return { homework: p.homework !== false, exams: p.exams !== false, results: p.results !== false };
}

export function withPref(prefs: PushPrefs, category: PushPrefCategory, on: boolean): PushPrefs {
  return { ...prefs, [category]: on };
}

/** Only parents and students are sent these pushes; nobody else has anything to switch. */
export function showsFamilyPushPrefs(role: string | null | undefined): boolean {
  return role === 'parent' || role === 'student';
}
