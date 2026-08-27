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
- Mobile test suite: 981 tests, 0 failures, 10 skipped (re-counted 2026-08-26
  on an installed workspace; 975, 971 and 962 earlier the same day/day before,
  925, 909, 900, 894,
  888, 865 and 855
  earlier the same day, 725 on 2026-08-23, 723 on 2026-08-22, the 480 here was
  stale before that, and the 376 before it).
  The number moves with almost every merge — re-count rather than cite it.
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
  9 lessons, and 3 of those lessons still have none), chemistry S2 19 (2 units /
  8 lessons, the 2 تجربة استهلالية carrying none — the book prints none for labs).
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
- **Every Grade 10 source PDF is now inventoried** in
  `lib/curriculum/src/data/g10_sources.json`, read through
  `lib/curriculum/src/sources.ts` (`usableSources()`, `pendingSources()`,
  `conflicts()`) and `lib/curriculum/src/bank.ts` (`bankItems()`,
  `examPapers()`, `usePolicy()`). It records, per file, its Drive id, what kind
  of document it is, whether NCCD or a named teacher wrote it, whether anything
  has been extracted from it, and — since 2026-08-25 — its curriculum scope,
  author and search terms. Written from a Drive listing taken 2026-08-24.
  **It is load-bearing as of 2026-08-25**: the app's support-resource search is
  a derived view of it, so a stale entry now costs a teacher a wrong document,
  not just a wrong answer to "what do we have".
  `scripts/verify-curriculum.ts` only scans
  `iqra_curriculum_*.json`, since the manifest lives in the same folder and has
  no units — without that filter it reported two structural errors and exited
  non-zero.
  - What it surfaced immediately: chemistry S1 **and** S2 each had two files
    claiming to be the same student book with different byte counts (an
    Arabic-titled and an English-titled copy). **Resolved 2026-08-24 — not an
    edition split:** each pair has an identical page count (76 / 84) and an
    identical PDF `CreationDate`; the Arabic-titled copies are iLovePDF
    re-compressions of the Adobe originals. The originals are canonical
    because these books are extracted from page renders and the compressed
    copies have downsampled images. Six teacher-made files are exact
    duplicates. The financial-literacy split is the one real conflict left.
  - Chemistry unit structure, read off the two student books: S1 carries units
    1–3 (بنية الذرة وتركيبها / التوزيع الإلكتروني والدورية / المركبات والروابط
    الكيميائية) with two lessons each; S2 carries units 4–5 (التفاعلات
    والحسابات الكيميائية / الطاقة الكيميائية) with three lessons each. Unit
    numbering runs continuously across the two semesters, so they are one
    course. Each unit also has a تجربة استهلالية, an إثراء وتوسع and a
    مراجعة — which is where the catalog's "9 lessons" for S1 comes from,
    against the 6 taught lessons the book names.
  - The Drive tree is mirrored on disk (`localRoot` in the manifest), so
    extraction reads local files rather than re-downloading ~300MB.
  - Teacher-made material is a large share of the Drive (worksheets, answer
    keys, دوسيات, past papers by named Jordanian teachers). `authority:
    'teacher'` marks it: usable to inform generation, not to be reproduced.
- Chemistry S2 is NCCD-sourced as of 2026-08-23 (2 units / 8 lessons, from the
  student book, ISBN 978-9923-41-284-8). It replaced two stubs that named unit 4
  «الوحدة الرابعة» and unit 5 «التفاعلات الكيميائية» — the latter is unit *4*'s
  subject; the book's unit 5 is «الطاقة الكيميائية».
  - **Enriched from the S2 teacher guide on 2026-08-24**: عدد الحصص per lesson
    (2–4, nine per unit — `periods` was null everywhere), per-unit
    `prior_knowledge` tagged with the grade each outcome was taught in, and the
    activities the guide's مخطط الوحدة names (guide pages 7A / 41A).
  - One correction from the same pass: the file's `known_gaps` said the S2 book
    prints no «فكرة عامة» for a unit, so the أتأمل الصورة box was stored as the
    unit's general idea. The book does print one, on the page facing each unit
    opener (book pages 8 and 42); `general_idea_ar` now carries it, and
    `meta.corrections_note` records the swap.
  - `services/__tests__/chemSem2Catalog.test.ts` asserts the placeholders are
    gone and the periods are present, against KB_UNITS/KB_LESSONS rather than
    the JSON, so the wiring is covered and not just the data.
- Chemistry S1's curriculum browser now serves its NCCD JSON too (2026-08-23).
  It previously showed 3 units / 3 lessons against the book's 3 / 9, mislabelled
  unit 2 as «الجدول الدوري وخواص العناصر» (the book says «التوزيع الإلكتروني
  والدورية»), and rendered unit 2 as an empty unit with zero lessons.
  - The swap would have deleted the last hand-authored Bloom's levels in the
    active catalog, since every NCCD builder hardcodes `'Understand'`.
    `catalog.ts::_mergeAuthoredOutcomes` carries them over by
    diacritics-insensitive title match, remapping `lessonId` onto the NCCD
    lesson and **appending** to the book's own نتاجات rather than replacing
    them. 5 authored outcomes survive, spanning Understand + Apply.
  - One casualty: «الرابطة الأيونية والتساهمية» has no NCCD counterpart — the
    book splits that material into «الروابط الكيميائية وأنواعها» and «الصيغ
    الكيميائية وخصائص المركبات» — so its Apply outcome is gone. Exported as
    `UNMATCHED_AUTHORED_LESSON_TITLES` and pinned by a test, so the list can
    shrink but never grow silently.
- Chemistry is thinner than "math + chemistry first" implies: 3 + 2 units /
  9 + 8 lessons against math's 4 / 18 per semester.
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

## Production has all 25 tables, and something checks it now, 2026-08-25

The `DATABASE_URL` secret is set and the schema monitor has run against the real
Neon database. **25 of 25 tables present** on
`ep-bold-bar-asvxvxjr-pooler…eu-central-1` — every file `ok`, evaluations
included. That subsystem is the one that could not work at all on 2026-08-19,
and it is the one this check exists to notice.

The count moved from the 24 recorded on 2026-08-22 because `aiGenerations` was
added since; it is present, so nothing is behind.

The monitor now runs on its own at 06:00 UTC, on demand from the Actions tab,
and whenever a schema change reaches `main`. The merge-time guard has also been
seen taking its **active** path on GitHub, not just its skip path — «Schema
files changed: lib/db/src/schema/index.ts» followed by «Acknowledged in the PR
body.» The one branch still unexercised in CI is the outright failure (schema
touched, no marker); that is covered by local tests, and the first real schema
PR is its live test.

**One thing to know before upgrading `pg`.** The run prints a deprecation
warning: `sslmode=require` currently behaves as `verify-full`, and in
pg-connection-string v3 / pg v9 it will adopt weaker libpq semantics. The
production URL says `require`. It changes nothing today — TLS is on either way —
but the same URL feeds the API, so that upgrade would quietly relax certificate
verification there too, not just in this script. The fix, whenever `pg` is
upgraded deliberately, is `sslmode=verify-full` in the Render env var.

### CLAUDE.md had unresolved conflict markers on main

Found while editing it: `<<<<<<< HEAD` / `=======` / `>>>>>>> origin/main` were
committed into the Commands block, straddling two different mobile test counts
(962 and 925). A merge resolution had been half-done and the markers shipped.
Resolved by **running the suite** rather than picking a side: 962 tests, 952
passing, 10 skipped. A `git grep` over the repo confirms no other tracked file
carries stray markers.

## Something finally asks whether the schema was pushed, 2026-08-25

**First, a correction I made in conversation and am writing down so it does not
spread: deploying is not manual.** `render.yaml` sets no `autoDeploy: false`, so
a push to `main` deploys on its own; the only wait is build time. (Worth one
glance at the Render dashboard, which can override the blueprint — this sandbox
cannot reach onrender.com to confirm.)

**What is manual is the schema push, and that stays manual on purpose.**
`drizzle-kit push` resolves drift by dropping columns, which is why
`render.yaml` deliberately keeps it out of `buildCommand`. That decision is
sound. What made it dangerous is that nothing ever asked whether the push had
happened — on 2026-08-19 that ran until 14 of 24 tables were missing from
production and the evaluations subsystem had never once worked there. It was
found only because somebody happened to look.

Two checks now, covering the two different ways it bites:

- **At merge time** (`ci.yml`, job `schema push acknowledged`): a PR touching
  `lib/db/src/schema` fails until its description says `schema-push: done` or
  `schema-push: n/a`. It cannot verify you ran the push; it makes the decision
  explicit rather than implicit, which is the whole difference between that
  outage and a chore. The diff uses `base...head` so commits that landed on
  main since the branch started are not counted as this PR's.
- **Afterwards** (`schema-check.yml`): `verify-schema` against the production
  DATABASE_URL daily at 06:00 UTC — before the Jordan school day — plus on
  demand and whenever a schema change reaches main. This catches the state
  whatever caused it: a hand-dropped table, a push against the wrong URL, a
  backup restored from before a migration. Needs a `DATABASE_URL` repository
  secret; **without it the job reports "not configured" and stops** rather than
  failing every night or, worse, implying it checked.

**`verify-schema` grew the two things a monitor needs.** `--from-env` reads the
URL from the environment (a runner has no `.env`, and writing one just to hold a
secret puts the credential in a file for no reason) — opt-in, so a stale local
shell value can never silently reach a check that reports which database it
looked at. And "could not check" is now exit **2**, distinct from exit 1's
"checked, tables missing": unhandled, a refused connection exits non-zero with a
stack trace, which to a nightly job is indistinguishable from the gap it exists
to find. A flaky night must not read as an outage, and an outage must not be
dismissed as a flaky night.

### Verified against a real database, not just the failure paths

Ran a scratch Postgres 16 and drove all four states: empty database → 25 tables
missing, exit 1; `push` → «Every declared table exists», exit 0; then
`DROP TABLE evaluations CASCADE` — the actual 2026-08-19 shape — → `MISS
evaluations.ts 1/2 evaluation authoring (التقييمات)`, exit 1. Unreachable host
and absent URL both exit 2 with one clear line. The PR-body matcher was tested
too: it accepts the marker at line start in any case, refuses a mid-line
mention, and does not execute backticks in a PR body.

**Still not automated, deliberately:** nothing runs `push` for you, and
`push.mjs` still reads only the repo-root `.env` — a destructive command taking
its target from an ambient variable is the foot-gun the original decision was
avoiding.

## The book's own diagrams reach a lesson now, 2026-08-25

Asked why a worksheet on «أوتار الدائرة» carries no diagram when the book's own
exercises cannot be answered without one, the answer was three faults stacked,
not one missing feature. Two are fixed here.

**The extractor could not see those figures.** `axis_seed` needs a long
horizontal and a long vertical that cross, and `figures_in` skipped any page
without one. That finds coordinate graphs and nothing else. Page 35 of the
maths S1 book carries 108 drawing paths and 109 curve operations and returned
`None`; the circle unit extracted zero figures across four lessons. Circles are
Bézier curves, so `curve_seeds` clusters those instead, filtered two ways —
both found by rendering crops and looking at them, neither visible in a count:

- Rounded panels are curves too. The «رموز رياضية» callout seeds as happily as
  a circle and is only 120pt wide, so width caps miss it. Text coverage
  separates them cleanly: real figures 1-12%, every panel 43-52%.
- One page prints four or five diagrams down the margin. `figures_in` yielded
  one per page, so the right seed alone would still have merged them.

Cluster growth is now scoped to axis seeds — a curve seed is already the whole
diagram, and growing it chained out through the panel border. That alone took
the circle lesson from 14 clean crops in 18 to 22 in 25.

**63 figures → 379.** math-s1 18 → 176, math-s2 40 → 135, chem-s1 5 → 68.

**The join was the other half, and the bigger one.** Extraction alone changed
lesson coverage not at all: still 21 of 64, still zero on the circle lesson.
`figure-lesson-map.json` had 22 entries because it was hand-curated against the
old extraction — the circle lessons had never had a figure to map, so they had
no entry. 38 book lessons now carry figures; 16 entries added, each a
translation check between the book's English opener title and the curriculum's
Arabic one, not a string overlap. `math-s1|1|1` stays `null` on purpose: the
book opens unit 1 with a lesson the curriculum does not carry, which is why
every later unit-1 lesson sits one place lower.

**Coverage 21 → 37 of 64 lessons. The circle lesson: 0 → 22 figures.**

The remaining 27 are not a join problem. Ten are financial literacy and eight
are chemistry S2 — books that have never been extracted, one of which is not in
the repo. Seven are `_lab` lessons the book prints no opener for. Two are real
maths lessons where nothing was found.

**Deleting a bad crop now works.** It is the documented review step, but the
index still listed the figure and `gen_book_figure_assets.mjs` emitted a
`require()` for the missing file — so following the instruction broke the
bundle. The generator skips absent files, and a deleted crop must lose its
`index.json` entry too, or `figuresForLesson` and the asset map disagree about
what a lesson has.

**Only one lesson has had the human pass.** I reviewed the circle lesson's 25
crops on a contact sheet and deleted three that grabbed page furniture — a
lesson-number badge, a margin rule, an «أتذكّر» callout. The other ~355 have
not been looked at, and the script's "about one crop in five absorbs an
adjacent exercise block" warning still stands. They are reachable from the
slides path, so an unreviewed bad crop ships.

**Still not done, and the third fault:** nothing renders these outside slides.
Lesson plans, worksheets and exams do not touch `figuresForLesson`, and the
system prompt still tells the model never to reference a figure unless the
question text states its equations — a rule written for graphs that silently
puts every circle-geometry question out of scope. Per-question binding also
needs care: the model cannot see these images, so letting it choose which
diagram belongs to which question is the fabrication failure the filename
fence closed earlier today, in a new place.

Two tests pinned numbers this moves; both now assert the property instead. The
asset map must equal exactly what the lessons can reach, recomputed rather than
counted, and the empty-lesson example moved to financial literacy — structurally
empty rather than incidentally so.

959 mobile tests pass; typecheck clean.

## A worksheet can show the book's own diagram now, without a model choosing which, 2026-08-26

The book figures joined to lessons yesterday reached nothing but slides. A
worksheet, quiz, lesson plan or activity that says «انظر الشكل المجاور» —
because that is how the book itself writes such a question — printed with no
figure anywhere on the page.

The straightforward fix, letting the model pick which of a lesson's figures
goes with which question, was rejected on purpose. **The model cannot see
these images.** It only knows a filename and a page number, so choosing
between them would be a guess dressed as a citation — the same class of
fabrication `demoExtractFromName`'s fence exists to stop, in a new place.

What ships instead is lesson-level, not per-question: every export now carries
an optional "من الكتاب المدرسي" appendix, printed once, after the content, with
the lesson's own figures — up to `EXPORT_FIGURE_MAX` (6) — each captioned with
its page. A teacher reading «انظر الشكل المجاور» on the paper turns the page
and matches it by eye, exactly as they would with the printed book open beside
them. Verified against the actual circle-chords lesson: rendered
`buildWorksheetHTML` with four real figures resolved from
`math-s1-student-book`, screenshotted the HTML with headless Chromium, and
read it — the diagrams, their page citations, and the "no page chosen for you"
note all render correctly, after the answer key, never inside a question.

`figuresSectionHTML` is one function, called from all four document builders
(`buildWorksheetHTML`, `buildQuizHTML`, `buildLessonPlanHTML`,
`buildActivityHTML`) with self-contained inline styles rather than the
`.section` classes `htmlBase` defines — `buildActivityHTML` builds its own
document with no such classes, so a class-based version would have rendered
unstyled there. `bookFigureRefsForLesson()` in `bookFigureUri.ts` is the one
place that turns `figuresForLesson()` into what the builders take, the same
three-step lookup `lessonSlides.ts` already did inline for slides, pulled out
so four callers do not grow four copies.

Scoped deliberately narrow. Per-question figure binding is still not done, and
still needs either a vision model or per-exercise extraction metadata neither
of which exists. The `FIGURE_RULE_AR`/`EN` system-prompt rule — never
reference a figure unless the question states its equations — is untouched;
it was written for graphs and still silently excludes every circle-geometry
question a live model would write. Word export carries no images at all: it
goes through `docx` paragraphs with no image support, a pre-existing
limitation this does not touch.

971 mobile tests pass; typecheck clean. New tests were checked against two
regressions, not just written to pass: removing the cap turns "caps at
EXPORT_FIGURE_MAX" red, and moving the appendix before the questions turns
"never attaches a figure to a specific question" red.

## A second grade can be added without a collision, 2026-08-25

Every curriculum id omits the grade. A unit is `kbu-math-s1-nccd-u2`, a lesson
`kbl-math-s1-nccd-u2_l1`, an objective `o-nccd-s1-u2_l1-0`, a bank tag `s1-u2`.
Grade 9 maths semester 1 unit 2 wants **the identical string for all four**, and
nothing would have noticed: there was no uniqueness check anywhere in the
repo, so a second grade would have silently overwritten the first in every map
keyed by unit id. The first symptom would have been a teacher seeing another
year's lesson.

**The grade was never missing from the data.** Every unit reaches one through
`book.gradeId` — 17 of 17, no gaps — and the catalog already spans two grades,
`grade-10` and a `grade-8` science stub. It was missing only from the strings,
because each of the five catalog modules interpolated its own prefix inline
(`` `kbu-math-s1-nccd-${jsonUnitId}` ``, five times) and then repeated that
prefix as a string literal wherever an id had to be parsed apart.

**What changed.** `lib/curriculum/src/curriculumIds.ts` is now the only thing
that decides what an id looks like. The five catalogs call it. `grade-10` gets
the historical form and every other grade gets an explicit `g9-` segment —
which *is* an implicit default, and the difference from before is that it now
lives in one documented function with a test on it rather than in five files as
an unwritten assumption.

**Grade 10's ids did not move — not one byte.** `evaluations.unitId`,
`evaluations.lessonId`, `evaluations.objectiveIds` and
`evaluation_questions.objectiveId` are free-text Postgres columns holding these
exact strings, so a rename is a migration over live student work. Verified by
dumping all 17 unit, 64 lesson and 196 objective ids before and after and
diffing: identical. The new test pins them **literally** rather than building
them with the same helpers the code uses — a test that recomputed them would
agree with any rename.

**Three copies of one regex became one.** `bankTagsForUnit` in `bank.ts`, the
API server's `UNIT_ID` in `grounding.ts`, and the app's `nccdUnitId` in
`kbContext.ts` each carried `/^kbu-(math|chem|finlit)-s[12]-nccd-u\d+$/`.
Adding a segment to a pattern held in three places is two chances to update only
two of them. All three now call `isNccdUnitId`.

**The guard is the deliverable**, not the refactor.
`src/__tests__/curriculumIds.test.ts` asserts global id uniqueness, that a
synthetic Grade 9 catalog over the same unit numbering collides with nothing,
and that Grade 10's ids are what they always were. Verified it fails on both
regressions it exists for: **2 of 14 red** when a Grade 9 id is built without
its grade segment, **4 of 14 red** when a Grade 10 id is quietly renamed.

