# Drawn physics figures in quizzes and worksheets — design

2026-11-13. Approved section by section in chat. Sub-project 2 of three that answer a Grade 10
physics teacher's review of the generated material (sub-project 1, «Science lessons cover every
key term of the book», is NizarAbuahmad/Iqraa#1422; sub-project 3 is explanations for book-figure
slides).

## Why

The reviewer asked for a drawing on 13 cells of their sheet («ضرورة إرفاق الشكل»):

| Where | Cells | Lessons |
|---|---|---|
| Quiz (اختبار قصير) | 7 | u2_l2, u2_l3, u4_l1, u4_l3, u5_l1, u6_l1, u6_l2 |
| Worksheet | 4 | u2_l2, u2_l3, u6_l1, u6_l2 |
| Slides | 2 | u1_l1 (vectors), u4_l1 (force directions) |

This spec covers the quiz and the worksheet (and homework, which is the worksheet generator).
Slides are a later sub-project.

## Where we start (checked 2026-11-13)

- `lib/figure` (`@workspace/figure`, 2026-11-03) is the drawn-figure package: the model proposes a
  typed spec, `resolveFigure` gates it (never repairs; refuses the whole figure), `layoutFigure`
  lays it out, `figureSvg` (`svg.ts`) draws an SVG string and `FigureView` (react-native-svg)
  draws it in the app. Two kinds only, both on a coordinate plane: `function-graph` and `vectors`.
  Labels are 1–3 letters (Latin or Arabic) plus an optional digit/prime, never a number — the
  answer-leak guard.
- Figures appear today only in Evaluations (teacher preview, student sitting) and student lesson
  cards, maths only. The AI-tools quiz and worksheet have no generated-figure field; their
  `figure` field is the BOOK crop a teacher attaches by hand (`QuestionFigure`).
- The quiz and worksheet generators never receive the figure prompt block
  (`figureFormatAr/En`, `artifacts/api-server/src/lib/figurePrompt.ts`).
- Every generated quiz/worksheet/homework passes `assertUsableGeneration` and
  `sanitizeWorksheetExtras` (`routes/generate.ts`, ~l.282) before it is pooled or served.
- Exports: `services/exportHtml.ts` builds the quiz and worksheet HTML/PDF and their class-mode
  slide versions (`buildQuizHTML`, `buildWorksheetHTML`, `buildQuizSlidesHTML`,
  `buildWorksheetSlidesHTML`; book crops via `questionFigureHTML`). Word: `quizDocx.ts`,
  `docxBuild.ts` — no figures at all today.
- Known `figureSvg` limit: its clip id is per size (`fig-clip-${w}x${h}`, `svg.ts:33`), so two
  same-size figures on one page share it.
- No live model has ever written a drawing (STATUS.md, 2026-11-03).

## Decisions (made in chat)

1. First target: quiz + worksheet/homework. Slides later.
2. Kinds: force diagram, two-body attraction, projectile path, circular motion, wave; the
   existing `vectors` kind is opened to physics.
3. Outputs: on screen and in the HTML/PDF exports now; Word next (its own PR, which would also
   carry book crops).
4. Approach A: the model proposes a spec per question, our code validates and draws it. No
   per-lesson fixed figure.
5. Work goes on new branches from main, one draft PR per part.

## 1. The figure kinds (`lib/figure`)

```ts
type PhysicsValue = { n: number; unit: string };   // a given shown on the drawing, e.g. 20 m/s

type Forces = {
  kind: 'forces';
  body: 'block' | 'point';
  incline?: number;                                   // degrees, 5–60: a block on a slope
  arrows: { dir: number; size: 1 | 2 | 3; label: string; value?: PhysicsValue }[]; // 1–5
};

type Attraction = {
  kind: 'attraction';
  bodies: [string, string];                           // labels, e.g. ["m1", "m2"]
  force: string;                                      // arrow label, e.g. "F"
  distance?: { label: string; value?: PhysicsValue };
};

type Projectile = {
  kind: 'projectile';
  launch: 'ground' | 'horizontal';                    // ground: at an angle; horizontal: off a height
  angle?: number;                                     // degrees 10–80, ground launch only
  speed?: PhysicsValue;                               // v0 shown with its value when given
  height?: PhysicsValue;                              // horizontal launch only
  marks: ('v0' | 'vx' | 'vy' | 'H' | 'R')[];          // what to mark; H/R never carry a value
};

type Circular = {
  kind: 'circular';
  radius?: { label: string; value?: PhysicsValue };
  turning: 'cw' | 'ccw';
  arrows: ('v' | 'F' | 'a')[];                        // v tangent; F or a toward the centre
};

type Wave = {
  kind: 'wave';
  cycles: 1 | 2 | 3;
  marks: ('crest' | 'trough' | 'A' | 'lambda')[];
  second?: { phase: 'in' | 'out'; sum: boolean };     // superposition
  amplitude?: PhysicsValue;
  wavelength?: PhysicsValue;
};

type Figure = FunctionGraph | VectorsFigure | Forces | Attraction | Projectile | Circular | Wave;
```

