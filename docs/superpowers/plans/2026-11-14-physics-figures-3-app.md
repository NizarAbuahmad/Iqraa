# Drawn physics figures, part 3: the app and the PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher sees a physics question's drawing under the question on the quiz and worksheet/homework screens and in saved materials, and in every HTML/PDF export (paper and class-mode slides). Word and the plain-text copies say «(الرسم في نسخة PDF)», and editing a question's words or answer removes its drawing.

**Architecture:** One pure, testable gate decides whether a question's drawing is shown: `paperVisualOf(q)` in `artifacts/mobile/services/paperVisual.ts`. It keeps `resolvePhysicsFigure(q.visual)` only when `figureNumbersInText(figure, q.text)` also holds, so a drawing is re-checked every time it is drawn (spec §3, decided in PR 2's final review). Every surface goes through it:
- the screens, via a new `PaperVisual` component that hands the gated figure to the existing `FigureView`;
- `exportHtml.ts`, via `figureSvg`;
- `quizDocx.ts` / `exportText.ts`, as a one-line note.

The edit helpers drop `visual` the way they already drop a worksheet row's working.

**Tech Stack:** Expo / React Native (+ web), react-native-svg (already installed), `@workspace/figure` (already a dependency), `node --test` for `services/__tests__`.

**Spec:** `docs/superpowers/specs/2026-11-13-physics-figures-design.md` §3 and §4.3. Part 1 is NizarAbuahmad/Iqraa#1443 (the package); part 2 is NizarAbuahmad/Iqraa#1467 (the server).

## Global Constraints

- **Branch:** `claude/physics-figures-3`, cut from `claude/physics-figures-2`. The draft PR's base is `claude/physics-figures-2`; retarget it as the PRs below it merge.
- **One gate for display:** `paperVisualOf` in `services/paperVisual.ts`. No screen and no exporter reads `q.visual` directly. A drawing that fails is not shown, and its question still shows in full.
- **Exam path untouched:** `components/ui/QuestionVisual.tsx` stays exactly as it is (maths-only `resolveFigure`; `figureView.test.ts` pins it). The AI-tools papers use the new `PaperVisual` component instead. This is a refinement of spec §3, which named `QuestionVisual`.
- **Edit rule:** an edit to a question's text, or to its answer, removes its `visual`. A points-only or explanation-only edit keeps it. An option edit removes it only when the edited option was the answer.
- **Word / text note, exactly:** «(الرسم في نسخة PDF)» / "(The drawing is in the PDF.)".
- **Book-figure hint:** `questionRefersToFigure`'s «attach a book figure» highlight is not shown for a question that has a shown drawing.
- **No native change:** no native module, and `app.json` `version` is unchanged.
- **Colours:** screen colours come from `useColors()`, which `FigureView` already does. Exports use `figureSvg`'s own colours. Ink print style greys them.
- **«ما الجديد» entry:**
  - `id: 'physics-drawn-figures'`, `roles: ['teacher']`, `route: '/ai-tools/quiz'`, no `toolId`;
  - dated the day it merges (set it to the day the PR is opened, and correct it on merge day);
  - Arabic and English keys in `services/i18n.ts`.
- **Repo rules:**
  - No `sed -i` / `perl -pi` / Python replace / shell heredocs on source: files hold Arabic. Use the Edit tool.
  - `git add` named paths only.
  - Commit messages end with the two attribution lines the controller gives.
- **Tests:**
  - Mobile: `cd artifacts/mobile && pnpm test`. It runs only `services/__tests__/**/*.test.ts`, under bare `node --test`, so components are pinned by source-reading tests as `figureView.test.ts` does.
  - Root: `pnpm run typecheck`.
  - API: `cd artifacts/api-server && pnpm build && pnpm test`.

## File map

| File | Change |
|---|---|
| `artifacts/mobile/services/ai/AIService.ts` | `visual?: PhysicsFigure` on `QuizQuestion` and `WorksheetQuestion` |
| `artifacts/mobile/services/paperVisual.ts` | **Create.** `paperVisualOf`, `DRAWING_IN_PDF_AR/EN`, `drawingInPdfNote` |
| `artifacts/mobile/services/__tests__/paperVisual.test.ts` | **Create.** |
| `artifacts/mobile/services/quizEdits.ts`, `services/worksheetEdits.ts` | Drop `visual` on text / answer edits |
| `artifacts/mobile/services/__tests__/paperVisualEdits.test.ts` | **Create.** |
| `artifacts/mobile/services/exportHtml.ts` | `paperVisualHTML`; drawings in all four builders; `quizSlideGroups` |
| `artifacts/mobile/services/printStyle.ts` | Ink and large-print rules for `.q-vis` |
| `artifacts/mobile/services/__tests__/paperVisualPrint.test.ts` | **Create.** |
| `artifacts/mobile/services/quizDocx.ts`, `services/exportText.ts` | The «(الرسم في نسخة PDF)» note |
| `artifacts/mobile/services/__tests__/paperVisualText.test.ts` | **Create.** |
| `artifacts/mobile/components/ui/PaperVisual.tsx` | **Create.** |
| `artifacts/mobile/app/ai-tools/quiz.tsx`, `app/ai-tools/worksheet.tsx`, `app/workspace/view.tsx` | Render `PaperVisual`; worksheet hint rule |
| `artifacts/mobile/services/__tests__/paperVisualScreens.test.ts` | **Create.** Source pins |
| `artifacts/mobile/services/whatsNew.ts`, `services/i18n.ts` | The entry and its words |
| `docs/status-log.md` | Top entry |