**One plan item was dropped after checking it.** The plan said to "open the
subject union" — `CurriculumSource['subject']` is `'math' | 'chemistry' |
'financial-literacy'`. It turns out to be self-guarding: three exhaustive
`Record<CurriculumSource['subject'], …>` maps mean adding a subject is a
compile-error trail, not a silent gap. And `APP_SUBJECTS` in
`mathSupportResources.ts` is a deliberate hold-back with its reason written
next to it (the unresolved financial-literacy edition conflict), not an
oversight. Widening either would have removed a working safeguard.

**Narrower than it was, and still not fixed here.** `isMathContext`
(`services/ai/mathPractice.ts:71`) concatenates the subject name with the topic
and lesson text and regex-matches the lot — `متجه|دائر|مثلث|…`. "The tools carry
the lesson's subject too" (above, landed while this was in review) fixed the
half that mattered most: the screens now receive the real `subjectIdx` instead
of defaulting to Grade 10 Mathematics, so the right subject name reaches the
blob. What it does not change is that the *topic* half still votes: a physics
lesson correctly labelled `Physics` but mentioning «متجه» still matches. So this
is no longer "every chat-launched tool thinks it is maths" — it is a narrower
false positive that will start mattering when a second science subject exists.
Its own change.

83 curriculum / 962 mobile / 262 api-server tests pass; typecheck clean;
`verify-curriculum` 0 errors; grounding coverage unchanged at 45 of 64 lessons.

## The books are in the prompts now, 2026-08-25

The corpus extracted two entries below this one was read by nothing. It is now
read by every generator, server-side.

**How it attaches.** `artifacts/api-server/src/lib/grounding.ts`. Resolve the
unit — an explicit `unitId` from the screen if there is one, else
`resolveUnitByTopic(topic)` — pull up to three ranked pages with
`passagesForUnit({ quotableOnly: true })`, and append them to
`additionalContext` under a cited heading. All eight builders in `prompts.ts`
and all nine classroom-activity prompts already inject `additionalContext`, so
**no prompt builder was edited**; the body is enriched before the builder runs.

It is *not* middleware. `routes/index.ts` mounts `router.use(generateRouter)`
with no path prefix, so `generateRouter.use(mw)` would have become API-wide and
shadowed every router after it — the trap this file and `mountOrder.test.ts`
both already record. Six routes call `withGrounding` explicitly instead.

**Exams too.** `llmGenerator`'s prompt takes an optional `bookExcerpts`, filled
from `groundingForObjectives(objectives)` in `routes/evaluations.ts`. A model
writing multiple-choice distractors from an objective's *title* is guessing at
exactly what `mockGenerator` refused to guess at; now it has the pages. Both
prompt versions bumped (`2026-08-25.2`, `exam-gen-2`).

**Quotable-only, asserted on the output.** A generated worksheet is an export
path. Teacher-authored bank documents are `reference-only`, and
`quotableOnly: true` is one flag away from being forgotten at a new call site,
so the test checks the returned `sourceId`s rather than the argument.

**Citations reach the client.** Every grounded response carries
`sources: [{ sourceId, titleAr, page }]`. Labels come from
`sourceLabel(kind, subject, semester)` in `bank.ts`, never the filename —
`chem-s1-student-book` is stored as «10th grade, alchamy1st semester.pdf»,
which is not a citation to show an Arabic-reading teacher. `kindLabel` moved
out of `mathSupportResources.ts` into `bank.ts` at the same time; the mobile
module re-exports it, so no caller changed.

**Three latent bugs closed on the way.**

- **`buildGeneratorContext` returned `''` when ungrounded** "so callers can
  fall back". All seven callers wrote `... || undefined`, so the ungrounded
  note — the sentence telling the model *not* to claim textbook grounding —
  reached a prompt from none of them. `lesson-plan.tsx` and `worksheet.tsx`
  were fine only because they bypass the function. It now returns the note.
- **Chat sent no curriculum context at all.** `chatArtifacts.ts` passed the
  teacher's attachments and nothing else. Now both, attachments first.
- **The filename fence.** `demoExtractFromName` invented learning objectives,
  formulas, definitions, worked examples and classroom activities out of a
  *filename* whenever the file could not be read — which on mobile is every
  PDF, every Word and PowerPoint file and every image, since there is no OCR —
  and `buildDocumentPromptBlock` put them in the prompt under ordinary
  headings. It was labelled `extractQuality: 'filename'`, and that is precisely
  why it survived: honest label, invented payload, and only the payload reaches
  a model. Same shape as a `verified` flag set from a fallback. Those fields are
  now empty and the block says the file was not read and that nothing may be
  attributed to it. Only the filename and its own words survive.

**The fence had never been testable.** `extract.ts` imports `react-native` at
module scope, which `node:test` cannot parse — so the invented content was
unreachable by any assertion. The pure half is now `documents/extractMeta.ts`,
the same split `exportHtml.ts` got out of `share.ts`, and the new test was
verified to fail (6 of 12) when one invented objective is put back.

83 curriculum / 962 mobile / 262 api-server tests pass; typecheck clean;
`verify-curriculum` 0 errors.

**Still invisible to a teacher.** `DEMO_MODE` is `true` and `AI_LIVE_MODE` is
unset, so no prompt reaches a model. Verified instead by composing the real
prompt directly: for «أوتار الدائرة وأقطارها ومماساتها» the lesson-plan prompt
is 5,838 characters carrying pages 34, 47 and 49 of the maths S1 student book,
with the teacher's own context still first and the JSON contract still last.

## The «عن» fix only fixed what was typed by hand, 2026-08-25

Reported with a screenshot of موادي: a material still titled «خطة درس: عن:
تركيب الاقترانات». The fix earlier today was real but shallow, and the way it
was verified is the lesson.

**The chips send punctuation the strip did not expect.** Every prompt builder —
`promptForTeachingAction` in `iqra.tsx`, `buildLessonSuggestions` in
`lessonCopilot.ts` — writes `«…عن: ${topic}»`, colon included. The rule matched
a bare `عن` token, so `عن:` sailed through. Tapping a chip is the most common
way a material is generated; typing the ask is the rare one. **The UI check
typed it, so it passed while the common path stayed broken.**

**Probing the real strings found four more leaks, not one.** Only 2 of the 10
prompts the product actually sends resolved to a clean topic:

| what the chip sends | what it resolved to |
| --- | --- |
| `أنشئ ورقة عمل صفية عن: X` | `صفية X` |
| `أنشئ واجباً منزلياً عن: X` | `اً منزلياً X` |
| `جهّز اختباراً قصيراً عن: X` | `اً قصيراً X` |
| `اقترح نشاطاً صفياً عن: X` | `اقترح اً صفياً X` |
| `Prepare a full lesson plan about: X` | `full X` |

Three separate causes: Arabic nouns arrive **inflected** (`واجباً`) while the
list held bare stems, so the accusative tail was left behind as its own word;
**qualifiers** describing the artifact (`صفية`, `full`, `in-class`) were not in
the list at all; and `اقترح` / `suggest` were missing from the verbs.

`topicFromQuery` is now a named export with the parts as lists — verbs, nouns,
qualifiers, lead-ins — each Arabic noun allowing the accusative tail, and the
removal repeating until it stops finding anything (one pass leaves `صفية`,
which only becomes a leading word once `ورقة عمل` in front of it is gone).

**The blacklist's own risk is eating a topic**, so the tests assert the ten real
curriculum topics survive bare. One casualty found and reverted: bare `class`
stripped "Class Management" to "Management", so it is deliberately not a
qualifier — `صفية` / `in-class` / `classroom` cover every phrasing the chips
send.

### Verified by tapping the chip, not by typing

The same check as before would have passed again. This one taps «حضّر خطة
الدرس» in the running app: the reply reads «المادة جاهزة لدرس «تركيب
الاقترانات»», the saved material is titled «خطة درس: تركيب الاقترانات», and a
DOM sweep for «عن:» finds it in exactly one place — the user's own bubble
echoing what the chip sent, which is correct.

## The tools carry the lesson's subject too, 2026-08-25

The Start Class fix earlier today closed one door and left its twin open. Chat
navigates to a generator screen with `params: { topic }` and nothing else
(`app/(tabs)/iqra.tsx`, both the tool menu and «اعرض» on a finished resource).
Every generator screen reads `gradeIdx` / `subjectIdx` and falls back to index
0 — **Grade 10 Mathematics** — then generates with
`subjects[subjectIdx].name`, which is exactly the string `isMathContext`
branches on.

So with «تجربة استهلالية: الطيف الذري» pinned in chat, opening شرائح الدرس gave
a 13-slide deck headed «الرياضيات · الصف العاشر» whose two quick-checks were
`y = x²` intersection questions. Same fault as «ابدأ الحصة» had, one screen
over, and it was never chat-specific: the AI-tools hub and `LessonPrepPanel`
have always passed these params. Only chat did not.

`lessonPickerParams(lessonId, lang)` in `services/lessonPrep.ts` turns the
active lesson into `{ gradeIdx, subjectIdx }` route params (it wraps the
existing `lessonPrepPickerIndices`), and both chat navigation sites spread it.
It returns **null** for an unknown or absent lesson rather than a fabricated
`'0'` — with no lesson to speak for, the screen's own default is honest.

**`lesson-flow` could not receive a subject at all.** It read only `topic` and
pinned both indices to `resolvePickerIndex(undefined, …)`, so it was the one
generator no caller could aim, however much the caller knew. It now reads both
params like its six siblings.

### Verified by driving the real UI

Same click path on both builds — تغيير الدرس → الكيمياء → بنية الذرة وتركيبها →
تجربة استهلالية: الطيف الذري → الأدوات → شرائح الدرس → جهّز الشرائح → اعرض على
الشاشة.

- **Before:** URL carries `topic` only; **الرياضيات** selected; 13 slides
  headed «الرياضيات · الصف العاشر»; quick-checks are `y = x²` and
  `y = x² − 4` intersections.
- **After:** URL carries `gradeIdx=0&subjectIdx=1`; **الكيمياء** selected;
  8 slides headed «الكيمياء · الصف العاشر»; the quick-check is the chemistry
  «اشرح بكلماتك» prompt.
- Maths unchanged: the default lesson opens on `subjectIdx=0` and still
  generates its 23-slide composition deck.

**Left alone:** `TopicSelector` still shows its unit/lesson placeholders when a
topic arrives as a prop — the topic is in state and is what generates, but the
dropdowns look empty. That is the pre-existing note in the component's own
comment, not something this touched. `app/ai-tools/classroom/builder.tsx` also
hardcodes both indices; it is reached from the classroom hub rather than from
chat with a lesson, and it has its own on-screen picker, so it is not part of
this path.

## A material's class stopped being a one-way door, 2026-08-25

Reported from the running app: "the add button to classes not changing when
changing the class and i can't uncheck it." Both halves were true.

**The class was asked once and never mentioned again.** `ClassPickerSheet`
opened on first save only (`setClassPromptFor(saved.id)`), showed no current
selection, and had no clear. No generator screen said which class a material had
gone to. And the class screen's attach list is `all.filter(m => !m.classGroupId)`
on purpose — "a material belongs to one class, so showing an attached one would
present a silent move as an add" — so the other class could not claim it either.
The only exit was Remove, inside the old class's الموارد tab. A wrong pick was
effectively permanent.

Now: the sheet takes `selectedClassId` (ticked, and titled «انقل المادة إلى صف
آخر» instead of «لأي صف هذه المادة؟») and an `onClear` that renders a «بلا صف»
row — only when there is a selection to undo. `MaterialClassField` states the
class on the material itself («الصف: العاشر أ» / «غير مرتبطة بصف») and reopens
the sheet on tap.

**The eight copies are down to one.** Every save site repeated the same six
lines — the `classPromptFor` id, the `attachToClass` writer, the toast, the
sheet — which is why a fix here had to be made in eight places to be made at
all. The six generator screens now pass one prop; chat keeps its own handler
because its material is per-message, but drives the same sheet.

**Cards in موادي name their class.** They carried `classGroupId` and showed
nothing, so the only way to learn where a material was filed was to open it.

**`activityType` is translated.** An otherwise Arabic activity had the word
`group` in its meta row, on the Activity screen and in the workspace viewer
both. The forms had the translations; nothing carried them back to the output.
`constants/activityType.ts` holds the map, and falls back to the raw value —
with live AI the generator is not bound to the form's five ids, and echoing what
it said beats calling a jigsaw a group activity.

### Two bugs this pass created and caught

- **The sheet auto-opened on a material that already had a class.** The prompt
  effect gated on `loading`, which starts `false` — so on the render where the
  id first appeared it ran before the fetch effect had set it, saw a `classId`
  still null because nothing had looked yet, and opened. It now waits for the
  read-back on that exact id, and skips an id the screen opened with (editing a
  saved material is not a fresh save).
- **A malformed roster response crashed the workspace list.** `listClasses()`
  returns `data.classes` unchecked, so a body without that key arrives as
  `undefined` and `.find` throws. Found by stubbing the endpoint with a bare
  array while driving the UI. `classNameFor` takes a nullish list now.

### Verified by driving the real UI

Expo web with a stubbed `/auth/me` and roster, and `/api/workspace/*` answering
404 so writes took the local path. On the lesson-plan screen opened at a saved
material: the sheet did **not** auto-open, the row read «الصف: العاشر أ», moving
to العاشر ب persisted `classGroupId: 'c2'`, and «بلا صف» persisted `null`. In
chat: the first «أضف لصف» asked (no clear row offered on an unfiled material),
picking filed it, and a second tap reopened as a move with the current class
ticked and a clear row — one workspace row throughout, never a duplicate. موادي
showed the class name on the card.

## «ابدأ الحصة» projects the lesson that was picked, 2026-08-25

**Reported:** change the lesson in chat, choose a different subject, press
«ابدأ الحصة» — and the projector still shows the first selection. Reproduced in
the running app, and it was two separate faults wearing one face.

**1. The deck had no subject, and the default is maths.** The chat called
`buildClassDeck({ topic, lang })`; `subjectId`/`subjectName` default to
`mathematics` / `Mathematics`. `isMathContext` matches on the subject *name*,
so every deck was a maths deck. Picking «تجربة استهلالية: الطيف الذري»
(chemistry) and starting the class gave 7 slides: a graph slide and four
algebra questions — `y = x²` intersections, a linear/quadratic system — under
the chemistry title. The home screen never had this bug; it passed
`pickedSubject.name`. The subject was dropped when Start Class moved out of
home into `services/startClass.ts` and the chat became its only caller.
`CurrentLessonView` now carries `subjectId` / `subjectName` from the lesson's
own book, and chat passes them.

**2. The change-lesson sheet threw away the id and searched for the title.**
`TopicSelector` knows exactly which lesson was tapped; `ContextBanner` kept
only the title string and re-derived the lesson with `searchKBSemantic`. That
returns a *different* lesson for **16 of the picker's 63 lessons**. Picking
«قانون الجيوب» pinned and displayed «قانون جيب التمام» — verified in the app
before the fix, on the lesson card and in the reply. `TopicSelectionDetail`
now carries `lessonId`, `resolvePickedLesson` prefers it, and the id is
persisted in `HomeLessonPick` so a restored pick is the same lesson too. The
search stays as the fallback for entire-unit picks and free-typed topics.
(`resolveGeneratorGrounding` was never the culprit — it resolves 63/63 exact
titles correctly. Only the semantic search drifts.)

Two smaller things fell out of the same trace, both fixed here:

- A pick with no KB match kept the previous `activeLessonId` while showing the
  new title, so generators stayed grounded on the lesson just left. It is
  cleared now, and both language topic fields move together.
- The reply to a freshly picked lesson still announced «وسأراعي تركيزك الحالي»
  with the *previous* lesson: `sendMessage` read `teachingCtx` / `sessionMemory`
  from a closure React had not updated yet. It now takes the teaching context
  from `pinnedLessonId` when one is passed — the same argument that already
  existed to solve this for retrieval.

### Verified by driving the real UI

Expo web build served statically with `/auth/me` stubbed and a token in
`localStorage`; no API server, so everything took the local/demo path. Same
click path each time — تغيير الدرس → الكيمياء → بنية الذرة وتركيبها → تجربة
استهلالية: الطيف الذري → ابدأ الحصة.

- **Before:** 7 slides — graph + four `y = x²` maths questions.
- **After:** 3 slides — whiteboard rules, one open chemistry prompt, summary.
- Maths is unchanged: the default lesson still projects 8 slides with its
  objectives and four composition/inverse questions.

**Worth knowing:** the chemistry deck is thin because `MockAIService` has no
chemistry question bank — its non-maths quick-check is one «اشرح بكلماتك»
prompt. That is pre-existing mock behaviour, not something this change
introduced; what changed is that a chemistry lesson now gets a thin honest deck
instead of a rich wrong one. Live AI generation is unaffected.

`services/__tests__/lessonPickFidelity.test.ts` covers all of it, including a
sweep asserting the 16-lesson drift still exists in `searchKBSemantic` — the
day it stops being true, the reason for threading the id through is gone.

## The two maths student books are swapped, 2026-08-25

Found by testing retrieval, not by reading data. Asking the new passage layer
for الدائرة returned a page about المتجهات, which looks like a ranking problem
and is not one.

`10th_grade,_math,_1st_semester_….pdf` opens **«الوحدةُ 5 الاقتراناتُ»** and
carries unit 7 المتجهات — the catalog's **Semester 2**. Its sibling named
`…,_2nd_semester_….pdf` opens **«الوحدةُ 1 المعادلاتُ»** and carries unit 3
حساب المثلثات — the catalog's **Semester 1**. The files are swapped relative to
their names, and `g10_sources.json` inherited the swap because its entries were
written from a Drive listing rather than from the documents.

The teacher guides are **not** affected: the S2 guide really does hold unit 6
المشتقات. This is the two student books only.

`extract-text.ts` now maps them across their filenames, by content, because
that is what makes a citation true — a passage offered for الدائرة has to come
from the book containing الدائرة. Retrieval for that unit now returns
«معرفة الوترِ، والقُطْرِ، والمماسِّ» (p34) and «الزوايا في الدائرة» (p47).

**This very likely extends past the two local files.** The `bytes` recorded
against `math-s1-student-book` and `math-s2-student-book`, and probably the
Drive copies themselves, carry the same swap — 33,429,449 bytes matches the
manifest's *s2* entry exactly and is the file whose contents are *s1*. Nothing
downstream of the catalog is wrong (unit numbers, titles and objectives are all
internally consistent and came from the guides), but anyone going to Drive for
"the semester 1 maths book" should expect to open semester 2.

A test now asserts each extracted book contains at least two of its own unit
titles. Reintroducing the swap fails it with "math-s1-student-book contains
only 1 of its own unit titles (الدائره) — it is probably the other semester's
book". Filenames and manifest labels are hearsay; the unit titles printed
inside the book are not.

**And there were three `normalizeArabic`s.** One in `blooms.ts`, one in the
api-server grading path, and nearly a third for retrieval. They agreed on
Arabic and disagreed on Latin case and Arabic-Indic digits. Now one, in
`lib/curriculum/src/arabic.ts`, re-exported from both old homes so no import
changed. Checked before merging: over all 196 marker terms and catalog
objectives the two differed on 7 strings, every one an English objective being
lowercased, and the Bloom's markers are Arabic verbs.

Retrieval itself (`src/passages.ts`, server-only, on the `./passages` subpath)
is lexical rather than vector: the bank already scopes a query to one book by
unit tag, so what is left is ranking a few hundred pages, and there is no
embedding store to add. Passage text is returned **raw** — repaired and folded
only for matching — because re-spelling a textbook on the way to a prompt is a
silent edit of a source document.

69 curriculum / 878 mobile / 223 api-server tests pass; typecheck clean.
(Mobile was 855 on the branch alone; the rest came in with `main`.)

**Still not wired to anything a teacher sees.** No prompt reads a passage yet,
and `DEMO_MODE` remains `true`.

## The books can be read after all, 2026-08-25

Two things I had been repeating in this file were wrong, and both were load-
bearing.

**The PDFs are not all on a Windows mirror.** Six real NCCD documents are
committed in `attached_assets/` — both math student books, chemistry S1, both
math exercise books, and the S2 teacher guide (~101 MB, tracked). That claim was
only ever true of the *teacher-made support pack*. The seventh, the math S1
teacher guide, is a Git-LFS pointer: 58 MB unpulled, and `git-lfs` is not
installed in the session container, so it stays blocked.

**Arabic extracts fine.** The entry above about `pdftotext` mangling Arabic is
accurate about *matching* and was read as "these PDFs are unusable". They are
not. `pdf-parse` — a root dependency that until today nothing imported — pulls
**682 pages and 1.18M characters** of readable Arabic prose out of the six:

| source | pages | chars |
| --- | --- | --- |
| math-s2-teacher-guide | 218 | 558,414 |
| math-s1-student-book | 150 | 220,128 |
| math-s2-student-book | 132 | 184,065 |
| chem-s1-student-book | 76 | 113,815 |
| math-s2-exercise-book | 56 | 57,003 |
| math-s1-exercise-book | 50 | 47,275 |

What is genuinely broken is string matching, for two narrow reasons: the
lam-alef ligature decomposes («الاقتران» → «االقتران») and tashkeel is
interleaved. `normalizeArabic()` plus a lam-alef fix takes probe matching from
mostly-failing to mostly-passing. **A model reads this text fine; a regex does
not.** So `lib/curriculum/scripts/extract-text.ts` stores pages and stops —
no structure parsing, no hunt for lesson boundaries. Every previous attempt to
infer structure from these books by pattern produced confidently wrong output;
retrieval will scope by the bank's unit tags, which already work.

**Provenance records the file actually read.** `math-s1-student-book` on disk is
a 12.1 MB Adobe InDesign original against the manifest's 18.6 MB — same 150
pages, same publisher, a different export. `extraction.bytesDifferFromManifest`
records that rather than letting two exports of one book quietly become
interchangeable, which is the assumption that put a downsampled copy of each
chemistry textbook in front of teachers. Each extraction carries its own
`sha256` and `localPath`, and a test re-hashes the file on disk.

**`status: 'ingested'` now means two different things, deliberately.** It used to
mean "a human transcribed objectives out of this by eye". It now also covers
"machine text exists". The new `extraction` block says precisely which, because
a document can have one without the other — and until today *every* book had
objectives with no machine-readable text.

**The 2.1 MB must not reach the phone.** The mobile app imports
`@workspace/curriculum`, so one static import of the corpus from `index.ts`
would ship all of it to every device for a feature the app does not run. A test
fails if anything under `src/` imports `data/extracted`. Retrieval belongs
behind a server-only subpath export.

Two bugs in my own first draft of that test, both worth recording because both
looked like data problems: it asserted 20 consecutive Arabic characters per page
and reported chemistry as 2 pages of 76 — the pages carry ~1,200 Arabic
characters each, but tashkeel, spaces and «Principal Quantum Number» mean a
20-character run almost never occurs; it was measuring typography, not language.
And the bundle guard grepped for the string `data/extracted`, which flagged
`sources.ts` for *documenting* where the text lives. Density, and an import
regex, respectively.

51 curriculum / 855 mobile / 223 api-server tests pass; typecheck clean;
`verify-curriculum` 0 errors. (Mobile was 815 and api-server 193 on the branch
alone; the rest arrived with `main` when this was merged up.)

~~**What this does not yet do:** no grounding, no change to any prompt.~~
**Superseded 2026-08-25** — see "The books are in the prompts now" above. The
`DEMO_MODE` half still holds: it is `true` and `AI_LIVE_MODE` is unset, so no
prompt reaches a model.

## An activity is an activity, and «عن» stopped being a lesson title, 2026-08-25

Two things the chat-materials pass left behind, both now closed.

**`MaterialType.activity` is no longer dead.** Every class activity — from the
Activity screen and from chat — was filed as `'lesson'`, because
`app/workspace/view.tsx` had no branch for one and its final `else` is the quiz
renderer, which maps over the `questions` an `ActivityOutput` does not have.
Saving one honestly meant saving a material that crashed the viewer that opened
it. The viewer has an `ActivityView` now — objective, group size and duration,
materials, numbered steps with their minutes, tips, differentiation, assessment
— in the same order and sections as the Activity screen's own result view, so a
teacher is looking at the same document on both surfaces. Export follows:
`formatActivityText` / `buildActivityHTML` already existed and were simply never
reachable from here.

**The activities already saved as `'lesson'` are rescued by shape, not by a
migration.** `looksLikeActivityContent()` (`services/materialShape.ts`) decides
when a stored `'lesson'` is really an activity — keyed on `steps` plus
`objective`, and refusing anything carrying a plan's `objectives` list. Tested
in both directions, because a false positive would send a real lesson plan to
the wrong renderer.

**The viewer stopped keeping its own colour map.** It had a private copy of the
same five colours `constants/materialKind.ts` holds, and adding a sixth to a
private copy is the exact drift that file was extracted to stop — a card in
موادي and the material it opens must not disagree about what colour an activity
is. One map now.

**«خطة درس عن تركيب الاقترانات» resolved to the topic «عن تركيب الاقترانات».**
That is a title, and since materials became projectable it is also a slide, so a
class saw a wall reading "About Function Composition". Two rules meant to
prevent it never fired in Arabic:

- the `^(عن|حول|about|for)\s+` anchor ran while the string still began with the
  spaces the verb strip had just left, so it never matched anything;
- `\b` is defined by `[A-Za-z0-9_]`, so `\bعن\b` cannot match between two
  Arabic letters — that rule only ever worked for `about` / `for`.

Whitespace is collapsed before the token pass now, and the token test is written
against spaces and string ends rather than `\b`. A stranded English article
("a function composition") goes too. `resolveArtifactTopic` moved to
`services/ai/artifactTopic.ts` to be testable at all — `chatArtifacts.ts`
constructs the AI client at import time, which `node:test` cannot load, the same
split `routeGating.ts` and `docxOutline.ts` already made. It is re-exported, so
no call site changed.

### Verified by driving the real UI

Expo web, `/auth/me` stubbed, no API server. «حضّر خطة درس عن تركيب الاقترانات»
now saves as **«خطة درس: تركيب الاقترانات»**. A generated activity saves as
`type: 'activity'` titled «نشاط صفي: تركيب الاقترانات», offers no Present button
(correct — there is no ActivityOutput deck builder), and opens in the workspace
showing its objective, materials and numbered steps. A hand-seeded legacy row —
activity content under `type: 'lesson'` — renders as an activity too, with no
console errors.

**Left alone:** the activity meta row shows the raw `activityType` (`group`)
rather than a translated label. That is what the Activity screen shows as well;
fixing it belongs on both at once.

## Chat materials stopped dead-ending at copy, 2026-08-25

**A material generated in chat now offers what the tool screens offer.** Chat
calls the same generators as `/ai-tools/*` and produces the same objects, but
the only thing a teacher could do with the result was copy or export the text —
so the fastest route to a lesson plan was also the one that led nowhere. The row
under a material bubble now reads **حفظ · أضف لصف · اعرض · نسخ · تصدير**.

- **حفظ** writes the structured object (not the prose) to موادي, so the
  workspace viewer parses it back, and so a plan edited in the bubble is saved
  as edited. A first save opens `ClassPickerSheet` on the returned id — the same
  "which class is this for?" moment the seven generator screens have.
- **أضف لصف** saves first when the material is not saved yet: the class link is
  a field on a saved material, so there would otherwise be nothing to attach.
  The id lives on the message, so a second tap updates rather than files a
  duplicate.
- **اعرض** builds the deck locally — `buildLessonDeck` for a plan,
  `buildDeckFromWorksheet` / `buildDeckFromQuiz` for the other two — and hands
  it to the presentation screen. Unlike «ابدأ الحصة» this needs no round trip
  and projects what is on screen instead of generating something new.
  **Activities get no Present button**: `ActivityOutput` is a teacher run-sheet,
  not a deck, and there is no builder for one. A button that silently did
  nothing would be worse than its absence.

**Nothing chat projects claims a verified answer key.** Chat does not run the
verifier, so `deckForArtifact` passes neither `verified` nor `outcomes` and the
slides badge unverified — the same rule this file records for `verified`
everywhere else. A test asserts it.

~~**An activity is saved as type `lesson`, not `activity`.**~~ **Superseded the
same day** — the viewer got its `ActivityView`, so both surfaces file activities
as `'activity'` and the type is no longer dead. See the section above.

The decision logic is `services/chatMaterialActions.ts` (pure, no React), tested
in `services/__tests__/chatMaterialActions.test.ts`; `app/(tabs)/iqra.tsx` owns
the buttons, toasts and navigation.

### Verified by driving the real UI

Expo web on :8081 with `/auth/me` stubbed and no API server, so every write took
the local fallback path. Asked «حضّر خطة درس عن تركيب الاقترانات», picked
الرياضيات, and got the plan with all five actions on one RTL row. حفظ → one row
in `@iqra_workspace_v1` (`type: 'lesson'`, content parsing back to the plan) and
the label flipped to «محفوظ ✓». أضف لصف → still one row, no duplicate; the class
sheet self-closed, which is what it does with no roster (server-only). اعرض →
`/ai-tools/classroom/presentation` rendering a 7-slide deck.

~~**Left alone:** the deck and the saved material are titled «عن تركيب
الاقترانات», preposition included.~~ **Fixed the same day** — see the section
above for why the two rules meant to strip it never fired in Arabic.

## The refusal now points somewhere, 2026-08-25

`mockGenerator` declines four of the eight question types on purpose — it will
not invent distractors, and there is a long comment saying why. The refusal was
also the end of the reply: a teacher asked for multiple choice, got told no,
and was no closer to an exam.

The bank knows there are 3 question banks, 6 past papers and 3 answer keys on
file for الدائرة. It could not say so, because **nothing server-side could see
the bank at all** — `bank.ts` shipped in `@workspace/curriculum`, which the API
already depends on, and only the mobile app read it.

Now a declined type ends with:

> Skipped multiple_choice, true_false: these need distractors or factual
> statements that cannot be derived from the curriculum text alone.
> The library holds 3 question banks, 6 past papers, 3 answer keys for these
> units — real items to draw on, but nothing has been extracted from them yet.
> 26 of the 35 documents for these units are a named teacher's own work and
> must not be reproduced verbatim.

The counts are counted, not estimated. An earlier draft said "most are a named
teacher's work"; the ratio varies by unit and a sentence that guesses is the
shape of almost-true claim this file exists to stop.

**`bankContext` is shaped like the answer retrieval will give**, so the seam is
already in place: `suggested` is the ranked list of documents that could supply
a real item (question banks, then past papers, then answer keys), each with its
`usePolicy`. What is missing is only the extracted content — `pending` reports
that per request rather than leaving `total` to be misread as "items we can
serve".

**New: `GET /bank/items`, `/bank/for-objectives`, `/bank/stats`.** Public, on
the same reasoning as `/curriculum/*` — titles and provenance, not documents.
`driveId` is dropped from the projection: a handle to a file this API does not
serve. `?kind=quiz` — the retired vocabulary's word — is a 400 rather than a
silently unfiltered 200.

**Two bugs found on the way, both latent for a while:**

- **Ten of the seventeen chemistry lessons resolved to no unit tag at all** —
  all of units 2, 4 and 5. `unitTagsForLesson` matched chemistry units against
  `unit.id === 'kbu-chem-1'` and four siblings, ids from a scheme the catalog
  no longer uses. Every branch was dead, so chemistry fell through to title
  keywords, and «التفاعلات الكيميائية» misses `/تفاعلات كيمي/` because the
  definite article sits between the two words. Those lessons saw only
  semester-wide material, in the shelf *and* in chat grounding. Replaced by
  `bankTagsForUnit()` in `bank.ts`, derived from the id's structure — which is
  also what lets the server answer. One mapping, both callers.
- **`mockGenerator` could not be loaded by `node --test`** — it imported
  `./competency` and `./questionTypes` without extensions, which only esbuild
  resolves. That is the documented trap in CLAUDE.md, and it is why the
  deliberate-refusal logic had no direct test until now. Two characters each.

44 curriculum / 815 mobile / 193 api-server tests pass, typecheck clean,
`verify-curriculum` 0 errors.

**Unchanged and still the blocker:** 63 of 78 documents are `pending`. This
tells a teacher what exists; it cannot yet hand them a question out of it.

## The lesson page says what the library holds, 2026-08-25

The knowledge-bank merge earlier today made `kind` trustworthy — `exam`,
`question-bank` and `worksheet` are three different things now. This spends it:
the lesson page has a **مكتبة الدرس** section listing the documents on file for
that lesson, by kind, with the teacher who wrote each one.

**The split is the design.** `math-s1-student-book` is tagged `s1` and so
belongs to all eighteen Semester 1 lessons; a worksheet on أوتار الدائرة is
tagged `s1-u2` and belongs to four. Listed together, every maths lesson's shelf
is the same twenty-odd files and the specific ones are lost. So
`isUnitScopedTag` (new, in `bank.ts`, replacing an inlined `tag.includes('-u')`)
splits them: unit-scoped material leads, semester-wide material is collapsed
behind a toggle. أوتار الدائرة gets **8 worksheets, 2 question banks and an
answer key** at the top, and 24 semester-wide files behind the fold.

**A bug the probe caught before it shipped.** «تجربة استهلالية: المعادلة
الكيميائية» matched the maths title rule `/أسس|معادل/` and picked up the
MATHEMATICS tag `s1-u1` — six algebra worksheets on a chemistry lab. It had
been latent for as long as those rules existed: chat survived it because
`scoreResource` rejects a subject mismatch *after* scoring, and nothing else
read the tags. The shelf reads them directly and had no such backstop. Fixed
where it belongs — the title rules are now gated to their own subject, so the
wrong tag is never emitted rather than emitted and discarded. Two tests hold
it: one over every lesson's shelf, one over the whole tag namespace.

`s1-matrices` also stopped being treated as semester-wide. It is a unit tag
that carries no number, so the old `includes('-u')` check scored it 3 instead
of 8.

**What the shelf does not do: hand over the PDF.** The binaries are gitignored
and not shipped, so a download button would fail. It says so once under the
header and the only action on a row is «اسأل عنه», which routes to chat —
which already grounds its reply on these titles. Wiring real file delivery is
still blocked on the same decision as the blueprint miner: get the PDFs
somewhere the app can reach, or publish the Drive links (`driveUrl()` exists;
whether the folder is shared with teachers is **not verified**).

Financial-literacy lessons get an empty shelf, deliberately — `APP_SUBJECTS`,
and the unresolved S1/S2 edition conflict behind it. A test asserts the empty
rather than leaving it to chance.

44 curriculum / 808 mobile / 175 api-server tests pass, typecheck clean.

## One knowledge bank, and ten past papers that were invisible, 2026-08-25

There were two catalogs of the same PDFs. `lib/curriculum/src/data/g10_sources.json`
held 78 documents with Drive ids, authority and duplicate resolution, and
**nothing read it**. `artifacts/mobile/data/g10_{math,chem}_support_resources.json`
held 66 of those same documents under a second id space and a second type
vocabulary, and it was the one the app actually searched.

They had drifted, in three ways that reached teachers:

- **All ten real exam papers were typed `quiz`**, the same value as a practice
  worksheet. Five of them were also tagged `remedial`, and carried `remedial`
  in their keyword list, where the scorer reads it at +2. So eight Jordanian
  final and monthly papers — the single most valuable thing in the Drive for
  exam work — were indistinguishable from remedial material, and there was no
  query that could ask for them.
- **Three entries pointed at copies the manifest marks `duplicate`**, including
  both chemistry student books in their downsampled iLovePDF form. The app
  de-duplicated by title and the two copies of each book had different titles
  (one Arabic, one English), so it could never have caught them.
- Four ministry files were credited to an author named «ول» — the tail of
  «الأول». The absorbed catalog had parsed authors off filenames.

**The manifest absorbed the catalog.** It gained `filename`, `authorAr`,
`unitTags`, `keywords` and an always-empty `objectiveIds`; the two mobile JSONs
are deleted; `mathSupportResources.ts` is now a search over
`@workspace/curriculum` and owns no data. `kind` is the only type vocabulary
left, so `exam`, `question-bank` and `study-pack` are three different things
and a teacher asking for quiz material now reaches the real papers
(`teachingAssistant.ts` passes `kinds: ['question-bank', 'exam', 'answer-key']`).

**`usePolicy` is the one place the reproduction line is drawn.** NCCD →
`quotable`; teacher and third-party → `reference-only`, meaning it may inform
generation and must never be emitted verbatim into anything a teacher exports.
`assertQuotable()` throws, naming the author, so the export path fails closed
rather than on someone remembering. Same discipline as `verified`.

**One thing I asserted and the data contradicted, worth recording because it is
the exact trap this repo keeps falling into:** I wrote that every exam paper is
teacher-authored. Nine are. The tenth, `math-diagnostic-test`, is the ministry
diagnostic and is quotable. `kind: 'exam'` is therefore *not* a proxy for
reference-only, and there is a test holding that.

**Still open — do not read this entry as saying the bank is built:**

- `objectiveIds` is empty on all 78 entries. Unit-level tags are enough to put
  a PDF on a lesson shelf; they are useless for exam assembly, which speaks
  `evaluations.objectiveIds`. Nothing has been mined that finely, and the test
  asserts the emptiness so it cannot be faked from a unit tag.
- **63 of 78 documents are `pending`** — a title and a Drive id, no extracted
  content. The blueprint miner has a data model's worth of fuel and no fuel:
  the PDFs live on the Windows mirror in `localRoot`, not in the repo.
- The PDFs still are not shipped. `knowledge-base/*/support-pdfs/` is
  gitignored and empty, so «📎 مواد مساندة متوفرة في مكتبة اقرأ» remains a
  promise the product cannot keep — it names a file it cannot hand over.
- `scripts/import_g10_{math,chem}_support.py` would recreate the split. They
  now refuse to run without `IQRA_ALLOW_LEGACY_SUPPORT_IMPORT=1`.
- Financial literacy is held out of the app view on purpose (`APP_SUBJECTS` in
  `mathSupportResources.ts`), because of the unresolved S1/S2 edition conflict.
  Its S1 book is otherwise usable; revisit when the edition is chosen.
- `محمد طارق` and `محمد طارق عوض` are probably one teacher. Left as two.

44 curriculum / 783 mobile / 175 api-server tests pass, typecheck clean,
`verify-curriculum` reports 0 errors. (Mobile was 761 on the branch alone; the
extra 22 came in with `main` when this was merged up, not from this change.)
## The first real scan was refused, 2026-08-25

The mark scanner shipped and the first photograph a teacher actually took came
back **"That photo is too large. Take it again at a lower quality."** — in
English, on an Arabic screen.

Two separate faults in one screenshot, and both were mine.

**The photo was never shrunk.** The picker asked `expo-image-picker` for
`quality: 0.6`, which re-compresses twelve megapixels rather than sending
fewer, so a default phone photo still arrived at several megabytes and a third
larger again as base64. The answer is to send less, not to raise the cap: a page
of handwritten marks is legible at about 1600px on the long edge, and a
3024×4032 photo becomes 1200×1600 — **a 6.3× cut in pixels, measured at 5.1× in
bytes** in the browser engine the web build actually runs in.

Done with `canvas`, no new dependency, and **web only on purpose**: the app is
served as an Expo web build and that is where teachers use it. On native it
returns the photo untouched rather than pretending — `expo-image-manipulator`
is the answer there, and adding a dependency for a platform nobody runs yet is
a cost with no reader. `fitWithin` is split into `imageFit.ts` so it can be
tested, the same split `routeGating.ts` and `studentAnswers.ts` already make.

**The teacher was shown the server's English.** Every failure on this path
already carried a `code` — that was the point of splitting them — and the
screen ignored all of it and rendered `err.message`. Now `image_too_large`,
`live_mode_off`, `budget_exceeded` and `user_quota_exceeded` each map to an
Arabic sentence that says what to do, and the fallback is "enter the marks by
hand" rather than the raw message.

Worth noting what this cost: the guard was tested, the parser was tested, the
route was tested — and none of that touched the one path a teacher takes with
a real phone. The failure was in the two steps either side of everything that
had tests.

968 mobile tests, 0 failures.

## Scanning the marks off the paper, 2026-08-25

A class of thirty on a ten-question paper is three hundred numbers typed by
hand, and that is the cost that decides whether a teacher keeps using any of
this. They already marked the paper. This reads their marks off a photo of it.

**Vision was confirmed available first**, because it gates the whole feature:
`gpt-5.4-mini` accepted an image and answered normally. Had it been text-only,
no amount of code would have helped — the OpenAI project permits only that and
`gpt-5.4-nano`.

**`POST /attempts/:id/scan-marks` writes nothing.** It returns *proposals* that
land in the boxes on screen; the ordinary marking endpoint is still the only
thing that saves a mark. That is the entire safety design, and it is why this
was worth building before reading students' answers: a misread cannot become a
mark without a teacher seeing the number first.

The module is built to under-claim, because a wrong OCR does not throw — it
produces a confident wrong number against a real child:

- A mark it cannot read comes back **absent, never zero**. A blank box is a cue
  to look; a zero is a mark.
- A number outside the question's range is **dropped, not clamped**. Turning a
  misread 50 into 5 invents a mark nobody wrote and looks exactly like a
  correct reading.
- A mark for a question not on the paper is ignored — that is a misread of the
  page, and reporting it would put a mark on the wrong question.
- Every proposal carries `readAs`, the characters the model claims it saw, so
  the teacher checks a reading rather than trusting a total.
- Arabic-Indic digits, `٥٫٥`, `5½` and `٥ ونصف` all parse; anything else is a
  skip with a reason.

The prompt says outright that it is *transcribing, not marking* — never infer a
mark from the student's work, never fill a gap, and omitting always beats
guessing.

**The photo is not stored.** It goes to the model and is discarded. There is no
object storage in this app, and inventing one to hold exam papers belonging to
minors deserves its own decision rather than arriving as a side effect of a
convenience feature. The cost is that a disputed mark has no scan to appeal to.

### A 500 that ordinary use would have hit

`express.json()` was at its 100KB default. A phone photo is several megabytes
before base64 inflates it by a third, so the body parser rejected it **before
any route ran** and the generic handler answered `500 Internal server error` —
nothing a teacher could act on, on the feature's main path. The limit is now
12MB, and `entity.too.large` answers 413 with advice. `scan-marks` still
refuses over 8MB itself; the limit only has to be high enough that the refusal
comes from somewhere that can explain itself.

Found by testing the guard, not the happy path.

13 tests on the parser, 6 on the route's guards (bad body, oversized, another
teacher's attempt, no token, live mode off, and that none of it writes a
grade). 256 api-server tests, 895 mobile, 0 failures.

**Not verified: the model actually reading a sheet.** The local key is a
placeholder and the endpoint is not deployed yet, so every test above runs with
live mode off. The first real scan will be the first time a photograph reaches
the model.

## Save stopped working after you deleted the material, 2026-08-25

Reported from use: save a quiz, pick a class, leave the screen, delete the
material from موادي, then press Save again — and nothing happens.

`updateItem` returns `false` when the material is no longer there. All four
generator screens — quiz, activity, lesson plan, worksheet — **dropped that
return value**:

```ts
await updateItem(savedId, { … });   // false, ignored
setSaveLabel('updated');            // says "تم التحديث" anyway
```

So the screen still held the id of something the teacher had since deleted, the
PATCH answered 404, and the button reported success over a material that no
longer existed. The work was never saved again, and nothing said so.

The fix folds the call into the condition, so a failed update falls through to
creating a fresh material — which is what pressing Save meant:

```ts
if (savedId && (await updateItem(savedId, { … }))) { … } else { …create… }
```

Confirmed against the API: PATCH returns 200 while the item exists and 404
after it is deleted, which is exactly the signal that was being thrown away.

**The same shape as the submit bug above**, and worth noticing twice in one
day: the operation reported success, the data said otherwise, and only a
teacher using it found out. Both were places where a return value or a piece of
feedback existed and nothing looked at it.

895 mobile tests, 0 failures.

## Two dead ends found by using it, 2026-08-25

Both came from a teacher walking the real flow on production, and neither
would have shown up in a test.

**The share card named a problem and offered no way to fix it.** An exam that
is not attached to a class cannot have a working link — the roster a student
picks their name from *is* the class — so the card said "attach this to a class
first" and stopped there. Attaching was only possible from inside the class
(الصفوف → الامتحانات → +), which a teacher standing on the evaluation screen has
no reason to guess. It now offers «أرفقه بصف الآن» and opens
`ClassPickerSheet` — the same sheet the seven generators already use, which
loads the list itself and closes silently for a teacher with no classes rather
than showing an empty dialog.

**Submitting looked like a button that did nothing.** «سلّم وصحّح» sits at the
bottom of a long page and the result card renders at the top, so a successful
submit changed nothing where the teacher was looking. The marks were saved
correctly the whole time — the teacher only found out by navigating to the
results dashboard and seeing 80%. Now it says «تم التصحيح — النتيجة في الأعلى»
and scrolls to the card.

The second one is worth remembering as a shape: **the work happened, the
feedback was somewhere else.** Nothing was broken, no error was thrown, and the
data was right. It still read as a failure, which is all that matters at the
moment a teacher decides whether to trust the tool.

243 api-server tests, 895 mobile, 0 failures.

**Verified as far as the automation allows.** The attach button renders on an
unattached published exam, and the endpoint behind it was proven when the exams
tab shipped. The *click* is not machine-verifiable — synthetic events do not
reach these React-Native-Web controls, which is already recorded above.

## A model can write the exam now, 2026-08-25

The student link shipped and immediately hit its own ceiling: **no teacher
could create a single question that marks itself.** The mock generator refuses
multiple choice, true/false, matching and fill-blank by design — its own note
says they "need distractors or factual statements that cannot be derived from
the curriculum text alone" — and the question editor can change a body but not
a *type*. Those four are exactly the types Tier 1 grades. So a link exam was
all written answers and the teacher still marked every one; the link removed
transcription, not marking.

`POST /evaluations/:id/generate` now takes a model path when `AI_LIVE_MODE` is
on, and the mock when it is not.

**Split so the risky part is pure.** `buildGenerationPrompt` and
`parseGeneratedQuestions` are pure functions with 15 tests; only the call out is
not. The parser assumes carelessness — every case it handles is something a
model actually does: inventing an objective id, returning a type nobody asked
for, omitting marks, wrapping the array in the wrong key. Malformed items are
dropped **with a reason a human can read**, and the count is reported, because
a teacher who asked for 15 and got 11 is owed the reason.

**Nothing new decides whether a question is good enough.** Output goes through
`validateGenerated` — the same gate the mock passes — which already enforces
objective scope, requested types, per-type structure, positive marks and
near-duplicate stems. The grading mode comes from the type registry, never from
the model: a model claiming its own question is `deterministic` would be
deciding how it gets marked.

**A failed model call never becomes four template questions.** This is the
repo's own scar — mock output that looked identical to real output — and it
would have been trivial to reintroduce here. Verified with live mode on and a
deliberately invalid key: `502 generator_unavailable`, nothing written, the
evaluation not marked as model-written. The message names which half failed and
says nothing was changed, so a teacher is not left wondering whether they now
have half a paper.

The four failure modes are now distinguishable — `live_mode_off` (503),
`budget_exceeded` (429), `user_quota_exceeded` (429), `generator_unavailable`
(502). One "Generation failed" for all of them is what makes a spend cap look
like an outage and an outage look like a bug.

**A per-teacher allowance, because fifty teachers share one card.**
`AI_BUDGET_USD` is a single month-to-date total; with a pilot that size,
whoever generates on the 20th is refused with no way to tell it from a bug.
`AI_USER_BUDGET_USD` caps each teacher, read from the ledger rather than a
process counter — an in-memory total is what made the global cap a *per-wake*
allowance once before, since the free tier restarts on every wake. Unset means
no per-teacher cap, which is right for one teacher and wrong for fifty.
**Verified**: seeded $0.90 of spend against a $0.50 cap gave `429
user_quota_exceeded`. A ledger that cannot be read does not block generation —
the global cap still applies underneath, and turning a database blip into a
total outage is the worse failure.

### Two things tidied on the way, both duplication of a security control

- **`sanitizeQuestionForStudent` now delegates to the type registry.** Every
  entry in `QUESTION_TYPES` already carries a `sanitizeForStudent` whose
  interface says it must never include answers or rubric. Yesterday's student
  link added a *second* allowlist beside it — two definitions of the same
  control, which would have disagreed the first time a type gained a field. The
  local list survives only as the fallback for a type the registry does not
  know.
- **`fill_blank.sanitizeForStudent` passed `body.blanks` through unexamined.**
  The real key lives in `expectedAnswer.blanks` and never reaches the
  projection, so nothing was leaking — but nothing renders `body.blanks` either
  (the student screen counts placeholders in the template), which made it free
  parking for a generator to leave answers in. That stops being hypothetical
  the moment a model writes these bodies. Now `template` only.
- `extractJSON` moved from inside `routes/generate.ts` to
  `lib/generationShape.ts`, since two routes need it and a second copy would
  drift the first time a model found a new way to be "helpful".

### What is still not true

**The maths verifier cannot check a generated answer key.** The plan said keys
would go through SymPy; the service only exposes `/verify/derivative` and
`/compute/derivative` — there is no general equivalence endpoint. So a
generated key is *unverified* unless the question happens to be a derivative,
and nothing claims otherwise. Wiring Tier 2 equivalence into grading needs a new
endpoint on the Python service first.

**Nothing has generated a real question yet.** Every test above runs with live
mode off or with a deliberately broken key. Turning it on is env-only —
`AI_LIVE_MODE=true`, `AI_BUDGET_USD`, `AI_USER_BUDGET_USD`, a working
`OPENAI_API_KEY` — and it costs real money per paper, so it is a decision
rather than a deploy.

238 api-server tests, 878 mobile, 0 failures.

## Students answer on their own phones, 2026-08-25

Marking worked; getting the answers in did not. A teacher typed every mark by
hand, and the answer sheet has no "next student", so a class of thirty meant
thirty round trips through a picker. At the scale of a fifty-teacher pilot that
is the thing that decides whether any of the rest gets used.

One link goes on the board. Each student opens it, taps their own name, answers
on their phone, and hands in. `attempts.source` was designed for exactly this in
Phase 4, so **nothing in grading, scoring, levels or recommendations changed** —
the same submit path runs, and a sitting that arrived by link is indistinguishable
downstream from one the teacher typed.

**The only unauthenticated write surface in the API.** Everything about
`routes/studentAttempt.ts` follows from that:

- **The answer key never leaves.** `sanitizeQuestionForStudent` builds the
  student's copy from an **allowlist** of body fields per question type, rather
  than copying the body and deleting what is dangerous. A question type that
  gains a field later inherits the safe default instead of silently leaking.
  Options are rebuilt down to `{id, text}`, because `isCorrect` rides inside
  them. Asserted on the **serialised** payload at any depth, not on object
  properties — checking `payload.expectedAnswer === undefined` passes happily
  while the key sits inside an option.
- **Mounted without auth and path-scoped**, with `mountOrder.test.ts` extended
  both ways: the link answers without a token, and nothing else became public.
  That test boots against an unreachable database on purpose, so the assertion
  is "not 401" — a 500 there is *proof the request reached the handler*, and a
  401 would mean an earlier guard swallowed it.
- **A wrong code answers exactly as a draft or a closed exam does.** A public
  endpoint should not confirm which codes exist.

**Identity is a shared link and a tapped name, chosen over per-student links.**
Thirty individual WhatsApp messages per exam is the thing that gets abandoned in
week one. The plan doc rejected this shape because "a level attached to the
wrong name is worse than no level", and that objection is not dissolved by
convenience — it is contained, four ways: an explicit confirm step before the
first question; a claimed name cannot be claimed again; the teacher sees who
started and when; and the teacher can **move a sitting to the right student**
afterwards, which is the only one of the four that actually repairs a mistake.
`DELETE /attempts/:id` releases a name for the phone that died.

Accepted and stated plainly: anyone holding the link sees the class's first
names while the exam is open.

**The race a classroom actually produces.** Thirty devices press start within
seconds, so a check-then-insert lets two claims on one name both pass before
either writes. Found by re-reading the claim path rather than by a failure:
there was no unique index on `(evaluation_id, student_id)`. There is now, and
the route catches `23505` and answers `name_taken`. **Verified with 30
simultaneous claims on one name: 1 created, 29 refused, 0 unexplained errors.**

**A share code, not a UUID.** Six characters from an alphabet with no `I`, `L`,
`O`, `0` or `1`, because a teacher writes it on a whiteboard and a student reads
it from the back of the room. Issued at publish and **kept across re-publishes**
— a link already on the board must not stop working because the exam was edited.
Input is normalised for the lower case, spaces and dashes students actually
type; ambiguous characters are dropped rather than guessed at, since mapping
`O` to `0` would be inventing an intent.

**Verified end to end** against a running API and Postgres: the link opens with
no token; the roster marks taken names; a claim issues a 64-character token
stored only as a hash; a second claim on the same name is refused; a student from
another class cannot be claimed through the link; autosave survives a resume;
a forged token is refused; editing after handing in is refused; and the student
is told only that it was received — no score, because releasing a result is the
teacher's decision and correctness would leak the key to everyone still sitting.

**Objective questions really do mark themselves.** A student tapped a
multiple-choice and a true/false answer through the link; the teacher opened it
and got `12.00/12.00`, four questions auto-marked, four written ones left for
them, result honestly provisional.

### The finding that changes what comes next

**No teacher can currently create a question that self-grades.** The mock
generator refuses multiple choice, true/false, matching and fill-blank by
design — its own note says they "need distractors or factual statements that
cannot be derived from the curriculum text alone" — and the question editor can
change a question's body but **not its type**. Those four types are exactly the
ones Tier 1 grades.

So shipped alone, this link collects typed answers that the teacher still marks
entirely by hand. It removes transcription, not marking. The two
self-grading questions proved above had to be inserted directly into the
database, because no route can make one.

That moves **real question generation from "next" to "the thing that makes this
pay off"**, and it is why the auto-grading path was proven now rather than
assumed later.

### Migrations

Applied locally; production needs both:

```sql
ALTER TABLE evaluations ADD COLUMN share_code text UNIQUE;
CREATE UNIQUE INDEX attempts_evaluation_student_unique ON attempts (evaluation_id, student_id);
```

The index will fail if any student already has two sittings for one exam. Check
before running it, and resolve the duplicates rather than dropping the index —
it is the only thing preventing the classroom race.

## The seed deploys itself now, 2026-08-25

Production went live with `level_scales` empty. Nothing had ever run
`seed-assessment.mjs` against it — the same gap as the schema, one layer up.

The failure that exposed it was three screens from its cause. `POST
/evaluations` looked up the system default scale, found none, and stored
`level_scale_id = null` without complaining. The evaluation was created, the
questions generated, the exam published — and only at answer entry did
attempt creation refuse: **"No level scale is configured for this
evaluation."** Every step in between reported success.

**Two fixes, and the second is the one that matters.**

- `POST /evaluations` now returns 409 `no_level_scale` instead of storing a
  null scale. An error belongs where its cause is.
- The API's `startCommand` runs the seed before the server, on **every boot**.
  It is idempotent and matches on natural keys, so re-running never duplicates
  and never overwrites a school's edited thresholds.

**The seed could not run on a server until now**, which is why it never had.
It began `delete process.env.DATABASE_URL` then forced the repo-root `.env` —
correct locally, where the point is that a stale shell variable must not aim a
seed at the wrong database, and fatal on Render, where there is no `.env` and
the environment *is* the configuration. It now forces the file only when the
file exists. Both directions were checked: with a `.env` present a deliberately
bogus `DATABASE_URL` in the shell was ignored, and with no `.env` the
environment was used.

**A seed failure stops the boot rather than being swallowed.** That is the
intended trade. Every route needs the database anyway, so a server that cannot
reach it has nothing to serve — and a silent half-configured start is precisely
what produced this bug.

**Verified**: `pnpm --filter @workspace/db run seed:assessment`, the exact
command the start line runs, against a worktree with no `.env` and the URL in
the environment. The guard was tested both ways against a running API —
`201` with a default scale present, `409 no_level_scale` with it switched off,
and the local scale restored afterwards.

175 api-server tests, 772 mobile, 0 failures.

**Production still needs the seed run by hand once**, because the fix only
takes effect on the next deploy and the rows are already missing. The SQL is
the same four statements the script performs; the backfill matters as much as
the insert, since evaluations already created carry a null scale and will keep
refusing until it is filled in:

```sql
UPDATE evaluations
SET level_scale_id = (SELECT id FROM level_scales WHERE scope = 'system' AND is_default = true LIMIT 1)
WHERE level_scale_id IS NULL;
```

## Marking is reachable from the class, 2026-08-24

Everything built today — hand marking, paper exams, next steps, class gaps —
was reachable **only** through the tool catalog. A teacher standing on
«Grade 10 - A», looking at their own three students, had no path to "mark their
paper" at all. Found by opening production and looking: the class screen offers
the note pencil and the remove ✕, and nothing else.

**A third tab: الامتحانات**, beside الطلاب and الموارد. Each row is an exam with
«صُحّح 12 من 26», or «مسودّة — انشره قبل إدخال العلامات» when it has not been
published. Tapping a published exam goes straight to its student list — the
marking screen; tapping a draft goes to the editor, because there is nothing to
mark yet.

**`markedCount` counts `attempt_results`, not attempt status.** An attempt sits
in `needs_review` while it carries real marks — status answers "is it
finished", and the question on this row is "how many are done".

**Attaching is the teacher's decision, and happens in the class.** The `+`
opens a sheet of the teacher's exams that are in no class. Same reasoning as
materials: nobody knows which section a paper is for while writing it, and a
class picker in the authoring flow would demand that answer too early.

**The unattached list is filtered server-side** (`?classId=none`), not by
fetching everything and filtering in the client. Client-side filtering is what
would let an exam already attached to *another* class look attachable here,
turning a silent move into what reads as an add.

**One nullable column, `evaluations.class_group_id`**, `ON DELETE SET NULL` —
archiving a class must not delete the exam record. Same shape and same
reasoning as `saved_materials.class_group_id`, rather than a second pattern for
the same relationship. `evaluation_assignments` is still untouched: it has
carried this shape since Phase 4 with no writer and supports many classes per
exam, which is more than anyone has asked for. The accepted cost, as with
materials, is that a paper used with two sections gets duplicated.

**Detach distinguishes "not provided" from "null".** `PATCH /evaluations/:id`
checks `=== undefined`, not truthiness — treating null as absent is exactly the
bug that made attach work and detach silently do nothing before `pickDefined`
existed. Verified: `{}` → 400, `{classGroupId: null}` → 200 and the column
actually clears.

**Verified end to end** against a running API, Postgres and the web build:
`?classId=` and `?classId=none` include and exclude correctly and move together
when an exam is attached; attaching to a class the teacher does not own is 404,
not 403, so it never distinguishes "not yours" from "not there"; the exam
outlives its detach; `confdeltype = 'n'` confirmed on the foreign key. The tab
renders «الامتحانات — 2 امتحانات» and both row states: «صُحّح 1 من 1» for a
published exam and the draft notice for an unpublished one.

175 api-server tests, 758 mobile, 0 failures; typecheck clean across all three.

**Needs one migration before it works anywhere.** Applied to local dev already;
production needs it after this merges:

```sql
ALTER TABLE evaluations ADD COLUMN class_group_id uuid
  REFERENCES class_groups(id) ON DELETE SET NULL;
