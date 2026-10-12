/**
 * Real items from the NCCD Grade 10 maths books — exercise-book questions and
 * the teacher guide's end-of-unit test — for the generators that build papers.
 *
 * Three kinds: `exercise` (exercise-book question, a short answer),
 * `unit-test-mcq` (end-of-unit multiple choice) and `unit-test` (an open,
 * short-answer question from the same end-of-unit test; it cites as the test,
 * not as the exercise book, and is drawn wherever a short answer is wanted).
 *
 * The data is `scripts/extract_book_items.py`'s output, committed, so there is
 * no schema and no migration. See docs/superpowers/specs/2026-10-12-book-items-design.md.
 *
 * **Trust is in `status`, and it is not a ranking.**
 *  - `verified`    the book's printed answer and SymPy agree.
 *  - `computed`    SymPy solved the stem; nothing in the book cross-checks it.
 *                  Served, labelled, and NEVER shown as verified — the stem was
 *                  read from a text layer that flattens exponents and splits
 *                  fractions, and no page image has been compared with it.
 *  - `book-key`    the book prints an answer the verifier cannot judge.
 *  - `quarantined` never in these files; it lives in `report.json`, with a reason.
 * `SERVED_STATUSES` is the one place that decides what a paper may draw.
 *
 * Joined by `lessonId`, never by title: a title does not identify a lesson.
 *
 * Not exported from `index.ts` on purpose — import `@workspace/curriculum/bookItems`.
 */
import exerciseS1 from './data/book-items/math-s1-exercise-book.json' with { type: 'json' };
import exerciseS2 from './data/book-items/math-s2-exercise-book.json' with { type: 'json' };
import guideS1 from './data/book-items/math-s1-teacher-guide.json' with { type: 'json' };

export type BookItemStatus = 'verified' | 'computed' | 'book-key' | 'quarantined';
export type BookItemKind = 'exercise' | 'unit-test-mcq' | 'unit-test';
export type BookTier = 'easy' | 'medium' | 'hard';

export interface BookItem {
  id: string;
  lessonId: string;
  source: {
    sourceId: string;
    /** 1-based page in that source's PDF. */
    page: number;
    /** The page number the book prints, for a citation. */
    bookPage: number;
    unit: number;
    number: number;
  };
  kind: BookItemKind;
  /** Our own clean Arabic instruction; the book's line is never reproduced. */
  instruction: string;
  /** The Latin maths, as printed (newline-separated for a system). */
  stem: string;
  /** Unit-test multiple choice only. */
  options?: string[];
  printedAnswer: string | null;
  computedAnswer: string;
  check: { topic: string; question: string; answer: string } | null;
  tier: BookTier;
  /** `position` = derived from the item's place in its lesson, not authored. */
  tierSource: 'position' | 'default';
  status: BookItemStatus;
  verificationSource: 'sympy+book' | 'sympy' | 'book' | 'none';
}

/** What a paper may draw. Narrow to `['verified']` here and nowhere else. */
export const SERVED_STATUSES: readonly BookItemStatus[] = ['verified', 'computed', 'book-key'];

const ALL: readonly BookItem[] = [exerciseS1, exerciseS2, guideS1].flatMap(
  f => (f as unknown as { items: BookItem[] }).items,
);

const BY_LESSON: ReadonlyMap<string, readonly BookItem[]> = (() => {
  const out = new Map<string, BookItem[]>();
  for (const item of ALL) {
    if (!SERVED_STATUSES.includes(item.status)) continue;
    out.set(item.lessonId, [...(out.get(item.lessonId) ?? []), item]);
  }
  return out;
})();

/** Every served item for a curriculum lesson (a `kbl-…` id). Empty when there are none. */
export function bookItemsForLesson(lessonId: string | null | undefined): readonly BookItem[] {
  return (lessonId && BY_LESSON.get(lessonId)) || [];
}

export interface TakeBookItem {
  lessonId: string | null | undefined;
  /** One kind, or several to draw from their union. Absent means any kind. */
  kind?: BookItemKind | readonly BookItemKind[];
  tier?: BookTier;
  /**
   * Draw from this list instead of the lesson's served items. For callers that
   * hold their own pool (tests, mostly); `lessonId` is then not consulted.
   */
  pool?: readonly BookItem[];
  /** Ids this paper has already spent; the taken id is added. Per request, never module state. */
  session: Set<string>;
  rng?: () => number;
}

/** One unspent item, preferring the tier, or null. */
export function takeBookItem({ lessonId, kind, tier, session, rng = Math.random, pool: given }: TakeBookItem): BookItem | null {
  const kinds = kind === undefined ? null : typeof kind === 'string' ? [kind] : kind;
  const pool = (given ?? bookItemsForLesson(lessonId)).filter(
    i => (!kinds || kinds.includes(i.kind)) && !session.has(i.id),
  );
  if (pool.length === 0) return null;
  const preferred = tier ? pool.filter(i => i.tier === tier) : [];
  const from = preferred.length > 0 ? preferred : pool;
  const pick = from[Math.min(from.length - 1, Math.floor(rng() * from.length))]!;
  session.add(pick.id);
  return pick;
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * A book stem as a student should read it. The stored text is the typing
 * notation the extractor and SymPy work in (`x^2`, ASCII `-`, `f (x)`), and
 * stays that way; this converts at display time only, to what the bank's own
 * questions print: `x²`, `−` (U+2212), `f(x)`. Nothing else changes.
 */
export function displayMath(text: string): string {
  return text
    .replace(/\^(\d+)/g, (_, digits: string) => digits.replace(/[0-9]/g, d => SUPERSCRIPT[Number(d)]!))
    .replace(/-/g, '\u2212')
    .replace(/\bf \(/g, 'f(');
}

const arabicDigits = (n: number) => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

/** «كتاب التمارين ص ٧٢، س ١١» — Arabic digits at display time only. */
export function bookCitation(item: BookItem, lang: 'ar' | 'en'): string {
  const { bookPage, number, unit } = item.source;
  // Both unit-test kinds cite the test; only `exercise` cites the exercise book.
  if (item.kind === 'unit-test-mcq' || item.kind === 'unit-test') {
    return lang === 'ar'
      ? `اختبار نهاية الوحدة ${arabicDigits(unit)}، س ${arabicDigits(number)}`
      : `Unit ${unit} test, Q${number}`;
  }
  return lang === 'ar'
    ? `كتاب التمارين ص ${arabicDigits(bookPage)}، س ${arabicDigits(number)}`
    : `Exercise book p. ${bookPage}, Q${number}`;
}

/** What the teacher is told about the key, or null when nothing needs saying (`verified`). */
export function bookStatusLabel(item: BookItem, lang: 'ar' | 'en'): string | null {
  if (item.status === 'computed') {
    return lang === 'ar' ? 'الحل محسوب من نص السؤال' : 'Answer computed from the question text';
  }
  if (item.status === 'book-key') {
    return lang === 'ar' ? 'من دليل المعلم' : 'From the teacher guide';
  }
  return null;
}
