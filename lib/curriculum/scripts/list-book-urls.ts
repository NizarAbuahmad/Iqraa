/**
 * Print the student-book download links the catalog already knows, as JSON.
 *
 * `scripts/scan_book_qr.py --fetch` reads this instead of scraping `catalog.ts`
 * with a regex: the links live on `Book.pdfUrl` ("official NCCD student-book
 * PDF"), and reading them through the real `BOOKS` array means a book added to
 * the catalog is picked up with no second list to keep in step.
 *
 *   pnpm --filter @workspace/curriculum run list-book-urls
 *
 * Stdout is JSON only — nothing else is written there, so a caller can parse
 * it. The teacher-guide and activity PDFs (`guidePdfUrl`, `activityPdfUrl`) are
 * left out on purpose: they print no student-facing codes.
 */
import { BOOKS } from '../src/catalog.ts';

const rows = BOOKS.filter(book => Boolean(book.pdfUrl)).map(book => ({
  bookId: book.id,
  gradeId: book.gradeId,
  subjectId: book.subjectId,
  semester: book.semester ?? null,
  language: book.language,
  titleAr: book.titleAr,
  pdfUrl: book.pdfUrl,
}));

process.stdout.write(`${JSON.stringify(rows)}\n`);
