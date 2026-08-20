"""Pure SymPy verify/compute helpers (no FastAPI). Latin x only."""
from __future__ import annotations

import re
from typing import Any, Callable

from sympy import Eq, Symbol, Tuple, diff, simplify, solve, sqrt
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)


# Typographic characters a teacher-facing option or key can carry. Only the
# character swaps belong here — the word-level rewrites in
# _normalise_answer_text ("أو" → ";") are for solution SETS and would break an
# expression parse.
_SUPERSCRIPTS = "\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079"

_EXPR_TYPOGRAPHY = (
    ("−", "-"), ("–", "-"), ("—", "-"),
    ("×", "*"), ("÷", "/"),
)


def normalise_expr_text(expr: str) -> str:
    """
    Typographic maths → parseable ASCII, for expression comparison.

    Distractors reach us exactly as a teacher reads them on screen — `3x²`,
    `x² − 4` — while the answer has already been latinised upstream. Parsing
    only the answer meant every derivative multiple-choice item failed its
    distractor check with parse_or_compare_error and lost its badge, even
    though the key itself had just been proved correct.
    """
    out = expr.strip()
    for src, dst in _EXPR_TYPOGRAPHY:
        out = out.replace(src, dst)
    # Every superscript digit, not only ² and ³. A distractor written `x⁴`
    # used to reach the parser with the character intact, where it is a
    # syntax error — so the item was rejected as bad_distractors and lost a
    # badge its key had already earned.
    return re.sub(
        f"[{_SUPERSCRIPTS}]+",
        lambda m: "**" + "".join(str(_SUPERSCRIPTS.index(c)) for c in m.group()),
        out,
    )


def parse_latin(expr: str) -> Any:
    x = Symbol("x")
    return parse_expr(
        normalise_expr_text(expr),
        transformations=TRANSFORMATIONS,
        local_dict={"x": x},
        evaluate=True,
    )


def expr_equiv(a: str, b: str) -> bool:
    """Fail-closed equivalence: .equals() → None becomes False."""
    ea, eb = parse_latin(a), parse_latin(b)
    if simplify(ea - eb) == 0:
        return True
    return bool(ea.equals(eb))


def _relation(a: str, b: str) -> str:
    """
    Three-way compare for distractor safety.
    Returns: 'equivalent' | 'distinct' | 'indeterminate' | 'error'
    """
    try:
        ea, eb = parse_latin(a), parse_latin(b)
        if simplify(ea - eb) == 0:
            return "equivalent"
        eq = ea.equals(eb)
        if eq is True:
            return "equivalent"
        if eq is None:
            return "indeterminate"
        return "distinct"
    except Exception:  # noqa: BLE001
        return "error"


def check_distractors(answer: str, distractors: list[dict]) -> dict[str, Any]:
    """
    Distractors must be confirmed WRONG and pairwise distinct.
    Fail-closed: equivalent or indeterminate → reject.
    """
    rejected: list[dict[str, str]] = []
    values: list[str] = []

    for d in distractors or []:
        if not isinstance(d, dict):
            rejected.append({"value": str(d), "reason": "invalid_distractor"})
            continue
        value = str(d.get("value", "")).strip()
        if not value:
            rejected.append({"value": "", "reason": "empty_distractor"})
            continue

        rel = _relation(answer, value)
        if rel == "equivalent":
            rejected.append({"value": value, "reason": "equivalent_to_answer"})
        elif rel == "indeterminate":
            rejected.append({"value": value, "reason": "equivalence_indeterminate"})
        elif rel == "error":
            rejected.append({"value": value, "reason": "parse_or_compare_error"})
        else:
            values.append(value)

    # Pairwise duplicate distractors
    for i, vi in enumerate(values):
        for vj in values[i + 1 :]:
            rel = _relation(vi, vj)
            if rel in ("equivalent", "indeterminate", "error"):
                reason = (
                    "duplicate_distractor"
                    if rel == "equivalent"
                    else f"distractor_pair_{rel}"
                )
                rejected.append({"value": vj, "reason": reason})

    return {"ok": len(rejected) == 0, "rejected": rejected}


