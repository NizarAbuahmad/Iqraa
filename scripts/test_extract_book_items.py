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
        self.assertEqual(list(self.extras['notes']), ['bi-math-s1-teacher-guide-u1l3-8'])

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
        self.assertEqual({r['source']['number'] for r in self.items.values() if r['id'] in ids}, {1, 2, 6, 7, 8, 9, 10, 11})


if __name__ == '__main__':
    unittest.main(verbosity=2)
