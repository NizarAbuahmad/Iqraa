/**
 * Memorisation progress for the Quran Corner. Pure: the storage adapter is
 * `hooks/useQuranProgress.ts`, so this file imports nothing from React Native
 * and can be tested with bare `node --test`.
 *
 * A mark is the LEARNER'S OWN rating. The app does not hear a recitation and
 * cannot tell whether an ayah is really memorised, so nothing here is named or
 * worded as "verified" or "correct". An ayah with no mark is new.
 */

export type AyahStatus = 'learning' | 'memorised';

export interface AyahMark {
  status: AyahStatus;
  /** Local date `YYYY-MM-DD` the learner last rated it. */
  at: string;
}

/** Surah number → ayah number → mark. Both keys are decimal strings, as JSON requires. */
export type QuranProgress = Record<string, Record<string, AyahMark>>;

export type AyahState = AyahStatus | 'new';

export const QURAN_PROGRESS_KEY = '@iqra_quran_progress_v1';

/** Per-user key, in the same `base:userId` form as the other on-device keys. */
export function quranProgressKey(userId: string | null | undefined): string {
  return userId ? `${QURAN_PROGRESS_KEY}:${userId}` : QURAN_PROGRESS_KEY;
}

/** Local calendar date, `YYYY-MM-DD`. Local, not UTC: a learner at 1 a.m. is still on today's date. */
export function todayKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Reads what was saved. Anything unreadable or malformed is dropped: a bad blob must never block the screen. */
export function parseProgress(raw: string | null | undefined): QuranProgress {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const out: QuranProgress = {};
  for (const [surah, ayahs] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^\d+$/.test(surah) || typeof ayahs !== 'object' || ayahs === null || Array.isArray(ayahs)) continue;
    for (const [ayah, mark] of Object.entries(ayahs as Record<string, unknown>)) {
      const m = mark as Partial<AyahMark> | null;
      if (!/^\d+$/.test(ayah) || !m) continue;
      if ((m.status === 'learning' || m.status === 'memorised') && typeof m.at === 'string') {
        (out[surah] ??= {})[ayah] = { status: m.status, at: m.at };
      }
    }
  }
  return out;
}

/** The progress after rating one ayah; `null` clears the rating. Never mutates its input. */
export function rateAyah(
  progress: QuranProgress,
  surah: number,
  ayah: number,
  status: AyahStatus | null,
  today: string,
): QuranProgress {
  const s = String(surah);
  const a = String(ayah);
  const surahMarks = { ...(progress[s] ?? {}) };
  if (status === null) delete surahMarks[a];
  else surahMarks[a] = { status, at: today };

  const next = { ...progress };
  if (Object.keys(surahMarks).length === 0) delete next[s];
  else next[s] = surahMarks;
  return next;
}

export function stateOf(progress: QuranProgress, surah: number, ayah: number): AyahState {
  return progress[String(surah)]?.[String(ayah)]?.status ?? 'new';
}

/** How many of the given ayahs are rated «memorised». */
export function countMemorised(progress: QuranProgress, surah: number, ayahs: readonly number[]): number {
  return ayahs.filter(n => stateOf(progress, surah, n) === 'memorised').length;
}
