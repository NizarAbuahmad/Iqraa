/**
 * Plurals (/play/plurals) — pick the plural of an Arabic word. Grades 2–5.
 *
 * The question is about Arabic morphology, so the word and the options are
 * Arabic whatever the UI language is; only the prompt is localised. Only words
 * with ONE common plural are used (no «بيت» — بيوت/أبيات — and no «عين» —
 * عيون/أعين); the options are the plurals of other words in the table, never a
 * made-up form, so no distractor is a malformed or a second valid plural.
 */
import { sample, shuffle } from './rng.ts';
import { withDistractors, type TextQuestion } from './textQuiz.ts';

export interface PluralPair {
  ar: string;
  pluralAr: string;
}

export const PLURAL_PAIRS: PluralPair[] = [
  { ar: 'كتاب', pluralAr: 'كتب' },
  { ar: 'قلم', pluralAr: 'أقلام' },
  { ar: 'ولد', pluralAr: 'أولاد' },
  { ar: 'بنت', pluralAr: 'بنات' },
  { ar: 'مدرسة', pluralAr: 'مدارس' },
  { ar: 'شجرة', pluralAr: 'أشجار' },
  { ar: 'رجل', pluralAr: 'رجال' },
  { ar: 'طالب', pluralAr: 'طلّاب' },
  { ar: 'باب', pluralAr: 'أبواب' },
  { ar: 'نهر', pluralAr: 'أنهار' },
  { ar: 'جبل', pluralAr: 'جبال' },
  { ar: 'ملعب', pluralAr: 'ملاعب' },
  { ar: 'مفتاح', pluralAr: 'مفاتيح' },
  { ar: 'سيف', pluralAr: 'سيوف' },
  { ar: 'ورقة', pluralAr: 'أوراق' },
  { ar: 'طائر', pluralAr: 'طيور' },
  { ar: 'سمكة', pluralAr: 'أسماك' },
  { ar: 'كوكب', pluralAr: 'كواكب' },
  { ar: 'قلب', pluralAr: 'قلوب' },
  { ar: 'صديق', pluralAr: 'أصدقاء' },
  { ar: 'مدينة', pluralAr: 'مدن' },
  { ar: 'دولة', pluralAr: 'دول' },
  { ar: 'سيّارة', pluralAr: 'سيّارات' },
  { ar: 'لغة', pluralAr: 'لغات' },
  { ar: 'نافذة', pluralAr: 'نوافذ' },
  { ar: 'كرسي', pluralAr: 'كراسي' },
  { ar: 'حقيبة', pluralAr: 'حقائب' },
  { ar: 'حديقة', pluralAr: 'حدائق' },
  { ar: 'قصّة', pluralAr: 'قصص' },
  { ar: 'معلّم', pluralAr: 'معلّمون' },
];

const ALL_PLURALS = PLURAL_PAIRS.map(p => ({ id: p.pluralAr, label: p.pluralAr }));

function buildQuestion(pair: PluralPair, rng: () => number): TextQuestion {
  const correct = { id: pair.pluralAr, label: pair.pluralAr };
  return {
    promptKey: 'playPluralsPrompt',
    subject: pair.ar,
    options: withDistractors(correct, ALL_PLURALS.filter(o => o.id !== pair.pluralAr), 3, rng),
    correctId: correct.id,
  };
}

/** `count` questions, each on a different word. `lang` is accepted for the shared game signature; the content is always Arabic. */
export function buildPluralRound(_lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  return shuffle(sample(PLURAL_PAIRS, count, rng), rng).map(p => buildQuestion(p, rng));
}
