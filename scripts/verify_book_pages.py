"""
Cuts each curriculum lesson's pages out of the student book, for projecting.

The app shows a lesson's pages as JPEGs in the public R2 bucket
(`book-pages/<kbLessonId>/<n>.jpg`, n from 1), not NCCD's full book: NCCD
serves ~190 KB/s, so its 30 MB PDFs took minutes to appear in front of a
class. Images rather than per-lesson PDFs because the books share one resource
set across pages, so a 5-page PDF slice still weighed 5 MB against 1.2 MB of
JPEGs — and an image needs no PDF viewer, so the phone app can show it too.

The page numbers come from OUR copy of each book (the figure extractor records
where every book lesson starts); the slices are cut from the LIVE copy in the
catalog's `pdfUrl`. NCCD re-issues books every school year, and one edition's
page 47 is another's page 51, so a book is only sliced after the two copies
are compared lesson by lesson: for every lesson start page, the live page
within +-6 that reads most like ours must be the same page for at least 80% of
comparable lessons, and the page counts must agree. Books with no extracted
text of our own cannot be compared and are skipped.

A curriculum lesson runs from its earliest book-lesson start to the page
before the next book lesson begins, capped at MAX_PAGES — the book prints a
lesson's start only where it has a figure, so "next start" can overshoot.

    python scripts/verify_book_pages.py [out_dir]
    pnpm --filter @workspace/curriculum run upload-book-pages-r2 -- <out_dir>

Re-run at the start of each school year or when a catalog `pdfUrl` changes.
Resumable: a book already in the JSON with the same URL and all its pages in
out_dir is not downloaded again. Needs PyMuPDF, curl and node >= 22.6.
"""
import datetime, difflib, glob, json, os, re, subprocess, sys, tempfile

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'knowledge-base', 'book-page-links.json')
MAX_PAGES = 20
WIDTH = 1400  # px; legible on a projector, ~250 KB a page at q75

SUBJECT = {
    'math': 'mathematics', 'chem': 'chemistry', 'chemistry': 'chemistry', 'phys': 'physics',
    'physics': 'physics', 'bio': 'biology', 'biology': 'biology', 'earth': 'earth-science',
    'earth-science': 'earth-science', 'eng': 'english', 'english': 'english',
    'hist': 'history', 'history': 'history', 'geo': 'geography', 'geography': 'geography',
    'finlit': 'financial-literacy', 'science': 'science', 'social': 'social',
    'voc': 'vocational-education', 'arts': 'creative-arts',
}


def catalog_books():
    dump = (
        "import { BOOKS } from '%s';"
        "console.log(JSON.stringify(BOOKS.filter(b => b.pdfUrl)));"
    ) % ('file:///' + os.path.join(ROOT, 'lib', 'curriculum', 'src', 'catalog.ts').replace('\\', '/'))
    path = os.path.join(tempfile.gettempdir(), 'dump-books.mts')
    open(path, 'w', encoding='utf-8').write(dump)
    out = subprocess.run(['node', '--experimental-strip-types', '--no-warnings', path],
                         capture_output=True, text=True, encoding='utf-8', check=True).stdout
    return json.loads(out)


def parse_source_id(source_id):
    """'g9-earth-science-s2-student-book' -> ('grade-9', 'earth-science', 2)."""
    m = re.match(r'^(?:g(\d+)-)?(.+)-s([12])-student-book$', source_id)
    if not m:
        return None
    grade = f'grade-{m.group(1) or 10}'
    subject = SUBJECT.get(m.group(2))
    return (grade, subject, int(m.group(3))) if subject else None


norm = lambda s: re.sub(r'\s+', '', s)[:400]


def lesson_ranges(figures, kb_of, pages):
    """kbLessonId -> (first, last) 1-based pages, from the book-lesson starts."""
    start_of = {}  # (unit, lesson) -> start page
    for f in figures:
        if f.get('lessonStartPage'):
            start_of[(f['unit'], f['lesson'])] = f['lessonStartPage']
    starts = sorted(set(start_of.values()))
    groups = {}
    for coord, start in start_of.items():
        kb = kb_of.get(coord)
        if kb:
            groups.setdefault(kb, []).append(start)
    ranges = {}
    for kb, s in groups.items():
        first, last_start = min(s), max(s)
        nxt = next((p for p in starts if p > last_start), pages + 1)
        ranges[kb] = (first, min(nxt - 1, first + MAX_PAGES - 1, pages))
    return ranges


