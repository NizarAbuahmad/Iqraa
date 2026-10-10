#!/usr/bin/env python3
"""
Find the QR codes printed in the student books and add them to
`knowledge-base/book-qr-links.json`.

Every NCCD student book prints QR codes in its margins — a video, a recording, a
supporting page. They are *drawn* into the page, not embedded as link
annotations, so neither the text layer nor `page.get_links()` sees them. The only
way to read them is to render each page and run a QR detector over the picture.
That is what this does. The library's «مصادر الكتاب» shelf is built from the
result (`artifacts/mobile/services/bookQrLinks.ts`).

**Why this exists.** The first pass was run once, on 2026-09-15, over 14 books —
all of them Grade 9 and 10 — and the script was never committed. Every other
grade therefore had *no entries*, which looked exactly like "that grade's books
print no codes" and was wrongly taken as fact. This script is the repeatable
version, and it records every book it has looked at under `scannedBooks`, so
"scanned, found none" and "never scanned" are no longer the same empty answer.

    pip install pymupdf opencv-python-headless numpy

    # every student book under knowledge-base/<grade-N-subject>/support-pdfs/
    python scripts/scan_book_qr.py

    # only some grades, and look first
    python scripts/scan_book_qr.py --grade 2 4 --dry-run

    # no PDFs to hand? download the student books from the links the catalog
    # already holds (Book.pdfUrl, the official NCCD files), then scan them
    python scripts/scan_book_qr.py --fetch --grade 2 4 --dry-run   # list what it would fetch
    python scripts/scan_book_qr.py --fetch --grade 2 4

    # a PDF that lives outside the repo layout (the Windows "Knowledge Base" tree)
    python scripts/scan_book_qr.py --pdf "C:\\...\\كتاب الطالب لمادة العلوم للصف الرابع الفصل الأول.pdf" \\
        --pdf-grade 4 --pdf-subject science

Then, in this order:

    pnpm --filter @workspace/curriculum run verify-qr-links   # which links answer
    pnpm --filter @workspace/mobile test                       # subject ids resolve

New rows are written with `httpStatus: "unchecked"`, which the app does not show:
a code appears in the library only after the link check has seen it answer.

**`--fetch` needs to run where `nccd.gov.jo` answers** — a normal home or office
connection in Jordan does; a cloud sandbox or CI runner may not (this one did
not: connection reset). It needs Node, the same one pnpm uses, to read the catalog.
Files land in the usual layout (`knowledge-base/grade-N-<subject>/support-pdfs/`,
gitignored), are named `كتاب الطالب — <title>.pdf` so the library shows a readable
book name, are checked to really be PDFs, and are not downloaded again. A book
that fails to download is listed and is **not** recorded as scanned.

**One page is not enough, and neither is one resolution.** A code that decodes at
200 dpi can fail at 150, 300 and 400 (Grade 10 history S1, page 12). So every
page is rendered at 150, 200 and 260 dpi and the union is taken; on the first pass
only 44 of 186 codes decoded at 150 dpi alone. Expect a few minutes per book.

**`pdfPage` is the 1-based page number**, which matches the page number the
ministry puts in the file name (`.../page15.mp4`) — 49 of the 63 existing rows
that carry one agree exactly.

**Read the summary before committing.** Three things it reports and does not
hide: books scanned with no codes (recorded, not dropped), payloads that were not
links (a Wi-Fi code or a contact card is not a resource), and PDFs it could not
open.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

REPO = Path(__file__).resolve().parent.parent
KB = REPO / "knowledge-base"
MANIFEST = KB / "book-qr-links.json"

DPIS = (150, 200, 260)
UNCHECKED = "unchecked"

MIN_PDF_BYTES = 10_000
# NCCD answers a browser; a bare Python user agent is the kind of thing that gets refused.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# A student book, by name. Teacher guides, answer keys and worksheets live in the
# same folders and print no student-facing codes; scanning them would only add
# rows nobody can use. Anything skipped is listed, never silently ignored.
STUDENT_BOOK = re.compile(r"كتاب\s*الطالب|student|pupil", re.IGNORECASE)

FOLDER = re.compile(r"^grade-(\d{1,2})-(.+)$")

KIND_BY_EXTENSION = {
    "mp3": "audio", "m4a": "audio", "wav": "audio",
    "mp4": "video", "mov": "video",
    "pdf": "document",
    "png": "image", "jpg": "image", "jpeg": "image",
}
VIDEO_HOSTS = ("youtube.com", "youtu.be", "vimeo.com")

# A payload is a resource only if it is a link. QR codes also carry Wi-Fi
# credentials, contact cards and plain text, and none of those belongs on a shelf.
LINKISH = re.compile(r"^(https?://|www\.)|^[\w-]+(\.[\w-]+)+(/|$)", re.IGNORECASE)


# ── pure helpers (tested in test_scan_book_qr.py) ────────────────────────────

def looks_like_link(text: str) -> bool:
    return bool(LINKISH.match(text.strip()))


def absolute(url: str) -> str:
    """A bare host handed to a browser is a relative path; give it a scheme."""
    url = url.strip()
    return url if re.match(r"^https?://", url, re.IGNORECASE) else f"http://{url}"


def working_url(printed: str) -> tuple[str, str | None]:
    """
    The URL to actually open, and a note when it differs from what is printed.

    `qr.nccd.gov.jo` prints https:// but its certificate has expired, so the printed
    link fails outright; the same path over http:// serves the file. Everything
    else is opened as printed.
    """
    url = absolute(printed)
    host = (urlparse(url).hostname or "").lower()
    if host == "qr.nccd.gov.jo" and url.lower().startswith("https://"):
        return "http://" + url[len("https://"):], "printed https fails: expired certificate on qr.nccd.gov.jo"
    return url, None


def kind_of(url: str) -> str:
    """The file's extension decides; a video host decides when there is none."""
    path = unquote(urlparse(absolute(url)).path)
    m = re.search(r"\.([A-Za-z0-9]{2,4})$", path)
    if m and m.group(1).lower() in KIND_BY_EXTENSION:
        return KIND_BY_EXTENSION[m.group(1).lower()]
    host = (urlparse(absolute(url)).hostname or "").lower()
    if any(host == h or host.endswith("." + h) for h in VIDEO_HOSTS):
        return "video"
    return "page"


