# Schedule, homework, exams & results for students and parents — design

Date: 2026-10-11 · Status: design approved in conversation, awaiting spec review

## Why

A teacher can build their own timetable and run digital exams, but a student or
parent sees almost nothing: three tabs (Resources, Alerts, Profile) plus
`my-exams.tsx`. Families need to see the class **schedule**, **homework**,
**exams** and **results**, and the teacher is the one who enters all of it. A
parent sees each of their children.

This is four sub-projects, shipped in order, each with its own migration and PR.
Each gets its own implementation plan (`writing-plans`) when its turn comes:

| # | Part | Scope |
| --- | --- | --- |
| 0 | Foundation | Shared family-access helper; "School" tab for students and parents |
| 1 | Schedule | Read-only class timetable, assembled from teachers' slots |
| 2 | Homework | New entity: teacher posts, student marks done, parent watches |
| 3 | Exams & results | Exam date, paper marks, release, per-child results |
| 4 | Notifications | Push for the four events below; scheduled trigger for reminders |

## Decisions taken

| Question | Decision |
| --- | --- |
| How is the class timetable created | **Assembled** from each teacher's own `schedule_slots` for that class. No second place to enter it |
| What homework is | Simple assignment: title, instructions, due date, optional link to an existing digital exam/worksheet |
| What a student can do with homework | Mark it done / not done. No uploads, no grading |
| What a parent can do with homework | Read only, per child, with that child's done state |
| Paper vs digital exams | One exam record (`evaluations`) for both. Teacher types paper marks |
| When marks are visible | Only after the teacher releases them (`releaseResultsToStudent`), same as digital exams today |
| Push notifications | Homework posted · homework due tomorrow and not done · exam scheduled/changed · results released |

