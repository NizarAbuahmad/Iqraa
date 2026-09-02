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
the script writes `_review.png` — a contact sheet of everything it found. Look
at the sheet and delete the bad crops before regenerating the asset map. A
figure printed beside the wrong question is worse than no figure, which is the
whole lesson of the check-slide work this follows.

These *are* reachable from the app now (`services/bookFigures.ts` → the slides
path), so a bad crop left in place ships. Deleting a crop means deleting BOTH
the PNG and its `index.json` entry: the bundler map is generated from files
that exist, but `figuresForLesson` reads the index, so pruning only one leaves
the two disagreeing about what the lesson has.

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
#
# THE MATHS FILENAMES ARE BACKWARDS. Read the pairing below carefully before
# "fixing" it: the file called `1st_semester` is the SECOND-semester book and
# vice versa. Both books say so on their own title pages — «الفصل الدراسـي
# الثانـي» appears in the one named 1st_semester — and their contents agree:
# that file holds units 5-8, the other holds units 1-4.
#
# This was got wrong originally, by taking the id from the filename. The ids
# then flowed into every figure's `sourceId`, and from there into a caption
# telling teachers to look in the wrong book. `check_semester` below is the
# guard so it cannot happen quietly again.
BOOKS: dict[str, tuple[str, str]] = {
    "math-s1-student-book": (
        "grade-10-math",
        "10th_grade,_math,_2nd_semester_1785147978008.pdf",
    ),
    "math-s2-student-book": (
        "grade-10-math",
        "10th_grade,_math,_1st_semester_1785071530816.pdf",
    ),
    "chem-s1-student-book": (
        "grade-10-chemistry",
        "10th_grade,_alchamy1st_semester_1785071530814.pdf",
    ),
    # These two are NOT copied into attached_assets/ — that directory predates
    # the 2026-08-30 switch to R2 for source PDFs (see STATUS.md), and adding
    # more large binaries there is the exact git-bloat problem R2 replaced.
    # The figure extractor has no R2 client of its own (only the TS text
    # pipeline does), and this run's *input* PDF doesn't need to be committed
    # or uploaded anywhere — only the small PNGs + index.json it writes do. So
    # these point straight at the local Drive mirror `g10_sources.json`
    # records (`localRoot`). `pathlib` resolves an absolute right-hand side by
    # replacing the left entirely, so `ASSETS / filename` below still works
    # unchanged with these two despite them living well outside `ASSETS`.
    #
    # This only reproduces on a checkout with that mirror at that path —
    # already true of this whole script for anyone besides its author.
    "chem-s2-student-book": (
        "grade-10-chemistry",
        "C:/Users/Lenovo/Downloads/Raya studio/Iqraa/Calude app/Knowledge Base/"
        "10th grade/alchamy/10th grade, alchamy.2nd semester.pdf",
    ),
    "finlit-s1-student-book": (
        "grade-10-finlit",
        "C:/Users/Lenovo/Downloads/Raya studio/Iqraa/Calude app/Knowledge Base/"
        "10th grade/الثقافة المالية 10 ف1 small.pdf",
    ),
    # Grade 9 maths: same local-mirror reasoning as chem-s2/finlit above.
    # Unlike the Grade 10 maths pair, these filenames are NOT swapped — the
    # «الفصل الأول» file's own headers print units 1-4 and «الفصل الثاني»
    # prints units 5-8, matching their names. Checked by content, not assumed
    # from the name, for the same reason the G10 pair's docstring insists on
    # it: a filename is a claim, not a fact.
    "g9-math-s1-student-book": (
        "grade-9-math",
        "C:/Users/Lenovo/Downloads/Raya studio/Iqraa/Calude app/Knowledge Base/"
        "9th grade/Math/كتاب الطالب لمادة الرياضيات الصف التاسع الفصل الأول.pdf",
    ),
    "g9-math-s2-student-book": (
        "grade-9-math",
        "C:/Users/Lenovo/Downloads/Raya studio/Iqraa/Calude app/Knowledge Base/"
        "9th grade/Math/كتاب الطالب لمادة الرياضيات الصف التاسع الفصل الثاني.pdf",
    ),
}

