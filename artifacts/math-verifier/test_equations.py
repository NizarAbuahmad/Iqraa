"""
Equation-verification regression tests.

Run:  PYTHONIOENCODING=utf-8 python -X utf8 test_equations.py

These pin the behaviour that decides whether the classroom screen may claim
"تم التحقق من الإجابة رياضيًا". Every case uses the answer formatting the
question bank actually produces — Arabic "أو", ±, √, and non-x variables —
because a parse failure on real data would silently downgrade a correct
answer to the unverified label.
"""
from __future__ import annotations

import sys

from verify_core import parse_solution_set, solve_equation, verify_item

# (topic, question, answer, expected_verified, label)
CASES: list[tuple[str, str, str, bool, str]] = [
    # ── linear ──
    ("equation_linear", "2x + 5 = 17", "x = 6", True, "linear"),
    ("equation_linear", "2x + 5 = 17", "x = 5", False, "linear wrong"),
    ("equation_linear", "3x - 4 = 11", "x = 5", True, "linear negative term"),
    ("equation_linear", "x/2 = 9", "x = 18", True, "linear division"),
    # ── quadratic ──
    ("equation_quadratic", "x^2 - 5x + 6 = 0", "x = 2 أو x = 3", True, "two roots, Arabic 'or'"),
    ("equation_quadratic", "x^2 - 5x + 6 = 0", "x = 3 أو x = 2", True, "root order irrelevant"),
    ("equation_quadratic", "x^2 - 5x + 6 = 0", "x = 2", False, "missing a root"),
    ("equation_quadratic", "x^2 = 49", "x = ±7", True, "plus-minus"),
    ("equation_quadratic", "x^2 = 49", "x = 7 فقط", False, "positive root only"),
    ("equation_quadratic", "x^2 - 4x + 1 = 0", "x = 2 ± √3", True, "surd roots"),
    ("equation_quadratic", "x^2 - 4x + 1 = 0", "x = 2 ± √5", False, "wrong surd"),
    ("equation_quadratic", "x^2 - 9 = 0", "x = ±3", True, "plus-minus simple"),
    # ── exponential (variable is not x) ──
    ("equation_exponential", "2^n = 16", "n = 4", True, "exponential"),
    ("equation_exponential", "2^n = 16", "n = 8", False, "exponential wrong"),
    # ── exponentials whose real root sits beside a complex branch ──
    # SymPy solves over C, so 4^x = 64 returns [3, (log(8) + I*pi)/log(2)].
    # Set comparison used to fail on size alone and the correct key lost its
    # badge. Matching the real subset is enough; a wrong root still is not.
    ("equation_exponential", "4^x = 64", "x = 3", True, "real root beside complex branch"),
    ("equation_exponential", "9^x = 27", "x = 3/2", True, "fractional real root"),
    ("equation_exponential", "4^x = 64", "x = 4", False, "wrong root not rescued"),
    ("equation_exponential", "4^x = 64", "x = 2", False, "wrong root not rescued (2)"),
    # ── typographic notation in a derivative key ──
    ("derivative_polynomial", "x^3-4x", "3x² − 4", True, "superscript and typographic minus"),
    ("derivative_polynomial", "x^3-4x", "3x² − 5", False, "typography does not excuse a wrong key"),
    # ── fail closed ──
    ("equation_linear", "2x + y = 7", "x = 2 ، y = 3", False, "system refused"),
    ("equation_linear", "2x + 5 = 17", "ست", False, "prose answer refused"),
]


def main() -> int:
    failures = 0

    for topic, question, answer, expected, label in CASES:
        result = verify_item(topic, question, answer)
        if result["verified"] != expected:
            failures += 1
            print(
                f"FAIL  {label}: expected verified={expected}, got "
                f"{result['verified']} (computed={result['computed_answer']}, "
                f"error={result['error']})"
            )

    # A distractor that is secretly the right answer must be rejected — the
    # class would otherwise see two correct options.
    sneaky = verify_item(
        "equation_quadratic",
        "x^2 = 49",
        "x = ±7",
        [{"value": "x = 7 أو x = -7"}, {"value": "x = 14"}],
    )
    if sneaky["verified"] or not sneaky["rejected"]:
        failures += 1
        print(f"FAIL  secretly-correct distractor not rejected: {sneaky}")

    # Genuinely wrong distractors must NOT block a correct item.
    clean = verify_item(
        "equation_quadratic", "x^2 = 49", "x = ±7",
        [{"value": "x = 7"}, {"value": "x = 14"}],
    )
    if not clean["verified"]:
        failures += 1
        print(f"FAIL  good distractors wrongly rejected: {clean}")

    # Unit checks on the parsing helpers.
    if len(parse_solution_set("x = 2 ± √3")) != 2:
        failures += 1
        print("FAIL  parse_solution_set did not expand ±")
    if len(solve_equation("x^2 - 5x + 6 = 0")) != 2:
        failures += 1
        print("FAIL  solve_equation did not return both roots")

    # Distractors arrive exactly as a teacher reads them on screen. Parsing
    # only the answer made every derivative multiple-choice item fail its
    # distractor check with parse_or_compare_error and lose its badge.
    typographic = verify_item(
        "derivative_polynomial", "x^3-4x", "3x^2 - 4",
        [{"value": "3x²"}, {"value": "x² − 4"}, {"value": "3x − 4"}],
    )
    if not typographic["verified"]:
        failures += 1
        print(f"FAIL  typographic distractors wrongly rejected: {typographic}")

    # …and that leniency must not let a secretly-correct one through.
    disguised = verify_item(
        "derivative_polynomial", "x^3-4x", "3x^2 - 4",
        [{"value": "3x² − 4"}, {"value": "x"}],
    )
    if disguised["verified"] or not disguised["rejected"]:
        failures += 1
        print(f"FAIL  disguised correct distractor not rejected: {disguised}")

    # The evidence shown to the class must be the set the key matched, not the
    # complex branches SymPy carried along.
    shown = verify_item("equation_exponential", "4^x = 64", "x = 3")
    if shown["computed_answer"] != "3":
        failures += 1
        print(f"FAIL  complex branch leaked into the classroom evidence: {shown}")

    total = len(CASES) + 7
    print(f"{total - failures}/{total} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
