# Admin User Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A system-admin page showing where users spend time, top features, returning/frequent users, what they like, and who the teachers are.

**Architecture:** Three commits on one branch. (1) A per-day, per-area minutes table fed by a 60 s client heartbeat. (2) Four optional teacher-profile columns on `users`, set through `PATCH /auth/users/profile`. (3) `GET /admin/insights` + `/admin/insights/users/:id` in a new router reading via `systemDb`, rendered by two new admin screens.

**Tech Stack:** Drizzle + Postgres migrations, Express, Expo Router / React Native (web too), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-19-admin-user-insights-design.md`

## Global Constraints

- Schema changes are migrations only: edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/`. A new table needs `GRANT SELECT, INSERT, UPDATE, DELETE ON "<table>" TO iqraa_app;` appended to its migration and a place in `rlsCoverage.test.ts` (DEFERRED).
- No `sed -i` / `perl -pi` on source; use the Edit tool.
- Days are Amman calendar days, fixed UTC+3 (`lib/dailyActivity.ts`).
- Files loaded by bare `node --test` import with an explicit `.ts` extension; mobile tests live in `services/__tests__/` and must not import `react-native` / `expo-*`.
- A file that imports `systemDb` must be listed in `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts`.
- Mobile colours from `useColors()`, never `palette`; icons on the `ICON` scale; no emoji ticks/crosses in chrome.
- Product name in copy: «إقرأ» / Iqrra.
- A user-visible change adds a `WHATS_NEW` entry dated the merge day.

---

### Task 1: `usage_minutes` table + heartbeat route (API)

**Files:**
- Create: `lib/db/src/schema/usage.ts`; Modify: `lib/db/src/schema/index.ts`
- Create: migration via `generate`, append GRANT
- Modify: `lib/db/src/__tests__/rlsCoverage.test.ts` (add `usage_minutes` to DEFERRED)
- Create: `artifacts/api-server/src/lib/usageAreas.ts` (pure: `USAGE_AREAS`, `normalizeArea`, `normalizePlatform`, `HEARTBEAT_MIN_GAP_SECONDS = 50`)
- Create: `artifacts/api-server/src/routes/usage.ts` (`POST /usage/heartbeat`)
- Modify: `artifacts/api-server/src/routes/index.ts` (mount)
- Test: `artifacts/api-server/src/lib/__tests__/usageAreas.test.ts`, `artifacts/api-server/src/routes/__tests__/usageHeartbeat.db.test.ts`

**Interfaces — Produces:**
- `USAGE_AREAS: readonly string[]` = `today, tools, gen-quiz, gen-worksheet, gen-lesson-plan, gen-activity, gen-slides, gen-other, classroom, chat, curriculum, corner-math, corner-lab, corner-quran, corner-english, play, classes, evaluations, homework, schedule, teaching-plans, workspace, messaging, school, notifications, profile, admin, other`
- Table `usage_minutes(user_id uuid fk cascade, day date, area text, platform text, minutes int default 0, last_beat_at timestamptz)`, PK `(user_id, day, area, platform)`, index on `day`.
- Route: body `{ area: string, platform: string }` → 204. Upsert:
  ```sql
  insert into usage_minutes (user_id, day, area, platform, minutes, last_beat_at)
  values ($user, $ammanDay, $area, $platform, 1, now())
  on conflict (user_id, day, area, platform) do update
    set minutes = usage_minutes.minutes + 1, last_beat_at = now()
    where usage_minutes.last_beat_at < now() - interval '50 seconds'
  ```
- Tests: pure — unknown area → `other`, bad platform → `web`, list has no duplicates. DB — first beat creates minutes=1; an immediate second beat leaves it 1; a row with `last_beat_at` 2 min ago goes to 2; 401 without a token; the day stored is `ammanDay(now)`.

