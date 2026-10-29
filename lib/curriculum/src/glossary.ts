/**
 * Definitions for key terms, from two sources that are NOT the same kind of thing:
 *
 *  - `book-glossary` — the book's own printed «مسرد المصطلحات», read from the
 *    PDF (data/glossary/science-g9-10.json). Word for word the book's; served.
 *  - `draft` — written by a model for a subject whose printed glossary we could
 *    not read (data/glossary/chem-g10-s1.draft.json). Served ONLY after a
 *    teacher has signed it off (`reviewedBy` + `reviewedAt`), the same rule as an
 *    English grammar unit's `reviewedBy`. A draft is never shown to a student
 *    on a model's say-so.
 *
 * `servedGlossary` is the only door the app should use; `draftGlossary` is for
 * the review sheet.
 */
import science from './data/glossary/science-g9-10.json' with { type: 'json' };
import chemDraft from './data/glossary/chem-g10-s1.draft.json' with { type: 'json' };

export type GlossarySource = 'book-glossary' | 'draft';

export interface GlossaryEntry {
  /** Catalog book id (`book-phys-10-s2`) — the same id space as `Unit.bookId`. */
  bookId: string;
  /** The term as printed (harakat kept for display). */
  ar: string;
  en: string;
  definitionAr: string;
  source: GlossarySource;
  /** Book page of the printed entry; absent for a draft. */
  page?: number;
  /** A drafts' sign-off: who and when. Both or neither. */
  reviewedBy?: string;
  reviewedAt?: string;
}

type RawBook = { bookId: string; page: number; ar: string; en: string; def: string };
type RawDraft = { bookId: string; ar: string; en: string; def: string; reviewedBy: string | null; reviewedAt: string | null };

const BOOK_ENTRIES: GlossaryEntry[] = (science.entries as RawBook[]).map(e => ({
  bookId: e.bookId, ar: e.ar, en: e.en, definitionAr: e.def, source: 'book-glossary', page: e.page,
}));

const DRAFT_ENTRIES: GlossaryEntry[] = (chemDraft.entries as RawDraft[]).map(e => ({
  bookId: e.bookId, ar: e.ar, en: e.en, definitionAr: e.def, source: 'draft',
  ...(e.reviewedBy && e.reviewedAt ? { reviewedBy: e.reviewedBy, reviewedAt: e.reviewedAt } : {}),
}));

/** A draft counts as reviewed only with BOTH a name and a date (YYYY-MM-DD). */
export function isSignedOff(e: GlossaryEntry): boolean {
  return e.source === 'book-glossary' || (!!e.reviewedBy?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(e.reviewedAt?.trim() ?? ''));
}

/** Every definition a student may see. */
export function servedGlossary(): GlossaryEntry[] {
  return [...BOOK_ENTRIES, ...DRAFT_ENTRIES.filter(isSignedOff)];
}

/** All drafts, signed or not — for the teacher's review sheet only, never for a game. */
export function draftGlossary(): GlossaryEntry[] {
  return DRAFT_ENTRIES;
}

const HARAKAT = /[\u064B-\u0655\u0670\u0640]/g;

/** One spelling of a term: no harakat or tatweel, one alef (ٱ and hamza forms), ى≡ي, ة≡ه, single spaces. */
function spelled(term: string): string {
  return term
    .replace(HARAKAT, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words without their «ال», one spelling, space-padded: `includes(' ' + bare(term) + ' ')` finds a whole term in a text. */
export function bareWords(text: string): string {
  return ` ${spelled(text).replace(/(^| )ال(?=\S)/g, '$1')} `;
}

/**
 * What "the same term" means across the glossary and a lesson's keyword: `spelled`
 * and without a leading «ال». The books print the same word with different vowels
 * and the odd hamza between the two lists.
 */
export function glossaryKey(term: string): string {
  return spelled(term).replace(/^ال/, '');
}

const BY_BOOK = new Map<string, GlossaryEntry[]>();
/** Per book, an entry under its spelled term and under the term without «ال» (the first of either wins). */
const INDEX = new Map<string, Map<string, GlossaryEntry>>();
for (const e of servedGlossary()) {
  const list = BY_BOOK.get(e.bookId);
  if (list) list.push(e);
  else BY_BOOK.set(e.bookId, [e]);
  const idx = INDEX.get(e.bookId) ?? new Map<string, GlossaryEntry>();
  INDEX.set(e.bookId, idx);
  for (const k of [spelled(e.ar), glossaryKey(e.ar)]) if (k && !idx.has(k)) idx.set(k, e);
}

/** The served entries of one book. */
export function glossaryForBook(bookId: string): readonly GlossaryEntry[] {
  return BY_BOOK.get(bookId) ?? [];
}

/**
 * The served entry of this book for a term, or undefined. The exact spelling is
 * tried before the one without «ال», so «الالتحام» is not lost to «التحام».
 */
export function findGlossaryEntry(bookId: string, term: string): GlossaryEntry | undefined {
  const idx = INDEX.get(bookId);
  if (!idx) return undefined;
  const full = spelled(term);
  return (full ? idx.get(full) : undefined) ?? idx.get(glossaryKey(term));
}
