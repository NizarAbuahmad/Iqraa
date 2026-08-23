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
  - **Without a complete `pnpm install`, `typecheck` reports 79 errors** and
    every one is a missing dependency, not a type error: 44 in `lib/db`
    (`drizzle-orm`, `pg`, `@types/node`), 19 in
    `lib/integrations-openai-ai-server`, 14 in generated API clients, 2 at
    tsconfig level. Same shape as the 10 aborting mobile suites noted below —
    an uninstalled workspace, not a regression. Worth stating precisely
    because the count was repeatedly described as "all in
    `lib/integrations-openai-ai-server`", which is wrong by a factor of three
    and would send someone looking in the wrong package.
- Mobile test suite: 723 tests, 0 failures, 10 skipped (re-counted 2026-08-22
  on an installed workspace; the 480 here was stale, and the 376 before it).
  The 10 skips are the chemistry KB-search cases, skipped by their own suite,
  not by the runner.
  The `test` script globs `services/__tests__/**/*.test.ts` — it used to be a
  hand-listed set of files that had drifted, so two suites never ran.
  - In a container where `@workspace/curriculum` has not been installed/built,
    10 suites abort with `Cannot find module '@workspace/curriculum'` before
    running a single assertion. That is the workspace dep missing, not a
    regression — but it means "10 failures" is the *expected* reading of a
    fresh checkout, and a real regression hides in that noise. Check the
    failing names against that list before assuming your branch broke them.
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

## Off-topic questions are declined, not answered, 2026-08-22

"ما أخبار الحرب في إيران؟" used to reach the teaching pipeline. `isTeaching()`
in `services/ai/intentRouter.ts` counts **any** message containing "؟" as a
teaching ask, so a general-knowledge question was retrieved against the
curriculum KB and answered from whichever lesson ranked highest — the assistant
looked like it was answering the news, in curriculum voice.

There is now an `off_topic` intent, checked after greeting/small talk and
**before** the teaching heuristics, since those are what claim the question.
It answers with what Iqraa is (a teaching assistant for the Jordanian Grade 10
curriculum), that the question is outside that, and the same five capabilities
the greeting offers — both read one `capabilityLines()` helper so they cannot
drift apart.

The detector is two lists, and the asymmetry is deliberate:

- `OFF_TOPIC_PATTERNS` — news, politics, war, sport, markets, weather,
  entertainment, travel, personal health. These must be **precise**: a false
  positive refuses a teacher's real question. Two curriculum collisions were
  found while writing them and are covered by tests — `الدوري` is also
  **الجدول الدوري** (the periodic table) and `الرئيس` is a prefix of
  **الفكرة الرئيسية**.
- `TEACHING_SIGNAL` — curriculum and classroom words. Any hit vetoes the
  off-topic verdict, because "أنشئ ورقة عمل إحصاء عن أسعار الدولار" is a
  worksheet, not a markets question. Over-matching here is the safe direction:
  it only restores the previous behaviour.

**What this does not do:** it is keyword matching, so an off-topic question
that uses none of the listed words still reaches the teaching pipeline. The
router is the demo-mode path; the live path is covered by prompt instead —
`api-server/src/lib/chatPrompts.ts` now carries an explicit scope-guard rule in
both the Arabic and English system prompts, telling the model to decline
non-teaching questions and offer what it can do rather than converting them
into teaching material. `scripts/provider-eval.ts` imports the same functions
the route does, so the eval measures the shipped guard.

15 tests in `services/__tests__/intentRouter.test.ts`, both languages, both
directions (declined, and not-declined).

## Preparing a lesson no longer leaves the lesson, 2026-08-22

Curriculum → book → unit → lesson → **حضّر خطة درس** used to `router.push` the
AI Tools lesson-plan screen. That screen is a blank generator form, so the
teacher arrived at pickers asking for the grade, the subject and the topic they
had just walked through four screens to choose, with the lesson's objectives,
its period length and the lesson page itself left behind.

It also lost information on the way. The button passed `lesson.title` — the
**English** title — while the UI and the KB search were Arabic, so
`resolveGeneratorGrounding` could not match it: `titleAr` is what
`resolveGroundedKbLesson` compares against in `ar`. A chemistry lesson that is
in the NCCD book came back badged "general content, not tied to a curriculum
lesson". Checked against the catalog before the fix: `lesson-chem-1`,
`lesson-chem-2` and `lesson-chem-s2-5` all ground on their Arabic title and all
fail on their English one. Math S1/S2 was unaffected only because its NCCD
titles are Arabic in both fields.

**Now:** the button opens `components/ui/LessonPrepPanel.tsx` in place on the
lesson page and generates immediately. Grade, subject, topic, objectives and
duration come from the lesson itself via `services/lessonPrep.ts` (pure, tested
in `services/__tests__/lessonPrep.test.ts`). Duration, teaching style and
adaptations are still there, behind "خيارات التحضير", and the full tool is one
link away for a topic that is *not* this lesson — pre-filled with the lesson's
grade and subject instead of index 0. The plan renders through `LessonPlanView`,
the same component the tool screen and chat use, so the three cannot drift.

Verified on the running web build (Expo :8081, DEMO_MODE): tapping حضّر on
`lesson-chem-1` renders the plan under the lesson with «مرتبط بالمنهاج الأردني —
نظرية بور لذرة الهيدروجين», and save posts `subject: "Mathematics"`/
`topic: "تركيب الاقترانات"` to `/workspace/items` from the math resume path.

Two things deliberately not changed:
- **English UI still labels these ungrounded.** The KB is Arabic-native, so an
  English topic string matches nothing — the same behaviour as everywhere else
  in the app. It is disclosed, not hidden.
- **`TopicSelector` still shows its placeholder** when the full tool is opened
  with a topic prop. Pre-existing and already noted in that file; the topic is
  carried and generation uses it, only the dropdown looks empty.

`app/home.tsx`'s "continue teaching" link keeps `openLessonPlan=1`, which now
opens the panel in place instead of pushing the form on a 350ms timer. Its
`topicOverride` param is gone: it could ask a lesson page to prepare a topic
other than the lesson it was showing.

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

## Render: the verifier build failed on a PyPI 502, 2026-08-18

`iqraa-verifier` failed to build on the merge of PR #55 — "Exited with status
1". The build log names the cause exactly:

```
ERROR: Could not install packages due to an OSError:
HTTPSConnectionPool(host='files.pythonhosted.org', port=443):
Max retries exceeded with url: .../uvicorn-0.52.3-py3-none-any.whl.metadata
(Caused by ResponseError('too many 502 error responses'))
```

**PyPI's CDN returned 502s.** Not the code, not the Python version, not the
dependency ranges. sympy and fastapi had already resolved; uvicorn's metadata
fetch is where it died. A redeploy is the fix, and the deploy that followed
succeeded.

The build command now passes `--retries 10 --timeout 30`, so the next blip of
this shape gets ridden out instead of failing a deploy.

### The wrong diagnosis, recorded on purpose

Before the log was read, the reasoning was: #55 changed `verify_core.py`, but
`pip install -r requirements.txt` never reads that file, CI ran the identical
install and suite on the exact merge commit and passed 29/29, and every module
imports cleanly — so the diff could not be the cause. **That part held up.**

The proposed cause did not. The theory was that the verifier pinned no Python
version, so Render might have picked one without wheels for `uvicorn[standard]`'s
C and Rust dependencies, forcing a source build the free-tier builder cannot do.
Plausible, and wrong — it never got as far as building anything.

Worth keeping as a reminder: "CI passes on the same commit, so it is
environmental" was sound, and everything after it was invention. The log was
one click away the whole time and settled it in a line.

### Two hardening changes kept anyway

- **`PYTHON_VERSION: 3.12.13`.** The log shows Render was on **3.14.3
  (default)** — a version nothing in CI has ever exercised, chosen for us and
  changeable without a commit. This service was the only one of the three
  pinning no runtime; both Node services pin `NODE_VERSION`. Pinning to what CI
  resolves against means a green `math verifier` job implies the deploy ran on
  the same interpreter. **This did not fix the 502.**
- **Upper bounds in `requirements.txt`.** All four were open `>=`, so every
  build resolved against whatever PyPI published that morning. Also not the
  cause here.

**Verified:** the capped set resolves to the same versions CI installed (sympy
1.14.0, fastapi 0.141.1, uvicorn 0.52.3, pydantic 2.13.4) in a clean venv, and
`test_equations.py` passes 29/29 against it.

## Widened what the verifier can prove, 2026-08-20

With the scoring fixed, the eval's objective half became trustworthy but not
informative: **4 provable questions out of 40.** 18 were صح/خطأ and the other
18 were families the verifier cannot judge. A pass rate over four items is not
a result, so the fix is coverage, not another run.

Three new topics, each a question shape the NCCD Grade 10 curriculum uses
constantly and each previously reported as a key SymPy rejected — which reads
identically to the model getting the maths wrong:

| Topic | Question | Payload | Compared as |
| --- | --- | --- | --- |
| `derivative_at_point` | «ما قيمة مشتقة f(x) = x⁴ عند x = 2؟» | `x^4@2` | expression |
| `circle_center` | «ما مركز الدائرة (x-4)² + (y+1)² = 9؟» | the equation | ordered pair |
| `circle_radius` | «ما نصف قطر الدائرة …؟» | the equation | expression |

`@` is the point separator because no expression can contain it. Circle
payloads accept standard *or* general form (`x²+y²-6x+4y-12=0` → centre
(3,-2), radius 5); an ellipse, a degenerate point, and an imaginary circle are
each refused rather than answered.

**Two silent extraction bugs surfaced while testing this, both older than
today's work:**

- **`x⁴` lost its exponent.** `normaliseMath` rewrote only `²` and `³`. Every
  other superscript is outside the math-safe character class, so
  `latinExpressionFrom('أوجد مشتقة f(x) = x⁴')` returned **`x`** — the verifier
  was asked to differentiate the wrong function. Fail-closed against the real
  key, so no false badge, but silently, and x⁴ is ordinary Grade-10 material.
  Both sides now handle ⁰–⁹, TS and Python.
- **«f′(2) = 32» could not parse.** The `f'(x) = …` answer rewrite required a
  literal `x`, so a key naming the point — the ordinary phrasing for this
  question — reached SymPy whole and failed. Both argument forms now reduce to
  the value.

**Fail-closed choices worth knowing.** A question asking for centre *and*
radius has a compound answer no single comparison can judge, so it stays
unclaimed. «قطر» is the diameter and deliberately does not match the radius
marker. A circle question with no readable equation («ما مركز الدائرة في الشكل
المجاور؟») claims nothing. An ellipse passes the TS gate and is then refused by
the verifier's own coefficient test — that costs a badge, not a wrong one.

**Verified** by replaying the real rejections from run-32383174183 and
run-32391665608 through the whole chain — `stripOptionLabel` →
`toVerifiablePair` → `classifyVerifiableTopic` → the real `verify_core` — and
all four now verify with SymPy's own value. On a scorer fixture mixing the new
shapes with a deliberately wrong radius key and a trigonometry item: 5 provable
of 7, 4 verified, the wrong key caught, trig and صح/خطأ excluded. Python suite
51/51; mobile 609 tests, 0 failures.

## Phase one is grades 1–10 — curriculum validation first, 2026-08-22

Scope decided 2026-08-22: **grades 1 to 10**, all subjects. Grades 11–12
(Tawjihi) are explicitly out of phase one — they need stream splits
(علمي / أدبي / صناعي) and the stakes on a wrong answer key are far higher.

**The grade model was never the blocker.** `GRADES` already covers 1–12 and
`SUBJECTS` already maps subjects to the right grade ranges. What restricts the
product to Grade 10 is `INVESTOR_MVP_CURRICULUM = true` plus
`isPickerCurriculumVisible` — **six call sites, all in `knowledgeBase.ts`.**
Unlocking a grade is small; having content worth unlocking is not.

**Correction to an earlier note in this file: Grade 9 is العلوم, not الكيمياء.**
The catalog already has this right — `science` is grades 1–9, and
`chemistry`/`physics`/`biology` start at grade 10 — which matches the Jordanian
system. Anyone sourcing Grade 9 books wants **الرياضيات + العلوم**.

**What shipped:** `lib/curriculum/src/validateCurriculum.ts` plus
`pnpm --filter @workspace/curriculum run verify`, wired into CI.

Two severities, deliberately not conflated:

- **errors** block — duplicate unit/lesson ids (a duplicate silently shadows
  every lookup), a missing Arabic title (renders as a blank heading on an RTL
  screen rather than falling back), missing required meta, no units.
- **gaps** report and do not block — lessons with no objectives, units with no
  `data_tier`, no `prior_knowledge`, no `source_books`. A subject can ship with
  known thin spots; it cannot ship with unknown ones.

First run over the four existing files:

```
file                                grade         subject          sem  units  lessons  objectives  tiered  errors  gaps
iqra_curriculum_g10_chem_sem1.json  الصف العاشر   الكيمياء           1      3        9         6/9     0/3       0     9
iqra_curriculum_g10_finlit_sem1.json الصف العاشر  الثقافة المالية    1      2       10       10/10     0/2       0     4
iqra_curriculum_g10_math_sem1.json  الصف العاشر   الرياضيات          1      4       18       18/18     4/4       0     0
iqra_curriculum_g10_math_sem2.json  الصف العاشر   الرياضيات          2      4       18       18/18     0/4       0     5
```

**Maths semester 1 is the only file with full provenance** (4/4 units carry a
`data_tier`), and it is also the only subject whose lessons carry rules and
worked examples. That is not a coincidence — it is the one built from a دليل
المعلم. It is the template for everything that follows.

**Chemistry semester 2 has no curriculum JSON at all.** Its two lessons are
hardcoded in `knowledgeBase.ts` with no source file, which is why 55 lessons
validate here against 57 in the KB. Not thin — absent.

## Chat is in the evaluation now, 2026-08-22

The harness covered lesson-plan, worksheet and quiz. Chat — the tab teachers
land on — was never measured against any model, which mattered more once
`AI_MODEL_CHAT` made it separately configurable.

**The chat system prompts were unreachable.** They lived as private functions
inside `routes/chat.ts`, so an eval could only have run a paraphrase, and a
paraphrase measures the paraphrase. Extracted verbatim to
`src/lib/chatPrompts.ts` — asserted byte-identical to the previous text — along
with `CHAT_MAX_TOKENS` and `CHAT_HISTORY_TURNS`, so the harness issues the same
request the product does.

Four fixed **multi-turn** scenarios. The follow-up turn is the point: a single
question tests the system prompt, a second tests whether the model still has
the lesson it was given. One scenario is deliberately out of scope
(`التكامل بالتجزيء` for Grade 10) because the system prompt says *don't guess,
say so, redirect* and holding that line is a product behaviour worth measuring.

