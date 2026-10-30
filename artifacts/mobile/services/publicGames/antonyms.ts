/**
 * Opposites (/play/antonyms) — pick the opposite of a word. Grades 1–4.
 *
 * Every word in the table appears exactly once, on either side of one pair
 * (antonyms.test checks it), so a distractor drawn from another pair can never
 * be the answer. Pairs were chosen so that no two share a sense (no
 * «واسع/ضيّق» next to «كبير/صغير», no «صيف/شتاء» next to «حارّ/بارد»): a
 * distractor that is also a defensible opposite makes a bad answer key.
 */
import { sample, shuffle } from './rng.ts';
import { withDistractors, type TextQuestion } from './textQuiz.ts';

export interface AntonymPair {
  ar: string;
  en: string;
  oppAr: string;
  oppEn: string;
}

export const ANTONYM_PAIRS: AntonymPair[] = [
  { ar: 'كبير', en: 'big', oppAr: 'صغير', oppEn: 'small' },
  { ar: 'طويل', en: 'tall', oppAr: 'قصير', oppEn: 'short' },
  { ar: 'سريع', en: 'fast', oppAr: 'بطيء', oppEn: 'slow' },
  { ar: 'ثقيل', en: 'heavy', oppAr: 'خفيف', oppEn: 'light' },
  { ar: 'حارّ', en: 'hot', oppAr: 'بارد', oppEn: 'cold' },
  { ar: 'جديد', en: 'new', oppAr: 'قديم', oppEn: 'old' },
  { ar: 'قريب', en: 'near', oppAr: 'بعيد', oppEn: 'far' },
  { ar: 'فوق', en: 'above', oppAr: 'تحت', oppEn: 'below' },
  { ar: 'داخل', en: 'inside', oppAr: 'خارج', oppEn: 'outside' },
  { ar: 'ليل', en: 'night', oppAr: 'نهار', oppEn: 'day' },
  { ar: 'أبيض', en: 'white', oppAr: 'أسود', oppEn: 'black' },
  { ar: 'سعيد', en: 'happy', oppAr: 'حزين', oppEn: 'sad' },
  { ar: 'نظيف', en: 'clean', oppAr: 'متّسخ', oppEn: 'dirty' },
  { ar: 'غنيّ', en: 'rich', oppAr: 'فقير', oppEn: 'poor' },
  { ar: 'سهل', en: 'easy', oppAr: 'صعب', oppEn: 'hard' },
  { ar: 'قويّ', en: 'strong', oppAr: 'ضعيف', oppEn: 'weak' },
  { ar: 'ممتلئ', en: 'full', oppAr: 'فارغ', oppEn: 'empty' },
  { ar: 'مفتوح', en: 'open', oppAr: 'مغلق', oppEn: 'closed' },
  { ar: 'حلو', en: 'sweet', oppAr: 'مرّ', oppEn: 'bitter' },
  { ar: 'مبلّل', en: 'wet', oppAr: 'جافّ', oppEn: 'dry' },
  { ar: 'شجاع', en: 'brave', oppAr: 'جبان', oppEn: 'cowardly' },
  { ar: 'صادق', en: 'honest', oppAr: 'كاذب', oppEn: 'dishonest' },
  { ar: 'أمام', en: 'in front', oppAr: 'خلف', oppEn: 'behind' },
  { ar: 'يمين', en: 'right', oppAr: 'يسار', oppEn: 'left' },
  { ar: 'بداية', en: 'start', oppAr: 'نهاية', oppEn: 'end' },
  { ar: 'حيّ', en: 'alive', oppAr: 'ميّت', oppEn: 'dead' },
  { ar: 'مبكّر', en: 'early', oppAr: 'متأخّر', oppEn: 'late' },
];

/** Both sides of every pair as options. The id is the Arabic word, so it is the same in either language. */
const ALL_WORDS = (lang: 'ar' | 'en') =>
  ANTONYM_PAIRS.flatMap(p => [
    { id: p.ar, label: lang === 'ar' ? p.ar : p.en },
    { id: p.oppAr, label: lang === 'ar' ? p.oppAr : p.oppEn },
  ]);

function buildQuestion(pair: AntonymPair, lang: 'ar' | 'en', rng: () => number): TextQuestion {
  const flip = rng() < 0.5; // ask about the second word half of the time
  const shown = flip ? { ar: pair.oppAr, en: pair.oppEn } : { ar: pair.ar, en: pair.en };
  const answer = flip ? { ar: pair.ar, en: pair.en } : { ar: pair.oppAr, en: pair.oppEn };
  const correct = { id: answer.ar, label: lang === 'ar' ? answer.ar : answer.en };
  const others = ALL_WORDS(lang).filter(o => o.id !== pair.ar && o.id !== pair.oppAr);
  const subjectLabel = lang === 'ar' ? shown.ar : shown.en;
  return {
    promptKey: 'playAntonymsPrompt',
    subject: subjectLabel,
    options: withDistractors(correct, others, 3, rng),
    correctId: correct.id,
    explanation: lang === 'ar'
      ? `ضدّ «${subjectLabel}» هو «${correct.label}»`
      : `The opposite of "${subjectLabel}" is "${correct.label}"`,
  };
}

/** `count` questions, each on a different pair. */
export function buildAntonymRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  return shuffle(sample(ANTONYM_PAIRS, count, rng), rng).map(p => buildQuestion(p, lang, rng));
}