```

**Deliberately not built:** a per-student exam history. Tapping a student still
only edits their note. That is the natural home for a sitting's comment as
history, and the answer to the two-notes overlap — `students.teacher_note` (the
running note on the child) and `attempts.teacher_comment` (one paper) now both
exist and a teacher meets two boxes that look alike. Worth a decision, not a
silent merge of the two.

## What the class missed, 2026-08-24

The results dashboard showed a class average and a level distribution. Nothing
anywhere aggregated objectives across students, so after marking thirty papers
the app could say what each individual was weak at — thirty times — and could
not answer the question the teacher actually has: **what is this class weak
at.** That is the one that changes what happens in the room tomorrow.

`GET /evaluations/:id/insights` sums `attempt_results.objectiveScores` across
every marked attempt.

**Marks-weighted, not a mean of percentages**, and this is the whole point.
Twenty students who each lost 1 of 2 marks and one who lost 9 of 10 are not the
same picture; averaging their percentages ranks the class's real problem below
a rounding error. Summing earned over available keeps the objective that
actually cost the class the most at the top — the same rule `scoring.ts`
applies inside one attempt, applied a level up. Pinned by a test where the two
orderings **disagree**: 55% costing 12 marks must lead 20% costing 2, because
ordering by percentage would send the teacher to reteach the cheaper one.

**Two numbers per objective, deliberately.** The class percentage, and how many
students were below the line on it. They diverge exactly where it matters —
"62%, 14 of 26 students below" is a reteach for the room, "62%, 3 students
below" is three conversations — and showing only the first hides which.

**Only marked attempts count.** An unmarked attempt carries an empty objective
breakdown; letting those in would drag every class percentage down as the
roster grows, and "the class is at 31%" would silently mean "you have not
finished marking".

**No rule was restated to build this.** `splitGapsAndStrengths` was extracted
from `scoreAttempt` and is now shared, and `recommendationsFor` was narrowed to
the three fields it actually reads (`Scored`) so the class aggregate — which
has no level, no competencies and no single student — runs the same rules
rather than a parallel copy. A second copy of either would drift, and then one
student's gap and their class's gap would be decided by different rules.

Class recommendations are **computed per request, not stored**: the
`recommendations` table is keyed by attempt, a class has no attempt to hang
them off, and they change the moment one more paper is marked.

**Verified end to end** against a running API, Postgres and the web build.
Three students, two objectives: a 2-mark objective everyone half-missed (50%,
3 marks lost) and a 10-mark one everyone lost 6 on (40%, 18 marks lost). The
class view returns `15/36 = 41.67%` and leads with the 18-mark loss. Before any
marking it returns zero students, zero objectives and no recommendations rather
than a zeroed-out class. The dashboard renders «ما الذي فات الصف» with both
numbers per objective and a «جهّز ورقة عمل للصف» button — whose presence is
itself proof the grade/subject scope resolved, since it is hidden rather than
shown-and-wrong when it does not.

175 api-server tests, 758 mobile, 0 failures; typecheck clean across all three.

**One flake worth knowing:** an api-server run taken immediately after
`pnpm build` reported 164 tests and one failure, then 175/0 on two consecutive
re-runs. The lower *count* is the tell — suites had not loaded yet. The
existing "run build before test" caveat is about `dist` being stale; this is
the narrower race of testing while it is still being written.

## Marking now says what to teach next, 2026-08-24

`recommendations` has been a table since Phase 4 with nothing ever writing to
it. Marking produced a percentage, a level and a per-objective breakdown, and
then stopped — at exactly the moment the teacher is asking "so what do I do
tomorrow". This writes it.

**Rule-based only, and that is the floor rather than a placeholder.** Every
recommendation here is arithmetic over marks the teacher entered, so none of
them carries a `confidence`: a number there would imply it might be wrong the
way an AI judgement can be. When AI enrichment lands it writes rows with
`generatedBy: 'ai'` beside these and the two stay distinguishable — the same
reason `grader` exists on a mark.

**Gaps are not re-derived.** `scoring.ts` already decides what counts as a gap
and orders them by *marks lost* rather than percentage — a 55% objective worth
12 marks costs more than a 20% one worth 2 — so `recommend.ts` consumes
`score.gaps` instead of restating the threshold. Two copies of that rule would
drift and then disagree about the same attempt. Measured on a real attempt: a
20%/8-marks-lost objective leads a 50%/2-marks-lost one, which is the ordering
a teacher's evening actually needs.

Below 30% an objective is not weak, it is untaught, so it comes back as
**reteach** rather than as more drilling. Every set with a gap also gets one
**reassess** on the costliest one: without it the loop never closes — the gap
gets taught and nothing ever checks whether the teaching worked.

**The panel is never empty for a marked attempt.** A student who did well gets
extension work on their strongest objective. "Nothing to do" is not useful to
tell a teacher, and a blank panel reads as broken rather than as praise. The
one case that needed care is the middling attempt — everything between the gap
line and the strength line clears neither list — which falls back to the best
objective on the paper. An attempt nobody has marked yet gets nothing at all:
advice off zero evidence is noise sitting where a real answer will go.

**Recommendations are rewritten on every recompute, not appended.** They are a
statement about the marks as they now stand, so yesterday's "reteach this"
must not survive beside a mark the teacher has since corrected. Verified: a
question corrected from 2/10 to 10/10 dropped its two rows and re-pointed the
reassessment at the remaining gap, leaving two rows stored, not five. Only
`generatedBy: 'rule'` rows are cleared, so future AI rows will not be lost
every time one mark is edited.

**"Build a worksheet" opens the generator already scoped to the exam's grade
and subject**, resolved from the evaluation — `GET /attempts/:id` now carries
`gradeId`/`subjectId`/`bookId` for exactly this. When either cannot be resolved
the button is not rendered at all, because a tool that opens offering grade-1
material for a grade-10 gap is worse than one that does not open. Reassessment
items carry no button: the answer to "re-test this" is another evaluation, not
a worksheet.

**Verified end to end** against a running API, Postgres and the web build.
Before marking: no recommendations. After four marks: `review(20%, -8)`,
`practice(50%, -2)`, `reassess(20%, -8)`, costliest first. The panel renders in
Arabic with the objective text, the evidence line («50٪ — خسر 2 علامة») and the
worksheet button — whose presence is itself the proof that the scope resolved.

169 api-server tests, 753 mobile, 0 failures. Typecheck clean across all three
projects — `main`'s `exportNotebook` breakage was fixed by `9f680b5` landing in
PR #103, so that entry below is now historical.

## Exams the app never wrote, 2026-08-24

Hand-marking (below) only reached exams Iqraa generated. A teacher's own paper
— the one they set, photocopied and handed out last week — could not be entered
at all, because an evaluation's questions could only come from the generator.
This adds the other source.

**No question text.** The paper has it. What the app takes is one row per
question: marks, objective, competency. That is the minimum needed to mark it,
score it, and afterwards say which objectives the class is weak on — and asking
a teacher to retype thirty questions the app will never display would be the
fastest way to make sure nobody uses this.

`PUT /evaluations/:id/questions/paper` replaces a draft's questions with the
grid. Rows land as `open_ended` with an empty body and `gradingMode: 'manual'`
— the honest type, since nothing here can be marked automatically and the
deterministic pass therefore leaves every question alone for the teacher.

**Three things are rejected rather than smoothed over**, each with the row
index so a thirty-row grid does not send the teacher hunting:

- **A zero-mark question.** It can never move the score, so it would sit in the
  paper looking like evidence of something.
- **An objective outside the evaluation's scope.** Every downstream answer to
  "what should I reteach" keys off the objective.
- **A missing competency.** `competency.ts` is explicit that a question's
  cognitive demand is *not* its objective's, and that inheriting it yields an
  evaluation which is half Understanding, half Application and nothing else.
  The form defaults the field so a long grid stays fast to fill; the server
  will not invent it. Deriving it here would have removed the choice and
  quietly flattened every breakdown.

**Publishing had to learn about this.** The publish check validates each
question's body against its type — a prompt, options, an answer key — so a
paper exam was unpublishable for failing to contain content it was never given
(four `Question N: Prompt is empty` blockers). `isPaperQuestion` now exempts it,
keyed on **the body being empty**, not on `source === 'teacher'`: a hand-written
question that does carry its own text is still validated like any other. The
exemption is "there is nothing here to check", not "a teacher wrote it".

The answer sheet drops the student-answer box for these questions too. There is
no prompt to show and nothing to transcribe — the paper is the answer — so the
card is the mark and the comment.

**Verified end to end** against a running API and Postgres: all four rejection
cases return 400 with `invalid_paper_grid` and the offending row; a 4-question,
12-mark paper saves as `open_ended/manual/teacher`; sending the grid twice
leaves four questions, not eight; editing after publish is 409; and marking it
runs `2.00/2.00` → `3.50/5.00` → `6.50/8.00` → `7.50/12.00 (62.50%)
provisional=false status=graded`, with per-objective scores of 70% and 57.14%.

**The competency breakdown reported "not enough evidence" for all four** — one
question each, and `MIN_QUESTIONS_PER_COMPETENCY` is 2. That is the sufficiency
rule working, not a bug: a four-question paper cannot support a competency
picture, and saying so is better than printing four percentages off one
question apiece. Worth knowing before anyone reads a short paper's blank bars
as a fault.

161 api-server tests, 733 mobile, 0 failures.

**Typecheck is not clean, and not because of this branch.** `main` references
`exportNotebook` / `exportNotebookSub` in `ExportMenu.tsx`, `slides.tsx` and
`lesson-flow.tsx` while `i18n.ts` defines neither, so `pnpm run typecheck`
fails with four errors on `main` itself and on anything branched from it. A
revert exists on `feat/exports-and-chemistry-s2` (`9f680b5`) and has not
landed. Nothing on this branch touches those files.

**No longer true (checked 2026-08-24, `main` at `1bb904b`):** `i18n.ts` now
defines all four keys in both languages, and `pnpm run typecheck` is clean on
`main`. Left in place rather than deleted — this file's habit of recording a
problem and never its fix is the thing worth not repeating.

## Figures are joined to curriculum lessons by a checked-in map, 2026-08-25

`figuresForLesson(kbLessonId)` in `services/bookFigures.ts` answers the
question the app actually asks. 18 of the 19 book lessons that carry figures
are joined to a `KB_LESSONS` id.

**The join is a file, not a runtime match, because the two datasets disagree
about lesson boundaries.** The book splits composition, inverse and radical
functions into separate lessons where the curriculum merges them into one;
the book opens unit 1 with «حل معادلات خاصة», which the curriculum does not
carry at all, so every later unit-1 lesson sits one place lower than the
number the book prints. Title overlap scored **0.67** between «Inverse
Function» and the merged lesson — convincing enough to ship, wrong enough to
file a figure under a lesson about something else.

**Half the misses were an alphabet problem.** Many curriculum lessons carry an
Arabic title only, so English-to-English matching could not see them at all:
«Polynomial Functions» ↔ «اقترانات كثيرات الحدود», «Adding and Subtracting
Vectors» ↔ «جمع المتجهات وطرحها», «Inverse Function» ↔ «الاقتران العكسي» —
that last one an exact match to a *different* lesson than the 0.67 English
candidate. Automatic matching proposed 11; reading the Arabic settled 7 more.

**Two extraction bugs found on the way:**

- A lesson title can run to a second line («Trigonometric Ratios for Angles» /
  «between 0º and 360º»); keeping only the last span kept only the tail, which
  then matched nothing.
- `u{n}_l{m}` in the curriculum matches the number the book PRINTS in every
  unit except unit 1. Worth knowing before anyone tries to derive the join
  arithmetically.

The one unmatched lesson stays unmatched: its figures are extracted, indexed
and simply never asked for.

**Not on a slide yet.** `figurePath()` returns a repo-relative path rather
than an imported asset, because how these reach a running app — bundled by
Metro or served over HTTP — is unsettled, and baking one answer in would make
the other expensive.

Verified: `pnpm run typecheck` clean; `artifacts/mobile` 823 tests / 0 fail
(8 new, asserted against the real extracted data rather than fixtures — a
fixture would only agree with itself).

## Each figure knows its unit and lesson, 2026-08-25

`index.json` now carries `unit`, `lesson`, `lessonTitleEn` and
`lessonStartPage` beside the page number, so a figure can be found by the
lesson it belongs to rather than by where it happens to sit in a PDF.

**Lesson openers are typeset, so they are detectable.** «الدرس» at 20–22pt in
the top band, the lesson number at 40pt+, the title beneath. The English title
is the one kept: the Arabic spans come out of the PDF with their diacritics
reordered and their letters unjoined («حُّلُ ُمُعادالٍتٍ»), so they cannot be
matched against anything, while the English line is clean ASCII.

**Three traps, each of which produced confident wrong answers:**

- **RTL puts the number before the word.** The running header extracts as
  «21  1 الوحدة», so `الوحدة\s*(\d+)` matches nothing on those pages and
  quietly carries a stale unit forward — it reported unit 10 for a unit-1
  page, with no error anywhere.
- **The header lags on a lesson opener.** Reading the unit off the opener
  filed every unit's *first* lesson under the preceding unit. The unit is now
  read from a page inside the lesson.
- **The book's unit numbers are not a sequence index.** Each book restarts
  its lessons at 1 while the units run 1-8 across the year, so numbering by
  position would have labelled figures with units the book does not use and a
  teacher looking for «الوحدة 5» would have been shown unit 1. The printed
  number is what is recorded.
  **Corrected 2026-08-25:** this entry used to say "semester 1 prints units
  5–8; semester 2 prints 1–4". That was the *filename* talking. Units 1-4 are
  semester 1 — see the 2026-08-25 entry below.

**Verified by content, not by counting.** `math-s2` p021 (circle + line) lands
in «Solving a System of Linear and Quadratic Equations»; p028 (circle +
parabola) in «Solving a System of Two Quadratic Equations»; the s1 hyperbolas
on p020–p024 in «Rational Functions». The lesson each figure was filed under
describes the mathematics in it.

| Book | Figures | Placed |
| --- | --- | --- |
| math-s1-student-book | 39 | 39 |
| math-s2-student-book | 17 | 16 |
| chem-s1-student-book | 4 | 0 |

The unplaced `math-s2` figure is on a unit-project page ahead of lesson 1,
which is correct.

**Chemistry is deliberately unplaced.** Its book uses a different opener
layout, and a loosened detector found exactly one lesson — filing all four
figures into a single lesson spanning fifty pages, titled with that lesson's
«الفكرة الرئيسة» line rather than its name. An outline yielding fewer than
three lessons is now refused outright: a wrong lesson reads exactly like a
right one, so nothing is better.

**Still to do:** match `lessonTitleEn` to a `KB_LESSONS` id, and render the
figure on the slide. Nothing in the app reads any of this yet.

## Book figures come out of the NCCD PDFs, 2026-08-25

The equation solver below draws every curve a stem states algebraically. The
books also print circles, 3-D solids, vector diagrams and scatter plots that no
equation in the stem describes, so those have to come from the book.
`scripts/extract_book_figures.py` cuts them out.

**A figure is vector drawing operations, not an embedded image.** The books hold
only ~74 rasters across 150 pages and those are photographs; every graph is
drawn with paths. So the script seeds on a pair of axes, clusters the drawing
rects around it, and renders that region at 160 dpi.

Two mistakes worth not repeating, both caught by looking at the output rather
than reasoning about it:

- **A crossing is not a bounding-box overlap.** The first pass treated any long
  horizontal plus any long vertical as axes — which the four sides of a
  rectangle satisfy, so a «spot the error» page with two notebook-paper boxes
  came out as a graph. Each segment must now pass through the other's interior.
- **Never grow through text.** Growing by proximity over drawings *and* text
  chains out of the figure into the body prose and stops only at the page cap;
  **half** the first run swallowed most of a page. Drawings cluster; text is
  only ever admitted, never chased. That one change took the clean rate from
  roughly 18/42 to 31/39.

| Book | Figures |
| --- | --- |
| math-s1-student-book | 39 |
| math-s2-student-book | 17 |
| chem-s1-student-book | 4 |

`math-s2` p021 is the `x² + y² = 9` / `y + x = 5` system, p024 the
parabola-and-line, p028 the circle-and-parabola — the figures that prompted
this, recovered from the book rather than redrawn.

**Assisted, not automatic, and not yet wired to anything.** About one crop in
five still absorbs an adjacent exercise block, so the script writes a
`_review.png` contact sheet per book and nothing reads the output. A figure
printed beside the wrong question is worse than no figure — the whole lesson of
the check-slide work above — so the review pass is part of the design, not a
missing feature.

**Still to do:** review and prune the crops, map each surviving figure to a
lesson and an example, then render it on the slide. `index.json` records
`sourceId` + `pdfPage` per figure, which is what a mapping will key on.

## Equations the book actually writes now draw, 2026-08-25

Every graph in the Grade 10 book is a *system*, and the book writes systems in
general form — «x − y = 1», «4y − 8x = −21», «y − x² = 7 − 5x». The extractor
required the equation to open with a name (`y =`, `f(x) =`), so **not one of
them extracted anything**. A question could carry a complete, correct set of
equations and still project a blank slide; the drop guard then removed the
question, which was honest but not the outcome anyone wants.

**Solved with three evaluations, not symbolic algebra.** Anything linear in y
is `a(x)·y + b(x) = 0`, so substituting y = 0, 1, 2 as literals into the
*existing* single-variable compiler recovers it exactly:

    b = E(x, 0)      a = E(x, 1) − E(x, 0)      y = −b / a

The third evaluation is the guard, not a spare: `E(x, 2)` must equal `2a + b`,
checked at four different x. **That check is what keeps a circle a circle** —
«x² + y² = 5» is quadratic in y, fails, and returns null instead of being
flattened into a confident wrong line on a projector. Vertical lines (`a = 0`)
fall out the same way.

No renderer changed. A `PlotSeries` is sampled points, so a curve recovered
this way draws on screen, in the PDF and in the PPTX exactly like any other.

**All of a figure, or none of it.** `scanGraphCommands` now returns what it had
to refuse beside what it kept. «x² + y² = 5 و x − y = 1» yields one drawable
line and one circle this build cannot plot, and drawing the line alone under a
sentence describing both is a picture contradicting its own caption — so the
check keeps nothing and is dropped, exactly as before.

**`slideShowsVisual` asks the renderer, not the field.** It tested
`graphCommands.length > 0`; a command nothing can sample leaves a slide as
blank as no command at all, so it now calls `visualForSlide`. Without this the
circle case would have re-opened the original bug from the other side.

Measured against the four book figures:

| Figure | Before | After |
| --- | --- | --- |
| `y − x² = 7 − 5x`, `4y − 8x = −21` | nothing | both curves |
| `y = 2 + 0.12x − 0.002x²`, `y = 0.15x` | both curves | both curves |
| `x² + y² = 5`, `x − y = 1` | nothing | refused as incomplete |
| `x² + y² = 9`, `y + x = 5` | nothing | refused as incomplete |

**Still open — circles.** They are refused rather than drawn. On screen and in
the PDF a circle is cheap (angle-sampled points draw straight through the
existing polyline path), but the PPTX export plots against a *category* axis,
which cannot represent a curve whose x is non-monotonic — it would print a
distorted blob. Doing it properly there means a scatter chart or native
shapes, which is its own piece of work rather than a rider on this one.

Verified: `pnpm run typecheck` clean; `artifacts/mobile` 792 tests / 0 fail
(12 new), `artifacts/api-server` 175 / 0 fail.

## The graph guard missed «يمثل الرسم البياني», 2026-08-25

The fix below shipped, and the very next deck projected two more checks about
a graph that was not drawn:

> يمثل الرسم البياني خطين مستقيمين يتقاطعان عند النقطة التي تحقق النظام…
> يوضح الرسم البياني خطين مستقيمين متوازيين لا يتقاطعان أبداً…

`referencesShownVisual` required a noun **and a pointing word** — «الشكل
**الظاهر**», «الرسم البياني **أعلاه**». Neither of these stems has one.
**Arabic is verb-first**, so the claim lives in the verb instead: «**يمثل**
الرسم البياني…» states, as fact, that the class is looking at a figure, and
is wrong the moment it isn't — exactly what «الظاهر» does, with no
demonstrative anywhere in the sentence.

So the test is now two shapes, not one: pointing at a figure, or saying what
it depicts (يمثل / يوضح / يبيّن / يُظهر / يعرض / يصف, plus their تـ forms).
Neither of the two live stems names a plottable function, so both are dropped
rather than drawn — the same order the section below describes.

**Where the line sits in English.** The verb form requires `the`: «**the**
graph shows two lines» is a claim about this slide; «**A** scatter plot shows
ordered pairs» is a definition of what a scatter plot is. That sentence — in
`knowledgeBase.ts`, the stats lesson — was the *only* false positive in a
sweep of all 977 curriculum strings, and `the` is what tells the two apart.
Arabic needs no such guard: «الرسم البياني» is definite by construction.

**Method worth repeating:** the predicate was run over the real corpus rather
than reasoned about — 977 objectives, concepts, examples and rules — which is
how the one bad match was found. Before: 1 flagged. After: 0.

Verified: `pnpm run typecheck` clean; `artifacts/mobile` 772 tests / 0 fail
(7 new).

## A check that says «في الرسم البياني الظاهر» now has one, 2026-08-24

Reported from a live deck: slide 5 of a Slides Maker lesson read «في الرسم
البياني الظاهر، يلتقي المستقيمان عند النقطة التي تمثل حل النظام. حدّدوا
إحداثيات نقطة التقاطع…» — and there was no graph on the slide. The class is
told to read coordinates off a picture that is not there.

**Why the picture was missing.** `graphCommands` is the only thing that draws
a curve, and until now only `buildGraphSlide` ever set it — on a dedicated
`type: 'graph'` slide. A formative check is a `question` or `challenge`
slide, so a check could talk about a figure but structurally could not carry
one. The generator writes those stems anyway: it is asked for questions about
a lesson, not told what the slide will render.

**Two rules, in this order** (`lessonSlides.ts`, applied inside
`splitChecks` before `isCheckSlide` runs):

1. **Plot what the check itself names.** If the stem references a shown
   figure and its own text carries plottable functions, `extractGraphCommands`
   attaches them to that slide. `visualForSlide` was already type-agnostic, so
   the presenter draws the curves with no renderer change.
2. **Drop what cannot be rescued.** A check still pointing at an absent figure
   is not a hard question, it is an impossible one, so it never reaches the
   deck. The generator is asked for five and the deck places at most five, so
   in practice a dropped check costs a slide, not a section.

**The deck's own graph is deliberately not borrowed.** `opts.graphCommands`
comes from the lesson's rule and examples. Projecting that parabola under a
question about two intersecting lines would put a confident, wrong picture
beneath a sentence claiming it is the right one — worse than the blank slide
being fixed. Commands come from the check's own text or from nowhere.

**What the deixis test is for.** `referencesShownVisual` (classMedia.ts)
requires a noun *and* a pointing word — «الشكل **الظاهر**», «الرسم البياني
**أعلاه**», "the graph **shown**". Matching «الرسم البياني» alone would have
deleted every graphing exercise in the corpus, since «ارسم الرسم البياني
للاقتران» is an instruction to draw one, not a claim that one is on screen.

**Two adjacent gaps closed on the way:**

- `extractGraphCommands` could not match a leading unary minus, so
  `y = -x + 3` extracted nothing. Any two-line system with a negative slope
  was projected with one line silently missing — the same shape as the
  spaces-in-the-body bug found on 2026-08-19 ("Charts: generated from lesson
  text, refused by default").
- Neither export drew a plotted curve on a `question` or `challenge` slide,
  so a check carrying a figure would have printed without it. Both now do,
  with the option rows and answer card laid out around the plot. **Still
  open:** in PPTX a *plot* reaches only `graph`, `question` and `challenge`
  slides — a curve attached to a content slide draws in the PDF and on
  screen but not in the .pptx. Charts reach every slide type in both.

Verified after merging `main` (`1bb904b`): `pnpm run typecheck` clean;
`artifacts/mobile` 770 tests / 0 fail (12 new here), `artifacts/api-server`
161 / 0 fail.

## A teacher can mark a paper exam by hand, 2026-08-24

Grading was deterministic-only. Four of the eight question types mark
themselves; the other four (short answer, open-ended, problem solving,
practical task) had no grader at all, so an evaluation made of them scored
nothing and the app told the teacher so — "manual grading, which isn't built
yet". This builds it. It is the smallest slice that makes an exam on paper
markable in the app; uploading the paper itself is not in it.

**One column, two routes, no new tables.** Everything the marking needs was
already in the schema and unused:

- `PUT /attempts/:id/grades/:questionId` writes a normal grade row with
  `grader: 'teacher'`. Correcting a mark that already existed also appends to
  `grade_overrides` — the table that has existed since Phase 4 with nothing
  ever writing to it. A **first** mark on an unmarked question writes no
  override row: nothing was overridden, and recording an invented "was 0,
  unanswered" would put a claim about the student into an audit trail.
- `PATCH /attempts/:id` saves `attempts.teacher_comment`, the note on the
  sitting as a whole. Per-answer comments needed no column — they go in the
  grade row's `rationaleAr`, next to the mark they are about.

**Submit and hand-marking now compute the result through one function.**
`scorePersistedGrades` scores whatever grades are on record rather than only
what the caller just produced, so a teacher marking the last open-ended
question moves the percentage exactly as submit would have. `isProvisional`
and the attempt status both follow from the same count, which means marking
the last question is what flips a result from provisional to final — the
point of the feature.

**A teacher's mark survives a re-submit.** Submitting used to delete every
grade for the attempt and re-grade from scratch. Re-submitting is the normal
way to pick up a corrected answer, so that would have lost an evening's
marking to a button there was every reason to press. Only machine grades are
cleared now, and the deterministic pass skips a question the teacher has
already marked by hand.

**Two things deliberately not inferred:**

- **`unanswered` is never derived from a zero.** A zero can equally mean
  "answered, wrong". A teacher can send that verdict explicitly; nothing
  guesses it.
- **The badge under each mark reads the server's `grader` field**, not whether
  the box has a number in it. An automatic mark and a hand mark look identical
  once both are numbers in a box, and telling them apart is the entire reason
  the override trail exists. For the same reason the comment box loads back
  only a teacher's own comment — a machine rationale ("إجابة صحيحة") shown in
  the teacher's box would make them the author of a line they never wrote.

An out-of-range mark is **rejected, not clamped** — silently turning a typed
`50` into the question's max of `5` shows a mark nobody entered.

12 tests in `modules/assessment/__tests__/manualGrade.test.ts` (the mark
parser, the verdict derivation, and scoring from persisted grades). Typecheck
clean across all three projects; api-server 146 tests, mobile 723, 0 failures.

**The local column was applied 2026-08-24** as one explicit statement rather
than `pnpm --filter @workspace/db run push`, which diffs the whole local schema
and carries unrelated drift along with it — same reasoning as `class_group_id`:

```sql
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS teacher_comment text NOT NULL DEFAULT '';
```

Confirmed `text | nullable=NO | default=''::text`. **Production has not had it
yet** — this is not on `main`.

**Verified against the running system, not asserted.** A fresh API build on a
spare port, against the local Postgres, driven end to end: create class →
student → evaluation → generate (3 questions, 6 marks, all open-ended, so the
deterministic pass marks nothing) → publish → attempt → submit →
`provisional true, 0.00/0.00, 3 unmarked`. Then marking by hand, one question
at a time: `1.00/1.00 (100%)` still provisional → `2.00/3.00 (66.67%)` still
provisional → `3.50/6.00 (58.33%) provisional=false status=graded` on the
third. The flip happens on the last mark, which is the behaviour the whole
change exists for. Also checked: `awardedMarks: 999` → 400 `marks_out_of_range`;
`awardedMarks: ""` → 400, not a silent zero; correcting a mark recomputes; the
overall comment round-trips; and **re-submitting kept the hand marks**
(`3.50/6.00`, still final). `grade_overrides` holds exactly **one** row for
three marks entered — the one correction, `1.00->1.00 correct->correct` with
the teacher's note. First marks wrote none, as intended.

**The screen was checked in a browser** (Expo web against that API): it renders
the mark box, the "من X" max, the «تصحيح المعلّم» badge and the performance
comment box, and it loads the saved marks (`1`, `1`, `1.5`), the per-answer
comments and the overall comment back into the right fields — with the machine
rationale correctly *absent* from the teacher's comment box.

**The full round trip was then confirmed in the browser by hand**: changing
question 2's mark from `1` to `2` and clicking away moved the card from
`3.50 / 6.00 · 58.33٪ · نامٍ` to `4.50 / 6.00 · 75.00٪ · متمكّن` — the level
crossing bands as a side effect of one mark, which is the behaviour a teacher
will actually rely on. The out-of-range guard was seen firing in the UI too
(«أدخل علامة بين 0 و 1» for a `2` on a one-mark question).

Automated browser drivers could not do this — typed characters append to these
React-Native-Web inputs instead of replacing, Backspace and select-all never
arrive, and synthetic `input`/`blur` events do not reach the handlers. Worth
knowing before anyone tries to write an e2e test for this screen: the commit
path is real, the automation is what cannot reach it.

**One thing that hand-test caught:** a refused mark stayed in the box after the
toast faded, so the field showed `6` while the record said `1`. `GradeDraft`
now carries `saved` — the last value the server accepted — and a rejected edit
reverts the box to it. A marking screen must never sit there displaying a mark
that was refused.

**Where this sits in the plan:** `docs/student-evaluation-module-plan.md` puts
manual marking inside Phase 7 alongside AI grading. This is the manual half
without the AI half — the review queue, rubric prompts and confidence policy
are untouched, and `grader: 'ai'` still has no writer.


## Every tool asks which class, and the toast stopped lying, 2026-08-24

**All seven save paths now offer the class sheet.** Previously only the two
lesson ones did. Same six lines each — `ClassPickerSheet` on the id `saveItem`
already returns — now in worksheet, quiz, activity, lesson-flow and slides too.
`slides` had no `savedId` of its own (saving a deck always creates a new one),
so the id is captured purely to ask the question.

**`updateItem` returns whether the change persisted, and callers check it.** It
returned `void` and swallowed every failure, which was harmless while the only
callers were favourite toggles that re-read the list afterwards. (**That premise
was wrong** — see the 2026-08-25 entry at the end of this file. Only two of the
six favourite callers re-read anything; the four generator screens held their
own optimistic star and never asked.) Attaching to a
class then started showing «حُفظت في العاشر أ» from a toast that fired no matter
what. Caught by the browser check below, which reported success against a
database where the material stayed unattached — the same shape as the `verified`
lesson this file already records: **fail closed, or label honestly, never
both.** All seven toasts, plus attach and detach inside the class screen, now
report what actually happened. Detach in particular no longer removes the row
optimistically, which made a failed detach look done until the next load put the
material back.

**A material with empty content no longer takes down the whole view.** `{}` is
truthy, so it slipped past the `!content` guard in `workspace/view.tsx` and died
inside whichever view mapped over an array that was not there. ponytail: this
only catches *empty* content; wrong-shaped content for its type still crashes.

### main was red when this started

`pnpm run typecheck` failed on `main` with four errors, none of them from this
work: the NotebookLM hand-off (PR #100) shipped `t('exportNotebook')` and
`t('exportNotebookSub')` calls for keys that were never added to `i18n.ts`.
Confirmed by stashing everything local and typechecking a clean tree. Both keys
are added here. **The Arabic copy is a guess at the original intent** — the row
opens NotebookLM so the teacher can upload the exported PDF for an audio
overview — so whoever wrote that feature should check the wording.

### Verified by driving the real UI

Generated a worksheet on معادلة الدائرة, saved it, and watched the sheet appear
(«لأي صف هذه المادة؟» listing العاشر أ · طالبان), picked the class, and got
«حُفظت في العاشر أ» — then checked the database, where `class_group_id` was
still null. That is what exposed the lying toast. The cause was a **stale API
process on :8080** started by another session before `class_group_id` existed,
which silently dropped the field; the current server on :8090 handles it. The
product bug was the toast, not the drop.

## The "..." menu in موادي never worked in a browser, 2026-08-24

Reported by the user, and true since the workspace screen was written: the
row menu was an `Alert.alert` with five buttons, and **`Alert.alert`'s handlers
never fire on react-native web**. Open, Edit, Duplicate and Delete were all
dead in the browser — which is the build teachers are demoed on — while looking
correct on a phone.

`services/confirm.ts` documents this exact defect and was written for it, but
it only covers two-button confirms; a five-action menu had nowhere to go. The
menu is now a `Modal`, inline in `app/workspace/index.tsx` rather than a shared
component, because it is the only multi-action `Alert.alert` left in shipping
code (the others are dev-only screens under `app/dev/`, plus one message-only
notice, which is fine — a plain `Alert.alert` with no buttons still displays).

**Verified by clicking it**, which is the point: menu opens, and عدّل actually
navigates to the worksheet editor.

### Attaching a material said the wrong thing when there was nothing to attach

Also reported. The sheet always read «كل موادك المحفوظة مرتبطة بصفوف أخرى» —
"they are all in other classes" — even for a teacher with nothing saved at all.
A `noSavedMaterials` string was written for that case and then never wired up.
`openAttach` now keeps the total count so the two cases can be told apart; they
look identical as a blank list and mean opposite things.

The sheet also offered exactly one way out — pick something that already
exists — so a teacher with nothing saved hit a dead end and a Cancel button. It
now offers **أنشئ مادة جديدة**, which goes to the tools tab.

### Two notes on how this was verified, because both cost time

- **`computer` clicks did nothing.** Browser input injection needs the pane
  displayed, and it was not, so every automated click silently fired zero DOM
  events. Real presses had to be dispatched from `javascript_tool`. Screenshots
  fail loudly in this state; clicks fail silently.
- **Reading the DOM immediately after a press shows the state before React
  re-renders.** This produced a confident wrong diagnosis — that the modal was
  opening and closing within one gesture — and a "fix" changing the backdrop
  from tap-to-dismiss to a plain `View`. Re-tested with a delay: the original
  backdrop was fine, and the change was reverted. Wait a tick before asserting
  a press did nothing.

## The parent message knows who the student is, 2026-08-24

`ai-tools/parent-message` composed a letter about a named child to their
guardian, and had no idea who the teacher's students were: you typed the name,
you typed the facts. It now offers **اختر من صفوفي** — class, then student —
via `components/ui/StudentPickerSheet.tsx`.

**What it fills in, and what it deliberately does not.** `parentMessage.ts`
carries a rule in its header worth honouring exactly: *the teacher supplies
every fact, this file supplies the register.*

- **Name** — filled from the roster. Saves the typing and the misspelling that
  reaches a parent. Typing it by hand still works.
- **The teacher's note** — offered into the *editable details box*, never into
  the message. It qualifies under the rule because the teacher wrote it; a
  sentence they typed last week is still theirs. Putting it in the box rather
  than the letter means nothing reaches a parent unread.
- **Marks — not pulled in, on purpose.** They are computed, partly by AI, and
  `attempt_results.isProvisional` exists precisely to mark the ones still
  awaiting teacher review. A number that lands in a parent's WhatsApp cannot be
  one the teacher has not confirmed. This is a decision, not an omission.
- **Gender — untouched.** The roster does not record it, and inferring it from
  a name would misgender a real child in a language that inflects for gender in
  almost every clause. The two toggles stay manual.

**The silent failure got a test.** Prefilling the details box can destroy work:
a teacher types three sentences about an incident, then picks the student to
attach the right name, and a naive prefill replaces what they wrote with last
term's note. Nothing errors and they may well send it. `seedDetailsFromNote()`
in `parentMessage.ts` is the rule — current text wins, whitespace counts as
empty — with four cases in `parentMessage.test.ts`, the overwrite one first.

`StudentPickerSheet` is deliberately **not** built on `ClassPickerSheet`, which
looks similar. That one closes itself when a teacher has no classes, because it
appears uninvited after a save. Here the teacher asked, so an empty roster has
to be said out loud. Same list, opposite behaviour on empty — sharing it would
need a prop that inverts the component's whole point.

Typecheck clean across three projects; mobile 733 tests, 0 failures.
No schema change, so nothing to run against production.

## A class remembers the child, and a lesson lands in the class, 2026-08-24

Two small follow-ons to the class/materials join below.

**Saving a lesson asks which class.** Attaching only from inside the class made
it a chore after the fact, and chores do not happen. There are seven `saveItem`
call sites with no shared funnel, so rather than adding a class field to seven
crowded forms, `components/ui/ClassPickerSheet.tsx` opens on the id a save
already returns. Wired into the two lesson-prep paths — `ai-tools/lesson-plan`
and `LessonPrepPanel` (the **حضّر خطة درس** flow). The other five tools are the
same six lines each now that the sheet exists; they were left out to keep the
change small, not because they are different.

The sheet has two silent exits, both deliberate: a teacher with **no classes**
is never asked (it closes itself on an empty list, which is why loading lives
inside the sheet rather than in each caller — otherwise all seven would have to
count classes before deciding to open it), and an **offline** roster closes it
too. The material is already saved by then; a failure dialog about a question
the teacher did not ask is worse than not asking.

**A note per student.** `students.teacher_note`, one running note, overwritten
— not a history. What a teacher wants at a parent evening is the current
picture, and a timeline of every edit is a bigger thing to build, read and
delete from. Tap a name in الطلاب to write it; the note replaces the register
number in the row's second line, because both at once makes a thirty-row list
unreadable and the note is what a teacher scans for.

`PATCH /students/:id` already existed and already scoped to the teacher, so
this is three lines there. The client's `renameStudent` — exported, called by
nothing — became `updateStudent`, which sends only what changed.

Note the distinction from `attempts.teacherComment`, added the same week by
separate work: that is a note about **one sitting**, this is a note about **a
child**, and it outlives any test. Both are legitimate; they will look
duplicative to whoever reads the schema next, hence this paragraph.

**Verified against the running system**: local API on :8090 against local
Postgres, nine checks — the note starts as `''` and never null, saves trimmed,
comes back on the roster response the class screen actually reads, survives a
PATCH that only renames, clears to `''` rather than null (the column is NOT
NULL), and **another teacher gets 404 rather than a write or a leak**.
Typecheck clean across three projects; api-server 139 tests, mobile 729.

**Where the check is thin:** no committed unit test guards the "empty note
means clear, absent means leave alone" branch — it lives in an Express handler
and the coverage above came from a live run, not from CI. If someone adds
`|| null` there the way `externalRef` has it, clearing a note will silently
stop working and nothing will fail.

**Production needs one column** before this ships:

```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_note text NOT NULL DEFAULT '';
```

## Materials belong to a class now, 2026-08-23

صفوفي and مساحتي were two islands. `class_groups` held names; `saved_materials`
held work; nothing joined them, so there was no answer to "what did I give
صف أ". The join had been *designed* — `evaluation_assignments` has carried
`studentId` XOR `classGroupId` plus a `dueAt` since Phase 4 — but nothing in the
repo has ever written or read that table. It is still dead. This took the
smaller path instead.

**One nullable column.** `saved_materials.class_group_id`, `ON DELETE SET NULL`
— archiving a class must not take the teacher's worksheets with it. One class
per material; a worksheet used with two sections gets duplicated, which the
existing `POST /workspace/items/:id/duplicate` already does (and the copy
deliberately starts unattached, or both copies would land in the same class).
Promote to a join table only if teachers ask for shared materials.

**Attaching happens in the class, not at save time.** A class picker in the
save flow would mean editing seven generator screens; `app/classes/[id].tsx` now
has two tabs (الطلاب / الموارد) and the materials tab attaches from the
teacher's unattached saved items. `GET /workspace/items?classId=` filters.

**Three things fixed on the way, because they were in the path:**

- `workspace.ts` had no equivalent of the roster's 42P01/42703 detection, so a
  database missing this column would have answered "Failed to save item" —
  exactly the useless 500 the [roster incident](#roster-storage--a-production-incident-worth-remembering)
  was about. `isSchemaMissing` moved to `src/lib/schemaMissing.ts` and both
  routers use it; workspace now answers 503 with
  `code: "workspace_storage_unavailable"`.
- The PATCH allowlist was nine hand-written `!== undefined` lines. Detach sends
  `classGroupId: null`, and the next person to add a nullable field and reach
  for truthiness makes attach work while detach silently does nothing. Replaced
  with `pickDefined()` in `src/lib/pickDefined.ts` — five tests, one of which is
  `null`. Still an allowlist, not a spread: `req.body` reaching `.set()` whole
  would let a client rewrite `userId`.
- `app/workspace/index.tsx`'s `typeLabel()` ended in `return t('quizType')` and
  its edit route ended in `'/ai-tools/quiz'`, so a saved **activity** or **deck**
  displayed as "اختبار قصير" and opened the quiz builder, which cannot rebuild
  either. Colour/icon/label/route now come from `constants/materialKind.ts`,
  shared with the new class tab; `slides` has no form-driven editor so it no
  longer offers Edit at all.

**Verified against the running system**, not asserted: local API on :8080
against local Postgres, ten checks — save starts unattached, attach sets it,
`?classId=` includes and excludes correctly, detach-with-null actually clears,
a PATCH that omits the field leaves it alone, duplicate starts unattached, and
the material outlives its class. `confdeltype = 'n'` confirmed on the FK.
Typecheck clean across all three projects; api-server 139 tests, mobile 725.

**Production has the column, 2026-08-23 8:13pm.** Applied by hand in the Neon
SQL editor rather than by `pnpm --filter @workspace/db run push`, deliberately:
`push` diffs the *whole* local schema against production and applies everything
it finds, so an unrelated local drift rides along unseen. This was one additive
change, so it went in as one explicit `ALTER TABLE` plus the FK. Verified in
the same session — `is_nullable = YES`, `confdeltype = n`. Matches local.

That leaves only the merge: `main` is the only branch that deploys, so the
column is live and the code that uses it is not.

**The process gap is still open.** Nothing about this deploys schema
automatically; it was a human remembering. That is the same standing landmine
recorded on 2026-08-19 and again here — and this entry is being written *with*
its fix rather than three days later, which is the actual lesson from last
time.

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
direction-neutral document. In an RTL document `flexDirection: 'row'` is
already reversed, so `'row-reverse'` cancels back to visual LTR, while
`textAlign: 'right'` (a physical value) stays put.

Measured on the deployed page, children of one such row:
`dir="rtl"` → x = `[913, 998]` (ascending → visually LTR, the bug);
no `dir` → x = `[288, 211]` (descending → visually RTL, correct).

`LanguageContext.applyRTL` now asserts `dir="ltr"` on web at boot and on every
language change. `app/+html.tsx` does *not* work here — `web.output` is unset,
which means `single`, and Expo ignores the custom shell in that mode.

**Where the `dir="rtl"` actually came from (corrected 2026-08-24).** This entry
and the comment in `LanguageContext` both said the deployed
`<html lang="ar" dir="rtl">` was something "this repo cannot produce", and
blamed the host. It is ours. `scripts/inject-pwa.mjs:39` rewrites the tag after
`expo export`:

```js
html = html.replace(/<html lang="en">/, '<html lang="ar" dir="rtl">');
```

`render.yaml:100` runs `build:web`, which is `expo export && inject-pwa`, so
every deploy ships that tag. `expo export` alone really does emit a bare shell —
which is why dev never reproduced it — but the deploy does not stop there.

So the build asserts `dir="rtl"` and the runtime asserts `dir="ltr"` about four
hundred milliseconds later, on every cold load. Nothing is "reintroducing" the
attribute; two parts of this repo disagree, and the later one wins.

Re-measured 2026-08-24 against a local `pnpm run build:web` (identical to what
Render runs), driving the real bundle in Chromium:

| | login-screen row `x` | reading |
| --- | --- | --- |
| as shipped (`dir="ltr"`) | `[578, 0]` | descending → visually RTL, correct |
| forced `dir="rtl"` | `[0, 702]` | ascending → visually LTR, the bug |

The August finding still holds exactly. Forcing `dir="rtl"` swaps the login
page's two halves and moves the envelope and lock icons to the far left of
right-aligned Arabic fields — the half-mirrored signature, reproduced on
current `main`.

No flash: the served `dir="rtl"` is replaced before any text paints (measured
both unthrottled and at 6× CPU throttling with a slow-network profile), so the
disagreement costs nothing visually today. It is a correctness and maintenance
problem, not a rendering one — but it is why nobody could say where the
attribute came from.

If the per-component flips are ever replaced by real document-level RTL, the
injector and `applyRTL` have to change in the same commit that deletes them —
all three, not two.

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
  - **Production is 25/25 as of 2026-08-23**, `ai_generations` included, run
    against Neon with `verify-schema` before and after the push (24/25 → push →
    25/25). Superseding the line below, which was correct when written.
  - **Production verified 24/24 on 2026-08-22**, via the same `to_regclass`
    check run in the Neon SQL console. The 2026-08-19 outage was fixed that
    same afternoon — Neon's query history shows "find missing tables" at
    1:36pm, a schema migration at 1:41pm, and a re-check at 1:42pm. Both this
    file and CLAUDE.md went on asserting the outage for three days afterwards,
    because the fix was never written down. **The process gap is real and
    still open; that particular outage is not.**
  - **Confirmed on 2026-08-23, by the push finding drift the check had
    reported as clean.** Against a 24/24 production database, `push` still had
    two changes to make: unique constraints on `class_groups.join_code` and on
    `class_memberships` that the schema declares and production did not have.
    Both were applied without truncating (the prompt offers truncation as the
    safe-if-it-fails option; with one row in each table a unique constraint
    cannot be violated, so it was declined). Nothing was wrong — but it is a
    worked example of the gap the next line describes, found by accident rather
    than by asking.
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

## Deleting a slide before presenting did not stick, 2026-08-23

Reported by a teacher: the trash icon on the slides outline appeared to do
nothing. Reproduced on the deployed site — delete three slides and the
outline kept two of them, then «اعرض على الشاشة» opened a deck with a
*different* count from the outline the teacher had just approved (17 rows
listed, 16 slides presented).

`removeSlide` and the slide editor both rebuilt the deck from the `deck`
captured at render time (`setDeck({ ...deck, slides })`) and targeted slides
by index. Neither holds while a deck is still being built: the photo, video
and verifier passes land seconds after the outline first renders and each
replaces the deck object, so the captured `deck` is stale and
`insertVideoSlide` shifts every index after the insert. Two edits in that
window overwrite each other, and an index picked before the video landed
deletes whatever moved into that position.

Both now update functionally (`setDeck(cur => …)`) and target the slide
*object*, not its position — identity survives the enrichment passes because
they rebuild only the slides they touch. `withoutSlide` in `lessonSlides.ts`
owns the drop-and-renumber, tested including the insert-ahead-of-it case.

**Not done:** there is no *hide* — only delete, which is permanent for that
deck. A teacher who deletes a slide and changes their mind regenerates. If
hiding is wanted, it is a per-slide flag the presenter and the exporters all
have to honour, which is why it was not smuggled into a bug fix.

## The exports were still the old dark deck, 2026-08-23

Reported with two screenshots side by side: the projector showed cream, teal
and magenta; the .pptx the teacher opened afterwards was near-black with an
indigo accent. Same deck, two products — and the handout is the half that
leaves the room.

The palette existed three times: in `presentation.tsx`, in `deckSlidesHtml.ts`
and in `exportPptx.ts`. The screen was restyled to the warm palette; the two
exporters kept their private copy of the dark one, and nothing connected them,
so the drift was invisible until someone put the two on one desk.

`services/deckTheme.ts` now holds the palette and `slideTypeAccent`, and all
three import it. The projected values won because that is what a room full of
people looks at. Swapping the background also meant re-checking everything
that assumed a dark one: white titles are kept only over a hero photo or the
flat accent divider (`.deck-on-photo`), cards went from `rgba(255,255,255,.03)`
to solid white, and the correct MCQ option lost its `color:#fff` — on the new
light tint that was white-on-cream.

