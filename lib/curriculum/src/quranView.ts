/**
 * Pure helpers the Quran Corner screens share. Kept apart from `quran.ts`, which
 * imports the whole generated data file, so these can be tested on small
 * fixtures.
 */
import type { QuranSegment, QuranSurah } from './quranTypes.ts';

/** True when the books assign every ayah of the surah. */
export function isWholeSurah(s: Pick<QuranSurah, 'segments' | 'ayahCount'>): boolean {
  return s.segments.length === 1 && s.segments[0]!.from === 1 && s.segments[0]!.to === s.ayahCount;
}

/** `1–8, 43–44`, Latin digits; the screen converts them at display time. */
export function segmentsText(segments: readonly QuranSegment[], separator = ', '): string {
  return segments.map(g => (g.from === g.to ? `${g.from}` : `${g.from}–${g.to}`)).join(separator);
}

const gradeNumber = (gradeId: string): number => Number(gradeId.replace('grade-', ''));

/** The grades whose books assign any part of the surah, ascending. */
export function surahGradeIds(s: Pick<QuranSurah, 'lessons'>): string[] {
  return [...new Set(s.lessons.map(l => l.gradeId))].sort((a, b) => gradeNumber(a) - gradeNumber(b));
}

/**
 * Surahs grouped under the first grade that assigns them, grades ascending,
 * surahs by number inside a group. The grade comes from the data, never from a
 * picker position.
 */
export function groupSurahsByGrade<T extends Pick<QuranSurah, 'number' | 'lessons'>>(
  surahs: readonly T[],
): Array<{ gradeId: string; surahs: T[] }> {
  const groups = new Map<string, T[]>();
  for (const s of surahs) {
    const first = surahGradeIds(s)[0];
    if (!first) continue;
    groups.set(first, [...(groups.get(first) ?? []), s]);
  }
  return [...groups.entries()]
    .sort((a, b) => gradeNumber(a[0]) - gradeNumber(b[0]))
    .map(([gradeId, list]) => ({ gradeId, surahs: [...list].sort((a, b) => a.number - b.number) }));
}
