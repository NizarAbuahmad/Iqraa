# Iqraa — Current Status

> Short on purpose: what is true **right now**, and what is open. The story of how
> each feature got here — what was built, what was and was not verified, the known
> limits — is in [`docs/status-log.md`](./docs/status-log.md). Older audits live in
> `docs/archive/` — historical snapshots, do not act on them.

_Last verified: 2026-10-18, **by command** against production and the repo — not carried
over from older text. Lines marked **(notes)** come from session notes and were not
re-checked that day._

## What Iqraa is

Arabic-native AI teaching assistant for the Jordanian national curriculum
(Grade 10 math + chemistry first). Teachers get a full lesson journey —
objectives → warmup → activity → practice → worksheet → exit ticket — not just
generated text. Differentiators: curriculum-anchored content, SymPy-verified
math answer keys (`artifacts/math-verifier`), RTL/Arabic-first UX.

## Production right now

Checked 2026-10-18:

- **API** `iqraa-api` (Cloud Run, europe-west1, project `iqraa-auth-507315`): commit
  `98ac0a1`, revision `iqraa-api-00382-j28`, 100% of traffic (`/api/healthz/version`).
- **Math verifier** `iqraa-verifier`: `/api/healthz/verifier` answers `ok`, self-test `pass`.
- **Web app** `app.iqrra.com` (Cloudflare Pages): 200. **Landing** `iqrra.com` (separate repo
  `Site_Iqra`, Vercel) answers 308 to `www.iqrra.com`, which is 200.
- **Database:** Neon Postgres. The schema deploys as migrations (11 files in
  `lib/db/migrations`); `verify-schema` runs before every API deploy.
- **Live config** (plain env on the service): `AI_LIVE_MODE=true`; models `gpt-5.4-mini`
  for generation and for chat; budgets `AI_BUDGET_USD=50`, per user `1`, per
  student `0.20`; `STUDENT_ACCOUNTS=true`; `MASTERY_GATE=true`.
- **Credentials:** 11 are Secret Manager references, 18 are plain config. Rotation:
  [`docs/deploying.md`](./docs/deploying.md), «Rotating a secret».
- **Mobile:** `app.json` version `1.4.0`. An OTA update only reaches a binary with the same
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
  mobile-build-gradle, mobile-update, provider-eval, schema-check.

## Open

Checked 2026-10-18:

- **No crash or error reporting service** for the app or the API (no Sentry/Crashlytics/Bugsnag
  anywhere in `package.json`, `app.json` or the API source). The API keeps its own error
  log (`/healthz/errors`, admin key) and Cloud Run logs; the app reports nothing. PR #1115
  adds Firebase Crashlytics to the app (needs a version bump to 1.5.0 and a new build); not merged.
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

- 2026-10-18 — One question-type order, one set of repeat-rule inputs
- 2026-10-18 — One card for quizzes and evaluations
- 2026-10-18 — Slides Maker decks stop looking like bare lists
- 2026-10-18 — Four new slide layouts: timeline, stats, table, flow
- 2026-10-17 — The parent letter stops saying things the teacher never typed
- 2026-10-17 — The parent letter: a typed name can be linked, and guardians can be chosen
- 2026-10-17 — Grade 1 reading in the English corner — built, shown to nobody yet
- 2026-10-17 — Two more slide layouts: quote and photo
- 2026-10-17 — The model chooses a deck's icons and charts
- 2026-10-16 — Typed chemistry topics measured and 18 of 44 misroutes fixed
- 2026-10-16 — The electron-configuration lesson was answered with periodic-trends questions; fixed
- 2026-10-16 — A decimal over a power drew as a broken fraction
- 2026-10-16 — The chat answers teachers, on the web too
- 2026-10-16 — Chat pushes are sent before the send is answered
- 2026-10-16 — Grade 1 grammar in the English corner — built, shown to nobody yet
- 2026-10-16 — The Library's lesson chips open at «كل الدروس» in Arabic
- 2026-10-15 — Exam and evaluation papers stop repeating themselves
- 2026-10-15 — Native photo shrinking needs a new binary: `version` 1.3.0 → 1.4.0
- 2026-10-15 — The periodic-table question family went from 5 to 15 items
- 2026-10-15 — All chemistry families now hold 15 or more items
- 2026-10-15 — Four chemistry lessons were routed to the wrong family; fixed
- 2026-10-15 — The heat-capacity lesson has its own question family
- 2026-10-15 — The derivative bank went from 5 items to 21, so a worksheet on a derivative lesson can reach the picker's count offline
- 2026-10-15 — A Grade 1 English teacher's review
- 2026-10-14 — Lesson plan, slides, activity, lesson-flow and the classroom builder take a unit, semester or whole book — as one revis…
- 2026-10-14 — Quiz, worksheet, homework and game take a unit, semester or whole book
- 2026-10-14 — Lesson plan «أعد التجهيز»: what changed, and what it cannot
- 2026-10-14 — Lesson plans have a second wording for the five fixed sections — Arabic and English, NOT YET READ BY A TEACHER
- 2026-10-14 — Scanning external exams: paper setup from photos, and a whole class at once
- 2026-10-13 — Wide-scope selection, foundation only

## Finding older detail, and recording new work

- The log has 323 sections. Anything cited elsewhere as
  «see STATUS.md «X»» means the entry titled X in [`docs/status-log.md`](./docs/status-log.md).
- **A PR adds its write-up to the top of the log** and edits **this page only when a line above
  stops being true** (a flag flips, a service moves, an open item closes). Re-verify a line
  before you rely on it: CLAUDE.md's first rule applies here too.
