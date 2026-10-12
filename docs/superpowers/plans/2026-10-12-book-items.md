# Real Book Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grade 10 maths evaluations draw real, cited NCCD exercise and unit-test questions, whose keys SymPy computed, alongside the generated bank.

**Architecture:** A Python script reads only committed page text and writes a committed JSON item store with explicit trust states. A small reader in `lib/curriculum` serves the items by `lessonId`. The API evaluation generator takes at most half a paper from it, and the teacher's evaluation screen shows the citation and key label.

**Tech Stack:** Python 3.12 + SymPy (reusing `artifacts/math-verifier/verify_core.py`), TypeScript run by `node --experimental-strip-types --test`, Express API (`artifacts/api-server`), Expo screen (`artifacts/mobile`).

**Spec:** `docs/superpowers/specs/2026-10-12-book-items-design.md` (approved 2026-10-12). Read it first; this plan implements it with the changes listed under *Differences from the spec*.

## Expected result (so nobody is surprised)

Running the extractor on the committed text gives **24 served items, all `computed`, 0 `verified`, 14 quarantined**. No printed answer was found for the families extracted here (exercise-book systems and derivatives, unit-test choices 1-2), so nothing can be `verified` yet. Guide page 47 does print answers inline for unit-test items 6-11 (e.g. `(1, 4), (-5, -20)` for item 6, «لا يوجد حل» for item 7); those are the first candidates for `verified` and are not extracted yet. The `verified` and `book-key` paths exist and are pinned by tests, but no data exercises them. If your counts differ, stop and find out why before continuing.

## Differences from the spec

The spec was written before the text was probed in depth. These are the places this plan departs from it, and why.

| Spec said | This plan does | Why |
| --- | --- | --- |
| Mobile offline quiz/exam uses book items | **Not in this plan** | `tryMathPractice` is reached from ten question factories in `generators.ts`; book items need provenance semantics (`fromBank` means "bank-checked"), and the paper exports have no place for a citation. It needs its own spec addendum. |
| Read the printed answer from the guide appendix | **Not built**; `assign_state` implements the rule and is pinned by test | No printed answer was found for the families in the table, so a reader would be dead code. Guide page 47 does print answers inline for unit-test items 6-11 (e.g. `(1, 4), (-5, -20)` for item 6, «لا يوجد حل» for item 7); add the reader with the first of those families. |
| Polynomial-equation family (S1 unit 1 lesson 1) | **Dropped** | The book's «حل معادلات خاصة» has no curriculum lesson, so its 15 items cannot be joined. The script stops if a table row cannot join. |
| Sample of 30 items in the PR body | **List all 24** | There are only 24. |
| Teacher sees citation/label | Shown on the **evaluation screen** from `aiMetadata` | The mobile quiz path is out of scope, and the evaluation screen is where these questions are reviewed. |
| Book items reach production papers | Only when live AI is off | the only caller of generateMockEvaluation is the non-live branch; production runs AI_LIVE_MODE=true |

## Global Constraints

- Stems and answers are stored in **Latin** maths; Arabic digits appear **only at display time** (`bookCitation`). `instruction` is our own clean Arabic and never the book's scrambled line.
- `verified` means the verifier confirmed it: a printed answer **and** agreement. SymPy alone is `computed`. **A non-`verified` item must never carry a `check`**, or the existing verification pass would badge it «تم التحقق».
- Join by `lessonId` (`kbl-math-sN-nccd-uX_lY`), **never by title**.
- `SERVED_STATUSES` in `bookItems.ts` is the only place that decides what a paper may draw.
- No database schema change, no native module, no `app.json` `version` bump. The mobile change is JS only (OTA-safe).
- Tests go **inside the existing globs**: `lib/curriculum/src/**/__tests__/**`, `artifacts/api-server/src/**/__tests__/**`, `artifacts/mobile/services/__tests__/**` (mobile only runs that one folder, and nothing that imports `react-native`/`expo-*` can run there). Code loaded directly by `node --test` needs explicit `.ts` extensions in relative imports.
- The extractor reads **only committed files**. The book PDFs are not in a fresh checkout and are not required.
- Do not flip `DEMO_MODE`. The live-AI path is unchanged.
- Commit messages end with the two attribution lines from the session's system reminder.

## Environment (once, before Task 1)

```bash
pnpm install --frozen-lockfile
pip install -r artifacts/math-verifier/requirements.txt
pnpm run typecheck:libs
```

## File structure

| File | Responsibility |
| --- | --- |
| `scripts/extract_book_items.py` (new) | Segment, normalise, solve, assign state, write the JSON and `report.json`. Holds the hand-written lesson `TABLE`. |
| `scripts/test_extract_book_items.py` (new) | Normalisation rules, solvers, state truth table, real-page golden cases, determinism. |
| `lib/curriculum/src/data/book-items/*.json` (new, generated) | The item store (three source files) and `report.json`. |
| `lib/curriculum/src/bookItems.ts` (new) | Types, `SERVED_STATUSES`, `bookItemsForLesson`, `takeBookItem`, `bookCitation`, `bookStatusLabel`. |
| `lib/curriculum/src/__tests__/bookItems.test.ts` (new) | Data invariants against the real JSON, and the reader. |
| `artifacts/api-server/src/modules/assessment/mockGenerator.ts` (modify) | `bookQuestion` helper and the half-paper quota. |
| `artifacts/api-server/src/modules/assessment/__tests__/bookItems.test.ts` (new) | Generator behaviour. |
| `artifacts/mobile/services/bookItemNote.ts` (new) + test | The teacher-facing line. |
| `artifacts/mobile/app/evaluations/[id]/index.tsx`, `services/evaluations.ts` (modify) | Render it. |
| `.github/workflows/ci.yml` (modify) | Run the script's tests; fail if the committed JSON drifts from the script. |
| `STATUS.md`, `CLAUDE.md`, `docs/adding-a-book.md` (modify) | Record what is true. |

---

### Task 1: The extractor

**Files:**
- Create: `scripts/test_extract_book_items.py`
- Create: `scripts/extract_book_items.py`

**Interfaces:**
- Consumes: `artifacts/math-verifier/verify_core.py` (`safe_parse_expr`); `lib/curriculum/src/data/extracted/<sourceId>.json` (`{"text": [page, ...]}`, page *n* is `text[n-1]`); `knowledge-base/grade-10-math/exercises/<sourceId>/index.json`.
- Produces: `build() -> (dict[sourceId, list[item]], list[rejects])`, `main()`, `assign_state(computed, printed, judged) -> (status, verificationSource)`, and the item shape defined in the spec.

- [ ] **Step 1: Write the failing test**

Create `scripts/test_extract_book_items.py`:

```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/math-verifier && python -X utf8 ../../scripts/test_extract_book_items.py`
Expected: `ModuleNotFoundError: No module named 'extract_book_items'`