def aligned(source_id, start_pages, doc):
    ext_path = os.path.join(ROOT, 'lib', 'curriculum', 'src', 'data', 'extracted', f'{source_id}.json')
    ours = {p['page']: p['text'] for p in json.load(open(ext_path, encoding='utf-8'))['text']}
    theirs = [norm(doc[i].get_text()) for i in range(doc.page_count)]
    if len(theirs) != len(ours):
        return False, f'page count differs: ours {len(ours)}, live {len(theirs)}'
    same = compared = 0
    for p in start_pages:
        a = norm(ours.get(p, ''))
        if len(a) < 40:
            continue  # an image-only page tells us nothing
        compared += 1
        window = range(max(1, p - 6), min(len(theirs), p + 6) + 1)
        best = max(window, key=lambda q: difflib.SequenceMatcher(None, a, theirs[q - 1]).ratio())
        same += best == p
    ok = compared >= 3 and same / compared >= 0.8
    return ok, f'{same}/{compared} lessons on the same page'


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'book-pages')
    os.makedirs(out_dir, exist_ok=True)
    prev = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    books_out = dict(prev.get('books', {}))
    lessons_out = dict(prev.get('lessons', {}))
    kb_of = {}
    for e in json.load(open(os.path.join(ROOT, 'knowledge-base', 'figure-lesson-map.json'), encoding='utf-8'))['entries']:
        if e.get('kbLessonId'):
            kb_of[(e['sourceId'], e['unit'], e['lesson'])] = e['kbLessonId']
    catalog = catalog_books()

    for index in sorted(glob.glob(os.path.join(ROOT, 'knowledge-base', '*', 'figures', '*', 'index.json'))):
        data = json.load(open(index, encoding='utf-8'))
        source_id = data['sourceId']
        key = parse_source_id(source_id)
        matches = [b for b in catalog if key and (b['gradeId'], b['subjectId'], b.get('semester')) == key]
        if len(matches) != 1:
            print(f'SKIP {source_id}: {len(matches)} catalog books match {key}')
            continue
        book = matches[0]
        mine = {kb: v for kb, v in lessons_out.items() if v['sourceId'] == source_id}
        done = books_out.get(source_id, {}).get('pdfUrl') == book['pdfUrl'] and mine and all(
            os.path.exists(os.path.join(out_dir, kb, f"{v['endPage'] - v['startPage'] + 1}.jpg")) for kb, v in mine.items())
        if done:
            print(f'KEEP {source_id}: already sliced ({len(mine)} lessons)')
            continue
        # Drop any stale entries for this book before deciding afresh.
        books_out.pop(source_id, None)
        for kb in mine:
            lessons_out.pop(kb, None)
        if not os.path.exists(os.path.join(ROOT, 'lib', 'curriculum', 'src', 'data', 'extracted', f'{source_id}.json')):
            print(f'FAIL {source_id}: no extracted text for our copy')
            continue

        pdf = os.path.join(tempfile.gettempdir(), f'bookpage-{source_id}.pdf')
        try:
            # curl, not urllib: nccd.gov.jo answers Python's client with 451.
            subprocess.run(['curl', '-sSfL', '--retry', '10', '--retry-all-errors', '--retry-delay', '30',
                            '--max-time', '1800', '-o', pdf, book['pdfUrl']], check=True, capture_output=True)
            doc = fitz.open(pdf)
        except Exception as e:  # noqa: BLE001 — a dead link fails the book, not the run
            print(f'FAIL {source_id}: download/open failed: {e}', flush=True)
            if os.path.exists(pdf):
                os.remove(pdf)
            continue
        try:
            starts = sorted({f['lessonStartPage'] for f in data['figures'] if f.get('lessonStartPage')})
            ok, why = aligned(source_id, starts, doc)
            print(f"{'PASS' if ok else 'FAIL'} {source_id} -> {book['id']}: {why}", flush=True)
            if not ok:
                continue
            coords = {(u, l): kb for (s, u, l), kb in kb_of.items() if s == source_id}
            for kb, (first, last) in lesson_ranges(data['figures'], coords, doc.page_count).items():
                os.makedirs(os.path.join(out_dir, kb), exist_ok=True)
                for n, pno in enumerate(range(first - 1, last), start=1):
                    page = doc[pno]
                    zoom = WIDTH / page.rect.width
                    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
                    open(os.path.join(out_dir, kb, f'{n}.jpg'), 'wb').write(pix.tobytes('jpeg', jpg_quality=75))
                rect = doc[first - 1].rect
                lessons_out[kb] = {'sourceId': source_id, 'startPage': first, 'endPage': last,
                                   'aspect': round(rect.width / rect.height, 4)}
            books_out[source_id] = {'bookId': book['id'], 'pdfUrl': book['pdfUrl'], 'pages': doc.page_count}
        finally:
            doc.close()
            os.remove(pdf)
        # Written after every book so a dead run keeps what it finished.
        write(books_out, lessons_out)

    write(books_out, lessons_out)
    print(f'{len(books_out)} books, {len(lessons_out)} lessons -> {OUT}; slices in {out_dir}')


def write(books_out, lessons_out):
    json.dump({
        'note': 'Written by scripts/verify_book_pages.py. Each lesson below has its pages at '
                'book-pages/<kbLessonId>/<n>.jpg in the public R2 bucket, cut from a book whose live '
                'PDF was compared page-by-page with the copy our start pages came from. '
                'Do not add entries by hand.',
        'verifiedAt': datetime.date.today().isoformat(),
        'books': dict(sorted(books_out.items())),
        'lessons': dict(sorted(lessons_out.items())),
    }, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    sys.exit(main())