# A real figure sits in a column; one filling the page is a failed detection.
MAX_W = 0.72
MAX_H = 0.60
# Breathing room on the final crop. Axis tick numbers sit just outside the
# drawing cluster, and cropping flush to it sliced «100» down to «0».
MARGIN = 10
# How far the crop may stretch to finish a label it is cutting through, in
# points. Two glyph widths: enough for «J» or «360°», far short of a word of
# body text.
LABEL_REACH = 22
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


# Arabic combining marks (harakat) and the tatweel stretch character. PDF text
# extraction fuses these into the word, so «الدرس» arrives as «ُالدرس» on most
# pages — invisible in a terminal, fatal to an equality test.
_MARKS = re.compile(r"[\u064B-\u0652\u0640\u0670]")


def _bare(text: str) -> str:
    """`text` with Arabic diacritics stripped, for comparing a keyword."""
    return _MARKS.sub("", text).strip()


def _dedupe(parts) -> str:
    """Join spans, dropping the immediate repeats these PDFs emit.

    Every heading appears two or three times in the text layer — once per
    render pass — so a naive join triples the title.
    """
    out: list[str] = []
    seen: set[str] = set()
    for t in parts:
        t = re.sub(r"\s+", " ", t.strip())
        # Compare bare: the repeats differ only by a stray combining mark, so
        # an exact test lets «…الهيدروجين» through twice.
        key = _bare(t)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(t)
    return " ".join(out)


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

    Two things the first version got wrong, both found by running it over
    chemistry and counting rather than by reading it:

    * «الدرس» usually extracts with a vowel mark fused to it — `ُالدرس` — so an
      exact string comparison matched only the pages that happened to also
      carry a clean copy of the span. That was 1 opener out of 6. Diacritics
      are stripped before comparing.
    * Chemistry states no English lesson title this band can reach — what
      sits there is its first SECTION heading. Widening the band to find one
      only nulled 14 maths titles, because the wider band caught Arabic body
      text. The ceiling stays at 115 and chemistry is identified by its
      Arabic title instead.
    * One chemistry opener (unit 3 lesson 2) sets «الدرس» at y=77 where its
      siblings put it at 47, so a `< 60` ceiling found five of six. The ceiling
      is 90. The number band is deliberately left tighter: it is what tells an
      opener apart from a page that merely mentions the word.
    * Grade 9 maths semester 2 sets its number at y=61 — every one of its 13
      openers, not a one-off — where G10's sits above 60. Found by grepping
      the raw spans on a known opener page after `< 60` returned zero openers
      for the whole book. Widened to 65: enough for this book, still well
      short of the 77 that a page merely mentioning «الدرس» could plausibly
      reach in body text.
    """
    if not any(
        _bare(s["text"]) == "\u0627\u0644\u062F\u0631\u0633" and s["size"] >= 20 and s["bbox"][1] < 90
        for s in _spans(page)
    ):
        return None
    number = None
    # A title can run to a second line — «Trigonometric Ratios for Angles» /
    # «between 0º and 360º». Keeping only the last span kept only the tail,
    # which then matched nothing at all in the curriculum.
    title_parts: list[tuple[float, float, str]] = []
    arabic_in_band = False
    heading_parts: list[tuple[float, float, str]] = []
    for s in _spans(page):
        t = s["text"].strip()
        if s["size"] >= 40 and s["bbox"][1] < 65 and t.translate(ARABIC_DIGITS).isdigit():
            number = int(t.translate(ARABIC_DIGITS))
        # The Arabic lesson title: the largest text in the very top band. It is
        # the only identifier chemistry states plainly, and it is what the
        # curriculum's own lesson titles are written in.
        if s["size"] >= 24 and s["bbox"][1] < 60 and t and not all(ord(c) < 0x0600 for c in t):
            heading_parts.append((round(s["bbox"][1], 1), s["bbox"][0], t))
        if 13 <= s["size"] <= 20 and 60 < s["bbox"][1] < 115:
            if not t:
                continue
            if all(ord(c) < 0x0600 for c in t) and len(t) > 3:
                title_parts.append((round(s["bbox"][1], 1), s["bbox"][0], t))
            else:
                arabic_in_band = True

    # An English line sharing this band with Arabic is a SECTION heading, not
    # the lesson's name. Maths puts the English lesson title alone there;
    # chemistry fills the band with its first section — «الخصائص الفيزيائية
    # للمركبات الأيونية» / "Physical Properties of Ionic Compounds" — under a
    # lesson actually called «الصيغ الكيميائية وخصائص المركبات». Recording that
    # as the lesson title is a confident wrong label, so it is refused.
    title_en = (
        None
        if arabic_in_band
        else re.sub(r"\s+", " ", " ".join(t for _, _, t in sorted(title_parts))) or None
    )
    title_ar = _dedupe(t for _, _, t in sorted(heading_parts)) or None
    return (
        None
        if number is None
        else {"lesson": number, "titleEn": title_en, "titleAr": title_ar}
    )


def unit_start(page: pymupdf.Page) -> int | None:
    """The unit number if this page is a UNIT opener, else None.

    Both books announce a unit the same way: «الوحدة» set large in the top
    band with the number larger still beside it. Maths then repeats the unit
    in a running header on every page; chemistry does not repeat it anywhere,
    which is why these pages are the only record of it there.
    """
    if not any(
        _bare(s["text"]) == "\u0627\u0644\u0648\u062D\u062F\u0629"
        and s["size"] >= 30
        and s["bbox"][1] < 60
        for s in _spans(page)
    ):
        return None
    for s in _spans(page):
        t = _bare(s["text"])
        if s["size"] >= 60 and s["bbox"][1] < 130 and t.translate(ARABIC_DIGITS).isdigit():
            return int(t.translate(ARABIC_DIGITS))
    return None


def outline(doc: pymupdf.Document) -> dict[int, dict]:
    """Map every 1-based page to the lesson it belongs to.

    Lesson openers give the boundaries and the lesson number. The UNIT number
    is read from the running header of a page *inside* the lesson, never the
    opener: on an opener the header still shows the outgoing unit.

    The printed number is what gets recorded, not a position in the sequence.
    Each book restarts its lessons at 1, so a running index would number the
    second book's units 1-4 when it prints 5-8. The printed number is what a
    teacher searching for «الوحدة 5» will look for.

    Units 1-4 are semester 1 and 5-8 semester 2 — see `check_semester`, which
    uses exactly that to catch a book filed under the wrong id.
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

    # Unit openers, which are the only statement of the unit in a book without
    # a running header.
    openers = {n + 1: u for n in range(len(doc)) if (u := unit_start(doc[n])) is not None}

    for i, lesson in enumerate(lessons):
        end = lessons[i + 1]["startPage"] if i + 1 < len(lessons) else len(doc) + 1
        for p in range(lesson["startPage"], end):
            # Never read the header off a unit OPENER inside this lesson's
            # span. A lesson runs up to the next lesson, which in the last
            # lesson of a unit means it also contains the NEXT unit's opener —
            # and reading the number there labelled chemistry's «النموذج
            # الميكانيكي الموجي» (unit 1) as unit 2, every unit's last lesson
            # one too high. Maths hides this: its running header is on every
            # ordinary page, so the loop breaks long before reaching an opener.
            if p in openers:
                continue
            m = UNIT_HEADER.search(doc[p - 1].get_text())
            if m:
                lesson["unit"] = int(m.group(1).translate(ARABIC_DIGITS))
                break

    # Books with no running header at all — chemistry — get the unit from the
    # last opener at or before the lesson.
    for lesson in lessons:
        if lesson["unit"] is None:
            before = [p for p in openers if p <= lesson["startPage"]]
            if before:
                lesson["unit"] = openers[max(before)]

    # A book with no running header AND no opener the size/position heuristic
    # can find — financial literacy prints «الوحدة» at 48pt but LOW on a
    # full-page divider (y≈525), not the top-60pt band `unit_start` checks.
    # Every one of these lessons is still unit `None` at this point.
    #
    # Every NCCD book restarts its lesson count at 1 inside each new unit —
    # already true of every subject above — so a `الدرسُ` sequence that drops
    # back to 1 (or merely stops increasing) IS a unit boundary, even when
    # nothing states the unit number itself. This found financial literacy's
    # missed boundary (lesson 5 at page 24, lesson 1 again at page 40) without
    # loosening `unit_start`'s position band — which stays tight on purpose,
    # per its own docstring, to avoid catching body text on a normal page.
    #
    # Guarded to fire only when literally nothing else found a unit anywhere,
    # so a book the two passes above already handle (maths, chemistry) cannot
    # regress: this can only ever turn `None` into a number, never overwrite
    # a real one.
    if all(lesson["unit"] is None for lesson in lessons):
        unit, prev = 1, None
        for lesson in lessons:
            if prev is not None and lesson["lesson"] <= prev:
                unit += 1
            lesson["unit"] = unit
            prev = lesson["lesson"]

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