**Chat gets its own table, not extra columns on the generation one.** A prose
reply has no JSON to parse and no required fields; reporting `parsed`/
`complete` as 0 would read as total failure and as N/N would be a lie, so they
are not asked.

What replaces them: `lib/languageCompliance.ts` scores the Arabic share of the
reply's **letters**. Arabic is the product language and a drift into English is
a failure a teacher sees instantly, yet it is invisible to latency, tokens and
cost. Letters only, so `f(x) = 2x` and `NaCl` inside a good Arabic answer do
not score it as half-English. The floor is 0.7, not 1.0, for the same reason.

The total-failure guard now covers chat rows too — otherwise a run where every
generation succeeded and every chat call failed would still have exited 0.

## Decided 2026-08-22 — gpt-5.4-mini for generation, and stop shopping

Four independent readings, all on the same eval set (4 real NCCD lessons ×
3 tasks):

| Axis | Result |
| --- | --- |
| Schema conformance | 12/12 parsed, 12/12 complete |
| Symbolic correctness | 6/6 provable answer keys verified by SymPy |
| Latency | ~7s median per artifact |
| Arabic quality | Read by Nizar across all 12 outputs — all good |

Cost, now that it is priced: $0.75 / $4.50 per million. At ~1,300 tokens per
generation that is fractions of a cent per lesson plan.

**No comparison was run, and none is planned.** Only `OPENAI_API_KEY` is set
as an Actions secret, so all three runs were single-provider. "Good enough on
every axis we can measure" is not the same claim as "best available" — but the
cost of finding out is a second provider key, another spend, and another blind
rating, and nothing in the evidence suggests the current model is the
constraint. Revisit if a real complaint appears, not on principle.

**What this decision does NOT cover: chat.** The harness only exercises
lesson-plan, worksheet and quiz. `AI_MODEL_CHAT` currently inherits
`AI_MODEL`, so chat runs gpt-5.4-mini by default and has never been measured
against anything. Chat is many short turns where latency and cost dominate —
`gpt-5.4-nano` is ~3.7× cheaper on both axes and completely untested here.
That is an open question, and answering it needs chat coverage in the eval
first.

## Decided 2026-08-22 — how AI spend survives many teachers, one curriculum

