# Real book items for evaluations, quizzes and exams — design

Status: approved in discussion 2026-10-12, awaiting spec review. Nothing is built.

## Problem

The ministry's Grade 10 maths exercise books and teacher guides print real
exercises, unit tests and an answer appendix. None of that reaches a generated
paper. The question bank (`lib/math-practice`) is template-generated: 93 maths
items in 14 families, none derived from the books. The exercise books are
registered and their page text is extracted, but only as grounding passages and
as a page/count index (`knowledge-base/grade-10-math/exercises/*/index.json`,
used for «تمارين ص ٧٢» references). The evaluation generator
(`artifacts/api-server/src/modules/assessment/mockGenerator.ts`) only lists which
exam and question-bank files exist for a unit; its own comment says "nothing has
been extracted from those documents".

Facts established while designing this (2026-10-11/12):

- **Exercise-book answers are partly in the guide.** The teacher guides' «ملحق
  الإجابات» has «إجابات أسئلة كتاب التمارين» sections, but they answer only some
  exercises per lesson. Unit tests («اختبار نهاية الوحدة») are real
  multiple choice with printed answers.
- **The text layer is usable for Latin maths, not for Arabic.** Exponents are
  flattened (`24x3 + 18x2 = 0` means 24x³ + 18x²) and fractions break across
  lines (`x = 1⏎3` means x = 1/3). Arabic instructions carry scrambled
  diacritics.
- **The PDFs are not reachable from a fresh sandbox** (gitignored, R2 only), so
  a stem cannot be checked against a page image there. The pipeline runs on
  committed files alone.
- **The verifier's topics are narrow:** derivatives, circle centre/radius, and
  linear/quadratic/exponential equations (`VERIFIABLE_TOPICS` in
  `lib/math-verify/src/answerKey.ts`). Higher-degree equations, systems and
  trigonometry are outside it today.
- **The math teacher guides are NCCD** (`authority: nccd`), so their content is
  quotable. The teacher-made exams and question banks are `reference-only` and
  are out of scope.

## Decisions

| Question | Decision |
| --- | --- |
| First slice | Grade 10 maths, symbolic items only (stems that are pure Latin maths). |
| Sources | The NCCD Grade 10 maths exercise books and teacher guides, both semesters: `math-s1-exercise-book`, `math-s2-exercise-book`, `math-s1-teacher-guide`, `math-s2-teacher-guide`. |
| Consumers | Evaluations, quizzes and exams. Worksheets, homework and decks keep the generated bank. |
| Store | Committed JSON, `lib/curriculum/src/data/book-items/<sourceId>.json`. No schema change, no migration. |
| Trust | Four explicit states; `verified` only when the verifier agrees with the book. |
| Out of scope | Arabic word problems, figure-based items, chemistry, the live-AI prompts, teacher-made exams/banks. |

Approaches considered: a database table with an import job (rejected: a
migration and seed step for content that never changes at runtime; the JSON can
be loaded into a table later without changing its shape), and runtime retrieval
with a model parsing page text (rejected: needs live AI, nothing verified, the
"looks real but unchecked" failure CLAUDE.md warns about).

## Design

### 1. Data shape and trust rules

One record per item:

| Field | Meaning |
| --- | --- |
| `id` | `bi-<sourceId>-u<unit>l<lesson>-<n>`, stable |
| `lessonId` | curriculum lesson id, via the existing exercise-book unit/lesson join (`bookExercises.ts`) |
| `source` | `{ sourceId, page, number }`, for a citation like «كتاب التمارين ص ٧٢، س ١١» |
| `kind` | `exercise` or `unit-test-mcq` |
| `instruction` | our own clean Arabic template, never the scrambled book line |
| `stem` | the Latin maths as printed, normalised |
| `options` | unit-test multiple choice only |
| `printedAnswer` | from the guide's answer appendix, when present and cleanly readable |
| `computedAnswer` | SymPy's answer for the stem |
| `check` | an `AnswerKeyCheck` when the verifier can judge the item |
| `tier`, `tierSource` | `easy`/`medium`/`hard`, with `tierSource: "position"` (see below) |
| `status` | one of the four states below |
| `verificationSource` | how the key was established |

Four states:

| State | Rule | Served? |
| --- | --- | --- |
| `verified` | printed answer and SymPy agree (`verificationSource: "sympy+book"`) | yes |
| `computed` | no printed answer; SymPy solved the stem on its own (`"sympy"`) | yes, labelled «الحل محسوب من نص السؤال»; never shown as verified |
| `book-key` | printed answer exists but the verifier cannot judge the item (`"book"`) | yes, labelled «من دليل المعلم» |
| `quarantined` | printed and SymPy answers disagree, or the stem/answer cannot be parsed cleanly | no; listed in the extraction report with the reason |

`computed` exists so that `verified` keeps CLAUDE.md's meaning ("the verifier
confirmed it; never from a code-computed fallback"). It is a separate label,
not a softer `verified`.

Difficulty is not tagged in the books. For exercises, tier is derived from the
item's position in its lesson (first third easy, middle third medium, last
third hard), recorded as `tierSource: "position"` and never presented as
authored. Unit-test multiple choice is `medium`.

### 2. Extraction pipeline

