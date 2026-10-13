# Student lesson explanations from the shared pool — design

Status: design approved in discussion 2026-10-13, awaiting spec review. Nothing is built.

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
| Reporting | Through the existing `reportVariant` queue. A student report never retires anything by itself. |

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
  `language` as requested (default `arabic`), `retired_at IS NULL`. Newest
  `created_at` first; ties broken by lowest `times_served`. One row returned.
- **Response.** `{ content, variantId }`. `content` has every `teacherNote`
  field removed (see *Open point*). `404 { code: 'not_available' }` when no row
  matches.
- **No model, no spend.** The handler reads the pool and nothing else. It never
  calls `generateContent`, so it needs no live-mode, budget or per-user quota
  gate, and a student cannot cause a paid call. This is stated in the file
  header, because the three guards every other generation route carries are
  absent here on purpose.
- **Serve count.** `noteServed(variantId)`, not awaited, as for teachers.
- **Input.** `:lessonId` must be a known curriculum lesson id (checked against
  the KB list in `lib/curriculum`); anything else is 404 before the query, so
  the route cannot be used to probe `lesson_ref` values.

The lesson id is carried through, never re-derived from a title. Per CLAUDE.md,
107 Arabic titles repeat across grades and `searchKBSemantic(title)` returns a
different lesson for 16 of the 63 pickable ones.

### 2. Data: one index

A plain index on `ai_artifacts (kind, lesson_ref)`, added by editing
`lib/db/src/schema/aiArtifacts.ts`, running
`pnpm --filter @workspace/db run generate`, and committing
`lib/db/migrations/`. No columns change and nothing is dropped, so CI does not
ask for `destructive-migration: ok`. Deploy applies it before the new API
revision takes traffic, as for every migration.

### 3. Prefill

Goal: every supported lesson (the 63 in the MVP picker set) has a stored
explanation before students can ask for it.

- **Where it runs.** `buildGeneratorContext`, `generatorLessonId` and
  `resolveGeneratorGrounding` live in the mobile app
  (`artifacts/mobile/services/kbContext.ts`), not the API. So the script lives
  in `artifacts/mobile/scripts/` and calls the **live endpoint** over HTTP,
  rather than reimplementing the body in the API.
- **Same path as a teacher.** It builds the body exactly as `slides.tsx` does
  for `generateLessonTeaching` (grade, subject, topic, language,
  `additionalContext`, `unitId`, `lessonId`, `contextSource: 'curriculum'`) and
  POSTs `/generate/lesson-teaching`. The row it creates is the row a teacher
  would have created, through every existing guard, and shares a key with a
  teacher's request for the same lesson.
- **Lesson id from the list, not a title.** The script iterates the KB lesson
  list and uses each lesson's id directly, passing the grade/subject `scope`
  (`KbScope`), per CLAUDE.md.
- **Token.** A `system_admin` account, so the run does not spend a teacher's
  monthly allowance (`AI_USER_BUDGET_USD`). Live mode must be on
  (`AI_LIVE_MODE=true`) and the global cap (`AI_BUDGET_USD`) must cover the run.
  Estimated cost ~ $1 for all of maths S1 per the cost plan; the script prints
  the spend it caused rather than assuming.
- **Idempotent.** It skips a lesson that already has a live row for the request
  key, so a rerun after a failure only fills gaps.
- **Review gate.** The script writes what it stored to a review file (lesson id,
  title, the text a student would see). Nothing is announced to students until
  that file has been read; see *Open point*.

### 4. Student app and reports

- **Entry.** A «اشرح لي الدرس» button on the lesson view reached from
  `/(tabs)/curriculum` → browse. The student's own grade is already the default
  there. The button is student-only (`isStudentRole`).
- **Screen.** Hook question, concept cards one idea each (with the
  misconception line), the worked example, then the practice problem with the
  hint shown on request and the answer behind a tap. Layout is a pure function
  from the stored content to a list of cards, in
  `artifacts/mobile/services/`, so it is testable under bare `node --test`.
  RTL-first; maths computed in Latin `x` and converted to `س` / Arabic digits at
  display time only.
- **Not available.** On `404 not_available` the button reads «قريبًا» and is
  disabled. No spinner that never resolves, no silent empty screen.
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

- Lookup: returns the newest live row; skips retired rows; ties go to the least
  served; wrong `language` finds nothing; unknown `lessonId` is 404 before any
  query; `teacherNote` is absent from the response at every depth.
- Roles: 401 without a token, 403 for teacher/parent, 200 for student.
- Mount order: an unowned path is still 404, not 401.
- No-model guarantee: the handler module does not import `generateContent` or
  the OpenAI client (the client throws at module scope without a key, so the
  handler must be importable under `node --test`).
- Report: queues, does not set `retiredAt`, double-tap is a no-op.
- Mobile: the card-layout function on a fixture with and without a book-supplied
  example, with an empty `concepts` array, and with Arabic digits.
- Prefill: a dry-run flag prints the bodies it would send; a test asserts the
  body for a known lesson carries the lesson's own id and `contextSource:
  'curriculum'`.

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
slide, with a `teacherNote` per slide and a worked example that is revealed
after a timer in the deck. A student reading alone on a phone does not need the
note and may meet wording that assumes a class. The endpoint strips
`teacherNote`; the rest is checked by reading the prefill review file against a
short list: phrases addressing "the class" or "your teacher", references to a
timer or reveal, and instructions to the projector. If more than a few lessons
need rewording, stop and choose approach C instead of patching text by hand.

## Open items before building

1. Confirm `AI_LIVE_MODE=true` and a `system_admin` token are available for the
   prefill run, and what `AI_BUDGET_USD` has left.
2. Observe the real hit rate (`select cache_status, count(*) from
   ai_generations`) — this spec does not depend on it, but it says how many
   lessons teachers will already have filled.
3. Confirm the migration has been applied to production for `ai_artifacts`
   itself (`/healthz/ai-budget` → `cacheFailure`). Without that table there is
   nothing to read.
