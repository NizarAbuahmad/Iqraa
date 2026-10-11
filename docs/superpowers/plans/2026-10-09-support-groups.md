# Support Groups (مجموعات الدعم) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Name the students under 60% on each of a class's objectives, and give each group a remedial worksheet and a quick re-check that only its members can sit, with each member's re-check outcome on the card.

**Architecture:** Groups are derived live from marks by a pure `supportGroups()` behind `GET /classes/:id/support-groups`. Only a re-check's audience is stored, as student rows in the existing `evaluation_assignments` table. A pure `audience.ts` decides who may see, claim, or be entered for an evaluation, and every student-facing path applies it. The app adds a «مجموعات الدعم» section to the class screen's exams tab and a member tick list to the quick-check screen.

**Tech Stack:** Express + Drizzle (api-server), Postgres migrations (drizzle-kit), Expo/React Native + react-query (mobile), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-09-support-groups-design.md`

## Global Constraints

- Weak = below 60%, the student record's rule exactly: marks-weighted across all of the student's marked papers in this class (provisional counted, archived evaluations counted, drafts excluded).
- An evaluation with any student-level `evaluation_assignments` row is a group check; its audience is exactly those students. No rows ⇒ whole class, exactly as today.
- Outcome on a group check: `passed` = a marked attempt (graded or needs_review) ≥ 60% on the check; `still_weak` = marked < 60%; `not_yet` = no marked attempt. Only assignees still in the class are listed.
- The audience is set only while the evaluation is a draft and attached to a class; every id must be a live, non-archived member of that class; non-empty; no duplicates.
- A non-assignee never sees a group check in «اختباراتي», is not on its share-link roster, cannot claim it (403 `not_in_group`), cannot be entered for it by the teacher (403 `not_in_group`), is not shown it as «لم يقدّمه» in their record, and is never gated by it in lesson progress. Anyone already holding an attempt still sees it.
- The remedial worksheet opens `/ai-tools/worksheet` through `worksheetAction` (the lesson's own grade/subject via `lessonPickerParams`); hidden when the lesson is unknown.
- Schema ships as a migration: edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/`. Never `push` to production.
- Mobile tests live only in `artifacts/mobile/services/__tests__/`, run under bare `node --test`: no `react-native`/`expo-*` imports in tested modules; relative imports carry `.ts`.
- API tests: `cd artifacts/api-server && pnpm build && pnpm test`. Root: `pnpm run typecheck`.
- Analytics carry no student name or id.
- Commit trailer (every commit):
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_011Rg5JbiuZf4G2rgVUfhsd2`

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/db/src/schema/attempts.ts` | unique `(evaluation_id, student_id)` on `evaluation_assignments` |
| `lib/db/migrations/0001_*.sql` (+ meta) | generated migration |
| `artifacts/api-server/src/modules/assessment/audience.ts` | pure: audience, visibility, audience-request decision |
| `artifacts/api-server/src/lib/evaluationAudience.ts` | DB: read and replace student assignments |
| `artifacts/api-server/src/modules/assessment/supportGroups.ts` | pure: groups, members, latest/draft check, outcomes |
| `artifacts/api-server/src/routes/evaluations.ts` | `PUT /evaluations/:id/audience`; `audience` on GET; teacher-entry gate; class change refused on a group check |
| `artifacts/api-server/src/routes/studentExams.ts` | exam list + progress gate respect the audience |
| `artifacts/api-server/src/routes/studentAttempt.ts` | link roster + claim respect the audience |
| `artifacts/api-server/src/routes/roster.ts` | `GET /classes/:id/support-groups`; record drops other groups' checks |
| `artifacts/mobile/services/supportGroups.ts` | pure: types, card helpers, param parsing, labels |
| `artifacts/mobile/services/roster.ts`, `services/evaluations.ts` | client calls |
| `artifacts/mobile/app/evaluations/mini.tsx` | member tick list + audience call |
| `artifacts/mobile/app/evaluations/[id]/index.tsx`, `[id]/answers/index.tsx` | group label; marking list limited to the group |
| `artifacts/mobile/components/classes/SupportGroupsSection.tsx` | the cards |
| `artifacts/mobile/app/classes/[id]/index.tsx` | load + render the section |
| `artifacts/mobile/services/i18n.ts` | strings |

---

### Task 1: Migration and the pure audience rule

