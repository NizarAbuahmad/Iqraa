#!/usr/bin/env python3
"""Index real exercises and unit-test questions from the NCCD Grade 10 maths books.

Run:  python3 scripts/extract_book_items.py

Reads only committed files (the extracted page text and the exercise index) and
writes `lib/curriculum/src/data/book-items/<sourceId>.json` plus `report.json`.
See docs/superpowers/specs/2026-10-12-book-items-design.md.

Why this is conservative. The text layer flattens superscripts (`24x3` is
24x³) and splits fractions across lines, and no page image is reachable from a
fresh checkout. So a stem is accepted only when every character of it can be
read without guessing, and anything else is quarantined WITH A REASON. A stem
that parses to a different valid equation is worse than a missing one, which
is why the rules below reject on ambiguity instead of picking a reading.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'artifacts' / 'math-verifier'))

from sympy import CRootOf, Eq, Integer, Rational, Symbol, diff, expand, simplify, solve, sqrt  # noqa: E402
from verify_core import safe_parse_expr  # noqa: E402

EXTRACTED = ROOT / 'lib' / 'curriculum' / 'src' / 'data' / 'extracted'
EXERCISES = ROOT / 'knowledge-base' / 'grade-10-math' / 'exercises'
OUT_DIR = ROOT / 'lib' / 'curriculum' / 'src' / 'data' / 'book-items'

ARABIC = re.compile(r'[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]')
MINUS = str.maketrans({'−': '-', '–': '-', '‒': '-', '—': '-', '×': '*', '÷': '/'})
X, Y = Symbol('x'), Symbol('y')


# ── the hand-written lesson table ────────────────────────────────────────────
# Which items of which lesson are which kind of question. The scrambled Arabic
# instruction line is never parsed: `instruction_ar` is ours. Every row must
# join to a curriculum lesson, or build() stops (a silent skip hid 15 items once).
@dataclass(frozen=True)
class Entry:
    source: str           # sourceId of the PDF the page text comes from
    semester: str         # 's1' | 's2'
    unit: int             # as the book prints it
    lesson: int           # as the book prints it
    first: int
    last: int
    family: str           # system | derivative | derivative_at | mcq_pair | unit_open | reading
    instruction_ar: str
    # mcq_pair / unit_open / reading: the guide page holding the test. An exercise family:
    # the source page holding the items, for a source with no exercise index (the student book).
    page: int | None = None
    params: dict = field(default_factory=dict)
    numbers: tuple[int, ...] = ()                # unit_open: exactly these items (first..last is only the span)
    allow_none: bool = False                     # unit_open: «لا يوجد حل» is a servable answer for this row
    # derivative rows: the page of the s2 teacher guide that reproduces this page with its
    # answers printed on it. They are paired with the items by name and value (`pair_derivatives`).
    answers: int | None = None
    unit_test: bool = False                      # an exercise family printed in the unit test: kind `unit-test`
    visual: dict | None = None                   # `figure` rows: the drawing the question carries (lib/figure)

    @property
    def items(self) -> tuple[int, ...]:
        return self.numbers or tuple(range(self.first, self.last + 1))


EX1, EX2, G1 = 'math-s1-exercise-book', 'math-s2-exercise-book', 'math-s1-teacher-guide'
SB2, G2 = 'math-s2-student-book', 'math-s2-teacher-guide'
# Student p.77 items 32-34's curve, drawn as the book does: A (max), B (y-intercept), C (min).
# Written in the figure gate's canonical form (`on` explicit), so the gate returns it unchanged.
CUBIC_77 = {'kind': 'function-graph', 'functions': [{'expr': 'x^3 - 12x + 17'}], 'x': [-4, 4],
            'points': [{'at': -2, 'label': 'A', 'on': 0}, {'at': 0, 'label': 'B', 'on': 0},
                       {'at': 2, 'label': 'C', 'on': 0}]}
DERIVATIVE_AR = 'أجد مشتقة الاقتران الآتي'
SYSTEM_AR = 'أحل نظام المعادلتين الآتي'
PAIR_AR = 'أي الأزواج المرتبة الآتية يمثل حلا لنظام المعادلتين الآتي؟'
ROOT_AR = 'أي المعادلات الأسية الآتية يكون العدد الآتي حلا لها؟'
BOX_AR = 'ما المقدار الجبري الذي يجب وضعه في المربع الفارغ ليتحقق التساوي؟'
NO_SOLUTION_PARAM_AR = 'أجد جميع قيم c التي لا يكون للنظام الآتي أي حل'
# What the guide prints for a system with no real solution, after NFKC (the text
# layer has it in Arabic presentation forms), and what an item with that answer stores.
NO_SOLUTION_AR = 'لا يوجد حل'
APPENDIX_AR = 'أنظر ملحق الإجابات'

TABLE: list[Entry] = [
    Entry(EX1, 's1', 1, 2, 1, 12, 'system', SYSTEM_AR),
    Entry(EX1, 's1', 1, 3, 1, 12, 'system', SYSTEM_AR),
    Entry(EX2, 's2', 6, 2, 1, 10, 'derivative', 'أجد مشتقة الاقتران الآتي'),
    Entry(EX2, 's2', 6, 2, 15, 16, 'derivative_at', 'أجد قيمة f′(-1) للاقتران الآتي', params={'point': '-1'}),
    Entry(G1, 's1', 1, 2, 1, 1, 'mcq_pair', PAIR_AR, page=47),
    Entry(G1, 's1', 1, 3, 2, 2, 'mcq_pair', PAIR_AR, page=47),
    # Guide p.47, the open questions of the unit test. Items 6, 10 and 11 are linear-quadratic
    # systems (curriculum lesson u1_l1), 8 and 9 quadratic-quadratic (u1_l2); 7 and 12 are
    # not here on purpose: 7 opts in to «لا يوجد حل», 12 is an inequality (out of scope).
    Entry(G1, 's1', 1, 2, 6, 10, 'unit_open', SYSTEM_AR, page=47, numbers=(6, 10)),
    Entry(G1, 's1', 1, 2, 7, 7, 'unit_open', SYSTEM_AR, page=47, allow_none=True),
    Entry(G1, 's1', 1, 2, 11, 11, 'unit_open', NO_SOLUTION_PARAM_AR, page=47, params={'param': 'c'}),
    Entry(G1, 's1', 1, 3, 8, 9, 'unit_open', SYSTEM_AR, page=47),
    # Guide p.47 items 3-5: multiple choice whose exponents and fractions the text layer flattens,
    # so each is read from READINGS (below) instead of normalised. Items 3 and 4 are book lesson 5
    # (u1_l4, exponential equations), item 5 book lesson 4 (u1_l3, simplifying exponential expressions).
    Entry(G1, 's1', 1, 5, 3, 3, 'reading', PAIR_AR, page=47, params={'check': 'points'}),
    Entry(G1, 's1', 1, 5, 4, 4, 'reading', ROOT_AR, page=47, params={'check': 'root'}),
    Entry(G1, 's1', 1, 4, 5, 5, 'reading', BOX_AR, page=47, params={'check': 'box'}),
    # The semester-2 student book, unit 6 (derivatives). p.68 items 1-9 and p.69 items 24-26
    # are lesson 2's practice; p.77 items 14-19 are the unit test's «find the derivative»
    # questions, which are lesson 2's skill. The guide reproduces each page with its
    # answers printed on it (guide p.102, p.103, p.112). Items 7-9 and 14 are expected to
    # quarantine: split fractions (7, 9, 14) and `x99`, which no rule tells from a flattened
    # exponent (8). Items 10-23 and 27-30 of p.68-69, and the test's multiple choice and
    # max/min questions, are word problems, figures or another family: not here on purpose.
    Entry(SB2, 's2', 6, 2, 1, 6, 'derivative', DERIVATIVE_AR, page=68, answers=102),
    Entry(SB2, 's2', 6, 2, 7, 9, 'derivative_at', 'أجد قيمة f′(-2) للاقتران الآتي', page=68,
          params={'point': '-2'}),
    Entry(SB2, 's2', 6, 2, 24, 26, 'derivative', DERIVATIVE_AR, page=69, answers=103),
    # Not 17, `f(x) = x`: its prompt is so short that the shared instruction makes it a
    # near-duplicate (0.86 > the validator's 0.85) of four other derivative items in this
    # lesson, so a draw could never place it beside them and the plan, a dry run with one
    # seed, would promise a question the paper does not get (bookQuestions.test.ts).
    Entry(SB2, 's2', 6, 2, 14, 19, 'derivative', DERIVATIVE_AR, page=77, answers=112, unit_test=True,
          numbers=(14, 15, 16, 18, 19)),
    # Lesson 6.3's practice, p.74: «find the local maximum and minimum values (if any)». No
    # readable printed key, so `computed`. Not item 2, `x^2 + 6x - 3`: a near-duplicate (0.89) of
    # item 1 by the validator's measure, which the book plan cannot draw beside it. Not 11-13:
    # word problems.
    Entry(SB2, 's2', 6, 3, 1, 10, 'extrema', 'أجد القيم العظمى والقيم الصغرى المحلية للاقتران الآتي (إن وجدت)',
          page=74, numbers=(1, 3, 4, 5, 6, 7, 8, 9, 10)),
    # The unit-6 test's open max/min questions, p.77 items 20-23 (21-24 in the 2021 printing).
    # The guide prints each answer on a line labelled `)n` (p.112); `pair_extrema` verifies an
    # item only when that line holds exactly the computed answer. 23's stem is broken over two
    # lines by the text layer (`2x3 -4x2` / `+2x+1`), hence `join`.
    Entry(SB2, 's2', 6, 3, 20, 23, 'extrema', 'أجد القيم العظمى والقيم الصغرى المحلية للاقتران الآتي (إن وجدت)',
          page=77, answers=112, unit_test=True, params={'join': True}),
    # The unit-6 test's graph questions whose curve the question fixes, drawn (see solve_figure).
    # 29: «the line in the figure» through the labelled (0, 2) and (6, 0); its points are drawn
    # as P and Q because a drawn label may not hold a value, so the stem states them. 32-34: the
    # stated f(x) = x^3 - 12x + 17 with A the maximum, B the y-intercept, C the minimum, as the
    # newer printing (and the picture) say; the guide and the 2021 text call the minimum B.
    Entry(SB2, 's2', 6, 1, 29, 29, 'figure',
          'إذا كان المستقيم المار بالنقطتين P وQ في الشكل هو منحنى الاقتران f(x)، فأجد f′(x)', page=77,
          unit_test=True, params={'stem': 'P(0, 2), Q(6, 0)', 'curve': 'f(x) = 2 - x/3', 'ask': 'derivative',
                                  'through': [(0, 2), (6, 0)], 'on_page': ['(0, 2)', '(6, 0)']},
          visual={'kind': 'function-graph', 'functions': [{'expr': '2 - x/3'}], 'x': [-1, 7],
                  'points': [{'at': 0, 'label': 'P', 'on': 0}, {'at': 6, 'label': 'Q', 'on': 0}]}),
    Entry(SB2, 's2', 6, 2, 32, 32, 'figure', 'يمثل الشكل منحنى الاقتران الآتي. أجد f′(x)', page=77,
          unit_test=True, params={'stem': 'f(x) = x^3 - 12x + 17', 'curve': 'f(x) = x^3 - 12x + 17',
                                  'ask': 'derivative', 'on_page': ['f(x) = x^3 -12x + 17']},
          visual=CUBIC_77),
    Entry(SB2, 's2', 6, 2, 33, 33, 'figure',
          'يمثل الشكل منحنى الاقتران الآتي، ويقطع محور y عند النقطة B. أجد ميل منحنى الاقتران عند النقطة B',
          page=77, unit_test=True,
          params={'stem': 'f(x) = x^3 - 12x + 17', 'curve': 'f(x) = x^3 - 12x + 17', 'ask': 'slope_at',
                  'label': 'B', 'expect_at': 0, 'on_page': ['f(x) = x^3 -12x + 17']},
          visual=CUBIC_77),
    Entry(SB2, 's2', 6, 3, 34, 34, 'figure',
          'يمثل الشكل منحنى الاقتران الآتي، وله قيمة عظمى عند النقطة A وقيمة صغرى عند النقطة C. أجد إحداثيي كل من النقطتين A وC',
          page=77, unit_test=True,
          params={'stem': 'f(x) = x^3 - 12x + 17', 'curve': 'f(x) = x^3 - 12x + 17', 'ask': 'extrema_points',
                  'max': 'A', 'min': 'C', 'on_page': ['f(x) = x^3 -12x + 17']},
          visual=CUBIC_77),
    # The unit-6 test's word problems, restated in our own Arabic (the maths in the stem, every
    # number the restatement carries checked on the page by `on_page`); answers paired with the
    # guide's copy of the page (p.111 for p.76, p.112 for p.77) by `pair_applied`. Not 8 ("show
    # that V(x) = …": its answer is in the question, and its dimensions in the figure) and not 13
    # (a near-duplicate of 12, 0.89).
    Entry(SB2, 's2', 6, 2, 5, 5, 'applied', "أجد h′(x) للاقتران الآتي، ثم أبيّن أن x(1 + h′(x)) = 2h(x)",
          page=76, answers=111, unit_test=True,
          params={'stem': 'h(x) = 2x^2 + x', 'ask': 'derivative_identity', 'identity': "x(1 + h'(x)) = 2h(x)",
                  'on_page': ['h(x) = 2x^2 + x', "x(1 + h'(x)) = 2h(x)"]}),
    Entry(SB2, 's2', 6, 2, 6, 6, 'applied',
          'تقع النقطة P(-1, c) على منحنى الاقتران الآتي. أجد قيمة c، ثم أحدد إذا كان الميل موجبًا أو سالبًا عند النقطة P',
          page=76, answers=111, unit_test=True,
          params={'stem': 'f(x) = 5x^2 + 2', 'ask': 'point_slope_sign', 'at': '-1', 'unknown': 'c',
                  'on_page': ['P(-1, c)', 'f(x)= 5x^2 + 2']}),
    Entry(SB2, 's2', 6, 2, 7, 7, 'applied', 'أجد معادلة مماس منحنى الاقتران الآتي عند النقطة التي إحداثيها x يساوي -1',
          page=76, answers=111, unit_test=True,
          params={'stem': 'f(x) = 4x^3 + 2', 'ask': 'tangent', 'at': '-1', 'on_page': ['f(x) = 4x^3 + 2']}),
    Entry(SB2, 's2', 6, 3, 9, 9, 'applied',
          'يمثل الاقتران الآتي حجم قالب يستعمل لصنع لبن البناء بالسنتيمتر المكعب. أستعمل المشتقة لإيجاد قيمة x التي تجعل الحجم أكبر ما يمكن',
          page=76, answers=111, unit_test=True,
          params={'stem': 'V(x) = 200x - 4/3 x^3', 'ask': 'argmax', 'on_page': ['V(x)= 200x- 4/3 x^3']}),
    Entry(SB2, 's2', 6, 3, 10, 10, 'applied',
          'يمثل الاقتران الآتي حجم قالب يستعمل لصنع لبن البناء بالسنتيمتر المكعب. أجد أكبر حجم ممكن للقالب',
          page=76, answers=111, unit_test=True,
          params={'stem': 'V(x) = 200x - 4/3 x^3', 'ask': 'max_value', 'unit': 'cm^3', 'on_page': ['V(x)= 200x- 4/3 x^3']}),
    Entry(SB2, 's2', 6, 2, 11, 11, 'applied',
          'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية. أجد السرعة بعد ثانيتين، ثم أجد الزمن عندما تبلغ السرعة 6 m/s',
          page=76, answers=111, unit_test=True,
          params={'stem': 's(t) = t^2 + 1', 'ask': 'velocity_and_time', 'at': '2', 'velocity': '6',
                  'on_page': ['s(t) = t^2 + 1', '6 m/s']}),
    Entry(SB2, 's2', 6, 2, 12, 12, 'applied',
          'يمثل الاقتران الآتي موقع سيارة تتحرك في مسار مستقيم نحو محطة الوقود، حيث s الموقع بالأمتار بعد t ثانية. أجد سرعة السيارة بعد ثانيتين',
          page=76, answers=111, unit_test=True,
          params={'stem': 's(t) = (t - 10)^2', 'ask': 'velocity_at', 'at': '2', 'on_page': ['s = (t - 10)^2']}),
    Entry(SB2, 's2', 6, 2, 24, 24, 'applied',
          'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية. ما الزمن الذي تساوي عنده السرعة 14.7 m/s؟',
          page=77, answers=112, unit_test=True,
          params={'stem': 's(t) = 0.6t^3 - 1.5t - 0.9', 'ask': 'time_for_velocity', 'velocity': '14.7',
                  'on_page': ['s(t) = 0.6t^3 - 1.5t - 0.9', '14.7m/s']}),
    Entry(SB2, 's2', 6, 3, 25, 25, 'applied', 'أجد قيمة الثابت k إذا كان للاقتران الآتي نقطة حرجة عندما x = -1',
          page=77, answers=112, unit_test=True,
          params={'stem': 'f(x) = kx - x^3', 'ask': 'param_critical', 'at': '-1', 'param': 'k',
                  'on_page': ['f(x) = kx - x^3', 'x = -1']}),
    # The lessons' own word problems: lesson 6.2's p.68 items 10-15 (answers on guide p.102) and p.69
    # items 16-30 (p.103; 28-30 in the appendix, p.117), lesson 6.3's p.74 items 11-13 (p.109).
    # `first`/`last` span each lesson's exercises (the tier). Not 12 (a near-duplicate of 15, 0.89),
    # 23 (of 22, 0.857: one condition, two asks), 18 («mark on the curve»; the guide's x = 2 ± √2
    # fits a slope of 1, not the -0.5 asked) or 24-26 (the derivative rows above).
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'أجد النقطة التي يكون عندها ميل منحنى الاقتران الآتي 12',
          page=68, answers=102, numbers=(10,),
          params={'stem': 'f(x) = 2x^2 - 10', 'ask': 'points_with_slope', 'slope': '12',
                  'on_page': ['12 f(x) = 2x2 - 10']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية. أجد الاقتران v(t) الذي يمثل سرعة الجسم في أي لحظة',
          page=68, answers=102, numbers=(11,),
          params={'stem': 's(t) = t^3 - 6t + 3', 'ask': 'derivative_function', 'name': 'v(t)', 'on_page': ['s(t) = t3 - 6t + 3']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية. أجد الزمن t عندما تكون السرعة 6 m/s',
          page=68, answers=102, numbers=(13,),
          params={'stem': 's(t) = t^3 - 6t + 3', 'ask': 'time_for_velocity', 'velocity': '6',
                  'on_page': ['s(t) = t3 - 6t + 3', '6 m/s']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية. أجد الاقتران a(t) الذي يمثل تسارع الجسم',
          page=68, answers=102, numbers=(14,),
          params={'stem': 's(t) = t^3 - 6t + 3', 'ask': 'derivative_function', 'name': 'a(t)', 'order': 2,
                  'on_page': ['s(t) = t3 - 6t + 3']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية. أجد تسارع الجسم عند الزمن المعطى',
          page=68, answers=102, numbers=(15,),
          params={'stem': 's(t) = t^3 - 6t + 3\nt = 5', 'ask': 'acceleration_at', 'at': '5',
                  'on_page': ['s(t) = t3 - 6t + 3', 't = 5']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', DERIVATIVE_AR, page=69, answers=103, numbers=(16,),
          params={'stem': 'f(x) = 0.5x^3 - 3x^2 + 4x', 'ask': 'derivative_function', 'pair': 'derivative',
                  'on_page': ['f(x) = 0.5x3 - 3x2 + 4x']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'أجد ميل منحنى الاقتران الآتي عند نقاط تقاطعه مع المحور x',
          page=69, answers=103, numbers=(17,),
          params={'stem': 'f(x) = 0.5x^3 - 3x^2 + 4x', 'ask': 'x_intercept_slopes',
                  'on_page': ['f(x) = 0.5x3 - 3x2 + 4x']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'أجد معادلة مماس منحنى الاقتران الآتي عند النقطة التي إحداثيها x يساوي 1',
          page=69, answers=103, numbers=(19,),
          params={'stem': 'f(x) = 3x^3 + 2', 'ask': 'tangent', 'at': '1', 'on_page': ['f(x)=3x3 +2']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'تقع النقطة P(-2, b) على منحنى الاقتران الآتي. أجد قيمة b',
          page=69, answers=103, numbers=(20,),
          params={'stem': 'g(x) = 3x^3 - x^2 - 7x + 4', 'ask': 'point_value', 'at': '-2', 'unknown': 'b',
                  'on_page': ['g(x) = 3x3 - x2 - 7x + 4', 'P(-2, b)']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'أجد قيم x التي يكون عندها ميل منحنى الاقتران الآتي صفرًا',
          page=69, answers=103, numbers=(21,),
          params={'stem': 'g(x) = 3x^3 - x^2 - 7x + 4', 'ask': 'zero_slope_x',
                  'on_page': ['g(x) = 3x3 - x2 - 7x + 4']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied',
          'إذا كانت قيمة ميل منحنى المعادلة الآتية عندما x = 2 هي -12، حيث a عدد ثابت، فأجد قيمة الثابت a',
          page=69, answers=103, numbers=(22,),
          params={'stem': 'y = x^3 - 2ax', 'ask': 'param_critical', 'param': 'a', 'at': '2', 'slope': '-12',
                  'on_page': ['-12', 'y = x3 - 2ax', 'x = 2']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'أجد قيمة الثابت k إذا كان ميل منحنى الاقتران الآتي عند النقطة (4, 0) هو 2',
          page=69, answers=103, numbers=(27,),
          params={'stem': 'f(x) = kx(x - 4)', 'ask': 'param_critical', 'param': 'k', 'at': '4', 'slope': '2',
                  'on_page': ['f(x) = kx (x-4)', '2 (4, 0)']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'أجد النقطتين على منحنى الاقتران الآتي اللتين تساوي عندهما مشتقة الاقتران 4',
          page=69, answers=117, numbers=(28,),
          params={'stem': 'f(x) = 1/3 x^3 - 5x + 4', 'ask': 'points_with_slope', 'slope': '4',
                  'on_page': ['4 f(x) = 1', '3 x3 - 5x + 4']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied', 'أجد قيمتي a و b إذا كان ميل منحنى الاقتران الآتي عند النقطة (2, -3) صفرًا',
          page=69, answers=117, numbers=(29,),
          params={'stem': 'y = ax^3 + bx^2 + 5', 'ask': 'fit_point_slope', 'point': ('2', '-3'),
                  'unknowns': ['a', 'b'], 'prose': True, 'on_page': ['y = ax3 + bx2 + 5', '(2, -3)']}),
    Entry(SB2, 's2', 6, 2, 1, 30, 'applied',
          'أُطلقت قذيفة من سطح الأرض رأسيًّا إلى الأعلى، ويمثل الاقتران الآتي موقعها s بالأمتار بعد t ثانية من إطلاقها. ما سرعة القذيفة عندما يكون موقعها 980 m فوق سطح الأرض؟',
          page=69, answers=117, numbers=(30,),
          params={'stem': 's(t) = -4.9t^2 + 147t', 'ask': 'velocity_at_position', 'position': '980',
                  'on_page': ['980 m', 's(t) = -4.9t2 + 147t']}),
    Entry(SB2, 's2', 6, 3, 1, 13, 'applied', 'يمثل الاقتران الآتي ارتفاع سهم عن سطح الأرض بالأمتار بعد t ثانية من إطلاقه. أجد سرعة السهم عند الزمن المعطى',
          page=74, answers=109, numbers=(11,),
          params={'stem': 'h(t) = 1.2 + 19.6t - 4.9t^2\nt = 3', 'ask': 'velocity_at', 'at': '3',
                  'on_page': ['h(t)= 1.2 + 19.6t - 4.9t2']}),
    Entry(SB2, 's2', 6, 3, 1, 13, 'applied', 'يمثل الاقتران الآتي ارتفاع سهم عن سطح الأرض بالأمتار بعد t ثانية من إطلاقه. أستعمل المشتقة لإيجاد أعلى ارتفاع يصله السهم',
          page=74, answers=109, numbers=(12,),
          params={'stem': 'h(t) = 1.2 + 19.6t - 4.9t^2', 'ask': 'max_value', 'unit': 'm',
                  'on_page': ['h(t)= 1.2 + 19.6t - 4.9t2']}),
    Entry(SB2, 's2', 6, 3, 1, 13, 'applied',
          'يمثل الاقتران الآتي مساحة مستطيل بالمتر المربع، حيث x الطول بالمتر. ما أكبر مساحة ممكنة للمستطيل؟',
          page=74, answers=109, numbers=(13,),
          params={'stem': 'A(x) = x(50 - x)', 'ask': 'max_value', 'unit': 'm^2', 'on_page': ['A(x) = x(50-x)']}),
    # Lesson 6.1 (estimating slope), p.61-62. The book asks for estimates and the guide accepts
    # any close answer (p.94, p.95, appendix p.116); the key is the exact value, which is the
    # number the guide prints where it prints one. `first`/`last` span the lesson's 27 exercises
    # (the tier). Not 1-3 (read off a drawn curve the text never gives), 4, 5, 8, 9, 17, 18, 22
    # (drawing), 6-7 (a function known only from a table), 19, 20, 23 (a curve known only from a
    # table; the guide's 10.5 for 23 is an estimate, the fitted curve gives 10), 27 (open).
    *[Entry(SB2, 's2', 6, 1, 1, 27, 'applied', 'أقدّر ميل منحنى الاقتران الآتي عند النقطة المعطاة',
            page=61, answers=94, numbers=(n,),
            params={'stem': f'{curve}\n{point}', 'ask': 'slope_at_point',
                    'on_page': [f'{point} {curve.replace("^", "")}' if n != 10 else curve.replace('^', ''), point]})
      for n, curve, point in (
          (10, 'f(x) = 0.1x^3', '(2, 0.8)'),
          (11, 'y = 4x^2 + 1', '(1, 5)'), (12, 'y = 3 + 2x^2', '(-1, 5)'), (13, 'y = 1 - x^2', '(-1, 0)'),
          (14, 'y = 5x^3 + 1', '(0, 1)'), (15, 'y = 9 - x^2', '(2, 5)'), (16, 'y = 8 - 2x', '(1, 6)'))],
    Entry(SB2, 's2', 6, 1, 1, 27, 'applied',
          'يبيّن الجدول الآتي موقع درّاجة نارية s بالأمتار بعد t ثانية من بدء حركتها. أحسب السرعة المتوسطة للدرّاجة في الفترة الزمنية المعطاة',
          page=62, answers=95, numbers=(21,),
          params={'stem': 't: 0, 1, 2, 3, 4, 5\ns(t): 0, 2, 8, 18, 32, 50\n[1, 3]', 'ask': 'average_velocity',
                  'on_page': ['5 4 3 2 1 0 t', '50 32 18 8 2 0 s(t)', '[1, 3]']}),
    Entry(SB2, 's2', 6, 1, 1, 27, 'applied',
          'يمثل الاقتران الآتي موقع سيارة تتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية، و a و b عددان ثابتان. أستعمل الجدول الآتي لإيجاد قيمة كل من a و b',
          page=62, answers=116, numbers=(24,),
          params={'stem': 's(t) = at + bt^2\nt: 0, 1, 2, 3, 4\ns(t): 0, 5, 12, 21, 32', 'ask': 'fit_table',
                  'unknowns': ['a', 'b'], 'prose': True,
                  'on_page': ['s(t) = at + bt 2', '4 3 2 1 0', '32 21 12 5 0']}),
    Entry(SB2, 's2', 6, 1, 1, 27, 'applied',
          'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم، حيث s الموقع بالأمتار بعد t ثانية. أقدّر سرعة الجسم عند الزمن المعطى',
          page=62, answers=116, numbers=(25,),
          params={'stem': 's(t) = 3t - t^2\nt = 2', 'ask': 'velocity_at', 'at': '2',
                  'on_page': ['s(t) = 3t - t2', 't = 2']}),
    Entry(SB2, 's2', 6, 1, 1, 27, 'applied',
          'أقدّر ميل منحنى الاقتران الآتي عند نقطتي تقاطعه مع المحور x، وعند نقطة تقاطعه مع المحور y',
          page=62, answers=116, numbers=(26,),
          params={'stem': 'f(x) = x^2 - 6x - 16', 'ask': 'intercept_slopes', 'on_page': ['f(x) = x2 - 6x - 16']}),
    # The unit-6 test's multiple choice, read from SB2_READINGS. The guide circles its key, which
    # the text layer does not carry, so these are `computed`. `choices` is the page's whole run.
    Entry(SB2, 's2', 6, 1, 1, 1, 'reading', 'ما ميل منحنى الاقتران الآتي عند قيمة x المعطاة؟', page=76,
          params={'check': 'slope_at', 'choices': (1, 2, 3, 4)}, unit_test=True),
    Entry(SB2, 's2', 6, 2, 2, 2, 'reading', 'ما مشتقة الاقتران الآتي؟', page=76,
          params={'check': 'derivative', 'choices': (1, 2, 3, 4)}, unit_test=True),
    Entry(SB2, 's2', 6, 3, 3, 3, 'reading', 'ما قيمة x التي يكون عندها للاقتران الآتي قيمة عظمى؟', page=76,
          params={'check': 'max_at', 'choices': (1, 2, 3, 4)}, unit_test=True),
    Entry(SB2, 's2', 6, 2, 4, 4, 'reading',
          'يمثل الاقتران الآتي موقع جسم يتحرك في مسار مستقيم (s بالأمتار، t بالثواني). ما سرعة الجسم بوحدة m/s عند الزمن المعطى؟',
          page=76, params={'check': 'velocity_at', 'choices': (1, 2, 3, 4)}, unit_test=True),
    Entry(SB2, 's2', 6, 3, 30, 30, 'reading', 'ما جميع قيم x التي يكون عندها للاقتران الآتي قيم عظمى أو صغرى محلية؟',
          page=77, params={'check': 'extrema_at', 'choices': (30, 31)}, unit_test=True),
    Entry(SB2, 's2', 6, 3, 31, 31, 'reading', 'ما عدد النقاط الحرجة للاقتران الآتي؟', page=77,
          params={'check': 'critical_count', 'choices': (30, 31)}, unit_test=True),
]
MAX_EXP = {'system': 12, 'derivative': 9, 'derivative_at': 9, 'extrema': 9, 'mcq_pair': 9, 'unit_open': 9, 'reading': 0}


# ── text access ──────────────────────────────────────────────────────────────
def page_text(source_id: str, page: int) -> str:
    pages = json.loads((EXTRACTED / f'{source_id}.json').read_text(encoding='utf-8'))['text']
    x = pages[page - 1]
    return x.get('text', '') if isinstance(x, dict) else x


def exercise_page(source_id: str, unit: int, lesson: int) -> int:
    index = json.loads((EXERCISES / source_id / 'index.json').read_text(encoding='utf-8'))
    return next(l['page'] for l in index['lessons'] if l['unit'] == unit and l['lesson'] == lesson)


def curriculum_lesson_id(semester: str, unit: int, lesson: int) -> str | None:
    """Mirror of `curriculumLessonId` in artifacts/mobile/services/bookExercises.ts."""
    if unit == 1:
        return None if lesson == 1 else f'kbl-math-{semester}-nccd-u1_l{lesson - 1}'
    return f'kbl-math-{semester}-nccd-u{unit}_l{lesson}'


# ── segmentation ─────────────────────────────────────────────────────────────
# A marker is a number then a tab, after line start, a tab or a space ("-6x 4 ⇥"
# is the marker 4, not an exponent). Numbering is sequential from `start`, which
# is what stops a stray figure label from splitting an item.
MARK = re.compile(r'(?:^|(?<=[\t ]))(\d{1,2})[ ]*\t', re.M)


def split_items(text: str, start: int = 1) -> dict[int, str]:
    marks, want = [], start
    for m in MARK.finditer(text):
        if int(m.group(1)) == want:
            marks.append((want, m.start(), m.end()))
            want += 1
    out: dict[int, str] = {}
    for i, (n, _s, e) in enumerate(marks):
        stop = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        out[n] = text[e:stop].strip()
    return out


# A unit-test question is headed by an Arabic line ending in its number.
QHEAD = re.compile(r'^(?=.*[؀-ۿﭐ-﷿ﹰ-﻿]).*[\t ](\d{1,2})$', re.M)


def split_questions(text: str) -> dict[int, str]:
    heads, want = [], 1
    for m in QHEAD.finditer(text):
        if int(m.group(1)) == want:
            heads.append(m)
            want += 1
    out: dict[int, str] = {}
    for i, m in enumerate(heads):
        stop = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out[i + 1] = text[m.end():stop].strip()
    return out


def lead_math(body: str) -> str:
    """The body up to its first Arabic character: what follows is the next section's prose."""
    m = ARABIC.search(body)
    return (body[:m.start()] if m else body).strip()


