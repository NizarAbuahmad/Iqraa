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
  // ⚠ The two student books are mapped ACROSS their filenames, on purpose.
  //
  // `10th_grade,_math,_1st_semester_….pdf` opens «الوحدةُ 5 الاقتراناتُ» and
  // carries unit 7 المتجهات — catalog **Semester 2**. `…,_2nd_semester_….pdf`
  // opens «الوحدةُ 1 المعادلاتُ» and carries unit 3 حساب المثلثات — catalog
  // **Semester 1**. The files are swapped relative to their names, and the
  // manifest inherited the swap when its entries were written from a Drive
  // listing rather than from the documents.
  //
  // Mapped by content, because that is what makes a citation true: a passage
  // offered for الدائرة must come from the book that contains الدائرة. Before
  // this was corrected, retrieval for the circle unit returned a page about
  // vectors and looked like a scoring problem.
  //
  // The teacher guides are *not* affected — the S2 guide really does hold unit
  // 6 المشتقات — so this is the two student books only. It is also very likely
  // true of the Drive copies and the `bytes` recorded against these two ids;
  // see STATUS.md. `bytesDifferFromManifest` fires on both as a result.
  'math-s1-student-book': 'attached_assets/10th_grade,_math,_2nd_semester_1785147978008.pdf',
  'math-s2-student-book': 'attached_assets/10th_grade,_math,_1st_semester_1785071530816.pdf',
  'chem-s1-student-book': 'attached_assets/10th_grade,_alchamy1st_semester_1785071530814.pdf',
  'math-s1-exercise-book': 'attached_assets/2026_MT10_WB1__10th_grade,_math_excersice_book,_semster_one_1785147998882.pdf',
  'math-s2-exercise-book': 'attached_assets/MA_10_WB2_6_11_2025-mather_exccersie_book,_semster_2_1785147998882.pdf',
  'math-s2-teacher-guide': 'attached_assets/Book10_2_Proof3_WEB-teacher_guiede,_10th_grade,_semster_two_1785147998881.pdf',
  // math-s1-teacher-guide is a Git-LFS pointer in this checkout (58 MB
  // unpulled). It is the richest single source — it supplied every math S1
  // objective — so it is named here to be picked up automatically once
  // `git lfs pull` has run, rather than quietly omitted.
  'math-s1-teacher-guide': 'attached_assets/TE010_Book-teacher_guiede,_10th_grade,_semster_one_1785147998881.pdf',

  // The 54 support-pack documents below (out of 60 pending in the
  // manifest) were fetched from the Drive folder the manifest's driveId
  // already pointed at, 2026-08-26 — see STATUS.md. Six remain unfetched:
  // two hit repeated transient MCP session drops, four exceed the 10MB
  // single-call download ceiling of the tool used to fetch them.
  'math-remedial-plan': 'attached_assets/knowledge-base-pending/math-remedial-plan.pdf',
  'math-remedial-part1': 'attached_assets/knowledge-base-pending/math-remedial-part1.pdf',
  'math-remedial-part2': 'attached_assets/knowledge-base-pending/math-remedial-part2.pdf',
  'math-s2-support-worksheets': 'attached_assets/knowledge-base-pending/math-s2-support-worksheets.pdf',
  'math-diagnostic-test': 'attached_assets/knowledge-base-pending/math-diagnostic-test.pdf',
  'math-u2-summary-alkhamayseh': 'attached_assets/knowledge-base-pending/math-u2-summary-alkhamayseh.pdf',
  'math-ws-systems-alhindi': 'attached_assets/knowledge-base-pending/math-ws-systems-alhindi.pdf',
  'math-ws-systems-solved-alkhatib': 'attached_assets/knowledge-base-pending/math-ws-systems-solved-alkhatib.pdf',
  'math-systems-almasri': 'attached_assets/knowledge-base-pending/math-systems-almasri.pdf',
  'math-ws-powers-almasri': 'attached_assets/knowledge-base-pending/math-ws-powers-almasri.pdf',
  'math-ws-polynomials-almasri': 'attached_assets/knowledge-base-pending/math-ws-polynomials-almasri.pdf',
  'math-ws-circle-full-alkhatib': 'attached_assets/knowledge-base-pending/math-ws-circle-full-alkhatib.pdf',
  'math-ws-tangents-alhindi': 'attached_assets/knowledge-base-pending/math-ws-tangents-alhindi.pdf',
  'math-ws-tangent-angle-alhindi': 'attached_assets/knowledge-base-pending/math-ws-tangent-angle-alhindi.pdf',
  'math-ws-cyclic-quad-1-alhindi': 'attached_assets/knowledge-base-pending/math-ws-cyclic-quad-1-alhindi.pdf',
  'math-ws-cyclic-quad-2-alhindi': 'attached_assets/knowledge-base-pending/math-ws-cyclic-quad-2-alhindi.pdf',
  'math-ws-angles-alhindi': 'attached_assets/knowledge-base-pending/math-ws-angles-alhindi.pdf',
  'math-ws-chords-1-alhindi': 'attached_assets/knowledge-base-pending/math-ws-chords-1-alhindi.pdf',
  'math-ws-chords-2-alhindi': 'attached_assets/knowledge-base-pending/math-ws-chords-2-alhindi.pdf',
  'math-mcq-circle-alkhatib': 'attached_assets/knowledge-base-pending/math-mcq-circle-alkhatib.pdf',
  'math-mcq-circle-suggested-alkhatib': 'attached_assets/knowledge-base-pending/math-mcq-circle-suggested-alkhatib.pdf',
  'math-matrices-suggested-alkhatib': 'attached_assets/knowledge-base-pending/math-matrices-suggested-alkhatib.pdf',
  'math-final-alhindi': 'attached_assets/knowledge-base-pending/math-final-alhindi.pdf',
  'math-final-1-alkhatib': 'attached_assets/knowledge-base-pending/math-final-1-alkhatib.pdf',
  'math-final-2-alkhatib': 'attached_assets/knowledge-base-pending/math-final-2-alkhatib.pdf',
  'math-month1-alkhatib': 'attached_assets/knowledge-base-pending/math-month1-alkhatib.pdf',
  'math-month2-alfarakh': 'attached_assets/knowledge-base-pending/math-month2-alfarakh.pdf',
  'math-u6-test-hussein': 'attached_assets/knowledge-base-pending/math-u6-test-hussein.pdf',
  'math-u7-test-hussein': 'attached_assets/knowledge-base-pending/math-u7-test-hussein.pdf',
  'math-foundation-lafi': 'attached_assets/knowledge-base-pending/math-foundation-lafi.pdf',
  'math-foundations-melhem': 'attached_assets/knowledge-base-pending/math-foundations-melhem.pdf',
  'math-geometry-formulas-melhem': 'attached_assets/knowledge-base-pending/math-geometry-formulas-melhem.pdf',
  'chem-s1-activity-book': 'attached_assets/knowledge-base-pending/chem-s1-activity-book.pdf',
  'chem-s2-activity-book': 'attached_assets/knowledge-base-pending/chem-s2-activity-book.pdf',
  'chem-loss-recovery': 'attached_assets/knowledge-base-pending/chem-loss-recovery.pdf',
  'chem-s1-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-pack-sartawi.pdf',
  'chem-s1-u1-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-u1-pack-sartawi.pdf',
  'chem-s1-u2-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-u2-pack-sartawi.pdf',
  'chem-s1-u3-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-u3-pack-sartawi.pdf',
  'chem-s1-pack-almasri': 'attached_assets/knowledge-base-pending/chem-s1-pack-almasri.pdf',
  'chem-s1-summary-shawata': 'attached_assets/knowledge-base-pending/chem-s1-summary-shawata.pdf',
  'chem-s2-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s2-pack-sartawi.pdf',
  'chem-s2-pack-shawata': 'attached_assets/knowledge-base-pending/chem-s2-pack-shawata.pdf',
  'chem-s2-pack-almasri': 'attached_assets/knowledge-base-pending/chem-s2-pack-almasri.pdf',
  'chem-u4-summary-sartawi': 'attached_assets/knowledge-base-pending/chem-u4-summary-sartawi.pdf',
  'chem-u5-summary-sartawi': 'attached_assets/knowledge-base-pending/chem-u5-summary-sartawi.pdf',
  'chem-s1-question-bank-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-question-bank-sartawi.pdf',
  'chem-s1-mixed-questions-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-mixed-questions-sartawi.pdf',
  'chem-ws-bohr-manhaji': 'attached_assets/knowledge-base-pending/chem-ws-bohr-manhaji.pdf',
  'chem-ws-bohr-tareq': 'attached_assets/knowledge-base-pending/chem-ws-bohr-tareq.pdf',
  'chem-ws-reactions-tareq': 'attached_assets/knowledge-base-pending/chem-ws-reactions-tareq.pdf',
  'chem-ws-planck-almasri': 'attached_assets/knowledge-base-pending/chem-ws-planck-almasri.pdf',
  'chem-u1-test-shawata': 'attached_assets/knowledge-base-pending/chem-u1-test-shawata.pdf',
  'chem-s2-month1-tareq': 'attached_assets/knowledge-base-pending/chem-s2-month1-tareq.pdf',
};

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
