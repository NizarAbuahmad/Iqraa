# Iqraa — agent context

Arabic-native AI teaching assistant for the Jordanian national curriculum
(Grade 10 math + chemistry first). pnpm monorepo.

## Read this first

**[`STATUS.md`](./STATUS.md) is the single source of truth for what is true
right now** — a short page (about 120 lines): production, how a change ships,
what is open. Read it before acting. When a line in it stops being true, edit it
in the same PR that changed it.

The long form — what each change built, what was and was not verified, its known
limits — is [`docs/status-log.md`](./docs/status-log.md) (20,000+ lines, the old
`STATUS.md` kept word for word). **A PR adds its write-up to the TOP of the
log**, not to `STATUS.md`. Anywhere you see «see STATUS.md «X»» — in code
comments, workflows and design docs — it means the entry titled X in the log:
search for the title there.

Older audits live in `docs/archive/` — historical snapshots, do not act on them.
`.agents/memory/` holds deeper notes: `iqra-architecture.md`,
`ai-integration.md`, `auth-workspace-api.md`.

This repo vendors the [Superpowers](https://github.com/obra/superpowers) skills
in `.claude/skills/` (spec-before-code, TDD, systematic debugging, plan writing,
verification-before-completion). They are project skills, invoked by bare name
via the `Skill` tool, and a `SessionStart` hook loads `using-superpowers` for
you. See [`.claude/SUPERPOWERS.md`](./.claude/SUPERPOWERS.md) for provenance and
how to update them.

## Layout

| Path | What |
| --- | --- |
| `artifacts/mobile` | Expo / React Native app (also the web build) |
| `artifacts/api-server` | Express API |
| `artifacts/math-verifier` | SymPy FastAPI service — verifies math answer keys |
| `artifacts/mockup-sandbox` | Design sandbox, **excluded from the workspace** |
| `lib/curriculum` | NCCD curriculum data, shared by app and API |
| `lib/math-verify` | Gates deciding what may claim symbolic verification — shared by app and API |
| `lib/db` | Drizzle schema |
| `docs/adding-a-book.md` | How a book / PDF enters the system (manifest, text, catalog, figures) |

## Commands

```bash
pnpm install
pnpm run typecheck                     # whole monorepo
pnpm run dev:api                       # Express on :8080
pnpm run dev:mobile:web                # Expo web on :8081 (MOBILE_PORT overrides)

cd artifacts/mobile     && pnpm test
cd artifacts/api-server && pnpm build && pnpm test   # build first — see below
```

`artifacts/api-server`'s mount-order suite boots the built bundle, so run
`pnpm build` before `pnpm test` there or it skips. They were once hand-listed
and silently drifted, so **add tests inside these globs, and do not narrow
them** — but note the two are not the same glob (checked 2026-09-08):
api-server runs `src/**/__tests__/**/*.test.ts`, while mobile runs only
`services/__tests__/**/*.test.ts`. A mobile test outside `services/__tests__/`
never runs. That is deliberate: the mobile runner is bare `node --test` with no
React Native transform, so anything importing `react-native` or `expo-*` at
module scope cannot be loaded at all — which is why `routeGating.ts` and
`fetchWithTimeout.ts` are split out of the files that use them.

**Browser smoke test** (`e2e/`, Playwright, `.github/workflows/e2e.yml`): a teacher
signs up, makes a class, publishes an exam, a student with no account hands it in
through `/take/CODE`, and the teacher sees it. The shareable "quiz" is an
*Evaluation*, not the ai-tools quiz, which can only be exported. To run it
locally, against a **throwaway** database (the test creates users and truncates
`rate_limit_buckets`):

```bash
# 1. empty Postgres database, then (db scripts IGNORE a shell DATABASE_URL when a
#    repo-root .env exists — run these from a checkout without one, or use CI's way)
DATABASE_URL=<throwaway> pnpm --filter @workspace/db run migrate -- --from-env
DATABASE_URL=<throwaway> pnpm --filter @workspace/db run seed:assessment
# 2. build what it drives
pnpm --filter @workspace/api-server run build
cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web
# 3. run (Playwright starts the API and a static server itself; uses your installed Chrome)
cd e2e && E2E_DATABASE_URL=<throwaway> pnpm test
```

It sets the UI to English and skips the intro through `localStorage` keys, drives
real screens (React Native Web inputs need `pressSequentially`, not `fill`, for
multiline fields), and plants the email-verification code in Postgres because
the real one is only ever emailed. It asserts "did it arrive", never copy or
scores. On a slow machine a request can time out and leave a screen on its error
text with no retry; the exam-builder step reloads for that, deliberately.

Local setup, env vars and troubleshooting: [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).
Before a live demo: [`docs/demo-checklist.md`](./docs/demo-checklist.md).
Shipping to production: [`docs/deploying.md`](./docs/deploying.md).

## Conventions

- Feature branches + PRs. `main` is merge-only, and **only `main` is deployed** —
  if a change "isn't showing", check it is merged before debugging anything visual.
  Since 2026-09-15 a merge deploys **all three** services —
  `.github/workflows/deploy.yml` ships the API and verifier to Cloud Run first,
  then the web bundle, and skips the web deploy if either failed
  ([`docs/deploying.md`](./docs/deploying.md)). Between the 2026-09-05 Cloud Run
  cutover and then, only the web app auto-deployed, which is how a bundle once
  went live against an API without the matching route.
  The schema deploys too, as migrations — see *Schema* in that file.
- Arabic is the product language; the UI is RTL-first. Compute maths in latin
  `x` and convert to `س` / Arabic digits **only at display time**.
- `DEMO_MODE = true` in `artifacts/mobile/services/ai/demoMode.ts` mocks all
  prose generation. Do not flip the code default without a decision — see
  STATUS.md («Production right now») and the log's «Strategy» section. Every
  shipped build overrides it with `EXPO_PUBLIC_DEMO_MODE=false`: Android
  (`eas.json`, `mobile-update.yml`) and, since 2026-10-16, the web (`deploy.yml`).

## Working here with Claude Code (team setup)

New to the repo? [`docs/team-onboarding.md`](./docs/team-onboarding.md) lists what
you set up yourself (Claude seat, GitHub, GCP / Neon / Cloudflare access). The repo
is **public**: nothing below, or anywhere in it, may hold a secret value.

**Shared config is committed; personal config is not.** `.claude/settings.json`
(permission allowlist + deny list), `.mcp.json` (Playwright only), `.claude/agents/`
and `.claude/skills/` are shared — change them in a PR. Your own tweaks go in
`.claude/settings.local.json` and `CLAUDE.local.md`, both gitignored.

**Secrets**
- Never read, `cat`, `grep` or print a `.env` file, and never print Cloud Run env.
  The settings deny `gcloud run revisions describe`, `revisions list`,
  `services describe` and printing an access token. A narrow
  `--format="value(...)"` read of one field (a traffic split, say) needs a local
  override in `.claude/settings.local.json`, or the person running it themselves.
  The deny rules are prefix matches: they do not cover PowerShell or every shell
  form, so branch protection and not reading `.env` files are the real guards, not
  the list. A key that reached a transcript, a PR or a log is rotated — see *Rotating a secret*
  in [`docs/deploying.md`](./docs/deploying.md).
- Credentials are Secret Manager references on Cloud Run. Rotating one is
  `gcloud secrets versions add` plus a new revision, never an env edit.
- No shared keys. Each person gets their own access through IAM / their own account.

**PRs and shipping**
- Never push to `main`. `main` requires an up-to-date branch and a green
  `typecheck + tests` job, and enforces both for admins. If `gh pr merge` is
  refused because `main` moved, run `gh pr update-branch <n>` and wait for CI.
- Run what CI runs before you open a PR: `pnpm run typecheck`; api-server
  `pnpm build` then `pnpm test`; mobile `pnpm test`; curriculum `test` and
  `verify`; `python -X utf8 test_equations.py` in `artifacts/math-verifier`.
- **A change you cannot undo by reverting the commit goes up as a draft PR** (a
  schema drop, removing a service block, anything whose rollback needs secrets
  re-typed). GitHub refuses to merge a draft; "do not merge yet" in the body stops
  nothing. Caveats go in the PR body, not only in chat.
- Merging to `main` deploys: the API and verifier to Cloud Run (project
  `iqraa-auth-507315`, `europe-west1`), then the web bundle to Cloudflare Pages
  (`.github/workflows/deploy.yml`, details in `docs/deploying.md`).
- The app ships over the air. A merge publishes to the `preview` channel on its own;
  the **`production` channel is manual**:
  `gh workflow run mobile-update.yml -f branch=production`. An OTA only reaches a
  binary with the same `app.json` `version` (see the runtime-version trap below).
  A native change needs a real build instead; run EAS builds from a clean worktree
  of `main` after `pnpm install --filter "./artifacts/mobile..."` (the CLI resolves
  Expo plugins locally), and expect ~25 minutes of mostly silence.
- Schema changes are migrations only (see *The schema deploys as migrations*
  below). Never `push`, never hand-run DDL on production — the next migration then
  fails with "already exists". `lib/db` scripts read the repo-root `.env`, which
  points at a local database; never put a production URL in it.

**Parallel sessions: one worktree per task.** Two Claude sessions in one checkout
share a working tree and an index: a second session that runs `git checkout`
silently discards your uncommitted edits to tracked files, and its `git commit` can
sweep in your staged files.
- `git worktree add ../wt-<task> -b <branch> origin/main`, work and commit there, and
  `git add` named paths — never `-A` or `.`. Check `git diff --cached --stat` for
  files you did not touch before committing.
- A fresh worktree needs a **full** `pnpm install` (a filtered one leaves
  `lib/curriculum` without `@types/node`) and `tsc --build` at the root; until then
  typecheck prints dozens of phantom errors (`TS6305`, "cannot find module
  `@workspace/...`"). A worktree whose `node_modules` is a junction to another
  checkout resolves `@workspace/*` to *that* checkout's `lib/` — do not trust its
  typecheck or tests.
- The mobile suite prints nothing until it finishes (minutes). That is not a hang.
- To run the app from a worktree: copy `.env` and `artifacts/mobile/.env` from your
  main checkout (do not open them), start the API with `AI_LIVE_MODE=false`, and
  register a throwaway teacher (the API logs the 6-digit code when there is no
  `RESEND_API_KEY`). Do **not** start Expo with `CI=1` if you will keep editing — it
  turns off Metro's file watching and you will debug stale code.
- Deleting a finished worktree on Windows hits `MAX_PATH` once `pnpm install` has
  run in it. In Git Bash: `rm -rf <worktree>` (backgrounded, ~2 min), then
  `git worktree prune` and `git branch -D <branch>`.
- A subagent started with `isolation: "worktree"` reports its PR and stops; the
  parent cleans up its worktree, never the agent.
- Finding a rebase or merge in progress that you did not start: do not
  `--abort` or `--continue` it. It is someone else's half-finished work.

**Tool pitfalls that corrupt files silently**
- No `sed -i` or `perl -pi` on source. Files are UTF-8 with Arabic and `${...}`,
  and a substitution once turned spaces into NUL bytes while tests stayed green. Use
  the Edit tool, even for a throwaway mutation. A `git diff --stat` line reading
  `Bin N -> M bytes` for a text file means corruption.
- The Bash tool rewrites backslash escapes inside commands and heredocs: `−`
  arrives as the literal character, `\\n` as a real newline, `\\-` as a bare `-`
  (which turns a regex class into a range that matches Arabic letters). In a patch
  script build special characters from code (`String.fromCodePoint(0x2212)`), put
  `-` last in a character class, and read the resulting `git diff`. Node on Windows
  cannot open `/tmp/x.cjs`; give it a Windows path.
- The Claude desktop Browser pane never fires `animationend`, so react-native-web
  fade/slide `Modal`s never become active there (no Escape, no focus trap). Check
  modal keyboard behaviour with Playwright (`e2e/`), not that pane.

**Product wording**
- The Latin product name is **Iqrra** (two r's), as in iqrra.com — never "Iqraa" or
  "Iqra" in copy, designs, wordmarks or PR titles. (The repo, folders and package
  names stay `Iqraa`.)
- The Arabic brand is **«إقرأ»** (hamzat qatʿ). The verb «اقرأ» ("read") is
  ordinary copy and stays; CI fails the old spelling in the files that name the
  product and the quoted form in the app's and API's source (`ci.yml`, "Brand is
  «إقرأ»"). The drawn wordmark artwork still shows «اقرأ» — it is a
  picture, not text.
- Before handing back a regenerated quiz, exam or worksheet, read the new questions
  and check each answer key yourself; a model's Arabic reads fluently either way.

## Things that have bitten before

- **Verify claims against the running system.** Several past bugs were things a
  doc asserted and the running system contradicted. This file included.
- **`verified` means the verifier confirmed it.** Never set it from a
  code-computed fallback — that shipped once and served items flagged verified
  that nothing had checked. Use `verificationSource` to say how a key was
  established. Fail closed, or label honestly; never both-at-once.
- **Routers mounted without a path prefix see every request.** A bare
  `router.use(mw)` inside one becomes API-wide middleware and shadows every
  router mounted after it. Scope guards to their paths. The tell is an unowned
  path returning 401 instead of 404 — `src/routes/__tests__/mountOrder.test.ts`
  asserts this.
- **A lesson title does not identify a lesson.** `searchKBSemantic(title)`
  returns a *different* lesson for 16 of the picker's 63 lessons («قانون
  الجيوب» → «قانون جيب التمام»), so any flow that carries a lesson as a string
  and re-derives it later can silently swap it. Carry the KB id. Note
  `resolveGeneratorGrounding` is exact on exact titles (63/63) — it is the
  semantic search that drifts, so "grounding is fine" does not mean the pin is.
  **And an exact title is not unique either (found 2026-10-02):** 107 Arabic
  titles repeat across the grade 1–10 books, so an exact match can still be
  another grade's lesson. When you know the picked grade/subject, pass it as
  the `scope` option (`KbScope`) — the generator screens, the reopened-material
  scope and `groundedSubjectConflict` do — and derive `lessonId`/`unitId` from
  the grounding you already resolved, never by re-grounding the title.
  **Scope is not enough either (found 2026-10-15):** every Grade 1 English lesson
  is "Vocabulary & Grammar" or "Listening & Speaking", so a scoped title still
  lands every unit on Unit 1. The generator screens hold the tapped or carried
  lesson's id with `usePickedLesson` and ground with `{ lessonId, scope }`; read
  request fields off that one grounding with `groundingRequestFields`. A new
  generator screen needs the same, and a route into one should pass `lessonId`.
- **Generators branch on the subject NAME.** `isMathContext` tests the string,
  so passing `subject: 'Mathematics'` for a chemistry lesson serves it maths
  questions from the concrete bank, titled with the chemistry lesson. Anything
  calling a generator must pass the lesson's own subject; the defaults on
  `buildClassDeck` are maths and will not fail loudly. The same trap sits on
  every `/ai-tools/*` screen: they default `subjectIdx` to 0, so navigating
  with a bare `topic` param silently regenerates this bug. Use
  `lessonPickerParams(lessonId, lang)` when you know the lesson, or
  `scopePickerParams(gradeId, subjectId)` when you only hold the ids — both in
  `services/lessonPrep.ts`, both computing indices against the exact bare
  picker lists the receiving screens rebuild. Since 2026-08-29 there are two
  backstops: a screen opened with a bare `topic` grounds it and takes the
  lesson's own grade/subject (`topicPickerParams`), and generation refuses a
  topic whose grounded lesson belongs to another subject
  (`groundedSubjectConflict`) instead of producing a mislabeled paper.
- **Picker order is persisted state.** `gradeIdx`/`subjectIdx` are saved in
  formState and route URLs as bare positions into `getPickerGrades()` /
  `getPickerSubjects()`. Enabling English/Grade 9 in the MVP set used to
  *insert* them (SUBJECTS/GRADES declaration order), so index 0 became
  English + الصف التاسع and a bare-topic math URL generated «اختبار في اللغة
  الإنجليزية» full of math questions. The MVP pickers now follow
  `MVP_SUBJECT_IDS` / `MVP_GRADE_IDS` order and `pickerOrder.test.ts` pins
  mathematics/grade-10 at index 0 — **append** new entries to those arrays,
  never insert.
- **SymPy does not reject Arabic — it multiplies it.** With
  `implicit_multiplication_application` on, «الإجابة سبعة» parses as a product
  of eight letter-symbols, compares unequal to the real answer, and comes back
  `answer_mismatch` — indistinguishable from a wrong key. Any check whose
  verdict *removes* content must therefore gate on Arabic script explicitly and
  answer "cannot judge", never "wrong"; `relate_answer_key` in
  `artifacts/math-verifier/verify_core.py` does, and
  `lib/math-verify/src/answerKey.ts` refuses the same input client-side rather
  than transliterating «ق(س)» into `f(x)`. Related: `expr_equiv` folds
  `.equals() → None` into `False`, so anything needing "undecidable" as a
  distinct outcome must use `_relation`, not `expr_equiv`.
- **An activity format lives in two places and both must move.** Each of the
  five activity types (plus `warmup`) has a blueprint in
  `artifacts/mobile/services/ai/activityBlueprints.ts` for the offline path and
  a structure clause in `ACTIVITY_FORMAT_RULES_AR`/`_EN`
  (`artifacts/api-server/src/lib/prompts.ts`) for the live one. Change one
  without the other and a teacher gets a different kind of activity depending
  on whether live generation was on. All five used to be a single template with
  the group-size noun swapped in — 1 distinct body across 5 types, measured —
  so the tests that pin them apart (`activityBlueprints.test.ts`,
  `activityPrompts.test.ts`) assert *every field differs from every other
  type*; a new format needs its own entry in both files or they fail.
- **"Same question" is the stem, with its numbers kept (found 2026-10-15).** A
  true/false item's «الإجابة المقترحة» is not part of its question —
  `questionStemKey` strips it, or one item prints twice (once per type) and
  regenerate counts a re-rolled proposed answer as a new question. And a
  duplicate measure must keep numbers: `stemSimilarity` once dropped every short
  token, so two different equations scored 1.0 and one was rejected. "Same
  sentence, different numbers" is a third thing — `stemFrame` — which is
  practice, not a duplicate, and is only warned about when it carries a paper
  (`dominantKind`, which also counts the same ask reworded — `sameKind`,
  capped at three changed words because exam stems quote whole objectives).
- **A question can come from the book, the bank or a model, and only a verifier
  makes one `verified`.** Real book items (`lib/curriculum/src/bookItems.ts`,
  data written by `scripts/extract_book_items.py`) join by `lessonId`, never by
  title. A `computed` item — SymPy solved a stem read from a text layer that
  flattens exponents and splits fractions — must never carry a `check`: the
  existing verification pass would badge it «تم التحقق», which says the stem was
  read correctly and nothing has checked that. `verified` exists for book items
  only where the guide prints the answer (the `unit-test` items 6-11 on
  teacher-guide p.47, 5 of 6): the printed answers come in a different order from
  the items, so the extractor pairs by VALUE (printed entry equals SymPy's answer
  for the stem it read; a misread stem finds no answer), never by position, and
  leaves an unmatched entry `computed` and listed in `report.json`
  (`unmatchedPrinted`), never tolerated into a match. Even then the item carries
  no `check` and no badge. A `unit-test` item cites as the unit test and is drawn
  wherever a short answer is wanted. Guide p.47 choices 3-5, whose exponents and
  fractions the text layer flattens beyond any rule, are served `computed` from a
  hand-written reading (`READINGS`) that is trusted for nothing: it must keep
  exactly the page's characters and brackets and leave exactly one correct
  option, or the item is quarantined. A reading is evidence about a layout, never
  a key. `SERVED_STATUSES` is the one place
  that decides what a paper may draw. Only the API's evaluation generator uses
  book items: the mock path (live AI off), and the live model path only when
  `BOOK_ITEMS_LIVE=true` (off by default, read per request; production runs
  `AI_LIVE_MODE=true`, so no live paper has them until someone sets the flag —
  `generationParams.bookItems` says which state a paper was made in). The mobile
  offline generators and `routes/generate.ts` ignore them, so a paper differs by
  which path made it — add a family to the script's `TABLE`, never to a
  generator. On the live path the model's surplus is cut before the book
  questions are appended (`assembleLivePaper`); the finished paper is put into
  type blocks by `inPaperOrder` like every stored paper, and the route's top-up
  for a short reply is measured against the model's share (`count − k`).
  The prompt is told what the book supplies and a per-competency quota
  (`allocateQuestions` over the whole paper, rescaled for the top-up by
  `remainingQuota`), and such a paper records `promptVersion` `exam-gen-7+book`.
- **A teaching style shapes the whole lesson plan, in two places.** Per-style
  phases live in `artifacts/mobile/services/ai/lessonPlanBlueprints.ts` and the
  matching contract in `LESSON_STYLE_RULES_AR`/`_EN`
  (`artifacts/api-server/src/lib/prompts.ts`). `teachingStyle` once reached
  only `mainActivity`, so a collaborative plan opened with group task cards and
  then banned peer discussion two sections later. Note the plan has TWO return
  paths — the document-grounded branch had to be fixed separately, and a test
  for it must use the real block shape from `buildDocumentPromptBlock`
  (`services/documents/extractMeta.ts`) or it silently exercises the ordinary
  path instead. `introduction`/`closure`/`assessment`/`homework` vary randomly
  via `pick()`, so asserting "the styles differ" on them proves nothing.
  **The teacher's text is first person, future (since 2026-10-12).** The plan's
  Arabic teacher fields read «اعرض… اسأل… فسّر…», which landed in the Ministry
  form's «دور المُعلم» column as commands to someone else; they now say «سأعرض…
  ثم سأسأل…». Words spoken to students stay quoted in «» and imperative. It is
  two places again: the offline blueprints (`lessonPlanBlueprints.ts`,
  `lessonPlanNative.ts`, the intro/closure/prior-review in `generators.ts`) and
  `teacherVoiceAr` in `prompts.ts`. `lessonPlanTeacherVoice.test.ts` fails on a
  bare imperative; it cannot list form-IV imperatives («أعلن», «أضف»), whose
  unvowelled spelling is also the first-person verb, so write those by hand.
- **A worksheet's structure lives in two places, and its count is the total.**
  The worked example, the half-solved first question and the key's working are
  built by `generateWorksheet` (`artifacts/mobile/services/ai/generators.ts`)
  from `lib/math-practice/src/steps*.ts`, and asked for by
  `worksheetPromptAr/En` (`artifacts/api-server/src/lib/prompts.ts`). Change one
  without the other and the paper differs by whether live AI was on. The example
  and the half-solved question count INSIDE the number the teacher picked, so
  sections hold n−1 questions when an example is present; a test that counts
  `sections` alone must add the example back. A new bank item needs working
  before it can be studied, and `steps.test.ts` fails a family with fewer than
  two solved items. Working is dropped, not kept, when a teacher edits the
  question it belongs to (`worksheetEdits.ts`).
  **The live route enforces that count, and homework follows the picker.** A
  model asked for 20 often returns 10, so `/generate/worksheet|homework` counts
  (`worksheetShortfall` — the example is inside the number, a prior-knowledge
  review of 2–3 questions is on top), asks once more for only the missing ones
  as one extra section (`worksheetTopUpBlock`, `mergeWorksheetTopUp`), and trims
  a real surplus (`trimWorksheet`, which never cuts a review the teacher asked
  for). The offline `homeworkOnce` used to ignore `numQuestions` and
  `questionTypes` entirely (always 3 written questions + challenge +
  reflection); the challenge and the reflection are now two of the picked
  number and the rest follow the ticked types (`worksheetCount.test.ts`).
- **A question's difficulty tier lives on the template, and in two prompts.**
  Every non-math question template carries its own `tier`
  (`TieredTemplate` in `artifacts/mobile/services/ai/generators.ts`), and
  `pickTiered` selects from that slice — the tier is deliberately NOT a
  parallel list of indices, which would silently mismatch the first time
  someone reordered a template and would look like "difficulty does nothing".
  A new template must declare a tier. The live path needs the matching clause
  in `difficultyClause*` / `quizDifficultyClause*`
  (`artifacts/api-server/src/lib/prompts.ts`), and the worksheet's `BANDS`
  table must agree with `WORKSHEET_BAND` there — `difficultyPrompts.test.ts`
  asserts the two match. `req.difficulty` used to be read by neither
  generator, and the quiz factories passed a literal `'medium'`, so an easy
  and a hard quiz drew the same bank slice.
- **A quiz's question types live in several places; their order in one.** The
  order, `QUIZ_TYPE_ORDER`, comes from `lib/exam-paper` (shared with the app,
  derived from `EXAM_TYPE_ORDER` and restricted to `QUIZ_TYPES`). The live
  prompt (`quizPromptAr/En` in `artifacts/api-server/src/lib/prompts.ts`), the
  server backstop `normalizeQuiz` (`generationShape.ts` — drops unrequested
  types, forces the صح/خطأ option pair, groups into ministry order before
  anything is pooled) and the offline `quizOnce` in `generators.ts`, which
  builds the same blocks from `QUIZ_TYPE_ORDER` in `services/quizPaper.ts`,
  all work from it.
  The exports print a «السؤال الأول: …» heading per block from `quizBlocks`.
  A new quiz type needs, in one pass: an entry in `QUIZ_TYPES`
  (`lib/exam-paper/src/index.ts`) and in `EXAM_TYPE_ORDER` if it is not there;
  its type contract in `QUIZ_TYPE_CONTRACT_AR`/`_EN` (`prompts.ts`, which
  `quizPromptAr/En` print), or the model is never told what the type looks
  like; a mapping in `quizTypeOf` (`generationShape.ts`), or `normalizeQuiz`
  drops it; `quizOnce` (`services/ai/generators.ts`); `QuizQuestion['type']`
  (`services/ai/AIService.ts`); the picker's labels and colours (`typeLabels`
  and `TYPE_COLOR` in `app/ai-tools/quiz.tsx`, both typed `Record<QuizType, …>`,
  so the typechecker finds a missing entry — the picker's own list comes from
  `QUIZ_TYPE_ORDER`); `quizTypeLabel` (`services/quizPaper.ts` — an
  unmapped type silently prints as "Short Answer"); and `examBlockDirection`
  (`services/examBlocks.ts` — an unmapped type gets the generic «أجب عن الأسئلة
  الآتية» line).
  **The count is enforced too.** A model asked for 20 questions often returns
  10 in a perfectly valid reply, so the quiz route counts (`quizShortfall`),
  asks once more for only the missing ones (`quizTopUpBlock`, merged by
  `absorbQuizTopUp`), trims a surplus from the biggest block, and scales the
  output ceiling with the count (`quizTokens`); evaluations do the same in
  `/evaluations/:id/generate`. If it is still short, `shortfall` says so.
  The same call replaces **repeats** (since 2026-10-17): questions past a
  third of the paper (never fewer than three — `kindQuota`, looser than the
  validator's quarter because a one-skill maths lesson asks it several times
  on purpose) that are one ask reworded or re-numbered (`quizRepeats` —
  `sameKind`, as the evaluation validator's `dominantKind`). A replacement takes the repeat's marks; a repeat nothing
  replaced stays, so a paper is never shortened for variety. Quizzes only — a
  worksheet's same-exercise-new-numbers is the practice. The
  offline generator can only give what the lesson's bank holds (5 for a
  chemistry lesson, 17 for a maths family) — a spent type hands its share to
  the others rather than ending the paper (`quizCount.test.ts`).
  Saved evaluations follow the same convention by a different route: the
  generate route stores questions via `inPaperOrder`
  (`modules/assessment/paperOrder.ts`) and the teacher's list heads each run
  of one type from `examBlocks` (`services/examBlocks.ts`). The type order is
  one list, `lib/exam-paper` (`EXAM_TYPE_ORDER`; the quiz's four types are
  `QUIZ_TYPES`, its order derived), imported by the API and the app.
  `paperOrder.test.ts`, `examBlocks.test.ts` and `quizMinistryOrder.test.ts`
  assert, by reference, that the API's and the app's `EXAM_TYPE_ORDER` /
  `QUIZ_TYPE_ORDER` exports are the package's own arrays, and `paperOrder.test.ts`
  reads `app/ai-tools/quiz.tsx` to check it imports from the package and declares
  no list or union of quiz types of its own (the picker had one until
  2026-10-20). A list under another name elsewhere is not caught:
  `QuizQuestion['type']` in `services/ai/AIService.ts` spells the four types out
  again. A new exam question type needs a place
  in `EXAM_TYPE_ORDER` and a direction in `examBlockDirection`.
- **`additionalContext` is not teacher-pasted material — it is usually the
  curriculum.** Every `/ai-tools` screen fills it with `buildGeneratorContext()`
  output derived from the lesson, and the server appends its own book passages
  to the same field. The shared artifact pool (`ai_artifacts`) treats
  teacher-supplied context as unshareable, so reading "context present" as
  "private" would exclude essentially every request and pin the hit rate at
  zero, with nothing in the logs to say why. Provenance is declared, not
  inferred: `contextSource: 'curriculum' | 'teacher'`, absent read as
  `'teacher'` so a screen that forgets fails closed rather than leaking. If you
  add a generator screen, say which it is.
- **A shared artifact makes every generator bug everybody's bug.** A pooled
  worksheet is served to every teacher who asks for that lesson, so anything
  that used to cost one teacher a regeneration now costs all of them.
  `assertUsableGeneration` runs before anything is stored — but it can only
  catch a *malformed* artifact, never a well-formed worksheet with a wrong
  answer. The way back out is `POST /generate/variants/:id/retire`, offered to
  teachers since 2026-09-02 as «بلّغ عن مشكلة» in `GeneratorResultActions`. It
  is deliberately open to any authenticated teacher (any `TEACHER_ROLES` role —
  the `/generate` guard), but since the artifact-report change it **queues a
  report** (`reportVariant`) for a `system_admin` and retires nothing: the
  artifact keeps being served to everyone else until an admin resolves the
  report as `approved` (`POST /moderation/artifact-reports/:id/resolve`, the
  only caller of `retireVariant`). The reporting teacher's client then
  regenerates, which avoids the paper they were served, so only they get a
  replacement at once — unless a spend/quota cap is reached, in which case the
  route serves `pool.variants[0]` (possibly the variant just reported, tagged
  `servedReason`) instead of generating.
- **Students are shown only what an admin approved (since 2026-10-13).** The
  pool serves a teacher whatever is stored, but a stored row can be under the
  wrong lesson id and a student is a minor, so `GET /student/lesson-explanation/…`
  filters on `ai_artifacts.student_approved_at`, which only
  `POST /moderation/lesson-explanations/approve` sets. A new student-facing read
  of the pool needs the same gate, and must not import generation code — a
  student route that can reach `generateContent` is a student who can spend the
  budget. `artifacts/mobile/scripts/pregenerate.ts` fills it; approval is a
  separate step on purpose.
- **`app.json`'s `version` is the OTA compatibility key, not a label.**
  `runtimeVersion.policy` is `appVersion`, so every build and every published
  update carries `"1.0.0"` until someone edits that string. An update only
  reaches a binary with a matching runtime version — which is the whole
  mechanism, and the trap: **add or remove a native module without bumping
  `version` and the next `eas update` ships JS that calls into a module the
  installed binary does not have.** That crashes on launch, and the bad bundle
  persists across launches, so recovery is a reinstall. Bump `version`
  whenever the native surface changes — a dependency with a config plugin, an
  `expo-*` package, anything touching `android/`. Pure JS, content and styling
  changes never need it. `appVersionSource: "remote"` in `eas.json` bumps
  `versionCode` only and never touches `version`, so nothing bumps it for you.
  The `fingerprint` policy would detect this automatically and was tried
  first: it hashes autolinking output, which embeds `.pnpm/` store paths, so
  local and EAS fingerprints never matched and every build failed at
  `CONFIGURE_EXPO_UPDATES`. In a pnpm monorepo that policy is not usable
  without excluding the very inputs it exists to watch.
- **On Android nothing lifts content above the keyboard unless a view asks.**
  Expo SDK 54 draws edge-to-edge and `KeyboardProvider` (root layout) forces
  `navigationBarTranslucent`, so the window is never resized for the keyboard —
  on screens and inside `<Modal>` windows alike. Sign-up, sign-in and chat all
  had their lower fields (or the composer) hidden behind it, while
  `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — the copy-pasted
  idiom — is a no-op on Android. The fix lives in two places only: the root
  Stack's `screenLayout` wraps **every screen** in `KeyboardSafeView`, and every
  `<Modal>` that holds a text input wraps its own body in one (a Modal is a
  separate window the Stack cannot reach). **Do not add a
  `KeyboardAvoidingView` inside a screen**: both react to the same event with
  the same stale frame and the content lifts twice. A new Modal with an input
  needs `<KeyboardSafeView>` inside it; a new screen needs nothing. Chat's
  composer and the tab bar are the exception that proves it — the bar hides on
  keyboard (`tabBarHideOnKeyboard`) and the composer drops its tab-bar padding
  (`useKeyboardVisible`), or a ~84px gap sits above the keyboard.
  **`KeyboardSafeView` is keyboard-controller's `KeyboardAvoidingView`, not
  React Native's (since 2026-10-08).** RN's caches the last keyboard event and
  re-derives its padding from it on every layout, so once it was wrapping every
  screen a lost hide left the padding in place for good — a grey band (the
  navigator's background) under the tab bar. keyboard-controller's padding
  follows live keyboard progress and is 0 whenever the keyboard is closed.
  Related trap: tab screens sit *under* the tab layout's lesson bar / bell
  header, which already pays `insets.top` — a tab screen header must not add it
  again.
- **Arabic-Indic digits next to operators scramble on web, and no style fixes
  it.** react-native-web puts `dir="auto"` on every `Text` (it beats
  `direction`), and a bidi isolate is not enough: Arabic-Indic digits are type
  AN, so «٩٫٥ × ١٠» still prints as «١٠ × ٩٫٥». A left-to-right *override*
  fixes the digits but reverses Arabic letters («جا» → «اج»). Use `forceLtr` /
  `displayLtr` / `entriesToSegments` in `services/mathCalc.ts`, and check such a
  screen in a browser, not just in tests (see STATUS.md «Math Corner»).
- **Extensionless relative imports only work through esbuild.** Anything loaded
  directly by `node --test` needs an explicit `.ts` extension.
- **The OpenAI client throws at module scope without a key**, which makes
  importing pure helpers in the same file impossible. Import it lazily inside
  the function that calls a model.
- ~~The `gpt-5.6-luna` model id is hardcoded in three api-server files.~~
  **No longer true (checked 2026-08-19):** that string appears nowhere. The
  model comes from `getGenerationModel()` / `getChatModel()` in
  `lib/aiBudget.ts` (`getAiModel()` split in two on 2026-08-22) —
  `AI_MODEL_GENERATE` / `AI_MODEL_CHAT`, both falling back to `AI_MODEL`, then
  to `gpt-4o-mini`. Live generation is gated by `AI_LIVE_MODE=true` and capped
  by `AI_BUDGET_USD`, with `EXPO_PUBLIC_DEMO_MODE=false` on the client. So
  turning real AI on is env vars, not a code change.
- **Mock AI content looks exactly like real AI content.** `RemoteAIService`
  falls back to `MockAIService` on any failure, so with `DEMO_MODE=false` a
  bad key still renders a full lesson plan. Since 2026-08-20 every generation
  is recorded in `services/ai/aiProvenance.ts` and the header badge says which
  it was — check the badge, not the content, when asking "is live AI on?".
- **A missing `EXPO_PUBLIC_*` key is a silent no-op, not an error.** Analytics
  ran for weeks collecting nothing because `EXPO_PUBLIC_POSTHOG_API_KEY` was
  never declared anywhere, and `analytics.ts` degrades to `client = null` by
  design. Same shape as the Unsplash and YouTube "no key" paths. If a
  feature's data is mysteriously absent, check the key is set *and* that the
  build which inlined it has actually deployed — these are baked in at build
  time, so an env change without a rebuild changes nothing.
  **It recurred, per-surface (found 2026-09-19).** The key was added to
  `deploy.yml`'s web build only, so the web app reported and every Android
  binary and OTA update reported nothing — a half-blind funnel that looks
  exactly like a working one in the PostHog dashboard. An `EXPO_PUBLIC_*` has
  **three** places to be declared, not one: `deploy.yml` (web), `eas.json`'s
  per-profile `env` (builds), and `mobile-update.yml` (OTA — `eas update` does
  not read `eas.json`). Add a new one to all three or state why not.
- **A parent or student may have no email.** Since 2026-10-10 they sign up from a
  teacher's code alone (`POST /auth/redeem`), so `users.email` is nullable and
  their credential is a personal login code (`users.login_code_hash`), not a
  password. Anything reading `user.email` for a non-teacher must tolerate null —
  the typechecker finds the typed sites, but not the assumptions: `/verify-email`
  hard-coded `hasRosterLink: false` because "no link can exist yet", which stopped
  being true the day an account could verify an email *after* being linked. And
  **the teacher's code is not a login**: it is shared, not single-use, and
  expires. A new code-only parent may not be made from a class code at all.
- **The schema deploys as migrations (since 2026-10-08) — don't `push` to
  production.** Edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run
  generate`, and commit `lib/db/migrations/`. CI fails a schema edit with no
  migration, applies all migrations to an empty Postgres, and makes destructive
  SQL (`DROP`/`RENAME`/`SET NOT NULL`/type change) wait for
  `destructive-migration: ok` in the PR body, because `deploy.yml` migrates
  *before* the new API revision takes traffic. `verify-schema` still runs
  after, as a backstop. This replaced hand-run `push`, which left production
  behind the code on 2026-08-19 (14 of 24 tables), 2026-09-16 (sign-in 500s for
  36 minutes), 2026-09-26 and 2026-10-05 — twice under a PR body that said
  `schema-push: done`. A database that has tables but no migration history is
  refused until baselined once; see *Schema* in `docs/deploying.md`.
- **A homework due date is a calendar day, and a completion belongs to a roster
  row.** The API sends and takes `dueDate: "YYYY-MM-DD"` and nothing else — an
  instant, a different order or a non-day is a 400 — and stores `dueAt` as
  23:59:59.999 **Asia/Amman** (a fixed UTC+3) of that day. So the traps are on the
  client, not in the contract: reading `dueAt` to say "due today" (a device in
  another zone disagrees with the server about the day near midnight; use the
  `dueDate` and `ammanToday()`), and building a `YYYY-MM-DD` from a local-timezone
  `Date` (`toISOString()` shifts to UTC; `new Date('YYYY-MM-DD')` shifts west of
  it). Display goes through `formatDueDate`, never the bidi algorithm.
  `homework_completions.student_id` is a
  `students.id` (a roster row), not a user: two accounts linked to the same row
  share their ticks, and "did this child do it" must look at every row of the
  child *in that homework's class*. `canTrack` is per homework ITEM, which is
  per class: ticking only works through the account's own `self`-linked rows in
  that item's class, so an item whose class has no such row cannot be ticked and
  must never be called late or unfinished — even when the same child has an
  account in another teacher's class. The child-level `canTrack` on
  `/parent/homework` is informational only; do not gate on it. Pinned by `homework.db.test.ts` and
  `familyHomework.db.test.ts`.
- **A mark a teacher types is invisible to a family until its sitting is handed
  in — writing the grade is not enough.** `studentExamRow` shows a result only
  when the attempt has `submittedAt` *and* results are released. On the teacher
  side only `gradeSubmission` (`modules/assessment/attemptGrading.ts`) stamps
  `submittedAt` and builds the result; `writeTeacherMark` writes the grade and
  stops, so a route that calls it alone passes its own tests (the grade rows are
  there) while the family's row never leaves its pre-mark state (`paper`,
  `available`…) and shows no mark. The paper-totals mark book
  (`lib/paperTotals.ts`) calls both for that reason. `writeTeacherMark` also
  does not check ownership — the caller must. Pinned by `paperTotals.db.test.ts`.
- **Work after `res.json` may never run on Cloud Run.** The API deploys
  without `--no-cpu-throttling`, so once a response is sent the instance's CPU
  is throttled and fire-and-forget work (`promise.catch(log)` after
  `res.json`) can stall until some later request wakes it. The family pushes
  (homework posted, exam date, paper marks) therefore `await pushWithin(…)`
  before answering — capped at 4 s, never throwing (`lib/pushWithin.ts`). So
  do chat messages and broadcasts since 2026-10-16: a chat push sent after the
  response also raced the caller's next request (an unblock straight after a
  post decided who was pushed — `rlsDiff.test.ts` caught it 1 run in 15). The
  release-announcement push is still fire-and-forget; move it the same way if
  its delivery ever looks late.
