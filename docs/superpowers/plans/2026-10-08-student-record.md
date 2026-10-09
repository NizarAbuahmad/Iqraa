# Student Record (ملف الطالب) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a student on the class screen opens their record for that class: weakest objectives first with remedial actions, the class's exams with their status, and the running note.

**Architecture:** One new roster route, `GET /classes/:id/students/:studentId/record`, fetches rows and hands them to a pure `studentRecord()` that reuses `aggregateClass`. The app gets a pure `services/studentRecord.ts` (split, labels, action params) and one new screen; the quick-check screen learns an `objectiveId` preset.

**Tech Stack:** Express + Drizzle (api-server), Expo Router / React Native (mobile), `node --test` with `--experimental-strip-types`, `@workspace/curriculum`.

**Spec:** `docs/superpowers/specs/2026-10-08-student-record-design.md`

## Global Constraints

- Scope is **this class only**: evaluations with `classGroupId = classId`, `archivedAt` null, status not `draft`.
- Objective rollup = `aggregateClass` unchanged (marks-weighted); **provisional papers are counted**, and `provisionalCount` is reported.
- **Weak = percent < 60.** Server constant `STUDENT_GAP_PERCENT` (classInsights.ts); app constant `WEAK_PERCENT = 60` pinned by a test.
- Access: `findLiveClass(classId, teacherId)` + a `class_memberships` row + `students.teacherId = teacherId` + `students.archivedAt` null; every failure → **404** `{ error: "Student not found" }` (or "Class not found" for the class), never 403.
- No database change.
- A `not_sat` exam has `attemptId: null` and is **never** linked to `/evaluations/[id]/answers/[studentId]` (that screen's mount effect creates a blank attempt).
- Generators get the lesson's own scope: worksheet params come from `lessonPickerParams(lessonId, 'ar')`; hide the action when it returns null (CLAUDE.md: generators branch on the subject name).
- The parent message pulls **no marks** (unchanged `parent-message.tsx` decision).
- Mobile tests live only in `artifacts/mobile/services/__tests__/`; anything they import must not import `react-native`/`expo-*`; relative imports need explicit `.ts`.
- UI accessibility: `aria-*` props, never `accessibilityState=` (`ariaState.test.ts`).
- Analytics carry no student name or id: `student_record_opened { classId }`, `student_record_action { kind }`.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_011Rg5JbiuZf4G2rgVUfhsd2`

## File Structure

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/modules/assessment/studentRecord.ts` (new) | Pure: rows → `{ exams, objectives, provisionalCount }` |
| `artifacts/api-server/src/modules/assessment/__tests__/studentRecord.test.ts` (new) | Its tests |
| `artifacts/api-server/src/routes/roster.ts` (modify) | The route: access checks, queries, response |
| `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (modify) | Route sits inside the guarded prefix |
| `artifacts/mobile/services/studentRecord.ts` (new) | Types, `WEAK_PERCENT`, split, labels, action params |
| `artifacts/mobile/services/__tests__/studentRecord.test.ts` (new) | Its tests |
| `artifacts/mobile/services/roster.ts` (modify) | `getStudentRecord()` client |
| `artifacts/mobile/services/miniEval.ts` (modify) | `miniEvalPreset()` |
| `artifacts/mobile/services/__tests__/miniEval.test.ts` (modify) | Its test |
| `artifacts/mobile/app/evaluations/mini.tsx` (modify) | Honour `objectiveId` param |
| `artifacts/mobile/app/classes/[id].tsx` → `app/classes/[id]/index.tsx` (move) | So the record can nest under the class |
| `artifacts/mobile/app/classes/[id]/student/[studentId].tsx` (new) | The screen |
| `artifacts/mobile/services/i18n.ts` (modify) | Strings |
| `STATUS.md` (modify) | Dated entry |

---

### Task 1: Pure `studentRecord()` on the server

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/studentRecord.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/studentRecord.test.ts`

**Interfaces:**
- Consumes: `aggregateClass` (`./classInsights.ts`), `ObjectiveScore` (`./scoring.ts`).
- Produces:
  ```ts
  export type RecordExamStatus = "not_sat" | "in_progress" | "submitted" | "marked";
  export interface RecordExamRow { evaluationId: string; title: string; titleAr: string; createdAt: Date;
    attemptId: string | null; attemptStatus: string | null; teacherComment: string | null;
    submittedAt: Date | null; earned: string | number | null; total: string | number | null;
    percent: string | number | null; isProvisional: boolean | null; objectiveScores: unknown[] | null }
  export interface ObjectiveInfo { titleAr: string; lessonId: string | null; lessonTitleAr: string }
  export interface RecordExam { evaluationId: string; title: string; createdAt: string; status: RecordExamStatus;
    attemptId: string | null; earned: number | null; total: number | null; percent: number | null;
    provisional: boolean; teacherComment: string | null; submittedAt: string | null }
  export interface RecordObjective { objectiveId: string; titleAr: string; lessonId: string | null;
    lessonTitleAr: string; earned: number; total: number; percent: number; marksLost: number;
    sittings: number; lastSeenAt: string }
  export function examStatus(attemptStatus: string | null): RecordExamStatus;
  export function studentRecord(rows: readonly RecordExamRow[], describe: (objectiveId: string) => ObjectiveInfo | null):
    { exams: RecordExam[]; objectives: RecordObjective[]; provisionalCount: number };
  ```

- [ ] **Step 1: Write the failing test**

```ts
/**
 * One student's record for one class — the per-student view the class screen
 * lacked. What must hold: the rollup is the same marks-weighted sum the class
 * view uses (not a mean of papers), provisional papers count but are reported,
 * a paper nobody marked does not drag the rollup, and an exam the student never
 * sat carries no attempt (the paper screen would create one on open).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { examStatus, studentRecord, type ObjectiveInfo, type RecordExamRow } from "../studentRecord.ts";
import type { ObjectiveScore } from "../scoring.ts";

function o(objectiveId: string, earned: number, total: number): ObjectiveScore {
  return { objectiveId, earned, total, percent: total > 0 ? (earned / total) * 100 : 0,
    questionCount: 1, marksLost: total - earned, bloomsRank: 2 };
}

function row(over: Partial<RecordExamRow>): RecordExamRow {
  return {
    evaluationId: "e1", title: "Quiz", titleAr: "", createdAt: new Date("2026-09-01T08:00:00Z"),
    attemptId: "a1", attemptStatus: "graded", teacherComment: "", submittedAt: new Date("2026-09-01T09:00:00Z"),
    earned: "1.00", total: "2.00", percent: "50.00", isProvisional: false, objectiveScores: [],
    ...over,
  };
}

const describeKnown = (id: string): ObjectiveInfo | null =>
  id === "o-known" ? { titleAr: "هدف معروف", lessonId: "kbl-x", lessonTitleAr: "درس" } : null;

describe("examStatus", () => {
  it("maps attempt states to what the teacher reads", () => {
    assert.equal(examStatus(null), "not_sat");
    assert.equal(examStatus("not_started"), "not_sat");
    assert.equal(examStatus("in_progress"), "in_progress");
    for (const s of ["submitted", "grading", "needs_review"]) assert.equal(examStatus(s), "submitted");
    assert.equal(examStatus("graded"), "marked");
  });
});

describe("studentRecord", () => {
  it("sums marks across papers instead of averaging their percentages", () => {
    const r = studentRecord([
      row({ evaluationId: "e1", objectiveScores: [o("o-known", 1, 2)] }),
      row({ evaluationId: "e2", attemptId: "a2", objectiveScores: [o("o-known", 9, 10)] }),
    ], describeKnown);
    assert.equal(r.objectives.length, 1);
    assert.equal(r.objectives[0]!.earned, 10);
    assert.equal(r.objectives[0]!.total, 12);
    assert.equal(r.objectives[0]!.percent, 83.33); // 10/12, not (50 + 90) / 2 = 70
  });

  it("counts sittings and the latest paper per objective", () => {
    const r = studentRecord([
      row({ evaluationId: "e1", submittedAt: new Date("2026-09-01T09:00:00Z"), objectiveScores: [o("o-known", 1, 2)] }),
      row({ evaluationId: "e2", attemptId: "a2", submittedAt: new Date("2026-09-20T09:00:00Z"), objectiveScores: [o("o-known", 1, 2)] }),
    ], describeKnown);
    assert.equal(r.objectives[0]!.sittings, 2);
    assert.equal(r.objectives[0]!.lastSeenAt, "2026-09-20T09:00:00.000Z");
  });

  it("counts provisional papers and says how many there were", () => {
    const r = studentRecord([
      row({ evaluationId: "e1", isProvisional: true, objectiveScores: [o("o-known", 0, 2)] }),
      row({ evaluationId: "e2", attemptId: "a2", objectiveScores: [o("o-known", 2, 2)] }),
    ], describeKnown);
    assert.equal(r.objectives[0]!.total, 4);
    assert.equal(r.provisionalCount, 1);
    assert.equal(r.exams.find(e => e.evaluationId === "e1")!.provisional, true);
  });

  it("lists an exam the student never sat, with no attempt and no score", () => {
    const r = studentRecord([
      row({ evaluationId: "e9", attemptId: null, attemptStatus: null, submittedAt: null,
        earned: null, total: null, percent: null, isProvisional: null, objectiveScores: null }),
    ], describeKnown);
    assert.deepEqual(r.exams[0], {
      evaluationId: "e9", title: "Quiz", createdAt: "2026-09-01T08:00:00.000Z", status: "not_sat",
      attemptId: null, earned: null, total: null, percent: null, provisional: false,
      teacherComment: null, submittedAt: null,
    });
    assert.equal(r.objectives.length, 0);
  });

  it("keeps an unmarked paper out of the rollup but in the exam list", () => {
    const r = studentRecord([row({ attemptStatus: "submitted", objectiveScores: [] })], describeKnown);
    assert.equal(r.exams[0]!.status, "submitted");
    assert.equal(r.objectives.length, 0);
    assert.equal(r.provisionalCount, 0);
  });

  it("orders exams newest first and objectives weakest first", () => {
    const r = studentRecord([
      row({ evaluationId: "old", createdAt: new Date("2026-09-01T00:00:00Z"), objectiveScores: [o("o-strong", 9, 10)] }),
      row({ evaluationId: "new", attemptId: "a2", createdAt: new Date("2026-09-30T00:00:00Z"), objectiveScores: [o("o-weak", 1, 10)] }),
    ], describeKnown);
    assert.deepEqual(r.exams.map(e => e.evaluationId), ["new", "old"]);
    assert.deepEqual(r.objectives.map(x => x.objectiveId), ["o-weak", "o-strong"]);
  });

  it("names the lesson behind each objective, and keeps an unknown one honest", () => {
    const r = studentRecord([
      row({ objectiveScores: [o("o-known", 1, 2), o("o-gone", 1, 2)] }),
    ], describeKnown);
    const known = r.objectives.find(x => x.objectiveId === "o-known")!;
    const gone = r.objectives.find(x => x.objectiveId === "o-gone")!;
    assert.equal(known.lessonId, "kbl-x");
    assert.equal(known.titleAr, "هدف معروف");
    assert.equal(gone.lessonId, null);
    assert.equal(gone.titleAr, "");
  });

  it("prefers the Arabic exam title, reads numeric strings, and drops an empty comment", () => {
    const r = studentRecord([row({ titleAr: "اختبار قصير", earned: "1.50", total: "2.00", percent: "75.00",
      teacherComment: "", objectiveScores: [o("o-known", 1.5, 2)] })], describeKnown);
    assert.equal(r.exams[0]!.title, "اختبار قصير");
    assert.equal(r.exams[0]!.earned, 1.5);
    assert.equal(r.exams[0]!.percent, 75);
    assert.equal(r.exams[0]!.teacherComment, null);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/studentRecord.test.ts`
Expected: FAIL — cannot find module `../studentRecord.ts`.

- [ ] **Step 3: Implement**

```ts
/**
 * One student's record in one class — what the class screen shows for the
 * whole room, for the one child a teacher is about to plan for.
 *
 * Pure on purpose: the route only fetches rows. The rollup is `aggregateClass`
 * unchanged — summing one student across papers is the same operation as
 * summing a class across students (see masteryRollup.test.ts), and it keeps
 * this number comparable with the class view's.
 */
import { aggregateClass } from "./classInsights.ts";
import type { ObjectiveScore } from "./scoring.ts";

export type RecordExamStatus = "not_sat" | "in_progress" | "submitted" | "marked";

export interface RecordExamRow {
  evaluationId: string;
  title: string;
  titleAr: string;
  createdAt: Date;
  attemptId: string | null;
  attemptStatus: string | null;
  teacherComment: string | null;
  submittedAt: Date | null;
  /** Numeric columns arrive as strings («2.00»). */
  earned: string | number | null;
  total: string | number | null;
  percent: string | number | null;
  isProvisional: boolean | null;
  objectiveScores: unknown[] | null;
}

export interface ObjectiveInfo {
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
}

export interface RecordExam {
  evaluationId: string;
  title: string;
  createdAt: string;
  status: RecordExamStatus;
  attemptId: string | null;
  earned: number | null;
  total: number | null;
  percent: number | null;
  provisional: boolean;
  teacherComment: string | null;
  submittedAt: string | null;
}

export interface RecordObjective {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  earned: number;
  total: number;
  percent: number;
  marksLost: number;
  sittings: number;
  lastSeenAt: string;
}

export function examStatus(attemptStatus: string | null): RecordExamStatus {
  switch (attemptStatus) {
    case null:
    case "not_started":
      return "not_sat";
    case "in_progress":
      return "in_progress";
    case "graded":
      return "marked";
    default:
      // submitted, grading, needs_review: the paper is in, the marks are not.
      return "submitted";
  }
}

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

export function studentRecord(
  rows: readonly RecordExamRow[],
  describe: (objectiveId: string) => ObjectiveInfo | null,
): { exams: RecordExam[]; objectives: RecordObjective[]; provisionalCount: number } {
  const exams = [...rows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r): RecordExam => {
      const status = r.attemptId ? examStatus(r.attemptStatus) : "not_sat";
      const hasResult = r.total !== null;
      return {
        evaluationId: r.evaluationId,
        title: r.titleAr || r.title,
        createdAt: r.createdAt.toISOString(),
        status,
        // The paper screen creates an attempt on open; never hand it one to open.
        attemptId: status === "not_sat" ? null : r.attemptId,
        earned: hasResult ? num(r.earned) : null,
        total: hasResult ? num(r.total) : null,
        percent: hasResult ? num(r.percent) : null,
        provisional: Boolean(r.isProvisional),
        teacherComment: r.teacherComment ? r.teacherComment : null,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      };
    });

  // Same rule as the class view: a paper nobody marked carries an empty
  // breakdown, and letting it in would drag the rollup toward zero.
  const marked = rows
    .map(r => ({ r, scores: ((r.objectiveScores as ObjectiveScore[] | null) ?? []) }))
    .filter(m => m.scores.length > 0);

  const rollup = aggregateClass(marked.map(m => ({ objectiveScores: m.scores })));

  const seen = new Map<string, { sittings: number; last: Date }>();
  for (const m of marked) {
    const when = m.r.submittedAt ?? m.r.createdAt;
    for (const s of m.scores) {
      const entry = seen.get(s.objectiveId) ?? { sittings: 0, last: when };
      entry.sittings += 1;
      if (when > entry.last) entry.last = when;
      seen.set(s.objectiveId, entry);
    }
  }

  const objectives = rollup.objectiveScores
    .map((s): RecordObjective => {
      const info = describe(s.objectiveId);
      const evidence = seen.get(s.objectiveId)!;
      return {
        objectiveId: s.objectiveId,
        titleAr: info?.titleAr ?? "",
        lessonId: info?.lessonId ?? null,
        lessonTitleAr: info?.lessonTitleAr ?? "",
        earned: s.earned,
        total: s.total,
        percent: s.percent,
        marksLost: s.marksLost,
        sittings: evidence.sittings,
        lastSeenAt: evidence.last.toISOString(),
      };
    })
    .sort((a, b) => a.percent - b.percent || b.marksLost - a.marksLost);

  return {
    exams,
    objectives,
    provisionalCount: marked.filter(m => m.r.isProvisional).length,
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/studentRecord.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm run typecheck` (repo root) — 0 errors.

```bash
git add artifacts/api-server/src/modules/assessment/studentRecord.ts artifacts/api-server/src/modules/assessment/__tests__/studentRecord.test.ts
git commit -m "feat(api): studentRecord — one student's papers and objective rollup for a class"
```

---

### Task 2: The route

**Files:**
- Modify: `artifacts/api-server/src/routes/roster.ts` (imports; new route directly after `GET /classes/:id/mastery`, which ends ~line 311)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (new case after "mounts the class-resource routes inside the roster's guarded prefix", ~line 257)

**Interfaces:**
- Consumes: `studentRecord`, `ObjectiveInfo` (Task 1); `findLiveClass`, `isUuid`, `failRoster` (already in roster.ts); `getObjectiveById` from `@workspace/curriculum`.
- Produces: `GET /classes/:id/students/:studentId/record` →
  `{ student: { id, displayName, teacherNote, gender, linked }, className, exams, objectives, provisionalCount, parent: { linked, lastContact: { kind, channel, at } | null } }`

- [ ] **Step 1: Write the failing mount test**

Add to `mountOrder.test.ts`:

```ts
  it("mounts the student record inside the roster's guarded prefix", async () => {
    // Like the class-resource routes: outside `router.use(["/classes", "/students"], …)`
    // this would answer 404 rather than 401, and one child's marks would be
    // readable with no token. Passes before the route exists — it guards the move.
    const id = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${base}/classes/${id}/students/${id}/record`);
    assert.equal(res.status, 401, "a student's record must require a token");
  });
