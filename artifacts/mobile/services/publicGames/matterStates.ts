/**
 * Solid, liquid or gas? (/play/matter) — name the state of an everyday
 * substance at room temperature. Grades 3–7.
 *
 * Only unambiguous substances: no milk or mayonnaise (colloids), no honey or
 * toothpaste (arguable), no "air" (a mixture), no mercury (a liquid metal that
 * contradicts the child's "metals are solid" rule). Salt and sugar are
 * granular solids, not powders-that-pour, and are listed as solids on purpose.
 */
import { sample, shuffle } from './rng.ts';
import type { TextQuestion } from './textQuiz.ts';

export type MatterState = 'solid' | 'liquid' | 'gas';

export interface Substance {
  id: string;
  ar: string;
  en: string;
  state: MatterState;
}

export const SUBSTANCES: Substance[] = [
  { id: 'wood', ar: 'خشب', en: 'Wood', state: 'solid' },
  { id: 'iron', ar: 'حديد', en: 'Iron', state: 'solid' },
  { id: 'glass', ar: 'زجاج', en: 'Glass', state: 'solid' },
  { id: 'stone', ar: 'حجر', en: 'Stone', state: 'solid' },
  { id: 'gold', ar: 'ذهب', en: 'Gold', state: 'solid' },
  { id: 'salt', ar: 'ملح', en: 'Salt', state: 'solid' },
  { id: 'sugar', ar: 'سكّر', en: 'Sugar', state: 'solid' },
  { id: 'water', ar: 'ماء', en: 'Water', state: 'liquid' },
  { id: 'olive-oil', ar: 'زيت الزيتون', en: 'Olive oil', state: 'liquid' },
  { id: 'vinegar', ar: 'خلّ', en: 'Vinegar', state: 'liquid' },
  { id: 'seawater', ar: 'ماء البحر', en: 'Seawater', state: 'liquid' },
  { id: 'rose-water', ar: 'ماء الورد', en: 'Rose water', state: 'liquid' },
  { id: 'oxygen', ar: 'الأكسجين', en: 'Oxygen', state: 'gas' },
  { id: 'carbon-dioxide', ar: 'ثاني أكسيد الكربون', en: 'Carbon dioxide', state: 'gas' },
  { id: 'hydrogen', ar: 'الهيدروجين', en: 'Hydrogen', state: 'gas' },
  { id: 'helium', ar: 'الهيليوم', en: 'Helium', state: 'gas' },
  { id: 'nitrogen', ar: 'النيتروجين', en: 'Nitrogen', state: 'gas' },
  { id: 'water-vapour', ar: 'بخار الماء', en: 'Water vapour', state: 'gas' },
];

const STATE_LABEL: Record<MatterState, { ar: string; en: string }> = {
  solid: { ar: 'صلب', en: 'Solid' },
  liquid: { ar: 'سائل', en: 'Liquid' },
  gas: { ar: 'غاز', en: 'Gas' },
};

const STATES: MatterState[] = ['solid', 'liquid', 'gas'];

function buildQuestion(s: Substance, lang: 'ar' | 'en', rng: () => number): TextQuestion {
  return {
    promptKey: 'playMatterPrompt',
    subject: lang === 'ar' ? s.ar : s.en,
    options: shuffle(STATES.map(st => ({ id: st, label: STATE_LABEL[st][lang] })), rng),
    correctId: s.state,
  };
}

/**
 * `count` different substances. The sample is redrawn until it holds at least
 * two states, so a round is never "all gases" by luck.
 */
export function buildMatterRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  let picked: Substance[];
  do {
    picked = sample(SUBSTANCES, count, rng);
  } while (new Set(picked.map(s => s.state)).size < 2);
  return picked.map(s => buildQuestion(s, lang, rng));
}
