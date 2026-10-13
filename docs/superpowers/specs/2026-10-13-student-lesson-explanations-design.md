# Student lesson explanations from the shared pool — design

Status: design approved 2026-10-13; revised the same day after reading the code (see *Revision*). Nothing is built.

## Problem

The shared artifact pool (`ai_artifacts`, `docs/ai-cost-savings-plan.md` phase 1)
exists so one paid generation serves every teacher who asks the same question.
Only teachers can reach it: `/generate` is teacher-only
(`routes/index.ts:107`, `requireRole(...TEACHER_ROLES)`), and the one student AI
feature, `chat-student`, is never pooled (`routes/chat.ts:129` — a chat turn
never repeats). A student opens the curriculum tab, picks a lesson, and gets the
book and nothing that explains it.

`/generate/lesson-teaching` already writes exactly the missing part: a hook
question, 3–5 concept cards, one worked example and one practice problem with a
hint and an answer. It is pooled (`contextSource: 'curriculum'`) and is
generated today only as the explanation section of a teacher's Slides Maker
deck. This spec lets a student read those stored explanations.

## Decisions

| Question | Decision |
| --- | --- |
| What a student gets | The stored `lesson-teaching` explanation as-is: hook, concept cards, worked example, practice problem with hint and answer. No quiz, no new generation kind. |
| When nothing is stored | Serve-only. A student never triggers a model call. The button shows «قريبًا». |
| How coverage is filled | A one-off prefill of the supported lessons, plus whatever teachers generate in the normal course. |
| Approach | Look up by curriculum **lesson id**, not by recomputing the teacher's `strictKey`. |
| Who may be shown | Only rows a `system_admin` has approved for students (`student_approved_at`). Not every stored row. |
| Reporting | Through the existing `reportVariant` queue. A student report never retires anything by itself. |

## Revision (2026-10-13, after reading the code)

Three things in the first draft did not survive contact with the code:

1. **Serving every stored row is unsafe.** `slides.tsx` sends
   `lessonId = generatorLessonId(title, lang)` with no `KbScope`
   (`app/ai-tools/slides.tsx:471`), so a row a teacher creates organically can
   sit under the wrong lesson id — the title trap in CLAUDE.md. And a teacher
   accepts what they read; a student is a minor. The first draft's review gate
   was procedural ("nobody announces it until the file is read") while the
   endpoint would have served unreviewed rows the moment it shipped. It is now
   a data gate: `ai_artifacts.student_approved_at`, set only by a
   `system_admin`, and the endpoint filters on it.
2. **The prefill already exists.** `artifacts/mobile/scripts/pregenerate.ts`
   fills the pool for worksheets and lesson plans through
   `services/generatorRequests.ts`. The lesson-teaching prefill is a third call
   kind there, not a new script, and the `slides.tsx` body is extracted into
   `buildLessonTeachingRequest` so the screen and the script cannot drift.
   The extraction is byte-identical to what the screen sends today (pinned by a
   test), so existing teacher rows keep matching.
3. **Two smaller corrections.** Lesson-id validation is by shape only: the
   KB list lives in the mobile app, and an unknown id can only ever match an
   approved row. And the deck's reveal-timer wording
   («اكشف الحل بعد انتهاء المؤقت») is added by `lessonSlides.ts`, not by the
   model, so the projector-wording risk is smaller than the first draft said;
   `teacherNote` is the part that must be stripped.

## Why not recompute the teacher's key

`strictKey` includes the model, `PROMPT_VERSION`, topic, grade, language and a
hash of the curriculum context text (`lib/generationKey.ts`). A student lookup
that rebuilt it would need the mobile app to reproduce the context text
byte-for-byte and would go silently empty — every lesson «قريبًا» — on the next
model or prompt bump, with nothing in the logs to say why. `ai_artifacts`
already stores `lessonRef` (the client's `lessonId`, else the normalised topic;
`lessonRefOf` in `routes/generate.ts`) and its schema comment says it exists so
the catalog can be browsed per lesson without re-deriving keys. This spec uses
it for that.

A lookup by id keeps working across bumps. The cost is that after a
`PROMPT_VERSION` bump students see the previous version until the prefill is
rerun; that is acceptable for explanatory text and is the reason the newest row
wins (below), not the same version.

## Design

### 1. Server: a read-only student endpoint

`GET /student/lesson-explanation/:lessonId?language=arabic|english`

- **Mounting.** The handlers go in `studentExams.ts` (or a sibling router
  mounted beside `studentExamsRouter` in `routes/index.ts`). That file already
  guards its prefix with `router.use("/student", authMiddleware,
  requireRole("student"))` (line 61), so routes under
  `/student/lesson-explanation/...` inherit the student-only check. A sibling
  router must repeat that path-scoped guard; a bare `router.use(mw)` would
  become API-wide and shadow later routers, so do not add one.
  `mountOrder.test.ts` gets a case: an unowned path is still 404, not 401, and
  the new path is 401 without a token and 403 for a teacher.