```

- [ ] **Step 2: Run it**

Run: `cd artifacts/api-server && pnpm build && pnpm test 2>&1 | grep -E "student record|^# (pass|fail)"`
Expected: the new case passes (the prefix guard already covers `/classes/**`) — it pins the mount, as the neighbouring cases document.

- [ ] **Step 3: Implement the route**

Add to the imports in `roster.ts`:

```ts
import { and, asc, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getObjectiveById, resolveObjectiveIds } from "@workspace/curriculum";
import { studentRecord } from "../modules/assessment/studentRecord.ts";
```

(replace the existing `drizzle-orm` and `@workspace/curriculum` import lines; keep every name already imported).

Add after the `/classes/:id/mastery` route:

```ts
/**
 * One student's record in this class — the per-student view STATUS.md listed as
 * "deliberately not built". Scoped to this class's evaluations, so a subject's
 * objectives stay together. Every refusal is 404, for the reason the rest of
 * this router gives: "exists but not yours" must not be distinguishable.
 */
router.get("/classes/:id/students/:studentId/record", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const studentId = req.params["studentId"] as string;
    const teacherId = req.user!.id;
    if (!isUuid(classId) || !isUuid(studentId)) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const group = await findLiveClass(classId, teacherId);
    if (!group) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const [student] = await db
      .select({
        id: students.id,
        displayName: students.displayName,
        teacherNote: students.teacherNote,
        gender: students.gender,
      })
      .from(students)
      .innerJoin(
        classMemberships,
        and(eq(classMemberships.studentId, students.id), eq(classMemberships.classGroupId, classId)),
      )
      .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId), isNull(students.archivedAt)))
      .limit(1);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const rows = await db
      .select({
        evaluationId: evaluations.id,
        title: evaluations.title,
        titleAr: evaluations.titleAr,
        createdAt: evaluations.createdAt,
        attemptId: attempts.id,
        attemptStatus: attempts.status,
        teacherComment: attempts.teacherComment,
        submittedAt: attempts.submittedAt,
        earned: attemptResults.earnedMarks,
        total: attemptResults.totalMarks,
        percent: attemptResults.percent,
        isProvisional: attemptResults.isProvisional,
        objectiveScores: attemptResults.objectiveScores,
      })
      .from(evaluations)
      .leftJoin(attempts, and(eq(attempts.evaluationId, evaluations.id), eq(attempts.studentId, studentId)))
      .leftJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
      .where(
        and(
          eq(evaluations.classGroupId, classId),
          isNull(evaluations.archivedAt),
          ne(evaluations.status, "draft"),
        ),
      );

    const [guardian] = await db
      .select({ id: rosterLinks.id })
      .from(rosterLinks)
      .where(and(eq(rosterLinks.studentId, studentId), eq(rosterLinks.relation, "guardian")))
      .limit(1);

    const [lastContact] = await db
      .select({ kind: parentContacts.kind, channel: parentContacts.channel, at: parentContacts.createdAt })
      .from(parentContacts)
      .where(and(eq(parentContacts.studentId, studentId), eq(parentContacts.teacherId, teacherId)))
      .orderBy(desc(parentContacts.createdAt))
      .limit(1);

    const record = studentRecord(rows, objectiveId => {
      const o = getObjectiveById(objectiveId);
      return o
        ? { titleAr: o.descriptionAr || o.description, lessonId: o.lessonId, lessonTitleAr: o.lessonTitleAr || o.lessonTitle }
        : null;
    });

    const linked = Boolean(guardian);
    res.json({
      student: { ...student, linked },
      className: group.nameAr || group.name,
      ...record,
      parent: {
        linked,
        lastContact: lastContact
          ? { kind: lastContact.kind, channel: lastContact.channel, at: lastContact.at.toISOString() }
          : null,
      },
    });
  } catch (err) {
    failRoster(res, err, "student record", "Failed to load student record");
  }
});
```

- [ ] **Step 4: Build, test, typecheck**

Run: `cd artifacts/api-server && pnpm build && pnpm test 2>&1 | grep -E "^# (pass|fail)"` — 0 failures.
Run: `pnpm run typecheck` (root) — 0 errors.

- [ ] **Step 5: Live check against local Postgres**

Start Postgres and `pnpm run dev:api` (see LOCAL_SETUP.md). With a teacher token for a class that has a marked evaluation:
`curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/api/classes/$CLASS/students/$STUDENT/record | head -c 600`
Expected: JSON with `student`, `exams`, `objectives`. A student id from another class → 404.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/routes/roster.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -m "feat(api): GET /classes/:id/students/:studentId/record"
```

