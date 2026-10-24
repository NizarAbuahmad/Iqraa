# Iqraa — Current Status

> Short on purpose: what is true **right now**, and what is open. The story of how
> each feature got here — what was built, what was and was not verified, the known
> limits — is in [`docs/status-log.md`](./docs/status-log.md). Older audits live in
> `docs/archive/` — historical snapshots, do not act on them.

_Last verified: 2026-10-22, **by command** against production and the repo — not carried
over from older text. Lines marked **(notes)** come from session notes and were not
re-checked that day._

## What Iqraa is

Arabic-native AI teaching assistant for the Jordanian national curriculum
(Grade 10 math + chemistry first). Teachers get a full lesson journey —
objectives → warmup → activity → practice → worksheet → exit ticket — not just
generated text. Differentiators: curriculum-anchored content, SymPy-verified
math answer keys (`artifacts/math-verifier`), RTL/Arabic-first UX.

## Production right now

Checked 2026-10-22:

- **API** `iqraa-api` (Cloud Run, europe-west1, project `iqraa-auth-507315`): commit
  `9346b5f`, revision `iqraa-api-00390-d4p`, 100% of traffic (`/api/healthz/version`).
- **Math verifier** `iqraa-verifier`: `/api/healthz/verifier` answers `ok`, self-test `pass`.
- **Web app** `app.iqrra.com` (Cloudflare Pages): 200. **Landing** `iqrra.com` (separate repo
  `Site_Iqra`, Vercel) answers 308 to `www.iqrra.com`, which is 200.
- **Database:** Neon Postgres, **Launch plan since 2026-10-23** (was Free: 100 compute-hours a
  month, 30.92 used, after which Neon suspends the compute), autoscaling 0.25-0.5 CU, scale to
  zero on, $10 spend alert — see «Neon leaves the Free plan before launch» in the log and the
  first item under *Open*. The schema deploys as migrations (17 files in
  `lib/db/migrations`); `verify-schema` runs before every API deploy.
