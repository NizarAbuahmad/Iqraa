"""
Tests for the pure parts of `scan_book_qr.py` — no PDFs, no OpenCV.

    python -m unittest scripts/test_scan_book_qr.py

CI does not run Python tests under `scripts/`; run this before changing the
script. What it guards is the output the library trusts: a printed ministry link
must be rewritten to the http:// form that serves, a re-scan must never disturb
a row a person or the link check already edited, and a payload that is not a
link must not become a resource.
"""
import copy
import shutil
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scan_book_qr as s  # noqa: E402


class WorkingUrl(unittest.TestCase):
    def test_ministry_https_becomes_http_with_a_note(self):
        url, note = s.working_url("https://qr.nccd.gov.jo/QR/Science/10%20Geography/page15.mp4")
        self.assertEqual(url, "http://qr.nccd.gov.jo/QR/Science/10%20Geography/page15.mp4")
        self.assertIn("expired certificate", note)

    def test_other_hosts_are_opened_as_printed(self):
        self.assertEqual(s.working_url("https://youtu.be/abc"), ("https://youtu.be/abc", None))

    def test_a_bare_host_gets_a_scheme(self):
        # `window.open("qr.nccd.gov.jo/x")` is a relative path and navigates inside the app.
        url, _ = s.working_url("qr.nccd.gov.jo/QR/Eng/10/S1/SB17.mp3")
        self.assertTrue(url.startswith("http://"))


class Kind(unittest.TestCase):
    def test_extension_decides(self):
        self.assertEqual(s.kind_of("http://h/x/y.mp3"), "audio")
        self.assertEqual(s.kind_of("http://h/x/y.MP4"), "video")
        self.assertEqual(s.kind_of("http://h/x/%D8%A7.pdf"), "document")
        self.assertEqual(s.kind_of("http://h/x/y.jpg?v=1".split("?")[0]), "image")

    def test_video_host_decides_when_there_is_no_extension(self):
        self.assertEqual(s.kind_of("https://youtu.be/abc"), "video")
        self.assertEqual(s.kind_of("https://www.youtube.com/watch?v=abc"), "video")

    def test_anything_else_is_a_page(self):
        self.assertEqual(s.kind_of("https://example.org/lesson"), "page")


class Links(unittest.TestCase):
    def test_wifi_and_contact_payloads_are_not_resources(self):
        self.assertFalse(s.looks_like_link("WIFI:T:WPA;S:home;P:secret;;"))
        self.assertFalse(s.looks_like_link("BEGIN:VCARD\nFN:x"))
        self.assertFalse(s.looks_like_link("hello"))

    def test_links_and_bare_hosts_are(self):
        for ok in ("https://a.org/x", "http://a.org", "www.a.org/x", "qr.nccd.gov.jo/QR/x.mp3"):
            self.assertTrue(s.looks_like_link(ok), ok)


class Merge(unittest.TestCase):
    def doc(self):
        return {
            "entries": [
                {"book": "b", "pdfPage": 3, "printedUrl": "https://a.org/1", "httpStatus": "200", "title": "عنوان"},
            ]
        }

    def test_an_existing_row_keeps_its_title_and_status(self):
        doc = self.doc()
        before = copy.deepcopy(doc["entries"][0])
        again = s.make_entry(4, "science", "b", 3, "https://a.org/1", 150)
        added = s.merge(doc, [again], {})
        self.assertEqual(added, 0)
        self.assertEqual(doc["entries"][0], before)

    def test_new_rows_are_hidden_until_the_link_check_has_seen_them(self):
        doc = self.doc()
        e = s.make_entry(4, "science", "b", 9, "https://a.org/2", 200)
        self.assertEqual(e["httpStatus"], "unchecked")
        self.assertNotIn(e["httpStatus"], ("200", "206"))
        self.assertEqual(s.merge(doc, [e], {}), 1)

    def test_a_book_with_no_codes_is_still_recorded_as_scanned(self):
        doc = self.doc()
        s.merge(doc, [], {"b2": {"pages": 80, "codes": 0, "scannedAt": "2026-10-09"}})
        self.assertEqual(doc["scannedBooks"]["b2"]["codes"], 0)

    def test_book_key_matches_the_first_pass(self):
        self.assertEqual(
            s.book_key(10, "arabic", "كتاب.pdf"),
            "grade-10-arabic/support-pdfs/كتاب.pdf",
        )


PDF = b"%PDF-1.4\n" + b"0" * 20_000