- [ ] **Step 3: Write the extractor**

Create `scripts/extract_book_items.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd artifacts/math-verifier && python -X utf8 ../../scripts/test_extract_book_items.py`
Expected: `Ran 23 tests` … `OK`

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_book_items.py scripts/test_extract_book_items.py
git commit -m "Extract real maths exercise and unit-test items with computed keys"
```

---

### Task 2: The data, the reader, and CI

**Files:**
- Create (generated): `lib/curriculum/src/data/book-items/math-s1-exercise-book.json`, `math-s2-exercise-book.json`, `math-s1-teacher-guide.json`, `report.json`
- Create: `lib/curriculum/src/bookItems.ts`
- Create: `lib/curriculum/src/__tests__/bookItems.test.ts`
- Modify: `lib/curriculum/package.json` (subpath export)
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 1's JSON shape.
- Produces (used by Tasks 3–4): `@workspace/curriculum/bookItems` exporting `BookItem`, `SERVED_STATUSES`, `bookItemsForLesson(lessonId)`, `takeBookItem({ lessonId, kind?, tier?, session, rng? }): BookItem | null`, `bookCitation(item, 'ar'|'en'): string`, `bookStatusLabel(item, 'ar'|'en'): string | null`.

- [ ] **Step 1: Generate the data**

Run: `python -X utf8 scripts/extract_book_items.py`
Expected output: `{"computed": 24, "quarantined": 14}`

- [ ] **Step 2: Write the failing test**

Create `lib/curriculum/src/__tests__/bookItems.test.ts`:

```ts
/**
 * Book items: the committed data's invariants, and the reader.
 *
 * These read the REAL committed JSON and the real exercise index. The data is a
 * script's output, so a fixture would agree with itself while the books did not.
 *
 * Run: node --experimental-strip-types --test src/__tests__/bookItems.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS } from '../catalog.ts';
import { G10_SOURCES } from '../sources.ts';
import { usePolicy } from '../bank.ts';
import {
  SERVED_STATUSES,
  bookCitation,
  bookItemsForLesson,
  bookStatusLabel,
  takeBookItem,
  type BookItem,
} from '../bookItems.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(join(HERE, rel), 'utf8'));
const SOURCES = ['math-s1-exercise-book', 'math-s2-exercise-book', 'math-s1-teacher-guide'];
const items: BookItem[] = SOURCES.flatMap(id => read(`../data/book-items/${id}.json`).items);
const report = read('../data/book-items/report.json') as {
  counts: Record<string, number>;
  quarantined: { id: string; reason: string }[];
};
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

describe('book items — the committed data', () => {
  it('has enough items that a run which quarantines everything fails here', () => {
    assert.ok(items.length >= 20, `only ${items.length} served items`);
  });

  it('joins every item to a real curriculum lesson', () => {
    const lessons = new Set(LESSONS.map(l => l.id));
    for (const i of items) assert.ok(lessons.has(i.lessonId), `${i.id} → ${i.lessonId}`);
  });

  it('cites the page and number the exercise index says exist', () => {
    for (const source of ['math-s1-exercise-book', 'math-s2-exercise-book']) {
      const index = read(`../../../../knowledge-base/grade-10-math/exercises/${source}/index.json`) as {
        lessons: { page: number; unit: number; lesson: number; exerciseCount: number }[];
      };
      for (const i of items.filter(x => x.source.sourceId === source)) {
        const [, unit, lesson] = /-u(\d+)l(\d+)-\d+$/.exec(i.id)!.map(Number);
        const row = index.lessons.find(l => l.unit === unit && l.lesson === lesson);
        assert.ok(row, `${i.id}: no index row`);
        assert.equal(i.source.page, row.page, i.id);
        assert.ok(i.source.number >= 1 && i.source.number <= row.exerciseCount, i.id);
      }
    }
  });

  it('keeps every stem Latin and every id unique', () => {
    assert.equal(new Set(items.map(i => i.id)).size, items.length);
    for (const i of items) {
      assert.ok(i.stem.length > 0 && !ARABIC.test(i.stem), `${i.id}: ${i.stem}`);
      assert.ok(i.computedAnswer.length > 0 && !ARABIC.test(i.computedAnswer), i.id);
    }
  });

  it('never claims verified without the book’s printed answer, and never carries a check otherwise', () => {
    for (const i of items) {
      if (i.status === 'verified') assert.ok(i.printedAnswer, `${i.id}: verified with no printed answer`);
      if (i.status !== 'verified') assert.equal(i.check, null, `${i.id}: a ${i.status} item must not reach the verification pass`);
      assert.ok(SERVED_STATUSES.includes(i.status), `${i.id}: ${i.status} is not servable`);
    }
  });

  it('gives a unit-test question four options with its key among them', () => {
    for (const i of items.filter(x => x.kind === 'unit-test-mcq')) {
      assert.equal(i.options?.length, 4, i.id);
      assert.ok(i.options!.includes(i.computedAnswer), i.id);
    }
  });

  it('comes only from sources that may be quoted', () => {
    for (const id of SOURCES) {
      const source = G10_SOURCES.find(s => s.id === id);
      assert.ok(source, id);
      assert.equal(usePolicy(source), 'quotable', id);
    }
  });

  it('agrees with its own report', () => {
    for (const status of ['computed', 'verified', 'book-key'] as const) {
      assert.equal(items.filter(i => i.status === status).length, report.counts[status] ?? 0, status);
    }
    assert.equal(report.counts['quarantined'], report.quarantined.length);
    for (const q of report.quarantined) assert.ok(q.reason.length > 0, q.id);
  });
});

describe('book items — the reader', () => {
  const lessonId = 'kbl-math-s1-nccd-u1_l1';

  it('serves nothing for a lesson without items, and for no lesson', () => {
    assert.deepEqual(bookItemsForLesson('kbl-math-s1-nccd-u4_l1'), []);
    assert.deepEqual(bookItemsForLesson(null), []);
    assert.equal(takeBookItem({ lessonId: undefined, session: new Set() }), null);
  });

  it('spends each item once per session', () => {
    const session = new Set<string>();
    const seen = new Set<string>();
    for (let n = 0; n < bookItemsForLesson(lessonId).length; n++) {
      const got = takeBookItem({ lessonId, session });
      assert.ok(got);
      assert.ok(!seen.has(got.id));
      seen.add(got.id);
    }
    assert.equal(takeBookItem({ lessonId, session }), null);
  });

  it('filters by kind and prefers the requested tier', () => {
    const mcq = takeBookItem({ lessonId, kind: 'unit-test-mcq', session: new Set() });
    assert.equal(mcq?.kind, 'unit-test-mcq');
    const hard = takeBookItem({ lessonId, kind: 'exercise', tier: 'hard', session: new Set(), rng: () => 0 });
    assert.equal(hard?.tier, 'hard');
  });

  it('is deterministic for a given rng', () => {
    const a = takeBookItem({ lessonId, kind: 'exercise', session: new Set(), rng: () => 0.5 });
    const b = takeBookItem({ lessonId, kind: 'exercise', session: new Set(), rng: () => 0.5 });
    assert.equal(a?.id, b?.id);
  });

  it('cites in Arabic digits at display time only', () => {
    const exercise = items.find(i => i.id === 'bi-math-s1-exercise-book-u1l2-3')!;
    assert.equal(bookCitation(exercise, 'ar'), 'كتاب التمارين ص ١١، س ٣');
    assert.equal(bookCitation(exercise, 'en'), 'Exercise book p. 11, Q3');
    const test = items.find(i => i.id === 'bi-math-s1-teacher-guide-u1l2-1')!;
    assert.equal(bookCitation(test, 'ar'), 'اختبار نهاية الوحدة ١، س ١');
  });

  it('labels what is not verified, and says nothing about what is', () => {
    const computed = items.find(i => i.status === 'computed')!;
    assert.equal(bookStatusLabel(computed, 'ar'), 'الحل محسوب من نص السؤال');
    assert.equal(bookStatusLabel({ ...computed, status: 'verified' }, 'ar'), null);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/bookItems.test.ts`
Expected: FAIL with `Cannot find module` for `../bookItems.ts`.

- [ ] **Step 4: Write the reader and its export**

Create `lib/curriculum/src/bookItems.ts`:

```ts
/**
 * Real items from the NCCD Grade 10 maths books — exercise-book questions and
 * the teacher guide's end-of-unit test — for the generators that build papers.
 *
 * The data is `scripts/extract_book_items.py`'s output, committed, so there is
 * no schema and no migration. See docs/superpowers/specs/2026-10-12-book-items-design.md.
 *
 * **Trust is in `status`, and it is not a ranking.**
 *  - `verified`    the book's printed answer and SymPy agree.
 *  - `computed`    SymPy solved the stem; nothing in the book cross-checks it.
 *                  Served, labelled, and NEVER shown as verified — the stem was
 *                  read from a text layer that flattens exponents and splits
 *                  fractions, and no page image has been compared with it.
 *  - `book-key`    the book prints an answer the verifier cannot judge.
 *  - `quarantined` never in these files; it lives in `report.json`, with a reason.
 * `SERVED_STATUSES` is the one place that decides what a paper may draw.
 *
 * Joined by `lessonId`, never by title: a title does not identify a lesson.
 *
 * Not exported from `index.ts` on purpose — import `@workspace/curriculum/bookItems`.
 */
