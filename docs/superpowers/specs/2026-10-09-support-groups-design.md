# Support groups (مجموعات الدعم) — design

Date: 2026-10-09 · Status: approved in conversation, awaiting spec review

## Why

The class view says «هدف X: 62%، 3 طلاب دون الحد» and never says *which* three.
The student record (2026-10-08) names one student's weak objectives, but a
teacher with 35 students would have to open every record to assemble a group.
And every action we have is class-wide or one-student: a quick check goes to
the whole class, a worksheet goes to nobody in particular.

This feature names the students under the line on each objective, gives that
group a remedial worksheet and a quick re-check **only they can sit**, and shows
who passed the re-check.

## Decisions taken

| Question | Decision |
| --- | --- |
| How the group sits its re-check | Online, assignees only: it appears in only their «اختباراتي» and share link, auto-marked; the teacher can also enter marks for an assignee |
| What «moved up» means | Passed the re-check: ≥ 60% on it. Who is weak in the first place stays the student record's rule |
| How the worksheet reaches the group | The teacher prints it; the card shows the names |
| Architecture | Approach A: groups are derived live from marks; only the re-check's audience is stored |
| Do group checks count in class mastery | Yes, like any paper (they are evidence about those students) |
| Can the teacher change the group | Untick members before creating the check; not add students from outside it |
| Where it lives | A «مجموعات الدعم» section on the class screen's exams tab |

## 1. Data and the audience rule

**Storage.** No new table. `evaluation_assignments` (`lib/db/src/schema/attempts.ts`,
in `0000_baseline.sql`, read and written by nothing today) gets one row per
group member: `{ evaluationId, studentId, assignedBy }`, `classGroupId` null.

- Migration `0001`: a unique index on `(evaluation_id, student_id)`. Additive;
  produced by `pnpm --filter @workspace/db run generate`, committed under
  `lib/db/migrations/`. Not destructive, so no `destructive-migration: ok`.
- **An evaluation with any student-level assignment row is a group check.**
  Its audience is exactly those students. Every other evaluation keeps today's
  rule — the whole class at read time. Existing evaluations have no rows, so
  nothing about them changes.
- A group check is single-objective (`objectiveIds = [X]`, as every quick check
  is); "the group's latest re-check" is the newest group check in the class
  whose only objective is X.

**One rule, one helper.** `audienceFor(assignedStudentIds: string[])` returns
`{ kind: 'class' }` when empty, else `{ kind: 'students', ids: Set }`; a pure
module beside the routes, used by every gate below.

**Where the rule is enforced** (all server-side; the client only reflects it):

1. **Student exam list** — `examRowsFor` (`routes/studentExams.ts`): a group
   check is listed only for its assignees. The `held` path stays, so anyone who
   already holds an attempt still sees it. The parent view (`GET
   /parent/exams`) inherits this, because it reuses `examRowsFor`.
2. **Share link** — `GET /take/:code` (`routes/studentAttempt.ts`): the roster
   it returns lists only assignees, so no other names leak. `POST
   /take/:code/claim` and `claim-self` refuse a non-assignee with 403.
3. **Teacher mark entry** — `POST /evaluations/:id/attempts`: refused (403) for
   a non-assignee of a group check.
4. **Marking list** — the screen `app/evaluations/[id]/answers/index.tsx`
   builds its rows from the class roster; for a group check it lists assignees
   only (the evaluation detail response carries `audience`), so non-members do
   not appear as «لم يقدّمه».
5. **Student record** — `GET /classes/:id/students/:studentId/record`: a group
   check the student is not assigned to is left out of their rows (it is not
   «لم يقدّمه» for them).
6. **Mastery gate** — `/student/progress`'s `quizLessonIds`: a group check never
   gates a lesson for students outside it.

**Counting.** A group check's marks count like any paper in class mastery and
in the student's record.

## 2. The groups, the screen, and creating a group check

**Route.** `GET /classes/:id/support-groups`, in `routes/roster.ts` under the
router's existing `/classes` guard (teacher roles, roster consent). Same access
check as the student record: `findLiveClass` else 404 «Class not found».

**Pure core** `supportGroups(...)` in
`artifacts/api-server/src/modules/assessment/supportGroups.ts`, from plain rows:

- **Members** of objective X = live, non-archived class members whose
  marks-weighted percentage on X across all their marked papers in this class is
  below 60 — the student record's rule exactly (provisional papers counted,
  archived evaluations counted, drafts excluded). Each member:
  `{ studentId, displayName, percent }`, weakest first.
- **Group** per objective with ≥ 1 member: `{ objectiveId, titleAr, lessonId,
  lessonTitleAr, classPercent, members, latestCheck }`.
- **`latestCheck`**: the newest **published or closed, non-archived** group check
  in this class whose only objective is X, or null. `{ evaluationId, title,
  status, createdAt, outcomes }`, where `outcomes` lists each assignee who is
  still a live class member with:
  - `passed` — a marked attempt (graded or needs_review) scoring ≥ 60% on X on
    this check (its own objective score; the attempt's percent when the
    breakdown is empty);
  - `still_weak` — a marked attempt under 60%;
  - `not_yet` — no marked attempt.
