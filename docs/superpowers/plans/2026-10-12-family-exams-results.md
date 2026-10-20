# Exams & results (Part 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Read first — no migration, and five places where the plan adapts the controller's decisions to the code:**

- **No migration is needed.** Evidence: `evaluations.exam_date` / `exam_time` already exist (`lib/db/src/schema/evaluations.ts:174-175`, migration `0006`, PR #1017); a paper exam is already ordinary `evaluation_questions` rows (`type: open_ended`, `body: {}`, `grading_mode: manual` — `routes/evaluations.ts:1032-1089`); a typed total is an ordinary `attempt_question_grades` row (`awarded_marks numeric(5,2)`) plus `attempt_results`; the release flag (`release_results_to_student`) and `attempts.source` exist; the new family state `paper` is a TypeScript union member, not a database enum; "is paper" is derived from the questions at read time. **No task in this plan touches `lib/db/src/schema` or `lib/db/migrations/`.** If an implementer finds they need to, they stop and report.
- **D2:** the School tab's child picker is keyed by `groupChildren` keys, but `/parent/exams` lists one entry per *roster row* with no key. Task 2 adds an additive `key` field to each `/parent/exams` entry (same grouping as `/parent/homework`). No new route.
- **D4:** chosen shape is a **new state value `"paper"`** plus a `paper: boolean` on every row. Rationale and the old-client cost are under Risks in Task 10.
- **D5:** there are **no existing tests** for `POST /evaluations/:id/attempts`, `PUT /attempts/:id/grades` or `POST /attempts/:id/submit` (only a `mountOrder` 401 case). Task 3 therefore writes characterisation tests on a real database *first*, then extracts the shared code. Also: `ownedEvaluation` does not check `archivedAt` and does not guard a malformed id (it would 500); the new route adds both itself.
- **D6:** marks may carry two decimals (`numeric(5,2)`, rounded by `normalizeManualMarks`), and **a quick paper exam's total N is at most 100** (`MAX_MARKS_PER_QUESTION` in `modules/assessment/paperExam.ts`, enforced by `PUT …/questions/paper`). The «مجموع فقط» form says so.
- **D3:** the card does know the class (the evaluation screen passes the whole `Evaluation`), so the hint is built; a second, one-line hint for a dated **draft** is added too (families see no draft).

**Goal:** Families see each exam's planned date and an "upcoming exams" list, paper exams stop offering a link, and a teacher types one total per student for a paper exam in a class mark book whose marks become real, release-gated results.

**Architecture:** Server: the family exam row builder (`modules/assessment/studentExams.ts`) gains the date and a `paper` state; `examRowsFor` reads the date and derives "paper" from the live questions. Teacher entry (find-or-create a `teacher_entry` sitting, write one hand mark) moves out of two route handlers into `lib/teacherEntry.ts` behind characterisation tests, and a new bulk route `PUT /evaluations/:id/paper-totals` (`lib/paperTotals.ts`, pure rules in `modules/assessment/paperTotals.ts`) reuses it and finalises each sitting through `gradeSubmission`. Mobile: pure logic in `services/upcomingExams.ts` and `services/paperMarks.ts` (tested), screens in `app/(tabs)/school.tsx`, `app/my-exams.tsx`, `app/evaluations/[id]/marks.tsx` (new), `app/evaluations/new.tsx`.

**Tech Stack:** Express + Drizzle (Postgres) in `artifacts/api-server`, DB test harness (`src/test-support/`), Expo / React Native (RTL, Arabic-first) in `artifacts/mobile`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-11-family-school-views-design.md` (section "3. Exams & results", plus "Testing" and "Risks"). Task 10 rewrites section 3 as built and corrects its `/student/grades` reference (that route returns curriculum grade ids, not marks).

## Global Constraints

- Branch `claude/brave-einstein-qxpxc3`, draft PR #1007. **Implementers commit only — never push, never edit the PR.** The controller pushes.
- **No schema change, no migration** (see the top of this plan).
- Every guard is path-scoped; never a bare `router.use(mw)`. The new route lives in `routes/evaluations.ts`, which is already behind `router.use("/evaluations", authMiddleware, requireRole(...TEACHER_ROLES))`.
- Same 404 body for "not yours", "missing", "malformed id" and "archived": `{ "error": "Evaluation not found" }`.
- Files loaded by `node --test` use explicit `.ts` extensions in relative imports; new api-server files use `.ts` extensions (as `lib/familyAccess.ts` does). `@workspace/db` cannot be imported by a unit-tested file (type-only imports are fine).
- DB-touching behaviour is tested through the harness (`describeDb`, raw-SQL seed, built bundle). Run api-server tests after `pnpm build`.
- Mobile tests only run from `artifacts/mobile/services/__tests__/` and cannot import `react-native` / `expo-*` / `apiClient.ts`; fetchers stay out of tested files.
- **An exam day is the text `examDate` ("YYYY-MM-DD", no zone).** Compare it as a string against `ammanToday()` (`services/homework.ts`); **never** `new Date(examDate)` and never `toISOString()` an exam date.
- `verified` is not involved anywhere here; do not set it.
- Families see a mark only when `releaseResultsToStudent` is on **and** the sitting is handed in (`submittedAt`) **and** the result is not provisional — the existing `studentResultReady` rule, unchanged.
- Mobile design ratchets (`designScale.test.ts`): new spacing/type/radius from `SPACE` / `TYPE` / `RADIUS`; never raise a ceiling. `aria-selected` / `aria-checked` on toggles, never `accessibilityState` (`ariaState.test.ts`). No `KeyboardAvoidingView` in a screen; any `<Modal>` holding a text input wraps its body in `KeyboardSafeView` (this plan adds no modal).
- `i18n.test.ts` green: every new key in both `ar` and `en`, same placeholder functions. Arabic is the source; English a faithful translation.
- Typed digits go through `toLatinDigits` (`services/latinDigits.ts`); also fold the Arabic decimal separator «٫» and «,» to «.».
- Commit trailers per the session attribution reminder. Do not name a model in code, comments or docs.
- Out of scope (Part 4): any push for exam scheduled/changed, any push for marks saved after release, reminders.

## File Structure

| Path | Responsibility |
| --- | --- |
| `artifacts/api-server/src/modules/assessment/studentExams.ts` | row builder: `examDate`, `examTime`, `paper`, state `"paper"`, no link on paper |
| `artifacts/api-server/src/modules/assessment/paperExam.ts` | `isPaperExam`, `isQuickPaperExam`, `paperExamIds` (pure) |
| `artifacts/api-server/src/routes/studentExams.ts` | `examRowsFor` reads date + paper; `/parent/exams` entries carry `key` |
| `artifacts/api-server/src/test-support/http.ts` (new) | `call()` helper shared by the new DB tests |
| `artifacts/api-server/src/test-support/seedExams.ts` (new) | exam fixture on top of `seedFamilyWorld` |
| `artifacts/api-server/src/routes/__tests__/familyExams.db.test.ts` (new) | family exam list on a real DB |
| `artifacts/api-server/src/lib/teacherEntry.ts` (new) | `loadAttemptTemplate`, `findOrStartTeacherEntry`, `writeTeacherMark` |
| `artifacts/api-server/src/routes/__tests__/teacherEntry.db.test.ts` (new) | characterisation of the three teacher-entry routes |
| `artifacts/api-server/src/modules/assessment/paperTotals.ts` (new) | pure: body parser, row result types, clear rule, refusal copy |
| `artifacts/api-server/src/lib/paperTotals.ts` (new) | DB: `savePaperTotals` |
| `artifacts/api-server/src/routes/evaluations.ts` | `PUT /evaluations/:id/paper-totals`; the two teacher-entry handlers call `lib/teacherEntry.ts` |
| `artifacts/api-server/src/routes/attempts.ts` | `PUT /attempts/:id/grades` calls `writeTeacherMark` |
| `artifacts/api-server/src/routes/__tests__/paperTotals.db.test.ts` (new) | the bulk route on a real DB |
| `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` | 401 case for the new route |
| `artifacts/mobile/services/myExams.ts` | `MyExam` date/paper fields, state `paper`, `ChildExams.key` |
| `artifacts/mobile/services/upcomingExams.ts` (new) | pure: upcoming filter/sort, child grouping, date labels |
| `artifacts/mobile/services/paperMarks.ts` (new) | pure: mark parsing, grid rows, request/response, quick-paper checks |
| `artifacts/mobile/services/evaluations.ts` | `savePaperTotals` fetcher |
| `artifacts/mobile/services/i18n.ts` | new keys, ar + en |
| `artifacts/mobile/app/(tabs)/school.tsx` | «الاختبارات القادمة» section |
| `artifacts/mobile/app/my-exams.tsx` | date/time on rows, `paper` state |
| `artifacts/mobile/components/ExamDateCard.tsx` | no-class / draft hints |
| `artifacts/mobile/app/evaluations/new.tsx` | «مجموع فقط» option |
| `artifacts/mobile/app/evaluations/[id]/marks.tsx` (new) | class mark book |
| `artifacts/mobile/app/evaluations/[id]/index.tsx`, `app/evaluations/[id]/answers/index.tsx` | entry points; no share code on a paper exam |
| `STATUS.md`, spec, `CLAUDE.md` (only if a real trap) | Task 10 |

---

### Task 1: Family exam rows carry the date, and a paper exam offers no link (API, pure)

**Files:**
- Modify: `artifacts/api-server/src/modules/assessment/studentExams.ts`
- Modify: `artifacts/api-server/src/modules/assessment/paperExam.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/studentExams.test.ts`, `artifacts/api-server/src/modules/assessment/__tests__/paperExam.test.ts`

**Interfaces:**
- Consumes: `isPaperQuestion(q: { gradingMode: string; body: Record<string, unknown> | null | undefined }): boolean` (already in `paperExam.ts`).
- Produces (`studentExams.ts`):
  - `ExamForStudent` gains optional `examDate?: string | null`, `examTime?: string | null`, `paper?: boolean` (absent reads as `null` / `null` / `false`, so existing callers and tests keep compiling).
  - `type StudentExamState = "available" | "in_progress" | "submitted" | "result" | "closed" | "paper"`.
  - `StudentExamRow` gains `examDate: string | null`, `examTime: string | null`, `paper: boolean`.
- Produces (`paperExam.ts`):
  - `isPaperExam(questions: readonly PaperQuestionShape[]): boolean` — at least one question and every one `isPaperQuestion`.
  - `isQuickPaperExam(questions: readonly PaperQuestionShape[]): boolean` — exactly one question and it `isPaperQuestion`.
  - `paperExamIds(rows: readonly ({ evaluationId: string } & PaperQuestionShape)[]): Set<string>` — the evaluation ids whose live questions are all paper questions.
  - `type PaperQuestionShape = { gradingMode: string; body: Record<string, unknown> | null | undefined }`.

- [ ] **Step 1: Write the failing tests.** Append to `studentExams.test.ts` (it already has `exam()`, `rowOf()`, `RESULT`, `NOW`):

```ts
describe("the planned day", () => {
  it("carries the exam's date and time onto the row", () => {
    const row = rowOf(exam({ examDate: "2026-10-20", examTime: "09:30" }), null, null, NOW);
    assert.equal(row.examDate, "2026-10-20");
    assert.equal(row.examTime, "09:30");
  });

  it("reads an exam that was never dated as null, not undefined", () => {
    const row = rowOf(exam(), null, null, NOW);
    assert.equal(row.examDate, null);
    assert.equal(row.examTime, null);
  });

  it("does not let a date list a draft", () => {
    assert.equal(studentExamRow(exam({ status: "draft", examDate: "2026-10-20" }), null, null, NOW), null);
  });
});

describe("a paper exam", () => {
  it("never offers a link once a student has handed one in", () => {
    // Pins the `!paper &&` in offerLink: without it a handed-in student_link sitting on a paper exam could re-open a link.
    // (Adapt the attempt literal to the helper's real signature in this file.)
    const row = rowOf(exam({ paper: true }), { status: "graded", startedAt: NOW, submittedAt: NOW, source: "student_link" }, null, NOW);
    assert.equal(row.state, "submitted");
    assert.equal(row.shareCode, null);
  });

  it("is 'paper' with no link while nothing is marked", () => {
    const row = rowOf(exam({ paper: true }), null, null, NOW);
    assert.equal(row.state, "paper");
    assert.equal(row.shareCode, null);
    assert.equal(row.paper, true);
  });

  it("stays 'paper' while the teacher is typing it in, with no deadline", () => {
    const row = rowOf(
      exam({ paper: true, timeLimitMin: 20 }),
      { status: "in_progress", startedAt: NOW, submittedAt: null, source: "teacher_entry" },
      null,
      NOW,
    );
    assert.equal(row.state, "paper");
    assert.equal(row.deadlineAt, null);
    assert.equal(row.shareCode, null);
  });

  it("is 'paper', not 'closed', once its link has expired", () => {
    const row = rowOf(exam({ paper: true, shareCodeExpiresAt: new Date("2026-10-02T00:00:00Z") }), null, null, NOW);
    assert.equal(row.state, "paper");
  });

  it("waits for the release once marked, then shows the mark", () => {
    const sitting = { status: "graded", startedAt: NOW, submittedAt: NOW, source: "teacher_entry" };
    const waiting = rowOf(exam({ paper: true, releaseResultsToStudent: false }), sitting, RESULT, NOW);
    assert.equal(waiting.state, "submitted");
    assert.equal(waiting.result, null);
    const shown = rowOf(exam({ paper: true, releaseResultsToStudent: true }), sitting, RESULT, NOW);
    assert.equal(shown.state, "result");
    assert.equal(shown.result?.earnedMarks, 8);
  });

  it("is never paper unless the exam says so", () => {
    assert.equal(rowOf(exam(), null, null, NOW).paper, false);
  });

  it("sorts after what the student can open now", () => {
    const sorted = sortStudentExams([
      rowOf(exam({ id: "p", paper: true }), null, null, NOW),
      rowOf(exam({ id: "a" }), null, null, NOW),
    ]);
    assert.deepEqual(sorted.map(r => r.evaluationId), ["a", "p"]);
  });
});
```

Append to `paperExam.test.ts` (extend its import with `isPaperExam, isQuickPaperExam, paperExamIds`):

```ts
const PAPER = { gradingMode: "manual", body: {} };
const TYPED = { gradingMode: "manual", body: { prompt: "Explain" } };
const MCQ = { gradingMode: "deterministic", body: { stem: "2+2?" } };

describe("isPaperExam / isQuickPaperExam", () => {
  it("needs every question to be on paper, and at least one", () => {
    assert.equal(isPaperExam([PAPER, PAPER]), true);
    assert.equal(isPaperExam([PAPER, MCQ]), false);
    assert.equal(isPaperExam([TYPED]), false);
    assert.equal(isPaperExam([]), false);
  });
  it("is quick only with exactly one paper question", () => {
    assert.equal(isQuickPaperExam([PAPER]), true);
    assert.equal(isQuickPaperExam([PAPER, PAPER]), false);
    assert.equal(isQuickPaperExam([MCQ]), false);
    assert.equal(isQuickPaperExam([]), false);
  });
});

describe("paperExamIds", () => {
  it("names the exams whose questions are all on paper", () => {
    const ids = paperExamIds([
      { evaluationId: "a", ...PAPER },
      { evaluationId: "a", ...PAPER },
      { evaluationId: "b", ...PAPER },
      { evaluationId: "b", ...MCQ },
      { evaluationId: "c", ...MCQ },
    ]);
    assert.deepEqual([...ids].sort(), ["a"]);
  });
});
```

- [ ] **Step 2: Run to verify failure.**
Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/studentExams.test.ts src/modules/assessment/__tests__/paperExam.test.ts`
Expected: FAIL (`examDate` undefined, `isPaperExam` not exported).

- [ ] **Step 3: Implement `paperExam.ts` additions** (append after `isPaperQuestion`):

```ts
export type PaperQuestionShape = {
  gradingMode: string;
  body: Record<string, unknown> | null | undefined;
};

/**
 * An exam sat on paper: every live question is a paper question. A family is
 * never offered its link — `/take/:code` would open a paper with nothing on it.
 * No column says "paper"; the question shape does, so this is the one rule.
 */
export function isPaperExam(questions: readonly PaperQuestionShape[]): boolean {
  return questions.length > 0 && questions.every(isPaperQuestion);
}

/** A paper exam marked as one total per student: a single paper question worth N. */
export function isQuickPaperExam(questions: readonly PaperQuestionShape[]): boolean {
  return questions.length === 1 && isPaperQuestion(questions[0]!);
}

/** Which of these exams are paper exams, from their live question rows. */
export function paperExamIds(rows: readonly ({ evaluationId: string } & PaperQuestionShape)[]): Set<string> {
  const allPaper = new Map<string, boolean>();
  for (const r of rows) allPaper.set(r.evaluationId, (allPaper.get(r.evaluationId) ?? true) && isPaperQuestion(r));
  return new Set([...allPaper].filter(([, paper]) => paper).map(([id]) => id));
}
```

- [ ] **Step 4: Implement `studentExams.ts`.** Add the three optional fields to `ExamForStudent` (with a doc comment: date/time are planning text from PR #1017; `paper` is `isPaperExam` over the live questions, computed by the loader). Add `"paper"` to `StudentExamState` and extend its doc comment: "`paper`: sat on paper in class; nothing to open, no mark yet." Add the three fields to `StudentExamRow`. Replace the body of `studentExamRow` after the draft check with:

```ts
  const paper = exam.paper === true;
  const open = linkIsOpen(exam, now);
  const handedIn = Boolean(sitting?.submittedAt);
  const released = handedIn && studentResultReady({ released: exam.releaseResultsToStudent, result: result ?? undefined });

  let state: StudentExamState;
  if (released) state = "result";
  else if (handedIn) state = "submitted";
  // Sat in the classroom: nothing to open and nothing to "close" — it waits
  // for the teacher's marks, whatever the link would say.
  else if (paper) state = "paper";
  else if (!open) state = "closed";
  else state = sitting ? "in_progress" : "available";

  const studentsOwn = !sitting || (sitting.source ?? "student_link") === "student_link";
  // Never a link to a paper exam: publishing issued a code, but the paper has no questions to show.
  const offerLink = !paper && open && studentsOwn && (state === "available" || state === "in_progress" || state === "submitted");
```

and add to the returned object, after `publishedAt`:

```ts
    examDate: exam.examDate ?? null,
    examTime: exam.examTime ?? null,
    paper,
```

Add `paper: 2,` to `STATE_ORDER`. Update the file's header comment with one bullet: "**No link to a paper exam** (`paper`), and its own state, `paper`, until it is marked."

- [ ] **Step 5: Run to verify pass.** Same command → all pass (old cases included). Then `pnpm run typecheck` from the repo root → clean.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/modules/assessment
git commit -m "feat(api): family exam rows carry the planned day; a paper exam offers no link"
```

---

### Task 2: Exam fixture, and the family exam lists over a real database

**Files:**
- Create: `artifacts/api-server/src/test-support/http.ts`, `artifacts/api-server/src/test-support/seedExams.ts`
- Modify: `artifacts/api-server/src/routes/studentExams.ts`
- Test: `artifacts/api-server/src/routes/__tests__/familyExams.db.test.ts`

**Interfaces:**
- Consumes: Task 1's `paperExamIds`, the new `ExamForStudent` fields; `groupChildren` (`modules/family/children.ts`); `seedFamilyWorld`, `FamilyWorld`, `CHILDREN` (`test-support/seedFamilies.ts`).
- Produces:
  - `call(server: TestServer, method: string, path: string, userId?: string, body?: unknown): Promise<{ status: number; text: string; json: any }>` in `test-support/http.ts`.
  - `seedExams(pool: Pool, w: FamilyWorld): Promise<ExamWorld>`, `EX_TITLES`, `ExamKey`, `ammanDay(offsetDays: number, now?: Date): string`, `ZAIN`, `ExamWorld` (shape below) in `test-support/seedExams.ts`. **Tasks 3 and 5 seed with this.**
  - HTTP: every `/student/exams` and `/parent/exams` row carries `examDate`, `examTime`, `paper`; `/parent/exams` entries are `{ key, studentId, displayName, exams }` where `key` is the `groupChildren` key of that roster row (the same key `/parent/homework` and `/parent/schedule` use).

- [ ] **Step 1: Write `test-support/http.ts`.**

```ts
/**
 * One HTTP call to a test server, as a given user (or none). A body, when
 * given, goes as JSON. Shared by the DB-backed route tests.
 */
import { accessToken } from "./tokens.ts";
import type { TestServer } from "./startServer.ts";

export interface CallResult {
  status: number;
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}

export async function call(
  server: TestServer,
  method: string,
  path: string,
  userId?: string,
  body?: unknown,
): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (userId) headers["Authorization"] = `Bearer ${accessToken(userId)}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${server.base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}
```

- [ ] **Step 2: Write `test-support/seedExams.ts`.** Read `lib/db/src/schema/evaluations.ts`, `attempts.ts` and `assessmentConfig.ts` first; the SQL below sets every NOT NULL column without a default. Rows:

| key | teacher | class | status | questions | day / time | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `exDated` | t1 | c1 | published | 1 digital (10) | +5 / 09:30 | code `EXDAT1` — family A, student A gets the link |
| `exDraftDated` | t1 | c1 | draft | none | +4 / 10:00 | must reach nobody |
| `exNoClass` | t1 | — | published | 1 digital (10) | +4 | code `EXNOC1` — must reach nobody |
| `exC3` | t1 | c3 | published | 1 digital (10) | +6 | code `EXC3B1` — family B (Noor) only |
| `exPaper` | t1 | c1 | published | 1 paper (20) | +3 / 08:00 | code `EXPAP1` — the quick paper exam |
| `exPaperMulti` | t1 | c1 | published | 2 paper (10 + 10) | — | code `EXPAP2` |
| `exPaperDraft` | t1 | c1 | draft | 1 paper (20) | — | |
| `exPaperNoClass` | t1 | — | published | 1 paper (20) | — | code `EXPAP3` |
| `exPaperArchived` | t1 | c1 | closed, archived | 1 paper (20) | — | code `EXPAP4` |
| `exGroup` | t1 | c1 | published | 1 paper (20) | — | code `EXGRP1`; a group check for Adam (`aA`) only |
| `exNoScale` | t1 | c1 | published, **no level scale** | 1 paper (20) | — | code `EXNSC1` |
| `exEmpty` | t1 | c1 | published | none | — | code `EXEMP1` |
| `exReleased` | t1 | c1 | published, **released** | 1 digital (10) | −2 | Sara (`sA1`) handed in, 8/10 final; Adam (`aA`) handed in, provisional |
| `exUnreleased` | t1 | c1 | published, not released | 1 digital (10) | −1 | code `EXUNR1`; Sara handed in, 9/10 final |

Plus Zain («زين»): a third roster row of t1 in c1 with no account, holding an unsubmitted `student_link` sitting on `exPaper` with one recorded answer (for the "never clear a student's own work" rule).

```ts
/**
 * Exams on top of the family world (seedFamilies.ts): one row per rule the
 * family exam lists and the class mark book must keep. Raw SQL, like the other
 * fixtures — tests state the rows they depend on, and @workspace/db cannot load
 * under node --test. Exam days are Amman calendar days computed from the clock
 * (Amman is a fixed UTC+3), so "upcoming" rows stay upcoming whenever this runs.
 */
import type { Pool } from "pg";

import type { FamilyWorld } from "./seedFamilies.ts";

/** Unique titles (`title` and `title_ar`), so a test can find a row, or prove it absent, by title. */
export const EX_TITLES = {
  exDated: "ex-dated-c1",
  exDraftDated: "ex-draft-dated-c1",
  exNoClass: "ex-dated-no-class",
  exC3: "ex-dated-c3-family-b",
  exPaper: "ex-quick-paper-c1",
  exPaperMulti: "ex-paper-two-questions-c1",
  exPaperDraft: "ex-quick-paper-draft-c1",
  exPaperNoClass: "ex-quick-paper-no-class",
  exPaperArchived: "ex-quick-paper-archived-c1",
  exGroup: "ex-quick-paper-group-adam",
  exNoScale: "ex-quick-paper-no-scale",
  exEmpty: "ex-no-questions-c1",
  exReleased: "ex-released-c1",
  exUnreleased: "ex-unreleased-c1",
} as const;
export type ExamKey = keyof typeof EX_TITLES;

export const ZAIN = "زين";

/** The Amman calendar day `offsetDays` from today, as YYYY-MM-DD. */
export function ammanDay(offsetDays: number, now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export interface ExamWorld {
  scaleId: string;
  exams: Record<ExamKey, string>;
  /** Live question ids. */
  questions: {
    exDated: string;
    exPaper: string;
    exPaperMulti: [string, string];
    exGroup: string;
    exNoScale: string;
    exReleased: string;
    exUnreleased: string;
  };
  dates: { exDated: string; exDraftDated: string; exNoClass: string; exC3: string; exPaper: string };
  /** Zain's roster row: t1, class c1, no account. */
  zain: string;
  attempts: { saraReleased: string; adamReleased: string; saraUnreleased: string; zainPaper: string };
}

async function id(pool: Pool, sql: string, params: unknown[]): Promise<string> {
  const r = await pool.query<{ id: string }>(sql, params);
  return r.rows[0].id;
}

async function levelScale(pool: Pool): Promise<string> {
  const scaleId = await id(pool, `INSERT INTO level_scales (name, is_default) VALUES ('test scale', true) RETURNING id`, []);
  const bands: Array<[string, number, number, number]> = [
    ["beginner", 0, 49.99, 0],
    ["developing", 50, 69.99, 1],
    ["proficient", 70, 84.99, 2],
    ["advanced", 85, 100, 3],
  ];
  for (const [key, min, max, order] of bands) {
    await pool.query(
      `INSERT INTO level_bands (scale_id, key, label_ar, label_en, min_percent, max_percent, sort_order)
       VALUES ($1, $2, $2, $2, $3, $4, $5)`,
      [scaleId, key, min, max, order],
    );
  }
  return scaleId;
}

interface ExamSpec {
  teacherId: string;
  classId: string | null;
  title: string;
  status: "draft" | "published" | "closed";
  scaleId: string | null;
  totalMarks: number;
  shareCode?: string;
  examDate?: string;
  examTime?: string;
  release?: boolean;
  archived?: boolean;
}

function exam(pool: Pool, s: ExamSpec): Promise<string> {
  // grade_id, subject_id, book_id and teacher_id are the NOT NULL columns with no default.
  return id(
    pool,
    `INSERT INTO evaluations
       (teacher_id, class_group_id, title, title_ar, grade_id, subject_id, book_id, status,
        share_code, share_code_expires_at, exam_date, exam_time, release_results_to_student,
        level_scale_id, total_marks, published_at, closed_at, archived_at)
     VALUES ($1, $2, $3, $3, 'grade-10', 'mathematics', 'book-test', $4::text,
        $5::text, CASE WHEN $5::text IS NULL THEN NULL ELSE now() + interval '7 days' END,
        $6, $7, $8, $9, $10,
        CASE WHEN $4::text <> 'draft' THEN now() END,
        CASE WHEN $4::text = 'closed' THEN now() END,
        CASE WHEN $11::boolean THEN now() END)
     RETURNING id`,
    [
      s.teacherId,
      s.classId,
      s.title,
      s.status,
      s.shareCode ?? null,
      s.examDate ?? null,
      s.examTime ?? null,
      s.release ?? false,
      s.scaleId,
      s.totalMarks.toFixed(2),
      s.archived ?? false,
    ],
  );
}

/** A paper question is what PUT /evaluations/:id/questions/paper writes: open_ended, empty body, manual. */
function question(pool: Pool, evaluationId: string, order: number, kind: "paper" | "digital", marks: number): Promise<string> {
  const paper = kind === "paper";
  return id(
    pool,
    `INSERT INTO evaluation_questions
       (evaluation_id, order_index, type, body, expected_answer, objective_id, competency_key, marks, grading_mode, source)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'obj-test', 'understanding', $6, $7, 'teacher') RETURNING id`,
    [
      evaluationId,
      order,
      paper ? "open_ended" : "multiple_choice",
      JSON.stringify(paper ? {} : { stem: "2 + 2 = ?", options: ["3", "4"] }),
      JSON.stringify(paper ? {} : { correctIndex: 1 }),
      marks.toFixed(2),
      paper ? "manual" : "deterministic",
    ],
  );
}

function sitting(
  pool: Pool,
  evaluationId: string,
  studentId: string,
  source: "teacher_entry" | "student_link",
  status: string,
  submitted: boolean,
): Promise<string> {
  return id(
    pool,
    `INSERT INTO attempts (evaluation_id, student_id, source, status, started_at, submitted_at)
     VALUES ($1, $2, $3, $4, now(), CASE WHEN $5::boolean THEN now() END) RETURNING id`,
    [evaluationId, studentId, source, status, submitted],
  );
}

async function result(pool: Pool, attemptId: string, earned: number, total: number, levelKey: string, provisional: boolean) {
  await pool.query(
    `INSERT INTO attempt_results (attempt_id, earned_marks, total_marks, percent, level_key, is_provisional)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [attemptId, earned.toFixed(2), total.toFixed(2), ((earned / total) * 100).toFixed(2), levelKey, provisional],
  );
}