**Not verified:** the .pptx was not opened in PowerPoint. The colour inputs are
shared now and the file builds, but nobody has looked at a rendered slide.

## The escape deck never said what the codes were for, 2026-08-25

Reported with two screenshots of the same deck on the deployed site. Both
reveal slides were headed «تم فتح الكود!» — the placeholder title from the
prompt, copied through verbatim — and slide 7's code rendered as a barely
visible speck. That speck was `٠`: Arabic-Indic zero is a dot, and at 48px
green on a light board it is nothing. Nobody watching could tell what the
number was, or what they were supposed to do with it.

The second half of that is the part worth writing down. **The unlock code has
no mechanism behind it.** There is no input, no validation, no gate — `grep
unlockCode` finds it in the prompts, the mock decks, and one render block in
`presentation.tsx`, and nowhere else. The lock is fiction; the code is
something students copy onto paper and read back at the end. That is a fine
design, but a deck that never explains it leaves a class staring at a digit
with no idea it is theirs to keep. Both language decks now open with a
"كيف نلعب؟" / "How to Play" slide that says so outright, including the line
that there is nothing to type the digits into.

The codes themselves are fixed in two places, because a prompt asks and does
not guarantee:

- The escape prompts (both languages) now state the code rules explicitly —
  one digit ١–٩, never ٠, distinct per challenge, reveal title naming the
  digit, summary listing the full sequence — and the worked example carries a
  real code instead of a repeated `"5"` the model was evidently copying.