# ── guide p.47: the open questions of the unit test ─────────────────────────
# This page is segmented by anchors written for THIS page only: its items are
# not tab-marked like the exercise pages, and 10 and 11 share one system that
# sits in the middle of their Arabic prose. Anything not found exactly once is
# left out of the result (build() quarantines it as `item_not_found`); nothing is
# guessed, and Arabic never reaches SymPy.
def nfkc(s: str) -> str:
    """The text layer gives Arabic in presentation forms; NFKC restores the letters."""
    return unicodedata.normalize('NFKC', s)


C_TOKEN = re.compile(r'(?<![A-Za-z])c(?![A-Za-z])')
# The `c` that item 10 replaces by its value: touching a digit (`2c`) or a letter it would be
# a product or a name, and `2c` with c = 8 is 16, not 28.
C_ISOLATED = re.compile(r'(?<![A-Za-z0-9])c(?![A-Za-z0-9])')
ITEM_END = re.compile(r'[\t ]\s*(\d{1,2})\s*$')   # an Arabic instruction line ends with its number


def item_ends(lines: list[str]) -> dict[int, list[int]]:
    out: dict[int, list[int]] = {}
    for i, l in enumerate(lines):
        if ARABIC.search(l) and (m := ITEM_END.search(l)):
            out.setdefault(int(m.group(1)), []).append(i)
    return out


