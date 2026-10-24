"""
Finds the page each curriculum lesson opens on, in subjects whose books print no
figure captions — Arabic, Islamic, physical education, digital skills, civic
education — so the lesson's own pages can be shown.

Why not the figure extractor's lesson outline
─────────────────────────────────────────────
`extract_book_figures.outline()` looks for «الدرس (n)» on the opener page and
`contents_outline.py` reads a contents table of «الدرس» rows. These five series
print neither: Islamic prints a unit/lesson/page table with no «الدرس», Arabic
and civic put the table elsewhere, the digital books print an outline of topics.
(`contents_outline.py` found 0 lesson slots on all five books it was tried on.)

What every one of them does print is the lesson's TITLE, in the largest type on
its opener page, and the curriculum catalog carries the same title (for Islamic
it was lifted from this very book). So this reads the title: the text set within
`BAND` points of each page's largest type, compared with every lesson title.

Comparing letters, not strings. The text layer of these books is scrambled the
same way across the NCCD series — «المسلم» comes out «املسلم», «تجاه» «جتاه»,
«في» «يف», «الإسلامي» «اإلسالمي» — so no string comparison survives it. A letter
BAG (a multiset of the Arabic letters after folding the alef, ya and ta-marbuta
variants and dropping diacritics) is untouched by every one of those swaps, and
two different titles of this size rarely share a bag.

Order is the second signal: a book's lessons run in the catalog's order, so a
page is only a candidate for lesson N if it lies after lesson N-1's. That is
what lets a title the text layer cannot read (a Quran lesson whose title is a
verse range) be found anyway, between its neighbours, or left unmapped.

Unmapped is the right answer when unsure. A lesson with no confident opener gets
no pages and the app shows nothing for it, which is what it did before; a wrong
page range would show another lesson's pages in front of a class.

    IQRAA_PDF_ROOT=/path/to/checkout/holding/the/pdfs \\
        python scripts/map_lesson_pages.py <books.json> <out.json> [sourceId ...]

`books.json` is the dump `scripts/dump_lesson_titles.mjs` writes.
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from collections import Counter

import fitz  # PyMuPDF

# "dict" extraction carries every image's bytes by default, which made one 150-page
# book take over a minute; the title is text, so ask for text only.
TEXT_FLAGS = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES

MARKS = re.compile(r"[ً-ٰٟـۖ-ۭ]")
KEEP = re.compile(r"[^ء-ي0-9a-zA-Z]")
FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"})

# Type within this many points of the page's largest counts as its heading.
BAND = 2.5
# A page whose heading holds more than this many times the title's letters is a
# contents page or a body page, not an opener.
MAX_EXTRA = 2.2
# Title-letter overlap needed to call a page a lesson's opener, and to accept a
# weaker match found only because it sits between two confident neighbours.
SURE = 0.90
BETWEEN = 0.60
# A lesson never runs longer than this in the app (matches verify_book_pages.py).
MAX_PAGES = 20


def norm(text: str) -> str:
    # NFKC first: several books set their text in Arabic Presentation Forms («ﺑ», «ﻻ»),
    # which are different code points from the letters they draw.
    text = unicodedata.normalize("NFKC", text)
    text = MARKS.sub("", text).replace("ﷺ", "").translate(FOLD)
    return KEEP.sub("", text)


def bag(text: str) -> Counter:
    return Counter(norm(text))


def overlap(title: Counter, heading: Counter) -> float:
    n = sum(title.values())
    return sum(min(c, heading.get(ch, 0)) for ch, c in title.items()) / n if n else 0.0


# Type within these many points of the page's largest counts as its heading. The
# narrow bands matter where the body text is set almost as large as the title
# (Grade 9 Islamic: 15.8 pt body under a 17.9 pt title) — at 2.5 points the whole
# paragraph is "heading" and the title drowns.
BANDS = (0.5, 1.5, 2.5)


def heading_bags(page: fitz.Page) -> list[Counter]:
    spans = [
        sp
        for block in page.get_text("dict", flags=TEXT_FLAGS)["blocks"]
        for line in block.get("lines", [])
        if abs(line["dir"][1]) < 0.1  # a diagonal «draft copy» watermark is set at 72 pt
        for sp in line.get("spans", [])
        if sp["text"].strip()
    ]
    if not spans:
        return []
    top = max(sp["size"] for sp in spans)
    # A lesson number set in huge type («2» at 24 pt over a 19 pt title) would
    # otherwise be the whole heading, so the title is also looked for under the
    # largest span that holds a word.
    words = [sp["size"] for sp in spans if len(norm(sp["text"])) >= 4]
    tops = {top, max(words)} if words else {top}
    return [
        bag(" ".join(sp["text"] for sp in spans if sp["size"] >= ref - band))
        for ref in sorted(tops, reverse=True)
        for band in BANDS
    ]


def score_page(title: Counter, headings: list[Counter]) -> float:
    """The best a page's heading, at any of the bands, resembles the title."""
    best = 0.0
    arabic_title = any("ء" <= c <= "ي" for c in title)
    for heading in headings:
        if arabic_title:
            # «التشفير» over «(Encryption)» in the same size is still the title
            heading = Counter({c: n for c, n in heading.items() if not c.isascii() or c.isdigit()})
        if not heading or sum(heading.values()) > MAX_EXTRA * max(1, sum(title.values())):
            continue
        best = max(best, overlap(title, heading))
    return best


