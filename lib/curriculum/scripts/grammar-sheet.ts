/**
 * Writes the teacher's grammar sheet — every sentence the Grade 1 grammar
 * activities can show — to docs/english-grammar-g1-sheet.md, and the same
 * sentences as a printable Arabic review form (tick boxes, notes, a sign-off
 * per unit) to docs/english-grammar-g1-review.html. Open the .html in a
 * browser and print it: A4 landscape, one unit per page.
 *
 *   pnpm --filter @workspace/curriculum run grammar-sheet
 *
 * A test fails when either committed file differs from the generator, so re-run
 * this after any change to src/englishGrammar.ts and commit the result.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderGrammarSheet } from '../src/englishGrammar.ts';
import { renderGrammarReviewHtml } from '../src/englishGrammarReview.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(HERE, '..', '..', '..', 'docs');
for (const [name, text] of [
  ['english-grammar-g1-sheet.md', renderGrammarSheet()],
  ['english-grammar-g1-review.html', renderGrammarReviewHtml()],
] as const) {
  const out = path.join(DOCS, name);
  writeFileSync(out, text);
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
