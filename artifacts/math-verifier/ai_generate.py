"""
AI + check path for derivative_polynomial.

LLM must return the exact JSON contract. Before returning to a teacher,
we re-solve with SymPy and only keep verified items (answer + distractors).
"""
from __future__ import annotations

import json
import os
import random
import re
from dataclasses import asdict
from typing import Any

from templates import TOPIC, DerivativeItem, Distractor, item_to_contract
from verify_core import check_distractors, verify_item

MAX_REGENERATE = 5

SYSTEM_PROMPT = """You are a Grade 10 Jordan math item writer for the topic المشتقات (derivatives).
Return ONLY valid JSON matching this exact contract (latin x, ascii digits, no Arabic symbols):
{
  "topic": "derivative_polynomial",
  "question": "3x^4 - 2x + 7",
  "answer": "12x^3 - 2",
  "distractors": [
    { "value": "3x^3", "misconception": "forgot to multiply by the power" }
  ]
}
Rules:
- topic must be "derivative_polynomial"
- question is a polynomial in x (use ^ for powers, e.g. 3x^4 - 2x + 7)
- answer is d/dx of question, simplified, same notation
- include 1–2 distractors with short English misconception labels
- distractors must NOT be equivalent to the correct answer
- never use Arabic letters or Eastern Arabic numerals
"""


def _extract_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _call_openai_llm(rng: random.Random) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("no_openai_key")

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("openai_package_missing") from exc

    base_url = os.environ.get("OPENAI_BASE_URL") or os.environ.get(
        "AI_INTEGRATIONS_OPENAI_BASE_URL"
    )
    client = OpenAI(api_key=api_key, base_url=base_url or None)
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    hints = [
        "Use a cubic or quartic with 3 terms.",
        "Include a constant term and a linear term.",
        "Use mixed positive and negative coefficients.",
        "Keep total degree between 2 and 5.",
    ]
    user = (
        f"Generate one fresh derivative drill item. Hint: {rng.choice(hints)} "
        "Vary coefficients; do not repeat a previous pattern."
    )

    completion = client.chat.completions.create(
        model=model,
        temperature=0.8,
        max_tokens=400,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    )
    raw = completion.choices[0].message.content or "{}"
    return _extract_json(raw)


def _synthetic_llm(
    rng: random.Random,
    *,
    wrong_answer: bool = False,
    equiv_distractor: bool = False,
) -> dict[str, Any]:
    """
    Offline stand-in when no API key.
    wrong_answer / equiv_distractor inject known failures for regen proofs.
    """
    from sympy import Symbol, diff
    from sympy.parsing.sympy_parser import (
        convert_xor,
        implicit_multiplication_application,
        parse_expr,
        standard_transformations,
    )

    x = Symbol("x")
    transformations = standard_transformations + (
        implicit_multiplication_application,
        convert_xor,
    )

    terms: list[str] = []
    for power in sorted(rng.sample(range(0, 6), k=rng.randint(3, 4)), reverse=True):
        coef = rng.choice([i for i in range(-8, 9) if i != 0])
        if power == 0:
            terms.append(str(coef))
        elif power == 1:
            terms.append(f"{coef}x" if abs(coef) != 1 else ("x" if coef == 1 else "-x"))
        else:
            if abs(coef) == 1:
                terms.append(f"x^{power}" if coef == 1 else f"-x^{power}")
            else:
                terms.append(f"{coef}x^{power}")

    question = terms[0]
    for t in terms[1:]:
        if t.startswith("-"):
            question += f" - {t[1:]}"
        else:
            question += f" + {t}"

    q = parse_expr(question, transformations=transformations, local_dict={"x": x})
    computed = diff(q, x)
    answer = str(computed).replace("**", "^").replace("*", "")

    if wrong_answer:
        answer = str(q).replace("**", "^").replace("*", "")

    # Safe wrong distractor (drop factor) + optional deliberately-equivalent one
    distractors: list[dict[str, str]] = [
        {
            "value": "x",
            "misconception": "forgot to multiply by the power",
        }
    ]
    if equiv_distractor:
        distractors.insert(
            0,
            {
                "value": answer if not wrong_answer else str(computed).replace("**", "^").replace("*", ""),
                "misconception": "copy of correct answer (should be rejected)",
            },
        )

    return {
        "topic": TOPIC,
        "question": question,
        "answer": answer,
        "distractors": distractors,
    }


def _normalize_contract(data: dict[str, Any]) -> DerivativeItem:
    if data.get("topic") != TOPIC:
        raise ValueError(f"bad_topic: {data.get('topic')}")
    question = str(data["question"]).strip()
    answer = str(data["answer"]).strip()
    if not question or not answer:
        raise ValueError("empty_question_or_answer")
    distractors_raw = data.get("distractors") or []
    distractors = [
        Distractor(
            value=str(d.get("value", "")),
            misconception=str(d.get("misconception", "")),
        )
        for d in distractors_raw
        if isinstance(d, dict) and d.get("value")
    ]
    return DerivativeItem(
        topic=TOPIC,
        question=question,
        answer=answer,
        distractors=distractors,
        source="ai_verified",
        verified=False,
    )


def generate_ai_verified(
    rng: random.Random | None = None,
    *,
    use_openai: bool | None = None,
    force_wrong_first: bool = False,
    force_equiv_distractor_first: bool = False,
) -> tuple[DerivativeItem | None, list[str]]:
    """
    Generate until answer + distractors verify, or return (None, attempts).
    Never returns an unverified item.
    """
    r = rng or random.Random()
    attempts: list[str] = []
    prefer_openai = use_openai
    if prefer_openai is None:
        prefer_openai = bool(
            os.environ.get("OPENAI_API_KEY")
            or os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
        )

    for i in range(MAX_REGENERATE):
        try:
            if force_wrong_first and i == 0 and not prefer_openai:
                raw = _synthetic_llm(r, wrong_answer=True)
            elif force_equiv_distractor_first and i == 0 and not prefer_openai:
                raw = _synthetic_llm(r, equiv_distractor=True)
            elif prefer_openai:
                try:
                    raw = _call_openai_llm(r)
                except RuntimeError as exc:
                    attempts.append(f"openai_fallback:{exc}")
                    raw = _synthetic_llm(r, wrong_answer=False)
            else:
                raw = _synthetic_llm(r, wrong_answer=False)

            item = _normalize_contract(raw)
            result = verify_item(
                item.topic,
                item.question,
                item.answer,
                [asdict(d) for d in item.distractors],
            )
            if result.get("verified"):
                item.answer = str(result["computed_answer"]).replace("**", "^")
                item.answer = item.answer.replace("*", "")
                item.verified = True
                return item, attempts + [f"ok_attempt_{i + 1}"]
            attempts.append(result.get("error") or "mismatch")
        except Exception as exc:  # noqa: BLE001
            attempts.append(f"{type(exc).__name__}:{exc}")

    return None, attempts


def generate_ai_verified_or_raise(**kwargs: Any) -> dict:
    item, attempts = generate_ai_verified(**kwargs)
    if item is None:
        raise RuntimeError(f"failed_to_verify_after_{MAX_REGENERATE}: {attempts}")
    return item_to_contract(item)


# Re-export for tests that assert distractor rejection directly
__all__ = [
    "MAX_REGENERATE",
    "check_distractors",
    "generate_ai_verified",
    "generate_ai_verified_or_raise",
]
