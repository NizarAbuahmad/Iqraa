# Send a worksheet to a class as a digital assignment

Step 4 of the worksheet design review (2026-10-08/09). Decisions taken with
Nizar in chat on 2026-10-09:

- **One objective for the whole sheet**, picked by the teacher when sending.
- **Auto-mark only what can be judged safely**: multiple choice, true/false, and
  short answers whose key is a plain number or `x = number`. Everything else is
  teacher-marked, never guessed.
- **Per-question book figures go to the student's screen** in the same change.

Scope: worksheets only (generated, or saved in موادي). Quizzes, homework, due
dates and editing a sent sheet are out.

## Why there is no shortcut

The exam system (`evaluations` + `evaluation_questions`, `take/[code]`) already
has student identity, attempts, marking, results and a marking screen. A
worksheet cannot be dropped into it as-is:

| Exam question needs | A worksheet question has |
| --- | --- |
| `objectiveId` + `competencyKey` (NOT NULL) | the lesson only |
| multiple choice answered by option **id**, ≥3 options | options as text, answer as text in a separate `answerKey` |
| `true_false` `{statement}` / `{value}` | «صح / خطأ» as a 2-option multiple choice |
| `fill_blank` `{template}` with `{{n}}` + accept lists | free text, answer `x = 3` |
| no image field | `figure` (teacher-attached, PR #960) |

So the work is a converter plus one route, not a new subsystem.

## Mapping the scope

A worksheet carries the KB lesson id (`scope.lesson.id`, saved as
`formState.lessonId`). That id **is** the curriculum lesson id: for
`kbl-math-s1-nccd-u3_l1`, `getObjectivesForUnit` returns `o-nccd-s1-u3_l1-0…3`
with `lessonId` equal to it and `bookId: 'book-math-10'` (checked 2026-10-09).
So the send sheet lists that lesson's objectives; the chosen one gives the
evaluation its `bookId`, `gradeId`, `subjectId` and `objectiveIds: [id]`.
`competencyKey` comes from the objective's `effectiveBloomsLevel` through the
existing `competencyForBlooms` — the same rule generation uses.

A worksheet with no resolvable lesson (a teacher's own document, an ungrounded
topic) cannot be sent; the button says why instead of guessing a lesson.

## Converting questions (server, pure, tested per rule)

`modules/assessment/fromWorksheet.ts`. Questions are flattened in paper order
and matched to `answerKey` by position, as every other worksheet consumer does.

1. **Options, and the key matches one of them, and ≥3 options** →
   `multiple_choice`, ids `a, b, c…`, `expectedAnswer.optionIds = [the match]`.
   Match after `stripOptionPrefix` + trim + Arabic normalisation.
2. **Exactly «صح / خطأ»** (or True / False), key is one of them →
   `true_false`, `statement` = the question text, `value` from the key.
3. **No options, key is a plain number or `<letter> = <number>`** (Latin or
   Arabic-Indic digits, optional sign/decimal), and the question is not
   half-solved → `fill_blank`, template = question text + «الإجابة: {{1}}»,
   accept = `[key, the bare number]`. Graded by the existing `answersMatch`
   (digit styles, spacing, minus signs).
4. **Everything else** — a key that matches no option, a 2-option non-T/F, a
   half-solved question, a word problem, any Arabic or expression answer →
   `short_answer`, `modelAnswer` = key (plus its working, if any),
   `keyConcepts = [key]`. Teacher-marked; nothing is guessed.
5. **A question with no key at all** blocks the send and names the question
   («السؤال ٤ بلا إجابة في المفتاح»). Inventing a key is the one thing worse than
   asking.

Marks = the question's `points`. `source: 'teacher'` (the teacher chose to send
this paper). `verification` is left empty: nothing here was checked by the
verifier, and `verified` must never be implied (CLAUDE.md).

The worked example is study material, not a question; evaluations have no
intro field, so it is **not sent**, and the send sheet says so. Live-AI and
bank questions convert the same way.

## Figures on the take screen

`body.figure = {uri, caption}` is accepted on every question type by the
registry's shared body check, **only for URIs under the book-figure base URL**
— a question body must not become a way to make students' phones load an
arbitrary image. `take/[code].tsx` shows it under the prompt; the existing
lesson-level «انظر الشكل» panel is skipped for a question that has its own.

## The route

`POST /evaluations/from-worksheet` (teacher roles, same middleware as the rest
of `/evaluations`):

```
{ worksheet: {title, sections, answerKey}, objectiveId, classGroupId, language }
```

- Checks the class belongs to the teacher (the check `PATCH /evaluations/:id`
  uses) and the objective exists.
- Converts, validates every question with the type registry, and inserts the
  evaluation (draft, `classGroupId` set, `generator: 'worksheet'`,
  `generationParams: {fromWorksheet: true, variantId?}`) and its questions in
  **one transaction** — no half-built draft on failure.
- Returns `{id, autoMarked, teacherMarked}`. Same 409 `no_level_scale` as
  `POST /evaluations`.

No schema change and no migration: everything rides existing jsonb columns.

## The app

- «أرسل للصف كواجب رقمي» on the worksheet screen's result actions and in
  موادي's worksheet viewer.
- A sheet: the teacher's classes (scoped to the worksheet's grade/subject when
  the class has one), the lesson's objectives (preselected when there is one),
  a line «٦ تُصحَّح تلقائيًا · ٤ يصحّحها المعلّم», and a note that the worked example
  is not sent.
- On success → `/evaluations/[id]`, the existing review-and-publish screen,
  which issues the class code.

## Testing

- Converter: one test per rule above, including the fail-closed ones (key
  matches no option → short answer; Arabic key → short answer; half-solved →
  short answer; no key → error), and every converted question passing the real
  type registry.
- Route: auth, foreign class refused, transaction (a bad question leaves no
  evaluation), counts returned — in the api-server suite.
- Figure: registry accepts a book-figure URI and refuses any other host.
- Driven in the web build: send a sheet, publish, take it as a student, see a
  multiple choice and a numeric answer auto-marked and a short answer waiting
  for the teacher.

## Not in this change

Quizzes (same converter, later), homework, due dates
(`evaluation_assignments` is unused), editing questions after sending, an AI
rubric for short answers, and the `math_equivalence` grading mode (unused by
the grader today).