- **Lookup.** `kind = 'lesson-teaching'`, `lesson_ref = :lessonId`,
  `language` as requested (default `arabic`), `retired_at IS NULL` **and
  `student_approved_at IS NOT NULL`**. Newest `created_at` first; ties broken
  by lowest `times_served`. One row returned.
- **Response.** `{ content, variantId }`. `content` has every `teacherNote`
  field removed (see *Open point*). `404 { code: 'not_available' }` when no row
  matches.
- **No model, no spend.** The handler reads the pool and nothing else. It never
  calls `generateContent`, so it needs no live-mode, budget or per-user quota
  gate, and a student cannot cause a paid call. This is stated in the file
  header, because the three guards every other generation route carries are
  absent here on purpose.
- **Serve count.** `noteServed(variantId)`, not awaited, as for teachers.
- **Input.** `:lessonId` must match `^[A-Za-z0-9_.:-]{1,120}$`; anything else
  is 404 before the query. It is a shape check only: the KB list lives in the
  mobile app, and an id that is not a lesson can only ever match an approved
  row, of which there are none.

The lesson id is carried through, never re-derived from a title. Per CLAUDE.md,
107 Arabic titles repeat across grades and `searchKBSemantic(title)` returns a
different lesson for 16 of the 63 pickable ones.

### 2. Data: one column and one index

A nullable `student_approved_at timestamptz` column and a plain index on
`ai_artifacts (kind, lesson_ref)`, added by editing
`lib/db/src/schema/aiArtifacts.ts`, running
`pnpm --filter @workspace/db run generate`, and committing
`lib/db/migrations/`. Adding a nullable column and an index drops, renames and
retypes nothing, so CI does not ask for `destructive-migration: ok`. Deploy applies it before the new API
revision takes traffic, as for every migration.

### 2b. Approval endpoint (admin)

`POST /moderation/lesson-explanations/approve`, body `{ variantIds: string[] }`
(1–200 uuids), `system_admin` only, next to the artifact-report routes in
`routes/moderation.ts`. It sets `student_approved_at = now()` on live
`lesson-teaching` rows that are not yet approved and returns
`{ requested, approved }`. There is no revoke: retiring a row (an approved
student report, `retireVariant`) already stops it being served.

### 3. Prefill and approval

Goal: every supported lesson has a stored, **reviewed and approved**
explanation before its button turns on.

- **Where.** A third call kind, `lesson-teaching`, in
  `artifacts/mobile/scripts/pregenerate.ts` (`pnpm run pregenerate`). It already
  logs in, rate-limit-waits, stops at a cost cap and is safe to rerun.
- **Same body as the screen.** `buildLessonTeachingRequest(form, grounding,
  regen?)` is added to `services/generatorRequests.ts` and `slides.tsx` calls it
  for `generateLessonTeaching`; the script calls it too. A test pins the builder
  against the old inline construction for every grade 10 maths lesson, so
  nothing teachers have already stored stops matching.
- **Lesson id from the grounding, not the title.** The script reuses
  `pregenerate.ts`'s existing guard: a lesson whose title grounds to a
  different lesson id is skipped, never generated under the wrong one.
- **Scope.** Grade 10 Mathematics and Chemistry. The existing worksheet and
  lesson-plan calls stay maths-only and unchanged.
- **Token.** A `system_admin` account (it can call `/generate`, and approval
  needs it). Live mode on, and `AI_BUDGET_USD` must cover the run
  (~$1 per the cost plan; the script prints what it actually caused).
- **Review file.** For every `lesson-teaching` response, pool hit or fresh, the
  script appends `{ variantId, lessonId, lesson, content }` to a review file
  (`--review=`, default `pregen-review.json`, git-ignored). `content` omits
  `teacherNote`, `sources`, `variantId` and `servedReason`: exactly what a
  student would read.
- **Approve step.** After a person has read the file and deleted the entries
  they reject, `pnpm run pregenerate -- --approve=pregen-review.json` posts the
  remaining `variantId`s to the approval endpoint. Nothing is approved by a
  run that only generates.

### 4. Student app and reports

- **Entry.** A «اشرح لي الدرس» button on `app/curriculum/lesson-detail.tsx`,
  the lesson page a student already reaches from the curriculum tab. It is
  student-only (`isStudentRole`); teachers keep their own buttons. The screen is
  `app/curriculum/lesson-explanation.tsx`, which `routeGating` already allows
  (`/curriculum` is on the non-teacher allowlist). The `lessonId` it sends is the
  lesson page's own `lesson.id`, the same id space as the KB lesson id the pool
  is keyed on (pinned by a test).
