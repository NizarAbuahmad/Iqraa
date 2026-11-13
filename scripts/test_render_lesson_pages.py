"""
render_lesson_pages.target_dir: where a lesson's re-rendered pages go.

A page-link entry may read its images from another lesson's folder
(`rendered.dir`, see `bookPagesForLesson`). Re-rendering a lesson into its own
folder would then overwrite the pages those other lessons show, and the
uploader replaces any image whose size changed — so a folder someone else
reads must never be written to.

    python -X utf8 scripts/test_render_lesson_pages.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_lesson_pages import book_entry, entry_for, target_dir  # noqa: E402


class TargetDir(unittest.TestCase):
    def test_own_folder_when_nobody_else_reads_it(self):
        links = {"a": {"startPage": 1, "endPage": 3}}
        self.assertEqual(target_dir(links, "a"), "a")
        self.assertEqual(target_dir(links, "new"), "new")

    def test_a_folder_another_lesson_reads_is_left_alone(self):
        links = {"b": {"startPage": 8, "endPage": 12, "rendered": {"dir": "a", "startPage": 6, "endPage": 25}}}
        self.assertEqual(target_dir(links, "a"), "a-v2")

    def test_the_next_free_version(self):
        links = {
            "b": {"startPage": 8, "endPage": 12, "rendered": {"dir": "a", "startPage": 6, "endPage": 25}},
            "c": {"startPage": 1, "endPage": 2, "rendered": {"dir": "a-v2", "startPage": 1, "endPage": 2}},
        }
        self.assertEqual(target_dir(links, "a"), "a-v3")

    def test_the_lesson_reading_its_own_folder_does_not_block_it(self):
        links = {"a": {"startPage": 9, "endPage": 10, "rendered": {"dir": "a", "startPage": 6, "endPage": 25}}}
        self.assertEqual(target_dir(links, "a"), "a")


class EntryFor(unittest.TestCase):
    def test_own_folder_needs_no_rendered(self):
        self.assertEqual(entry_for("s", "a", "a", 4, 7, 0.75), {"sourceId": "s", "startPage": 4, "endPage": 7, "aspect": 0.75})

    def test_a_new_folder_is_named(self):
        self.assertEqual(
            entry_for("s", "a", "a-v2", 4, 7, 0.75),
            {"sourceId": "s", "startPage": 4, "endPage": 7, "aspect": 0.75,
             "rendered": {"dir": "a-v2", "startPage": 4, "endPage": 7}},
        )


class BookEntry(unittest.TestCase):
    def test_a_book_cut_from_the_live_copy_keeps_its_record(self):
        # verify_book_pages.py keeps a book whose URL is unchanged; marking it
        # «our copy» would make its next run re-cut every lesson of the book.
        live = {"bookId": "book-science-6-s1", "pdfUrl": "https://nccd.gov.jo/x.pdf", "pages": 108}
        self.assertIs(book_entry(live, "book-science-6-s1", 108), live)

    def test_otherwise_it_says_it_is_our_copy(self):
        want = {"bookId": "kb-math-6-s1", "pdfUrl": None, "pages": 126, "source": "our copy of the student book"}
        self.assertEqual(book_entry(None, "kb-math-6-s1", 126), want)
        self.assertEqual(book_entry({**want, "pages": 1}, "kb-math-6-s1", 126), want)


if __name__ == "__main__":
    unittest.main()