Iqraa serves a fixed national curriculum, so the request distribution has a
brutal head: a few hundred teachers ask for the same lesson in the same week.
Today every one of those is its own model call — there is **no cache anywhere**
in `artifacts/api-server/src` or `lib/db` (the only `cache` matches in the tree
are comments in `aiBudget.ts` about OpenAI's cached-input pricing tier).

Plan and reasoning: [`docs/ai-cost-savings-plan.md`](./docs/ai-cost-savings-plan.md).
Three product decisions taken:

- **A pool of 3–5 variants per cache key**, not one shared artifact. Identical
  output means two classes in the same school get the same worksheet and
  students swap answers — a cost win that costs the product more.
- **Global cache only for requests with no `additionalContext`.** That field is
  free text teachers paste from their own material; serving an artifact derived
  from it to a different teacher is a content leak. Requests carrying it are
  cached per-user or not at all.
- **Discrete form inputs** (durations, question counts) instead of free-form.
  A free-form slider re-inflates the key space no matter how good the cache is.

The load-bearing idea is not the cache itself — it is generating **one superset
per (lesson × kind × language)** and applying difficulty, question count and
duration by slicing the result. That takes math S1 from ~1,800 keys to ~90,
which is small enough to pre-generate the whole semester for about $1 at
gpt-5.4-mini's measured ~1,300 tokens per generation.

**Phase 0 is built (2026-08-22)** — see the section below. What follows is why
it came first.

**The first code is not the cache.** Checking whether there was traffic to
instrument turned up something that outranks it: `AI_BUDGET_USD=5` is enforced
by a module-scope `let spentUsd = 0`, and the free-tier API sleeps after ~15
minutes idle. Every wake resets the counter, so the cap is **"$5 per wake",
not "$5 total"** — on a service built to sleep between uses. Live AI has been
on since 2026-08-20, so this is a live gap, not a hypothetical one. Phase 0 is
therefore a persistent spend total derived from per-generation rows; the
hit-rate instrumentation falls out of the same table.

**The account-level limits are set — checked in the OpenAI console 2026-08-22.**
Project `Iqraa` spend limit $50/month, organization budget $100/month, both
blocking, and the project's allowed-models list is `gpt-5.4-mini` and
`gpt-5.4-nano` only, so no expensive model is reachable even by
misconfiguration. Spend at the time of checking: $0.59 across 121 requests
since 2026-08-07, ~$0.005/request. The money is genuinely bounded; the
in-app counter is now a reporting mechanism, not the last line of defence.
One gap left: when the project limit binds, OpenAI's rejection falls through
`respondAiError` to a generic 500 "AI generation failed", so a teacher sees a
vague error rather than "the month's budget is spent." Not urgent at $0.59.

Phases 0 and 1 both add tables, so both need the manual
`pnpm --filter @workspace/db run push` — see the landmine below.

## AI spend is measured and survives a restart, 2026-08-22

Phase 0 of `docs/ai-cost-savings-plan.md`. No teacher-visible behaviour
changes; nothing is cached yet.

- **New table `ai_generations`** (`lib/db/src/schema/aiGenerations.ts`), one row
  per completed model call: kind, model, prompt version, token counts,
  estimated cost, and the two cache keys the request *would* have had.
- **The spend total is month-to-date, summed from those rows** and loaded at
  startup, replacing the module-scope `let spentUsd = 0`. The window is the
  current UTC month, matching how the OpenAI project limit resets — so the
  app's number and the console's now measure the same thing and can be
  compared. `AI_BUDGET_USD` is a cap again rather than a per-wake allowance.
- **`/healthz/ai-budget` gained `periodStart`, `persisted` and
  `persistenceFailure`.** Read `persisted` first: false means the total covers
  this process only, so the figure beside it is a floor, not a total.

### Two keys, because the plan's central claim was untested

Each row records a **coarse** key and a **strict** key. The strict key includes
every request parameter; the coarse key drops the ones the plan proposes to
serve by slicing one superset artifact (difficulty, question count, duration).

The gap between their repeat rates is the measurement. It answers "would a
cache have helped, and is the superset design worth its complexity?" **from
history, before any caching is written** — a question that was otherwise going
to be settled by argument. `hasContext` is recorded alongside, because a
request carrying teacher-pasted material can never enter a globally shared
cache and would otherwise inflate the figure.

**Chat and the derivative drill generator record no keys at all**, only their
`kind`. Both are uncacheable — a chat turn never repeats, and the drill prompt
takes no inputs and explicitly asks for a *fresh, varied* item. The first cut
gave them keys computed from an empty body, which meant every such row shared
one hash; the analysis would have read that as a perfect hit rate on exactly
the workloads that can never hit. An empty key is obviously "no key"; a
constant one silently reads as "the same request, every time". Their cost is
still recorded, which is what separates chat's share of spend from
generation's — the open `AI_MODEL_CHAT` question above.

Normalisation is where a cache's hit rate is won, and Arabic makes it
load-bearing rather than cosmetic: the same lesson title arrives with and
without diacritics, with tatweel padding, and with any of أ إ آ for one alef.
Left alone each variant is its own entry. Covered by 15 tests in
`src/lib/__tests__/generationKey.test.ts`.

### It fails soft, and says so

The schema is not deployed by anything automatic, so this can ship before the
table exists — the landmine below, which cost 14 tables in production once.
Every read and write is wrapped: a failure logs and degrades the guard to the
old per-process counting, rather than failing a generation the model was
already paid for. Verified by booting the built bundle against an unreachable
database — the server listens, generation is unaffected, and the endpoint
reports `persisted: false`.

`persistenceFailure` is the *operation* (`"read"` / `"insert"`), never the
driver's message. `/healthz/ai-budget` is public and unauthenticated on the
stated grounds that it carries no secrets, and a Drizzle error stringifies to
the whole failing query, its parameters and the connection target — the first
cut of this leaked exactly that, caught by reading the smoke-test response.

### Needs a schema push

`pnpm --filter @workspace/db run push` before this measures anything in
production. Until then it runs in its degraded mode, which is the pre-existing
behaviour, not a regression.

## Live AI is on, 2026-08-20

`AI_LIVE_MODE=true`, `AI_MODEL=gpt-5.4-mini`, `AI_BUDGET_USD=5` on iqraa-api;
`EXPO_PUBLIC_DEMO_MODE=false` on iqraa-web. Confirmed the way the badge exists
to be confirmed: `/api/healthz/ai-budget` reported `spentUsd` moving 0.1375 →
0.188 across one lesson-plan generation. That counter only advances on a real
completion with token usage, so it is proof independent of anything the screen
renders.

~~**`gpt-5.4-mini` is not in `PRICING_PER_MILLION_USD`**~~ **Priced 2026-08-22**
at the standard short-context rates ($0.75 / $4.50 per million), along with
`gpt-5.4` ($2.50 / $15) and `gpt-5.4-nano` ($0.20 / $1.25), in both the budget
guard and `scripts/provider-eval.ts`. Before this the guard billed at the
$10/$50 fallback — roughly **11× the real output rate** — so `AI_BUDGET_USD=5`
stopped somewhere near $0.45 of actual spend, and the eval reported cost as
"—" for every run, missing the axis that usually decides a model choice.

Note the endpoint is `/api/healthz/ai-budget` — everything is mounted under
`/api` (`app.use("/api", router)`).

## Fixed 2026-08-20 — the objectives box deleted the curriculum outcomes

Reported as "I added an objective and the plan didn't take it into account."
Two separate defects, both reproduced against the shipped code.

**1. Teacher objectives replaced the curriculum, silently.**
`serializeLessonContext` had `if (teacherObj) … else if (curriculumObjectives)`,
so typing anything at all into «الأهداف التعليمية (اختياري)» dropped the
official NCCD نتاجات from the prompt entirely. Verified for «المشروع وإدارته»:
without a teacher objective the context carries three official outcomes; with
one it carries only the teacher's line. The screen still displayed «مرتبط
بالمنهاج الأردني» either way — so adding one line produced a plan that was
*less* curriculum-grounded than leaving the field empty, while claiming
otherwise. Now additive: both blocks go in, each labelled by source.

**2. There was nowhere to put an instruction.** The field is labelled
«الأهداف التعليمية», and `lessonPlanPromptAr` renders it as «الأهداف المحددة»,
so "tailor this plan for student with adhd" came back as the lesson's sole
stated objective — verbatim, in English, with nothing in the body adapted. The
request was obeyed to the letter and ignored in substance. An adaptation is an
instruction about how to write every section, not something a student can
demonstrate, so it needed its own field: «تكييفات وتعليمات إضافية (اختياري)»,
routed through `buildAdaptationsDirective` into `additionalContext` and pointed
explicitly at the `differentiation` slot the output schema already has, with
"do not list these among the objectives" stated in the directive.

**Also found while reproducing, fixed below:** `buildSupportResourcesContext`
returned mathematics files for a financial-literacy lesson.

## Generation and chat can use different models, 2026-08-22

One `AI_MODEL` drove both. They are different jobs: a lesson plan is a single
long structured document where quality is worth paying for, chat is many short
turns where latency and cost dominate. Tying them together made every choice a
compromise between two workloads that share nothing but a client.

`AI_MODEL_GENERATE` and `AI_MODEL_CHAT` each fall back to `AI_MODEL`, which
still sets both — **no deployment has to change anything.** Set one to split
the workloads.

Two things had to move with it:

- **`recordUsage(usage, model)` now takes the model.** It priced by a single
  global; with two models that would bill every chat turn at the generation
  model's rate, and the budget guard would be wrong in whichever direction the
  prices differ.
- **`/api/healthz/ai-budget` reports `generationModel` and `chatModel`** in
  place of one `model`. The single field was only ever accurate while the two
  were guaranteed to match; naming them separately is what makes "which model
  answered that?" checkable from the endpoint. Nothing in the codebase read
  the old field.

## Fixed 2026-08-22 — /generate/* answered 200 with an empty artifact

`generateContent` ran `extractJSON` over the model's reply and handed the
result straight to `res.json()`. Nothing checked the object had the fields the
app reads. Two ways that goes wrong, both silent:

- a truncated response — `extractJSON` recovers a partial object, or `{}`;
- a well-formed object of the wrong shape.

Either way the route answered **200** and the screen drew a blank lesson plan.
No error in the logs, none in the UI, and the provenance badge said «ذكاء
اصطناعي مباشر» because the call had genuinely succeeded. Same family as every
other bug in this file: it failed without failing.

`src/lib/generationShape.ts` now gates all six `/generate/*` routes on the
fields the screens actually index into, and `respondAiError` maps the new
`UnusableGenerationError` to **502** (the request was fine; the upstream reply
was not) with the missing field names in the body and the log.

Failing closed costs nothing here: `RemoteAIService` already falls back to
`MockAIService` on any non-2xx, and `aiProvenance` labels the result «تعذّر
الاتصال · محتوى تجريبي». Sample content that says it is sample content beats
real-looking content that is empty.

The bar is deliberately the app's own contract, matching `REQUIRED_FIELDS` in
`scripts/provider-eval.ts` — which measured **12/12 conformance** for
`gpt-5.4-mini`, so a working generation clears it comfortably. Cosmetic echoes
of the request (a quiz's `duration`, a lesson plan's `grade`) are *not*
required: discarding an otherwise complete artifact over those would turn
usable output into mock content.

**Watch this:** if the gate fires spuriously in production, teachers get mock
content where they previously got a nearly-complete artifact. It logs the kind
and the exact missing fields, so check `/api/healthz/errors` (needs
`ADMIN_DEBUG_KEY`) before assuming a model problem.

## Fixed 2026-08-21 — support packs attached from the wrong subject

«المشروع وإدارته» (financial literacy) came back with three **mathematics**
files — «إجابات الوحدة الأولى (الأسس والمعادلات)» and friends. The support
block goes into `additionalContext`, so since live AI was switched on those
were being sent to the model on every generation for that lesson.

Swept all 57 KB lessons: **30 cross-subject attachments, every one of them
financial-literacy → mathematics.** Two independent causes.

1. **The subject gate was advisory.** A declared mismatch scored `-6`, on the
   theory that a strong title match should still be allowed through. But a
   matching unit tag scores `+8`, so one colliding tag beat the penalty
   outright. A Grade 10 maths worksheet is never the right attachment for a
   financial-literacy lesson however the titles score, so a declared mismatch
   now disqualifies.
2. **The unit tags had no subject in them.** `s1-u1` / `s2-u3` are
   *mathematics* catalog tags, but `unitTagsForLesson` emitted them for any
   unit id matching `/nccd-u\d+/` — which every NCCD unit does. Financial
   literacy unit 1 therefore emitted `s1-u1` and collided with every maths
   unit-1 pack. Chemistry escaped only because it carries explicit `chem-*`
   tags. The bare form is now emitted for mathematics alone.

A third leak survived both fixes: `buildSupportResourcesContext` retries
without the lesson when the scoped search finds nothing, and dropping the
lesson dropped the subject with it (`detectSubjectFromQuery` knows only maths
and chemistry). One financial-literacy lesson picked up **chemistry** activity
books through that path. The retry now widens the match, not the subject.

After: 0 cross-subject attachments; the only lessons whose results changed are
the 10 financial-literacy ones, which now correctly attach nothing — the
catalog holds no financial-literacy packs. All 36 mathematics and 11 chemistry
lessons are byte-identical to before.

## Fixed 2026-08-20 — generated multiple-choice keys could never verify

The provider evaluation's first successful run reported the objective half as:

```
provider   questions  provable  verified  pass rate
openai            40        14         0        0%
```

**That 0% was the scoring, not the model.** All 14 rejections were artifacts,
and two of the three causes are in the shipped app, not in the eval harness.

1. **Option labels.** `quizPromptAr` literally instructs the model to return
   `"options": ["أ) خيار", …]` and `"correctAnswer": "أ) الخيار الصحيح"`, so
   every generated multiple-choice item arrives labelled — and the label went
   to SymPy verbatim. The key failed to parse, and each distractor came back
   `parse_or_compare_error`, so the item was rejected as `bad_distractors`.
   Reproduced directly against `verify_core`: `verify_item('derivative_polynomial',
   '5x^3', 'أ) 15x²', …)` → `verified: False, computed_answer: None`; the same
   call with the label stripped → `verified: True, computed_answer: 15*x**2`.
   Net effect: **no generated multiple-choice derivative had ever earned a
   symbolic badge**, on precisely the family the verifier is best at. Fail-closed,
   so the badge was never wrong — it was silently never shown.
2. **صح/خطأ items.** «مشتقة الدالة f(x) = x² هي 2x. صح أم خطأ؟» still reads as
   a derivative question, so the classifier claimed it and the verifier was
   asked whether «صحيح» equals `2x`. It never can. Beyond the wasted round
   trip, the item was then reported as a key SymPy rejected — indistinguishable
   from the model getting the maths wrong, when it answered exactly the
   question it was asked.
3. **Circle equations.** «(x-4)² + (y+1)² = 9» has one `=`, a `^2` and Latin
   letters, so `latinEquationFrom` classified it as a single-unknown quadratic.
   `solve_equation` then refused it for having two unknowns. Fail-closed again,
   but again reported as a rejected key.

**Fixes**, all in the shared pipeline so production and the scorer inherit the
same behaviour rather than the eval carrying its own copy:

- `quizVerification.ts` gained `stripOptionLabel` (bracket-style labels only —
  accepting `1.` would rewrite the decimal key `2. 5` to `5`) and
  `isTrueFalseAnswer`. `verifyItems` strips the label from the key **and every
  distractor** — stripping one side only would leave the correct option in its
  own distractor list, where `check_distractors` rejects it as
  `equivalent_to_answer` — and short-circuits صح/خطأ items to `BANK_OUTCOME`
  without asking.
- `verifyMathGuards.ts`: an equation must contain exactly one unknown.
  Identifiers followed by `(` are functions, not unknowns, so `sin(x) = 0.5`
  still classifies.
- `score-math.py` mirrors the app's full pipeline again, counts صح/خطأ in its
  own column, and prints an explicit "this run measured nothing" line when
  `provable` is 0 rather than an `n/a` that reads like a result.

Replayed the real failure shapes through the fixed scorer: 2/3 provable, with
the one deliberately wrong key (`6x²` for `3x³`) still caught and reported —
the fix removes false rejections without blunting real ones.

**Do not read the 0% from that run as a model result.** The eval needs re-running
before any provider decision is made from its objective half.

## Fixed 2026-08-20 — the spend guard undercounted, and 2000 tokens is not a lesson plan

Asked to plan which model to use for what. Checking the current model facts
before recommending anything turned up three live problems, all of which would
have made the answer wrong.

### The "conservative" fallback was cheaper than a real model

`aiBudget.ts` prices models to estimate spend against `AI_BUDGET_USD`, and
falls back to a deliberately expensive rate for anything it does not
recognise — the comment says so. The fallback was **$5/$15 per million**.
Claude Opus 5 output is **$25**. So pointing `AI_MODEL` at a Claude model
would have made the guard undercount output by 40% and let a run sail past
its cap while the log reported it was under.

A default that undercuts a model you might actually select is not
conservative. The table now prices the Claude models explicitly, the fallback
is **$10/$50** (the most expensive current model, so an unknown id can only
trip the cap early), and a test pins the invariant: *the fallback is never
cheaper than anything the table knows*.

Claude Sonnet 5 is priced at its standard $3/$15, **not** the $2/$10
introductory rate that ends 2026-08-31 — a guard that assumes a promotional
price stops guarding when the promotion does.

### 2000 output tokens breaks a reasoning model, silently

`/generate/*` capped completions at 1500–2000 tokens. That is tight for a
full Arabic lesson plan and outright broken for a reasoning model: thinking
tokens are billed as output and count against the same ceiling, so the model
can spend most of the budget reasoning and return a truncated object.

The failure is invisible. `extractJSON` on a truncated response yields a
partial object or `{}`, the route answers **200**, and the client renders an
empty lesson plan — with the provenance badge reporting **live**, because the
API did answer. A precondition for using any thinking model here, not a
tuning preference. Now one `GENERATION_TOKENS = 8000` for every route.

### The eval would have measured itself

`provider-eval.ts` had the same 2000–2500 ceilings. A reasoning model would
have been truncated, scored as malformed, and read as *"bad at Arabic lesson
plans"* when it was never given room to answer. Raised to 16000 — an eval
that penalises a model for the harness's configuration measures the harness.

It also scored only whether the response **parsed**. A model can return
well-formed JSON with none of the fields the app reads and score as a
success, then render as an empty lesson plan. The report now has two columns,
`parsed` and `complete`, and `complete` checks the fields each artifact type
actually requires, treating empty strings and empty arrays as missing.

### Still to decide

One `AI_MODEL` covers generation and chat alike, though they want opposite
things — prep is low-volume and quality-critical, chat is high-volume and
latency-sensitive. Splitting it into `AI_MODEL_GENERATE` / `AI_MODEL_CHAT`
should land before the eval, so the thing measured is the thing shipped.

And `/generate/*` does no shape validation at all: `extractJSON` → `res.json`.
The 200-with-`{}` path above is the same hole. Fixing it properly means
deciding what the route does when the shape is wrong — fail closed with a
5xx, or return a labelled partial — which is a product decision, not a
refactor.

## The lesson library could be read but never written, 2026-08-20

Asked for a way to add a teacher's own video, image or other resource to a
deck. Went looking for where that would live and found it already built —
and orphaned.

`services/lessonMedia.ts` is complete: per user, per lesson, add / get /
remove, URL classification, duplicate rejection. Its only UI lived on the
home screen, which was retired when chat became the landing tab. Nothing
routes to `/home` and its tab is `display: none`, so:

| | writes | reads |
| --- | --- | --- |
| `app/home.tsx` | ✅ — unreachable | ✅ |
| Class Mode (`startClass.ts`) | — | ✅ **a store nothing can write** |
| Slides Maker | — | ❌ did not know it existed |

Class Mode has been asking every lesson for teacher-attached media that no
teacher could attach. Not a crash, not an error — a feature that quietly
stopped having an input.

**The UI now lives in `components/ui/LessonResources.tsx`**, under the lesson
picker in Slides Maker, as a component rather than a fourth copy of the same
form. Pin a video to «الاشتقاق» once and it lands in every future deck for
that lesson *and* in Class Mode, which was already reading for it.

**The search stands down when the teacher has spoken.** `shouldSearchForVideo`
returns false when a video is pinned, so a curated lesson makes no YouTube
call at all: one fewer thing on the projector, and 100 units of a 10,000/day
quota unspent per generation. The search fills a gap; it does not compete.

`insertLessonResources` puts the batch in together, at the same slot the
auto-found video uses — after the teaching, before the worked examples.
Inserting one at a time would have reversed them, since each lands before the
same first `challenge` slide.

**Verified in a real browser** end to end: pinned «فيديو المعلم نفسه» to
الاشتقاق, generated, and counted the calls to `/media/youtube-video`.

| | searches during generation |
| --- | --- |
| Nothing pinned | 1 |
| Teacher's video pinned | **0** |

The deck read …📐 القاعدة → **فيديو** → مثال 1–3 → 🎉 ملخص, with the search
result absent.

**Still to do in this direction:** insert-a-resource at a chosen position in
an existing deck, and a `link` kind with a QR code so articles, PhET and
GeoGebra applets can be projected and scanned. The dead `app/home.tsx` is
untouched — it is unreachable either way, and deleting a whole screen is its
own decision.

## "Suggest another video" — free, because the search already paid, 2026-08-20

The swap field let a teacher replace the video with one they had in mind. This
covers the other half: they don't like the pick and want a different
suggestion without leaving the app.

**The quota is what shaped the design.** A YouTube `search.list` costs 100
units against a 10,000/day default — 100 searches for the entire product, per
day. Re-searching each time a teacher rejected a suggestion would have made
the button a quota bomb. But `maxResults` does not change the price: one
search returns five candidates for the same 100 units. So the API now asks
for five, hands back `videos` alongside the unchanged `video`, and the editor
cycles the list locally.

**Measured, not assumed:** the browser check counts the calls to
`/media/youtube-video`. One at generation, and **still one after three
presses** of اقترح فيديو آخر.

The candidates live in screen state, not on the slide: they are a browsing
aid, and putting them in the deck would carry them into every save and every
export for nothing. A deck reopened from the workspace therefore has none —
the first press fetches once, then cycles free.

`nextVideoSuggestion` compares by **video id, not URL string**. The slide may
hold a `youtu.be` short link for a candidate the search returned as a
`watch?v=` link; offering a teacher the video they are already looking at
reads as a broken button. It returns null when there is genuinely nothing new,
so the control says «لا توجد اقتراحات أخرى» rather than cycling to itself.

Pressing the button fills the fields rather than saving — the teacher reads
the title first, and can keep pressing. The caption is rewritten with it, and
`videoCaption()` is now the single definition of «{title} — {channel}» shared
by the deck builder and the cycler, so a caption chosen here is
indistinguishable from one written at generation time.

**Verified in a real browser** against a stubbed three-candidate response:
pressing cycles 1 → 2 → 3 → back to 1, with the caption tracking the URL at
every step, and the search count never leaving 1.

## Teachers can swap the deck's video, 2026-08-20

Reported straight after the auto-found video started working: the slide editor
offered عنوان الشريحة and محتوى الشريحة and nothing else, so a teacher who
didn't want the video the search picked could delete the slide or keep it.
No way to substitute their own.

Media slides now carry two more fields — **رابط الفيديو أو الصورة** and
**وصف الوسائط**. Paste a YouTube link (watch / youtu.be / embed / shorts) or
a direct image URL.

**The caption is the part that had to be got right.** `mediaCaption` holds
«{title} — {channel}» for the video the *search* returned, and it is projected
on the slide and printed into the PDF and the PPTX. Left in place over a new
URL, the deck confidently labels one video with a different video's name —
wrong in the file the teacher hands out, where nobody is watching to catch it.
So an untouched auto-generated caption is dropped when the URL changes, while
a caption the teacher actually wrote is kept.

`mediaKind` follows the URL rather than the slide's previous kind, so pasting
a picture onto a video slide converts it instead of handing the video renderer
an image and printing a dead "watch" link.

**Unsupported links are refused, not stored.** A URL the app cannot embed
projects as a blank frame in front of a class and exports as a dead link, so
`applyMediaEdit` returns a refusal and the dialog stays open with the field
outlined and the reason under it. `classifyMediaUrl` was already there and
already tested — this is the first thing to use it on the edit path.

The edit dialog also got a `ScrollView`. It is capped at 85% of the screen
with a type-dependent field list; two more fields would have clipped the
bottom on a short viewport and taken the احفظ button with it.

**Verified in a real browser** against a stubbed search (no `YOUTUBE_API_KEY`
locally):

- pasting `https://example.com/not-a-video` → refused, dialog stays open, the
  field turns amber with «رابط غير مدعوم…», nothing written;
- pasting `https://youtu.be/dQw4w9WgXcQ` → reopening the editor reads back the
  new URL and an **empty** caption, the old video's title and channel gone.

**Not done:** no "suggest another video" button. That needs the API to return
more than `maxResults=1`, and cycling suggestions one search at a time would
burn the YouTube quota (100 units per search against a 10,000/day default).
The right shape is to fetch several in the one call the deck already makes and
cycle locally — worth doing, but it is an API change, not this one.

## Fixed 2026-08-20 — the celebration overlay followed you off its slide

Reported from a real deck: «🎉 أحسنتم! اكتمل النشاط» sitting on top of the
تدريب موجّه slide, and again on the تذكرة الخروج divider — slides that have
nothing to celebrate.

**Cause.** The overlay was fired imperatively from *both* navigation paths
(`goToSlide` and the keyboard handler), each scheduling a fire-and-forget
2.8-second timeout with nothing cancelling it. Advance before it faded and it
rode along onto whatever came next. Two copies of the same trigger, neither
tied to the slide that earned it.

**Pre-existing, and made reachable by the exit ticket.** While the summary was
the last slide there was nowhere to advance to, so the window never opened.
Putting the exit ticket after the summary made passing through those 2.8
seconds the normal case — the same shape as `extractGraphCommands`, where a
latent bug only became visible once something started depending on it.

**Fix:** one `useEffect` keyed on the current slide. If the slide closes a run
(`summary` / `podium`) it plays; otherwise it hides, and leaving cancels both
the entry and exit timers. The overlay can no longer outlive its slide, and
the duplicated trigger is gone.

**Verified in a real browser, both ways.** Walked to the summary (20/25),
confirmed the overlay appears, then advanced twice inside the old 2.8s window
and checked slide 22/25:

| | overlay still on screen at 22/25 |
| --- | --- |
| Before | **yes** — the reported bug, reproduced |
| After | **no** — and it still fires on the summary itself |

## Question stems, and the verification they were blocking, 2026-08-20

Putting checks in the lesson deck made the wording visible on a projector,
and it did not survive the look: «ما ناتج / حل: f(x)=x³ − 4x؟» — a stem that
asks neither for a result nor for a solution, and that no teacher would
write.

**The good Arabic already existed.** Every bank item that needs specific
wording carries a hand-written `promptAr` — «أوجد مشتقة f(x) = x².»، «ما ميل
مماس منحنى y = x² عند x = 3؟». Only `short_answer` read them. Multiple
choice, true/false and fill-in-the-blank each rebuilt a stem from `item.eq`,
so the same item that reads properly on a worksheet was projected as
boilerplate. One stem now feeds every question type, and items with no
prompt are worded by what they are — «أوجد حل المعادلة:» only when there is
an `=`, «بسّط المقدار:» for a simplify item, «أوجد حل النظام الآتي:» for a
system.

True/false states the question, then the proposed answer, then asks — an
error-analysis item. A prompt is an imperative and there is no mechanical
way to turn one into a statement, which is why the old attempt produced
«حل / ناتج «f(x)=x³ − 4x» هو …» for every family alike. The word-problem
fallback no longer invents «مسألة: يحتاج طالب إلى حل … ضمن تمرين صفي» —
a story about a student doing an exercise is the exercise with a sentence in
front of it. It asks for the working instead.

### The correct option was identifiable without doing any maths

Visible the moment the stem stopped being boilerplate. The bank stores
answers labelled and distractors bare:

    أوجد f′(x) إذا كان f(x) = x³ − 4x.
    أ) 3x²   ب) f'(x) = 3x² − 4   ج) x² − 4   د) 3x − 4

