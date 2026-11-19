# Admin user insights — design

Date: 2026-11-19. Status: approved in chat, one PR in three commits.

## Goal

Give a `system_admin` one page that answers: where users spend their time,
which features they use most, how many come back, who the most frequent users
are, what they like, and who the teachers are (what they teach, gender, age
range, governorate, experience).

## What exists today (checked 2026-11-19)

- Feature use is already stored: `ai_generations` (one row per model call,
  `userId`, `kind`, `createdAt`, `platform`), `saved_materials` (type, subject,
  grade, `isFavorite`), `feedback` (rating per tool / material type),
  `evaluations`, `homework`, `chat_messages`.
- What a teacher teaches: `users.gradeIds`, `subjectIds`, `teachingAssignments`,
  `schoolId`, `signupPlatform`, `createdAt`, `lastLogin` (sign-in only).
- **Not stored:** time spent and screens. Screen views go to PostHog only, and
  `routes/admin.ts` / `app/admin/dashboard.tsx` said on purpose not to duplicate
  them. This design reverses that for one coarse measure (minutes per area per
  day), not raw screen views.
- **Not collected:** gender, age, governorate, years teaching. The only `gender`
  column is a roster student's, typed by the teacher.

## Commit 1 — time spent (`usage_minutes`)

**Table `usage_minutes`** (new, `lib/db/src/schema/usage.ts`):

| column | type | note |
| --- | --- | --- |
| `user_id` | uuid → users, cascade | |
| `day` | date | Asia/Amman calendar day (fixed UTC+3, as homework) |
| `area` | text | one of `USAGE_AREAS` |
| `platform` | text | `web` / `android` / `ios` |
| `minutes` | integer, default 0 | |
| `last_beat_at` | timestamptz | rate cap and "last seen" |

Primary key `(user_id, day, area, platform)`. Index on `day`.
Rows are aggregated as they arrive, never raw pings.

**Areas.** `USAGE_AREAS` is a closed list shared by app and API
(exported from the API route module and mirrored in
`artifacts/mobile/services/usageAreas.ts`, pinned equal by a test that reads
both): `today`, `tools`, `gen-quiz`, `gen-worksheet`, `gen-lesson-plan`,
`gen-activity`, `gen-slides`, `gen-other`, `classroom`, `chat`, `curriculum`,
`corner-math`, `corner-lab`, `corner-quran`, `corner-english`, `play`,
`classes`, `evaluations`, `homework`, `schedule`, `teaching-plans`,
`workspace`, `messaging`, `notifications`, `profile`, `admin`, `student`,
`other`. `areaForPath(pathname)` maps a route to an area; IDs and query
strings are never sent.

**Client.** `useUsageHeartbeat()` mounted once in `app/_layout.tsx`. Every 60 s
it sends `POST /usage/heartbeat { area, platform }` only when **all** hold:
signed in; app foreground (`AppState` / `document.visibilityState`); a touch,
key or scroll in the last 120 s. The gating decision is a pure function
(`services/usageHeartbeat.ts`, `shouldBeat`) so it runs under bare
`node --test`. Failures are dropped, never queued or retried.

**Server.** `POST /usage/heartbeat` (`routes/usage.ts`, `authMiddleware`, any
role). Validates `area` against `USAGE_AREAS` (unknown → `other`) and
`platform`. Upsert: `minutes = minutes + 1`, `last_beat_at = now()`, **only if**
the row's `last_beat_at` is older than 50 s (or the row is new) — so one user
can earn at most ~1 minute per 50 s per area, whatever the client does.
Responds 204. Scoped to the caller's own row (RLS: owner write).

**RLS.** `usage_minutes` classified in `rlsCoverage.test.ts` as owner-scoped
(`user_id = current user`), with a grant to `iqraa_app`. The admin read goes
through `systemDb`; `routes/admin.ts` already uses it, so `systemDbFiles.test.ts`
needs no new file unless the insights code is split into its own module (then
add it there).

History: none. The page says "time tracking started <ship date>".

## Commit 2 — optional teacher profile

Four nullable `text` columns on `users`, each a closed set validated server-side:

