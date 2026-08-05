# Math verifier — derivative vertical slice

SymPy microservice that **guarantees answer keys** for Grade 10 المشتقات before a teacher sees them.

## Two generation paths

1. **Template (no AI)** — `templates.py` / API `POST /generate/verified-derivative/template`  
   Parameterized `a·x^n`; answer from the power rule in code.
2. **AI + check** — LLM returns the JSON contract; SymPy re-diffs and checks equivalence.  
   Mismatch, bad distractors, or 2s timeout → discard and regenerate. Never return unverified.

## Verify core

- `expr_equiv` — fail-closed (`.equals()` → `None` ⇒ false)
- `check_distractors` — each distractor must be confirmed wrong + pairwise distinct
- `SOLVERS` topic registry — `verify_item(topic, …)`; add topics with one entry
- ProcessPool + terminate on timeout (2s) so workers are not orphaned
- Batch API returns `attempts_per_ai_item` / `avg_ai_attempts` (regen cost signal)

## Contract (latin `x` only)

```json
{
  "topic": "derivative_polynomial",
  "question": "3x^4 - 2x + 7",
  "answer": "12x^3 - 2",
  "distractors": [
    { "value": "3x^3", "misconception": "forgot to multiply by the power" }
  ]
}
```

Convert to `س` / Arabic numerals **only at display time**.

## Run the verifier

```bash
cd artifacts/math-verifier
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8090
```

Health: `GET http://127.0.0.1:8090/healthz`  
Verify: `POST /verify/derivative` `{ "question", "answer" }` → `{ verified, computed_answer }`

Set `MATH_VERIFIER_URL=http://127.0.0.1:8090` for the API server.

## Done criterion (20 items, zero wrong)

```bash
cd artifacts/math-verifier
python prove_slice.py
```

Generates 10 template + 10 AI+check items and asserts every key verifies. Offline AI uses a synthetic proposer (still SymPy-gated); with `OPENAI_API_KEY` it calls the real LLM.
