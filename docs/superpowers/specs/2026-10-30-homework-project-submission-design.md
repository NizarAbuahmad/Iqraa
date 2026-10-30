# Homework project submission — design

Status: Phase 1 (API) built 2026-10-30; the app is not.

## Why

A teacher asked (in a message to the team) whether they can give students the
projects and tasks printed in the textbook, have **each student submit their own
project**, keep the work **saved on the site**, and be sure **no student can edit
another student's project**. Their end goal is to show the saved work to a
supervisor who visits.

Today none of that exists. `lib/db/src/schema/homework.ts` says it in print:
"No uploads and no grading — a student marks it done". A student can tick a
homework off and nothing more, and there is no table that holds anything a
student made.

## Goal

A teacher can mark a homework as **needing a submission**. Each student in that
class then submits their own project as **one to six photos plus a short note**
from the app. The teacher sees who has and has not submitted, and opens any
student's work. A linked parent sees their own child's. The work stays stored
until the homework is deleted or the student replaces it.

## Non-goals (this spec)

- **Supervisor access** — decided out of scope for now (2026-10-30). The teacher
  shows the work from their own phone. A read-only supervisor role or a share link
  is a separate spec; nothing here should make it harder to add (see *Later*).
- **Grading and teacher comments** on a submission. Phase 4, separate.
- **Files and video** (PDF, Word, mp4). Photos and a note only. The upload path
  stays one place so a new kind is a small change later.
- Group projects (one submission, several students), peer review, resubmission
  history. One submission per student per homework, replaced in place.
- Any change to exams or `attempts`. Projects are not exams.

## Decisions already made

| Question | Decision |
| --- | --- |
| Shape | Extend homework (approach A). Not a separate "project" entity, not chat. |
| What a student submits | Photos (1–6) + a text note. |
| Resubmitting | A student may replace their own submission until the due day ends. After that it is locked. |
| Late | A student with no submission may still submit after the due day. It is accepted and shown as **late**. |
| Supervisor | No access in this release. |
| Retention | Photos live until the student removes them, or the teacher deletes (archives) the homework, which purges the photos and deletes the submission rows. No automatic expiry. |

## 1. Data

### `homework.requires_submission` (new column)

`boolean NOT NULL DEFAULT false`. Existing homework is untouched. Set by the
teacher at creation or edit (`POST /homework`, `PATCH /homework/:id`).

### `homework_submissions` (new table)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `homework_id` | uuid → `homework.id`, `ON DELETE CASCADE` | |
| `student_id` | uuid → `students.id`, `ON DELETE CASCADE` | A **roster row**, not a user — same rule as `homework_completions` |
| `note` | text, default `''` | Capped at 2000 characters by the route |
| `photos` | jsonb `{ id, key, mime, sizeBytes }[]`, default `[]` | `key` is the R2 object key. Max 6 |
| `submitted_at` | timestamptz, **nullable** | `null` = a draft: photos uploaded, not handed in. Only a submitted row is visible to anyone but its author |
| `created_at`, `updated_at` | timestamptz | |

`unique (homework_id, student_id)`. Index on `student_id`.

Additive only, so no `destructive-migration: ok` is needed. A roster row has at
most one student account (`roster_links_one_self_idx`), so in practice one student
account writes a submission; a guardian linked to the same row reads it. The
submission is on the roster row, not the account, like a completion.

