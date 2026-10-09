/**
 * Element symbols trivia (/play/elements) — the hub's one science game.
 * Each question shows either a symbol (pick the name) or a name (pick the
 * symbol). Names follow the Jordanian science books' spelling (الخارصين, not
 * الزنك).
 */
import { sample, shuffle } from './rng.ts';
import type { TriviaOption } from './countries.ts';

export interface ChemElement {
  symbol: string;
  nameAr: string;
  nameEn: string;
}

/** Elements 1–20 plus the common metals and halogens the G7–10 books use. */
export const ELEMENTS: ChemElement[] = [
  { symbol: 'H', nameAr: 'الهيدروجين', nameEn: 'Hydrogen' },
  { symbol: 'He', nameAr: 'الهيليوم', nameEn: 'Helium' },
  { symbol: 'Li', nameAr: 'الليثيوم', nameEn: 'Lithium' },
  { symbol: 'Be', nameAr: 'البيريليوم', nameEn: 'Beryllium' },
  { symbol: 'B', nameAr: 'البورون', nameEn: 'Boron' },
  { symbol: 'C', nameAr: 'الكربون', nameEn: 'Carbon' },
  { symbol: 'N', nameAr: 'النيتروجين', nameEn: 'Nitrogen' },
  { symbol: 'O', nameAr: 'الأكسجين', nameEn: 'Oxygen' },
  { symbol: 'F', nameAr: 'الفلور', nameEn: 'Fluorine' },
  { symbol: 'Ne', nameAr: 'النيون', nameEn: 'Neon' },
  { symbol: 'Na', nameAr: 'الصوديوم', nameEn: 'Sodium' },
  { symbol: 'Mg', nameAr: 'المغنيسيوم', nameEn: 'Magnesium' },
  { symbol: 'Al', nameAr: 'الألمنيوم', nameEn: 'Aluminium' },
  { symbol: 'Si', nameAr: 'السيليكون', nameEn: 'Silicon' },
  { symbol: 'P', nameAr: 'الفسفور', nameEn: 'Phosphorus' },
  { symbol: 'S', nameAr: 'الكبريت', nameEn: 'Sulfur' },
  { symbol: 'Cl', nameAr: 'الكلور', nameEn: 'Chlorine' },
  { symbol: 'Ar', nameAr: 'الأرغون', nameEn: 'Argon' },
  { symbol: 'K', nameAr: 'البوتاسيوم', nameEn: 'Potassium' },
  { symbol: 'Ca', nameAr: 'الكالسيوم', nameEn: 'Calcium' },
  { symbol: 'Fe', nameAr: 'الحديد', nameEn: 'Iron' },
  { symbol: 'Cu', nameAr: 'النحاس', nameEn: 'Copper' },
  { symbol: 'Zn', nameAr: 'الخارصين', nameEn: 'Zinc' },
  { symbol: 'Br', nameAr: 'البروم', nameEn: 'Bromine' },
  { symbol: 'Ag', nameAr: 'الفضة', nameEn: 'Silver' },
  { symbol: 'Sn', nameAr: 'القصدير', nameEn: 'Tin' },
  { symbol: 'I', nameAr: 'اليود', nameEn: 'Iodine' },
  { symbol: 'Au', nameAr: 'الذهب', nameEn: 'Gold' },
  { symbol: 'Hg', nameAr: 'الزئبق', nameEn: 'Mercury' },
  { symbol: 'Pb', nameAr: 'الرصاص', nameEn: 'Lead' },
];

/** What the prompt shows: a symbol (answer with the name) or a name (answer with the symbol). */
export type ElementPrompt = 'symbol' | 'name';

export interface ElementQuestion {
  element: ChemElement;
  shows: ElementPrompt;
  options: TriviaOption[];
  correctId: string;
}

const nameOf = (e: ChemElement, lang: 'ar' | 'en') => (lang === 'ar' ? e.nameAr : e.nameEn);

/**
 * The right answer plus 3 distractors. Distractors sharing the symbol's first
 * letter come first — C / Ca / Cl / Cu is the mix-up students actually make,
 * and a random pool would make most questions guessable.
 */
export function buildElementQuestion(
  element: ChemElement,
  pool: ChemElement[],
  shows: ElementPrompt,
  lang: 'ar' | 'en',
  rng: () => number = Math.random,
): ElementQuestion {
  const others = pool.filter(e => e.symbol !== element.symbol);
  const initial = element.symbol[0];
  const near = shuffle(others.filter(e => e.symbol[0] === initial), rng);
  const far = shuffle(others.filter(e => e.symbol[0] !== initial), rng);
  const distractors = [...near, ...far].slice(0, 3);
  const options = shuffle(
    [element, ...distractors].map(e => ({ id: e.symbol, label: shows === 'symbol' ? nameOf(e, lang) : e.symbol })),
    rng,
  );
  return { element, shows, options, correctId: element.symbol };
}

/** `count` questions about distinct elements, alternating which side is shown. */
export function buildElementRound(
  lang: 'ar' | 'en',
  count: number,
  rng: () => number = Math.random,
): ElementQuestion[] {
  return sample(ELEMENTS, count, rng).map((el, i) =>
    buildElementQuestion(el, ELEMENTS, i % 2 === 0 ? 'symbol' : 'name', lang, rng),
  );
}