export async function seedExams(pool: Pool, w: FamilyWorld): Promise<ExamWorld> {
  const { t1 } = w.users;
  const { c1, c3 } = w.classes;
  const scaleId = await levelScale(pool);
  const dates = {
    exDated: ammanDay(5),
    exDraftDated: ammanDay(4),
    exNoClass: ammanDay(4),
    exC3: ammanDay(6),
    exPaper: ammanDay(3),
  };
  const base = { teacherId: t1, scaleId };

  const exams = {
    exDated: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exDated, status: "published", totalMarks: 10, shareCode: "EXDAT1", examDate: dates.exDated, examTime: "09:30" }),
    exDraftDated: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exDraftDated, status: "draft", totalMarks: 0, examDate: dates.exDraftDated, examTime: "10:00" }),
    exNoClass: await exam(pool, { ...base, classId: null, title: EX_TITLES.exNoClass, status: "published", totalMarks: 10, shareCode: "EXNOC1", examDate: dates.exNoClass }),
    exC3: await exam(pool, { ...base, classId: c3, title: EX_TITLES.exC3, status: "published", totalMarks: 10, shareCode: "EXC3B1", examDate: dates.exC3 }),
    exPaper: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaper, status: "published", totalMarks: 20, shareCode: "EXPAP1", examDate: dates.exPaper, examTime: "08:00" }),
    exPaperMulti: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaperMulti, status: "published", totalMarks: 20, shareCode: "EXPAP2" }),
    exPaperDraft: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaperDraft, status: "draft", totalMarks: 20 }),
    exPaperNoClass: await exam(pool, { ...base, classId: null, title: EX_TITLES.exPaperNoClass, status: "published", totalMarks: 20, shareCode: "EXPAP3" }),
    exPaperArchived: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaperArchived, status: "closed", totalMarks: 20, shareCode: "EXPAP4", archived: true }),
    exGroup: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exGroup, status: "published", totalMarks: 20, shareCode: "EXGRP1" }),
    exNoScale: await exam(pool, { teacherId: t1, scaleId: null, classId: c1, title: EX_TITLES.exNoScale, status: "published", totalMarks: 20, shareCode: "EXNSC1" }),
    exEmpty: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exEmpty, status: "published", totalMarks: 0, shareCode: "EXEMP1" }),
    exReleased: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exReleased, status: "published", totalMarks: 10, shareCode: "EXREL1", examDate: ammanDay(-2), release: true }),
    exUnreleased: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exUnreleased, status: "published", totalMarks: 10, shareCode: "EXUNR1", examDate: ammanDay(-1) }),
  } satisfies Record<ExamKey, string>;

  const questions = {
    exDated: await question(pool, exams.exDated, 0, "digital", 10),
    exPaper: await question(pool, exams.exPaper, 0, "paper", 20),
    exPaperMulti: [
      await question(pool, exams.exPaperMulti, 0, "paper", 10),
      await question(pool, exams.exPaperMulti, 1, "paper", 10),
    ] as [string, string],
    exGroup: await question(pool, exams.exGroup, 0, "paper", 20),
    exNoScale: await question(pool, exams.exNoScale, 0, "paper", 20),
    exReleased: await question(pool, exams.exReleased, 0, "digital", 10),
    exUnreleased: await question(pool, exams.exUnreleased, 0, "digital", 10),
  };
  await question(pool, exams.exNoClass, 0, "digital", 10);
  await question(pool, exams.exC3, 0, "digital", 10);
  await question(pool, exams.exPaperDraft, 0, "paper", 20);
  await question(pool, exams.exPaperNoClass, 0, "paper", 20);
  await question(pool, exams.exPaperArchived, 0, "paper", 20);

  // A group check for Adam alone (support groups): a student-level assignment row.
  await pool.query(`INSERT INTO evaluation_assignments (evaluation_id, student_id, assigned_by) VALUES ($1, $2, $3)`, [
    exams.exGroup,
    w.students.aA,
    t1,
  ]);

  const saraReleased = await sitting(pool, exams.exReleased, w.students.sA1, "student_link", "graded", true);
  await result(pool, saraReleased, 8, 10, "proficient", false);
  const adamReleased = await sitting(pool, exams.exReleased, w.students.aA, "student_link", "needs_review", true);
  await result(pool, adamReleased, 0, 10, "beginner", true);
  const saraUnreleased = await sitting(pool, exams.exUnreleased, w.students.sA1, "student_link", "graded", true);
  await result(pool, saraUnreleased, 9, 10, "advanced", false);

  const zain = await id(pool, `INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [t1, ZAIN]);
  await pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [c1, zain]);
  const zainPaper = await sitting(pool, exams.exPaper, zain, "student_link", "in_progress", false);
  await pool.query(`INSERT INTO attempt_answers (attempt_id, question_id, response) VALUES ($1, $2, '{"text":"on paper"}'::jsonb)`, [
    zainPaper,
    questions.exPaper,
  ]);

  return {
    scaleId,
    exams,
    questions,
    dates,
    zain,
    attempts: { saraReleased, adamReleased, saraUnreleased, zainPaper },
  };
}
```

- [ ] **Step 3: Write the failing DB tests** (`familyExams.db.test.ts`). Structure as `familyHomework.db.test.ts`: one DB, one server, seeded in `before`, dropped in `after`.

```ts
/**
 * What this guards: the exam lists a student and a parent read. The ways it goes
 * wrong are all leaks — a date bringing a draft with it, an exam with no class
 * reaching somebody, another family's exam, a parent being handed the child's
 * link, a paper exam offering «ابدأ», and a mark showing before the teacher
 * released it or on the wrong child.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

interface Row {
  evaluationId: string;
  title: string;
  state: string;
  shareCode: string | null;
  examDate: string | null;
  examTime: string | null;
  paper: boolean;
  deadlineAt: string | null;
  result: { earnedMarks: number; percent: number } | null;
}
interface ChildRows {
  key: string;
  studentId: string;
  displayName: string;
  exams: Row[];
}

describeDb("family exam lists over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;

  const studentList = async (userId: string) => {
    const r = await call(on, "GET", "/student/exams", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return { text: r.text, exams: r.json.exams as Row[] };
  };
  const parentList = async (userId: string) => {
    const r = await call(on, "GET", "/parent/exams", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return { text: r.text, children: r.json.children as ChildRows[] };
  };
  const find = (rows: Row[], title: string): Row => {
    const row = rows.find(r => r.title === title);
    assert.ok(row, `expected ${title} to be listed`);
    return row;
  };
  const allTexts = async () => [
    (await studentList(w.users.studentA)).text,
    (await studentList(w.users.studentB)).text,
    (await parentList(w.users.parentA)).text,
    (await parentList(w.users.parentB)).text,
  ];

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("carries each exam's planned day and time", async () => {
    const { exams } = await studentList(w.users.studentA);
    const dated = find(exams, EX_TITLES.exDated);
    assert.equal(dated.examDate, x.dates.exDated);
    assert.equal(dated.examTime, "09:30");
    assert.equal(dated.paper, false);
    assert.equal(dated.state, "available");
    assert.equal(dated.shareCode, "EXDAT1");
    const undated = find(exams, EX_TITLES.exPaperMulti);
    assert.equal(undated.examDate, null);
    assert.equal(undated.examTime, null);
  });

  it("never lists a dated draft, to anyone", async () => {
    for (const text of await allTexts()) assert.equal(text.includes(EX_TITLES.exDraftDated), false);
  });

  it("never lists a dated exam that has no class, to anyone", async () => {
    for (const text of await allTexts()) assert.equal(text.includes(EX_TITLES.exNoClass), false);
  });

  it("keeps each family to its own classes", async () => {
    const studentB = await studentList(w.users.studentB);
    find(studentB.exams, EX_TITLES.exC3);
    assert.equal(studentB.text.includes(EX_TITLES.exDated), false);
    const parentB = await parentList(w.users.parentB);
    const noor = parentB.children.find(c => c.studentId === w.students.nB1);
    assert.ok(noor);
    find(noor.exams, EX_TITLES.exC3);
    assert.equal((await studentList(w.users.studentA)).text.includes(EX_TITLES.exC3), false);
    assert.equal((await parentList(w.users.parentA)).text.includes(EX_TITLES.exC3), false);
  });

  it("never hands a parent a link", async () => {
    for (const parent of [w.users.parentA, w.users.parentB]) {
      const { children } = await parentList(parent);
      const rows = children.flatMap(c => c.exams);
      assert.ok(rows.length > 0);
      for (const r of rows) assert.equal(r.shareCode, null, `${r.title} carried a link for a parent`);
    }
  });

  it("offers no link and no Start on a paper exam", async () => {
    const { exams } = await studentList(w.users.studentA);
    const quick = find(exams, EX_TITLES.exPaper);
    assert.equal(quick.state, "paper");
    assert.equal(quick.shareCode, null);
    assert.equal(quick.paper, true);
    assert.equal(quick.deadlineAt, null);
    assert.equal(quick.examDate, x.dates.exPaper);
    assert.equal(quick.examTime, "08:00");
    assert.equal(find(exams, EX_TITLES.exPaperMulti).state, "paper");
    // Closed (and archived from the teacher's list): still "paper", never «مُغلق», never a link.
    const closed = find(exams, EX_TITLES.exPaperArchived);
    assert.equal(closed.state, "paper");
    assert.equal(closed.shareCode, null);
  });

  it("shows a mark only once released, and only on the child who sat", async () => {
    const { exams } = await studentList(w.users.studentA);
    const waiting = find(exams, EX_TITLES.exUnreleased);
    assert.equal(waiting.state, "submitted");
    assert.equal(waiting.result, null);
    const shown = find(exams, EX_TITLES.exReleased);
    assert.equal(shown.state, "result");
    assert.equal(shown.result?.earnedMarks, 8);
    assert.equal(shown.result?.percent, 80);

    const { children } = await parentList(w.users.parentA);
    const sara = children.find(c => c.studentId === w.students.sA1);
    const adam = children.find(c => c.studentId === w.students.aA);
    assert.ok(sara && adam);
    assert.equal(find(sara.exams, EX_TITLES.exReleased).result?.earnedMarks, 8);
    assert.equal(find(sara.exams, EX_TITLES.exUnreleased).result, null);
    // Adam handed in too, but his paper is still provisional: no mark, and never Sara's.
    const adamRow = find(adam.exams, EX_TITLES.exReleased);
    assert.equal(adamRow.state, "submitted");
    assert.equal(adamRow.result, null);

    for (const text of [(await parentList(w.users.parentB)).text, (await studentList(w.users.studentB)).text]) {
      assert.equal(text.includes(EX_TITLES.exReleased), false);
    }
  });

  it("labels each parent entry with the same child key as the homework list", async () => {
    const exams = (await parentList(w.users.parentA)).children;
    const hw = await call(on, "GET", "/parent/homework", w.users.parentA);
    assert.equal(hw.status, 200);
    const hwKey = (name: string) => (hw.json.children as { key: string; displayName: string }[]).find(c => c.displayName === name)?.key;
    const saraKey = hwKey(CHILDREN.sara);
    assert.ok(saraKey);
    for (const row of [w.students.sA1, w.students.sA2]) {
      assert.equal(exams.find(c => c.studentId === row)?.key, saraKey, "both of Sara's rows are one child");
    }
    assert.equal(exams.find(c => c.studentId === w.students.aA)?.key, hwKey(CHILDREN.adam));
  });
});
```

- [ ] **Step 4: Run to verify failure.** Start the throwaway Postgres per `LOCAL_SETUP.md` («DB-backed API tests»), then:
Run: `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/familyExams.db.test.ts`
Expected: FAIL on `examDate` (undefined), the paper state (`available`), and the missing `key`. The draft / no-class / other-family / parent-link / release cases already pass — they pin existing rules; that is expected.

- [ ] **Step 5: Implement in `routes/studentExams.ts`.**
  1. Imports: add `evaluationQuestions` to the `@workspace/db` import; add `import { paperExamIds } from "../modules/assessment/paperExam.ts";` and `import { groupChildren } from "../modules/family/children.ts";`.
  2. In `examRowsFor`, add to the `exams` select: `examDate: evaluations.examDate, examTime: evaluations.examTime,`.
  3. After `visibleExams` is computed:

```ts
  // "Paper" is the question shape (paperExam.ts), not a column: an exam whose
  // every live question is a paper question is sat in class and has no link.
  const paperIds = visibleExams.length
    ? paperExamIds(
        await db
          .select({
            evaluationId: evaluationQuestions.evaluationId,
            gradingMode: evaluationQuestions.gradingMode,
            body: evaluationQuestions.body,
          })
          .from(evaluationQuestions)
          .where(and(inArray(evaluationQuestions.evaluationId, visibleExams.map(e => e.id)), isNull(evaluationQuestions.deletedAt))),
      )
    : new Set<string>();
```

  4. In the `rows` map, pass `{ ...exam, paper: paperIds.has(exam.id) }` as the first argument to `studentExamRow`.
  5. Replace the body of the `/parent/exams` `lists` computation with:

```ts
    const links = await guardianLinkedStudents(req.user!.id);
    // One entry per roster row, as before, each labelled with its child's key —
    // the same grouping /parent/homework and /parent/schedule use — so the
    // School tab can put a child's rows from two teachers under one name.
    const keyOf = new Map<string, string>();
    for (const child of groupChildren(links)) for (const studentId of child.studentIds) keyOf.set(studentId, child.key);

    const lists = await Promise.all(
      links.map(async child => ({
        key: keyOf.get(child.studentId) ?? child.studentId,
        studentId: child.studentId,
        displayName: child.displayName,
        exams: (await examRowsFor([child.studentId])).map(guardianExamRow),
      })),
    );
```

  Update the route's doc comment to mention `key`.

- [ ] **Step 6: Run to verify pass.** Same command → all pass. Then the full api-server suite: `pnpm build && TEST_DATABASE_URL=… REQUIRE_DB_TESTS=true pnpm test` → 0 failures, 0 skipped; `pnpm run typecheck` at the root.

- [ ] **Step 7: Mutation proof** (report each, revert each): (a) in `studentExamRow` remove `!paper &&` from `offerLink` → the Task 1 unit test "never offers a link once a student has handed one in" goes red (the DB test alone cannot catch it: for state `paper` the link is already off by the state list); (b) in `/parent/exams` drop `.map(guardianExamRow)` → "never hands a parent a link" goes red; (c) in `examRowsFor` change `["published", "closed"]` to `["draft", "published", "closed"]` AND delete the draft early-return in `studentExamRow` (`modules/assessment/studentExams.ts` ~L101) → "never lists a dated draft" goes red (changing the status list alone cannot go red: `studentExamRow` already drops a draft with no hand-in, which Task 1 pins); (d) remove `examDate` from the select → "carries each exam's planned day" goes red.

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): family exam lists carry the date, mark paper exams, and key parent rows by child; DB tests"
```

---

### Task 3: Characterise teacher entry on a real database, then extract it to `lib/teacherEntry.ts`

**Files:**
- Create: `artifacts/api-server/src/lib/teacherEntry.ts`
- Modify: `artifacts/api-server/src/routes/evaluations.ts` (`POST /evaluations/:id/attempts`), `artifacts/api-server/src/routes/attempts.ts` (`PUT /attempts/:id/grades`)
- Test: `artifacts/api-server/src/routes/__tests__/teacherEntry.db.test.ts`

**Interfaces:**
- Consumes: `seedFamilyWorld`, `seedExams` (Task 2), `call` (Task 2).
- Produces (`lib/teacherEntry.ts`) — **Task 5 calls these**:

```ts
export interface AttemptTemplate { questions: EvaluationQuestion[]; bands: LevelBand[]; audience: Audience }
export function loadAttemptTemplate(evaluation: Pick<Evaluation, "id" | "levelScaleId">): Promise<AttemptTemplate>;
export type StartOutcome =
  | { ok: true; attempt: Attempt; created: boolean }
  | { ok: false; code: "not_in_group" | "no_questions" | "no_level_scale" };