## Shared test fixture (used by Tasks 1–5)

```ts
// A physics question whose drawing passes: every printed number (20, 30) is in the stem.
const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] };
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';
const STEM_NO_SPEED = 'قُذفت كرة بزاوية 30° مع الأفق. احسب سرعتها الابتدائية.'; // 20 not stated → drawing not shown
```

---

### Task 1: The display gate and the types

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts` (the `WorksheetQuestion` interface, ~l.291; `QuizQuestion`, ~l.354)
- Create: `artifacts/mobile/services/paperVisual.ts`
- Test: `artifacts/mobile/services/__tests__/paperVisual.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function paperVisualOf(q: { visual?: unknown; text?: unknown } | null | undefined): PhysicsFigure | null;
  export const DRAWING_IN_PDF_AR = '(الرسم في نسخة PDF)';
  export const DRAWING_IN_PDF_EN = '(The drawing is in the PDF.)';
  export function drawingInPdfNote(isAr: boolean): string;
  ```
- Types: `QuizQuestion.visual?: PhysicsFigure`; `WorksheetQuestion.visual?: PhysicsFigure`.

- [ ] **Step 1: Write the failing test** `services/__tests__/paperVisual.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DRAWING_IN_PDF_AR, DRAWING_IN_PDF_EN, drawingInPdfNote, paperVisualOf } from '../paperVisual.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] };
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';
const STEM_NO_SPEED = 'قُذفت كرة بزاوية 30° مع الأفق. احسب سرعتها الابتدائية.';

describe('paperVisualOf — what a paper question may show', () => {
  it('shows a drawing that passes the gate and states every number it prints', () => {
    assert.deepEqual(paperVisualOf({ text: STEM, visual: PROJ }), PROJ);
  });
  it('hides a drawing that prints a number the question does not state (re-checked at render)', () => {
    assert.equal(paperVisualOf({ text: STEM_NO_SPEED, visual: PROJ }), null);
  });
  it('hides a drawing the gate refuses, and a maths graph', () => {
    assert.equal(paperVisualOf({ text: STEM, visual: { ...PROJ, angle: 85 } }), null);
    assert.equal(paperVisualOf({ text: 'x', visual: { kind: 'function-graph', functions: [{ expr: 'x^2', label: 'f' }], x: [-2, 2] } }), null);
  });
  it('hides when there is no drawing, no text, or no question', () => {
    assert.equal(paperVisualOf({ text: STEM }), null);
    assert.equal(paperVisualOf({ visual: PROJ }), null);
    assert.equal(paperVisualOf({ text: 7, visual: PROJ }), null);
    assert.equal(paperVisualOf(null), null);
    assert.equal(paperVisualOf(undefined), null);
  });
  it('shows physics vectors whose components the question states', () => {
    const vec = { kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 0], label: 'A' }, { from: [0, 0], to: [0, 4], label: 'B' }] };
    assert.ok(paperVisualOf({ text: 'قوتان A = 3 N و B = 4 N متعامدتان. احسب المحصلة.', visual: vec }));
  });
  it('the Word / text note, in each language', () => {
    assert.equal(drawingInPdfNote(true), DRAWING_IN_PDF_AR);
    assert.equal(drawingInPdfNote(false), DRAWING_IN_PDF_EN);
    assert.equal(DRAWING_IN_PDF_AR, '(الرسم في نسخة PDF)');
    assert.equal(DRAWING_IN_PDF_EN, '(The drawing is in the PDF.)');
  });
});
```

- [ ] **Step 2: Run, and see it fail** because the module is missing. Command: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/paperVisual.test.ts`.

- [ ] **Step 3: Implement** `services/paperVisual.ts`:

```ts
/**
 * Whether a quiz / worksheet / homework question's drawing is shown — on screen, in
 * the HTML/PDF exports, and as the Word / text note.
 *
 * The server settled the drawing before it pooled the paper (api-server
 * lib/paperVisuals.ts). It is checked again here, every time, with the same two
 * rules: the gate (`resolvePhysicsFigure`) and the answer-leak guard (every number
 * the drawing prints is in the question's own text). So a guard fixed later reaches
 * papers saved before the fix, and a drawing whose question was reworded is not
 * drawn. A drawing that fails is simply not shown; the question always is.
 * Spec: docs/superpowers/specs/2026-11-13-physics-figures-design.md §3.
 */
import { figureNumbersInText, resolvePhysicsFigure, type PhysicsFigure } from '@workspace/figure';

export function paperVisualOf(q: { visual?: unknown; text?: unknown } | null | undefined): PhysicsFigure | null {
  if (!q || q.visual === undefined || q.visual === null || typeof q.text !== 'string') return null;
  const figure = resolvePhysicsFigure(q.visual);
  return figure && figureNumbersInText(figure, q.text) ? figure : null;
}

/** Word and the plain-text copies cannot carry the drawing; they say where it is. */
export const DRAWING_IN_PDF_AR = '(الرسم في نسخة PDF)';
export const DRAWING_IN_PDF_EN = '(The drawing is in the PDF.)';
export const drawingInPdfNote = (isAr: boolean): string => (isAr ? DRAWING_IN_PDF_AR : DRAWING_IN_PDF_EN);
```