---

### Task 3: App service — types, client, split, labels, action params

**Files:**
- Create: `artifacts/mobile/services/studentRecord.ts`
- Modify: `artifacts/mobile/services/roster.ts` (add `getStudentRecord` after `getClassMastery`)
- Test: `artifacts/mobile/services/__tests__/studentRecord.test.ts`

**Interfaces:**
- Consumes: the route's JSON (Task 2); `lessonPickerParams`, `resolveLessonPrepContext` (`./lessonPrep.ts`); `arCountPhrase` (`./arCount.ts`).
- Produces (used by Tasks 4–5):
  ```ts
  export const WEAK_PERCENT = 60;
  export type RecordExamStatus = 'not_sat' | 'in_progress' | 'submitted' | 'marked';
  export interface StudentRecordExam { evaluationId; title; createdAt; status: RecordExamStatus; attemptId: string | null;
    earned: number | null; total: number | null; percent: number | null; provisional: boolean;
    teacherComment: string | null; submittedAt: string | null }
  export interface StudentRecordObjective { objectiveId; titleAr; lessonId: string | null; lessonTitleAr;
    earned; total; percent; marksLost; sittings; lastSeenAt }
  export interface StudentRecord { student: { id; displayName; teacherNote; gender; linked: boolean };
    className: string; exams: StudentRecordExam[]; objectives: StudentRecordObjective[];
    provisionalCount: number; parent: { linked: boolean; lastContact: { kind: string; channel: string; at: string } | null } }
  export function focusObjectives(objs): { weak: StudentRecordObjective[]; shown: StudentRecordObjective[]; allClear: boolean };
  export function examStatusKey(status: RecordExamStatus): 'studentRecordNotSat' | 'studentRecordInProgress' | 'studentRecordSubmitted' | 'studentRecordMarked';
  export function formatDay(iso: string): string;            // «2026/10/02»
  export function sittingsLine(o: StudentRecordObjective, lang: 'ar' | 'en'): string;
  export function worksheetAction(o): { pathname: '/ai-tools/worksheet'; params: { topic: string; gradeIdx: string; subjectIdx: string } } | null;
  export function lessonAction(o): { pathname: '/curriculum/lesson-detail'; params: { lessonId: string } } | null;
  export function recheckAction(classId: string, o): { pathname: '/evaluations/mini'; params: { classId: string; objectiveId: string } };
  export function paperAction(exam, studentId: string): { pathname: '/evaluations/[id]/answers/[studentId]'; params: { id: string; studentId: string } } | null;
  // roster.ts
  export async function getStudentRecord(classId: string, studentId: string): Promise<StudentRecord>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAK_PERCENT, examStatusKey, focusObjectives, formatDay, lessonAction, paperAction,
  recheckAction, sittingsLine, worksheetAction,
  type StudentRecordExam, type StudentRecordObjective,
} from '../studentRecord.ts';
import { lessonPickerParams, resolveLessonPrepContext } from '../lessonPrep.ts';

const CHEM = 'kbl-chem-s1-nccd-u1_l1';
const MATH = 'kbl-math-s1-nccd-u1_l1';

function obj(over: Partial<StudentRecordObjective>): StudentRecordObjective {
  return { objectiveId: 'o-nccd-chem-s1-u1_l1-0', titleAr: 'هدف', lessonId: CHEM, lessonTitleAr: 'درس',
    earned: 1, total: 4, percent: 25, marksLost: 3, sittings: 3, lastSeenAt: '2026-10-02T09:00:00.000Z', ...over };
}
function exam(over: Partial<StudentRecordExam>): StudentRecordExam {
  return { evaluationId: 'e1', title: 'اختبار', createdAt: '2026-10-01T00:00:00.000Z', status: 'marked',
    attemptId: 'a1', earned: 3, total: 4, percent: 75, provisional: false, teacherComment: null,
    submittedAt: '2026-10-01T09:00:00.000Z', ...over };
}

describe('student record — weak line', () => {
  it('mirrors the server gap line (STUDENT_GAP_PERCENT in classInsights.ts)', () => {
    assert.equal(WEAK_PERCENT, 60);
  });
  it('splits at 60 and shows the weakest one when nothing is weak', () => {
    const weak = obj({ percent: 59.99 });
    const ok = obj({ objectiveId: 'b', percent: 60 });
    assert.deepEqual(focusObjectives([weak, ok]), { weak: [weak], shown: [weak], allClear: false });
    assert.deepEqual(focusObjectives([ok]), { weak: [], shown: [ok], allClear: true });
    assert.deepEqual(focusObjectives([]), { weak: [], shown: [], allClear: true });
  });
});

describe('student record — exams', () => {
  it('names each status', () => {
    assert.equal(examStatusKey('not_sat'), 'studentRecordNotSat');
    assert.equal(examStatusKey('in_progress'), 'studentRecordInProgress');
    assert.equal(examStatusKey('submitted'), 'studentRecordSubmitted');
    assert.equal(examStatusKey('marked'), 'studentRecordMarked');
  });
  it('never links an exam the student did not sit (the paper screen would create an attempt)', () => {
    assert.equal(paperAction(exam({ status: 'not_sat', attemptId: null }), 's1'), null);
    assert.deepEqual(paperAction(exam({}), 's1'), {
      pathname: '/evaluations/[id]/answers/[studentId]', params: { id: 'e1', studentId: 's1' },
    });
  });
  it('formats a day as the teacher writes it', () => {
    assert.equal(formatDay('2026-10-02T09:00:00.000Z'), '2026/10/02');
  });
  it('says how much evidence an objective rests on', () => {
    assert.equal(sittingsLine(obj({ sittings: 1 }), 'ar'), 'في ورقة · آخرها 2026/10/02');
    assert.equal(sittingsLine(obj({ sittings: 3 }), 'ar'), 'في 3 أوراق · آخرها 2026/10/02');
    assert.equal(sittingsLine(obj({ sittings: 2 }), 'en'), 'In 2 papers · latest 2026/10/02');
  });
});

describe('student record — actions', () => {
  it('opens the worksheet on the lesson’s own grade and subject, titled with the lesson', () => {
    const a = worksheetAction(obj({}))!;
    assert.equal(a.pathname, '/ai-tools/worksheet');
    assert.deepEqual({ gradeIdx: a.params.gradeIdx, subjectIdx: a.params.subjectIdx }, lessonPickerParams(CHEM, 'ar'));
    assert.equal(a.params.topic, resolveLessonPrepContext(CHEM, 'ar')!.topic);
    // The trap CLAUDE.md names: a chemistry objective must not land on maths.
    assert.notEqual(a.params.subjectIdx, lessonPickerParams(MATH, 'ar')!.subjectIdx);
  });
  it('hides worksheet and lesson when the lesson is unknown', () => {
    assert.equal(worksheetAction(obj({ lessonId: null })), null);
    assert.equal(worksheetAction(obj({ lessonId: 'kbl-nope' })), null);
    assert.equal(lessonAction(obj({ lessonId: null })), null);
  });
  it('opens the lesson and the quick re-check for this class', () => {
    assert.deepEqual(lessonAction(obj({})), { pathname: '/curriculum/lesson-detail', params: { lessonId: CHEM } });
    assert.deepEqual(recheckAction('c1', obj({})), {
      pathname: '/evaluations/mini', params: { classId: 'c1', objectiveId: 'o-nccd-chem-s1-u1_l1-0' },
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/studentRecord.test.ts`
Expected: FAIL — cannot find `../studentRecord.ts`.