Steps: write the tests → see them fail → implement → `pnpm --filter @workspace/db run generate` → append GRANT → `pnpm build && node --test` the two files with `TEST_DATABASE_URL` → commit with Task 2.

### Task 2: heartbeat client (mobile)

**Files:**
- Create: `artifacts/mobile/services/usageAreas.ts` (`USAGE_AREAS` mirror, `areaForPath(pathname): UsageArea`)
- Create: `artifacts/mobile/services/usageHeartbeat.ts` (pure `shouldBeat({ signedIn, foreground, lastInteractionAt, now })`, `IDLE_MS = 120_000`, `BEAT_MS = 60_000`)
- Create: `artifacts/mobile/hooks/useUsageHeartbeat.ts` (AppState/visibility + interaction listener, posts via `apiFetch`, swallows errors)
- Modify: `artifacts/mobile/app/_layout.tsx` (mount the hook once, with `pathname`)
- Test: `artifacts/mobile/services/__tests__/usageAreas.test.ts` (every top-level dir/file under `app/` maps to a known area; spot mappings; list equal to the API's file read as text), `artifacts/mobile/services/__tests__/usageHeartbeat.test.ts`

Mapping rules (`areaForPath`): `/` → today; `/ai-tools` → tools; `/ai-tools/quiz` → gen-quiz; `/ai-tools/worksheet` → gen-worksheet; `/ai-tools/lesson-plan` → gen-lesson-plan; `/ai-tools/activity` → gen-activity; `/ai-tools/slides|prompt-slides` → gen-slides; `/ai-tools/classroom*|whiteboard` → classroom; other `/ai-tools/*` → gen-other; `/iqra` → chat; `/curriculum/math|lab|quran|english*` → corner-*; other `/curriculum*` → curriculum; `/play|/live` → play; `/classes` → classes; `/evaluations|/exam-review|/take|/my-exams` → evaluations; `/homework-project|/homework-submissions` → homework; `/schedule|/calendar` → schedule; `/teaching-plans` → teaching-plans; `/workspace` → workspace; `/messaging` → messaging; `/school` → school; `/notifications` → notifications; `/profile|/settings|/setup-*|/onboarding|/whats-new|/faq|/legal|/suggest-feature|/add-email|/delete-account|/teacher-profile` → profile; `/admin` → admin; else other. `/guardian` (excluded by `shouldTrackScreen`) → never beats.

**Commit 1** = Tasks 1 + 2: "Record minutes per screen area per day for admin insights".

### Task 3: optional teacher profile (API)

**Files:**
- Modify: `lib/db/src/schema/users.ts` (+ `gender`, `ageRange` → `age_range`, `governorate`, `yearsTeaching` → `years_teaching`, all nullable text), generate migration
- Create: `artifacts/api-server/src/lib/teacherProfile.ts` (pure option lists + `parseTeacherProfile(body: unknown): { ok: true; updates: Partial<Record<Field, string|null>> } | { ok: false; error: string }` + `teacherProfileOf(user)`)
- Modify: `artifacts/api-server/src/routes/auth.ts` — PATCH `/users/profile` accepts `teacherProfile` (teacher roles only, 400 otherwise); `/auth/me` and the PATCH response include `teacherProfile`.
- Test: `artifacts/api-server/src/lib/__tests__/teacherProfile.test.ts`, `artifacts/api-server/src/routes/__tests__/teacherProfile.db.test.ts`

Options: gender `male|female|unspecified`; ageRange `20-29|30-39|40-49|50+`; governorate `amman|irbid|zarqa|balqa|mafraq|karak|jerash|madaba|ajloun|aqaba|maan|tafilah`; yearsTeaching `0-2|3-5|6-10|11+`. `null` clears a field; an unknown value is a 400; an absent field is untouched.

### Task 4: teacher profile screen (mobile)

**Files:**
- Create: `artifacts/mobile/services/teacherProfile.ts` (same option lists + Arabic/English label keys)
- Create: `artifacts/mobile/app/teacher-profile.tsx` — four `ChipGroup single` rows, Save, and «تخطّ» when opened from setup (`?from=setup`).
- Modify: `context/AuthContext.tsx` (`User.teacherProfile`, `updateProfile` accepts it), `app/setup-subjects.tsx` (first-time success → `/teacher-profile?from=setup`), `app/(tabs)/profile.tsx` (teacher row «عنك»), `services/i18n.ts` (strings), `services/whatsNew.ts` (entry `teacher-profile-optional`, teacher, route `/teacher-profile`), privacy text (one line).
- Test: `services/__tests__/teacherProfileOptions.test.ts` (lists equal to the API's file), existing `whatsNew.test.ts` passes.

**Commit 2** = Tasks 3 + 4: "Optional teacher profile: gender, age range, governorate, years teaching".

### Task 5: insights API

**Files:**
- Create: `artifacts/api-server/src/lib/insights.ts` (pure: `parseInsightsDays` (7|30|90, default 30), `suppressSmall(rows, key='count', min=3)`, `buildCohorts(signups, activeDays, weeks=8)`, `ACTIVITY_SOURCES_SQL` fragment builder kept in the route)
- Create: `artifacts/api-server/src/routes/adminInsights.ts` (`GET /admin/insights`, `GET /admin/insights/users/:id`, `authMiddleware, requireRole("system_admin")`, `systemDb`)
- Modify: `routes/index.ts` (mount after adminRouter), `lib/__tests__/systemDbFiles.test.ts` (list the file)
- Test: `lib/__tests__/insights.test.ts` (cohorts, suppression), `routes/__tests__/adminInsights.db.test.ts` (403 for teacher/school_admin; minutes per area; topUsers order and fields; returning count; feature counts; teacher breakdown suppression; per-user 404 for unknown id)

Response shape (`GET /admin/insights`): `{ days, since, trackingSince, time: { totalMinutes, byArea:[{area,minutes,users}], byDay:[{day,minutes}], byPlatform:[{platform,minutes}], avgMinutesPerActiveDay }, features: { generations:[{kind,count,users}], saved:[{type,count,users}], exported: null, evaluations, homework, chatMessages }, retention: { active, returning, churned, cohorts:[{week, size, retained:number[]}] }, topUsers:[{id,name,role,school,gradeIds,subjectIds,governorate,activeDays,minutes,topAreas,generations,lastSeen}], likes: { byTool:[{key,up,down}], favourites:[{type,count}], subjects:[{id,count}], grades:[{id,count}] }, teachers: { total, gender, ageRange, governorate, yearsTeaching, subjects, grades } }` where each breakdown is `{ answered, rows:[{key,count|null}] }` (null = fewer than 3).

Active day sources: `usage_minutes`, `ai_generations`, `saved_materials`, `evaluations.teacher_id`, `homework.teacher_id`, `chat_messages.sender_id` (verify column names before writing SQL).

### Task 6: insights screens (mobile)

**Files:**
- Create: `artifacts/mobile/services/adminInsights.ts` (types + fetchers + pure formatters, e.g. `formatMinutes`), `app/admin/insights.tsx`, `app/admin/insights-user.tsx`
- Modify: `app/admin/dashboard.tsx` (system_admin nav card), `services/i18n.ts` (strings)
- Test: `services/__tests__/adminInsights.test.ts` (formatters, suppressed-cell rendering label)

**Commit 3** = Tasks 5 + 6: "Admin insights page".

### Finish

- `pnpm run typecheck`; api-server `pnpm build && pnpm test` (with `TEST_DATABASE_URL`); mobile `pnpm test`; `lib/db` test with `RLS_TEST_DATABASE_URL`.
- Check the screens in `pnpm run dev:mobile:web` (light/dark, RTL, phone/desktop) against seeded data.
- Log entry at top of `docs/status-log.md`; STATUS.md line if the analytics paragraph changes; update PR body.