- A newest **draft** group check for X is returned separately as `draftCheck:
  { evaluationId } | null`, so the card can open its review instead of
  creating another.
- **Order:** most members first, then lowest `classPercent`, then `objectiveId`.

**Screen.** A «مجموعات الدعم» section on the exams tab of
`app/classes/[id]/index.tsx`, below the class gaps (`MasterySection`). The first
three groups show, then «عرض الكل (N)». Each card:

- objective title, lesson title, «N طلاب دون 60%»;
- member chips — each opens `/classes/[id]/student/[studentId]`;
- **«ورقة علاجية»** — the student record's `worksheetAction(o)` (lesson's own
  grade and subject via `lessonPickerParams`); hidden when the lesson is unknown;
- **«تحقق للمجموعة»** — `/evaluations/mini` with `classId`, `objectiveId` and
  `studentIds` (comma-joined member ids);
- with `draftCheck`: «أكمل التحقق» opens `/evaluations/[id]` instead;
- with `latestCheck`: its title and date, and per assignee «تجاوز» /
  «ما زال يحتاج دعمًا» / «لم يقدّمه بعد»; the check button reads «تحقق جديد».

No groups: the section is hidden (the class gaps already say the class is fine).

**Creating the check.** `app/evaluations/mini.tsx` takes an optional
`studentIds` param. When present:

- the screen shows «لـ N طلاب» and a tick list of those students (names from the
  class roster it already loads), all ticked; the teacher can untick, not add;
  «جهّز» is disabled with none ticked;
- after create → attach class → generate (unchanged), it calls the new
  **`PUT /evaluations/:id/audience`** `{ studentIds }`, then goes to the review
  screen as today. If the audience call fails, the screen shows the error and
  stays put (it does not navigate to a class-wide draft);
- the review screen shows «للمجموعة: N طلاب» for a group check.

**`PUT /evaluations/:id/audience`** replaces the evaluation's student-level
assignment rows. Refused when: the teacher does not own the evaluation (404);
it has no class (409); it is not a draft (409 — the audience is fixed once
students can start); the list is empty or has duplicates (400); any id is not a
live, non-archived member of the evaluation's class (400). Without `studentIds`
nothing calls it, so the quick check behaves exactly as today.

**Analytics.** `support_group_action { kind: 'worksheet' | 'check' | 'student' }`
and `support_group_check_created { members: number }`. No names or ids.

## 3. Edge cases

- **A student leaves the class after being assigned:** the assignment row stays;
  they drop out of the group and out of `outcomes` (live members only); an
  attempt they already hold stays visible to them through `held`.
- **A student who is now above 60% while a check is open:** they remain on that
  check's outcomes; they are simply absent from the next derived group.
- **An archived group check:** still counts as evidence (as in the record), but
  is never `latestCheck`.
- **A group check with every assignee removed from the class:** `outcomes` is
  empty; the card shows the check with «لا أحد من المجموعة في الصف الآن».
- **Removing assignments:** not offered. Deleting the draft evaluation removes
  them (`ON DELETE cascade`).

## 4. Testing

- **Server, pure** (`modules/assessment/__tests__/supportGroups.test.ts`):
  members follow the record's marks-weighted rule across papers; provisional and
  archived counted, drafts not; outcomes passed / still_weak / not_yet at the 60
  line; the newest published check wins, drafts go to `draftCheck`, archived
  checks are never latest; outcomes skip students no longer in the class;
  ordering. `audienceFor` class vs students.
- **Server, routes:** mountOrder 401 for `GET /classes/:id/support-groups` and
  `PUT /evaluations/:id/audience`; the audience route's refusal cases; the
  gates — a non-assignee does not see the check in `GET /student/exams`, is not
  on the `/take/:code` roster, is refused on claim and claim-self and on teacher
  entry, and does not get it as not-sat in the student record; an assignee does.
- **Migration:** `0001` committed; CI «migrations match schema» passes.
- **Mobile, pure** (`services/__tests__/supportGroups.test.ts`): visible-cards
  limit, card action params (worksheet carries the lesson's own subject, check
  carries `studentIds`), `studentIds` param parsing (dedupe, drop empties),
  outcome labels.
- **Running app:** a seeded class with three weak students; create a group
  check for two; a non-member student account does not see it in «اختباراتي»;
  the link roster shows the two; a member sits it; once marked, the card shows
  «تجاوز» or «ما زال يحتاج دعمًا»; an existing class-wide quick check is
  unchanged.
- **STATUS.md:** a dated section.

## Out of scope

Persisted groups with history; adding students from outside the group; changing
a published check's audience; sending the worksheet to student accounts;
cross-class groups; group chat threads; notifications on assignment.