def locate(doc: fitz.Document, titles: list[str], unit_sizes: list[int] | None = None) -> list[dict]:
    """One {page, score, how} per title, in order; page None when unsure."""
    tbags = [bag(t) for t in titles]
    heads = [heading_bags(doc[n]) for n in range(doc.page_count)]

    # Pass 1 — a monotonic walk taking, for each lesson, the best page at or
    # after the previous confident one. First page that reaches SURE wins, so a
    # later repeat of the title (a review page) cannot steal it.
    found: list[dict] = [{"page": None, "score": 0.0, "how": None} for _ in titles]
    floor = 0
    for i, tb in enumerate(tbags):
        best, at = 0.0, None
        for n in range(floor, doc.page_count):
            s = score_page(tb, heads[n])
            if s > best + 1e-9:
                best, at = s, n
            if best >= 0.97:
                break
        if at is not None and best >= SURE:
            found[i] = {"page": at + 1, "score": round(best, 2), "how": "title"}
            floor = at + 1

    # Pass 2 — a lesson with no confident opener is looked for only between the
    # confident pages on either side of it.
    for i, tb in enumerate(tbags):
        if found[i]["page"] is not None:
            continue
        lo = next((found[j]["page"] for j in range(i - 1, -1, -1) if found[j]["page"]), 0)
        hi = next((found[j]["page"] for j in range(i + 1, len(titles)) if found[j]["page"]), doc.page_count + 1)
        best, at = 0.0, None
        for n in range(lo, hi - 1):  # pages lo+1 .. hi-1 (1-based), so 0-based lo .. hi-2
            s = score_page(tb, heads[n])
            if s > best + 1e-9:
                best, at = s, n
        if at is not None and best >= BETWEEN:
            found[i] = {"page": at + 1, "score": round(best, 2), "how": "between"}
    # The labelled table when its shape fits the curriculum; failing that, the bare
    # column of page numbers, believed only through the book's own footers.
    ordinal = contents_table(doc)
    out = with_table(found, ordinal, unit_sizes, doc) if ordinal else found
    if out is found:
        out = with_table(found, numeric_table(doc, unit_sizes), unit_sizes, doc, need_vouch=True)
    return out


# ── The printed contents table ───────────────────────────────────────────────
# Some series name their lessons by SKILL («أستمع بانتباه وتركيز», «أتحدث بطلاقة:
# …») and repeat the same few names in every unit, so a title cannot place them
# — but they print a contents table with a «الدرس الأول / الثاني / …» label per
# lesson and its page number beside it. Read by geometry: the label and the page
# number are separate spans in the same row.
# "اول" is not a substring of the folded «الأول» (ا ل ا و ل), so the first is matched on "ول";
# no other ordinal below contains it.
ORDINALS = ["ول", "ثاني", "ثالث", "رابع", "خامس", "سادس", "سابع", "ثامن", "تاسع", "عاشر"]
_TATWEEL = re.compile("ـ")
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _bare(text: str) -> str:
    return norm(_TATWEEL.sub("", text))


