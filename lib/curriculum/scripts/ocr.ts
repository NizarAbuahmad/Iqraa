/**
 * OCR fallback for a PDF whose embedded text is missing or too corrupted to
 * trust — the four gates in `extract-text.ts` (no text layer, broken font
 * cmap, unshaped presentation forms, transposed definite article) are all
 * failures of the PDF's own embedded text, not of what is printed on the
 * page. Rasterizing the page and reading the pixels sidesteps all four at
 * once, because none of them exist in a rendered image.
 *
 * Needs two external tools this project did not previously shell out to:
 *
 *   - `pdftoppm` (poppler) to rasterize a page to PNG. This project already
 *     depends on a *working* poppler build for `pdftotext` (CLAUDE.md's
 *     landmine: the `/mingw64/bin/pdftotext` on PATH returns almost no
 *     Arabic from these NCCD PDFs — install the winget build instead).
 *   - `tesseract` to read the PNG. Windows' winget package ships English
 *     only; Arabic is a separate ~2.4MB model file
 *     (https://github.com/tesseract-ocr/tessdata) tesseract does not fetch
 *     for you.
 *
 * Both are optional at the project level: `isOcrAvailable()` probes for
 * both and `ocrPdf()` returns `null` — never throws — when either is
 * missing, so a checkout without them behaves exactly as it did before this
 * file existed. `extract-text.ts` falls back to the old rejection message
 * in that case.
 *
 * Setup, once per machine:
 *   winget install --id tesseract-ocr.tesseract -e
 *   curl -L -o ara.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/ara.traineddata
 *   move it into TESSDATA_DIR (default: ~/.config/tessdata — this project's
 *   own convention, not tesseract's; its install rarely ships non-English
 *   languages and Program Files is usually not writable without elevation)
 *
 * Quality: spot-checked on the Grade 10 biology teacher guide (a genuine
 * scan, no digital original). Real, coherent Arabic came back — safety
 * instructions, lab materials, teaching notes — with occasional garbled
 * words around small decorative page elements (unit-badge numerals, icons).
 * Good enough to ground generation citing a page number; **not** verified
 * character-for-character, so treat OCR'd text as one notch below a clean
 * digital extraction and spot-check anything a teacher will see quoted.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const TESSERACT_FALLBACKS = ['tesseract', path.join('C:', 'Program Files', 'Tesseract-OCR', 'tesseract.exe')];
const POPPLER_FALLBACKS = ['pdftoppm', ...findWingetPoppler()];

/** Windows only: winget's Poppler package dir carries a version hash in its
 * name, so the exact path in CLAUDE.md's landmine note is not portable
 * between machines. Globbed instead of hardcoded for that reason. */
function findWingetPoppler(): string[] {
  const base = path.join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft', 'WinGet', 'Packages',
  );
  if (!process.env.LOCALAPPDATA || !existsSync(base)) return [];
  try {
    const hit = readdirSync(base).find(d => /poppler/i.test(d));
    if (!hit) return [];
    // e.g. .../oschwartz10612.Poppler_.../poppler-25.07.0/Library/bin
    const versionDir = readdirSync(path.join(base, hit)).find(d => /^poppler-/i.test(d));
    if (!versionDir) return [];
    return [path.join(base, hit, versionDir, 'Library', 'bin', 'pdftoppm.exe')];
  } catch {
    return [];
  }
}

let resolved: { tesseract: string; pdftoppm: string } | null | undefined;

async function probe(candidates: string[], versionFlag: string): Promise<string | null> {
  for (const bin of candidates) {
    try {
      await run(bin, [versionFlag]);
      return bin;
    } catch {
      // not this one — try the next candidate
    }
  }
  return null;
}

/** Locates both binaries once per process; `null` means at least one is missing. */
async function resolveTools(): Promise<{ tesseract: string; pdftoppm: string } | null> {
  if (resolved !== undefined) return resolved;
  const [tesseract, pdftoppm] = await Promise.all([
    probe([process.env.TESSERACT_BIN, ...TESSERACT_FALLBACKS].filter((x): x is string => !!x), '--version'),
    probe([process.env.POPPLER_BIN, ...POPPLER_FALLBACKS].filter((x): x is string => !!x), '-v'),
  ]);
  resolved = tesseract && pdftoppm ? { tesseract, pdftoppm } : null;
  return resolved;
}

/** The tessdata directory holding `<lang>.traineddata`. See file header for setup. */
function tessdataDir(): string {
  return process.env.TESSDATA_DIR ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '.', '.config', 'tessdata');
}

export interface OcrPage {
  page: number;
  text: string;
}

/** Whether both OCR tools are reachable, without doing any OCR. For callers that want to log/skip up front. */
export async function isOcrAvailable(): Promise<boolean> {
  return (await resolveTools()) !== null;
}

/**
 * Rasterize every page of `pdfPath` and OCR it. `null` when tooling is
 * unavailable or the whole PDF failed; a page-level OCR failure yields an
 * empty string for that page rather than aborting the document, since one
 * blank plate (a cover, a divider) is common and not a reason to lose the
 * rest of the book.
 */
export async function ocrPdf(
  pdfPath: string,
  opts: { lang?: string; dpi?: number } = {},
): Promise<OcrPage[] | null> {
  const tools = await resolveTools();
  if (!tools) return null;

  const lang = opts.lang ?? process.env.OCR_LANG ?? 'ara';
  const dpi = opts.dpi ?? Number(process.env.OCR_DPI ?? 300);
  const dir = mkdtempSync(path.join(tmpdir(), 'iqraa-ocr-'));
  try {
    await run(tools.pdftoppm, ['-r', String(dpi), '-png', pdfPath, path.join(dir, 'p')]);
    const pngs = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
    if (!pngs.length) return null;

    const pages: OcrPage[] = [];
    for (const [i, file] of pngs.entries()) {
      const outBase = path.join(dir, `out-${i}`);
      try {
        await run(tools.tesseract, [
          '--tessdata-dir', tessdataDir(),
          '-l', lang,
          path.join(dir, file),
          outBase,
        ]);
        pages.push({ page: i + 1, text: readFileSync(`${outBase}.txt`, 'utf8').trim() });
      } catch {
        pages.push({ page: i + 1, text: '' });
      }
    }
    return pages;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
