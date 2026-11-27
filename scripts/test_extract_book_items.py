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
        wanted = sum(len(e.items) for e in x.TABLE)
        self.assertEqual(len(self.items) + len(self.rejects), wanted)

    def test_output_is_deterministic(self):
        again, rejects = x.build()
        self.assertEqual(again, self.by_source)
        self.assertEqual(rejects, self.rejects)

    def test_every_stem_is_latin_maths(self):
        for r in self.items.values():
            self.assertIsNone(x.ARABIC.search(r['stem']), r['id'])


# ── guide p.47: the open questions 6-11 and their printed answers ────────────
GUIDE_P47 = 'math-s1-teacher-guide', 47
PHRASE_PRESENTATION_FORMS = 'ﻻ ﻳﻮﺟﺪ ﺣﻞ'


def p47() -> str:
    return x.page_text(*GUIDE_P47)


class UnitOpenText(unittest.TestCase):
    def test_the_no_solution_phrase_is_nfkc_normalised(self):
        self.assertNotEqual(PHRASE_PRESENTATION_FORMS, x.NO_SOLUTION_AR)
        self.assertEqual(x.nfkc(PHRASE_PRESENTATION_FORMS), x.NO_SOLUTION_AR)
        self.assertEqual(x.NO_SOLUTION_AR, 'لا يوجد حل')

    def test_stems_6_to_11_are_cut_from_their_anchors(self):
        stems = x.split_unit_open(p47())
        self.assertEqual(sorted(stems), [6, 7, 8, 9, 10, 11])
        self.assertEqual(stems[6], 'y = 4x\ny = 5 \u2013 x2')
        self.assertEqual(stems[7], 'y \u2212 x = 15\nx2 + y2 = 64')
        self.assertEqual(stems[8], 'y = x2 \u2212 4x + 5\ny = \u2212x2 + 5')
        self.assertEqual(stems[9], 'y = \u2212x2 \u2212 x + 12\ny = x2 + 7x + 12')
        # 10 and 11 share the printed system; 10 has the c=8 line substituted, 11 keeps c
        self.assertEqual(stems[10], 'x \u2212 2y = 1\nx2 \u2212 y2 = 8')
        self.assertEqual(stems[11], 'x \u2212 2y = 1\nx2 \u2212 y2 = c')

    def test_no_stem_carries_arabic(self):
        for n, stem in x.split_unit_open(p47()).items():
            self.assertIsNone(x.ARABIC.search(stem), n)

    def test_a_missing_or_ambiguous_anchor_finds_nothing(self):
        page = p47()
        self.assertNotIn(8, x.split_unit_open(page.replace('8 y = x2', '8\ty = x2')))
        self.assertNotIn(7, x.split_unit_open(page + '\n7 y = 1\ny = 2'))
        no_c = page.replace('c = 8', 'c = ')
        self.assertTrue({10, 11}.isdisjoint(x.split_unit_open(no_c)))
        self.assertEqual(sorted(x.split_unit_open('')), [])

    def test_a_c_that_touches_a_digit_or_a_letter_is_not_substituted(self):
        page = p47()
        self.assertIn('x2 \u2212 y2 = c', page)
        for touching in ('2c', 'c2', 'xc', 'cx'):
            with self.subTest(touching=touching):
                stems = x.split_unit_open(page.replace('x2 \u2212 y2 = c', f'x2 \u2212 y2 = {touching}'))
                self.assertTrue({10, 11}.isdisjoint(stems), stems)    # refused, never "28" for 2*8
                self.assertEqual(sorted(stems), [6, 7, 8, 9])

    def test_the_answer_block_splits_into_six_entries_and_ignores_the_appendix_line(self):
        entries, ignored = x.printed_entries(p47())
        self.assertEqual(entries, [
            '(1, 4), (-5, -20)',
            '(0, 5), (2. 1)',
            'لا يوجد حل',
            '(0, 12), (-4, 0)',
            '(3, 1), ( - 11 3 , - 7 3 )',
            'c < - 1 3',
        ])
        self.assertEqual(ignored, 1)

    def test_the_answer_block_stops_at_the_unit_banner(self):
        entries, _ = x.printed_entries(p47() + '\n(9, 9)')
        self.assertNotIn('(9, 9)', entries)

    def test_no_answer_block_is_an_error_not_an_empty_list(self):
        with self.assertRaises(x.Reject) as ctx:
            x.printed_entries('34\nnothing here')
        self.assertEqual(str(ctx.exception), 'answer_block_not_found')


class ValueMatching(unittest.TestCase):
    def test_flat_turns_the_fraction_bar_into_a_gap_and_keeps_a_gap_between_digits(self):
        # the text layer splits `-11/3` into «- 11» over «3»; both spellings meet at `-11 3`
        self.assertEqual(x.flat('( - 11 3 , - 7 3 )'), '(-11 3,-7 3)')
        self.assertEqual(x.flat('( - 11\n3 , - 7\n3 )'), '(-11 3,-7 3)')
        self.assertEqual(x.flat('(-11/3, -7/3)'), '(-11 3,-7 3)')
        # a printed split fraction `1⏎2` IS `1/2`, but neither is the integer `12`
        self.assertEqual(x.flat('1 2'), x.flat('1/2'))
        self.assertNotEqual(x.flat('12'), x.flat('1 2'))
        self.assertNotEqual(x.flat('12'), x.flat('1/2'))
        self.assertEqual(x.flat('1  2'), x.flat('1\t2'))     # any run of whitespace is one gap

    def test_values_that_only_collide_once_the_bar_is_deleted_stay_apart(self):
        for printed, computed in [
            ('(12, 3)', '(1/2, 3)'),
            ('c < -13', 'c < -1/3'),
            ('( - 1 13 , 0)', '(-11/3, 0)'),
            ('( - 11 3 , 0)', '(-1/13, 0)'),
            ('(1 2, 3)', '(12, 3)'),
        ]:
            with self.subTest(printed=printed, computed=computed):
                self.assertFalse(x.same_answer(printed, computed))
                self.assertFalse(x.same_answer(computed, printed))

    def test_the_real_printed_forms_of_items_10_and_11_still_match(self):
        self.assertTrue(x.same_answer('(3, 1), ( - 11 3 , - 7 3 )', '(-11/3, -7/3), (3, 1)'))
        self.assertTrue(x.same_answer('c < - 1 3', 'c < -1/3'))

    def test_a_duplicated_point_is_not_a_single_point(self):
        self.assertFalse(x.same_answer('(1, 4), (1, 4)', '(1, 4)'))
        self.assertFalse(x.same_answer('(1, 4)', '(1, 4), (1, 4)'))
        records = [{'id': 'a', 'source': {'number': 1}, 'computedAnswer': '(1, 4)', 'printedAnswer': None}]
        left = x.pair_printed(records, ['(1, 4), (1, 4)'])
        self.assertEqual((records[0]['status'], records[0]['printedAnswer']), ('computed', None))
        self.assertEqual(left, ['(1, 4), (1, 4)'])

    def test_a_split_fraction_matches_its_value(self):
        self.assertTrue(x.same_answer('(3, 1), ( - 11 3 , - 7 3 )', '(-11/3, -7/3), (3, 1)'))
        self.assertTrue(x.same_answer('c < - 1 3', 'c < -1/3'))

    def test_the_order_of_the_solution_points_does_not_matter(self):
        self.assertTrue(x.same_answer('(1, 4), (-5, -20)', '(-5, -20), (1, 4)'))

    def test_the_order_of_the_coordinates_does_matter(self):
        self.assertFalse(x.same_answer('(4, 1), (-5, -20)', '(-5, -20), (1, 4)'))

    def test_the_printed_typo_is_not_tolerated(self):
        self.assertFalse(x.same_answer('(0, 5), (2. 1)', '(0, 5), (2, 1)'))

    def test_a_different_value_never_matches(self):
        self.assertFalse(x.same_answer('(0, 12), (-4, 1)', '(-4, 0), (0, 12)'))
        self.assertFalse(x.same_answer('c < - 1 2', 'c < -1/3'))
        self.assertFalse(x.same_answer('(1, 4)', '(-5, -20), (1, 4)'))

    def test_pairing_uses_each_entry_at_most_once(self):
        records = [
            {'id': 'a', 'source': {'number': 1}, 'computedAnswer': '(1, 2)', 'printedAnswer': None},
            {'id': 'b', 'source': {'number': 2}, 'computedAnswer': '(1, 2)', 'printedAnswer': None},
        ]
        left = x.pair_printed(records, ['(1,  2)', '(7, 7)'])
        self.assertEqual([r['printedAnswer'] for r in records], ['(1, 2)', None])
        self.assertEqual([r['status'] for r in records], ['verified', 'computed'])
        self.assertEqual(left, ['(7, 7)'])

    def test_a_matched_item_is_verified_by_sympy_and_the_book(self):
        records = [{'id': 'a', 'source': {'number': 1}, 'computedAnswer': '(-5, -20), (1, 4)', 'printedAnswer': None}]
        x.pair_printed(records, ['(1, 4), (-5,   -20)'])
        r = records[0]
        self.assertEqual((r['status'], r['verificationSource']), ('verified', 'sympy+book'))
        self.assertEqual(r['printedAnswer'], '(1, 4), (-5, -20)')   # whitespace normalised, nothing else


