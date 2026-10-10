/**
 * Which subjects the app presents as the national, Ministry-of-Education
 * textbook. Kept pure (no React Native) so the node test runner can load it.
 *
 * English is the subject here: every English book in the catalog — the
 * standard Grade 1–10 books and the four Grade 10 vocational tracks — is a
 * Ministry book, so the flag is by subject, not by book.
 */
const NATIONAL_BOOK_SUBJECTS: ReadonlySet<string> = new Set(['english']);

export function isNationalBookSubject(subjectId: string | undefined | null): boolean {
  return !!subjectId && NATIONAL_BOOK_SUBJECTS.has(subjectId);
}

/** The i18n key of the note to show for this subject, or null for none. */
export function nationalBookNoteKey(subjectId: string | undefined | null): 'nationalBookNote' | null {
  return isNationalBookSubject(subjectId) ? 'nationalBookNote' : null;
}