One script, `scripts/extract_book_items.py`. It reads only committed files — the
extracted page JSON in `lib/curriculum/src/data/extracted/` and the exercise
index — and imports SymPy through `artifacts/math-verifier/verify_core.py`.

1. **Locate.** Use the exercise index (page, unit, lesson) to cut each
   exercise-book page into numbered items.
2. **Classify per lesson from a small hand-written table** (about 32 rows):
   instruction template and verifier topic per lesson. The scrambled Arabic
   instruction line is not parsed.
3. **Normalise the stem** by fixed rules: letter followed by digits is an
   exponent; Unicode minus variants unified; `×`, `÷`, `√` handled. A stem with
   Arabic residue, a line-broken fraction, or an ambiguous construct such as
   `(x+1)2` is quarantined with a reason. Nothing is guessed.
4. **Solve** with SymPy for `computedAnswer`.
5. **Read the printed answer** from the guide appendix by lesson and number,
   only when it is plain Latin with no broken fraction; compare with SymPy and
   assign the state.
6. **Write** `book-items/<sourceId>.json` and a report: counts per state, and
   every quarantined item with its reason.

Unit-test multiple choice runs the same steps with `options` kept and the
printed answer as the key; options that do not parse cleanly quarantine the item.

Known limits: the first pass will quarantine a real share of items (anything with
fractions, mostly) and the report will say how many rather than the rules being
loosened; and no stem has been checked against a page image, so a sample review
by a person is part of the ship gate below.

### 3. Generator integration

Objectives carry `lessonId` and the mobile quiz path holds the lesson (`kb`), so
book items join by lesson id, never by title (see the lesson-title trap in
CLAUDE.md).

- **Shared reader:** `lib/curriculum/src/bookItems.ts`, exposed as a subpath
  export and not from `index.ts`. `bookItemsForLesson(lessonId)` and
  `takeBookItem({ lessonId, tier, session })`. It returns only served states.
  A single constant lists the served states, so narrowing to `verified` only is a
  one-line change.
- **Evaluations** (`mockGenerator.ts`): before `bankMultipleChoice`, try a book
  item for the objective's lesson. Exercise items become `short_answer` with
  `expectedAnswer` and a `check`, so the existing verification pass runs.
  Unit-test multiple choice becomes `multiple_choice` with `optionIds` and
  self-marks.
- **Mobile offline quiz/exam** (`artifacts/mobile/services/ai/generators.ts`):
  `tryMathPractice` tries `takeBookItem` first and adapts to the existing `WQ`
  shape with bank-style provenance.
- **Live-AI path: unchanged.** The model writes its own questions, so a live
  paper contains no book items. This is a known difference between paths and is
  recorded in CLAUDE.md ("an activity format lives in two places" family of
  notes) and STATUS.md.
- **Mixing:** book items fill at most half of a paper; the generated bank fills
  the rest. Book items share the request's `session` set with the generated bank
  so a paper never repeats an item.
- **Teacher-facing:** a citation on every book item; the state label for
  `computed` and `book-key`; none for `verified`. Students never receive the key
  or the label — `sanitizeForStudent` stays the only student projection.

### 4. Testing and rollout

Python (the existing sympy CI job in `ci.yml`, one extra step):

- normalisation, table-driven (exponent flattening, minus variants, rejection of
  Arabic residue, line-broken fractions and `(x+1)2`);
- state truth table: agree → `verified`, disagree → `quarantined`, no printed
  answer → `computed`, unsupported topic with printed answer → `book-key`;
- golden cases from real committed pages (S1 page 10 exercises 1–3, one system
  from page 11);
- mutation guard: corrupting one printed answer in a fixture lands it in
  `quarantined` (pins "never verified from a fallback");
- determinism: two runs produce byte-identical JSON.

TypeScript, inside the existing globs:

- `lib/curriculum/src/__tests__/bookItems.test.ts`: every `lessonId` exists in
  the KB; `source.page`/`number` agree with the exercise index; every stem passes
  `isLatinMath`; no `verified` without `printedAnswer`; ids unique; source passes
  `assertQuotable`; minimum counts per state so a regression that quarantines
  everything fails.
- Reader: `quarantined` never served; session dedupe; the half-paper cap.
- Assessment generator: cited book questions for a lesson with items; unit-test
  multiple choice self-marks with the right `optionIds`; `sanitizeForStudent`
  strips key and label; a lesson without items behaves exactly as before;
  chemistry untouched.
- Mobile adapter test under `services/__tests__` (no React Native imports).

Rollout:

- One branch and draft PR, three commits: store + extractor, assessment seam,
  mobile seam.
- No schema change, no native module: no migration, no `app.json` `version`
  bump; the mobile change ships as a normal OTA. Because `lib/` changes, the
  merge also redeploys the API.
- Ship gate: the PR body lists counts per state, every quarantined item with its
  reason, and a random sample of 30 items for comparison against the printed
  pages. Only `main` deploys, so the merge is the gate.
- Docs in the same PR: STATUS.md, and the CLAUDE.md note about the live-AI path.

## Not decided here

- Whether to widen the verifier's topics (cubics, systems, trigonometry) so more
  items move from `computed`/`book-key` to `verified`. That is a verifier change
  with its own tests; this slice works with the topics that exist.
- Later slices, in rough order: Arabic word problems (needs page-image reading),
  chemistry (its teacher guides have no extracted text yet), the live-AI path.
