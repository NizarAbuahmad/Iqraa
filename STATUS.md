# Iqraa — Current Status

> The single source of truth for project state. When something here stops being
> true, **edit this file in the same PR that changes it.** Older audits live in
> `docs/archive/` — they are historical snapshots, do not act on them.

_Last verified: 2026-08-12, against the running system (local Linux checkout +
the hosted demo API). Earlier lines carried over from the 2026-08-10 and
2026-08-06 passes are marked where they were not re-checked._

## What Iqraa is

Arabic-native AI teaching assistant for the Jordanian national curriculum
(Grade 10 math + chemistry first). Teachers get a full lesson journey —
objectives → warmup → activity → practice → worksheet → exit ticket — not just
generated text. Differentiators: curriculum-anchored content, SymPy-verified
math answer keys (`artifacts/math-verifier`), RTL/Arabic-first UX.

## Strategy (decided 2026-08-06)

Investor demo with **real, visible math verification**; all prose/content
generation stays mocked (`DEMO_MODE = true` in
`artifacts/mobile/services/ai/demoMode.ts` — do not flip it without a decision).
Vision screens (student/parent/school dashboards) are deprioritized.

> **Verification is live on the hosted demo as of 2026-08-10.** Confirmed
> end to end against `iqraa-api-dfxu.onrender.com`, both directions:
> `3x^4 - 2x + 7 → 12x^3 - 2` returns `verified: true`, and the same question
> with `12x^3 + 2` returns `verified: false` with `error: answer_mismatch` —
> while still reporting `computed_answer: 12*x**3 - 2`. It does not merely
> reject a wrong key; it derives the right one independently.
>
> What remains is surfacing that in the UI (blocker below). The verifier being
> live is not the same as a teacher being able to see that it ran.

## What works today (verified, not assumed)

- `pnpm install` and full `pnpm run typecheck` pass clean (checked on Windows
  2026-08-06 and on Linux 2026-08-10).
- Mobile test suite: 376 tests, 0 failures (10 skipped). The `test` script
  globs `services/__tests__/**/*.test.ts` — it used to be a hand-listed set of
  files that had drifted, so two suites never ran.
- API test suite: 74 tests, 0 failures. Its `test` script globs
  `src/**/__tests__/**/*.test.ts`; it was scoped to `src/modules/**` and so
  never ran anything under `src/lib` or `src/routes`. The mount-order suite
  boots the built bundle, so run `pnpm build` before `pnpm test` or it skips.
- **CI runs on every pull request** (`.github/workflows/ci.yml`, added
  2026-08-12): typecheck, then the api-server build *before* its tests, then
  both suites, plus the SymPy verification regressions. Node and pnpm are
  pinned to the versions the Render build uses. Before this the repo had no
  checks at all, which is how a `dist/` bundle built from an older commit was
  read as two failing tests on `main` for two days — the api-server suite boots
  `dist/index.mjs` and `pnpm test` does not build it.
- Local dev runs end to end: Express API (:8080) + Postgres 17 (`iqraa` db,
  6 tables) + Expo web (:8083). Login/register work against the local DB.
- Curriculum data loads in-app (math S1: 4 units / 18 lessons). It now lives in
  `lib/curriculum` (`@workspace/curriculum`), shared by mobile and the API —
  `services/curriculumData.ts` and `services/curriculumG10*.ts` are re-export
  shims, so app imports are unchanged. The API serves it at `/api/curriculum/*`
  (grades, subjects, books, units, lessons, objectives) because evaluation
  questions must be generated and graded against objectives server-side.
- **Math S1 is fully objective-backed.** Units 2–4 were title-only (13 lessons,
  zero objectives) because only the student book was on hand, which states
  objectives per unit. They were completed from the Semester 1 teacher guide's
  `مخطَّط الوحدة` tables (book pages 36B / 76B / 110B): per-lesson objectives,
  vocabulary and period counts. Math S1 went from 11 objectives to 59, and every
  Sem1 lesson now carries at least one (guarded by test).
  - Extraction needs the **winget poppler build**, not `/mingw64/bin/pdftotext` —
    the latter returns almost no Arabic from these NCCD PDFs, which is why the
    guide looked unusable. Even with the right build the text layer mangles the
    lam-alef ligature (`المعادلات` → `المعادالت`) and drops some hamza carriers,
    so the tables were transcribed from `pdftoppm` renders instead.
  - **Edition mismatch, unresolved:** the teacher guide gives Unit 2 a fifth
    lesson (الدوائر المتماسة, 3 حصص) plus a توسُّع item that the student book on
    file does not have. Not added — see `known_gaps` in the curriculum JSON.
- Objective counts, NCCD data in `lib/curriculum/src/data/*.json`: math S1 59,
  math S2 61, financial literacy 40, chemistry S1 12 (across 3 units /
  9 lessons, and 3 of those lessons still have none).
  - Separately, `lib/curriculum/src/catalog.ts` holds a small hand-authored
    catalog with real Bloom's levels — 4 of its objectives are chemistry S1.
    **These are two different datasets; do not read "chemistry 4" as the
    chemistry objective count.** Everything not hand-authored is stamped
    `'Understand'` by the catalog builders, so objectives expose
    `bloomsSource: 'authored' | 'defaulted'` and an `inferredBloomsLevel`
    derived from the Arabic action verb.
    See `docs/student-evaluation-module-plan.md` — **note its "nothing is
    implemented yet" header is out of date**: as of 2026-08-12 its phases 0–2
    are largely built (schema, roster + UI, evaluation CRUD/generate/coverage/
    publish, validators), plus deterministic marking and level aggregation.
    What is missing is any evaluation UI, the attempts/answer-entry endpoints,
    and the dashboard.
- Chemistry is thinner than "math + chemistry first" implies: 3 units /
  9 lessons against math's 4 / 18 per semester.
- Financial Literacy G10 S1 is browsable (2 units / 10 lessons, NCCD-sourced).
  It was previously offered as a subject tile with no book behind it, so the
  subject dead-ended on the "no semesters" empty state.
- Expo Go on a phone works over LAN (firewall rule `Iqraa-Dev-8080-8083`;
  see LOCAL_SETUP.md).
- `mockup-sandbox` is excluded from the workspace — it is a design sandbox,
  not product UI, and its type errors used to block the whole monorepo build.