class UnitOpenSolvers(unittest.TestCase):
    def test_no_real_solution_is_answered_only_when_the_row_allows_it(self):
        stem = 'y - x = 15\nx^2 + y^2 = 64'
        self.assertEqual(x.solve_system(stem, allow_none=True), x.NO_SOLUTION_AR)
        with self.assertRaises(x.Reject) as ctx:
            x.solve_system(stem)
        self.assertEqual(str(ctx.exception), 'no_real_solution')

    def test_allow_none_does_not_turn_an_unsolved_system_into_no_solution(self):
        self.assertEqual(x.solve_system('y = x - 1\ny = x^2 - 3x + 2', allow_none=True), '(1, 0), (3, 2)')

    def test_the_parameter_values_with_no_solution(self):
        self.assertEqual(x.solve_param_no_solution('x - 2y = 1\nx^2 - y^2 = c', 'c'), 'c < -1/3')

    def test_an_unsolved_system_is_never_answered_as_having_no_solution(self):
        # SymPy has a real root here (x^5 - x + 1 = 0) but returns no closed form; an empty
        # result means "could not solve", and `all()` over nothing is True.
        stem = 'y = x^5 - x + 1\ny = 0'
        with self.assertRaises(x.Reject) as ctx:
            x.solve_system(stem, allow_none=True)
        self.assertNotEqual(str(ctx.exception), x.NO_SOLUTION_AR)
        self.assertIn(str(ctx.exception), ('not_solved', 'not_closed_form'))

    def test_an_empty_solve_result_rejects_as_not_solved(self):
        real = x.solve
        x.solve = lambda *a, **k: []
        try:
            with self.assertRaises(x.Reject) as ctx:
                x.solve_system('y = x - 1\ny = x^2', allow_none=True)
        finally:
            x.solve = real
        self.assertEqual(str(ctx.exception), 'not_solved')

    def test_a_partial_solution_is_not_proof_of_no_solution(self):
        from sympy import I
        real = x.solve
        x.solve = lambda *a, **k: [{x.X: I}]      # says nothing about y
        try:
            with self.assertRaises(x.Reject) as ctx:
                x.solve_system('y = x - 1\ny = x^2', allow_none=True)
        finally:
            x.solve = real
        self.assertEqual(str(ctx.exception), 'no_real_solution')

    def test_item_7_s_real_no_solution_case_is_still_answered(self):
        self.assertEqual(x.solve_system('y - x = 15\nx^2 + y^2 = 64', allow_none=True), x.NO_SOLUTION_AR)

    def test_a_parameter_in_the_leading_coefficient_is_rejected(self):
        # c*x^2 - x^2 - 1 = 0 is not a quadratic for c = 1, so the discriminant rule is wrong there
        with self.assertRaises(x.Reject) as ctx:
            x.solve_param_no_solution('c*x^2 - y^2 = 1\nx - y = 0', 'c')
        self.assertEqual(str(ctx.exception), 'parameter_in_leading_coefficient')

    def test_the_bound_is_strict_because_the_boundary_value_has_a_solution(self):
        stem = 'x - 2y = 1\nx^2 - y^2 = {}'
        self.assertEqual(x.solve_system(stem.format('-1/3'), allow_none=True), '(-1/3, -2/3)')   # c = -1/3 is solvable
        self.assertEqual(x.solve_system(stem.format('-1/2'), allow_none=True), x.NO_SOLUTION_AR)
        self.assertEqual(x.solve_param_no_solution(stem.format('c'), 'c'), 'c < -1/3')

    def test_only_an_open_half_line_is_a_bound(self):
        from sympy import Interval, Rational, oo
        self.assertEqual(x.strict_upper_bound(Interval.open(-oo, Rational(-1, 3))), Rational(-1, 3))
        for bad in (Interval(-oo, Rational(-1, 3)),                 # closed: the boundary would be "no solution" too
                    Interval.open(Rational(-1, 3), oo), Interval.open(0, 1), Interval.open(-oo, oo)):
            with self.subTest(bad=bad), self.assertRaises(x.Reject):
                x.strict_upper_bound(bad)

    def test_a_parameter_that_cannot_make_the_system_unsolvable_is_rejected(self):
        with self.assertRaises(x.Reject):
            x.solve_param_no_solution('x - 2y = 1\nx + y = c', 'c')


class UnitOpenPage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects, cls.extras = x.build_all()
        cls.items = {r['id']: r for rs in cls.by_source.values() for r in rs}

    def item(self, n):
        return self.items[f"bi-math-s1-teacher-guide-u1l{3 if n in (8, 9) else 2}-{n}"]

    def test_all_six_are_served(self):
        for n in range(6, 12):
            self.assertIn(n, [self.item(n)['source']['number']])

    def test_golden_record_for_item_6(self):
        r = self.item(6)
        self.assertEqual(r, {
            'id': 'bi-math-s1-teacher-guide-u1l2-6',
            'lessonId': 'kbl-math-s1-nccd-u1_l1',
            'source': {'sourceId': 'math-s1-teacher-guide', 'page': 47, 'bookPage': 34, 'unit': 1, 'number': 6},
            'kind': 'unit-test',
            'instruction': x.SYSTEM_AR,
            'stem': 'y = 4x\ny = 5 - x^2',
            'printedAnswer': '(1, 4), (-5, -20)',
            'computedAnswer': '(-5, -20), (1, 4)',
            'check': None,
            'tier': 'medium',
            'tierSource': 'default',
            'status': 'verified',
            'verificationSource': 'sympy+book',
        })

    def test_lessons_follow_the_kind_of_system(self):
        for n in (6, 7, 10, 11):
            self.assertEqual(self.item(n)['lessonId'], 'kbl-math-s1-nccd-u1_l1', n)
        for n in (8, 9):
            self.assertEqual(self.item(n)['lessonId'], 'kbl-math-s1-nccd-u1_l2', n)

    def test_item_7_is_answered_with_the_normalised_phrase(self):
        r = self.item(7)
        self.assertEqual(r['computedAnswer'], 'لا يوجد حل')
        self.assertEqual(r['printedAnswer'], 'لا يوجد حل')
        self.assertEqual(r['status'], 'verified')

    def test_item_10_has_c_substituted_and_item_11_keeps_it(self):
        self.assertEqual(self.item(10)['stem'], 'x - 2y = 1\nx^2 - y^2 = 8')
        self.assertEqual(self.item(10)['instruction'], x.SYSTEM_AR)
        self.assertEqual(self.item(10)['computedAnswer'], '(-11/3, -7/3), (3, 1)')
        self.assertEqual(self.item(10)['printedAnswer'], '(3, 1), ( - 11 3 , - 7 3 )')
        r = self.item(11)
        self.assertEqual(r['stem'], 'x - 2y = 1\nx^2 - y^2 = c')
        self.assertEqual(r['instruction'], 'أجد جميع قيم c التي لا يكون للنظام الآتي أي حل')
        self.assertEqual((r['computedAnswer'], r['printedAnswer']), ('c < -1/3', 'c < - 1 3'))

    def test_five_are_verified_and_item_8_stays_computed(self):
        status = {n: self.item(n)['status'] for n in range(6, 12)}
        self.assertEqual(status, {6: 'verified', 7: 'verified', 8: 'computed', 9: 'verified', 10: 'verified', 11: 'verified'})
        r = self.item(8)
        self.assertEqual((r['printedAnswer'], r['verificationSource'], r['computedAnswer']), (None, 'sympy', '(0, 5), (2, 1)'))

    def test_item_8_s_printed_entry_is_reported_not_forgiven(self):
        self.assertEqual(self.extras['unmatchedPrinted'], ['(0, 5), (2. 1)'])
        # the s1 guide's only note; the s2 unit test's own: 23 (its max is printed rounded) and the word
        # problems no printed entry answers whole (5 and 7: «see margin»; 6: half a sentence; 10: rounded);
        # lesson 6.1's whose answer the guide prints bare (14, 16) or inside a sentence (25, 26)
        self.assertEqual(list(self.extras['notes']), [
            'bi-math-s1-teacher-guide-u1l3-8',
            'bi-math-s2-student-book-u6l1-14', 'bi-math-s2-student-book-u6l1-16',
            'bi-math-s2-student-book-u6l1-25', 'bi-math-s2-student-book-u6l1-26',
            'bi-math-s2-student-book-u6l2-t5', 'bi-math-s2-student-book-u6l2-t6', 'bi-math-s2-student-book-u6l2-t7',
            'bi-math-s2-student-book-u6l3-t10', 'bi-math-s2-student-book-u6l3-t23'])

    def test_nothing_unit_open_carries_a_check(self):
        for n in range(6, 12):
            self.assertIsNone(self.item(n)['check'])

    def test_an_identical_run_gives_an_identical_report(self):
        again = x.build_all()
        self.assertEqual(again, (self.by_source, self.rejects, self.extras))

    def test_a_corrupted_printed_entry_is_never_verified_and_is_reported(self):
        page = p47()
        for good, bad, n in [
            ('(0, 12), (-4, 0)', '(0, 12), (-4, 1)', 9),
            ('(1, 4), (-5, -20)', '(1, 4), (5, -20)', 6),
            ('c < - 1\n3', 'c < - 1\n2', 11),
        ]:
            with self.subTest(item=n):
                self.assertIn(good, page)
                corrupted = page.replace(good, bad)
                real = x.page_text
                x.page_text = lambda s, p, _c=corrupted, _r=real: _c if (s, p) == GUIDE_P47 else _r(s, p)
                try:
                    by_source, _rej, extras = x.build_all()
                finally:
                    x.page_text = real
                got = {r['id']: r for rs in by_source.values() for r in rs}
                r = got[f"bi-math-s1-teacher-guide-u1l{3 if n in (8, 9) else 2}-{n}"]
                self.assertEqual((r['status'], r['printedAnswer']), ('computed', None))
                self.assertIn(' '.join(bad.split()), extras['unmatchedPrinted'])
                self.assertIn(r['id'], extras['notes'])

    def test_value_pairing_does_not_depend_on_the_order_of_the_block(self):
        page = p47()
        a, b = '(1, 4), (-5, -20)\n', '(0, 12), (-4, 0)\n'
        swapped = page.replace(a, '@@A@@').replace(b, a).replace('@@A@@', b)
        self.assertNotEqual(swapped, page)
        real = x.page_text
        x.page_text = lambda s, p: swapped if (s, p) == GUIDE_P47 else real(s, p)
        try:
            by_source, _rej, extras = x.build_all()
        finally:
            x.page_text = real
        got = {r['id']: r['status'] for rs in by_source.values() for r in rs}
        self.assertEqual(got['bi-math-s1-teacher-guide-u1l2-6'], 'verified')
        self.assertEqual(got['bi-math-s1-teacher-guide-u1l3-9'], 'verified')
        self.assertEqual(extras['unmatchedPrinted'], ['(0, 5), (2. 1)'])

    def test_the_guide_items_are_all_accounted_for(self):
        ids = {r['id'] for r in self.items.values() if r['source']['page'] == 47}
        self.assertEqual({r['source']['number'] for r in self.items.values() if r['id'] in ids}, {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11})


