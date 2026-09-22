/**
 * Generates `artifacts/mobile/services/bookFigureAssets.ts`.
 *
 * It used to emit one literal `require()` per figure, because Metro resolves
 * assets from static string literals and cannot follow a computed path. That
 * worked and cost 250 MB: every reachable PNG went into the binary, and the
 * store build reached 267 MB and was killed on the first launches. The figures
 * are served from R2 now, so this emits only the *keys* — which figures exist
 * — and `lib/curriculum/scripts/upload-figures-r2.ts` puts exactly those keys in
 * the bucket.
 *
 * Only figures a lesson actually asks for are emitted. Chemistry's four are
 * skipped along with every unmapped maths figure, because a picture nothing
 * can reach is dead weight in the bucket too — 63 files on disk, 54 reachable.
 *
 * Run:  node scripts/gen_book_figure_assets.mjs
 * Check: artifacts/mobile/services/__tests__/bookFigureAssets.test.ts fails if
 * this file is stale, so a newly extracted figure cannot be silently missed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts/mobile/services/bookFigureAssets.ts');

const read = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const map = read('knowledge-base/figure-lesson-map.json');
const mapped = new Set(
  map.entries.filter(e => e.kbLessonId).map(e => `${e.sourceId}|${e.unit}|${e.lesson}`),
);

const indexes = [
  'knowledge-base/grade-10-math/figures/math-s1-student-book/index.json',
  'knowledge-base/grade-10-math/figures/math-s2-student-book/index.json',
  'knowledge-base/grade-10-chemistry/figures/chem-s1-student-book/index.json',
  'knowledge-base/grade-10-chemistry/figures/chem-s2-student-book/index.json',
  'knowledge-base/grade-10-finlit/figures/finlit-s1-student-book/index.json',
  'knowledge-base/grade-9-math/figures/g9-math-s1-student-book/index.json',
  'knowledge-base/grade-9-math/figures/g9-math-s2-student-book/index.json',
  'knowledge-base/grade-10-physics/figures/phys-s1-student-book/index.json',
  'knowledge-base/grade-10-physics/figures/phys-s2-student-book/index.json',
  'knowledge-base/grade-10-biology/figures/bio-s1-student-book/index.json',
  'knowledge-base/grade-10-biology/figures/bio-s2-student-book/index.json',
  'knowledge-base/grade-10-earth-science/figures/earth-s1-student-book/index.json',
  'knowledge-base/grade-10-earth-science/figures/earth-s2-student-book/index.json',
  'knowledge-base/grade-10-english/figures/eng-s1-student-book/index.json',
  'knowledge-base/grade-10-english/figures/eng-s2-student-book/index.json',
  'knowledge-base/grade-9-physics/figures/g9-physics-s1-student-book/index.json',
  'knowledge-base/grade-9-physics/figures/g9-physics-s2-student-book/index.json',
  'knowledge-base/grade-9-chemistry/figures/g9-chemistry-s1-student-book/index.json',
  'knowledge-base/grade-9-chemistry/figures/g9-chemistry-s2-student-book/index.json',
  'knowledge-base/grade-9-biology/figures/g9-biology-s1-student-book/index.json',
  'knowledge-base/grade-9-biology/figures/g9-biology-s2-student-book/index.json',
  'knowledge-base/grade-9-earth-science/figures/g9-earth-science-s1-student-book/index.json',
  'knowledge-base/grade-9-earth-science/figures/g9-earth-science-s2-student-book/index.json',
  'knowledge-base/grade-10-history/figures/history-s1-student-book/index.json',
  'knowledge-base/grade-10-geography/figures/geo-s1-student-book/index.json',
  'knowledge-base/grade-9-history/figures/g9-history-s1-student-book/index.json',
  'knowledge-base/grade-9-geography/figures/g9-geography-s1-student-book/index.json',
  'knowledge-base/grade-10-history/figures/history-s2-student-book/index.json',
  'knowledge-base/grade-10-geography/figures/geo-s2-student-book/index.json',
  'knowledge-base/grade-9-geography/figures/g9-geography-s2-student-book/index.json',
  'knowledge-base/grade-8-science/figures/g8-science-s1-student-book/index.json',
  'knowledge-base/grade-8-math/figures/g8-math-s1-student-book/index.json',
  'knowledge-base/grade-8-math/figures/g8-math-s2-student-book/index.json',
  'knowledge-base/grade-9-english/figures/g9-english-s1-student-book/index.json',
  'knowledge-base/grade-9-english/figures/g9-english-s2-student-book/index.json',
  'knowledge-base/grade-8-english/figures/g8-english-s1-student-book/index.json',
  'knowledge-base/grade-8-english/figures/g8-english-s2-student-book/index.json',
  'knowledge-base/grade-7-english/figures/g7-english-s1-student-book/index.json',
  'knowledge-base/grade-7-english/figures/g7-english-s2-student-book/index.json',
  'knowledge-base/grade-6-science/figures/g6-science-s1-student-book/index.json',
  'knowledge-base/grade-6-science/figures/g6-science-s2-student-book/index.json',
  'knowledge-base/grade-8-finlit/figures/g8-finlit-s1-student-book/index.json',
  'knowledge-base/grade-8-social/figures/g8-social-s1-student-book/index.json',
  'knowledge-base/grade-8-social/figures/g8-social-s2-student-book/index.json',
  'knowledge-base/grade-8-vocational/figures/g8-voc-s1-student-book/index.json',
  'knowledge-base/grade-3-science/figures/g3-science-s1-student-book/index.json',
  'knowledge-base/grade-3-science/figures/g3-science-s2-student-book/index.json',
  'knowledge-base/grade-3-social/figures/g3-social-s2-student-book/index.json',
  'knowledge-base/grade-4-art/figures/g4-arts-s1-student-book/index.json',
  'knowledge-base/grade-4-science/figures/g4-science-s1-student-book/index.json',
  'knowledge-base/grade-4-science/figures/g4-science-s2-student-book/index.json',
  'knowledge-base/grade-4-social/figures/g4-social-s1-student-book/index.json',
  'knowledge-base/grade-4-social/figures/g4-social-s2-student-book/index.json',
  'knowledge-base/grade-4-vocational/figures/g4-voc-s1-student-book/index.json',
  'knowledge-base/grade-5-science/figures/g5-science-s1-student-book/index.json',
  'knowledge-base/grade-5-science/figures/g5-science-s2-student-book/index.json',
  'knowledge-base/grade-8-vocational/figures/g8-voc-s2-student-book/index.json',
  'knowledge-base/grade-8-science/figures/g8-science-s2-student-book/index.json',
  'knowledge-base/grade-6-vocational/figures/g6-voc-s1-student-book/index.json',
  'knowledge-base/grade-7-vocational/figures/g7-voc-s1-student-book/index.json',
  'knowledge-base/grade-7-finlit/figures/g7-finlit-s1-student-book/index.json',
  'knowledge-base/grade-7-finlit/figures/g7-finlit-s2-student-book/index.json',
  'knowledge-base/grade-7-science/figures/g7-science-s1-student-book/index.json',
  'knowledge-base/grade-7-science/figures/g7-science-s2-student-book/index.json',
  'knowledge-base/grade-7-social/figures/g7-social-s1-student-book/index.json',
  'knowledge-base/grade-7-social/figures/g7-social-s2-student-book/index.json',
];

const rows = [];
for (const rel of indexes) {
  const dir = path.dirname(rel);
  for (const f of read(rel).figures) {
    if (!mapped.has(`${f.sourceId}|${f.unit}|${f.lesson}`)) continue;
    // Deleting a bad crop is the documented review step, and the index still
    // lists it — the extractor writes the index in the same pass that writes
    // the PNGs, so it cannot know what a human removed afterwards. Emitting a
    // `require()` for a file that is gone breaks the bundle, which made "look
    // at the contact sheet and delete the bad ones" advice that did not work.
    if (!existsSync(path.join(ROOT, dir, f.file))) continue;
    rows.push({ key: `${f.sourceId}/${f.file}` });
  }
}
rows.sort((a, b) => a.key.localeCompare(b.key));

const body = rows.map(r => `  '${r.key}',`).join('\n');

writeFileSync(OUT, `/**
 * GENERATED by scripts/gen_book_figure_assets.mjs — do not edit by hand.
 *
 * The \`sourceId/file\` key of every book figure a lesson can reach. Keys only:
 * the PNGs are served from R2 (see \`bookFigureUri\`), not bundled, so nothing
 * here is a \`require()\` and none of these files enter the binary.
 * Regenerate after extracting figures or editing figure-lesson-map.json.
 */

/**
 * Why a generated list at all, when the URL is derivable from the figure.
 *
 * \`bookFigureUri\` must be able to answer "no such figure" without a network
 * round trip — a figure extracted after the last upload would otherwise render
 * as a broken image on a slide instead of being dropped. This list is what it
 * checks against, and \`upload-figures-r2.ts\` uploads exactly these
 * keys, so the two cannot disagree about what exists.
 */
export const BOOK_FIGURE_KEYS: ReadonlySet<string> = new Set([
${body}
]);

/** How many figures the app can reach. Asserted by the drift test. */
export const BOOK_FIGURE_COUNT = ${rows.length};
`);

console.log(`wrote ${rows.length} figures → ${path.relative(ROOT, OUT)}`);