import exerciseS1 from './data/book-items/math-s1-exercise-book.json' with { type: 'json' };
import exerciseS2 from './data/book-items/math-s2-exercise-book.json' with { type: 'json' };
import guideS1 from './data/book-items/math-s1-teacher-guide.json' with { type: 'json' };

export type BookItemStatus = 'verified' | 'computed' | 'book-key' | 'quarantined';
export type BookItemKind = 'exercise' | 'unit-test-mcq';
export type BookTier = 'easy' | 'medium' | 'hard';

export interface BookItem {
  id: string;
  lessonId: string;
  source: {
    sourceId: string;
    /** 1-based page in that source's PDF. */
    page: number;
    /** The page number the book prints, for a citation. */
    bookPage: number;
    unit: number;
    number: number;
  };
  kind: BookItemKind;
  /** Our own clean Arabic instruction; the book's line is never reproduced. */
  instruction: string;
  /** The Latin maths, as printed (newline-separated for a system). */
  stem: string;
  /** Unit-test multiple choice only. */
  options?: string[];
  printedAnswer: string | null;
  computedAnswer: string;
  check: { topic: string; question: string; answer: string } | null;
  tier: BookTier;
  /** `position` = derived from the item's place in its lesson, not authored. */
  tierSource: 'position' | 'default';
  status: BookItemStatus;
  verificationSource: 'sympy+book' | 'sympy' | 'book' | 'none';
}

/** What a paper may draw. Narrow to `['verified']` here and nowhere else. */
export const SERVED_STATUSES: readonly BookItemStatus[] = ['verified', 'computed', 'book-key'];

const ALL: readonly BookItem[] = [exerciseS1, exerciseS2, guideS1].flatMap(
  f => (f as unknown as { items: BookItem[] }).items,
);

const BY_LESSON: ReadonlyMap<string, readonly BookItem[]> = (() => {
  const out = new Map<string, BookItem[]>();
  for (const item of ALL) {
    if (!SERVED_STATUSES.includes(item.status)) continue;
    out.set(item.lessonId, [...(out.get(item.lessonId) ?? []), item]);
  }
  return out;
})();

/** Every served item for a curriculum lesson (a `kbl-…` id). Empty when there are none. */
export function bookItemsForLesson(lessonId: string | null | undefined): readonly BookItem[] {
  return (lessonId && BY_LESSON.get(lessonId)) || [];
}

export interface TakeBookItem {
  lessonId: string | null | undefined;
  kind?: BookItemKind;
  tier?: BookTier;
  /** Ids this paper has already spent; the taken id is added. Per request, never module state. */
  session: Set<string>;
  rng?: () => number;
}

/** One unspent item, preferring the tier, or null. */
export function takeBookItem({ lessonId, kind, tier, session, rng = Math.random }: TakeBookItem): BookItem | null {
  const pool = bookItemsForLesson(lessonId).filter(i => (!kind || i.kind === kind) && !session.has(i.id));
  if (pool.length === 0) return null;
  const preferred = tier ? pool.filter(i => i.tier === tier) : [];
  const from = preferred.length > 0 ? preferred : pool;
  const pick = from[Math.min(from.length - 1, Math.floor(rng() * from.length))]!;
  session.add(pick.id);
  return pick;
}

const arabicDigits = (n: number) => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

/** «كتاب التمارين ص ٧٢، س ١١» — Arabic digits at display time only. */
export function bookCitation(item: BookItem, lang: 'ar' | 'en'): string {
  const { bookPage, number, unit } = item.source;
  if (item.kind === 'unit-test-mcq') {
    return lang === 'ar'
      ? `اختبار نهاية الوحدة ${arabicDigits(unit)}، س ${arabicDigits(number)}`
      : `Unit ${unit} test, Q${number}`;
  }
  return lang === 'ar'
    ? `كتاب التمارين ص ${arabicDigits(bookPage)}، س ${arabicDigits(number)}`
    : `Exercise book p. ${bookPage}, Q${number}`;
}

