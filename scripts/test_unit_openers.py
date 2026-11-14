"""
Tests for `unit_openers.py` and the two page renderers that use it.

    python -m unittest scripts/test_unit_openers.py

CI does not run Python tests under `scripts/`; run this before changing either
renderer. Needs PyMuPDF only to import the renderers (`pip install pymupdf`); the
detector itself is tested on the committed page text in
`lib/curriculum/src/data/extracted/`, the same books whose page images were opened
on 2026-11-13 to say which pages are covers, so these cases are real pages, not
made-up strings.
"""
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import unit_openers as U  # noqa: E402

EXTRACTED = HERE.parent / "lib" / "curriculum" / "src" / "data" / "extracted"


def book(source_id: str):
    pages = json.loads((EXTRACTED / f"{source_id}.json").read_text(encoding="utf-8"))["text"]
    by_page = {p["page"]: p["text"] for p in pages}
    return lambda n: by_page.get(n, "")


class RealBooks(unittest.TestCase):
    """Each range is a unit's last lesson as `book-page-links.json` held it."""

    def test_arabic_drops_the_next_units_cover_and_competencies(self):
        # p30 is unit 2's cover, p31 its «كفايات الوحدة الثانية»; p29 is lesson 5's own.
        self.assertEqual(U.trim_end(25, 31, book("g5-arabic-s1-student-book")), 29)

    def test_islamic_drops_the_lesson_list_cover(self):
        self.assertEqual(U.trim_end(18, 23, book("g5-islamic-s1-student-book")), 22)

    def test_a_units_end_page_stays_with_its_lesson(self):
        # p25 is «نهاية الوحدة» of unit 5 — it mentions «دروس وحدة ألعاب القوى» —
        # and p26 is unit 6's cover.
        self.assertEqual(U.trim_end(22, 26, book("g5-pe-s2-student-book")), 25)

    def test_a_short_exercise_page_under_its_own_units_header_stays(self):
        # p100 is lesson 5's last exercise: blank answer lines under «الوحدة التاسعة».
        self.assertEqual(U.trim_end(96, 100, book("g6-arabic-s2-student-book")), 100)

    def test_skill_names_found_by_chance_in_scrambled_text_do_not_count(self):
        # p100's text layer is reversed letter soup in which four skill names appear.
        self.assertEqual(U.trim_end(97, 100, book("g6-arabic-s1-student-book")), 100)

    def test_competencies_page_needs_only_four_readable_skills(self):
        # Grade 4 prints the fifth («البناء اللغوي») in a way the text layer loses.
        self.assertEqual(U.trim_end(26, 33, book("g4-arabic-s1-student-book")), 32)


class Markers(unittest.TestCase):
    def test_lesson_list_heading_must_be_in_order(self):
        self.assertTrue(U.overview("دُروسُ الوَحْدَةِ الثّانِيَة ⏎ آيَةُ الْكُرْسِي"))
        self.assertFalse(U.overview("بَعْدَ الانْتِهاءِ مِنْ دُروسِ وَحْدَةِ أَلْعابِ الْقُوى"))

    def test_article_may_come_out_reversed(self):
        self.assertTrue(U.overview("دروس لاوحدة الثالثة"))

    def test_end_of_unit_is_never_an_opener(self):
        self.assertFalse(U.is_unit_opener("مراجعة الوحدة ⏎ دروس الوحدة الثانية"))

    def test_english_overview(self):
        page = "07 Going to town VOCABULARY City GRAMMAR Going to LISTENING SPEAKING READING WRITING"
        self.assertTrue(U.overview(page))
        self.assertFalse(U.overview("LESSON 2A VOCABULARY Free-time activities"))

    def test_cover_must_name_another_unit(self):
        self.assertTrue(U.cover("الوحدة الثانية ⏎ الريشة الطائرة"))
        self.assertFalse(U.cover("الوحدة الثانية ⏎ الريشة الطائرة", own={1}))

    def test_never_walks_past_the_lessons_first_page(self):
        cover = "الوحدة الثانية"
        self.assertEqual(U.trim_end(5, 6, lambda p: cover), 5)


class Renderers(unittest.TestCase):
    """The two renderers trim only where the next lesson opens another unit."""

    PAGES = {
        10: "الدرس الأول " + "نص " * 200,
        14: "الدرس الثاني " + "نص " * 200,
        18: "الوحدة الثانية",          # unit 2's cover
        19: "الدرس الأول " + "نص " * 200,
    }

    def text_of(self, p):
        return self.PAGES.get(p, "نص " * 200)

    def test_map_lesson_pages(self):
        import map_lesson_pages as M
        found = [{"page": 10}, {"page": 14}, {"page": 19}]
        self.assertEqual(M.ranges(found, 30, None, [0, 0, 1], self.text_of), [(10, 13), (14, 17), (19, 30)])
        # Without unit information it behaves as before.
        self.assertEqual(M.ranges(found, 30, None)[1], (14, 18))

    def test_verify_book_pages(self):
        import verify_book_pages as V
        figures = [
            {"unit": 1, "lesson": 1, "lessonStartPage": 10},
            {"unit": 1, "lesson": 2, "lessonStartPage": 14},
            {"unit": 2, "lesson": 1, "lessonStartPage": 19},
        ]
        kb_of = {(1, 1): "a", (1, 2): "b", (2, 1): "c"}
        out = V.lesson_ranges(figures, kb_of, 30, self.text_of)
        self.assertEqual(out["a"], (10, 13))
        self.assertEqual(out["b"], (14, 17))
        self.assertEqual(V.lesson_ranges(figures, kb_of, 30)["b"], (14, 18))


if __name__ == "__main__":
    unittest.main()