In `services/ai/AIService.ts`, add `import type { PhysicsFigure } from '@workspace/figure';` with the file's other imports. Then add to `WorksheetQuestion`, after `figure?: QuestionFigure;`, and to `QuizQuestion`, after `lesson?: string;`:

```ts
  /**
   * A drawing the model proposed for a physics question (spec 2026-11-13 physics
   * figures). Never trusted as stored: shown only through `paperVisualOf`
   * (services/paperVisual.ts). Removed when the question's text or answer is edited.
   */
  visual?: PhysicsFigure;
```

- [ ] **Step 4: Run, and see it pass**; then root `pnpm run typecheck`.

- [ ] **Step 5: Commit** `paperVisual.ts`, its test and `AIService.ts`: "App: one gate decides whether a paper question's drawing is shown".

---

### Task 2: Editing a question removes its drawing

**Files:**
- Modify: `artifacts/mobile/services/quizEdits.ts` (`applyOptionEdit` ~l.38, `applyQuestionEdit` ~l.53)
- Modify: `artifacts/mobile/services/worksheetEdits.ts` (`applyWorksheetQuestionEdit` ~l.91, `applyWorksheetOptionEdit` ~l.110, `applyWorksheetAnswerEdit` ~l.136)
- Test: `artifacts/mobile/services/__tests__/paperVisualEdits.test.ts`

**Interfaces:**
- Consumes: the `visual` field (Task 1).
- Behaviour:
  - quiz: `applyQuestionEdit` drops `visual` when the patch has `text` or `correctAnswer`. `applyOptionEdit` drops it when the edited option was the answer.
  - worksheet: `applyWorksheetQuestionEdit` drops `visual` when the patch has `text`. `applyWorksheetAnswerEdit` always drops it. `applyWorksheetOptionEdit` drops it when the edited option was the answer.
  - Points, explanation and book-figure edits keep it.

- [ ] **Step 1: Write the failing test** `services/__tests__/paperVisualEdits.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyOptionEdit, applyQuestionEdit } from '../quizEdits.ts';
import {
  applyWorksheetAnswerEdit, applyWorksheetFigure, applyWorksheetOptionEdit, applyWorksheetQuestionEdit,
} from '../worksheetEdits.ts';
import type { QuizOutput, QuizQuestion, WorksheetOutput } from '../ai/AIService.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] } as unknown as QuizQuestion['visual'];
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';

const quizQ = (): QuizQuestion => ({
  id: 'q1', type: 'multiple_choice', text: STEM, options: ['5 m', '10 m', '20 m', '40 m'], correctAnswer: '5 m',
  points: 2, explanation: 'H = v²sin²θ/2g', visual: PROJ,
});
const quiz = (): QuizOutput => ({ title: 't', duration: 20, totalPoints: 2, questions: [quizQ()] });
const ws = (): WorksheetOutput => ({
  title: 't', instructions: 'i',
  sections: [{ type: 'multiple_choice', title: 's', questions: [{ text: STEM, options: ['5 m', '10 m'], points: 2, visual: PROJ }] }],
  answerKey: [{ num: 1, answer: '5 m' }],
});

describe('a quiz edit and the drawing', () => {
  it('a new text drops it', () => assert.ok(!('visual' in applyQuestionEdit(quiz(), 0, { text: 'x' }).questions[0]!)));
  it('a new answer drops it', () => assert.ok(!('visual' in applyQuestionEdit(quiz(), 0, { correctAnswer: '10 m' }).questions[0]!)));
  it('points or explanation keep it', () => {
    assert.ok(applyQuestionEdit(quiz(), 0, { points: 3 }).questions[0]!.visual);
    assert.ok(applyQuestionEdit(quiz(), 0, { explanation: 'y' }).questions[0]!.visual);
  });
  it('rewriting the correct option drops it; another option keeps it', () => {
    assert.ok(!('visual' in applyOptionEdit(quizQ(), 0, '6 m')));
    assert.ok(applyOptionEdit(quizQ(), 1, '11 m').visual);
  });
});

describe('a worksheet edit and the drawing', () => {
  const q0 = (w: WorksheetOutput) => w.sections[0]!.questions[0]!;
  it('a new text drops it', () => assert.ok(!('visual' in q0(applyWorksheetQuestionEdit(ws(), 0, 0, { text: 'x' })))));
  it('points keep it', () => assert.ok(q0(applyWorksheetQuestionEdit(ws(), 0, 0, { points: 3 })).visual));
  it('a new answer drops it', () => assert.ok(!('visual' in q0(applyWorksheetAnswerEdit(ws(), 0, 0, '10 m')))));
  it('rewriting the correct option drops it; another option keeps it', () => {
    assert.ok(!('visual' in q0(applyWorksheetOptionEdit(ws(), 0, 0, 0, '6 m'))));
    assert.ok(q0(applyWorksheetOptionEdit(ws(), 0, 0, 1, '11 m')).visual);
  });
  it('attaching a book figure keeps it', () => {
    const fig = { uri: 'https://x/p1.png', page: 1, caption: 'c' };
    assert.ok(q0(applyWorksheetFigure(ws(), 0, 0, fig)).visual);
  });
});
```

