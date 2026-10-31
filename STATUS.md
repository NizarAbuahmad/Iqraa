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
  `2277f57` **(2026-10-25, from deploy run 801 — its «Verify the deployed commit» step passed; the
  revision name and traffic split were not re-read)**. Last read by command, 2026-10-22: `9346b5f`,
  revision `iqraa-api-00390-d4p`, 100% of traffic (`/api/healthz/version`).
- **Site assistant «اسأل إقرأ»** (checked 2026-10-26 by command): `POST /api/site/ask` is live
  and the widget is on `www.iqrra.com` (`Site_Iqra`). The three starter questions are answered from
  fixed answers (`source: "curated"`); anything else goes to the AI path, capped by
  `SITE_BOT_BUDGET_USD_DAILY` (unset until 2026-10-27, then set to `1` a day by the owner, revision
  `iqraa-api-00445-4fm`, read back as `1`) and counted in `AI_BUDGET_USD`. See «`اسأل إقرأ` is live on iqrra.com» in the log.
- **Math verifier** `iqraa-verifier`: `/api/healthz/verifier` answers `ok`, self-test `pass`.
- **Web app** `app.iqrra.com` (Cloudflare Pages): 200. **Landing** `iqrra.com` (separate repo
  `Site_Iqra`, Vercel) answers 308 to `www.iqrra.com`, which is 200.
- **Database:** Neon Postgres, **Launch plan since 2026-10-23** (was Free: 100 compute-hours a
  month, 30.92 used, after which Neon suspends the compute), autoscaling 0.25-0.5 CU, scale to
  zero on, $10 spend alert — see «Neon leaves the Free plan before launch» in the log and the
  first item under *Open*. The schema deploys as migrations (19 files in
  `lib/db/migrations`, `0018` applied by deploy run 801 on 2026-10-25); `verify-schema` runs before every API deploy.
