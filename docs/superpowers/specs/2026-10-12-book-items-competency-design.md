# Telling the model what the book supplies — design addendum

Status: approved 2026-10-12 ("Competency-mix fix first", then "do it"). Extends
`2026-10-12-book-items-live-path-design.md`, whose final review found the one
Important issue left open there.

## Problem

With `BOOK_ITEMS_LIVE=true` the model is asked for `count − k` questions and never
learns that `k` more are coming. The book's questions are all short-answer
`application` (3 marks) or multiple-choice `understanding` (2 marks), so on a
10-question basic paper the book adds ~12 marks of application and the model,
unaware, writes its own mix on top. Measured by the reviewer: application lands
near 45% of marks against a 20% target, a competency can end on one question
(validator warning «Competency … has only 1 question»), and the type spread the
prompt asks for ("spread the count across every listed type") is made against the
model's share only, so short-answer ends over-represented. Warnings never block
publishing, so this is a quality issue, not a failure.

## Decision

When `k > 0`, the prompt tells the model what is already on the paper and how many
of each competency and type to write so that the WHOLE paper lands on the
difficulty's competency targets. When `k = 0` the prompt is byte-identical to
today's.

- **What is supplied** is read off the same seeded dry run `planBookDraw` already
  does: the number of short-answer and multiple-choice book questions and their
  competencies (by kind, as `liveSlot`). It is approximate by nature: the real
  draw uses another seed and may differ by a question; the text says "about".
- **How many of each competency the model writes** is `allocateQuestions` run for
  the whole paper with the supplied questions already counted (new optional
  parameter `supplied`; with none, behaviour is unchanged for the mock path). It
  stays marks-greedy and keeps the two-per-competency floor, counting the
  supplied ones towards it.
- **Types:** the prompt says the supplied types count when spreading across types,
  so the model writes fewer of them. This restates rule 2 for the whole paper; it
  does not change the ordering rule (the route sorts the finished paper).
- **Provenance:** the prompt text differs only when `supplied` is present, so the
  base `GENERATION_PROMPT_VERSION` is left alone and a paper made with the
  supplied block is stamped `exam-gen-6+book` (a helper, used where the version
  is recorded). Flag-off papers keep `exam-gen-6`.
- The model is still never shown book stems, only counts. It can't reword them.

## Not decided here

Telling the model the supplied *topics* (so it avoids their subject matter): the
clash check already drops near-duplicates at draw time. Per-objective balance.
