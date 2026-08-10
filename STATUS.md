# Iqraa — Current Status

> The single source of truth for project state. When something here stops being
> true, **edit this file in the same PR that changes it.** Older audits live in
> `docs/archive/` — they are historical snapshots, do not act on them.

_Last verified: 2026-08-10, against the running system (local Linux checkout +
the hosted demo API). Earlier lines carried over from the 2026-08-06 pass on
Windows 11 are marked where they were not re-checked._

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

> **The strategy is currently not met**, but not for the reason this file said
> until 2026-08-10. The SymPy verifier **is** deployed and healthy. The API
> cannot reach it because of a URL-scheme bug — see "Hosted demo" below. Until
> that is fixed and deployed, nothing in the hosted demo is symbolically
> verified.

## What works today (verified, not assumed)

- `pnpm install` and full `pnpm run typecheck` pass clean (checked on Windows
  2026-08-06 and on Linux 2026-08-10).
- Mobile test suite: 287 tests, 0 failures (10 skipped). The `test` script
  globs `services/__tests__/**/*.test.ts` — it used to be a hand-listed set of
  files that had drifted, so two suites never ran.
- API test suite: 31 tests, 0 failures. Its `test` script globs
  `src/**/__tests__/**/*.test.ts`; it was scoped to `src/modules/**` and so
  never ran anything under `src/lib` or `src/routes`. The mount-order suite
  boots the built bundle, so run `pnpm build` before `pnpm test` or it skips.
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
    See `docs/student-evaluation-module-plan.md`.
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
    - **But the API could not reach it, and the cause was a scheme bug, not a
      missing service.** The blueprint sets `MATH_VERIFIER_URL` via
      `fromService … property: hostport`, which yields Render's *internal*
      address `iqraa-verifier:10000`. Render's private network serves plain
      **HTTP** there. `normaliseVerifierUrl` treated "not localhost" as "must be
      https", so the API opened a TLS handshake against a non-TLS port and got
      `client_error:fetch failed` — instantly, and indistinguishably from the
      service not existing. **This file asserted "NOT DEPLOYED" for exactly that
      reason, and was wrong.**
    - Fixed on branch `fix/verifier-internal-url`: the scheme now follows the
      hostname's shape — no dot means an internal service name, so http.
      Until that merges and deploys, the workaround is to set
      `MATH_VERIFIER_URL` on `iqraa-api` to the public URL
      `https://iqraa-verifier.onrender.com`, which is genuinely TLS.
    - To check reachability at any time, unauthenticated:
      `GET /api/healthz/verifier` → `{"verifier":"ok"|"unreachable"}`.
  - DB: Neon free Postgres, project "iqraa", eu-central-1 (Frankfurt).
    Schema pushed; register/login verified end-to-end against it.
  - Demo account: demo@iqraa.app / IqraaDemo2026
  - Note the verifier is free-tier too, so it will sleep after ~15 min once
    deployed. The client's timeout is 2.5s, so the first call after idle fails.
    **Warm the verifier as well as the API before a demo** — a sleeping
    verifier and an undeployed one look the same from the app.

## Teacher UX pass — merged 2026-08-10

Was on `feat/evaluation-authoring`; **now merged into `main`** (`06ed814`).
Nothing is outstanding on that branch. The only unmerged work in the repo is
two parked chat-redesign branches — see "Open decisions".

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
    therefore still exists at `/home`, off the tab bar, reachable from
    Profile → «أدوات إضافية». Retiring it fully means rehoming those two first.
  - The first-run coach card also only renders on that screen, so Profile's
    "show me the start-here card again" now points at `/home` rather than
    `/(tabs)`, which would have reset the flag and shown nothing.
  - The two parked chat-redesign branches were **not** used —
    `claude/ikra-chat-ux-i087se` (`74c52e8`) and
    `claude/ikra-chat-agent-uiux-1j6wpm` (`7dcb99f`). Both rewrite `iqra.tsx`
    and `CurrentLessonCard.tsx` wholesale and conflict with each other; both add
    a starter-card welcome panel, which is polish, not this decision. Recorded
    here so the SHAs survive if the branches are deleted.

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

1. **Verifier deployed but unreachable from the API.** Nothing in the hosted
   demo is symbolically verified, and the demo strategy is built on it being
   verified. The service is healthy; the API sends https to an internal
   plain-HTTP address. Fix is on `fix/verifier-internal-url`; the one-field
   workaround is in "Hosted demo" above. The verifier code itself is fine —
   `python prove_slice.py` passes 20/20 with zero wrong keys.
2. **No external validation.** Zero real teachers have used the product.
   Getting 3–5 Jordanian teachers on it beats any further polish.
3. **Verifier not visible in UI.** The app doesn't surface verification
   (badge / rejected-count / proof panel). The API now returns
   `verificationSource: 'sympy' | 'code_template'` alongside `verified`, so
   there is something truthful to render — a badge must read from both, or it
   will claim verification on template items again.
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