One option carried a prefix. It was always the right one. The same tell ran
through the vectors (`u+v = ⟨4 ، 1⟩` against bare pairs), statistics
(`المتوسط = 5` against bare numbers) and functions items. Whatever else a
distractor is for, it cannot be eliminable on sight.

Options are now levelled to one shape, and only when they are actually
mismatched: a set that is already uniformly labelled (`x = 6` against
`x = 5`, `x = 11`) is left alone, because there the `x =` is what makes the
answer readable. The label pattern requires a single token before the `=`,
so «متعامدان (الضرب القياسي = 0)» and «قيم حرجة عند x = ±1» — where the `=`
is part of the sentence — are not sliced in half.

### It was also blocking symbolic verification, completely

Chasing the wording found that **no quick-check derivative question has ever
been symbolically verified.** Two independent causes:

1. The old stem «ما ناتج / حل: f(x)=x³ − 4x؟» carries no derivative marker,
   so `classifyVerifiableTopic` read `f(x)=…` as an *equation to solve* and
   SymPy rejected it.
2. Where classification did fire, the answer went over as `f'(x) = 2x`,
   which SymPy cannot parse at all — the apostrophe opens a string literal.

A third, smaller one: `isDerivativeQuestion` matched only the ASCII
apostrophe, while the Arabic bank writes U+2032 — «أوجد f′(x) إذا كان
f(x) = x³ − 4x.» has no «مشتق» in it either, so that character was the only
marker there was, and the guard did not recognise it.

Every one of these failed closed, so nothing false was ever claimed. The
effect was subtler: the badge that proves the maths never appeared on the
questions built to carry it, and «من بنك الأسئلة المُراجَع» looked like the
honest ceiling when it was actually a bug.

**Measured against the real SymPy service**, replaying the five derivative
items a Quick Check draws, before and after:

| | verified |
| --- | --- |
| Shipped | **0 of 5** |
| After | **3 of 5** |

The two that remain are correctly outside the prover's slice — a
tangent-slope answer is a number and a critical-points answer is prose,
neither of which the derivative comparison can check. They keep the honest
bank label.

**Verified in a real browser:** slide 13 of the الاشتقاق deck now reads
«أوجد f′(x) إذا كان f(x) = x³ − 4x.» with four options of one shape —
3x² · x² − 4 · 3x − 4 · 3x² − 4.

## Slides Maker: the deck now checks, not just teaches, 2026-08-20

The education review's top recommendation. A Slides Maker deck went title →
outcomes → vocabulary → hook → concepts → rule → examples → practice →
summary and never once asked the class a question. Forty-five minutes of
projection with no point at which a teacher finds out whether any of it
landed.

**Two mid-lesson checks and an exit ticket, placed rather than appended.**

| Where | Why there |
| --- | --- |
| After the rule, **before** the worked examples | The last moment a wrong answer is cheap. The show of hands decides whether the examples are a demonstration or a re-teach; after them it would only measure copying. |
| After the worked examples | "Can you do one" — a different question from "did you follow me". |
| After the summary, behind its own divider | The exit ticket leaves the room. Its own divider because it is a change of mode: the deck stops teaching and starts measuring. |

Questions come from the existing quick-check generator — the deck places
them, it never invents one. `ClassroomActivityRequest.numQuestions` is new so
Slides Maker can ask for the five it places instead of taking the four a
standalone Quick Check happens to make; the concrete bank tracks used items,
so five requests give five distinct questions and no mid-lesson question can
reappear at the door.

`splitChecks` drops nothing and pads nothing. Five → 2 mid + 3 exit. Four →
2 + 2. Three → three mid-lesson checks and no exit ticket at all, because a
one-question exit ticket is not one and that question is worth more where the
answer can still change the teaching.

**Not gated on subject.** The generator returns open write-on-your-board
questions when it has no verified bank to draw from, and those are accepted
as checks. Gating this on `subject === 'mathematics'` is precisely the bug
the visuals work had to undo, and chemistry and financial literacy would have
silently got nothing again.

`verified` / `verifiedBy` / `computedAnswer` ride through untouched — claims
about an answer key only the verifier may make. `questionIndex` is stripped:
it indexes a Class Challenge scoring ledger and this deck has none.