/** What the teacher is told about the key, or null when nothing needs saying (`verified`). */
export function bookStatusLabel(item: BookItem, lang: 'ar' | 'en'): string | null {
  if (item.status === 'computed') {
    return lang === 'ar' ? 'الحل محسوب من نص السؤال' : 'Answer computed from the question text';
  }
  if (item.status === 'book-key') {
    return lang === 'ar' ? 'من دليل المعلم' : 'From the teacher guide';
  }
  return null;
}
```

Apply to `lib/curriculum/package.json`:

```diff
diff --git a/lib/curriculum/package.json b/lib/curriculum/package.json
index 55d15c8..85cbf6c 100644
--- a/lib/curriculum/package.json
+++ b/lib/curriculum/package.json
@@ -19,6 +19,7 @@
     "./vocabulary": "./src/vocabulary.ts",
     "./englishHub": "./src/englishHub.ts",
     "./passages": "./src/passages.ts",
+    "./bookItems": "./src/bookItems.ts",
     "./catalogs/*": "./src/catalogs/*.ts",
     "./validateCurriculum": "./src/validateCurriculum.ts"
   },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/bookItems.test.ts`
Expected: `# pass 14`, `# fail 0`

- [ ] **Step 6: Run the whole curriculum suite and typecheck**

Run: `cd lib/curriculum && pnpm test && pnpm run typecheck`
Expected: `# pass 315`, `# fail 0`; typecheck prints no errors.

- [ ] **Step 7: Wire CI**

Apply to `.github/workflows/ci.yml` (in the existing `verifier` job, after the verification regression step):

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 0bec2c8..19e58f2 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -221,3 +221,19 @@ jobs:
         env:
           PYTHONIOENCODING: utf-8
         run: python -X utf8 test_equations.py
+
+      # Real book items: the extractor's normalisation and trust rules, then a
+      # check that the committed JSON is exactly what the script emits. A
+      # hand-edited item, or a rule change without a re-run, fails here.
+      - name: Book item extractor tests
+        working-directory: artifacts/math-verifier
+        env:
+          PYTHONIOENCODING: utf-8
+        run: python -X utf8 ../../scripts/test_extract_book_items.py
+
+      - name: Committed book items match the extractor
+        env:
+          PYTHONIOENCODING: utf-8
+        run: |
+          python -X utf8 scripts/extract_book_items.py
+          git diff --exit-code -- lib/curriculum/src/data/book-items
```

- [ ] **Step 8: Commit**

```bash
git add lib/curriculum .github/workflows/ci.yml
git commit -m "Serve real book items from lib/curriculum and check them in CI"
```

---

### Task 3: The evaluation generator

**Files:**
- Modify: `artifacts/api-server/src/modules/assessment/mockGenerator.ts`
- Create: `artifacts/api-server/src/modules/assessment/__tests__/bookItems.test.ts`

**Interfaces:**
- Consumes: Task 2's `takeBookItem`, `bookCitation`, `bookStatusLabel`; `CurriculumObjective.lessonId`; the generator's existing `BANK_TIER`, `buildRubric`, `QUESTION_TYPES`, seeded `rng`.
- Produces: questions with `aiMetadata.generator === "book"` and the keys `bookItemId`, `bookStatus`, `bookCitationAr/En`, `bookLabelAr/En`, which Task 4 reads.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/modules/assessment/__tests__/bookItems.test.ts`:

```ts
/**
 * Real book items inside a generated evaluation.
 *
 * What these pin:
 *  1. A maths objective whose lesson has book items gets cited book questions,
 *     never more than half the paper, and never a type that was not asked for.
 *  2. Unit-test multiple choice self-marks: its own key grades correct and a
 *     distractor grades incorrect.
 *  3. A `computed` item never reaches the verification pass (`check` is null)
 *     and says so in its metadata — it must not earn «تم التحقق».
 *  4. Students never receive the key.
 *  5. Without a `lessonId`, or for another subject, nothing changes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateMockEvaluation } from "../mockGenerator.ts";
import { QUESTION_TYPES } from "../questionTypes.ts";
import type { CurriculumObjective } from "@workspace/curriculum";

/** Book lesson 2 of unit 1: systems of equations — it has exercises and a unit-test question. */
const objective = (lessonId?: string): CurriculumObjective =>
  ({
    id: "o-nccd-s1-u1_l1-0",
    description: "حل نظام معادلتين",
    descriptionAr: "حل نظام معادلتين",
    bloomsSource: "defaulted",
    skills: [],
    ...(lessonId ? { lessonId } : {}),
  }) as unknown as CurriculumObjective;

const LESSON = "kbl-math-s1-nccd-u1_l1";
const generate = (over: Partial<Parameters<typeof generateMockEvaluation>[0]> = {}) =>
  generateMockEvaluation({
    objectives: [objective(LESSON)],
    assessmentTypes: ["multiple_choice", "short_answer"],
    count: 6,
    difficulty: "standard",
    subjectId: "mathematics",
    seed: 4,
    ...over,
  });
const fromBook = (res: ReturnType<typeof generate>) =>
  res.questions.filter(q => q.aiMetadata["generator"] === "book");
/** Book questions, asserting there are some: a guard over an empty list passes for the wrong reason. */
const drawn = (res: ReturnType<typeof generate>) => {
  const book = fromBook(res);
  assert.ok(book.length > 0, "no book question was drawn, so this test proves nothing");
  return book;
};
/** Template questions stamp `generatedAt`; two otherwise identical runs differ by the clock. */
const withoutClock = (res: ReturnType<typeof generate>) =>
  res.questions.map(q => ({ ...q, aiMetadata: { ...q.aiMetadata, generatedAt: undefined } }));

describe("evaluation generator — real book items", () => {
  it("draws cited book questions for the objective's own lesson", () => {
    const book = fromBook(generate());
    assert.ok(book.length > 0, "the lesson has book items; none were used");
    for (const q of book) {
      assert.match(String(q.aiMetadata["bookCitationAr"]), /ص|الوحدة/u);
      assert.match(String(q.aiMetadata["note"]), /NCCD/);
    }
  });

  it("fills at most half the paper", () => {
    assert.ok(drawn(generate({ count: 6 })).length <= 3);
    for (const count of [2, 4, 6, 9]) {
      assert.ok(fromBook(generate({ count })).length <= Math.floor(count / 2), `count ${count}`);
    }
  });

  it("only produces the types that were asked for", () => {
    const onlyChoice = generate({ assessmentTypes: ["multiple_choice"], count: 6 });
    assert.ok(onlyChoice.questions.every(q => q.type === "multiple_choice"));
    const onlyShort = generate({ assessmentTypes: ["short_answer"], count: 6 });
    assert.ok(drawn(onlyShort).every(q => q.type === "short_answer"));
  });

  it("emits questions the type modules accept", () => {
    for (const q of drawn(generate({ count: 8 }))) {
      const errors = QUESTION_TYPES[q.type].validate({
        type: q.type, body: q.body, expectedAnswer: q.expectedAnswer, rubric: q.rubric,
      } as never);
      assert.deepEqual(errors, [], `${q.type}: ${errors.join("; ")}`);
    }
  });

  it("self-marks unit-test multiple choice with its own key", () => {
    const choices = fromBook(generate({ assessmentTypes: ["multiple_choice"], count: 6 }))
      .filter(q => q.type === "multiple_choice");
    assert.ok(choices.length > 0, "no unit-test multiple choice was drawn");
    const grade = QUESTION_TYPES["multiple_choice"].grade!;
    for (const q of choices) {
      const draft = { type: q.type, body: q.body, expectedAnswer: q.expectedAnswer, rubric: q.rubric } as never;
      const key = q.expectedAnswer["optionIds"] as string[];
      assert.equal(grade(draft, { optionIds: key }).status, "correct");
      const wrong = (q.body["options"] as { id: string }[]).find(o => o.id !== key[0])!;
      assert.equal(grade(draft, { optionIds: [wrong.id] }).status, "incorrect");
    }
  });

  it("never lets a computed item reach the verification pass", () => {
    for (const q of drawn(generate({ count: 8 }))) {
      assert.equal(q.check ?? null, null, "a computed key must not earn the verified badge");
      assert.equal(q.aiMetadata["bookStatus"], "computed");
      assert.equal(q.aiMetadata["bookLabelAr"], "الحل محسوب من نص السؤال");
    }
  });

  it("keeps the key off the student's copy", () => {
    for (const q of drawn(generate({ count: 8 }))) {
      const student = JSON.stringify(
        QUESTION_TYPES[q.type].sanitizeForStudent({
          type: q.type, body: q.body, expectedAnswer: q.expectedAnswer, rubric: q.rubric,
        } as never),
      );
      assert.ok(!student.includes("optionIds"));
      if (q.type === "short_answer") {
        assert.ok(!student.includes(String(q.expectedAnswer["modelAnswer"])), "the answer leaked");
      }
    }
  });

  it("does not repeat an item within a paper", () => {
    const prompts = drawn(generate({ count: 9 })).map(q => String(q.body["prompt"] ?? q.body["stem"]));
    assert.equal(new Set(prompts).size, prompts.length);
  });

  it("is reproducible for a seed", () => {
    assert.ok(drawn(generate({ seed: 21 })).length > 0);
    assert.deepEqual(withoutClock(generate({ seed: 21 })), withoutClock(generate({ seed: 21 })));
  });

  it("changes nothing without a lessonId, or for another subject", () => {
    assert.equal(fromBook(generate({ objectives: [objective()] })).length, 0);
    assert.equal(fromBook(generate({ subjectId: "chemistry" })).length, 0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/bookItems.test.ts`
