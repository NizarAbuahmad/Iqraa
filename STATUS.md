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
- Mobile test suite: 311 tests, 0 failures (10 skipped). The `test` script
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

## Results dashboard, 2026-08-13

Per-evaluation class overview: `أدخل إجابات الطلاب` sits beside a new
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

1. **No external validation.** Zero real teachers have used the product.
   Getting 3–5 Jordanian teachers on it beats any further polish. Now the top
   blocker outright: the verification story works, and nothing else on this list
   is worth more than putting it in front of a teacher.
2. **Verification is live but barely visible.** The projector screen has had a
   good badge all along — green shield for `symbolic`, muted library icon for
   the reviewed bank, plus the independently computed answer — but *only* for
   quick-check decks. The quiz and worksheet tools passed `verified: false` for
   the whole deck and showed nothing. `claude/verification-badge` (PR #28) fixes
   the quiz side with per-question outcomes; **worksheet is still untouched**.
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
