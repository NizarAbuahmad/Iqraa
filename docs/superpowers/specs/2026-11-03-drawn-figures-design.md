# Drawn figures in exams and student lessons — design

2026-11-03. Approach A, approved in chat (the model emits a typed figure spec; our code
validates and draws it). This file is the written form for review before the
implementation plan.

## Why

A teacher using the app reported (translated): *"There are no outright scientific errors,
but some lessons need a graph or a vector drawing, and the app puts none in the lesson or
the exam."*

They are right, and it is a gap in what we built, not a bug:

- **Exams.** An exam question can carry only a static book-figure URL a teacher attached
  (`body.figure`, `questionFigure.ts`). The exam generator cannot produce a drawing:
  rule 7 in `llmGenerator.ts` lets the model refer to the lesson's book figures *in
  general* and forbids naming one, and `FIGURE_RULE_AR/EN` (`lib/prompts.ts`) bans any
  question that points to a graph unless its text states the equations. So a question
  about a parabola or a vector is text only.
- **Student lessons.** The explanation cards (`lessonExplanationCards.ts`) draw words only.
  The 2026-10-31 log entry says so outright: «Students still see no drawing».

## Where we start (checked 2026-11-03)

- `services/deckVisuals.ts` already defines `VisualBlock` (`plot`, `chart`) as an **open
  union** — renderers must skip a kind they do not know — and holds a tiny expression
  compiler/sampler (`compileExpression`, radians, fails closed, `maxAbsY` drops
  asymptotes). Its header says new kinds must be additive. It is mobile-only today.
- `components/math/PlaneGrid.tsx` + `services/mathViewport.ts` draw a coordinate-plane
  backdrop with nice ticks and Arabic-Indic labels (`axisLabel`); the Math Corner grapher
  and sketchpad use them. Nothing connects them to a lesson or an exam.
- Slides draw cycle/tree/Venn/mind-map from one pure geometry module
  (`diagramGeometry.ts`) behind one gate (`resolveSlideLayout`). That is the pattern to
  copy: **spec → gate → pure geometry → renderer(s)**; a refusal falls back to words.
- The API has no copy of the sampler or any figure gate, and cannot import mobile code.
  Shared pure logic lives in `lib/*` packages (`lib/exam-paper`, `lib/math-verify`).
- Exams are Evaluations: teacher reads them at `app/evaluations/[id]/index.tsx:799`,
  the student sits them at `app/take/[code].tsx:838`; both render `QuestionFigure`. The
  student body is built by `studentView.ts`, which re-validates `figure` at the point
  every student-facing question passes (`studentFigure`).
- Evaluations have no PDF/HTML export in the app (the share is a link to `/take/CODE`);
  `exportText.ts` is text only.
- The `lesson-teaching` prompt version is already `2026-11-03.1`
  (`generationKey.ts`, bumped today for the linking fixes).
- Curriculum: Grade 10 maths covers vectors in coordinate form ⟨a, b⟩ (magnitude, sum,
  scalar multiples 2v, −0.5v, drawn on the coordinate plane — `g10_math_sem1/2` data);
  Grade 10 physics draws force/velocity vectors to a chosen scale.

## Scope of v1

**In:** Evaluations (teacher preview + student sitting) and the student lesson-explanation
cards; **maths only**; two figure kinds — `function-graph` and `vectors`.

**Out (next, separately):** quiz/worksheet/lesson-plan outputs and their PDF/Word exports;
slides reuse of the same spec; chemistry and physics-scale vector figures; geometry
figures (triangles, circles); number lines; vector addition drawn head-to-tail with a
computed resultant; the legacy book-figure path (untouched).

## 1. The figure: spec, gate, one shared package

A new workspace package **`lib/figure`** (`@workspace/figure`, same shape as
`lib/exam-paper`, own `node --test` suite) holds the pure parts so the API and the app
share one gate:

- `compileExpression` / `sampleExpression`, **moved** from `deckVisuals.ts` (which
  re-exports them, so slides code and its tests do not change).
