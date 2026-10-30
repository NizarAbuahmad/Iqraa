/**
 * Solid, liquid or gas? (/play/matter) — name the state a substance is
 * normally known in. Grades 3–7.
 *
 * The question is the state most people know a thing in, not its state at some
 * particular temperature. Ice and water vapour are listed on purpose as the
 * solid and gas forms of water, so a child learns that one substance can be
 * all three. Salt and sugar are granular solids, not powders-that-pour, and
 * are listed as solids on purpose.
 *
 * Excluded: milk, honey, toothpaste, "air" and mercury. Their state is arguable
 * for a child: milk and honey pour, toothpaste keeps its shape, air is a mixture
 * of gases, and mercury is a liquid metal, which contradicts the child's rule
 * that metals are solid. A right answer would then depend on the child's reading
 * of the word, not on the substance.
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
  { id: 'ice', ar: 'ثلج', en: 'Ice', state: 'solid' },
  { id: 'glass', ar: 'زجاج', en: 'Glass', state: 'solid' },
  { id: 'stone', ar: 'حجر', en: 'Stone', state: 'solid' },
  { id: 'gold', ar: 'ذهب', en: 'Gold', state: 'solid' },
  { id: 'salt', ar: 'ملح', en: 'Salt', state: 'solid' },
  { id: 'sugar', ar: 'سكّر', en: 'Sugar', state: 'solid' },
  { id: 'water', ar: 'ماء', en: 'Water', state: 'liquid' },
  { id: 'olive-oil', ar: 'زيت الزيتون', en: 'Olive oil', state: 'liquid' },
  { id: 'orange-juice', ar: 'عصير البرتقال', en: 'Orange juice', state: 'liquid' },
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

/** What makes each state what it is: the "why" line under a revealed answer. */
export const STATE_DEFINITION: Record<MatterState, { ar: string; en: string }> = {
  solid: { ar: 'الصلب له شكل ثابت', en: 'A solid keeps its own shape' },
  liquid: { ar: 'السائل يأخذ شكل الإناء الذي يوضع فيه', en: 'A liquid takes the shape of its container' },
  gas: { ar: 'الغاز ينتشر ليملأ المكان الذي يوجد فيه', en: 'A gas spreads out to fill the space it is in' },
};

const STATES: MatterState[] = ['solid', 'liquid', 'gas'];

function buildQuestion(s: Substance, lang: 'ar' | 'en', rng: () => number): TextQuestion {
  return {
    promptKey: 'playMatterPrompt',
    subject: lang === 'ar' ? s.ar : s.en,
    options: shuffle(STATES.map(st => ({ id: st, label: STATE_LABEL[st][lang] })), rng),
    correctId: s.state,
    explanation: `${lang === 'ar' ? s.ar : s.en}: ${STATE_LABEL[s.state][lang]}. ${STATE_DEFINITION[s.state][lang]}`,
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