def curve_seeds(page: pymupdf.Page, gap: float = 6) -> list[pymupdf.Rect]:
    """Clusters of curve drawing, for the figures that have no axes at all.

    `axis_seed` finds graphs, and only graphs: it needs a long horizontal and a
    long vertical that cross. Unit 2 of the maths book is circle geometry —
    circles, chords, tangents, angle marks — and not one of those pages has an
    axis pair. Page 35 carries 108 drawing paths and 109 curve operations, and
    the old seed returned None for all of it, so the whole unit extracted zero
    figures while its exercises («يُمثِّلُ N مركزَ الدائرةِ في الشكلِ المجاورِ»)
    are unanswerable without them.

    A circle is drawn as Bézier curve operations, so those are the signal. Two
    things have to be filtered back out, both learned by looking at the crops:

    - **Rounded panels are curves too.** The «رموز رياضية» callout and the
      yellow theorem box are rounded rectangles, so they seed just as happily
      as a circle does. Width caps miss them — the callout is only 120pt wide.
      What separates them is that a panel is mostly *text* and a diagram is
      mostly *drawing*: measured over three pages, real figures came out at
      1-12% text coverage and every panel at 43-52%.
    - **One page holds several figures.** The exercise pages print four or five
      independent diagrams down the margin. Growing one seed over all of them
      swallows the questions in between, so each cluster stays its own figure.
    """
    W, H = page.rect.width, page.rect.height
    rects: list[pymupdf.Rect] = []
    for d in page.get_drawings():
        if not any(item[0] == "c" for item in d["items"]):
            continue
        r = pymupdf.Rect(d["rect"])
        if r.width < 8 or r.height < 8:
            continue  # dots, bullet glyphs, tick marks on their own
        if r.width > W * 0.55 or r.height > H * 0.55:
            continue  # page furniture: frames, full-width rounded panels
        rects.append(r)

    merged = True
    while merged:
        merged = False
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                if pymupdf.Rect(rects[i] + (-gap, -gap, gap, gap)).intersects(rects[j]):
                    rects[i] = rects[i] | rects.pop(j)
                    merged = True
                    break
            if merged:
                break
    return rects


