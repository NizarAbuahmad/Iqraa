#!/usr/bin/env python3
"""Cut the photographs out of the NCCD English student books.

Why this is a second script and not a flag on the first
──────────────────────────────────────────────────────
`extract_book_figures.py` seeds on *vector drawing operations* — a pair of
axes, a cluster of Bézier curves — because its books draw their diagrams.
That is the wrong instrument here, measured before this file was written:
across 60 pages the English student book carries ~3.4k vector ops against
physics's ~509k. Its content is photographs, embedded as raster XObjects,
which that detector ignores completely.

So the detector is the opposite one: enumerate the embedded rasters and throw
away the page furniture. Everything downstream — the `index.json` shape, the
`p###.png` naming, the `_review.png` contact sheet, the human pass that
follows — is deliberately identical, so `bookFigures.ts` reads these with no
idea they came from a different pipeline.

What "page furniture" means for these books
───────────────────────────────────────────
Three filters, each earning its place on measured counts, not taste:

1. **Repetition.** A raster used on many pages is a border, a logo or a
   section wash by definition. The cutoff is deliberately loose (see
   MAX_REUSE) because a genuine photo can legitimately appear twice — once in
   a reading text and once in the exercise that refers back to it.
2. **Size.** Icons, bullets and rules are small. A photo that illustrates a
   reading passage is not.
3. **Shape.** A raster far wider than it is tall (or the reverse) at these
   sizes is a rule, a banner or a page-edge gradient.

What it cannot do is judge whether a photo is *useful*, so — exactly as with
the vector extractor — it writes `_review.png` and the crops must be looked at
before they are wired into the app.

Placement
─────────
These books print «LESSON 1A».."7A" at 18pt in the page header and restart the
count in each unit, which is the whole outline: the RESET gives the unit and
the header itself gives the lesson. `where_of_page` returns both.

It returned the unit alone until 2026-09-13 and stamped every crop `lesson: 1`.
That was exact while the catalog modelled a unit as one lesson; the 2026-09-10
catalogs carry the seven the book prints, which left six of every seven photos
filed under a lesson they do not come from. Pages before the first LESSON
header are front matter and yield nothing.

Usage
─────
    pip install pymupdf pillow
    IQRAA_PDF_ROOT=/path/to/checkout python3 scripts/extract_book_photos.py

Writes knowledge-base/grade-10-english/figures/<source-id>/ plus an index.json
and a _review.png per book.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover - operator-facing
    sys.exit("pymupdf is required: pip install pymupdf")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_book_figures import DPI, review_sheet  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PDF_ROOT = Path(os.environ.get("IQRAA_PDF_ROOT") or ROOT)

KB = "knowledge-base/grade-10-english/support-pdfs/"
KB_G9 = "knowledge-base/grade-9-english/support-pdfs/"
# Grade 8 has no `knowledge-base/` tree and no manifest row; the id below is
# the one a manifest row would have to use, so adding one later needs no
# rename (`g9-physics-s1-student-book` had to be renamed once for exactly
# that reason).
MIRROR_G8 = ("C:/Users/Lenovo/Downloads/Raya studio/Iqraa/Calude app/"
             "Knowledge Base/8th grade/English/")
MIRROR_G7 = ("C:/Users/Lenovo/Downloads/Raya studio/Iqraa/Calude app/"
             "Knowledge Base/7th grade/")

BOOKS: dict[str, tuple[str, str]] = {
    "eng-s1-student-book": (
        "grade-10-english",
        KB + "كتاب الطالب لمادة اللغة الإنجليزية الصف العاشر الفصل الأول.pdf",
    ),
    # NOTE: the semester-2 book is stamped «نسخة قيد الإعداد والتجهيز» on 79 of
    # its 80 pages — a draft. Its crops are as provisional as its text; see the
    # matching note in iqra_curriculum_g10_english_sem2.json's known_gaps.
    "eng-s2-student-book": (
        "grade-10-english",
        KB + "كتاب الطالب لمادة اللغة الإنجليزية الصف العاشر الفصل الثاني.pdf",
    ),
    # ── Grades 9 and 8, added 2026-09-13 ─────────────────────────────────────
    # Same series and same «LESSON 1A» header as Grade 10, and their catalogs
    # carry the same five units of seven lessons — so they need no new
    # detection, only these rows.
    "g9-english-s1-student-book": (
        "grade-9-english",
        KB_G9 + "كتاب الطالب لمادة اللغة الإنجليزية الصف التاسع الفصل الأول.pdf",
    ),
    "g9-english-s2-student-book": (
        "grade-9-english",
        KB_G9 + "كتاب الطالب لمادة اللغة الإنجليزية الصف التاسع الفصل الثاني.pdf",
    ),
    "g8-english-s1-student-book": (
        "grade-8-english",
        MIRROR_G8 + "كتاب الطالب لمادة اللغة الإنجليزية للصف الثامن الفصل الأول.pdf",
    ),
    "g8-english-s2-student-book": (
        "grade-8-english",
        MIRROR_G8 + "كتاب الطالب لمادة اللغة الإنجليزية للصف الثامن الفصل الثاني.pdf",
    ),
    # ── Grade 7, added 2026-09-13 ────────────────────────────────────────────
    # Same series, but NOT the same shape as the other three grades: its
    # catalog is FOUR units of nine lessons where 8, 9 and 10 are five of
    # seven, and its semester-2 units are numbered 5-8, so the map offset is
    # +4 rather than +5. Copying either from a sibling grade would file every
    # semester-2 photo one unit out.
    "g7-english-s1-student-book": (
        "grade-7-english",
        MIRROR_G7 + "كتاب الطالب لمادة اللغة الإنجليزية للصف السابع الفصل الأول.pdf",
    ),
    "g7-english-s2-student-book": (
        "grade-7-english",
        MIRROR_G7 + "كتاب الطالب لمادة اللغة الإنجليزية للصف السابع الفصل الثاني.pdf",
    ),
}

# A raster on more than this many pages is furniture. Two is a real photo
# reused by an exercise; a border runs to dozens.
MAX_REUSE = 3
# Below this it is an icon, a bullet or a rule.
MIN_W, MIN_H = 220, 165
# A photo is not a 12:1 strip. Catches page-edge gradients and banner rules.
MAX_ASPECT = 4.0
# Enough pixels to be worth a slide; excludes thumbnails that survived above.
MIN_PIXELS = 60_000


# Grade 7 prints a different book under the same series name, measured
# 2026-09-13. Three differences, and each one alone corrupts the placement:
#
#   * its header is «Lesson 7» at 15pt, not «LESSON 7A» at 18pt;
#   * its BODY text cross-references lessons — «Read the dialogue in Lesson 2»
#     — at 13-14pt. Counted as headers, those produced 17 units for a 4-unit
#     book. Measured: 94 header spans at 15pt against 3 at 13-14pt, so the
#     size gate separates them cleanly. Gate at 14.5, NOT 15: the headers
#     measure 14.999968528747559pt, so `>= 15` excludes every one of them and
#     the book silently yields nothing;
#   * its lesson numbers run 1,2,3,5,6,8,9,10,11 — nine per unit WITH GAPS —
#     so "the number went down" is not a unit boundary here. The boundary is
#     «In this unit I will …», which appears exactly 4 times in each semester
#     book, matching the catalog.
#
# The gaps need no remapping: the catalog carries the printed numbers verbatim
# as `order`, gaps included.
G7_UNIT_MARK = re.compile(r"In this unit I will", re.I)
G7_LESSON = re.compile(r"Lesson\s*(\d+)\.?", re.I)


def where_of_page_g7(doc) -> dict[int, tuple[int, int]]:
    """Grade 7's variant of `where_of_page`. See G7_UNIT_MARK above."""
    at: dict[int, tuple[int, int]] = {}
    unit, lesson = 0, None
    for i, page in enumerate(doc):
        if G7_UNIT_MARK.search(page.get_text()):
            unit, lesson = unit + 1, None
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    m = G7_LESSON.fullmatch(" ".join(span["text"].split()))
                    if m and span["size"] >= 14.5:
                        lesson = int(m.group(1))
        if unit and lesson:
            at[i + 1] = (unit, lesson)
    return at


