#!/usr/bin/env python3
"""Place figures from a book's CONTENTS SPREAD instead of its lesson openers.

Why this exists
───────────────
`extract_book_figures.outline()` finds lessons by detecting an opener on the
page itself — «الدرس» at a known size with a number beside it. That works for
most of the NCCD series and fails completely for some: Grade 8 vocational and
creative arts, Grade 8 digital literacy («الدرس» on ZERO of its 187 pages),
Grade 6 maths, Grade 8 science S2, Grade 9 history S2. Measured one at a time
through September; the failures are layout, not content, and no threshold
reaches them.

But every one of those books prints a contents spread that lists each lesson
against its page number, and those tables are accurate — checked against Grade
8 social studies, where the opener detector found 15 of 21 lessons and the
contents page listed all 21 with the six missing pages among them.

So this is the same join from the other end: read the table, not the page.

How a row is reconstructed
──────────────────────────
The three parts of a contents row — «الدرس», its «(N)», the title, the page
number — are SEPARATE spans in unrelated text order, and often in different
columns. Reading order pairs them wrongly; only geometry pairs them correctly.
Spans are therefore grouped by the y-centre they share, and `Y_TOLERANCE` is
per-book because the column alignment is not identical across series: Grade 8
vocational sits within 2.4pt, Grade 8 social spreads to about 8.
"""

from __future__ import annotations

import re

import pymupdf

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩",
                              "0123456789")
_MARKS = re.compile(r"[ً-ْـٰ]")
DARS = "الدرس"
WAHDA = "الوحدة"
PAGE_NUM = re.compile(r"^[0-9٠-٩]{1,3}$")
# Unit banner page: «الوحدة الثالثة» set as a heading. The extra spelling of
# «الأولى» is the lam-alef the text extractor hands back for it.
ORDINALS = ["الأولى|الاولى|األولى", "الثانية", "الثالثة", "الرابعة",
            "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"]
UNIT_BANNERS = [re.compile(rf"{WAHDA}\s*(?:{o})") for o in ORDINALS]
BANNER_SIZE = 20.0
# «(1)» in the extracted stream is RTL-reversed to «)1(» as often as not.
LESSON_NUM = re.compile(r"[\(\)]\s*([0-9٠-٩]{1,2})\s*[\(\)]")


def _bare(text: str) -> str:
    return _MARKS.sub("", text).strip()


def _rows(page: pymupdf.Page, tol: float):
    """Spans grouped into visual rows by the y-centre they share."""
    rows: list[dict] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if not span["text"].strip():
                    continue
                y = (span["bbox"][1] + span["bbox"][3]) / 2
                for row in rows:
                    if abs(row["y"] - y) <= tol:
                        row["spans"].append(span)
                        break
                else:
                    rows.append({"y": y, "spans": [span]})
    for row in rows:
        row["spans"].sort(key=lambda s: s["bbox"][0])
    return sorted(rows, key=lambda r: r["y"])


def contents_rows(doc: pymupdf.Document, tol: float = 4.0, scan: int = 14):
    """Every «الدرس» row found on the book's contents pages.

    Returns (page_in_book, lesson_number_or_None, title) tuples in the order
    the table prints them, which is the order the lessons run.
    """
    out: list[tuple[int, int | None, str]] = []
    for n in range(min(scan, doc.page_count)):
        page = doc[n]
        found: list[tuple[int, int | None, str]] = []
        for row in _rows(page, tol):
            text = " ".join(s["text"] for s in row["spans"])
            if DARS not in _bare(text):
                continue
            nums = [s["text"].strip().translate(ARABIC_DIGITS) for s in row["spans"]
                    if PAGE_NUM.match(s["text"].strip().translate(ARABIC_DIGITS))]
            # The page number is the LARGEST plausible number on the row: the
            # lesson number is parenthesised and 1-2 digits, the page is bare.
            pages = [int(x) for x in nums if 1 <= int(x) <= doc.page_count]
            if not pages:
                continue
            m = LESSON_NUM.search(text)
            lesson = int(m.group(1).translate(ARABIC_DIGITS)) if m else None
            title = re.sub(r"\s+", " ", text).strip()
            found.append((max(pages), lesson, title))
        # A real contents page lists several lessons; one stray row is a
        # cross-reference in body text.
        if len(found) >= 3:
            out.extend(found)
    return out


