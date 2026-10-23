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
  first item under *Open*. The schema deploys as migrations (11 files in
  `lib/db/migrations`); `verify-schema` runs before every API deploy.
- **Live config** (plain env on the service): `AI_LIVE_MODE=true`; models `gpt-5.4-mini`
  for generation and for chat; budgets `AI_BUDGET_USD=50`, per user `1`, per
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
- 2026-10-22 — Game buttons read in dark mode
- 2026-10-22 — A lesson game can be homework, and the teacher sees the scores
- 2026-10-22 — Any deck plays as Class Challenge, with sound
- 2026-10-22 — Progress is celebrated
- 2026-10-22 — Math Corner exercises: learn or test yourself on a lesson from the book
- 2026-10-22 — Grade 4 grammar in the English corner — built, shown to nobody yet
- 2026-10-22 — Lesson games from a lesson's key terms
- 2026-10-22 — Teachers' phones open on Today
- 2026-10-22 — Book-picture slides no longer share one title
- 2026-10-22 — Grade 3 reading in the English corner — built, shown to nobody yet
- 2026-10-22 — Grade 3 grammar in the English corner — built, shown to nobody yet
- 2026-10-21 — Each corner has its own colour and band
- 2026-10-21 — Cards lift, presses give, screens arrive — 2026-10-21
- 2026-10-20 — Grade 2 reading in the English corner — built, shown to nobody yet
- 2026-10-19 — Grade 2 grammar in the English corner — built, shown to nobody yet
- 2026-10-19 — Arabic, Islamic, civic, digital and PE lessons get their book pages in decks
- 2026-10-19 — Load test: the exam path holds, the sign-up rush does not

## Finding older detail, and recording new work

- The log has 359 sections. Anything cited elsewhere as
  «see STATUS.md «X»» means the entry titled X in [`docs/status-log.md`](./docs/status-log.md).
- **A PR adds its write-up to the top of the log** and edits **this page only when a line above
  stops being true** (a flag flips, a service moves, an open item closes). Re-verify a line
  before you rely on it: CLAUDE.md's first rule applies here too.
