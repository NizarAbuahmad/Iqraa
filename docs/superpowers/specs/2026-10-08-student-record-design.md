# Student record (ملف الطالب) — design

Date: 2026-10-08 · Status: approved in conversation, awaiting spec review

## Why

A teacher can see that the class is weak on an objective (`GET
/classes/:id/mastery`, the exams tab), but not that *this* student has missed
it in three papers since September. Tapping a student today only edits a note
(`app/classes/[id].tsx`, `openNote`). STATUS.md records the per-student exam
history as "deliberately not built … worth a decision", together with the two
look-alike note boxes (`students.teacher_note`, `attempts.teacher_comment`).
This feature makes that decision.

**Main job: plan remediation.** The screen leads with the objectives this
student keeps missing, each with something to do about it.

## Decisions taken

| Question | Decision |
| --- | --- |
| Main job | Plan remediation (not parent meetings or term reports) |
| Scope | This class's evaluations only |
| Actions on a weak objective | Remedial worksheet, quick re-check, open the lesson |
| Architecture | Approach A: one new route returning the whole record |
| Provisional papers | Counted in the rollup, as the class view does; the count is shown |
| Entry point | Tapping a student row opens the record; the row's note icon still edits the note |
| Parent | Link to the existing parent-message screen; no marks are pulled into it |

## 1. Route

`GET /classes/:id/students/:studentId/record`, in `routes/roster.ts`, under the
router's existing path-scoped guard on `/classes` (teacher roles, roster
consent). No new middleware.

**Access.** `findLiveClass(classId, teacherId)` must succeed, and the student
must have a `class_memberships` row for this class and no `archivedAt`.
Anything else is 404, which does not say whether the student exists.

**Response** (`StudentRecord`):

```ts
{
  student: { id, displayName, teacherNote, gender, linked: boolean },
  className: string,
  exams: Array<{
    evaluationId, title, createdAt,
    status: 'not_sat' | 'in_progress' | 'submitted' | 'marked',
    attemptId: string | null,
    earned: number | null, total: number | null, percent: number | null,
    provisional: boolean,
    teacherComment: string | null,
    submittedAt: string | null,
  }>,                       // newest first
  objectives: Array<{
    objectiveId, titleAr, lessonId: string | null,
    earned, total, percent,
    sittings: number,       // papers that tested it
    lastSeenAt: string,     // most recent of those papers
  }>,                       // weakest first
  provisionalCount: number, // marked papers still provisional
  parent: { linked: boolean, lastContact: { kind, channel, at } | null },
}
```

- `exams` = every non-archived evaluation with `classGroupId = classId`, left
  joined to this student's attempt and result. `not_sat` has no `attemptId`.
- `objectives` = `aggregateClass` over this student's results in those
  evaluations, unchanged: marks-weighted (sum earned ÷ sum total), not a mean
  of percentages. Titles via `resolveObjectiveIds`. `lessonId` from the
  curriculum objective (`getObjectiveById(id).lessonId`; an objective id is an
  outcome id like `o-nccd-…-<lesson>-<n>`, never a lesson id).
- **Weak** = below 60%, the gap line `classInsights.ts` already uses. The route
  returns percentages; the client draws the line with its own
  `WEAK_PERCENT = 60` in `services/studentRecord.ts` (the app cannot import
  the server module), and a mobile test pins it to 60 with a comment naming
  the server constant it mirrors.
- `parent.lastContact` = the newest `parent_contacts` row for the student.

**Pure core.** `studentRecord(rows, …)` in
`artifacts/api-server/src/modules/assessment/studentRecord.ts` builds `exams`,
`objectives` and `provisionalCount` from plain rows. The route only fetches.
No database change.

## 2. Screen

New teacher-only screen, opened from the class screen with the class id and
the student id. The exact route file is settled in the plan; it must sit
under a teacher-only path (`routeGating`: not in `NON_TEACHER_ROUTES`).

Top to bottom, Arabic, RTL:

