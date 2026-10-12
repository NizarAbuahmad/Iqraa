# Schedule, homework, exams & results for students and parents — design

Date: 2026-10-11 · Status: Parts 0–4 built (Part 2 on 2026-10-12, with a final-review fix wave; Part 3 on 2026-10-12, on top of the exam date and school exam calendar that shipped separately in PR #1017; Part 4 (notifications) on 2026-10-12 (the reminder is inert until the owner creates `INTERNAL_CRON_KEY` and the scheduler job))

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
| 2 | Homework | New entity: teacher posts, student marks done, parent watches | Built, 2026-10-12 (its pushes are Part 4) |
| 3 | Exams & results | Exam date, paper marks, release, per-child results | Built, 2026-10-12 (teacher-side exam date + school exam calendar shipped earlier in PR #1017) |
| 4 | Notifications | Push for the four events below; scheduled trigger for reminders | Built, 2026-10-12 (the reminder is inert until the owner creates `INTERNAL_CRON_KEY` and the scheduler job) |

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
  Part 3 (below) returns the date to families through `/student/exams` and
  `/parent/exams`; families still do not get `/exam-calendar`.
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

**Built in this part (2026-10-12):**

- **Families see the date.** `/student/exams` and `/parent/exams` rows carry
  `examDate` (`"YYYY-MM-DD"` or `null`), `examTime` (`"HH:MM"` or `null`) and
  `paper` (boolean), all added in `studentExamRow` (`modules/assessment/studentExams.ts`),
  so a date appears only on an exam the child may already see: the loader
  (`examRowsFor`, `routes/studentExams.ts`) lists published or closed exams of
  the child's live classes plus any exam the child already holds a sitting on, so
  a dated draft and a dated exam with no class reach nobody (pinned by
  `familyExams.db.test.ts`). `/parent/exams` keeps one entry per roster row, and
  each entry now also carries `key`, the `groupChildren` key that
  `/parent/homework` and `/parent/schedule` use, so the School tab can put one
  child's rows from two teachers under one name. Families do not get
  `/exam-calendar`: it is the teachers' cross-colleague view and is guarded as such.
- **«الاختبارات القادمة»** is a section of the School tab between homework and
  the timetable (`app/(tabs)/school.tsx`, logic in `services/upcomingExams.ts`):
  the child's exams whose `examDate` is today or later, compared as
  `YYYY-MM-DD` strings against `ammanToday()`, soonest first (then by time, with
  a missing time last, then by title), in **any** state. A parent's picker is
  one chip per child by `key`. A row opens «اختباراتي», which also shows
  «موعده …» in the row's meta line.
- **A paper exam never offers a link or «ابدأ».** A **paper exam** is one whose
  every live question is a paper question (`isPaperExam` in
  `modules/assessment/paperExam.ts`: manual grading and an empty body; there is no
  column). Its row has `paper: true`, `shareCode: null`, and state `paper` («امتحان
  ورقي») until a handed-in sitting exists, after which it is `submitted` /
  `result` like any other exam, whatever the exam's status.
- **Paper marks: one total per student.** The first task of this part confirmed
  that no per-class grid existed: `answers/[studentId]` marks one student at a
  time. The owner chose a single total per student, built on the existing paper
  exam model with no migration. A **quick paper exam** is a paper exam with
  exactly one question worth N (0 < N ≤ 100, decimals allowed, stored as
  `numeric(5,2)`); «مجموع فقط» on the new-exam screen is the default shape for a
  paper exam, and builds it with one question on the first selected objective and
  the `understanding` competency. `PUT /evaluations/:id/paper-totals` takes
  `{ totals: [{ studentId, marks }] }` and answers `{ maxMarks, results }`, one
  result per row in order: `saved`, `unchanged`, `cleared`, or `error` with a code
  (`not_in_class`, `not_in_group`, `marks_out_of_range`, `kept_student_work`,
  `not_quick_paper`, `failed`). It accepts an exam that is `published` **or**
  `closed` (a teacher may close the paper after the sitting, then type the totals);
  a draft is `409 not_published`; an exam with no class, more than one question
  or no level scale is `409 no_class` / `not_quick_paper` / `no_level_scale`; an
  exam that is not the caller's, missing, malformed or archived is one identical
  404. Each row is found-or-created as a `teacher_entry` sitting
  (`lib/teacherEntry.ts`, shared with the per-student routes), the mark is
  written, and the sitting is handed in with `gradeSubmission`, which stamps
  `submittedAt` and builds the result. Rows are saved one after another and
  independently: one bad row never costs the others. `marks` is a number, a
  numeric string or `null`; a string is a plain decimal of at most **16
  characters** (no hex, exponent or non-Latin digits — the app folds Arabic-Indic
  digits and «٫» itself) read like a single typed mark (0..N, rounded to two
  decimals), and anything else is a row-level `marks_out_of_range`. **Limits:** at
  most **100 rows** per request (`400 too_many_rows`; the app sends chunks of 50),
  **60 requests per minute per user** (`429`), a student appearing twice is
  `400 duplicate_student`. **Clearing** (`marks: null`) deletes a
  teacher-entered sitting that holds no answers — with its result and its
  `grade_overrides` audit rows — even after results are released, and is refused
  (`kept_student_work`) for a sitting the student made through the link or one
  holding answers; the app asks for confirmation before sending a clear for a
  mark it had saved. The class mark book is `app/evaluations/[id]/marks.tsx`,
  reached from «أدخل العلامات» on the exam screen (a **published or closed** quick
  paper exam) and from «أدخل العلامات كجدول» on the answers picker. Only a
  published exam's screen links to the picker; the picker's own gate accepts a
  closed exam too, but nothing on a closed exam's screen leads there. A
  multi-question paper is still marked per student.
- **Visibility is unchanged.** `releaseResultsToStudent` + handed in + not
  provisional (`studentResultReady`), shaped by `studentExamRow` /
  `guardianExamRow`, so a parent sees exactly what the child sees. The teacher's
  `ExamDateCard` says when a date cannot reach families yet: no class, or a dated
  draft.
- **Per-child results: no new route — a correction.** An earlier draft of this
  spec pointed at `/student/grades`; that route returns the student's curriculum
  grade ids for the library (`{ gradeIds }`), not marks. The family's result is
  `result{…}` on the exam rows «اختباراتي» already shows (which, for a parent, are
  grouped per child). No term averages or report cards.

**A school day is stored two ways**, and anything that compares them (the Part 4
reminders, an "upcoming" list that mixes homework and exams) has to handle both:
an exam's day is the text pair `exam_date` / `exam_time` with no zone (the
teacher's local calendar day, like the schedule and plan tables), while a
homework's day is a `timestamptz` at 23:59:59.999 Asia/Amman. Compare exam days
as `YYYY-MM-DD` strings and homework days through their Amman date; never
`toISOString()` an exam date, which shifts it to UTC near midnight.

## 4. Notifications

As built, 2026-10-12. Four pushes, one sender, three switches.

- **Who:** the roster rows the news is about, then every account linked to them
  (`self` and `guardian`) via `accountsLinkedTo` / `liveClassStudentIds`
  (`lib/familyAccess.ts`). This is the "roster row → accounts" lookup Part 3 asked
  for. A guardian of two children gets one push per child, named first
  («سارة: واجب جديد»); a student gets the generic text. Suspended accounts and
  archived rows get nothing, and nothing is sent while `STUDENT_ACCOUNTS` is off
  (every one of these pushes opens a screen whose endpoints answer 403 then).
  Every device gets the push, and Expo's dead tokens are pruned. One sender,
  `lib/familyPush.ts`. Texts are Arabic only, in
  `modules/notifications/familyPushText.ts`. A guardian's lock-screen text carries
  the child's roster name (precedent: «نتيجة سارة»).
- **Homework posted** (`POST /homework`): the class's students and guardians,
  channel `homework`, which opens «المدرسة». Changing a due date pushes nothing.
  Homework whose due day is already past (the API allows 30 days back) is a
  record, not news: no push.
- **Exam date set, changed or cleared** (`PATCH /evaluations/:id`): pushed only
  when the stored date or time actually moves on an exam families can see:
  published or closed, attached to a live class, not archived. It goes only to
  that exam's audience (a group check reaches its own students). Attaching a class
  to a dated exam announces the date as new (`set`) to that class, and so does
  publishing a dated draft. Moving a dated exam to another class tells the new
  class only. A dated draft, or an exam with no class, pushes nothing, and neither
  does a date already in the past (a back-dated entry); clearing a date is always
  told. The announcing write is conditional on what the request read, so racing
  saves **should** announce at most once. **That is not proven:** no test could
  make the race case go red, even with the guard removed and eight simultaneous
  requests, so the case was deleted rather than kept as a test that proves
  nothing. A racing save with a *different* value stores the loser's value without
  announcing it. Publish is not race-safe either (known gap). Channel `exams`. The
  day is formatted as text, never through `Date`.
- **Results:** `announceResultsRelease` now goes through the shared sender. It
  skips provisional sittings, suspended accounts and switched-off accounts, and
  still re-announces after hide → release. Unlike the first plan, it is now
  **gated on `STUDENT_ACCOUNTS` like the other three** (review ruling: the old
  exemption contradicted its own rationale, because `/student/exams` and
  `/parent/exams` answer 403 while the flag is off). **Marks typed after the
  release** (`PUT /evaluations/:id/paper-totals`, rows that answer `saved`) get the
  same text. Not covered: a sitting handed in after the release via
  `POST /attempts/:id/submit` or the student link.
- **Reminder** (`POST /internal/homework-reminders`, Cloud Scheduler, 16:00
  Asia/Amman): homework due tomorrow (Amman day), not archived, in a live class.
  Not ticked, with an account that can tick (a non-suspended `self` link): the
  student and guardians are told it is not marked done. No such account: guardians
  only, and the text never says "not done". Ticked: nothing. Sent at most once per
  homework per due day (`homework_reminders`, claimed before sending; a failed
  send is not retried; a failed claim costs that homework only, not the run). The
  run is sequential, so a very large school could outlast Scheduler's attempt
  deadline; the job retries (`--max-retry-attempts 3`) and a retry reminds only what
  is not yet claimed. The key is
  `x-internal-key` = `INTERNAL_CRON_KEY`, and the route is a 404 without it,
  including while the key is unset. This ships in the same PR as the rest of Part
  4, not "its own PR" as this section first said.
- **Switches:** `users.push_prefs` (`{}` = all on), `GET|PUT
  /auth/me/push-preferences` for any account; three switches in Settings for
  parents and students (homework, exam dates, results; the homework switch also
  governs the reminder); chat is not affected.
- **Quiet hours:** 22:00–07:00 Amman, sent to the silent Android channel `quiet`
  with `sound: null`, because Android takes sound from the channel.
  `PUSH_QUIET_HOURS=off` disables it. Chat and admin pushes are unchanged.
- **Teacher-triggered pushes are awaited, capped at 4 s** (`pushWithin`), because
  Cloud Run throttles CPU after the response. A push never fails the request. The
  release announcement is still fire-and-forget. A hung Expo call is cut at 8 s
  per chunk.
- **App:** channels `homework`, `exams` and `quiet` are created at runtime from
  `PUSH_CHANNELS`, so they ship by OTA with no native change. `data.screen:
  "school"` opens the School tab. The permission prompt mentions homework and exam
  dates.
- **Not done, on purpose:** the Arabic push copy has not been read by a native
  speaker; texts ignore `preferredLanguage`.

## Testing

- API: `pnpm build && pnpm test` in `artifacts/api-server`. Must cover: a parent
  cannot read another family's child; a student cannot read another class's
  homework; a teacher cannot edit another teacher's homework; results hidden
  until released; unowned paths still 404, not 401.
- Part 3 DB tests: `familyExams.db.test.ts` (the date reaches families only on
  an exam they may see; `paper`; no link; release; the parent `key`),
  `teacherEntry.db.test.ts` (the shared sitting/mark code, characterised before it
  was extracted) and `paperTotals.db.test.ts` (who may call, which exams, per-row
  results, clearing, limits, the rate limit).
- Part 4 DB tests, each against an in-process Expo stub
  (`test-support/pushStub.ts`): `pushPreferences.db.test.ts` (the switches
  route), `resultsPush.db.test.ts` (the release announcement, characterised
  before it moved onto the shared sender), `homeworkPush.db.test.ts`,
  `examDatePush.db.test.ts`, `paperTotalsPush.db.test.ts` and
  `homeworkReminders.db.test.ts`; plus a `mountOrder.test.ts` case for the
  internal path (404 without the key, never 401). Pure rules sit beside them in
  `modules/notifications/__tests__/`.
- Mobile: logic in pure `services/*.ts` with tests in `services/__tests__/`
  (`upcomingExams.test.ts`, `paperMarks.test.ts`, `myExams.test.ts`);
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
   signed-in parent and student account right after deploy. Part 3 (exam dates,
   «الاختبارات القادمة», the `paper` state, the mark book) is the same: after
   deploy, open it on a real signed-in parent, student and teacher. At the time of
   writing none of it had been used by a real account or on a device; see STATUS.md
   «Exam dates and paper marks reach families, 2026-10-12» for what was rendered.
2. The assembled schedule is only as complete as teacher adoption.
3. The reminder needs `INTERNAL_CRON_KEY` and a Cloud Scheduler job, created by hand (docs/deploying.md); until then it never fires.
4. Out of scope: attendance, report cards / term averages, file uploads, a
   school-admin view, homework grades. Each would be its own spec.
5. Push delivery to a real device has never been seen.
