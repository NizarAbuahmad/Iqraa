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
import { downloadFromR2, isR2Configured } from './r2.ts';
import { LOCAL_FILES } from './localSources.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const outDir = path.resolve(here, '../src/data/extracted');

/** A Git-LFS pointer is a ~130-byte text file, not the document it stands for. */
function isLfsPointer(buf: Buffer): boolean {
  return buf.length < 1024 && buf.subarray(0, 40).toString('utf8').startsWith('version https://git-lfs');
}

const CONTROL_CHAR_RE = /[\x00-\x08\x0e-\x1f]/g;
const ARABIC_PRESENTATION_FORMS_RE = /[ﭐ-﷿ﹰ-﻿]/g;
const BASIC_ARABIC_RE = /[؀-ۿ]/g;

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
 * When a source isn't already on disk, try pulling it from R2 before giving
 * up — this is the replacement for the Drive fetch path described in r2.ts's
 * header. The R2 key convention is `${sourceId}.pdf`, chosen deliberately
 * over the messy original filenames in `LOCAL_FILES` (several carry a
 * machine-appended timestamp) so uploading a new source to the bucket is a
 * simple, memorable step: name the file after its sourceId.
 */
async function ensureLocal(sourceId: string, abs: string): Promise<string | null> {
  if (existsSync(abs)) return null;
  if (!isR2Configured()) return `missing on disk: ${path.relative(repoRoot, abs)}`;

  const bytes = await downloadFromR2(`${sourceId}.pdf`);
  if (!bytes) return `missing on disk and not found in R2 as ${sourceId}.pdf: ${path.relative(repoRoot, abs)}`;

  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
  console.log(`  ↓ ${sourceId} — fetched from R2 (${bytes.length} bytes)`);
  return null;
}

async function extractOne(sourceId: string, rel: string): Promise<ExtractedDocument | string> {
  const abs = path.join(repoRoot, rel);
  const fetchError = await ensureLocal(sourceId, abs);
  if (fetchError) return fetchError;

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

    const allText = pages.map(p => p.text).join('');
    // pdf-parse decoding a PDF's embedded font against the wrong cmap does not
    // throw — it returns text, just not text. Found on two real files: 28-37%
    // of the "extracted" characters were C0 control codes (\x00-\x1F), which
    // essentially never appear in real prose. A silent pass here would have
    // shipped noise into a teacher's prompt labelled as a citable page.
    const controlChars = (allText.match(CONTROL_CHAR_RE) ?? []).length;
    if (allText.length > 0 && controlChars / allText.length > 0.05) {
      return `decoded to mostly non-printable control characters (font cmap likely broken) — not usable: ${rel}`;
    }
    // Found on three files from the same author: real Arabic, but the PDF
    // encodes it as Arabic Presentation Forms (isolated per-glyph shapes,
    // U+FB50-FEFF) instead of the base Arabic block, and pdf-parse returns
    // them unshaped and with each word's letters in reverse order. Technically
    // decodable by a person turning the page sideways; unusable as a citation
    // or as text handed to a model.
    const presentationForms = (allText.match(ARABIC_PRESENTATION_FORMS_RE) ?? []).length;
    const basicArabic = (allText.match(BASIC_ARABIC_RE) ?? []).length;
    if (presentationForms > basicArabic) {
      return `Arabic in reversed presentation-form glyphs, not the base Arabic block — unusable without un-shaping: ${rel}`;
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