# Books whose placement needs the variant above rather than the default.
WHERE_OVERRIDES = {
    "g7-english-s1-student-book": where_of_page_g7,
    "g7-english-s2-student-book": where_of_page_g7,
}


def where_of_page(doc) -> dict[int, tuple[int, int]]:
    """Page number (1-based) → (unit, lesson), from the LESSON headers.

    The unit comes from the header RESETS — «LESSON 1A» starting over is a new
    unit, which is the only statement of the unit these books make. The lesson
    is the header itself, and taking it is the whole difference between this
    and the version that shipped on 2026-09-05.

    That version returned the unit alone and every crop was stamped
    `lesson: 1`. It was exact while the catalog modelled a unit as ONE lesson;
    since 2026-09-10 the catalogs carry the seven the book prints, so stamping
    1 put six of every seven photos on a lesson they do not come from — a
    wrong lesson, which reads exactly like a right one. The number was being
    parsed and discarded on the line below.

    A page with no header inherits the last one seen, which is what carries a
    lesson across its own continuation pages.
    """
    at: dict[int, tuple[int, int]] = {}
    unit, prev = 0, None
    for i, page in enumerate(doc):
        nums = set()
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    m = re.search(r"LESSON\s*(\d+)", " ".join(span["text"].split()), re.I)
                    if m and span["size"] >= 13:
                        nums.add(int(m.group(1)))
        for num in sorted(nums):
            if prev is None or num <= prev:
                unit += 1
            prev = num
        if unit:
            at[i + 1] = (unit, prev)
    return at