- **Hosted demo: all three services are live** (free tier — see render.yaml).
  All three are blueprint-managed and show **Deployed** in the Render dashboard:
  - Web: https://iqraa-web.onrender.com (static, always awake) — **up**
  - API: https://iqraa-api-dfxu.onrender.com (`iqraa-api` name was taken —
    note the `-dfxu` suffix; sleeps after ~15 min idle, ~30-60s to wake.
    **Warm it up before demos.**) — **up**, login verified 2026-08-10
  - Verifier: https://iqraa-verifier.onrender.com (SymPy/FastAPI,
    `artifacts/math-verifier`) — **up since 2026-08-09**. `/healthz` returns
    `{"status":"ok","topics":["derivative_frac_neg_exp","derivative_polynomial"]}`.
    - **The API now reaches it.** `MATH_VERIFIER_URL` on `iqraa-api` is set to
      the public URL `https://iqraa-verifier.onrender.com`. Verified end to end
      2026-08-10: correct key → `verified: true`; wrong key → `verified: false`,
      `error: answer_mismatch`, `computed_answer: 12*x**3 - 2`.
    - **Why it was broken, and why the diagnosis took three days.** The
      blueprint sets `MATH_VERIFIER_URL` via `fromService … property: hostport`,
      which yields Render's *internal* address `iqraa-verifier:10000`, and
      Render's private network serves plain **HTTP** there.
      `normaliseVerifierUrl` treated "not localhost" as "must be https", so the
      API opened a TLS handshake against a non-TLS port and got
      `client_error:fetch failed` — instantly, and indistinguishably from the
      service not existing. **This file asserted "NOT DEPLOYED" for exactly that
      reason, and was wrong.** "Unreachable" and "not deployed" are different
      states; only the Render dashboard could tell them apart.
    - `fix/verifier-internal-url` makes the scheme follow the hostname's shape —
      no dot means an internal service name, so http. **Worth merging even
      though the public URL works**: without it, the blueprint's own wiring
      stays a trap, and a re-sync that restores `hostport` would silently break
      verification again.
    - To check reachability at any time, unauthenticated:
      `GET /api/healthz/verifier` → `{"verifier":"ok"|"unreachable"}`
      (needs PR #27 merged).
  - DB: Neon free Postgres, project "iqraa", eu-central-1 (Frankfurt).
    Schema pushed; register/login verified end-to-end against it.
  - Demo account: demo@iqraa.app / IqraaDemo2026
  - Note the verifier is free-tier too, so it will sleep after ~15 min once
    deployed. The client's timeout is 2.5s, so the first call after idle fails.
    **Warm the verifier as well as the API before a demo** — a sleeping
    verifier and an undeployed one look the same from the app.

## Teacher UX pass — merged 2026-08-10

Was on `feat/evaluation-authoring`; **now merged into `main`** (`06ed814`).
Nothing is outstanding on that branch. (For unmerged work, see "Open
decisions" — as of 2026-08-12 only `claude/ikra-chat-agent-uiux-1j6wpm`
remains parked.)

General rule that still applies: the deployed site only shows what is on
`main`, which is the usual reason a change "did not appear" — check
`git log origin/main..origin/<branch>` before debugging anything visual.

Landed, in order:

- **Arabic typeface.** The app shipped with no Arabic font: all 574 `fontFamily`
  declarations asked for Inter, which has no Arabic glyphs, so every Arabic
  string was drawn by a per-device fallback at that fallback's own weight —
  bold headings were not reliably bold. Almarai now carries body, Cairo carries
  500/600/700. Chosen to map 1:1 onto the four Inter weights already in use.
- **Iqraa's mark.** `BrandLogo` is a 1024px two-line lockup and was being drawn
  at 22px in avatars, where it greys into a smudge — the "empty circles". New
  `IqraaMark` draws the leaf as vector for small sizes; BrandLogo stays where
  there is room for it.
- **Student mode removed** from the Iqraa screen. `Mode` narrowed to a single
  member so the compiler finds anything that still branches.
- **Grounding is stated.** All four tools now say whether output is anchored to
  a curriculum lesson, and name it when it is. Matters most because maths draws
  on a curated bank of 87 real problems while chemistry and financial literacy
  fall through to templates, and nothing showed the difference.
- **Document upload paused** behind `DOCUMENT_UPLOAD_ENABLED` in
  `services/features.ts`. Off because the curriculum already ships in the app,
  so uploading a textbook page pays to send content we hold — and with real
  generation on, it rides along as tokens on every request. Everything behind
  the flag still compiles; flip to `true` to restore.
- **Inline editing.** Generated material is editable in place (no edit mode) on
  the lesson-plan screen, the quiz screen, and lesson plans in chat.
  `LessonPlanView` is shared between the tool screen and chat so the two cannot
  drift. Quiz edit transforms live in `services/quizEdits.ts` with tests: the
  trap is that `correctAnswer` stores option **text**, so rewriting the correct
  option without carrying the key leaves a question with no right answer.
- **Chat stopped discarding structure.** It calls the same generators as the
  tools, then used to flatten the result to a string one line later.
  `ChatArtifactResult.data` now keeps the object; worksheet/quiz/activity carry
  it but still render as text until each gets a view.

## Chat + evaluation pass — merged 2026-08-12

Four PRs (#32, #34, #35, #36), all on `main`.

**The chat screen shed its chrome.** The header carried a mark, a wordmark, a
tagline, a demo label and a scrolling strip of tool chips above a conversation
that had not started — about a third of a phone screen. It is now the logo plus
the demo pill. The tool chips moved into the thread: inside the intro while it
is the only thing there, above the composer once a conversation exists, never
both at once. The current-lesson card, which opened to another third of a
screen, now defaults to one line — Start Class, lesson name, a done/total pill —
with the breadcrumb, Change Lesson and the rest one tap away. Web also stopped
applying a 67pt notch allowance it does not need and now centres content in a
readable column instead of stretching it across the window.

**The composer's "+" opens the whole tool catalog.** `services/toolCatalog.ts`
is now the single list, shared with the AI Tools screen — two hand-maintained
copies drift, and a tool added to one surface would quietly not exist on the
other. Tools the conversation can carry out run inline; the rest hand off to
their own screen carrying the current lesson. The five resource chips left the
lesson card as redundant with it.

**Results can be copied and exported**, and stopped rendering twice — a
generated lesson plan arrived as an editable document *and* as the entire
formatted plan again beneath it. A message that renders a document now shows
only the conversation around it. Copy and export re-serialise from the
structured data, so an edited plan exports as edited rather than as first
generated.

**Objective answers can now be marked.** `TypeModule` could validate and
sanitise a question but not mark one, so the roster, the generator and publish
all led nowhere. `grade()` exists on exactly the four types where marking is not
a judgement call; its absence on the other four is the contract that stops a
caller defaulting an ungraded answer to zero. `modules/assessment/normalize.ts`
folds Arabic orthography before comparing — hamza carriers, taa marbuta, final
yaa, harakat, tatweel, Arabic-Indic digits — so a student who writes الدائره for
الدائرة keeps the mark. Standalone hamza is deliberately left alone; folding it
changes words.

**Marks aggregate into a level** (`modules/assessment/scoring.ts`), with two
refusals: a competency backed by fewer than two questions or under a tenth of
total marks reports no percentage at all, and a headline average is capped when
its parts do not support it. Pure functions, 13 tests, no database needed.

**Also:** AI Tools joined the tab bar; More Tools moved from the account screen
to that tab (it is still the only route to lesson media and Smart Templates, so
it was moved rather than removed); "كيف أستخدم اقرأ؟" is now a nine-question FAQ
(`app/faq.tsx`) instead of re-opening the retired home screen's coach card.

### Roster storage — a production incident worth remembering

Creating a class on the hosted demo failed with a generic 500 rendered as
English "Failed to create class" inside an Arabic dialog, behind the sheet the
teacher was looking at. The handler was fine: **the Neon database had no roster
tables.** Nothing in the deploy creates them — the schema comes from
`pnpm --filter @workspace/db run push`, which only ever runs by hand, and a
release had added the tables without anyone running it.

Fixed in production by creating the three tables directly. In the repo:
roster routes now detect Postgres `42P01` / `42703` and answer 503 with
`code: "roster_storage_unavailable"` instead of a generic 500, the client
translates that code rather than echoing English into an Arabic UI, and
`render.yaml` states that no build step touches the database. The detection
walks the error's `cause` chain — drizzle wraps driver failures in
`_DrizzleQueryError`, so a check against the top level silently never matches.

**The rule this leaves:** when a release adds or changes a table, run the schema
push against the deployed `DATABASE_URL` as part of shipping it. Push is
deliberately not wired into `buildCommand` — drizzle-kit resolves drift by
dropping columns, and a deploy is the wrong place to discover that.

## Logo, flag, installability — merged 2026-08-13

PR #38, on `main`.

**The chat header's mark was unreadable at the size it's actually shown.**
`BrandLogo`'s lockup is a two-line image built for a splash screen; at the
~28px the header rendered it, each line of type lands about ten pixels tall
and dissolves into a grey smudge (the component's own doc comment already
said so — the header just wasn't using it). Swapped to `IqraaMark` at 30px
plus a live `<Text>` wordmark, which is what the mark was designed for.

**The Jordan flag was two letters, not a flag.** `🇯🇴` is a pair of regional-
indicator codepoints; Windows' Segoe UI Emoji has no flag glyphs for them, so
it rendered as literal Latin "jo" inside Arabic UI. Invisible in this sandbox
(Chromium ships Noto Color Emoji, which does render it) — only visible on the
user's actual machine. Replaced with `components/ui/JordanFlag.tsx`, a plain
SVG, everywhere the emoji appeared.

**The Notifications tab is hidden.** It has only ever rendered "no
notifications" — nothing feeds it. A tab that has never shown anything reads
as "there is nothing here" rather than "empty today," and it was costing a
fifth of the tab bar. The route stays registered so restoring it is one line.

**The web build is installable.** A teacher projecting the app got a browser
chrome — address bar, tabs, bookmarks strip — across the top of the lesson.
`public/manifest.webmanifest` plus `scripts/inject-pwa.mjs` (a post-`expo
export` patch to `dist/index.html`: manifest link, scheme-scoped theme-color,
Apple PWA meta tags, RTL `lang`/`dir`) make it installable to a home screen or
app-list entry, opening fullscreen. `app/+html.tsx` was tried first and
looked correct in the diff but had zero effect — Expo only honours that file
when `web.output` is `"static"`, and this app exports as an SPA, so it was
silently ignored. Caught only by actually running the export and grepping the
generated HTML. `render.yaml`'s `iqraa-web` build now calls `pnpm run
build:web` (export + inject) instead of a bare `expo export`.

## Attempts API — Phase 4 backend, merged 2026-08-13

PR #40, on `main`. API only; no mobile UI (that gap is closed below).
The evaluation plan (`docs/student-evaluation-module-plan.md`) calls this
"answer entry (teacher)": a teacher opens a student, enters what they wrote on
paper, and the app grades it. The schema for this (`attempts`, `attemptAnswers`,
`attemptQuestionGrades`, `attemptResults`, and friends) already existed —
phases 5–6's grading engine (`questionTypes.ts` `grade()`, `scoring.ts`
`scoreAttempt()`) was already built and tested but had nothing calling it. This
wires them together rather than building them.

**New:** `POST/GET /evaluations/:id/attempts` (find-or-create, list — in
`evaluations.ts`, since starting an attempt needs the evaluation's live
questions and level scale), and `GET /attempts/:id`,
`PUT /attempts/:id/answers/:questionId`, `POST /attempts/:id/submit` (new
`routes/attempts.ts`, self-scoped `router.use("/attempts", authMiddleware)`,
never re-declaring `/evaluations`'s own guard). An attempt snapshots its
questions and level-scale bands at creation, per the plan's §7: a later edit
to the evaluation or the scale must not retroactively change what an
in-flight attempt is graded against.

**Grading is honest about what it can't grade yet.** New
`modules/assessment/gradeAttempt.ts` (pure, unit-tested) runs `grade()` over
every question that has one and folds the results through `scoreAttempt()`.
A question whose type has no `grade()` — `short_answer`, `open_ended`,
`problem_solving`, `practical_task`, i.e. anything `ai_rubric` or `manual` —
is **not** scored as zero; it is left out of the persisted grades and the
score entirely, and the attempt is marked `needs_review` /
`isProvisional: true`. Tier 2 (SymPy math equivalence) and Tier 3 (AI rubric
grading) don't exist yet, so today that is every question the mock generator
produces — `mockGenerator.ts` only emits `ai_rubric` types, since it won't
fabricate MCQ distractors or true/false statements from curriculum text. A
teacher-authored evaluation with real objective questions grades those
questions for real today; nothing here pretends to grade the rest.

**Verified against a real database, not just typecheck + unit tests** (this
file's own rule): stood up local Postgres 16, pushed the schema, seeded the
default level scale, registered a teacher, created a class and a student,
generated a mock evaluation (confirmed: all six generated questions were
`ai_rubric`, exactly as designed), inserted one `multiple_choice` and one
`true_false` question directly (there is still no "add a manual question" API
— that's Phase 3 authoring UI, not built), published, created an attempt,
entered three answers, and submitted. Result: the two deterministic questions
graded correctly (one correct, one incorrect), the six `ai_rubric` questions
were excluded rather than zeroed, `isProvisional: true`, level resolved to
`نامٍ` at the resulting percentage. Fixed an answer and resubmitted: grade and
result rows were replaced in place (row counts stayed at 2 and 1), not
duplicated.

**Fixed in passing:** `attemptResults.objectiveScores`'s Drizzle column was
typed `Record<string, unknown>`; `scoreAttempt()` has always returned an
array (`ObjectiveScore[]`) there. Corrected the type annotation — jsonb, so no
migration.

**Still missing** at the time this shipped: an evaluation-authoring UI to
reach a published evaluation at all (Phase 3, closed the same day — see the
next section), and the mobile answer-entry screens themselves
(`evaluations/[id]/answers/*` in the plan's §5.2) — this PR deliberately
scoped to the backend only, since a teacher-entry screen with nothing to
attach it to would be unreachable.

## Evaluation authoring — minimal Phase 3, 2026-08-13

A teacher can now build and publish a real evaluation from the app: pick a
book, pick learning objectives, pick question types and a count, generate,
review, publish — end to end, reachable from **الأدوات → أدوات إضافية →
التقييمات**. This is deliberately smaller than the plan's §1.1 wizard (no
per-question editing, no coverage meter, no preview-as-student step): it
proves the pipeline the way #40's attempts API did — the smallest real slice,
not the whole vision.

**New:** `services/evaluations.ts` (client mirroring `roster.ts` — an
`EvaluationError` with `status`/`code`, same `readJson` pattern) and three
screens — `app/evaluations/index.tsx` (list), `new.tsx` (the form: title,
book, objectives, types, difficulty, count — submits by creating the
evaluation and immediately generating), `[id].tsx` (read-only question review
+ publish/regenerate). Objective and book data come straight from
`@workspace/curriculum`, already bundled client-side — no network round trip,
and it cannot drift from what the server accepts, since both read the same
package. The old "ورقة امتحان" (exam paper) tool-catalog entry, a
`comingSoon`-badged placeholder pointing nowhere, is replaced with the real
`/evaluations` route — it was reserving exactly this feature.

**Caught by using the actual app, not just typecheck:** the publish
confirmation used `Alert.alert` directly, which — per `services/confirm.ts`'s
own doc comment — silently does nothing on the web build; the dialog never
fires its buttons there. This exact failure mode was already hit and fixed
once before (roster removal, saved-material delete), with a shared `confirm()`
helper built specifically to stop it recurring. Caught by driving the actual
button in a real browser (Playwright against the local dev server), not by
reading the code — it typechecked and looked correct in the diff.

**Verified in a real browser against the running API + local Postgres:**
logged in, opened AI Tools → أدوات إضافية → التقييمات, saw the evaluation
created via #40's API testing already listed with its correct status and
marks, opened "New evaluation," picked the chemistry book (real Bloom's
data), selected two objectives and four question types (including
`multiple_choice`/`true_false`, to prove non-`ai_rubric` types round-trip
through this form even though the mock generator can't produce them),
generated a full 8-question evaluation, reviewed it, published, and confirmed
after a fresh page reload that the status persisted as منشور.

**Still missing:** per-question editing (retype a stem, fix an option, adjust
marks — currently only possible by deleting and regenerating the whole set),
a coverage meter, and the mobile answer-entry screens (Phase 4's UI — the API
has existed since #40).

## Answer-entry screens — Phase 4's UI, merged 2026-08-13

PR #42, on `main`. The evaluation pipeline is now demoable end to end in the app: author →
generate → publish → **enter a student's answers → submit → see their level**
— the last piece was reachable only via direct API calls until now. From a
published evaluation, **أدخل إجابات الطلاب** opens a class → student picker
(reusing the roster's own two-step navigation rather than inventing a new
one), each student's row showing their attempt's status and, once graded,
their percent. Opening a student finds-or-creates their attempt and renders
every question type with a real input — tap-to-select for multiple choice
and true/false, a per-row picker for matching, one text field per blank for
fill-in, a text area for the four open-response types — each answer saved as
it's entered (one `PUT` per field) rather than batched, so a dropped
connection loses at most the field being edited. Submitting shows the graded
result inline: level badge, percent, marks, and the four competency rows
(each a percentage or "بيانات غير كافية" per the sufficiency rule), with
**نسخ** and **مشاركة** buttons the teacher asked for.

**Caught by using the actual app, again:** clicking **مشاركة** threw
`Share is not supported in this browser` and crashed the screen — RN Web's
`Share.share()` requires `navigator.share`, which most desktop browsers don't
implement. This is the same class of bug the `Alert.alert`-on-web issue was
(looks fine on a phone, breaks in the browser teachers are demoed on), and it
was already latent in `shareAsText` for every existing caller (the quiz
screen's share button included) — none of them wrapped the call. Fixed at the
source: `shareAsText` now detects the missing API and falls back to copying
to the clipboard, returning which one happened so the caller can toast
correctly. Every existing call site is fixed by the same change; none needed
to touch their own code.

**Honest about today's ceiling:** every evaluation buildable through the
authoring UI is 100% open-ended (the mock generator only emits `ai_rubric`
types — see the Phase 4 backend section above), and open-ended grading
(Tier 3) doesn't exist yet. Submitting one of those today correctly reports
"لا توجد علامة بعد" rather than a fabricated zero or a fake level — proven in
testing against a mixed evaluation seeded with a `multiple_choice` and a
`true_false` question directly in the database (there is still no manual
question-authoring UI): those two graded and drove the level and competency
breakdown exactly as expected; the six open-ended questions alongside them
stayed excluded and the result stayed marked provisional.

**Verified in a real browser against the running API + local Postgres:**
reopened a student with an existing graded attempt and confirmed every prior
answer round-tripped correctly (multiple-choice selection, true/false
toggle, saved open-text) rather than resetting; changed an answer, confirmed
the `PUT` fired and the result recomputed (level and percent both changed on
resubmit, matching the new marks exactly); copied a result and read the
formatted text back off the clipboard; triggered the Share fallback and
confirmed it copies and toasts instead of crashing.

## Results dashboard, merged 2026-08-13

PR #43, on `main`. Per-evaluation class overview: `أدخل إجابات الطلاب` sits beside a new
`لوحة النتائج` button on the evaluation detail screen, opening every
student's attempt at a glance — level distribution (four colour-coded bars),
the class average, a "N of M graded" count, and a per-student list (name,
status pill, level + percent once graded) that taps straight into that
student's answer-entry screen. No new backend: it reuses
`GET /evaluations/:id/attempts` from the Phase 4 backend PR, which already
returns each attempt joined with its result. The class average and level
counts are computed client-side over graded attempts only — a student who
hasn't started yet has no percent to fold in, and averaging them in as zero
would understate the class rather than honestly report that fewer students
have been assessed than are on the roster.

Verified in a real browser with two students in different levels (one
scoring 33%/beginner, one 100%/capped-to-proficient by the critical-thinking
demotion rule) against the running API and local Postgres: the distribution
bars, the average, and both rows matched the API responses exactly.

## Fixed 2026-08-13 — changing the lesson mid-chat didn't take

Reported: picking a new topic via **تغيير الدرس** didn't update the
current-lesson bar or Start Class. Reproduced in a real browser: pick a new
lesson, confirm, and the header still showed the old one — worse, the
assistant's reply also talked about the old lesson, so it wasn't just a
display bug.

**Root cause — a stale closure, not a data problem.** Confirming a new
lesson calls two things back-to-back: `onContextChange(topic)` (queues a
`setSessionMemory` pinning the new lesson — a state update, applied on the
*next* render) and then, synchronously in the same handler,
`onAsk(topic)` → `sendMessage(text, sessionMemory.activeLessonId)`. That
`sessionMemory` is the one closed over by *this* render, i.e. still the
previous lesson, because the pin from `onContextChange` hasn't committed
yet. `sendMessage`'s own KB-search pipeline treats a passed lesson id as an
authoritative pin, so the old lesson id rode along as `pinnedLessonId` and
the pipeline answered about it — then re-confirmed it as the active lesson,
stomping the update that was already queued. Two state writes, correct
order in the code, wrong order in what actually lands, because one of them
was reading data from before the other had run.

**Fix:** `onAsk` no longer reads `sessionMemory.activeLessonId` from its
own render closure. It re-resolves the lesson from the topic string with
the same `searchKBSemantic` call `onContextChange` already made, so both
land on the same freshly-picked lesson instead of racing. Verified in a
real browser: picked "الاشتقاق" under "المشتقات," confirmed, and both the
header ("المشتقات • الاشتقاق") and the assistant's reply ("...لدرس
«الاشتقاق»؟") updated together.

## Security & cleanliness audit — 2026-08-15

Asked for a whole-app pass, not a diff review: three parallel audits (backend
security, mobile security, code cleanliness) across every route and service,
not just what changed on this branch.

**Fixed — HIGH, unauthenticated OpenAI proxy.** `routes/generate.ts` registered
`POST /classroom-activity` without the `/generate` prefix that
`routes/index.ts` scopes `authMiddleware` to — the same mount-order bug class
as the roster/evaluations incident, third time now. It sat outside every
guard: reachable at `/api/classroom-activity` with no token, an unlimited free
proxy onto the OpenAI account. It was also unreachable *correctly* — the
mobile client (`RemoteAIService.ts`) already called the intended
`/generate/classroom-activity`, so the feature was 404ing for real users while
the bare path stayed open for anyone else. Moved it under `/generate`, which
fixes both at once. `mountOrder.test.ts` — the suite this exact bug class put
in place — now asserts the guarded path 401s and the old bare path 404s.

**Fixed — HIGH, stored-XSS-to-token-theft chain.** `buildLessonFlowHTML` in
`services/share.ts` was the one HTML-builder in the file that didn't run its
fields through `esc()` — every other builder (lesson plan, worksheet, quiz,
slides) already does. Lesson Flow content comes from a live model call, so a
prompt-injected topic/step/question could land unescaped in the exported
HTML. On web, `exportAsPDF` writes that HTML into an iframe via
`document.write` — and access tokens live in `localStorage` on web
(`secureStorage.ts`), so an injected `<script>` would have had a path to
them. Escaped all interpolated fields to match the established pattern, and
added `sandbox="allow-same-origin"` to the export iframe as a second layer —
confirmed by isolated test that this blocks a `<script>` from executing while
keeping `contentDocument`/`print()` working (plain `sandbox=""` looked
stronger but silently breaks the export: it forces an opaque origin and
`contentDocument` returns `null`).

**Fixed — two real bugs, found but not yet applied by an earlier review pass:**
- `ai-tools/quiz.tsx`: deleting a question spliced `result.questions` but left
  the index-aligned `outcomes` array untouched, so every verification badge
  after the deleted question pointed at the wrong question once presented to
  class. `removeQuestion` now drops the same index from both.
- `evaluations/[id]/answers/index.tsx`: attempt statuses loaded on a plain
  `useEffect` keyed on `id`, unlike the sibling `results.tsx`. Submitting a
  student's answers and navigating back to the picker showed a stale status
  pill until the screen remounted. Switched to `useFocusEffect`, matching
  `results.tsx`.

**Cleanliness — mechanical fixes applied:** deleted two files with zero
callers (`components/KeyboardAwareScrollViewCompat.tsx`,
`services/validation.ts` + its test); removed two `console.log` debug probes
left in production code, unguarded by `__DEV__`
(`services/knowledgeBase.ts`'s `[KB-CATALOG-PROOF]` IIFE,
`TopicSelector.tsx`'s `[TopicSelector-PROOF]` effect); brought `auth.ts` and
`workspace.ts` onto the shared `logger` — they were the only two route files
still using raw `console.error`. Also fixed `RemoteAIService.ts`'s `postJSON`,
which called `fetch()` directly with no auth header — invisible today because
`DEMO_MODE` short-circuits before it runs, but every real `/generate/*` and
`/chat` call would have 401'd silently into the mock fallback the day
`DEMO_MODE` flips off, reading as "flaky network" rather than "nobody is
authenticated." Now routes through `apiFetch`, same as the rest of the app.

**Not fixed — flagged for a decision, not mechanical:**
- ~~**No rate-limiting on `/auth/login`, `/auth/register`, or
  `/auth/forgot-password`**, combined with an 8-character password minimum and
  no complexity requirement.~~ **Fixed 2026-08-15** — see below.
- Five near-identical copies of status/level color-and-label maps across the
  evaluation screens, plus `PickerField` and `CheckboxRow` each duplicated
  3–5 times across `ai-tools/*` and `evaluations/new.tsx` — real duplication,
  but which variant becomes canonical is a design call, not a paste-delete.
- ~900 lines of `HARDCODED_KB_LESSONS` entries in `knowledgeBase.ts` are dead
  at runtime (`_supersededUnitIds` filters them out; the file's own comments
  call them "kept for reference") — worth pruning or archiving, not done here
  since it's bulk curriculum content someone should confirm against first.
- `iqra.tsx` is 2,389 lines with three presentational components defined
  inline; lower priority, noted for a future extraction pass.

Verified: `pnpm run typecheck` clean across all three workspace projects;
mobile suite 293/293 passing (10 skipped, unrelated); api-server suite
75/75 passing after `pnpm build` (added the two mount-order regression
cases above); sandboxed-iframe behavior isolated-tested in a real browser
before picking `allow-same-origin` over a bare `sandbox=""`.

## Live-AI test mode with a budget cap, 2026-08-15

Wanted a way to test real OpenAI output — instead of `DEMO_MODE`'s mocks —
without risking an open-ended bill, plus an explicit on/off switch rather than
editing source. Two flags, both default to the safe (mocked) state:

- **`AI_LIVE_MODE`** (api-server, must be exactly `"true"`) gates every
  OpenAI-backed route (`chat.ts`, `generate.ts`, `derivativeVerified.ts`) —
  off by default, checked *before* the network call.
- **`EXPO_PUBLIC_DEMO_MODE`** (mobile) now reads from env instead of being
  hardcoded — `demoMode.ts`'s `DEMO_MODE` const is `true` unless the var is
  literally `"false"`. Same safe-by-default shape, client side.

A new `artifacts/api-server/src/lib/aiBudget.ts` tracks estimated USD spend
in-process (token counts from each completion × a hardcoded per-model
pricing table) and throws before the next OpenAI call once `AI_BUDGET_USD`
(default `$2`) is reached — the routes turn that into a `429` with a clear
message, which the mobile client's existing AI-error handling already
catches and falls back to mocked content for, no new client code needed.
`GET /api/healthz/ai-budget` (public, same reasoning as `/healthz/verifier`)
reports `{ liveMode, model, spentUsd, limitUsd, remainingUsd }` for checking
spend without digging through logs.

Also fixed while wiring this: the hardcoded, likely-invalid `gpt-5.6-luna`
model id across all three OpenAI call sites (the landmine this file already
flagged) — now `AI_MODEL`, default `gpt-4o-mini` for affordable testing.

**Known limits, by design:** the budget counter is process-memory only —
resets on restart, not shared across instances, not a substitute for the
hard usage limit that should also be set on the OpenAI account itself
(Settings → Billing → Usage limits). Pricing is a hardcoded estimate, not
billing-accurate. Full walkthrough: `LOCAL_SETUP.md` → "Testing against real
AI (optional)".

Verified: `pnpm run typecheck` clean; api-server suite 76/76 (added a
regression test for the new public status endpoint); mobile suite unchanged
at 293/293; manually drove `aiBudget.ts`'s guard functions end-to-end
(off-by-default throws before any call, usage accumulates correctly, cap
trips and blocks further calls) since there's no local Postgres in this
environment to exercise the full authenticated HTTP path.

## Basic error visibility, 2026-08-15

First real teachers are testing the app now — the only way to learn
something broke was a teacher saying so. Added a way to check "what errored
recently" without digging through Render's raw log stream, ahead of any
proper log aggregation.

`lib/logger.ts` hooks pino's `logMethod` (its documented interception point,
not a monkey-patch) so every existing `logger.error(...)` call across the
app — already the pattern in all ~30 route catch blocks — also lands in a
new in-memory ring buffer (`lib/errorLog.ts`, last 50, no code changes needed
at any of those call sites). `app.ts` also grew a catch-all Express error
handler as a safety net for anything a route doesn't catch itself, feeding
the same buffer. `GET /api/healthz/errors` returns the last 50, newest
first, gated by an `ADMIN_DEBUG_KEY` env var sent back as the `x-admin-key`
header; wrong key
and no key both 404, so the endpoint's existence isn't itself a signal to
anyone probing without the key. Chose a header-gated route over reusing
teacher auth because a logged-in teacher could otherwise read errors
referencing other users' data — there's no `admin` role yet to scope it to.

Also fixed one real, formerly-silent gap this surfaced: `middlewares/auth.ts`
caught *every* verification failure with a bare `catch {}` — both routine
ones (expired token, every client eventually hits this) and genuine backend
failures (the DB lookup after JWT verification throwing), with zero
distinction and zero logging for either. Expired/malformed tokens stay
silent (too routine to log); anything else — confirmed live against an
unreachable Postgres — now logs via `logger.error` and shows up at
`/healthz/errors`, which is exactly the case this feature exists for: a
failure on the single most-hit path (every authenticated request) that
previously had zero signal anywhere, not even in raw logs.

**Known limits, by design:** in-memory only, resets on restart, single
process — same tradeoff as the AI budget counter above. No stack traces or
request bodies in the buffer (deliberately — this is meant to be safe to
glance at, not a stand-in for real log aggregation once that's worth the
investment).

Verified: `pnpm run typecheck` clean; api-server suite 77/77 (added a
regression test that `/healthz/errors` 404s with no key set); mobile suite
unchanged at 293/293; drove the full path live against the built bundle —
triggered the auth-middleware DB failure against an unreachable Postgres,
confirmed it was silent before the fix and appeared in
`GET /healthz/errors` (with the correct key; 404 with no key and with a
wrong key) after it.

## Worksheet verification badges, 2026-08-15

Quiz has shown a per-question verification badge since PR #28; worksheet
(and homework, which reuses the same screen) never did — Class Mode passed
a blanket `verified: false` and the form screen showed nothing at all. Same
gap `STATUS.md`'s top-blockers list has been tracking since PR #28 landed.

`services/quizVerification.ts` gained `verifyWorksheetAnswers`, sharing the
same per-item verify/degrade-to-bank helper `verifyQuizAnswers` already
used (refactored the duplicated logic into one `verifyItems` — behavior for
quiz is unchanged, covered by the existing tests). Wired into
`app/ai-tools/worksheet.tsx` exactly like quiz: verification runs after the
worksheet is on screen (never blocks generation), the same badge component
appears once it resolves, and Class Mode now passes per-question `outcomes`
instead of the old blanket `verified: false`.

**Found and fixed a real, dormant bug while wiring this up.** A worksheet
question doesn't carry its own answer — the generator only ever fills in
the top-level `answerKey`, keyed by 1-based position across the flattened
`sections[].questions[]` list (confirmed against `routes/generate.ts`'s
actual prompt schema). `classDeck.ts`'s `buildDeckFromWorksheet` read
`q.answer` instead, which is never populated — so every worksheet's Class
Mode `correctIndex` silently defaulted to option 0 (`indexOfAnswer` finds
nothing, falls back to index 0) and the open-ended "expected answer" panel
was always blank. This has presumably been wrong since worksheets got a
Class Mode. Fixed to read from `answerKey` by position, matching how
`services/share.ts`'s PDF/Word export already did it correctly — the
verification work needed the same lookup anyway, so fixing this was free.
The existing `classDeck.test.ts` fixture had `answer` set directly on each
question (not matching the generator's real shape), which is exactly why
this wasn't caught earlier; rebuilt the fixture to match reality.

Verified: `pnpm run typecheck` clean; mobile suite 301/301 (up from 293 —
added tests for `verifyWorksheetAnswers` and the `buildDeckFromWorksheet`
provenance/answer-key-position fix); live end-to-end against the built app
with a real Postgres and a fresh teacher account (no shortcuts — full
signup → login → AI Tools → Worksheet → generate → Class Mode): generated a
real worksheet on "حل نظام مكوّن من معادلة خطية ومعادلة تربيعية", confirmed
the verifier was actually called (`/api/verify/derivative` hit once per
question) and the badge correctly showed the honest "nothing proved" state
for this system-of-equations content; opened Class Mode and confirmed the
revealed answer for question 2 now matches `answerKey` item 2 exactly,
where before the fix it would have shown whatever option happened to sit
at index 0.

## Auth hardening — rate limiting + password policy, 2026-08-15

Closed the gap the 2026-08-15 security audit flagged and left as a
landmine: `/auth/login`, `/auth/register`, and `/auth/forgot-password` had
no rate limiting, and password strength was just "8 characters, anything
goes" (`"12345678"` and `"password"` both passed).

No rate-limiting library was in `api-server`'s dependencies, and the app's
established pattern for this class of problem is already an in-memory,
single-process guard (`aiBudget.ts`, `errorLog.ts`) — reasonable for a
single-instance Render pilot, resets on restart. Followed the same pattern
instead of adding a dependency: `lib/rateLimit.ts` is a small fixed-window
limiter keyed by client IP, applied per-route —
`login` (10 / 15 min, roomier since real users mistype passwords),
`register` and `forgot-password` (5 / hour each). Exceeding the cap returns
`429` with a `Retry-After` header.

This depends on Express seeing the real client IP, not Render's proxy
address — `app.set("trust proxy", 1)` added to `app.ts`; without it every
request would report the same IP and all callers would share one bucket.

Password policy: `lib/passwordPolicy.ts`'s `isStrongPassword` now requires
8+ characters with at least one letter and one digit (Unicode-aware, so
Arabic passwords work) — blocks all-digit and dictionary-word passwords
without demanding a symbol, which would just push pilot teachers toward
writing passwords down. Applied to `/register` and `/reset-password` only;
existing accounts and `/login` are untouched, so nobody gets locked out by
a policy that changed after they signed up.

Verified: `pnpm run typecheck` clean; api-server suite 85/85 (new
`rateLimit.test.ts`, `passwordPolicy.test.ts`); live against a running
instance with real Postgres — confirmed a weak password is rejected on
`/register` and a strong one succeeds, confirmed repeated failed logins
past the 10-attempt cap return `429` with `Retry-After`, confirmed
`/forgot-password` blocks at 6 rapid requests.

## App icon reported washed-out on a real device, 2026-08-16

A teacher's home screen showed the Iqra icon nearly invisible (white on
white) inside a folder, while other apps kept full colour. Checked the
committed source assets: `icon.png` and `adaptive-icon.png` are both
correctly branded (navy `#081B3A` background, white+teal "اقرأ / IQRA"
mark — confirmed by pixel sampling, not assumption), and `app.json`
already sets `android.adaptiveIcon.backgroundColor` to the same navy.

Added `android.adaptiveIcon.monochromeImage` (same asset — its alpha
shape is already correct) so Android 13+ "Themed icons" renders a real
Iqra silhouette instead of auto-deriving one, which is the standard,
documented fix for icons looking wrong/pale specifically under Material
You theming. **Unverified on-device** — this needs a fresh EAS build and
reinstall to actually see, which this sandbox cannot do (no Android
SDK/device/EAS credentials here). If the teacher's install predates the
icon work merged 2026-08-13 (`STATUS.md`'s "Logo, flag, installability"
entry), a stale build is the more likely cause than a rendering bug, and
no code change fixes that short of reinstalling from a current build.

## Fixed 2026-08-16 — Slides Maker's PDF export ignored the actual deck; added real PPTX

A teacher's screenshot of the PDF export showed near-empty pages with tiny
grey text — not what the deck actually looked like. Root cause: the
"PDF" button called `buildLessonPlanSlidesHTML(plan, ...)`, which
re-derives a generic fixed 6-slide outline from the lesson plan fields
alone. It never read `deck.slides` — so the export ignored the graph
slide, the verification badges, and any per-slide edit, and (since it
keyed on `plan`, which can be null for a purely curriculum-grounded
deck) sometimes had no PDF button at all despite a full deck on screen.

**Deck-accurate PDF.** New `services/deckSlidesHtml.ts` (`buildDeckSlidesHTML`)
renders the actual `ClassroomActivity` — same dark background, same
per-type accent colour, same math layout, same verification badge the
presenter shows. A deck that looked different exported than it did on
the projector would just be a second, wrong deck. Both `slides.tsx`'s
PDF button and `save`/PDF/PPTX row now key off `deck`, not `plan`.

**New: real PPTX export.** `services/exportPptx.ts` (`pptxgenjs`) builds
an actual `.pptx` — one slide per deck slide, editable in PowerPoint —
following the same web-Blob-download / native-base64-Sharing pattern
`exportAsWord` already established for `.docx`. PPTX text runs can't
lay out a stacked fraction or a raised exponent, so `mathLineToUnicode`
(new, `mathRender.ts`) degrades to real Unicode superscripts where one
exists (covers every exponent this curriculum uses) and `(a)/(b)` /
`√(...)` otherwise.

**Found while building this:** `share.ts` imports `react-native` at
module scope, which `node:test` cannot parse — so nothing in that
1400-line file was ever actually reachable by the test suite, alias
imports included (`@/services/...` also silently never worked under
plain node). `buildDeckSlidesHTML` and its math-HTML helpers
(`mathLineToHtml`, `MATH_HTML_STYLES` in `mathRender.ts`) are pure and
now live outside that boundary, re-exported from `share.ts` for
existing callers. Caught a real bug this way: the verified-example
evidence line was rendering SymPy's raw `3*x**2` (missing
`prettifySymPy`) and, separately, double-escaping `mathLineToHtml`'s
already-escaped output — which would have printed literal `&lt;sup&gt;`
tags instead of a superscript. Both fixed before shipping; a test
pinned each.

Verified live: generated the «الاشتقاق» deck, exported PDF (screenshotted
the generated HTML directly — real title slide with brand identity,
answer card with the green SymPy shield, graph slide with plotted
commands, one-idea-per-slide pacing matching the projector) and PPTX
(downloaded and unzipped the actual file — 18 slides, correct Arabic
text, real Unicode superscripts `xⁿ`/`x³` in the XML, verification
badge honestly reading "bank" since the verifier wasn't running for
that pass). Zero console errors on either export. 423 mobile tests
(413 passing + 10 pre-existing skips, 15 new), monorepo typecheck clean.

## Slides Maker: verified examples, live graphs, NCCD enrichment, 2026-08-16

Three additions that make a Slides Maker deck something no generic AI
slides tool produces:

**Verified example slides.** After a deck builds, its worked examples run
through the same verifier quiz/worksheet use (`verifyDeckExamples` in
`quizVerification.ts`). The book states derivatives as a pair —
`f(x) = 4x² + 3x − 1` with answer `f'(x) = 8x + 3` — with the derivative
marker in the ANSWER, which the topic classifier (which only reads
questions) could never route to the prover; `toVerifiablePair` rephrases
that shape so it classifies, and latinizes the typographic ²/− the book
uses. The screen shows a summary row («تحقّق المُحقِّق الرمزي من ٢ من
أصل ٣ إجابة»), and the projector's answer reveal now carries the same
shield + SymPy-evidence line question slides have. Outcomes attach by
slide object identity, so a slide edited or deleted while verification
was in flight keeps no badge — and editing an example's content or
answer strips its badge, since the proof applied to the original pair.
`prettifySymPy` turns the evidence line's raw `3*x**2` into `3x^2`.

**Live graph slide.** When the lesson's own text carries plottable
functions (same conservative `extractGraphCommands` Start Class uses), a
GeoGebra slide lands between the rule and the examples. Unlike the
quick-check deck it is NOT always added for math — this deck's rule is
omit-rather-than-pad, so no plottables means no slide.

**NCCD lessons enriched from the hand-authored bank.** The reason none
of this fired at first: live NCCD lessons carry only what the Ministry's
planning tables state (titles, objectives, vocabulary, periods) — no
summaries, concepts, rules, or examples. That content exists, hand-
authored against the same book, in the superseded hardcoded lessons that
were dropped from the catalog for duplicating the NCCD *listing* — never
because the content was wrong (`NccdUnit.prior_knowledge`'s comment
explicitly reserves a slot for "follow-up data enrichment").
`knowledgeBase.ts` now merges them by diacritics-insensitive title match
(«مكوَّن» = «مكون», prefix tolerated for clarifying suffixes like
«الضرب القياسي (الداخلي)»): NCCD stays authoritative for identity,
objectives and periods; enrichment fills summaries, concepts, defined
terms, rules, examples, and real English titles. Result: 20 live math
lessons gain worked examples, 23 gain rules, 43 gain real EN titles —
this feeds every consumer of the KB, not just slides.

Verified live end to end with the real SymPy verifier running locally:
«الاشتقاق» deck went from 11 content-thin slides to 18 — real تمهيد,
5 concept slides, a القاعدة slide, a graph slide preloaded with
`f(x)=x^3` / `f(x)=4x^2`, and 3 worked examples. The summary badge
correctly read 2-of-3 symbolically proved (the third, `f(x)=5 → 0`, has
no variable and honestly degrades), and the projected reveal showed the
green SymPy shield with the prettified independent derivation `3x^2`.
407 mobile tests (397 passing + 10 pre-existing skips), monorepo
typecheck clean.

## Slides Maker: real math rendering + per-slide editing, 2026-08-15

Two upgrades to the deck the projector shows:

**Real math layout.** Equation lines used to project as flat strings —
`3x^4` with a caret, `(x^2+1)/(x-1)` with a slash — which reads as typing,
not mathematics, in exactly the grade where fractions, powers and roots
are the whole lesson. `services/mathRender.ts` is a deliberately
conservative parser (superscripts incl. parenthesized bases/exponents and
Arabic letters س ص ع ن, fractions both `(A)/(B)` and simple `3/4`, roots
`√(...)`/`sqrt(...)`/bare `√25`, all recursive so `√(x^2+16)` nests);
`components/classroom/MathText.tsx` renders the tree with pure
Views/Texts — stacked fraction bars, raised exponents, a radical with an
overline — no math library, no WebView, identical on native and web.
Anything the parser doesn't confidently recognize stays plain text
rendered exactly as before: the failure mode is "looks like today",
never "looks mangled" — guarded by a round-trip test asserting no input
ever loses characters. Wired into `presentation.tsx` for equation lines
and the answer reveal; 14 parser tests in `mathRender.test.ts`.

**Per-slide editing.** The generated deck is a draft the teacher owns,
not a fixed output. Every outline row in Slides Maker now opens an editor
(title, content, and — on example slides — the answer), and each row has
a delete with confirm (via `services/confirm.ts`, so it works on web).
Edits and deletions land in the same deck state that Present / Save / PDF
read, and `rebuildAnswerKey` in `lessonSlides.ts` recomputes the printable
answer key from the slides themselves so an edited answer prints as
edited and a deleted example drops out of the key instead of drifting.

Verified live end to end: generated a deck for «تبسيط المقادير الأسية»,
edited a slide to carry `(x^2+1)/(x-1)`, `3x^4 - 2x + 7` and
`√(x^2 + 16)`, deleted the homework slide (9 → 8, outline renumbered),
presented — the projector showed a real stacked fraction (numerator's
superscript intact), raised exponents, and a radical overline, with the
Arabic lead-in «بسّط:» correctly on the right. No console errors.

## Fixed 2026-08-15 — PDF export silently did nothing, everywhere

Reported against the hosted demo: Slides Maker's PDF button produced no
file, no dialog, no error — nothing observably happened.

**Root cause:** `exportAsPDF`'s web path (`services/share.ts`) writes the
export HTML into a hidden, sandboxed iframe and calls
`iframe.contentWindow.print()`. The sandbox was `allow-same-origin` only.
Chromium requires `allow-modals` in the sandbox token list for a
sandboxed frame to open `print()`/`alert()`/`confirm()` — without it the
call is silently ignored: no exception (so the `catch` never fires and no
error toast shows), just a console warning
(`Ignored call to 'print()'. The document is sandboxed, and the
'allow-modals' keyword is not set.`) nobody was looking at. Reproduced
directly against Chromium before touching the fix, to confirm this was
the actual mechanism and not a guess.

**This one function is shared by every PDF export button in the app** —
slides, worksheet, quiz, lesson plan, lesson flow, activity, and the
workspace saved-item view all call `exportAsPDF`. All were silently
broken on web, not just Slides Maker; the fix (adding `allow-modals` to
the sandbox attribute) repairs all of them at once. Verified live: built
a real curriculum-grounded deck end to end (login → Tools → Slides Maker
→ pick a Math S1 lesson → generate → PDF), confirmed the sandbox console
warning is gone after the fix where it reliably appeared before it.

## First-run onboarding + Slides Maker promoted, 2026-08-15

A teacher used to land straight on login with nothing explaining what
Iqraa does. Added a 4-slide product-intro carousel
(`app/onboarding.tsx`) shown once per install before the first login:
what Iqraa is, the full lesson-journey flow, real math verification, and
the class-time tools. Deliberately not swipe-driven — this app expresses
RTL per-component rather than via OS layout direction (see the web-RTL
writeup below), so a horizontal ScrollView's physical scroll axis
wouldn't reliably follow the reading direction. Paging is Next/Skip/dot
driven instead, which behaves identically in both languages.

- `services/appIntro.ts` tracks the "seen" flag globally (AsyncStorage,
  not user-scoped — the carousel runs before anyone is signed in, unlike
  `lessonContext.ts`'s per-user "onboarded" flag, which gates the
  first-lesson picker and is a different concept).
- `app/_layout.tsx`'s root redirect now checks it only on cold boot while
  signed out — an explicit logout goes straight back to login, not the
  intro again.
- Verified live: fresh install shows the carousel, `تخطي`/`ابدأ الآن`
  both land on login, the flag survives a reload so it doesn't repeat.

**Slides Maker promoted to the top tool** on both the tools tab and the
chat "+" menu — moved from `DURING_CLASS` to the front of `BEFORE_CLASS`
in `toolCatalog.ts`, the single list both surfaces render from in
`WORKFLOW` order. Verified live in both places.

## Class-time tools: Slides Maker + Class Challenge, 2026-08-15

Two tools, both projecting through the existing `presentation.tsx` player
rather than a second one.

- **Slides Maker** (`🖥️ شرائح الدرس`, `app/ai-tools/slides.tsx` →
  `services/lessonSlides.ts`). Builds a *teaching* deck — outcomes, vocabulary,
  concepts, worked examples, closure — as against `classDeck.ts`, which
  projects questions. The curriculum book wins over the generated plan for
  every field it carries; the plan fills only hook/practice/closure, so a
  grounded topic still yields a deck when generation fails. `teacherPreparation`
  states which of the two the deck came from. Adds `MaterialType 'slides'`:
  saved decks are viewable and re-projectable from the workspace. PDF reuses
  `buildLessonPlanSlidesHTML`, so it needs a plan.
- **Class Challenge** (`🏆 تحدي الصف`, `app/ai-tools/game.tsx` →
  `services/classGame.ts` + `buildGameDeckFromQuiz`). Kahoot-style team game
  for a room where **students have no phones**: projector is the board,
  students answer on the printed أ ب ج د cards `classDeck.ts` already
  prescribes, teacher taps which teams were right. Scores are *derived* by
  re-folding an award ledger, never accumulated — that is what makes a mis-tap
  exactly reversible including its streak bonus, which an incremental score
  cannot undo. Only MCQ items are scoreable, so `game.questionCount` counts
  survivors, not the quiz's questions.
  - **Per-student scoring is the intended next step.** The ledger is keyed by
    responder id so printed-card camera capture (Plickers-style, against
    `roster.ts` ids) can replace team ids with no change to the engine.
    `expo-camera` is not a dependency yet.

### Web RTL was broken in production only — fixed

Arabic screens rendered half-mirrored on the deployed site (tool-card icon and
title on the left, description on the right) while looking correct in dev.

Cause: the app expresses direction *per component* — ~190 sites write
`flexDirection: isRTL ? 'row-reverse' : 'row'` — which assumes a
direction-neutral document. `expo export` and the dev server both emit a shell
with no `dir`, but the deployed HTML served `<html lang="ar" dir="rtl">`, which
this repo cannot produce. In an RTL document `flexDirection: 'row'` is already
reversed, so `'row-reverse'` cancels back to visual LTR, while
`textAlign: 'right'` (a physical value) stays put.

Measured on the deployed page, children of one such row:
`dir="rtl"` → x = `[913, 998]` (ascending → visually LTR, the bug);
no `dir` → x = `[288, 211]` (descending → visually RTL, correct).

`LanguageContext.applyRTL` now asserts `dir="ltr"` on web at boot and on every
language change, so the host cannot reintroduce it. `app/+html.tsx` does *not*
work here — `web.output` is unset, which means `single`, and Expo ignores the
custom shell in that mode.

If the per-component flips are ever replaced by real document-level RTL, `dir`
must start following the language in the same commit that deletes them.

## Tools flattened + parent messages, 2026-08-15

- **«أدوات إضافية» is gone — twice.** The name covered two different things: a
  collapsed `MORE_TOOLS` section, *and* a card that pushed `/home`, the retired
  home screen. Both are removed; everything now sits in قبل/أثناء/بعد الحصة.
  - مسار الدرس → قبل الحصة. الفصل التفاعلي → أثناء الحصة. التقييمات and
    رسالة لولي الأمر → بعد الحصة.
  - `/home` is still the only route to lesson media and Smart Templates, so it
    is now a named tool (**وسائط الدرس والقوالب**) rather than an unlabelled
    card. Deleting the card outright would have orphaned both.
  - `MORE_TOOLS` fed **two** surfaces — the tools tab and the chat `+` sheet in
    `iqra.tsx`. Removing it required editing both; the catalog exists precisely
    because those two drift.
  - **الفصل التفاعلي now overlaps Slides Maker and Class Challenge** — all three
    end in the same presentation player. Kept for its activity formats (bingo,
    relay, gallery walk) and flagged in `toolCatalog.ts` as the candidate if the
    three entry points are ever collapsed.

- **رسالة لولي الأمر is real** (`app/ai-tools/parent-message.tsx` →
  `services/parentMessage.ts`), replacing the coming-soon stub.
  - **It does not generate.** The message is about a named child and goes to a
    parent under the teacher's name, usually via WhatsApp. A model that invents
    "لم يسلّم ثلاثة واجبات" when it was one produces something the teacher signs
    and cannot retract, and nothing downstream would catch it. So the teacher
    supplies every fact and the composer supplies the register — greeting,
    honorific, closing. A test asserts the output contains **no digit** the
    teacher did not type.
  - Consequence worth keeping: it works with `DEMO_MODE` on, offline, with no
    API key. That is why it shipped working instead of as another stub.
  - Student *and* teacher gender are inputs because Arabic inflects for both
    (ابنكم/ابنتكم، أظهر/أظهرت، معلّم/معلّمة). A slashed either/or form is what
    makes a message read as a circular; tests guard against one reappearing.

- **Logout asked twice.** `profile.tsx` never adopted `services/confirm.ts` —
  the helper written to replace exactly its inline `Platform` workaround, and
  whose header names that file. It also passed both `signOut` ("تسجيل الخروج")
  and `signOutConfirm` ("هل تريد تسجيل الخروج؟"), which say the same thing, so
  the browser stacked them above its own origin line: three lines for one
  question. Now one line, with the action on the confirm button.
  - The helper itself was left alone deliberately: `quiz.tsx` passes the
    question text as `message` and needs its `title` to say what is happening to
    it, so suppressing titles globally would have broken that caller.

## Open decisions (2026-08-10)

- ~~**Home vs chat.**~~ **Decided 2026-08-10: chat is the landing tab, home is
  retired from the tab bar.** `(tabs)/index.tsx` is now a `<Redirect href="/iqra">`
  — `/` stays the entry point so deep links and the post-login
  `router.replace('/(tabs)')` keep working. Start Class moved onto
  `CurrentLessonCard` in chat, and its deck-building orchestration came out of
  the screen into `services/startClass.ts` + a tested `assembleDeckSlides` in
  `services/classDeck.ts`.
  - **Two things did not move and are not yet rehomed:** attaching media to a
    lesson (`addLessonMedia` — the *only* entry point, and that media feeds
    Start Class decks via `buildMediaSlide`) and Smart Templates. The old screen
    therefore still exists at `/home`, off the tab bar. As of 2026-08-12 it is
    reached from the **AI Tools tab** → «أدوات إضافية», not from Profile.
    Retiring it fully still means rehoming those two first.
  - The first-run coach card only renders on that screen. Profile no longer
    re-opens it: «كيف أستخدم اقرأ؟» now goes to `app/faq.tsx` instead.
  - The two parked chat-redesign branches are resolved. `claude/ikra-chat-ux-i087se`
    was rebuilt on current `main` and merged across PRs #32, #34, #35 and #36;
    PR #33, which re-applied the pre-rebase version, was closed as superseded
    (it would have reverted this pass's `CurrentLessonCard` work and committed a
    stray `.pyc`). `claude/ikra-chat-agent-uiux-1j6wpm` (`7dcb99f`) is still
    parked and unmerged — SHA recorded here so it survives if the branch is
    deleted.

<details><summary>Original framing of the decision (superseded)</summary>

- **Home vs chat.** They duplicate each other: both carry the current lesson,
  the tool chips, and a text box. Home's box is a keyword router dressed as an
  assistant — `inferToolFromPrompt` matches on واجب/ورقة/اختبار/نشاط/خطة and
  silently defaults to lesson-plan for anything else, and `extractLessonTopic`
  strips a verb and passes the rest as a topic string. Proposal on the table:
  make chat the landing tab and fold home's useful parts (current lesson, what
  is ready, «تابع العمل») into its opening state; retire the home tab. Nizar's
  own Stitch mockup kept them separate, so the reason for the split is worth
  settling before acting.
  - Two branches are parked on this decision, one commit each, both unmerged
    and both redesigning the same surface: `claude/ikra-chat-ux-i087se` and
    `claude/ikra-chat-agent-uiux-1j6wpm`. Deciding the tab question decides
    whether to land, rebase, or delete them. They are the only unmerged work
    in the repo.

</details>
- **Which model backs AI grading** (blocks the evaluation module's AI-grading
  phase only — see docs/student-evaluation-module-plan.md §8).
- **Math S1 Unit 2 edition mismatch**: the teacher guide lists a fifth lesson
  (الدوائر المتماسة) the student book on file does not have. Recorded in the
  curriculum JSON's `known_gaps`, not merged in.

## Top blockers (in priority order)

1. ~~**No external validation.**~~ **In progress 2026-08-15: shared with real
   Jordanian teachers, awaiting feedback.** Given the app is now genuinely
   in front of them, priority shifted to landing fixes on `main` promptly
   (they're testing whatever's deployed) and to basic operational visibility
   (see the AI test-budget and error-visibility entries above) rather than
   further build-ahead-of-feedback work.
2. ~~**Verification is live but barely visible.**~~ **Fixed 2026-08-15: quiz
   and worksheet both badge per-question now.** The projector screen has had
   a good badge all along — green shield for `symbolic`, muted library icon
   for the reviewed bank, plus the independently computed answer — but only
   quick-check decks showed it; quiz and worksheet passed `verified: false`
   for the whole deck. `claude/verification-badge` (PR #28) fixed quiz with
   per-question outcomes; worksheet gets the same treatment now (see below) —
   `verifyWorksheetAnswers` in `services/quizVerification.ts`, wired into
   both the on-screen badge and Class Mode's per-question outcomes.
   - Earlier versions of this file said "the app doesn't surface verification".
     That was wrong too — it surfaced it in exactly one place, which is why
     nobody noticed the other places were silent.
4. **OpenAPI drift.** Generated clients reference routes the API doesn't
   implement; real `/auth/*`, `/workspace/*` routes missing from the spec.
   *(Carried from 2026-08-06, not re-verified. The `/auth/*` and `/workspace/*`
   routes do exist in `artifacts/api-server/src/routes/`; the spec side was not
   re-checked.)*
5. **i18n debt.** ~2,000 hardcoded strings vs ~500 i18n keys. *(Carried from
   2026-08-06, counts not re-verified.)*

## Known landmines

- `gpt-5.6-luna` model id is hardcoded in three api-server files
  (`derivativeVerified.ts`, `routes/generate.ts`, `routes/chat.ts`) — likely
  invalid; irrelevant while DEMO_MODE is on, blocking the day it's turned off.
- `DEMO_MODE` mocks AI but **not** auth: any demo needs a live API + Postgres.
- `chat.ts` and `generate.ts` construct the OpenAI client at module scope, so
  the API will not boot without `OPENAI_API_KEY` set to *something*, even
  though DEMO_MODE means no model is called. Render passes a placeholder for
  exactly this reason. `derivativeVerified.ts` was changed to import it lazily;
  the other two were left alone.
- **Deployed schema is not deployed.** No build step touches the database;
  tables come from `pnpm --filter @workspace/db run push`, run by hand against
  `DATABASE_URL`. A release that adds a table and skips that push produces
  endpoints that answer 503 on a database missing it — see the roster incident
  under "Chat + evaluation pass".
- **`pnpm test` in api-server does not build.** Its mount-order suite boots
  `dist/index.mjs`, so a stale bundle reports on code nobody is looking at. CI
  now builds first; do the same locally.
- Curriculum PDFs tracked in git (8 files, one on LFS; `.git` is ~67MB) —
  slow clones.
- Legacy duplicate `lib/integrations/openai_ai_integrations` mirrors the active
  `lib/integrations-openai-ai-server`.
- `app/ai-tools/classroom/classroomRouting.ts` is a helper inside the routes
  dir — Expo Router registers it as a phantom route and warns on every boot.
- ~~No rate-limiting on `/auth/login`, `/auth/register`,
  `/auth/forgot-password`, and only an 8-character password minimum with no
  complexity rule.~~ **Fixed 2026-08-15** — see "Auth hardening" above. In
  memory only (per-process, resets on restart); revisit if Render ever moves
  to multiple instances.

## Fixed 2026-08-10 — worth knowing about

Both were silent: the system reported success while doing nothing.

- **Verification was claimed, not performed.** `generateTemplateItem` treated an
  unreachable verifier as grounds to return `verified: true`, trusting the
  power rule it had just computed in code. So from 2026-08-07 the hosted API
  served a stream of items flagged verified that nothing had checked, and an
  unreachable verifier was indistinguishable from a passing one. `verified` now
  means *the verifier confirmed this*, and a new `verificationSource`
  (`'sympy' | 'code_template'`) carries how the key was established. Items are
  still served when the verifier is down — the key is computed, not guessed —
  they just no longer claim to be verified. The batch route's `pass` now
  requires that everything was actually checked. Guarded by tests in
  `src/lib/__tests__/derivativeVerified.test.ts`.
  - The AI path was already correct: it fails closed and returns nothing rather
    than an unverified item. Only the template path failed open.
- **Root-mounted auth swallowed later routers.** `roster.ts` and
  `evaluations.ts` are mounted at the root of `/api` and both called a bare
  `router.use(authMiddleware)`, which in Express matches every path — so every
  request reaching them was answered 401 before `chat`, `generate` and
  `verifiedMath` were consulted. Those three were guarded by accident of mount
  order, never by intent, and any reordering would have silently made two
  OpenAI-backed routes public. All guards are now path-scoped. The tell was
  that an unowned path like `/api/no-such-route` returned 401 instead of 404;
  `src/routes/__tests__/mountOrder.test.ts` asserts exactly that, and caught
  the fix reintroducing the bug in a different form.
- New `GET /api/healthz/verifier` — public, cheap, reports whether the verifier
  is reachable. Deliberately not folded into `/api/healthz`, which is Render's
  health check path: a sleeping verifier must not be able to take the API down
  with it.

## Working agreement

- One checkout: `Code\Iqraa` (the old `Downloads\Iqraa\Iqraa` copy is retired —
  everything unique from it was merged via PR #1).
- All changes via feature branches + PRs; `main` is merge-only.
- Verify claims against the running system before acting on any doc, including
  this one. Two of today's findings were things this file asserted or implied
  and the running system contradicted.
- `CLAUDE.md` at the repo root points agent sessions here and carries the
  commands plus the traps that have bitten before. It is deliberately short —
  **state belongs in this file, not there.** `.agents/memory/` holds four deeper
  context files (`MEMORY.md`, `iqra-architecture.md`, `ai-integration.md`,
  `auth-workspace-api.md`).
- `docs/demo-checklist.md` is the pre-demo runbook: warm the API *and* the
  verifier, confirm the verifier is real via `GET /api/healthz/verifier`, and
  prove it is checking with a wrong-answer control.
