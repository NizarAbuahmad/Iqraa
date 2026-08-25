#!/usr/bin/env python3
"""Index the exercises the NCCD exercise books print, lesson by lesson.

Iqraa's decks say things like «تمارين ١-٦ صفحة ٧٢». Until now that reference
was generated, which means invented: the numbers pointed at nothing. This
script reads the ministry's own exercise books so the reference can be true.

Run:  python3 scripts/extract_book_exercises.py

Writes `knowledge-base/grade-10-math/exercises/<source-id>/index.json`:

    {"sourceId": "math-s1-exercise-book",
     "lessons": [{"page": 10, "unit": 1, "lesson": 1,
                  "titleAr": "...", "titleEn": "Solving Special Equations",
                  "exerciseCount": 18}, ...]}

Why this is a separate script from `extract_book_figures.py`
────────────────────────────────────────────────────────────
The exercise books use nearly the same opener layout as the student books,
which made reusing `lesson_start` tempting. It does not fit: the exercise
books set the lesson NUMBER at y≈52 (semester 1) and y≈64 (semester 2), while
that detector deliberately requires y<60 because a tight number band is what
separates a real opener from a page merely mentioning «الدرس».

Loosening it to fit would have been the second time in this repo that widening
a shared band to accommodate one book silently broke another — the first cost
14 of 32 maths lesson titles. So the exercise books get their own detector and
the student-book one is left exactly as it is.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover - dependency check
    import sys

    sys.exit("pymupdf is required: pip install pymupdf")

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "attached_assets"

# Source id → PDF. Ids match lib/curriculum's g10_sources.json, and unlike the
# student books these filenames tell the truth: the file called `semster_one`
# really does open on «الوحدة 1 المعادلات». Verified by byte size against the
# catalogue as well as by content, because the student books taught us not to
# trust a filename.
BOOKS: dict[str, str] = {
    "math-s1-exercise-book": (
        "2026_MT10_WB1__10th_grade,_math_excersice_book,_semster_one_1785147998882.pdf"
    ),
    "math-s2-exercise-book": (
        "MA_10_WB2_6_11_2025-mather_exccersie_book,_semster_2_1785147998882.pdf"
    ),
}

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_MARKS = re.compile(r"[ً-ْـٰ]")

# «الوحدة» extracts with the number BEFORE the word and a colon between, as
# «:1 الوحدة» — right-to-left text laid out left-to-right. A pattern written in
# reading order matches nothing here; this cost a whole extraction pass once.
UNIT_HEADER = re.compile(r"[:：]?\s*([0-9٠-٩]+)\s*الوحدة")


def _bare(text: str) -> str:
    """`text` with Arabic diacritics stripped, for comparing a keyword."""
    return _MARKS.sub("", text).strip()


def _spans(page: pymupdf.Page):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            yield from line.get("spans", [])


def lesson_header(page: pymupdf.Page) -> dict | None:
    """The lesson this page opens, or None if it opens none.

    The exercise books put «الدرس» at 22pt, the number at 45pt, the Arabic
    title at 19pt and the English title at 19pt below it. The two books differ
    by about 14pt of vertical offset, so the bands are generous — but the
    number must still be large and high, which is what keeps a page that
    merely says «الدرس» in a sentence from matching.
    """
    if not any(
        _bare(s["text"]) == "الدرس"
        and s["size"] >= 20
        and s["bbox"][1] < 110
        for s in _spans(page)
    ):
        return None

    number = None
    title_ar: list[tuple[float, str]] = []
    title_en: list[tuple[float, str]] = []
    for s in _spans(page):
        t = s["text"].strip()
        if not t:
            continue
        if s["size"] >= 40 and s["bbox"][1] < 110 and t.translate(ARABIC_DIGITS).isdigit():
            number = int(t.translate(ARABIC_DIGITS))
        if 17 <= s["size"] <= 21 and 40 < s["bbox"][1] < 115:
            if all(ord(c) < 0x0600 for c in t) and len(t) > 3:
                title_en.append((s["bbox"][1], t))
            elif not all(ord(c) < 0x0600 for c in t):
                title_ar.append((s["bbox"][1], t))
    if number is None:
        return None

    unit = None
    m = UNIT_HEADER.search(_bare(page.get_text()))
    if m:
        unit = int(m.group(1).translate(ARABIC_DIGITS))

    return {
        "lesson": number,
        "unit": unit,
        "titleAr": _join(title_ar) or None,
        "titleEn": _join(title_en) or None,
    }


def _join(parts: list[tuple[float, str]]) -> str:
    """Join spans top-to-bottom, dropping the repeats the text layer emits."""
    out: list[str] = []
    seen: set[str] = set()
    for _, t in sorted(parts):
        t = re.sub(r"\s+", " ", t.strip())
        key = _bare(t)
        if key and key not in seen:
            seen.add(key)
            out.append(t)
    return " ".join(out)


def exercises_on(page: pymupdf.Page) -> list[int]:
    """The exercise numbers printed on this page.

    They are set BOLD at roughly 10-11pt, in whichever family the page uses —
    STIXGeneral in the first-semester book, UniMath in the second. Matching on
    the weight and size rather than the family is what makes one rule work for
    both.

    Callers check the result is a contiguous 1..N. That check is the point: an
    exercise book numbers its questions from 1 with nothing skipped, so a run
    with a gap or a duplicate means the rule caught something else, and the
    honest answer is to record nothing for that page.
    """
    found: set[int] = set()
    for s in _spans(page):
        t = s["text"].strip()
        if (
            t.isdigit()
            and "Bold" in s.get("font", "")
            and 9.5 <= s["size"] <= 11.5
            and s["bbox"][1] > 100
        ):
            n = int(t)
            # A bare `0` is never an exercise number — it is a coefficient or a
            # coordinate set in the same weight. One of these on «الاقتران
            # العكسي» made an otherwise perfect 1..21 look like a gap, and the
            # whole page was discarded for it.
            if n > 0:
                found.add(n)
    return sorted(found)


def contiguous(numbers: list[int]) -> bool:
    """Whether these are exactly 1..N."""
    return bool(numbers) and numbers == list(range(1, len(numbers) + 1))


def check_semester(source_id: str, lessons: list[dict]) -> None:
    """Refuse a book whose units contradict the semester in its id.

    Same invariant the figure extractor enforces: Grade 10 maths teaches units
    1-4 in semester 1 and 5-8 in semester 2. It is cheap here and it is the
    check that would have caught the student books being filed backwards.
    """
    expected = {1: range(1, 5), 2: range(5, 9)}
    semester = 1 if "-s1-" in source_id else 2 if "-s2-" in source_id else None
    if semester is None:
        return
    seen = {l["unit"] for l in lessons if l.get("unit") is not None}
    stray = sorted(u for u in seen if u not in expected[semester])
    if stray:
        raise SystemExit(
            f"{source_id}: semester {semester} should hold units "
            f"{expected[semester].start}-{expected[semester].stop - 1}, but the "
            f"book's own headers say unit(s) {stray}. Check BOOKS."
        )


def index_book(pdf: Path) -> list[dict]:
    doc = pymupdf.open(str(pdf))
    starts: list[tuple[int, dict]] = []
    for n in range(doc.page_count):
        header = lesson_header(doc[n])
        if header:
            starts.append((n + 1, header))

    # A long lesson repeats its header on the next page, so consecutive headers
    # naming the same lesson are one lesson, not two. «جمع المتجهات وطرحها»
    # runs across two pages and was being indexed twice, the second with no
    # exercises at all.
    merged: list[tuple[int, dict]] = []
    for page, header in starts:
        if merged and (merged[-1][1]["unit"], merged[-1][1]["lesson"]) == (
            header["unit"],
            header["lesson"],
        ):
            continue
        merged.append((page, header))

    out: list[dict] = []
    for i, (page, header) in enumerate(merged):
        end = merged[i + 1][0] if i + 1 < len(merged) else doc.page_count + 1
        numbers = exercises_on(doc[page - 1])
        # Follow the run onto continuation pages, but only while it CONTINUES.
        # A continuation picks up at N+1 (19..32 after 1..18); the «تدريب على
        # الاختبارات الدولية» page that can follow a lesson restarts at 1, and
        # is not this lesson's work. Requiring the next page to start exactly
        # where this one stopped tells the two apart without guessing.
        for p in range(page + 1, end):
            nxt = exercises_on(doc[p - 1])
            if nxt and nxt[0] == len(numbers) + 1 and nxt == list(
                range(nxt[0], nxt[0] + len(nxt))
            ):
                numbers = numbers + nxt
            else:
                break
        out.append(
            {
                "page": page,
                "unit": header["unit"],
                "lesson": header["lesson"],
                "titleAr": header["titleAr"],
                "titleEn": header["titleEn"],
                "exerciseCount": len(numbers) if contiguous(numbers) else 0,
                # Recorded so a reader can tell "no exercises printed" from
                # "the rule did not trust what it found".
                "exercisesTrusted": contiguous(numbers),
            }
        )
    return out


def main() -> None:
    for source_id, filename in BOOKS.items():
        pdf = ASSETS / filename
        if not pdf.exists():
            print(f"{source_id}: missing {filename} — skipped")
            continue
        lessons = index_book(pdf)
        check_semester(source_id, lessons)
        outdir = ROOT / "knowledge-base" / "grade-10-math" / "exercises" / source_id
        outdir.mkdir(parents=True, exist_ok=True)
        (outdir / "index.json").write_text(
            json.dumps({"sourceId": source_id, "lessons": lessons}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        trusted = sum(1 for l in lessons if l["exercisesTrusted"])
        total = sum(l["exerciseCount"] for l in lessons)
        print(
            f"{source_id}: {len(lessons)} lessons, {trusted} with trusted "
            f"numbering, {total} exercises → {outdir.relative_to(ROOT)}"
        )


if __name__ == "__main__":
    main()
