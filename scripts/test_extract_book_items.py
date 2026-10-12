"""Tests for scripts/extract_book_items.py.

Run (from artifacts/math-verifier, where CI installs sympy):
    python -X utf8 ../../scripts/test_extract_book_items.py

These read the REAL committed page text. A fixture would agree with itself
while the books disagreed.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import extract_book_items as x  # noqa: E402


class Normalise(unittest.TestCase):
    def test_flattened_exponents_are_restored(self):
        self.assertEqual(x.normalise_stem('y = 3x2 + 5x − 2', 12), 'y = 3x^2 + 5x - 2')

    def test_spaced_exponent_is_restored(self):
        self.assertEqual(x.normalise_stem('y = x 2 -5x+ 6', 9), 'y = x^2 -5x+ 6')

    def test_minus_variants_are_unified(self):
        self.assertEqual(x.normalise_stem('y – x2 = 0', 9), 'y - x^2 = 0')

    def test_rejections_carry_their_reason(self):
        cases = {
            'f (x) = 3x41': 'exponent_out_of_range',
            'f (x) = - 7\n3': 'broken_fraction_or_exponent',
            'g(x) = (x - 5)2': 'ambiguous_paren_exponent',
            '3 5x × 9y = 27': 'ambiguous_spacing',
            'y = x2 ْها': 'arabic_residue',
            '': 'no_math',
        }
        for raw, reason in cases.items():
            with self.subTest(raw=raw), self.assertRaises(x.Reject) as ctx:
                x.normalise_stem(raw, 9)
            self.assertEqual(str(ctx.exception), reason)


class Segmentation(unittest.TestCase):
    def test_a_marker_after_a_space_is_a_marker_not_an_exponent(self):
        items = x.split_items('3 \tf (x) = -6x 4 \tf (x) = 3.2x', start=3)
        self.assertEqual(items, {3: 'f (x) = -6x', 4: 'f (x) = 3.2x'})

    def test_numbering_must_be_sequential(self):
        self.assertEqual(sorted(x.split_items('1 \ta\n9 \tb\n2 \tc')), [1, 2])

    def test_tail_prose_is_cut_at_the_first_arabic_character(self):
        self.assertEqual(x.lead_math('y = x2 − 4x + 3ْها.يَدْ عُبُ'), 'y = x2 − 4x + 3')


class Solving(unittest.TestCase):
    def test_system_solutions_are_exact_and_sorted(self):
        self.assertEqual(x.solve_system('y = x - 1\ny = x^2 - 3x + 2'), '(1, 0), (3, 2)')

    def test_decimals_stay_exact(self):
        self.assertEqual(
            x.solve_system('y = 0.5x^2 + 0.5x + 1\ny = -x^2 + 2x + 4'), '(-1, 1), (2, 4)')

    def test_no_real_solution_is_quarantined_not_answered(self):
        with self.assertRaises(x.Reject) as ctx:
            x.solve_system('y - x = 0\ny = x^2 + 3x + 2')
        self.assertEqual(str(ctx.exception), 'no_real_solution')

    def test_derivative_is_printed_the_way_a_teacher_writes_it(self):
        self.assertEqual(x.solve_derivative('f (x) = x^3 - 4x^2 + 3'), "f'(x) = 3x^2 - 8x")
        self.assertEqual(x.solve_derivative('f (x) = 3.2x'), "f'(x) = 3.2")

    def test_derivative_at_a_point(self):
        self.assertEqual(x.solve_derivative_at('f (x) = x^2 - 3x + 1', '-1'), '-5')

    def test_a_non_function_line_is_rejected(self):
        with self.assertRaises(x.Reject):
            x.solve_derivative('f (x) = x^2\n-9')


class States(unittest.TestCase):
    def test_truth_table(self):
        self.assertEqual(x.assign_state('(1, 0)', '(1, 0)', True), ('verified', 'sympy+book'))
        self.assertEqual(x.assign_state('(1, 0)', None, True), ('computed', 'sympy'))
        self.assertEqual(x.assign_state('(1, 0)', '(2, 0)', True), ('quarantined', 'none'))
        self.assertEqual(x.assign_state('(1, 0)', '(2, 0)', False), ('book-key', 'book'))
        self.assertEqual(x.assign_state(None, '(2, 0)', True), ('quarantined', 'none'))

    def test_a_corrupted_printed_answer_is_never_verified(self):
        status, _ = x.assign_state('x = 2', 'x = 3', True)
        self.assertNotEqual(status, 'verified')


class RealPages(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        cls.items = {r['id']: r for rs in cls.by_source.values() for r in rs}

    def test_golden_system_from_exercise_page_11(self):
        r = self.items['bi-math-s1-exercise-book-u1l2-3']
        self.assertEqual(r['stem'], 'y - x = 10\nx^2 + y^2 = 50')
        self.assertEqual(r['computedAnswer'], '(-5, 5)')
        self.assertEqual((r['status'], r['lessonId']), ('computed', 'kbl-math-s1-nccd-u1_l1'))
        self.assertEqual(r['source'], {'sourceId': 'math-s1-exercise-book', 'page': 11, 'bookPage': 11, 'unit': 1, 'number': 3})

    def test_golden_derivative_from_exercise_page_28(self):
        r = self.items['bi-math-s2-exercise-book-u6l2-8']
        self.assertEqual(r['stem'], 'f (x) = 7x^3 + 6x^2 - x')
        self.assertEqual(r['computedAnswer'], "f'(x) = 21x^2 + 12x - 1")

    def test_golden_unit_test_choice_from_the_guide(self):
        r = self.items['bi-math-s1-teacher-guide-u1l2-1']
        self.assertEqual((r['kind'], r['stem']), ('unit-test-mcq', 'x^2 + y^2 = 4\n3x + y = 6'))
        self.assertEqual(r['options'], ['(1, 3)', '(0, 2)', '(2, 0)', '(-2, -2)'])
        self.assertEqual(r['computedAnswer'], '(2, 0)')
        self.assertEqual(r['source']['bookPage'], 34)

    def test_known_unreadable_items_are_quarantined_with_a_reason(self):
        reasons = {q['id']: q['reason'] for q in self.rejects}
        self.assertEqual(reasons['bi-math-s2-exercise-book-u6l2-5'], 'exponent_out_of_range')
        self.assertEqual(reasons['bi-math-s2-exercise-book-u6l2-10'], 'broken_fraction_or_exponent')
        self.assertEqual(reasons['bi-math-s1-exercise-book-u1l2-5'], 'no_real_solution')

    def test_nothing_is_both_served_and_quarantined(self):
        self.assertFalse(set(self.items) & {q['id'] for q in self.rejects})

    def test_every_table_row_is_accounted_for(self):
        wanted = sum(e.last - e.first + 1 for e in x.TABLE)
        self.assertEqual(len(self.items) + len(self.rejects), wanted)

    def test_output_is_deterministic(self):
        again, rejects = x.build()
        self.assertEqual(again, self.by_source)
        self.assertEqual(rejects, self.rejects)

    def test_every_stem_is_latin_maths(self):
        for r in self.items.values():
            self.assertIsNone(x.ARABIC.search(r['stem']), r['id'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
