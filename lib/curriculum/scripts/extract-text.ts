/**
 * Pull page-level text out of the source PDFs.
 *
 * This is the first thing in the project that turns a bank entry from a title
 * into content. Until now `status: 'ingested'` meant "a human read this and
 * typed some objectives out of it"; the objectives in
 * `iqra_curriculum_g10_*.json` were transcribed **by eye from page renders**,
 * because the received wisdom was that these NCCD PDFs do not yield usable
 * Arabic text.
 *
 * That turns out to be half true, and the half that is false is the useful
 * half. `pdf-parse` pulls 150 pages and ~223k characters of readable Arabic
 * prose out of the math S1 student book. What is genuinely broken is *string
 * matching* against it, for two reasons:
 *
 *   - the lam-alef ligature decomposes, so «الاقتران» arrives as «االقتران»
 *   - tashkeel is interleaved, so «أتعلَّم» never equals «أتعلم»
 *
 * Both are search problems, not reading problems. A model reads this text
 * fine. So this script stores the text and stops there — no structure parsing,
 * no regex hunt for lesson boundaries. Every previous attempt to infer
 * structure from these books by pattern (see `extract_book_figures.py`, and
 * the RTL running-header traps recorded in STATUS.md) produced confidently
 * wrong output. Retrieval scopes by the bank's unit tags, which already work.
 *
 * **Normalized text is deliberately not stored.** It is derivable from the
 * raw, and a committed derived copy is a second thing that can drift — the
 * exact failure the two source catalogs were merged to end. Callers normalize
 * on load.
 *
 * Run: pnpm --filter @workspace/curriculum run extract-text [--force]
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';
import { G10_SOURCES } from '../src/sources.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const outDir = path.resolve(here, '../src/data/extracted');

/**
 * Which source each local file is, stated rather than inferred.
 *
 * Hand-authored for the same reason `g10_sources.json` is: half these
 * filenames carry a machine-appended timestamp and one reads
 * "mather exccersie book". A parser clever enough for that is a parser nobody
 * could trust.
 *
 * Byte counts are checked against the manifest at run time and a mismatch is
 * recorded, not silently accepted — see the note on `math-s1-student-book`.
 */
const LOCAL_FILES: Record<string, string> = {
  'math-s1-student-book': 'attached_assets/10th_grade,_math,_1st_semester_1785071530816.pdf',
  'math-s2-student-book': 'attached_assets/10th_grade,_math,_2nd_semester_1785147978008.pdf',
  'chem-s1-student-book': 'attached_assets/10th_grade,_alchamy1st_semester_1785071530814.pdf',
  'math-s1-exercise-book': 'attached_assets/2026_MT10_WB1__10th_grade,_math_excersice_book,_semster_one_1785147998882.pdf',
  'math-s2-exercise-book': 'attached_assets/MA_10_WB2_6_11_2025-mather_exccersie_book,_semster_2_1785147998882.pdf',
  'math-s2-teacher-guide': 'attached_assets/Book10_2_Proof3_WEB-teacher_guiede,_10th_grade,_semster_two_1785147998881.pdf',
  // math-s1-teacher-guide is a Git-LFS pointer in this checkout (58 MB
  // unpulled). It is the richest single source — it supplied every math S1
  // objective — so it is named here to be picked up automatically once
  // `git lfs pull` has run, rather than quietly omitted.
  'math-s1-teacher-guide': 'attached_assets/TE010_Book-teacher_guiede,_10th_grade,_semster_one_1785147998881.pdf',
};

/** A Git-LFS pointer is a ~130-byte text file, not the document it stands for. */
function isLfsPointer(buf: Buffer): boolean {
  return buf.length < 1024 && buf.subarray(0, 40).toString('utf8').startsWith('version https://git-lfs');
}

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface ExtractedDocument {
  sourceId: string;
  /** Path actually read, relative to the repo root. */
  localPath: string;
  /** Bytes of the file actually read. */
  bytes: number;
  sha256: string;
  /**
   * Set when the file read is not byte-identical to the manifest entry — the
   * same book from a different export. Records it rather than assuming the two
   * are interchangeable, which is the mistake that put two copies of each
   * chemistry textbook in front of teachers.
   */
  bytesDifferFromManifest?: { manifest: number; local: number };
  tool: string;
  extractedAt: string;
  pages: number;
  chars: number;
  text: ExtractedPage[];
}

async function extractOne(sourceId: string, rel: string): Promise<ExtractedDocument | string> {
  const abs = path.join(repoRoot, rel);
  if (!existsSync(abs)) return `missing on disk: ${rel}`;

  const buf = readFileSync(abs);
  if (isLfsPointer(buf)) return `Git-LFS pointer, run \`git lfs pull\`: ${rel}`;

  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    const pages: ExtractedPage[] = (result.pages ?? []).map((p, i) => ({
      // `num` is pdf-parse's own 1-based page number. Taken from the library
      // rather than from the array index so a parser that ever skips a page
      // reports the gap instead of silently renumbering what follows.
      page: typeof p.num === 'number' ? p.num : i + 1,
      text: (p.text ?? '').trim(),
    }));
    // A PDF that yields no page array but does yield text is still worth
    // keeping — better one page-less blob than nothing.
    if (!pages.length && result.text) {
      pages.push({ page: 1, text: result.text.trim() });
    }
    if (!pages.some(p => p.text.length > 0)) {
      return `no text layer — needs OCR, which this project does not have: ${rel}`;
    }

    const manifest = G10_SOURCES.find(s => s.id === sourceId);
    const doc: ExtractedDocument = {
      sourceId,
      localPath: rel,
      bytes: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
      tool: 'pdf-parse@2',
      extractedAt: new Date().toISOString().slice(0, 10),
      pages: pages.length,
      chars: pages.reduce((n, p) => n + p.text.length, 0),
      text: pages,
    };
    if (manifest && manifest.bytes !== buf.length) {
      doc.bytesDifferFromManifest = { manifest: manifest.bytes, local: buf.length };
    }
    return doc;
  } finally {
    await parser.destroy();
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  mkdirSync(outDir, { recursive: true });

  const done: ExtractedDocument[] = [];
  const skipped: Array<{ id: string; why: string }> = [];

  for (const [sourceId, rel] of Object.entries(LOCAL_FILES)) {
    const out = path.join(outDir, `${sourceId}.json`);
    if (existsSync(out) && !force) {
      console.log(`· ${sourceId} — already extracted (use --force to redo)`);
      continue;
    }
    const result = await extractOne(sourceId, rel);
    if (typeof result === 'string') {
      skipped.push({ id: sourceId, why: result });
      console.log(`✗ ${sourceId} — ${result}`);
      continue;
    }
    writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`, 'utf8');
    done.push(result);
    const warn = result.bytesDifferFromManifest ? '  ⚠ bytes differ from manifest' : '';
    console.log(`✓ ${sourceId} — ${result.pages} pages, ${result.chars} chars${warn}`);
  }

  console.log(`\n${done.length} extracted, ${skipped.length} skipped.`);
  if (skipped.length) {
    console.log('\nSkipped:');
    for (const s of skipped) console.log(`  ${s.id}: ${s.why}`);
  }
  console.log(
    '\nNext: set `status: "ingested"` and the `extraction` block on these entries'
      + ' in lib/curriculum/src/data/g10_sources.json.',
  );
}

await main();
