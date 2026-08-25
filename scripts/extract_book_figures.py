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
    """Yield (page_number, page, rect) for every figure found."""
    doc = pymupdf.open(pdf)
    for n in range(len(doc)):
        page = doc[n]
        seed = axis_seed(page)
        if seed is None:
            continue
        r = with_labels(page, drawing_cluster(page, seed))
        r = pymupdf.Rect(r + (-MARGIN, -MARGIN, MARGIN, MARGIN)) & page.rect
        if r.width < 70 or r.height < 70:
            continue
        yield n, page, r


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
        for n, page, r in figures_in(pdf):
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
                }
            )
        (outdir / "index.json").write_text(
            json.dumps({"sourceId": source_id, "figures": index}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        review_sheet(written, outdir / "_review.png")
        print(f"{source_id}: {len(index)} figures → {outdir.relative_to(ROOT)}")
    print("\nReview each _review.png and delete any crop that grabbed the wrong")
    print("thing before wiring these into the app.")


if __name__ == "__main__":
    main()