- `resolveFigure(raw): Figure | null` — the gate. Never repairs; unknown or oversized
  input returns `null` and the caller shows words, exactly as `resolveSlideLayout` does.
- `figureAltText(figure, lang)` — a text alternative generated from the spec.

```ts
type Figure = FunctionGraph | Vectors;           // open: unknown kind → gate returns null

type FunctionGraph = {
  kind: 'function-graph';
  functions: { expr: string; label?: string }[]; // Latin, variable x
  x: [number, number];                           // domain shown
  y?: [number, number];                          // else fitted to the samples
  points?: { at: number; label: string; on?: number }[]; // x only; y is computed
};

type Vectors = {
  kind: 'vectors';
  vectors: { from: [number, number]; to: [number, number]; label?: string }[];
  components?: boolean;                          // dashed horizontal/vertical projections
};
```

### Gate limits (refuse the whole figure otherwise)

| Kind | Limits |
|---|---|
| `function-graph` | 1–3 functions; `expr` ≤ 60 chars and accepted by `compileExpression`; finite at ≥ 80% of 200 samples across `x` (so a function that is nothing but gaps is refused); `x` increasing, width 0.5–40, within ±50; no sample beyond 1e9 in magnitude; no repeated `expr`; `y`, if given, increasing and 0.1–200 tall; ≤ 4 `points`, each `at` inside `x`, with `f(at)` finite (a marked point on a gap, or outside a given `y`, is refused, not moved), `on` an existing function index (default 0) |
| `vectors` | 1–5 vectors; each coordinate a multiple of 0.5 with \|coord\| ≤ 12 (stored rounded to half-units); non-zero length; labels distinct; no repeated vector (same `from` and `to`; a vector and its reverse are different) |
| labels (both) | 1–3 letters (Latin or Arabic; tatweel U+0640 is not a letter here), optionally followed by one digit and/or a prime — **never** `=`, brackets, or a number on its own, and never a number word («six», «ten», «ستة», «عشر»…: a short deny-list in `gate.ts`) |
| both | the serialised spec ≤ 1.5 KB |

The label rule is the answer-leak guard, by construction: a question that asks for a
vertex or a magnitude cannot have the answer written beside the point, because a label
cannot hold a value. Axis ticks still show the scale, which a student can always read.

### Honest scale

