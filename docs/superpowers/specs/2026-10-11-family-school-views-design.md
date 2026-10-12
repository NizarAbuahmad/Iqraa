# Schedule, homework, exams & results for students and parents — design

Date: 2026-10-11 · Status: Parts 0–2 built (Part 2 on 2026-10-12, with a final-review fix wave); Part 3 is half built — the exam date and a school-wide exam calendar shipped separately (PR #1017, below) — and Parts 3 (family side, paper marks) and 4 are not started

## Why

A teacher can build their own timetable and run digital exams, but a student or
parent sees almost nothing: three tabs (Resources, Alerts, Profile) plus
`my-exams.tsx`. Families need to see the class **schedule**, **homework**,
**exams** and **results**, and the teacher is the one who enters all of it. A
parent sees each of their children.

This is four sub-projects, shipped in order, each with its own migration and PR.
Each gets its own implementation plan (`writing-plans`) when its turn comes:

| # | Part | Scope | State |
| --- | --- | --- | --- |
| 0 | Foundation | Shared family-access helper; "School" tab for students and parents | Built |
| 1 | Schedule | Read-only class timetable, assembled from teachers' slots | Built |
| 2 | Homework | New entity: teacher posts, student marks done, parent watches | Built, 2026-10-12 (no notifications yet — Part 4) |
| 3 | Exams & results | Exam date, paper marks, release, per-child results | Teacher-side exam date + school exam calendar built (PR #1017); families seeing the date, paper marks, release, per-child results not started |
| 4 | Notifications | Push for the four events below; scheduled trigger for reminders | Not started |

## Decisions taken

| Question | Decision |
| --- | --- |
| How is the class timetable created | **Assembled** from each teacher's own `schedule_slots` for that class. No second place to enter it |
| What homework is | Simple assignment: title, instructions, due date, optional link to an exam already attached to the class (an exam only — a worksheet has to be sent as an exam first) |
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
  `attempts.source` (`teacher_entry | student_link`). Since PR #1017 (STATUS.md,
  «Exams have a date, and teachers at one school can see each other's»)
  `evaluations` also has `exam_date` / `exam_time` text columns, and there are a
  `schools` table, `users.school_id` and a teacher-only `GET /exam-calendar`.
  `/student/exams` and `/parent/exams` do not return the date yet.
- `lib/resultsReleaseNotify.ts#announceResultsRelease` already pushes to
  children and guardians; `lib/pushNotifications.ts` is the Expo push layer.
- Mobile gating: `services/routeGating.ts` (`NON_TEACHER_ROUTES`,
  deny-by-default) and `buildTabEntries` in `app/(tabs)/_layout.tsx`.
- Homework did not exist when this was written and is Part 2 (built). Still
  nothing for standalone grades or attendance. No scheduler in the API server. Student/parent accounts sit behind `STUDENT_ACCOUNTS=true`
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
   showing the timetable, with a row to «اختباراتي»; Part 2 put a Homework
   section above the timetable, each under its own heading, with the page titled
   «المدرسة» (no segment control while there is one list and one link).
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

- `homework`: id, teacherId, classGroupId (NOT NULL, cascades), title,
  instructions, dueAt, `evaluationId` (nullable, `set null` on exam delete),
  createdAt, updatedAt, archivedAt.
- `homework_completions`: homeworkId, studentId, doneAt; unique
  (homeworkId, studentId). `studentId` is a **roster row** (`students.id`), not
  an account: a child with two accounts linked to the same row shares their
  done marks.
- **The due date is a calendar day, not a timestamp.** The API takes and
  returns `dueDate: "YYYY-MM-DD"`. The server stores `dueAt` as 23:59:59.999 on
  that day in Asia/Amman (a fixed UTC+3 since Jordan dropped DST in 2022) and
  also returns `dueAt` as ISO. Clients never do timezone arithmetic for it.

Routes, every guard path-scoped (`routes/homework.ts`, `routes/familyHomework.ts`):

- Teacher: `POST /homework` (with `classGroupId` in the body),
  `GET /classes/:id/homework` (with done and student counts, and
  `trackableCount`: the students who have an account and so can tick),
  `PATCH /homework/:id`, `DELETE /homework/:id` (archives). Ownership through
  `findLiveClass`; the same 404 for "not yours" and "missing". The create is
  `POST /homework`, not `POST /classes/:id/homework`, because the latter would
  inherit the roster router's `requireRosterConsent` gate, which is about
  entering child data and has nothing to do with homework.
- Student: `GET /student/homework`, `PUT|DELETE /student/homework/:id/done`,
  only for homework of a live class one of the student's `self`-linked roster
  rows sits in.
- Parent: `GET /parent/homework`, grouped per child (the same grouping as the
  schedule), each entry `{ key, displayName, canTrack, homework }`. Read-only: a
  parent cannot mark done. **`canTrack` is decided per item**, because ticking is per
  class: each homework item carries `canTrack`, true iff a roster row of the child that
  is a member of *that item's class* has a student account (a `self` link). When it is
  false nobody can tick that item, so the app shows the due date only — never «متأخّر»
  or a done mark — and, if every visible item is like that, drops the «المطلوب» heading.
  The entry's own `canTrack` is an informational aggregate (any item trackable; with no
  items, any live row has an account). Student items are always `canTrack: true`.
- `STUDENT_ACCOUNTS` gate: the student and parent handlers answer
  `403 { code: "student_accounts_disabled" }` when the flag is off, as
  `routes/familySchedule.ts` does.
- Pure rules (input parsing, date conversion, state, the family list builder)
  in `modules/homework/` with unit tests.

What a family sees:

- **Recent homework only:** `dueAt` within the last 14 days or later, and of
  those the **200 earliest-due** (`ORDER BY due_at ASC LIMIT 200` in
  `lib/familyHomeworkLoad.ts`). The limit applies per call, so it is **per child for
  a parent** (each child is loaded separately) and account-wide only for a student. Older work drops off rather than accumulating. Earliest-due is the right
  set to keep: if a family is ever over the limit, what gets cut is the work due
  furthest away, which nobody can act on yet, and never the work due this week. (An
  earlier draft of this spec said "newest 200"; that is not what the code does, and
  a limit that kept the latest-due would have done the opposite.)
- **An attached exam's title is shown only when that exam is `published`, not
  archived, and in the homework's own class**; a draft's title is not for
  children. Tapping it opens the existing «اختباراتي» screen, which applies the
  real visibility rules.
- State is `done`, `overdue` (past the due day and not done) or `open`.

**Attaching an exam = picking one already attached to the class.** The attached
exam must be one of this teacher's, not archived, with `classGroupId` equal to
the homework's class; anything else is one indistinguishable 400. The server
accepts any such live exam (draft included); the mobile picker offers only
**published** ones, since a draft's title is hidden from families anyway. A PATCH
that leaves the link as it is does not re-check it, so a homework stays editable
after its exam is archived or moved.

**The due date has a window:** `dueDate` must be within the last 30 days and the
next 366 days (Amman calendar days), else 400 with `code: "due_date_out_of_range"`.
A PATCH that resends the stored due date unchanged is not re-bounded, so an old
homework stays editable; a changed date is. The API accepts only
`YYYY-MM-DD`; the app displays it as `DD-MM-YYYY` in a left-to-right isolate. (Creating an
exam from a worksheet, `SendWorksheetSheet` → `fromWorksheet`, is a separate
flow and a separate project, so homework does not reuse it.)

Mobile: a «الواجبات» tab and create/edit modal in `classes/[id]` (the modal
wraps its body in `KeyboardSafeView`; `components/classes/HomeworkTab.tsx`). The
teacher's "N of M done" counts against `trackableCount`, with a muted
"K without an account" line, and no bar at all when nobody has an account. The
class screen's tab row scrolls horizontally when four tabs do not fit. Families
get a Homework section above the timetable on the School tab
(`app/(tabs)/school.tsx`); students get the toggle, parents the read-only list
per child.

## 3. Exams & results

**Already built, separately (PR #1017; STATUS.md «Exams have a date, and teachers
at one school can see each other's, 2026-10-11»).** This part builds on it
instead of adding its own column:

- `evaluations.exam_date` (`"YYYY-MM-DD"`) and `exam_time` (`"HH:MM"`), both
  nullable **text**, set from the evaluation screen through `PATCH
  /evaluations/:id` (`lib/examDate.ts`: `null` clears; a time needs a date).
  Planning data only — it does not open or close the student link.
- `schools` and `users.school_id`, assigned by a platform admin
  (`system_admin` only); teachers at one school see each other's dated exams
  (date, time, grade, subject, class name, teacher name — never id, title or
  content) through the **teacher-only** `GET /exam-calendar`, and get a warning
  when a grade would sit two exams on one day.
- The earlier plan for this part, an additive `evaluations.sitting_at
  timestamptz`, is dropped: the date exists, in the other shape.

**Still to do in this part:**

- **Show the date to families.** `/student/exams` and `/parent/exams` do not
  return `examDate` / `examTime` yet. Add them through `studentExamRow` /
  `guardianExamRow`, so a date appears only for an exam the child may already
  see — a draft that has been given a
  date for planning must not leak through the date. Then an "upcoming" list on
  the School tab. Families do not get `/exam-calendar`: it is the teachers'
  cross-colleague view and is guarded as such.
- Paper exams reuse `setPaperQuestions`, `scanMarks` and
  `attempts.source = teacher_entry`. **First task of this part:** read
  `evaluations/[id]/results` and `answers/[studentId]` and confirm whether a
  per-class marks-entry grid is missing before building one.
- Visibility stays gated by `releaseResultsToStudent` and shaped by
  `studentExamRow` / `guardianExamRow`, so a parent never sees what the child
  cannot.
- A per-child results view built on `/student/grades` — check what it already
  returns first. No term averages or report cards.

**A school day is stored two ways**, and anything that compares them (the Part 4
reminders, an "upcoming" list that mixes homework and exams) has to handle both:
an exam's day is the text pair `exam_date` / `exam_time` with no zone (the
teacher's local calendar day, like the schedule and plan tables), while a
homework's day is a `timestamptz` at 23:59:59.999 Asia/Amman. Compare exam days
as `YYYY-MM-DD` strings and homework days through their Amman date; never
`toISOString()` an exam date, which shifts it to UTC near midnight.

## 4. Notifications

- Homework posted and exam scheduled/changed: pushed from the create/update
  handlers through `lib/pushNotifications.ts` to the class's students and their
  guardians, resolved with the Part 0 helper.
- Results released: `announceResultsRelease` already does it; extend to paper
  marks.
- Exam scheduled/changed has a hook already: `exam_date` / `exam_time` are
  written by `PATCH /evaluations/:id`. Note the two day representations in Part
  3 (text exam day, Amman end-of-day homework instant) before writing any
  "tomorrow" logic that covers both.
- **Part 4 will need a "roster row → accounts" lookup.** `lib/familyAccess.ts`
  has account → roster rows helpers plus a rows → "has any student account"
  existence check (`studentIdsWithSelfAccount`); a push to "the class's students
  and their guardians" has to return the *users* (class → rows → `self` /
  `guardian` links → user ids), and that helper does not exist yet.
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
   and the homework screens were rendered in headless Chromium (create, edit,
   delete and tick exercised through the UI against a seeded database), but never
   on a device or by a real account; check them on a
   signed-in parent and student account right after deploy.
2. The assembled schedule is only as complete as teacher adoption.
3. The reminder needs new infrastructure (Cloud Scheduler + internal endpoint).
   If unwanted, drop that one notification.
4. Out of scope: attendance, report cards / term averages, file uploads, a
   school-admin view, homework grades. Each would be its own spec.