def split_unit_open(text: str) -> dict[int, str]:
    """Raw Latin stems, by item number, for the items of this page that can be read."""
    lines = text.split('\n')
    out: dict[int, str] = {}
    last_plain = -1
    # Items 6-9: one line `N <first equation>` (a space, not a tab) and the equation under it.
    for n in (6, 7, 8, 9):
        heads = [i for i, l in enumerate(lines) if re.match(rf'{n} \S', l)]
        if len(heads) != 1:
            continue
        i = heads[0]
        second = lines[i + 1] if i + 1 < len(lines) else ''
        first = lines[i][len(str(n)) + 1:]
        if ARABIC.search(first) or ARABIC.search(second) or '=' not in first or '=' not in second \
                or re.match(r'\d{1,2} ', second):
            continue
        out[n] = f'{first}\n{second}'
        last_plain = max(last_plain, i + 1)
    # Items 10 and 11: the system is the two Latin lines under the one Arabic header line that
    # names the parameter `c`; its value is on the line `c = <v> …` that ends with the number 10,
    # and item 11's own line ends with 11.
    ends = {n: ix[0] for n, ix in item_ends(lines).items() if len(ix) == 1}
    headers = [
        i for i in range(max(last_plain, 0), len(lines) - 2)
        if ARABIC.search(lines[i]) and C_TOKEN.search(lines[i])
        and not ARABIC.search(lines[i + 1]) and '=' in lines[i + 1]
        and not ARABIC.search(lines[i + 2]) and '=' in lines[i + 2]
    ]
    value = [(i, m) for i, l in enumerate(lines) if (m := re.match(r'c = (\d+)\b', l))]
    if len(headers) == 1 and len(value) == 1 and ends.get(10) == value[0][0] and 11 in ends \
            and ends[11] > value[0][0] and C_TOKEN.search(lines[ends[11]]):
        h = headers[0]
        system = f'{lines[h + 1]}\n{lines[h + 2]}'
        if len(C_TOKEN.findall(system)) == 1 and len(C_ISOLATED.findall(system)) == 1:
            out[11] = system
            out[10] = C_TOKEN.sub(value[0][1].group(1), system)
    return dict(sorted(out.items()))


def printed_entries(text: str) -> tuple[list[str], int]:
    """(the printed answers on guide p.47 as printed, whitespace normalised; how many ignored).

    The block follows item 12's system and ends at the banner line `الوحدة`. Its order is
    NOT the item order, and a fraction arrives split over lines, so an entry starts at a
    line beginning `(` or `c ` or at one of the two Arabic phrases, and every other line
    continues the entry before it. The appendix reference is recognised and ignored.
    """
    lines = [nfkc(l).strip() for l in text.split('\n')]
    heads = item_ends(text.split('\n')).get(12, [])
    stops = [i for i, l in enumerate(lines) if l == 'الوحدة']
    if len(heads) != 1 or len(stops) != 1 or stops[0] <= heads[0]:
        raise Reject('answer_block_not_found')
    entries: list[list[str]] = []
    ignored = 0
    for l in lines[heads[0] + 1:stops[0]]:
        if not l:
            continue
        phrase = l.rstrip('. ')
        if phrase == APPENDIX_AR:
            entries.append([])      # a marker that swallows nothing: it is dropped below
            ignored += 1
        elif l.startswith('(') or l.startswith('c ') or phrase == NO_SOLUTION_AR:
            entries.append([l])
        elif entries:
            entries[-1].append(l)   # a continuation (a split fraction); stem lines before the first entry are not
    out = [re.sub(r'\s+', ' ', ' '.join(e)).strip() for e in entries if e]
    if not out:
        raise Reject('answer_block_not_found')
    return out, ignored


