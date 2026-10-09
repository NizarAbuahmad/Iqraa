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

    # a PDF that lives outside the repo layout (the Windows "Knowledge Base" tree)
    python scripts/scan_book_qr.py --pdf "C:\\...\\كتاب الطالب لمادة العلوم للصف الرابع الفصل الأول.pdf" \\
        --pdf-grade 4 --pdf-subject science

Then, in this order:

    pnpm --filter @workspace/curriculum run verify-qr-links   # which links answer
    pnpm --filter @workspace/mobile test                       # subject ids resolve

New rows are written with `httpStatus: "unchecked"`, which the app does not show:
a code appears in the library only after the link check has seen it answer.

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
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import unquote, urlparse

REPO = Path(__file__).resolve().parent.parent
KB = REPO / "knowledge-base"
MANIFEST = KB / "book-qr-links.json"

DPIS = (150, 200, 260)
UNCHECKED = "unchecked"

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


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan student books for printed QR codes.")
    ap.add_argument("--kb", type=Path, default=KB, help="knowledge-base folder (default: the repo's)")
    ap.add_argument("--manifest", type=Path, default=MANIFEST)
    ap.add_argument("--grade", type=int, nargs="*", help="only these grades")
    ap.add_argument("--subject", nargs="*", help="only these subject folder suffixes (e.g. science art)")
    ap.add_argument("--pdf", type=Path, nargs="*", help="scan these PDFs instead of walking --kb")
    ap.add_argument("--pdf-grade", type=int, help="grade of the --pdf files")
    ap.add_argument("--pdf-subject", help="subject of the --pdf files, as in the folder name (e.g. science)")
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

    # Work list: (grade, subject, path)
    work: list[tuple[int, str, Path]] = []
    skipped_not_student: list[Path] = []
    if args.pdf:
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
        print("no PDFs found to scan.")
        if args.pdf is None and not any(args.kb.glob("grade-*-*/support-pdfs/*.pdf")):
            print("  The PDFs are gitignored: run this on the machine that holds them,")
            print("  or pass --pdf with --pdf-grade and --pdf-subject.")
        return 1

    already = doc.get("scannedBooks", {})
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
        return 0 if not unreadable else 1
    args.manifest.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(f"\nwrote {args.manifest}")
    print("next: pnpm --filter @workspace/curriculum run verify-qr-links")
    return 1 if unreadable else 0


if __name__ == "__main__":
    sys.exit(main())
