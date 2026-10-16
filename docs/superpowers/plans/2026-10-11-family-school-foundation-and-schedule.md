# Family "School" tab: foundation + schedule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students and parents get a "School" tab showing the weekly class timetable (read-only), built from the periods teachers already enter, with a shared helper that every later part (homework, exams) will reuse.

**Architecture:** Two new pure modules (`modules/family/children.ts`, `modules/schedule/familySchedule.ts`) hold all the logic and are unit-tested. A thin DB layer (`lib/familyAccess.ts`, `lib/familyScheduleLoad.ts`) feeds them. A new path-scoped router serves `GET /student/schedule` and `GET /parent/schedule`. The mobile app gets a pure service, a `school` tab screen, and an allowlist entry. No new tables, no migration.

**Tech Stack:** Express + drizzle (api-server, `node:test`), Expo Router / React Native (mobile, `node:test`), pnpm monorepo.

**Spec:** `docs/superpowers/specs/2026-10-11-family-school-views-design.md` (Parts 0 and 1). Task 7 amends the spec where this plan deliberately differs.

## Global Constraints

- Branch `claude/brave-einstein-qxpxc3`, draft PR [#1007](https://github.com/NizarAbuahmad/Iqraa/pull/1007). Retitle the PR when the first code task lands. Commit trailers (every commit): `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX`.
- Arabic is the product language, UI is RTL-first (`isRTL ? 'row-reverse' : 'row'`, manual `textAlign`). Fonts `Almarai_400Regular` body / `ReadexPro_*` headings.
- Every router mounted without a prefix sees every request: guards must be path-scoped (`router.use("/student/schedule", …)`), never bare. `mountOrder.test.ts` asserts it.
- Anything loaded directly by `node --test` needs explicit `.ts` extensions on relative imports.
- api-server tests live in `src/**/__tests__/**/*.test.ts`; mobile tests only in `services/__tests__/**/*.test.ts`, and may not import `react-native` / `expo-*` at module scope.
- Do not add a `KeyboardAvoidingView` to a screen (nothing here has an input).
- A tab screen's header must not add `insets.top` (the tab layout already pays it); use `topPad = 16`.
- `STUDENT_ACCOUNTS` stays off by default; the new routes answer `403 student_accounts_disabled` when it is off, like `/parent/exams`.
- i18n: every key in both `ar` and `en`; `i18n.test.ts` enforces matching keys and arity.
- `STATUS.md` is updated in the same PR (Task 7).
- Run API commands from `/home/user/Iqraa/artifacts/api-server`, mobile from `/home/user/Iqraa/artifacts/mobile`.

## Known limitation (read before building)

A `class_groups` row has exactly one `teacherId`, and a roster `students` row belongs to one teacher. So "a class's timetable assembled from every teacher's slots" is really: **the union of the slots of every class the account's linked roster rows sit in**. A student who has claimed only the maths teacher's code sees only the maths teacher's periods until they claim the others (`POST /auth/claim` already supports linking more rows). The empty state and copy must not imply the timetable is complete. This is called out again in the final report and in the spec (Task 7).

For parents the same child can therefore appear as several roster rows (one per teacher). Part 0 groups a parent's guardian links **by normalised display name** into one child for the schedule. `/parent/exams` is left untouched and keeps one section per roster row.

## File Structure

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/modules/family/children.ts` (new) | Pure: group a parent's guardian links into children by name |
| `artifacts/api-server/src/modules/family/__tests__/children.test.ts` (new) | Tests for the above |
| `artifacts/api-server/src/lib/familyAccess.ts` (new) | DB: `selfLinkedStudentIds`, `guardianLinkedStudents` (moved out of `studentExams.ts`) |
| `artifacts/api-server/src/modules/schedule/familySchedule.ts` (new) | Pure: slots + periods + classes + teachers → week grid |
| `artifacts/api-server/src/modules/schedule/__tests__/familySchedule.test.ts` (new) | Tests for the above |
| `artifacts/api-server/src/lib/familyScheduleLoad.ts` (new) | DB: load the four inputs for a set of roster-row ids |
| `artifacts/api-server/src/routes/familySchedule.ts` (new) | `GET /student/schedule`, `GET /parent/schedule` |
| `artifacts/api-server/src/routes/index.ts` (modify) | Mount the router |
| `artifacts/api-server/src/routes/studentExams.ts` (modify) | Use the moved helpers |
| `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (modify) | 401 assertions for both routes |
| `artifacts/mobile/services/familySchedule.ts` (new) | Types, fetchers, pure helpers |
| `artifacts/mobile/services/__tests__/familySchedule.test.ts` (new) | Tests for the above |
| `artifacts/mobile/services/routeGating.ts` + test (modify) | Allow `/school` |
| `artifacts/mobile/services/i18n.ts` (modify) | New keys, ar + en |
| `artifacts/mobile/app/(tabs)/_layout.tsx` (modify) | `school` tab for parent/student |
| `artifacts/mobile/app/(tabs)/school.tsx` (new) | The screen |
| `STATUS.md`, spec (modify) | Task 7 |

---

### Task 1: Group a parent's guardian links into children

**Files:**
- Create: `artifacts/api-server/src/modules/family/children.ts`
- Test: `artifacts/api-server/src/modules/family/__tests__/children.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface GuardianLink { studentId: string; displayName: string }
  export interface ChildGroup { key: string; displayName: string; studentIds: string[] }
  export function normalizeChildName(name: string): string
  export function groupChildren(links: readonly GuardianLink[]): ChildGroup[]
  ```
  `key` is the smallest `studentId` in the group (stable across calls), `studentIds` is sorted and de-duplicated, `displayName` is the trimmed name from the row with the smallest `studentId`. Groups are sorted by `displayName` (Arabic locale) then `key`.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/modules/family/__tests__/children.test.ts
/**
 * What this guards: a child taught by two teachers is two roster rows
 * (`students` is teacher-owned), so a parent linked to both would otherwise
 * see the same child twice on the schedule. Grouping is by name, within one
 * parent's own links only — never across accounts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { groupChildren, normalizeChildName } from "../children.ts";

describe("normalizeChildName", () => {
  it("ignores case, outer whitespace and repeated inner spaces", () => {
    assert.equal(normalizeChildName("  Sara   Haddad "), normalizeChildName("sara haddad"));
  });

  it("does not merge different names", () => {
    assert.notEqual(normalizeChildName("سارة"), normalizeChildName("سلمى"));
  });
});

describe("groupChildren", () => {
  it("merges rows with the same name into one child", () => {
    const groups = groupChildren([
      { studentId: "b", displayName: "سارة" },
      { studentId: "a", displayName: "سارة " },
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0], { key: "a", displayName: "سارة", studentIds: ["a", "b"] });
  });

  it("keeps different names apart", () => {
    const groups = groupChildren([
      { studentId: "a", displayName: "سارة" },
      { studentId: "b", displayName: "أحمد" },
    ]);
    assert.equal(groups.length, 2);
    assert.deepEqual(new Set(groups.map(g => g.displayName)), new Set(["سارة", "أحمد"]));
  });

  it("collapses a repeated row for the same student", () => {
    const groups = groupChildren([
      { studentId: "a", displayName: "Sara" },
      { studentId: "a", displayName: "Sara" },
    ]);
    assert.deepEqual(groups, [{ key: "a", displayName: "Sara", studentIds: ["a"] }]);
  });

  it("is stable whatever order the database returns the rows in", () => {
    const rows = [
      { studentId: "c", displayName: "Omar" },
      { studentId: "a", displayName: "Sara" },
      { studentId: "b", displayName: "Sara" },
    ];
    assert.deepEqual(groupChildren(rows), groupChildren([...rows].reverse()));
  });

  it("returns nothing for no links", () => {
    assert.deepEqual(groupChildren([]), []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/modules/family/__tests__/children.test.ts`
Expected: FAIL — cannot find module `../children.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// artifacts/api-server/src/modules/family/children.ts
/**
 * A parent's "children", as the schedule needs them.
 *
 * `students` rows are teacher-owned: the same child taught by two teachers is
 * two rows, each linked to the parent through its own `roster_links` row. The
 * schedule is assembled from every class those rows sit in, so it must treat
 * them as one child. There is no child entity to join on, so rows are grouped
 * by normalised name — inside one parent's own links, never across accounts.
 *
 * Pure and import-free so `node --test` can load it.
 */
export interface GuardianLink {
  studentId: string;
  displayName: string;
}

export interface ChildGroup {
  /** The smallest roster-row id in the group: stable, and unique per parent. */
  key: string;
  displayName: string;
  /** Sorted, de-duplicated. */
  studentIds: string[];
}

export function normalizeChildName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function groupChildren(links: readonly GuardianLink[]): ChildGroup[] {
  // Smallest id first, so the group's name and key do not depend on row order.
  const sorted = [...links].sort((a, b) => (a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0));
  const byName = new Map<string, ChildGroup>();
  for (const link of sorted) {
    const name = normalizeChildName(link.displayName);
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, {
        key: link.studentId,
        displayName: link.displayName.trim().replace(/\s+/g, " "),
        studentIds: [link.studentId],
      });
    } else if (!existing.studentIds.includes(link.studentId)) {
      existing.studentIds.push(link.studentId);
    }
  }
  return [...byName.values()].sort(
    (a, b) => a.displayName.localeCompare(b.displayName, "ar") || (a.key < b.key ? -1 : 1),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/modules/family/__tests__/children.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/modules/family
git commit -m "$(cat <<'EOF'
feat(api): group a parent's guardian links into children by name

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 2: Move the link queries into a shared helper

Behaviour-preserving refactor: no endpoint changes. The existing suite is the safety net.

**Files:**
- Create: `artifacts/api-server/src/lib/familyAccess.ts`
- Modify: `artifacts/api-server/src/routes/studentExams.ts` (local `selfLinkedStudentIds` at ~64–72; guardian query at ~496–507; imports at ~49)

**Interfaces:**
- Consumes: `GuardianLink` from Task 1.
- Produces:
  ```ts
  export async function selfLinkedStudentIds(userId: string): Promise<string[]>
  export async function guardianLinkedStudents(userId: string): Promise<GuardianLink[]>
  ```
  Both exclude archived students. `guardianLinkedStudents` returns one row per student id.

- [ ] **Step 1: Capture the baseline**

Run: `pnpm typecheck && pnpm build && pnpm test`
Expected: all green. Note the pass count so Step 5 can compare.

- [ ] **Step 2: Create the helper**

```ts
// artifacts/api-server/src/lib/familyAccess.ts
/**
 * Which roster rows a signed-in student or parent is linked to.
 *
 * Every student/parent read scopes through `roster_links`: a student is the
 * rows their account is `self`-linked to, a parent is the rows it is
 * `guardian`-linked to. These two queries used to live inline in
 * `routes/studentExams.ts`; the schedule (and later homework) need them too,
 * and "who may see this child" should be decided in exactly one place.
 *
 * Archived roster rows never count. The 404/empty behaviour for a row that is
 * not linked is the caller's — these only answer "which rows".
 */
import { db, rosterLinks, students } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import type { GuardianLink } from "../modules/family/children.ts";

/** Every live roster row this account is `self`-linked to. */
export async function selfLinkedStudentIds(userId: string): Promise<string[]> {
  const linked = await db
    .select({ studentId: rosterLinks.studentId })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), eq(rosterLinks.relation, "self"), isNull(students.archivedAt)));
  return [...new Set(linked.map(l => l.studentId))];
}

/** Every live roster row this account is `guardian`-linked to, one per student id. */
export async function guardianLinkedStudents(userId: string): Promise<GuardianLink[]> {
  const linked = await db
    .select({ studentId: students.id, displayName: students.displayName })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(
      and(
        eq(rosterLinks.userId, userId),
        eq(rosterLinks.relation, "guardian"),
        isNull(students.archivedAt),
      ),
    );
  return [...new Map(linked.map(l => [l.studentId, l])).values()];
}
```

- [ ] **Step 3: Point `studentExams.ts` at it**

Run `grep -n "rosterLinks\|students\b\|isNull" src/routes/studentExams.ts` first and note which imports are still used after the edit.

Edit 1 — add the import after the `assignedStudentsByEvaluation` import (line ~49):

```ts
import { guardianLinkedStudents, selfLinkedStudentIds } from "../lib/familyAccess.ts";
```

Edit 2 — delete the local helper, exactly this block:

```ts
/** Every live roster row this account is `self`-linked to. */
async function selfLinkedStudentIds(userId: string): Promise<string[]> {
  const linked = await db
    .select({ studentId: rosterLinks.studentId })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), eq(rosterLinks.relation, "self"), isNull(students.archivedAt)));
  return [...new Set(linked.map(l => l.studentId))];
}

```

Edit 3 — in `GET /parent/exams`, replace the inline query:

```ts
    const linked = await db
      .select({ studentId: students.id, displayName: students.displayName })
      .from(rosterLinks)
      .innerJoin(students, eq(students.id, rosterLinks.studentId))
      .where(
        and(
          eq(rosterLinks.userId, req.user!.id),
          eq(rosterLinks.relation, "guardian"),
          isNull(students.archivedAt),
        ),
      );
    const children = [...new Map(linked.map(l => [l.studentId, l])).values()];
```

with:

```ts
    const children = await guardianLinkedStudents(req.user!.id);
```

- [ ] **Step 4: Remove imports that are now unused**

Run: `pnpm typecheck`
If it reports an unused `rosterLinks`, `students` or `isNull` in `studentExams.ts`, delete exactly those names from the import lists and re-run until clean. Do not touch any import the compiler does not flag.

- [ ] **Step 5: Verify nothing changed**

Run: `pnpm typecheck && pnpm build && pnpm test`
Expected: green, same pass count as Step 1 plus the Task 1 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/lib/familyAccess.ts artifacts/api-server/src/routes/studentExams.ts
git commit -m "$(cat <<'EOF'
refactor(api): one place for "which roster rows is this account linked to"

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 3: Build the family week grid (pure)

**Files:**
- Create: `artifacts/api-server/src/modules/schedule/familySchedule.ts`
- Test: `artifacts/api-server/src/modules/schedule/__tests__/familySchedule.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SlotRow { teacherId: string; schoolName: string; dayOfWeek: number; periodNumber: number; classGroupId: string; subjectId: string; notes: string }
  export interface PeriodRow { teacherId: string; schoolName: string; periodNumber: number; startTime: string; durationMinutes: number }
  export interface ClassRow { id: string; subjectId: string; subjectIds: string[] }
  export interface TeacherRow { id: string; firstName: string; lastName: string }
  export interface ScheduleInput { slots: SlotRow[]; periods: PeriodRow[]; classes: ClassRow[]; teachers: TeacherRow[] }
  export interface FamilyPeriod { periodNumber: number; startTime: string | null; durationMinutes: number | null; subjectId: string; teacherName: string; notes: string }
  export interface FamilyDay { dayOfWeek: number; periods: FamilyPeriod[] }
  export interface FamilySchedule { days: FamilyDay[] }
  export function buildFamilySchedule(input: ScheduleInput): FamilySchedule
  ```
  `dayOfWeek` 0 = Sunday. Only days with at least one period appear, ascending. Within a day: by clock, then period number, then teacher name; a period with no known time sorts last and carries `startTime: null, durationMinutes: null`. A slot whose class is not in `classes` is dropped.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/modules/schedule/__tests__/familySchedule.test.ts
/**
 * What this guards: a family sees a week grid built from teachers' own
 * timetables. The traps are all "looks right, is wrong": two teachers define
 * "period 1" at different times, a multi-subject class that never said which
 * subject a period is, and a slot for a class the family is not in.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFamilySchedule,
  type PeriodRow,
  type ScheduleInput,
  type SlotRow,
} from "../familySchedule.ts";

function slot(over: Partial<SlotRow> = {}): SlotRow {
  return {
    teacherId: "t1",
    schoolName: "",
    dayOfWeek: 0,
    periodNumber: 1,
    classGroupId: "c1",
    subjectId: "",
    notes: "",
    ...over,
  };
}

function period(over: Partial<PeriodRow> = {}): PeriodRow {
  return { teacherId: "t1", schoolName: "", periodNumber: 1, startTime: "08:00", durationMinutes: 45, ...over };
}

function input(over: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    slots: [],
    periods: [],
    classes: [{ id: "c1", subjectId: "mathematics", subjectIds: ["mathematics"] }],
    teachers: [{ id: "t1", firstName: "Omar", lastName: "Haddad" }],
    ...over,
  };
}

describe("buildFamilySchedule", () => {
  it("is empty when no teacher has entered a slot — never an empty-looking free week", () => {
    assert.deepEqual(buildFamilySchedule(input()), { days: [] });
  });

  it("groups by day, ascending from Sunday, and only lists days that have a period", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ dayOfWeek: 3 }), slot({ dayOfWeek: 0 })],
        periods: [period()],
      }),
    );
    assert.deepEqual(s.days.map(d => d.dayOfWeek), [0, 3]);
  });

  it("orders a day by the clock, not by period number", () => {
    const s = buildFamilySchedule(
      input({
        slots: [
          slot({ teacherId: "t1", periodNumber: 1 }),
          slot({ teacherId: "t2", periodNumber: 2 }),
        ],
        // t2's period 2 starts before t1's period 1.
        periods: [
          period({ teacherId: "t1", periodNumber: 1, startTime: "09:00" }),
          period({ teacherId: "t2", periodNumber: 2, startTime: "08:00" }),
        ],
        teachers: [
          { id: "t1", firstName: "Omar", lastName: "Haddad" },
          { id: "t2", firstName: "Lina", lastName: "Saleh" },
        ],
      }),
    );
    assert.deepEqual(s.days[0].periods.map(p => p.teacherName), ["Lina Saleh", "Omar Haddad"]);
  });

  it("takes each period's time from its own teacher — two teachers' 'period 1' are unrelated", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ teacherId: "t1", dayOfWeek: 0 }), slot({ teacherId: "t2", dayOfWeek: 1 })],
        periods: [
          period({ teacherId: "t1", startTime: "08:00" }),
          period({ teacherId: "t2", startTime: "10:30", durationMinutes: 50 }),
        ],
        teachers: [
          { id: "t1", firstName: "Omar", lastName: "Haddad" },
          { id: "t2", firstName: "Lina", lastName: "Saleh" },
        ],
      }),
    );
    assert.equal(s.days[0].periods[0].startTime, "08:00");
    assert.equal(s.days[1].periods[0].startTime, "10:30");
    assert.equal(s.days[1].periods[0].durationMinutes, 50);
  });

  it("matches a period to the slot's school — the same number means different times in two schools", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ schoolName: "B" })],
        periods: [
          period({ schoolName: "", startTime: "08:00" }),
          period({ schoolName: "B", startTime: "13:00" }),
        ],
      }),
    );
    assert.equal(s.days[0].periods[0].startTime, "13:00");
  });

  it("keeps a period whose time is unknown, last, with null times", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ periodNumber: 1 }), slot({ periodNumber: 2 })],
        periods: [period({ periodNumber: 2, startTime: "09:00" })],
      }),
    );
    const [first, second] = s.days[0].periods;
    assert.equal(first.periodNumber, 2);
    assert.equal(second.periodNumber, 1);
    assert.equal(second.startTime, null);
    assert.equal(second.durationMinutes, null);
  });

  it("uses the slot's subject when it names one", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ subjectId: "physics" })],
        classes: [{ id: "c1", subjectId: "mathematics", subjectIds: ["mathematics", "physics"] }],
      }),
    );
    assert.equal(s.days[0].periods[0].subjectId, "physics");
  });

  it("fills the subject from a one-subject class that did not say", () => {
    const s = buildFamilySchedule(input({ slots: [slot()] }));
    assert.equal(s.days[0].periods[0].subjectId, "mathematics");
  });

  it("leaves the subject empty for a multi-subject class that did not say — guessing would mislabel it", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot()],
        classes: [{ id: "c1", subjectId: "mathematics", subjectIds: ["mathematics", "physics"] }],
      }),
    );
    assert.equal(s.days[0].periods[0].subjectId, "");
  });

  it("falls back to the single legacy subjectId when subjectIds is empty", () => {
    const s = buildFamilySchedule(
      input({ slots: [slot()], classes: [{ id: "c1", subjectId: "chemistry", subjectIds: [] }] }),
    );
    assert.equal(s.days[0].periods[0].subjectId, "chemistry");
  });

  it("drops a slot for a class the family is not in", () => {
    const s = buildFamilySchedule(input({ slots: [slot({ classGroupId: "someone-elses" })] }));
    assert.deepEqual(s, { days: [] });
  });

  it("copes with a teacher row that is missing — name is empty, the period still shows", () => {
    const s = buildFamilySchedule(input({ slots: [slot()], teachers: [] }));
    assert.equal(s.days[0].periods[0].teacherName, "");
  });

  it("carries the slot note through", () => {
    const s = buildFamilySchedule(input({ slots: [slot({ notes: "أحضر الآلة الحاسبة" })] }));
    assert.equal(s.days[0].periods[0].notes, "أحضر الآلة الحاسبة");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/modules/schedule/__tests__/familySchedule.test.ts`
Expected: FAIL — cannot find module `../familySchedule.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// artifacts/api-server/src/modules/schedule/familySchedule.ts
/**
 * A student's or parent's weekly timetable, from teachers' own slots.
 *
 * Teachers enter `schedule_slots` for their own classes (see
 * lib/db/src/schema/schedule.ts); a family sees the slots of every class their
 * linked roster rows sit in. Nothing is entered twice, and nothing here claims
 * the grid is complete — it is the union of the teachers who have filled theirs
 * in. An empty result means exactly that, and the client says so.
 *
 * Each period's time comes from its own teacher's `schedule_periods` row
 * (same school): two teachers' "period 1" are unrelated clock times, so times
 * are never merged across teachers.
 *
 * Pure and import-free: `node --test` cannot load the route files, and this is
 * the part worth testing.
 */
export interface SlotRow {
  teacherId: string;
  schoolName: string;
  /** 0 = Sunday .. 6 = Saturday. */
  dayOfWeek: number;
  periodNumber: number;
  classGroupId: string;
  /** '' = the teacher did not say which of the class's subjects this is. */
  subjectId: string;
  notes: string;
}

export interface PeriodRow {
  teacherId: string;
  schoolName: string;
  periodNumber: number;
  /** "HH:MM", 24-hour. */
  startTime: string;
  durationMinutes: number;
}

export interface ClassRow {
  id: string;
  subjectId: string;
  subjectIds: string[];
}

export interface TeacherRow {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ScheduleInput {
  slots: SlotRow[];
  periods: PeriodRow[];
  classes: ClassRow[];
  teachers: TeacherRow[];
}

export interface FamilyPeriod {
  periodNumber: number;
  startTime: string | null;
  durationMinutes: number | null;
  /** '' when it cannot be told without guessing. */
  subjectId: string;
  teacherName: string;
  notes: string;
}

export interface FamilyDay {
  dayOfWeek: number;
  periods: FamilyPeriod[];
}

export interface FamilySchedule {
  days: FamilyDay[];
}

const periodKey = (teacherId: string, schoolName: string, periodNumber: number): string =>
  `${teacherId}\u0000${schoolName}\u0000${periodNumber}`;

/** The slot's own subject, else the class's only subject, else nothing — never a guess. */
function subjectFor(slotSubject: string, cls: ClassRow): string {
  if (slotSubject) return slotSubject;
  const subjects = cls.subjectIds.length > 0 ? cls.subjectIds : cls.subjectId ? [cls.subjectId] : [];
  return subjects.length === 1 ? subjects[0] : "";
}

const clock = (p: FamilyPeriod): string => p.startTime ?? "99:99";

export function buildFamilySchedule(input: ScheduleInput): FamilySchedule {
  const classById = new Map(input.classes.map(c => [c.id, c]));
  const teacherById = new Map(input.teachers.map(t => [t.id, t]));
  const periodByKey = new Map(input.periods.map(p => [periodKey(p.teacherId, p.schoolName, p.periodNumber), p]));

  const byDay = new Map<number, FamilyPeriod[]>();
  for (const s of input.slots) {
    const cls = classById.get(s.classGroupId);
    if (!cls) continue;
    const time = periodByKey.get(periodKey(s.teacherId, s.schoolName, s.periodNumber));
    const teacher = teacherById.get(s.teacherId);
    const entry: FamilyPeriod = {
      periodNumber: s.periodNumber,
      startTime: time?.startTime ?? null,
      durationMinutes: time?.durationMinutes ?? null,
      subjectId: subjectFor(s.subjectId, cls),
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : "",
      notes: s.notes,
    };
    const day = byDay.get(s.dayOfWeek);
    if (day) day.push(entry);
    else byDay.set(s.dayOfWeek, [entry]);
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayOfWeek, periods]) => ({
      dayOfWeek,
      periods: periods.sort(
        (a, b) =>
          (clock(a) < clock(b) ? -1 : clock(a) > clock(b) ? 1 : 0) ||
          a.periodNumber - b.periodNumber ||
          a.teacherName.localeCompare(b.teacherName),
      ),
    }));
  return { days };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/modules/schedule/__tests__/familySchedule.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/modules/schedule
git commit -m "$(cat <<'EOF'
feat(api): build a family week grid from teachers' own timetable slots

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 4: Serve it — loader, router, mount, mount-order test

**Files:**
- Create: `artifacts/api-server/src/lib/familyScheduleLoad.ts`
- Create: `artifacts/api-server/src/routes/familySchedule.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (import near line 18; mount after line 96)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (new `it` after the `"guards a parent's view of their children's exams"` block, ~line 511)

**Interfaces:**
- Consumes: `buildFamilySchedule`, `FamilySchedule` (Task 3); `selfLinkedStudentIds`, `guardianLinkedStudents` (Task 2); `groupChildren` (Task 1).
- Produces:
  - `loadFamilySchedule(studentIds: string[]): Promise<FamilySchedule>`
  - `GET /student/schedule` → `200 { schedule: FamilySchedule }`
  - `GET /parent/schedule` → `200 { children: { key: string; displayName: string; schedule: FamilySchedule }[] }`
  - Both: `401` without a token, `403` wrong role, `403 { code: "student_accounts_disabled" }` while the flag is off, `500 { error }` on failure.

- [ ] **Step 1: Write the mount-order test**

Insert after the `"guards a parent's view of their children's exams"` `it` block:

```ts
  it("guards the family schedule, for both roles", async () => {
    // Same two traps as «اختباراتي»: refuse an anonymous caller, and never
    // answer for a path the teacher router owns. /schedule (teacher) and
    // /student/schedule (family) share a word and nothing else.
    for (const p of ["/student/schedule", "/parent/schedule"]) {
      const res = await fetch(`${base}${p}`);
      assert.equal(res.status, 401, `${p} must require a token`);
    }
    const teacher = await fetch(`${base}/schedule`);
    assert.equal(teacher.status, 401, "the teacher timetable keeps its own guard");
  });
```

- [ ] **Step 2: Run it — it passes before the router exists, on purpose**

Run: `pnpm build && node --experimental-strip-types --test src/routes/__tests__/mountOrder.test.ts`
Expected: PASS. `studentExamsRouter` already guards everything under `/student` and `/parent`, so both paths answer 401 today. This is a characterisation test, not a red-green one: it pins what the new router must not break (a 404, or a 200 without a token, would mean the mount is wrong). Re-run it in Step 7 after the router is mounted.

- [ ] **Step 3: Check the schema exports exist**

Run: `grep -n "scheduleSlots\|schedulePeriods\|classMemberships\|classGroups" ../../lib/db/src/schema/*.ts | grep "export const"`
Expected: all four tables are exported (`schedule.ts`, `students.ts`).

- [ ] **Step 4: Write the loader**

```ts
// artifacts/api-server/src/lib/familyScheduleLoad.ts
/**
 * The database half of a family's timetable: given the roster rows an account
 * is linked to, fetch the classes they sit in, those classes' slots, and the
 * teachers' period times and names, then hand them to the pure builder.
 *
 * Archived classes are skipped (a class that has ended is not "this week").
 * Slots with no class are never selected — `inArray` on `class_group_id` only
 * matches the ids asked for.
 */
import { db, classGroups, classMemberships, schedulePeriods, scheduleSlots, users } from "@workspace/db";
import { and, inArray, isNull, eq } from "drizzle-orm";
import { buildFamilySchedule, type FamilySchedule } from "../modules/schedule/familySchedule.ts";

const EMPTY: FamilySchedule = { days: [] };

export async function loadFamilySchedule(studentIds: string[]): Promise<FamilySchedule> {
  if (studentIds.length === 0) return EMPTY;

  const memberships = await db
    .select({
      id: classGroups.id,
      subjectId: classGroups.subjectId,
      subjectIds: classGroups.subjectIds,
    })
    .from(classMemberships)
    .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
    .where(and(inArray(classMemberships.studentId, studentIds), isNull(classGroups.archivedAt)));
  const classes = [...new Map(memberships.map(c => [c.id, c])).values()];
  if (classes.length === 0) return EMPTY;

  const slotRows = await db
    .select({
      teacherId: scheduleSlots.teacherId,
      schoolName: scheduleSlots.schoolName,
      dayOfWeek: scheduleSlots.dayOfWeek,
      periodNumber: scheduleSlots.periodNumber,
      classGroupId: scheduleSlots.classGroupId,
      subjectId: scheduleSlots.subjectId,
      notes: scheduleSlots.notes,
    })
    .from(scheduleSlots)
    .where(
      inArray(
        scheduleSlots.classGroupId,
        classes.map(c => c.id),
      ),
    );
  const slots = slotRows.flatMap(s => (s.classGroupId ? [{ ...s, classGroupId: s.classGroupId }] : []));
  if (slots.length === 0) return EMPTY;

  const teacherIds = [...new Set(slots.map(s => s.teacherId))];
  const [periods, teachers] = await Promise.all([
    db
      .select({
        teacherId: schedulePeriods.teacherId,
        schoolName: schedulePeriods.schoolName,
        periodNumber: schedulePeriods.periodNumber,
        startTime: schedulePeriods.startTime,
        durationMinutes: schedulePeriods.durationMinutes,
      })
      .from(schedulePeriods)
      .where(inArray(schedulePeriods.teacherId, teacherIds)),
    db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(inArray(users.id, teacherIds)),
  ]);

  return buildFamilySchedule({ slots, periods, classes, teachers });
}
```

- [ ] **Step 5: Write the router**

```ts
// artifacts/api-server/src/routes/familySchedule.ts
/**
 * «جدول الحصص» for students and parents: the weekly timetable, read-only,
 * assembled from the teachers' own (see modules/schedule/familySchedule.ts).
 *
 * A student sees the classes their `self`-linked roster rows sit in. A parent
 * sees one entry per child, children being their guardian-linked rows grouped
 * by name (modules/family/children.ts) so a child taught by two teachers is
 * one entry, not two.
 *
 * Path-scoped guards, like every other router here — see `mountOrder.test.ts`.
 * `studentExams.ts` already guards all of `/student` and `/parent`; these
 * repeat it on purpose, so moving a mount cannot quietly open the route.
 */
import { Router } from "express";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { guardianLinkedStudents, selfLinkedStudentIds } from "../lib/familyAccess.ts";
import { loadFamilySchedule } from "../lib/familyScheduleLoad.ts";
import { groupChildren } from "../modules/family/children.ts";

const router = Router();

router.use("/student/schedule", authMiddleware, requireRole("student"));
router.use("/parent/schedule", authMiddleware, requireRole("parent"));

const DISABLED = {
  code: "student_accounts_disabled",
  error: "Parent and student accounts are not available yet.",
} as const;

router.get("/student/schedule", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const schedule = await loadFamilySchedule(await selfLinkedStudentIds(req.user!.id));
    res.json({ schedule });
  } catch (err) {
    logger.error({ err }, "student schedule failed");
    res.status(500).json({ error: "Failed to load your schedule" });
  }
});

