/**
 * Data and pure question-building logic for the two trivia games
 * (flags, capitals). No login, no curriculum grounding — these are the
 * public acquisition-funnel games, deliberately separate from the
 * curriculum-anchored generators under services/ai/.
 */
import { sample, shuffle } from './rng.ts';

export interface Country {
  /** ISO 3166-1 alpha-2, lowercase — matches flagcdn.com's URL scheme. */
  code: string;
  nameAr: string;
  nameEn: string;
  capitalAr: string;
  capitalEn: string;
}

/** Arab world first, then a spread of widely-recognised countries. */
export const COUNTRIES: Country[] = [
  { code: 'jo', nameAr: 'الأردن', nameEn: 'Jordan', capitalAr: 'عمّان', capitalEn: 'Amman' },
  { code: 'eg', nameAr: 'مصر', nameEn: 'Egypt', capitalAr: 'القاهرة', capitalEn: 'Cairo' },
  { code: 'sa', nameAr: 'السعودية', nameEn: 'Saudi Arabia', capitalAr: 'الرياض', capitalEn: 'Riyadh' },
  { code: 'ae', nameAr: 'الإمارات', nameEn: 'UAE', capitalAr: 'أبوظبي', capitalEn: 'Abu Dhabi' },
  { code: 'sy', nameAr: 'سوريا', nameEn: 'Syria', capitalAr: 'دمشق', capitalEn: 'Damascus' },
  { code: 'lb', nameAr: 'لبنان', nameEn: 'Lebanon', capitalAr: 'بيروت', capitalEn: 'Beirut' },
  { code: 'iq', nameAr: 'العراق', nameEn: 'Iraq', capitalAr: 'بغداد', capitalEn: 'Baghdad' },
  { code: 'kw', nameAr: 'الكويت', nameEn: 'Kuwait', capitalAr: 'الكويت', capitalEn: 'Kuwait City' },
  { code: 'qa', nameAr: 'قطر', nameEn: 'Qatar', capitalAr: 'الدوحة', capitalEn: 'Doha' },
  { code: 'ma', nameAr: 'المغرب', nameEn: 'Morocco', capitalAr: 'الرباط', capitalEn: 'Rabat' },
  { code: 'tn', nameAr: 'تونس', nameEn: 'Tunisia', capitalAr: 'تونس', capitalEn: 'Tunis' },
  { code: 'dz', nameAr: 'الجزائر', nameEn: 'Algeria', capitalAr: 'الجزائر', capitalEn: 'Algiers' },
  { code: 'ps', nameAr: 'فلسطين', nameEn: 'Palestine', capitalAr: 'القدس', capitalEn: 'Jerusalem' },
  { code: 'tr', nameAr: 'تركيا', nameEn: 'Turkey', capitalAr: 'أنقرة', capitalEn: 'Ankara' },
  { code: 'fr', nameAr: 'فرنسا', nameEn: 'France', capitalAr: 'باريس', capitalEn: 'Paris' },
  { code: 'de', nameAr: 'ألمانيا', nameEn: 'Germany', capitalAr: 'برلين', capitalEn: 'Berlin' },
  { code: 'gb', nameAr: 'بريطانيا', nameEn: 'United Kingdom', capitalAr: 'لندن', capitalEn: 'London' },
  { code: 'it', nameAr: 'إيطاليا', nameEn: 'Italy', capitalAr: 'روما', capitalEn: 'Rome' },
  { code: 'es', nameAr: 'إسبانيا', nameEn: 'Spain', capitalAr: 'مدريد', capitalEn: 'Madrid' },
  { code: 'jp', nameAr: 'اليابان', nameEn: 'Japan', capitalAr: 'طوكيو', capitalEn: 'Tokyo' },
  { code: 'cn', nameAr: 'الصين', nameEn: 'China', capitalAr: 'بكين', capitalEn: 'Beijing' },
  { code: 'in', nameAr: 'الهند', nameEn: 'India', capitalAr: 'نيودلهي', capitalEn: 'New Delhi' },
  { code: 'br', nameAr: 'البرازيل', nameEn: 'Brazil', capitalAr: 'برازيليا', capitalEn: 'Brasília' },
  { code: 'ca', nameAr: 'كندا', nameEn: 'Canada', capitalAr: 'أوتاوا', capitalEn: 'Ottawa' },
  { code: 'us', nameAr: 'الولايات المتحدة', nameEn: 'United States', capitalAr: 'واشنطن', capitalEn: 'Washington' },
  { code: 'au', nameAr: 'أستراليا', nameEn: 'Australia', capitalAr: 'كانبرا', capitalEn: 'Canberra' },
  { code: 'za', nameAr: 'جنوب أفريقيا', nameEn: 'South Africa', capitalAr: 'بريتوريا', capitalEn: 'Pretoria' },
  { code: 'ru', nameAr: 'روسيا', nameEn: 'Russia', capitalAr: 'موسكو', capitalEn: 'Moscow' },
];

export function flagUrl(code: string): string {
  return `https://flagcdn.com/w320/${code}.png`;
}

export type TriviaField = 'name' | 'capital';

export interface TriviaOption {
  id: string;
  label: string;
}

export interface TriviaQuestion {
  /** The country the question is about — its flag/name is the prompt subject. */
  country: Country;
  field: TriviaField;
  options: TriviaOption[];
  correctId: string;
}

function labelFor(c: Country, field: TriviaField, lang: 'ar' | 'en'): string {
  if (field === 'capital') return lang === 'ar' ? c.capitalAr : c.capitalEn;
  return lang === 'ar' ? c.nameAr : c.nameEn;
}

/** One question: the right answer plus 3 distractors, all shuffled. */
export function buildTriviaQuestion(
  country: Country,
  pool: Country[],
  field: TriviaField,
  lang: 'ar' | 'en',
  rng: () => number = Math.random,
): TriviaQuestion {
  const distractors = sample(pool.filter(c => c.code !== country.code), 3, rng);
  const options = shuffle(
    [country, ...distractors].map(c => ({ id: c.code, label: labelFor(c, field, lang) })),
    rng,
  );
  return { country, field, options, correctId: country.code };
}

/** A full round of `count` questions, each about a different country. */
export function buildTriviaRound(
  field: TriviaField,
  lang: 'ar' | 'en',
  count: number,
  rng: () => number = Math.random,
): TriviaQuestion[] {
  const subjects = sample(COUNTRIES, count, rng);
  return subjects.map(country => buildTriviaQuestion(country, COUNTRIES, field, lang, rng));
}
