/**
 * Where the figures cut from the NCCD student books are served: `iqraa-public`'s
 * anonymous-read origin on R2 (`docs/adding-a-book.md`).
 *
 * Here rather than in the app because two sides need the same value: the app
 * loads figures from it, and the API refuses any other host in a question a
 * student will see — a question body is stored as-is, so a figure URL is the
 * one way a teacher-made question could make students' phones load something
 * arbitrary.
 */
export const BOOK_FIGURE_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/figures';