- [ ] **Step 3: Implement `services/studentRecord.ts`**

```ts
/**
 * The student record's logic, kept free of React Native so `node --test` can
 * load it (CLAUDE.md: the mobile runner has no RN transform).
 */
import { arCountPhrase } from './arCount.ts';
import { lessonPickerParams, resolveLessonPrepContext } from './lessonPrep.ts';

/**
 * Below this an objective counts as weak. Mirrors `STUDENT_GAP_PERCENT` in
 * artifacts/api-server/src/modules/assessment/classInsights.ts — the app cannot
 * import the server module, so a test pins the value instead.
 */
export const WEAK_PERCENT = 60;

export type RecordExamStatus = 'not_sat' | 'in_progress' | 'submitted' | 'marked';

export interface StudentRecordExam {
  evaluationId: string;
  title: string;
  createdAt: string;
  status: RecordExamStatus;
  attemptId: string | null;
  earned: number | null;
  total: number | null;
  percent: number | null;
  provisional: boolean;
  teacherComment: string | null;
  submittedAt: string | null;
}

export interface StudentRecordObjective {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  earned: number;
  total: number;
  percent: number;
  marksLost: number;
  sittings: number;
  lastSeenAt: string;
}

export interface StudentRecord {
  student: { id: string; displayName: string; teacherNote: string; gender: string; linked: boolean };
  className: string;
  exams: StudentRecordExam[];
  /** Weakest first. */
  objectives: StudentRecordObjective[];
  provisionalCount: number;
  parent: { linked: boolean; lastContact: { kind: string; channel: string; at: string } | null };
}

/** The weak objectives, and what to show when there are none: the weakest anyway. */
export function focusObjectives(objs: readonly StudentRecordObjective[]): {
  weak: StudentRecordObjective[];
  shown: StudentRecordObjective[];
  allClear: boolean;
} {
  const weak = objs.filter(o => o.percent < WEAK_PERCENT);
  return { weak, shown: weak.length > 0 ? weak : objs.slice(0, 1), allClear: weak.length === 0 };
}

export function examStatusKey(status: RecordExamStatus) {
  switch (status) {
    case 'not_sat': return 'studentRecordNotSat' as const;
    case 'in_progress': return 'studentRecordInProgress' as const;
    case 'submitted': return 'studentRecordSubmitted' as const;
    case 'marked': return 'studentRecordMarked' as const;
  }
}

export function formatDay(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '/');
}

export function sittingsLine(o: StudentRecordObjective, lang: 'ar' | 'en'): string {
  const day = formatDay(o.lastSeenAt);
  if (lang === 'ar') return `في ${arCountPhrase(o.sittings, 'ورقة', 'ورقتين', 'أوراق')} · آخرها ${day}`;
  return `In ${o.sittings} ${o.sittings === 1 ? 'paper' : 'papers'} · latest ${day}`;
}

/** The worksheet generator on the lesson's own grade and subject — never a default. */
export function worksheetAction(o: StudentRecordObjective) {
  if (!o.lessonId) return null;
  const picker = lessonPickerParams(o.lessonId, 'ar');
  const context = resolveLessonPrepContext(o.lessonId, 'ar');
  if (!picker || !context) return null;
  return { pathname: '/ai-tools/worksheet' as const, params: { topic: context.topic, ...picker } };
}

export function lessonAction(o: StudentRecordObjective) {
  return o.lessonId
    ? { pathname: '/curriculum/lesson-detail' as const, params: { lessonId: o.lessonId } }
    : null;
}

export function recheckAction(classId: string, o: StudentRecordObjective) {
  return { pathname: '/evaluations/mini' as const, params: { classId, objectiveId: o.objectiveId } };
}

/** Only a paper that exists: the paper screen creates an attempt for one that does not. */
export function paperAction(exam: StudentRecordExam, studentId: string) {
  return exam.status !== 'not_sat' && exam.attemptId
    ? { pathname: '/evaluations/[id]/answers/[studentId]' as const, params: { id: exam.evaluationId, studentId } }
    : null;
}
```

