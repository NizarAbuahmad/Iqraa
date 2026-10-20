/**
 * Writes the teacher's grammar sheet — every sentence the Grade 1 grammar
 * activities can show — to docs/english-grammar-g1-sheet.md, and the same
 * sentences as a printable Arabic review form (tick boxes, notes, a sign-off
 * per unit) to docs/english-grammar-g1-review.html, and the reading
 * activities' words and first letters as the same kind of form to
 * docs/english-reading-g1-review.html. Open an .html in a browser and print
 * it: A4 landscape, one unit per page.
 *
 *   pnpm --filter @workspace/curriculum run grammar-sheet
 *
 * A test fails when a committed file differs from the generator, so re-run
 * this after any change to src/englishGrammar.ts or src/englishReading.ts and
 * commit the result.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderGrammarSheet } from '../src/englishGrammar.ts';
import { renderGrammarReviewHtml } from '../src/englishGrammarReview.ts';
import { renderReadingReviewHtml } from '../src/englishReadingReview.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(HERE, '..', '..', '..', 'docs');
for (const [name, text] of [
  ['english-grammar-g1-sheet.md', renderGrammarSheet()],
  ['english-grammar-g1-review.html', renderGrammarReviewHtml()],
  ['english-reading-g1-review.html', renderReadingReviewHtml()],
] as const) {
  const out = path.join(DOCS, name);
  writeFileSync(out, text);
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