# Matching a printed answer to an item is by VALUE. The text layer splits `-11/3` into
# «- 11» over «3», so the printed form reads `- 11 3`. `flat` therefore turns the fraction
# bar into a gap and drops every gap EXCEPT one between two digits: both spellings meet at
# `-11 3`, while `12`, `1 2` and `1/2` stay three different things. (Deleting the bar made
# `(12, 3)` equal `(1/2, 3)` and `c < -13` equal `c < -1/3`: a printed answer could verify
# an item it contradicted.) Solution points may come in any order (the book prints them in
# its own), so a list of `(a,b)` points is compared as a sorted list of points - a
# duplicate counts, so `(1, 4), (1, 4)` is not `(1, 4)`; coordinates keep their order, and
# `(2. 1)` is the decimal 2.1, never the point (2, 1).
def flat(s: str) -> str:
    s = re.sub(r'\s+', ' ', s.replace('/', ' '))
    return re.sub(r'(?<![0-9])\s+|\s+(?![0-9])', '', s)


def _points(s: str) -> list[str] | None:
    f = flat(s)
    pts = re.findall(r'\([^()]*\)', f)
    return sorted(pts) if pts and ','.join(pts) == f else None


def same_answer(printed: str, computed: str) -> bool:
    if flat(printed) == flat(computed):
        return True
    a, b = _points(printed), _points(computed)
    return a is not None and a == b


def pair_printed(records: list[dict], entries: list[str]) -> list[str]:
    """Attach each record's printed answer by value, in item order, each entry once.

    Mutates the records (printedAnswer, status, verificationSource) and returns the
    entries nobody took, as printed. A record that finds none stays `computed`.
    """
    free = list(entries)
    for r in sorted(records, key=lambda r: r['source']['number']):
        hit = next((e for e in free if same_answer(e, r['computedAnswer'])), None)
        if hit is not None:
            free.remove(hit)
        # agreement was just established by value, so the printed side of the truth table is
        # the computed answer; the record keeps the book's own text.
        r['status'], r['verificationSource'] = assign_state(
            r['computedAnswer'], r['computedAnswer'] if hit is not None else None, False)
        r['printedAnswer'] = None if hit is None else re.sub(r'\s+', ' ', hit).strip()
    return free


# ── guide p.47 items 3-5: a written reading, accepted only if it can be checked ─────────────────
# These three are multiple choice and their maths is exactly what the text layer destroys: which
# digits are exponents (`9y` is 9^y, `42-x` is 4^(2-x), `x4y` is x^4 y) and where the fraction bar
# was cannot be derived by any rule, so `normalise_stem` rightly rejects all three. A READING is a
# person's statement of that structure. It is not trusted; it must pass two gates, and failing
# either stops the item (quarantined, with the reason) - nothing falls back to a looser reading:
#   1. SAME CHARACTERS. Strip whitespace and the structure characters `^ ( ) /` from the
#      reading and from the page's own Latin text, and the two must be identical. A reading can
#      therefore add exponents, brackets and bars, and nothing else: no digit, letter or
#      operator (`×` included) can be added, dropped, changed or moved. The page's OWN brackets
#      are structure too, but they are evidence, so each PAIR must stay as the page has it: the
#      same two places, and matched to each other. `(2y/x)^2` follows the page's `(2y` `x )2`,
#      while `(2y/x^2)` and `(2y/(x)^2)` have the same characters and one unique, different key
#      (option b) - only this rule stops them.
#   2. ONE KEY. Exactly one option must be correct under the reading (SymPy). Moving an exponent
#      or a bar almost always leaves none or several, which is what `test_extract_book_items.py`
#      shows for rival readings of each item.
# Passing is evidence, not proof - no page image has been compared - so the item is `computed`,
# never `verified`, and is on the list a person compares with the printed book.
STRUCTURE = re.compile(r'[\s^()/]')
# Also after a digit and a space: a split fraction leaves its denominator on the next option's
# line (student p.76 item 3: «3 b) - 5»). Not after any space, which `f(2, a)` could have.
LABEL = re.compile(r'(?m)(^|\t|(?<=\d) )[ ]*[a-d]\)')
DASHES = str.maketrans({'−': '-', '–': '-', '‒': '-', '—': '-'})


@dataclass(frozen=True)
class Reading:
    stem: tuple[str, ...]       # the stem lines, with structure added
    options: tuple[str, ...]    # a) to d), without the labels


READINGS: dict[int, Reading] = {
    3: Reading(('3^(5x) × 9^y = 27', '5^(3x) × 5^y = 25'), ('(-1, -1)', '(1, 1)', '(-1, 1)', '(1, -1)')),
    4: Reading(('x = -1',), ('5^(2x+1) = 25', '3^(1+x) = 81', '7^(3-2x) = 49', '4^(2-x) = 64')),
    5: Reading(('8x^2y^3 / □ = (2y/x)^2',), ('2x^4y', '4x^4y^2', '2xy', 'x^2y^2')),
}
LABELS = ('a)', 'b)', 'c)', 'd)')


def core(s: str) -> str:
    """The characters that carry meaning: no whitespace, no structure characters.

    Dashes are unified and nothing else is: `×` and `÷` are meaning, so a reading cannot
    swap the page's `×` for a `/` (3^(5x) / 9^y has a different key).
    """
    return STRUCTURE.sub('', s.translate(DASHES))


def bracket_pairs(s: str) -> Counter:
    """Each matched bracket pair as (meaning characters before the opener, before the closer).

    Pairs, not single brackets: `(2y/(x)^2)` has a `(` and a `)` where the page's `(2y` `x )2`
    has them, but they close different brackets. Unbalanced text raises.
    """
    pairs: Counter = Counter()
    stack: list[int] = []
    seen = 0
    # an option label `a)` is a closing bracket with no opener: it is a label, not structure
    for ch in LABEL.sub(r'\1', s.translate(DASHES)):
        if ch == '(':
            stack.append(seen)
        elif ch == ')':
            if not stack:
                raise Reject('unbalanced_brackets')
            pairs[(stack.pop(), seen)] += 1
        elif not STRUCTURE.match(ch):
            seen += 1
    if stack:
        raise Reject('unbalanced_brackets')
    return pairs


def page_latin(text: str, n: int) -> str:
    """The Latin text of item `n` on the page, Arabic removed, from its heading line to option d).

    The heading is the Arabic line ending in the item's number, and its own Latin residue counts
    (item 4's `x = -1` is printed in it). Anything not found exactly once raises.
    """
    lines = text.split('\n')
    heads = item_ends(lines).get(n, [])
    if len(heads) != 1:
        raise Reject('item_not_found')
    out = []
    for i in range(heads[0], len(lines)):
        l = lines[i]
        if i == heads[0]:
            l = ITEM_END.sub('', l)
        out.append(ARABIC.sub('', l).replace(':', ''))
        if re.search(r'\bd\)', l):
            return '\n'.join(out)
    raise Reject('options_not_found')


def split_readings(text: str, numbers: tuple[int, ...]) -> dict[int, str | Reject]:
    """The page's Latin text by item number; an item that cannot be cut out maps to its Reject."""
    out: dict[int, str | Reject] = {}
    for n in numbers:
        try:
            out[n] = page_latin(text, n)
        except Reject as r:
            out[n] = r
    return out


RESIDUE = re.compile(r'«[^«»]*»')


def served_stem(lines: tuple[str, ...]) -> tuple[str, ...]:
    """A reading's stem as served: its «residue» removed, blank lines dropped.

    Residue is page text that belongs to the Arabic sentence (`t`, `s` and `m/s` in «s موقع
    الجسم ... بوحدة m/s»). It is written in the reading, in its place, so the character gate
    still checks it against the page - it is just not part of the maths. The served stem is
    derived from the reading by this one rule, never written separately, so a stem cannot
    quietly drop the end of an expression."""
    out = (re.sub(r'\s+', ' ', RESIDUE.sub('', l)).strip() for l in lines)
    return tuple(l for l in out if l)


# ── the student book's multiple choice ───────────────────────────────────────
# Its test pages cannot be cut by heading lines, as guide p.47 is: on p.76 item 2's number
# also ends another line, item 4's is followed by a diacritic, and p.77 prints item 31's
# function on the line ABOVE its heading. So the block after the «أضع دائرة حول رمز الإجابة»
# instruction is cut into consecutive chunks, each ending at its `d)` line plus any bare-number
# lines that follow it (option d)'s split denominator, p.76 item 3). A chunk must hold exactly
# one Arabic heading line ending in its own number, or that item is not cut.
CHOICE_INSTRUCTION = 'دائرة حول رمز'
DIACRITICS = re.compile(r'[ً-ْٰـ]')   # harakat, superscript alef, tatweel


def split_choices(text: str, numbers: tuple[int, ...]) -> dict[int, str | Reject]:
    """The Latin text of each multiple-choice item in `numbers` (the page's whole run, in order)."""
    plain = [DIACRITICS.sub('', nfkc(l)) for l in text.split('\n')]
    starts = [i for i, l in enumerate(plain) if CHOICE_INSTRUCTION in l]
    if len(starts) != 1:
        return {n: Reject('choice_block_not_found') for n in numbers}
    out: dict[int, str | Reject] = {}
    i = starts[0] + 1
    for n in numbers:
        chunk: list[int] = []
        while i < len(plain) and not re.search(r'\bd\)', plain[i]):
            chunk.append(i)
            i += 1
        if i == len(plain):
            out[n] = Reject('options_not_found')
            continue
        chunk.append(i)
        i += 1
        while i < len(plain) and re.fullmatch(r'\s*\d+\s*', plain[i]):
            chunk.append(i)
            i += 1
        heads = [j for j in chunk if ARABIC.search(plain[j]) and (m := ITEM_END.search(plain[j])) and int(m.group(1)) == n]
        if len(heads) != 1:
            out[n] = Reject('item_not_found')
            continue
        out[n] = '\n'.join(
            ARABIC.sub('', ITEM_END.sub('', plain[j]) if j == heads[0] else plain[j]).replace(':', '')
            for j in chunk)
    return out


# Student book p.76 items 1-4 and p.77 items 30-31 (the newer printing's numbers; the 2021
# printing numbers p.77's 31-32 and writes item 4 with d(t)). Compared by eye with the printed
# page: 1-3 on p.76, 30-31 on p.77 of the 2021 printing, whose layout of these is the same.
SB2_READINGS: dict[tuple[int, int], Reading] = {
    (76, 1): Reading(('x = 5', 'f(x) = 3x - 1'), ('3', '1/3', '-1', '0')),
    (76, 2): Reading(("«f '(x)»", 'f(x) = x(2x + 1)'), ('x', '2x + 1', '2x^2 + x', '4x + 1')),
    (76, 3): Reading(('«x»', 'f(x) = (x-2)(x-3)^2'), ('-7/3', '-5/2', '7/3', '5/2')),
    (76, 4): Reading(('s(t) = t^2', '«t s»', 't = 1 «m/s»'), ('0', '1', '2', '4')),
    (77, 30): Reading(('«x»', 'f(x) = 3x^5 - 5x^3 + 15'), ('-1, 0, 1', '-1, 0', '0, 1', '-1, 1')),
    (77, 31): Reading(('f(x) = (x-3)^2',), ('0', '1', '2', '3')),
}


def solve_reading(n: int, page: str, check: str, reading: 'Reading | None' = None) -> tuple[str, list[str], int]:
    """(stem, options, index of the single correct option) for item `n` read as `reading`
    (default READINGS[n], guide p.47)."""
    r = reading if reading is not None else READINGS.get(n)
    if r is None:
        raise Reject('no_reading')
    written = '\n'.join([*(l.replace('«', '').replace('»', '') for l in r.stem),
                         *(f'{l} {o}' for l, o in zip(LABELS, r.options))])
    if core(written) != core(page):
        raise Reject('reading_changes_characters')
    if bracket_pairs(page) - bracket_pairs(written):
        raise Reject('reading_moves_brackets')
    stem = '\n'.join(l.translate(DASHES) for l in served_stem(r.stem))
    hits = [i for i, o in enumerate(r.options) if option_holds(check, stem, o)]
    if len(hits) != 1:
        raise Reject('key_not_unique')
    options = [re.sub(r'\s+', ' ', o.translate(DASHES)) for o in r.options]
    return stem, options, hits[0]