- **Screen.** Hook question, concept cards one idea each (with the
  misconception line), the worked example, then the practice problem with the
  hint shown on request and the answer behind a tap. Layout is a pure function
  from the stored content to a list of cards, in
  `artifacts/mobile/services/`, so it is testable under bare `node --test`.
  RTL-first. The text is shown as stored, the same as the slide deck shows it.
- **Not available.** The button checks availability when the lesson page opens;
  on `404 not_available` it reads «شرح الدرس قريبًا» and is disabled. A network
  failure leaves it enabled, and the screen shows a retry. No spinner that
  never resolves, no silent empty screen.
- **Report.** «بلّغ عن مشكلة» calls a new `POST /student/lesson-explanation/
  :variantId/report`, which calls the existing `reportVariant` with the
  student's id. This **queues** a report for a `system_admin`
  (`routes/moderation.ts`, `notifyAdminsOfArtifactReport`); it does not retire
  the row. Unlike the teacher route there is no immediate personal replacement,
  because a student cannot trigger generation. `reportVariant` already makes a
  duplicate open report from the same user a no-op.
- **Why not instant retire.** Teachers may retire immediately because the person
  holding the bad paper is the one who knows. A student's single tap removing an
  explanation for every classmate, with nothing regenerating it, is a bad trade;
  the queue keeps the bad text in circulation until reviewed, which is why the
  prefill review gate matters.

## Testing

All inside the existing globs (`src/**/__tests__/**/*.test.ts` in api-server;
`services/__tests__/**/*.test.ts` in mobile). api-server needs `pnpm build`
first for the mount-order suite.

- **Pure helpers** (`lib/lessonExplanation.ts`): newest approved row wins, ties
  go to the least served, empty list is null; `teacherNote` is removed at every
  depth and nothing else is; the approve body parser accepts 1–200 uuids,
  dedupes, and rejects anything else; the lesson-id shape check.
- **Mount order** (boots the built bundle): the new GET and POST are 401
  without a token, the approve route is 401 without a token, and an unowned
  path is still 404, not 401. Role refusal (403) is `requireRole`'s own,
  already exercised by the existing `/student` routes; booting a signed token
  into this suite is not worth its setup.
- **No-model guarantee:** the route and store modules import neither
  `generateContent` nor the OpenAI client (a source scan, because that client
  throws at module scope without a key).
- **Builder identity** (mobile): `buildLessonTeachingRequest` deep-equals the
  old inline body for every grade 10 maths lesson, and a lesson id from the
  grounding resolves through the curriculum browser's `getLessonById` (the
  id-space pin).
- **Prefill** (mobile): `plannedTeachingCalls()` carries the lesson's own id,
  `contextSource: 'curriculum'`, Arabic, and one call per lesson; `reviewEntry`
  strips the meta and `teacherNote` keys and returns null without a
  `variantId`.
- **Cards** (mobile): the card list for a full artifact, for a missing worked
  example, for an empty `concepts` array, and for blank strings.
- **Routing/i18n** (mobile): `/curriculum/lesson-explanation` is a non-teacher
  route; Arabic and English define the same keys.

## Not in this spec

- Student chat, and any student-triggered generation.
- Parent summaries (`/parent` is a separate role and route).
- Hints or explanations on exam questions (`studentExams.ts`).
- Slicing or precomputing beyond lesson explanations (phases 2 and 3 of the
  cost plan).
- A student-specific prompt (approach C). Revisit if the review below shows the
  projector wording does not survive.

## Open point

`lessonTeachingPrompt.ts` writes for the classroom projector, one idea per
slide, with a `teacherNote` per slide. A student reading alone on a phone does
not need the note and may meet wording that assumes a class. The endpoint
strips `teacherNote`; the rest is checked by a person reading the review file
against a short list: phrases addressing "the class" or "your teacher", and
instructions to the projector. (The reveal-timer sentence is added by
`lessonSlides.ts`, not generated, so it never reaches a student.) If more than a few lessons
need rewording, stop and choose approach C instead of patching text by hand.

## Open items before building

1. Confirm `AI_LIVE_MODE=true` and a `system_admin` login are available for the
   prefill run, and what `AI_BUDGET_USD` has left.
2. Observe the real hit rate (`select cache_status, count(*) from
   ai_generations`) — this spec does not depend on it, but it says how many
   lessons teachers will already have filled.
3. Confirm the migration has been applied to production for `ai_artifacts`
   itself (`/healthz/ai-budget` → `cacheFailure`). Without that table there is
   nothing to read.
