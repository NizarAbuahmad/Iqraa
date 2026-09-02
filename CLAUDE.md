# Iqraa — agent context

Arabic-native AI teaching assistant for the Jordanian national curriculum
(Grade 10 math + chemistry first). pnpm monorepo.

## Read this first

**[`STATUS.md`](./STATUS.md) is the single source of truth for project state.**
Read it before acting. When something in it stops being true, edit it in the
same PR that changed it.

Older audits live in `docs/archive/` — historical snapshots, do not act on them.
`.agents/memory/` holds deeper notes: `iqra-architecture.md`,
`ai-integration.md`, `auth-workspace-api.md`.

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

## Commands

```bash
pnpm install
pnpm run typecheck                     # whole monorepo
pnpm run dev:api                       # Express on :8080
pnpm run dev:mobile:web                # Expo web on :8081 (MOBILE_PORT overrides)

cd artifacts/mobile     && pnpm test   # 1017 tests (2026-08-29)
cd artifacts/api-server && pnpm build && pnpm test   # build first — see below
```

`artifacts/api-server`'s mount-order suite boots the built bundle, so run
`pnpm build` before `pnpm test` there or it skips. Both `test` scripts glob
`**/__tests__/**/*.test.ts`; they were once hand-listed and silently drifted, so
**add tests inside those globs, and do not narrow them.**

Local setup, env vars and troubleshooting: [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).
Before a live demo: [`docs/demo-checklist.md`](./docs/demo-checklist.md).

## Conventions

- Feature branches + PRs. `main` is merge-only, and **only `main` is deployed** —
  if a change "isn't showing", check it is merged before debugging anything visual.
- Arabic is the product language; the UI is RTL-first. Compute maths in latin
  `x` and convert to `س` / Arabic digits **only at display time**.
- `DEMO_MODE = true` in `artifacts/mobile/services/ai/demoMode.ts` mocks all
  prose generation. Do not flip it without a decision — see STATUS.md.

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
  is deliberately open to any authenticated teacher, and it retires
  immediately rather than queuing a review.
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
- **The production schema is not deployed by anything.** `pnpm --filter
  @workspace/db run push` is manual, so a release that adds a table and skips
  that push leaves endpoints answering 503. On 2026-08-19, 14 of 24 expected
  tables were missing from production, including the entire evaluations
  subsystem — **and it was fixed the same afternoon** (Neon query history:
  found 1:36pm, migrated 1:41pm, re-checked 1:42pm). This entry went on
  asserting the outage for three more days, because only the problem got
  written down and not the fix.
  **Verified 25/25 present on 2026-08-25**, against the real Neon database
  (`ep-bold-bar-asvxvxjr-pooler…eu-central-1`) — every file `ok`, evaluations
  included. The push is still manual, on purpose, but it is now *checked*: a PR
  touching `lib/db/src/schema` must answer `schema-push:` in its description,
  and `.github/workflows/schema-check.yml` runs `verify-schema` against
  production daily at 06:00 UTC, on demand, and whenever a schema change
  reaches `main`. The `DATABASE_URL` repository secret it needs is set.
  The gap in the *process* is narrowed, not closed — nothing runs the push for
  you. Re-check with `pnpm --filter @workspace/db run verify-schema` rather
  than trusting this line, and note it only asks whether each table *name*
  exists, so a table with a stale column set still reports `ok`.