Add to `services/roster.ts` (after `getClassMastery`), plus `import type { StudentRecord } from './studentRecord.ts';` at the top:

```ts
/** One student's record in one class. 404 when the student is not in it. */
export async function getStudentRecord(classId: string, studentId: string): Promise<StudentRecord> {
  const res = await apiFetch(`/classes/${classId}/students/${studentId}/record`);
  return readJson<StudentRecord>(res, 'Loading student record');
}
```

- [ ] **Step 4: Run and pass**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/studentRecord.test.ts` — PASS.
Run: `cd artifacts/mobile && pnpm test 2>&1 | grep -E "^# (pass|fail)"` — 0 fail. Root `pnpm run typecheck` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/studentRecord.ts artifacts/mobile/services/__tests__/studentRecord.test.ts artifacts/mobile/services/roster.ts
git commit -m "feat(mobile): student record service — weak split, labels, action params"
```

---

### Task 4: Quick check preset to an objective

**Files:**
- Modify: `artifacts/mobile/services/miniEval.ts` (append `miniEvalPreset`)
- Modify: `artifacts/mobile/services/__tests__/miniEval.test.ts` (append a describe)
- Modify: `artifacts/mobile/app/evaluations/mini.tsx` (params ~line 61; the loading effect ~lines 70–100)