def contents_table(doc: fitz.Document, scan: int = 12, tol: float = 7.0) -> list[dict]:
    """[{unit, lesson, page}] read from «الدرس <ordinal>» rows, in book order.

    A unit is a run of lessons whose ordinal starts again from the first. Rows
    with no readable page number are dropped, never guessed.
    """
    rows: list[dict] = []
    for n in range(min(scan, doc.page_count)):
        lines = []
        for block in doc[n].get_text("dict", flags=TEXT_FLAGS)["blocks"]:
            for line in block.get("lines", []):
                text = "".join(sp["text"] for sp in line["spans"]).strip()
                if text:
                    lines.append({"y": (line["bbox"][1] + line["bbox"][3]) / 2, "x": line["bbox"][0], "text": text})
        numbers = [l for l in lines if re.fullmatch(r"[0-9٠-٩]{1,3}", l["text"].translate(_DIGITS))]
        found = []
        for l in lines:
            b = _bare(l["text"])
            if not b.startswith("الدرس") or len(b) > 14:
                continue
            ordinal = next((i for i, w in enumerate(ORDINALS) if w in b[5:]), None)
            near = [m for m in numbers if abs(m["y"] - l["y"]) <= tol]
            if ordinal is None or not near:
                continue
            page = int(near[0]["text"].translate(_DIGITS))
            if 1 <= page <= doc.page_count:
                found.append({"ordinal": ordinal + 1, "page": page, "y": l["y"], "sheet": n})
        # a real contents page lists several lessons; one stray label is body text
        if len(found) >= 3:
            rows.extend(sorted(found, key=lambda r: r["y"]))
    out, unit, prev = [], 0, 99
    for r in rows:
        if r["ordinal"] <= prev:
            unit += 1
        prev = r["ordinal"]
        out.append({"unit": unit, "lesson": r["ordinal"], "page": r["page"]})
    return out


def printed_pages(doc: fitz.Document) -> dict[int, int]:
    """{number printed in a page's footer: 1-based PDF page}.

    A contents table lists PRINTED page numbers, and a book with a cover, a
    foreword and a contents spread before «1» has them a few pages off the PDF's.
    Reading the footers settles it from the book itself instead of from a guess:
    the digits survive even where the Arabic around them is scrambled. The first
    page to print a number keeps it, and only a footer-sized number in the bottom
    tenth of the page counts.
    """
    out: dict[int, int] = {}
    for n in range(doc.page_count):
        page = doc[n]
        floor = page.rect.height * 0.9
        here = []
        for block in page.get_text("dict", flags=TEXT_FLAGS)["blocks"]:
            for line in block.get("lines", []):
                text = "".join(sp["text"] for sp in line["spans"]).strip().translate(_DIGITS)
                if re.fullmatch(r"[0-9]{1,3}", text) and line["bbox"][1] >= floor:
                    here.append(int(text))
        # A page with several numbers down there is a table or a list of page
        # references, not a footer; only a page with exactly one is believed.
        if len(here) == 1:
            out.setdefault(here[0], n + 1)
    return out


def numeric_table(doc: fitz.Document, unit_sizes: list[int] | None, scan: int = 12) -> list[dict]:
    """[{unit, lesson, page}] from a contents page that is only a column of page
    numbers (some titles are not text at all, or are set in presentation forms
    no string comparison reads).

    The column lists a heading page for each unit and then each lesson's page, or
    just the lessons' pages; either must account for EVERY number against the
    catalog's unit shape or nothing is returned. Printed on the left of a
    right-to-left page (x under a quarter of the width); the numbers have to rise.
    """
    if not unit_sizes:
        return []
    nums: list[int] = []
    for n in range(min(scan, doc.page_count)):
        width = doc[n].rect.width
        found = []
        for block in doc[n].get_text("dict", flags=TEXT_FLAGS)["blocks"]:
            for line in block.get("lines", []):
                text = "".join(sp["text"] for sp in line["spans"]).strip().translate(_DIGITS)
                m = re.match(r"^([0-9]{1,3})(?![0-9])", text)
                if m and line["bbox"][0] < 0.25 * width and 1 <= int(m.group(1)) <= doc.page_count:
                    found.append((line["bbox"][1], int(m.group(1))))
        # The contents page's own footer number («4» at the bottom of page 4) is not a
        # row: a number in the bottom tenth with nothing within 45 pt above it.
        floor = 0.9 * doc[n].rect.height
        found = [(y, v) for y, v in found
                 if y < floor or any(0 < y - y2 <= 45 for y2, _ in found)]
        if len(found) >= 6:  # a contents page, not a page number in a margin
            nums.extend(v for _, v in sorted(found))
    # The contents order IS the book order, and a unit heading set a line or two
    # off the others' baseline can come back out of order, so sort; a repeated
    # number cannot be a start page and fails the whole table.
    nums.sort()
    if any(b <= a for a, b in zip(nums, nums[1:])):
        return []
    lessons, units = sum(unit_sizes), len(unit_sizes)
    # Trailing extras (an appendix, a glossary) are tolerated up to three; which of
    # the two layouts it is follows from the count, since the ranges do not overlap.
    out: list[dict] = []
    if lessons + units <= len(nums) <= lessons + units + 3:
        header, nums = True, nums[: lessons + units]
    elif lessons <= len(nums) < lessons + units:
        header, nums = False, nums[:lessons]
    else:
        return []
    i = 0
    for u, size in enumerate(unit_sizes, start=1):
        if header:
            i += 1  # the unit's own heading page
        for k in range(1, size + 1):
            out.append({"unit": u, "lesson": k, "page": nums[i]})
            i += 1
    return out