def option_holds(check: str, stem: str, option: str) -> bool:
    """Does `option` answer `stem` correctly? Exact (SymPy); an unparsable option is an error, not a no.

    Principal roots only: a reading with fractional exponents of negative numbers would be judged
    by SymPy's principal value, so none is accepted without a test of its own.
    """
    lines = [l.translate(MINUS) for l in stem.split('\n')]    # `×` to `*` for SymPy only
    if check == 'points':       # options are points; each stem line is an equation in x and y
        sides = [eq_sides(l) for l in lines]
        a, b = (parse(p) for p in option.translate(MINUS).strip('()').split(','))
        return all(simplify((l - r).subs({X: a, Y: b})) == 0 for l, r in sides)
    if check == 'root':         # the stem is `x = <value>`; options are equations in x
        (left, right), = [eq_sides(l) for l in lines]
        if left != X:
            raise Reject('not_a_root_stem')
        l, r = eq_sides(option.translate(MINUS))
        return simplify((l - r).subs(X, right)) == 0
    if check == 'box':          # the stem has one `□`; options are expressions for it
        (text,) = lines
        if text.count('□') != 1:
            raise Reject('not_one_box')
        box = Symbol('B')
        left, right = eq_sides(text.replace('□', 'B'))
        found = solve(Eq(left, right), box)
        if len(found) != 1:
            raise Reject('box_not_determined')
        return simplify(parse(option) - found[0]) == 0
    if check in CURVE_CHECKS:
        return curve_option_holds(check, lines, option.translate(MINUS))
    raise Reject('unknown_check')


# ── the s2 unit-6 test: questions about a curve ──────────────────────────────
# The stem is the curve's definition, `f(x) = …` or `s(t) = …`, plus, for the two "at a
# point" checks, the point line `x = 5` / `t = 1`. Anything the rule cannot decide is an
# error, never a "no": a second derivative of 0 at a stationary point, a curve that is not
# a polynomial (its critical points would also need where f′ is undefined), f′ ≡ 0.
CURVE_CHECKS = ('slope_at', 'velocity_at', 'derivative', 'max_at', 'extrema_at', 'critical_count')
CURVE = re.compile(r'([A-Za-z])\s*\(\s*([a-z])\s*\)\s*=(.*)')   # V(x) = … names a volume
POINT = re.compile(r'([a-z])\s*=\s*(\S.*)')


def curve_option_holds(check: str, lines: list[str], option: str) -> bool:
    from sympy import Poly, real_roots
    curves = [m for l in lines if (m := CURVE.fullmatch(l.strip()))]
    points = [m for l in lines if not CURVE.fullmatch(l.strip()) and (m := POINT.fullmatch(l.strip()))]
    at_point = check in ('slope_at', 'velocity_at')
    if len(curves) != 1 or len(points) != (1 if at_point else 0) or len(lines) != len(curves) + len(points):
        raise Reject('unexpected_stem_line')
    _name, var, right = curves[0].groups()
    f = parse(right)
    v = next((s for s in f.free_symbols if s.name == var), Symbol(var))
    if f.free_symbols - {v}:
        raise Reject('more_than_one_variable')
    d1 = diff(f, v)
    if at_point:
        if points[0].group(1) != var:
            raise Reject('point_on_another_variable')
        return simplify(d1.subs(v, parse(points[0].group(2))) - parse(option)) == 0
    if check == 'derivative':
        return simplify(parse(option) - d1) == 0
    if check == 'max_at':
        a = parse(option)
        if simplify(d1.subs(v, a)) != 0:
            return False
        d2 = simplify(diff(d1, v).subs(v, a))
        if d2 == 0:
            raise Reject('second_derivative_zero')
        return bool(d2 < 0)
    if not d1.is_polynomial(v):
        raise Reject('not_a_polynomial')
    if simplify(d1) == 0:
        raise Reject('derivative_is_zero')
    roots = Counter(real_roots(Poly(d1, v)))
    if check == 'critical_count':
        return parse(option) == len(roots)
    # extrema_at: a real root of f′ is a local extremum iff f′ changes sign there, i.e. its
    # multiplicity is odd. The option is the whole set, so a missing or extra point is a no.
    extrema = {r for r, k in roots.items() if k % 2 == 1}
    picked = [parse(p) for p in option.split(',')]
    return len(picked) == len(set(picked)) and set(picked) == extrema


# ── normalisation ────────────────────────────────────────────────────────────
class Reject(Exception):
    """The item is quarantined; the message is the reason in the report."""


def normalise_stem(raw: str, max_exp: int) -> str:
    t = raw.replace('\t', ' ').translate(MINUS)
    if ARABIC.search(t):
        raise Reject('arabic_residue')
    lines = [l.strip() for l in t.split('\n') if l.strip()]
    if not lines:
        raise Reject('no_math')
    if any(re.fullmatch(r'\d+', l) for l in lines):
        raise Reject('broken_fraction_or_exponent')
    t = '\n'.join(lines)

    def exponent(m: re.Match) -> str:
        if int(m.group(2)) > max_exp:
            raise Reject('exponent_out_of_range')
        return f'{m.group(1)}^{m.group(2)}'

    t = re.sub(r'([A-Za-z])[ ]*(\d+)(?![\w.(])', exponent, t)
    if re.search(r'\)\s*\d', t):
        raise Reject('ambiguous_paren_exponent')
    if re.search(r'[A-Za-z][ ]+\d|\d[ ]+\d', t):
        raise Reject('ambiguous_spacing')
    return t


# ── parsing and solving (exact: decimals become rationals) ───────────────────
def rationalise(text: str) -> str:
    def frac(m: re.Match) -> str:
        f = Fraction(m.group(0))
        return f'({f.numerator}/{f.denominator})'
    return re.sub(r'\d+\.\d+', frac, text)


def parse(text: str):
    return safe_parse_expr(rationalise(text.replace(' ', '')))


def eq_sides(line: str):
    if line.count('=') != 1:
        raise Reject('not_one_equation')
    left, right = line.split('=')
    return parse(left), parse(right)


def is_clean(v) -> bool:
    return v.is_real is True and not v.has(CRootOf) and len(str(v)) <= 24


def fmt(v, decimal: bool = False) -> str:
    if decimal and v.is_Rational and not v.is_Integer and set(_prime_factors(v.q)) <= {2, 5}:
        return format(float(v), 'g')
    s = str(v).replace('**', '^')
    s = re.sub(r'sqrt\(([^()]+)\)', r'√\1', s)
    return s.replace('*', '')


def _prime_factors(n: int) -> list[int]:
    out, d = [], 2
    while n > 1:
        while n % d == 0:
            out.append(d)
            n //= d
        d += 1
    return out


def solve_system(stem: str, allow_none: bool = False) -> str:
    """`allow_none`: a system SymPy proves has no real solution is answered «لا يوجد حل».

    Only a row that opts in gets that - for an exercise it stays quarantined, because there the
    book printed nothing to check it against. An undecidable system is never an answer.
    """
    lines = stem.split('\n')
    if len(lines) != 2:
        raise Reject('not_two_equations')
    decimal = '.' in stem
    sols = solve([Eq(*eq_sides(l)) for l in lines], [X, Y], dict=True)
    real = [s for s in sols if len(s) == 2 and all(v.is_real is True for v in s.values())]
    if not real:
        if not sols:
            # SymPy returned nothing: it could not solve, which is not a proof of none
            # (`y = x^5 - x + 1 ; y = 0` has a real root and comes back empty).
            raise Reject('not_solved')
        if allow_none and all(len(s) == 2 and any(v.is_real is False for v in s.values()) for s in sols):
            return NO_SOLUTION_AR
        raise Reject('no_real_solution')
    if not all(is_clean(v) for s in real for v in s.values()):
        raise Reject('not_closed_form')
    real.sort(key=lambda s: (float(s[X]), float(s[Y])))
    return ', '.join(f'({fmt(s[X], decimal)}, {fmt(s[Y], decimal)})' for s in real)


def solve_param_no_solution(stem: str, param: str) -> str:
    """The values of `param` for which the system has no real solution, as `c < a`.

    One equation is linear in x, y and free of the parameter: solve it for a variable, put
    that into the other, and the system is a quadratic in the remaining one. It has no real
    root exactly when the discriminant is negative.
    """
    from sympy import Poly, S, solve_univariate_inequality  # noqa: PLC0415
    c = Symbol(param, real=True)
    lines = stem.split('\n')
    if len(lines) != 2:
        raise Reject('not_two_equations')
    sides = [eq_sides(l) for l in lines]
    exprs = [(l - r).subs(Symbol(param), c) for l, r in sides]
    linear = [e for e in exprs if not e.has(c) and Poly(e, X, Y).total_degree() == 1]
    other = [e for e in exprs if e not in linear]
    if len(linear) != 1 or len(other) != 1:
        raise Reject('no_linear_equation')
    var = X if linear[0].coeff(X) != 0 else Y
    rest = Y if var == X else X
    quadratic = Poly(other[0].subs(var, solve(linear[0], var)[0]), rest)
    if quadratic.degree() != 2:
        raise Reject('not_a_quadratic')
    a, b, k = quadratic.all_coeffs()
    if a.has(c):
        # the leading coefficient can vanish for some c (`c*x^2 - y^2 = 1` with `x - y = 0`
        # is not a quadratic at c = 1), and then the discriminant says nothing about it
        raise Reject('parameter_in_leading_coefficient')
    allowed = solve_univariate_inequality(b**2 - 4 * a * k < 0, c, relational=False)
    return f'{param} < {fmt(strict_upper_bound(allowed))}'


def strict_upper_bound(allowed):
    """`end` of an open half-line `(-oo, end)` with a rational end; anything else is rejected.

    Open matters: at the boundary the discriminant is 0, a double root, so the system HAS a
    solution there and `c <= end` would be a wrong answer.
    """
    from sympy import S  # noqa: PLC0415
    if not (getattr(allowed, 'is_Interval', False) and allowed.start == S.NegativeInfinity
            and allowed.right_open and allowed.end.is_Rational):
        raise Reject('not_a_half_line')
    return allowed.end


FUNCTION = re.compile(r'([a-z])\(x\)')


def parse_f(stem: str):
    """(the function's one-letter name, its right-hand side). The student book names
    its functions g, r, i, v, t as well as f; the answer keeps the book's name."""
    if '\n' in stem or stem.count('=') != 1:
        raise Reject('not_a_function_definition')
    left, right = stem.split('=')
    m = FUNCTION.fullmatch(left.replace(' ', ''))
    if not m:
        raise Reject('not_a_function_definition')
    return m.group(1), parse(right)


def solve_derivative(stem: str) -> str:
    name, f = parse_f(stem)
    return f"{name}'(x) = {fmt(diff(f, X), '.' in stem)}"


def solve_derivative_at(stem: str, point: str) -> str:
    return fmt(diff(parse_f(stem)[1], X).subs(X, Rational(point)), '.' in stem)


# ── local maxima and minima (student p.74, lesson 6.3) ──────────────────────
# The key is words as well as maths, so it is fixed Arabic labels, each on its own line,
# and Latin maths on its own lines: a line mixing the two scrambles under the bidi algorithm
# on web. These five phrases are the only Arabic a key of this family may hold
# (bookItems.test.ts checks the same set).
EXTREMA_MAX_AR = 'قيمة عظمى محلية:'
EXTREMA_MIN_AR = 'قيمة صغرى محلية:'
EXTREMA_NO_MAX_AR = 'لا توجد قيمة عظمى محلية'
EXTREMA_NO_MIN_AR = 'لا توجد قيمة صغرى محلية'
EXTREMA_NONE_AR = 'لا توجد قيم عظمى أو صغرى محلية'


def solve_extrema(stem: str) -> str:
    """Every local maximum and minimum of a polynomial, exact.

    A real root r of f′ is an extremum iff f′ changes sign there, i.e. its multiplicity k is
    odd; then the k-th derivative of f′ at r is non-zero and its sign says which (positive:
    f′ rises through 0, a minimum). So `2x^3 + 7` has none, and `x^4` has a minimum at 0. A
    root SymPy can only give as a CRootOf, or a sign it cannot decide, is refused."""
    name, f = parse_f(stem)
    decimal = '.' in stem
    found = extrema_points(f)
    line = lambda p: f'{name}({fmt(p[0], decimal)}) = {fmt(p[1], decimal)}'
    maxima, minima = [line(p) for p in found['max']], [line(p) for p in found['min']]
    if not maxima and not minima:
        return EXTREMA_NONE_AR
    out = [EXTREMA_MAX_AR, *maxima] if maxima else [EXTREMA_NO_MAX_AR]
    out += [EXTREMA_MIN_AR, *minima] if minima else [EXTREMA_NO_MIN_AR]
    return '\n'.join(out)


def extrema_points(f) -> dict[str, list[tuple]]:
    """{'max': [(x, y)…], 'min': […]}, exact and sorted by x (see `solve_extrema`)."""
    from sympy import Poly, real_roots
    d1 = diff(f, X)
    if not d1.is_polynomial(X):
        raise Reject('not_a_polynomial')
    out: dict[str, list[tuple]] = {'max': [], 'min': []}
    if simplify(d1) == 0:
        # A constant: every point is a non-strict extremum, but the guide answers p.77 item 20
        # (f(x) = 17) «لا توجد قيم عظمى وقيم صغرى» - the school counts strict extrema only.
        return out
    roots = Counter(real_roots(Poly(d1, X)))
    if any(r.has(CRootOf) for r in roots):
        raise Reject('not_clean')
    for r in sorted(roots, key=lambda r: float(r)):
        k = roots[r]
        if k % 2 == 0:
            continue
        s = simplify(diff(d1, X, k).subs(X, r))
        if s.is_positive is None or s == 0:
            raise Reject('extremum_not_decided')
        out['min' if s.is_positive else 'max'].append((simplify(r), simplify(f.subs(X, r))))
    return out


