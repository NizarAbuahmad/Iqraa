#!/usr/bin/env python3
"""Cut the coordinate-graph figures out of the NCCD student books.

Why this exists
───────────────
Roughly one question in five in the Grade 10 books is answerable only from a
picture — «يمثل الرسم البياني…», «في الشكل المجاور…». The app can now DRAW the
ones whose equations it can solve (see `curveFromCommand`), but the book also
prints circles, 3-D solids, vector diagrams and scatter plots that no equation
in the stem describes. Those have to come from the book itself.

What a figure is, mechanically
──────────────────────────────
Not an embedded image. The books hold only ~74 rasters across 150 pages, and
those are photographs; every graph is *vector drawing operations*. So a figure
is a cluster of drawing paths, seeded on a pair of axes, plus the small labels
sitting inside it.

Two things this learned the hard way, both visible in the review sheet:

1. **A crossing is not a bounding-box overlap.** The first pass called any long
   horizontal plus any long vertical an axis pair, and the four sides of a
   rectangle satisfy that — a «spot the error» page with two notebook-paper
   boxes came out as a graph. Each segment must pass through the other's
   interior.

2. **Never grow through text.** Growing by proximity over drawings *and* text
   chains from the figure into the body prose and stops only at the page cap;
   half the first run swallowed most of a page. Drawings cluster; text is only
   ever admitted, never chased.

This is assisted, not automatic
───────────────────────────────
About one crop in five still absorbs an adjacent exercise block. That is why
the script writes `_review.png` — a contact sheet of everything it found — and
why nothing here is wired into the app. Look at the sheet, delete the bad
crops, and only then use what is left. A figure printed beside the wrong
question is worse than no figure, which is the whole lesson of the check-slide
work this follows.

Usage
─────
    pip install pymupdf pillow
    python3 scripts/extract_book_figures.py

Writes knowledge-base/<subject>/figures/<source-id>/ plus an index.json and a
_review.png per book.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover - operator-facing
    sys.exit("pymupdf is required: pip install pymupdf")

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "attached_assets"

# Source id → the PDF in attached_assets. Ids match lib/curriculum's
# g10_sources.json so a figure can be traced back to the book it was cut from.
BOOKS: dict[str, tuple[str, str]] = {
    "math-s1-student-book": (
        "grade-10-math",
        "10th_grade,_math,_1st_semester_1785071530816.pdf",
    ),
    "math-s2-student-book": (
        "grade-10-math",
        "10th_grade,_math,_2nd_semester_1785147978008.pdf",
    ),
    "chem-s1-student-book": (
        "grade-10-chemistry",
        "10th_grade,_alchamy1st_semester_1785071530814.pdf",
    ),
}

# A real figure sits in a column; one filling the page is a failed detection.
MAX_W = 0.72
MAX_H = 0.60
# Breathing room on the final crop. Axis tick numbers sit just outside the
# drawing cluster, and cropping flush to it sliced «100» down to «0».
MARGIN = 10
DPI = 160



# ─── Where in the book a figure sits ─────────────────────────────────────────

# RTL: the extracted stream puts the NUMBER BEFORE the word, so the running
# header reads «21  1 الوحدة». A left-to-right `الوحدة\s*(\d+)` matches nothing
# on those pages and silently carries a stale unit forward from an earlier one —
# it reported unit 10 for a unit-1 page, with no error anywhere.
UNIT_HEADER = re.compile(r"([0-9\u0660-\u0669]+)\s*[\u064B-\u065F]?\s*\u0627\u0644\u0648\u062D\u062F\u0629")
ARABIC_DIGITS = str.maketrans("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669", "0123456789")


def _spans(page: pymupdf.Page):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                yield span


def lesson_start(page: pymupdf.Page) -> dict | None:
    """A lesson opener: «الدرس» set at 22pt in the top band, its number at 45pt,
    and titles beneath.

    The English title is the one worth keeping. The Arabic spans come out of
    the PDF with their diacritics reordered and their letters unjoined
    («حُّلُ ُمُعادالٍتٍ»), so they are useless for matching; the English line is
    clean ASCII.

    The bands are loose enough for two different layouts. Maths sets «الدرس»
    at the very top with the number under it; chemistry puts a 58pt number
    first and «الدرس» below the Arabic title. Pinning the tight maths
    coordinates found no chemistry lesson at all.
    """
    if not any(
        s["text"].strip() == "\u0627\u0644\u062F\u0631\u0633" and s["size"] >= 20 and s["bbox"][1] < 60
        for s in _spans(page)
    ):
        return None
    number = None
    # A title can run to a second line — «Trigonometric Ratios for Angles» /
    # «between 0º and 360º». Keeping only the last span kept only the tail,
    # which then matched nothing at all in the curriculum.
    title_parts: list[tuple[float, float, str]] = []
    for s in _spans(page):
        t = s["text"].strip()
        if s["size"] >= 40 and s["bbox"][1] < 60 and t.translate(ARABIC_DIGITS).isdigit():
            number = int(t.translate(ARABIC_DIGITS))
        if 13 <= s["size"] <= 20 and 60 < s["bbox"][1] < 115:
            if t and all(ord(c) < 0x0600 for c in t) and len(t) > 3:
                title_parts.append((round(s["bbox"][1], 1), s["bbox"][0], t))
    title_en = re.sub(r"\s+", " ", " ".join(t for _, _, t in sorted(title_parts))) or None
    return None if number is None else {"lesson": number, "titleEn": title_en}


def outline(doc: pymupdf.Document) -> dict[int, dict]:
    """Map every 1-based page to the lesson it belongs to.

    Lesson openers give the boundaries and the lesson number. The UNIT number
    is read from the running header of a page *inside* the lesson, never the
    opener: on an opener the header still shows the outgoing unit.

    The printed number is what gets recorded, not a position in the sequence.
    The semester-1 book prints units 5–8 and semester-2 prints 1–4, so a
    sequence index would have labelled every semester-1 figure with a unit
    number the book does not use — and a teacher looking for «الوحدة 5» would
    have been shown unit 1.
    """
    lessons: list[dict] = []
    for n in range(len(doc)):
        start = lesson_start(doc[n])
        if start:
            lessons.append({**start, "startPage": n + 1, "unit": None})

    # An outline this thin is not an outline. The chemistry book yielded a
    # single opener, so every figure in it was filed under one lesson spanning
    # fifty pages — titled with that lesson's «الفكرة الرئيسة» line rather than
    # its name. Placing figures on that is worse than leaving them unplaced,
    # because a wrong lesson reads exactly like a right one.
    if len(lessons) < 3:
        return {}

    for i, lesson in enumerate(lessons):
        end = lessons[i + 1]["startPage"] if i + 1 < len(lessons) else len(doc) + 1
        for p in range(lesson["startPage"], end):
            m = UNIT_HEADER.search(doc[p - 1].get_text())
            if m:
                lesson["unit"] = int(m.group(1).translate(ARABIC_DIGITS))
                break

    by_page: dict[int, dict] = {}
    for i, lesson in enumerate(lessons):
        end = lessons[i + 1]["startPage"] if i + 1 < len(lessons) else len(doc) + 1
        for p in range(lesson["startPage"], end):
            by_page[p] = lesson
    return by_page


def _crosses(h: pymupdf.Rect, v: pymupdf.Rect) -> bool:
    """Whether these two segments genuinely intersect, corner cases excluded."""
    hy = (h.y0 + h.y1) / 2
    vx = (v.x0 + v.x1) / 2
    return (
        h.x0 + 0.15 * h.width < vx < h.x1 - 0.15 * h.width
        and v.y0 + 0.15 * v.height < hy < v.y1 - 0.15 * v.height
    )


def axis_seed(page: pymupdf.Page) -> pymupdf.Rect | None:
    """The largest crossed axis pair on the page, or None if there is none."""
    drawings = [d["rect"] for d in page.get_drawings()]
    horizontals = [r for r in drawings if r.width > 60 and r.height < 3]
    verticals = [r for r in drawings if r.height > 60 and r.width < 3]
    best = None
    for h in horizontals:
        for v in verticals:
            if not _crosses(h, v):
                continue
            r = pymupdf.Rect(h) | pymupdf.Rect(v)
            if best is None or r.get_area() > best.get_area():
                best = r
    return best


def drawing_cluster(page: pymupdf.Page, seed: pymupdf.Rect, gap: float = 9) -> pymupdf.Rect:
    """Chain together the drawing rects that touch the seed, and only those."""
    boxes = [pymupdf.Rect(d["rect"]) for d in page.get_drawings()]
    r = pymupdf.Rect(seed)
    changed = True
    while changed:
        changed = False
        for b in boxes:
            if r.contains(b):
                continue
            if not pymupdf.Rect(r + (-gap, -gap, gap, gap)).intersects(b):
                continue
            grown = r | b
            if grown.width < page.rect.width * MAX_W and grown.height < page.rect.height * MAX_H:
                r, changed = grown, True
    return r


def with_labels(page: pymupdf.Page, r: pymupdf.Rect, pad: float = 7) -> pymupdf.Rect:
    """Admit the axis numbers and curve labels already inside the figure.

    A span wider than a quarter of the page is prose, not a label. The overlap
    threshold is 0.6 rather than 0.8 because a tick number straddling the axis
    line is only mostly inside, and demanding more of it clipped the digits.
    """
    area = pymupdf.Rect(r + (-pad, -pad, pad, pad))
    out = pymupdf.Rect(r)
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                sb = pymupdf.Rect(span["bbox"])
                if sb.width > page.rect.width * 0.25:
                    continue
                overlap = sb & area
                if overlap.is_empty or overlap.get_area() < sb.get_area() * 0.6:
                    continue
                grown = out | sb
                if grown.width < page.rect.width * MAX_W and grown.height < page.rect.height * MAX_H:
                    out = grown
    return out


def figures_in(pdf: Path):
    """Yield (page_number, page, rect, lesson) for every figure found."""
    doc = pymupdf.open(pdf)
    where = outline(doc)
    for n in range(len(doc)):
        page = doc[n]
        seed = axis_seed(page)
        if seed is None:
            continue
        r = with_labels(page, drawing_cluster(page, seed))
        r = pymupdf.Rect(r + (-MARGIN, -MARGIN, MARGIN, MARGIN)) & page.rect
        if r.width < 70 or r.height < 70:
            continue
        yield n, page, r, where.get(n + 1)


def review_sheet(paths: list[Path], out: Path) -> None:
    """A contact sheet of every crop, for the human pass this script requires."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("  (pillow missing — skipping review sheet)")
        return
    if not paths:
        return
    cols, cell = 6, 210
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 16)), "white")
    draw = ImageDraw.Draw(sheet)
    for i, p in enumerate(paths):
        im = Image.open(p)
        im.thumbnail((cell - 8, cell - 8))
        x, y = (i % cols) * cell, (i // cols) * (cell + 16)
        sheet.paste(im, (x + 4, y + 4))
        draw.text((x + 6, y + cell + 2), p.stem, fill="black")
        draw.rectangle([x, y, x + cell - 1, y + cell + 14], outline="#cccccc")
    sheet.save(out)


def main() -> None:
    for source_id, (subject, filename) in BOOKS.items():
        pdf = ASSETS / filename
        if not pdf.exists():
            print(f"{source_id}: missing {filename} — skipped")
            continue
        outdir = ROOT / "knowledge-base" / subject / "figures" / source_id
        outdir.mkdir(parents=True, exist_ok=True)
        index, written = [], []
        for n, page, r, lesson in figures_in(pdf):
            name = f"p{n + 1:03d}.png"
            path = outdir / name
            page.get_pixmap(clip=r, dpi=DPI).save(path)
            written.append(path)
            index.append(
                {
                    "file": name,
                    "sourceId": source_id,
                    # 1-based, matching how a teacher cites a page.
                    "pdfPage": n + 1,
                    "rect": [round(v, 1) for v in r],
                    # As PRINTED in the book, so «الوحدة 5» finds unit 5.
                    "unit": lesson["unit"] if lesson else None,
                    "lesson": lesson["lesson"] if lesson else None,
                    "lessonTitleEn": lesson["titleEn"] if lesson else None,
                    "lessonStartPage": lesson["startPage"] if lesson else None,
                }
            )
        (outdir / "index.json").write_text(
            json.dumps({"sourceId": source_id, "figures": index}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        review_sheet(written, outdir / "_review.png")
        placed = sum(1 for f in index if f["unit"] is not None)
        print(f"{source_id}: {len(index)} figures ({placed} placed in a lesson)"
              f" → {outdir.relative_to(ROOT)}")
    print("\nReview each _review.png and delete any crop that grabbed the wrong")
    print("thing before wiring these into the app.")


if __name__ == "__main__":
    main()