- `lib/escapeCodes.ts` repairs what still comes back wrong: a code that is
  zero, empty, multi-character or duplicated is replaced; a reveal takes the
  code of the challenge before it; a generic reveal title is rewritten to name
  the digit. A valid, distinct code is left exactly as the model wrote it. It
  runs on every classroom activity and is a no-op for decks with no
  `unlockCode`, since `activityType` is model output too and is not always the
  one that was asked for. 18 tests, including the `٠` case that started this.

When it does repair a code, it also rewrites the summary's full-code line —
a stale summary sends the class out with the wrong final answer, which is
worse than the digit it was fixing.

`PROMPT_VERSION` bumped to `2026-08-25.1`: the prompts changed in a way that
makes previously recorded generations stale, which is what that constant is for.

**Not verified:** this has not been run against a live model. The prompt half
is unproven — what is tested is the repair layer, which is deliberately the
half that does not depend on the model complying. The mock decks (used under
`DEMO_MODE`) were updated by hand and are 13 slides now, not 12.

**Not done:** the how-to-play slide is a second `type: 'intro'` rather than a
new slide type. A `rules` type would theme separately and let the exporters
treat it differently, but it would touch the type union, `deckTheme`, the
presenter and both exporters — too much to smuggle into this.


## The favourite star lit whether or not anything was saved, 2026-08-25