export function findOrStartTeacherEntry(input: {
  evaluation: Pick<Evaluation, "id" | "levelScaleId">;
  studentId: string;
  teacherId: string;
  template?: AttemptTemplate;
}): Promise<StartOutcome>;
export function writeTeacherMark(input: {
  attemptId: string; questionId: string; awardedMarks: number; maxMarks: number;
  verdict: Verdict; teacherId: string;
  /** The comment on this answer. Undefined keeps the one already stored ("" if none). */
  note?: string;
  /** Write nothing (no grade, no audit row) when the stored teacher mark and verdict already match. */
  skipIfUnchanged?: boolean;
}): Promise<{ changed: boolean; grade: AttemptQuestionGrade }>;
```

- [ ] **Step 1: Write the characterisation tests** (`teacherEntry.db.test.ts`) — they must pass **against the current code** before anything moves. One DB, one server; seed with `seedFamilyWorld` + `seedExams`.

```ts
/**
 * Teacher answer entry, as it behaves today: find-or-create a teacher_entry
 * sitting, mark one question by hand, hand the paper in. Written before the
 * code moved into lib/teacherEntry.ts so the move is proven to change nothing;
 * the class mark book (paper-totals) runs the same code.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

describeDb("teacher answer entry over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;
  let attemptId = "";

  const start = (userId: string, examId: string, studentId: string) =>
    call(on, "POST", `/evaluations/${examId}/attempts`, userId, { studentId });
  const one = async (sql: string, params: unknown[]) => (await db.pool.query(sql, params)).rows[0];

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("starting a sitting", () => {
    it("creates a teacher-entry sitting once, then returns the same one", async () => {
      const first = await start(w.users.t1, x.exams.exPaperMulti, w.students.sA1);
      assert.equal(first.status, 201, on.logs().slice(-1500));
      assert.equal(first.json.created, true);
      attemptId = first.json.attempt.id;
      const row = await one(
        `SELECT source, entered_by, status, started_at, jsonb_array_length(question_snapshot) AS q,
                jsonb_array_length(level_scale_snapshot->'bands') AS b
           FROM attempts WHERE id = $1`,
        [attemptId],
      );
      assert.equal(row.source, "teacher_entry");
      assert.equal(row.entered_by, w.users.t1);
      assert.equal(row.status, "in_progress");
      assert.ok(row.started_at);
      assert.equal(row.q, 2);
      assert.equal(row.b, 4);

      const again = await start(w.users.t1, x.exams.exPaperMulti, w.students.sA1);
      assert.equal(again.status, 200);
      assert.equal(again.json.created, false);
      assert.equal(again.json.attempt.id, attemptId);
    });

    it("refuses an unpublished exam, a student who is not the teacher's, and an exam that is not theirs", async () => {
      const draft = await start(w.users.t1, x.exams.exPaperDraft, w.students.sA1);
      assert.equal(draft.status, 409);
      assert.equal(draft.json.error, "Publish this evaluation before entering answers");
      const notMine = await start(w.users.t1, x.exams.exPaperMulti, w.students.sA2);
      assert.equal(notMine.status, 404);
      assert.equal(notMine.json.error, "Student not found");
      const otherTeacher = await start(w.users.t2, x.exams.exPaperMulti, w.students.sA2);
      assert.equal(otherTeacher.status, 404);
      assert.equal(otherTeacher.json.error, "Evaluation not found");
    });

    it("keeps a group check to its group", async () => {
      const outside = await start(w.users.t1, x.exams.exGroup, w.students.sA1);
      assert.equal(outside.status, 403);
      assert.equal(outside.json.code, "not_in_group");
      const inside = await start(w.users.t1, x.exams.exGroup, w.students.aA);
      assert.equal(inside.status, 201);
      await db.pool.query(`DELETE FROM attempts WHERE id = $1`, [inside.json.attempt.id]);
    });

    it("refuses an exam with no level scale, and one with no questions", async () => {
      const noScale = await start(w.users.t1, x.exams.exNoScale, w.students.sA1);
      assert.equal(noScale.status, 409);
      assert.equal(noScale.json.error, "No level scale is configured for this evaluation");
      const empty = await start(w.users.t1, x.exams.exEmpty, w.students.sA1);
      assert.equal(empty.status, 409);
      assert.equal(empty.json.error, "This evaluation has no questions");
    });
  });

  describe("marking and handing in", () => {
    const [q1, q2] = [() => x.questions.exPaperMulti[0], () => x.questions.exPaperMulti[1]];
    const mark = (questionId: string, awardedMarks: unknown) =>
      call(on, "PUT", `/attempts/${attemptId}/grades/${questionId}`, w.users.t1, { awardedMarks });
    const overrides = async () => (await one(`SELECT count(*)::int AS n FROM grade_overrides WHERE attempt_id = $1`, [attemptId])).n as number;

    it("checks the range, and audits only a re-mark", async () => {
      const tooMany = await mark(q1(), 11);
      assert.equal(tooMany.status, 400);
      assert.equal(tooMany.json.code, "marks_out_of_range");
      const first = await mark(q1(), 7);
      assert.equal(first.status, 200);
      assert.equal(first.json.grade.grader, "teacher");
      assert.equal(first.json.grade.verdict, "partial");
      assert.equal(first.json.result.isProvisional, true, "the second question is still unmarked");
      assert.equal(first.json.attempt.status, "needs_review");
      assert.equal(await overrides(), 0, "a first mark overrides nothing");
      const again = await mark(q1(), "8");
      assert.equal(again.status, 200);
      assert.equal(await overrides(), 1);
      const audit = await one(`SELECT old_marks, new_marks FROM grade_overrides WHERE attempt_id = $1`, [attemptId]);
      assert.equal(audit.old_marks, "7.00");
      assert.equal(audit.new_marks, "8.00");
    });

    it("stamps the hand-in once, and finalises when every question is marked", async () => {
      const submitted = await call(on, "POST", `/attempts/${attemptId}/submit`, w.users.t1);
      assert.equal(submitted.status, 200);
      const stamped = (await one(`SELECT submitted_at FROM attempts WHERE id = $1`, [attemptId])).submitted_at as Date;
      assert.ok(stamped);
      assert.equal(submitted.json.result.isProvisional, true);
      const last = await mark(q2(), 10);
      assert.equal(last.json.result.isProvisional, false);
      assert.equal(last.json.attempt.status, "graded");
      await call(on, "POST", `/attempts/${attemptId}/submit`, w.users.t1);
      const after = (await one(`SELECT submitted_at FROM attempts WHERE id = $1`, [attemptId])).submitted_at as Date;
      assert.equal(after.getTime(), stamped.getTime(), "a re-submit keeps the first hand-in time");
      const hand = await one(`SELECT count(*)::int AS n FROM attempt_question_grades WHERE attempt_id = $1 AND grader = 'teacher'`, [attemptId]);
      assert.equal(hand.n, 2, "submitting kept both hand marks");
    });
  });
});
```

- [ ] **Step 2: Run against the current code — it must PASS.**
Run: `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=… node --experimental-strip-types --test src/routes/__tests__/teacherEntry.db.test.ts`
Expected: all pass. If one fails, the test is wrong about today's behaviour: fix the test to match the code (it is a characterisation), and say which in the report. Commit the tests alone:

```bash
git add artifacts/api-server/src/routes/__tests__/teacherEntry.db.test.ts
git commit -m "test(api): characterise teacher answer entry against a real database"
```

- [ ] **Step 3: Write `lib/teacherEntry.ts`.**

```ts
/**
 * Teacher entry, shared: starting the paper a teacher types in for a student,
 * and writing one hand mark. These were the bodies of
 * `POST /evaluations/:id/attempts` and `PUT /attempts/:id/grades`; the class
 * mark book (`lib/paperTotals.ts`) needs exactly the same behaviour, so it
 * lives once, here. `teacherEntry.db.test.ts` pinned it before it moved.
 */
import { db, attemptQuestionGrades, attempts, evaluationQuestions, gradeOverrides, levelBands } from "@workspace/db";
import type { Attempt, AttemptQuestionGrade, Evaluation, EvaluationQuestion, LevelBand, Verdict } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { inAudience, type Audience } from "../modules/assessment/audience.ts";
import { evaluationAudience } from "./evaluationAudience.ts";

/** What a new sitting is frozen from — loaded once per exam, not once per student. */
export interface AttemptTemplate {
  questions: EvaluationQuestion[];
  bands: LevelBand[];
  audience: Audience;
}

export async function loadAttemptTemplate(evaluation: Pick<Evaluation, "id" | "levelScaleId">): Promise<AttemptTemplate> {
  const questions = await db
    .select()
    .from(evaluationQuestions)
    .where(and(eq(evaluationQuestions.evaluationId, evaluation.id), isNull(evaluationQuestions.deletedAt)))
    .orderBy(asc(evaluationQuestions.orderIndex));
  const bands = evaluation.levelScaleId
    ? await db.select().from(levelBands).where(eq(levelBands.scaleId, evaluation.levelScaleId)).orderBy(asc(levelBands.sortOrder))
    : [];
  return { questions, bands, audience: await evaluationAudience(evaluation.id) };
}

export type StartOutcome =
  | { ok: true; attempt: Attempt; created: boolean }
  | { ok: false; code: "not_in_group" | "no_questions" | "no_level_scale" };

/**
 * Find-or-create. Any existing sitting is returned whatever its source: the
 * schema allows one per student per exam, so a student who sat via the link
 * has the only paper there will be. Ownership of the exam and the student, and
 * "published", are the caller's checks.
 */
export async function findOrStartTeacherEntry(input: {
  evaluation: Pick<Evaluation, "id" | "levelScaleId">;
  studentId: string;
  teacherId: string;
  template?: AttemptTemplate;
}): Promise<StartOutcome> {
  const [existing] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.evaluationId, input.evaluation.id), eq(attempts.studentId, input.studentId)))
    .limit(1);
  if (existing) return { ok: true, attempt: existing, created: false };

  const template = input.template ?? (await loadAttemptTemplate(input.evaluation));
  // A group check is for its group only — the same rule the share link and
  // the student's own list apply (audience.ts).
  if (!inAudience(template.audience, input.studentId)) return { ok: false, code: "not_in_group" };
  if (template.questions.length === 0) return { ok: false, code: "no_questions" };
  if (template.bands.length === 0) return { ok: false, code: "no_level_scale" };

  // Frozen at start: a later edit to the evaluation or the scale must not
  // retroactively change what this attempt is graded against.
  const [row] = await db
    .insert(attempts)
    .values({
      evaluationId: input.evaluation.id,
      studentId: input.studentId,
      source: "teacher_entry",
      enteredBy: input.teacherId,
      status: "in_progress",
      startedAt: new Date(),
      questionSnapshot: template.questions,
      levelScaleSnapshot: { scaleId: input.evaluation.levelScaleId, bands: template.bands },
    })
    .returning();
  return { ok: true, attempt: row!, created: true };
}

/**
 * Write one hand mark as a normal grade row (`grader: 'teacher'`), appending to
 * `grade_overrides` when a mark already existed — the evidence for "the machine
 * said 2, the teacher said 3". A first mark writes no override: nothing was
 * overridden. Recomputing the result is the caller's next step.
 */
export async function writeTeacherMark(input: {
  attemptId: string;
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  verdict: Verdict;
  teacherId: string;
  note?: string;
  skipIfUnchanged?: boolean;
}): Promise<{ changed: boolean; grade: AttemptQuestionGrade }> {
  const [previous] = await db
    .select()
    .from(attemptQuestionGrades)
    .where(and(eq(attemptQuestionGrades.attemptId, input.attemptId), eq(attemptQuestionGrades.questionId, input.questionId)))
    .limit(1);

  const awarded = input.awardedMarks.toFixed(2);
  if (
    input.skipIfUnchanged &&
    previous &&
    previous.grader === "teacher" &&
    Number(previous.awardedMarks).toFixed(2) === awarded &&
    previous.verdict === input.verdict
  ) {
    return { changed: false, grade: previous };
  }

  const note = input.note ?? previous?.rationaleAr ?? "";
  const values = {
    attemptId: input.attemptId,
    questionId: input.questionId,
    awardedMarks: awarded,
    maxMarks: input.maxMarks.toFixed(2),
    verdict: input.verdict,
    grader: "teacher" as const,
    // A teacher's mark is not a guess: no confidence, never queued for review.
    confidence: null,
    needsReview: false,
    // The teacher's comment replaces the machine's rationale: its verdict no longer stands.
    rationaleAr: note,
    gradedAt: new Date(),
  };
  const [grade] = await db
    .insert(attemptQuestionGrades)
    .values(values)
    .onConflictDoUpdate({ target: [attemptQuestionGrades.attemptId, attemptQuestionGrades.questionId], set: values })
    .returning();

  if (previous) {
    await db.insert(gradeOverrides).values({
      attemptId: input.attemptId,
      questionId: input.questionId,
      teacherId: input.teacherId,
      oldMarks: previous.awardedMarks,
      newMarks: values.awardedMarks,
      oldVerdict: previous.verdict,
      newVerdict: input.verdict,
      note,
    });
  }
  return { changed: true, grade: grade! };
}
```

Note: the route always passes `note` (a string, `""` when absent), so for the route `note ?? previous…` never applies and behaviour is unchanged.

- [ ] **Step 4: Move the routes onto it.**
  - `routes/evaluations.ts`, `POST /evaluations/:id/attempts`: keep the ownership, `published`, `studentId` and `ownedStudent` checks as they are. Replace everything from the `existing` lookup to the final `res.status(201)` with:

```ts
    const started = await findOrStartTeacherEntry({ evaluation, studentId, teacherId: req.user!.id });
    if (!started.ok) {
      if (started.code === "not_in_group") {
        res.status(403).json({ error: "This check is for a group; this student is not in it", code: "not_in_group" });
      } else if (started.code === "no_questions") {
        res.status(409).json({ error: "This evaluation has no questions" });
      } else {
        res.status(409).json({ error: "No level scale is configured for this evaluation" });
      }
      return;
    }
    if (started.created) res.status(201).json({ attempt: started.attempt, created: true });
    else res.json({ attempt: started.attempt, created: false });
```

  Keep the handler's doc comment and move the "any source" and "frozen at start" comments into `lib/teacherEntry.ts` (done above). Import `findOrStartTeacherEntry` from `"../lib/teacherEntry.ts"`. Remove imports this leaves unused (`levelBands`, `evaluationAudience`, `inAudience` — check each is not used elsewhere in the file before removing; typecheck will tell).
  - `routes/attempts.ts`, `PUT /attempts/:id/grades/:questionId`: replace the `previous` lookup, the upsert and the override insert with

```ts
    const { grade } = await writeTeacherMark({
      attemptId: owned.attempt.id,
      questionId,
      awardedMarks,
      maxMarks,
      verdict,
      note,
      teacherId: req.user!.id,
    });