router.get("/parent/schedule", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const children = groupChildren(await guardianLinkedStudents(req.user!.id));
    const lists = await Promise.all(
      children.map(async child => ({
        key: child.key,
        displayName: child.displayName,
        schedule: await loadFamilySchedule(child.studentIds),
      })),
    );
    res.json({ children: lists });
  } catch (err) {
    logger.error({ err }, "parent schedule failed");
    res.status(500).json({ error: "Failed to load your children's schedule" });
  }
});

export default router;
```

- [ ] **Step 6: Mount it**

In `routes/index.ts`, add after `import studentExamsRouter from "./studentExams";`:

```ts
import familyScheduleRouter from "./familySchedule";
```

and after `router.use(studentExamsRouter);`:

```ts
// «جدول الحصص» for students and parents — read-only, path-scoped to
// /student/schedule and /parent/schedule.
router.use(familyScheduleRouter);
```

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm build && pnpm test`
Expected: all green, including the new mount-order test.

- [ ] **Step 8: Prove the 403 path against the built bundle**

The suite boots without `STUDENT_ACCOUNTS`, so a signed-in family request cannot be exercised there (no database). Check by reading: `grep -n "studentAccountsEnabled" src/routes/familySchedule.ts` shows the check is the first statement in both handlers. Record this in the PR description as "not exercised end-to-end here — needs a database and `STUDENT_ACCOUNTS=true`".

