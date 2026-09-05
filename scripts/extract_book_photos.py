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
count in each unit, which is the whole outline. The catalog models one lesson
per unit (see `lib/curriculum/src/catalogs/g10EnglishSem1.ts` for why), so a
page needs only its UNIT number, and that is the reset count. Pages before the
first LESSON header are front matter and yield nothing.

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


def unit_of_page(doc) -> dict[int, int]:
    """Page number (1-based) → unit number, from the LESSON header resets."""
    at: dict[int, int] = {}
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
            at[i + 1] = unit
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
        units = unit_of_page(doc)
        outdir = ROOT / "knowledge-base" / subject / "figures" / source_id
        outdir.mkdir(parents=True, exist_ok=True)

        index, written = [], []
        seen_on_page: dict[int, int] = {}
        skipped_front = 0
        for n, rect, _digest in photos_in(doc):
            unit = units.get(n + 1)
            if unit is None:
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
                "unit": unit,
                # One lesson per unit, so every photo lands on lesson 1 of its
                # unit. Not a placeholder — see the catalog's header for why
                # the seven printed slots are not modelled.
                "lesson": 1,
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
