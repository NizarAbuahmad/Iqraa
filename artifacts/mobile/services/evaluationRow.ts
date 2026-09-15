/**
 * The two lines of context one «تقييماتي» row shows beneath its title.
 *
 * Pure, and split out of the screen, for the usual reason in this repo: there
 * are no screen tests, and both of these fail silently rather than loudly.
 * `bookLabel` given an id the catalog has retired would otherwise print the
 * raw id, which reads as corruption; `formatListDate` given a timestamp the
 * list endpoint did not send would otherwise print the literal string
 * "Invalid Date", which React Native renders perfectly happily.
 *
 * Both answer `null` for "nothing honest to say", and the screen omits the
 * line rather than showing a placeholder — an exam with no resolvable book is
 * still an exam, and a blank is truer than a guess.
 */
import { getBookById } from '@workspace/curriculum';

/** The book an exam was built from, or null when it cannot be resolved. */
export function bookLabel(bookId: string | undefined | null, lang: 'ar' | 'en'): string | null {
  if (!bookId) return null;
  const book = getBookById(bookId);
  if (!book) return null;
  return (lang === 'ar' ? book.titleAr : book.title) || null;
}

/**
 * When the exam was created, in the reader's calendar.
 *
 * Same locales the workspace list and the home feed already use ('ar-JO' /
 * 'en-GB'), so three lists of dated things do not render dates three ways.
 */
export function formatListDate(iso: string | undefined | null, lang: 'ar' | 'en'): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', opts);
  } catch {
    return null;
  }
}
