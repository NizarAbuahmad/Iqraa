# Send a Worksheet to a Class — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher sends a generated or saved worksheet to one of their classes as a draft evaluation that students take on `take/[code]`, with safe questions auto-marked and the rest teacher-marked.

**Architecture:** A pure converter in the API (`modules/assessment/fromWorksheet.ts`) turns worksheet questions into evaluation questions validated by the existing type registry. One route creates the evaluation and its questions in a single transaction. The app adds a send sheet (class + objective) and shows a teacher-attached figure on the take screen through a host-checked `figure` that the student projection passes through.

**Tech Stack:** Express + Drizzle (api-server), `@workspace/curriculum` (objectives, `normalizeArabic`), Expo Router / React Native (mobile), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-09-worksheet-to-class-assignment-design.md`

## Global Constraints

- One objective per sent sheet, chosen by the teacher; `competencyKey = competencyForBlooms(objective.effectiveBloomsLevel)`.
- Auto-marked only: multiple choice (≥3 options, key matches an option), «صح / خطأ», and a key that is a plain number or `<letter> = <number>`. Everything else `short_answer`. Never guess.
- A question with no key blocks the send and names it.
- `verification` stays empty; nothing is labelled verified.
- A `figure` reaches a student only when its `uri` starts with the book-figure base URL + `/`.
- No migration. `generator` gains `'worksheet'` as a TypeScript union member only; `pnpm --filter @workspace/db run generate` must produce nothing.
- Arabic copy uses «ًا» not «اً» (`i18n terminology` test). Spacing, radius and font sizes on the theme scales (`designScale.test.ts`).
- Tests go inside the existing globs: api-server `src/**/__tests__/**/*.test.ts`, mobile `services/__tests__/**/*.test.ts`.

**One deviation from the spec, decided while planning:** the send sheet cannot show «٦ تُصحَّح تلقائيًا · ٤ يصحّحها المعلّم» *before* sending without a second copy of the conversion rules in the app (the "two places" trap CLAUDE.md warns about). The counts come back from the route and are shown on success instead. The spec is updated to say so in Task 6.

---

### Task 1: Book-figure base URL shared, and `figure` through the student projection

**Files:**
- Create: `lib/curriculum/src/bookFigureBase.ts`
- Modify: `lib/curriculum/src/index.ts` (export it)
- Modify: `artifacts/mobile/services/bookFigureUri.ts:37` (re-export from the lib instead of the literal)
- Create: `artifacts/api-server/src/modules/assessment/questionFigure.ts`
- Modify: `artifacts/api-server/src/modules/assessment/studentView.ts` (`sanitizeQuestionForStudent`, after the matching shuffle)
- Test: `artifacts/api-server/src/modules/assessment/__tests__/questionFigure.test.ts`

**Interfaces:**
- Produces: `BOOK_FIGURE_BASE_URL: string` from `@workspace/curriculum`; `studentFigure(body: Record<string, unknown>): { uri: string; caption: string } | null` from `questionFigure.ts`.

- [ ] **Step 1: Failing test** — `questionFigure.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOOK_FIGURE_BASE_URL } from "@workspace/curriculum";
import { studentFigure } from "../questionFigure.ts";
import { sanitizeQuestionForStudent } from "../studentView.ts";

const ok = { uri: `${BOOK_FIGURE_BASE_URL}/g10-math-s1/p045-1.png`, caption: "كتاب الطالب · صفحة ٤٥" };

describe("studentFigure", () => {
  it("passes a book figure", () => assert.deepEqual(studentFigure({ figure: ok }), ok));
  it("refuses any other host, a lookalike prefix, and junk", () => {
    for (const uri of ["https://evil.example/x.png", `${BOOK_FIGURE_BASE_URL}evil/x.png`, "javascript:alert(1)", 7]) {
      assert.equal(studentFigure({ figure: { uri, caption: "x" } }), null, String(uri));
    }
    assert.equal(studentFigure({}), null);
  });
});