**Interfaces:**
- Consumes: `getObjectiveById` from `@/services/curriculumData` (re-exports `@workspace/curriculum`); `recheckAction` params from Task 3 (`classId`, `objectiveId`).
- Produces: `export function miniEvalPreset(objectiveId: string | undefined, bookIds: readonly string[], lookup: (id: string) => { bookId: string } | undefined): { bookId: string; objectiveId: string } | null`

- [ ] **Step 1: Failing test** (append to `miniEval.test.ts`; add `miniEvalPreset` to its import from `../miniEval.ts`)

```ts
describe('miniEvalPreset', () => {
  const lookup = (id: string) => (id === 'o1' ? { bookId: 'book-chem-10' } : undefined);
  it('opens on the objective and its book when the book is on offer', () => {
    assert.deepEqual(miniEvalPreset('o1', ['book-chem-10', 'book-math-10'], lookup), { bookId: 'book-chem-10', objectiveId: 'o1' });
  });
  it('presets nothing for an unknown objective, an absent one, or a book the class does not offer', () => {
    assert.equal(miniEvalPreset('nope', ['book-chem-10'], lookup), null);
    assert.equal(miniEvalPreset(undefined, ['book-chem-10'], lookup), null);
    assert.equal(miniEvalPreset('o1', ['book-math-10'], lookup), null);
  });
});
```

- [ ] **Step 2: Run, watch fail** — `node --experimental-strip-types --test services/__tests__/miniEval.test.ts` (from `artifacts/mobile`): FAIL, `miniEvalPreset` not exported.

- [ ] **Step 3: Implement** (append to `miniEval.ts`)

```ts
/**
 * The student record's «تحقق سريع» opens here with an objective already chosen.
 * Only when its book is among the ones offered: a preset the screen cannot show
 * would leave a selected objective the teacher cannot see.
 */
export function miniEvalPreset(
  objectiveId: string | undefined,
  bookIds: readonly string[],
  lookup: (id: string) => { bookId: string } | undefined,
): { bookId: string; objectiveId: string } | null {
  if (!objectiveId) return null;
  const objective = lookup(objectiveId);
  if (!objective || !bookIds.includes(objective.bookId)) return null;
  return { bookId: objective.bookId, objectiveId };
}
```

In `mini.tsx`:
- import `getObjectiveById` alongside `BOOKS` from `@/services/curriculumData`, and `miniEvalPreset` alongside `MINI_EVAL_*` from `@/services/miniEval`;
- change the params line to
  `const { classId, objectiveId: presetObjectiveId } = useLocalSearchParams<{ classId?: string; objectiveId?: string }>();`
- in the loading effect replace `if (candidates.length === 1) setBookId(candidates[0]!.id);` with:

```ts
      const preset = miniEvalPreset(presetObjectiveId, candidates.map(b => b.id), getObjectiveById);
      if (preset) {
        setBookId(preset.bookId);
        setObjectiveId(preset.objectiveId);
      } else if (candidates.length === 1) {
        setBookId(candidates[0]!.id);
      }
```
- add `presetObjectiveId` to that effect's dependency array: `[classId, presetObjectiveId]`.

- [ ] **Step 4: Pass** — the miniEval test passes; `pnpm test` (mobile) 0 fail; root typecheck 0 errors.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/miniEval.ts artifacts/mobile/services/__tests__/miniEval.test.ts artifacts/mobile/app/evaluations/mini.tsx
git commit -m "feat(mobile): quick check opens on an objective passed by the student record"
```

---

### Task 5: The screen, and the class row opens it

**Files:**
- Move: `artifacts/mobile/app/classes/[id].tsx` → `artifacts/mobile/app/classes/[id]/index.tsx` (`git mv`; contents unchanged except the row tap below — every import is `@/…`, and every link uses `pathname: '/classes/[id]'`, which still resolves)
- Create: `artifacts/mobile/app/classes/[id]/student/[studentId].tsx`
- Modify: `artifacts/mobile/services/i18n.ts` (Arabic block next to `studentNoteHint`; English block likewise)

**Interfaces:**
- Consumes: Task 3 (`getStudentRecord`, `focusObjectives`, `examStatusKey`, `formatDay`, `sittingsLine`, `worksheetAction`, `lessonAction`, `recheckAction`, `paperAction`, `StudentRecord`), `updateStudent` (`services/roster.ts`), `classQueryKey` (`services/rosterQueryKeys.ts`), `trackEvent` (`services/analytics.ts`), `goBack` (`services/navigation.ts`).
- Produces: route `/classes/[id]/student/[studentId]`.

- [ ] **Step 1: Move the class screen**

```bash
mkdir -p "artifacts/mobile/app/classes/[id]/student"
git mv "artifacts/mobile/app/classes/[id].tsx" "artifacts/mobile/app/classes/[id]/index.tsx"
```

Then in `app/classes/[id]/index.tsx` change the student row's `onPress={() => openNote(item)}` (~line 853) to

```tsx
              onPress={() =>
                router.push({ pathname: '/classes/[id]/student/[studentId]', params: { id, studentId: item.id } })
              }