# ── guide p.47 items 3-5: written readings, accepted only if they pass two gates ─────────────
class Readings(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects, cls.extras = x.build_all()
        cls.items = {r['id']: r for rs in cls.by_source.values() for r in rs}
        cls.text = p47()
        cls.page = {n: x.page_latin(cls.text, n) for n in (3, 4, 5)}

    def solve(self, n, reading, check):
        """solve_reading for item `n` with READINGS[n] replaced by `reading`, then restored."""
        real = x.READINGS[n]
        x.READINGS[n] = reading
        try:
            return x.solve_reading(n, self.page[n], check)
        finally:
            x.READINGS[n] = real

    def test_the_page_text_each_reading_is_checked_against(self):
        # the Latin text of the page, Arabic removed; item 4's `x = -1` is printed in its heading line
        self.assertEqual(x.core(self.page[3]), '35x×9y=27' '5' '3x×5y=25' 'a-1,-1b1,1c-1,1d1,-1')
        self.assertEqual(x.core(self.page[4]), 'x=-1' 'a52x+1=25b3' '1+x=81c73-2x=49d42-x=64')
        self.assertEqual(x.core(self.page[5]), '8x2y3□=2yx2a2x4yb4x4y2c2xydx2y2')

    def test_the_three_are_served_computed_and_never_verified(self):
        for id_, key in (('u1l5-3', '(1, -1)'), ('u1l5-4', '4^(2-x) = 64'), ('u1l4-5', '2x^4y')):
            r = self.items[f'bi-math-s1-teacher-guide-{id_}']
            self.assertEqual((r['kind'], r['status'], r['verificationSource'], r['check'], r['printedAnswer']),
                             ('unit-test-mcq', 'computed', 'sympy', None, None), id_)
            self.assertEqual(r['computedAnswer'], key, id_)
            self.assertIn(r['computedAnswer'], r['options'], id_)
            self.assertEqual((r['tier'], r['tierSource']), ('medium', 'default'), id_)
            self.assertEqual(r['source']['bookPage'], 34, id_)

    def test_lessons_follow_the_book_lesson(self):
        self.assertEqual(self.items['bi-math-s1-teacher-guide-u1l5-3']['lessonId'], 'kbl-math-s1-nccd-u1_l4')
        self.assertEqual(self.items['bi-math-s1-teacher-guide-u1l5-4']['lessonId'], 'kbl-math-s1-nccd-u1_l4')
        self.assertEqual(self.items['bi-math-s1-teacher-guide-u1l4-5']['lessonId'], 'kbl-math-s1-nccd-u1_l3')

    def test_golden_stems_are_the_readings(self):
        self.assertEqual(self.items['bi-math-s1-teacher-guide-u1l5-3']['stem'], '3^(5x) × 9^y = 27\n5^(3x) × 5^y = 25')
        self.assertEqual(self.items['bi-math-s1-teacher-guide-u1l5-4']['stem'], 'x = -1')
        self.assertEqual(self.items['bi-math-s1-teacher-guide-u1l4-5']['stem'], '8x^2y^3 / □ = (2y/x)^2')

    def test_every_option_of_every_reading_is_reachable_and_exactly_one_is_correct(self):
        for n, check in ((3, 'points'), (4, 'root'), (5, 'box')):
            stem, options, key = x.solve_reading(n, self.page[n], check)
            holds = [x.option_holds(check, stem, o) for o in options]
            self.assertEqual(holds.count(True), 1, n)
            self.assertTrue(holds[key], n)

    # gate 1: the same characters
    def test_a_reading_that_changes_a_digit_is_refused(self):
        r = x.READINGS[3]
        for stem in (('3^(5x) × 9^y = 28', r.stem[1]), ('3^(5x) × 9^y = 27', '5^(3x) × 5^y = 24')):
            with self.subTest(stem=stem), self.assertRaises(x.Reject) as ctx:
                self.solve(3, x.Reading(stem, r.options), 'points')
            self.assertEqual(str(ctx.exception), 'reading_changes_characters')

    def test_a_reading_that_drops_adds_or_moves_a_character_is_refused(self):
        r = x.READINGS[4]
        cases = {
            'dropped': x.Reading(r.stem, ('5^(2x+1) = 25', '3^(1+x) = 81', '7^(3-2x) = 49', '4^2-x = 6')),
            'added': x.Reading(r.stem, ('5^(2x+1) = 25', '3^(1+x) = 81', '7^(3-2x) = 49', '4^(2-x) = 64 + 0')),
            'moved': x.Reading(r.stem, ('5^(1+2x) = 25', '3^(1+x) = 81', '7^(3-2x) = 49', '4^(2-x) = 64')),
            'sign': x.Reading(('x = 1',), r.options),
        }
        for name, reading in cases.items():
            with self.subTest(name), self.assertRaises(x.Reject) as ctx:
                self.solve(4, reading, 'root')
            self.assertEqual(str(ctx.exception), 'reading_changes_characters')

    def test_structure_characters_alone_never_change_the_core(self):
        self.assertEqual(x.core('3^(5x) × 9^y'), x.core('3 5x × 9y'))
        self.assertNotEqual(x.core('3^(5x) × 9^y'), x.core('3^(5x) / 9^y'))   # an operator is meaning
        self.assertEqual(x.core('(2y/x)^2'), x.core('(2y\nx )2'))

    # gate 2: exactly one key. These readings keep every character, so only gate 2 can stop them.
    def test_rival_readings_that_pass_gate_1_but_have_no_unique_key_are_refused_by_gate_2(self):
        # item 3: no exponents at all (a product read as written), and the lone `5` as a coefficient
        flat3 = x.Reading(('3 5x × 9y = 27', '5 3x × 5y = 25'), x.READINGS[3].options)
        # item 4: bases and exponents glued the other way round
        flat4 = x.Reading(x.READINGS[4].stem, ('5^(2)x+1 = 25', '3^(1)+x = 81', '7^(3)-2x = 49', '4^(2)-x = 64'))
        # item 5: the same characters with a different exponent structure on the left (x^(2y^3))
        flat5 = x.Reading(('8x^(2y^3) / □ = (2y/x)^2',), x.READINGS[5].options)
        for n, check, reading in ((3, 'points', flat3), (4, 'root', flat4), (5, 'box', flat5)):
            with self.subTest(n):
                try:
                    self.solve(n, reading, check)
                except x.Reject as r:
                    self.assertEqual(str(r), 'key_not_unique', n)
                else:
                    self.fail(f'item {n}: a rival reading was accepted')

    def test_a_rival_that_reorders_the_characters_is_refused_by_gate_1(self):
        # the box moved across the equals sign: structure alone cannot move a character
        moved = x.Reading(('8x^2y^3 = □ / (2y/x)^2',), x.READINGS[5].options)
        with self.assertRaises(x.Reject) as ctx:
            self.solve(5, moved, 'box')
        self.assertEqual(str(ctx.exception), 'reading_changes_characters')

    def test_an_exponent_one_place_off_breaks_item_3(self):
        # 9^y read as 9y (a product) leaves no correct point
        off = x.Reading(('3^(5x) × 9y = 27', '5^(3x) × 5^y = 25'), x.READINGS[3].options)
        with self.assertRaises(x.Reject) as ctx:
            self.solve(3, off, 'points')
        self.assertEqual(str(ctx.exception), 'key_not_unique')

    def test_item_5_bracket_in_a_different_place_has_a_unique_key_and_only_the_bracket_rule_stops_it(self):
        # (2y/x^2) keeps every character, and under it option b is the unique correct one - a wrong
        # answer that gate 2 alone would serve. The page prints `(2y` ... `x )2`, so the bracket
        # closes AFTER the 2, which `(2y/x)^2` honours and these do not.
        for stem in ('8x^2y^3 / □ = (2y/x^2)', '8x^2y^3 / □ = 2y/x^2'):
            with self.subTest(stem=stem):
                self.assertTrue(x.option_holds('box', stem, '4x^4y^2'))
                self.assertEqual(sum(x.option_holds('box', stem, o) for o in x.READINGS[5].options), 1)
                with self.assertRaises(x.Reject) as ctx:
                    self.solve(5, x.Reading((stem,), x.READINGS[5].options), 'box')
                self.assertEqual(str(ctx.exception), 'reading_moves_brackets')

    def test_bracket_pairs_are_counted_in_meaning_characters(self):
        want = {(7, 10): 1}
        self.assertEqual(dict(x.bracket_pairs('8x2y3\n□ = (2y\nx )2')), want)
        self.assertEqual(dict(x.bracket_pairs('8x^2y^3 / □ = (2y/x)^2')), want)
        self.assertEqual(dict(x.bracket_pairs('5 2x+1 = 25')), {})
        # an option label is not a bracket; a bracket after a letter inside a line still is
        self.assertEqual(dict(x.bracket_pairs('a) (1, 3) \tb) (0, 2)')), {(0, 3): 1, (3, 6): 1})
        with self.assertRaises(x.Reject):
            x.bracket_pairs('2 (a) b)')

    def test_unbalanced_brackets_are_an_error_not_a_pair(self):
        for s in ('(2y', '2y)', ')(', '((2y)'):
            with self.subTest(s), self.assertRaises(x.Reject) as ctx:
                x.bracket_pairs(s)
            self.assertEqual(str(ctx.exception), 'unbalanced_brackets')

    def test_the_operator_of_the_page_cannot_be_swapped_for_a_bar(self):
        # 3^(5x) / 9^y = 27 and 5^(3x) / 5^y = 25 have one correct option, (1, 1) - a wrong answer
        # that gate 2 alone would serve, and that gate 1 used to let through by ignoring `×`.
        swapped = x.Reading(('3^(5x) / 9^y = 27', '5^(3x) / 5^y = 25'), x.READINGS[3].options)
        stem = '\n'.join(swapped.stem)
        self.assertEqual([i for i, o in enumerate(swapped.options) if x.option_holds('points', stem, o)], [1])
        with self.assertRaises(x.Reject) as ctx:
            self.solve(3, swapped, 'points')
        self.assertEqual(str(ctx.exception), 'reading_changes_characters')
        for op in ('*', '+', ''):       # dropping or replacing the `×` is refused too
            dropped = x.Reading((f'3^(5x) {op} 9^y = 27', f'5^(3x) {op} 5^y = 25'), x.READINGS[3].options)
            with self.subTest(op), self.assertRaises(x.Reject) as ctx:
                self.solve(3, dropped, 'points')
            self.assertEqual(str(ctx.exception), 'reading_changes_characters')

    def test_a_bracket_that_closes_a_different_bracket_is_refused(self):
        # (2y/(x)^2): a `(` and a `)` sit where the page's do, but the `)` closes the inner bracket.
        # Under it option b is the unique key - the answer the bracket rule exists to stop.
        stem = '8x^2y^3 / □ = (2y/(x)^2)'
        self.assertTrue(x.option_holds('box', stem, '4x^4y^2'))
        with self.assertRaises(x.Reject) as ctx:
            self.solve(5, x.Reading((stem,), x.READINGS[5].options), 'box')
        self.assertEqual(str(ctx.exception), 'reading_moves_brackets')

    def test_two_correct_options_or_none_is_not_a_key(self):
        # the page text is the reading itself, so gate 1 passes and only gate 2 can speak
        stem = ('x = -1',)
        for name, options in (
            ('two', ('2^(x+1) = 1', '3^(x+1) = 1', '5^(2x+1) = 25', '4^(2-x) = 63')),
            ('none', ('2^(x+1) = 2', '3^(x+1) = 2', '5^(2x+1) = 25', '4^(2-x) = 63')),
        ):
            reading = x.Reading(stem, options)
            page = '\n'.join([*stem, *(f'{l} {o}' for l, o in zip(x.LABELS, options))])
            real = x.READINGS[4]
            x.READINGS[4] = reading
            try:
                with self.subTest(name), self.assertRaises(x.Reject) as ctx:
                    x.solve_reading(4, page, 'root')
            finally:
                x.READINGS[4] = real
            self.assertEqual(str(ctx.exception), 'key_not_unique')

    def test_unknown_check_and_missing_reading_are_refused(self):
        with self.assertRaises(x.Reject) as ctx:
            x.solve_reading(99, '', 'points')
        self.assertEqual(str(ctx.exception), 'no_reading')
        with self.assertRaises(x.Reject) as ctx:
            x.option_holds('nonsense', 'x = 1', '1')
        self.assertEqual(str(ctx.exception), 'unknown_check')

    # the page itself
    def test_a_missing_or_repeated_heading_finds_nothing(self):
        with self.assertRaises(x.Reject):
            x.page_latin('no items here', 3)
        found = x.split_readings('no items here', (3, 4, 5))
        self.assertEqual({n: str(r) for n, r in found.items()}, {3: 'item_not_found', 4: 'item_not_found', 5: 'item_not_found'})
        doubled = self.text + '\n' + self.text
        with self.assertRaises(x.Reject):
            x.page_latin(doubled, 3)

    def test_a_page_without_option_d_is_refused(self):
        cut = '\n'.join(l for l in self.text.split('\n') if 'd)' not in l)
        with self.assertRaises(x.Reject) as ctx:
            x.page_latin(cut, 3)
        self.assertEqual(str(ctx.exception), 'options_not_found')

    def test_a_changed_page_quarantines_the_item_instead_of_serving_it(self):
        real = x.page_text
        changed = self.text.replace('3x × 5y = 25', '3x × 5y = 26')
        x.page_text = lambda s, p: changed if (s, p) == GUIDE_P47 else real(s, p)
        try:
            by_source, rejects, _ = x.build_all()
        finally:
            x.page_text = real
        served = {r['id'] for rs in by_source.values() for r in rs}
        self.assertNotIn('bi-math-s1-teacher-guide-u1l5-3', served)
        self.assertEqual({q['id']: q['reason'] for q in rejects}['bi-math-s1-teacher-guide-u1l5-3'], 'reading_changes_characters')
        self.assertIn('bi-math-s1-teacher-guide-u1l5-4', served)    # its neighbours are untouched

    def test_nothing_is_guessed_for_the_other_unit_test_items(self):
        # items 12-18 of the page are not rows; a reading row for them would need its own reading
        self.assertEqual(set(x.READINGS), {3, 4, 5})
        rows = [e for e in x.TABLE if e.family == 'reading' and e.source == x.G1]
        self.assertEqual(sorted(n for e in rows for n in e.items), [3, 4, 5])
        # and every student-book reading row has its own reading, keyed by page
        sb2 = [(e.page, n) for e in x.TABLE if e.family == 'reading' and e.source == x.SB2 for n in e.items]
        self.assertEqual(sorted(sb2), sorted(x.SB2_READINGS))

    def test_the_report_counts_the_new_items_as_computed(self):
        counts = {}
        for rs in self.by_source.values():
            for r in rs:
                counts[r['status']] = counts.get(r['status'], 0) + 1
        # verified: 5 from guide p.47, 13 s2 derivatives, 3 s2 unit-test max/min (20-22);
        # computed: 28 before, + the s2 unit-6 test's 6 multiple choice, + p.74's 9 max/min, + test item 23,
        # + its 4 drawn graph questions (29, 32-34), + 4 of its word problems (5, 6, 7, 10);
        # verified + the other 5 word problems (9, 11, 12, 24, 25);
        # lesson 6.1: verified 10-13, 15, 21, 24; computed 14, 16, 25, 26
        self.assertEqual((counts['verified'], counts['computed']), (33, 56))


class RivalReadings(unittest.TestCase):
    """Every other way to place exponents over the page's own characters.

    The chosen readings are not trusted because they look right: this enumerates the rivals (up to
    two exponent groups per equation, plus one fraction bar anywhere for items 3 and 4) and requires
    that any rival which still leaves exactly one correct option leaves the SAME one. Operators and
    the page's brackets are held fixed here because the character and bracket gates already fix
    them (see Readings), and the lone `5` of item 3 stays the second equation's base. Item 5's
    bar is part of its reading, so its search fixes the page's bracket and varies exponents. A rival that disagreed would mean
    the key depends on a guess about the layout, and the item would have to be quarantined.
    """

    @staticmethod
    def variants(s, max_groups=2, bars=True):
        """Exponent groups (up to `max_groups`), and with `bars` also one fraction bar anywhere."""
        import itertools
        import re
        spans = [(i, j) for i in range(1, len(s)) for j in range(i + 1, len(s) + 1)
                 if not re.search(r'[*=]', s[i:j])]
        out = {s}
        for k in range(1, max_groups + 1):
            for comb in itertools.combinations(spans, k):
                ordered = sorted(comb)
                if all(ordered[a][1] <= ordered[a + 1][0] for a in range(k - 1)):
                    t = s
                    for i, j in sorted(comb, reverse=True):
                        t = t[:i] + '^(' + t[i:j] + ')' + t[j:]
                    out.add(t)
        if bars:
            for v in list(out):
                for i in range(1, len(v)):
                    if v[i - 1] not in '=*' and v[i] not in '=*':
                        out.add(v[:i] + '/' + v[i:])
        return out

    def test_item_3_every_unique_rival_reading_gives_the_same_point(self):
        from sympy import simplify
        pts = ['(-1,-1)', '(1,1)', '(-1,1)', '(1,-1)']

        def truth(eq):
            l, r = x.eq_sides(eq)
            out = []
            for p in pts:
                a, b = (x.parse(c) for c in p.strip('()').split(','))
                out.append(simplify((l - r).subs({x.X: a, x.Y: b})) == 0)
            return out

        def table(base):
            rows = {}
            for v in self.variants(base):
                try:
                    rows[v] = truth(v)
                except Exception:       # a reading SymPy cannot parse is not a rival
                    pass
            return rows

        first, second = table('35x*9y=27'), table('53x*5y=25')
        keys = set()
        for ta in first.values():
            for tb in second.values():
                sat = [a and b for a, b in zip(ta, tb)]
                if sum(sat) == 1:
                    keys.add(pts[sat.index(True)])
        self.assertEqual(keys, {'(1,-1)'})

    def test_item_4_every_unique_rival_reading_gives_the_same_option(self):
        from sympy import simplify
        rows = []
        for raw in ('52x+1=25', '31+x=81', '73-2x=49', '42-x=64'):
            seen = set()
            for v in self.variants(raw, 1):   # one exponent group and one bar
                try:
                    l, r = x.eq_sides(v)
                    seen.add(simplify((l - r).subs(x.X, -1)) == 0)
                except Exception:
                    pass
            rows.append(seen)
        keys = set()
        for combo in __import__('itertools').product([True, False], repeat=4):
            if combo.count(True) == 1 and all(c in seen for c, seen in zip(combo, rows)):
                keys.add(combo.index(True))
        self.assertEqual(keys, {3})      # d) only

    def test_item_5_every_unique_rival_reading_with_the_pages_brackets_gives_the_same_expression(self):
        from sympy import Eq, Symbol, simplify, solve
        keys = set()
        for left in self.variants('8x2y3', 2, bars=False):
            for sep in ('/', '*', ''):
                for inner in ('2y/x', '2y*x', '2yx'):
                    for tail in ('^2', '2', '^(2)'):
                        try:
                            l, r = x.eq_sides(f'{left}{sep}B=({inner}){tail}')
                            sol = solve(Eq(l, r), Symbol('B'))
                            if len(sol) != 1:
                                continue
                            hit = [o for o in x.READINGS[5].options if simplify(x.parse(o) - sol[0]) == 0]
                            if len(hit) == 1:
                                keys.add(hit[0])
                        except Exception:
                            pass
        self.assertEqual(keys, {'2x^4y'})


class StudentBookDerivatives(unittest.TestCase):
    """Unit 6 of the semester-2 student book: p.68-69 (lesson 2) and the unit test, p.77.

    The guide reproduces each student page with its answers printed on it (guide p.102,
    p.103, p.112); an item is `verified` only when one of those, read by value, equals
    SymPy's answer.
    """

    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        cls.items = {r['id']: r for r in cls.by_source.get('math-s2-student-book', [])}
        cls.reasons = {q['id']: q['reason'] for q in cls.rejects}

    def test_a_derivative_keeps_the_function_name_the_book_gives_it(self):
        self.assertEqual(x.solve_derivative('g(x) = 3x^9'), "g'(x) = 27x^8")
        self.assertEqual(x.solve_derivative('t(x) = 6 - 2x + x^2'), "t'(x) = 2x - 2")
        self.assertEqual(x.solve_derivative('f (x) = 7x^3'), "f'(x) = 21x^2")

    def test_a_name_that_is_not_one_letter_is_rejected(self):
        for stem in ('fg(x) = x^2', '2(x) = x', 'f(y) = y^2', '(x) = x'):
            with self.subTest(stem=stem), self.assertRaises(x.Reject):
                x.solve_derivative(stem)

    def test_printed_derivatives_are_read_with_their_names_and_labels(self):
        got = x.printed_derivatives("f '(x) = 0 \t)14\nf '(x) = 8x 7 )15\nk = 3")
        self.assertEqual([g[:3] for g in got], [('f', '0', 14), ('f', '8x^7', 15)])
        self.assertEqual(got[1][3], "f '(x) = 8x 7 )15")
        got = x.printed_derivatives("g '(x) = 27x8 \tr '(x) = -10x\nf '(x) = m")
        self.assertEqual([g[:3] for g in got], [('g', '27x^8', None), ('r', '-10x', None), ('f', 'm', None)])

    def test_a_printed_entry_split_over_lines_is_not_read(self):
        self.assertEqual(x.printed_derivatives("f '(x) = 7\n3\ng '(x) = 2x"), [('g', '2x', None, "g '(x) = 2x")])
        # guide p.112 prints item 32's 3x^2 - 12 as «3x 2» over «- 12»: the line continues
        self.assertEqual(x.printed_derivatives("f '(x) = 3x 2\n- 12"), [])
        # a split 1/3 x^2 must not read as 1
        self.assertEqual(x.printed_derivatives("f '(x) = 1\n3 x2"), [])

    def test_the_next_answer_on_the_next_line_is_not_a_continuation(self):
        # guide p.102: item 4's answer, then item 7's; item 2's and 3's, then a section number
        got = x.printed_derivatives("i '(x) = 4x3 - 3\n-26.8\ng '(x) = 27x8 \tr '(x) = -10x\n4\tالتدريب")
        self.assertEqual([g[:3] for g in got], [('i', '4x^3 - 3', None), ('g', '27x^8', None), ('r', '-10x', None)])

    def test_a_number_in_the_next_column_is_not_an_exponent(self):
        self.assertEqual(x.printed_derivatives("f '(x) = 2x \t3"), [])
        # a tab before the next entry or before the label still ends the value cleanly
        got = x.printed_derivatives("v '(x) = 2x + 1 \tt '(x) = -2 + 2x")
        self.assertEqual([g[:3] for g in got], [('v', '2x + 1', None), ('t', '-2 + 2x', None)])
        self.assertEqual([g[:3] for g in x.printed_derivatives("f '(x) = 0 \t)14")], [('f', '0', 14)])

    def test_on_a_labelled_page_an_unlabelled_entry_answers_nothing(self):
        # p.112 labels the unit test's 14-19; its unlabelled entries are items 29 and 32
        got = x.printed_derivatives("f '(x) = 0 \t)14\nf '(x) = m\nf '(x) = 3x 2\nk = 3")
        self.assertEqual([g[:3] for g in got], [('f', '0', 14)])

    def test_a_labelled_entry_is_preferred_to_an_unlabelled_one(self):
        recs = [{'source': {'number': n}, 'computedAnswer': "f'(x) = 2x", 'status': 'computed'} for n in (3, 5)]
        x.pair_derivatives(recs, [('f', '2x', None, 'a'), ('f', '2x', 3, 'b')])
        self.assertEqual([r['printedAnswer'] for r in recs], ['b', 'a'])

    def test_a_printed_derivative_matches_by_name_and_value_and_label(self):
        rec = {'source': {'number': 2}, 'computedAnswer': "g'(x) = 27x^8"}
        self.assertTrue(x.derivative_matches(('g', '27x^8', None), rec))
        self.assertFalse(x.derivative_matches(('r', '27x^8', None), rec))    # another item's name
        self.assertFalse(x.derivative_matches(('g', '27x^7', None), rec))    # another value
        self.assertFalse(x.derivative_matches(('g', '27x^8', 3), rec))       # another item's label
        self.assertTrue(x.derivative_matches(('g', '27x^8', 2), rec))

    def test_golden_derivative_from_student_page_68(self):
        r = self.items['bi-math-s2-student-book-u6l2-2']
        self.assertEqual((r['stem'], r['computedAnswer']), ('g(x) = 3x^9', "g'(x) = 27x^8"))
        self.assertEqual((r['status'], r['verificationSource'], r['printedAnswer']), ('verified', 'sympy+book', "g '(x) = 27x8"))
        self.assertEqual(r['source'], {'sourceId': 'math-s2-student-book', 'page': 68, 'bookPage': 68, 'unit': 6, 'number': 2})
        self.assertEqual((r['kind'], r['lessonId'], r['check']), ('exercise', 'kbl-math-s2-nccd-u6_l2', None))

    def test_golden_unit_test_derivative_from_student_page_77(self):
        r = self.items['bi-math-s2-student-book-u6l2-t15']
        self.assertEqual((r['stem'], r['computedAnswer']), ('f(x) = x^8', "f'(x) = 8x^7"))
        self.assertEqual((r['kind'], r['tier'], r['tierSource']), ('unit-test', 'medium', 'default'))
        self.assertEqual((r['status'], r['printedAnswer']), ('verified', "f '(x) = 8x 7 )15"))
        self.assertEqual(r['source']['bookPage'], 77)

    def test_the_products_on_page_69_are_verified(self):
        for n in (24, 25, 26):
            with self.subTest(n=n):
                self.assertEqual(self.items[f'bi-math-s2-student-book-u6l2-{n}']['status'], 'verified')

    def test_the_unreadable_ones_are_quarantined_with_a_reason(self):
        # 7: `3/5 x3` arrives as «3» then «5 x3» on the next line, so the stem is two lines
        self.assertEqual(self.reasons['bi-math-s2-student-book-u6l2-7'], 'not_a_function_definition')
        self.assertEqual(self.reasons['bi-math-s2-student-book-u6l2-8'], 'exponent_out_of_range')
        self.assertEqual(self.reasons['bi-math-s2-student-book-u6l2-9'], 'broken_fraction_or_exponent')
        self.assertEqual(self.reasons['bi-math-s2-student-book-u6l2-t14'], 'broken_fraction_or_exponent')

    def test_unit_test_ids_never_collide_with_the_lessons_practice_numbers(self):
        ids = [r['id'] for r in self.items.values() if r['kind'] == 'unit-test']
        self.assertEqual(sorted(ids), sorted(
            ['bi-math-s2-student-book-u6l1-t29']
            + [f'bi-math-s2-student-book-u6l2-t{n}' for n in (5, 6, 7, 11, 12, 15, 16, 18, 19, 24, 32, 33)]
            + [f'bi-math-s2-student-book-u6l3-t{n}' for n in (9, 10, 20, 21, 22, 23, 25, 34)]))

    def test_item_17_is_left_out_on_purpose_not_quarantined(self):
        # `f(x) = x` is a near-duplicate of four other items by the validator's measure
        self.assertNotIn('bi-math-s2-student-book-u6l2-t17', self.items)
        self.assertNotIn('bi-math-s2-student-book-u6l2-t17', self.reasons)

    def test_every_served_one_is_verified(self):
        # the derivatives: p.68-69's practice and the unit test's 14-19
        open_ones = [r for r in self.items.values() if r['lessonId'] == 'kbl-math-s2-nccd-u6_l2'
                     and (r['source']['page'] in (68, 69) or 14 <= r['source']['number'] <= 19)
                     and r['kind'] != 'unit-test-mcq']
        self.assertEqual(len(open_ones), 13)
        self.assertEqual({r['status'] for r in open_ones}, {'verified'})


class StudentBookChoices(unittest.TestCase):
    """The unit-6 test's multiple choice: student p.76 items 1-4 and p.77 items 30-31.

    Read from hand-written readings (`SB2_READINGS`) that must keep the page's characters
    and brackets and leave exactly one correct option. The guide marks its key by circling
    it, which the text layer does not carry, so every one is `computed`, never `verified`.
    """

    KEYS = {  # id: (lessonId suffix, stem, options, key)
        't1': ('u6_l1', 'x = 5\nf(x) = 3x - 1', ['3', '1/3', '-1', '0'], '3'),
        't2': ('u6_l2', 'f(x) = x(2x + 1)', ['x', '2x + 1', '2x^2 + x', '4x + 1'], '4x + 1'),
        't3': ('u6_l3', 'f(x) = (x-2)(x-3)^2', ['-7/3', '-5/2', '7/3', '5/2'], '7/3'),
        't4': ('u6_l2', 's(t) = t^2\nt = 1', ['0', '1', '2', '4'], '2'),
        't30': ('u6_l3', 'f(x) = 3x^5 - 5x^3 + 15', ['-1, 0, 1', '-1, 0', '0, 1', '-1, 1'], '-1, 1'),
        't31': ('u6_l3', 'f(x) = (x-3)^2', ['0', '1', '2', '3'], '1'),
    }

    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        cls.items = {r['id'].rsplit('-', 1)[1]: r for r in cls.by_source.get('math-s2-student-book', [])
                     if r['kind'] == 'unit-test-mcq'}
        cls.p76 = x.page_text('math-s2-student-book', 76)
        cls.p77 = x.page_text('math-s2-student-book', 77)

    def test_all_six_are_served_computed_with_the_right_key(self):
        self.assertEqual(sorted(self.items), sorted(self.KEYS))
        for k, (lesson, stem, options, key) in self.KEYS.items():
            with self.subTest(item=k):
                r = self.items[k]
                self.assertEqual((r['stem'], r['options'], r['computedAnswer']), (stem, options, key))
                self.assertEqual(r['lessonId'], f'kbl-math-s2-nccd-{lesson}')
                self.assertEqual((r['status'], r['verificationSource'], r['printedAnswer'], r['check']),
                                 ('computed', 'sympy', None, None))
                self.assertEqual((r['tier'], r['tierSource']), ('medium', 'default'))

    def test_the_choice_block_is_cut_at_each_d_line_and_keeps_a_split_denominator(self):
        lines = lambda b: [l.strip() for l in b.split('\n') if l.strip()]
        blocks = x.split_choices(self.p76, (1, 2, 3, 4))
        self.assertEqual(lines(blocks[3])[-2:], ['3 d) 5', '2'])          # d)'s denominator stays with item 3
        self.assertEqual(lines(blocks[4])[0], 's(t) = t 2')                # and item 4's heading lost its «4»
        blocks = x.split_choices(self.p77, (30, 31))
        self.assertEqual(lines(blocks[31])[:2], ['f(x) = (x-3)', '2'])     # the exponent printed in the heading

    def test_a_chunk_without_its_own_number_is_not_cut(self):
        blocks = x.split_choices(self.p76, (1, 2, 3, 5))
        self.assertIsInstance(blocks[5], x.Reject)

    def test_residue_is_checked_against_the_page_but_never_served(self):
        r = x.SB2_READINGS[(76, 4)]
        self.assertTrue(any('«' in l for l in r.stem))
        self.assertEqual(x.served_stem(r.stem), ('s(t) = t^2', 't = 1'))

    def test_a_reading_that_drops_a_character_is_refused(self):
        page = x.split_choices(self.p76, (1, 2, 3, 4))[4]
        dropped = x.Reading(('s(t) = t^2', 't = 1 «m/s»'), x.SB2_READINGS[(76, 4)].options)   # «t s» gone
        with self.assertRaises(x.Reject) as e:
            x.solve_reading(4, page, 'velocity_at', dropped)
        self.assertEqual(str(e.exception), 'reading_changes_characters')

    def test_the_flattened_readings_give_no_key_or_another_key(self):
        page = x.split_choices(self.p76, (1, 2, 3, 4))[3]
        flat = x.Reading(('«x»', 'f(x) = (x-2)(x-3)2'), x.SB2_READINGS[(76, 3)].options)
        with self.assertRaises(x.Reject):   # 2(x-2)(x-3) has no maximum
            x.solve_reading(3, page, 'max_at', flat)
        # Item 31 read flat, f(x) = 2(x-3), has no critical point, so the gate alone would accept
        # option a): the reading's exponent rests on the page image (p.77, compared by eye).
        page = x.split_choices(self.p77, (30, 31))[31]
        flat = x.Reading(('f(x) = (x-3)2',), x.SB2_READINGS[(77, 31)].options)
        self.assertEqual(x.solve_reading(31, page, 'critical_count', flat)[2], 0)

    def test_the_checks(self):
        h = x.option_holds
        self.assertTrue(h('slope_at', 'x = 5\nf(x) = 3x - 1', '3'))
        self.assertFalse(h('slope_at', 'x = 5\nf(x) = 3x - 1', '1/3'))
        self.assertTrue(h('derivative', 'f(x) = x(2x + 1)', '4x + 1'))
        self.assertFalse(h('derivative', 'f(x) = x(2x + 1)', '2x + 1'))
        self.assertTrue(h('max_at', 'f(x) = (x-2)(x-3)^2', '7/3'))
        self.assertFalse(h('max_at', 'f(x) = (x-2)(x-3)^2', '3'))       # a minimum
        self.assertTrue(h('velocity_at', 's(t) = t^2\nt = 1', '2'))
        self.assertFalse(h('velocity_at', 's(t) = t^2\nt = 1', '1'))
        self.assertTrue(h('extrema_at', 'f(x) = 3x^5 - 5x^3 + 15', '-1, 1'))
        self.assertFalse(h('extrema_at', 'f(x) = 3x^5 - 5x^3 + 15', '-1, 0, 1'))  # 0 is not one
        self.assertTrue(h('critical_count', 'f(x) = (x-3)^2', '1'))
        self.assertFalse(h('critical_count', 'f(x) = (x-3)^2', '2'))

    def test_an_undecided_second_derivative_is_not_judged(self):
        with self.assertRaises(x.Reject) as e:
            x.option_holds('max_at', 'f(x) = x^4', '0')
        self.assertEqual(str(e.exception), 'second_derivative_zero')

    def test_a_curve_that_is_not_a_polynomial_is_not_judged(self):
        for check in ('extrema_at', 'critical_count'):
            with self.subTest(check=check), self.assertRaises(x.Reject) as e:
                x.option_holds(check, 'f(x) = 1/x', '0')
            self.assertEqual(str(e.exception), 'not_a_polynomial')


class StudentBookExtrema(unittest.TestCase):
    """Lesson 6.3's practice, student p.74 items 1 and 3-10: local maxima and minima.

    No readable printed key (the guide's copy of p.74 has none in its text layer, and the
    appendix only split, rounded fragments for 9 and 10), so every one is `computed`. The key
    is fixed Arabic labels on their own lines and Latin maths on its own lines, never mixed
    on one line (bidi). Item 2 is left out: a near-duplicate of item 1.
    """

    MAX, MIN = x.EXTREMA_MAX_AR, x.EXTREMA_MIN_AR
    KEYS = {
        1: f'{x.EXTREMA_NO_MAX_AR}\n{x.EXTREMA_MIN_AR}\nf(2) = -1',
        3: f'{x.EXTREMA_MAX_AR}\nf(5/2) = 29/4\n{x.EXTREMA_NO_MIN_AR}',
        4: f'{x.EXTREMA_MAX_AR}\nf(-3) = 40.5\n{x.EXTREMA_MIN_AR}\nf(2) = -22',
        5: f'{x.EXTREMA_MAX_AR}\nf(-3) = 81\nf(3) = 81\n{x.EXTREMA_MIN_AR}\nf(0) = 0',
        6: f'{x.EXTREMA_MAX_AR}\nf(-1) = 8\n{x.EXTREMA_MIN_AR}\nf(1) = 0',
        7: f'{x.EXTREMA_MAX_AR}\nf(-2) = 12\n{x.EXTREMA_MIN_AR}\nf(2) = -20',
        8: x.EXTREMA_NONE_AR,
        9: f'{x.EXTREMA_MAX_AR}\nf(-√6/3) = 4√6/9 + 4\n{x.EXTREMA_MIN_AR}\nf(√6/3) = 4 - 4√6/9',   # SymPy's term order
        10: f'{x.EXTREMA_MAX_AR}\nf(-2) = 66\n{x.EXTREMA_MIN_AR}\nf(4/3) = 1282/27',
    }

    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        cls.items = {r['source']['number']: r for r in cls.by_source.get('math-s2-student-book', [])
                     if r['lessonId'] == 'kbl-math-s2-nccd-u6_l3' and r['kind'] == 'exercise'}

    def test_every_key(self):
        self.assertEqual(sorted(self.items), sorted(self.KEYS))
        for n, key in self.KEYS.items():
            with self.subTest(item=n):
                r = self.items[n]
                self.assertEqual(r['computedAnswer'], key)
                self.assertEqual((r['status'], r['verificationSource'], r['printedAnswer'], r['check']),
                                 ('computed', 'sympy', None, None))
                self.assertEqual(r['source'], {'sourceId': 'math-s2-student-book', 'page': 74, 'bookPage': 74,
                                               'unit': 6, 'number': n})
                self.assertEqual(r['tierSource'], 'position')

    def test_golden_stem(self):
        self.assertEqual(self.items[4]['stem'], 'f(x) = x^3 + 1.5x^2 - 18x')
        self.assertEqual(self.items[9]['stem'], 'f(x) = x^3 -2x + 4')

    def test_item_2_is_left_out_on_purpose_not_quarantined(self):
        self.assertNotIn(2, self.items)
        self.assertNotIn('bi-math-s2-student-book-u6l3-2', {q['id'] for q in self.rejects})

    def test_no_line_mixes_arabic_and_maths(self):
        phrases = {x.EXTREMA_MAX_AR, x.EXTREMA_MIN_AR, x.EXTREMA_NO_MAX_AR, x.EXTREMA_NO_MIN_AR, x.EXTREMA_NONE_AR}
        for r in self.items.values():
            for line in r['computedAnswer'].split('\n'):
                with self.subTest(line=line):
                    self.assertTrue(line in phrases or not x.ARABIC.search(line))

    def test_a_flat_point_is_not_an_extremum(self):
        # 2x^3 + 7: f'(0) = 0 but f' does not change sign there
        self.assertEqual(x.solve_extrema('f(x) = 2x^3 + 7'), x.EXTREMA_NONE_AR)
        # x^4: f' = 4x^3, a root of odd multiplicity 3, so 0 IS a minimum
        self.assertEqual(x.solve_extrema('f(x) = x^4'), f'{x.EXTREMA_NO_MAX_AR}\n{x.EXTREMA_MIN_AR}\nf(0) = 0')

    def test_what_cannot_be_judged_is_refused(self):
        for stem, reason in (('f(x) = 1/x', 'not_a_polynomial'),
                             ('f(x) = x^4 + 2x^2 + 4x', 'not_clean')):   # f' = 4(x^3 + x + 1): a CRootOf
            with self.subTest(stem=stem), self.assertRaises(x.Reject) as e:
                x.solve_extrema(stem)
            self.assertEqual(str(e.exception), reason)

    def test_a_constant_has_none_as_the_book_says(self):
        # f' ≡ 0: every point is a non-strict extremum, but the guide answers p.77 item 20
        # (f(x) = 17) «لا توجد قيم عظمى وقيم صغرى» - the school counts strict extrema only
        self.assertEqual(x.solve_extrema('f(x) = 17'), x.EXTREMA_NONE_AR)


class StudentBookTestExtrema(unittest.TestCase):
    """The unit-6 test's open max/min questions, student p.77 items 20-23.

    The guide's copy (p.112) prints each answer on a line ending in its `)n` label. An item
    is `verified` only when that line holds exactly what SymPy found - the same kinds and the
    same exact points, or the «none» phrase for none."""

    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        cls.items = {r['source']['number']: r for r in cls.by_source.get('math-s2-student-book', [])
                     if r['lessonId'] == 'kbl-math-s2-nccd-u6_l3' and r['kind'] == 'unit-test'
                     and 20 <= r['source']['number'] <= 23}

    def test_the_four_keys_and_their_states(self):
        self.assertEqual(sorted(self.items), [20, 21, 22, 23])
        self.assertEqual(self.items[20]['computedAnswer'], x.EXTREMA_NONE_AR)
        self.assertEqual(self.items[21]['computedAnswer'], x.EXTREMA_NONE_AR)
        self.assertEqual(self.items[22]['computedAnswer'], f'{x.EXTREMA_NO_MAX_AR}\n{x.EXTREMA_MIN_AR}\nf(5/2) = -1/4')
        self.assertEqual(self.items[23]['computedAnswer'],
                         f'{x.EXTREMA_MAX_AR}\nf(1/3) = 35/27\n{x.EXTREMA_MIN_AR}\nf(1) = 1')
        for n in (20, 21, 22):
            with self.subTest(item=n):
                r = self.items[n]
                self.assertEqual((r['status'], r['verificationSource'], r['check']), ('verified', 'sympy+book', None))
                self.assertTrue(r['printedAnswer'].endswith(f'){n}'), r['printedAnswer'])
        # 23's maximum is printed split and rounded (1.296 for 35/27): no agreement, so computed
        self.assertEqual((self.items[23]['status'], self.items[23]['printedAnswer']), ('computed', None))

    def test_ids_kind_and_citation_fields(self):
        r = self.items[22]
        self.assertEqual(r['id'], 'bi-math-s2-student-book-u6l3-t22')
        self.assertEqual((r['kind'], r['tier'], r['tierSource']), ('unit-test', 'medium', 'default'))
        self.assertEqual(r['source'], {'sourceId': 'math-s2-student-book', 'page': 77, 'bookPage': 77, 'unit': 6, 'number': 22})

    def test_item_23_is_joined_across_its_line_break(self):
        self.assertEqual(self.items[23]['stem'], 'f(x)=2x^3 -4x^2 +2x+1')

    def test_only_a_line_starting_with_a_sign_is_joined(self):
        self.assertEqual(x.join_continued('f(x)=2x3 -4x2\n+2x+1'), 'f(x)=2x3 -4x2 +2x+1')
        self.assertEqual(x.join_continued('f(x)= 3\n5 x3 + x4'), 'f(x)= 3\n5 x3 + x4')   # a split fraction stays split

    def test_the_printed_lines_are_read_by_label(self):
        got = x.printed_extrema(x.page_text('math-s2-teacher-guide', 112))
        self.assertEqual(got[20][1], set())
        self.assertEqual(got[21][1], set())
        self.assertEqual(got[22][1], {('min', x.Rational(5, 2), x.Rational(-1, 4))})
        self.assertIsNone(got[23][1])     # «3 , 1.296)»: a fragment, not an answer

    def test_a_printed_line_verifies_only_the_whole_answer(self):
        rec = lambda key: {'computedAnswer': key}
        full = f'{x.EXTREMA_MAX_AR}\nf(1/3) = 35/27\n{x.EXTREMA_MIN_AR}\nf(1) = 1'
        self.assertEqual(x.extrema_set(full), {('max', x.Rational(1, 3), x.Rational(35, 27)), ('min', 1, 1)})
        self.assertFalse(x.extrema_set(full) == {('min', 1, 1)})                  # a missing max is no match
        self.assertEqual(x.extrema_set(x.EXTREMA_NONE_AR), set())
        self.assertIsNone(x.extrema_set('f(x) = 2'))                              # not a key of this family


class StudentBookFigures(unittest.TestCase):
    """The unit-6 test's graph questions whose curve the question itself defines: p.77 item 29
    (the line through (0, 2) and (6, 0)) and 32-34 (f(x) = x^3 - 12x + 17, A the maximum, B the
    y-intercept, C the minimum). Each carries a drawing (`visual`, a `function-graph`) that is
    checked against the question: its curve is the stated one, its points sit where the
    question says. 26-28 are left out: their curve has no formula."""

    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        cls.items = {r['source']['number']: r for r in cls.by_source.get('math-s2-student-book', [])
                     if r.get('visual')}

    def test_the_four_items_their_keys_and_lessons(self):
        self.assertEqual(sorted(self.items), [29, 32, 33, 34])
        expect = {
            29: ('kbl-math-s2-nccd-u6_l1', 'P(0, 2), Q(6, 0)', "f'(x) = -1/3"),
            32: ('kbl-math-s2-nccd-u6_l2', 'f(x) = x^3 - 12x + 17', "f'(x) = 3x^2 - 12"),
            33: ('kbl-math-s2-nccd-u6_l2', 'f(x) = x^3 - 12x + 17', '-12'),
            34: ('kbl-math-s2-nccd-u6_l3', 'f(x) = x^3 - 12x + 17', 'A(-2, 33), C(2, 1)'),
        }
        for n, (lesson, stem, key) in expect.items():
            with self.subTest(item=n):
                r = self.items[n]
                self.assertEqual((r['lessonId'], r['stem'], r['computedAnswer']), (lesson, stem, key))
                self.assertEqual((r['kind'], r['status'], r['printedAnswer'], r['check']),
                                 ('unit-test', 'computed', None, None))
                self.assertEqual(r['visual']['kind'], 'function-graph')

    def test_the_drawings(self):
        self.assertEqual(self.items[29]['visual'], {
            'kind': 'function-graph', 'functions': [{'expr': '2 - x/3'}], 'x': [-1, 7],
            'points': [{'at': 0, 'label': 'P', 'on': 0}, {'at': 6, 'label': 'Q', 'on': 0}]})
        cubic = {'kind': 'function-graph', 'functions': [{'expr': 'x^3 - 12x + 17'}], 'x': [-4, 4],
                 'points': [{'at': -2, 'label': 'A', 'on': 0}, {'at': 0, 'label': 'B', 'on': 0},
                            {'at': 2, 'label': 'C', 'on': 0}]}
        for n in (32, 33, 34):
            self.assertEqual(self.items[n]['visual'], cubic)

    def test_a_drawing_of_another_curve_is_refused(self):
        with self.assertRaises(x.Reject) as e:
            x.check_figure('f(x) = x^3 - 12x + 17', {'functions': [{'expr': 'x^3 - 12x + 16'}], 'points': []}, {})
        self.assertEqual(str(e.exception), 'drawing_is_another_curve')

    def test_a_point_off_the_stated_line_is_refused(self):
        with self.assertRaises(x.Reject) as e:
            x.check_figure('f(x) = 2 - x/3', {'functions': [{'expr': '2 - x/3'}], 'points': []},
                           {'through': [(0, 2), (6, 1)]})
        self.assertEqual(str(e.exception), 'curve_misses_a_stated_point')

    def test_a_drawing_whose_labels_disagree_with_the_answer_is_refused(self):
        # A must be the maximum: put it at the minimum and the item is quarantined
        swapped = {'functions': [{'expr': 'x^3 - 12x + 17'}],
                   'points': [{'at': 2, 'label': 'A'}, {'at': 0, 'label': 'B'}, {'at': -2, 'label': 'C'}]}
        with self.assertRaises(x.Reject) as e:
            x.solve_figure('f(x) = x^3 - 12x + 17', swapped, {'ask': 'extrema_points'})
        self.assertEqual(str(e.exception), 'drawing_labels_disagree')

    def test_the_stated_data_must_be_on_the_page(self):
        page = x.page_text('math-s2-student-book', 77)
        x.require_on_page(page, ['(0, 2)', '(6, 0)', 'f(x) = x^3 -12x + 17'])
        with self.assertRaises(x.Reject) as e:
            x.require_on_page(page, ['f(x) = x^3 -12x + 18'])
        self.assertEqual(str(e.exception), 'not_on_page')


class StudentBookWordProblems(unittest.TestCase):
    """The unit-6 test's word problems: student p.76 items 5-7, 9-12 and p.77 items 24-25.

    Each is restated in our own Arabic with its maths in the stem, every number the
    statement carries is checked on the page, and an item is `verified` only when every
    part of its key equals a printed entry on the guide's copy of the page (p.111, p.112):
    the same value and unit, and the same name where one is printed. Item 8 ("show that
    V(x) = …") prints its own answer; 13 is a near-duplicate of 12."""

    KEYS = {  # number: (lesson, stem, key, status)
        5: ('u6_l2', 'h(x) = 2x^2 + x', "h'(x) = 4x + 1", 'computed'),
        6: ('u6_l2', 'f(x) = 5x^2 + 2', "c = 7, f'(-1) = -10 < 0", 'computed'),
        7: ('u6_l2', 'f(x) = 4x^3 + 2', 'y = 12x + 10', 'computed'),
        9: ('u6_l3', 'V(x) = 200x - 4/3 x^3', 'x = 5√2', 'verified'),
        10: ('u6_l3', 'V(x) = 200x - 4/3 x^3', 'V = 2000√2/3 cm^3', 'computed'),
        11: ('u6_l2', 's(t) = t^2 + 1', 'v(2) = 4 m/s, t = 3 s', 'verified'),
        12: ('u6_l2', 's(t) = (t - 10)^2', 'v(2) = -16 m/s', 'verified'),
        24: ('u6_l2', 's(t) = 0.6t^3 - 1.5t - 0.9', 't = 3 s', 'verified'),
        25: ('u6_l3', 'f(x) = kx - x^3', 'k = 3', 'verified'),
    }

    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        ids = {f'bi-math-s2-student-book-u6l{lesson[-1]}-t{n}': n for n, (lesson, *_r) in cls.KEYS.items()}
        cls.items = {ids[r['id']]: r for r in cls.by_source.get('math-s2-student-book', []) if r['id'] in ids}

    def test_every_item_key_and_state(self):
        self.assertEqual(sorted(self.items), sorted(self.KEYS))
        for n, (lesson, stem, key, status) in self.KEYS.items():
            with self.subTest(item=n):
                r = self.items[n]
                self.assertEqual((r['lessonId'], r['stem'], r['computedAnswer'], r['status']),
                                 (f'kbl-math-s2-nccd-{lesson}', stem, key, status))
                self.assertEqual((r['kind'], r['check'], r['id']),
                                 ('unit-test', None, f'bi-math-s2-student-book-u6l{lesson[-1]}-t{n}'))
                if status == 'verified':
                    self.assertEqual(r['verificationSource'], 'sympy+book')
                    self.assertTrue(r['printedAnswer'])
                else:
                    self.assertIsNone(r['printedAnswer'])

    def test_8_and_13_are_left_out_on_purpose(self):
        rejected = {q['id'] for q in self.rejects}
        for n in (8, 13):
            self.assertNotIn(n, self.items)
            self.assertFalse(any(i.endswith(f'-t{n}') and 'u6l' in i for i in rejected if 'student' in i), n)

    def test_the_printed_entries_matched(self):
        self.assertEqual(self.items[9]['printedAnswer'], 'x = √50')
        self.assertEqual(self.items[11]['printedAnswer'], '4 m/s | t = 3 s')
        self.assertEqual(self.items[12]['printedAnswer'], '-16 m/s')

    def test_a_part_reads_name_value_unit(self):
        self.assertEqual(x.answer_part('v(2) = -16 m/s'), ('v(2)', x.Integer(-16), 'm/s'))
        self.assertEqual(x.answer_part('x = √50'), ('x', 5 * x.sqrt(2), None))
        self.assertEqual(x.answer_part('942.8 cm3'), (None, x.Rational(9428, 10), 'cm^3'))
        self.assertIsNone(x.answer_part("f'(-1) = -10 < 0"))     # not one value

    def test_a_part_matches_only_the_same_value_unit_and_name(self):
        m = x.part_matches
        self.assertTrue(m(x.answer_part('v(2) = -16 m/s'), x.answer_part('-16 m/s')))   # printed has no name
        self.assertFalse(m(x.answer_part('v(2) = -16 m/s'), x.answer_part('-16 s')))    # another unit
        self.assertFalse(m(x.answer_part('t = 3 s'), x.answer_part('k = 3')))            # another name
        self.assertFalse(m(x.answer_part('V = 2000√2/3 cm^3'), x.answer_part('942.8 cm3')))  # rounded
        self.assertTrue(m(x.answer_part('x = 5√2'), x.answer_part('x = √50')))

    def test_a_printed_entry_two_items_could_take_verifies_neither(self):
        recs = [{'source': {'number': n}, 'computedAnswer': 't = 3 s', 'status': 'computed'} for n in (1, 2)]
        x.pair_applied(recs, ['t = 3 s'])
        self.assertEqual([r['status'] for r in recs], ['computed', 'computed'])

    def test_an_item_is_verified_only_when_every_part_is_printed(self):
        recs = [{'source': {'number': 1}, 'computedAnswer': 'v(2) = 4 m/s, t = 3 s', 'status': 'computed'}]
        x.pair_applied(recs, ['4 m/s'])
        self.assertEqual(recs[0]['status'], 'computed')
        x.pair_applied(recs, ['4 m/s \tt = 3 s'])
        self.assertEqual(recs[0]['status'], 'verified')

    def test_a_bare_number_is_never_a_printed_answer(self):
        # the guide's pages carry axis labels («3», «10», «-1»): a number with no name and no unit
        recs = [{'source': {'number': 1}, 'computedAnswer': 'k = 3', 'status': 'computed'}]
        x.pair_applied(recs, ['3', '-1'])
        self.assertEqual(recs[0]['status'], 'computed')

    def test_the_solvers_refuse_what_they_cannot_decide(self):
        with self.assertRaises(x.Reject) as e:       # the identity does not hold
            x.solve_applied('h(x) = 2x^2 + x', {'ask': 'derivative_identity', 'identity': "x(1 + h'(x)) = 3h(x)"})
        self.assertEqual(str(e.exception), 'identity_fails')
        with self.assertRaises(x.Reject) as e:       # two positive times give the velocity
            x.solve_applied('s(t) = t^3 - 6t^2', {'ask': 'time_for_velocity', 'velocity': '-9'})
        self.assertEqual(str(e.exception), 'time_not_unique')


class StudentBookSlopes(unittest.TestCase):
    """Lesson 6.1 (estimating slope), student p.61-62: items 10-16, 21, 24-26.

    The book asks for estimates and the guide accepts any close answer; the key is the exact
    value. An item is `verified` where the guide prints that number with its own words around
    it («8 أي إجابة قريبة من», «تقريبًا. 1.2»), with a unit, or as a result in its working
    (`a = 4`, for 24); a bare «0» or «-2» on a line is still an axis label."""

    KEYS = {  # number: (stem, key, status)
        10: ('f(x) = 0.1x^3\n(2, 0.8)', '1.2', 'verified'),
        11: ('y = 4x^2 + 1\n(1, 5)', '8', 'verified'),
        12: ('y = 3 + 2x^2\n(-1, 5)', '-4', 'verified'),
        13: ('y = 1 - x^2\n(-1, 0)', '2', 'verified'),
        14: ('y = 5x^3 + 1\n(0, 1)', '0', 'computed'),
        15: ('y = 9 - x^2\n(2, 5)', '-4', 'verified'),
        16: ('y = 8 - 2x\n(1, 6)', '-2', 'computed'),
        21: ('t: 0, 1, 2, 3, 4, 5\ns(t): 0, 2, 8, 18, 32, 50\n[1, 3]', '8 m/s', 'verified'),
        24: ('s(t) = at + bt^2\nt: 0, 1, 2, 3, 4\ns(t): 0, 5, 12, 21, 32', 'a = 4, b = 1', 'verified'),
        25: ('s(t) = 3t - t^2\nt = 2', 'v(2) = -1 m/s', 'computed'),
        26: ('f(x) = x^2 - 6x - 16', "f'(-2) = -10, f'(8) = 10, f'(0) = -6", 'computed'),
    }

    @classmethod
    def setUpClass(cls):
        cls.by_source, cls.rejects = x.build()
        ids = {f'bi-math-s2-student-book-u6l1-{n}': n for n in cls.KEYS}
        cls.items = {ids[r['id']]: r for r in cls.by_source.get('math-s2-student-book', []) if r['id'] in ids}

    def test_every_item_key_and_state(self):
        self.assertEqual(sorted(self.items), sorted(self.KEYS))
        for n, (stem, key, status) in self.KEYS.items():
            with self.subTest(item=n):
                r = self.items[n]
                self.assertEqual((r['lessonId'], r['stem'], r['computedAnswer'], r['status']),
                                 ('kbl-math-s2-nccd-u6_l1', stem, key, status))
                self.assertEqual((r['kind'], r['check'], r['source']['page']),
                                 ('exercise', None, 61 if n <= 16 else 62))
                self.assertTrue(r['instruction'].startswith(('أقدّر', 'يبيّن', 'يمثل')))
                if status == 'verified':
                    self.assertEqual(r['verificationSource'], 'sympy+book')
                else:
                    self.assertIsNone(r['printedAnswer'])

    def test_nothing_else_of_the_lesson_is_quarantined(self):
        self.assertEqual([q['id'] for q in self.rejects if '-u6l1-' in q['id']], [])

    def test_the_guide_pages_entries(self):
        read = lambda page, prose=False: [c[0] for c in x.applied_entries(x.page_text(x.G2, page).split('\n'), prose)]
        self.assertEqual(read(94), ['1.2', '8', '2', '-4', '-4', '1.9'])
        self.assertEqual(read(95), ['8 m/s', '8 m/s'])
        # the working of 24 states its results; `a + b = 5` and `2a + 4b = 12` are not results
        self.assertEqual(read(116, True), ['t = 3', 'b = 1', 'a = 4', 'b = 1'])

    def test_an_estimate_is_read_only_with_the_guides_words(self):
        e = lambda line: [c[0] for c in x.applied_entries([line])]
        self.assertEqual(e('8 أيُّ إجابةٍ قريبةٍ من'), ['8'])
        self.assertEqual(e('ﺗﻘﺮﻳﺒﹰﺎ. 1.2'), ['1.2'])
        self.assertEqual(e('8'), [])                                   # bare: an axis label
        self.assertEqual(e('تقريبًا. 10.5 m/s هي t = 3 السرعة عندما'), [])   # half a sentence

    def test_a_value_printed_twice_verifies_two_items_and_once_verifies_neither(self):
        recs = lambda: [{'source': {'number': n}, 'computedAnswer': '-4', 'status': 'computed'} for n in (1, 2)]
        twice, once = recs(), recs()
        x.pair_applied(twice, ['-4 أي إجابة قريبة من', '-4 أي إجابة قريبة من'])
        x.pair_applied(once, ['-4 أي إجابة قريبة من'])
        self.assertEqual([r['status'] for r in twice], ['verified', 'verified'])
        self.assertEqual([r['status'] for r in once], ['computed', 'computed'])

    def test_the_solvers_refuse_what_they_cannot_decide(self):
        cases = [
            ('y = 4x^2 + 1\n(1, 6)', {'ask': 'slope_at_point'}, 'point_not_on_curve'),
            ('y = 4x^2 + 1', {'ask': 'slope_at_point'}, 'no_point'),
            ('t: 0, 1, 2\ns(t): 0, 2, 8\n[1, 3]', {'ask': 'average_velocity'}, 'interval_not_in_table'),
            ('t: 0, 1, 2\ns(t): 0, 2\n[0, 1]', {'ask': 'average_velocity'}, 'not_a_value_table'),
            # a table no `at + bt^2` passes through exactly
            ('s(t) = at + bt^2\nt: 0, 1, 2, 3\ns(t): 0, 5, 12, 22', {'ask': 'fit_table', 'unknowns': ['a', 'b']},
             'table_not_fitted_once'),
            ('f(x) = x^2 + 1', {'ask': 'intercept_slopes'}, 'x_intercepts_not_rational'),
            ('f(x) = x^2 - 2', {'ask': 'intercept_slopes'}, 'x_intercepts_not_rational'),
        ]
        for stem, params, reason in cases:
            with self.subTest(stem=stem), self.assertRaises(x.Reject) as e:
                x.solve_applied(stem, params)
            self.assertEqual(str(e.exception), reason)


if __name__ == '__main__':
    unittest.main(verbosity=2)
