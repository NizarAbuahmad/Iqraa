/**
 * The FAQ as data — which questions exist, how they are grouped, and the
 * search over them.
 *
 * Kept out of the screen so `node --test` can pin it: every question needs an
 * answer in both languages, and the search has to find Arabic through the
 * hamza / ta-marbuta spellings a teacher actually types. Types only come from
 * i18n, which is pure.
 */
import type { TranslationKey } from './i18n.ts';

export type FaqCategoryId = 'start' | 'tools' | 'saving' | 'class' | 'account';

export type FaqCategory = {
  id: FaqCategoryId;
  labelKey: TranslationKey;
  /** Ionicons glyph, shared by the chip and the entry badge. */
  icon: string;
};

export type FaqEntry = {
  q: TranslationKey;
  a: TranslationKey;
  category: FaqCategoryId;
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'start', labelKey: 'faqCatStart', icon: 'rocket-outline' },
  { id: 'tools', labelKey: 'faqCatTools', icon: 'construct-outline' },
  { id: 'saving', labelKey: 'faqCatSaving', icon: 'download-outline' },
  { id: 'class', labelKey: 'faqCatClass', icon: 'people-outline' },
  { id: 'account', labelKey: 'faqCatAccount', icon: 'person-circle-outline' },
];

/** Grouped by topic; within a topic, ordered by when a teacher hits it. */
export const FAQ_ENTRIES: FaqEntry[] = [
  { q: 'faqQ1', a: 'faqA1', category: 'start' },
  { q: 'faqQ2', a: 'faqA2', category: 'start' },
  { q: 'faqQ10', a: 'faqA10', category: 'start' },
  { q: 'faqQ3', a: 'faqA3', category: 'tools' },
  { q: 'faqQ11', a: 'faqA11', category: 'tools' },
  { q: 'faqQ5', a: 'faqA5', category: 'tools' },
  { q: 'faqQ12', a: 'faqA12', category: 'tools' },
  { q: 'faqQ6', a: 'faqA6', category: 'tools' },
  { q: 'faqQ4', a: 'faqA4', category: 'saving' },
  { q: 'faqQ13', a: 'faqA13', category: 'saving' },
  { q: 'faqQ7', a: 'faqA7', category: 'class' },
  { q: 'faqQ8', a: 'faqA8', category: 'class' },
  { q: 'faqQ9', a: 'faqA9', category: 'class' },
  { q: 'faqQ15', a: 'faqA15', category: 'class' },
  { q: 'faqQ14', a: 'faqA14', category: 'class' },
  { q: 'faqQ16', a: 'faqA16', category: 'account' },
  { q: 'faqQ17', a: 'faqA17', category: 'account' },
  { q: 'faqQ18', a: 'faqA18', category: 'account' },
];

/**
 * Lowercase, tashkeel and tatweel stripped, alef / ya / ta-marbuta folded —
 * so «الاسئله» finds «الأسئلة». Not shared with commandPalette's `normalize`
 * on purpose: that file's folding is tuned for command matching and this one
 * must stay boring.
 */
export function foldForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[؟?!.,،«»"“”()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Entries whose question or answer contains every word of `query`. An empty
 * query matches everything; `category` narrows first.
 */
export function filterFaq(
  entries: FaqEntry[],
  query: string,
  category: FaqCategoryId | 'all',
  t: (key: TranslationKey) => string,
): FaqEntry[] {
  const words = foldForSearch(query).split(' ').filter(Boolean);
  return entries.filter(e => {
    if (category !== 'all' && e.category !== category) return false;
    if (!words.length) return true;
    const hay = foldForSearch(`${t(e.q)} ${t(e.a)}`);
    return words.every(w => hay.includes(w));
  });
}