describe("the student projection carries a checked figure", () => {
  const q = (figure: unknown) => ({ id: "q1", orderIndex: 0, type: "true_false", marks: "1", body: { statement: "س", figure } });
  it("keeps a book figure", () => assert.deepEqual(sanitizeQuestionForStudent(q(ok), "a1").body["figure"], ok));
  it("drops a foreign one", () => assert.equal(sanitizeQuestionForStudent(q({ uri: "https://evil.example/x.png", caption: "x" }), "a1").body["figure"], undefined));
});
```

- [ ] **Step 2: Run, expect fail** — `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/questionFigure.test.ts` → module not found.

- [ ] **Step 3: Implement.** `lib/curriculum/src/bookFigureBase.ts`:

```ts
/** Where the book figures cut from the NCCD student books are served (R2). One
 *  value for the app, which loads them, and the API, which refuses any other
 *  host in a question a student will see. */
export const BOOK_FIGURE_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/figures';
```

Export it from `lib/curriculum/src/index.ts` (`export * from './bookFigureBase.ts';`). In `artifacts/mobile/services/bookFigureUri.ts` replace the literal with `import { BOOK_FIGURE_BASE_URL } from '@workspace/curriculum'; export const FIGURE_BASE_URL = BOOK_FIGURE_BASE_URL;`.

`questionFigure.ts`:

```ts
import { BOOK_FIGURE_BASE_URL } from "@workspace/curriculum";

/** A teacher-attached book figure as a student may receive it, or null. The
 *  host check is what stops a question body from making students' phones load
 *  an arbitrary URL. */
export function studentFigure(body: Record<string, unknown>): { uri: string; caption: string } | null {
  const f = body["figure"] as Record<string, unknown> | undefined;
  const uri = typeof f?.["uri"] === "string" ? f["uri"] : "";
  const caption = typeof f?.["caption"] === "string" ? f["caption"].trim() : "";
  return uri.startsWith(`${BOOK_FIGURE_BASE_URL}/`) && caption ? { uri, caption } : null;
}
```

In `sanitizeQuestionForStudent`, before `return {`: `const figure = studentFigure(source); if (figure) body["figure"] = figure;`

- [ ] **Step 4: Run, expect pass**; also `pnpm test` in api-server (after `pnpm build`) and mobile.
- [ ] **Step 5: Commit** — `feat(assessment): a checked book figure reaches the student projection`.

### Task 2: The converter

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/fromWorksheet.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/fromWorksheet.test.ts`

**Interfaces:**
- Consumes: `QUESTION_TYPES` (`questionTypes.ts`), `normalizeArabic` (`normalize.ts`), `studentFigure` (Task 1).
- Produces:

```ts
export interface WorksheetInput {
  sections: { questions: { text: string; options?: string[]; points: number; figure?: { uri: string; caption: string } }[] }[];
  answerKey: { num: number; answer: string; solution?: string[] }[];
}
export interface ConvertedQuestion {
  type: "multiple_choice" | "true_false" | "fill_blank" | "short_answer";
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  marks: number;
}
export type ConvertResult =
  | { ok: true; questions: ConvertedQuestion[]; autoMarked: number; teacherMarked: number }
  | { ok: false; missingKey: number[] };   // 1-based paper numbers
export function convertWorksheet(ws: WorksheetInput): ConvertResult;
```

- [ ] **Step 1: Failing tests** — one per rule, each also asserting `QUESTION_TYPES[q.type].validate(q)` is `[]`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOOK_FIGURE_BASE_URL } from "@workspace/curriculum";
import { convertWorksheet, type WorksheetInput } from "../fromWorksheet.ts";
import { QUESTION_TYPES } from "../questionTypes.ts";

const one = (q: WorksheetInput["sections"][number]["questions"][number], answer: string, solution?: string[]) =>
  convertWorksheet({ sections: [{ questions: [q] }], answerKey: [{ num: 1, answer, ...(solution ? { solution } : {}) }] });
const only = (r: ReturnType<typeof convertWorksheet>) => {
  assert.ok(r.ok, JSON.stringify(r));
  const q = r.questions[0]!;
  assert.deepEqual(QUESTION_TYPES[q.type].validate({ ...q, rubric: null }), [], `${q.type} invalid`);
  return q;
};

