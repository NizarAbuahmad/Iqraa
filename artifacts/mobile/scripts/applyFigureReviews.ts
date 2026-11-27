/**
 * Writes a figure-note review export into the notes files.
 *
 *   cd artifacts/mobile
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types \
 *     scripts/applyFigureReviews.ts <reviews.json> [--dry-run]
 *
 * <reviews.json> is `{ "reviews": FigureReview[] }` (services/figureNoteReviews.ts).
 * Refuses the whole export, writing nothing, if any review is refused; prints
 * why and exits 1. Running it twice with the same export changes nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOTES_BOOKS, type NotesFile } from '../services/bookFigureNotes.ts';
import { applyFigureReviews, serializeNotesFile, type FigureReview } from '../services/figureNoteReviews.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const [input, ...flags] = process.argv.slice(2);
if (!input) {
  console.error('usage: applyFigureReviews.ts <reviews.json> [--dry-run]');
  process.exit(2);
}
const dryRun = flags.includes('--dry-run');

const raw = JSON.parse(readFileSync(input, 'utf8')) as { reviews?: FigureReview[] };
if (!Array.isArray(raw.reviews)) {
  console.error(`${input}: expected { "reviews": [...] }`);
  process.exit(2);
}

const files: NotesFile[] = [];
const figures = new Map<string, string[]>();
for (const book of NOTES_BOOKS) {
  const dir = path.join(ROOT, book.dir);
  files.push(JSON.parse(readFileSync(path.join(dir, 'notes.json'), 'utf8')) as NotesFile);
  const index = JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf8')) as { figures: { file: string }[] };
  figures.set(book.sourceId, index.figures.map(f => f.file));
}

const { files: out, changed, refused } = applyFigureReviews(files, figures, raw.reviews);
if (refused.length > 0) {
  console.error(`refused — nothing written:\n${refused.map(r => `  ${r}`).join('\n')}`);
  process.exit(1);
}
for (const [i, book] of NOTES_BOOKS.entries()) {
  const target = path.join(ROOT, book.dir, 'notes.json');
  const text = serializeNotesFile(out[i]!);
  if (text !== readFileSync(target, 'utf8') && !dryRun) writeFileSync(target, text);
}
const tally = (s: string) => out.reduce((n, f) => n + Object.values(f.notes).filter(e => e.status === s).length, 0);
console.log(`${raw.reviews.length} reviews, ${changed} entries changed${dryRun ? ' (dry run, nothing written)' : ''}`);
console.log(`now: ${tally('approved')} approved, ${tally('needs-fix')} need a fix, ${tally('draft')} draft, ${tally('skip')} skipped`);