# ── graph questions whose curve the question defines (student p.77) ─────────
# The book's picture cannot be cropped into a paper here, but where the question itself
# fixes the curve - a line through two stated points, a stated polynomial - the figure
# package can draw it exactly (`function-graph`; `lib/figure`'s gate checks it again in the
# API). Such a drawing is trusted for nothing either: its curve must BE the stated one, each
# stated point must lie on it, the stated data must be on the page, and every label the
# answer names must sit where the answer is. A graph whose curve the book never states
# (p.77 items 26-28) is not drawn at all: a curve of ours would be a different picture.
def require_on_page(text: str, fragments: list[str]) -> None:
    """Each fragment's meaning characters appear, in order, in the page's Latin text."""
    page = core(ARABIC.sub('', nfkc(text)).translate(MINUS))
    for frag in fragments:
        if core(frag.translate(MINUS)) not in page:
            raise Reject('not_on_page')


def check_figure(curve: str, visual: dict, params: dict) -> None:
    _name, f = parse_f(curve)
    for fn in visual.get('functions', []):
        if simplify(parse(fn['expr']) - f) != 0:
            raise Reject('drawing_is_another_curve')
    for px, py in params.get('through', []):
        if simplify(f.subs(X, px) - py) != 0:
            raise Reject('curve_misses_a_stated_point')


def solve_figure(curve: str, visual: dict, params: dict) -> str:
    check_figure(curve, visual, params)
    _name, f = parse_f(curve)
    at = {p['label']: p['at'] for p in visual.get('points', [])}
    ask = params['ask']
    if ask == 'derivative':
        return solve_derivative(curve)
    if ask == 'slope_at':
        label = params['label']
        if label not in at or at[label] != params.get('expect_at', at.get(label)):
            raise Reject('drawing_labels_disagree')
        return fmt(simplify(diff(f, X).subs(X, at[label])))
    if ask == 'extrema_points':
        found = extrema_points(f)
        if len(found['max']) != 1 or len(found['min']) != 1:
            raise Reject('not_one_max_and_one_min')
        (mx, my), (nx, ny) = found['max'][0], found['min'][0]
        hi, lo = params.get('max', 'A'), params.get('min', 'C')
        if at.get(hi) != mx or at.get(lo) != nx:
            raise Reject('drawing_labels_disagree')
        return f'{hi}({fmt(mx)}, {fmt(my)}), {lo}({fmt(nx)}, {fmt(ny)})'
    raise Reject('unknown_ask')


# ── the unit-6 test's word problems (student p.76-77) ───────────────────────
# Each is restated in our own Arabic (the row's instruction) with its maths in the stem,
# and every number the restatement carries is checked on the page (`require_on_page`).
# One small solver per question shape; each refuses what it cannot decide.
Y_CURVE = re.compile(r'y\s*=(.*)')   # lesson 6.1 names its curves `y = …`, in x


def _curve(stem: str):
    """(name, variable symbol, expression) of a stem `f(x) = …` / `s(t) = …` / `V(x) = …` / `y = …`.

    Only the stem's first line is the curve; later lines carry the point or the table."""
    first = stem.strip().split('\n')[0].strip()
    m, y = CURVE.fullmatch(first), Y_CURVE.fullmatch(first)
    if not m and not y:
        raise Reject('not_a_function_definition')
    name, var, right = m.groups() if m else ('y', 'x', y.group(1))
    expr = parse(right)
    v = next((s for s in expr.free_symbols if s.name == var), Symbol(var))
    return name, v, expr


def fmt_poly(expr, v, decimal: bool) -> str:
    """A polynomial highest power first; with `decimal`, coefficients as the book writes them
    (`1.5x^2 - 6x + 4`, never `3x^2/2`). Anything else, or no decimals, is `fmt`'s."""
    from sympy import Poly
    if not decimal or not expr.is_polynomial(v):
        return fmt(expr, decimal)
    out = ''
    for (p,), c in Poly(expr, v).terms():
        mag = fmt(abs(c), True)
        body = (mag if p == 0 else ('' if mag == '1' else mag) + (str(v) if p == 1 else f'{v}^{p}'))
        out += (('-' if c < 0 else '') + body) if not out else ((' - ' if c < 0 else ' + ') + body)
    return out or '0'


def _one(values: list, reason: str):
    if len(values) != 1:
        raise Reject(reason)
    return values[0]


TABLE_ROW = re.compile(r'([a-z](?:\([a-z]\))?):\s*(.+)')


def _table(stem: str) -> dict[str, list]:
    """The stem's value table, one `t: 0, 1, 2` line per variable, as exact numbers."""
    rows = {}
    for line in stem.strip().split('\n'):
        m = TABLE_ROW.fullmatch(line.strip())
        if m:
            rows[m.group(1)] = [Rational(c.strip()) for c in m.group(2).split(',')]
    if len(rows) != 2 or len({len(r) for r in rows.values()}) != 1:
        raise Reject('not_a_value_table')
    return rows


def _point(stem: str) -> tuple:
    """The stem's last line, `(a, b)`, as exact numbers."""
    m = re.fullmatch(r'\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)', stem.strip().split('\n')[-1].strip())
    if not m:
        raise Reject('no_point')
    return Rational(m.group(1)), Rational(m.group(2))


def solve_applied(stem: str, params: dict) -> str:
    from sympy import real_roots, Poly
    ask = params['ask']
    if ask == 'average_velocity':           # (s(b) - s(a)) / (b - a), read from the stem's table
        (_tn, ts), (_sn, ss) = _table(stem).items()
        m = re.fullmatch(r'\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]', stem.strip().split('\n')[-1].strip())
        if not m:
            raise Reject('no_interval')
        a, b = Rational(m.group(1)), Rational(m.group(2))
        if a not in ts or b not in ts or a == b:
            raise Reject('interval_not_in_table')
        return f'{fmt((ss[ts.index(b)] - ss[ts.index(a)]) / (b - a), True)} m/s'
    name, v, f = _curve(stem)
    d1 = diff(f, v)
    at = Rational(params['at']) if 'at' in params else None
    if ask == 'slope_at_point':             # the point is on the curve, or the question is not
        px, py = _point(stem)
        if simplify(f.subs(v, px) - py) != 0:
            raise Reject('point_not_on_curve')
        return fmt(simplify(d1.subs(v, px)), '.' in stem)
    if ask == 'fit_table':                  # the constants that make the curve pass every table row
        (_tn, ts), (_sn, ss) = _table(stem).items()
        unknowns = [s for s in f.free_symbols if s.name in params['unknowns']]
        if len(unknowns) != len(params['unknowns']):
            raise Reject('unknowns_not_in_curve')
        found = solve([Eq(f.subs(v, t), s) for t, s in zip(ts, ss)], unknowns, dict=True)
        sol = _one(found, 'table_not_fitted_once')
        if set(sol) != set(unknowns):
            raise Reject('table_not_fitted_once')
        return ', '.join(f'{u} = {fmt(sol[next(s for s in unknowns if s.name == u)])}' for u in params['unknowns'])
    if ask in ('intercept_slopes', 'x_intercept_slopes'):   # where the curve meets the x axis (then the y axis)
        roots = sorted({r for r in real_roots(Poly(f, v))}, key=float)
        y_axis = ask == 'intercept_slopes'
        if not roots or any(not r.is_Rational for r in roots) or (y_axis and 0 in roots):
            raise Reject('x_intercepts_not_rational')
        dec = '.' in stem
        return ', '.join(f"{name}'({fmt(x)}) = {fmt(simplify(d1.subs(v, x)), dec)}"
                         for x in [*roots, *([Integer(0)] if y_axis else [])])
    if ask == 'derivative_identity':        # find h'(x), then show the stated identity holds
        left, right = params['identity'].split('=')
        # placeholders the safe parser accepts (one letter), filled with f′ and f after parsing
        sub = lambda side: parse(side.replace(f"{name}'({v})", '(u)').replace(f'{name}({v})', '(w)'))
        expr = sub(left) - sub(right)
        holes = {s.name: s for s in expr.free_symbols}
        if simplify(expr.subs({holes.get('u', Symbol('u')): d1, holes.get('w', Symbol('w')): f})) != 0:
            raise Reject('identity_fails')
        return f"{name}'({v}) = {fmt(expand(d1))}"
    if ask == 'point_slope_sign':           # the point (at, c) lies on the curve; sign of the slope there
        c, slope = simplify(f.subs(v, at)), simplify(d1.subs(v, at))
        if slope == 0:
            raise Reject('slope_is_zero')
        return f"{params['unknown']} = {fmt(c)}, {name}'({fmt(at)}) = {fmt(slope)} {'<' if slope < 0 else '>'} 0"
    if ask == 'tangent':
        return f'y = {fmt(expand(d1.subs(v, at) * (v - at) + f.subs(v, at)))}'
    dec = '.' in stem                       # decimals in, decimals out (`-9.8`, not `-49/5`)
    if ask in ('argmax', 'max_value'):      # the one positive x where f has a local maximum
        roots = [r for r in real_roots(Poly(d1, v)) if r > 0 and diff(d1, v).subs(v, r) < 0]
        r = _one(sorted(set(roots), key=float), 'maximum_not_unique')
        if ask == 'argmax':
            return f'{v} = {fmt(simplify(r))}'
        return f"{name} = {fmt(simplify(f.subs(v, r)), dec)} {params['unit']}"
    if ask in ('velocity_at', 'velocity_and_time', 'time_for_velocity'):
        parts = []
        if ask != 'time_for_velocity':
            parts.append(f'v({fmt(at)}) = {fmt(simplify(d1.subs(v, at)), dec)} m/s')
        if ask != 'velocity_at':
            target = parse(params['velocity'])
            times = [t for t in solve(Eq(d1, target), v) if t.is_real and t >= 0]
            parts.append(f'{v} = {fmt(_one(times, "time_not_unique"), dec)} s')
        return ', '.join(parts)
    if ask == 'param_critical':             # the parameter that makes f'(at) = slope (0: a critical point)
        k = next((s for s in f.free_symbols if s.name == params['param']), None)
        if k is None:
            raise Reject('parameter_not_in_curve')
        slope = Rational(params.get('slope', '0'))
        found = solve(Eq(d1.subs(v, at), slope), k)
        value = _one(found, 'parameter_not_unique')
        if 'then_slope_at' not in params:
            return f"{params['param']} = {fmt(value, dec)}"
        return fmt(simplify(d1.subs(k, value).subs(v, Rational(params['then_slope_at']))), dec)
    if ask == 'derivative_function':        # f'(x), or v(t) = s'(t) and a(t) = s''(t) under their own names
        order, label = params.get('order', 1), params.get('name', f"{name}'({v})")
        return f'{label} = {fmt_poly(expand(diff(f, v, order)), v, dec)}'
    if ask == 'acceleration_at':
        return f'a({fmt(at)}) = {fmt(simplify(diff(f, v, 2).subs(v, at)), dec)} m/s^2'
    if ask == 'point_value':                # the point (at, unknown) lies on the curve
        return f"{params['unknown']} = {fmt(simplify(f.subs(v, at)), dec)}"
    if ask in ('points_with_slope', 'zero_slope_x'):
        slope = Rational(params.get('slope', '0'))
        xs = sorted({r for r in solve(Eq(d1, slope), v) if r.is_real}, key=float)
        if not xs or any(not r.is_Rational for r in xs):
            raise Reject('roots_not_rational')
        if ask == 'zero_slope_x':
            return ', '.join(f'{v} = {fmt(r, dec)}' for r in xs)
        return ', '.join(f'({fmt(r, dec)}, {fmt(simplify(f.subs(v, r)), dec)})' for r in xs)
    if ask == 'fit_point_slope':            # constants that put the stated point on the curve with the stated slope
        px, py = (Rational(c) for c in params['point'])
        unknowns = [s for s in f.free_symbols if s.name in params['unknowns']]
        if len(unknowns) != len(params['unknowns']):
            raise Reject('unknowns_not_in_curve')
        found = solve([Eq(f.subs(v, px), py), Eq(d1.subs(v, px), Rational(params.get('slope', '0')))],
                      unknowns, dict=True)
        sol = _one(found, 'not_fitted_once')
        if set(sol) != set(unknowns):
            raise Reject('not_fitted_once')
        return ', '.join(f'{u} = {fmt(sol[next(s for s in unknowns if s.name == u)], dec)}' for u in params['unknowns'])
    if ask == 'velocity_at_position':       # every non-negative time the position is reached, and the velocity then
        times = sorted({t for t in solve(Eq(f, parse(params['position'])), v) if t.is_real and t >= 0}, key=float)
        if not times or any(not t.is_Rational for t in times):
            raise Reject('times_not_rational')
        return ', '.join(f'v({fmt(t, dec)}) = {fmt(simplify(d1.subs(v, t)), dec)} m/s' for t in times)
    raise Reject('unknown_ask')