```

  and keep `recomputeResult` and the response exactly as they are. Import from `"../lib/teacherEntry.ts"`; drop imports left unused (`gradeOverrides` if nothing else uses it).

- [ ] **Step 5: Run to verify nothing changed.** `pnpm build && TEST_DATABASE_URL=… node --experimental-strip-types --test src/routes/__tests__/teacherEntry.db.test.ts` → all pass, untouched. Then the full suite with `REQUIRE_DB_TESTS=true`, and `pnpm run typecheck`.

- [ ] **Step 6: Mutation proof** (report, revert): (a) in `findOrStartTeacherEntry` drop the `inAudience` check → "keeps a group check to its group" goes red; (b) in `writeTeacherMark` drop the `if (previous)` override insert → "audits only a re-mark" goes red.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src
git commit -m "refactor(api): teacher entry lives in lib/teacherEntry.ts, behaviour pinned by DB tests"
```

---

### Task 4: Paper totals — the pure rules (API)

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/paperTotals.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/paperTotals.test.ts`

**Interfaces:**
- Consumes: `isUuid` from `modules/homework/rules.ts` (pure).
- Produces — **Task 5 uses all of these**:

```ts
export const PAPER_TOTALS_MAX_ROWS = 300;
export interface PaperTotalInput { studentId: string /* lower-cased uuid */; marks: number | string | null }
export type PaperTotalsParse =
  | { ok: true; rows: PaperTotalInput[] }
  | { ok: false; code: "invalid_paper_totals" | "too_many_rows" | "duplicate_student"; error: string; index?: number };
export function parsePaperTotals(body: unknown): PaperTotalsParse;
export type PaperTotalErrorCode = "not_in_class" | "not_in_group" | "marks_out_of_range" | "kept_student_work" | "not_quick_paper" | "failed";
export type PaperTotalResult =
  | { studentId: string; status: "saved" | "unchanged"; marks: number }
  | { studentId: string; status: "cleared"; marks: null }
  | { studentId: string; status: "error"; code: PaperTotalErrorCode };
export type ClearDecision = "nothing" | "delete" | "keep";
export function clearDecision(sitting: { source: string; hasAnswers: boolean } | null): ClearDecision;
export type PaperTotalsRefusal = "no_class" | "not_quick_paper" | "no_level_scale";
export const PAPER_TOTALS_REFUSAL: Record<PaperTotalsRefusal, string>;
```

- [ ] **Step 1: Write the failing tests.**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { PAPER_TOTALS_MAX_ROWS, clearDecision, parsePaperTotals } from "../paperTotals.ts";

// Hex LETTERS in the ids on purpose: all-digit ids are their own upper case, so a case test would pass without `.toLowerCase()`.
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("parsePaperTotals", () => {
  it("accepts numbers, numeric strings and null, and lower-cases ids", () => {
    const r = parsePaperTotals({ totals: [{ studentId: A.toUpperCase(), marks: 15 }, { studentId: B, marks: "12.5" }, { studentId: "33333333-3333-4333-8333-333333333333", marks: null }] });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.rows[0]!.studentId, A);
      assert.deepEqual(r.rows.map(x => x.marks), [15, "12.5", null]);
    }
  });

  it("refuses a body that is not { totals: [...] } with at least one row", () => {
    for (const body of [null, [], "x", {}, { totals: "x" }, { totals: [] }]) {
      const r = parsePaperTotals(body);
      assert.equal(r.ok, false, JSON.stringify(body));
      if (!r.ok) assert.equal(r.code, "invalid_paper_totals");
    }
  });

  it("caps the rows per request", () => {
    const rows = Array.from({ length: PAPER_TOTALS_MAX_ROWS + 1 }, (_, i) => ({
      studentId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      marks: 1,
    }));
    const r = parsePaperTotals({ totals: rows });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "too_many_rows");
    assert.equal(parsePaperTotals({ totals: rows.slice(0, PAPER_TOTALS_MAX_ROWS) }).ok, true);
  });

  it("names the first malformed row", () => {
    const cases: unknown[] = [
      { studentId: "nope", marks: 1 },
      { studentId: A },
      { studentId: A, marks: "" },
      { studentId: A, marks: "  " },
      { studentId: A, marks: true },
      { studentId: A, marks: Number.NaN },
      { studentId: A, marks: Infinity },
      { studentId: A, marks: {} },
      "row",
    ];
    for (const bad of cases) {
      const r = parsePaperTotals({ totals: [{ studentId: B, marks: 1 }, bad] });
      assert.equal(r.ok, false, JSON.stringify(bad));
      if (!r.ok) {
        assert.equal(r.code, "invalid_paper_totals");
        assert.equal(r.index, 1);
      }
    }
  });

  it("refuses the same student twice, whatever the case of the id", () => {
    const r = parsePaperTotals({ totals: [{ studentId: A, marks: 1 }, { studentId: A.toUpperCase(), marks: 2 }] });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "duplicate_student");
      assert.equal(r.index, 1);
    }
  });
});

describe("clearDecision", () => {
  it("has nothing to do without a sitting", () => {
    assert.equal(clearDecision(null), "nothing");
  });
  it("deletes only a teacher-typed sitting with no recorded answers", () => {
    assert.equal(clearDecision({ source: "teacher_entry", hasAnswers: false }), "delete");
    assert.equal(clearDecision({ source: "teacher_entry", hasAnswers: true }), "keep");
    assert.equal(clearDecision({ source: "student_link", hasAnswers: false }), "keep");
    assert.equal(clearDecision({ source: "student_link", hasAnswers: true }), "keep");
  });
});
```

- [ ] **Step 2: Run to verify failure.** `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/paperTotals.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement.**

```ts
/**
 * The class mark book for a paper exam: one total per student, typed by the
 * teacher (`PUT /evaluations/:id/paper-totals`, lib/paperTotals.ts). This file
 * is the part that needs no database: reading the request, the per-row result
 * shapes, and when "clear this mark" may delete a sitting.
 *
 * Partial by design: a class of thirty is thirty independent rows, and one
 * student who left the class must not cost the teacher the other twenty-nine.
 * The body is refused whole only when it is malformed.
 */
import { isUuid } from "../homework/rules.ts";

/** A large class is ~45; this bounds one request's work, not a class. */
export const PAPER_TOTALS_MAX_ROWS = 300;

export interface PaperTotalInput {
  /** Lower-cased: the database returns uuids lower-case, and rows are matched by string. */
  studentId: string;
  /** A number or numeric string (checked against the question later), or null to clear. */
  marks: number | string | null;
}

export type PaperTotalsParse =
  | { ok: true; rows: PaperTotalInput[] }
  | { ok: false; code: "invalid_paper_totals" | "too_many_rows" | "duplicate_student"; error: string; index?: number };

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parsePaperTotals(body: unknown): PaperTotalsParse {
  const totals = record(body)?.["totals"];
  if (!Array.isArray(totals) || totals.length === 0) {
    return { ok: false, code: "invalid_paper_totals", error: "totals must be a non-empty list" };
  }
  if (totals.length > PAPER_TOTALS_MAX_ROWS) {
    return { ok: false, code: "too_many_rows", error: `At most ${PAPER_TOTALS_MAX_ROWS} students per request` };
  }
  const seen = new Set<string>();
  const rows: PaperTotalInput[] = [];
  for (const [index, item] of totals.entries()) {
    const row = record(item);
    if (!row || !isUuid(row["studentId"])) {
      return { ok: false, code: "invalid_paper_totals", error: "Each row needs a studentId", index };
    }
    const marks = row["marks"];
    const marksOk =
      marks === null ||
      (typeof marks === "number" && Number.isFinite(marks)) ||
      (typeof marks === "string" && marks.trim() !== "");
    if (!marksOk) {
      return { ok: false, code: "invalid_paper_totals", error: "Each row needs marks: a number, or null to clear", index };
    }
    const studentId = row["studentId"].toLowerCase();
    if (seen.has(studentId)) {
      return { ok: false, code: "duplicate_student", error: "A student appears twice", index };
    }
    seen.add(studentId);
    rows.push({ studentId, marks: marks as number | string | null });
  }
  return { ok: true, rows };
}

export type PaperTotalErrorCode =
  | "not_in_class"
  | "not_in_group"
  | "marks_out_of_range"
  | "kept_student_work"
  | "not_quick_paper"
  | "failed";

export type PaperTotalResult =
  | { studentId: string; status: "saved" | "unchanged"; marks: number }
  | { studentId: string; status: "cleared"; marks: null }
  | { studentId: string; status: "error"; code: PaperTotalErrorCode };

export type ClearDecision = "nothing" | "delete" | "keep";

/**
 * Clearing a mark deletes the sitting only when the teacher made all of it: a
 * `teacher_entry` paper with no recorded answers. A sitting the student made
 * through the link, or one with answers on it, is the student's work — the
 * teacher clears it from that student's page, deliberately, not from a grid.
 */
export function clearDecision(sitting: { source: string; hasAnswers: boolean } | null): ClearDecision {
  if (!sitting) return "nothing";
  return sitting.source === "teacher_entry" && !sitting.hasAnswers ? "delete" : "keep";
}

export type PaperTotalsRefusal = "no_class" | "not_quick_paper" | "no_level_scale";

export const PAPER_TOTALS_REFUSAL: Record<PaperTotalsRefusal, string> = {
  no_class: "Attach this exam to a class before entering marks",
  not_quick_paper: "One total per student works only on a paper exam with a single question",
  no_level_scale: "No level scale is configured for this evaluation",
};
```

- [ ] **Step 4: Run to verify pass**; `pnpm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/assessment
git commit -m "feat(api): paper totals request parser and clear rule"
```

---

### Task 5: `PUT /evaluations/:id/paper-totals` — typed totals become real results

**Files:**
- Create: `artifacts/api-server/src/lib/paperTotals.ts`
- Modify: `artifacts/api-server/src/routes/evaluations.ts`, `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`
- Test: `artifacts/api-server/src/routes/__tests__/paperTotals.db.test.ts`

**Interfaces:**
- Consumes: `loadAttemptTemplate`, `findOrStartTeacherEntry`, `writeTeacherMark` (Task 3); `parsePaperTotals`, `clearDecision`, `PAPER_TOTALS_REFUSAL`, `PaperTotalInput`, `PaperTotalResult`, `PaperTotalErrorCode` (Task 4); `isQuickPaperExam`, `isPaperQuestion` (Task 1 / existing); `normalizeManualMarks`, `deriveVerdict` (`modules/assessment/manualGrade.ts`); `gradeSubmission` (`modules/assessment/attemptGrading.ts`); `findLiveClass` (`lib/classOwnership.ts`); `inAudience` (`modules/assessment/audience.ts`).
- Produces:
  - `savePaperTotals(input: { evaluation: Evaluation; teacherId: string; rows: PaperTotalInput[] }): Promise<{ ok: true; maxMarks: number; results: PaperTotalResult[] } | { ok: false; code: PaperTotalsRefusal }>`.
  - HTTP `PUT /evaluations/:id/paper-totals`, body `{ totals: [{ studentId, marks: number | string | null }] }`:
    - `404 { error: "Evaluation not found" }` — not yours, missing, malformed id, archived (identical bodies).
    - `409 { code: "not_published", error: "Publish this evaluation before entering marks" }`.
    - `400 { code, error, index? }` — `invalid_paper_totals` | `too_many_rows` | `duplicate_student`.
    - `409 { code: "no_class" | "not_quick_paper" | "no_level_scale", error }`.
    - `200 { maxMarks: number, results: PaperTotalResult[] }` — one result per request row, same order.
  - Rate limit `paper-totals`: 60 requests / minute / user.
  - Per row: not a live member (owned, not archived) of the exam's class → `not_in_class`; outside a group check's audience → `not_in_group`; `marks: null` → `clearDecision` (`delete` removes the sitting → `cleared`; `nothing` → `cleared`; `keep` → `kept_student_work`); a number outside `0..N` → `marks_out_of_range` and nothing written for that row; otherwise find-or-create the sitting, `writeTeacherMark(… skipIfUnchanged: true)`, and **finalise with `gradeSubmission`** (the only code that stamps `submittedAt`, so the only way a family can ever see the mark) unless nothing changed and it was already handed in (`unchanged`). An unexpected error on one row → `failed` for that row, logged, the rest continue.

- [ ] **Step 1: Write the failing DB tests** (`paperTotals.db.test.ts`). Seed `seedFamilyWorld` + `seedExams`. Tests run in file order; later ones depend on earlier writes as stated.

```ts
/**
 * The class mark book over HTTP. What it must never do: let anyone but the
 * exam's teacher write, write a mark for a child outside the exam's class or
 * group, accept a mark above the paper's total, show a typed mark to a family
 * before the teacher releases results, or delete work a student made. And what
 * it must do: turn a typed total into a handed-in, final result.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

const RANDOM_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";

describeDb("paper totals over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;

  const put = (userId: string | undefined, examId: string, body: unknown) =>
    call(on, "PUT", `/evaluations/${examId}/paper-totals`, userId, body);
  const totals = (...rows: Array<[string, number | string | null]>) => ({
    totals: rows.map(([studentId, marks]) => ({ studentId, marks })),
  });
  const count = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows[0].n as number;
  const attemptsOn = (examId: string) => count(`SELECT count(*)::int AS n FROM attempts WHERE evaluation_id = $1`, [examId]);
  const paperRow = async (userId: string, studentId?: string) => {
    if (!studentId) {
      const r = await call(on, "GET", "/student/exams", userId);
      return (r.json.exams as any[]).find(e => e.title === EX_TITLES.exPaper);
    }
    const r = await call(on, "GET", "/parent/exams", userId);
    const child = (r.json.children as any[]).find(c => c.studentId === studentId);
    return child?.exams.find((e: any) => e.title === EX_TITLES.exPaper);
  };

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("who may call", () => {
    it("401 without a token; 403 for a parent and a student", async () => {
      const body = totals([w.students.sA1, 5]);
      assert.equal((await put(undefined, x.exams.exPaper, body)).status, 401);
      assert.equal((await put(w.users.parentA, x.exams.exPaper, body)).status, 403);
      assert.equal((await put(w.users.studentA, x.exams.exPaper, body)).status, 403);
      assert.equal(await attemptsOn(x.exams.exPaper), 1, "only Zain's seeded sitting");
    });

    it("404 alike for another teacher's exam, a missing id, a malformed id and an archived exam", async () => {
      const body = totals([w.students.sA1, 5]);
      const bodies = [
        await put(w.users.t2, x.exams.exPaper, body),
        await put(w.users.t1, RANDOM_UUID, body),
        await put(w.users.t1, "nope", body),
        await put(w.users.t1, x.exams.exPaperArchived, body),
      ];
      for (const r of bodies) {
        assert.equal(r.status, 404);
        assert.equal(r.text, bodies[0]!.text);
      }
      assert.deepEqual(bodies[0]!.json, { error: "Evaluation not found" });
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });
  });

  describe("which exams", () => {
    it("409 for a draft, an exam with no class, a two-question paper and a digital exam", async () => {
      const body = totals([w.students.sA1, 5]);
      assert.equal((await put(w.users.t1, x.exams.exPaperDraft, body)).json.code, "not_published");
      assert.equal((await put(w.users.t1, x.exams.exPaperNoClass, body)).json.code, "no_class");
      assert.equal((await put(w.users.t1, x.exams.exPaperMulti, body)).json.code, "not_quick_paper");
      const digital = await put(w.users.t1, x.exams.exDated, body);
      assert.equal(digital.status, 409);
      assert.equal(digital.json.code, "not_quick_paper");
      assert.equal(await attemptsOn(x.exams.exDated), 0);
    });

    it("400 for a malformed body, and nothing written", async () => {
      const many = Array.from({ length: 301 }, () => ({ studentId: randomUUID(), marks: 1 }));
      const cases: Array<[unknown, string]> = [
        [{}, "invalid_paper_totals"],
        [{ totals: [] }, "invalid_paper_totals"],
        [{ totals: many }, "too_many_rows"],
        [totals([w.students.sA1, 1], [w.students.sA1, 2]), "duplicate_student"],
        [{ totals: [{ studentId: "nope", marks: 1 }] }, "invalid_paper_totals"],
        [{ totals: [{ studentId: w.students.sA1 }] }, "invalid_paper_totals"],
      ];
      for (const [body, code] of cases) {
        const r = await put(w.users.t1, x.exams.exPaper, body);
        assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
        assert.equal(r.json.code, code);
      }
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });
  });

  describe("per student", () => {
    it("refuses, row by row, anyone who is not a live student of the exam's class", async () => {
      // nB1: t1's, but in c3. sA2: t2's row. aArch: t2's, archived. Then a stranger.
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.nB1, 5], [w.students.sA2, 5], [w.students.aArch, 5], [RANDOM_UUID, 5]));
      assert.equal(r.status, 200, on.logs().slice(-1500));
      for (const row of r.json.results) assert.deepEqual([row.status, row.code], ["error", "not_in_class"]);
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });

    it("refuses a mark outside 0..N for that row only, writing nothing", async () => {
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, 21]));
      assert.deepEqual(r.json.results[0], { studentId: w.students.sA1, status: "error", code: "marks_out_of_range" });
      const neg = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, -1]));
      assert.equal(neg.json.results[0].code, "marks_out_of_range");
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });

    it("turns a typed total into a handed-in, final result that families see only after release", async () => {
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, 15]));
      assert.deepEqual(r.json, { maxMarks: 20, results: [{ studentId: w.students.sA1, status: "saved", marks: 15 }] });
      const row = (
        await db.pool.query(
          `SELECT a.source, a.entered_by, a.submitted_at, r.earned_marks, r.total_marks, r.percent, r.is_provisional
             FROM attempts a JOIN attempt_results r ON r.attempt_id = a.id
            WHERE a.evaluation_id = $1 AND a.student_id = $2`,
          [x.exams.exPaper, w.students.sA1],
        )
      ).rows[0];
      assert.equal(row.source, "teacher_entry");
      assert.equal(row.entered_by, w.users.t1);
      assert.ok(row.submitted_at, "handed in, or no family could ever see it");
      assert.deepEqual([row.earned_marks, row.total_marks, row.percent, row.is_provisional], ["15.00", "20.00", "75.00", false]);

      // Not released yet: the student and the parent see «سُلِّم — بانتظار النتيجة», no mark.
      for (const seen of [await paperRow(w.users.studentA), await paperRow(w.users.parentA, w.students.sA1)]) {
        assert.equal(seen.state, "submitted");
        assert.equal(seen.result, null);
      }

      const rel = await call(on, "POST", `/evaluations/${x.exams.exPaper}/results-release`, w.users.t1, { released: true });
      assert.equal(rel.status, 200);

      for (const seen of [await paperRow(w.users.studentA), await paperRow(w.users.parentA, w.students.sA1)]) {
        assert.equal(seen.state, "result");
        assert.equal(seen.result.earnedMarks, 15);
        assert.equal(seen.result.percent, 75);
      }
      // Adam, same parent and class, has no mark yet: still "paper", never Sara's.
      const adam = await paperRow(w.users.parentA, w.students.aA);
      assert.equal(adam.state, "paper");
      assert.equal(adam.result, null);
      assert.equal((await call(on, "GET", "/parent/exams", w.users.parentB)).text.includes(EX_TITLES.exPaper), false);
    });

    it("re-saving the same mark changes nothing; a new mark is audited once", async () => {
      const before = (await db.pool.query(`SELECT submitted_at FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [x.exams.exPaper, w.students.sA1])).rows[0].submitted_at as Date;
      const same = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, "15"]));
      assert.equal(same.json.results[0].status, "unchanged");
      assert.equal(await count(`SELECT count(*)::int AS n FROM grade_overrides`), 0);
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [x.exams.exPaper, w.students.sA1]), 1);

      const changed = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, "16.5"]));
      assert.deepEqual(changed.json.results[0], { studentId: w.students.sA1, status: "saved", marks: 16.5 });
      const audit = (await db.pool.query(`SELECT old_marks, new_marks FROM grade_overrides`)).rows;
      assert.deepEqual(audit, [{ old_marks: "15.00", new_marks: "16.50" }]);
      const after = (await db.pool.query(
        `SELECT a.submitted_at, r.earned_marks, r.percent FROM attempts a JOIN attempt_results r ON r.attempt_id = a.id WHERE a.evaluation_id = $1 AND a.student_id = $2`,
        [x.exams.exPaper, w.students.sA1],
      )).rows[0];
      assert.equal(after.submitted_at.getTime(), before.getTime(), "the first hand-in time stands");
      assert.deepEqual([after.earned_marks, after.percent], ["16.50", "82.50"]);
    });

    it("saves the good rows of a mixed batch and reports the bad one", async () => {
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.aA, 10], [w.students.nB1, 5]));
      assert.deepEqual(r.json.results, [
        { studentId: w.students.aA, status: "saved", marks: 10 },
        { studentId: w.students.nB1, status: "error", code: "not_in_class" },
      ]);
    });

    it("null clears a typed paper, and refuses to clear a student's own work", async () => {
      const cleared = await put(w.users.t1, x.exams.exPaper, totals([w.students.aA, null]));
      assert.deepEqual(cleared.json.results[0], { studentId: w.students.aA, status: "cleared", marks: null });
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [x.exams.exPaper, w.students.aA]), 0);
      assert.equal((await paperRow(w.users.parentA, w.students.aA)).state, "paper");
      const again = await put(w.users.t1, x.exams.exPaper, totals([w.students.aA, null]));
      assert.equal(again.json.results[0].status, "cleared", "clearing nothing is still cleared");
      const zain = await put(w.users.t1, x.exams.exPaper, totals([x.zain, null]));
      assert.deepEqual(zain.json.results[0], { studentId: x.zain, status: "error", code: "kept_student_work" });
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE id = $1`, [x.attempts.zainPaper]), 1);
    });

    it("keeps a group check to its group", async () => {
      const r = await put(w.users.t1, x.exams.exGroup, totals([w.students.sA1, 5], [w.students.aA, 5]));
      assert.deepEqual(r.json.results, [
        { studentId: w.students.sA1, status: "error", code: "not_in_group" },
        { studentId: w.students.aA, status: "saved", marks: 5 },
      ]);
    });
  });
});
```

- [ ] **Step 2: Run to verify failure.** `pnpm build && TEST_DATABASE_URL=… node --experimental-strip-types --test src/routes/__tests__/paperTotals.db.test.ts` → FAIL (route missing: 404 everywhere; the "who may call" 401/403 cases already pass because the `/evaluations` guard runs first).

- [ ] **Step 3: Implement `lib/paperTotals.ts`.**

```ts
/**
 * The class mark book for a quick paper exam (one paper question worth N):
 * one typed total per student becomes a real result.
 *
 * Each row goes through the same code as typing a mark on the student's own
 * page (lib/teacherEntry.ts) and is then handed in with `gradeSubmission` —
 * the only code that stamps `submittedAt`, so the only way a family ever sees
 * the mark, and only after the teacher releases results. Rows are independent:
 * one bad row is reported, the others are saved.
 */