Expected: `# pass 1`, `# fail 9` (only "changes nothing without a lessonId, or for another subject" passes; the rest need book questions to exist, and each asserts that some were drawn).

- [ ] **Step 3: Add the book path to the generator**

Apply to `artifacts/api-server/src/modules/assessment/mockGenerator.ts`:

```diff
diff --git a/artifacts/api-server/src/modules/assessment/mockGenerator.ts b/artifacts/api-server/src/modules/assessment/mockGenerator.ts
index 1ef0b73..ba2f14f 100644
--- a/artifacts/api-server/src/modules/assessment/mockGenerator.ts
+++ b/artifacts/api-server/src/modules/assessment/mockGenerator.ts
@@ -32,6 +32,11 @@ import {
   type CurriculumSource,
   type SourceKind,
 } from "@workspace/curriculum";
+import {
+  bookCitation,
+  bookStatusLabel,
+  takeBookItem,
+} from "@workspace/curriculum/bookItems";
 import type { Difficulty, QuestionType } from "@workspace/db";
 import {
   allocateQuestions,
@@ -441,6 +446,84 @@ function bankMultipleChoice(
   };
 }
 
+/**
+ * A real question from the NCCD books, for the objective's own lesson.
+ *
+ * Joined by `objective.lessonId`, never by title. Unit-test multiple choice
+ * self-marks; an exercise becomes a short answer the teacher marks against the
+ * key. Neither carries a `check`: only `verified` items may reach the
+ * verification pass, and a `computed` key proves nothing about whether the
+ * stem was read correctly — so it must not earn the «تم التحقق» badge.
+ *
+ * Returns null whenever the lesson has no item of a requested shape, so the
+ * caller falls through to the generated bank exactly as it did before.
+ */
+function bookQuestion(args: {
+  objective: CurriculumObjective;
+  competency: CompetencyKey;
+  difficulty: Difficulty;
+  marks: number;
+  wantChoice: boolean;
+  wantShort: boolean;
+  session: Set<string>;
+  rng: () => number;
+}): GeneratedQuestion | null {
+  const { objective, competency, difficulty, marks, session, rng } = args;
+  const lessonId = objective.lessonId;
+  if (!lessonId) return null;
+  const tier = BANK_TIER[difficulty];
+  const item =
+    (args.wantChoice && takeBookItem({ lessonId, kind: "unit-test-mcq", tier, session, rng })) ||
+    (args.wantShort && takeBookItem({ lessonId, kind: "exercise", tier, session, rng })) ||
+    null;
+  if (!item) return null;
+
+  const prompt = `${item.instruction}\n${item.stem}`;
+  const common = {
+    objectiveId: objective.id,
+    competencyKey: competency,
+    difficulty,
+    marks,
+    skill: objective.skills?.[0] ?? null,
+    check: null,
+    aiMetadata: {
+      generator: "book",
+      note: `from the NCCD ${bookCitation(item, "en")}; not model-authored`,
+      bookItemId: item.id,
+      bookStatus: item.status,
+      bookCitationAr: bookCitation(item, "ar"),
+      bookCitationEn: bookCitation(item, "en"),
+      bookLabelAr: bookStatusLabel(item, "ar"),
+      bookLabelEn: bookStatusLabel(item, "en"),
+      objectiveBloomsSource: objective.bloomsSource,
+    },
+  };
+
+  if (item.kind === "unit-test-mcq") {
+    const options = (item.options ?? []).map((text, i) => ({ id: `o${i}`, text }));
+    const correct = options.findIndex(o => o.text === item.computedAnswer);
+    // An answer not among the options would mark a correct student wrong, for
+    // the whole class, with nothing to show why. Spend the item and fall through.
+    if (options.length < 3 || correct < 0) return null;
+    return {
+      ...common,
+      type: "multiple_choice",
+      body: { stem: prompt, multiSelect: false, options },
+      expectedAnswer: { optionIds: [options[correct]!.id] },
+      rubric: null,
+      gradingMode: QUESTION_TYPES["multiple_choice"].defaultGradingMode,
+    };
+  }
+  return {
+    ...common,
+    type: "short_answer",
+    body: { prompt },
+    expectedAnswer: { modelAnswer: item.computedAnswer, keyConcepts: [item.computedAnswer] },
+    rubric: buildRubric(competency, marks),
+    gradingMode: QUESTION_TYPES["short_answer"].defaultGradingMode,
+  };
+}
+
 /**
  * Open-response type best suited to a competency. Recall and comprehension fit
  * a short answer; application and analysis need room to show working.
@@ -544,6 +627,13 @@ export function generateMockEvaluation(req: GenerationRequest): GenerationResult
 
   let objectiveCursor = 0;
   const mcqAvailable = available.includes("multiple_choice");
+  // Real book items fill at most half a paper, so a quiz does not become a
+  // photocopy of the exercise book; the generated bank fills the rest. Only
+  // maths has book items. They share `bookSession` with nothing else: the
+  // generated bank's own session set spends bank ids, not these.
+  const bookQuota = req.subjectId === "mathematics" ? Math.floor(req.count / 2) : 0;
+  const bookSession = new Set<string>();
+  let bookUsed = 0;
 
   for (const competency of COMPETENCY_KEYS) {
     const wanted = allocation[competency];
@@ -569,6 +659,24 @@ export function generateMockEvaluation(req: GenerationRequest): GenerationResult
       const topic = objective.descriptionAr || objective.description;
       const marks = MARKS_BY_COMPETENCY[competency];
 
+      if (bookUsed < bookQuota) {
+        const book = bookQuestion({
+          objective,
+          competency,
+          difficulty: req.difficulty,
+          marks,
+          wantChoice: mcqAvailable,
+          wantShort: available.includes("short_answer"),
+          session: bookSession,
+          rng,
+        });
+        if (book) {
+          questions.push(book);
+          bookUsed += 1;
+          continue;
+        }
+      }
+
       // The bank first, when the subject has one. A question that marks itself
       // is worth more to a teacher than a prose prompt they mark by hand, so
       // this only falls through to the templates when the bank has nothing
```

