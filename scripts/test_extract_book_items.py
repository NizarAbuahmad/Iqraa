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
        rows = [e for e in x.TABLE if e.family == 'reading']
        self.assertEqual(sorted(n for e in rows for n in e.items), [3, 4, 5])

    def test_the_report_counts_the_new_items_as_computed(self):
        counts = {}
        for rs in self.by_source.values():
            for r in rs:
                counts[r['status']] = counts.get(r['status'], 0) + 1
        self.assertEqual((counts['verified'], counts['computed']), (5, 28))


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


if __name__ == '__main__':
    unittest.main(verbosity=2)