**Files:**
- Modify: `lib/db/src/schema/attempts.ts` (the `evaluationAssignments` table's index list, ~line 61)
- Create (generated): `lib/db/migrations/0001_*.sql`, updated `lib/db/migrations/meta/*`
- Create: `artifacts/api-server/src/modules/assessment/audience.ts`
- Create: `artifacts/api-server/src/lib/evaluationAudience.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/audience.test.ts`

**Interfaces:**
- Produces:
  - `type Audience = { kind: "class" } | { kind: "students"; ids: ReadonlySet<string> }`
  - `audienceFor(assigned: readonly string[] | undefined): Audience`
  - `inAudience(audience: Audience, studentId: string): boolean`
  - `examVisibleTo(assigned: readonly string[] | undefined, studentIds: readonly string[], held: boolean): boolean`
  - `audienceRequestDecision(input: { status: string; classGroupId: string | null; studentIds: unknown; memberIds: ReadonlySet<string> }): { ok: true; studentIds: string[] } | { ok: false; status: 400 | 409; code: string; error: string }`
  - `assignedStudentsByEvaluation(evaluationIds: readonly string[]): Promise<Map<string, string[]>>`
  - `evaluationAudience(evaluationId: string): Promise<Audience>`
  - `replaceEvaluationAudience(evaluationId: string, studentIds: readonly string[], assignedBy: string): Promise<void>`

- [ ] **Step 1: Schema.** In `lib/db/src/schema/attempts.ts`, change the `evaluationAssignments` table's last argument from

```ts
  t => [index("evaluation_assignments_eval_idx").on(t.evaluationId)],
```

to

```ts
  t => [
    index("evaluation_assignments_eval_idx").on(t.evaluationId),
    // A student is assigned to an evaluation once. Class-level rows leave
    // student_id null, and Postgres treats nulls as distinct, so they are
    // unaffected.
    unique("evaluation_assignments_eval_student_unique").on(t.evaluationId, t.studentId),
  ],
```

(`unique` is already imported from `drizzle-orm/pg-core` in this file.)

- [ ] **Step 2: Generate the migration.** Run `pnpm --filter @workspace/db run generate`. Expected: a new `lib/db/migrations/0001_<name>.sql` containing `ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_eval_student_unique" UNIQUE("evaluation_id","student_id");` and updated `meta/_journal.json` plus `meta/0001_snapshot.json`. Run it again: it must report nothing new. Do not hand-edit the SQL. Do not run `push`.

- [ ] **Step 3: Failing test.** Create `artifacts/api-server/src/modules/assessment/__tests__/audience.test.ts`:

```ts
/**
 * Who an evaluation is for. A group check (support groups, 2026-10-09) is
 * for exactly the students assigned to it; everything else is for the class,
 * as before. Holding an attempt always keeps an exam visible.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { audienceFor, audienceRequestDecision, examVisibleTo, inAudience } from "../audience.ts";

describe("audienceFor / inAudience", () => {
  it("is the whole class when nobody is assigned", () => {
    assert.deepEqual(audienceFor(undefined), { kind: "class" });
    assert.deepEqual(audienceFor([]), { kind: "class" });
    assert.equal(inAudience(audienceFor([]), "anyone"), true);
  });
  it("is exactly the assigned students otherwise", () => {
    const a = audienceFor(["s1", "s2"]);
    assert.equal(a.kind, "students");
    assert.equal(inAudience(a, "s1"), true);
    assert.equal(inAudience(a, "s3"), false);
  });
});

describe("examVisibleTo", () => {
  it("shows a class exam to any member and a group check only to its members", () => {
    assert.equal(examVisibleTo(undefined, ["s9"], false), true);
    assert.equal(examVisibleTo(["s1"], ["s1"], false), true);
    assert.equal(examVisibleTo(["s1"], ["s9"], false), false);
  });
  it("matches any of several linked roster rows", () => {
    assert.equal(examVisibleTo(["s2"], ["s1", "s2"], false), true);
  });
  it("keeps an exam the student already holds an attempt on", () => {
    assert.equal(examVisibleTo(["s1"], ["s9"], true), true);
  });
});

describe("audienceRequestDecision", () => {
  const base = { status: "draft", classGroupId: "c1", memberIds: new Set(["s1", "s2"]) };
  it("accepts members of a draft attached to a class", () => {
    assert.deepEqual(audienceRequestDecision({ ...base, studentIds: ["s1", "s2"] }), { ok: true, studentIds: ["s1", "s2"] });
  });
  it("refuses an empty, malformed or duplicated list", () => {
    for (const studentIds of [[], undefined, "s1", [1], ["s1", "s1"], ["s1", " "]]) {
      const d = audienceRequestDecision({ ...base, studentIds });
      assert.equal(d.ok, false);
      if (!d.ok) assert.equal(d.status, 400);
    }
  });
  it("refuses once published, and without a class", () => {
    const published = audienceRequestDecision({ ...base, status: "published", studentIds: ["s1"] });
    assert.equal(published.ok, false);
    if (!published.ok) { assert.equal(published.status, 409); assert.equal(published.code, "audience_locked"); }
    const noClass = audienceRequestDecision({ ...base, classGroupId: null, studentIds: ["s1"] });
    assert.equal(noClass.ok, false);
    if (!noClass.ok) { assert.equal(noClass.status, 409); assert.equal(noClass.code, "audience_no_class"); }
  });
  it("refuses a student who is not a live member of the class", () => {
    const d = audienceRequestDecision({ ...base, studentIds: ["s1", "s3"] });
    assert.equal(d.ok, false);
    if (!d.ok) { assert.equal(d.status, 400); assert.equal(d.code, "audience_not_member"); }
  });
});
```

- [ ] **Step 4: Run, watch fail.** `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/audience.test.ts`. Expected: FAIL, module `../audience.ts` not found.

- [ ] **Step 5: Implement** `artifacts/api-server/src/modules/assessment/audience.ts`:

```ts
/**
 * Who an evaluation is for.
 *
 * A group check (support groups, 2026-10-09) is assigned to particular students
 * through `evaluation_assignments` rows with `student_id` set; it is for those
 * students and nobody else. An evaluation with no such rows is for its class,
 * read at request time — which is every evaluation that existed before.
 *
 * Pure: routes fetch the assigned ids and ask here. Every student-facing path
 * (exam list, share link, claim, teacher entry, the record, the mastery gate)
 * uses the same answer, so they cannot drift apart.
 */
export type Audience = { kind: "class" } | { kind: "students"; ids: ReadonlySet<string> };

export function audienceFor(assigned: readonly string[] | undefined): Audience {
  return assigned && assigned.length > 0 ? { kind: "students", ids: new Set(assigned) } : { kind: "class" };
}

export function inAudience(audience: Audience, studentId: string): boolean {
  return audience.kind === "class" || audience.ids.has(studentId);
}

/**
 * Whether a student (any of an account's linked roster rows) should see an
 * exam. Holding an attempt always wins: a sitting already started is theirs.
 */
export function examVisibleTo(
  assigned: readonly string[] | undefined,
  studentIds: readonly string[],
  held: boolean,
): boolean {
  if (held) return true;
  const audience = audienceFor(assigned);
  return studentIds.some(id => inAudience(audience, id));
}

export type AudienceDecision =
  | { ok: true; studentIds: string[] }
  | { ok: false; status: 400 | 409; code: string; error: string };

/**
 * `PUT /evaluations/:id/audience`. `memberIds` is the subset of the requested
 * ids that are live, non-archived members of the evaluation's class (the route
 * looks them up). The audience is fixed once students can start, so only a
 * draft accepts one.
 */
export function audienceRequestDecision(input: {
  status: string;
  classGroupId: string | null;
  studentIds: unknown;
  memberIds: ReadonlySet<string>;
}): AudienceDecision {
  const raw = input.studentIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, status: 400, code: "audience_empty", error: "studentIds must be a non-empty list" };
  }
  const ids = raw.map(v => (typeof v === "string" ? v.trim() : ""));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    return { ok: false, status: 400, code: "audience_invalid", error: "studentIds must be distinct student ids" };
  }
  if (input.status !== "draft") {
    return { ok: false, status: 409, code: "audience_locked", error: "The group is fixed once the check is published" };
  }
  if (!input.classGroupId) {
    return { ok: false, status: 409, code: "audience_no_class", error: "Attach the check to a class first" };
  }
  if (ids.some(id => !input.memberIds.has(id))) {
    return { ok: false, status: 400, code: "audience_not_member", error: "Every student must be in this class" };
  }
  return { ok: true, studentIds: ids };
}
```

- [ ] **Step 6: Implement** `artifacts/api-server/src/lib/evaluationAudience.ts`:

```ts
/**
 * Reading and writing a group check's audience: the student-level rows of
 * `evaluation_assignments`. Class-level rows (`class_group_id` set) are not
 * written by anything and are ignored here; an evaluation's class is still
 * `evaluations.class_group_id`. See modules/assessment/audience.ts for the rule.
 */
import { db, evaluationAssignments } from "@workspace/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { audienceFor, type Audience } from "../modules/assessment/audience.ts";

export async function assignedStudentsByEvaluation(
  evaluationIds: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (evaluationIds.length === 0) return out;
  const rows = await db
    .select({ evaluationId: evaluationAssignments.evaluationId, studentId: evaluationAssignments.studentId })
    .from(evaluationAssignments)
    .where(and(inArray(evaluationAssignments.evaluationId, [...evaluationIds]), isNotNull(evaluationAssignments.studentId)));
  for (const r of rows) {
    if (!r.studentId) continue;
    const list = out.get(r.evaluationId) ?? [];
    list.push(r.studentId);
    out.set(r.evaluationId, list);
  }
  return out;
}

export async function evaluationAudience(evaluationId: string): Promise<Audience> {
  return audienceFor((await assignedStudentsByEvaluation([evaluationId])).get(evaluationId));
}

/** Replace the student-level rows in one transaction. */
export async function replaceEvaluationAudience(
  evaluationId: string,
  studentIds: readonly string[],
  assignedBy: string,
): Promise<void> {
  await db.transaction(async tx => {
    await tx
      .delete(evaluationAssignments)
      .where(and(eq(evaluationAssignments.evaluationId, evaluationId), isNotNull(evaluationAssignments.studentId)));
    if (studentIds.length > 0) {
      await tx.insert(evaluationAssignments).values(
        studentIds.map(studentId => ({ evaluationId, studentId, assignedBy })),
      );
    }
  });
}
```

Check `evaluationAssignments` is exported from `@workspace/db` (it is declared in `lib/db/src/schema/attempts.ts`; confirm with `grep -n "attempts" lib/db/src/schema/index.ts`). If `db.transaction` is not used anywhere else in api-server, it is still the Drizzle node-postgres API; keep it.

- [ ] **Step 7: Pass.** The audience test passes; `cd artifacts/api-server && pnpm build && pnpm test` 0 fail; root `pnpm run typecheck` 0 errors.

- [ ] **Step 8: Commit.**

```bash
git add lib/db/src/schema/attempts.ts lib/db/migrations artifacts/api-server/src/modules/assessment/audience.ts artifacts/api-server/src/modules/assessment/__tests__/audience.test.ts artifacts/api-server/src/lib/evaluationAudience.ts
git commit -m "feat(api): who an evaluation is for — group-check audience rule and migration 0001"
```

---

### Task 2: Evaluation routes — set the audience, expose it, gate teacher entry

**Files:**
- Modify: `artifacts/api-server/src/routes/evaluations.ts` (`GET /evaluations/:id` ~line 346; `PATCH /evaluations/:id` ~line 376; `POST /evaluations/:id/attempts` ~line 1514; new route after `PATCH`)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`

**Interfaces:**
- Consumes (Task 1): `audienceRequestDecision`, `inAudience`, `assignedStudentsByEvaluation`, `evaluationAudience`, `replaceEvaluationAudience`.
- Produces:
  - `GET /evaluations/:id` → adds `audience: string[] | null` (null = whole class).
  - `PUT /evaluations/:id/audience` body `{ studentIds: string[] }` → `200 { audience: string[] }`; errors per `audienceRequestDecision`, 404 when not owned.
  - `POST /evaluations/:id/attempts` → `403 { code: "not_in_group" }` for a non-assignee of a group check.
  - `PATCH /evaluations/:id` → `409 { code: "audience_class_locked" }` when the evaluation has student assignments and the class would change.

- [ ] **Step 1: Failing mount test.** In `mountOrder.test.ts`, after the case "mounts the student record inside the roster's guarded prefix", add:

```ts
  it("mounts the group-check audience inside the evaluations guard", async () => {
    // A student list on an exam decides who may sit it; it must never be
    // writable without a teacher token.
    const id = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${base}/evaluations/${id}/audience`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentIds: [id] }),
    });
    assert.equal(res.status, 401, "setting who may sit an exam must require a token");
  });
```

(It passes before the route exists, because the `/evaluations` guard answers 401 for the whole prefix. It pins the guard for the new path. This is accepted, as for the student record.)

- [ ] **Step 2: Imports.** In `routes/evaluations.ts` add:

```ts
import { audienceRequestDecision, inAudience } from "../modules/assessment/audience.ts";
import {
  assignedStudentsByEvaluation,
  evaluationAudience,
  replaceEvaluationAudience,
} from "../lib/evaluationAudience.ts";
```

and add `isNull` is already imported; also import `classMemberships` and `students` (already in the `@workspace/db` import list).

- [ ] **Step 3: `audience` on GET.** Replace the body of `router.get("/evaluations/:id", …)`'s success path:

```ts
    // Teacher view — answers and rubrics included. The student projection is a
    // different endpoint entirely, so the two cannot be confused.
    const assigned = (await assignedStudentsByEvaluation([row.id])).get(row.id);
    res.json({ evaluation: row, questions: await liveQuestions(row.id), audience: assigned ?? null });
```

- [ ] **Step 4: Refuse a class change on a group check.** In `router.patch("/evaluations/:id", …)`, after the `findLiveClass` check and before the update, insert:

```ts
    // A group check's students were checked against this class when it was
    // set; moving it would leave an audience of students who are not in the
    // new class. Re-attaching to the same class is a no-op and allowed.
    if ((classGroupId || null) !== evaluation.classGroupId) {
      const assigned = (await assignedStudentsByEvaluation([evaluation.id])).get(evaluation.id);
      if (assigned && assigned.length > 0) {
        res.status(409).json({ error: "This check is for a group in its class", code: "audience_class_locked" });
        return;
      }
    }
```

- [ ] **Step 5: The audience route.** Directly after the `PATCH /evaluations/:id` handler, add:

```ts
/**
 * Who a group check is for (support groups, 2026-10-09): replaces the
 * evaluation's student-level assignments. Only while it is a draft attached to
 * a class, and only with live members of that class — see audience.ts.
 */
router.put("/evaluations/:id/audience", async (req: AuthenticatedRequest, res) => {
  try {
    const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
    const requested = Array.isArray(req.body?.studentIds)
      ? (req.body.studentIds as unknown[]).filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean)
      : [];
    const members = evaluation.classGroupId && requested.length
      ? await db
          .select({ id: students.id })
          .from(classMemberships)
          .innerJoin(students, eq(students.id, classMemberships.studentId))
          .where(
            and(
              eq(classMemberships.classGroupId, evaluation.classGroupId),
              inArray(classMemberships.studentId, requested),
              eq(students.teacherId, req.user!.id),
              isNull(students.archivedAt),
            ),
          )
      : [];
    const decision = audienceRequestDecision({
      status: evaluation.status,
      classGroupId: evaluation.classGroupId,
      studentIds: req.body?.studentIds,
      memberIds: new Set(members.map(m => m.id)),
    });
    if (!decision.ok) {
      res.status(decision.status).json({ error: decision.error, code: decision.code });
      return;
    }
    await replaceEvaluationAudience(evaluation.id, decision.studentIds, req.user!.id);
    res.json({ audience: decision.studentIds });
  } catch (err) {
    logger.error({ err }, "set evaluation audience failed");
    res.status(500).json({ error: "Failed to set who this check is for" });
  }
});
```

- [ ] **Step 6: Gate teacher entry.** In `router.post("/evaluations/:id/attempts", …)`, after the `if (existing) { … return; }` block and before `const questions = await liveQuestions(evaluation.id);`, insert:

```ts
    // A group check is for its group only — the same rule the share link and
    // the student's own list apply (audience.ts).
    if (!inAudience(await evaluationAudience(evaluation.id), studentId)) {
      res.status(403).json({ error: "This check is for a group; this student is not in it", code: "not_in_group" });
      return;
    }
```

- [ ] **Step 7: Verify.** `cd artifacts/api-server && pnpm build && pnpm test` 0 fail (includes the new mount case and Task 1's tests); root `pnpm run typecheck` 0 errors.

- [ ] **Step 8: Commit.**

```bash
git add artifacts/api-server/src/routes/evaluations.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -m "feat(api): set a group check's students; teacher entry and class moves respect them"
```

---

### Task 3: Student-facing paths respect the audience

**Files:**
- Modify: `artifacts/api-server/src/routes/studentExams.ts` (`examRowsFor` ~line 173; `/student/progress` `openExams` ~line 320)
- Modify: `artifacts/api-server/src/routes/studentAttempt.ts` (`GET /take/:code` ~line 196; `claimAttemptFor` ~line 243)
- Modify: `artifacts/api-server/src/routes/roster.ts` (record route rows, ~line 357–385)

**Interfaces:**
- Consumes (Task 1): `examVisibleTo`, `inAudience`, `assignedStudentsByEvaluation`, `evaluationAudience`.
- Produces: no new exports; behaviour per Global Constraints.

- [ ] **Step 1: Exam list.** In `routes/studentExams.ts` add imports:

```ts
import { examVisibleTo } from "../modules/assessment/audience.ts";
import { assignedStudentsByEvaluation } from "../lib/evaluationAudience.ts";
```

In `examRowsFor`, directly after the `const exams = await db.select({...}).from(evaluations).where(where);` statement, insert:

```ts
  // A group check is listed only for its students (support groups); a sitting
  // the student already holds keeps it listed whatever the group.
  const assignedByExam = await assignedStudentsByEvaluation(exams.map(e => e.id));
  const heldIds = new Set(heldEvaluationIds);
  const visibleExams = exams.filter(e => examVisibleTo(assignedByExam.get(e.id), studentIds, heldIds.has(e.id)));
```

and change the later `const rows = exams` to `const rows = visibleExams`.

- [ ] **Step 2: Progress gate.** In `/student/progress`, change the `openExams` select to include the id, and filter by audience:

```ts
    const openExamRows = classIds.length
      ? (
          await db
            .select({
              id: evaluations.id,
              objectiveIds: evaluations.objectiveIds,
              shareCodeExpiresAt: evaluations.shareCodeExpiresAt,
            })
            .from(evaluations)
            .where(and(inArray(evaluations.classGroupId, [...new Set(classIds)]), eq(evaluations.status, "published")))
        ).filter(e => !e.shareCodeExpiresAt || e.shareCodeExpiresAt.getTime() > now.getTime())
      : [];
    // A group check never holds back a student outside the group.
    const openAssigned = await assignedStudentsByEvaluation(openExamRows.map(e => e.id));
    const openExams = openExamRows.filter(e => examVisibleTo(openAssigned.get(e.id), studentIds, false));
```

(replacing the existing `const openExams = …` statement; the code after it keeps using `openExams`).

- [ ] **Step 3: Share-link roster.** In `routes/studentAttempt.ts` add imports:

```ts
import { inAudience } from "../modules/assessment/audience.ts";
import { evaluationAudience } from "../lib/evaluationAudience.ts";
```

In `router.get("/take/:code", …)`, after the `roster` query, insert:

```ts
    // A group check's link lists its group only: the names behind a link are
    // the one thing it exposes, and a group check must not expose the class.
    const audience = await evaluationAudience(evaluation.id);
    const shown = roster.filter(s => inAudience(audience, s.id));
```

and change `students: roster.map(s => ({ ...s, taken: taken.has(s.id) })),` to `students: shown.map(s => ({ ...s, taken: taken.has(s.id) })),`.

- [ ] **Step 4: Claim.** At the top of `claimAttemptFor` (before the `existing` lookup), insert:

```ts
  // Both claim paths (tap-a-name and signed-in self) come through here, so the
  // group rule is enforced once. Resuming an attempt already held never
  // reaches this function.
  if (!inAudience(await evaluationAudience(evaluation.id), member.id)) {
    res.status(403).json({ error: "This check is for a group in your class", code: "not_in_group" });
    return;
  }
```

- [ ] **Step 5: The student record.** In `routes/roster.ts` add imports:

```ts
import { examVisibleTo } from "../modules/assessment/audience.ts";
import { assignedStudentsByEvaluation } from "../lib/evaluationAudience.ts";
```

In the record route, after the `rows` query and before `const [guardian]`, insert:

```ts
    // Another group's check is not this student's paper: leave it out rather
    // than listing it as «لم يقدّمه». One they hold an attempt on stays.
    const assignedByExam = await assignedStudentsByEvaluation([...new Set(rows.map(r => r.evaluationId))]);
    const ownRows = rows.filter(r => examVisibleTo(assignedByExam.get(r.evaluationId), [studentId], r.attemptId !== null));
```

and pass `ownRows` instead of `rows` to `studentRecord(...)`.

- [ ] **Step 6: Verify.** `cd artifacts/api-server && pnpm build && pnpm test` 0 fail; root `pnpm run typecheck` 0 errors. The api-server has no database-backed route tests (its route suite boots the built bundle without a database), so the spec's per-gate route tests are carried as: the decision logic in Task 1's tested `examVisibleTo`/`inAudience`, plus each gate exercised against a real database in Task 8's running-app check.

- [ ] **Step 7: Commit.**

```bash
git add artifacts/api-server/src/routes/studentExams.ts artifacts/api-server/src/routes/studentAttempt.ts artifacts/api-server/src/routes/roster.ts
git commit -m "feat(api): a group check reaches only its group — list, link, claim, record, gate"
```

---

### Task 4: `supportGroups()` and its route

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/supportGroups.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/supportGroups.test.ts`
- Modify: `artifacts/api-server/src/routes/roster.ts` (new route after the record route)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`

**Interfaces:**
- Consumes: `aggregateClass` (`classInsights.ts`), `ObjectiveScore` (`scoring.ts`), `ObjectiveInfo` (`studentRecord.ts`), Task 1's `assignedStudentsByEvaluation` is not needed (the route joins directly).
- Produces:

```ts
export type CheckOutcome = "passed" | "still_weak" | "not_yet";
export interface SupportGroup {
  objectiveId: string; titleAr: string; lessonId: string | null; lessonTitleAr: string;
  classPercent: number;
  members: { studentId: string; displayName: string; percent: number }[];
  latestCheck: null | {
    evaluationId: string; title: string; status: "published" | "closed"; createdAt: string;
    outcomes: { studentId: string; displayName: string; outcome: CheckOutcome; percent: number | null }[];
  };
  draftCheck: null | { evaluationId: string };
}
export function supportGroups(input: SupportGroupsInput, describe: (objectiveId: string) => ObjectiveInfo | null): SupportGroup[];
```

  Route `GET /classes/:id/support-groups` → `{ groups: SupportGroup[] }`.

- [ ] **Step 1: Failing test.** Create `artifacts/api-server/src/modules/assessment/__tests__/supportGroups.test.ts`:

```ts
/**
 * Support groups: who is under 60% on each objective (the student record's
 * marks-weighted rule), and how each member did on the group's latest check.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { supportGroups, type SupportGroupsInput } from "../supportGroups.ts";
import type { ObjectiveInfo } from "../studentRecord.ts";
import type { ObjectiveScore } from "../scoring.ts";

function o(objectiveId: string, earned: number, total: number): ObjectiveScore {
  return { objectiveId, earned, total, percent: total > 0 ? (earned / total) * 100 : 0,
    questionCount: 1, marksLost: total - earned, bloomsRank: 2 };
}
const describeAll = (id: string): ObjectiveInfo | null =>
  ({ titleAr: `هدف ${id}`, lessonId: id === "oX" ? null : `kbl-${id}`, lessonTitleAr: `درس ${id}` });

const members = [
  { studentId: "s1", displayName: "أحمد" },
  { studentId: "s2", displayName: "ليلى" },
  { studentId: "s3", displayName: "عمر" },
];

function input(over: Partial<SupportGroupsInput>): SupportGroupsInput {
  return { members, papers: [], checks: [], checkAttempts: [], ...over };
}

describe("supportGroups — members", () => {
  it("lists students under 60% marks-weighted across papers, weakest first", () => {
    const groups = supportGroups(input({
      papers: [
        { studentId: "s1", objectiveScores: [o("oA", 1, 5)] },
        { studentId: "s1", objectiveScores: [o("oA", 4, 5)] },   // s1: 5/10 = 50%
        { studentId: "s2", objectiveScores: [o("oA", 1, 10)] },  // s2: 10%
        { studentId: "s3", objectiveScores: [o("oA", 9, 10)] },  // s3: 90%
      ],
    }), describeAll);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]!.members.map(m => [m.studentId, m.percent]), [["s2", 10], ["s1", 50]]);
    assert.equal(groups[0]!.classPercent, 50); // 15/30
    assert.equal(groups[0]!.lessonId, "kbl-oA");
  });
  it("ignores papers with no breakdown and students no longer in the class", () => {
    const groups = supportGroups(input({
      papers: [
        { studentId: "s1", objectiveScores: [] },
        { studentId: "gone", objectiveScores: [o("oA", 0, 5)] },
      ],
    }), describeAll);
    assert.deepEqual(groups, []);
  });
  it("orders groups by member count, then lowest class percent", () => {
    const groups = supportGroups(input({
      papers: [
        { studentId: "s1", objectiveScores: [o("oA", 2, 5), o("oB", 1, 5)] },
        { studentId: "s2", objectiveScores: [o("oA", 2, 5), o("oB", 5, 5)] },
        { studentId: "s3", objectiveScores: [o("oC", 0, 5)] },
      ],
    }), describeAll);
    assert.deepEqual(groups.map(g => g.objectiveId), ["oA", "oC", "oB"]);
  });
});

describe("supportGroups — the group's check", () => {
  const papers = [
    { studentId: "s1", objectiveScores: [o("oA", 1, 5)] },
    { studentId: "s2", objectiveScores: [o("oA", 1, 5)] },
    { studentId: "s3", objectiveScores: [o("oA", 1, 5)] },
  ];
  const check = (over: Partial<SupportGroupsInput["checks"][number]>) => ({
    evaluationId: "c1", title: "تحقق", status: "published" as const, archived: false,
    createdAt: new Date("2026-10-05T08:00:00Z"), objectiveIds: ["oA"], assignedStudentIds: ["s1", "s2", "s3"],
    ...over,
  });
  it("reports passed / still_weak / not_yet at the 60 line", () => {
    const [g] = supportGroups(input({
      papers,
      checks: [check({})],
      checkAttempts: [
        { evaluationId: "c1", studentId: "s1", attemptStatus: "graded", percent: "100.00", objectiveScores: [o("oA", 3, 3)] },
        { evaluationId: "c1", studentId: "s2", attemptStatus: "needs_review", percent: "33.33", objectiveScores: [o("oA", 1, 3)] },
        { evaluationId: "c1", studentId: "s3", attemptStatus: "in_progress", percent: null, objectiveScores: null },
      ],
    }), describeAll);
    assert.deepEqual(g!.latestCheck!.outcomes.map(x => [x.studentId, x.outcome]), [["s1", "passed"], ["s2", "still_weak"], ["s3", "not_yet"]]);
    assert.equal(g!.latestCheck!.outcomes[0]!.percent, 100);
    assert.equal(g!.latestCheck!.outcomes[2]!.percent, null);
  });
  it("uses the attempt's percent when the breakdown is empty, and 60 passes", () => {
    const [g] = supportGroups(input({
      papers, checks: [check({ assignedStudentIds: ["s1"] })],
      checkAttempts: [{ evaluationId: "c1", studentId: "s1", attemptStatus: "graded", percent: "60.00", objectiveScores: [] }],
    }), describeAll);
    assert.equal(g!.latestCheck!.outcomes[0]!.outcome, "passed");
  });
  it("takes the newest published check, never an archived one, and reports a draft separately", () => {
    const [g] = supportGroups(input({
      papers,
      checks: [
        check({ evaluationId: "old", createdAt: new Date("2026-10-01T08:00:00Z") }),
        check({ evaluationId: "new", createdAt: new Date("2026-10-03T08:00:00Z") }),
        check({ evaluationId: "arch", archived: true, createdAt: new Date("2026-10-04T08:00:00Z") }),
        check({ evaluationId: "draft", status: "draft", createdAt: new Date("2026-10-06T08:00:00Z") }),
        check({ evaluationId: "other", objectiveIds: ["oB"], createdAt: new Date("2026-10-07T08:00:00Z") }),
        check({ evaluationId: "multi", objectiveIds: ["oA", "oB"], createdAt: new Date("2026-10-08T08:00:00Z") }),
      ],
    }), describeAll);
    assert.equal(g!.latestCheck!.evaluationId, "new");
    assert.deepEqual(g!.draftCheck, { evaluationId: "draft" });
  });
  it("lists only assignees still in the class", () => {
    const [g] = supportGroups(input({
      papers, checks: [check({ assignedStudentIds: ["s1", "gone"] })],
    }), describeAll);
    assert.deepEqual(g!.latestCheck!.outcomes.map(x => x.studentId), ["s1"]);
  });
});
```

- [ ] **Step 2: Run, watch fail.** `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/supportGroups.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement** `artifacts/api-server/src/modules/assessment/supportGroups.ts`:

```ts
/**
 * Support groups (مجموعات الدعم): for each objective, the class members under
 * the 60% line, and how each did on the group's latest re-check.
 *
 * "Under the line" is the student record's rule exactly — `aggregateClass`
 * over one student's marked papers in this class, marks-weighted — so a name
 * on a card opens a record that agrees with it. A re-check outcome is read
 * off that check alone: a three-question check barely moves a cumulative
 * percentage, and "did they get it this time" is the teacher's question.
 *
 * Pure: the route fetches plain rows.
 */
import type { AttemptStatus } from "@workspace/db";
import { aggregateClass, STUDENT_GAP_PERCENT } from "./classInsights.ts";
import type { ObjectiveScore } from "./scoring.ts";
import type { ObjectiveInfo } from "./studentRecord.ts";

export type CheckOutcome = "passed" | "still_weak" | "not_yet";

export interface SupportGroupsInput {
  /** Live, non-archived members of the class. */
  members: { studentId: string; displayName: string }[];
  /** Every attempt result on a non-draft evaluation of this class (group checks included). */
  papers: { studentId: string; objectiveScores: unknown[] | null }[];
  /** Evaluations of this class with student-level assignments. */
  checks: {
    evaluationId: string; title: string; status: "draft" | "published" | "closed";
    archived: boolean; createdAt: Date; objectiveIds: string[]; assignedStudentIds: string[];
  }[];
  /** Attempts on those checks. */
  checkAttempts: {
    evaluationId: string; studentId: string; attemptStatus: AttemptStatus;
    percent: string | number | null; objectiveScores: unknown[] | null;
  }[];
}

export interface SupportGroup {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  classPercent: number;
  members: { studentId: string; displayName: string; percent: number }[];
  latestCheck: null | {
    evaluationId: string;
    title: string;
    status: "published" | "closed";
    createdAt: string;
    outcomes: { studentId: string; displayName: string; outcome: CheckOutcome; percent: number | null }[];
  };
  draftCheck: null | { evaluationId: string };
}

const MARKED: ReadonlySet<AttemptStatus> = new Set<AttemptStatus>(["graded", "needs_review"]);
const round2 = (n: number) => Math.round(n * 100) / 100;
const scoresOf = (v: unknown[] | null): ObjectiveScore[] => (v as ObjectiveScore[] | null) ?? [];

export function supportGroups(
  input: SupportGroupsInput,
  describe: (objectiveId: string) => ObjectiveInfo | null,
): SupportGroup[] {
  const names = new Map(input.members.map(m => [m.studentId, m.displayName]));

  // Per student, the same rollup the record uses.
  const papersByStudent = new Map<string, { objectiveScores: ObjectiveScore[] }[]>();
  for (const p of input.papers) {
    if (!names.has(p.studentId)) continue;
    const scores = scoresOf(p.objectiveScores);
    if (scores.length === 0) continue;
    const list = papersByStudent.get(p.studentId) ?? [];
    list.push({ objectiveScores: scores });
    papersByStudent.set(p.studentId, list);
  }

  const weakByObjective = new Map<string, { studentId: string; displayName: string; percent: number }[]>();
  const allMarked: { objectiveScores: ObjectiveScore[] }[] = [];
  for (const [studentId, papers] of papersByStudent) {
    allMarked.push(...papers);
    for (const s of aggregateClass(papers).objectiveScores) {
      if (s.percent >= STUDENT_GAP_PERCENT) continue;
      const list = weakByObjective.get(s.objectiveId) ?? [];
      list.push({ studentId, displayName: names.get(studentId)!, percent: s.percent });
      weakByObjective.set(s.objectiveId, list);
    }
  }
  const classPercent = new Map(aggregateClass(allMarked).objectiveScores.map(s => [s.objectiveId, s.percent]));

  const groups: SupportGroup[] = [];
  for (const [objectiveId, weak] of weakByObjective) {
    const forObjective = input.checks
      .filter(c => !c.archived && c.objectiveIds.length === 1 && c.objectiveIds[0] === objectiveId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.evaluationId.localeCompare(b.evaluationId));
    const latest = forObjective.find(c => c.status !== "draft") ?? null;
    const draft = forObjective.find(c => c.status === "draft") ?? null;
    const info = describe(objectiveId);
    groups.push({
      objectiveId,
      titleAr: info?.titleAr ?? objectiveId,
      lessonId: info?.lessonId ?? null,
      lessonTitleAr: info?.lessonTitleAr ?? "",
      classPercent: classPercent.get(objectiveId) ?? 0,
      members: [...weak].sort((a, b) => a.percent - b.percent || a.studentId.localeCompare(b.studentId)),
      latestCheck: latest
        ? {
            evaluationId: latest.evaluationId,
            title: latest.title,
            status: latest.status as "published" | "closed",
            createdAt: latest.createdAt.toISOString(),
            outcomes: latest.assignedStudentIds
              .filter(id => names.has(id))
              .map(id => outcomeFor(latest.evaluationId, objectiveId, id, names.get(id)!, input.checkAttempts)),
          }
        : null,
      draftCheck: draft ? { evaluationId: draft.evaluationId } : null,
    });
  }

  return groups.sort(
    (a, b) => b.members.length - a.members.length
      || a.classPercent - b.classPercent
      || a.objectiveId.localeCompare(b.objectiveId),
  );
}

function outcomeFor(
  evaluationId: string,
  objectiveId: string,
  studentId: string,
  displayName: string,
  attempts: SupportGroupsInput["checkAttempts"],
): { studentId: string; displayName: string; outcome: CheckOutcome; percent: number | null } {
  const attempt = attempts.find(a => a.evaluationId === evaluationId && a.studentId === studentId);
  if (!attempt || !MARKED.has(attempt.attemptStatus)) {
    return { studentId, displayName, outcome: "not_yet", percent: null };
  }
  const own = scoresOf(attempt.objectiveScores).find(s => s.objectiveId === objectiveId);
  const percent = own && own.total > 0
    ? round2((own.earned / own.total) * 100)
    : attempt.percent === null ? 0 : Number(attempt.percent);
  return { studentId, displayName, outcome: percent >= STUDENT_GAP_PERCENT ? "passed" : "still_weak", percent };
}
```

If `STUDENT_GAP_PERCENT` is not exported from `classInsights.ts`, add `export` to its declaration (line ~23: `const STUDENT_GAP_PERCENT = 60;` → `export const STUDENT_GAP_PERCENT = 60;`). Nothing else changes in that file.

- [ ] **Step 4: Pass.** The new test passes.

- [ ] **Step 5: The route.** In `routes/roster.ts`: add `evaluationAssignments` to the `@workspace/db` import list, `isNotNull` to the `drizzle-orm` import, and `import { supportGroups } from "../modules/assessment/supportGroups.ts";`. Directly after the student-record route add:

```ts
/**
 * Support groups (مجموعات الدعم): per objective, the class members under the
 * line and the group's latest re-check. Same access as the record.
 */
router.get("/classes/:id/support-groups", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const teacherId = req.user!.id;
    if (!isUuid(classId)) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    const group = await findLiveClass(classId, teacherId);
    if (!group) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const members = await db
      .select({ studentId: students.id, displayName: students.displayName })
      .from(classMemberships)
      .innerJoin(students, eq(students.id, classMemberships.studentId))
      .where(and(eq(classMemberships.classGroupId, classId), eq(students.teacherId, teacherId), isNull(students.archivedAt)));

    const papers = await db
      .select({ studentId: attempts.studentId, objectiveScores: attemptResults.objectiveScores })
      .from(attemptResults)
      .innerJoin(attempts, eq(attempts.id, attemptResults.attemptId))
      .innerJoin(evaluations, eq(evaluations.id, attempts.evaluationId))
      .where(and(eq(evaluations.classGroupId, classId), ne(evaluations.status, "draft")));

    const assignmentRows = await db
      .select({
        evaluationId: evaluations.id,
        title: evaluations.title,
        titleAr: evaluations.titleAr,
        status: evaluations.status,
        archivedAt: evaluations.archivedAt,
        createdAt: evaluations.createdAt,
        objectiveIds: evaluations.objectiveIds,
        studentId: evaluationAssignments.studentId,
      })
      .from(evaluationAssignments)
      .innerJoin(evaluations, eq(evaluations.id, evaluationAssignments.evaluationId))
      .where(and(eq(evaluations.classGroupId, classId), isNotNull(evaluationAssignments.studentId)));

    const checksById = new Map<string, Parameters<typeof supportGroups>[0]["checks"][number]>();
    for (const r of assignmentRows) {
      const c = checksById.get(r.evaluationId) ?? {
        evaluationId: r.evaluationId,
        title: r.titleAr || r.title,
        status: r.status,
        archived: r.archivedAt !== null,
        createdAt: r.createdAt,
        objectiveIds: (r.objectiveIds as string[] | null) ?? [],
        assignedStudentIds: [],
      };
      if (r.studentId) c.assignedStudentIds.push(r.studentId);
      checksById.set(r.evaluationId, c);
    }
    const checkIds = [...checksById.keys()];
    const checkAttempts = checkIds.length
      ? await db
          .select({
            evaluationId: attempts.evaluationId,
            studentId: attempts.studentId,
            attemptStatus: attempts.status,
            percent: attemptResults.percent,
            objectiveScores: attemptResults.objectiveScores,
          })
          .from(attempts)
          .leftJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
          .where(inArray(attempts.evaluationId, checkIds))
      : [];

    const groups = supportGroups(
      { members, papers, checks: [...checksById.values()], checkAttempts },
      objectiveId => {
        const o = getObjectiveById(objectiveId);
        return o
          ? { titleAr: o.descriptionAr || o.description, lessonId: o.lessonId, lessonTitleAr: o.lessonTitleAr || o.lessonTitle }
          : null;
      },
    );
    res.json({ groups });
  } catch (err) {
    failRoster(res, err, "support groups", "Failed to load support groups");
  }
});
```

(`evaluations.status` is typed `EvaluationStatus` = `"draft" | "published" | "closed"`, which matches the input type. `isUuid` is already imported in this file.)

- [ ] **Step 6: Mount test.** In `mountOrder.test.ts` after the record case:

```ts
  it("mounts support groups inside the roster's guarded prefix", async () => {
    const id = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${base}/classes/${id}/support-groups`);
    assert.equal(res.status, 401, "who is under the line in a class must require a token");
  });
```

- [ ] **Step 7: Verify.** `cd artifacts/api-server && pnpm build && pnpm test` 0 fail; root `pnpm run typecheck` 0 errors.

- [ ] **Step 8: Commit.**

```bash
git add artifacts/api-server/src/modules/assessment/supportGroups.ts artifacts/api-server/src/modules/assessment/__tests__/supportGroups.test.ts artifacts/api-server/src/modules/assessment/classInsights.ts artifacts/api-server/src/routes/roster.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -m "feat(api): GET /classes/:id/support-groups — who is under the line, and their re-check"
```

---

### Task 5: App service

**Files:**
- Create: `artifacts/mobile/services/supportGroups.ts`
- Test: `artifacts/mobile/services/__tests__/supportGroups.test.ts`
- Modify: `artifacts/mobile/services/studentRecord.ts` (`worksheetAction` parameter type only)
- Modify: `artifacts/mobile/services/roster.ts` (add `getSupportGroups`)
- Modify: `artifacts/mobile/services/evaluations.ts` (`getEvaluation` return type; add `setEvaluationAudience`)

**Interfaces:**
- Consumes: server shapes from Task 2 and Task 4.
- Produces:
  - types `CheckOutcome`, `SupportGroup` (as in Task 4)
  - `SUPPORT_GROUPS_SHOWN = 3`
  - `visibleGroups(groups: SupportGroup[], showAll: boolean): SupportGroup[]`
  - `outcomeKey(o: CheckOutcome): 'supportOutcomePassed' | 'supportOutcomeStillWeak' | 'supportOutcomeNotYet'`
  - `groupCheckAction(classId: string, g: SupportGroup)` → `{ pathname: '/evaluations/mini', params: { classId, objectiveId, studentIds } }`
  - `groupDraftAction(g: SupportGroup)` → `{ pathname: '/evaluations/[id]', params: { id } } | null`
  - `groupWorksheetAction(g: SupportGroup)` → `worksheetAction` result or null
  - `parseStudentIds(raw: string | string[] | undefined): string[]`
  - `filterToAudience<T extends { id: string }>(rows: T[], audience: string[] | null): T[]`
  - `groupSizeLabel(n: number, lang: 'ar' | 'en'): string`
  - `membersBelowLabel(n: number, lang: 'ar' | 'en'): string`
  - `getSupportGroups(classId: string): Promise<SupportGroup[]>` (roster.ts)
  - `setEvaluationAudience(evaluationId: string, studentIds: string[]): Promise<string[]>` (evaluations.ts)
  - `getEvaluation(id)` now resolves `{ evaluation, questions, audience: string[] | null }`

- [ ] **Step 1: Failing test.** Create `artifacts/mobile/services/__tests__/supportGroups.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_GROUPS_SHOWN, filterToAudience, groupCheckAction, groupDraftAction, groupSizeLabel,
  groupWorksheetAction, membersBelowLabel, outcomeKey, parseStudentIds, visibleGroups,
  type SupportGroup,
} from '../supportGroups.ts';
import { lessonPickerParams } from '../lessonPrep.ts';

const CHEM = 'kbl-chem-s1-nccd-u1_l1';
const MATH = 'kbl-math-s1-nccd-u1_l1';

function group(over: Partial<SupportGroup>): SupportGroup {
  return {
    objectiveId: 'o1', titleAr: 'هدف', lessonId: CHEM, lessonTitleAr: 'درس', classPercent: 40,
    members: [{ studentId: 's1', displayName: 'أحمد', percent: 30 }, { studentId: 's2', displayName: 'ليلى', percent: 50 }],
    latestCheck: null, draftCheck: null, ...over,
  };
}

describe('visibleGroups', () => {
  it('shows the first three until asked for all', () => {
    const groups = [1, 2, 3, 4, 5].map(i => group({ objectiveId: `o${i}` }));
    assert.equal(SUPPORT_GROUPS_SHOWN, 3);
    assert.equal(visibleGroups(groups, false).length, 3);
    assert.equal(visibleGroups(groups, true).length, 5);
  });
});

describe('card actions', () => {
  it('sends the group check to the quick check with the members', () => {
    assert.deepEqual(groupCheckAction('c1', group({})), {
      pathname: '/evaluations/mini', params: { classId: 'c1', objectiveId: 'o1', studentIds: 's1,s2' },
    });
  });
  it('opens an unfinished draft instead of a new check', () => {
    assert.equal(groupDraftAction(group({})), null);
    assert.deepEqual(groupDraftAction(group({ draftCheck: { evaluationId: 'e9' } })), {
      pathname: '/evaluations/[id]', params: { id: 'e9' },
    });
  });
  it("opens the worksheet on the lesson's own subject, and hides it without a lesson", () => {
    const chem = groupWorksheetAction(group({}))!;
    const math = groupWorksheetAction(group({ lessonId: MATH }))!;
    assert.equal(chem.params.subjectIdx, lessonPickerParams(CHEM, 'ar')!.subjectIdx);
    assert.notEqual(chem.params.subjectIdx, math.params.subjectIdx);
    assert.equal(groupWorksheetAction(group({ lessonId: null })), null);
  });
});

describe('parseStudentIds', () => {
  it('splits, trims, dedupes and drops empties', () => {
    assert.deepEqual(parseStudentIds(' s1, s2,,s1 '), ['s1', 's2']);
    assert.deepEqual(parseStudentIds(['s1,s2', 's3']), ['s1', 's2', 's3']);
    assert.deepEqual(parseStudentIds(undefined), []);
  });
});

describe('filterToAudience', () => {
  const rows = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  it('keeps everyone for a class exam and only the group for a group check', () => {
    assert.equal(filterToAudience(rows, null).length, 3);
    assert.deepEqual(filterToAudience(rows, ['s3', 's1']).map(r => r.id), ['s1', 's3']);
  });
});

describe('labels', () => {
  it('names each outcome', () => {
    assert.equal(outcomeKey('passed'), 'supportOutcomePassed');
    assert.equal(outcomeKey('still_weak'), 'supportOutcomeStillWeak');
    assert.equal(outcomeKey('not_yet'), 'supportOutcomeNotYet');
  });
  it('counts students in Arabic and English', () => {
    assert.equal(groupSizeLabel(1, 'ar'), 'للمجموعة: طالب واحد');
    assert.equal(groupSizeLabel(2, 'ar'), 'للمجموعة: طالبان');
    assert.equal(groupSizeLabel(5, 'ar'), 'للمجموعة: 5 طلاب');
    assert.equal(groupSizeLabel(1, 'en'), 'For the group: 1 student');
    assert.equal(membersBelowLabel(3, 'ar'), '3 طلاب دون 60%');
    assert.equal(membersBelowLabel(12, 'ar'), '12 طالبًا دون 60%');
    assert.equal(membersBelowLabel(2, 'en'), '2 students below 60%');
  });
});
```

- [ ] **Step 2: Run, watch fail.** `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/supportGroups.test.ts` → FAIL, module not found.

- [ ] **Step 3: Widen `worksheetAction`.** In `services/studentRecord.ts` change `export function worksheetAction(o: StudentRecordObjective) {` to `export function worksheetAction(o: Pick<StudentRecordObjective, 'lessonId'>) {`. Nothing else.

- [ ] **Step 4: Implement** `artifacts/mobile/services/supportGroups.ts`:

```ts
/**
 * Support groups (مجموعات الدعم) on the class screen — pure, so it runs under
 * the bare node test runner. The server decides who is in a group
 * (`supportGroups()` in api-server); this file only shapes cards and links.
 */
import { arCountPhrase } from './arCount.ts';
import { worksheetAction } from './studentRecord.ts';

export type CheckOutcome = 'passed' | 'still_weak' | 'not_yet';

export interface SupportGroup {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  classPercent: number;
  members: { studentId: string; displayName: string; percent: number }[];
  latestCheck: null | {
    evaluationId: string;
    title: string;
    status: 'published' | 'closed';
    createdAt: string;
    outcomes: { studentId: string; displayName: string; outcome: CheckOutcome; percent: number | null }[];
  };
  draftCheck: null | { evaluationId: string };
}

export const SUPPORT_GROUPS_SHOWN = 3;

export function visibleGroups(groups: SupportGroup[], showAll: boolean): SupportGroup[] {
  return showAll ? groups : groups.slice(0, SUPPORT_GROUPS_SHOWN);
}

export function outcomeKey(o: CheckOutcome): 'supportOutcomePassed' | 'supportOutcomeStillWeak' | 'supportOutcomeNotYet' {
  switch (o) {
    case 'passed': return 'supportOutcomePassed';
    case 'still_weak': return 'supportOutcomeStillWeak';
    case 'not_yet': return 'supportOutcomeNotYet';
  }
}

export function groupCheckAction(classId: string, g: SupportGroup) {
  return {
    pathname: '/evaluations/mini' as const,
    params: { classId, objectiveId: g.objectiveId, studentIds: g.members.map(m => m.studentId).join(',') },
  };
}

/** An unfinished group check for this objective: finish it, do not start another. */
export function groupDraftAction(g: SupportGroup) {
  return g.draftCheck ? { pathname: '/evaluations/[id]' as const, params: { id: g.draftCheck.evaluationId } } : null;
}

export function groupWorksheetAction(g: SupportGroup) {
  return worksheetAction({ lessonId: g.lessonId });
}

export function parseStudentIds(raw: string | string[] | undefined): string[] {
  const parts = (Array.isArray(raw) ? raw : [raw ?? ''])
    .flatMap(s => s.split(','))
    .map(s => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

/** A group check's marking list is its group; a class exam's is the class. */
export function filterToAudience<T extends { id: string }>(rows: T[], audience: string[] | null): T[] {
  if (!audience) return rows;
  const ids = new Set(audience);
  return rows.filter(r => ids.has(r.id));
}

function studentsAr(n: number): string {
  // arCountPhrase's 11+ branch reuses the singular («12 طالب واحد»); Arabic
  // takes the accusative singular there.
  return n >= 11 ? `${n} طالبًا` : arCountPhrase(n, 'طالب واحد', 'طالبان', 'طلاب');
}

export function groupSizeLabel(n: number, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? `للمجموعة: ${studentsAr(n)}` : `For the group: ${n} ${n === 1 ? 'student' : 'students'}`;
}

export function membersBelowLabel(n: number, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? `${studentsAr(n)} دون 60%` : `${n} ${n === 1 ? 'student' : 'students'} below 60%`;
}
```


- [ ] **Step 5: Client calls.** In `services/roster.ts` add (next to `getStudentRecord`), with `import type { SupportGroup } from './supportGroups';` at the top beside the `StudentRecord` type import:

```ts
export async function getSupportGroups(classId: string): Promise<SupportGroup[]> {
  const res = await apiFetch(`/classes/${classId}/support-groups`);
  return (await readJson<{ groups: SupportGroup[] }>(res, 'Loading support groups')).groups;
}
```

In `services/evaluations.ts` change `getEvaluation`'s return type to `Promise<{ evaluation: Evaluation; questions: EvaluationQuestion[]; audience: string[] | null }>` and add after `setEvaluationClass`:

```ts
/** Who a group check is for (support groups). Only while it is a draft. */
export async function setEvaluationAudience(evaluationId: string, studentIds: string[]): Promise<string[]> {
  const res = await apiFetch(`/evaluations/${evaluationId}/audience`, {
    method: 'PUT',
    body: JSON.stringify({ studentIds }),
  });
  return (await readJson<{ audience: string[] }>(res, 'Choosing the group')).audience;
}
```

(Use the same `readJson` / error type this file already uses for its other calls; if it is named differently there, use that one — check `setEvaluationClass` just above.)

- [ ] **Step 6: Pass.** The new test passes; `cd artifacts/mobile && pnpm test` 0 fail (10 pre-existing skips); root `pnpm run typecheck` 0 errors.

- [ ] **Step 7: Commit.**

```bash
git add artifacts/mobile/services/supportGroups.ts artifacts/mobile/services/__tests__/supportGroups.test.ts artifacts/mobile/services/studentRecord.ts artifacts/mobile/services/roster.ts artifacts/mobile/services/evaluations.ts
git commit -m "feat(mobile): support groups service — cards, links, group size labels, client calls"
```

---

### Task 6: Quick check for a group; group label; marking list

**Files:**
- Modify: `artifacts/mobile/app/evaluations/mini.tsx`
- Modify: `artifacts/mobile/app/evaluations/[id]/index.tsx` (hero, ~line 380)
- Modify: `artifacts/mobile/app/evaluations/[id]/answers/index.tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes (Task 5): `parseStudentIds`, `groupSizeLabel`, `filterToAudience`, `setEvaluationAudience`, `getEvaluation(...).audience`; `trackEvent` (`services/analytics.ts`).

- [ ] **Step 1: i18n.** Add to the Arabic block (next to `studentRecordTitle`):

```ts
    miniEvalWhoSits: 'من يقدّمه؟',
    miniEvalGroupNoneTicked: 'اختر طالبًا واحدًا على الأقل.',
    supportGroupAudienceFailed: 'تعذّر تحديد طلاب المجموعة. حاول مرة أخرى.',
    supportGroupClassFailed: 'تعذّر ربط التحقق بالصف. حاول مرة أخرى.',
```

and to the English block:

```ts
    miniEvalWhoSits: 'Who sits it?',
    miniEvalGroupNoneTicked: 'Choose at least one student.',
    supportGroupAudienceFailed: 'Could not set the group. Try again.',
    supportGroupClassFailed: 'Could not attach the check to the class. Try again.',
```

- [ ] **Step 2: Mini screen state.** In `mini.tsx`:
  - imports: add `setEvaluationAudience` to the `@/services/evaluations` import; add `import { groupSizeLabel, parseStudentIds } from '@/services/supportGroups';` and `import { trackEvent } from '@/services/analytics';`.
  - params: `const { classId, objectiveId: presetObjectiveId, studentIds: rawStudentIds } = useLocalSearchParams<{ classId?: string; objectiveId?: string; studentIds?: string }>();`
  - below the params: `const groupIds = useMemo(() => parseStudentIds(rawStudentIds), [rawStudentIds]);` and `const isGroup = groupIds.length > 0 && !!classId;`
  - state: `const [groupNames, setGroupNames] = useState<{ id: string; name: string }[]>([]);` and `const [ticked, setTicked] = useState<Set<string>>(() => new Set(groupIds));`
  - in the loading effect, the existing `const { group } = await getClass(classId);` becomes `const { group, students: roster } = await getClass(classId);` and right after it add:

```ts
          if (groupIds.length) {
            // Names from the class itself: an id in the link that is no longer
            // in the class is simply not offered.
            const inClass = roster.filter(s => groupIds.includes(s.id));
            setGroupNames(inClass.map(s => ({ id: s.id, name: s.displayName })));
            setTicked(new Set(inClass.map(s => s.id)));
          }
```

  and add `rawStudentIds` to that effect's dependency array.

- [ ] **Step 3: Create flow.** In `onGenerate`, replace the class-attach block

```ts
      if (classId) {
        try {
          await setEvaluationClass(evaluation.id, classId);
        } catch {
          // The evaluation exists and is worth keeping; the detail screen can
          // attach it. Losing the draft over this would be the worse trade.
        }
      }
```

with

```ts
      if (classId) {
        try {
          await setEvaluationClass(evaluation.id, classId);
        } catch {
          // The evaluation exists and is worth keeping; the detail screen can
          // attach it. Losing the draft over this would be the worse trade —
          // except for a group check, whose students are checked against the
          // class: without it the draft would be class-wide.
          if (isGroup) {
            setError(t('supportGroupClassFailed'));
            setWorking(false);
            return;
          }
        }
      }
      if (isGroup) {
        // Before generating: a failed audience must not leave a class-wide
        // draft behind with its questions already written.
        try {
          await setEvaluationAudience(evaluation.id, [...ticked]);
        } catch {
          setError(t('supportGroupAudienceFailed'));
          setWorking(false);
          return;
        }
        trackEvent('support_group_check_created', { members: ticked.size });
      }
```

  and add `isGroup, ticked` to the `useCallback` dependency list. At the top of `onGenerate`, after `if (!bookId || !objectiveId) return;`, add `if (isGroup && ticked.size === 0) { setError(t('miniEvalGroupNoneTicked')); return; }`.

- [ ] **Step 4: The tick list.** In the JSX, directly after the error box and before the book chooser, add:

```tsx
      {isGroup && groupNames.length > 0 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 8 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align }}>
            {t('miniEvalWhoSits')} · {groupSizeLabel(ticked.size, lang === 'ar' ? 'ar' : 'en')}
          </Text>
          {groupNames.map(s => {
            const on = ticked.has(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => setTicked(prev => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                  return next;
                })}
                accessibilityRole="checkbox"
                aria-checked={on}
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? ACCENT : colors.mutedForeground} />
                <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: align, flex: 1 }}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
```

  Check `aria-checked` against `services/__tests__/ariaState.test.ts` (it bans `accessibilityState=` and expects `aria-*`).

- [ ] **Step 5: Review screen label.** In `app/evaluations/[id]/index.tsx`: add `import { groupSizeLabel } from '@/services/supportGroups';`, after `const questions = data?.questions ?? [];` add `const audience = data?.audience ?? null;`, and inside the hero block after the `evalTotalMarks` `<Text>` add:

```tsx
            {audience ? (
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24 }}>
                {groupSizeLabel(audience.length, lang === 'ar' ? 'ar' : 'en')}
              </Text>
            ) : null}