def _diff_x(question: str) -> Any:
    return diff(parse_latin(question), Symbol("x"))


# ── Equations ────────────────────────────────────────────────────────────────
# Equations cannot use expression equivalence: the question has an '=' and the
# answer is a SOLUTION SET ("x = 2 أو x = 3", "x = ±7"). These helpers solve
# symbolically and compare sets, so ordering and phrasing never matter.

def _parse_any(expr: str) -> Any:
    """Parse without pinning the variable — equations may use n, y, t…"""
    return parse_expr(
        expr.strip(),
        transformations=TRANSFORMATIONS,
        evaluate=True,
    )


def _normalise_answer_text(answer: str) -> str:
    """Arabic/typographic notation → SymPy-parseable ASCII."""
    out = answer.strip()
    # √3 must become sqrt(3), not sqrt3 — the latter parses as a symbol and
    # silently fails a correct surd answer like "x = 2 ± √3".
    out = re.sub(r"√\s*(\d+(?:\.\d+)?|[A-Za-z]\w*)", r"sqrt(\1)", out)
    out = out.replace("√", "sqrt")
    for src, dst in (
        ("−", "-"), ("–", "-"), ("—", "-"),
        ("×", "*"), ("÷", "/"),
        ("²", "**2"), ("³", "**3"),
        (" أو ", ";"), ("أو", ";"),
        (" or ", ";"),
        ("فقط", ""),
    ):
        out = out.replace(src, dst)
    return out.strip()


def solve_equation(question: str) -> list[Any]:
    """
    Solve a single-variable equation given as 'lhs = rhs'.
    Raises ValueError when the shape is unsupported, so callers fail closed.
    """
    text = _normalise_answer_text(question)
    if text.count("=") != 1:
        raise ValueError("expected exactly one '='")
    lhs_s, rhs_s = text.split("=")
    lhs, rhs = _parse_any(lhs_s), _parse_any(rhs_s)
    symbols = sorted((lhs - rhs).free_symbols, key=lambda s: s.name)
    if len(symbols) != 1:
        raise ValueError(f"expected one unknown, found {len(symbols)}")
    sols = solve(Eq(lhs, rhs), symbols[0], dict=False)
    if not sols:
        raise ValueError("no solution found")
    return list(sols)


def parse_solution_set(answer: str) -> list[Any]:
    """
    Turn a teacher-facing answer into a set of values.
    Handles: 'x = 6' · 'x = 2 أو x = 3' · 'x = ±7' · 'x = 2 ± √3' · 'n = 4'.
    Raises ValueError on multi-variable answers (systems) — a different check.
    """
    text = _normalise_answer_text(answer)
    # 'x = 2 ، y = 3' is a system; set comparison would be meaningless.
    if "،" in text or "," in text:
        raise ValueError("multi-variable answer")

    values: list[Any] = []
    for part in (p for p in text.split(";") if p.strip()):
        body = part.split("=")[-1].strip()  # drop any 'x =' prefix
        if not body:
            continue
        if "±" in body:
            plus, minus = body.replace("±", "+"), body.replace("±", "-")
            values.extend([_parse_any(plus), _parse_any(minus)])
        else:
            values.append(_parse_any(body))
    if not values:
        raise ValueError("no values parsed")
    return values


def real_solutions(values: list[Any]) -> list[Any]:
    """
    The real subset of a solution list.

    SymPy solves over the complex field, so a Grade-10 exponential like
    4^x = 64 comes back as [3, (log(8) + I*pi)/log(2)] — one intended root
    plus a complex branch. Set comparison then failed on size alone and the
    item degraded to the 'bank' label despite the key being right. Keep the
    full set too: matching either one is enough, and neither can turn a wrong
    answer into a verified one, since both require exact set equality against
    a genuine solution set.
    """
    out: list[Any] = []
    for v in values:
        try:
            if v.is_real:
                out.append(v)
        except AttributeError:
            continue
    return out


