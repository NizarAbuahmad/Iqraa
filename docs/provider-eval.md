# Choosing the model

Which model this product should use is one question with three answers,
because the jobs differ:

| Job | Volume | Latency | What decides it |
| --- | --- | --- | --- |
| Prep generation (`/generate/*`) | Low — a few per teacher per day | Tolerant; the teacher is prepping | Arabic quality, curriculum fidelity, schema conformance |
| Chat (`/chat`) | High — many turns per session | Sensitive; it is a chat | Fluency, grounding, speed, cost per turn |
| Quick Check items | Low | Tolerant | Maths correctness — the one thing that can be verified |

Today one `AI_MODEL` env var covers all three. Splitting it into
`AI_MODEL_GENERATE` / `AI_MODEL_CHAT` should happen before the choice is
made, so what gets measured is what gets shipped.

## Running the evaluation

**Settings → Secrets and variables → Actions**, add any of:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`

Any provider whose key is absent is skipped, so one key is enough to start.

Then **Actions → Provider evaluation → Run workflow**. It is manual-only: it
spends real money, so it never fires on a push, a pull request or a schedule.
The inputs let you pin a model or an effort level; blank means the harness
default.

A full run is 4 lessons × 3 tasks × N providers — 12 generations per
provider, comfortably under $2 even at the top of the range. Cost is not a
reason to cut the eval short.

## Reading the result

The run summary carries two tables, and the artifact carries everything.

**Objective — automated.**

- `parsed` — was the response JSON at all.
- `complete` — did it contain the fields the app actually reads. These are
  different questions: a model can return well-formed JSON the app renders as
  an empty lesson plan.
- Median latency, tokens, estimated cost.
- **Symbolic scoring** — every generated maths answer key through the same
  classifier the app uses and then through SymPy. Read it as a floor, not a
  grade: only derivatives and single-unknown equations are provable, so
  trigonometry and word problems are excluded rather than counted wrong. A
  model is not worse for writing a good trigonometry question.

**Subjective — yours, and blind.**

Outputs are written to `raw/` under anonymised ids (`s001.json`), with the
mapping held back in `key.json`. **Rate before opening `key.json`.** A model
that reads better because you knew which one it was is not evidence.

Suggested rubric, 1–5 per output:

1. Arabic naturalness — does it read as a Jordanian teacher wrote it?
2. Curriculum fidelity — NCCD scope, notation, terminology.
3. Pedagogical usefulness — would this help a real lesson?
4. Would you hand it to a class unedited?

**Write the decision rule down before you look.** Something like: *take the
cheaper model unless the stronger one wins by ≥1 point on curriculum fidelity
or ≥15 points on symbolic pass rate.* Agreeing the rule in advance is what
stops the numbers being rationalised afterwards.

## What the harness will not tell you

It measures one shot per lesson per task. It does not measure consistency
across repeated runs, behaviour on long chat histories, or how any model
handles the retrieval grounding the chat path adds. Those need their own
passes if the first result is close.