describe("convertWorksheet", () => {
  it("multiple choice whose key matches an option → auto-marked by option id", () => {
    const q = only(one({ text: "أوجد x: 2^x = 8", options: ["x = 2", "x = 3", "x = 4", "x = 5"], points: 2 }, "x = 3"));
    assert.equal(q.type, "multiple_choice");
    assert.deepEqual(q.expectedAnswer, { optionIds: ["b"] });
    assert.equal(q.marks, 2);
  });
  it("matches through a baked-in option marker", () => {
    const q = only(one({ text: "س", options: ["أ) 6", "ب) 8", "ج) 9"], points: 1 }, "8"));
    assert.deepEqual(q.expectedAnswer, { optionIds: ["b"] });
  });
  it("صح / خطأ → true_false", () => {
    const q = only(one({ text: "العبارة 2^0 = 1 صحيحة.", options: ["صح", "خطأ"], points: 1 }, "صح"));
    assert.equal(q.type, "true_false");
    assert.deepEqual(q.expectedAnswer, { value: true });
    assert.equal(q.body["statement"], "العبارة 2^0 = 1 صحيحة.");
  });
  it("a plain-number or x = number key → fill_blank accepting both", () => {
    const q = only(one({ text: "حل 5^x = 25", points: 3 }, "x = 2"));
    assert.equal(q.type, "fill_blank");
    assert.match(String(q.body["template"]), /\{\{1\}\}$/);
    assert.deepEqual(q.expectedAnswer, { blanks: [{ accept: ["x = 2", "2"] }] });
  });
  it("fails closed to a teacher-marked short answer", () => {
    const cases: [Parameters<typeof one>[0], string][] = [
      [{ text: "س", options: ["1", "2", "3"], points: 1 }, "4"],                       // key matches no option
      [{ text: "س", options: ["نعم", "لا"], points: 1 }, "نعم"],                       // 2 options, not صح/خطأ
      [{ text: "اشرح لماذا", points: 2 }, "لأن الأساسين متساويان"],                   // Arabic key
      [{ text: "بسّط", points: 2 }, "2^(x+1)"],                                         // expression
      [{ text: "أكمل الحل:\n1) نكتب 9 = 3^2\n2) __________", points: 6 }, "x = 2"],     // half-solved
    ];
    for (const [q, a] of cases) assert.equal(only(one(q, a)).type, "short_answer", q.text);
  });
  it("keeps the working in the teacher's model answer", () => {
    const q = only(one({ text: "اشرح", points: 2 }, "ج", ["خطوة ١", "إذن ج"]));
    assert.equal(q.expectedAnswer["modelAnswer"], "ج\nخطوة ١\nإذن ج");
    assert.deepEqual(q.expectedAnswer["keyConcepts"], ["ج"]);
  });
  it("blocks a question with no key, naming it", () => {
    const r = convertWorksheet({ sections: [{ questions: [{ text: "أ", points: 1 }, { text: "ب", points: 1 }] }], answerKey: [{ num: 1, answer: "3" }] });
    assert.deepEqual(r, { ok: false, missingKey: [2] });
  });
  it("counts auto- and teacher-marked", () => {
    const r = convertWorksheet({
      sections: [{ questions: [{ text: "أ", options: ["صح", "خطأ"], points: 1 }, { text: "ب", points: 1 }] }],
      answerKey: [{ num: 1, answer: "خطأ" }, { num: 2, answer: "اشرح" }],
    });
    assert.ok(r.ok);
    assert.deepEqual([r.autoMarked, r.teacherMarked], [1, 1]);
  });
  it("carries a book figure and drops any other", () => {
    const fig = { uri: `${BOOK_FIGURE_BASE_URL}/a/p1.png`, caption: "ص ١" };
    assert.deepEqual(only(one({ text: "س", points: 1, figure: fig }, "3")).body["figure"], fig);
    assert.equal(only(one({ text: "س", points: 1, figure: { uri: "https://x.example/a.png", caption: "c" } }, "3")).body["figure"], undefined);
  });
});
```

- [ ] **Step 2: Run, expect fail** (module not found).
- [ ] **Step 3: Implement** `fromWorksheet.ts`:

```ts
import { normalizeArabic } from "./normalize.ts";
import { studentFigure } from "./questionFigure.ts";
// (types as in Interfaces above)