def solution_sets_match(expected: list[Any], claimed: list[Any]) -> bool:
    """Fail-closed set equality up to symbolic simplification."""
    if len(expected) != len(claimed):
        return False
    remaining = list(claimed)
    for e in expected:
        hit = None
        for i, c in enumerate(remaining):
            try:
                if simplify(e - c) == 0:
                    hit = i
                    break
            except Exception:  # noqa: BLE001
                continue
        if hit is None:
            return False
        remaining.pop(hit)
    return not remaining


# ── Derivative evaluated at a point ──────────────────────────────────────────
# «ما قيمة مشتقة f(x) = x⁴ عند x = 2؟» → 32. The classifier used to extract
# only `x^4` and hand it to the plain derivative solver, which computed 4x³ and
# rejected the key 32 — a correct answer reported as a wrong one. The payload
# carries the point after an '@', a character no expression can contain, so the
# two halves can never be confused for one expression.

def _diff_at_point(payload: str) -> Any:
    expr_s, _, point_s = payload.partition("@")
    if not point_s.strip():
        raise ValueError("expected 'expression@point'")
    derivative = diff(parse_latin(expr_s), Symbol("x"))
    return simplify(derivative.subs(Symbol("x"), parse_latin(point_s)))


# ── Circles in standard form ─────────────────────────────────────────────────
# (x - h)² + (y - k)² = r². Two unknowns, so solve_equation refuses it and the
# item degraded to 'bank'; centre and radius are nonetheless exactly computable.

def _circle(payload: str) -> tuple[Any, Any, Any]:
    """(x-h)² + (y-k)² = r² → (h, k, r). Raises when it is not that shape."""
    text = normalise_expr_text(payload)
    if text.count("=") != 1:
        raise ValueError("expected exactly one '='")
    lhs_s, rhs_s = text.split("=")
    x, y = Symbol("x"), Symbol("y")
    lhs = parse_expr(lhs_s, transformations=TRANSFORMATIONS, local_dict={"x": x, "y": y})
    rhs = parse_expr(rhs_s, transformations=TRANSFORMATIONS, local_dict={"x": x, "y": y})
    poly = (lhs - rhs).expand()
    if poly.free_symbols != {x, y}:
        raise ValueError("expected exactly the unknowns x and y")
    # Match a*x² + a*y² + b*x + c*y + d with equal square coefficients — the
    # only family that is a circle. An ellipse or hyperbola must not qualify.
    ax, ay = poly.coeff(x, 2), poly.coeff(y, 2)
    if ax == 0 or ax != ay:
        raise ValueError("not a circle")
    if poly.coeff(x, 1).has(y) or poly.coeff(y, 1).has(x):
        raise ValueError("cross term present")
    b, c = poly.coeff(x, 1) / ax, poly.coeff(y, 1) / ay
    d = simplify(poly.subs({x: 0, y: 0}) / ax)
    h, k = simplify(-b / 2), simplify(-c / 2)
    r_squared = simplify(h**2 + k**2 - d)
    # A degenerate "circle" of radius 0 or an imaginary one is not a question
    # with a centre and a radius, so it never qualifies.
    if not r_squared.is_positive:
        raise ValueError("non-positive radius")
    return h, k, simplify(sqrt(r_squared))


def _circle_center(payload: str) -> Any:
    h, k, _ = _circle(payload)
    return Tuple(h, k)


def _circle_radius(payload: str) -> Any:
    return _circle(payload)[2]