- [ ] **Step 2: Run, and see the drop cases fail.**

- [ ] **Step 3: Implement.**
  - **quizEdits.ts:**
    - Add `const withoutVisual = ({ visual: _visual, ...rest }: QuizQuestion): QuizQuestion => rest;`.
    - `applyQuestionEdit` maps the edited question to `{ ...('text' in patch || 'correctAnswer' in patch ? withoutVisual(q) : q), ...patch }`.
    - `applyOptionEdit` starts from `const base = wasCorrect ? withoutVisual(question) : question;` and returns `{ ...base, options, correctAnswer: wasCorrect ? next : question.correctAnswer }`. Compute `wasCorrect` before `base`.
    - Update both docstrings: a reworded question or a changed answer no longer matches its drawing.
  - **worksheetEdits.ts:**
    - Add `const withoutVisual = ({ visual: _visual, ...rest }: WorksheetQuestion): WorksheetQuestion => rest;` next to `withoutFormat`.
    - In `applyWorksheetQuestionEdit`, the text branch becomes `withoutVisual(withoutFormat(f.question))`.
    - In `applyWorksheetAnswerEdit`, wrap the existing question expression in `withoutVisual(...)`. This applies to the graph-format branch too: the answer changed.
    - In `applyWorksheetOptionEdit`, the question becomes `{ ...(wasCorrect ? withoutVisual(f.question) : f.question), options }`.
    - Update the three docstrings.

- [ ] **Step 4: Run, and see it pass**, plus the existing edit suites: `quizEdits.test.ts`, `worksheetEdits.test.ts`, `worksheetFormatEdits.test.ts`, `worksheetWorking.test.ts`, `worksheetQuestionFigure.test.ts`.

- [ ] **Step 5: Commit** both services files and the test: "App: editing a question's words or answer removes its drawing".

---

### Task 3: Drawings in the HTML/PDF exports

**Files:**
- Modify: `artifacts/mobile/services/exportHtml.ts`
- Modify: `artifacts/mobile/services/printStyle.ts`
- Test: `artifacts/mobile/services/__tests__/paperVisualPrint.test.ts`

**Interfaces:**
- Consumes: `paperVisualOf` (Task 1); `figureSvg` from `@workspace/figure`.
- Produces:
  - `paperVisualHTML(q, isAr, id)`, module-private: returns `''` or `<figure class="q-vis">…svg…</figure>`.
  - `export function quizSlideGroups(questions: QuizQuestion[]): { start: number; questions: QuizQuestion[] }[]` puts at most 3 questions and at most 1 shown drawing on a slide.

- [ ] **Step 1: Write the failing test** `services/__tests__/paperVisualPrint.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizHTML, buildQuizSlidesHTML, buildWorksheetHTML, buildWorksheetSlidesHTML, quizSlideGroups } from '../exportHtml.ts';
import type { QuizOutput, QuizQuestion, WorksheetOutput } from '../ai/AIService.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] } as unknown as QuizQuestion['visual'];
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';
const STEM_NO_SPEED = 'قُذفت كرة بزاوية 30° مع الأفق. احسب سرعتها الابتدائية.';
const meta = { subject: 'الفيزياء', grade: 'الصف العاشر' };
const q = (id: string, text: string, visual?: unknown): QuizQuestion => ({
  id, type: 'short_answer', text, correctAnswer: 'a', points: 2, explanation: '', ...(visual ? { visual: visual as QuizQuestion['visual'] } : {}),
});
const quiz = (questions: QuizQuestion[]): QuizOutput => ({ title: 't', duration: 20, totalPoints: questions.length * 2, questions });
const sheet = (questions: { text: string; visual?: unknown }[]): WorksheetOutput => ({
  title: 't', instructions: 'i',
  sections: [{ type: 'short_answer', title: 's', questions: questions.map(x => ({ text: x.text, points: 2, ...(x.visual ? { visual: x.visual as QuizQuestion['visual'] } : {}) })) }],
  answerKey: questions.map((_, i) => ({ num: i + 1, answer: 'a' })),
});
const count = (html: string, s: string) => html.split(s).length - 1;

describe('drawings in the quiz paper', () => {
  for (const withKey of [false, true]) {
    it(`prints a shown drawing under its question, once, in the ${withKey ? 'teacher' : 'student'} copy`, () => {
      const html = buildQuizHTML(quiz([q('a', STEM, PROJ), q('b', 'سؤال بلا رسم')]), 't', meta, true, [], withKey);
      assert.equal(count(html, 'class="q-vis"'), 1);
      assert.equal(count(html, '<svg'), 1);
      // Match the markup, never the CSS: the page's <style> names the same classes first.
      const first = html.indexOf('class="q-card"');
      const card = html.slice(first, html.indexOf('class="q-card"', first + 1));
      assert.ok(card.includes('<figure class="q-vis"><svg'), 'the drawing sits in its own question card');
    });
  }
  it('does not print a drawing whose numbers the question does not state', () => {
    assert.equal(count(buildQuizHTML(quiz([q('a', STEM_NO_SPEED, PROJ)]), 't', meta, true), '<svg'), 0);
  });
  it('gives every drawing its own clip id', () => {
    const html = buildQuizHTML(quiz([q('a', STEM, PROJ), q('b', STEM, PROJ)]), 't', meta, true);
    const ids = [...html.matchAll(/clipPath id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
  });
  it('prints the drawing in English with English labels', () => {
    const html = buildQuizHTML(quiz([q('a', 'A ball is thrown at 20 m/s at 30° to the horizontal. Find H.', PROJ)]), 't', meta, false);
    assert.equal(count(html, '<svg'), 1);
  });
});

describe('drawings in the worksheet / homework paper', () => {
  it('prints a shown drawing under its question text, in both copies', () => {
    for (const withKey of [false, true]) {
      const html = buildWorksheetHTML(sheet([{ text: STEM, visual: PROJ }, { text: 'بلا رسم' }]), 't', meta, true, [], withKey);
      assert.equal(count(html, 'class="q-vis"'), 1);
      // Markup positions, never the CSS ones.
      const vis = html.indexOf('class="q-vis"');
      assert.ok(vis > html.indexOf('class="q-text'), 'after the question text');
      assert.ok(vis < html.indexOf('class="q-lines"'), 'before the writing lines');
    }
  });
});

describe('drawings on the class-mode slides', () => {
  it('worksheet slides print the drawing in its card', () => {
    assert.equal(count(buildWorksheetSlidesHTML(sheet([{ text: STEM, visual: PROJ }]), 't', meta, true), 'class="q-vis"'), 1);
  });
  it('quiz slides print the drawing, at most one drawing per slide', () => {
    const qs = [q('a', STEM, PROJ), q('b', STEM, PROJ), q('c', 'بلا رسم'), q('d', 'بلا رسم'), q('e', 'بلا رسم')];
    const html = buildQuizSlidesHTML(quiz(qs), 't', meta, true);
    assert.equal(count(html, 'class="q-vis"'), 2);
    const groups = quizSlideGroups(qs);
    assert.deepEqual(groups.map(g => g.questions.map(x => x.id)), [['a'], ['b', 'c', 'd'], ['e']]);
    assert.deepEqual(groups.map(g => g.start), [0, 1, 4]);
  });
  it('without drawings the slides group in threes exactly as before', () => {
    const qs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => q(id, 'x'));
    assert.deepEqual(quizSlideGroups(qs).map(g => g.questions.length), [3, 3, 1]);
  });
});
```