def book_key(grade: int, subject: str, pdf_name: str) -> str:
    """Same shape the first pass wrote: `grade-10-arabic/support-pdfs/<name>.pdf`."""
    return f"grade-{grade}-{subject}/support-pdfs/{pdf_name}"


def make_entry(grade: int, subject: str, book: str, page: int, printed: str, dpi: int) -> dict:
    working, note = working_url(printed)
    entry = {
        "gradeId": f"grade-{grade}",
        "subjectId": subject,
        "book": book,
        "pdfPage": page,
        "printedUrl": printed,
        "kind": kind_of(working),
        "decodedAtDpi": dpi,
        "workingUrl": working,
        "httpStatus": UNCHECKED,
    }
    if note:
        entry["note"] = note
    return entry


def entry_key(e: dict) -> tuple:
    return (e.get("book"), e.get("pdfPage"), e.get("printedUrl"))


def merge(doc: dict, new_entries: list[dict], scanned: dict[str, dict]) -> int:
    """
    Add what is new and touch nothing that exists.

    An existing row keeps its `title`, `httpStatus` and `note` — those were put
    there by a person or by the link check, and a re-scan must not undo them.
    Returns how many rows were added.
    """
    have = {entry_key(e) for e in doc["entries"]}
    added = [e for e in new_entries if entry_key(e) not in have]
    added.sort(key=lambda e: (e["gradeId"], e["subjectId"], e["book"], e["pdfPage"], e["printedUrl"]))
    doc["entries"].extend(added)
    doc.setdefault("scannedBooks", {}).update(scanned)
    return len(added)


# ── scanning ─────────────────────────────────────────────────────────────────

def _decode(detector, img) -> list[str]:
    """Every payload cv2 can read from one picture, across OpenCV versions."""
    out: list[str] = []
    try:
        res = detector.detectAndDecodeMulti(img)
        # (retval, decoded_info, points, straight_qrcode) — older builds differ.
        infos = res[1] if len(res) >= 2 else []
        out.extend(t for t in (infos or []) if t)
    except Exception:  # noqa: BLE001 — a detector failure on one page is not fatal
        pass
    if not out:
        try:
            text, _, _ = detector.detectAndDecode(img)
            if text:
                out.append(text)
        except Exception:  # noqa: BLE001
            pass
    return out