```

  (`lang` comes from `useLanguage()`; add it to that destructure if it is not already there.)

- [ ] **Step 6: Marking list.** In `app/evaluations/[id]/answers/index.tsx`: import `getEvaluation` from `@/services/evaluations` and `filterToAudience` from `@/services/supportGroups`; add `const [audience, setAudience] = useState<string[] | null>(null);`; in the existing `useFocusEffect` that calls `listAttempts(id)`, also call `getEvaluation(id).then(d => setAudience(d.audience ?? null)).catch(() => {});`; and change the student `FlatList`'s `data={students}` to `data={filterToAudience(students, audience)}`.

- [ ] **Step 7: Verify.** `cd artifacts/mobile && pnpm test` 0 fail; root `pnpm run typecheck` 0 errors.

- [ ] **Step 8: Commit.**

```bash
git add artifacts/mobile/app/evaluations/mini.tsx "artifacts/mobile/app/evaluations/[id]/index.tsx" "artifacts/mobile/app/evaluations/[id]/answers/index.tsx" artifacts/mobile/services/i18n.ts
git commit -m "feat(mobile): a quick check for a group — tick list, audience, group label, marking list"
```

---

### Task 7: «مجموعات الدعم» on the class screen

**Files:**
- Create: `artifacts/mobile/components/classes/SupportGroupsSection.tsx`
- Modify: `artifacts/mobile/app/classes/[id]/index.tsx` (state, load ~line 270, render after `<MasterySection …/>` ~line 1139)
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes (Task 5): `SupportGroup`, `visibleGroups`, `outcomeKey`, `groupCheckAction`, `groupDraftAction`, `groupWorksheetAction`, `membersBelowLabel`, `getSupportGroups`; `formatListDate` (`services/evaluationRow.ts`); `trackEvent`.

- [ ] **Step 1: i18n.** Arabic block:

```ts
    supportGroupsTitle: 'مجموعات الدعم',
    supportGroupsHint: 'طلاب دون 60% في هدف واحد — جهّز لهم ورقة علاجية وتحققًا قصيرًا لهم وحدهم.',
    supportGroupsShowAll: (n: string) => `عرض الكل (${n})`,
    supportGroupWorksheet: 'ورقة علاجية',
    supportGroupCheck: 'تحقق للمجموعة',
    supportGroupNewCheck: 'تحقق جديد',
    supportGroupFinishCheck: 'أكمل التحقق',
    supportGroupLatest: 'آخر تحقق',
    supportGroupNoneLeft: 'لا أحد من المجموعة في الصف الآن',
    supportOutcomePassed: 'تجاوز',
    supportOutcomeStillWeak: 'ما زال يحتاج دعمًا',
    supportOutcomeNotYet: 'لم يقدّمه بعد',
