/**
 * The grade / subject drill-down above the new-evaluation book list.
 *
 * A teacher with two grades still sees ~25 books, and the list is only ever
 * grouped by catalog order. These narrow it on top of whatever the teacher
 * scope already chose — they never widen it.
 *
 * Pure and catalog-free (`lookup` is injected) for the reason
 * `teacherCatalogFilter.ts` is: unit-testable without loading the curriculum.
 * An empty id means "all".
 */
export interface BookFacet {
  gradeId: string;
  subjectId: string;
}

export type BookLookup = (bookId: string) => BookFacet | undefined;

export interface BookFilter {
  gradeId: string;
  subjectId: string;
}

export const NO_BOOK_FILTER: BookFilter = { gradeId: '', subjectId: '' };

/** The distinct grade or subject ids on offer, in first-seen (catalog) order. */
export function facetIds(
  books: { bookId: string }[],
  lookup: BookLookup,
  facet: keyof BookFacet,
  within: Partial<BookFilter> = {},
): string[] {
  const seen = new Set<string>();
  for (const b of books) {
    const f = lookup(b.bookId);
    if (!f) continue;
    if (within.gradeId && f.gradeId !== within.gradeId) continue;
    seen.add(f[facet]);
  }
  return [...seen];
}

/**
 * Drops a stale pick. The subject list is rebuilt whenever the grade changes,
 * so the subject chosen for the previous grade may not exist in the new one —
 * derived on render, like `resolveSelectedId`, so no frame has them disagree.
 */
export function resolveBookFilter(
  books: { bookId: string }[],
  lookup: BookLookup,
  filter: BookFilter,
): BookFilter {
  const gradeId = facetIds(books, lookup, 'gradeId').includes(filter.gradeId) ? filter.gradeId : '';
  const subjectId = facetIds(books, lookup, 'subjectId', { gradeId }).includes(filter.subjectId)
    ? filter.subjectId
    : '';
  return { gradeId, subjectId };
}

/**
 * A book the catalog doesn't know stays listed only while nothing is filtered:
 * it can't be shown to belong to the chosen grade, and hiding it with no
 * filter on would drop a row the unfiltered list had.
 */
export function applyBookFilter<T extends { bookId: string }>(
  books: T[],
  lookup: BookLookup,
  filter: BookFilter,
): T[] {
  if (!filter.gradeId && !filter.subjectId) return books;
  return books.filter(b => {
    const f = lookup(b.bookId);
    if (!f) return false;
    return (!filter.gradeId || f.gradeId === filter.gradeId) && (!filter.subjectId || f.subjectId === filter.subjectId);
  });
}
