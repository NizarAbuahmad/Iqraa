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
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'artifacts' / 'math-verifier'))

from sympy import CRootOf, Eq, Rational, Symbol, diff, simplify, solve  # noqa: E402
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
    family: str           # system | derivative | derivative_at | mcq_pair
    instruction_ar: str
    page: int | None = None                      # mcq_pair / unit_open: the guide page holding the test
    params: dict = field(default_factory=dict)
    numbers: tuple[int, ...] = ()                # unit_open: exactly these items (first..last is only the span)
    allow_none: bool = False                     # unit_open: «لا يوجد حل» is a servable answer for this row

    @property
    def items(self) -> tuple[int, ...]:
        return self.numbers or tuple(range(self.first, self.last + 1))


EX1, EX2, G1 = 'math-s1-exercise-book', 'math-s2-exercise-book', 'math-s1-teacher-guide'
SYSTEM_AR = 'أحل نظام المعادلتين الآتي'
PAIR_AR = 'أي الأزواج المرتبة الآتية يمثل حلا لنظام المعادلتين الآتي؟'
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
]
MAX_EXP = {'system': 12, 'derivative': 9, 'derivative_at': 9, 'mcq_pair': 9, 'unit_open': 9}


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


def parse_f(stem: str):
    if '\n' in stem or stem.count('=') != 1:
        raise Reject('not_a_function_definition')
    left, right = stem.split('=')
    if left.replace(' ', '') != 'f(x)':
        raise Reject('not_a_function_definition')
    return parse(right)


def solve_derivative(stem: str) -> str:
    return f"f'(x) = {fmt(diff(parse_f(stem), X), '.' in stem)}"


def solve_derivative_at(stem: str, point: str) -> str:
    return fmt(diff(parse_f(stem), X).subs(X, Rational(point)), '.' in stem)


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
    for e in TABLE:
        lesson_id = curriculum_lesson_id(e.semester, e.unit, e.lesson)
        if lesson_id is None:
            raise SystemExit(f'table row {e.source} u{e.unit} l{e.lesson} has no curriculum lesson')
        if e.family in ('mcq_pair', 'unit_open'):
            text = page_text(e.source, e.page)
            split = split_questions if e.family == 'mcq_pair' else split_unit_open
            blocks, page, book_page = split(text), e.page, int(text.split('\n', 1)[0].strip())
        else:
            page = exercise_page(e.source, e.unit, e.lesson)
            blocks, book_page = split_items(page_text(e.source, page), e.first), page
        for n in e.items:
            base = {
                'id': f'bi-{e.source}-u{e.unit}l{e.lesson}-{n}',
                'lessonId': lesson_id,
                'source': {'sourceId': e.source, 'page': page, 'bookPage': book_page, 'unit': e.unit, 'number': n},
            }
            try:
                if n not in blocks:
                    raise Reject('item_not_found')
                if e.family == 'mcq_pair':
                    stem, options, key = solve_mcq_pair(blocks[n])
                    computed, kind, tier, tier_source = options[key], 'unit-test-mcq', 'medium', 'default'
                    extra = {'options': options}
                elif e.family == 'unit_open':
                    stem = normalise_stem(blocks[n], MAX_EXP[e.family])
                    computed = (solve_param_no_solution(stem, e.params['param']) if 'param' in e.params
                                else solve_system(stem, e.allow_none))
                    kind, tier, tier_source = 'unit-test', 'medium', 'default'
                    extra = {}
                else:
                    stem = normalise_stem(lead_math(blocks[n]), MAX_EXP[e.family])
                    computed = {
                        'system': lambda: solve_system(stem),
                        'derivative': lambda: solve_derivative(stem),
                        'derivative_at': lambda: solve_derivative_at(stem, e.params['point']),
                    }[e.family]()
                    kind, tier, tier_source = 'exercise', tier_for(n, e.first, e.last), 'position'
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
            except Reject as r:
                rejects.append({**base, 'family': e.family, 'reason': str(r)})
            except Exception as ex:  # noqa: BLE001 - any parse/solve failure quarantines; nothing is guessed
                rejects.append({**base, 'family': e.family, 'reason': f'{type(ex).__name__}: {ex}'[:120]})
    unmatched: list[str] = []
    notes: dict[str, str] = {}
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