```

The row's note icon (~line 903) keeps calling `openNote(item)`.

- [ ] **Step 2: i18n** — add to the Arabic block:

```ts
    studentRecordTitle: 'ملف الطالب',
    studentRecordNeedsSupport: 'يحتاج دعمًا',
    studentRecordAllClear: 'لا أهداف ضعيفة في هذا الصف. أضعف هدف حتى الآن:',
    studentRecordAllObjectives: 'كل الأهداف',
    studentRecordExams: 'الاختبارات',
    studentRecordNote: 'ملاحظة المعلم',
    studentRecordSaveNote: 'احفظ الملاحظة',
    studentRecordEmpty: 'يمتلئ هذا الملف حين تُصحَّح أوراق الطالب في هذا الصف.',
    studentRecordQuickCheck: 'تقييم سريع',
    studentRecordWorksheet: 'ورقة علاجية',
    studentRecordRecheck: 'تحقق سريع',
    studentRecordOpenLesson: 'افتح الدرس',
    studentRecordParent: 'رسالة لولي الأمر',
    studentRecordParentLinked: 'ولي أمر مرتبط',
    studentRecordProvisional: 'تصحيح أولي',
    studentRecordProvisionalNote: 'تشمل النسب أوراقًا بتصحيح أولي.',
    studentRecordNotSat: 'لم يقدّمه',
    studentRecordInProgress: 'قيد الحل',
    studentRecordSubmitted: 'بانتظار التصحيح',
    studentRecordMarked: 'مصحَّح',
    studentRecordNotFound: 'هذا الطالب ليس في هذا الصف.',
```

and to the English block:

```ts
    studentRecordTitle: 'Student record',
    studentRecordNeedsSupport: 'Needs support',
    studentRecordAllClear: 'No weak objectives in this class. Weakest so far:',
    studentRecordAllObjectives: 'All objectives',
    studentRecordExams: 'Exams',
    studentRecordNote: 'Teacher note',
    studentRecordSaveNote: 'Save note',
    studentRecordEmpty: "This record fills in as the student's papers in this class are marked.",
    studentRecordQuickCheck: 'Quick check',
    studentRecordWorksheet: 'Remedial worksheet',
    studentRecordRecheck: 'Quick re-check',
    studentRecordOpenLesson: 'Open lesson',
    studentRecordParent: 'Message parent',
    studentRecordParentLinked: 'Parent linked',
    studentRecordProvisional: 'Provisional',
    studentRecordProvisionalNote: 'Percentages include provisionally marked papers.',
    studentRecordNotSat: 'Not sat',
    studentRecordInProgress: 'In progress',
    studentRecordSubmitted: 'Awaiting marking',
    studentRecordMarked: 'Marked',
    studentRecordNotFound: 'This student is not in this class.',
```

- [ ] **Step 3: The screen** — `app/classes/[id]/student/[studentId].tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getStudentRecord, updateStudent } from '@/services/roster';
import { classQueryKey } from '@/services/rosterQueryKeys';
import { trackEvent } from '@/services/analytics';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';
import {
  examStatusKey, focusObjectives, formatDay, lessonAction, paperAction, recheckAction,
  sittingsLine, worksheetAction, type StudentRecordObjective,
} from '@/services/studentRecord';

const ACCENT = palette.primary;
const ACCENT_FILL = palette.hero;