def scan_pdf(pdf: Path, dpis=DPIS, progress=True) -> tuple[int, dict[tuple[int, str], int]]:
    """
    Returns (page count, {(page, payload): lowest dpi that read it}).

    Union across resolutions, because no single one reads every code.
    """
    import cv2  # imported here so `--help` and the unit tests do not need OpenCV
    import numpy as np
    import pymupdf

    found: dict[tuple[int, str], int] = {}
    detector = cv2.QRCodeDetector()
    with pymupdf.open(pdf) as doc:
        n = doc.page_count
        for i in range(n):
            page = doc[i]
            for dpi in dpis:
                pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
                for text in _decode(detector, img):
                    found.setdefault((i + 1, text.strip()), dpi)
            if progress and (i + 1) % 20 == 0:
                print(f"    {i + 1}/{n} pages", flush=True)
    return n, found


def discover(kb: Path, grades: set[int] | None, subjects: set[str] | None):
    """Yield (grade, subject, pdf path, is_student_book) for every PDF in the layout."""
    for folder in sorted(p for p in kb.iterdir() if p.is_dir()):
        m = FOLDER.match(folder.name)
        if not m:
            continue
        grade, subject = int(m.group(1)), m.group(2).lower()
        if grades and grade not in grades:
            continue
        if subjects and subject not in subjects:
            continue
        pdfs = folder / "support-pdfs"
        if not pdfs.is_dir():
            continue
        for pdf in sorted(pdfs.glob("*.pdf")):
            yield grade, subject, pdf, bool(STUDENT_BOOK.search(pdf.name))


# ── fetching ─────────────────────────────────────────────────────────────────

class DownloadError(Exception):
    pass


def safe_filename(name: str) -> str:
    """A name Windows will accept: drop what it refuses, collapse the whitespace."""
    return re.sub(r"\s+", " ", re.sub(r'[\\/:*?"<>|]+', " ", name)).strip()


def fetch_filename(title_ar: str) -> str:
    """
    `كتاب الطالب — العلوم – الصف الرابع – الفصل الأول.pdf`

    The library shows the file name, minus `.pdf`, as the book's name; and the
    leading «كتاب الطالب» is what marks it a student book to `STUDENT_BOOK`.
    """
    return safe_filename(f"كتاب الطالب — {title_ar}") + ".pdf"


def catalog_books(catalog_json: Path | None = None) -> list[dict]:
    """
    Every book the catalog has an official student-book link for.

    Read through the real `BOOKS` array (`lib/curriculum/scripts/list-book-urls.ts`)
    rather than scraped out of `catalog.ts`, so a book added to the catalog is
    picked up with no second list to keep in step. `catalog_json` replaces it
    for tests or when Node is not to hand.
    """
    if catalog_json:
        return json.loads(catalog_json.read_text(encoding="utf8"))
    try:
        proc = subprocess.run(
            ["node", "--experimental-strip-types", "scripts/list-book-urls.ts"],
            cwd=REPO / "lib" / "curriculum", capture_output=True, text=True, timeout=120,
        )
    except FileNotFoundError:
        raise SystemExit("--fetch needs Node (the one pnpm uses) to read the catalog; "
                         "or pass --catalog-json with a saved list.")
    if proc.returncode != 0:
        raise SystemExit(f"could not read the catalog:\n{proc.stderr.strip()[-600:]}")
    return json.loads(proc.stdout.strip().splitlines()[-1])


def select_books(rows: list[dict], grades: set[int] | None, subjects: set[str] | None) -> list[dict]:
    """Filter by grade/subject; one row per link, since two books can share a file."""
    out: list[dict] = []
    seen: set[str] = set()
    for r in rows:
        m = re.match(r"^grade-(\d{1,2})$", str(r.get("gradeId", "")))
        url = (r.get("pdfUrl") or "").strip()
        if not m or not url or url in seen:
            continue
        grade, subject = int(m.group(1)), str(r.get("subjectId", "")).lower()
        if grades and grade not in grades:
            continue
        if subjects and subject not in subjects:
            continue
        seen.add(url)
        out.append({"grade": grade, "subject": subject, "title": r.get("titleAr", ""), "url": url})
    return out


def looks_like_pdf(path: Path) -> bool:
    """A real PDF, not the HTML error page a server sometimes returns with a 200."""
    try:
        with open(path, "rb") as f:
            head = f.read(5)
        return head == b"%PDF-" and path.stat().st_size >= MIN_PDF_BYTES
    except OSError:
        return False