### Gate (in `resolveFigure`, refusing the whole figure on any breach)

- Every enum and range above; arrows 1–5; no two arrows with the same label; directions 0–359.
- Labels: the existing rule plus Greek letters (λ θ α β ω Δ μ), still 1–3 letters + optional
  digit/prime, still never a number or number word.
- A `PhysicsValue`: `n` finite, |n| ≤ 10⁶, at most 3 decimals; `unit` from this fixed
  allow-list, kept in `gate.ts`: `m`, `cm`, `km`, `s`, `m/s`, `km/h`, `m/s²`, `N`, `kg`, `g`,
  `°`, `Hz`, `J`, `W`, `Pa`, `N/m²`, `kg/m³`, `g/cm³`, `m³`, `cm³`. A unit outside it refuses the
  figure. The unit is printed as written, in Latin, as the book does.
- `H` and `R` in a projectile's `marks` are symbol-only (they are what the questions ask for).
- Serialised spec ≤ 1.5 KB, as today.

### "Every number on the drawing is in the question"

`figureNumbers(figure): number[]` lists every number the drawing prints (values and angles).
`figureNumbersInText(figure, text): boolean` is true only if each appears in the question text,
after folding Arabic-Indic digits (٠–٩) to Latin and «٫» / «،» decimal marks to «.», comparing
numerically (20 = 20.0). The figure package cannot see the question, so the CALLER runs it (the
server, section 2). This is what lets a physics drawing show the givens while it still cannot
show an answer.

### Drawing

These kinds are not plotted on a coordinate plane, so a new primitive layer is added beside
the plane one: `layoutScene(figure, box)` → `{ lines, arrows, polylines, circles, rects (with
rotation), dashes, labels }` in pixels. `figureSvg` and `FigureView` each gain a scene renderer;
the plane kinds keep their path unchanged. Physical correctness the renderer guarantees: a
projectile's curve is the real parabola for its angle (shape only; not to the speed's scale);
arrow directions are the stated degrees; an incline is drawn at its angle with the weight
straight down; a wave's λ mark spans exactly one cycle; out-of-phase second wave is a true
half-cycle shift and the sum is the computed sum. Numbers and units on a drawing are Latin, as
`figureSvg` already prints, so no bidi reordering applies inside the SVG. `figureAltText` gains
a sentence per kind (Arabic and English).

The clip-id collision is fixed here: `figureSvg` takes (or generates) a unique id per call.

## 2. Generation and server checks

- **Offered only for physics.** A quiz, worksheet or homework request whose `subject` is Physics
  (the lesson's own subject name as screens send it; `isPhysicsSubject` beside
  `isMathContext`). Every other subject's prompt is byte-for-byte unchanged.
- **Prompt block** `physicsFigureFormatAr/En` (in `figurePrompt.ts`): the six kinds, one JSON
  example and the limits for each, and the rules: a question MAY carry one optional `visual`;
  only where a drawing helps (forces, a projectile, circular motion, a wave, vectors); the
  question text states everything needed to answer; every number on the drawing appears in the
  question; never put the answer on the drawing; at most 6 drawings in the paper. The shape is
  question-level `"visual"`, a sibling of `"text"`, in the quiz `questions[]` and the worksheet
  `sections[].questions[]`.
- **Check before anything is stored or served** — a new step beside `sanitizeWorksheetExtras`,
  run for quiz/worksheet/homework:
  1. a non-physics paper: every `visual` is removed;
  2. a physics paper: each `visual` runs `resolveFigure` (refused → removed), then
     `figureNumbersInText(visual, question.text)` (fails → removed), then the per-paper cap of 6
     in paper order (over → removed). The question always stays;
  3. the same step runs on top-up replies (`quizTopUpBlock` / `worksheetTopUpBlock` merges).