- **A secret ref in `deploy.yml` before the secret exists fails every deploy.**
  `gcloud run deploy --update-secrets NAME=NAME:latest` refuses a secret Secret
  Manager does not have, and that breaks every merge, not just the one that
  added it. New secrets are attached by hand once (`gcloud run services update
  --update-secrets`), and `--update-env-vars` deploys keep them — see
  `INTERNAL_CRON_KEY` in docs/deploying.md. Code reading one must work, or
  fail closed, while it is unset.
- **Row-level security fails quietly, and `systemDb` is the hole in it (since 2026-10-13).**
  A query that reads *another user's* rows does not error under RLS — it returns fewer
  rows. In the prototype that meant: no push notifications at all (recipients' tokens),
  a blocked user able to open a thread (the block is the other person's row), and a student
  excluded from a restricted exam able to take it from its share link (the audience read came
  back empty, and an empty audience means «everyone»). Statuses alone cannot see any of
  that, so `lib/db/src/__tests__/rlsDiff.test.ts` also diffs the pushes sent and the rows
  left behind. `RLS_ENFORCE` is off by default; `systemDb` (the owner connection) is for
  paths that act without a user or must read other users' rows to decide something, and the
  files that use it are pinned in `systemDbFiles.test.ts`. A new table must be classified in
  `rlsCoverage.test.ts`, and a new table gets **no** grant to `iqraa_app` automatically.
- **`startAttempt` is find-or-create and the marking endpoint upserts (found
  2026-10-14, designing the class scan — it had not bitten yet).** Writing marks
  into a paper you did not create replaces a teacher's or a student's mark with
  no error, and `startAttempt` (mobile) hides which case you are in. Use
  `startAttemptChecked` and read `created`; and remember the `attemptId` you got
  so a retry does not start again and mistake its own half-saved paper for
  someone else's. `services/classScanSave.ts` is the worked example.
- **A corner's colour lives in one table (since 2026-10-21).** `constants/corners.ts`
  holds each corner's tokens; `CornerThemeProvider` (mounted only by the
  `_layout.tsx` of a corner directory — all five: math, lab, quran, english, play) puts them in context and `useColors()`
  spreads them over the palette, so a shared button or chip inside a corner is
  that corner's colour with no edit. Corner code must take
  colours from `useColors()`, never from the global `palette`, whether read at
  module scope or inside render: both ignore the provider and stay teal.
  Text on a `colors.primary` fill is `colors.primaryForeground`, never `'#fff'`:
  in dark mode a corner's primary is light.
  A `Button` in a colour of its own (a game's accent) takes `fill`, never a
  `backgroundColor` style, which leaves the variant's label on it (navy on every
  game accent in dark mode); `gameAccents.test.ts` fails the style form.
  `cornerTheme.test.ts` fails any file in a wired corner (or
  `components/{math,lab,quran,corners,englishHub,publicGames}`) that imports `palette`, and any
  `_layout.tsx` outside a corner directory that mounts `CornerThemeProvider`.
  The library (`/curriculum/resources`) is deliberately **not** a corner — its
  tiles borrow each corner's colour, its own chrome is brand teal.
  A new corner is one table row, one layout
  file, and a `CornerFrame`.
- **Cards, presses, entry motion and bands are shared pieces (since 2026-10-21).**
  The pieces are `useSurface()`/`Surface`, `PressableScale`, `Entrance` and
  `Band` in `components/ui`, built from `ELEVATION` (`constants/theme.ts`) and
  `MOTION` (`services/motion.ts`). Traps:
  - A shadow is light-mode and Android 9+ only; dark cards, and light ones on
    older Android (no outset `boxShadow` below API 28), keep their 1px border.
  - A surface must not set `overflow: 'hidden'`, because iOS clips a view's
    own shadow.
  - When a card takes `useSurface()`, delete its own `borderWidth: 1`. A light
    surface has no border colour, so a leftover width draws black.
  - Motion goes through `useReduceMotion()`. With it on, nothing slides or
    scales.
  - Header bands are `Band`: a gradient that only deepens, and
    `cornerTheme.test.ts` measures white text on both stops.
  - A band under the status bar (one that pays `insets.top`) calls
    `useLightStatusBar()`, or its icons are dark on it in light mode;
    `statusBar.test.ts` fails one that does not.
  - `designScale.test.ts` counts hand-written `shadowColor`, so new depth
    comes from the tokens.
  A teacher's phone lands on Today (`components/today/PhoneToday.tsx`), which
  shares `useTodayLesson()` with the desktop workspace — change the lesson
  logic there, never in one layout; tab visibility and the lesson-bar rule live
  in `services/tabVisibility.ts`.
  Today's band wears the lesson's subject (`subjectTheme` in
  `services/subjectTheme.ts`): a corner subject borrows its corner, any other its
  catalog colour deepened for white text; each prep row has its own hue
  (`PREP_ROWS[].color`).
  Progress is celebrated by `Celebrate` (`components/ui/Celebrate.tsx`) at four
  moments only — exam handed in, game over, last homework ticked, prep checklist
  all ready. The exam fires on a successful hand-in the student made (never the
  forced one when time runs out or the exam closes); the other three fire only
  on the crossing into done (`justCompleted` / `prepCrossing` in
  `services/celebration.ts`), never on opening a screen that is already done.
  A load that failed or fell back to the device list is never the baseline:
  `getItems` does not reject, so the prep board reads `getAllItemsChecked()` and
  drops its baseline on a degraded read, or the next good read at 5 of 5 would
  celebrate on opening Today.
  **Amber (`palette.live`) means *now*** (start class, due today, live) and
  nothing else.
- **Icons take a scale size, and a concept's icon and colour come from `CONCEPTS`
  (since 2026-10-23).** `constants/icons.ts` holds `ICON` (14/16/20/24 for UI
  icons), `ICON_DISPLAY` (32/40/48/64 for empty states and hero glyphs) and
  `CONCEPTS` (one icon and one colour per teaching concept: quiz, worksheet,
  lesson plan, slides, activity, homework, evaluations, challenge, games,
  classroom, parent message…). `toolCatalog.ts` and `PREP_ROWS` read from it, so
  the quiz is one glyph in one colour on the Tools tab, the prep board and a
  generator's header; a new tool adds a concept, never a literal colour. Outline
  for actions and navigation, filled for status (`checkmark-circle`,
  `close-circle`, `alert-circle`, `information-circle`) and the selected tab.
  Never draw a tick, cross, warning or tip with an emoji (✓ ✕ ⚠ 💡 render
  differently on every platform): use `<Ionicons>`. A row or card that leads
  with an icon uses `IconTile` (`components/ui`), whose glyph is
  `readableOn(color, colors.card)`; a raw tool colour drawn as a glyph on a card
  goes through `readableOn(color, colors.card, 3)`, or it sinks on the dark card.
  `iconSystem.test.ts` pins exactly this: every literal `<Ionicons size>` is on the
  scale; one icon family (plus the whiteboard eraser); `CONCEPTS` colours carry
  white at 4.5:1, Tools-tab pairs are at least CIEDE2000 8 apart on the light card
  and on the dark one, and none is amber; the catalog and the prep board read from
  `CONCEPTS`; ✓ ✕ ✗ ⚠ 💡 ✅ ❌ are absent from `.tsx` chrome; `relatedResourcesDone`
  has no leading emoji; the Tools tab, Today and the chat menu use `readableOn` on
  the tool glyph. **Not tested, only convention:** outline for actions and filled
  for status, and which rows use `IconTile`.
  **Iqraa draws its own icons for the main concepts (since 2026-10-23).**
  `constants/glyphs.ts` holds twenty approved drawings (24 grid, 1.75 stroke,
  outline + 18% tint), drawn by `Glyph` / `ConceptIcon` (`components/ui/Glyph.tsx`,
  react-native-svg). The tab bar and the desktop sidebar draw their tabs with
  `tabIcon(name)` in `app/(tabs)/_layout.tsx`: outline when idle, tinted when
  selected (`tint={focused}`), on every platform. A tab added to the bar needs a
  drawing, not an Ionicons name. A concept names its drawing in `CONCEPTS[…].glyph`, a corner
  in `CORNERS[…].drawing`; draw a concept with `<ConceptIcon icon glyph …>`, never
  a bare `<Ionicons name={tool.icon}>`, or the drawing silently falls back to the
  stock glyph. A new drawing must be used or listed in `HELD` with its reason
  (`glyphs.test.ts`; it is empty today).
- **A generator screen is built from `components/generator/` (since 2026-10-23; the
  quiz is the first, the other four follow).** `ToolHeader` takes the band's colour
  from its `concept`; the form is `SegmentedControl` (a list of at most four labels),
  `Stepper` (a numeric list: it moves the screen's INDEX through the real option
  array, never a number), `ChipGroup` (multi-select), one `LessonCard` wrapping the
  existing grade/subject pickers and `TopicSelector`, and a `DockedAction` (docked
  on a phone, under `PaperPreview` on desktop via `GeneratorLayout`). Summary text
  comes from `services/generatorSummary.ts`. Traps: the card's body is hidden with
  `display: 'none'`, never unmounted, because `TopicSelector` holds the unit /
  semester / book selection that drives `useWideScope`; the screen's state names and
  persisted index positions do not change; a stepper over a new array must keep the
  array's order (append, never insert); text or a ring in the tool's colour on a card
  is `readableOn(ACCENT, colors.card)` (the raw concept colour sinks on the dark
  card), a solid fill takes `textOn`. **Pinned by `generatorScreens.test.ts`:** the
  quiz's invariants (state names, option arrays, `TopicSelector` inside the card and
  never conditional, no `PickerField` for a short list, validation, no `palette`, no
  hand-written hex in the shared pieces, 44-point targets, `aria-*` state), and white
  text at 4.5:1 on every concept band. **Only convention:** which list becomes which
  control on a screen not yet ported (a field whose real options are not a short list
  stays a dropdown), and how it looks (check it in `pnpm run dev:mobile:web`, phone
  and desktop, light and dark, RTL).