- [ ] **Step 2: Run, and see it fail.**

- [ ] **Step 3: Implement** in `exportHtml.ts`:

1. Imports: `import { figureSvg } from '@workspace/figure';` and `import { paperVisualOf } from './paperVisual.ts';`, written to match the file's existing import style (extension or not).
2. Next to `questionFigureHTML` (~l.528), add:

```ts
/**
 * A physics question's own drawing, printed inside its card under the text, when
 * `paperVisualOf` shows it (gate + every printed number stated). `figureSvg` is
 * self-contained (its own colours and clip path); `id` keeps clip ids unique on a page.
 */
function paperVisualHTML(q: { visual?: unknown; text?: unknown }, isAr: boolean, id: string): string {
  const figure = paperVisualOf(q);
  return figure ? `<figure class="q-vis">${figureSvg(figure, { lang: isAr ? 'ar' : 'en', id })}</figure>` : '';
}
```

3. `buildWorksheetHTML`, the card at ~l.595: `${questionFigureHTML(q.figure)}${paperVisualHTML(q, isAr, `pv-w${qNum}`)}${fmt ? …`. The drawing comes after a book figure the teacher attached and before options or lines.
4. `buildQuizHTML`, the card at ~l.733: put `${paperVisualHTML(q, isAr, `pv-q${i + 1}`)}` on the line before `${options}${room}`.
5. `buildWorksheetSlidesHTML`, ~l.1195: `${questionFigureHTML(q.figure)}${paperVisualHTML(q, isAr, `pv-s${qCounter}`)}${opts}`.
6. `buildQuizSlidesHTML`:
   - Replace the fixed `GROUP_SIZE` loop with `const questionGroups = quizSlideGroups(quiz.questions);`.
   - Make the group map read `group.start` / `group.questions`: `const startIdx = group.start`, `idx = startIdx + qi + 1`, and the header uses `startIdx + 1` and `startIdx + group.questions.length`.
   - Put `${paperVisualHTML(q, isAr, `pv-z${idx}`)}` after the `q-text` div.
   - `TOTAL` keeps using `questionGroups.length`.
   - Export the grouping from the module:

```ts
/**
 * Question slides for a quiz: up to three questions each, as always, but never more
 * than one shown drawing on a slide — a slide is a fixed page and three drawings
 * do not fit. Without drawings this is exactly the old grouping by threes.
 */
export function quizSlideGroups(questions: QuizQuestion[]): { start: number; questions: QuizQuestion[] }[] {
  const out: { start: number; questions: QuizQuestion[] }[] = [];
  let drawn = false;
  questions.forEach((q, i) => {
    const has = paperVisualOf(q) !== null;
    const last = out[out.length - 1];
    if (!last || last.questions.length >= 3 || (has && drawn)) {
      out.push({ start: i, questions: [q] });
      drawn = has;
    } else {
      last.questions.push(q);
      drawn = drawn || has;
    }
  });
  return out;
}
```

   Import `QuizQuestion` as a type if the file does not already have it.