**The exports had no `question` branch at all.** Both fell through to the
generic content renderer, so an MCQ printed as a bare stem: the slide asked
the class to raise a letter card and the file showed no letters to raise.
This was already true for the Class Challenge and Quick Check decks — adding
checks to lesson decks would have spread it. Both exports now render the
option rows with أ/ب/ج/د, mark the correct one (matching what the challenge
branch already did with worked-example answers — the exported file is the
teacher's copy) and carry the verification line.

The printable answer key is now rebuilt from the slides rather than from the
book's example list, which never knew about any slide added after it. Checks
are keyed by their own title, not renumbered into one sequence: "تذكرة
الخروج 1" is the first exit-ticket question, not the first question in the
deck.

**Verified in a real browser, all three surfaces.** Local Postgres + API +
Expo web, generated الاشتقاق → a 25-slide deck reading …القاعدة (11) →
الرسم البياني (12) → **✋ تحقّق سريع 1 (13)** → مثال 1–3 (14–16) → **✋ تحقّق
سريع 2 (17)** → تدريب (18–19) → ملخص (20) → divider (21) → **🎫 تذكرة الخروج
1–3 (22–24)** → الواجب (25).

- **Presenter:** slide 13 shows the timer, «الكل يجيب: ارفعوا بطاقة الحرف!»,
  four unrevealed options and the reveal control.
- **PPTX:** exported the real file and unzipped it — `slide13.xml` carries
  the stem, أ/ب/ج/د, all four options, the ✓ on the correct one, and
  «من بنك الأسئلة المُراجَع».
- **PDF:** captured the print iframe's HTML — 22 option rows across the five
  checks, each marked exactly once.

**Known content gap, not introduced here:** the bank's generic stem reads
«ما ناتج / حل: f(x)=x³ − 4x؟», which is clumsy Arabic. It affects the
standalone Quick Check identically; putting checks in the lesson deck only
makes it more visible.

## Mock AI content was indistinguishable from real, 2026-08-20

`RemoteAIService` falls back to `MockAIService` whenever a live call fails.
That fallback was a `console.warn` and nothing else. With
`EXPO_PUBLIC_DEMO_MODE=false` the app rendered the same confident Arabic
lesson plan either way, so a wrong `OPENAI_API_KEY`, an expired token, a
server without `AI_LIVE_MODE`, or a 429 from the budget cap all looked
exactly like working AI. There was no way to answer "is the real model
actually on?" from inside the product — which is the first thing anyone
asks after flipping the switch.

**What now happens.** Every generation records where it came from
(`services/ai/aiProvenance.ts`): `live`, `mock` via demo mode, `mock` via
fallback, or `none` when a call failed and nothing was produced. The badge
under each screen title — the one that used to be the demo-mode label, on
all eleven generator screens already — reads that record:

| Situation | Badge |
| --- | --- |
| `DEMO_MODE` on | `وضع العرض · محتوى تجريبي` (unchanged) |
| Live, nothing generated yet | **nothing** |
| Live call succeeded | `ذكاء اصطناعي مباشر` |
| Live call failed, mock stood in | ⚠️ `تعذّر الاتصال · محتوى تجريبي`, amber |

The empty state is deliberate. A badge saying "Live AI" before any call has
been made would assert something nobody checked — the same mistake as
setting `verified` from a code-computed fallback.

`EXPO_PUBLIC_AI_STRICT_LIVE=true` goes further and refuses to substitute at
all: the screen shows its error state instead of content nothing generated.
Off by default, because a teacher mid-lesson is better served by a worksheet
labelled as sample content than by an error. On while you are verifying that
live mode is really wired up.

The API's failure text (`HTTP 401`, `AI live mode is off…`) is diagnostic and
usually English — it goes in the accessibility label, not the visible badge.
`describeAiError` caps it at 120 characters and takes only the message, so a
proxy's HTML error page can't end up rendered in a header.

**Verified in a real browser, all three states.** Stood up a local Postgres,
pushed the schema (24 tables), ran the API on :8080 and Expo web on :8083
with `EXPO_PUBLIC_DEMO_MODE=false`, registered a teacher, and generated a
lesson plan for المشتقات · الاشتقاق:

- before generating — no badge, as designed;
- with the server's `AI_LIVE_MODE` off — a full lesson plan rendered *and*
  the amber `تعذّر الاتصال · محتوى تجريبي` badge appeared in the header.
  This is the exact bug, reproduced and then labelled;
- with a 200 stubbed at the network layer — the server's own text rendered
  and the badge read `ذكاء اصطناعي مباشر`.

**Not done:** the API still reports nothing about *its* own provenance —
whether a 200 came from OpenAI or from a server-side default. Today the
client's `live` badge means "the API answered", not "a model ran". That is
the honest reading of what is checked, and `/api/healthz/ai-budget` already
reports `liveMode` for the server side.

## Charts: generated from lesson text, refused by default, 2026-08-19

The visual mechanism shipped with nothing producing `chart` blocks. This wires
that up, and fixes a gap the first pass left behind.

### The gap: visuals only drew on graph slides

Both exports called `visualForSlide` **inside the graph branch only**, so a
chart attached to any other slide rendered nowhere. Any slide can carry a
visual now, in HTML and PPTX alike.

### Extraction refuses far more than it accepts

`extractChartData` reads labelled quantities out of lesson prose — a budget
split, a set of shares. The hard part is not finding numbers, it is **refusing
them**:

| Input | Result |
| --- | --- |
| «السكن 200 دينار، الطعام 150 دينار، النقل 50 دينار» | 3 bars |
| «السكن 40%، الطعام 30%، النقل 10%، الادخار 20%» | pie (sums to 100) |
| «أوجد المتوسط الحسابي للبيانات: 2، 4، 6، 8» | **null** |
| «بعد 3 سنوات يصبح المبلغ 1200 دينار» | **null** |
| «س 5، ص 10، ع 15» | **null** |

A statistics mean exercise is a list of bare numbers; charting it would give
four unlabelled bars that mean nothing. Single-character labels are algebraic
variables, not categories. Every value must carry its own text label, there
must be at least three, and repeated labels void the whole match.

Percentages summing to ~100 become a pie because they are parts of a whole;
everything else becomes bars. Unrelated rates («نمو 5%، تضخم 3%، فائدة 7%»)
stay bars — three rates are not one pie.

There is deliberately **no chart equivalent of the blank calculator**. Maths
gets an empty GeoGebra slide to type into live because that is a teaching
tool; an empty chart asserts nothing.

### Verified

- 42 tests on the visual module, 15 of them on extraction, most asserting a
  refusal rather than an acceptance.
- **Against a real `.pptx`**: generated bar and pie slides, unzipped, and
  confirmed `chart1.xml` is a `barChart` and `chart2.xml` a `pieChart`, both
  carrying the Arabic category names and correct values.
- Two new HTML tests: a chart on a *content* slide draws, and an unknown block
  kind is omitted rather than throwing — the open-union contract exercised
  through the real renderer.
- Typecheck clean; mobile 495 tests, 0 failures.

### Running it over the real corpus found a worse bug

Rather than assume the extractor fires, it was run over the actual knowledge
base — the same shape `startClass.ts` reads. **Charts: 0 of 57 lessons.** The
NCCD lesson text states concepts and outcomes, not datasets; budgets live in
the exercises, not the lesson body. So charts currently only appear if
generated activity content states one.

Checking the plot path the same way surfaced a **pre-existing bug in
`extractGraphCommands`**: its body pattern excluded spaces, so it stopped at
the first one. `f(x) = x³ − 4x` became `f(x)=x^3`, and `y = 2x + 1` became
`y=2x`. **GeoGebra has been drawing a different curve from the one written on
the slide, quietly, for every multi-term function in the corpus.** Nobody
noticed because a parabola still looks like a parabola.

Simply allowing spaces would have swallowed the prose after the formula, which
is why they were excluded. The body is now matched as a real expression — a
term, then any number of (operator, term) pairs — which keeps `x^3 - 4x` whole
and still stops at `1 and then…`. Trailing full stops are dropped as
punctuation.

`expressionFromCommand` also only accepted `f` and `y`, while
`extractGraphCommands` emits `f`, `g`, `h` and `y` — so a second curve beside
the first never plotted. Widened to all four.

My own fix made that truncation more dangerous, not less: the wrong curve was
previously confined to GeoGebra, where a teacher might catch it. Rendering it
into the PDF and PPTX would have printed it.

### Still not done

Not verified in a live browser. And the chart path, though correct, has nothing
in the current corpus to act on — it is waiting on content, not on code.

## Deck visuals: one spec, three renderers, 2026-08-19

The deck had three renderers and only one of them could show a graph.
`type: 'graph'` slides carry GeoGebra commands — an iframe — so **both exports
printed `f(x)=x^2` as a text chip beside a note apologising that the graph was
interactive inside the app.** The most valuable picture in a maths deck was
missing from the file that actually goes on the projector.

Worse, `startClass.ts` gated the whole thing on
`subjectId === 'mathematics'`, so **chemistry and financial-literacy decks got
no functional visual at all** — for months, silently, because nothing fails
when a branch simply never runs.

### The rule

A visual is **data, never a live embed**. Data can be drawn as SVG, as a native
PowerPoint chart, or as react-native-svg. An iframe can only be one of those,
which is exactly why it died at the export boundary.

`services/deckVisuals.ts` holds the spec, a tiny fail-closed expression
sampler, and the shared geometry, so the three surfaces cannot drift into
drawing different pictures of the same data:

- **PDF/HTML** — inline SVG (vector-sharp in print, no asset to fetch and race)
- **PPTX** — `addChart`, a *native* chart the teacher can restyle
- **Presenter** — react-native-svg, except on graph slides, which keep
  GeoGebra: live, a curve the teacher can drag beats a static drawing

`visualForSlide` derives the plot at render time rather than at generation
time, so **decks teachers saved before today gain their graphs too.**

### The union is open on purpose

`plot` and `chart` cover maths, financial literacy, statistics and physics.
Chemistry needs `flow` and `figure`; Arabic and English need annotated text
(إعراب over a sentence, tense highlighting) which none of the current
primitives express; art needs an exemplar set, where the image *is* the
content. Those are not designed here — guessing at them from subjects that
don't exist yet would be wrong in expensive ways.

Adding a kind stays additive because **every renderer skips kinds it doesn't
know rather than throwing.** A deck generated next year has to open in an
export path written today.

### Fail closed, like the verifier

The sampler handles `+ - * / ^`, parentheses, unary minus and the implicit
multiplication school notation uses (`3x`, `2(x+1)`). Anything else —
`sin(x)`, `Circle((0,0),3)`, a second unknown — produces **no picture rather
than a wrong one**, and the slide keeps its honest note. A wrong curve on a
classroom wall is worse than no curve, and unlike an answer key there is no
SymPy to catch it.

### Verified

- 27 new unit tests. The load-bearing one asserts the on-screen minimum of
  `x²−5x+6` sits at its vertex — SVG's y-axis grows downward, and getting that
  backwards projects an upside-down parabola that looks plausible enough that
  nobody would question it.
- **Against a real `.pptx`**: generated one, unzipped it, confirmed
  `ppt/charts/chart1.xml` carries all 80 sampled points with a minimum y of
  −0.249 — the true vertex.
- Typecheck clean; mobile 480 tests, 0 failures.
- One existing test asserted the old behaviour (that the apology note was
  present). It was updated to assert the drawing instead, plus a new case
  proving the note *survives* for an unplottable command.

### Not done

**Nothing generates `chart` blocks yet.** The renderers draw them and the tests
cover them, but no generator emits one, so financial literacy benefits only
where a lesson states a plottable function. Extracting a budget breakdown from
prose reliably is the next piece, and it has to fail closed the same way.

Not verified in a live browser — the sampler, geometry and PPTX output are
covered by tests and file inspection, but nobody has watched a deck render.

## Provider evaluation harness, 2026-08-19

Before turning real AI on, the question of *which* provider — OpenAI, Claude,
DeepSeek — needs answering. It cannot be answered from benchmarks: what matters
here is Arabic educational register in the Jordanian curriculum, which
published evals do not cover.

`artifacts/api-server/scripts/provider-eval.ts` runs the **shipped prompts**
over a fixed set of real NCCD lessons through every provider whose key is
present, and records latency, token usage and cost. `score-math.py` then puts
every generated quiz answer key through the app's own verification pipeline —
`toVerifiablePair` → `classifyVerifiableTopic` → SymPy — and reports a
per-provider pass rate.

**That scoring is the point.** Having a symbolic verifier means model choice
can be settled with a number on the one axis that matters most, instead of
vibes. Nobody else evaluating Arabic content generation has that.

Three decisions worth keeping:

- **Offline, not wired into the app.** Building a provider abstraction into the
  request path first would be weeks of plumbing before learning anything, and
  would leave three integrations to maintain to settle a question that only
  needs settling once. Wire in the winner afterwards.
- **The prompts are imported, not re-written.** `src/lib/prompts.ts` was split
  out of `routes/generate.ts` (which constructs the OpenAI client at module
  scope and cannot be imported without a key) so the harness measures what the
  product actually ships. Comparing models on a prompt written for the
  comparison measures the wrong thing.
- **Arabic rating is blind.** Outputs are written under anonymised ids with the
  mapping held back in `key.json`. A model that reads better because you knew
  which one it was is not evidence.

The eval set is fixed and checked in: an eval whose inputs drift cannot be
compared across runs.

**Verified:** the scorer was smoke-tested end-to-end against synthetic output
containing a deliberately wrong key — it caught `x = 7` for `2x + 5 = 17`
(SymPy: 6), correctly counted an Arabic word problem as unprovable rather than
wrong, and verified a `2^{x+1} = 32` item. That test also caught a real bug in
the scorer: without `toVerifiablePair` it rejected every correct derivative
key, which would have systematically under-scored all providers on the family
the verifier handles best. Typecheck clean, api-server 88 tests passing.

`scripts/` had no typechecking at all — it is outside the main tsconfig's
`rootDir`. Added `tsconfig.scripts.json` and chained it into the api-server's
typecheck, so a script importing from `src` can no longer rot silently.

**Not run against real providers.** No Anthropic or DeepSeek key is available
in this environment. Cost, latency and pass-rate numbers do not exist yet —
the harness is ready, the run is not done.

## The feedback table never existed in production, 2026-08-19

Every thumbs-up and thumbs-down teachers submitted since the widget shipped
was lost. `SELECT COUNT(*) FROM feedback` in the live Neon database returned
`ERROR: relation "feedback" does not exist`. The table was created by hand
today; before that, every write 500'd.

### Two silent failures, one on each side

**The widget reported success for a rejected request.** `apiFetch` resolves
for *any* HTTP status — it only rejects on a network failure; `apiJson` is the
wrapper that checks `res.ok`. `FeedbackWidget` awaited `apiFetch` and never
looked at the status, so a 500 fell straight through to `setSubmitted(true)`
and the teacher saw «🙏 شكرًا لملاحظتك». The `catch` that was supposed to
handle this could only ever fire when the network itself was down.

An audit of all 29 `apiFetch` call sites found this was the **only** one that
ignored the status: `workspace.ts` checks inline, and `roster.ts` and
`evaluations.ts` funnel everything through a `readJson` helper that checks
once. Bounded problem, now fixed — and the widget shows a real error and keeps
the form so the comment can be re-sent rather than discarded.

**The dashboard threw the reason away.** `.catch(() => setError('تعذّر تحميل
البيانات.'))` discarded the error object. The message it swallowed said
exactly what was wrong. It now shows it.

### And STATUS.md asserted the opposite

This file claimed the table was "Pushed live via `pnpm --filter @workspace/db
run push`". Nothing had verified that. This is the failure mode CLAUDE.md
opens with — *"Verify claims against the running system. Several past bugs
were things a doc asserted and the running system contradicted. This file
included."* The claim is now corrected in place.

### Also fixed: no deep link survived a page load

The boot effect in `_layout.tsx` ran `router.replace('/(tabs)')` on **every**
signed-in cold boot. On web a reload *is* a cold boot, so opening
`/admin/dashboard`, refreshing a worksheet, or sharing an evaluation link all
landed on the home tab. It now only redirects from an entry route
(`/login`, `/register`, `/forgot-password`, `/onboarding`, `/`) or on a fresh
sign-in. The rule is a pure `isEntryRoute` in `services/routeGating.ts` with
unit tests, since `_layout.tsx` cannot be loaded by `node:test`.

The admin dashboard's own entry point is **حسابي → لوحة الإدارة**, rendered
only for `school_admin` / `system_admin`.

### Worth doing, not done

Nothing detects schema drift. The push is manual, no build step touches the
database, and a missing table surfaces as a 500 at whatever moment a teacher
happens to trigger it. A `/api/healthz/schema` check listing expected-but-
absent tables would have caught this the day it shipped, in one request.

**Verified:** typecheck clean; mobile 462 tests, 0 failures (10 pre-existing
skips). Table creation and the resulting empty `COUNT(*) = 0` confirmed
against the live Neon database.

## Lesson Plan tested; the Word export was mangling Arabic, 2026-08-18

Lesson Plan was the one pilot tool of the five never exercised in the Tier 1
round — Slides, Worksheet, Quiz and Evaluations were, it was not. Closing that
gap found three real bugs, none of them in Lesson Plan itself.

**13/13 on the happy path.** Generates from a curriculum lesson, honours a
non-default duration and teaching style, produces ten named sections rather
than one blob, grounds in the chosen lesson, offers feedback, and its related
panel shows only pilot tools. Two initial failures were **my test, not the
app**: duration and teaching style are dropdown pickers showing their current
value (`45 دقيقة`, `التعليم المباشر`), not chip rows, so the options do not
exist in the DOM until the picker opens.

### 1. The Word export promoted almost everything to a heading

`exportAsWord` decided headings with `line === line.toUpperCase()`. **Arabic is
caseless, so that predicate is `true` for every Arabic line.** Proven by
unzipping a generated `.docx`: 23 `Heading2` paragraphs, of which only 10 were
section labels. A 145-character paragraph of teacher instructions, the
assessment notes, the differentiation notes, the homework and the
«أُنشئ بواسطة إقرأ» footer were all bold headings; just 4 paragraphs survived as
body text. The heuristic did nothing useful in English either — these
formatters never upper-case their labels.

The formatters already declare their headings structurally: `H(label)` writes
the label and then a `─` rule as long as it. That signal is now what is read.
After the fix, on a freshly generated file: **exactly the 10 section labels are
`Heading2`**, one `Heading1` title, body text 4 → 17, and no stray rules
printed.

Six tools share `exportAsWord` — lesson-plan, worksheet, quiz, activity,
workspace view and chat — so all of them were affected and all are fixed.
Confirmed separately on a worksheet, whose headings come from a different
formatter: exactly its three section titles.

The decision is now a pure module, `services/docxOutline.ts`, unit-tested —
`share.ts` imports `react-native` at module scope and cannot be loaded by
`node:test`, the same trap that produced `deckSlidesHtml.ts`. Previously this
could only be checked by unzipping a `.docx` by hand.

### 2. Arabic materials carried English subject and grade

Every screen already computes localised `subjectNames`/`gradeNames` for its
pickers, then `getExportMeta` bypassed them and read `.name` off the catalog
directly. An Arabic lesson plan opened in Word led with
`Mathematics | Grade 10 | 45 دقيقة` while the screen above it said الرياضيات.
Fixed in lesson-plan, worksheet, quiz and activity.

### 3. …and the grade leaked into generated Arabic prose

The worksheet's student header printed «الصف: Grade 10», because the AI request
carries `grade` verbatim into generated content. Localised at the four pilot
generation sites. **`subject` was deliberately left in English**: it feeds
`isMathContext` and ~30 other call sites, and its display-facing use was
already fixed above. `grade` is never compared anywhere — only displayed and
passed through — so translating it is safe.

**Verified:** typecheck clean; mobile 457 tests, 0 failures (10 pre-existing
skips). Each fix was confirmed against a **real generated file**, not asserted:
the `.docx` was unzipped and its `document.xml` outline counted before and
after, for both a lesson plan and a worksheet.

**Not verified:** PDF and Slides exports were confirmed to run without error,
but a web print dialog cannot be inspected headlessly, so their visual output
is still unchecked.

## Verification audit: the badge was understating itself, 2026-08-18

Tier 1 testing found no crashes, so the next question was whether the
verification badge tells the truth. Rather than eyeball it, every question the
concrete math bank can render — 86 items × 5 question types = **430** — was
replayed through the real SymPy verifier offline.

**Baseline: 55 of 430 earned the symbolic badge, and 3 of those 55 were false.**

### The false one

`P = 1/6` is the "equation" behind *«عند رمي حجر نرد عادل، ما احتمال ظهور 5؟»*.
The classifier saw a well-formed linear equation, SymPy solved it to `1/6`, and
it matched the key **by construction** — the equation *is* the answer. A
probability item nothing had reasoned about carried a green
*«تم التحقق من الإجابة رياضيًا (SymPy)»*. `latinEquationFrom` now refuses a
bare unknown against a constant: solving that proves nothing. This also stops
`r = 5` (circle items) from burning a round trip on a guaranteed mismatch.

### Four ways a real proof was being thrown away

All failed *closed* — no wrong key was ever vouched for — but each one made the
product's core claim look weaker than it is.

| Defect | Effect |
| --- | --- |
| `{}` outside the math-safe character class | `2^{x+1} = 32` extracted as `4^x=2^` — a truncated fragment that syntax-errors |
| `.` inside it (decimals need it) | `f(x) = x².` extracted as `x^2.`, rejected by SymPy |
| `toVerifiablePair` wired only into the deck path | quiz/worksheet sent `f'(x) = 2x` verbatim; unparseable, so **every** derivative item degraded to 'bank' while the identical item in a class deck verified |
| SymPy solves over ℂ | `4^x = 64` → `[3, (log(8) + I*pi)/log(2)]`; set comparison failed on size alone and the correct key lost its badge |

Fixes, in order: fold `^{…}` into `^(…)` before extraction; trim trailing
sentence punctuation; apply `toVerifiablePair` inside `verifyItems` so both
paths agree; accept the real subset of a solution set as well as the full one.

The last one widened acceptance, so it widened **rejection** too — a distractor
matching the real-root set is secretly correct and must still be thrown out.
And the evidence line now shows the set the key actually matched, so a Grade-10
wall never displays `3, (log(8) + I*pi)/log(2)` as the verifier's working.

Fixing derivatives then exposed one more: distractors arrive as a teacher reads
them (`3x²`, `x² − 4`) while the answer had already been latinised upstream, so
every derivative multiple-choice item failed its distractor check with
`parse_or_compare_error`. Expression parsing now normalises the same typography
the solution-set parser always did.

### Result

**55 → 100 items symbolically verified, and the false badge is gone.** Every
one of the 100 was checked by hand against its key: `4^x = 2^(x+3) → x = 3`,
`8^x = 4^(x+1) → x = 2`, `2^(x+2) = 2^x + 12 → x = 2`, `x² − 4x + 1 = 0 →
2 ± √3`, all three derivative families. No family that the verifier cannot
actually reason about (stats, circle, trig, vectors, functions) claims a badge
any more.

Round trips also dropped — 223 questions were being sent to the verifier, now
209, with the removed ones being the guaranteed-mismatch tautologies.

**Verified:** `pnpm run typecheck` clean; mobile 449 tests, 0 failures (10
pre-existing skips); `test_equations.py` 29/29. The audit harness is
throwaway — what it found is pinned by unit tests instead: brace exponents,
trailing punctuation, tautology refusal, the pair rewrite on both quiz and
worksheet paths, real-root acceptance, wrong roots still refused, typographic
distractors, and a disguised-correct distractor still rejected.

**Still unverified by the prover** (honest 'bank' label, correctly): systems of
equations, graphical intersections, circle geometry, trigonometry, vectors,
statistics, and every word problem. That is a coverage boundary, not a bug —
the badge now states it accurately.

## Tool catalog narrowed to five for the pilot, 2026-08-18

Audited all 14 tools and tiered them, then parked everything outside the
core. What a teacher is now offered, on both surfaces:

**slides · lesson-plan · worksheet · quiz · evaluations**

Parked (kept, not deleted): `simplify`, `lesson-flow`, `game`,
`activity`, `geogebra`, `classroom`, `lesson-media`, `homework`,
`parent-msg`.

**Why these five.** Slides Maker is the only tool that is genuinely
differentiated — built from the curriculum book, SymPy-verified worked
examples, projected live; the rest generate text a generic model could
produce. Lesson plan and worksheet are the bread-and-butter artifacts.
Quiz and evaluations are assessment, and evaluations is the largest
non-slides feature in the codebase (author → answers → results, all
DB-backed). Everything else was either a duplicate entry point, a
mislabelled tool, or a second-order convenience.

**The audit findings behind the parking**, worth keeping because they
are still true and will need deciding eventually:
- `simplify` is not a tool. It routes to `lesson-plan` with a flag,
  produces the identical `LessonPlanOutput`, and its description promises
  "examples and misconceptions" that do not exist in that type.
- `activity`'s description is **backwards**. It says "an in-class
  experience… not a printable worksheet"; the code generates a printable
  PDF/Word document with no live-presentation capability at all.
  Meanwhile `classroom`'s description ("live experiences on screen") is
  the one that actually fits `activity`'s claim.
- `slides`, `game` and `classroom` all build a `ClassroomActivity` and
  land on the same presenter — three doors to one room. Deliberately not
  resolved: PostHog is now instrumented, so which door teachers actually
  use is a question answerable with evidence in a few weeks rather than
  guessed today.
- `lesson-media` routes to `/home`, a legacy dashboard that *also*
  re-exposes six other tools through a second, undocumented navigation
  path.

**Two catalogs, not one — the trap this pass had to avoid.**
`toolCatalog.ts` drives the tools tab and the chat "+" menu, but
`homeAiTools.ts` is a separate list driving the "قد يفيدك أيضاً"
related-tools panel, the hero chips and Smart Templates — and it
referenced `simplify`, `activity` and `homework` independently. Hiding in
`toolCatalog.ts` alone would have left a teacher generating a lesson plan
and being offered parked tools immediately afterwards. Both are now
filtered: a `hidden` flag whose filtering happens at the export boundary
in `toolCatalog.ts` (so neither screen needed editing and neither can
drift), and `enabled: false` in `homeAiTools.ts`, which the existing
`isToolEnabled` filters already respected. `PROMPT_CHIPS` still lists
`simplify` but has no consumers anywhere — dead code, left alone.

Nothing was deleted: routes still resolve, so saved materials and deep
links keep working, and unparking a tool is deleting one line.

Verified live on both surfaces and the related panel: the tools tab and
chat menu each render exactly the five, and the panel after a lesson-plan
generation dropped from five suggestions to the two pilot tools that
remain. New `toolCatalog.test.ts` pins the visible set and asserts no
parked tool can reach either menu — the failure mode is easy to
reintroduce, since adding a tool to those arrays is how you add one at
all. 440 mobile tests, typecheck clean.

## Exports now print in the app's own typefaces, 2026-08-18

Last item from the "theme, design, font" list: PDF and PPTX both rendered
in generic Arial while the app itself uses Almarai for body copy and
Cairo for every heavier weight. Nothing was needed from the user for
this — the `.ttf` files already ship inside `@expo-google-fonts/almarai`
and `/cairo`, openly licensed, no key or account involved.

**PDF** links the two families from Google Fonts rather than
base64-embedding them. The four faces are ~440KB; inlined they would sit
in the repo *and* in every user's JS bundle, including the majority who
never export. This export already fetches remote images, so it already
assumes network, and the CSS stack keeps Arial as the fallback — with no
network it prints exactly what it printed before, so offline is no worse
than today. `share.ts` gained `waitForFonts` alongside the existing
`waitForImages`, because a webfont is the same race the images were: a
`print()` that fires early doesn't error, it just quietly produces an
Arial PDF.

**PPTX** names the fonts via `pptx.theme` rather than per-run, so no
`addText` call can be missed. PowerPoint cannot embed a font from
pptxgenjs, so this renders correctly wherever Cairo/Almarai are
installed and falls back to a system Arabic face otherwise — again no
worse than the Arial before it.

**Why this also answers "wouldn't Google Slides be easier?"** The Slides
API would be a step *up* in cost, not down: full OAuth 2.0, per-teacher
account connection, token refresh, and Google's app-verification review
for Drive scopes — a real feature, unlike the API-key-in-an-env-var
pattern Unsplash and YouTube use. But Google Slides imports `.pptx`
natively, and Cairo/Almarai *are* Google Fonts, so naming them should be
enough for an uploaded deck to resolve them from Google's own catalogue.
The cheap change plausibly buys the Google Slides path for free; the API
would only add "appears in Drive without uploading," which is
convenience, not capability. **Unverified** — this sandbox cannot upload
to Google Slides, so that one hop needs a human to try a file.

Verified by inspecting the actual shipped artifact rather than trusting
the code read correct: generated a real deck through the UI, downloaded
the `.pptx`, unzipped it, and confirmed `theme1.xml` carries
`majorFont = Cairo` / `minorFont = Almarai`, that the 19 explicit
heading runs (one per slide) name Cairo, that every other run carries no
typeface and so inherits Almarai from the theme, and that **zero** slides
still contain Arial. There is no unit test on the PPTX side because
`exportPptx.ts` imports `react-native` at module scope and `node:test`
cannot parse it — the same trap `share.ts` hit — and inventing an
abstraction purely to make it testable would be worse than the real-file
check, which is stronger evidence anyway. The PDF side is pinned by a new
`deckSlidesHtml.test.ts` case asserting the font link, both families in
use, and Arial surviving as fallback. 437 mobile tests, typecheck clean.

## Video slide polish after seeing it live, 2026-08-18

The YouTube integration went live with a real API key and worked first
try — an Arabic تنجيهي explainer for الاشتقاق, correctly placed at 13/20
right before the worked examples. Two presentation problems were only
visible once a real embed was on screen:

**The caption said everything twice.** It was one string —
`{title} — {channel} (فيديو خارجي، راجعه قبل العرض)` — printed above a
player that already displays the title and channel in its own chrome.
The fix is not to shorten it: `mediaCaption` is what the PDF and PPTX
exports print, and they have no player to read a title off, so dropping
the title there would lose the only record of *which* video it is. So
the two fields now do two jobs — `mediaCaption` keeps `{title} —
{channel}` for the exports, `content` carries just the preview warning
for the presenter. Both exports render `content` as an extra note line
so the warning survives there too; before the split it rode along inside
`mediaCaption`, and dropping it silently would have been a regression.

**The player letterboxed itself.** `mediaStyles.frame` was `width: 100%,
height: 460` — a fixed height regardless of width, so a 16:9 embed on a
wide projector fit itself to the width and left a band of dead black
underneath. Now `aspectRatio: 16/9` with `maxWidth: 900` and
`alignSelf: center`. Measured on a 1600px viewport: 898×504, ratio
**1.781** against 16:9's 1.778.

That change then exposed a third thing it had been hiding: with the
player narrowed and centred, the RTL-margin-aligned caption floated off
to the far right, disconnected from the thing it describes. Media slides
now centre their content lines, so badge, caption and player share one
axis.

Verified live end to end on a wide viewport against the mock search API,
measuring the real bounding boxes rather than eyeballing: caption block
centred on x≈800, iframe centred at 351+898/2 = 800. The grey placeholder
inside the frame during this check is YouTube being unreachable from this
sandbox (egress policy), not a rendering fault — the box geometry was the
thing under test. 436 mobile / 88 api-server tests pass; the PDF video
test now pins both fields separately so a future re-merge of the caption
fails loudly.

## Slides Maker: auto-found explainer video per lesson, 2026-08-18

Asked about integrating chat.z.ai for slide video. Steered away from it
deliberately: their relevant model (CogVideoX) *generates* synthetic
video from a prompt, with no way to fact-check the result. For math and
chemistry, a generated video could show a wrong derivative or a
mislabeled diagram with total confidence, and unlike the SymPy-verified
answer keys there is no mechanism to catch it — the opposite of this
product's whole verification posture. It is also metered, not free, at
any real scale.

Built the honest version instead: search for a **real, existing** video
(YouTube Data API) rather than generating one. Free quota is 10,000
units/day (~100 searches), and most of the plumbing already existed —
`ActivitySlide` has had `mediaKind: 'video'` with YouTube-embed support
since Class Mode's teacher-pasted videos, so this is an automatic
*search* wired into deck generation, not new video infrastructure.

`GET /api/media/youtube-video` (new, in the same `media.ts` as the
Unsplash route, and covered by the same `/media` auth guard) searches
with `safeSearch=strict` (non-negotiable for a K-12 app),
`videoEmbeddable=true` (a match the app cannot play is useless),
`videoDuration=medium` (4-20 min — a real explainer, not a full recorded
lecture), and `relevanceLanguage` from the client. Unset `YOUTUBE_API_KEY`
answers `200 { video: null }`, same never-an-error shape as Unsplash.

`slides.tsx` now fetches all three pieces of external media in one
`Promise.all` and applies them in a single state update, so they share
one staleness guard instead of racing each other. The video query uses
the **lesson topic**, not the subject — a generic "mathematics" video is
no use mid-lesson, where the point is explaining *this* concept.
`classMedia.ts`'s new `insertVideoSlide` places it right before the first
worked example (concept met, about to attempt problems), falling back to
before the summary, then the end. The caption names the channel and says
plainly that this is outside material the teacher should preview —
nothing here is curriculum-grounded or verified, and the deck should not
imply otherwise.

Exports can't play video, so both degrade to a real link rather than
faking a player or dropping the slide: the PDF prints a clickable anchor
**and** the bare URL (a printed page can't be clicked), and the PPTX uses
a genuine `hyperlink` run — chosen over PowerPoint's online-video embed,
which depends on a player shim that varies by version and commonly fails
offline or on mobile, i.e. an inert box in front of a class.

Also fixed a doubled emoji this surfaced: `buildMediaSlide` put "🎬" in
the slide title while every renderer prepends its own type emoji, so
media slides read "🎬  🎬 فيديو". Pre-existing for teacher-pasted media,
but newly visible on every generated deck.

**Verified live against a mock YouTube API** (the sandbox's egress policy
blocks `googleapis.com`/`unsplash.com`/`onrender.com` outright — confirmed
via the proxy status endpoint, not assumed): asserted on the query
parameters this server actually put on the wire — `safeSearch=strict`,
`videoEmbeddable=true`, `videoDuration=medium`, `relevanceLanguage=ar`,
Arabic query correctly percent-encoded — rather than trusting the code
read correct. Then generated a real deck through the UI: 19 slides became
20, the video landed at 13/20 exactly before "مثال 1" as designed, and
the live presenter rendered a real `youtube-nocookie.com/embed/...`
iframe. One earlier run showed the fallback "افتح الوسائط" button instead
of the embed — traced to the mock returning a 9-character video id where
`youtubeIdFrom`'s regex correctly requires YouTube's real 11, i.e. a
defect in the test double, not the app. 436 mobile tests / 88 api-server
tests passing, monorepo typecheck clean.

## Fixed 2026-08-18 — deck hero photos silently missing from PDF/PPTX exports

Reported after setting a real `UNSPLASH_ACCESS_KEY` in production: the
title photo showed up live but not in either export. Two independent
bugs, both introduced the moment a real external image entered these
exports for the first time (before this, both HTML and PPTX exports were
pure inline text/shapes with zero network dependencies).

**PDF (web):** `exportAsPDF` (`share.ts`) injects the deck HTML into a
hidden iframe, waits a flat `300ms`, then calls `iframe.contentWindow.print()`.
That was plenty when there was nothing to load — now there can be a real
`<img src="https://images.unsplash.com/...">`, a genuine network fetch
that doesn't reliably finish in 300ms. `print()` doesn't error when it
fires early, it just captures whatever had painted by then — silently
missing the photo, no console error, exactly the reported symptom. Fixed
with a new `waitForImages(doc, maxWaitMs)`: resolves once every `<img>`
in the iframe has fired `load` or `error`, capped at 2500ms so one
slow/broken photo can never hang the export. **Verified against a real
timing race**, not just reasoned about: a local test image server with
an artificial 1.5s network delay confirmed the old code would have fired
`print()` at 300ms — 1.2s before the image finished — while the fixed
version correctly waited the full ~1510ms and confirmed `img.complete`
+ real pixel data before printing.

**PPTX:** `addHeroBackground` called pptxgenjs's `addImage({ path: url })`,
which — read straight from the installed package's source — fetches
remote images in the browser via a bare `XMLHttpRequest` with no error
boundary the caller can react to; if that request fails for any reason
(a CORS-restrictive response, offline, a dead link), the whole
`pptx.write()` call rejects and the entire export fails, not just the
photo. Fixed by fetching the image ourselves first (`fetchAsDataUrl`:
`fetch` → `blob` → `FileReader.readAsDataURL`) and handing pptxgenjs the
raw `data:` bytes instead of a remote `path` — a failed fetch now just
means no photo on that slide (same flat accent-panel fallback as an
unconfigured key), not a failed export. Also applied to the pre-existing
`type: 'media'` slide image (Class Mode's teacher-pasted images), same
underlying risk. **Verified live in a real browser**, since this
sandbox's network policy blocks `unsplash.com`/`onrender.com` outright
(confirmed via the proxy status, not assumed): a local CORS-enabled test
image server proved the fetch→blob→dataURL path succeeds correctly even
under load delay, and a non-CORS server proved a failure is caught and
degrades gracefully (`null`, not a thrown error) — the two real
behaviors this fix depends on, not simulated.

`deck.slides.forEach(...)` in `exportPptx.ts` had to become a `for...of`
loop (with every early `return` inside it changed to `continue`) since
`forEach` can't be awaited — the async image fetch needs to actually
finish before `pptx.write()` runs, not fire-and-forget mid-loop.

Also answered: "images only showed up on the cover, what about other
subjects" — the fetch/attach code treats all three curated subjects
(mathematics, chemistry, financial-literacy) identically, no subject
gating exists. The much more likely explanation is per-lesson: the
divider slide (the second photo) only exists when that lesson's curriculum
data actually lists key concepts — a lesson with none gets no divider at
all, by the same "omit rather than pad" rule every other optional section
in this deck already follows, so it will only ever show the one title
photo regardless of subject. Free-tier Unsplash's 50 req/hour cap is a
secondary possibility worth ruling out during heavy back-to-back testing.

## Slides Maker: full-bleed hero images + section dividers, 2026-08-18

Follow-up to the Unsplash pass: asked for more visual variety per slide
plus better use of photos, not just one generic image sandwiched after
the title. Decided against fetching a photo per slide (fragile to lay
out well across three renderers, and burns the free Unsplash rate limit
fast) in favor of two targeted moments: the title slide gets a full-bleed
photo background, and a new `'divider'` slide type — a full-bleed
"chapter title" the deck inserts before the dense explanation section —
optionally gets one too.

`ActivitySlide.type` gained `'divider'`. `mediaUrl`/`mediaCaption`
(already on every slide, previously only meaningful for `type: 'media'`)
now double as a background photo on the title slide and on dividers —
attached directly via `classMedia.ts`'s new `attachBackgroundImage`,
replacing the previous `insertImageAfterTitle` (deleted along with its
tests), which spliced a whole extra slide into the deck instead. Fewer
slides for the same visual payoff, and no renumbering to get right.

`buildLessonDeck` (`lessonSlides.ts`) inserts one divider — topic name as
title, "لنبدأ الشرح" / "Let's dig in" as subtitle — right before the
concept slides, only when there are concepts to introduce (omit rather
than pad, same rule the rest of this deck follows). `slides.tsx` now
fetches two photos in parallel instead of one, using `classMedia.ts`'s
new `deckPhotoQueries(subjectId, subjectName)` — curated query pairs for
the three subjects this app actually teaches (mathematics, chemistry,
financial-literacy), generic `"{subject} education"`/`"{subject}
classroom students"` fallback otherwise — attaching the first to the
title and the second to the divider (found by `type === 'divider'`, a
no-op if the deck has none). Same identity-guarded, try/catch-wrapped,
never-blocks-generation pattern as the single-photo version it replaced.

All three render surfaces gained the same two things — a `HeroSlideView`
in the live presenter (`presentation.tsx`, full-bleed `<Image>` +
`expo-linear-gradient` scrim, or a flat accent panel when there's no
photo), a `dividerSlide()`/`deckHeroLayer()` pair in the PDF exporter
(`deckSlidesHtml.ts`, `<img>` + a CSS gradient div, both explicitly
z-indexed above the title/divider text so painting order can't flip
them), and an `addHeroBackground()` helper in the PPTX exporter
(`exportPptx.ts`, `addImage` + a semi-transparent `addShape('rect')`
scrim — pptxgenjs has no gradient fill, so it's one flat dark layer
rather than the top-to-bottom fade the other two use).

**Verified live, full stack, real Postgres, no Unsplash key configured**
(this sandbox's — and this repo's default — actual state, so the
no-photo fallback path is the one that matters most): generated a real
derivatives deck through the actual UI, confirmed both curated
`GET /api/media/unsplash-photo` calls fired with the right per-subject
queries (`mathematics equations chalkboard`, `geometry classroom
students`), watched the title slide render unchanged (no photo → the
same layout it always had, no regression) and the divider slide render
as a full-bleed indigo panel with centered title/subtitle exactly as
designed, with zero *new* console errors (one pre-existing, unrelated
`<button>`-nesting hydration warning from the slide-outline edit/delete
row predates this work). Exported the real deck to `.pptx`, unzipped it,
and confirmed `slide5.xml` (the divider) actually contains the `4F46E5`
background fill and both text runs — proof against the shipped file, not
just the generator code. The with-photo path on all three surfaces is
covered by unit tests (`deckSlidesHtml.test.ts`'s four new hero-layer
cases) and typecheck/code-pattern consistency (`exportPptx.ts`'s
`addHeroBackground` reuses the same `addImage`/`addShape` calls the file
already made for the existing media-slide and header-bar code) rather
than a live screenshot — no real Unsplash key was available in this
sandbox to see an actual photo land. 433 mobile tests (423 passing + 10
pre-existing skips), monorepo typecheck clean.

## Thumbs up/down feedback + admin dashboard, 2026-08-18

Follow-up to the PostHog pass: asked for a way for teachers to say whether
generated content was actually good, and an admin view to see it plus
usage. Decided not to duplicate PostHog's own analytics UI in-house —
that's already free and working. The split: **feedback** is real product
data (own table, own admin API, since you'll want to query/filter it
inside the app), **usage numbers** on the dashboard come from data
already durably stored (materials saved, users, evaluations — real
counts, no new event pipeline), with a link out to PostHog for the
deeper screen-by-screen trace data it already captures.

**New `feedback` table** (`lib/db/src/schema/feedback.ts`) — same
conventions as `savedMaterials`: uuid id, `userId` FK cascading on
delete, `materialType`/`toolId`/`rating`/`comment` as plain `text`
columns (rating is `'up' | 'down'`, comment defaults to `''`, capped at
2000 chars server-side against one runaway paste). **This paragraph used to
claim the table was "pushed live via `pnpm --filter @workspace/db run push`".
It was not** — see the 2026-08-19 entry. The table did not exist in production
until it was created by hand on 2026-08-19, and every submission until then
failed.

**New `requireRole` middleware** (`middlewares/auth.ts`) — nothing like
it existed before this; the only prior "admin" gate anywhere was
`/healthz/errors`'s static `ADMIN_DEBUG_KEY` header check, not
role-based. `authMiddleware` already re-fetches `role` fresh from the DB
on every request (confirmed live: promoting a user's role mid-session
and re-using their existing JWT immediately unlocked the admin routes,
no re-login needed), so `requireRole(...roles)` just reads `req.user.role`
— 401 with no token, 403 (not 404 — a signed-in non-admin knowing the
route exists isn't worth hiding, unlike the debug-key route) if the role
doesn't match.

**New routes**: `POST /feedback` (any signed-in teacher), `GET /feedback`
(admin-only, paginated, filterable by rating/materialType, joined with
the submitter's name/email), `GET /admin/usage-summary` (admin-only —
total users, total evaluations, saved materials grouped by type,
feedback grouped by rating). Both files declare `authMiddleware`/
`requireRole` per-route rather than a router-wide guard, since `POST
/feedback` and `GET /feedback` need different permission levels in the
same file.

**`components/ui/FeedbackWidget.tsx`** — thumbs up/down plus an optional
comment. Deliberately doesn't fire on tap: a bare thumb can't distinguish
"wrong on purpose" from "wrong, here's why," and firing immediately would
need either a second PATCH request to attach a comment afterward (an
endpoint that doesn't otherwise need to exist) or losing the comment
entirely. Tapping a thumb only selects it; one explicit Submit sends
rating and comment together in a single row. Wired into the six
generator screens that produce a result a teacher would judge —
`lesson-plan.tsx` (covers `simplify` too, same screen), `worksheet.tsx`
(covers `homework`), `quiz.tsx`, `activity.tsx`, `slides.tsx`,
`lesson-flow.tsx`. There's no shared result-action component across
these screens (confirmed by reading all six — each builds its own
Save/Export row independently), so each got the widget added at its own
existing `result && !loading` guard, next to `RelatedResourcesPanel`
where that already exists.

**`app/admin/dashboard.tsx`** — role-gated client-side (redirects/shows
an "admins only" message for non-admins; the real enforcement is
server-side, both admin routes 403 for anything but
`school_admin`/`system_admin`), reachable from a new "Admin dashboard"
row in Profile that only renders for those two roles. Shows the usage
counts, a feedback list with rating filter chips and pagination, and a
link out to PostHog for deep trace data.

**Verified live, full stack, real Postgres**: registered a teacher via
the API, submitted two feedback rows, confirmed `GET /feedback` and `GET
/admin/usage-summary` both 403 for that teacher; promoted the same user
to `school_admin` via SQL and confirmed both now return 200 with correct
data using the *same* still-valid JWT (proving the fresh-role-lookup
claim above, not just asserting it); loaded the admin dashboard in a
real browser as that admin and confirmed the counts and both feedback
rows render correctly with zero console errors. Separately, as a plain
teacher, generated a real lesson plan through the actual UI (Tools tab →
lesson plan → derivatives), tapped 👍 on the `FeedbackWidget`, added a
comment, hit Send, watched the network panel show `POST /api/feedback →
201`, saw the "🙏 شكرًا لملاحظتك" confirmation replace the widget, and
confirmed that exact row showed up moments later in the admin feedback
list. Typecheck clean; mobile suite unchanged at 427 tests (417 passing
+ 10 pre-existing skips — none of the touched files are in the test
net); api-server suite at 87 (was 86; added a mount-order guard test for
the two new routes).

## Teacher-pilot usage analytics wired (PostHog), 2026-08-17

Asked how to see what tools teachers actually use/visit/keep during
testing. Hotjar and Microsoft Clarity were both ruled out before writing
any code: they inject into a DOM, so they'd only ever see the Expo
**web** build, not the native app most pilot teachers would install.
PostHog's SDK covers native and web with one integration, so it's the
one that can actually see the whole pilot, not just the web slice of it.

New `services/analytics.ts` wraps `posthog-react-native` behind
`initAnalytics`/`trackEvent`/`trackScreen`/`identifyUser`/
`resetAnalyticsIdentity`. Disabled by default — with no
`EXPO_PUBLIC_POSTHOG_API_KEY` every call is a silent no-op, same shape as
Unsplash's "no server key" path a day earlier. The client loads lazily
inside the functions that use it, never at module scope: `posthog-react-native`
pulls in `react-native`, and importing it at module scope here would have
made every file that imports this module (`workspace.ts`, `share.ts`,
`exportPptx.ts`) untestable under plain `node --test` — the exact trap
the OpenAI client hit (see "Things that have bitten before" at the top
of this file).

Instrumented at existing shared choke points rather than per-screen, so
one fix covers every tool:
- **Screens visited** — `app/_layout.tsx` fires `trackScreen(pathname)`
  on every route change, one line covering the entire app, not just AI
  tools.
- **Tools opened** — `runToolAction` (Tools tab) and `handleToolSelect`
  (chat's `+` menu) are the only two places a tool ever gets navigated
  to; both now fire `tool_opened` with `{ toolId, source }`.
- **Materials kept** — `saveItem` (`workspace.ts`) is what every tool's
  Save button calls; fires `material_saved` once, keyed by
  `payload.type`, regardless of which storage path (API vs local
  fallback) actually lands it.
- **Materials exported** — `exportAsPDF`/`exportAsWord` (`share.ts`) and
  `exportDeckAsPptx` (`exportPptx.ts`) fire `material_exported` keyed by
  format.
- **Identity** — `identifyUser(user.id, { role })` on sign-in,
  `resetAnalyticsIdentity()` on sign-out, both gated on the same
  `authChanged`/`finishedBoot` transition the existing navigation effect
  already computes. No email/name sent, by design.

"Liked" has no dedicated event yet — there's no thumbs-up affordance in
the product to hang it on. Save/export/re-open are the proxy signals
this pass gives you; a real like/dislike signal would need a UI
decision first, not just an analytics one.

Verified live: registered a real user against local Postgres, confirmed
`pnpm run typecheck` and the full mobile suite (427 tests, unchanged —
none of the four touched files are in the test net) stay clean, then
loaded the app in a real browser with analytics unconfigured (this
repo's actual default `.env` state) and navigated multiple screens with
zero console errors — the property that matters most: the app behaves
identically whether or not a PostHog key is ever set. No PostHog project
was available in this sandbox to verify an event actually lands
server-side; that requires a real `EXPO_PUBLIC_POSTHOG_API_KEY` (free
tier, 1M events/month) in a deployed environment.

## Slides Maker: auto-fetched Unsplash photo per deck, 2026-08-17

Every generated deck was text-only slide after text-only slide. Slides
Maker now fetches one topic-relevant photo per deck and drops it in as a
slide right after the title, using the existing `type: 'media'` slide
shape (`buildMediaSlide`/`MediaView`) that Class Mode's manually-pasted
image slides already render live — nothing new to build for the
projector view.

The Unsplash access key is server-side only: `GET /api/media/unsplash-photo`
(new `media.ts`, mounted and auth-gated the same way as `/chat`,
`/generate`, `/verify` — one shared key across every teacher, so an
unauthenticated caller can't burn the whole app's rate limit) calls
Unsplash's Search Photos endpoint, pings `download_location` per their
API guidelines when a result is used, and always answers `200
{ photo: null }` — never an error — when the key is unset, the query is
empty, or nothing relevant comes back. The mobile client
(`services/unsplashImage.ts`) never throws either. `slides.tsx` fires the
lookup after the deck is already on screen (same non-blocking,
identity-guarded pattern the verify-example pass already uses — a stale
fetch landing after the teacher regenerated is a silent no-op, not a
stomp), and `classMedia.ts` gained `insertImageAfterTitle` to splice the
result in and renumber.

PDF (`deckSlidesHtml.ts`) and PPTX (`exportPptx.ts`) export previously had
no handling for `type: 'media'` slides at all — they'd have fallen
through to the generic text-only renderer and silently dropped the image
from anything exported. Both gained an image-slide renderer (`<img>` for
HTML, `addImage` for pptxgenjs) so the photo survives into both exports,
not just the live projector.

Verified live: registered a real test user against local Postgres,
confirmed `GET /api/media/unsplash-photo` returns `401` unauthenticated
and `200 { photo: null }` authenticated-but-unconfigured (this repo's
actual default `.env` state — no `UNSPLASH_ACCESS_KEY` set) — the
critical property is that a deck generates and displays identically
whether or not the key is ever configured. No real Unsplash key was
available in this sandbox to verify the photo-present path live; that
path is covered by unit tests instead — `insertImageAfterTitle`'s
splicing/renumbering, and the PDF exporter's `<img>` rendering for an
image media slide (with a video media slide pinned to keep falling back
to text, since there's no `<img>` to render there). The PPTX exporter's
`addImage` call has no dedicated test — same as `exportPptx.ts`'s
existing coverage gap, since pptxgenjs isn't mocked in this suite — and
was checked by typecheck + code review only. 427 mobile tests (417
passing + 10 pre-existing skips) / 86 api-server tests passing, monorepo
typecheck clean.

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

## Math rendering extended to worksheet, quiz, lesson plan, and chat, 2026-08-16

The math renderer built for the projector (`mathRender.ts`/`MathText`)
was wired into exactly two places: the presenter and Slides Maker's PDF
export. Everywhere else a teacher sees generated content — worksheet
questions, quiz options/answers, lesson-plan sections, chat replies —
still showed `x^2` and `3/4` as typed-looking flat strings.

New `components/ui/MathParagraph.tsx` is a drop-in replacement for
`<Text style={style}>{text}</Text>`: splits on `\n` (a no-op for
single-line content) and renders each line through the same
MathText/`hasRenderableMath` decision the projector already uses — a
line the parser doesn't recognise renders exactly as the plain `Text`
did, so prose is never at risk. Its `alignItems` wrapper keeps a bare
equation with no Arabic lead-in on the correct margin regardless of
MathText's own per-line reading-order heuristic, which only governs
word order *within* a mixed prose+equation line.

One shared fix does most of the work: `EditableText`'s read branch in
`Editable.tsx` is what quiz.tsx (question text, options, answers,
explanations), `LessonPlanView.tsx`'s editable path (used by both
`lesson-plan.tsx` and chat's lesson-plan bubbles), and any other
`EditableText` consumer all render through — fixing it once fixed all
of them. `LessonPlanView.tsx`'s read-only fallback (reachable if a
future caller omits `onEdit`) got the same treatment for consistency.
`worksheet.tsx` has no shared component to lean on, so its question
text, options, and answer-key entries were edited directly. Chat's
generic message-bubble loop (`iqra.tsx`) already splits on `\n` with
lightweight bold/bullet markdown handling — the plain-line fallback
and math-only bullets (no `**bold**` spans) now route through
`MathParagraph`; a bullet mixing bold and math falls back to the
existing inline-text rendering, since MathText's View-based layout
can't nest inside a `Text` run the way inline bold spans do.

Verified live: worksheet's answer key showed a real overlined radical
(`x = 2 ± √3`) where the string was a bare `√3` — definitive proof the
renderer is active, not just theoretically wired, since a plain-Unicode
`√` has no built-in vinculum. Chat walked through a full multi-turn
"explain الاشتقاق" exchange (clarifying questions, subject picker,
final explanation with `d/dx(xⁿ) = nxⁿ⁻¹`-style bullets) with zero
console errors and no visual regressions. Most existing curriculum and
mock-generated content already uses pre-formatted Unicode superscripts
(`²`, `³`, `ⁿ`) rather than caret notation, so the renderer stays
correctly inactive there — its clearest wins are fractions, roots, and
anywhere `^`-notation genuinely appears (e.g. `prettifySymPy`'d
verifier output). 423 mobile tests (413 passing + 10 pre-existing
skips, unchanged — `MathParagraph` has no dedicated test file, same as
`MathText`; verified live instead), monorepo typecheck clean.

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

## Exported PDFs were laid out left-to-right, 2026-08-20

Reported from a print preview of an Arabic quiz: option letters sat on the
wrong side of their own options, and every option carried two markers —
`أ) الوقت A.`

Three separate faults, all in `services/share.ts`:

1. **The same `row-reverse` cancellation as the web-RTL bug above, inverted.**
   That incident was per-component flips assuming a direction-neutral document.
   The export HTML is the one place that *is* direction-aware — `htmlBase`
   writes `<html dir="rtl">` and `direction: rtl` on body — and it *also* wrote
   `flex-direction: row-reverse`. Under `direction: rtl`, plain `row` already
   runs right-to-left; reversing it moves main-start back to the left edge, so
   `.q-option`, `.answer-row` and `.school-header` packed against the left of a
   right-aligned page. Rows are plain `row` now. **The rule cuts both ways: in
   this repo, `row-reverse` is right in React Native components and wrong in
   exported HTML.**
2. **Options were lettered `String.fromCharCode(65 + i)`** — A/B/C/D on an
   Arabic paper, at five call sites. Now `أ/ب/ج/د` in abjad order (not the
   alphabetical `أ ب ت ث`, which is the tell that a list was lettered by
   someone who does not read the language).
3. **The model letters options itself.** The mock generator returns bare option
   text, so this never showed in `DEMO_MODE` — it needs live AI to reproduce,
   which is why a printed paper was the first sighting. Markers are stripped on
   receipt (`normalizeQuestionOptions`) so exactly one marker exists, added by
   the renderer.

New `services/optionLabels.ts` + 27 tests. Marker punctuation is `.`, never
`)` — a closing paren is bidi-mirrored inside an RTL run and prints as `(`.

Answer keys are now lettered from the option's **position**, not from whatever
marker the model wrote into `correctAnswer`: since options are re-lettered by
index, a model that emitted its choices out of order previously left a key
pointing at the wrong line. Fails honest — an answer matching no option prints
verbatim rather than being relabelled to fit.

Also renamed **`أداة تقييم` → `اختبار قصير`**. It sat next to `التقييمات` under
بعد الحصة and both read as "assessment", but they are unrelated systems: the
first generates a paper artifact and stores nothing, the second is the
DB-backed subsystem with students, attempts and marks. The quiz tool no longer
contains the word تقييم at all. Two deliberate exceptions: the intent regex in
`teachingAssistant.ts` still matches `أداة تقييم` so teachers who type the old
name are still understood, and `التقييمات` is untouched (route, API, schema and
this file all name it).

Verified by rendering `buildQuizHTML`'s real output in Chromium, before and
after, against the reported quiz. ~~Not verifiable by unit test.~~
**Verifiable since 2026-08-22** — the builders moved to `exportHtml.ts`, which
imports no React Native, and `exportHtml.test.ts` now asserts the RTL rule
across all nine of them. See "The export HTML is testable now" below.

## The export HTML is testable now, 2026-08-22

The RTL bug above shipped because nothing could see the markup. `share.ts`
imports `react-native` at module scope for Platform/Share, so `node:test`
cannot parse anything defined beside it — and every document builder lived in
that file. The fix was verified by rendering in Chromium by hand, which is not
a regression test.

Split along the line that was already there: pure builders out, IO stays.

| module | what | testable |
| --- | --- | --- |
| `exportHtml.ts` | 9 HTML builders + `htmlBase`/`esc` | yes |
| `exportText.ts` | 5 plain-text formatters | yes |
| `share.ts` | clipboard, share sheet, expo-print, docx | no, and does not need to be |

`share.ts` re-exports both, so **no caller changed** — verified by comparing
the exported symbol set against `main`: 19 before, 19 after, none lost, none
added.

`exportHtml.test.ts` (12 tests) asserts what actually broke, across every
builder rather than the one that was reported:

- **no `row-reverse` in any Arabic document** — the exact cancellation that put
  option letters on the wrong side. This is the guard that would have caught it.
- `dir="rtl"` on `<html>` for all nine builders
- abjad option letters in Arabic, A/B/C/D in English, never a latin marker on
  an Arabic paper
- the model's own baked-in marker stripped rather than doubled
- the answer key lettered to match the printed option
- question text escaped, not interpolated raw

One thing the tests corrected in me rather than in the code: the slide
builders declare direction via `<html dir>` only, while the page builders also
set `direction` in body CSS. Both are right — `direction` inherits — so the
assertion checks `dir` on the root and not how each builder spells it.

**Still untested:** `share.ts` itself (the IO), and `iqra.tsx`.

`iqra.tsx` has no coverage of any kind and cannot get any — there is no React
renderer in the repo, no `@testing-library`, and no test imports anything from
`app/`. Adding that stack is a real decision nobody has made. So the pattern
used instead, twice now, is to lift the decision out of the component and test
that: `shouldAskWhichLesson` in `kbSuggestion.ts` (2026-08-22) is the "did you
mean?" branch's conditions as a pure function, covering the cases where being
wrong is expensive in both directions — asking when the teacher was already
clear, and staying silent when an artifact is about to be built on a guess.
The chip *rendering* is still unexercised; only the decision to show it is.

## KB retrieval was a cliff — added a "did you mean?" tier, 2026-08-20

`isConfidentKbHit` was the only gate on grounding, so a top hit scoring 9
was discarded exactly like a top hit scoring 0. The system had a good
candidate in hand, threw it away, and asked the teacher to supply the lesson
from scratch — which is what made chat feel like it demanded a lesson it
could have guessed.

Retrieval now resolves three ways instead of two (`services/kbSuggestion.ts`):

| outcome | when | what the teacher sees |
| --- | --- | --- |
| `confident` | clears `KB_CONFIDENT_SCORE` (10) **and** beats the runner-up by 1.2× | nothing — grounds silently, unchanged |
| `ambiguous` | clears `KB_SUGGEST_SCORE` (5) but not the above | «أيّ درس تقصد؟» + up to 3 lesson chips |
| `none` | below the suggest bar | the existing fallback, unchanged |

`ambiguous` covers two shapes of doubt that get the same question: `weak`
(plausible but under the bar) and `contested` (strong hit, near-equal rival).
The `reason` is carried for tuning — they are different retrieval problems.

**Applied to artifact intent only.** An artifact is where being wrong is
expensive: a weak fuzzy match still produces a full worksheet claiming NCCD
grounding, and the teacher finds out in front of a class. For a teaching
answer a near-miss costs a sentence they can correct next turn, so the
question would cost more than the mistake. Same principle as `verified` —
guess loudly, never silently.

Tapping a chip re-sends the original query with `pinnedLessonId` set, which is
the door the lesson suggestion chips already used. That also empties `ranked`,
so a confirmed pin cannot re-trigger the ask — no loop.

`KB_CONFIDENT_SCORE` and `isConfidentKbHit` **moved** out of
`knowledgeBase.ts` into `kbSuggestion.ts`, which imports only types.
`knowledgeBase.ts` re-exports them, so every existing import path still works.
The point of the move is testability: `knowledgeBase.ts` pulls the curriculum
data, so anything importing it cannot be tested without that dep built —
which is exactly why `kbContext.test.ts` and `kbAmbiguity.test.ts` are among
the 10 suites that abort on a fresh checkout. `kbSuggestion.test.ts` (17
tests) runs anywhere.

**Not done:** the two thresholds are hand-picked, not measured. There is no
corpus of real teacher queries to tune them against, so `KB_SUGGEST_SCORE = 5`
is a guess at where "plausible" starts. If chat starts asking too often, that
constant is the one knob to turn.

## The letter-card routine asked teachers to print something the app can't make, 2026-08-20

The whole-class response routine told teachers to hand out أ ب ج د cards
(`اطبع بطاقات الحروف مرة واحدة وتُعاد في كل حصة`) and projected
`ارفعوا بطاقة الحرف!` on every question slide.

Nothing in the codebase produced those cards. `printables` is declared on
`ActivityOutput`, populated by the generators, and **consumed by nothing** — no
screen renders it, no exporter emits it. So the deck opened by asking for a
prop the teacher had no way to obtain from the app.

Students now hold up fingers instead (إصبع = أ، إصبعان = ب، …), which needs no
prop at all. The technique is unchanged and is the part worth keeping: silent
thinking, a timer, everyone answering at once, and the teacher reading the
spread before revealing — `توزيع الإجابات نفسه هو التقييم`. Only the
dependency on a printed card is gone. Mini whiteboards stay as an optional
alternative in the materials list.

Touched the projected banner, both intro rules slides (solo and team),
materials, teacher prep, the Class Challenge how-it-works copy, and
`printables` for quick-check (now `[]`). Bingo, station, exit-ticket and
challenge cards are untouched — those are genuinely card-based activities.

**Superseded 2026-08-23: the signal is a raised hand, not fingers.** Product
call — the projected banner now reads `ارفع يدك للإجابة!` and every rules
slide, materials list and teacher tip says the same. What this gives up is
real: fingers encoded *which* option each student picked, so the teacher read
the distribution in one glance. A raised hand only says «I have an answer», so
reading the spread per option now costs a poll. The prop-free property is
kept. Reverse by restoring the (إصبع = أ، إصبعان = ب) mapping in the rules
slides only — the banner wording was the part that was asked for.

**`printables` is still dead data everywhere else.** The remaining entries name
props no export produces. Either build the printables exporter or stop
populating the field; a list a teacher cannot act on is worse than no list.

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
  - **You can now ask:** `pnpm --filter @workspace/db run verify-schema` checks
    every table in `lib/db/src/schema` with `to_regclass` and names the feature
    each missing one takes down. Read-only, exits non-zero when anything is
    absent. It does not fix the deploy gap — it makes the gap visible, which is
    the part that was missing when 14 of 24 tables were absent from production.
  - **It cuts the other way too, and that is the sharper edge.** `push`
    reconciles the live database to *whatever schema files are checked out*, so
    a stale checkout does not fail — it proposes **dropping** every table added
    since. On 2026-08-22 a `push` from a checkout predating 2026-08-11 offered
    to delete 8 tables including `students`, `evaluations` and
    `evaluation_questions` with 54 rows in it. It was correctly aborted at the
    prompt. Read the data-loss list, every time; "yes" is not a formality here.
  - **Run `verify-schema` before `push`, always.** It is read-only and answers
    the only question that matters first: what does this database have, and
    what does this checkout think it should have. On the stale checkout it
    would have shown 8 tables the checkout did not know about, before anything
    was at risk.
  - **`push.mjs` deletes `process.env.DATABASE_URL` and reloads the repo-root
    `.env`.** A shell variable is therefore ignored — the `.env` file is the
    only thing that decides which database you are about to modify, and local
    and production `.env` values look nothing alike but produce identical
    console output apart from one line. `verify-schema` prints the host it
    checked (`Schema check against …`) as its first line. Read it.
  - **Production verified 24/24 on 2026-08-22**, via the same `to_regclass`
    check run in the Neon SQL console. The 2026-08-19 outage was fixed that
    same afternoon — Neon's query history shows "find missing tables" at
    1:36pm, a schema migration at 1:41pm, and a re-check at 1:42pm. Both this
    file and CLAUDE.md went on asserting the outage for three days afterwards,
    because the fix was never written down. **The process gap is real and
    still open; that particular outage is not.**
  - **What the check does not prove:** `to_regclass` asks whether a table
    *name* exists. A table with a stale column set — a migration that added
    the table but not a later column — still reports `ok`. Column-level drift
    needs a different check, which does not exist yet.
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

## Warm-up slides projected the teacher's stage directions, 2026-08-23

The generated intro is written *at the teacher* — `ابدأ بطرح السؤال: "…" سجّل
إجابات الطلاب على السبورة` — and `lessonSlides.ts` projected it verbatim on the
class screen, so the room read what the teacher was about to do instead of the
question itself. `splitWarmup` now projects the quoted question alone and moves
the full instruction into the slide's teacher notes. No quoted question means
nothing to lift out and the text projects as before, so an AI-generated intro
in another shape degrades to the old behaviour rather than to a blank slide.
