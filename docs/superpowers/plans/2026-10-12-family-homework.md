# Homework (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher posts homework to a class; students see it and mark it done; parents see each child's homework read-only; the teacher sees how many have finished.

**Architecture:** Two additive tables (`homework`, `homework_completions`). Pure rules and the family-payload builder live in `artifacts/api-server/src/modules/homework/` and are unit-tested; thin loaders query the database and hand rows to the builders; routes are path-scoped. Access rules (a family sees only its own classes' homework, a student can mark done only for a class their roster row sits in, a teacher touches only their own homework) are proven against a real Postgres with the DB test harness from PR #1007. Mobile follows the pure/fetcher split: logic in `services/homework.ts`, fetchers in `services/homeworkApi.ts`.

**Tech Stack:** Express + Drizzle (Postgres) in `artifacts/api-server`, `lib/db` migrations, Expo / React Native (RTL, Arabic-first) in `artifacts/mobile`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-11-family-school-views-design.md` (section "2. Homework"). This plan amends it in five places — recorded in Task 8, and listed under "Spec amendments" below.

## Global Constraints

- Branch `claude/brave-einstein-qxpxc3`, draft PR #1007. Do not mark ready or merge.
- Schema change = edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/`. Additive only — no `DROP`/`RENAME`/`SET NOT NULL`/type change (those need `destructive-migration: ok`). Never `push`.
- Every guard is path-scoped; **never** a bare `router.use(mw)`. Scope with a path prefix or put the middleware on the route itself.
- Files loaded directly by `node --test` need explicit `.ts` extensions in relative imports; api-server source that is bundled by esbuild may use `.js`/`.ts` as its neighbours do. New api-server files use `.ts` extensions for relative imports (as `familyAccess.ts` does).
- `@workspace/db` cannot be imported under `node --test`; anything unit-tested must not import it. DB-touching behaviour is tested through the harness (`describeDb`, raw-SQL seed, built bundle).
- Mobile tests only run from `artifacts/mobile/services/__tests__/` and cannot import `react-native` / `expo-*`. Keep fetchers (which import `apiClient.ts`) out of tested files.
- Arabic is the product language, UI is RTL-first. Dates are `YYYY-MM-DD` strings at the API boundary; **the school day is Asia/Amman, a fixed UTC+3** (Jordan abolished DST in 2022).
- `STUDENT_ACCOUNTS` gate: every `/student/*` and `/parent/*` homework handler answers `403 { code: "student_accounts_disabled" }` when `studentAccountsEnabled()` is false, exactly like `routes/familySchedule.ts`.
- Mobile design ratchets (`designScale.test.ts`): use `SPACE` / `TYPE` / `RADIUS` tokens, do not raise any ceiling. `aria-selected` / `aria-checked` on toggles (`ariaState.test.ts`). Do not add a `KeyboardAvoidingView`; any `<Modal>` with a text input wraps its body in `KeyboardSafeView`.
- `i18n.test.ts` must stay green: every new key in both `ar` and `en`.
- Commit trailers per the session attribution reminder. Do not name a model in code, comments or docs.
- No push notifications in this part (Part 4). No grading, no uploads.

## Spec amendments (decided in this plan)

1. **Teacher create is `POST /homework` with `classGroupId` in the body**, read is `GET /classes/:id/homework`. (As the spec says; noted because a `POST /classes/:id/homework` would have inherited the roster router's `requireRosterConsent` gate, which is about entering child data and not relevant to homework.)
2. **The API takes and returns a calendar date**, `dueDate: "YYYY-MM-DD"`, not a timestamp. The server stores `dueAt` as 23:59:59.999 Asia/Amman of that date and also returns `dueAt` ISO. Clients never do timezone arithmetic for the due date.
3. **Attaching an exam = picking one already attached to the class.** The spec said to reuse `SendWorksheetSheet` → `fromWorksheet`; that flow creates a new exam from a worksheet and is a separate project. The attached exam must be one of this teacher's, not archived, with `classGroupId` equal to the homework's class.
4. **Families see recent homework only:** `dueAt` within the last 14 days or later, newest 200. Older work drops off rather than accumulating.
5. **A family sees an attached exam's title only when that exam is `published`** (a draft's title is not for children), and tapping it opens the existing «اختباراتي» screen, which applies the real visibility rules.

## File Structure

| Path | Responsibility |
| --- | --- |
| `lib/db/src/schema/homework.ts` (new) | `homework`, `homework_completions` tables |
| `lib/db/src/schema/index.ts` | export it; fix the stale "push by hand" header |
| `lib/db/migrations/0006_*.sql` + meta (generated) | the additive migration |
| `artifacts/api-server/src/modules/homework/rules.ts` (new) | pure: input parsing, date conversion, state |
| `artifacts/api-server/src/modules/homework/familyHomework.ts` (new) | pure: builds a family's homework list from rows |
| `artifacts/api-server/src/lib/familyHomeworkLoad.ts` (new) | DB: loads rows for a set of roster ids, calls the builder |
| `artifacts/api-server/src/lib/homeworkDone.ts` (new) | DB: mark/unmark done for a student account |
| `artifacts/api-server/src/routes/homework.ts` (new) | teacher routes |
| `artifacts/api-server/src/routes/familyHomework.ts` (new) | student + parent routes |
| `artifacts/api-server/src/routes/index.ts` | mount both |
| `artifacts/api-server/src/test-support/seedFamilies.ts` | `FamilyWorld` also returns class and roster ids |
| `artifacts/api-server/src/test-support/seedHomework.ts` (new) | homework fixture |
| `artifacts/api-server/src/routes/__tests__/homework.db.test.ts`, `familyHomework.db.test.ts` (new) | access tests on a real DB |
| `artifacts/mobile/services/homework.ts` (new) | pure types, normalisers, due-date helpers |
| `artifacts/mobile/services/homeworkApi.ts` (new) | fetchers (family + teacher) |
| `artifacts/mobile/services/i18n.ts` | `hw*` keys, ar + en |
| `artifacts/mobile/app/(tabs)/school.tsx` | Homework section (student toggle, parent read-only) |
| `artifacts/mobile/components/classes/HomeworkTab.tsx` (new) | teacher list + create/edit modal |
| `artifacts/mobile/app/classes/[id]/index.tsx` | a «الواجبات» tab that renders `HomeworkTab` |

---

### Task 1: Schema and migration

**Files:**
- Create: `lib/db/src/schema/homework.ts`
- Modify: `lib/db/src/schema/index.ts`
- Generate: `lib/db/migrations/0006_*.sql`, `lib/db/migrations/meta/0006_snapshot.json`, `lib/db/migrations/meta/_journal.json`

**Interfaces:**
- Produces: `homework`, `homeworkCompletions` tables and types `Homework`, `HomeworkCompletion`, exported from `@workspace/db`.

- [ ] **Step 1: Write the schema**

```ts
/**
 * Homework a teacher sets for one class, and which children have ticked it off.
 *
 * Deliberately small: a title, instructions, a due day, and an optional link to
 * an exam already attached to the class. No uploads and no grading — a student
 * marks it done, a parent reads it, the teacher sees a count.
 *
 * `class_group_id` is NOT NULL and cascades: homework belongs to a class, and a
 * class has exactly one teacher, so a "class" and "whose homework" can never
 * disagree. Archiving a class (the product's delete) hides its homework —
 * readers join on `class_groups.archived_at` — without touching these rows.
 *
 * Completion is per roster row (`students.id`), not per account. A child taught
 * by two teachers is two roster rows in two classes, and homework belongs to
 * exactly one class, so one row per (homework, child) is unambiguous.
 */
import { pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { classGroups, students } from "./students";
import { evaluations } from "./evaluations";

export const homework = pgTable(
  "homework",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    /** End of the due day, Asia/Amman (23:59:59.999 +03:00) — see modules/homework/rules.ts. */
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    /** An exam already attached to this class; `set null` so deleting the exam leaves the homework. */
    evaluationId: uuid("evaluation_id").references(() => evaluations.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  t => [
    index("homework_class_due_idx").on(t.classGroupId, t.dueAt),
    index("homework_teacher_idx").on(t.teacherId),
  ],
);

export const homeworkCompletions = pgTable(
  "homework_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    doneAt: timestamp("done_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("homework_completions_unique").on(t.homeworkId, t.studentId),
    index("homework_completions_student_idx").on(t.studentId),
  ],
);

export type Homework = typeof homework.$inferSelect;
export type HomeworkCompletion = typeof homeworkCompletions.$inferSelect;
```

- [ ] **Step 2: Export it and fix the stale header.** In `lib/db/src/schema/index.ts` add, after the `schedule` export:

```ts
// Homework a teacher sets for a class, and who has ticked it off — see homework.ts
export * from "./homework";
```

Replace the header comment block (it says the tables come from a hand-run `push`, which stopped being true on 2026-10-08) with:

```ts
// The tables deploy as MIGRATIONS (since 2026-10-08), not `push`.
//
// Edit a file here, run `pnpm --filter @workspace/db run generate`, and commit
// `lib/db/migrations/`. CI fails a schema edit with no migration, applies every
// migration to an empty Postgres, and holds destructive SQL until the PR body
// says `destructive-migration: ok`. See "Schema" in docs/deploying.md.
```

- [ ] **Step 3: Generate the migration.** Run `pnpm --filter @workspace/db run generate`. If it prompts, the name is free-form. Read the new `.sql`: it must contain only two `CREATE TABLE`, their `FOREIGN KEY` constraints, one `UNIQUE`, and three `CREATE INDEX`. No `DROP`, `ALTER ... DROP`, `RENAME`, `SET NOT NULL`.

- [ ] **Step 4: Prove it applies to an empty database.** Run the repo's own check as CI does (see the `migrations` job in `.github/workflows/ci.yml`), or with the throwaway Postgres in `LOCAL_SETUP.md` ("DB-backed API tests"): create an empty database and run `DATABASE_URL=<it> node lib/db/scripts/migrate.mjs --from-env`; then `\d homework` / `\d homework_completions` show the columns above.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm run typecheck
git add lib/db/src/schema/homework.ts lib/db/src/schema/index.ts lib/db/migrations
git commit -m "feat(db): homework and homework_completions tables"
```

---

### Task 2: Pure rules and the family-list builder (API)

**Files:**
- Create: `artifacts/api-server/src/modules/homework/rules.ts`
- Create: `artifacts/api-server/src/modules/homework/familyHomework.ts`
- Test: `artifacts/api-server/src/modules/homework/__tests__/rules.test.ts`, `.../familyHomework.test.ts`

**Interfaces:**
- Produces (`rules.ts`):
  - `const TITLE_MAX = 120`, `INSTRUCTIONS_MAX = 2000`, `FAMILY_WINDOW_DAYS = 14`, `FAMILY_LIMIT = 200`
  - `dueDateToDueAt(date: unknown): Date | null` — strict `YYYY-MM-DD`, a real calendar date, else `null`; returns that day's 23:59:59.999 Asia/Amman (= 20:59:59.999Z).
  - `dueAtToDueDate(dueAt: Date): string` — the Asia/Amman calendar date.
  - `type HomeworkState = "done" | "overdue" | "open"`; `homeworkState(input: { dueAt: Date; done: boolean; now: Date }): HomeworkState`
  - `familyCutoff(now: Date): Date` — `now` minus `FAMILY_WINDOW_DAYS` days.
  - `interface CreateInput { classGroupId: string; title: string; instructions: string; dueAt: Date; evaluationId: string | null }`
  - `interface PatchInput { title?: string; instructions?: string; dueAt?: Date; evaluationId?: string | null }`
  - `parseCreate(body: unknown): { ok: true; value: CreateInput } | { ok: false; error: string }`
  - `parsePatch(body: unknown): { ok: true; value: PatchInput } | { ok: false; error: string }` — at least one known field, else `ok: false`.
  - `isUuid(v: unknown): v is string` (same shape as `lib/classResource.ts`'s; copy the regex, do not import — that file's imports are not `node --test` safe; check before copying and import it if it is).
- Produces (`familyHomework.ts`): see Step 4.

- [ ] **Step 1: Write failing tests for `rules.ts`** (`rules.test.ts`):

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dueDateToDueAt, dueAtToDueDate, homeworkState, familyCutoff,
  parseCreate, parsePatch, TITLE_MAX, INSTRUCTIONS_MAX,
} from "../rules.ts";

const CLASS = "11111111-1111-4111-8111-111111111111";
const EXAM = "22222222-2222-4222-8222-222222222222";

describe("dueDateToDueAt / dueAtToDueDate", () => {
  it("is the end of the Amman day", () => {
    assert.equal(dueDateToDueAt("2026-10-14")!.toISOString(), "2026-10-14T20:59:59.999Z");
  });
  it("round-trips, including across the UTC date boundary", () => {
    for (const d of ["2026-10-14", "2026-01-01", "2026-12-31", "2028-02-29"]) {
      assert.equal(dueAtToDueDate(dueDateToDueAt(d)!), d);
    }
    // 22:00Z is already tomorrow in Amman.
    assert.equal(dueAtToDueDate(new Date("2026-10-14T22:00:00Z")), "2026-10-15");
  });
  it("rejects anything that is not a real YYYY-MM-DD", () => {
    for (const bad of ["", "2026-13-01", "2026-02-30", "2026-2-3", "14/10/2026", "2026-10-14T00:00:00Z", null, undefined, 20261014, {}]) {
      assert.equal(dueDateToDueAt(bad), null, String(bad));
    }
  });
});

describe("homeworkState", () => {
  const dueAt = dueDateToDueAt("2026-10-14")!;
  it("done wins over overdue", () => {
    assert.equal(homeworkState({ dueAt, done: true, now: new Date("2026-11-01Z") }), "done");
  });
  it("is overdue only after the due day has ended", () => {
    assert.equal(homeworkState({ dueAt, done: false, now: new Date("2026-10-14T20:59:00Z") }), "open");
    assert.equal(homeworkState({ dueAt, done: false, now: new Date("2026-10-14T21:00:00Z") }), "overdue");
  });
});

describe("familyCutoff", () => {
  it("is fourteen days back", () => {
    assert.equal(familyCutoff(new Date("2026-10-15T00:00:00Z")).toISOString(), "2026-10-01T00:00:00.000Z");
  });
});

describe("parseCreate", () => {
  const ok = { classGroupId: CLASS, title: "  حل التمارين  ", dueDate: "2026-10-14" };
  it("trims, defaults instructions to '' and evaluationId to null", () => {
    const r = parseCreate(ok);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.title, "حل التمارين");
      assert.equal(r.value.instructions, "");
      assert.equal(r.value.evaluationId, null);
      assert.equal(r.value.dueAt.toISOString(), "2026-10-14T20:59:59.999Z");
    }
  });
  it("requires a class id, a title and a real due date", () => {
    assert.equal(parseCreate({ ...ok, classGroupId: "nope" }).ok, false);
    assert.equal(parseCreate({ ...ok, title: "   " }).ok, false);
    assert.equal(parseCreate({ ...ok, dueDate: "2026-02-30" }).ok, false);
    assert.equal(parseCreate(null).ok, false);
  });
  it("enforces length limits", () => {
    assert.equal(parseCreate({ ...ok, title: "x".repeat(TITLE_MAX + 1) }).ok, false);
    assert.equal(parseCreate({ ...ok, instructions: "x".repeat(INSTRUCTIONS_MAX + 1) }).ok, false);
    assert.equal(parseCreate({ ...ok, title: "x".repeat(TITLE_MAX) }).ok, true);
  });
  it("accepts an exam id but only a uuid", () => {
    assert.equal(parseCreate({ ...ok, evaluationId: EXAM }).ok, true);
    assert.equal(parseCreate({ ...ok, evaluationId: "nope" }).ok, false);
  });
});

describe("parsePatch", () => {
  it("accepts any subset of the editable fields", () => {
    const r = parsePatch({ dueDate: "2026-10-20", evaluationId: null });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.evaluationId, null);
      assert.equal(r.value.dueAt!.toISOString(), "2026-10-20T20:59:59.999Z");
      assert.equal("title" in r.value, false);
    }
  });
  it("refuses an empty patch, a blank title, and a bad date", () => {
    assert.equal(parsePatch({}).ok, false);
    assert.equal(parsePatch({ title: " " }).ok, false);
    assert.equal(parsePatch({ dueDate: "soon" }).ok, false);
  });
  it("ignores fields it does not own (class and teacher cannot be changed)", () => {
    const r = parsePatch({ title: "x", classGroupId: CLASS, teacherId: CLASS });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(Object.keys(r.value), ["title"]);
  });
});
```

- [ ] **Step 2: Run to verify failure.** `cd artifacts/api-server && node --test src/modules/homework/__tests__/rules.test.ts` → fails (module missing).

- [ ] **Step 3: Implement `rules.ts`.**

```ts
/**
 * The rules for homework that need no database: reading a teacher's input,
 * converting between the calendar day a teacher means and the instant we store,
 * and deciding what state an item is in.
 *
 * The school day is Asia/Amman. Jordan stopped changing its clocks in 2022 and
 * sits at a fixed UTC+3, so "end of the due day" is 20:59:59.999Z of that date
 * — no tz database needed, and no client ever converts a due date itself.
 */
export const TITLE_MAX = 120;
export const INSTRUCTIONS_MAX = 2000;
/** Families see homework due this many days ago or later; older work drops off. */
export const FAMILY_WINDOW_DAYS = 14;
export const FAMILY_LIMIT = 200;

const AMMAN_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** `YYYY-MM-DD` that names a real day → that day's last millisecond in Amman; else null. */
export function dueDateToDueAt(date: unknown): Date | null {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC rolls 2026-02-30 into March; a real date survives the round trip.
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - AMMAN_OFFSET_MS);
}

/** The Amman calendar date an instant falls on, as `YYYY-MM-DD`. */
export function dueAtToDueDate(dueAt: Date): string {
  return new Date(dueAt.getTime() + AMMAN_OFFSET_MS).toISOString().slice(0, 10);
}

export type HomeworkState = "done" | "overdue" | "open";

export function homeworkState(input: { dueAt: Date; done: boolean; now: Date }): HomeworkState {
  if (input.done) return "done";
  return input.now.getTime() > input.dueAt.getTime() ? "overdue" : "open";
}

export function familyCutoff(now: Date): Date {
  return new Date(now.getTime() - FAMILY_WINDOW_DAYS * DAY_MS);
}

export interface CreateInput {
  classGroupId: string;
  title: string;
  instructions: string;
  dueAt: Date;
  evaluationId: string | null;
}
export interface PatchInput {
  title?: string;
  instructions?: string;
  dueAt?: Date;
  evaluationId?: string | null;
}
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function record(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function parseTitle(v: unknown): Parsed<string> {
  if (typeof v !== "string" || v.trim() === "") return { ok: false, error: "title is required" };
  const t = v.trim();
  if (t.length > TITLE_MAX) return { ok: false, error: `title must be at most ${TITLE_MAX} characters` };
  return { ok: true, value: t };
}
function parseInstructions(v: unknown): Parsed<string> {
  if (typeof v !== "string") return { ok: false, error: "instructions must be text" };
  const t = v.trim();
  if (t.length > INSTRUCTIONS_MAX) return { ok: false, error: `instructions must be at most ${INSTRUCTIONS_MAX} characters` };
  return { ok: true, value: t };
}
function parseEvaluationId(v: unknown): Parsed<string | null> {
  if (v === null || v === "") return { ok: true, value: null };
  return isUuid(v) ? { ok: true, value: v } : { ok: false, error: "evaluationId must be an exam id or null" };
}

export function parseCreate(body: unknown): Parsed<CreateInput> {
  const b = record(body);
  if (!b) return { ok: false, error: "A JSON object is required" };
  if (!isUuid(b["classGroupId"])) return { ok: false, error: "classGroupId is required" };
  const title = parseTitle(b["title"]);
  if (!title.ok) return title;
  const instructions = b["instructions"] === undefined ? ({ ok: true, value: "" } as const) : parseInstructions(b["instructions"]);
  if (!instructions.ok) return instructions;
  const dueAt = dueDateToDueAt(b["dueDate"]);
  if (!dueAt) return { ok: false, error: "dueDate must be a real date, YYYY-MM-DD" };
  const evaluationId = b["evaluationId"] === undefined ? ({ ok: true, value: null } as const) : parseEvaluationId(b["evaluationId"]);
  if (!evaluationId.ok) return evaluationId;
  return {
    ok: true,
    value: { classGroupId: b["classGroupId"], title: title.value, instructions: instructions.value, dueAt, evaluationId: evaluationId.value },
  };
}

export function parsePatch(body: unknown): Parsed<PatchInput> {
  const b = record(body);
  if (!b) return { ok: false, error: "A JSON object is required" };
  const out: PatchInput = {};
  if (b["title"] !== undefined) {
    const r = parseTitle(b["title"]);
    if (!r.ok) return r;
    out.title = r.value;
  }
  if (b["instructions"] !== undefined) {
    const r = parseInstructions(b["instructions"]);
    if (!r.ok) return r;
    out.instructions = r.value;
  }
  if (b["dueDate"] !== undefined) {
    const d = dueDateToDueAt(b["dueDate"]);
    if (!d) return { ok: false, error: "dueDate must be a real date, YYYY-MM-DD" };
    out.dueAt = d;
  }
  if (b["evaluationId"] !== undefined) {
    const r = parseEvaluationId(b["evaluationId"]);
    if (!r.ok) return r;
    out.evaluationId = r.value;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "Nothing to change" };
  return { ok: true, value: out };
}
```

- [ ] **Step 4: Run to verify pass.** Same command → all pass. Then write the failing test for the builder and implement it.

`familyHomework.ts` contract:

```ts
import { dueAtToDueDate, homeworkState, type HomeworkState } from "./rules.ts";

export interface HomeworkRow { id: string; classGroupId: string; title: string; instructions: string; dueAt: Date; evaluationId: string | null }
/** One roster row of the family sitting in one live class. */
export interface MembershipRow { classGroupId: string; studentId: string; className: string; teacherId: string }
export interface CompletionRow { homeworkId: string; studentId: string; doneAt: Date }
export interface TeacherRow { id: string; firstName: string; lastName: string }
export interface ExamRow { id: string; title: string; titleAr: string; status: string }

export interface FamilyHomeworkItem {
  id: string; title: string; instructions: string;
  /** YYYY-MM-DD, Asia/Amman. */
  dueDate: string; dueAt: string;
  className: string; teacherName: string;
  done: boolean; doneAt: string | null; state: HomeworkState;
  /** Only when the attached exam is published; null otherwise. */
  exam: { title: string } | null;
}

export function buildFamilyHomework(input: {
  homework: HomeworkRow[]; memberships: MembershipRow[]; completions: CompletionRow[];
  teachers: TeacherRow[]; exams: ExamRow[]; now: Date;
}): FamilyHomeworkItem[]
```

Rules the tests must pin (each a separate `it`):
1. Homework whose class is not in `memberships` is dropped (never trust the caller's query to have filtered).
2. `done` is true iff **any** completion exists for this homework by a roster row that is a member of the homework's class among `memberships` — a completion by a row of the same child **in another class** or by a row not in `memberships` does not count.
3. `doneAt` is the **earliest** matching completion's ISO time; `null` when not done.
4. `state` comes from `homeworkState` with the passed `now`.
5. `teacherName` = `"firstName lastName"` trimmed, `""` if the teacher is missing; `className` from the membership.
6. `exam` is `{ title: titleAr || title }` only when the exam exists and `status === "published"`; else `null` (draft, closed, missing, or `evaluationId` null).
7. Sorted: not-done first, then `dueAt` ascending, then `title` (Arabic locale `"ar"`), done items last also by `dueAt` ascending.
8. Output contains no field named `teacherId`, `classGroupId`, `studentId` or `evaluationId` (assert on `Object.keys`) — families get what they need, not ids that name other people's rows.

- [ ] **Step 5: Run both test files, typecheck, commit**

```bash
cd artifacts/api-server && node --test src/modules/homework/__tests__/*.test.ts && cd ../.. && pnpm run typecheck
git add artifacts/api-server/src/modules/homework
git commit -m "feat(api): homework rules and the family list builder"
```

---

### Task 3: Teacher routes + DB access tests

**Files:**
- Create: `artifacts/api-server/src/routes/homework.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (mount after `rosterRouter`)
- Modify: `artifacts/api-server/src/test-support/seedFamilies.ts` (return class and roster ids too)
- Create: `artifacts/api-server/src/test-support/seedHomework.ts`
- Test: `artifacts/api-server/src/routes/__tests__/homework.db.test.ts`; add 401 cases to `routes/__tests__/mountOrder.test.ts`

**Interfaces:**
- Consumes: `findLiveClass(classId, teacherId)` from `lib/classOwnership.js`; `parseCreate`, `parsePatch`, `dueAtToDueDate` from `modules/homework/rules.ts`; `authMiddleware`, `requireRole`, `TEACHER_ROLES`, `AuthenticatedRequest` from `middlewares/auth.js`.
- Produces HTTP:
  - `POST /homework` body `{ classGroupId, title, instructions?, dueDate, evaluationId? }` → `201 { homework: TeacherHomework }`; `400 { error }` (validation, bad exam); `404 { error: "Class not found" }` (not yours / archived / missing — identical).
  - `GET /classes/:id/homework` → `200 { studentCount: number, homework: TeacherHomework[] }` newest due first, max 100; `404` as above.
  - `PATCH /homework/:id` body any of `{ title, instructions, dueDate, evaluationId }` → `200 { homework }`; `404 { error: "Homework not found" }`.
  - `DELETE /homework/:id` → `200 { archived: id }`; `404`.
  - `TeacherHomework = { id, classGroupId, title, instructions, dueDate, dueAt, evaluationId, examTitle: string | null, doneCount: number, studentCount: number }`. `studentCount` = live (non-archived) roster rows currently in the class; `doneCount` = completions by those rows.
- Guards: `router.use("/homework", authMiddleware, requireRole(...TEACHER_ROLES))` and, on the class read, the middlewares on the route itself: `router.get("/classes/:id/homework", authMiddleware, requireRole(...TEACHER_ROLES), handler)`. Never `router.use(mw)` unscoped.
- Exam rule (create, and patch when `evaluationId` is a uuid): the exam must exist, `teacherId` = caller, `archivedAt` null, and `classGroupId` = the homework's class; otherwise `400 { error: "That exam is not attached to this class" }` — the same message whichever condition failed.
- Ownership of an existing homework (patch/delete): row exists, `teacherId` = caller, `archivedAt` null, **and its class is live** (`class_groups.archivedAt` null). Otherwise the same `404`.

- [ ] **Step 1: Extend the world fixture.** `FamilyWorld` gains (additive; keep `users`):

```ts
classes: { c1: string; c2: string; c3: string; c4: string; c5: string }; // c4 is the archived one
students: { sA1: string; sA2: string; aA: string; aArch: string; nB1: string; yB: string };
```
and `seedFamilyWorld` returns them. Update nothing else; `familySchedule.db.test.ts` must still pass unchanged.

- [ ] **Step 2: Write `seedHomework.ts`.** `seedHomework(pool, w: FamilyWorld): Promise<HomeworkWorld>` inserting with raw SQL (read the `evaluations` table in `lib/db/src/schema/evaluations.ts` for its NOT NULL columns; set only those). Exports constants for titles so tests can assert on them. Rows (dates relative to `now()` in SQL, e.g. `now() + interval '3 days'`):

| key | teacher | class | due | notes |
| --- | --- | --- | --- | --- |
| `hwC1` | t1 | c1 | +3 days | visible to family A (Sara's row sA1, Adam), student A |
| `hwC1Exam` | t1 | c1 | +5 days | `evaluation_id` = a **published** exam on c1 (`examPublished`) |
| `hwC1Draft` | t1 | c1 | +6 days | `evaluation_id` = a **draft** exam on c1 (`examDraft`) |
| `hwC2` | t2 | c2 | +2 days | family A only through Sara's *second* row sA2; student A (self-linked to sA1 only) must NOT see it |
| `hwC3` | t1 | c3 | +4 days | family B (Noor) |
| `hwC5` | t2 | c5 | +4 days | family B (Yazan) |
| `hwC4` | t1 | c4 (archived class) | +4 days | nobody |
| `hwArchived` | t1 | c1 | +4 days, `archived_at` set | nobody |
| `hwOld` | t1 | c1 | 30 days ago | outside the 14-day window |
| `hwRecentOverdue` | t1 | c1 | 3 days ago | inside the window, overdue |

Also insert `examOtherClass` (published, t1, attached to c3) and `examOtherTeacher` (published, t2, attached to c2) for the exam-rule tests. Titles are unique strings, e.g. `"hw-c1"`.

- [ ] **Step 3: Write the failing DB tests** (`homework.db.test.ts`, structure copied from `familySchedule.db.test.ts`: `describeDb`, one DB, one server; tokens via `accessToken`). Cases:
  1. 401 with no token on all four endpoints. 403 for a parent token and a student token on all four (teacher-only).
  2. `POST /homework` as t1 for c1 → 201; body has `dueDate`, `dueAt` `…T20:59:59.999Z`, `doneCount: 0`, `studentCount: 2` (Sara-row and Adam; the archived roster row aArch is in c2, not c1).
  3. `POST` as **t2** for c1 → 404 `Class not found`, and the response body for "class belongs to another teacher" is byte-identical to "class id does not exist" (a random uuid) and to "class is archived" (c4 as t1).
  4. `POST` validation → 400: blank title, `dueDate: "2026-02-30"`, `classGroupId: "nope"` (this one is 400, not 500).
  5. `POST` with `evaluationId` = `examOtherClass` (t1's, but on c3) → 400; = `examOtherTeacher` → 400; = `examPublished` → 201 and `examTitle` set. The two 400 bodies are identical.
  6. `GET /classes/c1/homework` as t1 → includes `hwC1`, `hwC1Exam`, `hwC1Draft`, `hwOld`, `hwRecentOverdue`; excludes `hwArchived`; `studentCount: 2`; sorted newest due first. As t2 → 404.
  7. `PATCH /homework/:hwC1` as t1 changes title and `dueDate`; as t2 → 404; a patch `{ classGroupId: c3 }` alone → 400 `Nothing to change` and the homework's class is unchanged (query the DB); `{ evaluationId: null }` detaches.
  8. `PATCH` on `hwC4` (class archived) as t1 → 404. On `hwArchived` → 404.
  9. `DELETE /homework/:id` as t2 → 404 and the row is untouched; as t1 → 200, then it is absent from the class list and the row has `archived_at` set (not deleted — completions survive).
  10. Roster consent does not gate homework writes: the seeded teachers have no `roster_consent_at`, and `POST /homework` still succeeds (this pins amendment 1).
  11. Counts: insert completions for `hwC1` by `sA1` through SQL → `doneCount: 1`; a completion by a row **no longer in the class** (delete the membership of `aA` after inserting a completion for it) is not counted.

- [ ] **Step 4: Run to verify failure.** Per `LOCAL_SETUP.md` "DB-backed API tests": start the throwaway Postgres, `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=… node --test src/routes/__tests__/homework.db.test.ts`. Expected: fails (routes missing → 404s).

- [ ] **Step 5: Implement `routes/homework.ts`.** Shape (fill the queries; the logic is fully specified above):

```ts
const router = Router();
router.use("/homework", authMiddleware, requireRole(...TEACHER_ROLES));

const NO_CLASS = { error: "Class not found" } as const;
const NO_HOMEWORK = { error: "Homework not found" } as const;
const BAD_EXAM = { error: "That exam is not attached to this class" } as const;

async function examOk(evaluationId: string, teacherId: string, classId: string): Promise<boolean> { /* select 1 from evaluations where id, teacher_id, archived_at is null, class_group_id = classId */ }
async function ownedHomework(id: string, teacherId: string) { /* homework ⨝ class_groups on class id; where homework.id = id, homework.teacher_id = teacherId, homework.archived_at is null, class_groups.archived_at is null; guard isUuid(id) first → undefined */ }
async function withCounts(rows: Homework[]): Promise<TeacherHomework[]> { /* two grouped queries: studentCount per class; doneCount per homework, both limited to live roster rows currently in the class */ }
```

Mount in `routes/index.ts`: `router.use(homeworkRouter);` directly after `router.use(rosterRouter);`, with the import. Errors: `logger.error` + `isSchemaMissing` → `503 { code: "homework_storage_unavailable" }` like `failSchedule`, else 500.

- [ ] **Step 6: Add the 401 cases to `mountOrder.test.ts`:** unauthenticated `POST /api/homework`, `PATCH /api/homework/x`, `DELETE /api/homework/x`, `GET /api/classes/x/homework` → 401 (follow the existing case's helper); confirm the existing "unknown paths answer 404" case still passes.

- [ ] **Step 7: Run everything.** The new DB file, `familySchedule.db.test.ts` (unchanged), and the full suite: `pnpm build && TEST_DATABASE_URL=… pnpm test` in `artifacts/api-server`; `pnpm run typecheck`.

- [ ] **Step 8: Mutation proof** (note each in the report, revert each): (a) drop the `teacherId` condition in `ownedHomework` → cases 7/9 go red; (b) drop the `classGroupId` condition in `examOk` → case 5 goes red; (c) drop the live-roster filter in `withCounts` → case 11 goes red.

- [ ] **Step 9: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): teacher homework routes, with access tests on a real database"
```

---

### Task 4: Student and parent routes + DB access tests

**Files:**
- Create: `artifacts/api-server/src/lib/familyHomeworkLoad.ts`, `artifacts/api-server/src/lib/homeworkDone.ts`, `artifacts/api-server/src/routes/familyHomework.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (mount after `familyScheduleRouter`), `routes/__tests__/mountOrder.test.ts`
- Test: `artifacts/api-server/src/routes/__tests__/familyHomework.db.test.ts`

**Interfaces:**
- Consumes: `selfLinkedStudentIds`, `guardianLinkedStudents` (`lib/familyAccess.ts`); `groupChildren` (`modules/family/children.ts`); `buildFamilyHomework`, row types (`modules/homework/familyHomework.ts`); `familyCutoff`, `FAMILY_LIMIT` (`rules.ts`); `studentAccountsEnabled` (`lib/features.js`).
- Produces:
  - `loadFamilyHomework(studentIds: string[], now = new Date()): Promise<FamilyHomeworkItem[]>` — `[]` for no ids. Queries: memberships of those ids in **live** classes (join `class_groups.archived_at is null`), homework in those classes with `archived_at is null` and `due_at >= familyCutoff(now)` (limit `FAMILY_LIMIT`, `due_at asc`), completions for those homework ids and ids, teachers, and exams (`id in …`); then `buildFamilyHomework`.
  - `setHomeworkDone(userId: string, homeworkId: string, done: boolean): Promise<"ok" | "not_found">` — the account's `selfLinkedStudentIds` ∩ the live members of the homework's (live, non-archived-homework) class; none → `"not_found"` (same result for a missing id, a malformed id, another class, an archived class). `done` inserts one completion per matching row with `ON CONFLICT DO NOTHING`; `!done` deletes those rows' completions. Idempotent.
  - HTTP: `GET /student/homework` → `{ homework: FamilyHomeworkItem[] }`; `GET /parent/homework` → `{ children: [{ key, displayName, homework }] }` (same `key`/`displayName` as `/parent/schedule` — it uses `groupChildren` the same way); `PUT /student/homework/:id/done` and `DELETE /student/homework/:id/done` → `200 { done: boolean }` or `404 { error: "Homework not found" }`. Parent `PUT`/`DELETE` → 403 (role guard). All four honour the `STUDENT_ACCOUNTS` flag (403 `student_accounts_disabled`).
  - Guards (path-scoped, mirror `familySchedule.ts`): `router.use("/student/homework", authMiddleware, requireRole("student"))`, `router.use("/parent/homework", authMiddleware, requireRole("parent"))`.

- [ ] **Step 1: Write the failing DB tests** (`familyHomework.db.test.ts`; seed with `seedFamilyWorld` + `seedHomework`; one server with the flag on, one off). Cases:
  1. 401 no token; 403 for a teacher token on `/student/homework` and `/parent/homework`; 403 parent token on `/student/homework`; 403 student token on `/parent/homework`; parent token on `PUT /student/homework/<hwC1>/done` → 403 (parents cannot mark done).
  2. Flag off → `403 student_accounts_disabled` on all four endpoints.
  3. **Student A** sees `hwC1`, `hwC1Exam`, `hwC1Draft`, `hwRecentOverdue` — and **not** `hwC2` (a class their row is not in, though their parent's other row for the same child is), `hwC3`, `hwC5`, `hwC4`, `hwArchived`, `hwOld`. Student A's body contains no title from family B's classes.
  4. **Parent A** has two children entries? No — Sara (two rows) and Adam: assert `children.length === 2`, Sara's homework includes `hwC1` **and** `hwC2` (both her rows), Adam's has `hwC1` only, and neither contains `hwC3`/`hwC5`. The archived roster row `aArch` contributes nothing. Parent B sees only B's.
  5. Exam field: `hwC1Exam.exam.title` equals the published exam's title; `hwC1Draft.exam` is `null` and the draft exam's title appears nowhere in the response text; no item carries `teacherId`, `classGroupId`, `studentId` or `evaluationId`.
  6. State and order: `hwRecentOverdue` has `state: "overdue"` and sorts before open items; a done item sorts last.
  7. Marking done: student A `PUT …/<hwC1>/done` → 200 `{done:true}`; then student A's list shows it `done: true, state: "done"`; **parent A's list shows it done for Sara and not for Adam** (Adam's row has no completion — Adam is a different child but the same class; this pins per-child scoping: Sara's completion must not mark Adam's homework done); parent B unaffected; second `PUT` is a no-op 200; `DELETE` → 200 `{done:false}` and it is open again.
  8. Student A `PUT` on `hwC2` (class not theirs), on `hwC3` (other family), on `hwC4`, `hwArchived`, a random uuid and `"nope"` → all 404 with **identical bodies**, and no row inserted (count `homework_completions` before/after).
  9. Teacher t1's `GET /classes/c1/homework` after student A marks `hwC1` done → `doneCount: 1`.
  10. A student with no roster link (`studentUnlinked`) → `{ homework: [] }`; a parent with no children → `{ children: [] }`.

  Note on case 4/7: Adam and Sara share parent A; **parent A's `children` are grouped by name**, so "Sara" is one entry spanning sA1 and sA2.

- [ ] **Step 2: Run to verify failure** (same invocation as Task 3 Step 4).

- [ ] **Step 3: Implement** the two lib files and `routes/familyHomework.ts`. Handlers follow `routes/familySchedule.ts` exactly (flag check first, try/catch with `logger.error`, 500 text in plain English). Mount in `routes/index.ts` right after `router.use(familyScheduleRouter);`.

- [ ] **Step 4: Add `mountOrder.test.ts` cases:** unauthenticated `GET /api/student/homework`, `PUT /api/student/homework/x/done`, `GET /api/parent/homework` → 401.

- [ ] **Step 5: Run everything** (new file, the previous DB files, the full suite with `TEST_DATABASE_URL`, typecheck). All pass, 0 skipped.

- [ ] **Step 6: Mutation proof** (revert each): (a) in `setHomeworkDone` drop the class-membership intersection (use all of `selfLinkedStudentIds`) → case 8 goes red; (b) in `buildFamilyHomework` count a completion by **any** row of the family regardless of class membership → case 7 (Adam) goes red; (c) drop the draft-exam `status` check → case 5 goes red; (d) drop the `archivedAt` filter on homework → case 3 goes red.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): student and parent homework routes, with access tests on a real database"
```

---

### Task 5: Mobile pure logic, fetchers, and copy

**Files:**
- Create: `artifacts/mobile/services/homework.ts`, `artifacts/mobile/services/homeworkApi.ts`
- Test: `artifacts/mobile/services/__tests__/homework.test.ts`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Produces (`homework.ts`, no `react-native`/`expo`/`apiClient` imports):

```ts
export type HomeworkState = 'done' | 'overdue' | 'open';
export interface FamilyHomework {
  id: string; title: string; instructions: string;
  dueDate: string;            // YYYY-MM-DD, Asia/Amman
  className: string; teacherName: string;
  done: boolean; state: HomeworkState;
  examTitle: string | null;
}
export interface ChildHomework { key: string; displayName: string; homework: FamilyHomework[] }
export interface TeacherHomework {
  id: string; title: string; instructions: string; dueDate: string;
  evaluationId: string | null; examTitle: string | null;
  doneCount: number; studentCount: number;
}
export type DueBadge = { kind: 'overdue' | 'today' | 'tomorrow' | 'later'; days: number };

export function ammanToday(now?: Date): string;                       // YYYY-MM-DD, now + 3h in UTC
export function addDays(ymd: string, days: number): string;
export function dueBadge(dueDate: string, today: string): DueBadge;  // days = signed distance (negative = late)
export function dueDatePresets(today: string): { days: number; date: string }[]; // +1, +2, +3, +7
export function isValidYmd(s: string): boolean;
export function normalizeFamilyHomework(raw: unknown): FamilyHomework[];   // drops malformed rows, never throws
export function normalizeTeacherHomework(raw: unknown): TeacherHomework[];
export function splitHomework(items: FamilyHomework[]): { todo: FamilyHomework[]; done: FamilyHomework[] };
export function applyDone(items: FamilyHomework[], id: string, done: boolean): FamilyHomework[];   // optimistic update; recomputes state's done part only
export function homeworkDraftError(d: { title: string; dueDate: string }): 'title' | 'dueDate' | null;
```

  `applyDone(…, true)` sets `done: true, state: 'done'`; `applyDone(…, false)` sets `done: false` and `state` back to `'overdue'` if its `dueDate` is before `ammanToday()` else `'open'` (it cannot know the server's state any other way — test it).
- Produces (`homeworkApi.ts`, imports `apiJson`/`apiFetch` from `./apiClient.ts`): `getMyHomework(): Promise<ChildHomework[]>` (one entry `{ key: 'self', displayName: '' }` like `getMySchedule`), `getChildHomework(): Promise<ChildHomework[]>`, `setHomeworkDone(id: string, done: boolean): Promise<void>` (`PUT`/`DELETE /student/homework/:id/done`), and the teacher's `listClassHomework(classId)`, `createHomework(input)`, `updateHomework(id, patch)`, `archiveHomework(id)`. Read `services/schedule.ts` and `services/roster.ts` for the error-class convention (`ScheduleError`) and reuse that shape (`HomeworkError` with `status`, `code`).

- [ ] **Step 1: Write failing tests** (`homework.test.ts`) pinning, each as its own `it`: `ammanToday` at `2026-10-14T21:00:00Z` is `2026-10-15` and at `20:59:59Z` is `2026-10-14`; `addDays` across a month and a leap day; `dueBadge` for late / today / tomorrow / later with the right signed `days`; `dueDatePresets` = four entries starting tomorrow; `isValidYmd` rejects `2026-02-30`, `2026-1-1`, `''`; `normalizeFamilyHomework` drops a row without an id/title/dueDate, coerces missing optional strings to `''`, treats an unknown `state` as `'open'`, and returns `[]` for `null`/non-arrays; `splitHomework` puts overdue first, then by `dueDate` ascending, and done items in `done`; `applyDone` both directions including the late-reopen case; `homeworkDraftError` returns `'title'` for blank/whitespace, `'dueDate'` for invalid, `null` when fine.
- [ ] **Step 2: Run to verify failure** — `cd artifacts/mobile && node --test services/__tests__/homework.test.ts`.
- [ ] **Step 3: Implement `homework.ts`** (explicit `.ts` import extensions if it imports anything; it should import nothing) and run to pass.
- [ ] **Step 4: Implement `homeworkApi.ts`.** No test file (like `familyScheduleApi.ts`); say so in its header comment.
- [ ] **Step 5: i18n.** Add to both `ar` and `en` in `services/i18n.ts` (look at how `schoolScheduleTitle` etc. are declared; keep alphabetical/grouped with them). Keys (Arabic is the source; English is a faithful translation):

| key | ar | en |
| --- | --- | --- |
| `tabHomework` | الواجبات | Homework |
| `hwTitle` | الواجبات | Homework |
| `hwDescStudent` | واجباتك من معلّميك. اضغط لتعليم الواجب كمُنجز. | Homework from your teachers. Tap to mark it done. |
| `hwDescParent` | واجبات أبنائك ومن أنجزها منهم. | Your children's homework, and what they have finished. |
| `hwTodo` | المطلوب | To do |
| `hwDone` | تم إنجازه | Done |
| `hwEmptyTitle` | لا واجبات الآن | No homework right now |
| `hwEmptyDesc` | عندما يضيف معلّمك واجباً سيظهر هنا. | When a teacher adds homework it will appear here. |
| `hwEmptyDescParent` | عندما يضيف المعلّمون واجباً سيظهر هنا. | When teachers add homework it will appear here. |
| `hwDueOverdue` | متأخّر {n} | Late by {n} |
| `hwDueToday` | اليوم | Today |
| `hwDueTomorrow` | غداً | Tomorrow |
| `hwDueOn` | الموعد {date} | Due {date} |
| `hwMarkDone` | تعليم كمُنجز | Mark as done |
| `hwMarkUndone` | إلغاء الإنجاز | Mark as not done |
| `hwLoadFailed` | تعذّر تحميل الواجبات | Couldn't load homework |
| `hwSaveFailed` | تعذّر حفظ التغيير | Couldn't save the change |
| `hwOpenExam` | فتح الاختبار | Open the exam |
| `hwTeacherTab` | الواجبات | Homework |
| `hwAdd` | واجب جديد | New homework |
| `hwEdit` | تعديل الواجب | Edit homework |
| `hwFieldTitle` | عنوان الواجب | Title |
| `hwFieldInstructions` | التعليمات (اختياري) | Instructions (optional) |
| `hwFieldDue` | موعد التسليم | Due date |
| `hwDueFormat` | السنة-الشهر-اليوم | YYYY-MM-DD |
| `hwFieldExam` | ربط باختبار (اختياري) | Link an exam (optional) |
| `hwNoExam` | بدون اختبار | No exam |
| `hwDoneCount` | أنجزه {done} من {total} | {done} of {total} done |
| `hwDelete` | حذف الواجب | Delete homework |
| `hwDeleteConfirm` | سيختفي هذا الواجب عند الطلاب وأولياء الأمور. | This will disappear for students and parents. |
| `hwTeacherEmptyTitle` | لم تضف واجباً بعد | No homework yet |
| `hwTeacherEmptyDesc` | أضف واجباً ليراه طلاب الصف وأولياء أمورهم. | Add homework and the class's students and parents will see it. |
| `hwErrTitle` | اكتب عنواناً للواجب | Enter a title |
| `hwErrDue` | اكتب تاريخاً صحيحاً مثل 2026-10-14 | Enter a valid date such as 2026-10-14 |

  Check how `i18n.ts` writes placeholders (`{n}` vs positional args like `t('schoolPeriodN', n)`) and match it exactly; adapt the table's placeholder syntax to the file's.
- [ ] **Step 6: Run** `node --test services/__tests__/homework.test.ts services/__tests__/i18n.test.ts`, the full mobile suite (`pnpm test`), `pnpm run typecheck`. Commit.

```bash
git add artifacts/mobile/services
git commit -m "feat(mobile): homework logic, fetchers and copy"
```

---

### Task 6: Homework on the School screen (student toggle, parent read-only)

**Files:**
- Modify: `artifacts/mobile/app/(tabs)/school.tsx`

**Interfaces:**
- Consumes: everything from Task 5; the screen's existing `isParent`, `selected` (child key), child picker, `load`, `onRefresh`, `error` patterns.

Behaviour:
- A «الواجبات» section **above** the timetable (homework is the thing a family acts on). Loaded with its own function and its own error state, so a failing homework fetch does not blank the timetable and vice versa; both reload on focus and on pull-to-refresh. Both use the same child picker (`selected` is a child `key`; homework and schedule use the same `groupChildren` keys). Find the active child's homework by `key`, falling back to the first child — mirror `activeChild`.
- Items grouped «المطلوب» (`splitHomework().todo`) then «تم إنجازه» (collapsed list under a heading; no accordion — just a heading and the rows).
- Row: title, `className · teacherName`, a due badge from `dueBadge` (overdue in `colors.destructive`, today/tomorrow in `palette.warning`, later muted), instructions below (3 lines, tap row to expand — local state), and `examTitle` as a small tappable line «فتح الاختبار: …» that `router.push('/my-exams' as never)`.
- **Student only:** a checkbox control at the row's start. `accessibilityRole="checkbox"`, `aria-checked={done}`, `accessibilityLabel` = `hwMarkDone` / `hwMarkUndone`, `hitSlop` ≥ 8, minimum 44×44 touch area. Tap → `Haptics.selectionAsync()`, **optimistic** `applyDone`, call `setHomeworkDone`; on failure revert and show `hwSaveFailed` in the section's error banner. Ignore taps while that item's request is in flight (a `Set` of ids in a ref/state) so a double tap cannot send two requests.
- **Parent:** no checkbox; a read-only status mark (`checkmark-circle` filled when done, `ellipse-outline` otherwise) with `accessibilityLabel` of the state, not interactive.
- Empty: the existing empty-state style with `hwEmptyTitle` + `hwEmptyDesc` / `hwEmptyDescParent`. Not shown while loading or on error.
- Header description text stays the timetable's; the section has its own title row (`hwTitle`) with `hwDescStudent`/`hwDescParent` under it, or fold the description into the existing header sentence — implementer's choice, but the existing «المدرسة» header stays.
- Use `SPACE`, `TYPE`, `RADIUS` tokens for **all new spacing, type sizes and radii**; do not copy the file's literal numbers. `designScale.test.ts` must stay green without raising a ceiling.
- RTL: `flexDirection` flips with `isRTL`; text `textAlign: align`; the checkbox sits at the reading-start edge in both.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `cd artifacts/mobile && pnpm test` (includes `designScale`, `ariaState`, `i18n`), `pnpm run typecheck` at the repo root. Fix spacing-ratchet failures by using tokens, never by raising the ceiling.
- [ ] **Step 3: Look at it.** Run `pnpm run dev:mobile:web`, sign in is not possible without a backend and a family account — so instead render the screen against fixtures: write a throwaway harness route under `artifacts/mobile/app/dev/` **only if one already exists there for this purpose** (check `app/dev/`); otherwise state plainly in the report that the screen was type-checked and tested but **not seen**, as the School tab itself was not. Do not commit any throwaway.
- [ ] **Step 4: Commit**

```bash
git add "artifacts/mobile/app/(tabs)/school.tsx"
git commit -m "feat(mobile): homework on the School screen"
```

---

### Task 7: Teacher's Homework tab on the class screen

**Files:**
- Create: `artifacts/mobile/components/classes/HomeworkTab.tsx`
- Modify: `artifacts/mobile/app/classes/[id]/index.tsx`

**Interfaces:**
- `HomeworkTab` props: `{ classId: string; exams: Evaluation[]; colors; isRTL; lang; t }` where `exams` is the screen's existing `exams` state (the class's attached evaluations — look at the `Evaluation` type it already imports). It owns its own state: list, loading, error, modal open/edit target, draft fields, saving. It loads on mount and after every successful write via `listClassHomework(classId)`.
- The class screen change is small: extend `type Tab` with `'homework'`; add `renderTab('homework', t('hwTeacherTab'), …)` after the exams tab; render `<HomeworkTab …/>` when `tab === 'homework'`; **hide the floating `+` button on this tab** (HomeworkTab renders its own add button — the FAB's `else` branch would otherwise call `openAttach()`); the existing FAB `accessibilityLabel` ternary must not fall through to `attachMaterial` for this tab. Check the tab bar still fits four tabs at 360px width (shorten counts if needed; render no count for this tab).

Behaviour:
- List rows: title, due date (`dueBadge`-style text), `hwDoneCount` («أنجزه 12 من 28») with a thin progress bar (token radius/spacing), linked exam title if any. Tap a row → edit modal. Newest due first (server order).
- Add button: a full-width `Pressable` row at the top of the list («+ واجب جديد»). Empty state: `hwTeacherEmptyTitle`/`hwTeacherEmptyDesc` with the same action.
- Modal (create/edit) — `<Modal transparent animationType="fade">` whose body is wrapped in `<KeyboardSafeView>` (follow the `showEdit` modal at the class screen for chrome, e.g. `styles` for the backdrop/card): title input; instructions multiline input; due date `TextInput` (`placeholder` = `hwDueFormat`, `maxLength={10}`, `keyboardType="numbers-and-punctuation"`, LTR text direction for the digits) **plus a chip row of `dueDatePresets(ammanToday())`** (label: «غداً» for +1, «بعد يومين» / «بعد 3 أيام» / «بعد أسبوع»; tapping fills the field; the chip matching the field is `aria-selected`); exam picker: «بدون اختبار» plus one row per **published** exam in `exams` (single select, `aria-selected`); `evaluationId` is sent as `null` for none. Save is disabled while saving; validation via `homeworkDraftError` shows `hwErrTitle` / `hwErrDue` inline under the field. Errors from the server appear inside the modal (a toast would sit behind it — see the comments at lines ~616 and ~644 of the class screen).
- Edit modal also has «حذف الواجب» (destructive text button) → `confirm` (use `services/confirm.ts`, look at how `onDetachExam` does it) → `archiveHomework`.
- The create call sends `{ classGroupId: classId, title, instructions, dueDate, evaluationId }`.
- New spacing/type/radius all from tokens; `aria-selected` on chips and exam rows.

- [ ] **Step 1:** Implement the component and wire the tab.
- [ ] **Step 2:** `pnpm test` in `artifacts/mobile`, `pnpm run typecheck`.
- [ ] **Step 3:** State honestly whether the tab was seen in a browser; as in Task 6, only if a fixture route already exists.
- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile
git commit -m "feat(mobile): homework tab on the class screen"
```

---

### Task 8: Docs, spec amendments, final verification, push

**Files:**
- Modify: `docs/superpowers/specs/2026-10-11-family-school-views-design.md`, `STATUS.md`, `CLAUDE.md` (only if a new trap was found), PR #1007 description

- [ ] **Step 1: Spec.** In the "2. Homework" section apply the five amendments from the top of this plan (rewrite the affected bullets, do not append a changelog), mark Part 2 built in the table, and in "Risks" keep the STUDENT_ACCOUNTS note.
- [ ] **Step 2: STATUS.md.** Add a section «Homework: teachers set it, students tick it, parents watch, 2026-10-12» in the style of the timetable section: what exists (routes, tables, mobile surfaces), the access rules and which DB test pins each, **what has not been seen** (the screens on a device/browser; push notifications are Part 4 — nothing tells a family about new homework yet), the 14-day window and the Amman-day rule, and the known limitation that a student's done marks are per roster row (a child with two accounts linked to the same row shares them). Update any line in STATUS.md that this changes.
- [ ] **Step 3: Full verification.** From the repo root: `pnpm run typecheck`; `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=… REQUIRE_DB_TESTS=true pnpm test` (0 skipped, all pass); `cd artifacts/mobile && pnpm test`. Paste the counts into the report.
- [ ] **Step 4: Update the PR description** (title stays or becomes «Family School tab (timetable + homework) + DB-backed API test harness»): add a Homework section — tables, routes, the migration (additive, no destructive flag), and the "not seen on a device" caveat. Keep the separate "CI change" section. End with the attribution line from the session reminder.
- [ ] **Step 5: Push and watch CI.** `git push -u origin claude/brave-einstein-qxpxc3`; poll the three checks until they finish; if CI tests the PR merged with `main` and `main` has moved, merge `origin/main` into the branch first (never rebase). All three green is the exit condition; a red check is investigated and fixed, not re-run.
- [ ] **Step 6: Commit docs**

```bash
git add docs STATUS.md CLAUDE.md
git commit -m "docs: homework spec amendments and STATUS"
```

---

## Self-review

- **Spec coverage:** tables (T1) · teacher CRUD + counts + ownership via `findLiveClass` and the same-404 rule (T3) · student list / mark done / class-only (T4) · parent read-only per child (T4) · pure rules in `modules/homework/` with unit tests (T2) · mobile Homework section and create/edit modal with `KeyboardSafeView` (T6, T7) · attach an exam (T7, amended) · spec Testing list: parent cannot read another family's child (T4 cases 3–4), student cannot read another class's homework (T4 cases 3, 8), teacher cannot edit another teacher's homework (T3 cases 7, 9), unowned paths still 404 not 401 (T3 Step 6, T4 Step 4 plus the existing case) · STATUS in the same PR (T8). Notifications and the reminder are Part 4 and intentionally absent.
- **Placeholders:** none; Task 6/7 describe UI behaviour precisely rather than line-by-line JSX because the surrounding files own the chrome — the implementer is pointed at the exact precedent for each piece.
- **Type consistency:** `TeacherHomework` fields match between T3 (HTTP) and T5 (`normalizeTeacherHomework`); `FamilyHomeworkItem` (T2) has `exam: {title}|null`, T5 flattens to `examTitle` — the normaliser must do that mapping, and its test must cover it (add to T5 Step 1: `normalizeFamilyHomework` maps `exam.title` → `examTitle`, `null` exam → `null`). `HomeworkState` is the same union in both sides. `dueDate` is `YYYY-MM-DD` everywhere; `dueAt` ISO appears only in API responses.
