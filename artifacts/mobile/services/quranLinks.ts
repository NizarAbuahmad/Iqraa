/**
 * Routes for the Quran Corner. A surah URL is shareable, so the param that
 * arrives is untrusted: it resolves to a surah the books assign or to null.
 */
import { getQuranSurah, type QuranSurah } from '@workspace/curriculum/quran';

export const QURAN_ROUTE = '/curriculum/quran';

export function surahPath(number: number): string {
  return `${QURAN_ROUTE}/${number}`;
}

export function memorizePath(number: number): string {
  return `${QURAN_ROUTE}/${number}/memorize`;
}

export function resolveSurahParam(param: string | string[] | undefined): QuranSurah | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw || !/^\d{1,3}$/.test(raw)) return null;
  return getQuranSurah(Number(raw)) ?? null;
}
