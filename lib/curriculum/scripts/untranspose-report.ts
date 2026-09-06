/**
 * What the repair would do to every extraction on file, without writing any
 * of them.
 *
 * `extract-text.ts` repairs at extraction time, which means the effect on the
 * books already ingested is only visible by re-extracting them — a slow pass
 * over ~700MB of PDFs. This reads the extracted JSON instead and reports the
 * same numbers in a second, so the decision to re-extract can be made from
 * evidence rather than from faith.
 *
 * Run: node --experimental-strip-types scripts/untranspose-report.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairWithCounts } from './untranspose.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'src', 'data', 'extracted');

/** The unambiguous marker, the same one the audit counted. */
const MARKER = /(?:^|\s)ا[أإآا]ل/gu;
const ARABIC = /[؀-ۿ]{2,}/gu;

interface Row {
  id: string;
  tool: string;
  words: number;
  before: number;
  after: number;
  orphans: number;
  repairs: number;
}

const rows: Row[] = [];

for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  if (!Array.isArray(doc.text)) continue;

  const pages: string[] = doc.text.map((p: { text?: string }) => p.text ?? '');
  const { pages: fixed, marks, articles } = repairWithCounts(pages);
  const joinBefore = pages.join(' ');
  const joinAfter = fixed.join(' ');

  rows.push({
    id: file.replace(/\.json$/, ''),
    tool: String(doc.tool ?? '').includes('tesseract') ? 'ocr' : 'pdf-parse',
    words: (joinBefore.match(ARABIC) ?? []).length,
    before: (joinBefore.match(MARKER) ?? []).length,
    after: (joinAfter.match(MARKER) ?? []).length,
    orphans: marks,
    repairs: articles,
  });
}

rows.sort((a, b) => b.before - a.before);

const pdf = rows.filter(r => r.tool === 'pdf-parse');
const ocr = rows.filter(r => r.tool === 'ocr');
const sum = (xs: Row[], k: keyof Row): number => xs.reduce((n, r) => n + (r[k] as number), 0);

console.log('worst 15 by article marker:\n');
console.log('  article  after  detached-marks  words repaired  source');
for (const r of rows.slice(0, 15)) {
  console.log(
    `  ${String(r.before).padStart(7)}  ${String(r.after).padStart(5)}  ${String(r.orphans).padStart(14)}  ${String(r.repairs).padStart(14)}  ${r.id}`,
  );
}

console.log('\n--- totals ---');
for (const [label, set] of [['pdf-parse', pdf], ['ocr', ocr]] as const) {
  console.log(
    `${label.padEnd(10)} ${String(set.length).padStart(3)} docs | article ${sum(set, 'before')} -> ${sum(set, 'after')}` +
      ` | detached marks ${sum(set, 'orphans')} | words repaired ${sum(set, 'repairs')}`,
  );
}

const stillDirty = pdf.filter(r => r.after > 0);
console.log(`\npdf-parse docs with any marker left: ${stillDirty.length} of ${pdf.length}`);
if (stillDirty.length) {
  console.log('  ' + stillDirty.map(r => `${r.id}(${r.after})`).join(', '));
}
