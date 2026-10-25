"""
Finds each English lesson's pages in the Jordan «High Note» student books (grades 9-10).

The Arabic page mapper (`map_lesson_pages.py`) cannot place these: the catalog calls every
lesson by its skill («القراءة والمفردات», «المحادثة») and repeats the same few names in every
unit, and the book's text is English. What the books do print, at the top of each lesson, is a
running header, «LESSON 1A VOCABULARY AND GRAMMAR», «LESSON 2A READING …», … numbered 1-7
inside each unit. So the lessons are found by position: the headers in page order, split into
units wherever the number goes back down, must come out in exactly the shape the curriculum
has (units × lessons); if they do not, the book is left alone.

    IQRAA_PDF_ROOT=… python scripts/map_english_pages.py <all_books.json> <out.json> <pdfs.json> [kbBookId …]

`pdfs.json` is {kbBookId: student-book PDF}; the output has the shape of `map_lesson_pages.py`,
so `render_lesson_pages.py` takes it as it is.
"""
from __future__ import annotations

import json
import re
import sys

import fitz  # PyMuPDF

HEADER = re.compile(r"^LESSON\s+(\d{1,2})[A-Z]\b")
MAX_PAGES = 20


def headers(doc: fitz.Document) -> list[tuple[int, int]]:
    """[(1-based page, lesson number)] in reading order, one per header line."""
    out: list[tuple[int, int]] = []
    for n in range(doc.page_count):
        lines = []
        for block in doc[n].get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(sp["text"] for sp in line["spans"]).strip()
                m = HEADER.match(text)
                if m:
                    lines.append((line["bbox"][1], int(m.group(1))))
        for _, k in sorted(lines):
            out.append((n + 1, k))
    return out


def split_units(found: list[tuple[int, int]], sizes: list[int]) -> list[list[tuple[int, int]]] | None:
    """Cut the headers into the curriculum's units; None unless the shape fits exactly."""
    units: list[list[tuple[int, int]]] = []
    for page, k in found:
        if not units or k <= units[-1][-1][1]:
            units.append([])
        units[-1].append((page, k))
    # Pages after the last unit (grammar reference, writing bank) repeat «LESSON 1A»; they form
    # trailing groups that are not part of the units, so only the first len(sizes) are looked at.
    units = units[: len(sizes)]
    if len(units) != len(sizes):
        return None
    for unit, size in zip(units, sizes):
        if [k for _, k in unit] != list(range(1, size + 1)):
            return None
    return units


def main() -> None:
    books = {b["id"]: b for b in json.load(open(sys.argv[1], encoding="utf-8"))}
    out_path = sys.argv[2]
    pdfs = json.load(open(sys.argv[3], encoding="utf-8"))
    only = set(sys.argv[4:])
    result: dict[str, dict] = {}
    for kb, pdf in pdfs.items():
        if only and kb not in only:
            continue
        book = books[kb]
        sizes = [len(u["lessons"]) for u in book["units"]]
        doc = fitz.open(pdf)
        units = split_units(headers(doc), sizes)
        if units is None:
            print(f"{kb}: headers do not fit {sizes} — left alone")
            continue
        flat = [p for unit in units for p, _ in unit]
        ids = [l["id"] for u in book["units"] for l in u["lessons"]]
        titles = [l["titleAr"] for u in book["units"] for l in u["lessons"]]
        lessons = {}
        for i, start in enumerate(flat):
            nxt = flat[i + 1] if i + 1 < len(flat) else doc.page_count + 1
            end = max(start, min(nxt - 1, start + MAX_PAGES - 1))
            # a unit's last lesson would run on into the next unit's opener, so stop short of it
            lessons[ids[i]] = {"start": start, "end": end, "score": 1.0, "how": "lesson-header", "title": titles[i]}
        sid = kb.replace("kb-", "", 1) + "-student-book"
        result[sid] = {"kbBookId": kb, "pdf": pdf, "pages": doc.page_count, "lessons": lessons, "unmapped": []}
        print(f"{kb}: {len(lessons)}/{sum(sizes)} lessons by header")
        doc.close()
    json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