- [ ] **Step 9: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src
git commit -m "$(cat <<'EOF'
feat(api): GET /student/schedule and /parent/schedule

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 5: Mobile schedule service

**Files:**
- Create: `artifacts/mobile/services/familySchedule.ts`
- Test: `artifacts/mobile/services/__tests__/familySchedule.test.ts`

**Interfaces:**
- Consumes: `apiJson` from `./apiClient.ts`; `endTime` from `./scheduleCalendar.ts`; `TranslationKey` type from `./i18n.ts`.
- Produces:
  ```ts
  export interface FamilyPeriod { periodNumber: number; startTime: string | null; durationMinutes: number | null; subjectId: string; teacherName: string; notes: string }
  export interface FamilyDay { dayOfWeek: number; periods: FamilyPeriod[] }
  export interface FamilySchedule { days: FamilyDay[] }
  export interface ChildSchedule { key: string; displayName: string; schedule: FamilySchedule }
  export const WEEKDAY_KEYS: readonly TranslationKey[]          // index = dayOfWeek, 0 = Sunday
  export function normalizeSchedule(raw: unknown): FamilySchedule
  export function periodTimeLabel(p: FamilyPeriod): string | null  // "08:00–08:45"
  export function activeChild(children: readonly ChildSchedule[], selectedKey: string | null): ChildSchedule | null
  export function getMySchedule(): Promise<ChildSchedule[]>     // one entry, key 'self'
  export function getChildSchedules(): Promise<ChildSchedule[]>
  ```

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/mobile/services/__tests__/familySchedule.test.ts
/**
 * What this guards: the family timetable arrives from a server that may be
 * older or newer than the app, and the screen must render "nothing yet"
 * rather than crash on a shape it did not expect.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEEKDAY_KEYS,
  activeChild,
  normalizeSchedule,
  periodTimeLabel,
  type ChildSchedule,
  type FamilyPeriod,
} from '../familySchedule.ts';

const period = (over: Partial<FamilyPeriod> = {}): FamilyPeriod => ({
  periodNumber: 1,
  startTime: '08:00',
  durationMinutes: 45,
  subjectId: 'mathematics',
  teacherName: 'Omar Haddad',
  notes: '',
  ...over,
});

describe('normalizeSchedule', () => {
  it('reads anything that is not a schedule as an empty one', () => {
    for (const raw of [undefined, null, 'x', 42, {}, { days: 'nope' }]) {
      assert.deepEqual(normalizeSchedule(raw), { days: [] }, String(raw));
    }
  });

  it('keeps well-formed days and drops malformed ones', () => {
    const good = { dayOfWeek: 0, periods: [period()] };
    const s = normalizeSchedule({ days: [good, null, { dayOfWeek: 'x', periods: [] }, { dayOfWeek: 2 }] });
    assert.deepEqual(s, { days: [good] });
  });
});

describe('periodTimeLabel', () => {
  it('shows start and end', () => {
    assert.equal(periodTimeLabel(period()), '08:00–08:45');
  });

  it('is null when the teacher never set the time', () => {
    assert.equal(periodTimeLabel(period({ startTime: null, durationMinutes: null })), null);
  });
});

describe('WEEKDAY_KEYS', () => {
  it('has one key per weekday, Sunday first — matching Date#getDay()', () => {
    assert.equal(WEEKDAY_KEYS.length, 7);
    assert.equal(WEEKDAY_KEYS[0], 'schoolDaySun');
    assert.equal(WEEKDAY_KEYS[6], 'schoolDaySat');
  });
});

describe('activeChild', () => {
  const kids: ChildSchedule[] = [
    { key: 'a', displayName: 'سارة', schedule: { days: [] } },
    { key: 'b', displayName: 'أحمد', schedule: { days: [] } },
  ];

  it('returns the selected child', () => {
    assert.equal(activeChild(kids, 'b')?.key, 'b');
  });

  it('falls back to the first when the selection is gone or unset', () => {
    assert.equal(activeChild(kids, 'zzz')?.key, 'a');
    assert.equal(activeChild(kids, null)?.key, 'a');
  });

  it('is null when there are no children', () => {
    assert.equal(activeChild([], 'a'), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/familySchedule.test.ts`
Expected: FAIL — cannot find module `../familySchedule.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// artifacts/mobile/services/familySchedule.ts
/**
 * «الجدول الأسبوعي» for a student or parent — read-only, from
 * `GET /student/schedule` and `GET /parent/schedule`. The server assembles it
 * from the teachers' own timetables (api-server `modules/schedule`), so it is
 * only as complete as the teachers who have filled theirs in; an empty week
 * means "not entered yet", never "no lessons".
 *
 * No local fallback, like roster.ts and schedule.ts: server state with no
 * offline meaning.
 */