def photos_in(doc):
    """Yield (page_index, rect, digest) for each raster worth keeping."""
    # First pass: how often each distinct image is used anywhere in the book.
    uses: Counter[str] = Counter()
    digest_of: dict[int, str] = {}
    for page in doc:
        for img in page.get_images(full=True):
            xref = img[0]
            if xref not in digest_of:
                try:
                    digest_of[xref] = hashlib.md5(doc.extract_image(xref)["image"]).hexdigest()
                except Exception:
                    digest_of[xref] = ""
            if digest_of[xref]:
                uses[digest_of[xref]] += 1

    seen_here: set[tuple[int, str]] = set()
    for i, page in enumerate(doc):
        for img in page.get_images(full=True):
            xref = img[0]
            digest = digest_of.get(xref) or ""
            if not digest or uses[digest] > MAX_REUSE:
                continue
            # The same image can be placed twice on one page (a bleed and a
            # crop of it); one is enough.
            if (i, digest) in seen_here:
                continue
            for rect in page.get_image_rects(xref):
                w, h = rect.width, rect.height
                if w < MIN_W or h < MIN_H:
                    continue
                if max(w, h) / max(1.0, min(w, h)) > MAX_ASPECT:
                    continue
                if w * h < MIN_PIXELS:
                    continue
                seen_here.add((i, digest))
                yield i, rect, digest
                break


def main() -> None:
    only = set(sys.argv[1:])
    unknown = only - BOOKS.keys()
    if unknown:
        sys.exit(f"unknown source id(s): {', '.join(sorted(unknown))}")

    for source_id, (subject, filename) in BOOKS.items():
        if only and source_id not in only:
            continue
        pdf = PDF_ROOT / filename
        if not pdf.exists():
            print(f"{source_id}: missing {filename} — skipped")
            continue

        doc = pymupdf.open(pdf)
        where = WHERE_OVERRIDES.get(source_id, where_of_page)(doc)
        outdir = ROOT / "knowledge-base" / subject / "figures" / source_id
        outdir.mkdir(parents=True, exist_ok=True)

        index, written = [], []
        seen_on_page: dict[int, int] = {}
        skipped_front = 0
        for n, rect, _digest in photos_in(doc):
            at = where.get(n + 1)
            if at is None:
                # Before the first LESSON header: cover, contents, credits.
                skipped_front += 1
                continue
            k = seen_on_page.get(n, 0)
            seen_on_page[n] = k + 1
            name = f"p{n + 1:03d}{'' if k == 0 else chr(ord('b') + k - 1)}.png"
            path = outdir / name
            doc[n].get_pixmap(clip=rect, dpi=DPI).save(path)
            written.append(path)
            index.append({
                "file": name,
                "sourceId": source_id,
                "pdfPage": n + 1,
                "rect": [round(v, 1) for v in rect],
                "unit": at[0],
                "lesson": at[1],
                "lessonTitleEn": None,
                "lessonTitleAr": None,
                "lessonStartPage": None,
            })

        (outdir / "index.json").write_text(
            json.dumps({"sourceId": source_id, "figures": index},
                       ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8")
        review_sheet(written, outdir / "_review.png")
        note = f", {skipped_front} before the first lesson skipped" if skipped_front else ""
        print(f"{source_id}: {len(index)} photos ({len(set(f['unit'] for f in index))} units{note})"
              f" → {outdir.relative_to(ROOT)}")
        doc.close()

    print("\nReview each _review.png and delete any crop that is decoration")
    print("rather than content before wiring these into the app.")


if __name__ == "__main__":
    main()