- `gender`: `male` / `female` / `unspecified`
- `age_range`: `20-29` / `30-39` / `40-49` / `50+`
- `governorate`: the 12 Jordanian governorates (ids: `amman`, `irbid`,
  `zarqa`, `balqa`, `mafraq`, `karak`, `jerash`, `madaba`, `ajloun`, `aqaba`,
  `maan`, `tafilah`)
- `years_teaching`: `0-2` / `3-5` / `6-10` / `11+`

The option lists live in one small module on each side
(`artifacts/api-server/src/lib/teacherProfile.ts`,
`artifacts/mobile/services/teacherProfile.ts`), pinned equal by a test.

- `PATCH /users/profile` accepts them **only for teacher roles**
  (`TEACHER_ROLES`); from any other role the fields are a 400. `null` clears.
- Returned on the auth user payload so the app can prefill.
- UI: an optional card at the end of `setup-subjects` («ساعدنا في تحسين
  إقرأ» + «تخطّ»), and the same fields under Profile → edit. Chips, not free
  text. Arabic and English labels.
- `WHATS_NEW` entry (teacher role, route to the profile edit screen).
- Privacy policy: one line naming the fields and the purpose. The wording is
  flagged in the PR for the owner's sign-off.

## Commit 3 — the insights page

**API** (`routes/admin.ts`, `requireRole("system_admin")`):

- `GET /admin/insights?days=7|30|90` → one JSON:
  - `time`: total minutes, minutes per area, minutes per day, minutes per
    platform, average minutes per active user-day. `trackingSince`.
  - `features`: `ai_generations` count by `kind`; `saved_materials` by `type`;
    evaluations created; homework posted; chat messages sent. Per period.
  - `retention`: active users (any of: a usage row, a generation, a saved
    material, an evaluation, a homework, a chat message — by day),
    returning (≥ 2 active days in the period), churned (active in the 30 days
    before the window's last 14 days, none since), and weekly cohorts for the
    last 8 sign-up weeks (week 0…7 share still active).
  - `topUsers`: top 50 by active days, then minutes. Each: id, name, role,
    school name, gradeIds, subjectIds, governorate, active days, minutes, top 3
    areas, generations, last seen (`max(last_beat_at, lastLogin)`).
  - `likes`: 👍/👎 counts and rate per tool / material type; favourites by type;
    top subjects and grades by generations + saved materials.
  - `teachers`: counts by subject, grade, governorate, gender, age range,
    years teaching, each with `answered` / `total`.
  - **Suppression:** in `teachers` and `likes` breakdowns, any cell with
    1–2 people is returned as `{ suppressed: true }` (shown "<3").
- `GET /admin/insights/users/:id?days=…` → that user's profile fields, daily
  activity (minutes + events per day), feature mix, area mix, feedback list.

The aggregation lives in a pure-ish module `src/lib/insights.ts` (SQL + small
pure helpers for cohorts and suppression) so the maths is testable without the
route.

**App:** `app/admin/insights.tsx` and `app/admin/insights-user.tsx`. A card on
`dashboard.tsx` (system_admin only, like Schools). Period toggle
(`SegmentedControl` 7/30/90). Bars drawn with plain views, as the existing
dashboard charts are. Colours from `useColors()`, icons on the `ICON` scale,
cards from `useSurface()`. Arabic first, RTL.

## Testing

- API, DB tests: heartbeat upsert + the 50 s cap + Amman day boundary; unknown
  area → `other`; profile fields 400 for student/parent, accepted for teacher;
  `/admin/insights*` 403 for teacher, school_admin, student; retention and
  cohort maths on fixed rows; suppression of cells < 3.
- API unit: `USAGE_AREAS` equal to the app's list; profile option lists equal.
- Mobile (`services/__tests__`): `areaForPath` covers every top-level route
  directory under `app/` (reads the folder), `shouldBeat` gating.
- `pnpm run typecheck`, api-server build + test, mobile test, as CI.

## Out of scope

School-admin access; exporting the data; per-screen (rather than per-area)
time; anything collected from students or parents beyond minutes per area.