const ARABIC_LETTER = /[ء-ي]/;
const OPTION_MARKER = /^\s*(?:[ء-يa-dA-D]|\d{1,2})\s*[).:\-]\s+/;
const NUMERIC_KEY = /^\s*(?:([A-Za-z])\s*=\s*)?([-−]?[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?)\s*$/;
const BLANK_LINE = /^\s*(\(?[0-9٠-٩]+[).]?)?\s*_{5,}\s*$/m;
const IDS = "abcdefghij";
const TRUE = ["صح", "صحيح", "true"], FALSE = ["خطأ", "خطا", "false"];

const key = (s: string) => normalizeArabic(s.replace(OPTION_MARKER, ""));

export function convertWorksheet(ws: WorksheetInput): ConvertResult {
  const flat = ws.sections.flatMap(s => s.questions);
  const missingKey = flat.map((_, i) => i + 1)
    .filter(n => !ws.answerKey.find(k => k.num === n)?.answer?.trim());
  if (missingKey.length) return { ok: false, missingKey };

  const questions = flat.map((q, i): ConvertedQuestion => {
    const entry = ws.answerKey.find(k => k.num === i + 1)!;
    const answer = entry.answer.trim();
    const figure = studentFigure(q as unknown as Record<string, unknown>);
    const withFigure = (body: Record<string, unknown>) => (figure ? { ...body, figure } : body);
    const options = q.options ?? [];
    const marks = q.points > 0 ? q.points : 1;

    const tf = options.length === 2 && [options[0]!, options[1]!].map(o => key(o)).every(o => [...TRUE, ...FALSE].map(key).includes(o));
    if (tf && [...TRUE, ...FALSE].map(key).includes(key(answer))) {
      return { type: "true_false", body: withFigure({ statement: q.text }), expectedAnswer: { value: TRUE.map(key).includes(key(answer)) }, marks };
    }
    const hit = options.findIndex(o => key(o) === key(answer));
    if (options.length >= 3 && options.length <= IDS.length && hit >= 0) {
      return {
        type: "multiple_choice",
        body: withFigure({ stem: q.text, options: options.map((o, j) => ({ id: IDS[j], text: o.replace(OPTION_MARKER, "").trim() })) }),
        expectedAnswer: { optionIds: [IDS[hit]] },
        marks,
      };
    }
    const num = NUMERIC_KEY.exec(answer);
    if (options.length === 0 && num && !BLANK_LINE.test(q.text)) {
      const accept = num[1] ? [answer, num[2]!] : [answer];
      return { type: "fill_blank", body: withFigure({ template: `${q.text}\nالإجابة: {{1}}` }), expectedAnswer: { blanks: [{ accept }] }, marks };
    }
    return {
      type: "short_answer",
      body: withFigure({ prompt: q.text }),
      expectedAnswer: { modelAnswer: [answer, ...(entry.solution ?? [])].join("\n"), keyConcepts: [answer] },
      marks,
    };
  });
  const autoMarked = questions.filter(q => q.type !== "short_answer").length;
  return { ok: true, questions, autoMarked, teacherMarked: questions.length - autoMarked };
}
```

(The `ARABIC_LETTER` guard is implied by `NUMERIC_KEY`, which admits no letter but a single Latin variable; keep the constant only if a test needs it — otherwise delete it before committing.)

- [ ] **Step 4: Run, expect pass**; fix until every rule passes **without** loosening a test.
- [ ] **Step 5: Commit** — `feat(assessment): convert a worksheet into evaluation questions`.

### Task 3: The route

**Files:**
- Modify: `artifacts/api-server/src/routes/evaluations.ts` (new route after `POST /evaluations`; it is under the existing `/evaluations` teacher middleware)
- Modify: `lib/db/src/schema/evaluations.ts:169` — `$type<"mock" | "llm" | "worksheet">()`
- Create: `artifacts/api-server/src/modules/assessment/worksheetRequest.ts` (pure body parsing, testable)
- Test: `artifacts/api-server/src/modules/assessment/__tests__/worksheetRequest.test.ts`

**Interfaces:**
- Consumes: `convertWorksheet` (Task 2), `getObjectiveById` + `getBookById` (`@workspace/curriculum`), `competencyForBlooms` (`competency.ts`), `findLiveClass` (`lib/classOwnership.js`), `QUESTION_TYPES`.
- Produces: `POST /evaluations/from-worksheet` → `201 { evaluation, autoMarked, teacherMarked }`; `400 { error, missingKey? }`; `404` class; `409 { code: 'no_level_scale' }`. And `parseWorksheetRequest(body: unknown): { ok: true; value: { worksheet: WorksheetInput; objectiveId: string; classGroupId: string; title: string; language: string } } | { ok: false; error: string }`.

- [ ] **Step 1: Failing test** for `parseWorksheetRequest`: rejects a missing/empty `sections`, a question without `text`, non-numeric `points`, missing `objectiveId`/`classGroupId`, more than 50 questions; accepts a minimal valid body and trims strings.
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement** `parseWorksheetRequest` (plain checks, no new dependency), then the route:

```ts
router.post("/evaluations/from-worksheet", async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = parseWorksheetRequest(req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const { worksheet, objectiveId, classGroupId, title, language } = parsed.value;
    const objective = getObjectiveById(objectiveId);
    const book = objective ? getBookById(objective.bookId) : undefined;
    if (!objective || !book) { res.status(400).json({ error: "Unknown objective" }); return; }
    if (!(await findLiveClass(classGroupId, req.user!.id))) { res.status(404).json({ error: "Class not found" }); return; }
    const converted = convertWorksheet(worksheet);
    if (!converted.ok) { res.status(400).json({ error: "Some questions have no answer in the key", missingKey: converted.missingKey }); return; }
    const [defaultScale] = await db.select({ id: levelScales.id }).from(levelScales)
      .where(and(eq(levelScales.scope, "system"), eq(levelScales.isDefault, true))).limit(1);
    if (!defaultScale) { res.status(409).json({ error: "No level scale is configured.", code: "no_level_scale" }); return; }
    const competencyKey = competencyForBlooms(objective.effectiveBloomsLevel);
    const total = converted.questions.reduce((s, q) => s + q.marks, 0);
    const evaluation = await db.transaction(async tx => {
      const [row] = await tx.insert(evaluations).values({
        teacherId: req.user!.id, title, titleAr: title,
        gradeId: book.gradeId, subjectId: book.subjectId, bookId: book.id,
        unitId: objective.unitId, lessonId: objective.lessonId,
        objectiveIds: [objectiveId], difficulty: "standard",
        targetQuestionCount: converted.questions.length,
        assessmentTypes: [...new Set(converted.questions.map(q => q.type))],
        language: book.subjectId === "english" ? "en" : language,
        levelScaleId: defaultScale.id, classGroupId,
        generator: "worksheet", generationParams: { fromWorksheet: true },
        totalMarks: total.toFixed(2),
      }).returning();
      await tx.insert(evaluationQuestions).values(converted.questions.map((q, i) => ({
        evaluationId: row!.id, orderIndex: i, type: q.type, body: q.body, expectedAnswer: q.expectedAnswer,
        rubric: null, objectiveId, competencyKey, marks: q.marks.toFixed(2), difficulty: "standard" as const,
        gradingMode: QUESTION_TYPES[q.type].defaultGradingMode, source: "teacher" as const,
      })));
      return row!;
    });
    res.status(201).json({ evaluation, autoMarked: converted.autoMarked, teacherMarked: converted.teacherMarked });
  } catch (err) {
    logger.error({ err }, "evaluation from worksheet failed");
    res.status(500).json({ error: "Failed to send the worksheet" });
  }
});
```

Before inserting, assert in code that every converted question passes `QUESTION_TYPES[q.type].validate` and return 400 with the problems if not (the converter test proves it, the route must not trust it blindly).

- [ ] **Step 4:** `pnpm --filter @workspace/db run generate` → no new file in `lib/db/migrations/`. `cd artifacts/api-server && pnpm build && pnpm test` → green (mount-order included). `pnpm run typecheck` → clean.
- [ ] **Step 5: Commit** — `feat(api): POST /evaluations/from-worksheet`.

### Task 4: Client call and the objective list

**Files:**
- Modify: `artifacts/mobile/services/evaluations.ts` — `createEvaluationFromWorksheet`
- Create: `artifacts/mobile/services/worksheetAssignment.ts` — `lessonObjectivesForSend(lessonId)` and `classesForSend(classes, gradeId, subjectId)`
- Test: `artifacts/mobile/services/__tests__/worksheetAssignment.test.ts`

**Interfaces:**
- Produces: `createEvaluationFromWorksheet(input: { worksheet: { title: string; sections: …; answerKey: … }; objectiveId: string; classGroupId: string; title: string; language: 'ar' | 'en' }): Promise<{ evaluation: Evaluation; autoMarked: number; teacherMarked: number }>`; on 400 with `missingKey` it throws an `Error` whose message names the numbers. `lessonObjectivesForSend(lessonId: string | undefined): CurriculumObjective[]` (empty when the lesson has none). `classesForSend<T extends { gradeId: string; subjectId: string; subjectIds?: string[] }>(classes: T[], gradeId: string, subjectId: string): T[]` — classes matching grade+subject first, then the rest (never empty when the teacher has a class).

- [ ] **Step 1: Failing tests:** `lessonObjectivesForSend('kbl-math-s1-nccd-u3_l1')` returns ids starting `o-nccd-s1-u3_l1-` (4 of them, checked 2026-10-09), all `bookId === 'book-math-10'`; `lessonObjectivesForSend(undefined)` → `[]`; `classesForSend` orders matching classes first and keeps the rest.
- [ ] **Step 2–4:** implement with `getObjectivesForUnit` filtered by `lessonId` (via `@workspace/curriculum`), run, pass.
- [ ] **Step 5: Commit** — `feat(mobile): client and helpers for sending a worksheet`.

### Task 5: The send sheet and its two entry points

**Files:**
- Create: `artifacts/mobile/components/ui/SendWorksheetSheet.tsx` (Modal; no text input, so no `KeyboardSafeView`)
- Modify: `artifacts/mobile/app/ai-tools/worksheet.tsx` (button in the result actions area, beside «اعرض على الشاشة»)
- Modify: `artifacts/mobile/app/workspace/view.tsx` (button for `kind === 'worksheet'`)
- Modify: `artifacts/mobile/services/i18n.ts` (ar + en)

**Interfaces:**
- Consumes: Task 4 helpers, `listClasses()` (`services/roster.ts`).
- Produces: `<SendWorksheetSheet visible worksheet lessonId gradeId subjectId title language onClose onSent={(evaluationId, counts) => …} />`.

- [ ] **Step 1:** Sheet lists classes (from `classesForSend`), the lesson's objectives (preselected when exactly one), a note «المثال المحلول لا يُرسَل — هو للدراسة»; «أرسل» disabled until both are chosen. No lesson → the entry button is disabled with «اختر درسًا من المنهاج لإرسال الورقة».
- [ ] **Step 2:** On success: toast «أُرسلت إلى الصف: N تُصحَّح تلقائيًا، M يصحّحها المعلّم» and `router.push('/evaluations/' + id)`. On `missingKey`: inline «السؤال ٤ بلا إجابة في المفتاح — أكمِل المفتاح ثم أرسل». On `no_level_scale`: the same message `evaluations/new.tsx` shows.
- [ ] **Step 3:** Strings: `sendToClass`, `sendToClassTitle`, `sendToClassClass`, `sendToClassObjective`, `sendToClassWorkedExampleNote`, `sendToClassNoLesson`, `sendToClassSent`, `sendToClassMissingKey` — ar with «ًا», en.
- [ ] **Step 4:** `pnpm run typecheck`, mobile `pnpm test` (includes `designScale` and `i18n terminology`).
- [ ] **Step 5: Commit** — `feat(mobile): send a worksheet to a class as a digital assignment`.

### Task 6: Figure on the take screen, docs, and the end-to-end check

**Files:**
- Modify: `artifacts/mobile/app/take/[code].tsx` — under the prompt in `QuestionCard`, render `question.body.figure` (`expo-image`, caption under it); when a question has its own figure, skip the lesson-level `BookFiguresPanel` for it (`examFigures` at ~L653).
- Modify: `docs/superpowers/specs/2026-10-09-worksheet-to-class-assignment-design.md` — counts shown after sending (the deviation above).
- Modify: `STATUS.md` — new dated entry.

- [ ] **Step 1:** Implement the figure; typecheck.
- [ ] **Step 2: Drive it in the web build** (Expo web, API on :8080 with a seeded local Postgres — `LOCAL_SETUP.md`; if no database is available here, say so and verify only what the stubbed build can show: the sheet, the request body, the error paths). Path: generate «النسب المثلثية» worksheet → attach a figure → send to a class → publish → open `/take/<code>` as a student → answer an MC, a numeric and a short answer → submit → teacher view shows two auto-marked, one waiting.
- [ ] **Step 3:** STATUS entry (what, where, how verified, what was not); spec note.
- [ ] **Step 4:** Full checks: `pnpm run typecheck`; mobile `pnpm test`; api-server `pnpm build && pnpm test`; `pnpm --filter @workspace/db run generate` → no migration.
- [ ] **Step 5: Commit, push, open the draft PR**, subscribe.
