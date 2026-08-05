"""Pure SymPy verify/compute helpers (no FastAPI). Latin x only."""
from __future__ import annotations

from typing import Any, Callable

from sympy import Symbol, diff, simplify
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


def parse_latin(expr: str) -> Any:
    x = Symbol("x")
    return parse_expr(
        expr.strip(),
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


# Topic-pluggable solvers — add a topic later = one entry here.
SOLVERS: dict[str, Callable[[str], Any]] = {
    "derivative_polynomial": _diff_x,
    # Stub registry entry (same diff solver) for fractional / negative exponents.
    "derivative_frac_neg_exp": _diff_x,
}


def verify_item(
    topic: str,
    question: str,
    answer: str,
    distractors: list[dict] | None = None,
) -> dict[str, Any]:
    """Dispatch by topic; verified only if answer matches and distractors (if any) are ok."""
    solver = SOLVERS.get(topic)
    if solver is None:
        return {
            "verified": False,
            "computed_answer": None,
            "error": "unsupported_topic",
            "rejected": [],
        }
    try:
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