Reported from the hosted web build, on a quiz that had just been saved: tapping
**أضف إلى المفضلة** did not read as having done anything, and tapping it again
read as nothing at all.

Two independent faults, both of them the same shape as the `verified` lesson
this file already records — **fail closed, or label honestly, never both.**

**`toggleFavorite` could not fail.** It returned `void`. On the signed-in path
it fell through to the local store on any non-OK response, and for a signed-in
teacher the material is normally not *in* the local store — so `if (item)` was
false and the whole toggle evaporated, resolving successfully. Every caller
flipped its star optimistically and toasted «أضفتها إلى المفضلة» regardless.
Nothing was written; the next reload put the star out. It now returns
`{ ok, isFavorite }` and takes the desired state as an argument, which also
removes the read-then-write round trip that let two taps both read "off".

**The toast could not repeat.** `Toast`'s animation keyed on `visible` alone.
Tapping the star twice set `visible` true when it already was, so the effect
never re-ran: the second message swapped into a view already fading out, and
the first sequence's `onHide` then unmounted it. Star on, star off, one
confirmation — which is exactly what was reported. It keys on the message now
and restarts the sequence, and a superseded run no longer fires `onHide`.

**One hook, not six handlers.** `hooks/useFavorite.ts` owns the star for the
four generator screens and the workspace viewer; the decision itself lives in
`services/favorites.ts`, which is dependency-free and covered by
`services/__tests__/favorites.test.ts`. A failed write puts the star back where
it was — not on `result.isFavorite`, which says nothing when the write did not
land — and says `favoriteFailed`. A second tap is sequenced rather than
blocked, so "add it, then change my mind" still works while the first request
is in flight. The labels moved into `i18n.ts` (`addToFavorites`, `inFavorites`,
`favoriteShort`, `favoriteFailed`); the workspace viewer's star had a fixed
label — «مفضلة» whether or not it was one — and now changes with the state.

**Not verified:** neither the offline nor the server-error path was exercised
against the running system. The honest-failure branch is unit-tested and the
green path is not observably changed, but nobody has watched a real 500 put the
star back.

## The mission slide looked like it had failed to load, 2026-08-25

Reported from a live deck with a screenshot: slide 1/10 of an escape challenge
showed «مهمتكم», three lines of text, a countdown reading 00:58 — and two
thirds of the projector empty below it. The question asked was whether
something was supposed to be there.

Nothing was. `SlideView`'s cover branch (`presentation.tsx`) draws title, rule
and body and stops; hint, answer, unlock badge, visuals and the teacher-panel
button are all conditional and an intro slide carries none of them. But the
cover was top-aligned inside a full-height stage with a `contentContainerStyle`
that did not grow, so a short slide sat under the header with the rest of the
screen blank. It now grows to the stage and centres (`flexGrow` on both the
scroll content box and the cover). Content taller than the stage still starts
at the top and scrolls — checked in a react-native-web harness at 1400×760,
both cases, because the app itself is behind a login this container cannot pass.

The timer was the real defect. Every generation prompt specifies
`durationSeconds: 0` for intro slides (`api-server/src/routes/generate.ts`) and
nothing enforced it, so a model that emitted 60 got a live countdown — and an
amber-then-red bar — against a paragraph that asks the class to do nothing yet.
`timerSecondsForSlide` in `services/presentationUtils.ts` now returns 0 for the
slide types that are read out rather than worked through (intro, reveal,
summary, divider, scoreboard, podium); the presenter and the slides outline
both ask it instead of reading `durationSeconds` raw, so the editor cannot
advertise a timer the projector then refuses to run.

Clamped at display time on purpose: the deck keeps what the model produced, so
saves and exports are unchanged and the clamp cannot corrupt a stored activity.

## The book's figures are on the slides now, 2026-08-25

`figuresForLesson()` had no caller — 54 extracted figures sat in
`knowledge-base/` and nothing asked for them. They now appear as media slides
in the lesson deck, after the rule and before the interactive graph.

**Bundled, not served** (the decision that was open): `require()`d at build
time, so figures need no network and no API. The web export puts them in
`dist/assets/__knowledge-base/…` as 54 separately-hashed files — 1.7 MB
fetched lazily by the browser, *not* added to the 4.87 MB JS bundle. The
"3.3 MB into the bundle" cost quoted while deciding was wrong twice over: the
figures are separate files, and only the 54 reachable ones ship (chemistry's
four and every unmapped maths figure are excluded).

### Traps found doing it

- **`knowledge-base/` was outside Metro's `watchFolders`.** It is not a
  workspace package, so Expo's default config never watched it, and Metro
  refuses to resolve anything outside `projectRoot + watchFolders`. This was
  a latent break, not a new one: `bookFigures.ts` already imported JSON from
  there, and the *first screen to import it* would have failed the bundle.
  One line in `metro.config.js` fixes both the JSON and the PNGs.
- **`require('x.png')` is not the same value on web and native.** Metro's web
  output makes each asset a module exporting `{uri, width, height}`; native
  yields an opaque numeric id for the asset registry. The generated map was
  first typed `Record<string, number>` — a lie on the platform that actually
  ships. `bookFigureUri` now forks on the shape, and the type says both.
  Found by reading the built bundle, not by reasoning about it.
- **The map has to be generated.** Metro resolves assets from *string
  literals* at build time, so `require(figurePath(f))` cannot work.
  `scripts/gen_book_figure_assets.mjs` writes one literal `require()` per
  figure. Its failure mode is silent — extract figures, forget to regenerate,
  and they are simply absent — so `bookFigureAssets.test.ts` asserts the map
  covers exactly the reachable set and that every path exists on disk.
- **A capped count, deliberately.** Lessons carry up to six figures (median
  three). `BOOK_FIGURE_MAX = 2` — six would be six slides of looking at
  pictures in a 45-minute period.

### What this deliberately does *not* do

Figures are **not** attached to check questions that mention a graph. A
lesson's figure is not necessarily *the* figure a given question means, and
putting a plausible-looking wrong picture beside a question is the exact
failure the draw-or-drop guard exists to prevent. Those questions are still
dropped unless their own text carries plottable equations.

Every figure slide is captioned «كتاب الطالب · الفصل … · صفحة ٢١». The page
number is the point: it is what lets a teacher hold the projected figure
against the printed one. A picture on a projector with no provenance is
indistinguishable from one the AI invented, and these are the opposite.

### Not verified

Native PDF export (`Print.printToFileAsync`) is handed a bundled-asset URI
that may not resolve inside that HTML. Web — the surface that actually
deploys — is fine: the print iframe inherits the page's base URL, so the
root-relative `/assets/…` path loads, and `waitForImages` already blocks the
print until it has.

## Three during-class tools came back, and an exam dead end closed, 2026-08-25

Reported by trying to use the app: «تحدي الهروب» could not be found anywhere,
and the class screen's «أرفق امتحانًا» dialog said "no exams yet — create one
first" while offering nothing but Cancel.

**The escape challenge was not missing, it was parked.** The 2026-08-18 audit
above narrowed both menus to five tools and hid `classroom` — the only door to
the escape, bingo, relay and gallery-walk formats. Their routes still resolved,
so the formats were reachable by typing `/ai-tools/classroom`, which is the same
as unreachable. `game` and `activity` are un-parked with it rather than leaving
one of the three doors open; everything else the audit parked stays parked, and
`toolCatalog.test.ts` now pins both lists so either change has to be deliberate.

That audit's other finding is fixed rather than carried forward: **`activity`'s
description was backwards.** It promised "an in-class experience… not a
printable worksheet"; `ActivityOutput` has no slides, the screen has no route to
the presenter, and it renders a document with an export menu. Now described as
what it is — a step-by-step plan to print or follow. The live-on-screen claim
belongs to «الفصل التفاعلي», which is on the same menu now, so the two could not
go on contradicting each other.

**The exam dialog was the materials dialog's bug, un-fixed.** The materials
sheet grew a dashed «أنشئ مادة جديدة» row for exactly this reason; the exams
modal never got one. It has one now, routing to `/evaluations/new`. The
`createNewExam` label already existed in `i18n.ts` and was wired to nothing —
somebody meant to build this button and stopped.

Only `toolCatalog.ts` changed. `homeAiTools.ts` — the second catalog behind
Smart Templates and the "قد يفيدك أيضاً" panel — still has `activity` and
`game` disabled, deliberately: that is a suggestion surface, not a menu, and
re-enabling it is a separate decision.

**Not verified:** none of this was seen in a browser. The catalog and the
dialog are unit-covered, but nobody has clicked the new «الفصل التفاعلي» card
or the new exam button on a running build.

**Still open:** the three-doors question the audit deferred is now more visible,
not less — `slides`, `game` and `classroom` all build a `ClassroomActivity` and
land on the same presenter, and all three are on the menu. PostHog is still the
way to answer which door teachers use.

## Stop the model writing questions about graphs it never gives, 2026-08-25

The draw-or-drop guard keeps a question about an absent graph off the
projector, but dropping is a last resort — the question is still lost, and
the three slides that started this all drop rather than draw. The real fix is
that the model never writes one.

Nothing in this repo writes «يمثل الرسم البياني خطين مستقيمين…» — grep found
that phrasing in no generator, no mock and no question bank. The model
produces it unprompted, and the prompts said nothing about figures at all. So
the rule now sits in `SYSTEM_AR` / `SYSTEM_EN`, which every generator passes
(lesson-plan, worksheet, quiz, classroom-activity), rather than in the one
builder that got caught.

**The latin-variable clause is the load-bearing half.**
`extractGraphCommands` matches `[a-z]` terms, so «y = 2س + 1» extracts
*nothing* and its question is dropped exactly as if it had named no equations
at all. A rule saying only "state the equations" would have produced
dutifully compliant questions that still showed an empty slide — the original
bug wearing a better sentence. Verified before the rule was written:

| stem | commands extracted |
| --- | --- |
| «… y = 2x + 1 و y = -x + 4» | 2 |
| «… y = 2س + 1 و y = -س + 4» | **0** |
| «مثّل المستقيم ص = 2س + 1» | **0** |

This does not touch the display convention: س still appears at display time,
well after extraction.

The rule also says what to write *instead* («وإن أردتَ سؤالًا بلا معادلات
فاكتبه بلا أي إشارة إلى رسم»), because without it the model's cheapest escape
is to stop writing graph questions altogether.

### Held together by a comment, not a compiler

The prompt lives in `api-server` and the extractor in `mobile`, and no build
step checks that the rule's worked example still parses.
`classMedia.test.ts` asserts the exact sentence yields two curves, and
`figureRule.test.ts` asserts the prompt still contains it and carries no
Arabic maths variable. Both carry a comment pointing at the other. If the
prompt's example ever changes, change them together.

## The two maths books were labelled backwards, 2026-08-25

Every one of the 54 figure captions named the wrong semester. A unit-1 figure
was captioned «الفصل الثاني» and vice versa — so the one claim those captions
existed to support, *that a teacher can hold the projected figure against the
printed page*, sent them to the wrong book first.

**The maths PDF filenames in `attached_assets` are backwards.** The file
called `10th_grade,_math,_1st_semester…` says «الفصل الدراسـي الثانـي» on its
own title page and contains units 5–8; the one called `2nd_semester` says
«الفصل الدراسي الأول» and contains units 1–4. `BOOKS` took each source id from
the filename, so the ids were swapped, and from there the wrong semester
flowed into every caption.

The teacher-guide filenames are *correct*, which is part of why this was hard
to spot: only the two student books are misnamed.

### What was and was not broken

- **The figure→lesson join was right all along.** It was built by reading
  lesson titles, not filenames, so every figure sat on the correct lesson. The
  only wrong thing was the book label. Nothing failed, no test went red, and
  the figures on screen were the right figures — which is exactly why it
  shipped.
- **Captions were wrong on all 54.** Fixed by correcting the ids; the caption
  code itself never needed changing.

### The guard

`check_semester` now refuses to write an index whose units contradict its
source id, using an invariant the extractor already parses reliably: Grade 10
maths teaches **units 1–4 in semester 1 and 5–8 in semester 2**. Verified by
feeding it the exact mistake that shipped —

```
math-s1-student-book: semester 1 should hold units 1-4, but the book's own
headers say unit(s) [5, 6, 7, 8]. The source id and the PDF are mismatched.
```

`bookFigures.test.ts` asserts the same invariant from the app side: a
`kbl-math-s1-…` lesson may only be illustrated from the semester-1 book.

Reading the PDF cover text was tried first and abandoned. «الأول» extracts as
`ا أ ل و ل` — the alef and hamza-alef swapped, the same RTL reordering that
made the unit header «21  1 الوحدة» in the first extraction pass. Deriving the
semester from unit numbers avoids the Arabic text layer entirely.

### Correction to an earlier entry

The 2026-08-25 extraction entry above claimed "semester 1 prints units 5–8;
semester 2 prints 1–4". That was the filename talking, and it is now corrected
in place. The unit numbering itself was never the problem — the books really
do print 1–8 across the year.

## Chemistry's figures are placed now, 2026-08-25

The chemistry book yielded no outline at all, so its four figures sat
extracted and unreachable. It has one now — 3 units × 2 lessons, matching
`KB_LESSONS` exactly — and the figures are joined to their lessons. 58 of the
60 extracted figures now ship, up from 54.

Every fix below was found by running the detector over the book and counting,
not by reading it. The maths outline is asserted byte-identical throughout.

### Four reasons it found nothing

- **«الدرس» usually carries a fused vowel mark** — `ُالدرس` — so an exact
  string comparison matched only pages that happened to also emit a clean
  copy of the span. That was 1 opener in 6. Compared bare now.
- **One opener sets «الدرس» at y=77** where its siblings use 47, so a `< 60`
  ceiling found five of six. The ceiling is 90; the *number* band stays tight,
  since that is what distinguishes an opener from a page merely mentioning
  the word.
- **The chemistry book has no running «الوحدة N» header at all.** Maths
  repeats the unit on every page; chemistry states it only on unit openers.
  The header search was therefore matching the *next* unit's opener, which
  falls inside the last lesson of each unit — labelling «النموذج الميكانيكي
  الموجي» (unit 1) as unit 2, every unit's final lesson one too high. Openers
  are now skipped during the header search, and a book with no header takes
  its unit from the last opener at or before the lesson.
- **What sits in the English-title band is a SECTION heading.** Chemistry's
  first section — «الخصائص الفيزيائية للمركبات الأيونية» / "Physical
  Properties of Ionic Compounds" — sits under a lesson actually called «الصيغ
  الكيميائية وخصائص المركبات». An English line sharing that band with Arabic
  is refused, and chemistry is identified by its Arabic title instead, which
  matches the curriculum's word for word.

### A widening that cost 14 titles

Reaching for chemistry's English title, the band went from `< 115` to
`< 140`. Chemistry gained nothing — it prints its English lesson title at
10pt, letter-spaced, and not on every opener — while maths **silently lost 14
of 32 titles**, because the wider band caught Arabic body text and the
section-heading rule then rejected the line. Caught by diffing the maths
outline against a snapshot taken before the change. The ceiling is back at
115.

That snapshot is the method worth keeping: capture the known-good outline
first, then require it byte-identical after every change to a shared
detector.

### Verified

Re-running extraction leaves **every one of the 60 PNGs byte-identical**, so
the diff is metadata only. `build:web` exports 58 figures, 4 of them
chemistry.

## Every generation failed on a cold API, and the fallback was suppressed, 2026-08-25

Reported from the deployed site: «بطاقة الخروج», «تحقق سريع» and «تحدي الهروب»
all failed with «تعذر إتمام العملية. حاول مرة أخرى.» — three different activity
types, one identical dead end.

**The fallback that exists for exactly this was being skipped.** `postJSON`
enforced its 18s ceiling by calling `controller.abort()`, so a timeout reached
`generateWithProvenance` as an `AbortError` — indistinguishable from the
teacher pressing Cancel. That branch deliberately refuses to substitute mock
content (answering "stop" with a fabricated worksheet is the substitution the
module exists to prevent), so it rethrew, the builder caught, and the teacher
got an error with nothing behind it.

**And the ceiling guaranteed the timeout.** `iqraa-api` is a free Render
service: it sleeps after ~15 minutes idle and takes 30-60s to answer the first
request after that — `render.yaml` says so in its own header. 18s is below that
floor, so the first generation of any session timed out, was classified as a
cancellation, and failed with no fallback. Every tool, every activity type,
every time the API had gone to sleep. The timeout is now a `TimeoutError`
(name, not class — the check is name-based) and the ceiling is 45s.

**A second crash on the same path**, found while confirming the first:
`applyClassroomSetup` called `.some` on `activity.materials`, but `materials`
is model output and the server's usability check requires only `activityName`
and `slides` (`REQUIRED_FIELDS['classroom-activity']`). A generation that
omitted it threw *after* a successful API call — a complete, usable deck
discarded on its way to the projector over a field nobody reads. It tolerates
a missing list now.