def text_fraction(page: pymupdf.Page, r: pymupdf.Rect) -> float:
    """How much of a rect is covered by text spans.

    The one measurement that tells a diagram from a callout box. Both are drawn
    with curves; only one is mostly words.
    """
    covered = 0.0
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                overlap = pymupdf.Rect(span["bbox"]) & r
                if not overlap.is_empty:
                    covered += overlap.get_area()
    return covered / max(r.get_area(), 1.0)


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


#: Above this share of text, a curve cluster is a callout panel, not a figure.
MAX_TEXT_SHARE = 0.30


def uncut_labels(page: pymupdf.Page, r: pymupdf.Rect) -> pymupdf.Rect:
    """Finish any label the crop currently slices through.

    `with_labels` admits a label only when most of it already sits inside the
    figure. A point label just outside — «J» on the right of the tangents
    diagram on page 35, «K» at its bottom-left — fails that test, and then the
    margin cuts straight through the glyph. On the projector that reads as a
    broken image rather than a tight crop.

    This is deliberately not a looser `with_labels`. Loosening that admits text
    the crop does not touch, which is how a figure grows into the body prose
    beside it — the failure that once swallowed most of a page. This only
    finishes what is ALREADY being cut, and only when finishing it costs a
    little: a span the crop clips is part of the picture; one it does not touch
    is somebody else's paragraph.
    """
    out = pymupdf.Rect(r)
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if not span["text"].strip():
                    continue
                text = span["text"].strip()
                sb = pymupdf.Rect(span["bbox"])
                # A point label is tiny: measured across these books, «J», «ZT»
                # and «360°» run 0.7-2.4% of the page width, while the shortest
                # line of prose that sits near a figure runs 12%. The gap is
                # wide, so the threshold sits in it rather than near either
                # edge. An 18% ceiling tried first was inside the prose range,
                # and pulled a page of Arabic credits into a crop — Arabic
                # extracts as many short spans, so a character count alone
                # would not have caught it either. Both guards, then.
                if sb.width > page.rect.width * 0.05 or len(text) > 6:
                    continue
                overlap = sb & out
                # Only spans the crop actually cuts: touching it, but not
                # already inside it.
                if overlap.is_empty or out.contains(sb):
                    continue
                grown = out | sb
                # Finishing a label is a small change. Anything that grows the
                # box appreciably is not a label being clipped.
                if (grown.width > out.width + LABEL_REACH
                        or grown.height > out.height + LABEL_REACH):
                    continue
                if (grown.width < page.rect.width * MAX_W
                        and grown.height < page.rect.height * MAX_H):
                    out = grown
    return out