import { apiJson } from './apiClient.ts';
import { endTime } from './scheduleCalendar.ts';
import type { TranslationKey } from './i18n.ts';

export interface FamilyPeriod {
  periodNumber: number;
  /** "HH:MM" — null when the teacher never set this period's time. */
  startTime: string | null;
  durationMinutes: number | null;
  /** '' when it cannot be told without guessing. */
  subjectId: string;
  teacherName: string;
  notes: string;
}

export interface FamilyDay {
  /** 0 = Sunday .. 6 = Saturday, matching Date#getDay(). */
  dayOfWeek: number;
  periods: FamilyPeriod[];
}

export interface FamilySchedule {
  days: FamilyDay[];
}

export interface ChildSchedule {
  key: string;
  displayName: string;
  schedule: FamilySchedule;
}

/** Index = `dayOfWeek`. */
export const WEEKDAY_KEYS: readonly TranslationKey[] = [
  'schoolDaySun',
  'schoolDayMon',
  'schoolDayTue',
  'schoolDayWed',
  'schoolDayThu',
  'schoolDayFri',
  'schoolDaySat',
];

function isDay(d: unknown): d is FamilyDay {
  return (
    typeof d === 'object' &&
    d !== null &&
    typeof (d as FamilyDay).dayOfWeek === 'number' &&
    Array.isArray((d as FamilyDay).periods)
  );
}

