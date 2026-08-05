"""
Template path (no AI): derivative of a·x^n.

Picks random a, n and computes the answer in code — always correct.
Latin symbols only; Arabic display is a separate step.
Item is verified only if answer + distractors pass verify_item.
"""
from __future__ import annotations

import random
from dataclasses import asdict, dataclass

from verify_core import verify_item

TOPIC = "derivative_polynomial"
MAX_TEMPLATE_ATTEMPTS = 8


@dataclass
class Distractor:
    value: str
    misconception: str


@dataclass
class DerivativeItem:
    topic: str
    question: str
    answer: str
    distractors: list[Distractor]
    source: str  # "template" | "ai_verified"
    verified: bool = True


def _fmt_term(coef: int, power: int, var: str = "x") -> str:
    if power == 0:
        return str(coef)
    if power == 1:
        body = var
    else:
        body = f"{var}^{power}"
    if coef == 1:
        return body
    if coef == -1:
        return f"-{body}"
    return f"{coef}{body}"


def _build_axn(rng: random.Random) -> DerivativeItem:
    a = rng.choice([i for i in range(-9, 10) if i not in (0,)])
    n = rng.randint(2, 8)

    question = _fmt_term(a, n)
    new_coef = a * n
    new_power = n - 1
    answer = _fmt_term(new_coef, new_power)

    distractors = [
        Distractor(
            value=_fmt_term(a, new_power),
            misconception="forgot to multiply by the power",
        )
    ]
    if n > 2:
        distractors.append(
            Distractor(
                value=_fmt_term(a, n),
                misconception="did not reduce the exponent",
            )
        )

    return DerivativeItem(
        topic=TOPIC,
        question=question,
        answer=answer,
        distractors=distractors,
        source="template",
        verified=False,
    )


def template_axn(rng: random.Random | None = None) -> DerivativeItem:
    """Parameterized template: d/dx [a·x^n] = a·n·x^(n-1). Regenerates if distractors fail."""
    r = rng or random.Random()
    last_error = "unknown"
    for _ in range(MAX_TEMPLATE_ATTEMPTS):
        item = _build_axn(r)
        result = verify_item(
            item.topic,
            item.question,
            item.answer,
            [asdict(d) for d in item.distractors],
        )
        if result.get("verified"):
            if result.get("computed_answer"):
                item.answer = str(result["computed_answer"]).replace("**", "^").replace("*", "")
            item.verified = True
            return item
        last_error = str(result.get("error") or "mismatch")
    raise RuntimeError(f"template_failed_after_{MAX_TEMPLATE_ATTEMPTS}: {last_error}")


def item_to_contract(item: DerivativeItem) -> dict:
    d = asdict(item)
    return {
        "topic": d["topic"],
        "question": d["question"],
        "answer": d["answer"],
        "distractors": d["distractors"],
        "source": d["source"],
        "verified": d["verified"],
    }


ARABIC_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def to_arabic_display(expr: str) -> str:
    """Convert latin x / digits to س / Arabic numerals at display time only."""
    out = expr.replace("x", "س")
    return out.translate(ARABIC_DIGITS)