- [ ] **Step 4: Run the new test repeatedly**

Run: `for i in 1 2 3 4 5; do node --experimental-strip-types --test src/modules/assessment/__tests__/bookItems.test.ts 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; done`
Expected: `# pass 10 # fail 0` five times. (An earlier draft of the reproducibility test failed about one run in five because template questions stamp `generatedAt`; the test compares without it. A single green run is not evidence here.)

- [ ] **Step 5: Run the whole API suite and typecheck**

Run: `cd artifacts/api-server && pnpm run build && pnpm test && pnpm run typecheck`
Expected: `# pass 1489`, `# fail 0`; typecheck prints no errors. (`build` first: the mount-order suite boots the built bundle and skips without it.)

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server
git commit -m "Draw real book items into maths evaluations, at most half a paper"
```

---

### Task 4: The teacher sees where a question came from

**Files:**
- Create: `artifacts/mobile/services/bookItemNote.ts`
- Create: `artifacts/mobile/services/__tests__/bookItemNote.test.ts`
- Modify: `artifacts/mobile/services/evaluations.ts`
- Modify: `artifacts/mobile/app/evaluations/[id]/index.tsx`

**Interfaces:**
- Consumes: Task 3's `aiMetadata` keys. The teacher `GET /evaluations/:id` already returns whole question rows (`liveQuestions` selects every column), so no API change is needed; the student endpoint is a separate projection.
- Produces: `bookItemNote(meta, 'ar'|'en'): string | null`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/bookItemNote.test.ts`:

```ts
/**
 * Run: node --experimental-strip-types --test artifacts/mobile/services/__tests__/bookItemNote.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bookItemNote } from '../bookItemNote.ts';

const META = {
  generator: 'book',
  bookCitationAr: 'كتاب التمارين ص ١١، س ٣',
  bookCitationEn: 'Exercise book p. 11, Q3',
  bookLabelAr: 'الحل محسوب من نص السؤال',
  bookLabelEn: 'Answer computed from the question text',
};

describe('bookItemNote', () => {
  it('gives the citation and the key label, in the reader’s language', () => {
    assert.equal(bookItemNote(META, 'ar'), 'كتاب التمارين ص ١١، س ٣ · الحل محسوب من نص السؤال');
    assert.equal(bookItemNote(META, 'en'), 'Exercise book p. 11, Q3 · Answer computed from the question text');
  });

  it('gives the citation alone when there is nothing to caveat', () => {
    assert.equal(bookItemNote({ ...META, bookLabelAr: null }, 'ar'), 'كتاب التمارين ص ١١، س ٣');
  });

  it('says nothing for a question that did not come from a book', () => {
    assert.equal(bookItemNote({ generator: 'mock', note: 'template' }, 'ar'), null);
    assert.equal(bookItemNote({ generator: 'llm' }, 'en'), null);
  });

  it('never throws on the bag an older question has', () => {
    for (const meta of [null, undefined, {}, { generator: 'book' }, { generator: 'book', bookCitationAr: 5 }]) {
      assert.equal(bookItemNote(meta as never, 'ar'), null);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test artifacts/mobile/services/__tests__/bookItemNote.test.ts`
Expected: FAIL with `Cannot find module` for `../bookItemNote.ts`.

- [ ] **Step 3: Write the helper**

Create `artifacts/mobile/services/bookItemNote.ts`:

```ts
/**
 * The line a teacher reads above a question that came from the NCCD books:
 * where in the book it is, and — when the answer is not verified — how its key
 * was established.
 *
 * Kept free of React Native imports so it is unit-testable, and reading
 * `aiMetadata` defensively: it is a jsonb bag, absent on every question written
 * before book items existed, and nothing here may throw on one.
 */
export function bookItemNote(
  meta: Record<string, unknown> | null | undefined,
  lang: 'ar' | 'en',
): string | null {
  if (!meta || meta['generator'] !== 'book') return null;
  const pick = (ar: string, en: string): string | null => {
    const v = meta[lang === 'ar' ? ar : en];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const citation = pick('bookCitationAr', 'bookCitationEn');
  if (!citation) return null;
  const label = pick('bookLabelAr', 'bookLabelEn');
  return label ? `${citation} · ${label}` : citation;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test artifacts/mobile/services/__tests__/bookItemNote.test.ts`
Expected: `# pass 4`, `# fail 0`

- [ ] **Step 5: Show it on the evaluation screen**

Apply to `artifacts/mobile/services/evaluations.ts` and `artifacts/mobile/app/evaluations/[id]/index.tsx`:

