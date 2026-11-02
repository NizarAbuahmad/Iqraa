# Lesson explanations: the math verifier checks the arithmetic — design

2026-11-02. Written after the work was approved in chat ("go, do the verifier check")
and built test-first; this is the record of what was decided and why.

## Problem

Student lesson explanations (`lesson-teaching`, grade 10 maths and chemistry) are
generated ahead of time, pooled, read by a person, and only then approved for
students. The first two prefill runs (2026-11-01 and 2026-11-02, 50 + 37 explanations)
were read line by line, every number recomputed:

| Run | Prompt | Rejected |
|---|---|---|
| 1 | `2026-10-31.1` | 20 of 50 |
| 2 | `2026-11-01.1` (an accuracy rule: substitute every answer back) | 12 of 37 |

The rule helped the *ideas* and not the *arithmetic*. What was left was a wrong final
number or a wrong substitution: 5 cm for 10/√3 ≈ 5.77, a grouped mean of 4.8 for 5.2, a
median of 20 for 20.9, (9, 63) for (9, 135), (1, 0) and (3, 2) for a system they do not
solve. The same lessons failed in both runs. A language model does not reliably compute;
the repo already has a service that does.

## Decision

Reuse the exam-question path (`modules/assessment/keyVerification.ts`): the model
attaches a Latin `check` — `{ topic, question, answer }` — to the worked example and to
the practice; the math verifier (SymPy) solves `question` and compares it with `answer`.

- **Two new verifier topics**, because the failing families had none:
  - `evaluate` — a closed expression (degrees as `30°`), compared with the key as it
    is written: rounded or truncated to the places the key has, but a whole-number key
    is a rounding only (`5` is not `5.77`, `20` is not `20.93`); or compared exactly
    (`10*sqrt(3)/3`). A unit left on the key is `error`, not a wrong key.
  - `system_solutions` — `eq1; eq2` in x and y, compared as a set of points.
- **The check only counts if the prose states it** (`statesAnswer`, exported from
  `keyLinking.ts`). A verifier agreeing with a second copy of the key proves nothing
  about the first. A prose answer that differs from the model's own check is
  `unlinked` and treated like a contradiction.
- **One retry.** A contradicted or unlinked item asks the model once more with what the
  verifier computed and what was written. The attempt with fewer problems is kept (the
  second on a tie) and carries its verdicts. The discarded attempt is billed.
- **Nothing is deleted and nothing is auto-approved.** `content.verification` records
  `verified | contradicted | unlinked | undecided | unreachable | no_check` per item.
  `pregenerate.ts` shows it beside the text in the review file, hashes it (deleting it
  from the file is an edit), and `--approve` refuses a contradicted entry. `unlinked`
  and `undecided` are the reviewer's call.
- **Students never see it.** `check` and `verification` join `teacherNote` and `mistake`
  in the keys stripped from what a student reads.
- **Cannot tell is not wrong.** `indeterminate`, `error`, `unsupported_topic` are
  `undecided`; an unreachable verifier stops the pass and changes nothing.

## What it does not do

It checks arithmetic, not whether the question asked is the question the lesson meant.
A model that sets a problem up wrongly and then computes its wrong setup correctly
passes. Of the 12 rejects in run 2, about five were of the kind it catches (two
systems, the law of sines, the grouped mean, the ogive median); the others were false
or loose statements («a sector lies between two arcs», a quadrant rule without its
sign condition, a lab that uses derivatives early) that no calculation sees. A person
still reads every explanation.

## Verification

- Verifier: 35 new cases in `test_equations.py` (124 in all), every wrong key above
  among them.
- API: `lessonTeachingChecks.test.ts` (24), prompt pins in both languages, student
  stripping, pool version.
- The real verifier, started locally, and the real client, against the actual wrong and
  right answers from both reviews: all wrong ones `contradicted`, all right ones
  `verified`, a prose answer different from its check `unlinked`.
- **Not tested:** how often a live model writes a usable `check`, and how often a retry
  fixes what the verifier found. Only the next prefill and a third review can say.