import { db, attemptAnswers, attempts, classMemberships, students } from "@workspace/db";
import type { Attempt, Evaluation, EvaluationQuestion } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { findLiveClass } from "./classOwnership.ts";
import { logger } from "./logger.ts";
import { findOrStartTeacherEntry, loadAttemptTemplate, writeTeacherMark, type AttemptTemplate } from "./teacherEntry.ts";
import { inAudience } from "../modules/assessment/audience.ts";
import { gradeSubmission } from "../modules/assessment/attemptGrading.ts";
import { deriveVerdict, normalizeManualMarks } from "../modules/assessment/manualGrade.ts";
import { isPaperQuestion, isQuickPaperExam } from "../modules/assessment/paperExam.ts";
import {
  clearDecision,
  type PaperTotalErrorCode,
  type PaperTotalInput,
  type PaperTotalResult,
  type PaperTotalsRefusal,
} from "../modules/assessment/paperTotals.ts";

export type PaperTotalsOutcome =
  | { ok: true; maxMarks: number; results: PaperTotalResult[] }
  | { ok: false; code: PaperTotalsRefusal };

interface Context {
  evaluation: Evaluation;
  teacherId: string;
  template: AttemptTemplate;
  question: EvaluationQuestion;
  members: Set<string>;
  attemptByStudent: Map<string, Attempt>;
  withAnswers: Set<string>;
}

const refused = (studentId: string, code: PaperTotalErrorCode): PaperTotalResult => ({ studentId, status: "error", code });

/** The one paper question a sitting was frozen with, or null if it is not a quick paper. */
function snapshotQuestion(attempt: Attempt): EvaluationQuestion | null {
  const snapshot = (attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
  return snapshot.length === 1 && isPaperQuestion(snapshot[0]!) ? snapshot[0]! : null;
}

async function saveOne(row: PaperTotalInput, ctx: Context): Promise<PaperTotalResult> {
  const { studentId } = row;
  if (!ctx.members.has(studentId)) return refused(studentId, "not_in_class");
  if (!inAudience(ctx.template.audience, studentId)) return refused(studentId, "not_in_group");
  const existing = ctx.attemptByStudent.get(studentId) ?? null;

  if (row.marks === null) {
    const decision = clearDecision(existing && { source: existing.source, hasAnswers: ctx.withAnswers.has(existing.id) });
    if (decision === "keep") return refused(studentId, "kept_student_work");
    // Cascades to its grades, result, audit rows and recommendations: the paper was never entered.
    if (decision === "delete") await db.delete(attempts).where(eq(attempts.id, existing!.id));
    return { studentId, status: "cleared", marks: null };
  }

  const question = existing ? snapshotQuestion(existing) : ctx.question;
  if (!question) return refused(studentId, "not_quick_paper");
  const maxMarks = Number(question.marks);
  const awarded = normalizeManualMarks(row.marks, maxMarks);
  if (awarded === null) return refused(studentId, "marks_out_of_range");

  let attempt = existing;
  if (!attempt) {
    const started = await findOrStartTeacherEntry({
      evaluation: ctx.evaluation,
      studentId,
      teacherId: ctx.teacherId,
      template: ctx.template,
    });
    if (!started.ok) return refused(studentId, started.code === "not_in_group" ? "not_in_group" : "failed");
    attempt = started.attempt;
  }

  const { changed } = await writeTeacherMark({
    attemptId: attempt.id,
    questionId: question.id,
    awardedMarks: awarded,
    maxMarks,
    verdict: deriveVerdict(awarded, maxMarks),
    teacherId: ctx.teacherId,
    skipIfUnchanged: true,
  });
  if (!changed && attempt.submittedAt) return { studentId, status: "unchanged", marks: awarded };

  const graded = await gradeSubmission(attempt);
  if (!graded.ok) return refused(studentId, "failed");
  return { studentId, status: "saved", marks: awarded };
}

export async function savePaperTotals(input: {
  evaluation: Evaluation;
  teacherId: string;
  rows: PaperTotalInput[];
}): Promise<PaperTotalsOutcome> {
  const { evaluation, teacherId, rows } = input;
  const classId = evaluation.classGroupId;
  if (!classId || !(await findLiveClass(classId, teacherId))) return { ok: false, code: "no_class" };

  const template = await loadAttemptTemplate(evaluation);
  if (!isQuickPaperExam(template.questions)) return { ok: false, code: "not_quick_paper" };
  if (template.bands.length === 0) return { ok: false, code: "no_level_scale" };

  const ids = rows.map(r => r.studentId);
  // Live members of THIS exam's class, owned by this teacher — never "any student of theirs".
  const members = new Set(
    (
      await db
        .select({ id: students.id })
        .from(classMemberships)
        .innerJoin(students, eq(students.id, classMemberships.studentId))
        .where(
          and(
            eq(classMemberships.classGroupId, classId),
            inArray(students.id, ids),
            eq(students.teacherId, teacherId),
            isNull(students.archivedAt),
          ),
        )
    ).map(r => r.id),
  );
  const held = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.evaluationId, evaluation.id), inArray(attempts.studentId, ids)));
  const withAnswers = held.length
    ? new Set(
        (
          await db
            .selectDistinct({ attemptId: attemptAnswers.attemptId })
            .from(attemptAnswers)
            .where(inArray(attemptAnswers.attemptId, held.map(a => a.id)))
        ).map(r => r.attemptId),
      )
    : new Set<string>();

  const ctx: Context = {
    evaluation,
    teacherId,
    template,
    question: template.questions[0]!,
    members,
    attemptByStudent: new Map(held.map(a => [a.studentId, a])),
    withAnswers,
  };

  const results: PaperTotalResult[] = [];
  for (const row of rows) {
    try {
      results.push(await saveOne(row, ctx));
    } catch (err) {
      logger.error({ err, evaluationId: evaluation.id, studentId: row.studentId }, "paper total failed");
      results.push(refused(row.studentId, "failed"));
    }
  }
  return { ok: true, maxMarks: Number(ctx.question.marks), results };
}
```

  Check `lib/classOwnership.ts` and `lib/logger.ts` export names before using them (`findLiveClass`, `logger`); `routes/` imports them as `.js`, this new lib file uses `.ts` like `lib/familyAccess.ts`.

- [ ] **Step 4: Add the route to `routes/evaluations.ts`**, directly after `POST /evaluations/:id/attempts`. Imports: `parsePaperTotals, PAPER_TOTALS_REFUSAL` from `"../modules/assessment/paperTotals.ts"`, `savePaperTotals` from `"../lib/paperTotals.ts"` (`isUuid` and `createRateLimiter` are already imported).

```ts
// A whole class per request, each row a find-or-create, a mark and a hand-in;
// generous for a teacher saving a mark book, a wall for a loop.
const paperTotalsLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  name: "paper-totals",
  key: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

/**
 * The class mark book: one typed total per student for a quick paper exam
 * (exactly one paper question, worth N) — see lib/paperTotals.ts. Each row is
 * saved, refused or cleared on its own and reported back; a saved row is
 * handed in, so it reaches the student and their parents once — and only once
 * — the teacher releases results.
 *
 * Archived counts as "not found" here, like a missing or malformed id: the
 * exam has left the teacher's lists, and a mark book must not write to it.
 */