class _Handler(BaseHTTPRequestHandler):
    hits: dict = {}

    def log_message(self, *a):  # keep test output quiet
        pass

    def do_GET(self):  # noqa: N802
        _Handler.hits[self.path] = _Handler.hits.get(self.path, 0) + 1
        n = _Handler.hits[self.path]
        if self.path == "/ok.pdf":
            self._send(200, PDF)
        elif self.path == "/html.pdf":
            self._send(200, b"<html>" + b"x" * 20_000)
        elif self.path == "/flaky.pdf":
            self._send(503, b"busy") if n == 1 else self._send(200, PDF)
        else:
            self._send(404, b"nope")

    def _send(self, code, body):
        self.send_response(code)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class Fetching(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), _Handler)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        _Handler.hits = {}
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_filename_is_windows_safe_and_marks_a_student_book(self):
        name = s.fetch_filename("الرياضيات – الصف الرابع: الفصل الأول؟")
        self.assertTrue(name.startswith("كتاب الطالب"))
        self.assertTrue(name.endswith(".pdf"))
        self.assertTrue(s.STUDENT_BOOK.search(name))
        for bad in '\\/:*?"<>|':
            self.assertNotIn(bad, name)

    def test_select_books_filters_and_keeps_one_row_per_file(self):
        rows = [
            {"gradeId": "grade-4", "subjectId": "science", "titleAr": "a", "pdfUrl": "http://h/1.pdf"},
            {"gradeId": "grade-4", "subjectId": "science", "titleAr": "dup", "pdfUrl": "http://h/1.pdf"},
            {"gradeId": "grade-2", "subjectId": "arabic", "titleAr": "b", "pdfUrl": "http://h/2.pdf"},
            {"gradeId": "grade-4", "subjectId": "art", "titleAr": "no link", "pdfUrl": ""},
            {"gradeId": "kg", "subjectId": "art", "titleAr": "bad grade", "pdfUrl": "http://h/3.pdf"},
        ]
        self.assertEqual([b["title"] for b in s.select_books(rows, None, None)], ["a", "b"])
        self.assertEqual([b["title"] for b in s.select_books(rows, {4}, None)], ["a"])
        self.assertEqual([b["title"] for b in s.select_books(rows, None, {"arabic"})], ["b"])

    def test_looks_like_pdf_rejects_an_html_page_served_with_200(self):
        good, html, small = self.tmp / "g.pdf", self.tmp / "h.pdf", self.tmp / "s.pdf"
        good.write_bytes(PDF)
        html.write_bytes(b"<html>" + b"x" * 20_000)
        small.write_bytes(b"%PDF-1.4 tiny")
        self.assertTrue(s.looks_like_pdf(good))
        self.assertFalse(s.looks_like_pdf(html))
        self.assertFalse(s.looks_like_pdf(small))
        self.assertFalse(s.looks_like_pdf(self.tmp / "missing.pdf"))

    def test_download_then_cached(self):
        dest = self.tmp / "a" / "b.pdf"
        self.assertEqual(s.download(f"{self.base}/ok.pdf", dest, pause=0), "downloaded")
        self.assertEqual(s.download(f"{self.base}/ok.pdf", dest, pause=0), "cached")
        self.assertEqual(_Handler.hits["/ok.pdf"], 1, "a cached book must not be fetched again")
        self.assertFalse(list(dest.parent.glob("*.part")))

    def test_a_refusal_is_not_retried(self):
        with self.assertRaises(s.DownloadError) as cm:
            s.download(f"{self.base}/missing.pdf", self.tmp / "m.pdf", pause=0)
        self.assertIn("404", str(cm.exception))
        self.assertEqual(_Handler.hits["/missing.pdf"], 1)

    def test_a_transient_failure_is_retried(self):
        self.assertEqual(s.download(f"{self.base}/flaky.pdf", self.tmp / "f.pdf", pause=0), "downloaded")
        self.assertEqual(_Handler.hits["/flaky.pdf"], 2)

    def test_an_html_answer_leaves_nothing_behind(self):
        dest = self.tmp / "h.pdf"
        with self.assertRaises(s.DownloadError):
            s.download(f"{self.base}/html.pdf", dest, pause=0)
        self.assertFalse(dest.exists())
        self.assertFalse(list(self.tmp.glob("*.part")))

    def test_the_real_catalog_lists_books_with_official_links(self):
        if not shutil.which("node"):
            self.skipTest("node not installed")
        rows = s.catalog_books()
        self.assertGreater(len(rows), 100)
        picked = s.select_books(rows, {2, 4}, None)
        self.assertTrue(picked)
        for b in picked:
            self.assertIn(b["grade"], (2, 4))
            self.assertTrue(b["url"].startswith("http"))


if __name__ == "__main__":
    unittest.main()