- **Live config** (plain env on the service): `AI_LIVE_MODE=true`; models `gpt-5.4-mini`
  for generation and for chat (`AI_MODEL_DOCUMENTS`, which would move lesson plans,
  worksheets, quizzes and slide decks to Claude Sonnet 5.5, is **unset**: the code is in,
  the secret and the switch are Nizar's — «Claude writes the documents» in the log); budgets `AI_BUDGET_USD=50`, per user `1`, per
  student `0.20`; `STUDENT_ACCOUNTS=true`; `MASTERY_GATE=true`.
- **Credentials:** 11 are Secret Manager references, 18 are plain config. Rotation:
  [`docs/deploying.md`](./docs/deploying.md), «Rotating a secret».
- **Mobile:** `app.json` version `1.6.0` once the screen-recording PR merges (bumped 2026-10-29 for
  PostHog session replay's native module); **the installed production binary is still `1.5.0`**, so
  OTAs published from `main` stop reaching it until a 1.6.0 build is made and installed. An OTA
  update only reaches a binary with the same version (CLAUDE.md, «`app.json`'s `version` is the OTA
  compatibility key»).
- **Every shipped build uses live AI.** `EXPO_PUBLIC_DEMO_MODE=false` is set for Android
  (`eas.json`, `mobile-update.yml`) and, since 2026-10-16, for the web build (`deploy.yml`).
  The code default in `demoMode.ts` is still demo mode; do not flip it without a decision
  (see «Strategy» in the log, which describes the older demo-only setup).

## How a change reaches production

- `main` is merge-only and the only branch that deploys. A merge runs: production
  migrations → schema check → API and verifier → web, and the web job is skipped if an
  earlier one failed ([`docs/deploying.md`](./docs/deploying.md)).
- Required checks on `main`: `typecheck + tests` and `row-level security` (the latter added by the owner
  on 2026-10-27, in the branch rule's settings **(owner's report — not re-read from GitHub)**). Also run on
  every PR, not required: `migrations match schema`, `math verifier`, `destructive migrations acknowledged`,
  and the browser smoke test (`e2e/`, teacher → exam → student → results).
- Workflows: ci, deploy, deploy-rerun-stalled, destructive-migration-ack, e2e, mobile-build,
  mobile-build-gradle, mobile-update, provider-eval, rls-neon-rehearsal, schema-check.

## Open

- 2026-10-31 — Homework submissions record their author (migration `0022`; what is left open is the item «A student whose record already holds a project…» below)
- 2026-10-31 — Slides: cycle, tree, Venn and mind-map diagrams; curriculum slides gain shapes, icons, charts and photos (untested against a live model)
- **Screen recording of everyone is ON for the web app (since the 2026-10-29 re-run of Deploy
  #868) and not yet running on Android.** Web: the Contentsquare tag loads on `app.iqrra.com` (not
  the marketing website) because the `CONTENTSQUARE_TAG_ID` repository **variable** is set; delete
  it and re-run Deploy to switch it off. Contentsquare's own check reads «Installation
  successful» for the app (owner's screenshot). Two layers of masking, both unverified in a real
  replay: the project's *Data masking* is on «Full masking» with 0 page and 0 element rules
  (owner's screenshot; do not add rules, they unmask), and the code puts `data-cs-mask` on
  `<body>`. **Still to do: open one real recording under Replays and confirm it shows no names,
  marks or answers.** PostHog (usage events everywhere, session replay on Android): from the merge
  of the 2026-10-30 change the app reports to the owner's own **EU** project 326639, created
  2026-10-30 (key and `EXPO_PUBLIC_POSTHOG_HOST` change together in four files, pinned by
  `posthogProject.test.ts`); the older US project behind the previous key has no known owner and
  its history is out of reach. For Android replay that project needs "Record user sessions" on
  **and a 1.6.0 build made after that change merged** (see Mobile above); web events reach it
  once the site redeploys. Students, parents and exam pages are recorded; the parent consent page
  is not. The homework project screen (`/homework-project`, students' photos of their work) is left
  out of screen-view tracking (`shouldTrackScreen`), which does not stop a recording already
  running, and whether masking hides its photos is unverified, like every other screen. The policy (`LEGAL_VERSION` 2026-10-31.b now; its recording text dates from 2026-10-30) was written by a model and **not reviewed by a
  lawyer**; Contentsquare's data location was not checked (PostHog's settings say «EU Cloud»),
  and the Contentsquare plan shows a 200K sessions a month cap.
  Entry: «Screen recordings: Contentsquare on the web, PostHog replay on Android» in the log.
- **`GUARDIAN_APPROVAL` is built (server and app), merged and deployed (PR #1274, 2026-10-25), and
  off; do not set it** until the app has
  reached users, the parent-consent wording has been read by a native speaker and a lawyer, and
  `constants/legal.ts` and `LEGAL_VERSION` are updated. With it on, every email student with no
  teacher link is held (403 `guardian_approval_required`) until a parent approves by email, and
  existing email students are locked out until a parent acts. The owner's steps are numbered in
  the entry «Parent approval for email students — the app (PR B)» in the log; the server side is
  «Parent approval for email students — server (PR A)».
- **A student can sign up with an email and no teacher's code (PR #1226, merged 2026-10-24) — the
  legal wording still needs a person to read it.** The privacy policy §5 and terms §1
  (`constants/legal.ts`, since `LEGAL_VERSION` 2026-10-23; 2026-10-31.b now) say a student may join with an email after
  confirming they are an adult or have a guardian's agreement. They were drafted, not reviewed by
  a lawyer, and nothing in the repo records a review since. Merging deploys, and from then new
  sign-ups record that version; existing accounts are not asked again (there is no re-acceptance
  flow, checked 2026-10-31: only the three sign-up calls in `context/AuthContext.tsx` send it). The code comment on the store declaration
  (`artifacts/api-server/src/lib/features.ts`) now describes both ways in; **the store declaration
  itself (Play Console) was not checked** and may still say accounts are made only through a class.
  Becoming a student by switching role asks for the same confirmation as signing up as one. Entry:
  «Students choose an email or a teacher's code» in the log.
- **A student whose record already holds a project handed in from another account is stuck on that
  homework, and the teacher has no tool to clear it.** Since migration `0022_light_stellaris` (adds
  `homework_submissions.author_user_id`; it ships with the merge that carries it, before the API) a
  submission belongs to the account that wrote it: after a teacher unlinks a mis-claimed account and
  links the right one, the new account sees «سُلِّم مشروع لهذا السجلّ من حساب آخر» and every write is
  409 `other_author`, while the teacher and the parents still see the old work. The only ways out
  today: the old account deletes itself (its work goes), or the teacher archives the whole homework
  (everyone's work goes). To decide: a teacher action that clears one student's submission. Entry:
  «Homework submissions record their author» in the log.
- **An exam's read-aloud recordings outlive the exam's removal and the student's account.**
  Removing an exam (`DELETE /evaluations/:id`) archives it, and attempts reference the roster row, so
  neither that nor the student deleting their account deletes the recordings in R2 (privacy §6
  says so). They go only with a re-take, a quiz retake, the teacher deleting the attempt, or the
  teacher's account. To decide: purge them on archive and/or with the student's account.
- **Uploaded images keep the metadata the device wrote, which can include where a photo was
  taken.** The client re-encodes a photo only when it shrinks it (long edge over 1600 px): on the
  web through a canvas, which writes no metadata; on a phone through `expo-image-manipulator`,
  whose output was not checked for metadata. A smaller photo, or one whose resize fails, is sent as
  its file's own bytes, and the server stores them as received. That covers
  project photos, chat images and lesson media. Privacy §1 now says an attached image may carry its
  own metadata. To do: strip EXIF/GPS on the server, or always re-encode on the client.
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
  reach a device. **API errors:** since PR #1238 (2026-10-24) the API logs in Cloud Logging's
  shape (`severity`, `stack_trace`, `serviceContext`) and the Error Reporting API is enabled on
  `iqraa-auth-507315`. Checked 2026-10-30: production error entries carry `stack_trace`. Not
  checked: that the Error Reporting page groups them. `/healthz/errors` (admin key) and Cloud
  Run logs still work.
- **Row-level security is switched on in production** (`RLS_ENFORCE=on` on `iqraa-api`, set by the owner;
  PR #1048, migration `0008`). The last switch-on was 2026-10-27 about 21:16 on the owner's clock, revision
  `iqraa-api-00456-7md`; the owner reported the teacher inbox, a chat message, the parent's notification and
  reply, and the chat moving up the inbox all working, and the `permission denied` / `row-level security`
  log searches run that day printed nothing **(owner's report and log searches — not re-checked by me)**.
  It had been switched off and on by mistake more than once between 2026-10-24 and 2026-10-27, so there is
  no unbroken run of days to point to. The full 30-minute watch (`docs/rls-watch-checklist.md`, checklist D3)
  was run by the owner on 2026-10-29 and reported **clean** **(owner's report only — which readings they took
  and any numbers were not given to me)**. Rehearsed on 2026-10-23 on a separate empty Neon project: all migrations apply and the
  database suite passes 46/46 on both the direct and the pooled endpoint (workflow run
  39931238295). The connection ceiling checks out (20 instances, pooled endpoint, `max_connections` 225).
  **Latency (C1):** the first benchmark (2026-10-23) failed — +336 ms p95 on a 15-statement request, budget
  +100 ms — because each statement becomes three round trips of about 11 ms (europe-west1 to Frankfurt). The
  held connection (one read-only connection per request, inbox first; PR #1223, spec 2026-10-23) was measured on
  2026-10-24 from Cloud Shell against the rehearsal project's pooled endpoint: an 8-statement request adds
  **+20.8 ms at p95** held (budget +100 ms: passes), against +346 ms without it. Routes not on the held list
  still pay about 22 ms per statement, so each is known and accepted or added to the list
  (`artifacts/api-server/src/lib/heldReads.ts`). Not done: deciding which more routes to hold (read
  `held scope ended` at `LOG_LEVEL=debug` for real statement counts) — steps in
  `docs/rls-rollout-checklist.md`.
  To turn it off: `RLS_ENFORCE=off` with `--update-env-vars` (rollback, checklist D4).
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

- 2026-10-31 — Grade 6 unit word lists in the English corner
- 2026-10-30 — PostHog moves to the owner's own EU project
- 2026-10-29 — Screen recordings: Contentsquare on the web, PostHog replay on Android
- 2026-10-28 — Grade 8 semester 2 word lists in the English corner
- 2026-10-28 — extract-text judges an English book as English, so Grade 8 semester 2 can be extracted
- 2026-10-25 — Grade 8 semester 1 word lists in the English corner
- 2026-10-25 — English audio check: the first real run, and three kinds of false alarm removed
- 2026-10-25 — Lesson games: «ما معنى المصطلح؟» from the books' printed glossary, and a draft route that stays hidden
- 2026-10-25 — A parent signs up with an email or a teacher's code
- 2026-10-25 — Parent approval for email students: merged and deployed, flag still off
- 2026-10-30 — Slides: the class's turn, spot the mistake, and one point at a time (prompts untested against a live model)
- 2026-10-24 — Parent approval for email students: the app (off)
- 2026-10-24 — Parent approval for email students: the server (off)
- 2026-10-24 — English audio: a speech-to-text check of every recording
- 2026-10-24 — English corner: all ten grades, the official books, and free listening and reading sites
- 2026-10-24 — English audio on phones: clips are saved on the device and a lesson's clips are fetched ahead
- 2026-10-24 — Tests for the roster consent gate
- 2026-10-24 — Tests for the login-code reissue route
- 2026-10-24 — Grade 10 grammar (Semester 2) in the English corner — built, shown to nobody yet
- 2026-10-24 — English audio: voice register fixed, clips trimmed and levelled, and an audit that needs no keys
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

## Finding older detail, and recording new work

- The log has 418 sections. Anything cited elsewhere as
  «see STATUS.md «X»» means the entry titled X in [`docs/status-log.md`](./docs/status-log.md).
- **A PR adds its write-up to the top of the log** and edits **this page only when a line above
  stops being true** (a flag flips, a service moves, an open item closes). Re-verify a line
  before you rely on it: CLAUDE.md's first rule applies here too.