export default function StudentRecordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const { id, studentId } = useLocalSearchParams<{ id: string; studentId: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['studentRecord', id, studentId],
    queryFn: () => getStudentRecord(id, studentId),
  });

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { if (data) setNote(data.student.teacherNote); }, [data]);
  useEffect(() => { trackEvent('student_record_opened', { classId: id }); }, [id]);

  const go = (kind: string, target: { pathname: string; params: Record<string, string> } | null) => {
    if (!target) return;
    trackEvent('student_record_action', { kind });
    router.push(target as never);
  };

  const saveNote = async () => {
    if (!data || savingNote) return;
    setSavingNote(true);
    try {
      await updateStudent(data.student.id, { teacherNote: note });
      void queryClient.invalidateQueries({ queryKey: classQueryKey(id) });
      void refetch();
    } finally {
      setSavingNote(false);
    }
  };

  const text = (style: object) => [style, { color: colors.foreground, textAlign: align }];

  const ObjectiveCard = ({ o }: { o: StudentRecordObjective }) => {
    const ws = worksheetAction(o);
    const lesson = lessonAction(o);
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={text(styles.cardTitle)}>{o.titleAr}</Text>
        {o.lessonTitleAr ? <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{o.lessonTitleAr}</Text> : null}
        <View style={[styles.barTrack, { backgroundColor: colors.muted }]} aria-label={`${Math.round(o.percent)}%`}>
          <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, o.percent))}%`, backgroundColor: o.percent < 60 ? colors.destructive : ACCENT, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        </View>
        <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
          {Math.round(o.percent)}% · {sittingsLine(o, lang)}
        </Text>
        <View style={[styles.actions, { flexDirection: row }]}>
          {ws ? <Pill label={t('studentRecordWorksheet')} onPress={() => go('worksheet', ws)} /> : null}
          <Pill label={t('studentRecordRecheck')} onPress={() => go('recheck', recheckAction(id, o))} />
          {lesson ? <Pill label={t('studentRecordOpenLesson')} onPress={() => go('lesson', lesson)} /> : null}
        </View>
      </View>
    );
  };

  const Pill = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.pill, { borderColor: ACCENT }]}>
      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  const focus = data ? focusObjectives(data.objectives) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={[styles.header, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => goBack()} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} hitSlop={10} accessibilityRole="button">
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { textAlign: align }]}>{data?.student.displayName ?? t('studentRecordTitle')}</Text>
        {data ? (
          <Text style={[styles.headerSub, { textAlign: align }]}>
            {data.className}{data.parent.linked ? ` · ${t('studentRecordParentLinked')}` : ''}
          </Text>
        ) : null}
      </View>

      {isLoading ? <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} /> : null}
      {error ? <Text style={[styles.empty, { color: colors.destructive, textAlign: align }]}>{t('studentRecordNotFound')}</Text> : null}

      {data && focus ? (
        <View style={{ padding: 20, gap: 20 }}>
          <View style={[styles.actions, { flexDirection: row }]}>
            <Pill
              label={t('studentRecordParent')}
              onPress={() => go('parent', { pathname: '/ai-tools/parent-message', params: { studentId: data.student.id, studentName: data.student.displayName } })}
            />
          </View>

          {data.objectives.length === 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={[styles.empty, { color: colors.mutedForeground, textAlign: align }]}>{t('studentRecordEmpty')}</Text>
              <View style={[styles.actions, { flexDirection: row }]}>
                <Pill label={t('studentRecordQuickCheck')} onPress={() => go('recheck', { pathname: '/evaluations/mini', params: { classId: id } })} />
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={text(styles.section)}>{t('studentRecordNeedsSupport')}</Text>
              {focus.allClear ? <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{t('studentRecordAllClear')}</Text> : null}
              {focus.shown.map(o => <ObjectiveCard key={o.objectiveId} o={o} />)}
              {data.provisionalCount > 0 ? <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{t('studentRecordProvisionalNote')}</Text> : null}

              <Pressable onPress={() => setShowAll(v => !v)} accessibilityRole="button" aria-expanded={showAll} style={[styles.toggle, { flexDirection: row }]}>
                <Text style={text(styles.section)}>{t('studentRecordAllObjectives')} ({data.objectives.length})</Text>
                <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </Pressable>
              {showAll ? data.objectives.map(o => (
                <View key={o.objectiveId} style={[styles.listRow, { flexDirection: row, borderColor: colors.border }]}>
                  <Text style={[{ flex: 1, color: colors.foreground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{o.titleAr}</Text>
                  <Text style={{ color: o.percent < 60 ? colors.destructive : colors.foreground, fontFamily: 'ReadexPro_500Medium' }}>{Math.round(o.percent)}%</Text>
                </View>
              )) : null}
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Text style={text(styles.section)}>{t('studentRecordExams')}</Text>
            {data.exams.map(e => {
              const paper = paperAction(e, data.student.id);
              const body = (
                <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={{ flexDirection: row, justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[text(styles.cardTitle), { flex: 1 }]}>{e.title}</Text>
                    <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>
                      {e.percent !== null ? `${Math.round(e.percent)}%` : '—'}
                    </Text>
                  </View>
                  <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
                    {formatDay(e.createdAt)} · {t(examStatusKey(e.status))}{e.provisional ? ` · ${t('studentRecordProvisional')}` : ''}
                  </Text>
                  {e.teacherComment ? <Text style={[styles.comment, { color: colors.foreground, textAlign: align, borderColor: colors.border }]}>{e.teacherComment}</Text> : null}
                </View>
              );
              return paper ? (
                <Pressable key={e.evaluationId} onPress={() => go('paper', paper)} accessibilityRole="button">{body}</Pressable>
              ) : (
                <View key={e.evaluationId}>{body}</View>
              );
            })}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={text(styles.section)}>{t('studentRecordNote')}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              aria-label={t('studentRecordNote')}
              style={[styles.note, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, textAlign: align }]}
            />
            <Pressable
              onPress={saveNote}
              disabled={savingNote || note === data.student.teacherNote}
              aria-disabled={savingNote || note === data.student.teacherNote}
              aria-busy={savingNote}
              accessibilityRole="button"
              style={[styles.save, { backgroundColor: ACCENT_FILL, opacity: savingNote || note === data.student.teacherNote ? 0.5 : 1, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
            >
              <Text style={{ color: '#fff', fontFamily: 'ReadexPro_500Medium' }}>{t('studentRecordSaveNote')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 18, gap: 6 },
  headerTitle: { color: '#fff', fontSize: 22, fontFamily: 'ReadexPro_700Bold' },
  headerSub: { color: '#fff', opacity: 0.9, fontSize: 14, fontFamily: 'Almarai_400Regular' },
  section: { fontSize: 16, fontFamily: 'ReadexPro_600SemiBold' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  cardTitle: { fontSize: 15, fontFamily: 'ReadexPro_500Medium' },
  meta: { fontSize: 13, fontFamily: 'Almarai_400Regular' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  actions: { flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  toggle: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  listRow: { alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  comment: { fontSize: 13, fontFamily: 'Almarai_400Regular', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  note: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 90, fontFamily: 'Almarai_400Regular', fontSize: 14 },
  save: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  empty: { fontSize: 14, fontFamily: 'Almarai_400Regular', marginTop: 8 },
});
```

Check against the codebase before committing: `palette.primary`, `palette.hero`, `colors.muted`, `colors.card`, `colors.border`, `colors.destructive`, `colors.mutedForeground` exist (they are used by `app/evaluations/mini.tsx` and `app/classes/[id]/index.tsx`); if `colors.muted` does not exist use `colors.border` for the bar track. `trackEvent`'s event-name type may be a union — if so, add `'student_record_opened' | 'student_record_action'` to it in `services/analytics.ts`.

- [ ] **Step 4: Verify** — `cd artifacts/mobile && pnpm test` (0 fail, includes `ariaState.test.ts`); root `pnpm run typecheck` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add -A "artifacts/mobile/app/classes" artifacts/mobile/services/i18n.ts artifacts/mobile/services/analytics.ts
git commit -m "feat(mobile): student record screen; a class's student row opens it"
```

---

### Task 6: Running-app check, STATUS.md, PR

- [ ] **Step 1: Local stack** — Postgres + `pnpm run dev:api` + `pnpm run dev:mobile:web`; a verified teacher; a class with ≥2 students; a published quick evaluation attached to the class with one student's paper marked (low score on its objective) and the other student not sat.
- [ ] **Step 2: Check, in the browser:**
  - tapping the marked student's row opens the record; header shows class name;
  - «يحتاج دعمًا» lists the weak objective with its lesson and «في ورقة · آخرها …»;
  - «ورقة علاجية» opens the worksheet screen on the lesson's own subject (not maths for a chemistry lesson);
  - «تحقق سريع» opens the quick check with the objective already selected;
  - «افتح الدرس» opens the lesson page;
  - the exam row opens the paper; a `not_sat` row is not tappable and opening the record creates no attempt (count `attempts` rows before/after);
  - the note saves and the class screen's note icon shows the same text;
  - the other student's record shows the empty state;
  - a student id from another class → «هذا الطالب ليس في هذا الصف.»;
  - the row's note icon still opens the note modal.
- [ ] **Step 3: STATUS.md** — a dated section «The student record: one student's objectives and papers in a class, 2026-10-08» (what shipped, the decisions table from the spec, what was verified, what was not), and update the line «**Deliberately not built:** a per-student exam history.» to point at it.
- [ ] **Step 4: Push, update PR NizarAbuahmad/Iqraa#920's description, mark ready when green.**