```diff
diff --git a/artifacts/mobile/app/evaluations/[id]/index.tsx b/artifacts/mobile/app/evaluations/[id]/index.tsx
index b8e6374..7298e7e 100644
--- a/artifacts/mobile/app/evaluations/[id]/index.tsx
+++ b/artifacts/mobile/app/evaluations/[id]/index.tsx
@@ -30,6 +30,7 @@ import {
   type QuestionType,
 } from '@/services/evaluations';
 import { summariseKeyChecks, type KeyCheckSummary } from '@/services/keyCheckSummary';
+import { bookItemNote } from '@/services/bookItemNote';
 import { isolateForeignRuns, prettifySymPy } from '@/services/mathRender';
 import { copyToClipboard } from '@/services/share';
 import { AddReadAloudModal } from '@/components/AddReadAloudModal';
@@ -614,6 +615,14 @@ export default function EvaluationDetailScreen() {
                 {isolateForeignRuns(t('verifiedComputed', prettifySymPy(q.verification.computedAnswer)))}
               </Text>
             ) : null}
+            {/* Where in the NCCD book this came from, and how its key was
+                established when that is not "verified". Nothing for a question
+                that did not come from a book. */}
+            {bookItemNote(q.aiMetadata, lang === 'ar' ? 'ar' : 'en') ? (
+              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18, marginBottom: 6, textAlign: align }}>
+                {isolateForeignRuns(bookItemNote(q.aiMetadata, lang === 'ar' ? 'ar' : 'en') ?? '')}
+              </Text>
+            ) : null}
             <Text
               style={[
                 styles.qText,
diff --git a/artifacts/mobile/services/evaluations.ts b/artifacts/mobile/services/evaluations.ts
index fa34232..724575d 100644
--- a/artifacts/mobile/services/evaluations.ts
+++ b/artifacts/mobile/services/evaluations.ts
@@ -85,6 +85,8 @@ export interface EvaluationQuestion {
   marks: string;
   gradingMode: 'deterministic' | 'math_equivalence' | 'ai_rubric' | 'manual';
   source: 'ai' | 'teacher' | 'ai_edited';
+  /** How the question was made. Read only through `bookItemNote`; absent on older questions. */
+  aiMetadata?: Record<string, unknown> | null;
   /**
    * SymPy's verdict on this question's answer key, when there was one to
    * check. Absent on every question written before key checking existed, and
```

- [ ] **Step 6: Typecheck and run the mobile suite**

Run: `pnpm run typecheck:libs && cd artifacts/mobile && pnpm run typecheck && pnpm test`
Expected: typecheck prints no errors; `# fail 0` (about 3866 tests, 10 skipped).

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile
git commit -m "Show a book question's citation and key label on the evaluation screen"
```

---

### Task 5: Record it, and hand it over for review

**Files:**
- Modify: `STATUS.md`, `CLAUDE.md`, `docs/adding-a-book.md`

- [ ] **Step 1: Update the docs**

Apply:

```diff
diff --git a/CLAUDE.md b/CLAUDE.md
index b523bf0..4fbc360 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -147,6 +147,17 @@ Shipping to production: [`docs/deploying.md`](./docs/deploying.md).
   so the tests that pin them apart (`activityBlueprints.test.ts`,
   `activityPrompts.test.ts`) assert *every field differs from every other
   type*; a new format needs its own entry in both files or they fail.
+- **A question can come from the book, the bank or a model, and only a verifier
+  makes one `verified`.** Real book items (`lib/curriculum/src/bookItems.ts`,
+  data written by `scripts/extract_book_items.py`) join by `lessonId`, never by
+  title. A `computed` item — SymPy solved a stem read from a text layer that
+  flattens exponents and splits fractions — must never carry a `check`: the
+  existing verification pass would badge it «تم التحقق», which says the stem was
+  read correctly and nothing has checked that. `SERVED_STATUSES` is the one place
+  that decides what a paper may draw. Only the API evaluation generator uses
+  book items; the live-AI path and the mobile offline generators ignore them, so
+  a paper differs by which path made it — add a family to the script's `TABLE`,
+  never to a generator.
 - **A teaching style shapes the whole lesson plan, in two places.** Per-style
   phases live in `artifacts/mobile/services/ai/lessonPlanBlueprints.ts` and the
   matching contract in `LESSON_STYLE_RULES_AR`/`_EN`
diff --git a/STATUS.md b/STATUS.md
index ebd31f0..a1483bf 100644
--- a/STATUS.md
+++ b/STATUS.md
@@ -932,6 +932,40 @@ an announcement by default» below.
     **Warm the verifier as well as the API before a demo** — a sleeping
     verifier and an undeployed one look the same from the app.
 
+## Real book items in evaluations: 24 served, none verified, 2026-10-12
+
+A Grade 10 maths evaluation used to be built from generated templates only.
+It now also draws **real NCCD items** — exercise-book questions and the teacher
+guide's end-of-unit test — for the objective's own lesson. Reader:
+`lib/curriculum/src/bookItems.ts`; data: `src/data/book-items/`, written by
+`scripts/extract_book_items.py`. Design:
+`docs/superpowers/specs/2026-10-12-book-items-design.md`.
+
+- **What is in it.** 24 served items: systems of equations (S1 unit 1, two
+  lessons), polynomial derivatives (S2 unit 6) and two unit-test choices. 14 more
+  were quarantined, each with its reason in `report.json` (no real solution, an
+  exponent the text layer made ambiguous, a fraction split across lines).
+- **None is `verified`.** No printed answer was found for the families extracted
+  here (guide page 47 does print some for unit-test items 6-11, not extracted
+  yet), so SymPy's answer is the only one. They are `computed`: labelled to the teacher «الحل محسوب من نص
+  السؤال», and carrying no `check`, so they cannot earn the verified badge.
+  `verified` exists and is pinned by test for the day a family has a printed
+  answer; nothing exercises it with data yet.
+- **No stem has been compared with a page image.** The text layer flattens
+  exponents (`24x3` is 24x³) and splits fractions, and the book PDFs are not in a
+  fresh checkout. The extractor refuses anything ambiguous rather than choosing a
+  reading, but a person should read the 24 against the books. The PR that
+  introduced this lists them.
+- **Where it applies.** Only the API evaluation generator (`mockGenerator.ts`
+  `bookQuestion`): at most half a paper, only when the objective's `lessonId` has
+  items and the requested types allow them. The live-AI path, the mobile offline
+  quiz/exam generators, worksheets, homework and decks do not use book items.
+  The teacher sees the citation and key label on the evaluation screen
+  (`services/bookItemNote.ts`).
+- **Not covered.** S1 unit 1's first lesson («حل معادلات خاصة») has no
+  curriculum lesson, so its 15 exercises cannot be joined; Arabic word problems;
+  figure items; chemistry (its teacher guides have no extracted text).
+
 ## Parents and students sign up with the teacher's code alone, 2026-10-10
 
 A parent or student used to need a first and last name, an email, a password, a
