# Iqraa — Current Status

> The single source of truth for project state. When something here stops being
> true, **edit this file in the same PR that changes it.** Older audits live in
> `docs/archive/` — they are historical snapshots, do not act on them.

_Last verified: 2026-08-06, on Windows 11 (Cursor/Claude local dev)._

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

## What works today (verified, not assumed)

- `pnpm install` and full `pnpm run typecheck` pass clean on Windows.
- Mobile test suite: 219 tests, 0 failures (10 skipped). The `test` script now
  globs `services/__tests__/**/*.test.ts` — it used to be a hand-listed set of
  files that had drifted, so two suites never ran.
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
- Objective counts elsewhere: math S2 61, financial literacy 40, chemistry 4.
  Only chemistry's 4 carry a hand-authored Bloom's level; the rest are stamped
  `'Understand'` by the catalog builders, so objectives expose
  `bloomsSource: 'authored' | 'defaulted'` and an `inferredBloomsLevel` derived
  from the Arabic action verb. See `docs/student-evaluation-module-plan.md`.
- Financial Literacy G10 S1 is browsable (2 units / 10 lessons, NCCD-sourced).
  It was previously offered as a subject tile with no book behind it, so the
  subject dead-ended on the "no semesters" empty state.
- Expo Go on a phone works over LAN (firewall rule `Iqraa-Dev-8080-8083`;
  see LOCAL_SETUP.md).
- `mockup-sandbox` is excluded from the workspace — it is a design sandbox,
  not product UI, and its type errors used to block the whole monorepo build.
- **Hosted demo is LIVE** (2026-08-07, free tier — see render.yaml):
  - Web: https://iqraa-web.onrender.com (static, always awake)
  - API: https://iqraa-api-dfxu.onrender.com (`iqraa-api` name was taken —
    note the `-dfxu` suffix; sleeps after ~15 min idle, ~30-60s to wake.
    **Warm it up before demos.**)
  - DB: Neon free Postgres, project "iqraa", eu-central-1 (Frankfurt).
    Schema pushed; register/login verified end-to-end against it.
  - Demo account: demo@iqraa.app / IqraaDemo2026

## Teacher UX work in flight (2026-08-10)

Branch `feat/evaluation-authoring`, **unmerged commits ahead of `main`**. The
deployed site only shows what is on `main`, which is the usual reason a change
"did not appear" — check `git log origin/main..origin/feat/evaluation-authoring`
before debugging anything visual.

Landed on that branch, in order:

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

## Open decisions (2026-08-10)

- **Home vs chat.** They duplicate each other: both carry the current lesson,
  the tool chips, and a text box. Home's box is a keyword router dressed as an
  assistant — `inferToolFromPrompt` matches on واجب/ورقة/اختبار/نشاط/خطة and
  silently defaults to lesson-plan for anything else, and `extractLessonTopic`
  strips a verb and passes the rest as a topic string. Proposal on the table:
  make chat the landing tab and fold home's useful parts (current lesson, what
  is ready, «تابع العمل») into its opening state; retire the home tab. Nizar's
  own Stitch mockup kept them separate, so the reason for the split is worth
  settling before acting.
- **Which model backs AI grading** (blocks the evaluation module's AI-grading
  phase only — see docs/student-evaluation-module-plan.md §8).
- **Math S1 Unit 2 edition mismatch**: the teacher guide lists a fifth lesson
  (الدوائر المتماسة) the student book on file does not have. Recorded in the
  curriculum JSON's `known_gaps`, not merged in.

## Top blockers (in priority order)

1. **No external validation.** Zero real teachers have used the product.
   Getting 3–5 Jordanian teachers on it beats any further polish.
3. **Verifier not visible in UI.** The SymPy math-verifier works but the app
   doesn't surface verification (badge / rejected-count / proof panel).
4. **OpenAPI drift.** Generated clients reference routes the API doesn't
   implement; real `/auth/*`, `/workspace/*` routes missing from the spec.
5. **i18n debt.** ~2,000 hardcoded strings vs ~500 i18n keys.

## Known landmines

- `gpt-5.6-luna` model id is hardcoded in the AI service — likely invalid;
  irrelevant while DEMO_MODE is on, blocking the day it's turned off.
- `DEMO_MODE` mocks AI but **not** auth: any demo needs a live API + Postgres.
- ~100MB of curriculum PDFs tracked in git (one 58MB LFS object) — slow clones.
- Legacy duplicate `lib/integrations/openai_ai_integrations` mirrors the active
  `lib/integrations-openai-ai-server`.
- `app/ai-tools/classroom/classroomRouting.ts` is a helper inside the routes
  dir — Expo Router registers it as a phantom route and warns on every boot.

## Working agreement

- One checkout: `Code\Iqraa` (the old `Downloads\Iqraa\Iqraa` copy is retired —
  everything unique from it was merged via PR #1).
- All changes via feature branches + PRs; `main` is merge-only.
- Verify claims against the running system before acting on any doc, including
  this one.
