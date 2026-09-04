/**
 * The extracted page text, and the manifest's claims about it.
 *
 * Two failure modes are guarded here.
 *
 * The first is drift: `g10_sources.json` states a page count, a character
 * count and a sha256 for each extraction, and `data/extracted/*.json` holds
 * the text. Nothing stops those two disagreeing except this file.
 *
 * The second is quieter and would hurt more. These files total ~2.1 MB. The
 * mobile app imports `@workspace/curriculum`, so a single static import of the
 * extracted text from `index.ts` would put all of it into the phone bundle to
 * serve a retrieval feature the app does not run. There is a test below that
 * fails if anything under `src/` imports the extracted data. When retrieval
 * lands it belongs behind a server-only subpath export, read from disk.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { G10_SOURCES } from '../sources.ts';
import { searchForm } from '../passages.ts';
import { isLfsPointer } from '../../scripts/r2.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '..');
const extractedDir = path.join(srcDir, 'data', 'extracted');
const repoRoot = path.resolve(here, '../../../..');

type Extracted = {
  sourceId: string;
  localPath: string;
  bytes: number;
  sha256: string;
  tool: string;
  pages: number;
  chars: number;
  text: Array<{ page: number; text: string }>;
};

const files = existsSync(extractedDir)
  ? readdirSync(extractedDir).filter(f => f.endsWith('.json'))
  : [];

const load = (f: string): Extracted =>
  JSON.parse(readFileSync(path.join(extractedDir, f), 'utf8')) as Extracted;

describe('extracted text', () => {
  it('has extracted something at all', () => {
    assert.ok(files.length >= 6, `only ${files.length} extractions on disk`);
  });

  it('matches what the manifest claims about it', () => {
    for (const f of files) {
      const doc = load(f);
      const source = G10_SOURCES.find(s => s.id === doc.sourceId);
      assert.ok(source, `${doc.sourceId} has no manifest entry`);
      assert.ok(source.extraction, `${doc.sourceId} is extracted but the manifest does not say so`);
      assert.equal(source.extraction.pages, doc.pages, `${doc.sourceId} page count`);
      assert.equal(source.extraction.chars, doc.chars, `${doc.sourceId} char count`);
      assert.equal(source.extraction.sha256, doc.sha256, `${doc.sourceId} sha256`);
      assert.equal(source.status, 'ingested', `${doc.sourceId} extracted but not marked ingested`);
    }
  });

  it('claims an extraction only where one exists', () => {
    const onDisk = new Set(files.map(f => load(f).sourceId));
    for (const s of G10_SOURCES) {
      if (!s.extraction) continue;
      assert.ok(onDisk.has(s.id), `${s.id} claims an extraction with no file behind it`);
    }
  });

  it('has not regenerated an extraction that was blocked on purpose', () => {
    // The guard that was missing. `extract-text.ts` decided what to do by
    // whether the output file existed, so purging a corrupt extraction made it
    // look un-extracted and the next run wrote it straight back: the scrambled
    // financial-literacy text removed on 2026-09-03 was on disk again on
    // 2026-09-04, serving teachers, with nothing red. The quality gate cannot
    // catch these — both blocked files passed it — so the judgement is recorded
    // on the manifest and this asserts the record is honoured.
    const onDisk = new Set(files.map(f => load(f).sourceId));
    const blocked = G10_SOURCES.filter(s => s.extractionBlocked);
    assert.ok(blocked.length > 0, 'nothing is blocked — has the field been dropped?');
    for (const s of blocked) {
      assert.ok(!onDisk.has(s.id), `${s.id} is blocked but has an extraction on disk: ${s.extractionBlocked}`);
      assert.ok(!s.extraction, `${s.id} is blocked but the manifest claims an extraction`);
    }
  });

  it('is internally consistent', () => {
    for (const f of files) {
      const doc = load(f);
      assert.equal(doc.text.length, doc.pages, `${doc.sourceId} pages vs entries`);
      assert.equal(
        doc.text.reduce((n, p) => n + p.text.length, 0),
        doc.chars,
        `${doc.sourceId} char total`,
      );
      const numbers = doc.text.map(p => p.page);
      assert.equal(new Set(numbers).size, numbers.length, `${doc.sourceId} repeats a page number`);
    }
  });

  it('holds real Arabic, not an empty text layer', () => {
    // A PDF with no text layer parses happily and yields nothing. The whole
    // premise — that these books do yield usable Arabic — is asserted here.
    //
    // Measured as character *density*, not as an unbroken run. A first draft
    // of this looked for 20 consecutive Arabic characters and reported the
    // chemistry book as 2 pages out of 76, which is nonsense: its pages carry
    // ~1,200 Arabic characters each, but interleaved tashkeel, spaces and
    // English terms («Principal Quantum Number») mean a 20-character run
    // almost never occurs. The run was measuring typography, not language.
    //
    // A second draft required 70% of a document's *pages* to individually
    // clear a density bar. That is the wrong unit once the corpus includes
    // teacher-made booklets rather than only continuous-prose textbooks: a
    // real, cleanly-extracted study pack can legitimately carry blank divider
    // pages and dotted table-of-contents leaders, which are real pages with
    // near-zero Arabic on them and not a sign the extraction failed. Measured
    // at the whole-document level instead. The real floor, checked against
    // every extraction on disk: the lowest ratio among genuine documents is
    // 0.32; the reversed-glyph and broken-cmap files this same run's quality
    // gate now rejects before they reach disk measured 0.00-0.12. 0.2 sits in
    // the gap with margin on both sides, not picked to just barely pass today.
    // The English books added on 2026-09-03 broke the premise above: they are
    // genuinely English, so an Arabic floor would fail them for being exactly
    // what they are. Exempting them outright would leave their extractions
    // unchecked, which loses the point of the test — so the same question is
    // asked of the alphabet each source is actually written in. Measured
    // across every extraction on disk: English sources are 74.0% and 74.3%
    // Latin, while the highest Latin density among Arabic-language documents
    // is 15.1% (`chem-ws-planck-almasri`, a worksheet dense with formula
    // symbols). 0.4 sits in that gap the same way 0.2 sits in the Arabic one.
    const ARABIC = /[؀-ۿ]/g;
    const LATIN = /[A-Za-z]/g;
    const subjectOf = new Map(G10_SOURCES.map(s => [s.id, s.subject]));
    const failures: string[] = [];
    for (const f of files) {
      const doc = load(f);
      const isEnglish = subjectOf.get(doc.sourceId) === 'english';
      const script = isEnglish ? LATIN : ARABIC;
      const floor = isEnglish ? 0.4 : 0.2;
      const label = isEnglish ? 'Latin' : 'Arabic';
      const scriptChars = doc.text.reduce((n, p) => n + (p.text.match(script) ?? []).length, 0);
      const ratio = doc.chars > 0 ? scriptChars / doc.chars : 0;
      if (ratio <= floor) {
        failures.push(`${doc.sourceId}: only ${(ratio * 100).toFixed(1)}% of extracted characters are ${label}`);
      }
    }
    // Every file is checked before asserting — a loop that throws on the
    // first bad file would let a second one hide behind it alphabetically.
    // That is exactly what happened while calibrating this test: two files
    // extracting to pure control-character noise sat past `chem-s1-pack-*`
    // in listing order and never got checked until this was fixed.
    assert.deepEqual(failures, []);
  });

  it('records the file it actually read, and flags a mismatched one', () => {
    for (const f of files) {
      const doc = load(f);
      const abs = path.join(repoRoot, doc.localPath);
      // An LFS-thin checkout is not a failure here — whether the file is
      // fully absent, or present only as the ~130-byte pointer stub that
      // `existsSync` alone can't tell apart from the real thing.
      if (!existsSync(abs) || isLfsPointer(readFileSync(abs))) continue;
      assert.equal(statSync(abs).size, doc.bytes, `${doc.sourceId} bytes`);
      assert.equal(
        createHash('sha256').update(readFileSync(abs)).digest('hex'),
        doc.sha256,
        `${doc.sourceId} sha256 — the file on disk is not the one extracted`,
      );
      const source = G10_SOURCES.find(s => s.id === doc.sourceId)!;
      // If the bytes differ from the manifest it must be recorded, not implied.
      if (source.bytes !== doc.bytes) {
        assert.ok(
          source.extraction?.bytesDifferFromManifest,
          `${doc.sourceId} was extracted from a different export and does not say so`,
        );
      }
    }
  });
});

describe('the extracted text stays out of the app bundle', () => {
  it('is imported by nothing under src/', () => {
    // ~2.1 MB. The mobile app imports this package; one static import from
    // index.ts and every phone carries the whole corpus for a feature the app
    // does not run. Retrieval belongs behind a server-only subpath export.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'extracted') continue;
          walk(p);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        if (p === fileURLToPath(import.meta.url)) continue;
        // An *import*, not a mention. `sources.ts` documents where the text
        // lives, in prose; a grep for the path called that an offender.
        const body = readFileSync(p, 'utf8');
        const imports = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"][^'"]*data\/extracted[^'"]*['"]/;
        if (imports.test(body)) offenders.push(path.relative(srcDir, p));
      }
    };
    walk(srcDir);
    assert.deepEqual(offenders, [], `these import the extracted corpus: ${offenders.join(', ')}`);
  });
});

describe('a book actually contains the units it is mapped to', () => {
  it('holds its own unit titles, not another semester\'s', () => {
    // The guard that was missing. `10th_grade,_math,_1st_semester_….pdf` opens
    // «الوحدةُ 5 الاقتراناتُ» — catalog Semester *2* — and its sibling opens
    // «الوحدةُ 1 المعادلاتُ». The two student books are swapped relative to
    // their filenames, and `extract-text.ts` maps across them to compensate.
    //
    // Nothing enforced that. Retrieval for الدائرة returned a page about
    // vectors and read as a ranking problem, which is how a mapping error
    // disguises itself. Filenames and manifest labels are both hearsay; the
    // unit titles printed inside the book are not.
    const bySemester: Record<string, string[]> = {
      'math-s1-student-book': ['الاسس والمعادلات', 'الدائره', 'حساب المثلثات'],
      'math-s2-student-book': ['الاقترانات', 'المشتقات', 'المتجهات'],
      'chem-s1-student-book': ['بنيه الذره', 'الروابط'],
    };
    for (const [sourceId, titles] of Object.entries(bySemester)) {
      const f = path.join(extractedDir, `${sourceId}.json`);
      if (!existsSync(f)) continue;
      const doc = JSON.parse(readFileSync(f, 'utf8')) as Extracted;
      const body = searchForm(doc.text.map(p => p.text).join(' '));
      const found = titles.filter(t => body.includes(searchForm(t)));
      assert.ok(
        found.length >= 2,
        `${sourceId} contains only ${found.length} of its own unit titles `
          + `(${found.join(', ') || 'none'}) — it is probably the other semester's book`,
      );
    }
  });
});