def figures_in(pdf: Path):
    """Yield (page_number, page, rect, lesson) for every figure found.

    Two seed families, and a page can yield several of each. Axis pairs find
    the coordinate graphs this script was written for; curve clusters find the
    geometry — circles, arcs, solids — that has no axes and was therefore
    invisible to it. Seeds that grow into the same region are one figure.
    """
    doc = pymupdf.open(pdf)
    where = outline(doc)
    for n in range(len(doc)):
        page = doc[n]

        seeds: list[tuple[str, pymupdf.Rect]] = []
        axis = axis_seed(page)
        if axis is not None:
            seeds.append(("axis", axis))
        seeds.extend(("curve", c) for c in curve_seeds(page))

        found: list[pymupdf.Rect] = []
        for kind, seed in seeds:
            # Axis seeds are a bare cross and must be grown over the curve and
            # tick paths around them. Curve seeds are already the whole diagram
            # — growing those was what swallowed the yellow theorem panel on
            # page 35 and the «أتذكّر» callout on page 38: the seed was a clean
            # circle, and `drawing_cluster` chained it out through the panel
            # border to the box edge. Visible in the contact sheet as four bad
            # crops in eighteen; not visible in any count.
            r = drawing_cluster(page, seed) if kind == "axis" else pymupdf.Rect(seed)
            r = with_labels(page, r)
            r = pymupdf.Rect(r + (-MARGIN, -MARGIN, MARGIN, MARGIN)) & page.rect
            # After the margin, because the margin is what does the cutting.
            r = uncut_labels(page, r) & page.rect
            if r.width < 70 or r.height < 70:
                continue
            if text_fraction(page, r) > MAX_TEXT_SHARE:
                continue
            # Two seeds inside one diagram — a circle and the axes it sits on —
            # grow to the same place. Keep the first; a near-duplicate crop
            # printed twice beside one question reads as two questions.
            if any(prev.intersects(r) and (prev & r).get_area() > r.get_area() * 0.5
                   for prev in found):
                continue
            found.append(r)

        # Left to right, top to bottom, so the file suffixes follow the page.
        for r in sorted(found, key=lambda b: (round(b.y0), b.x0)):
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