/** Anything that is not a schedule reads as an empty one, so the screen shows "nothing yet". */
export function normalizeSchedule(raw: unknown): FamilySchedule {
  const days = (raw as { days?: unknown } | null | undefined)?.days;
  return { days: Array.isArray(days) ? days.filter(isDay) : [] };
}

/** "08:00–08:45", or null when the time was never set. */
export function periodTimeLabel(p: FamilyPeriod): string | null {
  if (!p.startTime || p.durationMinutes === null) return null;
  const end = endTime(p.startTime, p.durationMinutes);
  return end ? `${p.startTime}–${end}` : p.startTime;
}

export function activeChild(children: readonly ChildSchedule[], selectedKey: string | null): ChildSchedule | null {
  return children.find(c => c.key === selectedKey) ?? children[0] ?? null;
}

/** A student's own timetable, as a one-entry list so the screen treats both roles alike. */
export async function getMySchedule(): Promise<ChildSchedule[]> {
  const data = await apiJson<{ schedule?: unknown }>('/student/schedule');
  return [{ key: 'self', displayName: '', schedule: normalizeSchedule(data.schedule) }];
}

export async function getChildSchedules(): Promise<ChildSchedule[]> {
  const data = await apiJson<{ children?: Array<{ key?: unknown; displayName?: unknown; schedule?: unknown }> }>(
    '/parent/schedule',
  );
  return (data.children ?? []).flatMap(c =>
    typeof c.key === 'string'
      ? [
          {
            key: c.key,
            displayName: typeof c.displayName === 'string' ? c.displayName : '',
            schedule: normalizeSchedule(c.schedule),
          },
        ]
      : [],
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/familySchedule.test.ts`
Expected: PASS. (`'schoolDaySun'` is not yet a `TranslationKey`; the test run strips types so it passes, and Task 6 Step 3 adds the keys before typecheck runs.)

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/familySchedule.ts artifacts/mobile/services/__tests__/familySchedule.test.ts
git commit -m "$(cat <<'EOF'
feat(mobile): family schedule service

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 6: The "School" tab and screen

**Files:**
- Modify: `artifacts/mobile/services/routeGating.ts` (`NON_TEACHER_ROUTES`, ~line 70–90)
- Modify: `artifacts/mobile/services/__tests__/routeGating.test.ts`
- Modify: `artifacts/mobile/services/i18n.ts` (two anchors)
- Modify: `artifacts/mobile/app/(tabs)/_layout.tsx` (`iconNameFor`, `buildTabEntries`)
- Create: `artifacts/mobile/app/(tabs)/school.tsx`

**Interfaces:**
- Consumes: everything exported by Task 5; `subjectLabel(subjectId, lang)` from `@/services/myExams`; `apiErrorMessage` from `@/services/apiErrorKey`.
- Produces: the `/school` tab (visible only for non-teacher roles) and the i18n keys `tabSchool`, `schoolScheduleTitle`, `schoolScheduleDesc`, `schoolScheduleDescParent`, `schoolScheduleLoadFailed`, `schoolEmptyTitle`, `schoolEmptyDesc`, `schoolEmptyDescParent`, `schoolPeriodN(n)`, `schoolToday`, `schoolDaySun`…`schoolDaySat`.

- [ ] **Step 1: Write the failing gating test**

In `routeGating.test.ts`, add `'/school'` and `'/school/anything'` to the list in `it('lets a parent or student reach the screens built for them'`, and add a boundary case to the `'does not match a route that merely starts with the same letters'` test:

```ts
    assert.equal(isNonTeacherRoute('/schools'), false);
```

Run: `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/routeGating.test.ts`
Expected: FAIL on `/school`.

- [ ] **Step 2: Allow the route**

In `routeGating.ts`, add to `NON_TEACHER_ROUTES` after the `'/my-exams'` entry:

```ts
  // «المدرسة» — the parent/student tab: the weekly timetable (and, later,
  // homework). One screen, reading /student/schedule or /parent/schedule by role.
  '/school',
```

Re-run the gating test. Expected: PASS.

- [ ] **Step 3: Add the i18n keys**

Arabic block — after the line `myExamsTileCount: (n: number) => (n === 1 ? 'اختبار واحد بانتظارك' : \`${n} اختبارات بانتظارك\`),` insert:

```ts
    tabSchool: 'المدرسة',
    schoolScheduleTitle: 'الجدول الأسبوعي',
    schoolScheduleDesc: 'حصصك كما أدخلها معلّموك.',
    schoolScheduleDescParent: 'حصص أبنائك كما أدخلها معلّموهم.',
    schoolScheduleLoadFailed: 'تعذّر تحميل الجدول.',
    schoolEmptyTitle: 'لا جدول بعد',
    schoolEmptyDesc: 'لم يُدخل معلّموك حصصهم بعد. سيظهر الجدول هنا كلما أدخل معلّم حصصه، وقد لا يكتمل حتى تربط حسابك بصفوف معلّميك جميعًا.',
    schoolEmptyDescParent: 'لم يُدخل المعلّمون حصصهم بعد. سيظهر الجدول هنا كلما أدخل معلّم حصصه، وقد لا يكتمل حتى تربطوا حسابكم بصفوف المعلّمين جميعًا.',
    schoolPeriodN: (n: number) => `الحصة ${n}`,
    schoolToday: 'اليوم',
    schoolDaySun: 'الأحد',
    schoolDayMon: 'الاثنين',
    schoolDayTue: 'الثلاثاء',
    schoolDayWed: 'الأربعاء',
    schoolDayThu: 'الخميس',
    schoolDayFri: 'الجمعة',
    schoolDaySat: 'السبت',
```

English block — after the line `myExamsTileCount: (n: number) => (n === 1 ? '1 exam waiting' : \`${n} exams waiting\`),` insert:

```ts
    tabSchool: 'School',
    schoolScheduleTitle: 'Weekly schedule',
    schoolScheduleDesc: 'Your periods, as your teachers entered them.',
    schoolScheduleDescParent: "Your children's periods, as their teachers entered them.",
    schoolScheduleLoadFailed: 'Could not load the schedule.',
    schoolEmptyTitle: 'No schedule yet',
    schoolEmptyDesc: "Your teachers haven't entered their periods yet. The schedule fills in as each teacher does, and may stay incomplete until your account is linked to all your teachers' classes.",
    schoolEmptyDescParent: "The teachers haven't entered their periods yet. The schedule fills in as each teacher does, and may stay incomplete until your account is linked to all the teachers' classes.",
    schoolPeriodN: (n: number) => `Period ${n}`,
    schoolToday: 'Today',
    schoolDaySun: 'Sunday',
    schoolDayMon: 'Monday',
    schoolDayTue: 'Tuesday',
    schoolDayWed: 'Wednesday',
    schoolDayThu: 'Thursday',
    schoolDayFri: 'Friday',
    schoolDaySat: 'Saturday',
```

Run: `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts`
Expected: PASS. If `i18nTerminology` objects to a word, change that word, not the test.

- [ ] **Step 4: Register the tab**

In `app/(tabs)/_layout.tsx`:

`iconNameFor` — add before `case 'curriculum'`:

```ts
    case 'school': return 'school-outline';
```

`buildTabEntries` — insert this entry immediately before the `curriculum` entry (the one starting `// Route file kept as "curriculum"`):

```tsx
    {
      // Parents and students only: the weekly timetable (homework joins it
      // later). A teacher has the timetable under the profile tab already.
      name: 'school',
      titleKey: 'tabSchool',
      visible: !isTeacher,
      icon: ({ color, focused, isIOS }) =>
        isIOS ? (
          <SymbolView name={focused ? 'graduationcap.fill' : 'graduationcap'} tintColor={color} size={22} />
        ) : (
          <Ionicons name={focused ? 'school' : 'school-outline'} size={22} color={color} />
        ),
    },
```

- [ ] **Step 5: Write the screen**

```tsx
// artifacts/mobile/app/(tabs)/school.tsx
/**
 * «المدرسة» — a student's or parent's weekly timetable, read-only.
 *
 * The server assembles it from the teachers' own timetables, so it is only as
 * complete as the teachers who have filled theirs in: an empty week is "not
 * entered yet", and the empty state says so rather than looking like a free
 * week. A parent sees one child at a time (a picker appears with more than
 * one); exams and results are one tap away on the existing «اختباراتي» screen.
 *
 * Not a Stack screen: it sits under the tab layout, which already pays for the
 * status bar — so no `insets.top` here, same as notifications.tsx.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  WEEKDAY_KEYS,
  activeChild,
  getChildSchedules,
  getMySchedule,
  periodTimeLabel,
  type ChildSchedule,
  type FamilyPeriod,
} from '@/services/familySchedule';
import { subjectLabel } from '@/services/myExams';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';

const ACCENT = palette.primary;

export default function SchoolScreen() {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [children, setChildren] = useState<ChildSchedule[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // The list to read depends on the role, so nothing loads until the session
  // has; a newer load wins over an older one still in flight (same guard as
  // my-exams.tsx).
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!user) return;
    const seq = ++loadSeq.current;
    setError('');
    try {
      const next = isParent ? await getChildSchedules() : await getMySchedule();
      if (seq === loadSeq.current) setChildren(next);
    } catch (e) {
      if (seq === loadSeq.current) setError(apiErrorMessage(e, 'schoolScheduleLoadFailed', t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParent, user?.id]);

  // On every focus: a teacher may have entered their periods since last time.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const child = children ? activeChild(children, selected) : null;
  const today = new Date().getDay();
  const empty = children !== null && (child === null || child.schedule.days.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Not insets.top: the tab layout's bar above already pays for the status bar. */}
      <View style={[styles.header, { paddingTop: 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('schoolScheduleTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(isParent ? 'schoolScheduleDescParent' : 'schoolScheduleDesc')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 120,
          gap: 12,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {error ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: rowDir },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
            <Pressable onPress={() => void load()} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textDecorationLine: 'underline' }}>
                {t('retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {children === null && !error ? <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} /> : null}

        {isParent && children && children.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: rowDir }}>
            {children.map(c => {
              const on = c.key === child?.key;
              return (
                <Pressable
                  key={c.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(c.key);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: on ? ACCENT : colors.card, borderColor: on ? ACCENT : colors.border },
                  ]}
                >
                  <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                    {c.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {empty ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: ACCENT + '1F' }]}>
              <Ionicons name="calendar-outline" size={30} color={ACCENT} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 17, textAlign: 'center' }}>
              {t('schoolEmptyTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              {t(isParent ? 'schoolEmptyDescParent' : 'schoolEmptyDesc')}
            </Text>
          </View>
        ) : null}

        {child?.schedule.days.map(day => (
          <View
            key={day.dayOfWeek}
            style={[styles.dayCard, { backgroundColor: colors.card, borderColor: day.dayOfWeek === today ? ACCENT : colors.border, borderRadius: colors.radius }]}
          >
            <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 16, textAlign: align }}>
                {t(WEEKDAY_KEYS[day.dayOfWeek] ?? 'schoolDaySun')}
              </Text>
              {day.dayOfWeek === today ? (
                <View style={[styles.todayChip, { backgroundColor: ACCENT + '1A' }]}>
                  <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>{t('schoolToday')}</Text>
                </View>
              ) : null}
            </View>
            {day.periods.map((p, i) => (
              <PeriodRow
                key={`${p.periodNumber}:${p.teacherName}:${i}`}
                period={p}
                lang={lang}
                colors={colors}
                isRTL={isRTL}
                t={t}
              />
            ))}
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/my-exams' as never)}
          style={({ pressed }) => [
            styles.examsRow,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: rowDir, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="document-text-outline" size={20} color={ACCENT} />
          <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align }}>
            {t(isParent ? 'childResultsTitle' : 'myExamsTitle')}
          </Text>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PeriodRow({
  period, lang, colors, isRTL, t,
}: {
  period: FamilyPeriod;
  lang: 'ar' | 'en';
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const subject = period.subjectId ? subjectLabel(period.subjectId, lang) : null;
  const time = periodTimeLabel(period);
  const meta = [period.teacherName, time].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
      <View style={[styles.periodBadge, { backgroundColor: ACCENT + '1F' }]}>
        <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_700Bold', fontSize: 14 }}>{period.periodNumber}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align }}>
          {subject ?? t('schoolPeriodN', period.periodNumber)}
        </Text>
        {meta ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
            {meta}
          </Text>
        ) : null}
        {period.notes ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
            {period.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22 },
  desc: { fontSize: 15, lineHeight: 24, marginTop: 4 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  dayCard: { borderWidth: 1, padding: 14 },
  todayChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  periodBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  examsRow: { alignItems: 'center', gap: 12, borderWidth: 1, padding: 14, marginTop: 4 },
});
```

- [ ] **Step 6: Verify**

Run (mobile): `pnpm typecheck && pnpm test`
Expected: both green. Typecheck is what proves the i18n keys, `TranslationKey` typing, and the new imports line up; if it reports a missing export (`apiErrorMessage`, `CONTENT_MAX_WIDTH`, `palette`), open the file my-exams.tsx imports it from and match that import path exactly.

- [ ] **Step 7: Look at it**

Run: `cd /home/user/Iqraa && pnpm run dev:api` (one terminal) and `pnpm run dev:mobile:web` (another). Needs a database and `STUDENT_ACCOUNTS=true` (see `LOCAL_SETUP.md`). Sign in as a student linked to a class whose teacher has filled in slots, then as a parent with two children: check the timetable renders RTL, today is outlined, the child picker switches, an empty class shows the empty state, the exams row opens `/my-exams`, and the tab bar shows four tabs. **If the local setup cannot be run in this environment, say so explicitly in the PR rather than claiming the screen was checked.**

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile
git commit -m "$(cat <<'EOF'
feat(mobile): School tab with the weekly timetable for students and parents

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 7: Docs, spec amendment, final verification, push

**Files:**
- Modify: `STATUS.md` (read lines ~925–960 first; add a dated section beside "Parents and students sign up with the teacher's code alone, 2026-10-10")
- Modify: `docs/superpowers/specs/2026-10-11-family-school-views-design.md`

- [ ] **Step 1: STATUS.md**

`STATUS.md` is ~1 MB; do not open it whole. `grep -n "sign up with the teacher's code alone" STATUS.md`, read ~30 lines from that heading to find the section's end, and insert after it:

```md
## Students and parents see the weekly timetable, 2026-10-11

Parents and students have a **المدرسة** tab (`app/(tabs)/school.tsx`) showing the
weekly timetable, read-only, from `GET /student/schedule` and
`GET /parent/schedule` (`routes/familySchedule.ts`). No new tables.

- **It is the union of the teachers who have filled theirs in.** A class belongs to
  one teacher, so an account sees only the slots of classes its linked roster rows
  sit in. A student who has claimed one teacher's code sees one teacher's periods
  until they claim the rest (`POST /auth/claim`). The empty state says "not entered
  yet", never "no lessons".
- **A parent's children are grouped by name** (`modules/family/children.ts`) for the
  schedule, because the same child under two teachers is two roster rows.
  `/parent/exams` still lists one section per roster row.
- Times come from each slot's own teacher (`schedule_periods`); they are never merged.
- Behind `STUDENT_ACCOUNTS=true` like every family route. Not yet exercised against a
  real database in CI — the mount-order suite only proves the 401s.
- Still to come (spec `docs/superpowers/specs/2026-10-11-family-school-views-design.md`):
  homework, exam dates and paper marks, notifications.
```

- [ ] **Step 2: Amend the spec**

Three edits to `docs/superpowers/specs/2026-10-11-family-school-views-design.md`:

1. Replace the bullet `- Teachers define period times independently, so each slot carries its own` … (Schedule section) by appending a new bullet after it:

```md
- **A class has one teacher**, so a family sees the slots of every class their
  linked roster rows sit in — the union across teachers, not a whole-class
  timetable. An account linked to only one teacher's class sees only that
  teacher's periods. Parents' roster rows are grouped into children by name
  (`modules/family/children.ts`) so one child under two teachers is one entry.
```

2. In Part 0, replace the sentence beginning `1. **\`api-server/src/lib/familyAccess.ts\`**` so it reads: `selfLinkedStudentIds(userId)` and `guardianLinkedStudents(userId)` — extracted from `studentExams.ts`; the class lookup lives in `lib/familyScheduleLoad.ts` rather than a separate `classIdsForStudents`.

3. In Part 0 item 3, replace `with segments Schedule · Homework · Exams` with `showing the timetable, with a row to «اختباراتي»; Part 2 adds a Homework section (no segment control while there is one list and one link)`.

- [ ] **Step 3: Full verification**

Run, in order, from `/home/user/Iqraa`:

```bash
pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test && cd ../mobile && pnpm test
```

Expected: all green. Paste the final pass/fail counts into the PR description.

- [ ] **Step 4: Commit and push**

```bash
cd /home/user/Iqraa
git add STATUS.md docs/superpowers/specs/2026-10-11-family-school-views-design.md
git commit -m "$(cat <<'EOF'
docs: STATUS and spec for the family timetable

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
git push -u origin claude/brave-einstein-qxpxc3
```

Then retitle PR #1007 to "Family School tab: foundation + weekly timetable (design + Parts 0–1)" and extend its description with the Known limitation section above and a note that the signed-in family path was not run against a database.

---

## Self-review

**Spec coverage.** Part 0 — shared access helper (Task 2), child grouping/picker (Tasks 1, 6), School tab + allowlist + i18n (Task 6). Part 1 — read-only routes behind existing guards with mount-order coverage (Task 4), assembly from slots with per-teacher times and explicit empty state (Tasks 3, 6), pure logic tested. Not in this plan, by design: the teacher-side "N periods in this class's timetable" hint from the spec's Part 1 (no teacher screen change was needed to ship the family view; it is a candidate for the next plan) and the Homework/Exams segments (Part 2/3).

**Placeholder scan.** No TBD/TODO. Two steps are deliberately procedural rather than literal: Task 2 Step 4 (delete exactly the imports the compiler flags — which ones depends on the file) and Task 7 Step 1 (insert position in a 1 MB file located by grep); both name the exact command and the exact text to insert.

**Type consistency.** `GuardianLink`/`ChildGroup` (Task 1) are consumed unchanged in Tasks 2 and 4. `FamilySchedule`/`FamilyPeriod`/`FamilyDay` have identical shapes server-side (Task 3) and client-side (Task 5). `WEEKDAY_KEYS` entries (`schoolDaySun`…`schoolDaySat`) match the i18n keys added in Task 6. `loadFamilySchedule(studentIds: string[])` matches both call sites in Task 4. Route response shapes (`{ schedule }`, `{ children: [{ key, displayName, schedule }] }`) match the fetchers in Task 5.