router.put("/evaluations/:id/paper-totals", paperTotalsLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const evaluation = isUuid(id) ? await ownedEvaluation(id, req.user!.id) : undefined;
    if (!evaluation || evaluation.archivedAt) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    if (evaluation.status !== "published") {
      res.status(409).json({ code: "not_published", error: "Publish this evaluation before entering marks" });
      return;
    }
    const parsed = parsePaperTotals(req.body);
    if (!parsed.ok) {
      res.status(400).json({ code: parsed.code, error: parsed.error, ...(parsed.index === undefined ? {} : { index: parsed.index }) });
      return;
    }
    const outcome = await savePaperTotals({ evaluation, teacherId: req.user!.id, rows: parsed.rows });
    if (!outcome.ok) {
      res.status(409).json({ code: outcome.code, error: PAPER_TOTALS_REFUSAL[outcome.code] });
      return;
    }
    res.json({ maxMarks: outcome.maxMarks, results: outcome.results });
  } catch (err) {
    logger.error({ err }, "save paper totals failed");
    res.status(500).json({ error: "Failed to save the marks" });
  }
});
```

- [ ] **Step 5: `mountOrder.test.ts`.** Next to "mounts the group-check audience inside the evaluations guard", add:

```ts
  it("guards the class mark book", async () => {
    // Writes marks for a whole class; it must never answer without a teacher token.
    const id = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${base}/evaluations/${id}/paper-totals`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ totals: [{ studentId: id, marks: 1 }] }),
    });
    assert.equal(res.status, 401, "typing a class's marks must require a token");
  });
```

- [ ] **Step 6: Run everything.** The new DB file → all pass. Then `pnpm build && TEST_DATABASE_URL=… REQUIRE_DB_TESTS=true pnpm test` (0 failed, 0 skipped — includes `mountOrder`, Task 2's and Task 3's files) and `pnpm run typecheck`.

- [ ] **Step 7: Mutation proof** (report, revert each): (a) drop the `members` check in `saveOne` → "refuses, row by row" goes red; (b) replace `gradeSubmission(attempt)` with `recomputeResult(attempt)` (import it) → "turns a typed total into a handed-in, final result" goes red (`submitted_at` null, family state `paper`); (c) drop `|| evaluation.archivedAt` in the route → the 404 case goes red; (d) make `clearDecision` always return `"delete"` → the clear case goes red (Zain's sitting deleted); (e) pass `skipIfUnchanged: false` → the re-save case goes red (an override row appears).

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): PUT /evaluations/:id/paper-totals — a typed total per student becomes a handed-in result"
```

---

### Task 6: Mobile family logic and copy — exam dates, the paper state, upcoming exams

**Files:**
- Modify: `artifacts/mobile/services/myExams.ts`, `artifacts/mobile/services/i18n.ts`
- Create: `artifacts/mobile/services/upcomingExams.ts`
- Test: `artifacts/mobile/services/__tests__/myExams.test.ts`, `artifacts/mobile/services/__tests__/upcomingExams.test.ts` (new)

**Interfaces:**
- Consumes: the HTTP shapes from Tasks 1–2; `ammanToday`, `dueBadge`, `formatDueDate`, `isValidYmd` from `services/homework.ts` (no imports, node-test safe).
- Produces:
  - `myExams.ts`: `MyExamState` gains `'paper'`; `MyExam` gains `examDate?: string | null`, `examTime?: string | null`, `paper?: boolean` (optional: an older server omits them); `ChildExams` gains `key?: string`; `MY_EXAM_STATE_KEY.paper = 'myExamsStatePaper'`; `myExamAction` returns `null` for `paper`.
  - `upcomingExams.ts`:

```ts
export interface ExamGroup { key: string; displayName: string; exams: MyExam[] }
export function groupChildExams(children: readonly ChildExams[]): ExamGroup[];
export function upcomingExams(exams: readonly MyExam[], today: string): MyExam[];
export function formatExamTime(examTime: string | null | undefined): string | null;
export function formatExamWhen(examDate: string, examTime: string | null | undefined): string;
export type ExamDayKind = 'today' | 'tomorrow' | 'later';
export function examDayKind(examDate: string, today: string): ExamDayKind;
```

- [ ] **Step 1: Write the failing tests.** In `myExams.test.ts`: extend "names every state the server can send" to include `'paper'`, and add:

```ts
  it('never offers anything on a paper exam', () => {
    assert.equal(myExamAction(exam({ state: 'paper', shareCode: null, paper: true })), null);
    // Even if an older server still sent a code.
    assert.equal(myExamAction(exam({ state: 'paper', shareCode: 'ABC234', paper: true })), null);
  });
```

  New `upcomingExams.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { examDayKind, formatExamTime, formatExamWhen, groupChildExams, upcomingExams } from '../upcomingExams.ts';
import type { ChildExams, MyExam } from '../myExams.ts';

function exam(over: Partial<MyExam> = {}): MyExam {
  return {
    evaluationId: 'e1', title: 'Quiz', titleAr: 'اختبار', subjectId: 'mathematics', gradeId: 'grade-10',
    totalMarks: 10, timeLimitMin: null, publishedAt: null, state: 'available', shareCode: null,
    submittedAt: null, deadlineAt: null, result: null, ...over,
  };
}
const TODAY = '2026-10-14';

describe('upcomingExams', () => {
  it('keeps today and later, drops the past and anything undated or malformed', () => {
    const list = upcomingExams([
      exam({ evaluationId: 'past', examDate: '2026-10-13' }),
      exam({ evaluationId: 'today', examDate: '2026-10-14' }),
      exam({ evaluationId: 'later', examDate: '2026-10-20' }),
      exam({ evaluationId: 'none', examDate: null }),
      exam({ evaluationId: 'absent' }),
      exam({ evaluationId: 'bad', examDate: '2026-02-30' }),
    ], TODAY);
    assert.deepEqual(list.map(e => e.evaluationId), ['today', 'later']);
  });

  it('sorts by day, then time with untimed last, then title', () => {
    const list = upcomingExams([
      exam({ evaluationId: 'b-untimed', examDate: '2026-10-15', titleAr: 'أ' }),
      exam({ evaluationId: 'b-10', examDate: '2026-10-15', examTime: '10:00' }),
      exam({ evaluationId: 'b-08', examDate: '2026-10-15', examTime: '08:00' }),
      exam({ evaluationId: 'a', examDate: '2026-10-14', examTime: '12:00' }),
    ], TODAY);
    assert.deepEqual(list.map(e => e.evaluationId), ['a', 'b-08', 'b-10', 'b-untimed']);
  });

  it('keeps every state, a closed one included', () => {
    assert.equal(upcomingExams([exam({ state: 'closed', examDate: '2026-10-20' })], TODAY).length, 1);
  });
});

describe('formatting a day', () => {
  it('writes the day DD-MM-YYYY and the time HH:MM, each in a left-to-right isolate', () => {
    assert.equal(formatExamWhen('2026-10-20', '09:30'), '⁦20-10-2026⁩ ⁦09:30⁩');
    assert.equal(formatExamWhen('2026-10-20', null), '⁦20-10-2026⁩');
    assert.equal(formatExamWhen('2026-10-20', '9:30'), '⁦20-10-2026⁩', 'a malformed time is left out');
    assert.equal(formatExamTime('25:00'), null);
  });

  it('says today and tomorrow by the Amman day', () => {
    assert.equal(examDayKind('2026-10-14', TODAY), 'today');
    assert.equal(examDayKind('2026-10-15', TODAY), 'tomorrow');
    assert.equal(examDayKind('2026-10-30', TODAY), 'later');
  });
});

describe('groupChildExams', () => {
  it("puts one child's rows from two teachers under one key, without repeating an exam", () => {
    const children: ChildExams[] = [
      { key: 'k-sara', studentId: 's1', displayName: 'سارة', exams: [exam({ evaluationId: 'x' })] },
      { key: 'k-sara', studentId: 's2', displayName: 'سارة', exams: [exam({ evaluationId: 'y' }), exam({ evaluationId: 'x' })] },
      { key: 'k-adam', studentId: 'a1', displayName: 'آدم', exams: [] },
    ];
    const groups = groupChildExams(children);
    assert.deepEqual(groups.map(g => g.key), ['k-adam', 'k-sara'], 'by name, like the server groups children');
    assert.deepEqual(groups[1]!.exams.map(e => e.evaluationId), ['x', 'y']);
  });

  it('falls back to the roster row id from an older server', () => {
    const groups = groupChildExams([{ studentId: 's1', displayName: 'سارة', exams: [] }]);
    assert.equal(groups[0]!.key, 's1');
  });
});
```

- [ ] **Step 2: Run to verify failure.** `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/myExams.test.ts services/__tests__/upcomingExams.test.ts` → FAIL.

- [ ] **Step 3: Implement `myExams.ts`.** Add `'paper'` to `MyExamState`; add the three optional fields to `MyExam` with doc comments ("`examDate` 'YYYY-MM-DD', a calendar day with no zone — compare as a string, never through `Date`"; "`paper`: sat on paper; never has a link"); add `key?: string` to `ChildExams` ("the server's child key — one child's rows under two teachers share it; absent from an older server"); add `paper: 'myExamsStatePaper'` to `MY_EXAM_STATE_KEY`; add as the first line of `myExamAction`'s body after the result case: `if (exam.state === 'paper') return null;`.

- [ ] **Step 4: Implement `upcomingExams.ts`.**

```ts
/**
 * «الاختبارات القادمة» — the exams with a planned day from today on, for the
 * School tab. Pure: the lists come from GET /student/exams and /parent/exams
 * (services/studentExam.ts), which already apply every visibility rule.
 *
 * An exam's day is plain text ("YYYY-MM-DD", the teacher's calendar day, no
 * zone), unlike a homework due date, which is an Amman instant. Compare it as a
 * string against `ammanToday()`; never `new Date(examDate)`, which moves the day
 * in any zone west of UTC.
 */
import { dueBadge, formatDueDate, isValidYmd } from './homework.ts';
import type { ChildExams, MyExam } from './myExams.ts';

export interface ExamGroup {
  key: string;
  displayName: string;
  exams: MyExam[];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A parent's list is one entry per roster row; the School tab's picker is one
 * per child (the server's `key`). Same name order as the server's grouping.
 */
export function groupChildExams(children: readonly ChildExams[]): ExamGroup[] {
  const byKey = new Map<string, ExamGroup>();
  for (const child of children) {
    const key = child.key || child.studentId;
    const group = byKey.get(key) ?? { key, displayName: child.displayName, exams: [] };
    for (const e of child.exams) {
      if (!group.exams.some(x => x.evaluationId === e.evaluationId)) group.exams.push(e);
    }
    byKey.set(key, group);
  }
  return [...byKey.values()].sort(
    (a, b) => a.displayName.trim().localeCompare(b.displayName.trim(), 'ar') || (a.key < b.key ? -1 : 1),
  );
}

const timeKey = (e: MyExam) => (e.examTime && TIME.test(e.examTime) ? e.examTime : '99:99');
const titleOf = (e: MyExam) => e.titleAr || e.title || '';

/** Dated today or later, soonest first; whatever their state. */
export function upcomingExams(exams: readonly MyExam[], today: string): MyExam[] {
  return exams
    .filter(e => typeof e.examDate === 'string' && isValidYmd(e.examDate) && e.examDate >= today)
    .sort(
      (a, b) =>
        a.examDate!.localeCompare(b.examDate!) ||
        timeKey(a).localeCompare(timeKey(b)) ||
        titleOf(a).localeCompare(titleOf(b), 'ar'),
    );
}

/** HH:MM in a left-to-right isolate, or null for no (or a malformed) time. */
export function formatExamTime(examTime: string | null | undefined): string | null {
  return examTime && TIME.test(examTime) ? `⁦${examTime}⁩` : null;
}

/** The day as DD-MM-YYYY (same as homework), then the time, each isolated. */
export function formatExamWhen(examDate: string, examTime: string | null | undefined): string {
  const time = formatExamTime(examTime);
  return time ? `${formatDueDate(examDate)} ${time}` : formatDueDate(examDate);
}

export type ExamDayKind = 'today' | 'tomorrow' | 'later';

export function examDayKind(examDate: string, today: string): ExamDayKind {
  const badge = dueBadge(examDate, today);
  return badge.kind === 'today' || badge.kind === 'tomorrow' ? badge.kind : 'later';
}
```

- [ ] **Step 5: i18n.** Add to both `ar` and `en` in `services/i18n.ts`, next to the `myExamsState*` keys (ar ~L2145, en ~L4623) and the `school*` keys; placeholders are functions, as the file already does (`myExamsSentOn: (date: string) => …`):

| key | ar | en |
| --- | --- | --- |
| `myExamsStatePaper` | امتحان ورقي | Paper exam |
| `myExamsOnDate` | `(when: string) => \`موعده ${when}\`` | `(when: string) => \`On ${when}\`` |
| `upcomingExamsTitle` | الاختبارات القادمة | Upcoming exams |
| `upcomingExamsDescStudent` | مواعيد اختباراتك كما حدّدها معلّموك. | Your exam dates, as your teachers set them. |
| `upcomingExamsDescParent` | مواعيد اختبارات أبنائك كما حدّدها المعلّمون. | Your children's exam dates, as their teachers set them. |
| `upcomingExamsNone` | لا اختبارات بموعد قادم. | No upcoming exams with a date. |
| `upcomingExamsLoadFailed` | تعذّر تحميل الاختبارات | Couldn't load exams |
| `examDayToday` | اليوم | Today |
| `examDayTomorrow` | غداً | Tomorrow |
| `examDateNoClassHint` | أرفق الامتحان بشعبة ليرى الطلبة وأولياء الأمور موعده. | Attach this exam to a class so students and parents can see its date. |
| `examDateDraftHint` | لا يرى الطلبة وأولياء الأمور الموعد حتى تنشر الامتحان. | Students and parents see the date once you publish the exam. |

  And change the existing `schoolPageDesc` to «واجباتك واختباراتك القادمة وجدول حصصك.» / "Your homework, upcoming exams and timetable.", `schoolPageDescParent` to «واجبات أبنائك واختباراتهم القادمة وجداول حصصهم.» / "Your children's homework, upcoming exams and timetables."

- [ ] **Step 6: Run** the two test files plus `services/__tests__/i18n.test.ts` → pass; `pnpm test` in `artifacts/mobile`; `pnpm run typecheck` at the root (it fails in `app/my-exams.tsx` until Task 7 adds `paper` to `STATE_COLOR` / `STATE_ICON` — so do the two-line `STATE_COLOR.paper: '#475467'` and `STATE_ICON.paper: 'document-text-outline'` additions here to keep the build green).

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/services artifacts/mobile/app/my-exams.tsx
git commit -m "feat(mobile): exam dates, the paper state and upcoming-exam logic, with copy"
```

---

### Task 7: Families see the dates — School tab section, «اختباراتي» rows, and the teacher's date hints

**Files:**
- Modify: `artifacts/mobile/app/(tabs)/school.tsx`, `artifacts/mobile/app/my-exams.tsx`, `artifacts/mobile/components/ExamDateCard.tsx`

**Interfaces:**
- Consumes: Task 6 (`groupChildExams`, `upcomingExams`, `examDayKind`, `formatExamTime`, `formatExamWhen`, `MY_EXAM_STATE_KEY`, `myExamTitle`, `subjectLabel`, new copy); `getMyExams`, `getChildExams` (`services/studentExam.ts`); `ammanToday`, `isValidYmd` (`services/homework.ts`).

- [ ] **Step 1: School tab — state and loader.** In `school.tsx`, next to the homework state:

```tsx
  // Exams have their own list, error and sequence, like homework: one failing
  // never blanks the other. A parent's rows are per roster row; grouped by the
  // server's child key so they follow the same picker.
  const [exams, setExams] = useState<ExamGroup[] | null>(null);
  const [examError, setExamError] = useState('');
  const examSeq = useRef(0);
  const loadExams = useCallback(async () => {
    if (!user) return;
    const seq = ++examSeq.current;
    setExamError('');
    try {
      const next = isParent
        ? groupChildExams(await getChildExams())
        : [{ key: 'self', displayName: '', exams: await getMyExams() }];
      if (seq === examSeq.current) setExams(next);
    } catch (e) {
      if (seq === examSeq.current) setExamError(apiErrorMessage(e, 'upcomingExamsLoadFailed', t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParent, user?.id]);
```

  Call `void loadExams()` in the focus effect and include `loadExams()` in `onRefresh`'s `Promise.all`; add `loadExams` to both dependency arrays. Picker fallback: `children ?? homework ?? exams ?? []`. Active child, after `hwChild`:

```tsx
  // Same child as the picker shows, whichever list decided it.
  const activeKey = selected ?? child?.key ?? hwChild?.key ?? null;
  const examChild = exams ? (exams.find(g => g.key === activeKey) ?? exams[0] ?? null) : null;
  const upcoming = upcomingExams(examChild?.exams ?? [], hwToday);
```

  `loading` also waits for `exams === null && !examError`. Update the header comment: the page shows homework, then upcoming exams, then the timetable; exams load and fail on their own.

- [ ] **Step 2: School tab — the section**, between the homework `</View>` and the timetable block:

```tsx
        <View style={{ gap: SPACE.md, marginTop: SPACE.md }}>
          <View style={{ gap: SPACE.xs }}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: align }}>
              {t('upcomingExamsTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align }}>
              {t(isParent ? 'upcomingExamsDescParent' : 'upcomingExamsDescStudent')}
            </Text>
          </View>

          {examError ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: rowDir },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {examError}
              </Text>
              <Pressable onPress={() => void loadExams()} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textDecorationLine: 'underline' }}>
                  {t('retry')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {exams !== null && !examError && upcoming.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, textAlign: align }}>
              {t('upcomingExamsNone')}
            </Text>
          ) : null}

          {upcoming.map(exam => (
            <UpcomingExamRow key={exam.evaluationId} exam={exam} today={hwToday} colors={colors} isRTL={isRTL} lang={lang} t={t} />
          ))}
        </View>
```

  And the row component at the bottom of the file:

```tsx
function UpcomingExamRow({
  exam, today, colors, isRTL, lang, t,
}: {
  exam: MyExam;
  today: string;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  lang: 'ar' | 'en';
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const kind = examDayKind(exam.examDate!, today);
  const dayColor = kind === 'later' ? colors.mutedForeground : palette.warning;
  const dayText = kind === 'today' ? t('examDayToday') : kind === 'tomorrow' ? t('examDayTomorrow') : formatExamWhen(exam.examDate!, null);
  const subject = subjectLabel(exam.subjectId, lang);
  const meta = [subject, formatExamTime(exam.examTime), t(MY_EXAM_STATE_KEY[exam.state] ?? 'myExamsStateClosed')]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push('/my-exams' as never)}
      style={({ pressed }) => [
        styles.examRow,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.hwBadge, { backgroundColor: dayColor + '1A' }]}>
        <Text style={{ color: dayColor, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{dayText}</Text>
      </View>
      <View style={{ flex: 1, gap: SPACE.xs }}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>
          {myExamTitle(exam, lang) || t('myExamsUntitled', subject ?? '')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 21, textAlign: align }}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}
```

  Add `examRow: { alignItems: 'center', gap: SPACE.md, borderWidth: 1, padding: SPACE.md },` to `styles`. Imports: `getChildExams, getMyExams` from `'@/services/studentExam'`; `groupChildExams, upcomingExams, examDayKind, formatExamTime, formatExamWhen, type ExamGroup` from `'@/services/upcomingExams'`; extend the `'@/services/myExams'` import with `MY_EXAM_STATE_KEY, myExamTitle, type MyExam`.

- [ ] **Step 3: «اختباراتي» rows** (`my-exams.tsx`, `ExamRow`). Imports: `isValidYmd` from `'@/services/homework'`, `formatExamWhen` from `'@/services/upcomingExams'`. Replace the `meta` computation with:

```tsx
  // The planned day, when the teacher set one. A paper exam's "sent" and
  // "handed in" times are when the teacher published it and typed the mark —
  // not what a family means by either — so a paper row shows only its day.
  const examWhen = exam.examDate && isValidYmd(exam.examDate) ? t('myExamsOnDate', formatExamWhen(exam.examDate, exam.examTime)) : null;
  const meta = [
    subject,
    examWhen,
    exam.paper ? null : whenLine,
    exam.timeLimitMin && !exam.paper ? t('myExamsTimeLimit', exam.timeLimitMin) : null,
    exam.totalMarks ? t('myExamsMarks', formatMarks(exam.totalMarks)) : null,
  ].filter(Boolean).join(' · ');
```

  In the chip, use `t(MY_EXAM_STATE_KEY[exam.state] ?? 'myExamsStateClosed')` and `STATE_COLOR[exam.state] ?? '#667085'`, `STATE_ICON[exam.state] ?? 'lock-closed-outline'` so a state a future server adds degrades to «مُغلق» instead of a blank chip. This screen keeps listing a parent's children per roster row (`key: c.studentId`), as before.

- [ ] **Step 4: Date-card hints** (`components/ExamDateCard.tsx`). Widen the prop to `Pick<Evaluation, 'id' | 'gradeId' | 'examDate' | 'examTime' | 'classGroupId' | 'status'>` (the evaluation screen already passes the whole `Evaluation`). Under the existing `examDateHint` text add:

```tsx
      {/* Families see a date only on an exam they can see: published, in a class. */}
      {!evaluation.classGroupId ? (
        <Text style={{ color: colors.warning, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 19, textAlign: align }}>
          {t('examDateNoClassHint')}
        </Text>
      ) : evaluation.status === 'draft' ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 19, textAlign: align }}>
          {t('examDateDraftHint')}
        </Text>
      ) : null}
```

  Update the file's header comment: the date is also what families see on «اختباراتي» and the School tab, for a published exam attached to a class.

- [ ] **Step 5: Run** `cd artifacts/mobile && pnpm test` (`designScale`, `ariaState`, `i18n` included) and `pnpm run typecheck` at the root. Fix ratchet failures with tokens, never by raising a ceiling.

- [ ] **Step 6: Say what was seen.** The controller does the visual check (Task 10). In the report, state that the screens were type-checked and tested, not seen, unless a fixture route already exists under `app/dev/` for this (check; do not create one and do not commit any throwaway).

- [ ] **Step 7: Commit**

```bash
git add "artifacts/mobile/app/(tabs)/school.tsx" artifacts/mobile/app/my-exams.tsx artifacts/mobile/components/ExamDateCard.tsx
git commit -m "feat(mobile): upcoming exams on the School tab, dates on «اختباراتي», and the teacher's date hints"
```

---

### Task 8: Mobile mark-book logic, the fetcher, teacher copy, and «مجموع فقط» on the new-exam screen

**Files:**
- Create: `artifacts/mobile/services/paperMarks.ts`
- Modify: `artifacts/mobile/services/evaluations.ts`, `artifacts/mobile/services/i18n.ts`, `artifacts/mobile/app/evaluations/new.tsx`
- Test: `artifacts/mobile/services/__tests__/paperMarks.test.ts` (new)

**Interfaces:**
- Consumes: Task 5's HTTP contract; `toLatinDigits` (`services/latinDigits.ts`); types `AttemptListRow`, `EvaluationQuestion`, `PaperQuestionInput`, `Difficulty` from `services/evaluations.ts` (**`import type` only** — that file imports `apiClient.ts`).
- Produces (`paperMarks.ts`) — **Task 9 uses all of these**:

```ts
export const QUICK_PAPER_MAX = 100;          // MAX_MARKS_PER_QUESTION on the server
export const PAPER_TOTALS_CHUNK = 100;       // rows per request from the app (server cap 300)
export type PaperTotalErrorCode = 'not_in_class' | 'not_in_group' | 'marks_out_of_range' | 'kept_student_work' | 'not_quick_paper' | 'failed';
export type PaperTotalResult =
  | { studentId: string; status: 'saved' | 'unchanged'; marks: number }
  | { studentId: string; status: 'cleared'; marks: null }
  | { studentId: string; status: 'error'; code: PaperTotalErrorCode };
export const PAPER_TOTAL_ERROR_KEY: Record<PaperTotalErrorCode, TranslationKeyString>;
export type MarkParse = { ok: true; value: number | null } | { ok: false; error: 'invalid' | 'range' | 'precision' };
export function parsePaperMark(text: string, max: number): MarkParse;
export function formatMark(n: number): string;
export type RowStatus = { kind: 'idle' } | { kind: 'saved' } | { kind: 'cleared' } | { kind: 'error'; code: PaperTotalErrorCode };
export interface GridRow { studentId: string; name: string; saved: number | null; pendingFinal: boolean; text: string; status: RowStatus }
export function initialGridRows(roster: readonly { id: string; displayName: string }[], attempts: readonly Pick<AttemptListRow, 'studentId' | 'submittedAt' | 'result'>[]): GridRow[];
export function editRow(rows: readonly GridRow[], studentId: string, text: string): GridRow[];
export function rowState(row: GridRow, max: number): { dirty: boolean; invalid: boolean; value: number | null };
export function buildTotalsRequest(rows: readonly GridRow[], max: number): { totals: { studentId: string; marks: number | null }[]; invalidIds: string[] };
export function mergeTotalsResponse(rows: readonly GridRow[], results: readonly PaperTotalResult[]): GridRow[];
export function gridSummary(rows: readonly GridRow[], max: number): { total: number; entered: number; dirty: number; invalid: number; errors: number };
export function isPaperExam(questions: readonly Pick<EvaluationQuestion, 'gradingMode' | 'body'>[]): boolean;
export function isQuickPaperExam(questions: readonly Pick<EvaluationQuestion, 'gradingMode' | 'body'>[]): boolean;
export function quickPaperQuestions(totalText: string, objectiveIds: readonly string[], difficulty: Difficulty): { ok: true; questions: PaperQuestionInput[] } | { ok: false };
```

  (`TranslationKeyString` above means: the object is declared `as const satisfies Record<PaperTotalErrorCode, string>`, like `MY_EXAM_STATE_KEY`, so the screen can pass its values to `t`.)
- Produces (`evaluations.ts`): `savePaperTotals(evaluationId: string, totals: { studentId: string; marks: number | null }[]): Promise<{ maxMarks: number; results: PaperTotalResult[] }>` — `PUT /evaluations/:id/paper-totals`, `timeoutMs: 45_000`.

- [ ] **Step 1: Write the failing tests** (`paperMarks.test.ts`):

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TOTAL_ERROR_KEY, buildTotalsRequest, editRow, formatMark, gridSummary, initialGridRows,
  isPaperExam, isQuickPaperExam, mergeTotalsResponse, parsePaperMark, quickPaperQuestions, rowState,
} from '../paperMarks.ts';

const result = (earned: string, provisional = false) =>
  ({ attemptId: 'a', earnedMarks: earned, totalMarks: '20.00', percent: '0', competencyScores: {} as never, levelKey: null, isProvisional: provisional });

describe('parsePaperMark', () => {
  it('reads an empty box as "no mark"', () => {
    assert.deepEqual(parsePaperMark('', 20), { ok: true, value: null });
    assert.deepEqual(parsePaperMark('   ', 20), { ok: true, value: null });
  });
  it('reads Latin and Arabic-Indic digits, and three decimal separators', () => {
    for (const [text, value] of [['15', 15], ['١٥', 15], ['۱۵', 15], ['12.5', 12.5], ['12٫5', 12.5], ['12,5', 12.5], ['0', 0], ['20', 20]] as const) {
      assert.deepEqual(parsePaperMark(text, 20), { ok: true, value }, text);
    }
  });
  it('refuses more than two decimals, out-of-range marks and anything else', () => {
    assert.deepEqual(parsePaperMark('12.555', 20), { ok: false, error: 'precision' });
    assert.deepEqual(parsePaperMark('21', 20), { ok: false, error: 'range' });
    for (const bad of ['-1', 'abc', '1e1', '.', '1.2.3']) assert.deepEqual(parsePaperMark(bad, 20), { ok: false, error: 'invalid' }, bad);
  });
});

describe('the grid', () => {
  const roster = [{ id: 's1', displayName: 'آدم' }, { id: 's2', displayName: 'سارة' }, { id: 's3', displayName: 'زين' }];
  const attempts = [
    { studentId: 's1', submittedAt: '2026-10-12T10:00:00Z', result: result('15.00') },
    { studentId: 's2', submittedAt: null, result: result('12.50') },
    { studentId: 's3', submittedAt: null, result: result('0.00', true) },
  ];

  it('starts from what the server holds, in roster order', () => {
    const rows = initialGridRows(roster, attempts);
    assert.deepEqual(rows.map(r => [r.studentId, r.saved, r.pendingFinal, r.text]), [
      ['s1', 15, false, '15'],
      ['s2', 12.5, true, '12.5'],
      ['s3', null, false, ''],
    ]);
  });

  it('sends only what changed, plus marks typed but never handed in', () => {
    let rows = initialGridRows(roster, attempts);
    assert.deepEqual(buildTotalsRequest(rows, 20), { totals: [{ studentId: 's2', marks: 12.5 }], invalidIds: [] });
    rows = editRow(rows, 's1', '');
    rows = editRow(rows, 's3', '١٨');
    assert.deepEqual(buildTotalsRequest(rows, 20).totals, [
      { studentId: 's1', marks: null },
      { studentId: 's2', marks: 12.5 },
      { studentId: 's3', marks: 18 },
    ]);
    rows = editRow(rows, 's3', '99');
    assert.deepEqual(buildTotalsRequest(rows, 20).invalidIds, ['s3']);
    assert.deepEqual(rowState(rows[2]!, 20), { dirty: false, invalid: true, value: null });
  });

  it('takes the server answer row by row', () => {
    let rows = editRow(initialGridRows(roster, attempts), 's3', '18');
    rows = mergeTotalsResponse(rows, [
      { studentId: 's2', status: 'saved', marks: 12.5 },
      { studentId: 's3', status: 'error', code: 'not_in_class' },
    ]);
    assert.deepEqual([rows[1]!.saved, rows[1]!.pendingFinal, rows[1]!.status], [12.5, false, { kind: 'saved' }]);
    assert.deepEqual([rows[2]!.text, rows[2]!.status], ['18', { kind: 'error', code: 'not_in_class' }]);
    rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'cleared', marks: null }]);
    assert.deepEqual([rows[0]!.saved, rows[0]!.text, rows[0]!.status], [null, '', { kind: 'cleared' }]);
    assert.deepEqual(gridSummary(rows, 20), { total: 3, entered: 1, dirty: 1, invalid: 0, errors: 1 });
  });

  it('formats a mark the way it is stored', () => {
    assert.equal(formatMark(15), '15');
    assert.equal(formatMark(12.5), '12.5');
    assert.equal(formatMark(16.25), '16.25');
  });

  it('names a message for every refusal the server can send', () => {
    for (const code of ['not_in_class', 'not_in_group', 'marks_out_of_range', 'kept_student_work', 'not_quick_paper', 'failed'] as const) {
      assert.ok(PAPER_TOTAL_ERROR_KEY[code], code);
    }
  });
});

describe('paper exams', () => {
  const PAPER = { gradingMode: 'manual' as const, body: {} };
  const TYPED = { gradingMode: 'manual' as const, body: { prompt: 'x' } };
  it('agrees with the server on what a paper exam is', () => {
    assert.equal(isPaperExam([PAPER, PAPER]), true);
    assert.equal(isPaperExam([PAPER, TYPED]), false);
    assert.equal(isPaperExam([]), false);
    assert.equal(isQuickPaperExam([PAPER]), true);
    assert.equal(isQuickPaperExam([PAPER, PAPER]), false);
  });

  it('builds the one question of a total-only paper', () => {
    const r = quickPaperQuestions('٢٠', ['obj-2', 'obj-1'], 'standard');
    assert.deepEqual(r, { ok: true, questions: [{ marks: 20, objectiveId: 'obj-2', competencyKey: 'understanding', difficulty: 'standard' }] });
    for (const bad of ['', '0', '101', 'x', '12.555']) assert.equal(quickPaperQuestions(bad, ['obj-1'], 'standard').ok, false, bad);
    assert.equal(quickPaperQuestions('20', [], 'standard').ok, false);
  });
});
```

- [ ] **Step 2: Run to verify failure.** `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/paperMarks.test.ts` → FAIL.

- [ ] **Step 3: Implement `paperMarks.ts`.**

```ts
/**
 * The class mark book for a paper exam typed as one total per student — the
 * logic behind app/evaluations/[id]/marks.tsx, and the «مجموع فقط» question the
 * new-exam screen creates. Pure: loaded by bare `node --test`, so types only
 * from evaluations.ts (which imports apiClient).
 *
 * A row is dirty when what the box says differs from what the server holds —
 * or when the server holds a mark that was never handed in (typed on the
 * student's own page without «سلّم»): families cannot see that one, and
 * «حفظ الكل» is the step that hands it in.
 */
import { toLatinDigits } from './latinDigits.ts';
import type { AttemptListRow, Difficulty, EvaluationQuestion, PaperQuestionInput } from './evaluations.ts';

/** MAX_MARKS_PER_QUESTION in api-server/src/modules/assessment/paperExam.ts. */
export const QUICK_PAPER_MAX = 100;
/** Rows per request: well under the server's 300, and under apiFetch's timeout. */
export const PAPER_TOTALS_CHUNK = 100;

export type PaperTotalErrorCode =
  | 'not_in_class'
  | 'not_in_group'
  | 'marks_out_of_range'
  | 'kept_student_work'
  | 'not_quick_paper'
  | 'failed';

export type PaperTotalResult =
  | { studentId: string; status: 'saved' | 'unchanged'; marks: number }
  | { studentId: string; status: 'cleared'; marks: null }
  | { studentId: string; status: 'error'; code: PaperTotalErrorCode };

export const PAPER_TOTAL_ERROR_KEY = {
  not_in_class: 'marksGridErrNotInClass',
  not_in_group: 'marksGridErrNotInGroup',
  marks_out_of_range: 'marksGridInvalid',
  kept_student_work: 'marksGridErrKept',
  not_quick_paper: 'marksGridNotQuick',
  failed: 'marksGridErrFailed',
} as const satisfies Record<PaperTotalErrorCode, string>;

export type MarkParse = { ok: true; value: number | null } | { ok: false; error: 'invalid' | 'range' | 'precision' };

const NUMBER = /^\d+(\.\d+)?$/;

export function parsePaperMark(text: string, max: number): MarkParse {
  const s = toLatinDigits(text).trim().replace(/[٫,]/g, '.');
  if (s === '') return { ok: true, value: null };
  if (!NUMBER.test(s)) return { ok: false, error: 'invalid' };
  if ((s.split('.')[1] ?? '').length > 2) return { ok: false, error: 'precision' };
  const value = Number(s);
  if (value < 0 || value > max) return { ok: false, error: 'range' };
  return { ok: true, value };
}

export function formatMark(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export type RowStatus = { kind: 'idle' } | { kind: 'saved' } | { kind: 'cleared' } | { kind: 'error'; code: PaperTotalErrorCode };

export interface GridRow {
  studentId: string;
  name: string;
  /** The mark the server holds (final or not), or null. */
  saved: number | null;
  /** The server holds `saved` but it was never handed in, so no family can see it. */
  pendingFinal: boolean;
  /** What the box says. */
  text: string;
  status: RowStatus;
}

export function initialGridRows(
  roster: readonly { id: string; displayName: string }[],
  attempts: readonly Pick<AttemptListRow, 'studentId' | 'submittedAt' | 'result'>[],
): GridRow[] {
  const byStudent = new Map(attempts.map(a => [a.studentId, a]));
  return roster.map(s => {
    const a = byStudent.get(s.id);
    const saved = a?.result && !a.result.isProvisional ? Number(a.result.earnedMarks) : null;
    return {
      studentId: s.id,
      name: s.displayName,
      saved,
      pendingFinal: saved !== null && !a?.submittedAt,
      text: saved === null ? '' : formatMark(saved),
      status: { kind: 'idle' },
    };
  });
}

export function editRow(rows: readonly GridRow[], studentId: string, text: string): GridRow[] {
  return rows.map(r => (r.studentId === studentId ? { ...r, text, status: { kind: 'idle' } } : r));
}

export function rowState(row: GridRow, max: number): { dirty: boolean; invalid: boolean; value: number | null } {
  const parsed = parsePaperMark(row.text, max);
  if (!parsed.ok) return { dirty: false, invalid: true, value: null };
  const value = parsed.value;
  const dirty = value !== row.saved || (value !== null && row.pendingFinal);
  return { dirty, invalid: false, value };
}

export function buildTotalsRequest(
  rows: readonly GridRow[],
  max: number,
): { totals: { studentId: string; marks: number | null }[]; invalidIds: string[] } {
  const totals: { studentId: string; marks: number | null }[] = [];
  const invalidIds: string[] = [];
  for (const row of rows) {
    const s = rowState(row, max);
    if (s.invalid) invalidIds.push(row.studentId);
    else if (s.dirty) totals.push({ studentId: row.studentId, marks: s.value });
  }
  return { totals, invalidIds };
}

export function mergeTotalsResponse(rows: readonly GridRow[], results: readonly PaperTotalResult[]): GridRow[] {
  const byStudent = new Map(results.map(r => [r.studentId, r]));
  return rows.map(row => {
    const r = byStudent.get(row.studentId);
    if (!r) return row;
    if (r.status === 'error') return { ...row, status: { kind: 'error', code: r.code } };
    if (r.status === 'cleared') return { ...row, saved: null, pendingFinal: false, text: '', status: { kind: 'cleared' } };
    return { ...row, saved: r.marks, pendingFinal: false, text: formatMark(r.marks), status: { kind: 'saved' } };
  });
}

export function gridSummary(
  rows: readonly GridRow[],
  max: number,
): { total: number; entered: number; dirty: number; invalid: number; errors: number } {
  let entered = 0, dirty = 0, invalid = 0, errors = 0;
  for (const row of rows) {
    const s = rowState(row, max);
    if (row.saved !== null && !row.pendingFinal) entered++;
    if (s.dirty) dirty++;
    if (s.invalid) invalid++;
    if (row.status.kind === 'error') errors++;
  }
  return { total: rows.length, entered, dirty, invalid, errors };
}

type QuestionShape = Pick<EvaluationQuestion, 'gradingMode' | 'body'>;
/** The server's rule (paperExam.ts `isPaperQuestion`): marked by hand, nothing in the body. */
const isPaperQ = (q: QuestionShape) => q.gradingMode === 'manual' && Object.keys(q.body ?? {}).length === 0;

export function isPaperExam(questions: readonly QuestionShape[]): boolean {
  return questions.length > 0 && questions.every(isPaperQ);
}

export function isQuickPaperExam(questions: readonly QuestionShape[]): boolean {
  return questions.length === 1 && isPaperQ(questions[0]!);
}

/**
 * «مجموع فقط»: a paper exam of one question worth the total, measured against
 * the first selected objective. Its competency breakdown rests on one question,
 * which scoring reports as "not enough evidence" rather than a percentage.
 */
export function quickPaperQuestions(
  totalText: string,
  objectiveIds: readonly string[],
  difficulty: Difficulty,
): { ok: true; questions: PaperQuestionInput[] } | { ok: false } {
  const parsed = parsePaperMark(totalText, QUICK_PAPER_MAX);
  const objectiveId = objectiveIds[0];
  if (!parsed.ok || parsed.value === null || parsed.value <= 0 || !objectiveId) return { ok: false };
  return { ok: true, questions: [{ marks: parsed.value, objectiveId, competencyKey: 'understanding', difficulty }] };
}
```

- [ ] **Step 4: Fetcher** in `services/evaluations.ts`, after `listAttempts`:

```ts
/**
 * The class mark book: one total per student for a quick paper exam. Answers
 * per student — saved, unchanged, cleared, or refused with a code — so one bad
 * row never loses the others. Longer than the 15s default: each row is a mark
 * and a hand-in.
 */
export async function savePaperTotals(
  evaluationId: string,
  totals: { studentId: string; marks: number | null }[],
): Promise<{ maxMarks: number; results: import('./paperMarks.ts').PaperTotalResult[] }> {
  const res = await apiFetch(`/evaluations/${evaluationId}/paper-totals`, {
    method: 'PUT',
    body: JSON.stringify({ totals }),
    timeoutMs: 45_000,
  });
  return readJson(res, 'Saving marks');
}
```

- [ ] **Step 5: Teacher copy.** Add to both `ar` and `en`, next to `paperGridHint` (ar ~L2203, en ~L4679). Placeholders are functions taking strings:

| key | ar | en |
| --- | --- | --- |
| `paperShapeQuestions` | لكل سؤال | Per question |
| `paperShapeTotal` | مجموع فقط | Total only |
| `paperShapeTotalHint` | علامة واحدة لكل طالب من مجموع تحدّده — مثل دفتر العلامات. | One mark per student out of a total you set — like a mark book. |
| `paperTotalLabel` | العلامة الكاملة | Out of |
| `paperTotalInvalid` | `(max: string) => \`العلامة الكاملة رقم أكبر من صفر وحتى ${max}.\`` | `(max: string) => \`The total must be more than 0 and at most ${max}.\`` |
| `marksGridBtn` | أدخل العلامات | Enter marks |
| `marksGridTableBtn` | أدخل العلامات كجدول | Enter marks as a table |
| `marksGridTitle` | علامات الطلبة | Student marks |
| `marksGridHint` | `(max: string) => \`اكتب علامة كل طالب من ${max}. اترك الخانة فارغة لمن لم يقدّم الامتحان.\`` | `(max: string) => \`Type each student's mark out of ${max}. Leave it empty for anyone who did not sit it.\`` |
| `marksGridMarkLabel` | `(name: string) => \`علامة ${name}\`` | `(name: string) => \`Mark for ${name}\`` |
| `marksGridSaveAll` | حفظ الكل | Save all |
| `marksGridSaved` | تم الحفظ. | Saved. |
| `marksGridUnsaved` | `(n: string) => \`${n} لم تُحفظ بعد\`` | `(n: string) => \`${n} not saved yet\`` |
| `marksGridEntered` | `(done: string, total: string) => \`أُدخلت ${done} من ${total}\`` | `(done: string, total: string) => \`${done} of ${total} entered\`` |
| `marksGridFixInvalid` | صحّح العلامات المحدّدة بالأحمر قبل الحفظ. | Fix the marks shown in red before saving. |
| `marksGridInvalid` | `(max: string) => \`علامة من 0 إلى ${max}، بخانتين عشريتين على الأكثر\`` | `(max: string) => \`A mark from 0 to ${max}, at most two decimals\`` |
| `marksGridErrNotInClass` | لم يعد هذا الطالب في الشعبة. | This student is no longer in the class. |
| `marksGridErrNotInGroup` | هذا الطالب ليس ضمن مجموعة هذا الاختبار. | This student is not in this check's group. |
| `marksGridErrKept` | لهذا الطالب إجابات مسجّلة — عدّلها من صفحته. | This student has recorded answers — change them on their page. |
| `marksGridErrFailed` | تعذّر حفظ هذه العلامة — حاول مرة أخرى. | Couldn't save this mark — try again. |
| `marksGridNotQuick` | لهذا الامتحان أكثر من سؤال — أدخل علامات كل طالب من صفحته. | This exam has more than one question — enter each student's marks on their page. |
| `marksGridNeedsPublish` | انشر الامتحان أولاً، ثم أدخل العلامات. | Publish the exam first, then enter the marks. |
| `marksGridNeedsClass` | أرفق الامتحان بشعبة أولاً لإدخال علامات طلابها. | Attach the exam to a class first to enter its students' marks. |
| `marksGridEmptyClass` | لا طلاب في هذه الشعبة بعد. | No students in this class yet. |
| `marksGridLoadFailed` | تعذّر تحميل العلامات | Couldn't load the marks |
| `marksGridSaveFailed` | تعذّر حفظ العلامات | Couldn't save the marks |
| `marksGridNotReleased` | النتائج غير معلنة — لا يرى الطلبة وأولياء الأمور العلامات حتى تعلنها. | Results not released — students and parents see no marks until you release them. |
| `marksGridReleasedWarning` | النتائج معلنة: أي علامة تحفظها الآن تظهر فورًا للطالب ووليّ أمره، دون إشعار. | Results are released: any mark you save now shows to the student and their parent at once, with no notification. |
| `marksGridSaveFirst` | احفظ العلامات قبل إعلان النتائج. | Save the marks before releasing the results. |

- [ ] **Step 6: «مجموع فقط» on `app/evaluations/new.tsx`.**
  - Imports: `QUICK_PAPER_MAX, quickPaperQuestions` from `'@/services/paperMarks'`.
  - State: `const [paperShape, setPaperShape] = useState<'questions' | 'total'>('total');` (total-only is the common case for a teacher's own paper) and `const [paperTotal, setPaperTotal] = useState('20');`. `const totalOnly = mode === 'paper' && paperShape === 'total';`
  - Under the mode hint, when `mode === 'paper'`, a second chip row (same `styles.modeRow` / `styles.modeChip` look) with two `Pressable`s, each `accessibilityRole="button"` and `aria-selected={paperShape === shape}`, labels `paperShapeTotal` / `paperShapeQuestions`; under it, when `totalOnly`, the hint `paperShapeTotalHint`.
  - Hide the question-count `PickerField` when `totalOnly`. When `totalOnly`, render instead of the paper grid: the `paperTotalLabel` label and a `TextInput` (`value={paperTotal}`, `onChangeText={setPaperTotal}`, `keyboardType="decimal-pad"`, `maxLength={6}`, `accessibilityLabel={t('paperTotalLabel')}`, styled like `styles.input`, with `textAlign: 'center'` and a `width` of `SPACE.hero * 2`). The `selectAtLeastOneObjective` warning still shows when nothing is selected.
  - In `onSubmit`, replace the `if (mode === 'paper') { … bad row … }` block with:

```ts
    const quick = totalOnly ? quickPaperQuestions(paperTotal, [...selectedObjectives], difficulty) : null;
    if (quick && !quick.ok) {
      setError(t('paperTotalInvalid', String(QUICK_PAPER_MAX)));
      return;
    }
    if (mode === 'paper' && !totalOnly) {
      // Named row, not "check your marks" — on a 30-row grid the teacher
      // should not have to hunt for the one that is wrong.
      const bad = paperRows.findIndex(r => !(Number(toLatinDigits(r.marks)) > 0));
      if (bad >= 0) {
        setError(t('paperMarksInvalid', String(bad + 1)));
        return;
      }
    }
```

    set `targetQuestionCount: mode === 'paper' ? (totalOnly ? 1 : paperRows.length) : QUESTION_COUNTS[countIdx],` and replace the `setPaperQuestions` argument with `quick?.ok ? quick.questions : paperRows.map(…existing mapping…)`.
  - Do not touch the generate flow.

- [ ] **Step 7: Run** the new test file, `pnpm test` (all of `services/__tests__`, `i18n`, `designScale`, `ariaState`), `pnpm run typecheck`.

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/services artifacts/mobile/app/evaluations/new.tsx
git commit -m "feat(mobile): mark-book logic, the paper-totals fetcher, and «مجموع فقط» on a new paper exam"
```

---

### Task 9: The class mark book screen, and the ways in

**Files:**
- Create: `artifacts/mobile/app/evaluations/[id]/marks.tsx`
- Modify: `artifacts/mobile/app/evaluations/[id]/index.tsx`, `artifacts/mobile/app/evaluations/[id]/answers/index.tsx`, `artifacts/mobile/services/__tests__/routeGating.test.ts`

**Interfaces:**
- Consumes: Task 8 (`paperMarks.ts` exports, `savePaperTotals`, copy); `getEvaluation`, `listAttempts`, `setResultsReleased`, `Evaluation` (`services/evaluations.ts`); `getClass` (`services/roster.ts`); `filterToAudience` (`services/supportGroups.ts`); `confirm` (`services/confirm.ts`); `apiErrorMessage`.

- [ ] **Step 1: Write `app/evaluations/[id]/marks.tsx`.**

```tsx
/**
 * «علامات الطلبة» — a paper exam's mark book: one row per student of the exam's
 * class, one box for their total out of N. For a quick paper exam (one paper
 * question worth N, made with «مجموع فقط»); a paper with several questions is
 * marked per student on answers/[studentId].
 *
 * «حفظ الكل» sends only the rows that changed to PUT /evaluations/:id/paper-totals,
 * which hands each one in and answers per student, so one bad row never loses
 * the rest. Families see a mark only after «أعلن النتائج», so the release sits
 * at the foot of this screen and waits for unsaved marks: type, save, release.
 * A mark saved after the release shows to the family at once, with no
 * notification (STATUS.md, Part 3 known gaps) — the screen says so.
 *
 * Loaded once, not on every focus: a refetch would wipe marks typed but not
 * saved. A Stack screen with inputs — the root layout already wraps it in
 * KeyboardSafeView, so there is no KeyboardAvoidingView here (CLAUDE.md).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { getEvaluation, listAttempts, savePaperTotals, setResultsReleased, type Evaluation } from '@/services/evaluations';
import { getClass } from '@/services/roster';
import { filterToAudience } from '@/services/supportGroups';
import { apiErrorMessage } from '@/services/apiErrorKey';
import {
  PAPER_TOTALS_CHUNK,
  PAPER_TOTAL_ERROR_KEY,
  buildTotalsRequest,
  editRow,
  formatMark,
  gridSummary,
  initialGridRows,
  isQuickPaperExam,
  mergeTotalsResponse,
  rowState,
  type GridRow,
} from '@/services/paperMarks';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';

const ACCENT = palette.primary;
const ACCENT_FILL = palette.hero;

type Blocker = 'not_quick' | 'needs_publish' | 'needs_class';
const BLOCKER_KEY = {
  not_quick: 'marksGridNotQuick',
  needs_publish: 'marksGridNeedsPublish',
  needs_class: 'marksGridNeedsClass',
} as const satisfies Record<Blocker, string>;

export default function PaperMarksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [maxMarks, setMaxMarks] = useState(0);
  const [rows, setRows] = useState<GridRow[] | null>(null);
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'release' | null>(null);

  const load = async () => {
    if (!id) return;
    setLoadError('');
    try {
      const { evaluation: ev, questions, audience } = await getEvaluation(id);
      setEvaluation(ev);
      if (!isQuickPaperExam(questions)) return setBlocker('not_quick');
      if (ev.status !== 'published') return setBlocker('needs_publish');
      if (!ev.classGroupId) return setBlocker('needs_class');
      setBlocker(null);
      setMaxMarks(Number(questions[0]!.marks));
      const [{ students }, attempts] = await Promise.all([getClass(ev.classGroupId), listAttempts(id)]);
      setRows(initialGridRows(filterToAudience(students, audience), attempts));
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'marksGridLoadFailed', t));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const summary = rows ? gridSummary(rows, maxMarks) : null;
  const max = formatMark(maxMarks);
  const released = Boolean(evaluation?.releaseResultsToStudent);

  const onSave = async () => {
    if (!id || !rows || busy) return;
    const { totals, invalidIds } = buildTotalsRequest(rows, maxMarks);
    if (invalidIds.length > 0) {
      setNotice({ kind: 'error', text: t('marksGridFixInvalid') });
      return;
    }
    if (totals.length === 0) return;
    setBusy('save');
    setNotice(null);
    try {
      for (let i = 0; i < totals.length; i += PAPER_TOTALS_CHUNK) {
        const { results } = await savePaperTotals(id, totals.slice(i, i + PAPER_TOTALS_CHUNK));
        setRows(prev => (prev ? mergeTotalsResponse(prev, results) : prev));
      }
      // «صُحّح N من M» on the exam lists counts from the server.
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      setNotice({ kind: 'ok', text: t('marksGridSaved') });
    } catch (e) {
      // A retry is safe: a row already saved comes back "unchanged".
      setNotice({ kind: 'error', text: apiErrorMessage(e, 'marksGridSaveFailed', t) });
    } finally {
      setBusy(null);
    }
  };

  const onToggleRelease = async () => {
    if (!id || !evaluation || busy) return;
    const release = !released;
    if (release) {
      const ok = await confirm({
        title: t('releaseResultsBtn'),
        message: t('releaseResultsConfirm'),
        confirmLabel: t('releaseResultsBtn'),
        cancelLabel: t('cancel'),
      });
      if (!ok) return;
    }
    setBusy('release');
    setNotice(null);
    try {
      setEvaluation(await setResultsReleased(id, release));
      await queryClient.invalidateQueries({ queryKey: ['evaluation', id] });
    } catch {
      setNotice({ kind: 'error', text: t('releaseResultsFailed') });
    } finally {
      setBusy(null);
    }
  };

  const title = evaluation ? (lang === 'ar' ? evaluation.titleAr || evaluation.title : evaluation.title || evaluation.titleAr) : '';
  const holdRelease = !released && (summary?.dirty ?? 0) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + SPACE.md }]}>
        <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} />
        <Text style={[styles.headerTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{t('marksGridTitle')}</Text>
        {title ? (
          <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: align }}>
            {title}
          </Text>
        ) : null}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: insets.bottom + SPACE.page, gap: SPACE.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
      >
        {loadError ? (
          <View style={[styles.banner, { borderColor: colors.destructive, flexDirection: rowDir }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={{ flex: 1, color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: align }}>{loadError}</Text>
            <Pressable onPress={() => void load()} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textDecorationLine: 'underline' }}>{t('retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {blocker ? (
          <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align }}>
            {t(BLOCKER_KEY[blocker])}
          </Text>
        ) : null}

        {!blocker && !loadError && rows === null ? <ActivityIndicator color={ACCENT} style={{ marginTop: SPACE.page }} /> : null}

        {rows && !blocker ? (
          <>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}>
              {t('marksGridHint', max)}
            </Text>
            {rows.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: align }}>{t('marksGridEmptyClass')}</Text>
            ) : null}
            {rows.map(row => (
              <MarkRow
                key={row.studentId}
                row={row}
                max={maxMarks}
                onChange={text => setRows(prev => (prev ? editRow(prev, row.studentId, text) : prev))}
                colors={colors}
                isRTL={isRTL}
                t={t}
              />
            ))}

            {summary ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                {[t('marksGridEntered', String(summary.entered), String(summary.total)), summary.dirty ? t('marksGridUnsaved', String(summary.dirty)) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}

            {notice ? (
              <Text style={{ color: notice.kind === 'error' ? colors.destructive : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, textAlign: align }}>
                {notice.text}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void onSave()}
              disabled={busy !== null || !summary?.dirty}
              accessibilityRole="button"
              style={[styles.primary, { backgroundColor: ACCENT_FILL, opacity: busy !== null || !summary?.dirty ? 0.5 : 1 }]}
            >
              {busy === 'save' ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>{t('marksGridSaveAll')}</Text>
              )}
            </Pressable>

            <View style={[styles.releaseBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ color: released ? palette.warning : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}>
                {t(released ? 'marksGridReleasedWarning' : 'marksGridNotReleased')}
              </Text>
              {holdRelease ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>{t('marksGridSaveFirst')}</Text>
              ) : null}
              <Pressable
                onPress={() => void onToggleRelease()}
                disabled={busy !== null || holdRelease}
                accessibilityRole="button"
                style={[styles.secondary, { borderColor: released ? colors.border : ACCENT, opacity: busy !== null || holdRelease ? 0.5 : 1, flexDirection: rowDir }]}
              >
                <Ionicons name={released ? 'eye-off-outline' : 'megaphone-outline'} size={18} color={released ? colors.mutedForeground : ACCENT} />
                <Text style={{ color: released ? colors.mutedForeground : ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>
                  {t(released ? 'hideResultsBtn' : 'releaseResultsBtn')}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MarkRow({
  row, max, onChange, colors, isRTL, t,
}: {
  row: GridRow;
  max: number;
  onChange: (text: string) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const state = rowState(row, max);
  const maxText = formatMark(max);
  const problem = state.invalid
    ? t('marksGridInvalid', maxText)
    : row.status.kind === 'error'
      ? t(PAPER_TOTAL_ERROR_KEY[row.status.code], maxText)
      : null;
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: problem ? colors.destructive : colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={{ flex: 1, gap: SPACE.xxs }}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>{row.name}</Text>
        {problem ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 19, textAlign: align }}>{problem}</Text>
        ) : null}
      </View>
      <TextInput
        value={row.text}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        maxLength={6}
        accessibilityLabel={t('marksGridMarkLabel', row.name)}
        style={[styles.input, { color: colors.foreground, borderColor: problem ? colors.destructive : colors.border, backgroundColor: colors.background }]}
      />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label }}>{`⁦/ ${maxText}⁩`}</Text>
      <View style={styles.mark}>
        {state.dirty ? (
          <Ionicons name="ellipse" size={10} color={palette.warning} accessibilityLabel={t('marksGridUnsaved', '1')} />
        ) : row.status.kind === 'saved' ? (
          <Ionicons name="checkmark-circle" size={20} color={palette.success} accessibilityLabel={t('marksGridSaved')} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, gap: SPACE.sm },
  headerTitle: { fontSize: TYPE.headline, color: '#fff' },
  banner: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md },
  row: { alignItems: 'center', gap: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md },
  input: { width: SPACE.hero + SPACE.xxl, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.sm, fontSize: TYPE.bodyLg, textAlign: 'center', writingDirection: 'ltr' },
  mark: { width: SPACE.xxl, alignItems: 'center' },
  primary: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.md },
  secondary: { alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.md, borderRadius: RADIUS.md, borderWidth: 1.5 },
  releaseBox: { gap: SPACE.sm, padding: SPACE.lg, borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACE.sm },
});
```

  If `hideResultsBtn` / `releaseResultsBtn` / `releaseResultsConfirm` / `releaseResultsFailed` / `cancel` / `retry` differ in name, use the existing keys the evaluation screen uses (they exist: see `app/evaluations/[id]/index.tsx` `onToggleRelease`). If `ActivityIndicator`/`Ionicons` `accessibilityLabel` is not accepted by the type, wrap the icon in a `View accessible accessibilityLabel=…`.

- [ ] **Step 2: Entry from the evaluation screen** (`app/evaluations/[id]/index.tsx`).
  - Import `isPaperExam, isQuickPaperExam` from `'@/services/paperMarks'`. After `questions` is derived: `const paperExam = isPaperExam(questions); const quickPaper = isQuickPaperExam(questions);`
  - `ShareLinkCard` gets a `paper: boolean` prop (pass `paper={paperExam}`). Directly AFTER the existing `const [copied, setCopied] = useState(false);` (never above any hook: `questions` starts empty and loads, so `paper` flips false → true and an early return above a hook changes the hook count) and before `if (!shareCode) return null;`:

```tsx
  // A paper exam is sat in class: its code would open a paper with nothing on
  // it, so the card offers no code — only the class it still needs.
  if (paper) {
    if (attachedToClass) return null;
    return (
      <View style={{ marginHorizontal: 20, marginTop: 16 }}>
        <View style={[styles.shareCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: palette.warning, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: align }}>
            {t('marksGridNeedsClass')}
          </Text>
          <Pressable onPress={onAttach} style={[styles.shareBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="people-outline" size={16} color={ACCENT} />
            <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{t('shareExamAttachNow')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
```

    (The literal sizes copy the card's own; 20/16/15/13 are all on the `SPACE`/`TYPE` scales, so the ratchet does not move. Run `designScale.test.ts` anyway.)
  - In the `status === 'published'` actions block, when `quickPaper`, render a primary `Pressable` «`marksGridBtn`» (`styles.enterAnswersBtn`, `create-outline` icon) that pushes `({ pathname: '/evaluations/[id]/marks', params: { id: evaluation.id } } as never)`, and render the existing «`enterAnswersBtn`» button with the outline look of `styles.resultsBtn` instead of the filled one. Otherwise unchanged.

- [ ] **Step 3: Entry from the answers picker** (`app/evaluations/[id]/answers/index.tsx`). Import `isQuickPaperExam` from `'@/services/paperMarks'`. Add `const [quickPaper, setQuickPaper] = useState(false);` and change the focus-effect line to `getEvaluation(id).then(d => { setAudience(d.audience ?? null); setQuickPaper(d.evaluation.status === 'published' && isQuickPaperExam(d.questions)); }).catch(() => {});`. Directly below the error box, when `quickPaper`:

```tsx
      {quickPaper ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(({ pathname: '/evaluations/[id]/marks', params: { id: id as string } } as never))}
          style={[styles.card, { backgroundColor: colors.card, borderColor: ACCENT, marginHorizontal: SPACE.xl, marginTop: SPACE.lg }]}
        >
          <Ionicons name="grid-outline" size={18} color={ACCENT} />
          <Text style={{ flex: 1, color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>{t('marksGridTableBtn')}</Text>
        </Pressable>
      ) : null}
```

  (import `SPACE`, `TYPE` from `'@/constants/theme'`.)
- [ ] **Step 4: Route gating test.** In `services/__tests__/routeGating.test.ts`, add `'/evaluations/abc123/marks'` to the "leaves real destinations alone" list. Teacher routes need no gating change (non-teachers are denied by default — check `NON_TEACHER_ROUTES` does not list `/evaluations`).
- [ ] **Step 5: Run** `pnpm test` in `artifacts/mobile` and `pnpm run typecheck`. State in the report that the screen was type-checked and tested but not seen (the controller looks at it in Task 10).
- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile
git commit -m "feat(mobile): the class mark book for a paper exam, reachable from the exam and the answers picker"
```

---

### Task 10: Docs, final verification, and the controller's visual check

**Files:**
- Modify: `STATUS.md`, `docs/superpowers/specs/2026-10-11-family-school-views-design.md`, `CLAUDE.md` (only if Step 3 finds a real new trap)

- [ ] **Step 1: Spec.** In `2026-10-11-family-school-views-design.md`:
  - Header status line and the Part 3 table row: Part 3 built (2026-10-12) — families see exam dates and an upcoming list, paper exams carry no link, paper totals are typed in a class mark book and released like digital results; notifications still Part 4.
  - Replace the "**Still to do in this part:**" list in section 3 (keep the "Already built, separately" part and the "A school day is stored two ways" paragraph) with "**Built in this part (2026-10-12):**" bullets:
    - `/student/exams` and `/parent/exams` rows carry `examDate`, `examTime` and `paper`, through `studentExamRow`, so a date appears only on an exam the child may already see; a dated draft and a dated exam with no class reach nobody (pinned by `familyExams.db.test.ts`). `/parent/exams` entries carry the child `key` that `/parent/homework` uses. Families do not get `/exam-calendar`.
    - "Upcoming exams" is a School-tab section between homework and the timetable: the child's exams dated today (Amman) or later, soonest first, any state; tap opens «اختباراتي», which also shows the date.
    - A **paper exam** (every live question a paper question — `isPaperExam`; no column) never offers a link or «ابدأ»: its state is `paper` until it is marked, then `submitted` / `result` like any other.
    - **Paper marks**: no per-class grid existed (the first task of this part, per the earlier spec, confirmed it — `answers/[studentId]` marks one student at a time). A **quick paper exam** is a paper exam with exactly one question worth N (≤ 100), created with «مجموع فقط»; `PUT /evaluations/:id/paper-totals` takes one total per student, finds-or-creates the `teacher_entry` sitting (`lib/teacherEntry.ts`, shared with the per-student routes), writes the mark and hands the sitting in with `gradeSubmission`; per-row results; `null` clears a teacher-typed sitting but never one with student work. The class mark book is `app/evaluations/[id]/marks.tsx`. A multi-question paper is still marked per student.
    - Visibility is unchanged: `releaseResultsToStudent` + handed in + not provisional (`studentResultReady`), so a parent sees exactly what the child sees.
    - **Per-child results: no new route.** The family's result is `result{…}` on the exam rows «اختباراتي» already shows. (An earlier draft pointed at `/student/grades`; that route returns the student's curriculum grade ids for the library, not marks.)
  - In "Testing", add the new DB files. In "Risks", add the items from Step 2's known gaps that are risks.
- [ ] **Step 2: STATUS.md.** Add a section after the Homework one: «Exams: families see the date, and paper marks are typed per class, 2026-10-12», in the style of the Homework section:
  - What exists: the row fields and `paper` state; the `/parent/exams` `key`; the School-tab section; the `my-exams` date; `PUT /evaluations/:id/paper-totals` (codes, per-row results, 60/min limit, 300 rows/request); `lib/teacherEntry.ts` (and that it now carries the two old route bodies); `marks.tsx`; «مجموع فقط»; the date-card hints. No migration.
  - Which DB test pins each access rule (`familyExams.db.test.ts`, `teacherEntry.db.test.ts`, `paperTotals.db.test.ts`) and the mutation proofs run.
  - **Not seen:** whatever the controller's Step 5 does not cover.
  - **Known gaps** (each one line, with the reason): a mark saved **after** release shows to the family at once with **no push** (`announceResultsRelease` only fires on the release flip) — Part 4; exam scheduled/changed sends no push — Part 4; a dated exam with **no class** reaches no family (only a hint tells the teacher); a total-only paper measures **one objective and one competency** (all marks go to the first selected objective — the teacher's objective breakdown for that exam means "the total", and the family's competency card says "not enough evidence"); a quick paper exam's total is capped at **100**; a **published paper exam still has a share code** server-side — `/take/:code` would still admit a student who has it (families and the teacher's screen no longer show it); `/student/progress` (mastery gate) counts a **published paper exam as an open quiz** for its lesson (only matters with `MASTERY_GATE=true`); **old app builds** (before the OTA carrying Task 6–7) show a blank chip for the new `paper` state until they update; a re-submit through the grid of a sitting a student made via the link grades it as the teacher's mark (as the per-student screen already does).
  - Update the lines this changes: the Exam-date section's "families do not see it" statement (around L974–1018), and any line saying parents' results come from `/student/grades`.
- [ ] **Step 3: CLAUDE.md** — only if implementation found a trap that is not already obvious from code comments. Candidate, if the reviewer agrees it bites: "**A paper exam is not a column.** `isPaperExam` over the live questions decides it, publishing still issues a share code, and anything that offers a family a link must ask `paper` first." Do not add it otherwise.
- [ ] **Step 4: Full verification** (paste the counts into the report):

```bash
pnpm run typecheck
cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres REQUIRE_DB_TESTS=true pnpm test
cd ../mobile && pnpm test
```

  Expected: typecheck clean; api-server 0 failed, 0 skipped; mobile 0 failed.
- [ ] **Step 5: Visual check — the CONTROLLER does this, not the implementer.** Against a local API on a seeded database (`pnpm run dev:api`, `pnpm run dev:mobile:web`), in a browser at phone width, in Arabic and English: (1) teacher — create a paper exam «مجموع فقط» out of 20, attach a class, set a date, publish; the evaluation screen shows «أدخل العلامات» and no share code; open the mark book, type three marks (one in Arabic-Indic digits, one invalid), «حفظ الكل», see per-row results; release; (2) student of that class — School tab shows the exam under «الاختبارات القادمة» with its day, «اختباراتي» shows «امتحان ورقي» before marking and the mark after release, no «ابدأ»; (3) parent with two children — each child's upcoming exams follow the picker, the mark appears on the right child only. Record what was and was not seen in STATUS.md.
- [ ] **Step 6: Commit docs** (implementer: Steps 1–4 and 6; the controller adds Step 5's findings in its own commit)

```bash
git add STATUS.md docs CLAUDE.md
git commit -m "docs: Part 3 — exam dates for families and paper marks, as built"
```

---

## Self-review

- **Spec coverage (section 3, "Testing", "Risks"):** date to families via `studentExamRow`/`guardianExamRow`, draft never leaks through the date (T1 unit, T2 DB) · upcoming list on the School tab (T6 logic, T7 screen) · families never get `/exam-calendar` (untouched; stated in T10) · paper exams reuse `setPaperQuestions` (T8 «مجموع فقط»), `attempts.source = teacher_entry` (T3, T5) — `scanMarks` stays on the per-student screen; the "first task: confirm a per-class grid is missing" is answered in the findings and recorded in T10 · visibility gated by `releaseResultsToStudent` and shaped by the row builders (T2, T5 DB) · per-child results: no new route, spec corrected (T10) · Testing: a parent cannot read another family's child (T2 "keeps each family to its own classes", T5 parent B), results hidden until released (T2, T5), unowned paths still 404 not 401 (T5 Step 5 + existing case), `routeGating.test.ts` (T9), `i18n.test.ts` (T6, T8), typecheck (every task), STATUS in the same PR (T10), the end-to-end check (T10 Step 5, controller) · Risks: `STUDENT_ACCOUNTS` is on in production (T10 restates; the visual check is required) · controller decisions D1–D10 each map to a task (D1 T1–2, D2 T2/T6/T7, D3 T7, D4 T1/T6/T7/T9, D5 T3–5, D6 T8–9, D7 T9 copy + T10 gap, D8 T10, D9 T2/T3/T5, D10 T10).
- **Placeholder scan:** no TBD/TODO; UI steps for `school.tsx`, `my-exams.tsx`, `ExamDateCard.tsx`, `new.tsx` and the two entry points give the code to insert and name the existing precedent for the chrome; `marks.tsx` is written out in full.
- **Type consistency:** `PaperTotalResult` / `PaperTotalErrorCode` are the same unions in `modules/assessment/paperTotals.ts` (T4) and `services/paperMarks.ts` (T8); the HTTP body `{ maxMarks, results }` matches `savePaperTotals`'s return; `StudentExamState`/`MyExamState` both gain `'paper'`; `examDate`/`examTime`/`paper` are named the same on server rows, `MyExam` and the tests; `ChildExams.key` (T6) is the field T2 adds; `findOrStartTeacherEntry` / `loadAttemptTemplate` / `writeTeacherMark` signatures in T3 are the ones T5 calls (`template`, `skipIfUnchanged`, `note` omitted); `isQuickPaperExam` exists on both sides with the same rule (manual + empty body), pinned by tests on each.