#: Which units each semester holds, per subject. Grade 10 numbers units
#: across the whole year, but subjects disagree on where the year splits:
#: maths runs semester 1 = units 1-4, semester 2 = 5-8; chemistry runs 1-3
#: then 4-5. A single hardcoded pair here (maths's) failed chemistry S2 with
#: "mismatched book" on a correctly-named file — chemistry's own unit 4 read
#: as a stray, because the check assumed semester 2 always starts at 5.
#: A subject missing from this table (financial literacy, which prints no
#: unit headers at all) is simply not checked.
EXPECTED_UNITS: dict[str, dict[int, range]] = {
    "grade-10-math": {1: range(1, 5), 2: range(5, 9)},
    "grade-10-chemistry": {1: range(1, 4), 2: range(4, 6)},
    "grade-9-math": {1: range(1, 5), 2: range(5, 9)},
}


def check_semester(source_id: str, subject: str, index: list[dict]) -> None:
    """Fail loudly if a book's figures carry units its semester cannot hold.

    The units found in a book are proof of which semester it is, and they are
    read from the page headers — content, not the filename.

    That distinction is the whole point. The maths PDFs are named backwards,
    and taking the id from the filename put every semester-1 figure under
    `math-s2-student-book`, which a caption then printed to teachers as the
    wrong book. Nothing failed; the figures were right and only the label was
    wrong, which is exactly the kind of error that survives review.

    A subject with no entry in `EXPECTED_UNITS` (financial literacy) or a book
    whose outline yields no units at all (chemistry S1) is not checked — there
    is nothing to compare against.
    """
    expected = EXPECTED_UNITS.get(subject)
    if expected is None:
        return
    semester = 1 if "-s1-" in source_id else 2 if "-s2-" in source_id else None
    if semester is None:
        return
    seen = {f["unit"] for f in index if f.get("unit") is not None}
    stray = sorted(u for u in seen if u not in expected[semester])
    if stray:
        raise SystemExit(
            f"{source_id}: semester {semester} should hold units "
            f"{expected[semester].start}-{expected[semester].stop - 1}, "
            f"but the book's own headers say unit(s) {stray}. "
            f"The source id and the PDF are mismatched — check BOOKS."
        )


def main() -> None:
    for source_id, (subject, filename) in BOOKS.items():
        pdf = ASSETS / filename
        if not pdf.exists():
            print(f"{source_id}: missing {filename} — skipped")
            continue
        outdir = ROOT / "knowledge-base" / subject / "figures" / source_id
        outdir.mkdir(parents=True, exist_ok=True)
        index, written = [], []
        # A page can now yield several figures, so the page number alone is no
        # longer a unique name. The first keeps the bare `p035.png` it has
        # always had; the rest get a letter. Filenames are referenced from the
        # generated asset map, not from the lesson map, so this churns only
        # what `gen_book_figure_assets.mjs` regenerates.
        seen_on_page: dict[int, int] = {}
        for n, page, r, lesson in figures_in(pdf):
            k = seen_on_page.get(n, 0)
            seen_on_page[n] = k + 1
            suffix = "" if k == 0 else chr(ord("b") + k - 1)
            name = f"p{n + 1:03d}{suffix}.png"
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
                    # Chemistry states no English lesson title the opener band
                    # can reach, so the Arabic one is its only identifier — and
                    # it is what the curriculum's titles are written in anyway.
                    "lessonTitleAr": lesson.get("titleAr") if lesson else None,
                    "lessonStartPage": lesson["startPage"] if lesson else None,
                }
            )
        check_semester(source_id, subject, index)
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
