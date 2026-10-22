/**
 * Writes the teacher's grammar sheet — every sentence the grammar activities
 * can show — to docs/english-grammar-g{N}-sheet.md, and the same sentences as a
 * printable Arabic review form (tick boxes, notes, a sign-off per unit) to
 * docs/english-grammar-g{N}-review.html, for Grades 1 to 4, and the Grade 1
 * reading activities' words and first letters as the same kind of form to
 * docs/english-reading-g1-review.html, and Grade 2's (words, first letters and the
 * Read the sentence pool) to docs/english-reading-g2-review.html. Grade 3's and Grade 4's go to
 * docs/english-reading-g3-review.html and docs/english-reading-g4-review.html. Open an .html in a browser and print
 * it: A4 landscape, one unit per page.
 *
 *   pnpm --filter @workspace/curriculum run grammar-sheet
 *
 * A test fails when a committed file differs from the generator, so re-run
 * this after any change to src/englishGrammar.ts, src/englishGrammarG2.ts, src/englishGrammarG3.ts, src/englishGrammarG4.ts or
 * src/englishReading.ts and commit the result.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderGrammarSheet } from '../src/englishGrammar.ts';
import { renderGrammarReviewHtml } from '../src/englishGrammarReview.ts';
import { renderReadingReviewHtml } from '../src/englishReadingReview.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(HERE, '..', '..', '..', 'docs');
const files: (readonly [string, string])[] = [];
for (const grade of [1, 2, 3, 4]) {
  files.push([`english-grammar-g${grade}-sheet.md`, renderGrammarSheet(grade)]);
  files.push([`english-grammar-g${grade}-review.html`, renderGrammarReviewHtml(grade)]);
}
files.push(['english-reading-g1-review.html', renderReadingReviewHtml(1)]);
files.push(['english-reading-g2-review.html', renderReadingReviewHtml(2)]);
files.push(['english-reading-g3-review.html', renderReadingReviewHtml(3)]);
files.push(['english-reading-g4-review.html', renderReadingReviewHtml(4)]);
for (const [name, text] of files) {
  const out = path.join(DOCS, name);
  writeFileSync(out, text);
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