# Topic-pluggable solvers — add a topic later = one entry here.
SOLVERS: dict[str, Callable[[str], Any]] = {
    "derivative_polynomial": _diff_x,
    # Stub registry entry (same diff solver) for fractional / negative exponents.
    "derivative_frac_neg_exp": _diff_x,
    "derivative_at_point": _diff_at_point,
    "circle_radius": _circle_radius,
    "circle_center": _circle_center,
}

# Topics whose answer is an ordered PAIR, not an expression. «(4, -1)» cannot
# go through expr_equiv — subtracting two tuples raises — so these compare
# coordinate by coordinate.
POINT_TOPICS: frozenset[str] = frozenset({"circle_center"})

# Topics compared as SOLUTION SETS rather than by expression equivalence.
EQUATION_TOPICS: frozenset[str] = frozenset(
    {"equation_linear", "equation_quadratic", "equation_exponential"}
)


def _verify_equation(
    question: str,
    answer: str,
    distractors: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Solve the equation and compare SOLUTION SETS.

    Distractors are checked as sets too: a distractor whose set equals the
    real solution set is secretly correct and must be rejected, exactly as
    expression-equivalence does for derivatives.
    """
    try:
        expected = solve_equation(question)
    except Exception as exc:  # noqa: BLE001
        return {
            "verified": False,
            "computed_answer": None,
            "error": f"solve_error: {type(exc).__name__}: {exc}",
            "rejected": [],
        }

    pretty = ", ".join(str(v) for v in expected)

    try:
        claimed = parse_solution_set(answer)
    except Exception as exc:  # noqa: BLE001
        return {
            "verified": False,
            "computed_answer": pretty,
            "error": f"answer_parse_error: {type(exc).__name__}: {exc}",
            "rejected": [],
        }

    reals = real_solutions(expected)
    matched_reals = bool(reals) and solution_sets_match(reals, claimed)
    if not (solution_sets_match(expected, claimed) or matched_reals):
        return {
            "verified": False,
            "computed_answer": pretty,
            "error": "answer_mismatch",
            "rejected": [],
        }

    rejected: list[dict[str, str]] = []
    for d in distractors or []:
        value = str((d or {}).get("value", "")).strip()
        if not value:
            rejected.append({"value": "", "reason": "empty_distractor"})
            continue
        try:
            parsed = parse_solution_set(value)
            # Widened acceptance above must widen rejection here too, or a
            # distractor equal to the real-root set would slip through as a
            # legitimate wrong option while being secretly correct.
            if solution_sets_match(expected, parsed) or (
                reals and solution_sets_match(reals, parsed)
            ):
                rejected.append({"value": value, "reason": "equivalent_to_answer"})
        except Exception:  # noqa: BLE001
            # Unparseable distractor is fine: it is plainly not the answer,
            # and students only ever see it as text.
            continue
    if rejected:
        return {
            "verified": False,
            "computed_answer": pretty,
            "error": "bad_distractors",
            "rejected": rejected,
        }

    # Report the set the claim actually matched. Echoing the complex branches
    # back would put "3, (log(8) + I*pi)/log(2)" on a Grade-10 classroom wall
    # as the verifier's own working.
    shown = ", ".join(str(v) for v in reals) if matched_reals else pretty
    return {"verified": True, "computed_answer": shown, "error": None, "rejected": []}


def parse_point(text: str) -> tuple[Any, ...]:
    """
    «(4, -1)» → (4, -1). Also accepts the Arabic comma and a bare `4, -1`.

    Raises on anything that is not an ordered pair, so a key like «صحيح» or
    «المركز (4,-1) ونصف القطر 3» fails closed rather than half-matching.
    """
    body = normalise_expr_text(text).replace("،", ",").strip()
    if body.startswith("(") and body.endswith(")"):
        body = body[1:-1]
    parts = [pp.strip() for pp in body.split(",")]
    if len(parts) != 2 or not all(parts):
        raise ValueError("expected an ordered pair")
    return tuple(
        parse_expr(pp, transformations=TRANSFORMATIONS, evaluate=True) for pp in parts
    )


def points_match(expected: tuple[Any, ...], claimed: tuple[Any, ...]) -> bool:
    """Fail-closed coordinate-wise equality, up to symbolic simplification."""
    if len(expected) != len(claimed):
        return False
    for e, c in zip(expected, claimed):
        try:
            if simplify(e - c) != 0:
                return False
        except Exception:  # noqa: BLE001
            return False
    return True


def _verify_point(
    solver: Callable[[str], Any],
    question: str,
    answer: str,
    distractors: list[dict] | None = None,
) -> dict[str, Any]:
    """Verify a topic whose answer is an ordered pair, e.g. a circle's centre."""
    expected = solver(question)
    pretty = f"({expected[0]}, {expected[1]})"
    try:
        claimed = parse_point(answer)
    except Exception as exc:  # noqa: BLE001
        return {
            "verified": False,
            "computed_answer": pretty,
            "error": f"answer_parse_error: {type(exc).__name__}: {exc}",
            "rejected": [],
        }
    if not points_match(tuple(expected), claimed):
        return {
            "verified": False,
            "computed_answer": pretty,
            "error": "answer_mismatch",
            "rejected": [],
        }

    rejected: list[dict[str, str]] = []
    for d in distractors or []:
        value = str((d or {}).get("value", "")).strip()
        if not value:
            rejected.append({"value": "", "reason": "empty_distractor"})
            continue
        try:
            if points_match(tuple(expected), parse_point(value)):
                rejected.append({"value": value, "reason": "equivalent_to_answer"})
        except Exception:  # noqa: BLE001
            # Not a coordinate pair at all, so plainly not this answer. Same
            # judgement the equation path makes, and the opposite of the
            # expression path, which cannot tell "unparseable" from "equal".
            continue
    if rejected:
        return {
            "verified": False,
            "computed_answer": pretty,
            "error": "bad_distractors",
            "rejected": rejected,
        }
    return {"verified": True, "computed_answer": pretty, "error": None, "rejected": []}


def verify_item(
    topic: str,
    question: str,
    answer: str,
    distractors: list[dict] | None = None,
) -> dict[str, Any]:
    """Dispatch by topic; verified only if answer matches and distractors (if any) are ok."""
    if topic in EQUATION_TOPICS:
        return _verify_equation(question, answer, distractors)

    solver = SOLVERS.get(topic)
    if solver is None:
        return {
            "verified": False,
            "computed_answer": None,
            "error": "unsupported_topic",
            "rejected": [],
        }
    try:
        if topic in POINT_TOPICS:
            return _verify_point(solver, question, answer, distractors)
        expected = str(solver(question))
        if not expr_equiv(expected, answer):
            return {
                "verified": False,
                "computed_answer": expected,
                "error": "answer_mismatch",
                "rejected": [],
            }
        if distractors is not None:
            # Compare distractors against the proposed answer (≡ expected after answer check).
            dcheck = check_distractors(answer, distractors)
            if not dcheck["ok"]:
                return {
                    "verified": False,
                    "computed_answer": expected,
                    "error": "bad_distractors",
                    "rejected": dcheck["rejected"],
                }
        return {
            "verified": True,
            "computed_answer": expected,
            "error": None,
            "rejected": [],
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "verified": False,
            "computed_answer": None,
            "error": f"verify_error: {type(exc).__name__}: {exc}",
            "rejected": [],
        }


def compute_derivative(question: str) -> dict[str, Any]:
    try:
        computed = _diff_x(question)
        return {"ok": True, "computed_answer": str(computed), "error": None}
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "computed_answer": None,
            "error": f"compute_error: {type(exc).__name__}: {exc}",
        }


def verify_derivative(
    question: str,
    answer: str,
    distractors: list[dict] | None = None,
) -> dict[str, Any]:
    """Backward-compatible wrapper → topic registry."""
    return verify_item("derivative_polynomial", question, answer, distractors)