7. CSS:
   - In the paper styles, next to `.q-fig` (~l.199), add:
     ```
     /* A physics question's own drawing (services/paperVisual.ts). */
     .q-vis { margin: 6px 0 4px; text-align: center; break-inside: avoid; }
     .q-vis svg { width: 100%; max-width: 110mm; height: auto; }
     ```
   - In the worksheet-slides styles, next to `.q-fig` (~l.1271): `.q-vis { width:100%; margin:4px 0; text-align:center; } .q-vis svg { max-height:60mm; width:auto; max-width:60%; height:auto; }`
   - In the quiz-slides styles (~l.1448–1481), the same two rules.
8. `printStyle.ts`:
   - Ink block, next to the `.q-fig img` rule (~l.58): `.q-vis svg { filter: grayscale(1) contrast(1.15); }`
   - Large-print block (~l.82): `.q-vis svg { max-width: 150mm; }`

- [ ] **Step 4: Run** the new test plus `exportHtml.test.ts`, `worksheetQuestionFigure.test.ts`, `quizPaper.test.ts`, `quizMinistryOrder.test.ts`, `printStyle.test.ts`, `worksheetPrint.test.ts` and `formatSlides.test.ts`. All must pass. A quiz-slides test that counts slides must still pass, since grouping without drawings is unchanged.

- [ ] **Step 5: Commit** `exportHtml.ts`, `printStyle.ts` and the test: "App: physics drawings print under their questions, on paper and on slides".

---

### Task 4: Word and the text copies say where the drawing is

**Files:**
- Modify: `artifacts/mobile/services/quizDocx.ts` (the stem paragraph, ~l.156–169)
- Modify: `artifacts/mobile/services/exportText.ts` (`formatWorksheetText` ~l.121–124; `formatQuizText` ~l.166)
- Test: `artifacts/mobile/services/__tests__/paperVisualText.test.ts`

**Interfaces:**
- Consumes: `paperVisualOf`, `drawingInPdfNote` (Task 1).

- [ ] **Step 1: Write the failing test** `services/__tests__/paperVisualText.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as docx from 'docx';
import { buildQuizDocx } from '../quizDocx.ts';
import { formatQuizText, formatWorksheetText } from '../exportText.ts';
import type { QuizOutput, QuizQuestion, WorksheetOutput } from '../ai/AIService.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] } as unknown as QuizQuestion['visual'];
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';
const STEM_NO_SPEED = 'قُذفت كرة بزاوية 30° مع الأفق. احسب سرعتها الابتدائية.';
const meta = { subject: 'الفيزياء', grade: 'الصف العاشر' };
const quiz = (text: string): QuizOutput => ({ title: 't', duration: 20, totalPoints: 2, questions: [{ id: 'a', type: 'short_answer', text, correctAnswer: 'a', points: 2, explanation: '', visual: PROJ }] });
const sheet = (text: string): WorksheetOutput => ({ title: 't', instructions: 'i', sections: [{ type: 'short_answer', title: 's', questions: [{ text, points: 2, visual: PROJ }] }], answerKey: [{ num: 1, answer: 'a' }] });

describe('the text copies name the drawing', () => {
  it('quiz text: the note under a drawn question, and none when the drawing is not shown', () => {
    assert.ok(formatQuizText(quiz(STEM), 't', meta, true).includes('(الرسم في نسخة PDF)'));
    assert.ok(formatQuizText(quiz(STEM), 't', meta, false).includes('(The drawing is in the PDF.)'));
    assert.ok(!formatQuizText(quiz(STEM_NO_SPEED), 't', meta, true).includes('(الرسم في نسخة PDF)'));
  });
  it('worksheet text, the same', () => {
    assert.ok(formatWorksheetText(sheet(STEM), 't', meta, true).includes('(الرسم في نسخة PDF)'));
    assert.ok(!formatWorksheetText(sheet(STEM_NO_SPEED), 't', meta, true).includes('(الرسم في نسخة PDF)'));
  });
  it('quiz Word file carries the note', async () => {
    const doc = buildQuizDocx(quiz(STEM), 't', meta, true, false, docx);
    const xml = JSON.stringify(doc);
    assert.ok(xml.includes('(الرسم في نسخة PDF)'));
  });
});
```

> Before writing the Word assertion, read `services/__tests__/quizDocx.test.ts`. It shows how that suite reads text out of a built document; use its helper and its argument order for `buildQuizDocx`, `formatQuizText` and `formatWorksheetText` (check the real signatures). Keep the three behaviours above.

- [ ] **Step 2: Run, and see it fail.**

- [ ] **Step 3: Implement.**
  - **quizDocx.ts:** after the stem paragraph, when `paperVisualOf(q)` is non-null, add `para(drawingInPdfNote(isAr), { color: '6B7280', size: 18, after: 60 })`. Use the file's own `para` helper and option names, and put the note between the stem and the options.
  - **exportText.ts:**
    - `formatWorksheetText`: after the `if (q.figure) …` line, add `if (paperVisualOf(q)) lines.push(`   ${drawingInPdfNote(isAr)}`);`.
    - `formatQuizText`: after the question line, add the same push.

  Both files import from `./paperVisual.ts`. Match the import style the file already uses.

- [ ] **Step 4: Run, and see it pass**, plus `quizDocx.test.ts`, `docxBuild.test.ts`, `exportText.test.ts`, `quizExport.test.ts` and `worksheetExport.test.ts`.

- [ ] **Step 5: Commit** both files and the test: "App: Word and text copies say the drawing is in the PDF".

