/**
 * Writes `src/data/quran_corner.json` and `sources/quran-ws/VERIFY.md`, or with
 * `--check` only verifies the committed file is what the pinned package and the
 * catalogs produce. Run after adding or retitling an Islamic Education lesson,
 * or after bumping `@quran.ws/text`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { assertFullHafs, buildCorner, reviewSheet } from './quranCornerBuild.ts';
import { loadBuildInput } from './quranCornerSource.ts';

const OUT = new URL('../src/data/quran_corner.json', import.meta.url);
const SHEET_DIR = new URL('../sources/quran-ws/', import.meta.url);
const SHEET = new URL('VERIFY.md', SHEET_DIR);

const input = await loadBuildInput();
assertFullHafs(input.source);
const corner = buildCorner(input);
const json = JSON.stringify(corner, null, 1) + '\n';

if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== json) {
    console.error('quran_corner.json is out of date. Run: pnpm --filter @workspace/curriculum run build-quran-corner');
    process.exit(1);
  }
  console.log('quran_corner.json is up to date');
} else {
  writeFileSync(OUT, json);
  mkdirSync(SHEET_DIR, { recursive: true });
  writeFileSync(SHEET, reviewSheet(corner));
  const ayahs = corner.surahs.reduce((n, s) => n + s.ayahs.length, 0);
  console.log(`wrote ${corner.surahs.length} surahs, ${ayahs} ayahs`);
}