1. **Header** — student name, class name, «ولي أمر مرتبط» when linked;
   «رسالة لولي الأمر».
2. **«يحتاج دعمًا»** — objectives below 60%, weakest first. Each card:
   objective title, its lesson's title, a percentage bar, «في N أوراق · آخرها
   ‹date›», and three actions. With none below 60%: «لا أهداف ضعيفة في هذا
   الصف» and the weakest objective shown anyway.
3. **«كل الأهداف»** — collapsed list of every objective with its percentage.
4. **«الاختبارات»** — each exam: title, date, status, score; «تصحيح أولي»
   when provisional; the paper's teacher comment underneath. A row with a
   paper opens `/evaluations/[id]/answers/[studentId]`. A `not_sat` row is not
   tappable — that screen's mount effect would create a blank attempt.
5. **«ملاحظة المعلم»** — the running note, editable in place.

**Empty state** (no marked paper): one line saying the record fills as papers
are marked, and «تقييم سريع» for this class.

**Class screen change:** the student row's `onPress` opens the record; the
note icon keeps opening the existing note modal.

## 3. Actions

- **«ورقة علاجية»** → `/ai-tools/worksheet` with `topic` = the lesson's title
  and `...lessonPickerParams(lessonId, 'ar')`, so the generator gets the
  lesson's own grade and subject. Hidden when `lessonId` is null or
  `lessonPickerParams` returns null. (CLAUDE.md: generators branch on the
  subject name, and picker indices must come from the lesson.)
- **«تحقق سريع»** → `/evaluations/mini` with `classId` and a new optional
  `objectiveId`. The mini screen, given one, selects that objective's book and
  the objective, so the teacher lands one tap from «جهّز». The rest of the flow
  (create, review, publish) is unchanged.
- **«افتح الدرس»** → `/curriculum/lesson-detail?lessonId=…`. Hidden when
  `lessonId` is null.
- **«رسالة لولي الأمر»** → the existing `/ai-tools/parent-message` with
  `studentId` and `studentName`. It still pulls no marks into the letter
  (`parent-message.tsx` — marks can be provisional and partly AI-derived).
- **Note** → `updateStudent(id, { teacherNote })`, then the class roster query
  is invalidated so the class screen shows it.

Analytics: `student_record_opened { classId }` and
`student_record_action { kind: 'worksheet' | 'recheck' | 'lesson' | 'parent' | 'paper' }`.
No student name or id in events.

## 4. Testing

- **Server** (`modules/assessment/__tests__/studentRecord.test.ts`, beside
  `classInsights.test.ts`): marks-weighted rollup across papers; `sittings` and
  `lastSeenAt`; provisional papers counted and `provisionalCount` reported;
  `not_sat` exams with no attempt; newest-first exams and weakest-first
  objectives; `lessonId` from the objective id; an unknown objective id keeps
  `lessonId: null`.
- **Route guard:** a case in `routes/__tests__/mountOrder.test.ts` for the new
  path (unauthenticated → 401 from the roster guard, not a 404 from elsewhere).
- **Mobile** (`services/__tests__/studentRecord.test.ts`, logic in plain
  `services/studentRecord.ts`): weak/other split at 60%; the empty-state rule;
  exam status labels and which rows are tappable; each action's params,
  including hiding worksheet/lesson when the lesson can't be resolved and the
  worksheet params carrying the lesson's own subject.
- **Mini screen param:** the objective → book selection is a pure helper with a
  test.
- **Running app:** seeded class, a student with marked and unmarked papers:
  open the record; weak objectives listed; each action lands with the right
  subject and grade; a paper opens; a `not_sat` row does not create an
  attempt; the note saves and shows on the class screen; a non-member student
  id is 404.
- **STATUS.md:** a dated entry, and the "per-student exam history deliberately
  not built" line updated.

## Out of scope

Cross-class or cross-subject history; parent-facing progress summaries with
marks; term-report writing; per-student charts over time; changing how
provisional marking works; the competency (Bloom) view per student.
