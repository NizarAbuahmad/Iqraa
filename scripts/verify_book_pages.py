"""
Which book PDFs can be opened at a lesson's page.

The app opens a lesson's page in the book's public PDF (NCCD, or r2.dev) at
the page our figure extractor recorded as `lessonStartPage`. That page number
comes from OUR copy of the book; the link goes to THEIR copy. NCCD re-issues
books every school year, and one edition's page 47 is another's page 51, so a
book is only allowed a page link after this script has compared the two copies
lesson by lesson.

For each figure book with a matching catalog book (same grade, subject and
semester, with a `pdfUrl`), it downloads the live PDF and, for every lesson
start page, finds which live page within +-6 reads most like ours. A book
passes when page counts agree and at least 80% of its comparable lessons land
on the same page. Passing books go to knowledge-base/book-page-links.json,
with the exact URL that was checked. Re-run when a catalog `pdfUrl` changes
or at the start of each school year:

    python scripts/verify_book_pages.py

Needs PyMuPDF, curl and node >= 22.6. Downloads one PDF at a time (20-40 MB each)
into the temp dir and deletes it after.
"""
import datetime, difflib, glob, json, os, re, subprocess, sys, tempfile

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'knowledge-base', 'book-page-links.json')

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


def check(source_id, start_pages, url):
    ext_path = os.path.join(ROOT, 'lib', 'curriculum', 'src', 'data', 'extracted', f'{source_id}.json')
    if not os.path.exists(ext_path):
        return None, 'no extracted text for our copy'
    ours = {p['page']: p['text'] for p in json.load(open(ext_path, encoding='utf-8'))['text']}
    pdf = os.path.join(tempfile.gettempdir(), f'bookpage-{source_id}.pdf')
    try:
        # curl, not urllib: nccd.gov.jo answers Python's client with 451.
        subprocess.run(['curl', '-sSfL', '--retry', '5', '--retry-all-errors', '--retry-delay', '10', '--max-time', '900', '-o', pdf, url], check=True, capture_output=True)
        doc = fitz.open(pdf)
        theirs = [norm(doc[i].get_text()) for i in range(doc.page_count)]
        doc.close()
    except Exception as e:  # noqa: BLE001 — a dead link fails the book, not the run
        return None, f'download/open failed: {e}'
    finally:
        if os.path.exists(pdf):
            os.remove(pdf)
    if len(theirs) != len(ours):
        return None, f'page count differs: ours {len(ours)}, live {len(theirs)}'
    same = compared = 0
    for p in start_pages:
        a = norm(ours.get(p, ''))
        if len(a) < 40:
            continue  # an image-only page tells us nothing
        compared += 1
        window = range(max(1, p - 6), min(len(theirs), p + 6) + 1)
        best = max(window, key=lambda q: difflib.SequenceMatcher(None, a, theirs[q - 1]).ratio())
        same += best == p
    if compared < 3 or same / compared < 0.8:
        return None, f'{same}/{compared} lessons on the same page'
    return len(theirs), f'{same}/{compared} lessons on the same page'


def main():
    books = catalog_books()
    result = {}
    for index in sorted(glob.glob(os.path.join(ROOT, 'knowledge-base', '*', 'figures', '*', 'index.json'))):
        data = json.load(open(index, encoding='utf-8'))
        source_id = data['sourceId']
        key = parse_source_id(source_id)
        matches = [b for b in books if key and (b['gradeId'], b['subjectId'], b.get('semester')) == key]
        if len(matches) != 1:
            print(f'SKIP {source_id}: {len(matches)} catalog books match {key}')
            continue
        book = matches[0]
        starts = sorted({f['lessonStartPage'] for f in data['figures'] if f.get('lessonStartPage')})
        pages, why = check(source_id, starts, book['pdfUrl'])
        print(f"{'PASS' if pages else 'FAIL'} {source_id} -> {book['id']}: {why}", flush=True)
        if pages:
            result[source_id] = {'bookId': book['id'], 'pdfUrl': book['pdfUrl'], 'pages': pages}
    json.dump({
        'note': 'Written by scripts/verify_book_pages.py. A book listed here had its live PDF '
                'compared page-by-page with the copy our lesson start pages came from. '
                'Do not add entries by hand.',
        'verifiedAt': datetime.date.today().isoformat(),
        'books': result,
    }, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(result)} books verified -> {OUT}')


if __name__ == '__main__':
    sys.exit(main())