# A printed answer on the guide's copy of the page is matched part by part. A part is
# `name = value unit`, `value unit` or `name = value`; a bare number is never one (the pages
# carry axis labels). Two parts match only with the same exact value (no rounding), the same
# unit, and the same name where the printed part has one.
# A unit's flattened exponent is read as one (`m/s 2` is m/s², `m 2` is m²), at the end of
# the part only. Spaces and `^` are dropped before the lookup.
UNITS = {'m/s': 'm/s', 'm/s2': 'm/s^2', 's': 's', 'cm3': 'cm^3', 'm2': 'm^2', 'm': 'm'}
ANSWER_PART = re.compile(r"(?:(?P<name>[A-Za-z]'?(?:\([^()=]*\))?)\s*=\s*)?(?P<val>-?[\d√.]+(?:/\d+)?)"
                         r"\s*(?P<unit>m/s ?\^?2|m/s|cm ?\^?3|m ?\^?2|m|s)?")
LINE_CHARS = re.compile(r'[\dxy+\-*/(). ]+')


def line_part(text: str) -> tuple | None:
    """A straight line written in x and y, any arrangement (`y - 5 = 9(x-1)`), as ('y', its y in x).

    Linear only, and never with a space between x and a digit (a flattened exponent)."""
    sides = text.split('=')
    if len(sides) != 2 or not all(LINE_CHARS.fullmatch(t.strip()) for t in sides) \
            or 'y' not in text or 'x' not in text or re.search(r'x\s+\d', text):
        return None
    try:
        sols = solve(Eq(parse(sides[0]), parse(sides[1])), Y)
    except Exception:  # noqa: BLE001 - an unreadable equation matches nothing
        return None
    if len(sols) != 1 or sols[0].has(Y) or sols[0].free_symbols - {X} or diff(sols[0], X, 2) != 0:
        return None
    return ('y', expand(sols[0]), None)


def answer_part(text: str) -> tuple | None:
    text = text.strip().translate(MINUS)
    m = ANSWER_PART.fullmatch(text)
    if not m:
        return line_part(text)
    val = re.sub(r'(\d)?√(\d+)', lambda g: f"{g.group(1) + '*' if g.group(1) else ''}sqrt({g.group(2)})", m.group('val'))
    try:
        value = simplify(parse(val))
    except Exception:  # noqa: BLE001 - an unreadable part matches nothing
        return None
    unit = m.group('unit')
    return (m.group('name'), value, UNITS[re.sub(r'[\s^]', '', unit)] if unit else None)


def part_matches(key: tuple | None, printed: tuple | None) -> bool:
    """Same exact value, and the same name where the printed part has one. The same unit too,
    except that a printed part which names the answer may leave its unit out (`t = 2` for
    `t = 2 s`): the name already says what it is. One with neither name nor unit is bare."""
    if key is None or printed is None:
        return False
    (kn, kv, ku), (pn, pv, pu) = key, printed
    same_unit = ku == pu or (pu is None and pn is not None and pn == kn)
    return simplify(kv - pv) == 0 and same_unit and (pn is None or pn == kn)


def chained_part(text: str) -> tuple | None:
    """A worked line `v(10) = -98 + 147 = 49 m/s`: its name and last value, if every step between
    them is arithmetic that equals that value (`s(t) = -4.9t2 + 147t = 980` is not one)."""
    steps = [t.strip() for t in text.split('=')]
    if len(steps) < 3:
        return None
    p = answer_part(f'{steps[0]} = {steps[-1]}')
    if p is None or p[0] is None:
        return None
    for mid in steps[1:-1]:
        try:
            if not re.fullmatch(r'[\d+\-*/(). ]+', mid) or simplify(parse(mid) - p[1]) != 0:
                return None
        except Exception:  # noqa: BLE001
            return None
    return p


def clean_entry(raw: str) -> str:
    """An entry without its item label or trailing comma (`17) f '(0) = 4,` -> `f'(0) = 4`)."""
    raw = re.sub(r'\s+', ' ', raw).strip()
    raw = re.sub(r'^\d{1,2}\)\s*', '', raw)
    raw = re.sub(r'\s*[,،]$', '', raw)
    return re.sub(r"([a-z]) '\s*\(", r"\1'(", raw)


# Lesson 6.1's answers are estimates, printed with the guide's own words around one number:
# «8 أي إجابة قريبة من» (any answer close to 8) or «تقريبًا. 1.2» (1.2, roughly). The number
# with those words is an entry; the same number alone on a line is still an axis label.
ESTIMATE_ENTRY = (re.compile(r'(?P<ans>-?[\d.]+(?: m/s)?) أي إجابة قريبة من'),
                  re.compile(r'تقريب ?ا\. (?P<ans>-?[\d.]+(?: m/s)?)'))
# A `name = value` the guide's working states as a result, inside a prose line: `.a = 4`, `( b = 1`.
# Not one that is the right-hand end of an equation (`a + b = 5`, `2a + 4b = 12`).
PROSE_RESULT = re.compile(r'(?:^|(?<![-+*/=⟹] )(?<=[\s.(]))([a-z]) = (-?\d+(?:\.\d+)?)(?![\d.]*[A-Za-z(])')


def applied_entries(lines: list[str], prose: bool = False) -> list[tuple[str, tuple]]:
    """The answer entries a guide page prints: (the printed text, its parsed part)."""
    chunks = []
    for line in lines:
        text = re.sub(r'\s+', ' ', DIACRITICS.sub('', nfkc(line))).strip()
        for pattern in ESTIMATE_ENTRY:
            if (m := pattern.fullmatch(text)) and (p := answer_part(m.group('ans'))):
                chunks.append((m.group('ans'), p))
        for raw in nfkc(line).split('\t'):
            raw = clean_entry(raw.translate(MINUS))
            p = answer_part(raw) or chained_part(raw)
            if p and (p[0] or p[2]):              # a bare number is an axis label, not an answer
                chunks.append((raw, p))
        if prose:
            latin = re.sub(r'\s+', ' ', ARABIC.sub(' ', DIACRITICS.sub('', nfkc(line))))
            chunks += [(f'{n} = {val}', (n, Rational(val), None)) for n, val in PROSE_RESULT.findall(latin)]
    return chunks


def pair_applied(records: list[dict], lines: list[str], prose: bool = False) -> None:
    """Verify each record whose every key part equals its own printed entry on the page.

    Nothing is paired by position. An entry that several records' parts could match is used
    only where the page prints that answer at least as often as those records need it (the
    guide prints «-4» twice for lesson 6.1's two items whose slope is -4); otherwise it
    verifies none of them."""
    chunks = applied_entries(lines, prose)
    keys = {id(r): [answer_part(s) for s in r['computedAnswer'].split(', ')] for r in records}
    taken: set[int] = set()
    for r in records:
        parts, used = keys[id(r)], []
        for part in parts:
            fits = [i for i, (_raw, p) in enumerate(chunks) if part_matches(part, p)]
            rivals = [o for o in records if o is not r
                      and any(part_matches(q, chunks[i][1]) for q in keys[id(o)] for i in fits)]
            free = [i for i in fits if i not in taken and i not in used]
            if len(fits) < 1 + len(rivals) or not free:
                break
            used.append(free[0])
        if parts and len(used) == len(parts):
            taken.update(used)
            r['status'], r['verificationSource'] = assign_state(r['computedAnswer'], r['computedAnswer'], False)
            r['printedAnswer'] = ' | '.join(chunks[i][0] for i in used)


def join_continued(text: str) -> str:
    """Join a line that starts with + or − onto the line before it: an expression the text
    layer broke (student p.77 item 23, `2x3 -4x2` over `+2x+1`). Only for the rows that ask
    (`params['join']`): a line starting with a digit, like a split fraction's `5 x3`, stays."""
    return re.sub(r'\n[ \t]*(?=[+\-−–])', ' ', text)


EXTREMA_POINT = re.compile(r'([a-z])\((.+)\) = (.+)')


def extrema_set(key: str) -> set | None:
    """A max/min key as {(kind, x, value)}, exact; None if it is not a key of this family."""
    if key == EXTREMA_NONE_AR:
        return set()
    out, kind = set(), None
    for line in key.split('\n'):
        if line in (EXTREMA_MAX_AR, EXTREMA_MIN_AR):
            kind = 'max' if line == EXTREMA_MAX_AR else 'min'
        elif line in (EXTREMA_NO_MAX_AR, EXTREMA_NO_MIN_AR):
            kind = None
        elif kind and (m := EXTREMA_POINT.fullmatch(line)):
            out.add((kind, simplify(parse(m.group(2).replace('√', 'sqrt'))),
                     simplify(parse(m.group(3).replace('√', 'sqrt')))))
        else:
            return None
    return out


# The s2 guide prints a unit-test max/min answer on a line ending in its item number:
# «لا توجد قيم عظمى وقيم صغرى. ⇥)20», «: صغرى.(2.5, -0.25) ⇥)22». Only that line is read. A line
# whose points cannot all be read (p.112's `3 , 1.296) )23`, a fragment of a split fraction)
# reads as None and verifies nothing; a line that holds part of an answer verifies nothing either,
# because the item is verified only when the line's set EQUALS the computed one.
PRINTED_NONE_AR = 'لا توجد قيم عظمى وقيم صغرى'
PRINTED_POINT = re.compile(r'(عظمى|صغرى)\s*\.?\s*\(([^()]*)\)')


def printed_extrema(text: str) -> dict[int, tuple[str, set | None]]:
    out: dict[int, tuple[str, set | None]] = {}
    for line in (nfkc(l) for l in text.split('\n')):
        label = PRINTED_LABEL.search(line)
        if not label:
            continue
        raw = re.sub(r'\s+', ' ', line).strip()
        body = line[:label.start()]
        if body.strip().strip('.: ').strip() == PRINTED_NONE_AR:
            out[int(label.group(1))] = (raw, set())
            continue
        found, rest = set(), PRINTED_POINT.sub('', body)
        try:
            for kind, pair in PRINTED_POINT.findall(body):
                a, b = pair.translate(MINUS).split(',')
                found.add(('max' if kind == 'عظمى' else 'min', simplify(parse(a)), simplify(parse(b))))
        except Exception:  # noqa: BLE001 - an unreadable printed point verifies nothing
            found = set()
        # anything left beyond punctuation means the line holds more than whole points
        out[int(label.group(1))] = (raw, found if found and not re.search(r'[^\s.:،]', rest) else None)
    return out


def pair_extrema(records: list[dict], printed: dict[int, tuple[str, set | None]]) -> None:
    """Verify a record when its own labelled line holds exactly its computed answer."""
    for r in records:
        raw, found = printed.get(r['source']['number'], ('', None))
        if found is not None and found == extrema_set(r['computedAnswer']):
            r['status'], r['verificationSource'] = assign_state(r['computedAnswer'], r['computedAnswer'], False)
            r['printedAnswer'] = raw


# ── the s2 guide's printed derivatives ───────────────────────────────────────
# The guide reproduces a student page and prints the answers on it, in its own order
# and sometimes with the item number after them («f '(x) = 8x 7 )15»). An entry is
# `name '(x) = value`; several can share a line. The value is read with the stem's own
# exponent rule, and an entry whose value cannot be read cleanly, or that ends a line
# whose next line is a bare number (a fraction split over lines), is skipped - it can
# then verify nothing. A printed answer verifies an item only when the name, the value
# (by SymPy) and any printed number all agree; nothing is paired by position.
PRINTED_DERIVATIVE = re.compile(r"(?<![A-Za-z])([a-z])\s*'\s*\(x\)\s*=\s*")
PRINTED_LABEL = re.compile(r'\s*\)\s*(\d{1,2})\s*$')


# A line shaped like this continues the entry on the line before, which is then cut off and
# not read: a bare number (a fraction's denominator), an operator then a space (`3x 2` over
# `- 12`), or a number then a space and a term (`1` over `3 x2`). Narrower than "starts with a
# sign or digit" on purpose: guide p.102 prints the NEXT answer on the next line (`-26.8`,
# a signed number with no space; `4⇥التدريب`, a section number), and those are not continuations.
CONTINUES = re.compile(r'\s*(?:\d+\s*$|[-+*/^]\s|\d+ +[A-Za-z(√])')