def unit_banner_pages(doc: pymupdf.Document) -> dict[int, int]:
    """{unit number: page} for the full-page banner that opens each unit.

    The contents table lists lessons only, so the unit opener spread — banner
    plus «الفكرة العامة» — falls outside every listed lesson and lands on the
    tail of the PREVIOUS unit's last lesson, which is where the figures on it
    would be filed. Reading the banner puts that spread on the unit it opens.

    A banner page names exactly ONE unit. Without that rule the Grade 8 social
    contents spread, which lists «الوحدة الأولى» through «الوحدة السادسة» on two
    pages, read as six banners on pages 3 and 4 — and since the result is
    inverted to page→unit by its caller, all six collapsed onto one page and
    filed every figure in the book under unit 6.
    """
    at: dict[int, int] = {}
    for n in range(doc.page_count):
        text = _bare(doc[n].get_text())
        hits = [i for i, pattern in enumerate(UNIT_BANNERS, start=1)
                if pattern.search(text)]
        if len(hits) != 1 or hits[0] in at:
            continue
        if any(span["size"] >= BANNER_SIZE
               for block in doc[n].get_text("dict")["blocks"]
               for line in block.get("lines", [])
               for span in line.get("spans", [])
               if WAHDA in _bare(span["text"])):
            at[hits[0]] = n + 1
    return at


def contents_outline(doc: pymupdf.Document, tol: float = 4.0) -> dict[int, dict]:
    """`extract_book_figures.outline()`'s shape, from the contents table.

    A lesson owns every page from its own start up to the next lesson's, which
    is the same span rule the opener-based outline uses. Units are counted from
    the lesson numbering resetting, because a contents spread states the unit
    in a heading row this does not try to read.
    """
    rows = contents_rows(doc, tol)
    if len(rows) < 3:
        return {}
    rows.sort(key=lambda r: r[0])

    banners = unit_banner_pages(doc)
    unit, prev = 1, None
    placed: list[tuple[int, int, int]] = []  # (start page, unit, lesson)
    for start, lesson, _title in rows:
        if lesson is None:
            continue
        if prev is not None and lesson <= prev:
            unit += 1
        prev = lesson
        # A unit's first lesson starts at the banner that opens the unit, so
        # the opener spread is not read as the previous lesson running long.
        banner = banners.get(unit)
        after = placed[-1][0] if placed else 0
        if banner is not None and after < banner < start:
            start = banner
        placed.append((start, unit, lesson))

    at: dict[int, dict] = {}
    for i, (start, u, l) in enumerate(placed):
        end = placed[i + 1][0] if i + 1 < len(placed) else doc.page_count + 1
        for p in range(start, end):
            at[p] = {"unit": u, "lesson": l, "titleEn": None, "titleAr": None,
                     "startPage": start}
    return at


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from extract_book_figures import BOOKS, CONTENTS_PLACEMENT, resolve_pdf
    for sid in sys.argv[1:]:
        # The tolerance extraction will actually use, so the probe and the run
        # cannot disagree — it is per-book, and the default reads several books
        # one row short of their catalog.
        tol = CONTENTS_PLACEMENT.get(sid, 4.0)
        doc = pymupdf.open(resolve_pdf(BOOKS[sid][1]))
        rows = contents_rows(doc, tol)
        at = contents_outline(doc, tol)
        slots = sorted({(v["unit"], v["lesson"]) for v in at.values()})
        print(f"{sid} (tol {tol}): {len(rows)} contents rows -> {len(slots)} lesson slots")
        print(f"    unit banners: {unit_banner_pages(doc)}")
        for u in sorted({u for u, _ in slots}):
            print(f"    u{u}: {[l for uu, l in slots if uu == u]}")
        doc.close()
