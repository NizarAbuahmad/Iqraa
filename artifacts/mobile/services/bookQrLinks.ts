/**
 * The resources the ministry printed into the books, as tappable rows.
 *
 * Every NCCD student book prints QR codes in its margins — a video for a
 * lesson, a recording to listen to, a supporting document. They are *drawn*
 * into the page rather than embedded as link annotations, so the only way to
 * get them was to render every page and decode the images;
 * `knowledge-base/book-qr-links.json` is the result of that pass, 186 codes
 * across 23 books, each with the printed URL and an HTTP status checked on
 * 2026-09-12.
 *
 * **Nothing read that file until this module.** It sat in the repo while the
 * subjects it covers best — Islamic studies, Arabic, art, civics, PE — had no
 * student-facing media of any kind, because those books carry no extractable
 * figures either. 138 of the codes are in exactly those five subjects.
 *
 * Nothing here fetches. A row is a label and a URL handed to `openExternal`,
 * which is the same destination the student's phone camera reaches by scanning
 * the printed code. We remove the scan, not the hop.
 *
 * Why the printed URL is not the one we open
 * ─────────────────────────────────────────
 * Every ministry code prints `https://qr.nccd.gov.jo/…` and that host's
 * certificate has expired, so the printed link fails outright. The same path
 * over plain `http://` serves the file, and that is what the manifest's
 * `workingUrl` holds. So these are open-in-the-browser links and cannot become
 * an inline `<audio>`/`<video>`: over https the handshake fails with no
 * click-through a subresource can offer, and over http a page served from https
 * blocks it as mixed content. A player here would look right and render dead.
 */
import qrLinks from '../../../knowledge-base/book-qr-links.json' with { type: 'json' };

/** What the row opens, decided by the file it points at. */
export type QrResourceKind = 'audio' | 'video' | 'document' | 'image' | 'page';

export interface QrResource {
  kind: QrResourceKind;
  /** Always scheme-qualified. `isHttp` says whether it is the insecure one. */
  url: string;
  /** The printed page the code sits on — the locator a student can act on. */
  pdfPage: number;
  isHttp: boolean;
}

export interface QrResourceBook {
  /** The book's own printed title, already Arabic and already correct. */
  title: string;
  subjectId: string;
  resources: QrResource[];
}

/**
 * A row is only offered if it was reachable when last checked.
 *
 * 206 rather than 200 is the common case: these are media files and the origin
 * honours range requests, which is also why seeking works once the browser
 * opens one. The 17 rows outside this set are 12 × 404, 2 × 403 and 3 that did
 * not answer — every grade-10 digital-literacy code is among them, so that
 * subject drops out of the library entirely rather than showing four dead rows.
 */
const REACHABLE = new Set(['200', '206']);

/**
 * Four of the manifest's `subjectId` values are not catalog subject ids.
 *
 * Spelled out rather than matched, because the obvious shortcut is wrong: a
 * substring test for `art` hits `earth-science` before `creative-arts`.
 */
const SUBJECT_ALIASES: Record<string, string> = {
  art: 'creative-arts',
  civic: 'civic-education',
  pe: 'physical-education',
  math: 'mathematics',
};

/** The extension decides the kind — see `kindOf`. */
const KIND_BY_EXTENSION: Record<string, QrResourceKind> = {
  mp3: 'audio',
  m4a: 'audio',
  wav: 'audio',
  mp4: 'video',
  mov: 'video',
  pdf: 'document',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
};

function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  return (path.match(/\.([A-Za-z0-9]{2,4})$/)?.[1] ?? '').toLowerCase();
}

/**
 * Trust the extension where there is one, the declared `kind` where there
 * isn't. Both directions are load-bearing, and each was measured:
 *
 *   - **All 20 `.mp3` rows are declared `kind: "page"`** — the only curriculum
 *     audio in the product was labelled "web page". Reading the declared kind
 *     loses every one of them.
 *   - **3 rows declared `video` have no extension at all.** Deriving from the
 *     extension alone would file those as pages.
 */
function kindOf(url: string, declared: unknown): QrResourceKind {
  const byExtension = KIND_BY_EXTENSION[extensionOf(url)];
  if (byExtension) return byExtension;
  const kind = String(declared);
  return kind === 'video' || kind === 'audio' || kind === 'document' || kind === 'image'
    ? kind
    : 'page';
}

/**
 * 12 `workingUrl` values are bare hosts — `qr.nccd.gov.jo/QR/Eng/10/S1/SB17.mp3`
 * with no scheme. Handed to `window.open` as-is that is a *relative path*, so
 * the tab navigates inside our own app and the student loses what they had
 * open. The manifest is written by a decode pass that can produce more of
 * these, so this normalises rather than assuming the count stays at 12.
 */
function absolute(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

/** `…/support-pdfs/كتاب الطالب … .pdf` → the printed title. */
function bookTitle(bookPath: string): string {
  return (bookPath.split('/').pop() ?? bookPath).replace(/\.pdf$/i, '');
}

interface RawEntry {
  gradeId?: string;
  subjectId?: string;
  book?: string;
  pdfPage?: number;
  kind?: string;
  workingUrl?: string;
  httpStatus?: string | number;
}

const ENTRIES = (qrLinks as { entries: RawEntry[] }).entries;

/**
 * Every reachable row, grouped by the book that prints it.
 *
 * Grouped by the manifest's own `book` string and **not** by a catalog `Book`,
 * which is not a shortcut but the only correct choice: `creative-arts` and
 * `physical-education` have no book in the catalog at all, so a catalog join
 * silently drops those 16 rows — including 7 of the 20 audio files. The
 * printed filename is already a correct Arabic title for every one of them.
 *
 * Keyed on book + printed page rather than a lesson id, because only 12 of the
 * 186 codes carry one. That is the better locator anyway: the student is
 * holding the book, and «صفحة ٤٥» is something they can act on.
 */
export function qrResourcesForGrade(gradeId: string): QrResourceBook[] {
  if (!gradeId) return [];
  const byBook = new Map<string, QrResourceBook>();

  for (const entry of ENTRIES) {
    if (entry.gradeId !== gradeId) continue;
    if (!entry.workingUrl || !REACHABLE.has(String(entry.httpStatus))) continue;

    const url = absolute(entry.workingUrl);
    const bookPath = entry.book ?? '';
    let book = byBook.get(bookPath);
    if (!book) {
      const raw = entry.subjectId ?? '';
      book = {
        title: bookTitle(bookPath),
        subjectId: SUBJECT_ALIASES[raw] ?? raw,
        resources: [],
      };
      byBook.set(bookPath, book);
    }
    book.resources.push({
      kind: kindOf(url, entry.kind),
      url,
      pdfPage: entry.pdfPage ?? 0,
      isHttp: url.toLowerCase().startsWith('http://'),
    });
  }

  for (const book of byBook.values()) {
    book.resources.sort((a, b) => a.pdfPage - b.pdfPage);
  }
  return [...byBook.values()].sort((a, b) => b.resources.length - a.resources.length);
}

/** For hiding the library entry on a grade that has nothing in it. */
export function qrResourceCountForGrade(gradeId: string): number {
  return qrResourcesForGrade(gradeId).reduce((n, b) => n + b.resources.length, 0);
}

/** Every grade the manifest covers, for tests and for sanity checks. */
export function gradesWithQrResources(): string[] {
  const grades = new Set<string>();
  for (const entry of ENTRIES) {
    if (entry.workingUrl && REACHABLE.has(String(entry.httpStatus)) && entry.gradeId) {
      grades.add(entry.gradeId);
    }
  }
  return [...grades].sort();
}
