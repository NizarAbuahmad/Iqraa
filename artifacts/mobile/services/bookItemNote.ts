/**
 * The line a teacher reads above a question that came from the NCCD books:
 * where in the book it is, and — when the answer is not verified — how its key
 * was established.
 *
 * Kept free of React Native imports so it is unit-testable, and reading
 * `aiMetadata` defensively: it is a jsonb bag, absent on every question written
 * before book items existed, and nothing here may throw on one.
 */
export function bookItemNote(
  meta: Record<string, unknown> | null | undefined,
  lang: 'ar' | 'en',
  /**
   * The teacher changed the question. An edit keeps `aiMetadata`, so without
   * this the screen would go on saying a rewritten question came from the book.
   */
  edited = false,
): string | null {
  if (edited || !meta || meta['generator'] !== 'book') return null;
  const pick = (ar: string, en: string): string | null => {
    const v = meta[lang === 'ar' ? ar : en];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const citation = pick('bookCitationAr', 'bookCitationEn');
  if (!citation) return null;
  const label = pick('bookLabelAr', 'bookLabelEn');
  return label ? `${citation} · ${label}` : citation;
}