Ruled out first: the mock generator builds all seven activity types cleanly
(escape 13 slides, quick-check 6, error-detective 8, exit-ticket 5, bingo 10,
relay 6, gallery-walk 7), so the fallback would have produced a deck had it
been reached.

**Not verified:** the API could not be reached from the sandbox the diagnosis
was done in (the agent proxy 403s both Render hosts), so neither fault was
observed live — both are read off the code path, and the fixes are unit-tested
rather than confirmed against the running system. If «تعذر إتمام العملية»
survives this, it is a third cause, not these two.

**Worth noting for whoever sees it next:** `builder.tsx` catches with a bare
`catch {}` and shows one generic string, which is why three different faults
looked like one. The diagnosis took a code read because the screen carried no
information at all.

## One material, several sections — and a picker you can change your mind in, 2026-08-25

Asked for directly while testing: the «لأي صف هذه المادة؟» sheet should let a
teacher pick more than one class, then confirm or leave.

**Landed on top of the same-day rework** that gave the sheet a current-class
tick and a Clear row (PR #145). Both were wanted and neither was dropped: the
rows became checkboxes, the material's current class starts ticked, and Clear
stays its own row rather than becoming "untick everything and confirm" — an
empty confirm reads as a no-op, not as a delete.

**Multi-select is opt-in per caller (`multiple`).** The three material sites
use it; `app/evaluations/[id]` deliberately does not. An evaluation holds one
class and has no copy semantics, so checkboxes there would let a teacher tick
three and silently keep one.

**The old sheet committed on touch.** Tapping a row attached the material and
closed — one class, no confirm, no way back except attaching from inside each
class afterwards. A teacher who teaches the same lesson to three sections had
to save it three times, and a mis-tap was final. Rows are checkboxes now, with
«احفظ في الصفوف المحددة» and «ليس الآن»; the confirm is disabled rather than
hidden while nothing is ticked, because a button that appears on first tick
does not tell you ticking is what the sheet wants.

**What "several classes" means here, and what it does not.**
`saved_materials.class_group_id` is a single column. Its schema comment says a
material used with two sections has to be duplicated, and to *"promote to a
join table if teachers actually ask for shared materials"*. A teacher asked; the
join table did not happen in this pass. **Chosen deliberately:** the schema is
deployed by hand (`pnpm --filter @workspace/db run push`) and this file already
records what a release that adds a table and skips that push does to
production, with teachers on the live build right now.

So the first class keeps the original and every class after it gets a copy,
through the `POST /workspace/items/:id/duplicate` the schema comment points at.
First rather than last on purpose: the teacher is looking at the material they
just made, and it should stay theirs rather than silently becoming copy three.
**The copies are independent** — editing صف أ's worksheet does not change صف ب —
so the toast says «نسخة مستقلة لكل صف» rather than implying one shared thing.

**The save screens each held one line** — `ok ? savedToClass(name) :
saveToClassFailed` — which cannot describe two of three landing. (PR #145 had
already folded eight of those sites into `MaterialClassField`, which is why
this touched four callers rather than eight.) Both the
policy and the message moved into `services/classAttach.ts`, which imports no
react-native and so is loadable by `node --test`: the same split, for the same
reason, as `generateWithProvenance` living outside `RemoteAIService`. 13 tests
cover the ordering, the de-duplication of a class picked twice, partial
failure, and Arabic number agreement at 2 / 10 / 11.

**Still open — the join table.** This makes the common case work without a
migration; it does not make a material genuinely shared. A teacher who edits
one copy will reasonably expect the others to follow, and they will not. That
is the argument for promoting it, and it is now a known cost rather than a
hypothetical one.

**Not verified:** not seen in a browser. The policy and the message are unit
tested; nobody has ticked three real classes on a running build and confirmed
three materials arrive.

## Homework cites real exercises now, 2026-08-25

Decks have always been able to say «تمارين ١-٦ صفحة ٧٢». Until now that was
generated, which is to say invented: the page and the numbers pointed at
nothing. `scripts/extract_book_exercises.py` reads the ministry's own exercise
books, and the homework slide carries the result — **31 of 32 maths lessons**,
attributed to the book on its own line.

### Read from the books, checked three ways

- **Exercise numbers** are set BOLD at ~10-11pt, in STIXGeneral in the
  first-semester book and UniMath in the second. Matching on weight and size
  rather than family is what makes one rule fit both. The rule is then
  self-checking: an exercise book numbers from 1 with nothing skipped, so a run
  with a gap means the rule caught something else and the page records nothing.
- **The join is arithmetic** — `u{n}_l{m}` is the number the book prints, with
  unit 1 shifted by one — and arithmetic is exactly how you cite a confidently
  wrong page. So the test walks every derived id, asserts it exists in
  `KB_LESSONS`, and asserts the curriculum's own title matches the book's.
- **The figure map was deliberately not reused.** It encodes the same
  relationship but only carries rows for lessons that have a figure, so joining
  through it covered 18 of 32 and dropped the rest silently.

### Three ways two ministry documents disagree about a title

Found by running the check, and each fixed with an exact rule rather than a
similarity score — a 0.67 near-miss once almost filed a figure under the wrong
lesson:

| | book | curriculum | resolved by |
| --- | --- | --- | --- |
| `u1_l1` | …System **of** Linear… | …System**:** Linear… | Arabic matches |
| `u5_l2` | الاقترانات النسبية | **قسمة كثيرات الحدود و**الاقترانات النسبية | containment — the curriculum merges lessons |
| `u4_l3` | قانون **جيوب** التمام | قانون **جيب** التمام | named exception; both are real names for the Law of Cosines |

### Two things it deliberately does not do

- **A separate detector, not a widened one.** The exercise books set the lesson
  number at y≈52 and y≈64 where the student-book detector requires y<60.
  Loosening that shared band would have been the second time in this repo that
  accommodating one book silently broke another — the first cost 14 of 32
  maths titles.
- **The generated homework is left alone.** It may still contain a reference
  the model invented, which is why the real one is on its own line and says
  «من كتاب التمارين». Telling the generator not to invent exercise references —
  the same treatment the figure rule got — is the obvious follow-up.

### Coverage

31 of 32 book lessons join to a curriculum lesson. The one that does not is
«حل معادلات خاصة», which the curriculum deliberately omits. The two exponent
lessons the curriculum *does* carry have no exercises in the 2026 book, and
correctly get silence rather than an invented page.

## Pacing filled in from the teacher guides, 2026-08-25

Every maths lesson now carries a period count and every unit a total, read
from the «عدد الحصص» column of the guides' مخطط الوحدة tables.

**The data was mostly right already.** Six of the eight units matched the
guide exactly, which is the useful finding: this was four nulls, not a
rebuild.

| filled | value | from |
| --- | --- | --- |
| `u1_lab` periods | 1 | TG s1 p15, «معمل برمجية جيوجبرا» row |
| `u6` total | 14 | TG s2 p83 |
| `u8_l5` periods | 4 | TG s2 p157 |
| `u8` total | 21 | TG s2 p157 |

A null here is invisible rather than loud — a pacing plan just omits the
lesson — which is why `curriculumPacing.test.ts` now asserts there are none.

### Reading the table

The plan is a table whose columns are only distinguishable by x-position: the
lesson number sits at x≈598 (right edge, RTL) and its period count at x≈81.
Pairing by shared y recovers the column. The unit total is the last number in
the same column, labelled «مجموع الحصص».

### The gap is the unit's own work

A unit's printed total always exceeds its lessons' sum, because the guide
counts the lab, the project and the end-of-unit test in the same column.
Six units sit at exactly 3 (project 1 + test 2), unit 4 at 4 — and unit 2 at
**7**, which is not a mistake but the divergence below, arithmetically
visible.

### Unit 2's periods were deliberately not imported

The teacher guide's «الدائرة» lists **five** lessons and a GeoGebra lab; this
curriculum carries four lessons and no lab — matching the student book and the
2026 exercise book, both of which print four. Same shape as unit 1: the guide
is the first *trial* edition and the outlier, except here the curriculum
followed the newer books.

Its per-lesson counts therefore do not map, and forcing them would put a
number on a lesson the guide was describing differently. The printed total
(20) is kept, the lesson counts are left as they were, and the unit carries a
`pacing_note` saying so — in the data, not only in a test, so the next person
editing the curriculum sees it.

## The page citation is now on screen, not just in the response, 2026-08-26

Live grounding was verified end to end on 2026-08-26: a real worksheet on
أوتار الدائرة, generated against the live API, reproduced named theorems from
the actual textbook page (confirmed against the printed book), and the
`/api/healthz/ai-budget` spend delta ($0.5678 → $0.6199) proved it was a real
model call, not the mock fallback. What that check could not do is what a
teacher does every time: the API has returned `sources: [{sourceId, titleAr,
page}]` since PR #140, and nothing on screen read it — verifying grounding
meant opening the PDF and matching a theorem by eye.

`LessonPlanOutput`, `WorksheetOutput`, `QuizOutput` and `ActivityOutput` (in
`services/ai/AIService.ts`) now carry an optional `sources?: GroundedSource[]`
field, mirroring the server's type. `GroundingNotice` — already rendered on
all four generator screens (worksheet, quiz, lesson-plan, activity) to say
whether a generation is anchored to the curriculum — gained a `sources` prop:
when the lesson resolved *and* the server actually attached book passages, a
second line prints each citation, e.g. «كتاب الرياضيات - الفصل الأول · صفحة
٣٥». When only the lesson resolved but no passages were found (most lessons
today — six of 78 documents are ingested), the line is silently absent; this
is the same distinction `groundingFor()` already draws server-side between
"a unit resolved" and "passages were found for it".

The formatting itself (Arabic-Indic digits, the `·` separator, the join for
more than one source) lives in `sourceCitationLine()` in `services/kbContext.ts`
rather than inside the component, so it runs under the mobile test glob
(`services/__tests__/**/*.test.ts`, which does not reach `components/`) —
`components/ui/*` has no test coverage in this repo and this file is not an
exception to that, but the pure formatting logic underneath it now is.

**Not verified visually.** This sandbox has no `OPENAI_API_KEY` and outbound
access to the production API is blocked (same limitation recorded when
`DEMO_MODE` was flipped, days earlier in this same thread) — `MockAIService`
never sets `.sources`, so there is nothing in this container that can produce
a screen actually showing the new line. `pnpm run typecheck` (all three
packages) and the mobile suite (975 tests, 0 failures) both pass. Confirm on
the next live generation that the citation line under the grounding banner
reads correctly, RTL included.

## Figures were being cropped through their own labels, 2026-08-26

Reported from a live deck with two screenshots: the tangents diagram on page
35 with «J» sliced down the middle at the right edge, and the circle on page
34 with «Q» cut off the top and «P»/«L» the bottom.

**The PNG was cropped, not the display.** Worth stating because the display
was the obvious suspect and was innocent: `MediaView` already used
`resizeMode="contain"`. Opening the extracted file settled it in one look —
the glyph was missing from the image itself.

`with_labels` admits a label only when 60% of it already sits inside the
figure. A point label just outside fails that, and then `MARGIN` cuts straight
through the glyph. `uncut_labels` now finishes any small label the crop is
*already slicing*.

### Why not just loosen `with_labels`

Because that admits text the crop never touches, which is how a figure grows
into the paragraph beside it — the failure that once swallowed most of a page.
The new step only extends a box through something it is already cutting: a
span the crop clips is part of the picture, one it does not touch is somebody
else's prose.

### The first threshold was inside the prose range

An 18%-of-page-width ceiling let a page of Arabic credits into a crop, because
Arabic extracts as many short spans and a character count would not have
caught it either. Measured against the books rather than guessed again:

| | width, as % of page |
| --- | --- |
| «J», «ZT», «360°» | 0.7 – 2.4% |
| shortest prose line near a figure | 12.4% |

The ceiling is 5%, in the gap, plus a 6-character limit. Both guards, since
either alone lets one of the two cases through.

### Bounded, and measured that way

Compared against the identical script with the step removed: **46 of 142**
maths-s1 crops grew, largest **+27pt**; **29 of 89** maths-s2, largest
**+21pt**. Never more than about one label.

That comparison also settled a false alarm. Against `HEAD` some crops looked
twice as wide — but the committed PNGs came from an earlier version of the
script, so the diff was against a stale baseline, not against this change.
Comparing two runs of the *current* script with only this step differing is
what isolates it.

## Tap a figure to enlarge it, 2026-08-26

A book figure is a diagram with point labels on it, and at slide size «J» is a
few pixels — readable on a laptop, not from the back of a classroom. Tapping
opens it full-screen over a near-opaque backdrop, dismissed by tapping
anywhere or with an explicit close button.

The backdrop is deliberately not opaque: the slide stays faintly visible, so
it reads as a zoom of this figure rather than navigation away from the deck.
The image keeps a white ground, because a line diagram on a dark backdrop
loses its strokes.

## The topic half of isMathContext stopped voting, 2026-08-26

Closes the gap the 2026-08-25 entry above ("Narrower than it was, and still
not fixed here") left open: a lesson correctly labelled with a non-math
subject could still get algebra questions, because the topic/lesson-text half
of `isMathContext`'s one shared regex could out-vote a correctly-passed
subject. Confirmed live, not hypothetical, against the real KB before
touching anything: 4 of today's 78 lessons false-positive-match the regex
today — 3 chemistry lessons whose text contains «معادلة» (chemical
*equation*, matched via «معادل») and one financial-literacy lesson matched
via «أسي». `generateWorksheet` for the real chemistry lesson «التفاعلات
الكيميائية» produced abstract algebra items before this change; it does not
after (checked directly, not just by the new tests below).

**The subject is now checked twice, in order, and the first real answer
wins.** `isMathContext` (`services/ai/mathPractice.ts`) first asks the KB
lesson itself — `getBookForLesson(kb)?.subjectId` — which exists precisely
because a book's subject is ground truth and a caller's string is a second
copy of it that can drift. Only when there is no KB lesson (an ungrounded,
free-text topic) does the caller's `subject` string get consulted at all, and
only when neither gives an answer does the old topic-text regex still run.
This is a different shape from the previous partial fix, which appended
`subject` into the same blob the regex ran over — additive, not a gate, so a
correct subject could still lose to the topic text. Now a correct subject
(or a resolvable KB lesson) always wins.

**The other half of the bug was a wiring gap, not a logic gap.**
`tryMathPractice` — the function every one of `generateWorksheet`,
`generateQuiz`, and `generateHomework`'s three core questions actually route
through — never received a `subject` argument at all, even after "the tools
carry the lesson's subject too" landed. `req.subject` was in scope the entire
time in all three generators; it just dead-ended at the top of each function
instead of reaching the ten `makeXXX_ar/en` question factories and the six
quiz wrappers underneath. Only `generateActivity`, `generateClassroomActivity`
and `generateHomework`'s optional *challenge* question threaded it through —
which is why the existing test for this bug
(`lessonPickFidelity.test.ts`, "the subject a deck is generated under") only
ever exercised `generateClassroomActivity` and never caught the worksheet/
quiz/homework-core gap. All sixteen functions and every call site now take
and pass `subject`; none of `prompts.ts`, the API routes, or any screen
needed to change — `req.subject` was already there, it just wasn't being read
past `tryMathPractice`.

**The existing test's premise flipped, on purpose.** Its `asMaths` case
mislabelled a real chemistry lesson's subject as `'Mathematics'` and asserted
the (old, buggy) result: algebra questions anyway. That assertion is now
backwards — a mislabelled subject on a lesson the KB can identify must no
longer win, so the test was rewritten to assert exactly that, plus a second
case (a topic with no KB match) confirming the caller-supplied subject still
governs when there is nothing else to check it against. New
`mathPractice.test.ts` tests `isMathContext` directly for the first time —
checked against a real regression before trusting it: 2 of 5 fail on the
pre-fix code, both the chemistry and financial-literacy false positives found
above.

Widening `APP_SUBJECTS` or `CurriculumSource['subject']` for a fourth subject
was not attempted here — the 2026-08-25 entry above already found both
self-guarding or deliberately held back, and neither changed today.

981 mobile tests pass (was 975), typecheck clean across all three packages.

## 46 of the 60 pending documents are read, 2026-08-26

The blocker recorded above ("63 of 78 documents are `pending` — a title and a
Drive id, no extracted text") and repeated again earlier today ("all 60
`pending` documents have no local file anywhere in this repo and there is no
Drive/S3 fetch mechanism") is now wrong on both counts. The user supplied the
Drive folder the manifest's `driveId`s already pointed at, and this session
has real Google Drive MCP access — a capability that simply was not checked
for before answering "no fetch mechanism exists."

**54 of 60 were downloaded and byte-verified against the manifest**, using
`download_file_content` per `driveId`. The tool caps a single call at 10 MB
and returns everything larger as a downloadable-once file on disk rather than
inline — both are treated as ordinary conditions, not failures: results over
the inline-token limit are saved by the harness to a local JSON file (`{id,
title, content}`, content base64) and decoded from there without ever putting
the base64 in this session's own context, and results over 10 MB are named
and left for later rather than retried into a wall. Six documents remain
unfetched:

| id | why |
| --- | --- |
| `math-s1-support-material`, `math-u1-answers-almasri`, `math-u1-answers-alkhatib`, `math-u2-answers-alkhatib` | 15–18 MB, over the tool's 10 MB ceiling |
| `math-loss-recovery`, `math-u1-summary-alkhamayseh` | repeated transient "MCP server session expired" across many retries — not a size or content problem, the same two ids failed at every position in every batch tried |

**Extraction caught two failure modes a first pass would have shipped
silently.** `extract-text.ts` already treats a PDF with no text layer as an
honest skip ("needs OCR"); two more shapes needed the same treatment, found by
running the corpus through the existing `extraction.test.ts` Arabic-density
check and refusing to accept a document just because `pdf-parse` returned
non-empty text:

- **Two files decoded to 28–37% raw control characters** (`math-foundations-melhem`,
  `math-geometry-formulas-melhem`) — pdf-parse reading an embedded font
  against the wrong cmap does not throw, it returns bytes. `assert.ok(text.length
  > 0)` alone would have called this a success.
- **Three files from the same author** (`chem-ws-bohr-tareq`,
  `chem-ws-reactions-tareq`, `chem-s2-month1-tareq`) **decoded to real Arabic
  in the wrong Unicode block** — Arabic Presentation Forms (isolated glyph
  shapes, U+FB50–FEFF) with each word's letters in reverse order, instead of
  the base Arabic block a shaped renderer would produce. Readable by a person
  who mentally un-reverses each word; unusable as a citation or as text handed
  to a model.

Both are now gates in `extract-text.ts` itself — a control-character fraction
over 5%, or more Presentation-Forms characters than base-Arabic characters —
so a future file with either defect is reported and skipped at extraction
time, the same as "no text layer," rather than silently marked `ingested`.

**The test that should have caught this only caught the first file
alphabetically.** `extraction.test.ts`'s Arabic-density check asserted inside
a loop over all extracted files; the first assertion failure throws, so once
`chem-s1-pack-almasri` (a real, correctly-extracted document — see below)
tripped the old per-page threshold, the two genuinely corrupted files sitting
later in listing order never got checked at all in that run. Rewritten to
collect every failure before asserting.

**The threshold itself was also wrong, for a document type the corpus didn't
have before.** The old check required 70% of a document's *pages* to
individually clear a density bar — calibrated on six continuous-prose
textbooks. `chem-s1-pack-almasri` is a real, cleanly-extracted teacher-made
study pack with legitimate blank divider pages and dotted table-of-contents
leaders (`denseFrac` 0.67, just under the old bar) — a real document, not a
bad extraction. Rewritten to measure Arabic density across the whole document
rather than per-page: the lowest ratio among all 46 genuine extractions is
0.32; the five rejected above measured 0.00–0.12. A 0.2 floor sits in that
gap with real margin on both sides.

**Grounding coverage moved from 45 to 53 of 64 lessons** — remeasured, not
estimated — because 7 of the newly-ingested documents carry `authority:
"nccd"` (the two chemistry activity books, the ministry remedial-program
material, the diagnostic test) and are therefore `quotable`, the same as the
original six books, and now contribute real passages alongside them.

**One more stale assumption, caught by a test that turned out to be checking
the wrong thing.** `grounding.test.ts`'s "cites only NCCD material" test
matched cited source ids against a hardcoded regex of the original six
books' filenames. It broke the moment a *legitimately* NCCD-authority
document outside that regex got cited — which is the correct outcome of
ingesting more NCCD material, not a bug. Rewritten to check the manifest's own
`authority` field instead of guessing at an id-naming convention.

**Two now-inverted directional tests, fixed in the direction reality moved.**
`bank.test.ts`'s and `mountOrder.test.ts`'s `bankStats`/`/bank/stats` checks
both asserted `pending > ingested` — true when written, false as of today
(57 ingested, 14 pending). Flipped, with the date and the reason recorded next
to each so the next person who has to flip it again knows this is a fact
about the corpus's reading progress, not an invariant of the code.

83 curriculum / 981 mobile / 275 api-server tests pass; typecheck clean;
`pnpm --filter @workspace/curriculum run verify` reports 0 errors (unchanged —
it checks the curriculum catalog, not the bank manifest).

### What's still not done

- The 6 documents in the table above.
- The 3 documents extraction genuinely cannot read without OCR
  (`math-remedial-part2`, `math-u2-summary-alkhamayseh`, `math-ws-systems-alhindi`)
  — no text layer at all, same class as the S1 teacher guide's LFS block.
- The 5 documents whose extraction is real but unusable, per the two new
  gates above — `math-foundations-melhem`, `math-geometry-formulas-melhem`,
  `chem-ws-bohr-tareq`, `chem-ws-reactions-tareq`, `chem-s2-month1-tareq`.

That's all 14 remaining `pending` entries accounted for. The manifest's other
7 non-`ingested` entries (6 `duplicate`, 1 `conflict`) are unrelated to this
pass — pre-existing and untouched. 78 total = 57 `ingested` + 14 `pending` +
6 `duplicate` + 1 `conflict`.

## `verify-curriculum` gaps: 14 → 7, 2026-08-26

Before touching any new grade, closed what was cheaply closeable in the
content gaps `verify-curriculum --gaps` already tracked for Grade 10.

**Math S2's 5 gaps were a data-shape bug, not missing content.**
`meta.source_books` was an array of two strings; the validator requires an
object (`isObj(meta.source_books)`), so it read as absent even though both
source books were named. Reshaped to `{ teacher_guide, student_book }`. The
four units' `total_periods`/`prior_knowledge` already carry the teacher
guide's مخطط الوحدة data (`pacing_source` says so on every unit) — that *is*
lesson-level provenance, it just had no `data_tier` field naming it. Added
`"data_tier": "lesson-level (teacher guide + student book)"` to all four,
matching the string chem-S1 already uses for the same tier. 0 gaps now.

**Finlit S1's `data_tier` gaps closed the same way, honestly downgraded.**
Its own `known_gaps` already said the student book carries no period counts
and a teacher guide "is unavailable." Checked whether that was still true —
listed the Drive folder directly (`Financial literacy G10`, two files: the S1
book already ingested and the S2 book already marked `conflict` for its
edition mismatch) rather than trusting the prose. No teacher guide exists.
So both units got `"data_tier": "book-level (student book only — no NCCD
teacher guide located for this subject)"` — a true, lower-tier label, not the
teacher-guide-backed tier math and chem carry.

**Not closed, on purpose — closing them would mean inventing content:**
- **5 chemistry gaps** (`تجربة استهلالية`, 3 in S1 + 2 in S2): the source
  book states no learning outcomes for these lab-intro lessons.
  `iqra_curriculum_g10_chem_sem1.json`'s own `known_gaps` already says so
  ("الكتاب لا يذكر نتاجات لها"). Writing outcomes not in the book would be
  exactly the "plausible-looking invention"
  `validateCurriculum.ts` says provenance exists to catch.
- **Finlit S1's 2 `prior_knowledge` gaps**: same reason — no teacher guide
  to source a prior-knowledge list from, and the student book doesn't state
  one. Left empty rather than filled with a plausible-sounding guess.

**Checked, not assumed, that the source PDFs are actually reachable.** Every
row in `g10_sources.json` carries a Google Drive `driveId`; this session has
read access to that Drive (confirmed by fetching one pending document's
metadata). That reopens the door on the two gaps that are genuinely blocked
on missing source material — chemistry S2 and financial-literacy's
figure/diagram grounding (18 of the 64-lesson gap tracked separately, not by
this script) — as a follow-up, not attempted in this pass.

`verify-curriculum`: 14 gaps → 7, all seven now the honest kind. 83
curriculum tests pass (unchanged), typecheck not run here (container has no
`node_modules` for `@workspace/curriculum` — pre-existing, unrelated to this
change).

## Grade 9 Math Semester 1 lands, in the data model only, 2026-08-26

The first real second-grade catalog since the id-collision scheme (2026-08-25,
above) was built to allow one. `lib/curriculum/src/catalogs/g9MathSem1.ts` and
`data/iqra_curriculum_g9_math_sem1.json`, mirroring `g10MathSem1.ts`'s shape
and tiering exactly: Unit 1 lesson-level (objectives, vocabulary, periods),
Units 2–4 title-only (real titles and order from the student book, no invented
content). Wired into `catalog.ts`'s `UNITS`/`LESSONS`/`BOOKS` alongside the
existing NCCD catalogs.

**Deliberately not exposed to any picker.** `INVESTOR_MVP_CURRICULUM` still
gates everything to `grade-10`; this PR does not touch `MVP_GRADE_ID` or
`MVP_BOOK_IDS`. Whether a second grade becomes visible alongside Grade 10 or
swaps it in is a product decision, not made here — confirmed by hand that
`getVisibleGrades()`, `getBooksForSubjectGrade('mathematics','grade-9')` and
`isCurriculumBookVisible('book-math-9-s1')` all still report Grade 9 as
absent/invisible with this change applied.

**Sourcing hit a real tooling limit, not a data-availability one.** The NCCD
Grade 9 Math source PDFs exist in Drive in the same volume as Grade 10's — full
S1 and S2 sets (student books, teacher guides, exercise books, answer keys,
remedial material). But both available Drive extraction paths cap out on large
files: `download_file_content` (raw bytes) times out above ~2MB for this
account, and `read_file_content` (Drive's own text extraction) silently
truncates — no error, the text just stops. The S1 student book (8.9MB, 151
pages) returned text through ~page 80; the 46MB teacher guide returned text
through ~page 51. Unit 1 was fully inside that window; Units 2–4 were not, so
they carry no lesson-level content — not because the source doesn't exist, but
because nothing available in this session could read that far into it.

**One real book-vs-guide conflict found and resolved by precedent, not by
authority.** The teacher guide's Unit 1 مخطط الوحدة lists four lessons,
including a "حل معادلات القيمة المطلقة ومتبايناتها" (absolute-value
equations/inequalities) lesson the student book's own table of contents does
not carry. Sided with the student book — same call as the Grade 10 circle-unit
precedent (2026-08-25 entries above) — but flagged as unconfirmed in the JSON's
`known_gaps` rather than asserted, because that Grade 10 case had a national
framework document to check against and this one does not.

`curriculumIds.test.ts`'s "produces ids no existing id already uses" test
asserted no synthetic Grade 9 id collides with anything in the catalog — true
by construction when Grade 9 was hypothetical, false now that it's real (a
Grade 9 lesson id matching its own synthetic candidate is the scheme working).
Rewrote it to scope the collision check to non-Grade-9 content, so it still
catches an actual cross-grade collision.

83 curriculum tests pass (was 83, one rewritten), `verify-curriculum`: 6 files,
78 lessons, 21 gaps (14 pre-existing + 7 new, all Grade 9 Units 2–4's expected
title-only gaps). Typecheck not run here (same pre-existing `node_modules` gap
as the entry above).

## The MVP grade lock is a set now, 2026-08-26

Settled the product question the previous two entries deferred: once a grade
is actually complete, does it join Grade 10 in the app, or replace it? Decided
**join** — a school has teachers across grades at once, and that's the shape
the roadmap in `STATUS.md`'s earlier grade-expansion discussion assumed too.

`MVP_GRADE_ID: string` (`'grade-10'`) is now `MVP_GRADE_IDS: readonly
string[]` (`['grade-10']`), checked with `.includes()` everywhere it used to
be checked with `===` (`getVisibleGrades`, `getSubjectsForGrade`,
`isPickerCurriculumVisible`). The deprecated, already-unused `MVP_SUBJECT_ID`
singular went with it — confirmed via repo-wide grep that neither name was
referenced outside `catalog.ts` before deleting.

**Grade 9 is not in the set yet, on purpose.** Only Semester 1 Unit 1 is
lesson-level; Units 2–4 are title-only and Semester 2 doesn't exist. Widening
the set is a one-line change (`MVP_GRADE_IDS: readonly string[] =
['grade-10', 'grade-9']`) — the right time to make it is when Grade 9's
catalog is actually done, not now. Confirmed behavior is unchanged today:
`getVisibleGrades()` still returns only `grade-10`, `isPickerCurriculumVisible
('mathematics', 'grade-9')` still returns `false`.

83 curriculum tests pass, unchanged.

## Grade 9 Math grows a real Semester 2, and Units 3–4 stop being title-only, 2026-08-26

The Drive extraction ceiling from the previous entry blocked finishing Grade 9
Math from Drive alone. The user uploaded four PDFs directly instead —
`poppler-utils` (`pdftotext`/page rendering) wasn't installed in this
container; installed it, and it reads these cleanly with correct RTL order,
unlike Drive's `read_file_content` which returns text with each line's
characters reversed. Four files, identified by content since the upload
filenames were stripped to underscores:

- The official Grade 9 Math **Semester 1 exercise book** (54 pages, full).
- The official Grade 9 Math **Semester 2 exercise book** (52 pages, full) —
  the first Semester 2 source this project has had at all.
- Two files together forming a **teacher's edition excerpt covering Units 3
  and 4 of Semester 1 only** (93 pages) — exercise pages plus the same
  مخطَّط الوحدة tables the Grade 10 catalogs are built from.

**Units 3 and 4 are now lesson-level**, matching Unit 1's tier — real
objectives, vocabulary, and periods transcribed from the teacher's-edition
tables, visually verified against rendered page images (not just text
extraction) given how much rides on getting a نتاجات table right. Two more
book-vs-guide conflicts found, resolved the same way as Unit 1's: Unit 3's
table lists a sixth lesson («حل معادلات خاصة») and Unit 4's a third
(«البرهان الإحداثي»), neither in the student book's table of contents. Both
excluded — and this time with stronger evidence than Unit 1 had, because
*two independent official sources* (the student book **and** the exercise
book) agree against the guide, not just one. `known_gaps` says so explicitly,
including the specific unmerged lesson-count math (Unit 3's `total_periods`
of 24 sums the guide's six lessons; the four kept here sum to 18).

**Unit 2 stays title-only** — no مخطَّط الوحدة table for it turned up in any
of the five sources this project now has for Semester 1. It did gain
`prior_knowledge`, though, sourced from the exercise book's own «أستعدُّ
لدراسة الوحدة» (get ready to study the unit) review-section headers — a
different, legitimate source from Unit 1's full bulleted list, and
`known_gaps` says the list drawn from it may be incomplete.

**Semester 2 is new**, `iqra_curriculum_g9_math_sem2.json` +
`catalogs/g9MathSem2.ts`, same shape as Sem1. Every unit is title-only —
there is no teacher guide for this semester at all yet, only the exercise
book's table of contents (4 units, 16 lessons) and, again, one
`prior_knowledge` item per unit from its «أستعدُّ» section header.

Wired into `catalog.ts` exactly like Sem1 was — new `book-math-9-s2` entry,
new browser-catalog build, spread into `UNITS`/`LESSONS`,
`isBrowserUnitTitleOnly`/`isBrowserLessonTitleOnly` extended. `MVP_GRADE_IDS`
untouched, so none of this reaches any picker yet — confirmed unchanged:
`getVisibleGrades()` still `['grade-10']`.

`verify-curriculum`: 7 files now (was 6), 94 lessons (was 78), 28 gaps (was
21) — Grade 9 Sem1 alone dropped from 14 gaps to 5 (Unit 2's five lessons,
the only ones left with no source), Sem2 added 16 new (every lesson, honestly,
since no guide exists for it). 83 curriculum tests pass, unchanged.

## Chasing the last 6: text obtained for 5, none ingested yet, 2026-08-26

Followed up on the 6 documents the previous entry left unfetched. All 6 are
answered now, but "answered" means three different things, and none of the
6 are in `data/extracted/` yet — the reason why is the real finding here.

**The two "session expired" stragglers were a tool-choice problem, not a
transient one.** `math-loss-recovery` and `math-u1-summary-alkhamayseh` had
failed on every retry, in every batch position, across many attempts — with
`download_file_content`. Switched to `read_file_content` (Drive's own
server-side text conversion, not a raw-byte download) and both succeeded on
the first try. Whatever was dropping the session was specific to the download
path, not to these two files.

**One of those two looked misattributed, and wasn't.** `math-loss-recovery`'s
manifest title is about "تعويض الفاقد التعليمي" (compensating for lost
learning), but the fetched text opens with a book introduction and table of
contents that reads like a general curriculum front-matter, not
loss-recovery-specific framing. Checked before trusting it: the file size
matches the manifest exactly (6,543,330 bytes), and the body — read in
full — is the loss-recovery syllabus itself (algebra, quadratics, exponents,
coordinate geometry, trigonometry), ending "تم بحمد الله تعالى". Every
official MoE document in this corpus opens with the same "منهاجي" front
matter; that's why it looked like a different document at a glance. Not a
misattribution — a false alarm, recorded here because the check is what
makes that conclusion trustworthy rather than assumed.

**`read_file_content` also turned out to work around the 10 MB download
ceiling**, since it doesn't move raw bytes. Tried it on the four large
files blocked by that ceiling:

| id | result |
| --- | --- |
| `math-u2-answers-alkhatib` | real text, correctly ordered, circle-geometry answer key |
| `math-s1-support-material`, `math-u1-answers-almasri` | real Arabic text, but every *line* is character-order-reversed |
| `math-u1-answers-alkhatib` | "Page 1" … "Page 85" headers only, no OCR'd text under any of them |

The line-reversal is a third, distinct corruption shape from the two
`extract-text.ts` already gates (control-character noise, and per-word
Arabic-Presentation-Forms reversal). Confirmed fixable — reversing each line
(`[...line].reverse().join('')`) restored real prose on a sample check
(`رشانلا ميلعتلاو ةيبرتلا ةرازو` → `وزارة التربية والتعليم الناشر`) — but
that repair is not written anywhere yet. `math-u1-answers-alkhatib` is the
same "no text layer, needs OCR" class as the three already on file
(`math-remedial-part2`, `math-u2-summary-alkhamayseh`, `math-ws-systems-alhindi`).

**None of the 3 good ones (`math-loss-recovery`, `math-u1-summary-alkhamayseh`,
`math-u2-answers-alkhatib`) are in `data/extracted/` yet, on purpose.** Every
extraction on file today carries real printed page numbers, for free, from
`pdf-parse` reading a local PDF — that's what lets `grounding.ts` cite "page
34" and mean it. `read_file_content` returns Drive's flattened text
conversion with no such structure. One of the three happens to carry visible
printed-page footers in its own text (`-1-`, `-2-`, … `-22-`); the other two
show no reliable per-document delimiter at a glance. Writing a per-document
regex to guess page boundaries from three different documents' three
different footer conventions, unverified, is exactly the trap
`extract-text.ts`'s own header comment already names from a past attempt:
"every previous attempt to infer structure from these books by pattern...
produced confidently wrong output." A wrong page number on a citation is
worse than no citation — a teacher who turns to "page 12" and finds something
else loses trust in every citation after it, not just that one.

So this stops at acquisition. **Real, verified text exists on disk in this
conversation's history for 3 more documents than before**, but turning that
into a trustworthy citation needs one of two things neither built here: a
page-preserving extraction path for Drive-converted text, or a document-level
(no-page) citation shape that `groundingFor`/`grounding.test.ts` don't
support today. Left as an open decision rather than guessed at.

Updated count: of the 78-document manifest, 3 more (`math-loss-recovery`,
`math-u1-summary-alkhamayseh`, `math-u2-answers-alkhatib`) now have real,
verified text sitting outside the repo, not yet ingested. `math-s1-support-material`
and `math-u1-answers-almasri` need the line-reversal repair written first.
`math-u1-answers-alkhatib` joins the no-text-layer/OCR-needed group. No files
changed in `lib/curriculum` this pass — this entry is the only artifact of
this session's work.

## Grade 9 is visible now, and two hardcoded grade-10 UI paths got fixed to match, 2026-08-27

Widened `MVP_GRADE_IDS` to `['grade-10', 'grade-9']` and added
`book-math-9-s1`/`book-math-9-s2` to `MVP_BOOK_IDS` — the one-line change the
2026-08-26 entry said was ready whenever a human decided it was time. Decided:
show it now, honestly thin parts included (all of Semester 2 and Unit 2 of
Semester 1 are still title-only) rather than waiting for full coverage.
Confirmed end-to-end: `getBooksForSubjectGrade('mathematics', 'grade-9')`
returns both semester books, `getUnitsForBook` returns real unit titles for
each.

**Widening the picker surfaced two screens that were never wired to it at
all.** `getPickerGrades()`/`getVisibleGrades()` themselves were already
length-agnostic everywhere the AI-tools screens use them (`resolvePickerIndex`,
`PickerField`, `lessonPrepPickerIndices` all worked off array length, not a
hardcoded index) — but two flows never called those functions, they had
`gradeId: 'grade-10'` typed directly into the code, so a teacher could not
reach Grade 9 through them no matter what the picker allowed elsewhere:

- `app/home.tsx`'s "change lesson" dialog — `TopicSelector` was pinned to
  `gradeId="grade-10"`. Added a `draftGradeId` state, a grade-pill row
  (mirrors the existing subject-pill row, shown only when there's more than
  one grade to choose), and threaded it into `HomeLessonPick` (new optional
  `gradeId` field — absent on picks saved before today, callers already
  fall back to grade-10). The banner's grade label was also a hardcoded
  string (`'Grade 10'`/`'الصف العاشر'`) regardless of what was actually
  picked; now reads from the pick.
- `app/classes/index.tsx`'s new-class dialog — `createClass` always sent
  `gradeId: 'grade-10'`, no field to change it. Added the same pill pattern.

**Found and fixed a related bug while in `home.tsx`, not introduced by this
change but caught by the same audit:** `openGenerator` (the quick-generate
buttons) built its nav params from `buildGeneratorNav` alone, which only sets
`topic` — never `gradeIdx`/`subjectIdx`. That's exactly the silent-default
trap this file already documents (`lessonPrep.ts`'s own comment: every
generator screen falls back to index 0, Grade 10 Mathematics, and
`isMathContext` branches on that string). It affected Grade 10 Chemistry
lessons too, not just Grade 9 — a chemistry lesson opened via a home quick-
action was generating from the math question bank under the chemistry title.
Fixed by spreading `lessonPickerParams(lessonPick?.lessonId, lang)` into the
nav params, the same helper the AI-tools hub and `LessonPrepPanel` already
use.

Verified with an `Explore` agent sweep across `artifacts/mobile/` for other
places consuming grade pickers before concluding these were the only two
gaps — everything else (the 7 `ai-tools/*` screens, `evaluations/[id]/results.tsx`,
`answers/[studentId].tsx`, the API server's `curriculum.ts` proxy) already
derives its grade index from data rather than a hardcoded literal.

No `node_modules` in this container for either package touched, so neither
`pnpm --filter mobile typecheck` nor a bundler run was possible here — checked
syntax only, with global `tsc --noResolve` (parses cleanly, no TS1xxx errors,
only the expected implicit-`any`/unresolved-import noise from skipping type
resolution). `pnpm --filter @workspace/curriculum run verify` unchanged (7
files, 94 lessons, 28 gaps, 0 structural errors) and `test` still 83/83 —
this pass touched app code, not curriculum data. **Not run against the real
app** — confirm the grade pill actually renders and a Grade 9 pick survives
a generator round-trip on the next live check.

## Grade 9's teacher guides surfaced in Drive, closing part of the title-only gap, 2026-08-27

Re-checked Drive for Grade 9 Math source material now that the grade is live.
Found a complete Semester 2 teacher guide (`دليل المعلم ... الفصل الثاني.pdf`,
36.5MB) that did not exist in any earlier search this session — the first
real teacher guide found for that semester. Both S1 and S2 guides exceed the
10MB `download_file_content` ceiling, so full extraction still isn't
possible; but `read_file_content` reached each guide's complete table of
contents (Drive's own text extraction still truncates before any unit's
actual مخطط الوحدة period table — that's unchanged).

What the TOCs bought, honestly:
- **Semester 2 (units 5-8): every lesson title now traced to the teacher
  guide itself**, not just the exercise book. One real correction: Unit 5
  Lesson 2's official title is «منصفات في المثلث», not «منصفات الزوايا في
  المثلث» — the exercise-book-derived title had added a qualifier that isn't
  in the guide. Everything else matched exactly. Still title-only — no
  periods, objectives, or vocabulary; that needs the unit-plan tables the
  extraction doesn't reach.
- **Semester 1 Unit 2**: independently confirmed correct (titles/order
  already matched, from earlier work). Caught a real ordering bug instead —
  the Unit 1 GeoGebra lab was positioned before Lesson 1 in the data; the
  guide's TOC places it after Lesson 4 (this file's `u1_l3`, post-exclusion).
  Fixed by moving the array entry, not just its `order` number — the
  browser-catalog builder iterates the JSON array literally and never reads
  `lesson.order`, so renumbering alone would have changed nothing a reader
  could see.

Both `iqra_curriculum_g9_math_sem1.json` and `..._sem2.json` provenance/
known_gaps rewritten to match — S2's now says a teacher guide exists (it
used to correctly say none did), S1 documents the lab reorder.

**This container now has `node_modules`** — `pnpm install` succeeded this
session where it hadn't in earlier ones (probably just a fresh container
with the network reachable this time, not a permanent change; re-check next
session rather than assuming it holds). Ran the real tools instead of the
`--noResolve` syntax-check workaround several recent entries had to fall
back on: `pnpm --filter @workspace/curriculum run verify` (7 files, 94
lessons, 0 structural errors, 28 gaps — unchanged count, since these were
title corrections not new lessons), `test` (83/83), and `pnpm run
typecheck` for the whole monorepo (clean). Grade 9 Math S1 Unit 2 and all of
Semester 2 remain title-only — the unit-plan tables are the next thing worth
chasing, and would need either a >10MB-capable download path or the guides
re-uploaded directly the way the S1 units 3-4 material was.

## Grade 9 was visible but unreachable — the real screen and the real KB never got the fix, 2026-08-27

Ran the app for the first time this session — `pnpm install` and a local
Postgres (started in-container: `service postgresql start`, schema pushed
against `postgresql://postgres:postgres@localhost:5432/iqraa`) both worked,
where earlier entries this week had no `node_modules` at all and could only
syntax-check. That let the previous "Not run against the real app" caveat
from the 2026-08-27 grade-pill entry actually get checked — and it failed.

**`app/home.tsx`, the file the earlier PR fixed, is not the screen a teacher
lands on.** The real "change lesson" flow is `ContextBanner` inside
`app/(tabs)/iqra.tsx` — a 2885-line file, its own `CONTEXT_SUBJECTS` /
`TopicSelector` wiring, nothing shared with `home.tsx` beyond the component
name. Its grade was `gradeId: 'grade-10'` baked into every subject row, no
picker, no way to reach Grade 9 from it at all. Fixed the same way as
`home.tsx`: independent `gradeId`/`draftGradeId` state, a grade-pill row,
`ChatLessonPick` carries `gradeId` through to `saveLessonPick`. Caught a
second hardcoded-Grade-10 spot in the same file while there — the synthetic
"I'm teaching X to Grade 10 students" chat prompt that opens a fresh topic,
unconditionally, regardless of the grade actually picked.

**Worse: even with the picker fixed, Grade 9 had zero content behind it.**
`TopicSelector`'s unit → lesson cascade, chat retrieval, `resolveGroundedKbLesson`,
lesson-prep grounding — all of it reads `services/knowledgeBase.ts`, and
`KB_BOOKS` there is a hand-maintained list completely separate from
`lib/curriculum/src/catalog.ts`'s `BOOKS`. It had five Grade 10 entries and
nothing else; `grep -c grade-9` was 0. Turning `MVP_GRADE_IDS` on
(2026-08-27, PR #169) made Grade 9 *listed* — grade/subject pickers, the
curriculum browser — without making it *reachable*: `TopicSelector` falls
back to a bare free-text box whenever `hasKBContent(subject, grade)` is
false, silently dropping the one thing that keeps a picked lesson from
drifting (`onSelectionDetail`'s `lessonId`) and forcing every Grade 9 pick
through `searchKBSemantic` fallback matching instead.

Fixed by giving Grade 9 Math the same KB-shaped builder Grade 10 Math has
had all along: added `buildG9MathSem1Catalog()` / `buildG9MathSem2Catalog()`
to `lib/curriculum/src/catalogs/g9MathSem{1,2}.ts` (mirrors
`buildNccdSem1Catalog` in `g10MathSem1.ts` field-for-field — same shape,
same title-only-lesson summary convention), added the two subpath exports to
`lib/curriculum/package.json`, added `services/curriculumG9MathSem{1,2}.ts`
re-export shims (same one-line pattern `curriculumG10MathSem1.ts` uses), and
merged the results into `KB_BOOKS`/`KB_UNITS`/`KB_LESSONS`. Grade 9 Math now
has a real unit → lesson cascade in the picker, confirmed live: picking
الصف التاسع → حل المعادلات lists the actual 4 lessons
(بيانيًا/بالتحليل/بإكمال المربع/بالقانون العام), and the KB id survives
through to the lesson-grounded chat reply, which cites the real objectives
from the JSON and correctly labels itself «الصف التاسع» — `resolveCurriculumContext`
in `teachingAssistant.ts` had the exact same hardcoded-grade bug as the
subject line its own comment already flagged as fixed; fixed grade the same
way, from the lesson's own book.

**Wiring Grade 9 into the KB surfaced a live content-isolation bug, not just
a coverage gap.** `mathSupportResources.ts`'s title-keyword tagging
(`unitTagsForLesson`'s "secondary" block — `/اقتران/` → `s2-u5`, etc.) is
gated by subject only, and those bare tags (`s1-u1`, `s2-u5`, no grade
prefix) are `bankTagsForParsedUnit`'s Grade-10-only namespace — every other
grade gets an explicit `g{n}-` prefix precisely so this can't collide, a
mechanism already built for this exact scenario and never wired to check it
here. The moment Grade 9 Math had lessons to match against, a Grade 9 lesson
titled «الاقترانات» picked up the Grade 10 functions-unit tag. Confirmed
live and worse than the tag path alone: `searchSupportResources`'s
title/keyword scoring has no grade awareness at all (only a subject gate),
so a Grade 9 «حل المعادلات» lesson pulled three Grade 10 worksheets and an
answer key straight into a live chat reply — the resource bank is entirely
Grade 10 material with no `gradeId` field on any entry, so nothing in that
path could have known better. Fixed at both layers: gated the keyword block
to `book.gradeId === 'grade-10'`, and added a hard grade gate at the top of
`searchSupportResources` (empty result for any non-Grade-10 lesson — same
"honestly empty" precedent already used for financial-literacy) threaded
through `buildSupportResourcesContext`'s widened retry too, which drops the
lesson object but needs to keep the grade it implied. Two existing tests
encoded the old single-grade assumption as their pass condition
(`lessonShelf.test.ts`'s tag-namespace allowlist, `knowledgeBase.test.ts`'s
"probability lesson" ranking, now genuinely ambiguous between grades) —
updated both to state what they actually guarantee post-Grade-9 rather than
loosening them.

Verified against the real running app end-to-end (not just tests): registered
a test account, opened the change-lesson sheet in `(tabs)/iqra.tsx`, picked
الصف التاسع → الرياضيات → حل المعادلات → حل المعادلات التربيعية بالتحليل,
confirmed the chat reply carries the correct grade label, the real JSON
objectives, and — after the fix — no Grade 10 resource attachments.
`pnpm --filter @workspace/curriculum run verify`/`test` unchanged (0 errors,
28 gaps, 83/83); mobile `pnpm test` 982/982 (972 pass + 10 skipped) after the
two test updates above; `pnpm run typecheck` clean across the monorepo.

Net: the 2026-08-27 "Grade 9 is visible now" entry was true and also not
enough — visible in the pickers is not the same as reachable in the one
screen that matters, and reachable is not the same as grounded in real
content. All three now hold for Grade 9 Math.
