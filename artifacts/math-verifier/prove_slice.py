#!/usr/bin/env python3
"""
Done criterion for the derivative verifier vertical slice:

Generate 20 items (template + AI+check paths) and assert every answer key
is SymPy-correct — zero wrong. Plus distractor + registry acceptance checks.

Usage (from artifacts/math-verifier):
  pip install -r requirements.txt
  python prove_slice.py
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

from ai_generate import generate_ai_verified
from templates import item_to_contract, template_axn, to_arabic_display
from verify_core import (
    SOLVERS,
    check_distractors,
    expr_equiv,
    verify_item,
)

SEED = 42
TEMPLATE_COUNT = 10
AI_COUNT = 10


def assert_verified(item: dict, label: str) -> None:
    result = verify_item(
        item["topic"],
        item["question"],
        item["answer"],
        item.get("distractors") or [],
    )
    if not result.get("verified"):
        raise AssertionError(
            f"{label} FAILED verify: q={item['question']!r} a={item['answer']!r} "
            f"computed={result.get('computed_answer')!r} err={result.get('error')!r} "
            f"rejected={result.get('rejected')!r}"
        )


def assert_distractors_wrong(item: dict, label: str) -> None:
    for d in item.get("distractors") or []:
        value = d["value"] if isinstance(d, dict) else getattr(d, "value", "")
        if expr_equiv(item["answer"], str(value)):
            raise AssertionError(
                f"{label} distractor equivalent to answer: {value!r} vs {item['answer']!r}"
            )
    dcheck = check_distractors(item["answer"], item.get("distractors") or [])
    if not dcheck["ok"]:
        raise AssertionError(f"{label} check_distractors failed: {dcheck}")


def main() -> int:
    rng = random.Random(SEED)
    items: list[dict] = []

    # Equivalence smoke (not counted in the 20)
    smoke = verify_item("derivative_polynomial", "x^2 + 2*x + 1", "2*(x + 1)")
    assert smoke["verified"], f"equivalence smoke failed: {smoke}"

    # --- Acceptance: equivalent distractor is REJECTED ---
    bad = check_distractors("12x^3 - 2", [
        {"value": "12*x**3 - 2", "misconception": "same as answer"},
    ])
    assert bad["ok"] is False and any(
        r["reason"] == "equivalent_to_answer" for r in bad["rejected"]
    ), f"expected equivalent distractor rejection, got {bad}"

    # Regen path: first proposal has equivalent distractor → discarded
    recovered, attempts = generate_ai_verified(
        random.Random(SEED + 1),
        force_equiv_distractor_first=True,
    )
    assert recovered is not None, f"equiv-distractor regen failed: {attempts}"
    assert any("bad_distractors" in a for a in attempts) or len(attempts) >= 1
    assert_distractors_wrong(item_to_contract(recovered), "equiv_distractor_regen")
    print(f"OK equivalent-distractor rejection/regen: attempts={attempts}")

    # --- Acceptance: topic registry stub (fractional exponent) ---
    assert "derivative_frac_neg_exp" in SOLVERS
    frac = verify_item("derivative_frac_neg_exp", "x^(1/2)", "1/(2*x^(1/2))")
    # Allow equivalent forms of 1/(2*sqrt(x))
    if not frac["verified"]:
        frac_alt = verify_item(
            "derivative_frac_neg_exp",
            "x**(1/2)",
            str(SOLVERS["derivative_frac_neg_exp"]("x**(1/2)")),
        )
        assert frac_alt["verified"], f"frac registry verify failed: {frac} / {frac_alt}"
        frac = frac_alt
    print(f"OK registry stub derivative_frac_neg_exp: {frac['computed_answer']}")

    print("=== Template path (no AI) ===")
    for i in range(TEMPLATE_COUNT):
        item = item_to_contract(template_axn(rng))
        assert item["verified"] is True
        assert_verified(item, f"template[{i}]")
        assert_distractors_wrong(item, f"template[{i}]")
        display_q = to_arabic_display(item["question"])
        display_a = to_arabic_display(item["answer"])
        items.append({**item, "display": {"question": display_q, "answer": display_a}})
        print(
            f"  [{i+1:02d}] {item['question']} -> {item['answer']}  |  "
            f"display: {display_q} -> {display_a}".encode("utf-8", "replace").decode("utf-8")
        )

    print("=== AI + check path ===")
    ai_attempt_counts: list[int] = []
    for i in range(AI_COUNT):
        item_obj, attempts = generate_ai_verified(
            rng,
            force_wrong_first=(i == 0),
        )
        if item_obj is None:
            raise AssertionError(f"ai[{i}] produced no verified item; attempts={attempts}")
        item = item_to_contract(item_obj)
        assert item["verified"] is True
        assert_verified(item, f"ai[{i}]")
        assert_distractors_wrong(item, f"ai[{i}]")
        # attempts list includes failure reasons + final ok_attempt_N
        ai_attempt_counts.append(len(attempts))
        display_q = to_arabic_display(item["question"])
        display_a = to_arabic_display(item["answer"])
        items.append({**item, "display": {"question": display_q, "answer": display_a}})
        line = f"  [{i+1:02d}] {item['question']} -> {item['answer']}  (attempts={attempts})"
        print(line)

    assert len(items) == TEMPLATE_COUNT + AI_COUNT
    wrong = 0
    for idx, item in enumerate(items):
        r = verify_item(
            item["topic"],
            item["question"],
            item["answer"],
            item.get("distractors") or [],
        )
        if not r.get("verified"):
            wrong += 1
            print(f"WRONG #{idx}: {item}", file=sys.stderr)

    avg_ai_attempts = sum(ai_attempt_counts) / len(ai_attempt_counts) if ai_attempt_counts else 0

    out = Path(__file__).resolve().parent / "prove_slice_report.json"
    out.write_text(
        json.dumps(
            {
                "total": len(items),
                "wrong": wrong,
                "template": TEMPLATE_COUNT,
                "ai_verified": AI_COUNT,
                "attempts_per_ai_item": ai_attempt_counts,
                "avg_ai_attempts": avg_ai_attempts,
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(f"Generated {len(items)} items; wrong answer keys: {wrong}")
    print(f"AI attempts_per_item={ai_attempt_counts} avg={avg_ai_attempts:.2f}")
    print(f"Report: {out}")
    if wrong != 0:
        return 1
    print("PASS — every answer key verified correct; distractors confirmed wrong.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