Rejected: a teacher-entered whole-class timetable (a second thing to keep in
sync, and it needs one teacher to know every other teacher's periods); a
read-only homework notice (teacher gets no feedback); photo/file submission
(needs child-upload storage and moderation — a project of its own); a separate
paper-exam table (families would get two lists of exams and results).

## What exists

- Timetable: `lib/db/src/schema/schedule.ts` (`schedule_periods`,
  `schedule_slots`), teacher-only router `routes/schedule.ts`. Mobile
  `app/schedule/*`, `services/schedule.ts`.
- Roster and links: `class_groups`, `students`, `class_memberships`,
  `roster_links` (`self` / `guardian`).
- Student/parent API template: `routes/studentExams.ts` — `/student` and
  `/parent` guarded by `requireRole`. Parent scoping is inline (guardian link,
  student not archived); `selfLinkedStudentIds()` serves students.
- Exams: `evaluations.releaseResultsToStudent`, `evaluation_assignments.dueAt`,
  `attempts.source` (`teacher_entry | student_link`). `evaluations` has **no
  exam-date column**.
- `lib/resultsReleaseNotify.ts#announceResultsRelease` already pushes to
  children and guardians; `lib/pushNotifications.ts` is the Expo push layer.
- Mobile gating: `services/routeGating.ts` (`NON_TEACHER_ROUTES`,
  deny-by-default) and `buildTabEntries` in `app/(tabs)/_layout.tsx`.
- Nothing for homework, standalone grades or attendance. No scheduler in the API
  server. Student/parent accounts sit behind `STUDENT_ACCOUNTS=true`
  (`lib/features.ts`), which is currently `true` in production (STATUS.md,
  2026-09-07).

## 0. Foundation

1. **`api-server/src/lib/familyAccess.ts`** — `selfLinkedStudentIds(userId)`
   and `guardianLinkedStudents(userId)` (self link for students, guardian links
   for parents, non-archived), extracted from the inline queries in
   `studentExams.ts` and used by every new route; the class lookup lives in
   `lib/familyScheduleLoad.ts` rather than a separate `classIdsForStudents`.
   `studentExams.ts` moves onto it with its existing tests as the safety net.
2. **Parents with several children** get a child picker (the per-child section
   pattern of `my-exams.tsx`). Filter by roster link, never by a display
   preference — STATUS.md records results being lost that way.
3. **"School" (المدرسة) tab** for student and parent in `buildTabEntries`,
   showing the timetable, with a row to «اختباراتي»; Part 2 adds a Homework
   section (no segment control while there is one list and one link).
   `app/(tabs)/school.tsx`, an
   `iconNameFor` case, ar + en i18n keys, sub-routes added to
   `NON_TEACHER_ROUTES` and `routeGating.test.ts`. `my-exams` stays reachable
   from the Exams segment.

## 1. Schedule

No new tables. `routes/familySchedule.ts`, mounted path-scoped at
`/student/schedule` and `/parent/schedule` behind the existing role guards, with
a case in `mountOrder.test.ts`.

- Read `schedule_slots` where `classGroupId` is one of the child's classes; join
  `schedule_periods` on (teacherId, schoolName, periodNumber) for times; subject
  from the slot or class; teacher display name.
- Response: a week grid per child (`dayOfWeek` 0 = Sunday); each cell has
  period, start/end, subject, teacher.
- **Teachers' slot notes are private and are NOT sent to families.**
  `schedule_slots.notes` is a note in the teacher's own timetable; nothing told
  teachers families could read it, and notes can concern individual children. If
  notes are ever shown to families it must be a deliberate, separately-labelled
  teacher field, not these.
- **A class with no slots returns an explicit empty state** saying the teachers
  have not entered it, never an empty grid that reads as a free week.
- Teachers define period times independently, so each slot carries its own
  teacher's times; they are not merged.
- **A class has one teacher**, so a family sees the slots of every class their
  linked roster rows sit in — the union across teachers, not a whole-class
  timetable. An account linked to only one teacher's class sees only that
  teacher's periods. Parents' roster rows are grouped into children by name
  (`modules/family/children.ts`) so one child under two teachers is one entry.
- The mobile fetchers live in their own file, `services/familyScheduleApi.ts`,
  split from the pure `services/familySchedule.ts`: `apiClient.ts` pulls
  `react-native` into module scope, which the bare `node --test` runner cannot
  load, so the logic stays importable by tests.
- Teacher side: **Deferred — not built in Parts 0–1; candidate for the next plan:**
  a one-line hint in `classes/[id]` ("N periods in this class's timetable") so
  teachers know what families see.
- Pure logic lives in `services/familySchedule.ts`, tested like
  `scheduleCalendar.ts`.

## 2. Homework

New `lib/db/src/schema/homework.ts`, exported from `index.ts`; additive, so no
`destructive-migration` flag.

- `homework`: id, teacherId, classGroupId, title, instructions, dueAt,
  `evaluationId` (nullable), createdAt, updatedAt, archivedAt.
- `homework_completions`: homeworkId, studentId, doneAt; unique
  (homeworkId, studentId).

`routes/homework.ts`, every guard path-scoped:

- Teacher: `POST/GET/PATCH/DELETE /homework`, `GET /classes/:id/homework` (with
  done counts). Ownership through `findLiveClass`; the same 404 for "not yours"
  and "missing".
- Student: `GET /student/homework`, `PUT/DELETE /student/homework/:id/done`, only
  for homework of a class the student belongs to.
- Parent: `GET /parent/homework` grouped per child. Cannot mark done.
- Pure rules (visibility, overdue, done state) in `modules/homework/` with unit
  tests.

Mobile: a Homework section and create/edit modal in `classes/[id]` (the modal
wraps its body in `KeyboardSafeView`); attaching a worksheet reuses the
`SendWorksheetSheet` → `fromWorksheet` flow and stores the resulting
`evaluationId`. Families get the Homework segment; students get the toggle.

## 3. Exams & results

- Additive migration: `evaluations.sitting_at timestamptz NULL`, the exam date.
  Set on create/edit; returned by `/student/exams` and `/parent/exams`; shown as
  an "upcoming" list and on the calendar.
- Paper exams reuse `setPaperQuestions`, `scanMarks` and
  `attempts.source = teacher_entry`. **First task of this part:** read
  `evaluations/[id]/results` and `answers/[studentId]` and confirm whether a
  per-class marks-entry grid is missing before building one.
- Visibility stays gated by `releaseResultsToStudent` and shaped by
  `studentExamRow` / `guardianExamRow`, so a parent never sees what the child
  cannot.
- A per-child results view built on `/student/grades` — check what it already
  returns first. No term averages or report cards.

## 4. Notifications

- Homework posted and exam scheduled/changed: pushed from the create/update
  handlers through `lib/pushNotifications.ts` to the class's students and their
  guardians, resolved with the Part 0 helper.
- Results released: `announceResultsRelease` already does it; extend to paper
  marks.
- **Homework due tomorrow, not done:** the API server has no scheduler. Use Cloud
  Scheduler calling `POST /internal/homework-reminders`, guarded by a
  shared-secret header, mounted with a path prefix and covered in
  `mountOrder.test.ts`. Idempotent: record the reminder per homework and day so a
  double fire sends nothing twice. Its own PR, after the rest of Part 2.
- Follow the existing push policy (`services/pushPolicy.ts`) for opt-outs and
  quiet hours.

## Testing

- API: `pnpm build && pnpm test` in `artifacts/api-server`. Must cover: a parent
  cannot read another family's child; a student cannot read another class's
  homework; a teacher cannot edit another teacher's homework; results hidden
  until released; unowned paths still 404, not 401.
- Mobile: logic in pure `services/*.ts` with tests in `services/__tests__/`;
  update `routeGating.test.ts`; keep `i18n.test.ts` green.
- `pnpm run typecheck`; migrations generated with
  `pnpm --filter @workspace/db run generate`.
- End to end locally: teacher posts homework, sets an exam date, enters paper
  marks; a parent with two children sees each child's schedule, homework, exam
  and (after release) result and nothing from another family; a student marks
  homework done and the teacher's count updates.
- `STATUS.md` updated in the same PR as each part.

## Risks and open items

1. `STUDENT_ACCOUNTS` is already `true` in production (STATUS.md, 2026-09-07), so
   this feature reaches real parent and student accounts on merge. The School tab
   has not been viewed on a device or browser; check it on a signed-in parent and
   student account right after deploy.
2. The assembled schedule is only as complete as teacher adoption.
3. The reminder needs new infrastructure (Cloud Scheduler + internal endpoint).
   If unwanted, drop that one notification.
4. Out of scope: attendance, report cards / term averages, file uploads, a
   school-admin view, homework grades. Each would be its own spec.