- **Live config** (plain env on the service): `AI_LIVE_MODE=true`; models `gpt-5.4-mini`
  for generation and for chat (`AI_MODEL_DOCUMENTS`, which would move lesson plans,
  worksheets, quizzes and slide decks to Claude Sonnet 5.5, is **unset**: the code is in,
  the secret and the switch are Nizar's — «Claude writes the documents» in the log); budgets `AI_BUDGET_USD=50`, per user `1`, per
  student `0.20`; `STUDENT_ACCOUNTS=true`; `MASTERY_GATE=true`.
- **Credentials:** 11 are Secret Manager references, 18 are plain config. Rotation:
  [`docs/deploying.md`](./docs/deploying.md), «Rotating a secret».
- **Mobile:** `app.json` version `1.5.0`. An OTA update only reaches a binary with the same
  version (CLAUDE.md, «`app.json`'s `version` is the OTA compatibility key»).
- **Every shipped build uses live AI.** `EXPO_PUBLIC_DEMO_MODE=false` is set for Android
  (`eas.json`, `mobile-update.yml`) and, since 2026-10-16, for the web build (`deploy.yml`).
  The code default in `demoMode.ts` is still demo mode; do not flip it without a decision
  (see «Strategy» in the log, which describes the older demo-only setup).

## How a change reaches production

- `main` is merge-only and the only branch that deploys. A merge runs: production
  migrations → schema check → API and verifier → web, and the web job is skipped if an
  earlier one failed ([`docs/deploying.md`](./docs/deploying.md)).
- Required check on `main`: `typecheck + tests`. Also run on every PR, not required:
  `migrations match schema`, `math verifier`, `destructive migrations acknowledged`,
  and the browser smoke test (`e2e/`, teacher → exam → student → results).
- Workflows: ci, deploy, deploy-rerun-stalled, destructive-migration-ack, e2e, mobile-build,
  mobile-build-gradle, mobile-update, provider-eval, rls-neon-rehearsal, schema-check.

## Open

- **A student can sign up with an email and no teacher's code — the legal wording needs a person
  to read it before this merges.** The privacy policy §5 and terms §1 (`constants/legal.ts`,
  `LEGAL_VERSION` 2026-10-23) now say a student may join with an email after confirming they are
  an adult or have a guardian's agreement; they were drafted, not reviewed by a lawyer, and the
  store declaration (`lib/features.ts` comment) still describes accounts made only through a
  class. Merging deploys it, and every user is asked to accept the new version. Becoming a
  student by switching role asks for the same confirmation as signing up as one. Entry:
  «Students choose an email or a teacher's code» in the log.
- **Neon is on Launch (applied 2026-10-23 by the owner); two checks remain.** Autoscaling 0.25-0.5
  CU, scale to zero on: about $10 a month expected, about $39 at most (estimates; read Neon's
  Usage page weekly for a month). Check `pooled` on `GET /api/healthz/pool` (admin key) once this
  deploys: if `false`, production's `DATABASE_URL` is a direct connection (218 direct
  connections at the 0.5 CU maximum, fewer when scaled down); switch the secret to the pooled
  string. Details and what is unverified: the log entry named above.

Checked 2026-10-22:

- **Crash reporting in the app:** Firebase Crashlytics (PR #1115, 2026-10-19, `app.json` 1.5.0) is
  merged, a 1.5.0 production build ran on 2026-10-22 (the Mobile Android build workflow, success)
  and Crashlytics is enabled in the Firebase console (project `iqraa-95dd1`) **(notes — the owner
  said so; not checked)**. Not verified: which build is installed on a phone, that a crash
  actually appears in the console, and that the OTAs published since #1115 (all runtime 1.5.0)
  reach a device. The API has no error-reporting service; it keeps its own log
  (`/healthz/errors`, admin key) and Cloud Run logs.
- **Row-level security is deployed and switched off** (`RLS_ENFORCE` unset; PR #1048, migration
  `0008`). Rehearsed on 2026-10-23 on a separate empty Neon project: all migrations apply and the
  database suite passes 46/46 on both the direct and the pooled endpoint (workflow run
  39931238295). The connection ceiling checks out (20 instances, pooled endpoint, `max_connections` 225).
  **The latency gate failed (C1, 2026-10-23): +336 ms p95 on a 15-statement request,
  budget +100 ms** — each statement becomes three round trips and one costs about 11 ms from
  europe-west1 to Frankfurt; a mitigation (one held read-only connection per request, inbox first; spec
  2026-10-23) is built, and it must not be switched on until `bench:rls`'s `held` column passes the gate
  (`held` p95 added ≤ +100 ms on the inbox-shaped request, no listed route over +100 ms, every unlisted route's
  cost, about 22 ms per statement, known and accepted or listed). Nothing says it has passed.
  Not done: the `held` measurement (from Cloud Shell, the way the failed run was measured), enabling it in production, and making the `row-level security` check required — the steps and
  the switch are in `docs/rls-rollout-checklist.md`.
- **Draft PR #730** (teacher visibility into English Corner practice) changes the schema,
  conflicts with `main`, and needs `pnpm --filter @workspace/db run generate` after it is updated.
- **The E2E smoke test is not a required check** yet; make it one after about a week
  without a red run.

From session notes **(notes)**:

- Several shipped features still await a **device check**: notifications, grade-setup
  undo, chat identity / leave, the student «اختباراتي» screen, the arch-review fixes.
- **Unsplash** is on the Demo tier (50 requests/hour, shared); it needs Production before launch.
- **Play Store:** `1.2.0` in Closed testing since 2026-10-01; production needs 12 testers
  for 14 days. Native-module changes since then (keyboard, photo shrinking) need a new
  Android build; until one is installed an installed app is unchanged.
- Render demo services are **suspended**, not deleted; if they are ever deleted, also remove
  `https://iqraa-web.onrender.com` from the Google web client's authorised origins.

## Recent changes

The 30 newest dated entries, titles only; the text of each is in the [log](./docs/status-log.md).

- 2026-10-24 — Grade 10 grammar (Semester 2) in the English corner — built, shown to nobody yet
- 2026-10-24 — Tests for the code-only account routes
- 2026-10-24 — Printed grammar forms fit the page, sign-off no longer covers rows, and True or false says right or wrong without pictures
- 2026-10-24 — Grade 10 grammar (Semester 1) in the English corner — built, shown to nobody yet
- 2026-10-24 — Generator screens: Retry repeats the run, and the evaluations picker row
- 2026-10-24 — Generator screens: the toast clears the docked bar
- 2026-10-23 — Students choose an email or a teacher's code
- 2026-10-23 — Generator screens: Cancel then a refusal, and the banner contrast
- 2026-10-23 — Generator screens: the slides
- 2026-10-23 — Generator screens: the activity
- 2026-10-23 — Generator screens: the lesson plan
- 2026-10-23 — Generator screens: the worksheet and homework
- 2026-10-23 — Grade 5 grammar in the English corner — built, shown to nobody yet
- 2026-10-23 — Generator screens: the shared pieces and the quiz
- 2026-10-23 — The "now" amber is only for now
- 2026-10-23 — Grammar-only hub lessons, and the last five Grade 9 grammar lessons — built, shown to nobody yet
- 2026-10-23 — Grade 9 grammar: the passive added, and a wrong «no hub lesson» corrected
- 2026-10-23 — The tab bar is drawn
- 2026-10-23 — Neon leaves the Free plan before launch
- 2026-10-23 — Leftover icon colours follow CONCEPTS
- 2026-10-23 — Grade 9 grammar, thirteen lessons in the English corner — built, shown to nobody yet
- 2026-10-23 — Iqraa draws its own icons
- 2026-10-23 — Grade 9 grammar pilot (Unit 4) in the English corner — built, shown to nobody yet
- 2026-10-23 — Icons follow one system
- 2026-10-22 — Today wears the lesson's subject
- 2026-10-22 — Grade 5 in the English corner — words glossed, recordings still to make
- 2026-10-22 — The desktop Tools grid reads right to left in Arabic
- 2026-10-22 — Live games: students answer from any device
- 2026-10-22 — Status-bar icons read on the corner bands
- 2026-10-22 — Grade 4 reading in the English corner — built, shown to nobody yet

## Finding older detail, and recording new work

- The log has 396 sections. Anything cited elsewhere as
  «see STATUS.md «X»» means the entry titled X in [`docs/status-log.md`](./docs/status-log.md).
- **A PR adds its write-up to the top of the log** and edits **this page only when a line above
  stops being true** (a flag flips, a service moves, an open item closes). Re-verify a line
  before you rely on it: CLAUDE.md's first rule applies here too.
