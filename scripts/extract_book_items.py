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
    page: int | None = None                      # mcq_pair only: the guide page holding the test
    params: dict = field(default_factory=dict)


EX1, EX2, G1 = 'math-s1-exercise-book', 'math-s2-exercise-book', 'math-s1-teacher-guide'
SYSTEM_AR = 'أحل نظام المعادلتين الآتي'
PAIR_AR = 'أي الأزواج المرتبة الآتية يمثل حلا لنظام المعادلتين الآتي؟'

TABLE: list[Entry] = [
    Entry(EX1, 's1', 1, 2, 1, 12, 'system', SYSTEM_AR),
    Entry(EX1, 's1', 1, 3, 1, 12, 'system', SYSTEM_AR),
    Entry(EX2, 's2', 6, 2, 1, 10, 'derivative', 'أجد مشتقة الاقتران الآتي'),
    Entry(EX2, 's2', 6, 2, 15, 16, 'derivative_at', 'أجد قيمة f′(-1) للاقتران الآتي', params={'point': '-1'}),
    Entry(G1, 's1', 1, 2, 1, 1, 'mcq_pair', PAIR_AR, page=47),
    Entry(G1, 's1', 1, 3, 2, 2, 'mcq_pair', PAIR_AR, page=47),
]
MAX_EXP = {'system': 12, 'derivative': 9, 'derivative_at': 9, 'mcq_pair': 9}


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


def solve_system(stem: str) -> str:
    lines = stem.split('\n')
    if len(lines) != 2:
        raise Reject('not_two_equations')
    decimal = '.' in stem
    sols = solve([Eq(*eq_sides(l)) for l in lines], [X, Y], dict=True)
    real = [s for s in sols if len(s) == 2 and all(v.is_real is True for v in s.values())]
    if not real:
        raise Reject('no_real_solution')
    if not all(is_clean(v) for s in real for v in s.values()):
        raise Reject('not_closed_form')
    real.sort(key=lambda s: (float(s[X]), float(s[Y])))
    return ', '.join(f'({fmt(s[X], decimal)}, {fmt(s[Y], decimal)})' for s in real)


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
def build() -> tuple[dict[str, list[dict]], list[dict]]:
    by_source: dict[str, list[dict]] = {}
    rejects: list[dict] = []
    for e in TABLE:
        lesson_id = curriculum_lesson_id(e.semester, e.unit, e.lesson)
        if lesson_id is None:
            raise SystemExit(f'table row {e.source} u{e.unit} l{e.lesson} has no curriculum lesson')
        if e.family == 'mcq_pair':
            text = page_text(e.source, e.page)
            blocks, page, book_page = split_questions(text), e.page, int(text.split('\n', 1)[0].strip())
        else:
            page = exercise_page(e.source, e.unit, e.lesson)
            blocks, book_page = split_items(page_text(e.source, page), e.first), page
        for n in range(e.first, e.last + 1):
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
                by_source.setdefault(e.source, []).append({
                    **base, 'kind': kind, 'instruction': e.instruction_ar, 'stem': stem, **extra,
                    'printedAnswer': None, 'computedAnswer': computed, 'check': None,
                    'tier': tier, 'tierSource': tier_source, 'status': status, 'verificationSource': how,
                })
            except Reject as r:
                rejects.append({**base, 'family': e.family, 'reason': str(r)})
            except Exception as ex:  # noqa: BLE001 - any parse/solve failure quarantines; nothing is guessed
                rejects.append({**base, 'family': e.family, 'reason': f'{type(ex).__name__}: {ex}'[:120]})
    return by_source, rejects


def _order(rec: dict) -> tuple:
    s = rec['source']
    return (s['sourceId'], s['unit'], rec['lessonId'], s['number'])


def main() -> int:
    by_source, rejects = build()
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
        json.dumps({'counts': counts, 'quarantined': rejects}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(counts))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
