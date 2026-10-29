/**
 * Jordan's governorates (/play/governorates) — which governorate is this town
 * or site in? Grades 4–9.
 *
 * Eleven of the twelve governorates share their name with their centre (only
 * Balqa → Salt differs), so "governorate → centre" would be near-trivial. The
 * question is the other way round, about towns and sites that carry a
 * different name. Every row was checked against a published source before it
 * was added (see the commit that introduced it); a place whose governorate is
 * arguable (the Dead Sea spans several) is deliberately absent.
 */
import { sample } from './rng.ts';
import { withDistractors, type TextQuestion } from './textQuiz.ts';

export interface Governorate {
  id: string;
  ar: string;
  en: string;
}

export interface Place {
  ar: string;
  en: string;
  /** A `Governorate.id`. */
  gov: string;
}

export const GOVERNORATES: Governorate[] = [
  { id: 'amman', ar: 'عمّان', en: 'Amman' },
  { id: 'zarqa', ar: 'الزرقاء', en: 'Zarqa' },
  { id: 'irbid', ar: 'إربد', en: 'Irbid' },
  { id: 'mafraq', ar: 'المفرق', en: 'Mafraq' },
  { id: 'balqa', ar: 'البلقاء', en: 'Balqa' },
  { id: 'jerash', ar: 'جرش', en: 'Jerash' },
  { id: 'ajloun', ar: 'عجلون', en: 'Ajloun' },
  { id: 'madaba', ar: 'مأدبا', en: 'Madaba' },
  { id: 'karak', ar: 'الكرك', en: 'Karak' },
  { id: 'tafilah', ar: 'الطفيلة', en: 'Tafilah' },
  { id: 'maan', ar: 'معان', en: "Ma'an" },
  { id: 'aqaba', ar: 'العقبة', en: 'Aqaba' },
];

export const PLACES: Place[] = [
  { ar: 'سحاب', en: 'Sahab', gov: 'amman' },
  { ar: 'ماركا', en: 'Marka', gov: 'amman' },
  { ar: 'ناعور', en: 'Naur', gov: 'amman' },
  { ar: 'الرصيفة', en: 'Russeifa', gov: 'zarqa' },
  { ar: 'الأزرق', en: 'Azraq', gov: 'zarqa' },
  { ar: 'الرمثا', en: 'Ramtha', gov: 'irbid' },
  { ar: 'أم قيس', en: 'Umm Qais', gov: 'irbid' },
  { ar: 'بيت راس', en: 'Beit Ras', gov: 'irbid' },
  { ar: 'الرويشد', en: 'Ruwaished', gov: 'mafraq' },
  { ar: 'أم الجمال', en: 'Umm al-Jimal', gov: 'mafraq' },
  { ar: 'السلط', en: 'Salt', gov: 'balqa' },
  { ar: 'فحيص', en: 'Fuheis', gov: 'balqa' },
  { ar: 'دير علا', en: 'Deir Alla', gov: 'balqa' },
  { ar: 'سوف', en: 'Souf', gov: 'jerash' },
  { ar: 'كفرنجة', en: 'Kufranjah', gov: 'ajloun' },
  { ar: 'عنجرة', en: 'Anjara', gov: 'ajloun' },
  { ar: 'ذيبان', en: 'Dhiban', gov: 'madaba' },
  { ar: 'جبل نيبو', en: 'Mount Nebo', gov: 'madaba' },
  { ar: 'مؤتة', en: "Mu'ta", gov: 'karak' },
  { ar: 'الصافي', en: 'Safi', gov: 'karak' },
  { ar: 'دانا', en: 'Dana', gov: 'tafilah' },
  { ar: 'بصيرا', en: 'Busayra', gov: 'tafilah' },
  { ar: 'وادي موسى (البتراء)', en: 'Wadi Musa (Petra)', gov: 'maan' },
  { ar: 'الشوبك', en: 'Shobak', gov: 'maan' },
  { ar: 'وادي رم', en: 'Wadi Rum', gov: 'aqaba' },
  { ar: 'القويرة', en: 'Quweira', gov: 'aqaba' },
];

const optionFor = (g: Governorate, lang: 'ar' | 'en') => ({ id: g.id, label: lang === 'ar' ? g.ar : g.en });

function buildQuestion(place: Place, lang: 'ar' | 'en', rng: () => number): TextQuestion {
  const home = GOVERNORATES.find(g => g.id === place.gov)!;
  const others = GOVERNORATES.filter(g => g.id !== home.id).map(g => optionFor(g, lang));
  return {
    promptKey: 'playGovernoratesPrompt',
    subject: lang === 'ar' ? place.ar : place.en,
    options: withDistractors(optionFor(home, lang), others, 3, rng),
    correctId: home.id,
  };
}

/** `count` questions, each on a different place. */
export function buildGovernorateRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  return sample(PLACES, count, rng).map(p => buildQuestion(p, lang, rng));
}
