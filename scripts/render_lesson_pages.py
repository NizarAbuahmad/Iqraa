"""
Renders the pages `map_lesson_pages.py` found for each lesson and lists them in
`knowledge-base/book-page-links.json`, next to the lessons `verify_book_pages.py`
already put there.

Differences from `verify_book_pages.py`, and why
────────────────────────────────────────────────
That script cuts pages out of the LIVE book (the catalog's `pdfUrl`) after
checking, figure by figure, that the live book's pagination matches our copy's —
because its page numbers come from the figure extractor's reading of OUR copy.
Here the numbers come from our copy too, but the pages are rendered from our copy
as well, so the page a lesson is said to open on is by construction the page
the picture shows; there is no second copy to disagree with. The cost is that a
book NCCD has since re-issued shows the edition we hold. The titles were matched
to the curriculum, so the lesson is the right lesson in that edition.

Same output shape on purpose (`book-pages/<kbLessonId>/<n>.jpg`, 1400 px wide, q75, an
`aspect`, 20 pages at most), so `bookPagesForLesson`, the lesson screen's page
view and `upload-book-pages-r2` need no change.

    IQRAA_PDF_ROOT=/path/to/pdfs python scripts/render_lesson_pages.py <page_map.json> <out_dir> [--min-score 0.9]

Resumable: a lesson whose pages are all in <out_dir> is not re-rendered.
"""
from __future__ import annotations

import json
import os
import sys

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINKS = os.path.join(ROOT, "knowledge-base", "book-page-links.json")
WIDTH = 1400


def main() -> None:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import extract_book_figures as E

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    page_map = json.load(open(args[0], encoding="utf-8"))
    out_dir = args[1]
    min_score = float(sys.argv[sys.argv.index("--min-score") + 1]) if "--min-score" in sys.argv else 0.0

    links = json.load(open(LINKS, encoding="utf-8"))
    books, lessons = links["books"], links["lessons"]

    for sid, book in page_map.items():
        todo = {k: v for k, v in book["lessons"].items() if v["score"] >= min_score}
        if not todo:
            continue
        doc = fitz.open(str(E.resolve_pdf(book["pdf"])))
        books[sid] = {"bookId": book["kbBookId"], "pdfUrl": None, "pages": doc.page_count,
                      "source": "our copy of the student book"}
        done = 0
        for kb_id, rng in todo.items():
            first, last = rng["start"], rng["end"]
            target = os.path.join(out_dir, kb_id)
            os.makedirs(target, exist_ok=True)
            aspect = None
            for n, page_no in enumerate(range(first, last + 1), start=1):
                page = doc[page_no - 1]
                rect = page.rect
                aspect = aspect or round(rect.width / rect.height, 4)
                path = os.path.join(target, f"{n}.jpg")
                if os.path.exists(path):
                    continue
                zoom = WIDTH / rect.width
                pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
                open(path, "wb").write(pix.tobytes("jpeg", jpg_quality=75))
            lessons[kb_id] = {"sourceId": sid, "startPage": first, "endPage": last, "aspect": aspect}
            done += 1
        doc.close()
        print(f"{sid}: {done} lessons rendered")

    links["lessons"] = dict(sorted(lessons.items()))
    links["books"] = dict(sorted(books.items()))
    json.dump(links, open(LINKS, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