- **Log** «paper visuals»: `{ kind, lessonId, kept: { [kind]: n }, dropped: { reason: n } }`,
  where reason ∈ `gate | numbers | cap | not-physics`.
- **Shared pool**: a physics quiz/worksheet/homework request gets `drawings: "physics-1"` in the
  STRICT cache key (absent for every other subject), so stored physics papers made before
  drawings existed are not served for them; every other subject keeps its pool. Cost: each
  physics paper kind regenerates once per lesson.
- **Answer keys** are unchanged; a drawing never earns «تم التحقق».
- **Offline generators** (demo mode or a live failure) produce no drawings. Same-for-both-paths
  is not claimed: the PR says so.

## 3. Showing them: app and PDF

- **Types**: `QuizQuestion` and the worksheet question type (`services/ai/AIService.ts`) gain
  `visual?: Figure` from `@workspace/figure`. The book-crop `figure` field is untouched.
- **Re-gated at every render** with `resolveFigure`; a stored drawing that no longer passes is
  skipped, never half-drawn.
- **On screen** via the existing `components/ui/QuestionVisual.tsx` (extended by the new
  renderer): the quiz result list (`app/ai-tools/quiz.tsx`), the worksheet/homework result
  (`app/ai-tools/worksheet.tsx`), `components/generator/PaperPreview.tsx`, and the saved-materials
  viewer (`app/workspace/view.tsx`). The chat bubble (`app/(tabs)/iqra.tsx`) draws them only if it
  renders questions through those components; otherwise the plan records chat as a gap rather
  than build a new chat view.
- **Print**: `buildQuizHTML`, `buildWorksheetHTML`, `buildQuizSlidesHTML`,
  `buildWorksheetSlidesHTML` print `figureSvg(visual)` under the question text, in the student
  and the teacher copy (a drawing never carries the answer).
- **Editing** a question's text or answer removes its `visual` (`quizEdits.ts`,
  `worksheetEdits.ts`), as an exam question's drawing is removed on edit.
- `questionRefersToFigure` does not add the book-figure hint to a question that has a `visual`.
- **Word** stays text-only; under a question with a drawing it prints «(الرسم في نسخة PDF)» /
  "(The drawing is in the PDF.)".
- No native module; `app.json` `version` does not change.

## 4. Delivery: three draft PRs, branches from main

1. `claude/physics-figures-1` — **`lib/figure`**: kinds, gate, numbers helpers, scene layout,
   both renderers, alt text, clip-id fix. No user-visible change.
   Tests: every gate row accepted and refused; labels with values refused; `PhysicsValue` units;
   numbers check with Arabic-Indic digits and «٫»; geometry inside the box; projectile apex at
   the computed point for its angle; wave λ spans one cycle; superposition sum.
   By eye: every kind rendered to PNG in the container's browser and looked at; images shared.
2. `claude/physics-figures-2` — **server**: prompt block, cleanup step, cap, top-up, cache
   marker, log. Tests: kept / dropped (gate, numbers, cap, not-physics), question kept, top-up
   checked, prompt block present only for physics in both languages, cache key changes only for
   physics.
3. `claude/physics-figures-3` — **app + PDF**: types, screens, saved materials, exports, edit
   rule, Word note, «ما الجديد» entry (teacher, dated the merge day, route the quiz tool; no
   `toolId`, it is not a new tool). Checks: browser run on a fixture physics quiz and worksheet,
   phone and desktop, Arabic and English, light and dark; the exported PDF read page by page;
   `pnpm run typecheck`, api-server `pnpm build && pnpm test`, mobile `pnpm test`.

All three are code only (no migration); each reverts by reverting its commits. PR 3 depends on
PR 1; PR 2 depends on PR 1. Merge order 1 → 2 → 3.

## Not verifiable here

- Whether a live model writes good drawings, how often, and how often they are refused: the
  OpenAI key behind the session proxy is out of credit (2026-11-13). First live check: a quiz
  and a worksheet for u2_l2, u4_l1, u4_l3, u6_l1; read the «paper visuals» log line; compare every
  drawing with its question and answer key by hand.
- Native devices (checks run on the web build).

## Trust rules (short)

1. The model proposes data; our code draws.
2. Fail closed: a refused drawing leaves the question as words.
3. A drawing shows only numbers the question already states; an answer cannot appear on it.
4. The words are always enough to answer; the drawing illustrates.
5. A drawing is never badged verified.
6. Editing a question removes its drawing.