`vectors` draws with **equal scale on both axes** (a vector's direction is the point), a
grid, and axes through the origin when the origin is in view; the viewport is fitted to
the vectors plus the origin with at least 4 units on a side. `function-graph` may use
unequal scales. A `tan`-style spike is dropped at the asymptote by `maxAbsY`, as on slides.

## 2. Geometry and rendering

- `figureGeometry.ts` (in `lib/figure`, pure): spec + box → primitives (polylines for
  curves, line + arrowhead polygon for a vector, circles for marked points, text anchors
  for labels and axis names). Viewport maths comes from `mathViewport` rules (ticks,
  nice steps); if `mathViewport.ts` is not importable by the API, the needed functions
  move into the package and the app re-exports them (decided in the plan).
- `components/ui/FigureView.tsx`: draws the primitives with react-native-svg, reusing
  `PlaneGrid` for the backdrop so a figure matches the grapher. Colours from
  `useColors()` only (never `palette`); the 3 curve colours are drawn from a set that
  keeps 3:1 against the card in light and dark, and **colour is never the only cue** —
  each curve and vector carries its letter. Axis names: «س»/«ص» in Arabic, x/y in English
  (maths stays Latin internally, converted only at display). Tick digits through
  `axisLabel` (Arabic-Indic); text that mixes digits and operators goes through
  `forceLtr`/`displayLtr` (CLAUDE.md, bidi trap). The plane is **not mirrored** in RTL: x
  grows to the right in both languages, as in the book.
- The component sets `accessibilityLabel` from `figureAltText` and is non-interactive in
  v1 (no pan/zoom, no tap to enlarge).
- One renderer in v1. The PDF/PPTX renderers the slides have are not needed by any v1
  surface; because the geometry is pure, a later HTML/PPTX renderer is additive.
- Not added under any corner directory; no native module (react-native-svg is already
  installed), so **`app.json` `version` does not change** and the change ships over the air.

## 3. Exams

### Generation (`modules/assessment/llmGenerator.ts`)

- The reply schema gains an optional question-level `"visual"` (sibling of `"check"`),
  offered **only on a maths paper**. `parseGeneratedQuestions` runs `resolveFigure`; an
  accepted figure is stored as `body.visual` (normalised), a refused one is dropped and
  the question is kept. Refusals are counted with reasons in the generation notes.
- Prompt: rule 7 keeps its ban on naming a *book* figure. A new rule says a question may
  carry **one** `visual`, and that **the stem must state everything the question needs**
  (the function, the vector components) — the drawing illustrates, it is never the only
  carrier of information. Because the model knows exactly what its own drawing shows, the
  stem may then say «في الرسم المرافق». `FIGURE_RULE_AR/EN` in `prompts.ts` (the deck/
  worksheet path) is unchanged in v1.
- The rule that the stem is self-sufficient is what keeps the answer key checkable: the
  key still comes from the stem's maths and the existing `check` (SymPy). A drawing adds
  no new claim that needs verifying.
- **Tie to `check`.** When a `check` exists and its `question` compiles with
  `compileExpression`, a `function-graph` whose functions all differ from it (compared at
  24 sample points, relative tolerance 1e-6) is dropped — the picture would show a
  different function from the one checked. If `check.question` does not compile (an
  equation, a system) the figure is kept unchecked. This is a narrow guard, not a proof;
  the spec does not claim it verifies a drawing.
- **No badge.** A drawing never wears «تم التحقق». `verified` keeps meaning only "the
  verifier confirmed the key".

### Storage and student view

- `body.visual` is stored with the question (like `body.figure`). A new
  `modules/assessment/questionVisual.ts` next to `questionFigure.ts` exposes
  `studentVisual(body)`, which **re-runs `resolveFigure`** and is called from
  `studentView.ts` outside every type's allowlist, exactly where `studentFigure` is. A
  stored object that no longer passes the gate (a limit tightened later, a hand-edited
  row) is simply not sent.
- **Editing drops the drawing.** If a teacher edits a question's text or key, its
  `body.visual` is removed — the same precedent as a worksheet's working
  (`worksheetEdits.ts`): a drawing that may no longer match is worse than none. The plan
  locates the edit route and does this server-side so no other client can bypass it.
- Question reorder/duplication copies the visual with the body; nothing else reads it.

### Screens

- `QuestionVisual` (a thin wrapper over `FigureView`) is rendered beside `QuestionFigure`
  at the two sites above. A question that has a drawn visual is not also given the
  lesson's book-figure hint (`questionRefersToFigure` reads «الرسم» in the stem; the plan
  makes it skip when `body.visual` is present).
- The teacher sees the same drawing the class will see, before publishing.

## 4. Student lessons

- `LessonTeachingOutput.concepts[]` and `workedExample` gain an optional `visual`
  (the same `Figure`). The `lesson-teaching` prompt gets a rule (maths lessons only, ≤ 2
  per section, same self-sufficiency rule: the words state the function or components).
- `usableTeaching` runs `resolveFigure`; a refused figure is dropped alone and the
  concept keeps its points, as with `shape`/`chart`.
- `buildExplanationCards`: a `concept` and an `example` card gain `visual?: Figure`,
  passed through only if the gate accepts it (the card builder stays pure and loadable
  under bare `node --test`). `app/curriculum/lesson-explanation.tsx` draws `FigureView`
  above the points/steps.
