/**
 * «اقترح ميزة» (`app/suggest-feature.tsx`) — when an idea asks for something
 * «إقرأ» already does, the thank-you says how to do it now. The idea is still
 * sent: a request for a feature that exists says it is hard to find.
 *
 * Deliberately a short list of strict rules, not `findAppPlaces` from
 * `appHelp.ts`: that matcher answers questions about the app and reads any tool
 * name as the place, so «تحضير كل شيء» found the lesson-plan tool and «أريد لعبة
 * عن الكسور» the games — every idea would be told "this already exists". A rule
 * here matches only words that name the existing feature itself. Append a rule
 * when real ideas keep asking for something that is already there.
 *
 * Pure TypeScript (only `normalize` is imported), so `node --test` loads it.
 */
import { normalize } from './commandPalette.ts';

export type ExistingFeature = {
  id: 'export' | 'dark-mode';
  /** i18n key of the answer shown under the thank-you. */
  howKey: 'faqA4' | 'howDarkMode';
};

const ARABIC = /[؀-ۿ]/;

/**
 * Word or PDF. «وورد» is only ever Microsoft Word; English "word" is too common
 * on its own ("a word game", "word problems"), so it counts inside an Arabic
 * message — «أريد تصدير ورقة إلى Word» — or with a file word next to it.
 */
// One clitic, then «ال»: «وورد», «الوورد», «بالوورد», «كوورد», «للوورد».
const WORD_AR = /(?:^|[\s,،.؟?!(«"'])(?:[وفبكل]?(?:ال)?|لل)وورد(?=$|[\s,،.؟?!)»"'])/;
const WORD_EN = /\b(?:ms|microsoft)\s+word\b|\bword\s+(?:file|files|doc|docs|document|documents|format)\b|\b(?:to|into|as|in)\s+word\s*(?:$|[.,!?])/;
const PDF = /\bpdf\b|\bdocx?\b|بي\s*دي\s*اف/;

/** «الوضع الليلي», «وضع داكن», "dark mode", "night theme". */
const DARK_MODE = /(?:^|\s)(?:ال)?وضع\s+(?:ال)?(?:ليلي|داكن|مظلم|غامق)(?:\s|$)|\b(?:dark|night)\s+(?:mode|theme)\b/;

export function existingFeatureFor(idea: string): ExistingFeature | null {
  const raw = idea ?? '';
  const text = normalize(raw);
  if (!text) return null;
  const arabic = ARABIC.test(raw);
  if (WORD_AR.test(text) || PDF.test(text) || WORD_EN.test(text) || (arabic && /\bword\b/.test(text))) {
    return { id: 'export', howKey: 'faqA4' };
  }
  if (DARK_MODE.test(text)) return { id: 'dark-mode', howKey: 'howDarkMode' };
  return null;
}
