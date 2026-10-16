/**
 * Writes the teacher's grammar sheet — every sentence the Grade 1 grammar
 * activities can show — to docs/english-grammar-g1-sheet.md.
 *
 *   pnpm --filter @workspace/curriculum run grammar-sheet
 *
 * A test fails when the committed sheet differs from the generator, so re-run
 * this after any change to src/englishGrammar.ts and commit the result.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderGrammarSheet } from '../src/englishGrammar.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(HERE, '..', '..', '..', 'docs', 'english-grammar-g1-sheet.md');
writeFileSync(out, renderGrammarSheet());
console.log(`wrote ${path.relative(process.cwd(), out)}`);