---

### Task 5: The screens draw it

**Files:**
- Create: `artifacts/mobile/components/ui/PaperVisual.tsx`
- Modify:
  - `artifacts/mobile/app/ai-tools/quiz.tsx`: the question card, under the text `EditableText`, ~l.936–944
  - `artifacts/mobile/app/ai-tools/worksheet.tsx`: under the text `EditableText`, before the book figure, ~l.1215–1223; the hint at ~l.1291
  - `artifacts/mobile/app/workspace/view.tsx`: `QuizView` under the question text ~l.760; `WorksheetView` under the question text, before the book figure, ~l.683
- Test: `artifacts/mobile/services/__tests__/paperVisualScreens.test.ts` (source pins)

**Interfaces:**
- Consumes: `paperVisualOf` (Task 1); `FigureView` (`components/ui/FigureView.tsx`, `{ figure: AnyFigure; lang: 'ar' | 'en' }`).
- Produces: `export function PaperVisual({ question, lang }: { question: { visual?: unknown; text?: unknown }; lang: 'ar' | 'en' })`.

- [ ] **Step 1: Write the failing test** `services/__tests__/paperVisualScreens.test.ts`. It reads source, as `figureView.test.ts` does, because components cannot load under bare node:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('physics drawings on screen', () => {
  it('PaperVisual draws only what paperVisualOf shows, through FigureView', () => {
    const src = read('components/ui/PaperVisual.tsx');
    assert.match(src, /paperVisualOf\(question\)/);
    assert.match(src, /<FigureView figure=\{figure\} lang=\{lang\} \/>/);
    assert.ok(!/resolvePhysicsFigure|resolveFigure/.test(src), 'no second gate');
  });
  for (const [file, count] of [['app/ai-tools/quiz.tsx', 1], ['app/ai-tools/worksheet.tsx', 1], ['app/workspace/view.tsx', 2]] as const) {
    it(`${file} renders PaperVisual (${count}×) and reads no visual directly`, () => {
      const src = read(file);
      assert.equal(src.split('<PaperVisual ').length - 1, count);
      assert.ok(!/\.visual\b/.test(src), `${file} reads .visual directly`);
    });
  }
  it('the book-figure hint is not shown for a question with a drawing', () => {
    assert.match(read('app/ai-tools/worksheet.tsx'), /!q\.figure && !paperVisualOf\(q\) && questionRefersToFigure\(q\.text\)/);
  });
  it('the exam path is untouched: QuestionVisual still gates with resolveFigure', () => {
    assert.match(read('components/ui/QuestionVisual.tsx'), /resolveFigure\(body\['visual'\]\)/);
  });
});
```

- [ ] **Step 2: Run, and see it fail.**

- [ ] **Step 3: Implement.**

`components/ui/PaperVisual.tsx`:

```tsx
/**
 * A quiz / worksheet / homework question's own drawing (physics), under its text.
 * Shown only when `paperVisualOf` passes it — the same gate the exports use — so a
 * drawing is checked again every time it is drawn. Exam questions use
 * `QuestionVisual` instead (maths, `resolveFigure`).
 */
import React from 'react';
import { paperVisualOf } from '@/services/paperVisual';
import { FigureView } from './FigureView';