```

English block:

```ts
    supportGroupsTitle: 'Support groups',
    supportGroupsHint: 'Students below 60% on one objective — give them a remedial worksheet and a short check for them alone.',
    supportGroupsShowAll: (n: string) => `Show all (${n})`,
    supportGroupWorksheet: 'Remedial worksheet',
    supportGroupCheck: 'Check this group',
    supportGroupNewCheck: 'New check',
    supportGroupFinishCheck: 'Finish the check',
    supportGroupLatest: 'Latest check',
    supportGroupNoneLeft: 'Nobody from the group is in the class now',
    supportOutcomePassed: 'Passed',
    supportOutcomeStillWeak: 'Still needs support',
    supportOutcomeNotYet: 'Not yet',
```

- [ ] **Step 2: The component** `artifacts/mobile/components/classes/SupportGroupsSection.tsx`:

```tsx
/**
 * «مجموعات الدعم» — per objective, the students under 60% and what to do for
 * them. The server derives the groups (api-server supportGroups.ts); this only
 * renders cards and routes the three actions.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { palette } from '@/constants/colors';
import { formatListDate } from '@/services/evaluationRow';
import { trackEvent } from '@/services/analytics';
import {
  groupCheckAction, groupDraftAction, groupWorksheetAction, membersBelowLabel, outcomeKey,
  visibleGroups, type CheckOutcome, type SupportGroup,
} from '@/services/supportGroups';

const ACCENT = palette.primary;

type Kind = 'worksheet' | 'check' | 'student';

export function SupportGroupsSection({
  classId, groups, isRTL, align, lang, t,
}: {
  classId: string;
  groups: SupportGroup[] | null;
  isRTL: boolean;
  align: 'left' | 'right';
  lang: 'ar' | 'en';
  t: (key: any, ...args: any[]) => string;
}) {
  const colors = useColors();
  const [showAll, setShowAll] = useState(false);
  if (!groups || groups.length === 0) return null;
  const row = isRTL ? 'row-reverse' : 'row';

  const go = (kind: Kind, target: { pathname: string; params: Record<string, string> } | null) => {
    if (!target) return;
    trackEvent('support_group_action', { kind });
    router.push(target as never);
  };

  const outcomeColor = (o: CheckOutcome) =>
    o === 'passed' ? palette.success : o === 'still_weak' ? colors.destructive : colors.mutedForeground;

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, textAlign: align }}>
        {t('supportGroupsTitle')}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, textAlign: align }}>
        {t('supportGroupsHint')}
      </Text>
      {visibleGroups(groups, showAll).map(g => {
        const ws = groupWorksheetAction(g);
        const draft = groupDraftAction(g);
        return (
          <View key={g.objectiveId} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 15, textAlign: align }}>{g.titleAr}</Text>
            {g.lessonTitleAr ? (
              <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{g.lessonTitleAr}</Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.destructive, textAlign: align }]}>{membersBelowLabel(g.members.length, lang)}</Text>
            <View style={[styles.wrap, { flexDirection: row }]}>
              {g.members.map(m => (
                <Pressable
                  key={m.studentId}
                  accessibilityRole="button"
                  onPress={() => go('student', { pathname: '/classes/[id]/student/[studentId]', params: { id: classId, studentId: m.studentId } })}
                  style={[styles.chip, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
                    {m.displayName} · {Math.round(m.percent)}%
                  </Text>
                </Pressable>
              ))}
            </View>

            {g.latestCheck ? (
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
                  {t('supportGroupLatest')}: {g.latestCheck.title}
                  {formatListDate(g.latestCheck.createdAt, lang) ? ` · ${formatListDate(g.latestCheck.createdAt, lang)}` : ''}
                </Text>
                {g.latestCheck.outcomes.length === 0 ? (
                  <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{t('supportGroupNoneLeft')}</Text>
                ) : (
                  g.latestCheck.outcomes.map(x => (
                    <View key={x.studentId} style={{ flexDirection: row, justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: align }}>{x.displayName}</Text>
                      <Text style={{ color: outcomeColor(x.outcome), fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
                        {t(outcomeKey(x.outcome))}{x.percent !== null ? ` · ${Math.round(x.percent)}%` : ''}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}

            <View style={[styles.wrap, { flexDirection: row, marginTop: 4 }]}>
              {ws ? <Pill label={t('supportGroupWorksheet')} onPress={() => go('worksheet', ws)} /> : null}
              {draft ? (
                <Pill label={t('supportGroupFinishCheck')} onPress={() => go('check', draft)} />
              ) : (
                <Pill
                  label={t(g.latestCheck ? 'supportGroupNewCheck' : 'supportGroupCheck')}
                  onPress={() => go('check', groupCheckAction(classId, g))}
                />
              )}
            </View>
          </View>
        );
      })}
      {!showAll && groups.length > visibleGroups(groups, false).length ? (
        <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{t('supportGroupsShowAll', String(groups.length))}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.pill, { borderColor: ACCENT }]}>
      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  meta: { fontSize: 13, fontFamily: 'Almarai_400Regular' },
  wrap: { flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
```

  Confirm `palette.success` exists (it is used in `app/evaluations/[id]/answers/index.tsx`'s `STATUS_COLOR`).

- [ ] **Step 3: Wire it in.** In `app/classes/[id]/index.tsx`:
  - add `getSupportGroups` to the `@/services/roster` import, and `import { SupportGroupsSection } from '@/components/classes/SupportGroupsSection';` and `import type { SupportGroup } from '@/services/supportGroups';`;
  - add state beside `mastery`: `const [supportGroups, setSupportGroups] = useState<SupportGroup[] | null>(null);`
  - in the refresh function, after `setMastery(await getClassMastery(id).catch(() => null));` add `setSupportGroups(await getSupportGroups(id).catch(() => null));`
  - after `<MasterySection mastery={mastery} … />` add `<SupportGroupsSection classId={id} groups={supportGroups} isRTL={isRTL} align={align} lang={lang === 'ar' ? 'ar' : 'en'} t={t} />`.

- [ ] **Step 4: Verify.** `cd artifacts/mobile && pnpm test` 0 fail; root `pnpm run typecheck` 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/mobile/components/classes/SupportGroupsSection.tsx "artifacts/mobile/app/classes/[id]/index.tsx" artifacts/mobile/services/i18n.ts
git commit -m "feat(mobile): «مجموعات الدعم» on the class screen — names, worksheet, group check, outcomes"
```

---

### Task 8: Running-app check, STATUS.md, PR

- [ ] **Step 1: Local stack.** Postgres; `pnpm --filter @workspace/db run migrate` (applies `0001`) on the local database; `pnpm run dev:api`; `pnpm run dev:mobile:web`. A verified teacher with roster consent and chemistry in scope; a chemistry class with three students weak on one objective (marked papers) and one strong student; at least one student linked to a student account (self link) — or seed attempts directly.
- [ ] **Step 2: Check.**
  - the exams tab shows «مجموعات الدعم» with the three weak students, weakest first; a name opens the record;
  - «ورقة علاجية» opens the worksheet on الكيمياء;
  - «تحقق للمجموعة» opens the quick check with the three ticked; untick one; create → the review screen says «للمجموعة: طالبان»; `evaluation_assignments` holds two rows;
  - publish; `GET /take/:code` lists the two only; claiming as the unticked student → 403 `not_in_group`; teacher entry for the unticked student → 403;
  - the unticked/strong student's `GET /student/exams` does not list it; their record does not show it as «لم يقدّمه»;
  - the marking list for the check shows the two only;
  - mark one at ≥60% and one under: the card shows «تجاوز» and «ما زال يحتاج دعمًا»; the button reads «تحقق جديد»;
  - a draft group check makes the button read «أكمل التحقق» and opens the review;
  - an ordinary class-wide quick check still lists the whole class everywhere;
  - `PUT /evaluations/:id/audience` on the published check → 409 `audience_locked`; moving a group check to another class → 409 `audience_class_locked`.
- [ ] **Step 3: STATUS.md** — a dated section «Support groups: who is under the line on each objective, and a check for them alone, 2026-10-09»: what shipped, the decisions table from the spec, the audience rule and the six places it is enforced, the migration, what was verified, what was not.
- [ ] **Step 4: Push; open the PR as a draft with a `schema` note (migration `0001`, additive — no `destructive-migration` line needed); mark ready when green.**