- **Pool.** `PROMPT_VERSION_BY_KIND['lesson-teaching']` moves to a new value
  (`2026-11-03.1` is today's; the plan picks the next). Consequence, to be stated in the
  PR: every lesson's first teacher after the merge pays for a new teaching section, and
  new sections need approving as before. Student explanations already approved are read
  by lesson and language, not by this key, so they keep being served — **without** a
  drawing, until regenerated and approved. `pregenerate.ts` is re-run to fill ahead of
  teachers (cost noted in the PR).
- **Review hole to close first.** Students see only what an admin approved. The plan's
  first task is to find how an admin reads an explanation before approving
  (`routes/moderation.ts`); if that view cannot show the drawing, approval would cover a
  picture nobody looked at, which is the same class of hole as the one that closed on
  2026-10-13. The review view must draw it, or the drawing is withheld from students
  until it does.

## 5. Trust rules (the short version)

1. The model never draws pixels; it proposes data and **our code** draws it.
2. Fail closed: any refusal leaves the question or card as words, never a half-drawing.
3. A label cannot carry a value; the drawing cannot leak a key.
4. A drawing is never badged «verified»; the key's verification is unchanged.
5. The words are always sufficient to answer; the drawing illustrates.
6. The student path re-validates what it sends (exams: server; cards: the card builder,
   on content an admin has approved).
7. Editing a question removes its drawing.

## 6. Delivery: three PRs

1. **`lib/figure` + `FigureView`** — package, gate, geometry, sampler move, component,
   tests; a dev-only fixture page is not shipped. No behaviour change anywhere.
2. **Exams** — generator schema/prompt, `questionVisual.ts`, `studentView.ts`, edit rule,
   the two screens, «ما الجديد» entry. This is the first user-visible change; the entry is
   dated the day it merges (CLAUDE.md), role `teacher`, route the evaluations list.
3. **Student lessons** — types, prompt rule, `usableTeaching`, cards, screen, admin
   review, prompt-version bump; its own «ما الجديد» entry (student role; or the PR body
   says why none).

PR 1 is safe to revert by itself; PRs 2 and 3 are code-only (no migration: `body` is
JSON, `ai_artifacts` stores JSON), so both revert by reverting the commit.

## 7. Verification

- **Package tests:** every gate row accepted and refused (including the label rule, a
  point on a gap, a flat-gap function, a zero-length vector, the 1.5 KB cap); geometry
  inside the box; equal scale for vectors; `tan` asymptote; the sampler's existing tests
  carried over unchanged.
- **API tests:** `parseGeneratedQuestions` keeps the question and drops a bad visual;
  the `check` tie (differs → dropped, doesn't compile → kept); `studentView` strips an
  over-limit or unknown-kind visual; the edit route removes it; prompt-pin tests in both
  languages (rule text present on a maths paper, absent otherwise); the existing
  rule 7 pins still pass.
- **Mobile tests:** `buildExplanationCards` passes an accepted visual, drops a refused
  one, leaves a card with none unchanged; `questionRefersToFigure` skip; `usableTeaching`.
- **On screen:** Playwright against the built web bundle, a fixture evaluation and a
  fixture explanation, phone and desktop widths, Arabic RTL and English, light and dark,
  screenshots read by eye (labels not clipped, digits not scrambled, arrows pointing the
  right way, curves not flattened).
- **Whole suite:** `pnpm run typecheck`, api-server `pnpm build && pnpm test`, mobile
  `pnpm test`, plus the new package's `test`.
- Before handing back any regenerated paper, read the new questions and check each key
  (CLAUDE.md).

**Not verifiable here:** how a live model fills `visual` in practice (the session's key
cannot call a model), so the first live run is the real test of the prompt — the
generation notes' refusal counts are how we will see it; native devices.

## 8. Decisions to confirm when you review

1. **"Exam" means Evaluations** (the shareable exam and the student sitting). The quiz and
   worksheet tools and their exports are not in v1. Say so if you meant them.
2. **Editing a question removes its drawing** rather than keeping a possibly wrong one.
3. **Vectors are drawn from coordinates only** (what the books show: ⟨a, b⟩, 2v, −0.5v).
   A head-to-tail sum with a computed resultant, and physics vectors drawn to scale in
   cm : N, are the next kind.
4. **A new package** (`lib/figure`) rather than duplicating the sampler in the API.
5. Students keep seeing the 55 approved explanations without drawings until a
   regenerated one is approved — no student-visible drawing arrives on merge day.