export function PaperVisual({ question, lang }: { question: { visual?: unknown; text?: unknown }; lang: 'ar' | 'en' }) {
  const figure = paperVisualOf(question);
  return figure ? <FigureView figure={figure} lang={lang} /> : null;
}
```

Use the alias form (`@/services/paperVisual`) that neighbouring components use for services; check one, for example `FigureView.tsx` imports `@/services/readableColor`.

Screens:
- **quiz.tsx:** right after the `<View style={styles.qText}>…</View>` that wraps the text `EditableText`, add `<PaperVisual question={q} lang={outLang} />`. `outLang` is the screen's output language, `'ar' | 'en'`. If its type is wider, narrow it with `outLang === 'ar' ? 'ar' : 'en'`.
- **worksheet.tsx:**
  - Right after the text `EditableText` and before `{q.figure ? (`, add `<PaperVisual question={q} lang={outLang} />`.
  - At the hint, `const wanted = !q.figure && questionRefersToFigure(q.text);` becomes `const wanted = !q.figure && !paperVisualOf(q) && questionRefersToFigure(q.text);`. Import `paperVisualOf` from `@/services/paperVisual`.
- **view.tsx:**
  - `QuizView`: after the question `<Text>` (~l.760), add `<PaperVisual question={q} lang={lang === 'ar' ? 'ar' : 'en'} />`.
  - `WorksheetView` has no `lang` prop. Add `lang: string` to its props and pass `lang={docLang}` at the call site (~l.393). After the question `<Text>` and before `{q.figure ? (`, add `<PaperVisual question={q} lang={lang === 'ar' ? 'ar' : 'en'} />`.

Do NOT change `PaperPreview.tsx` (it draws skeleton rows, never real questions), the chat bubble (text only), lesson-flow previews, or `QuestionVisual.tsx`.

- [ ] **Step 4: Run, and see it pass**; then root `pnpm run typecheck`; then the whole mobile suite, `cd artifacts/mobile && pnpm test`. The suite is silent for minutes; that is normal. It must pass, and that includes `figureView.test.ts`, `generatorScreens.test.ts` and `cornerTheme.test.ts`.

- [ ] **Step 5: Commit** the component, the three screens and the test: "App: physics drawings on the quiz, worksheet and saved-material screens".

---

### Task 6: «ما الجديد»

**Files:**
- Modify: `artifacts/mobile/services/whatsNew.ts` (top of `WHATS_NEW`, which is newest first)
- Modify: `artifacts/mobile/services/i18n.ts` (the ar block near `whatsNewFollowUsTitle`, ~l.3167, and the en block, ~l.6770)

- [ ] **Step 1: Add the entry** as the first element of `WHATS_NEW`:

```ts
  {
    id: 'physics-drawn-figures',
    date: '2026-11-14',
    roles: ['teacher'],
    titleKey: 'whatsNewPhysicsDrawingsTitle',
    bodyKey: 'whatsNewPhysicsDrawingsBody',
    route: '/ai-tools/quiz',
  },
```

Keep newest-first: the date must not be earlier than the entry below it. Correct the date on merge day.

- [ ] **Step 2: Add the words.** ar block, after `whatsNewFollowUsBody`:

```ts
    whatsNewPhysicsDrawingsTitle: 'رسوم في أسئلة الفيزياء',
    whatsNewPhysicsDrawingsBody: 'يمكن الآن أن يحمل سؤال الفيزياء في الاختبار القصير وورقة العمل والواجب رسمًا: قوى تؤثر في جسم، أو مسار مقذوف، أو حركة دائرية، أو موجة، أو متجهات. يظهر الرسم تحت السؤال وفي نسخة PDF، ولا يطبع إلا أعدادًا يذكرها السؤال. وإن عدّلتَ نص السؤال أو إجابته يُحذف رسمه.',
```

en block, after `whatsNewFollowUsBody`:

```ts
    whatsNewPhysicsDrawingsTitle: 'Drawings in physics questions',
    whatsNewPhysicsDrawingsBody: 'A physics question in a quiz, worksheet or homework can now carry a drawing: forces on a body, a projectile path, circular motion, a wave, or vectors. It shows under the question and in the PDF, and it prints only numbers the question already states. Edit the question’s words or answer and its drawing is removed.',
```

- [ ] **Step 3: Run** `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whatsNew.test.ts`, then root `pnpm run typecheck`. The `TranslationKey` type must accept the new keys.

- [ ] **Step 4: Commit** `whatsNew.ts` and `i18n.ts`: "What's new: drawings in physics questions".

---

### Task 7: Seen, read, logged (controller-led)

**Files:**
- Modify: `docs/status-log.md` (a new top entry)

- [ ] **Step 1: Prints, by eye.** Write a scratch script, not committed, that builds a fixture physics quiz (6 questions: a forces, an incline, an attraction, a projectile, a circular and a wave drawing, each with a stem that states its numbers, plus 2 without drawings) and a fixture worksheet the same way. For each, write the student and teacher paper and the slides, in Arabic and English, colour and ink, to HTML files. Render each to a PDF and to PNG pages with the pre-installed Playwright Chromium (`page.pdf`, `page.screenshot`). Read every page. Check that:
  - each drawing sits in its question's card;
  - nothing overlaps or is cut at a page or slide edge;
  - no slide holds more than one drawing;
  - Arabic labels read correctly in an RTL page;
  - ink mode is grey.
- [ ] **Step 2: Screen, best effort.** Run the web build (`pnpm run dev:mobile:web`) against a local API. If a local Postgres is available (see CLAUDE.md's e2e notes), save the fixture quiz and worksheet as materials through the API, then open them in `/workspace/view`:
  - phone width and desktop;
  - light and dark;
  - Arabic and English.

  Take screenshots. If no database is available, record "screen not seen" in the log and the PR, and do not claim it.
- [ ] **Step 3: Log entry** at the top of `docs/status-log.md`, titled «Physics drawings show in quizzes, worksheets and their PDFs — <date>». Cover:
  - the gate re-check at render;
  - the surfaces covered;
  - the edit rule;
  - the Word / text note;
  - the slide rule (one drawing per slide);
  - what was seen by eye and what was not;
  - the known gaps:
    - **chat:** the bubble is text only and shows the note; its PDF export draws;
    - **lesson-flow previews:** text only;
    - **the in-app class-mode deck:** `classDeck.ts`, text only;
    - **send to students:** `worksheetSendPayload` does not carry `visual`, so a sent worksheet's exam has no drawing;
    - **games:** text only;
  - «ما الجديد»: added (`physics-drawn-figures`).
- [ ] **Step 4: The full check.** Report every count.

```bash
pnpm run typecheck
(cd lib/figure && pnpm test)
(cd artifacts/api-server && pnpm build && pnpm test)
(cd artifacts/mobile && pnpm test)
```

- [ ] **Step 5: Commit** `docs/status-log.md`: "Docs: physics drawings in the app and the PDF".

## After the plan (controller)

- Final whole-branch review on the most capable model, against spec §3 and these Global Constraints.
- Push `claude/physics-figures-3` and open a **draft** PR with base `claude/physics-figures-2`.
  - The PR body carries the «ما الجديد» date caveat and the gaps above.
  - It also says PR 2 and PR 3 merge together.
- Not in this PR (recorded as gaps): the projector deck, send-to-students, games, chat bubble, lesson-flow preview.
