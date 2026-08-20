"""
Score generated answer keys against SymPy.

The objective half of the provider evaluation. Every quiz question a model
produced goes through the SAME gate the app uses to decide whether it may claim
"تم التحقق من الإجابة رياضيًا" — the classifier in verifyMathGuards.ts, then
verify_core. So a provider's score here is not a proxy for correctness; it is
the product's own definition of it.

Read the numbers as a floor, not a grade. Only some families are provable
(derivatives and single-unknown equations); trigonometry, circle geometry and
word problems classify as unverifiable and are excluded rather than counted
wrong. A provider is not worse for writing a good trigonometry question — it
just cannot be scored on one. صح/خطأ items are excluded for the same reason:
the statement may be about a derivative, but «صحيح» is a verdict, not an
expression, and no symbolic prover can confirm it.

Run:  python3 artifacts/api-server/scripts/score-math.py eval-out/<runId>
"""
from __future__ import annotations

import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "artifacts" / "math-verifier"))

try:
    from verify_core import verify_item
except ImportError:
    sys.exit("verify_core not importable — run: pip install -r artifacts/math-verifier/requirements.txt")

GUARDS = REPO / "artifacts" / "mobile" / "services" / "ai" / "verifyMathGuards.ts"
PAIR = REPO / "artifacts" / "mobile" / "services" / "quizVerification.ts"


def classify(items: list[dict]) -> list[dict]:
    """Classify via the app's own guards, so scoring matches production."""
    # Must mirror the app's FULL pipeline, not just the classifier. Skipping
    # toVerifiablePair leaves "f'(x) = 2x" prefixed and SymPy rejects every
    # derivative key — the scorer would report a provider as wrong on exactly
    # the family the verifier is best at.
    script = f"""
import {{ classifyVerifiableTopic }} from {json.dumps(str(GUARDS))};
import {{ toVerifiablePair, stripOptionLabel, isTrueFalseAnswer }} from {json.dumps(str(PAIR))};
const items = JSON.parse(process.argv[2]);
console.log(JSON.stringify(items.map(i => {{
  // `quizPromptAr` asks for «أ) الخيار الصحيح», so the key and every option
  // arrive carrying an option label. Unstripped, SymPy cannot parse either —
  // the key is rejected and the distractors all come back
  // parse_or_compare_error, so a correct answer scores as a wrong one.
  const answer = stripOptionLabel(i.answer);
  const options = i.options.map(stripOptionLabel);
  const pair = toVerifiablePair(i.text, answer);
  const c = classifyVerifiableTopic(pair.question);
  return {{
    ...i, answer: pair.answer, options,
    trueFalse: isTrueFalseAnswer(answer),
    topic: c?.topic ?? null, payload: c?.payload ?? null,
  }};
}})));
"""
    tmp = REPO / "eval-classify.mjs"
    tmp.write_text(script, encoding="utf-8")
    try:
        out = subprocess.run(
            ["node", "--experimental-strip-types", str(tmp), json.dumps(items)],
            capture_output=True, text=True, check=True, cwd=REPO,
        )
        return json.loads(out.stdout)
    finally:
        tmp.unlink(missing_ok=True)


def main() -> int:
    if len(sys.argv) < 2:
        return print(__doc__) or 2
    run_dir = Path(sys.argv[1])
    items = json.loads((run_dir / "math-items.json").read_text(encoding="utf-8"))
    key = json.loads((run_dir / "key.json").read_text(encoding="utf-8"))
    if not items:
        print("No quiz questions were produced — nothing to score.")
        return 0

    classified = classify(items)
    stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"total": 0, "true_false": 0, "classified": 0, "verified": 0}
    )
    failures: list[tuple[str, str, str, str]] = []

    for item in classified:
        provider = key[item["anonId"]]["provider"]
        s = stats[provider]
        s["total"] += 1
        # A صح/خطأ statement about a derivative still classifies as one, so it
        # must be dropped here rather than counted wrong: comparing «صحيح» to
        # 2*x can only ever fail, and reporting that as a rejected key blames
        # the model for answering the question it was asked.
        if item["trueFalse"]:
            s["true_false"] += 1
            continue
        if not item["topic"]:
            continue
        s["classified"] += 1
        res = verify_item(
            item["topic"], item["payload"], item["answer"],
            [{"value": d} for d in item["options"] if d != item["answer"]],
        )
        if res["verified"]:
            s["verified"] += 1
        else:
            failures.append((provider, item["payload"], item["answer"], str(res.get("computed_answer"))))

    print(f"\nSymbolic scoring — {run_dir}\n")
    print(f"{'provider':<12} {'questions':>10} {'صح/خطأ':>9} {'provable':>9} {'verified':>9}  {'pass rate':>9}")
    for provider, s in sorted(stats.items()):
        rate = f"{100 * s['verified'] / s['classified']:.0f}%" if s["classified"] else "n/a"
        print(f"{provider:<12} {s['total']:>10} {s['true_false']:>9} {s['classified']:>9}"
              f" {s['verified']:>9}  {rate:>9}")
    # "provable" is the denominator. A run where it is 0 is not a pass or a
    # fail — it measured nothing, and saying so beats printing n/a and moving on.
    if all(s["classified"] == 0 for s in stats.values()):
        print("\nNothing was provable in this run — the pass rate above is not a result.")

    if failures:
        # These are the ones that matter: a provable question whose key SymPy
        # disagreed with is a wrong answer key, which is the failure this whole
        # product is built to avoid.
        print(f"\n{len(failures)} provable question(s) whose key SymPy rejected:\n")
        for provider, payload, answer, computed in failures[:25]:
            print(f"  [{provider}] {payload!r}  key={answer!r}  sympy={computed!r}")
        if len(failures) > 25:
            print(f"  … and {len(failures) - 25} more")
    else:
        print("\nNo provable question had a key SymPy rejected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
