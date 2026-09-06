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
 * Run: pnpm --filter @workspace/curriculum run extract-text [--force] [--ocr] [<sourceId> ...]
 * Positional sourceIds restrict the run to just those — useful when only a
 * handful of the many pending sources need a (slow) OCR pass and the rest
 * should wait.
 *
 * `--ocr` skips the pdf-parse attempt and rasterizes straight away. The gates
 * decide *automatic* rejection, and their thresholds are set where the
 * evidence is unambiguous; a file can still be poor without tripping one. The
 * two Islamic teacher guides sit at ~42% word transposition — under
 * `WORD_TRANSPOSITION_LIMIT`, readable, and genuinely worse than every file
 * this project treats as quotable. That is a judgement call, so it is made
 * explicitly on the command line and recorded on the manifest entry, rather
 * than by moving a threshold until it catches what someone wanted caught.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';
import { G10_SOURCES } from '../src/sources.ts';
import { downloadFromR2, isLfsPointer, isR2Configured } from './r2.ts';
import { LOCAL_FILES } from './localSources.ts';
import { rejectReason } from './textQuality.ts';
import { ocrPdf } from './ocr.ts';
import { loadEnvFile } from '../../../scripts/load-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
loadEnvFile(path.join(repoRoot, '.env'));
const outDir = path.resolve(here, '../src/data/extracted');


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

/**
 * When a source isn't usably on disk — missing entirely, or present only as
 * a Git-LFS pointer (a ~130-byte stub `existsSync` sees as "there") — try
 * pulling it from R2 before giving up. This is the replacement for the Drive
 * fetch path described in r2.ts's header. The R2 key convention is
 * `${sourceId}.pdf`, chosen deliberately over the messy original filenames
 * in `LOCAL_FILES` (several carry a machine-appended timestamp) so
 * uploading a new source to the bucket is a simple, memorable step: name
 * the file after its sourceId.
 */
async function ensureLocal(sourceId: string, abs: string): Promise<string | null> {
  const onDisk = existsSync(abs) && !isLfsPointer(readFileSync(abs));
  if (onDisk) return null;

  const problem = existsSync(abs)
    ? `Git-LFS pointer, run \`git lfs pull\`: ${path.relative(repoRoot, abs)}`
    : `missing on disk: ${path.relative(repoRoot, abs)}`;
  if (!isR2Configured()) return problem;

  const bytes = await downloadFromR2(`${sourceId}.pdf`);
  if (!bytes) return `${problem} — and not found in R2 as ${sourceId}.pdf`;

  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
  console.log(`  ↓ ${sourceId} — fetched from R2 (${bytes.length} bytes)`);
  return null;
}

async function parseWithPdfParse(buf: Buffer): Promise<{ pages: ExtractedPage[]; reason: string | null }> {
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
    return { pages, reason: rejectReason(pages.map(p => p.text).join('')) };
  } finally {
    await parser.destroy();
  }
}

/**
 * Rasterize-and-read fallback for a PDF whose embedded text failed one of
 * the gates above. All of them are failures of the PDF's own embedded text
 * — a missing text layer, a broken font cmap, unshaped presentation forms, a
 * transposed definite article — none of which exist in a rendered page
 * image, so OCR output is checked against the same `rejectReason` gate
 * rather than assumed clean.
 */
async function tryOcr(abs: string): Promise<{ pages: ExtractedPage[]; reason: string | null } | null> {
  const ocred = await ocrPdf(abs);
  if (!ocred) return null;
  const pages: ExtractedPage[] = ocred.map(p => ({ page: p.page, text: p.text.trim() }));
  return { pages, reason: rejectReason(pages.map(p => p.text).join('')) };
}

async function extractOne(
  sourceId: string,
  rel: string,
  forceOcr = false,
): Promise<ExtractedDocument | string> {
  const abs = path.join(repoRoot, rel);
  const fetchError = await ensureLocal(sourceId, abs);
  if (fetchError) return fetchError;

  const buf = readFileSync(abs);
  if (isLfsPointer(buf)) return `Git-LFS pointer, run \`git lfs pull\`: ${rel}`;

  if (forceOcr) {
    const ocrResult = await tryOcr(abs);
    if (!ocrResult) {
      return `--ocr requested but OCR is unavailable — see lib/curriculum/scripts/ocr.ts. ${rel}`;
    }
    if (ocrResult.reason) {
      // Held to the same gates as any other text: a forced OCR pass that comes
      // back garbage is still garbage, and must not overwrite what is on disk.
      return `--ocr requested, and the OCR output was rejected: ${ocrResult.reason}. ${rel}`;
    }
    return buildDoc(sourceId, rel, buf, ocrResult.pages, 'tesseract-ocr (--ocr requested)');
  }

  let { pages, reason } = await parseWithPdfParse(buf);
  let tool = 'pdf-parse@2';

  if (reason) {
    const pdfParseReason = reason;
    const ocrResult = await tryOcr(abs);
    if (ocrResult && !ocrResult.reason) {
      ({ pages, reason } = ocrResult);
      tool = `tesseract-ocr (pdf-parse rejected: ${pdfParseReason})`;
    } else {
      const ocrNote = ocrResult
        ? ` OCR fallback also rejected: ${ocrResult.reason}.`
        : ' OCR unavailable or produced nothing — see lib/curriculum/scripts/ocr.ts.';
      return `${pdfParseReason} — not usable:${ocrNote} ${rel}`;
    }
  }

  return buildDoc(sourceId, rel, buf, pages, tool);
}

function buildDoc(
  sourceId: string,
  rel: string,
  buf: Buffer,
  pages: ExtractedPage[],
  tool: string,
): ExtractedDocument {
  const manifest = G10_SOURCES.find(s => s.id === sourceId);
  const doc: ExtractedDocument = {
    sourceId,
    localPath: rel,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    tool,
    extractedAt: new Date().toISOString().slice(0, 10),
    pages: pages.length,
    chars: pages.reduce((n, p) => n + p.text.length, 0),
    text: pages,
  };
  if (manifest && manifest.bytes !== buf.length) {
    doc.bytesDifferFromManifest = { manifest: manifest.bytes, local: buf.length };
  }
  return doc;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(a => a !== '--force' && a !== '--ocr');
  const force = process.argv.includes('--force');
  // Rasterizing is slow and overwrites a clean extraction with a lesser one if
  // pointed at the wrong file, so it only ever applies to sources named
  // explicitly — never to a whole-corpus run.
  const forceOcr = process.argv.includes('--ocr');
  const only = args.length ? new Set(args) : null;
  if (forceOcr && !only) {
    console.error('--ocr requires explicit sourceIds; refusing to OCR the whole corpus.');
    process.exitCode = 1;
    return;
  }
  mkdirSync(outDir, { recursive: true });

  const done: ExtractedDocument[] = [];
  const skipped: Array<{ id: string; why: string }> = [];

  for (const [sourceId, rel] of Object.entries(LOCAL_FILES)) {
    if (only && !only.has(sourceId)) continue;
    const out = path.join(outDir, `${sourceId}.json`);
    if (existsSync(out) && !force) {
      console.log(`· ${sourceId} — already extracted (use --force to redo)`);
      continue;
    }
    const result = await extractOne(sourceId, rel, forceOcr);
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