**Which roster row.** `ownHomeworkRows` (`lib/homeworkDone.ts`) can return more
than one row for an account in a class. The submission is stored on the first of
the **sorted** rows (the helper's own "so the first is stable" rule), and the tick
goes to all of them via the existing `tickRows`.

**Late is computed, never stored.** `late = submitted_at > homework.due_at`. The
due day is the Amman day (`dueAt` is 23:59:59.999 Amman) — read it through
`modules/homework/rules.ts`, never compare against a local-timezone day.

## 2. Storage

Photos go to the **private** R2 bucket, in the same way as chat attachments.

- New key helper in `lib/r2.ts`: `newHomeworkSubmissionKey(homeworkId, studentId, ext)`
  → `homework-submissions/<homeworkId>/<studentId>/<uuid><ext>`. The key never
  contains the caller's filename. A prefix of its own means "delete everything for
  this homework or this student" is a prefix operation, the reason `attempt-audio/`
  has one.
- Reads use `presignedGetUrl(key, 600)` — ten minutes, not the one-hour default —
  and only after the access check passes. There is no public URL for these objects.
- A student's photo is a minor's image. It is never written to the public bucket.

**Upload format.** One photo per request as a `data:` URL, parsed with the
existing `parseDataUrl` (`lib/lessonMediaUpload.ts`). One per request keeps each
body far below the 12 MB `express.json` limit that a six-photo body would hit.

- Accepted: `image/jpeg`, `image/png`, `image/webp`. HEIC is converted on the
  device (the app already ships `expo-image-manipulator`, and
  `2026-10-15-native-photo-downscaling-design.md` covers the downscale). The
  server refuses `image/heic` with a 400 rather than storing something it cannot
  show.
- Cap: 4 MB decoded per photo. The client downscales first, so a real photo is far
  below it; the cap is the server's own backstop.
- Magic-byte check on the decoded buffer, not only the declared mime.

## 3. API

All new student and parent routes are path-scoped under their existing prefixes
(`/student/homework`, `/parent/homework`) and gated by `studentAccountsEnabled()`
like their neighbours in `routes/familyHomework.ts`. **No bare `router.use` guard**
— see the mount-order trap in `CLAUDE.md`; `mountOrder.test.ts` must cover each new
path.

### Student (`requireRole("student")`)

| Route | Does |
| --- | --- |
| `GET /student/homework/:id/submission` | The caller's own submission, draft or submitted, with signed photo URLs. A student with nothing yet gets status "none", not a 404; 404 is for a homework that does not resolve |
| `POST /student/homework/:id/submission/photos` | Body `{ photoDataUrl }`. Creates the draft row if missing, stores the object, appends to `photos`. 409 `photo_limit` past six, 409 `locked` if submitted and past due |
| `DELETE /student/homework/:id/submission/photos/:photoId` | Removes one photo from the row **and** the object from R2. Same lock rule |
| `PUT /student/homework/:id/submission` | Body `{ note }`. Saves the note on the draft or submitted row |
| `POST /student/homework/:id/submission/submit` | Needs at least one photo or a non-empty note. Sets `submitted_at` (kept on a replace — see below), then ticks the homework done through `tickRows` |

The photo upload is limited to 60 per account per hour. The limiter counts every
request that reaches the route, refused ones included, so "60 photos an hour"
really means 60 attempts. A handed-in project may not be emptied (removing its
last photo, or clearing the note of a project with no photo): this is enforced
inside each `UPDATE` statement's `WHERE`, not only by a read in code, so two
concurrent requests cannot empty it.

Every one resolves the row through `ownHomeworkRows(userId, homeworkId)`, so the
rules the tick already enforces apply unchanged: a live homework in a live class,
and a roster row **this account is self-linked to, in that class**. Every failure
to resolve is the same 404 `not_found`, as in the existing student routes.

**Replace.** Before the due day ends, a submitted row can be edited again (photos
added or removed, note changed) and submitted again; `submitted_at` keeps the
**first** submit time, so a student who submitted on time and then improved the
work is never marked late. After the due day a submitted row is locked (409
`locked`); a student with no submitted row can still submit once, and is late.

**The tick.** For a homework with `requires_submission`, `PUT /student/homework/:id/done`
is refused with 409 `submission_required`. Done is set only by submitting.
`DELETE …/done` is refused the same way, so the tick and the submission cannot
disagree. Playing an attached game no longer ticks such a homework either.

### Teacher (existing `/homework` router, owner check as the siblings do)

| Route | Does |
| --- | --- |
| `GET /homework/:id/submissions` | One row per live roster member of the homework's class: `{ studentId, displayName, status: "none" \| "submitted" \| "late", submittedAt, photoCount }`. A draft is reported as `none` — the teacher never sees an unfinished upload |
| `GET /homework/:id/submissions/:studentId` | One student's `note` and photos with signed URLs. 404 for a draft or a student not in this class |
| `DELETE /homework/:id` (existing) | That route **archives** (`archived_at`). It now also removes every stored photo (drafts included) and deletes the submission rows. The purge runs on the owner connection (`systemDb`), because a draft is invisible to the teacher's own identity; a test with `RLS_ENFORCE=on` pins it. The purge runs **before** the archive and a purge that throws answers 500 with the homework still live (an archived homework can no longer be found, so a failure after it could never be retried); a second best-effort pass follows the archive. Not recoverable, so the teacher's delete confirmation must say so |
| `DELETE /classes/:id` (existing) | Archiving a class makes its homework unreachable for the teacher and the students alike, so it purges every homework of the class first (a throw answers 500 and the class stays live). Deleting a teacher's account (`DELETE /auth/users/me`) reads the keys of all their homework's photos before the cascade and deletes the objects after it |

`homework.teacherId = req.user.id` is checked in the route, as in every other
`/homework` handler. This read does not rely on RLS alone (see §4).

### Parent (`requireRole("parent")`)

`GET /parent/homework/:id/submissions` → the submitted work of the guardian's
linked children **in that homework's class**, each with `{ key, displayName,
submission }` (the `key` matches `groupChildren`, as the list does). A parent can
read, never write.

### What the family list says

`loadFamilyHomework` gains `requiresSubmission` and, per item, `submission:
"none" | "submitted" | "late"` for the viewer's own rows, so the list can show a
state without fetching photos.

## 4. Isolation — the part the teacher asked for

"No student can edit another's project" is not a UI promise. Three layers:

1. **The route resolves the student from the account, never from the request.**
   There is no `studentId` parameter on any student write. The account's own
   self-linked rows in the homework's class decide it (`ownHomeworkRows`).
2. **Reads scope the same way.** A student reads only the submission of their
   own rows. A parent reads only their linked children's, and only in that
   class. A teacher reads only their own homework.
3. **Row-level security on the new table.** `homework_submissions` joins the
   `PROTECTED` list in `lib/db/src/__tests__/rlsCoverage.test.ts` (not
   `DEFERRED`; `homework` itself still is, but this table holds a minor's work):
   - **Read:** the homework's teacher (`homework.teacher_id = app_uid()`), or
     `app_sees_student(student_id)` **and** `submitted_at is not null` for anyone
     else. A draft is readable only by its own self-linked author.
   - **Write:** `INSERT` and `UPDATE` only by the self-linked author of that
     roster row. There is no `DELETE` policy; removal is `systemDb`'s job (the
     archive purge, on the owner connection, pinned by a test with `RLS_ENFORCE=on`).
     A guardian link does not grant write.
   - Policy helpers follow `2026-10-13-row-level-security-design.md`
     (`SECURITY DEFINER`, pinned `search_path`) to avoid recursive policies.

RLS fails quietly: a bad policy returns fewer rows rather than an error. So
`rlsDiff.test.ts` gains cases that diff the **rows a student, a teacher, a
guardian and an unrelated student each see**, not only status codes. The plan
must add them before the routes land.

Row-level security is **on in production** (`RLS_ENFORCE=on` on `iqraa-api`, see
`STATUS.md`), so every route here runs under it from its first deploy; it is not
a layer that is merely planned.

*Not built in phase 1:* the `rlsDiff` cases. That suite boots its own server and
would need the in-memory S3 wired into that boot. The policies are covered by the
matrix test (`rlsMatrix.test.ts`) and by RLS-on server tests in
`homeworkSubmission.db.test.ts` (the student journey: upload, note, hand in, remove a
photo; the teacher's list and detail reading it back and not seeing a draft; the
archive purge of a draft; the parent's and the student's reads); see the status log.

**Object access.** A signed URL is minted only after the row was read through the
caller's own connection, so a request that RLS or the route refused never reaches
`presignedGetUrl`. Keys are unguessable UUIDs and the bucket is private. The object
key field is never returned to a client, but a signed URL's path carries it: the
homework id and the roster-row id of `homework-submissions/<hw>/<student>/…` are
visible to whoever holds the link, for the ten minutes it lives.

## 5. App

Copy exists in Arabic and English. The Latin product name is **Iqrra**.

- **Teacher — create/edit homework:** a switch «يتطلب تسليم مشروع» /
  "Requires a project submission". On the class page, a homework with the switch
  on shows «سلّم X من Y» ("X of Y submitted") and opens a list of students with
  their state; a row opens that student's photos and note.
- **Student — homework list:** a submission homework shows its state (not
  submitted / submitted / late) in place of the plain tick. Its screen has the
  note field, up to six photo slots (camera or gallery through `expo-image-picker`,
  downscaled on the device), a remove control per photo, and a «سلّم» button that
  is disabled until there is at least one photo or a note. After the due day a
  submitted project shows read-only with a short lock message.
- **Parent — homework list:** the child's submission state, and a read-only view
  of the photos and note.
- Photos on a card use `useSurface()` and tokens from `useColors()`, not `palette`;
  a state tick is an `<Ionicons>` glyph, never an emoji; targets are 44 points; and
  every state announced by colour is also text. A screen that loads photos shows
  a retry on failure, because a failed load must not look like "no submission".

**Native surface.** `expo-image-picker` and `expo-image-manipulator` are already
dependencies. The plan must still **confirm both are in the shipped binary** (config
plugins and permission strings in `app.json`) before deciding no `app.json` `version`
bump is needed; if a permission string is missing it is a native change and the
`version` must move, or the OTA will crash old binaries on launch.

## 6. Phases — one PR each

1. **Foundation.** Migration (`homework.requires_submission`, `homework_submissions`),
   RLS policies, the `PROTECTED` entry, the R2 key helper, the student submission
   routes, the teacher list/detail routes, the delete cleanup, and the tests below.
   Draft PR; the migration is additive and reverts cleanly.
2. **Student app.** The submit screen and list state.
3. **Teacher and parent app.** The teacher's list and detail, and the parent's
   read-only view.
4. **Later, separate specs.** Teacher feedback or a mark on a submission;
   supervisor access (see below); video and files.

## 7. Testing

- **DB tests** (`homework.db.test.ts` style): the unique key; a guardian
  linked to the row reads the student's submission; a class the account is not in is a 404;
  a draft invisible to the teacher; replace keeps the first `submitted_at`; late
  after the due day; locked replace; photo cap; wrong mime, oversized and
  non-image bytes refused; `submission_required` on the manual tick; archiving
  the homework removes the R2 objects and deletes the rows (R2 faked in the test,
  as the chat tests do).
- **RLS diff** (`rlsDiff.test.ts`) — *not built in phase 1, see §4*: rows seen by
  owner student, another student in the same class, the class teacher, another
  teacher, a linked parent, an unlinked parent. The result for each must equal the
  matrix in §4. `rlsMatrix.test.ts` covers the policies directly instead.
- **`mountOrder.test.ts`:** every new path answers 401 unauthenticated, and an
  unowned path is still 404, never 401 (no bare guard installed).
- **Pure-function tests** for the validators (`modules/homework/submission.ts`:
  data URL, mime, magic bytes, note cap, lock rule, late rule), outside the DB
  tests so `node --test` can load them without `DATABASE_URL`.
- **Mobile `services/__tests__`:** the submission state machine (draft → submitted
  → locked), the downscale-then-upload sequencing, and retry behaviour. Anything
  importing `react-native` cannot load there, so the logic lives in a pure module.
- **Browser smoke (`e2e/`):** one added step to the existing journey: the teacher
  marks a homework as needing a submission, a student submits a photo, the teacher
  sees the count change.

## 8. Risks and limits

- **Storage cost and abuse.** Up to 6 photos × 4 MB per student per homework.
  Uploads go through the existing rate limiter (`rate_limit_buckets`), at 60
  attempts an hour per account (see §3). This is not a free-for-all file host.
- **A wrong photo of a minor** (a face, a document) is stored. The teacher's
  delete-homework purge and the student's own remove control are the only
  removal paths in this release (a teacher cannot remove a single student's
  photo without deleting the whole homework). There is no moderation queue; note it in the PR
  body so it is a known gap, not a surprise.
- **`students.id` is a roster row.** A child in two of a teacher's classes is two
  rows and two submissions. That is correct and matches homework completions.
- **The archive purge is not transactional.** Objects are deleted first; a failed
  object delete is logged with its key and the rows are deleted anyway, so an
  unreachable orphan object can remain in the bucket (private, unguessable key, no
  row pointing to it). A purge that cannot run at all (it throws before deleting)
  stops the archive instead: the homework or class stays live and the teacher retries.
- **Orphan objects that phase 1 does not close.** (a) An exception after a photo is
  stored but before it is recorded leaves an object no row points to. (b) A failed
  object delete (logged with its key) leaves one too. (c) An upload racing a purge, by
  milliseconds, can store a photo after the purge listed the rows. They are private,
  unguessable and unreachable, but they stay. **A prefix sweep of
  `homework-submissions/` must land before phase 2 lets students upload.**
  **The sweep now exists** (`POST /internal/homework-submission-sweep`, same
  `INTERNAL_CRON_KEY` as the reminders; see `docs/status-log.md` «Homework submission
  cleanup sweep»). It retries the purge of archived homework and deletes unreferenced
  objects older than 24 hours, at most 1000 a run, and only under a homework that
  exists in the service's own database; a run whose orphans are over 20 and over half
  of what it can attribute is refused, with no override (a database and a bucket that
  do not belong together, e.g. a local `.env` with production R2 credentials, would
  otherwise see every photo as an orphan). Photos left under a homework row deleted
  by cascade are therefore kept for good. **Those guards do not catch a copy or
  branch of the production database** (a Neon branch knows every old homework, so
  production photos uploaded since the branch point look like known orphans), so the
  route is also a 404 unless `HOMEWORK_SUBMISSION_SWEEP=on` is set on the service, by
  hand and on `iqraa-api` alone: no other server may hold the production R2
  credentials with `INTERNAL_CRON_KEY`. **The switch and the Cloud Scheduler job still
  have to be set up by the owner** (`docs/deploying.md`, dry run first), so until then the
  cases above stay open in production, and **it has never run against real R2**. Still
  open: a failed object delete in the sweep is not exercised by any test; the photo
  extension list exists twice (`modules/homework/submission.ts` and the sweep's key
  regex) with no test tying them; and a listing past 200,000 keys is only flagged
  (`listTruncated`), not handled.
- **Open question: toggling `requiresSubmission` after work exists.** It is not
  specified, and `PATCH /homework/:id` accepts it today. On → off makes the stored
  photos unreadable (every student route answers 404) and lets drafts be ticked by
  hand; off → on leaves students who already ticked "done" with a submission of
  `none` and unable to untick. To be decided before the teacher's app exposes the
  switch (phase 3), for example a 409 once any submission or completion exists.
- **R2 not configured** (`isR2Configured()` false, e.g. a local checkout): upload
  routes answer 503 `storage_unavailable`, the same shape as media, and the app
  hides the photo control rather than failing on tap.
- **No supervisor view.** The teacher's own phone is the demo path, and a stale
  signed URL (10 minutes) means a re-fetch, not a broken photo.

## 9. Later: how supervisor access would attach

A read-only link, minted by the teacher per class, listing submitted work and
nothing else, with its own expiry and a revoke — the same shape as the exam link
(`attempts.accessTokenHash`: only the hash stored). It would read through a
`systemDb` route pinned in `systemDbFiles.test.ts`, which is why it is a separate
spec: that route is the first one that reads minors' work with no signed-in user.
A logged-in `supervisor` role is the alternative and needs the `schools` membership
that `schools.ts` says today grants nothing beyond one calendar read.