def with_table(found: list[dict], table: list[dict], unit_sizes: list[int] | None, doc: fitz.Document,
               need_vouch: bool = False) -> list[dict]:
    """The printed contents table's pages, when it describes THIS curriculum book.

    Used only when the table has exactly the curriculum's shape — the same number
    of units and the same number of lessons in each — because a table that lists a
    lesson the catalog merges (or the reverse) cannot be lined up row for row.
    The printed number is then trusted over a title match, after one check: where
    a title WAS found with confidence it must agree with the table, to a constant
    offset (a cover page before page 1), or the table is not believed at all.
    """
    page_count = doc.page_count
    if not table or not unit_sizes:
        return found
    shape = [sum(1 for r in table if r["unit"] == u) for u in sorted({r["unit"] for r in table})]
    if shape != unit_sizes:
        return found
    pages = [r["page"] for r in table]
    if need_vouch:
        # Read through the book's own footers. The printed numbers must turn up as
        # footers at one constant distance from their PDF pages (a cover, a
        # foreword); a stray one — the table's own last row, read as the footer of
        # the page it sits on — lands off that distance and is ignored. No title
        # has to vouch for a table the footers confirm.
        footer = printed_pages(doc)
        gaps = Counter(footer[p] - p for p in pages if p in footer)
        if gaps:
            offset, votes = gaps.most_common(1)[0]
            if votes >= 0.8 * len(pages) and all(0 < pages[i] + offset <= page_count for i in range(len(pages))):
                return [{"page": pages[i] + offset, "score": 1.0, "how": "table"} for i in range(len(found))]
    diffs = Counter(f["page"] - pages[i] for i, f in enumerate(found) if f["how"] == "title" and f["score"] >= 0.97)
    if diffs:
        offset, votes = diffs.most_common(1)[0]
        if votes < 0.6 * sum(diffs.values()):
            return found  # the table and the titles disagree: believe neither over the other
    elif need_vouch:
        return found  # a bare column of numbers is believed only where titles confirm it
    else:
        offset = 0
    if need_vouch and sum(diffs.values()) < 2:
        return found
    out = []
    for i, f in enumerate(found):
        page = pages[i] + offset
        out.append({"page": page, "score": 1.0, "how": "table"} if 1 <= page <= page_count else f)
    return out


def ranges(found: list[dict], page_count: int, back_matter: int | None) -> list[tuple[int, int] | None]:
    """(first, last) page per lesson: from its opener to the page before the next
    opener, capped at MAX_PAGES and at the book's own back matter."""
    starts = [f["page"] for f in found]
    out: list[tuple[int, int] | None] = []
    for i, s in enumerate(starts):
        if s is None:
            out.append(None)
            continue
        nxt = next((x for x in starts[i + 1:] if x), None)
        end = (nxt - 1) if nxt else (back_matter or page_count)
        out.append((s, max(s, min(end, s + MAX_PAGES - 1, page_count))))
    return out


SUBJECT_KEYS = {
    "arabic": ["arabic"],
    "islamic": ["islamic"],
    "physical-education": ["pe"],
    "digital-literacy": ["digital", "digital-literacy"],
    "civic-education": ["civic"],
    # second pass: the books that already have extracted figures but whose other
    # lessons show nothing (grade 10 sources carry no grade prefix and short names)
    "mathematics": ["math"],
    "science": ["science"],
    "social": ["social"],
    "vocational-education": ["voc"],
    "financial-literacy": ["finlit"],
    "creative-arts": ["arts"],
    "biology": ["biology", "bio"],
    "chemistry": ["chemistry", "chem"],
    "physics": ["physics", "phys"],
    "earth-science": ["earth-science", "earth"],
    "geography": ["geography", "geo"],
    "history": ["history"],
}


