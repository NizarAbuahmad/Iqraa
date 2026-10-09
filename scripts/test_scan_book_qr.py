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
import sys
import unittest
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


if __name__ == "__main__":
    unittest.main()