def printed_derivatives(text: str) -> list[tuple[str, str, int | None, str]]:
    """[(name, value as the stem rule reads it, printed item number or None, the entry as printed)].

    Fails closed on three layouts: an entry that ends a line the next line continues; a tab
    inside a value (the text layer separates columns with tabs, so `2x ⇥3` is two columns,
    never 2x³ - the exponent gaps it flattens are spaces); and, on a page where some entry is
    labelled with its item number, every unlabelled entry (it answers some other question).
    """
    lines = [nfkc(l).translate(MINUS) for l in text.split('\n')]
    out = []
    for i, line in enumerate(lines):
        heads = list(PRINTED_DERIVATIVE.finditer(line))
        for k, h in enumerate(heads):
            end = heads[k + 1].start() if k + 1 < len(heads) else len(line)
            raw = re.sub(r'\s+', ' ', line[h.start():end]).strip()
            value = line[h.end():end]
            label = PRINTED_LABEL.search(value)
            if label:
                value = value[:label.start()]
            value = value.strip()
            last = k + 1 == len(heads)
            if not value or '\t' in value or (last and i + 1 < len(lines) and CONTINUES.match(lines[i + 1])):
                continue
            try:
                value = value if re.fullmatch(r'-?\d+', value) else normalise_stem(value, MAX_EXP['derivative'])
                parse(value)
            except Exception:  # noqa: BLE001 - an unreadable printed entry verifies nothing
                continue
            out.append((h.group(1), value, int(label.group(1)) if label else None, raw))
    if any(e[2] is not None for e in out):
        out = [e for e in out if e[2] is not None]
    return out


def derivative_matches(entry: tuple, record: dict) -> bool:
    name, value, label = entry[:3]
    if label is not None and label != record['source']['number']:
        return False
    computed_name, computed_value = record['computedAnswer'].split("'(x) = ")
    return name == computed_name and simplify(parse(value) - parse(computed_value)) == 0


def pair_derivatives(records: list[dict], entries: list[tuple]) -> None:
    """Verify each record against one printed entry, in item order, each entry once.

    Labelled entries are tried first, so an unlabelled one is never spent on an item whose
    own labelled entry is on the page."""
    free = sorted(entries, key=lambda e: e[2] is None)
    for r in sorted(records, key=lambda r: r['source']['number']):
        hit = next((e for e in free if derivative_matches(e, r)), None)
        if hit is None:
            continue
        free.remove(hit)
        r['status'], r['verificationSource'] = assign_state(r['computedAnswer'], r['computedAnswer'], False)
        r['printedAnswer'] = hit[3]


OPT = re.compile(r'([a-d])\)\s*(\([^()]*\))')


def solve_mcq_pair(body: str) -> tuple[str, list[str], int]:
    """(stem, options, index of the single option satisfying both equations)."""
    cut = re.search(r'^a\)', body, re.M)
    if not cut:
        raise Reject('no_options')
    stem = normalise_stem(body[:cut.start()], MAX_EXP['mcq_pair'])
    found = OPT.findall(body[cut.start():])
    if [k for k, _ in found] != ['a', 'b', 'c', 'd']:
        raise Reject('options_not_a_to_d')
    options = [re.sub(r'\s+', ' ', v.translate(MINUS)) for _, v in found]
    lines = stem.split('\n')
    if len(lines) != 2:
        raise Reject('not_two_equations')
    sides = [eq_sides(l) for l in lines]
    hits = []
    for i, option in enumerate(options):
        a, b = (parse(p) for p in option.strip('()').split(','))
        if all(simplify((l - r).subs({X: a, Y: b})) == 0 for l, r in sides):
            hits.append(i)
    if len(hits) != 1:
        raise Reject('key_not_unique')
    return stem, options, hits[0]


# ── states ───────────────────────────────────────────────────────────────────
def assign_state(computed: str | None, printed: str | None, judged: bool) -> tuple[str, str]:
    """(status, verificationSource). `judged`: the verifier has a topic for this item.

    `verified` needs the book's printed answer AND agreement; SymPy alone is
    `computed`. No family in the table has a printed answer today, so this is
    pinned by test rather than exercised by data.
    """
    if computed is None:
        return 'quarantined', 'none'
    if printed is None:
        return 'computed', 'sympy'
    if printed == computed:
        return 'verified', 'sympy+book'
    return ('quarantined', 'none') if judged else ('book-key', 'book')


def tier_for(number: int, first: int, last: int) -> str:
    third = (last - first + 1) / 3
    pos = number - first
    return 'easy' if pos < third else 'medium' if pos < 2 * third else 'hard'


# ── build ────────────────────────────────────────────────────────────────────
def build_all() -> tuple[dict[str, list[dict]], list[dict], dict]:
    """(items by source, quarantined, the pairing facts `report.json` also carries)."""
    by_source: dict[str, list[dict]] = {}
    rejects: list[dict] = []
    open_items: dict[tuple[str, int], list[dict]] = {}     # unit_open records waiting for their printed answers
    derivative_items: dict[int, list[dict]] = {}           # s2 guide page -> derivative records it answers
    extrema_items: dict[int, list[dict]] = {}              # s2 guide page -> max/min records it answers
    # (s2 guide page, read its prose) -> word-problem records it answers
    applied_items: dict[tuple[int, bool], list[dict]] = {}
    for e in TABLE:
        lesson_id = curriculum_lesson_id(e.semester, e.unit, e.lesson)
        if lesson_id is None:
            raise SystemExit(f'table row {e.source} u{e.unit} l{e.lesson} has no curriculum lesson')
        if e.family in ('mcq_pair', 'unit_open', 'reading'):
            text = page_text(e.source, e.page)
            if e.family == 'reading' and 'choices' in e.params:
                blocks = split_choices(text, e.params['choices'])
            elif e.family == 'reading':
                blocks = split_readings(text, e.items)
            else:
                blocks = (split_questions if e.family == 'mcq_pair' else split_unit_open)(text)
            page, book_page = e.page, int(text.split('\n', 1)[0].strip())
        else:
            page = e.page or exercise_page(e.source, e.unit, e.lesson)
            blocks, book_page = split_items(page_text(e.source, page), e.first), page
        for n in e.items:
            base = {
                # A unit-test row of a book whose lessons are numbered in the same book (the
                # student book) takes a `t`: its item 15 is not the lesson's practice item 15.
                'id': f'bi-{e.source}-u{e.unit}l{e.lesson}-{"t" if e.unit_test else ""}{n}',
                'lessonId': lesson_id,
                'source': {'sourceId': e.source, 'page': page, 'bookPage': book_page, 'unit': e.unit, 'number': n},
            }
            try:
                # A figure row's question is a picture, not a text block: its data is checked
                # on the page by `require_on_page` instead (item 29's number has no marker).
                if e.family not in ('figure', 'applied') and n not in blocks:
                    raise Reject('item_not_found')
                if e.family not in ('figure', 'applied') and isinstance(blocks[n], Reject):
                    raise blocks[n]
                if e.family == 'mcq_pair':
                    stem, options, key = solve_mcq_pair(blocks[n])
                    computed, kind, tier, tier_source = options[key], 'unit-test-mcq', 'medium', 'default'
                    extra = {'options': options}
                elif e.family == 'reading':
                    reading = None
                    if e.source == SB2:   # never fall back to guide p.47's READINGS for another page
                        reading = SB2_READINGS.get((e.page, n))
                        if reading is None:
                            raise Reject('no_reading')
                    stem, options, key = solve_reading(n, blocks[n], e.params['check'], reading)
                    computed, kind, tier, tier_source = options[key], 'unit-test-mcq', 'medium', 'default'
                    extra = {'options': options}
                elif e.family == 'unit_open':
                    stem = normalise_stem(blocks[n], MAX_EXP[e.family])
                    computed = (solve_param_no_solution(stem, e.params['param']) if 'param' in e.params
                                else solve_system(stem, e.allow_none))
                    kind, tier, tier_source = 'unit-test', 'medium', 'default'
                    extra = {}
                elif e.family == 'figure':
                    require_on_page(page_text(e.source, page), e.params['on_page'])
                    stem = e.params['stem']
                    computed = solve_figure(e.params['curve'], e.visual, e.params)
                    kind, tier, tier_source = 'unit-test', 'medium', 'default'
                    extra = {'visual': e.visual}
                elif e.family == 'applied':
                    require_on_page(page_text(e.source, page), e.params['on_page'])
                    stem = e.params['stem']
                    computed = solve_applied(stem, e.params)
                    kind, tier, tier_source = (('unit-test', 'medium', 'default') if e.unit_test
                                               else ('exercise', tier_for(n, e.first, e.last), 'position'))
                    extra = {}
                else:
                    lead = lead_math(blocks[n])
                    stem = normalise_stem(join_continued(lead) if e.params.get('join') else lead, MAX_EXP[e.family])
                    computed = {
                        'system': lambda: solve_system(stem),
                        'derivative': lambda: solve_derivative(stem),
                        'derivative_at': lambda: solve_derivative_at(stem, e.params['point']),
                        'extrema': lambda: solve_extrema(stem),
                    }[e.family]()
                    kind, tier, tier_source = (('unit-test', 'medium', 'default') if e.unit_test
                                               else ('exercise', tier_for(n, e.first, e.last), 'position'))
                    extra = {}
                status, how = assign_state(computed, None, False)
                record = {
                    **base, 'kind': kind, 'instruction': e.instruction_ar, 'stem': stem, **extra,
                    'printedAnswer': None, 'computedAnswer': computed, 'check': None,
                    'tier': tier, 'tierSource': tier_source, 'status': status, 'verificationSource': how,
                }
                by_source.setdefault(e.source, []).append(record)
                if e.family == 'unit_open':
                    open_items.setdefault((e.source, e.page), []).append(record)
                if e.answers is not None and e.family == 'applied' and e.params.get('pair') == 'derivative':
                    derivative_items.setdefault(e.answers, []).append(record)   # an f'(x) key: the derivative reader
                elif e.answers is not None and e.family == 'applied':
                    applied_items.setdefault((e.answers, bool(e.params.get('prose'))), []).append(record)
                elif e.answers is not None:
                    {'derivative': derivative_items}.get(
                        e.family, extrema_items).setdefault(e.answers, []).append(record)
            except Reject as r:
                rejects.append({**base, 'family': e.family, 'reason': str(r)})
            except Exception as ex:  # noqa: BLE001 - any parse/solve failure quarantines; nothing is guessed
                rejects.append({**base, 'family': e.family, 'reason': f'{type(ex).__name__}: {ex}'[:120]})
    unmatched: list[str] = []
    notes: dict[str, str] = {}
    for (page, prose), records in applied_items.items():
        pair_applied(records, page_text(G2, page).split('\n'), prose)
        for rec in records:
            if rec['status'] == 'computed':
                notes[rec['id']] = f'no printed entries on guide p.{page} hold every part of the computed answer'
    for page, records in extrema_items.items():
        pair_extrema(records, printed_extrema(page_text(G2, page)))
        for rec in records:
            if rec['status'] == 'computed':
                notes[rec['id']] = f'its line on guide p.{page} does not hold exactly the computed answer'
    for page, records in derivative_items.items():
        pair_derivatives(records, printed_derivatives(page_text(G2, page)))
        for rec in records:
            if rec['status'] == 'computed':
                notes[rec['id']] = f'no printed answer on guide p.{page} has this name and value'
    for (source, page), records in open_items.items():
        try:
            entries, _ignored = printed_entries(page_text(source, page))
        except Reject as r:
            entries = []
            for rec in records:
                notes[rec['id']] = f'{r}: no printed answer could be read from the page'
        left = pair_printed(records, entries)
        unmatched += left
        for rec in records:
            if rec['status'] == 'computed' and rec['id'] not in notes:
                notes[rec['id']] = ('the guide prints answers on this page and none equals the computed '
                                    'answer; see unmatchedPrinted' if entries else 'no printed answer found')
    return by_source, rejects, {'unmatchedPrinted': unmatched, 'notes': dict(sorted(notes.items()))}


def build() -> tuple[dict[str, list[dict]], list[dict]]:
    by_source, rejects, _extras = build_all()
    return by_source, rejects


def _order(rec: dict) -> tuple:
    s = rec['source']
    return (s['sourceId'], s['unit'], rec['lessonId'], s['number'])


def main() -> int:
    by_source, rejects, extras = build_all()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for source, items in by_source.items():
        items.sort(key=_order)
        (OUT_DIR / f'{source}.json').write_text(
            json.dumps({'sourceId': source, 'items': items}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        for r in items:
            counts[r['status']] = counts.get(r['status'], 0) + 1
    counts['quarantined'] = counts.get('quarantined', 0) + len(rejects)
    rejects.sort(key=_order)
    (OUT_DIR / 'report.json').write_text(
        json.dumps({'counts': counts, **extras, 'quarantined': rejects}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(counts))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