# Student books on disk that `extract_book_figures.BOOKS` does not register (it
# registers books for figure extraction, and these have no figures): id -> (source
# id, PDF path relative to the checkout holding the PDFs).
EXTRA_BOOKS = {
    "kb-pe-10-s1": ("pe-s1-student-book", "knowledge-base/grade-10-pe/support-pdfs/كتاب الطالب لمادة التربية الرياضية للصف العاشر الفصل الأول.pdf"),
}


def source_for(book: dict, registry: dict) -> str | None:
    """The extractor's id for a curriculum book: 'g9-islamic-s1-student-book',
    or 'islamic-s1-student-book' for grade 10. None when the extractor has no
    student book registered for it."""
    grade = book["gradeId"].split("-")[1]
    prefix = f"g{grade}-" if grade != "10" else ""
    for key in SUBJECT_KEYS.get(book["subjectId"], []):
        # an arts book is one per year, with no semester in its source id
        for sid in (f"{prefix}{key}-s{book['semester']}-student-book", f"{prefix}{key}-student-book"):
            if sid in registry:
                return sid
    return None


def main() -> None:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import extract_book_figures as E  # BOOKS registry + resolve_pdf (honours IQRAA_PDF_ROOT)

    books = json.load(open(sys.argv[1], encoding="utf-8"))
    out_path = sys.argv[2]
    args = sys.argv[3:]
    # --pdfs <json>: {kbBookId: path to a student-book PDF} for books `extract_book_figures.BOOKS`
    # does not register (the primary-grade books, downloaded from NCCD and kept off the repo).
    pdf_map: dict[str, str] = {}
    if "--pdfs" in args:
        at = args.index("--pdfs")
        pdf_map = json.load(open(args[at + 1], encoding="utf-8"))
        args = args[:at] + args[at + 2:]
    only = set(args)
    # Resumable: a book already in the output file is kept as it is.
    result: dict[str, dict] = json.load(open(out_path, encoding="utf-8")) if os.path.exists(out_path) else {}
    for b in books:
        sid = source_for(b, E.BOOKS)
        pdf_rel = E.BOOKS[sid][1] if sid else None
        if sid is None and b["id"] in EXTRA_BOOKS:
            sid, pdf_rel = EXTRA_BOOKS[b["id"]]
        if b["id"] in pdf_map:
            sid, pdf_rel = b["id"].replace("kb-", "", 1) + "-student-book", pdf_map[b["id"]]
        if sid is None:
            continue
        if only and sid not in only:
            continue
        if sid in result:
            print(f"{sid}: already mapped — kept", flush=True)
            continue
        b = {**b, "sourceId": sid, "kbBookId": b["id"]}
        pdf = str(E.resolve_pdf(pdf_rel))
        if not os.path.exists(pdf):
            print(f"{sid}: PDF missing — skipped")
            continue
        titles = [l["titleAr"] for u in b["units"] for l in u["lessons"]]
        ids = [l["id"] for u in b["units"] for l in u["lessons"]]
        doc = fitz.open(pdf)
        found = locate(doc, titles, [len(u["lessons"]) for u in b["units"]])
        rng = ranges(found, doc.page_count, None)
        mapped = sum(1 for f in found if f["page"])
        sure = sum(1 for f in found if f["how"] in ("title", "table"))
        print(f"{b['sourceId']:34} {mapped:>3}/{len(titles):<3} mapped ({sure} sure)  pages {doc.page_count}", flush=True)
        result[b["sourceId"]] = {
            "kbBookId": b["kbBookId"],
            "pdf": pdf_rel,
            "pages": doc.page_count,
            "lessons": {
                ids[i]: {"start": rng[i][0], "end": rng[i][1], "score": found[i]["score"], "how": found[i]["how"], "title": titles[i]}
                for i in range(len(titles)) if rng[i]
            },
            "unmapped": [{"id": ids[i], "title": titles[i]} for i in range(len(titles)) if not rng[i]],
        }
        doc.close()
        json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)  # after every book: a dead run keeps what it finished


if __name__ == "__main__":
    main()