def download(url: str, dest: Path, tries: int = 3, timeout: int = 60, pause: float = 2.0) -> str:
    """
    Returns "cached" or "downloaded"; raises DownloadError with the reason.

    TLS verification stays on: an expired certificate is reported, not bypassed.
    A refusal (403/404/410) or a non-PDF answer is not retried — asking again
    will not change it — but a timeout or a dropped connection is.
    """
    if looks_like_pdf(dest):
        return "cached"
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    safe_url = quote(url, safe="%:/?&=#+@,;~!$'()*")
    last = "failed"
    for attempt in range(1, tries + 1):
        try:
            req = urllib.request.Request(
                safe_url, headers={"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp, open(part, "wb") as out:
                shutil.copyfileobj(resp, out, 1 << 20)
            if not looks_like_pdf(part):
                raise DownloadError(f"the server answered, but not with a PDF (or one under {MIN_PDF_BYTES // 1000} KB, too small to be a book)")
            os.replace(part, dest)
            return "downloaded"
        except DownloadError as exc:
            last = str(exc)
            break
        except urllib.error.HTTPError as exc:
            last = f"HTTP {exc.code}"
            if exc.code in (400, 401, 403, 404, 410):
                break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = str(getattr(exc, "reason", exc))
        if attempt < tries:
            time.sleep(pause * attempt)
    part.unlink(missing_ok=True)
    raise DownloadError(last)


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan student books for printed QR codes.")
    ap.add_argument("--kb", type=Path, default=KB, help="knowledge-base folder (default: the repo's)")
    ap.add_argument("--manifest", type=Path, default=MANIFEST)
    ap.add_argument("--grade", type=int, nargs="*", help="only these grades")
    ap.add_argument("--subject", nargs="*", help="only these subject folder suffixes (e.g. science art)")
    ap.add_argument("--pdf", type=Path, nargs="*", help="scan these PDFs instead of walking --kb")
    ap.add_argument("--pdf-grade", type=int, help="grade of the --pdf files")
    ap.add_argument("--pdf-subject", help="subject of the --pdf files, as in the folder name (e.g. science)")
    ap.add_argument("--fetch", action="store_true",
                    help="download the student books from the catalog's official links, then scan them")
    ap.add_argument("--catalog-json", type=Path,
                    help="with --fetch: read the book list from this JSON instead of running Node")
    ap.add_argument("--rescan", action="store_true", help="scan books already listed under scannedBooks")
    ap.add_argument("--all-pdfs", action="store_true", help="scan every PDF, not only student books")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    ap.add_argument("--dpi", type=int, nargs="*", default=list(DPIS),
                    help="resolutions to render at (default 150 200 260); add 330 for a book that "
                         "looks short of codes — a code under about half an inch needs it")
    args = ap.parse_args()

    if not args.manifest.is_file():
        print(f"no manifest at {args.manifest}", file=sys.stderr)
        return 2
    doc = json.loads(args.manifest.read_text(encoding="utf8"))
    doc.setdefault("entries", [])

    already = doc.get("scannedBooks", {})

    # Work list: (grade, subject, path)
    work: list[tuple[int, str, Path]] = []
    skipped_not_student: list[Path] = []
    download_failed: list[tuple[str, str]] = []
    if args.fetch:
        if args.pdf:
            print("--fetch and --pdf are separate ways to supply books; use one.", file=sys.stderr)
            return 2
        books = select_books(
            catalog_books(args.catalog_json), set(args.grade or []),
            {x.lower() for x in args.subject or []},
        )
        if not books:
            print("the catalog has no book links for that selection.")
            return 1
        print(f"{len(books)} book link(s) selected from the catalog")
        for i, b in enumerate(books, 1):
            name = fetch_filename(b["title"])
            dest = args.kb / f"grade-{b['grade']}-{b['subject']}" / "support-pdfs" / name
            key = book_key(b["grade"], b["subject"], name)
            tag = f"[{i}/{len(books)}] {b['title']}"
            if key in already and not args.rescan:
                print(f"{tag}: already scanned, not fetching")
                continue
            if args.dry_run:
                print(f"{tag}: would fetch {b['url']}")
                continue
            try:
                how = download(b["url"], dest)
            except DownloadError as exc:
                download_failed.append((b["title"], str(exc)))
                print(f"{tag}: FAILED — {exc}")
                continue
            print(f"{tag}: {how}", flush=True)
            work.append((b["grade"], b["subject"], dest))
        if args.dry_run:
            print("\n--dry-run: nothing downloaded or scanned.")
            return 0
    elif args.pdf:
        if not (args.pdf_grade and args.pdf_subject):
            print("--pdf needs --pdf-grade and --pdf-subject", file=sys.stderr)
            return 2
        work = [(args.pdf_grade, args.pdf_subject.lower(), p) for p in args.pdf]
    else:
        if not args.kb.is_dir():
            print(f"no knowledge-base folder at {args.kb}", file=sys.stderr)
            return 2
        for grade, subject, pdf, student in discover(
            args.kb, set(args.grade or []), {s.lower() for s in args.subject or []}
        ):
            if student or args.all_pdfs:
                work.append((grade, subject, pdf))
            else:
                skipped_not_student.append(pdf)

    if not work:
        if args.fetch:
            print("nothing to scan" + (f" — {len(download_failed)} download(s) failed" if download_failed else "") + ".")
            if download_failed:
                print("  If every one says the connection was reset or refused, this network cannot")
                print("  reach nccd.gov.jo; run it from one that can (e.g. a home connection).")
            return 1 if download_failed else 0
        print("no PDFs found to scan.")
        if args.pdf is None and not any(args.kb.glob("grade-*-*/support-pdfs/*.pdf")):
            print("  The PDFs are gitignored: run this on the machine that holds them,")
            print("  or pass --pdf with --pdf-grade and --pdf-subject.")
        return 1

    new_entries: list[dict] = []
    scanned: dict[str, dict] = {}
    unreadable: list[tuple[Path, str]] = []
    not_links: list[tuple[str, int, str]] = []
    zero_code_books: list[str] = []
    today = date.today().isoformat()

    for grade, subject, pdf in work:
        book = book_key(grade, subject, pdf.name)
        if book in already and not args.rescan:
            print(f"skip (already scanned {already[book].get('scannedAt', '?')}): {pdf.name}")
            continue
        print(f"scan: {book}", flush=True)
        try:
            pages, found = scan_pdf(pdf, tuple(args.dpi))
        except Exception as exc:  # noqa: BLE001 — name the file and carry on with the rest
            unreadable.append((pdf, f"{type(exc).__name__}: {exc}"))
            continue
        codes = 0
        for (page, text), dpi in sorted(found.items()):
            if not looks_like_link(text):
                not_links.append((book, page, text[:80]))
                continue
            new_entries.append(make_entry(grade, subject, book, page, text, dpi))
            codes += 1
        scanned[book] = {"pages": pages, "codes": codes, "scannedAt": today}
        if codes == 0:
            zero_code_books.append(book)
        print(f"  {pages} pages, {codes} code(s)")

    added = merge(doc, new_entries, scanned)

    print("\n──── summary ────")
    print(f"books scanned: {len(scanned)}   new rows: {added}   (rows already known: {len(new_entries) - added})")
    if zero_code_books:
        print(f"\n{len(zero_code_books)} book(s) scanned with NO codes (recorded as scanned):")
        for b in zero_code_books:
            print(f"  • {b}")
    if not_links:
        print(f"\n{len(not_links)} payload(s) that were not links, left out:")
        for b, p, t in not_links[:15]:
            print(f"  • {Path(b).name} p.{p}: {t!r}")
    if download_failed:
        print(f"\n{len(download_failed)} book(s) could not be downloaded — NOT recorded as scanned:")
        for title, why in download_failed:
            print(f"  • {title}: {why}")
    if unreadable:
        print(f"\n{len(unreadable)} PDF(s) could not be read — NOT recorded as scanned:")
        for p, why in unreadable:
            print(f"  • {p.name}: {why}")
    if skipped_not_student:
        print(f"\n{len(skipped_not_student)} PDF(s) skipped as not student books (use --all-pdfs to include):")
        for p in skipped_not_student[:10]:
            print(f"  • {p.name}")
        if len(skipped_not_student) > 10:
            print(f"  … and {len(skipped_not_student) - 10} more")
    subjects = sorted({e["subjectId"] for e in new_entries})
    if subjects:
        print(f"\nsubject ids in the new rows: {', '.join(subjects)}")
        print("  If `pnpm --filter @workspace/mobile test` says one is not a catalog subject,")
        print("  add it to SUBJECT_ALIASES in artifacts/mobile/services/bookQrLinks.ts.")

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        return 0
    if not scanned:
        print("\nnothing new scanned: manifest left as it was.")
        return 0 if not (unreadable or download_failed) else 1
    args.manifest.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(f"\nwrote {args.manifest}")
    print("next: pnpm --filter @workspace/curriculum run verify-qr-links")
    return 1 if (unreadable or download_failed) else 0


if __name__ == "__main__":
    sys.exit(main())