diff --git a/docs/adding-a-book.md b/docs/adding-a-book.md
index 965c84d..1eb9ab1 100644
--- a/docs/adding-a-book.md
+++ b/docs/adding-a-book.md
@@ -14,6 +14,7 @@ and `lib/curriculum/src/curriculumIds.ts` for the reasoning behind the ids.
 | C. Catalog | units / lessons / objectives | `lib/curriculum/src/data/iqra_curriculum_*.json` + `lib/curriculum/src/catalogs/*.ts` | yes |
 | D. Figures | PNG crops + index + lesson map | `knowledge-base/<grade>-<subject>/figures/<sourceId>/`, `knowledge-base/figure-lesson-map.json` | PNGs and index yes, PDF no |
 | E. Exercises | real «تمارين ص ٧٢» references | `knowledge-base/grade-10-math/exercises/<sourceId>/index.json` | yes |
+| E2. Items | real exercise and unit-test questions, keys computed by SymPy | `lib/curriculum/src/data/book-items/<sourceId>.json` | yes |
 
 Source PDFs are gitignored (`knowledge-base/**/support-pdfs/`,
 `knowledge-base/**/*.pdf`, and since 2026-09-16 `attached_assets/**/*.pdf` too —
@@ -139,6 +140,23 @@ curriculum book with its own units and lessons.
 
 23. Add to `BOOKS` in `scripts/extract_book_exercises.py`, run it, commit `index.json`, add the import in `artifacts/mobile/services/bookExercises.ts`.
 
+## E2. Items (exercise and unit-test questions)
+
+Only Grade 10 maths so far. Everything is in `scripts/extract_book_items.py`;
+read its header before adding to it.
+
+28. Add a row to `TABLE`: the source, the book's unit and lesson, the item range,
+    a `family` (`system`, `derivative`, `derivative_at` or `mcq_pair`) and **your
+    own** Arabic `instruction_ar`. The book's scrambled instruction line is never
+    parsed. A row must join to a curriculum lesson or the script stops.
+29. A new kind of question needs a solver, a `MAX_EXP` entry and a test in
+    `scripts/test_extract_book_items.py`. Reject on ambiguity with a reason; never
+    choose a reading.
+30. `python scripts/extract_book_items.py`, then commit the three JSON files and
+    `report.json`. CI re-runs the script and fails if the committed files differ.
+31. Read the new items against the printed book. No page image is reachable from a
+    fresh checkout, so this is the only check on the stem.
+
 ## F. Public download link (only when NCCD does not host the book)
 
 No credentials and no extraction. This is pure file hosting.
@@ -195,4 +213,5 @@ test; add it to `SUBJECT_ALIASES` in `artifacts/mobile/services/bookQrLinks.ts`.
 | Catalog | curriculum browser, every picker, evaluations, objectives |
 | Figures | slides deck and Start Class (2 slides), lesson plan / worksheet / quiz / activity panel and export appendix (up to 6, lesson-level, cited by page) |
 | Exercises | practice references in lesson plans and decks |
+| Items | maths evaluations (API generator only), at most half a paper |
 | Public download link | a download chip on the book card in `app/curriculum/subjects.tsx`, and nothing else |
```

- [ ] **Step 2: Re-run the whole gate once**

Run: `(cd artifacts/math-verifier && python -X utf8 ../../scripts/test_extract_book_items.py) && python -X utf8 scripts/extract_book_items.py && git diff --exit-code -- lib/curriculum/src/data/book-items && pnpm run typecheck`
Expected: 23 Python tests OK; extractor prints `{"computed": 24, "quarantined": 14}`; `git diff --exit-code` exits 0 (the committed JSON is what the script emits); typecheck clean.

- [ ] **Step 3: Commit and push**

```bash
git add STATUS.md CLAUDE.md docs/adding-a-book.md
git commit -m "Record real book items in STATUS, CLAUDE and adding-a-book"
git push -u origin claude/great-pasteur-hgo389
```

- [ ] **Step 4: Print the review list for the PR body**

Save as `/tmp/pr_table.py` (not committed) and run `python /tmp/pr_table.py`:

```python
import json
from pathlib import Path

d = Path('lib/curriculum/src/data/book-items')
rows = []
for f in sorted(d.glob('math-*.json')):
    rows += json.loads(f.read_text(encoding='utf-8'))['items']
print('| Item | Book citation | Stem as extracted | Computed answer |')
print('| --- | --- | --- | --- |')
for r in rows:
    s = r['source']
    cite = (f"exercise book p.{s['bookPage']} Q{s['number']}" if r['kind'] == 'exercise'
            else f"unit {s['unit']} test Q{s['number']} (guide p.{s['page']})")
    stem = r['stem'].replace('\n', ' ; ').replace('|', '\\|')
    print(f"| `{r['id'].removeprefix('bi-math-')}` | {cite} | `{stem}` | `{r['computedAnswer']}` |")
rep = json.loads((d / 'report.json').read_text(encoding='utf-8'))
print()
print('Quarantined (not served):')
for q in rep['quarantined']:
    print(f"- `{q['id'].removeprefix('bi-math-')}`: {q['reason']}")
```

- [ ] **Step 5: Update the existing draft PR**

PR [#1021](https://github.com/NizarAbuahmad/Iqraa/pull/1021) already exists on this branch (it began as the spec). Rename it "Real book items in maths evaluations" and replace its body with: what changed in one paragraph; the *Expected result* section of this plan; the full output of Step 4 under a heading **"Please compare these 24 against the printed books"**; and these caveats verbatim: no stem has been compared with a page image; none is `verified`; only the API evaluation generator uses book items (not the live-AI path, the mobile offline generators, worksheets or decks). End with the attribution line from the session's system reminder. Use `mcp__github__update_pull_request`.

The merge is the review gate: only `main` deploys, and a merge also redeploys the API because `lib/` changed. Do not merge it yourself.

---

## Self-review against the spec

| Spec section | Where |
| --- | --- |
| 1. Data shape, four states, tier rule | Task 1 (record shape, `assign_state`, `tier_for`); Task 2 (invariants: no `verified` without a printed answer, no `check` unless verified) |
| 2. Pipeline: locate, classify per lesson, normalise, solve, write, report | Task 1 |
| 2. Pipeline: read printed answer | Deferred; see *Differences* |
| 3. Reader, `SERVED_STATUSES`, subpath export | Task 2 |
| 3. Evaluations: book first, half-paper cap, shared session, types honoured | Task 3 |
| 3. Mobile offline quiz/exam | Deferred; see *Differences* |
| 3. Live-AI unchanged, recorded in docs | Task 5 |
| 3. Citation + label for the teacher; students never get the key | Task 3 (metadata, `sanitizeForStudent` test), Task 4 (screen) |
| 4. Python tests, TS invariants, reader and generator tests | Tasks 1–4 |
| 4. CI step, drift check | Task 2 |
| 4. Ship gate: counts, quarantine list, sample in PR body | Task 5 |

No placeholders remain. Names are consistent across tasks: `takeBookItem`, `bookCitation`, `bookStatusLabel`, `SERVED_STATUSES`, `bookItemNote`, and the `aiMetadata` keys `bookItemId`, `bookStatus`, `bookCitationAr/En`, `bookLabelAr/En`.
