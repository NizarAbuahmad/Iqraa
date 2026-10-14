# Wide-scope teaching tools — lesson plan, slides, activity, classroom builder, lesson-flow (piece 3 of 3)

Status: draft for review · 2026-10-14

Builds on piece 1 (`2026-10-13-wide-scope-selection-design.md`, merged) and piece 2
(`2026-10-14-wide-scope-assessment-tools-design.md`, PR #1054). Piece 3 teaches
the five teaching screens what a unit, a semester or the whole book means.

## Problem

The five teaching screens already show «الكتاب كاملًا» and a unit entry in their
topic picker, because `TopicSelector`'s default allows `lesson`, `unit` and
`book`. Today those arrive as **label strings**, and every one of the five
re-grounds the label (verified by reading the code, not by running the app):

- `resolveGeneratorGrounding(label)`, `generatorLessonId(label)`,
  `buildGeneratorContext(label)` on `lesson-plan`, `activity`, `slides`,
  `lesson-flow` and `classroom/builder` find one lesson, or none. On
  `slides`, `lesson-flow` and the classroom builder the calls are unscoped, so a
  unit title can ground to **another grade's lesson** (piece 2 measured 18 of 35
  unit titles doing this).
- The offline generators then splice the label into lesson-shaped templates
  («المفهوم الرئيسي لـ الفصل الأول كاملًا», «بينجو الفصل الأول كاملًا»).
- There is no semester entry at all on these screens (it is dropped under
  `DEMO_MODE`).

So the tools already offer a choice they cannot honour. Piece 3 makes the choice
real, using the same structured `ScopeSelection` as pieces 1–2.

## Decisions (resolved with the product owner, 2026-10-14)

1. **A wide scope means a revision session.** One session, selective: the
   material spends its time on the key ideas of each unit in scope and says
   plainly what it leaves out. (Alternatives rejected: an overview/pacing plan;
   several sessions with a «عدد الحصص» picker — both are a bigger change to every
   tool and can follow.)
2. **Five tools:** lesson plan, slides, activity, lesson-flow, classroom
   builder. **The infographic is out**: it has no tool screen, it only appears as
   a chat artifact, so it follows when chat gets wide scopes.
3. **The lesson plan keeps today's eight sections** (no new fields, so the
   Ministry-form export, the viewer and the saved-plan type are untouched). The
   main activity runs as a round per unit.
4. **All five activity formats keep working** (individual, group, discussion,
   hands-on, game, plus the warm-up variant). No format gets a second blueprint;
   the content is drawn across the units.

## Non-goals

- Several-session plans, pacing/overview plans, a per-unit weighting control.
- The infographic and the chat path (`iqra.tsx`).
- Evaluations (exams) and `parent-message` / `whiteboard` / `prompt-slides`.
- No distribution picker and no question-count change: those belong to the
  assessment tools. A teaching tool's wide scope has no «توزيع».
- Making `presentation`/`whiteboard` follow a wide result (they take a bare
  topic label; see *Known limits*).

## Design

### 0. What changes in the shared pieces

**`buildScopeRequest(sel, lang, own)`** — new, pure, in
`artifacts/mobile/services/wideScopeRequest.ts` (or a sibling module). It is
**not** `buildWideRequest`: that one wants a question count, builds a lesson
`coverage` for question spreading and forces `contextSource: 'curriculum'` with a
replaced `additionalContext`, which on a teaching tool would silently drop the
teacher's typed objectives, adaptations and prior-topic notes. It returns:

- `scopeRequestFields(grounding)` (scope, digest context),
- explicit-`undefined` `lessonId` / `unitId` and `bookFigureCount: 0`,
- `additionalContext` = the digest **plus** whatever teacher text the screen
  already put in the field, and `contextSource: 'teacher'` whenever the teacher
  typed anything (the existing rule), else `'curriculum'`,
- `coverage: { lessons }` (the lesson table, **no `slots`**) so the offline path
  has the lessons without re-deriving them from a title.

Returns `null` for a lesson scope or a scope that does not ground; the screen
refuses with `wideScopeUngrounded` exactly as the assessment screens do.

**One revision flag, no new request field.** "This is a revision session" is
read from `req.scope` being present (kind unit / semester / book). That keeps the
cache key as it is (the scope key and the digest hash already separate a wide
request from a lesson one) and a lesson request byte-identical; no
`PROMPT_VERSION` bump is needed because a prompt gains text only when `scope` is
present.

**Every screen adopts the same guards the piece-2 reviews forced** (each was a
real defect found there): a module-level inert `WIDE_GROUNDING`, so a wide
result never re-grounds its label; `noFigures` on `useGeneratorExport`;
`scopeLabel(sel, lang)` as the grounding-notice title; `hideRelated` on
`GeneratorResultActions`; `useWideScope(params, {gradeId, subjectId})`; a
frozen-at-generation `wideFrozen` that Save writes through `scopeFormState`
(`withLessonId` already declines to stamp a lesson id on a wide material); the
grounding calls skipped for a wide scope; `groundedSubjectConflict` skipped for a
wide scope only. `offlineWideScope` is passed to `TopicSelector` and
`allowedKinds` becomes `['lesson','unit','semester','book']`.

### 1. Lesson plan (`lesson-plan.tsx`, `generators.ts`, `prompts.ts`) — size L

*Offline.* A wide branch in `lessonPlanOnce` (before `groundedKb`) builds the
eight sections from the **units in scope** rather than one `KBLesson`: per unit,
its title, up to three outcomes and up to three key terms from the scope's
lessons (the data `resolveScopeGrounding` already digests). The teaching style
still applies: its phases (`lessonPlanBlueprints.ts`) are kept, and the **main
activity is arranged as a round per unit** in each style's own form (inquiry: one
guiding question per unit; collaborative: one group card per unit; direct: one
worked review per unit). Introduction states the scope and **what the session
leaves out** (the lessons whose outcomes did not fit the time). The Arabic teacher
fields stay first person future («سأعرض… ثم سأسأل…»), per the voice rule.
*Prior-knowledge review is not offered on a wide scope* (as on the wide
worksheet).

*Live.* A revision clause in `lessonPlanPromptAr/En`, appended only when
`scope` is present, saying: this is one revision session over the listed
units; give each unit a round in the main activity; spend the time on the key
ideas; state what is left out; keep the first-person-future voice; keep the
teaching-style contract. It lives beside `LESSON_STYLE_RULES_*` and the offline
wide builder and is pinned to it (same two-places rule).

*Screen.* Ministry export (`:383-409`) needs a single lesson's unit, periods and
prior learning; it is **hidden for a wide plan** (open item 1).

### 2. Activity (`activity.tsx`, `activityBlueprints.ts`, `prompts.ts`) — size L

*Offline.* `buildOfflineActivity` branches before `groundedKb`: the concept pool,
rules, key terms and bank items come from `req.coverage.lessons` across the units
(the same lesson-table approach as piece 2's `offlineWideScope`), and the topic
phrase passed to the blueprint is a revision phrase («موضوعات الفصل الأول» /
«Semester 1 topics») instead of the label. The blueprints themselves are
**unchanged** (all formats keep their structure; decision 4).
`nextActivityVariant`'s key gains the scope key so two grades' «الكتاب كاملًا»
do not share a regenerate counter.

*Live.* One wide clause appended to the activity prompt (not one per format, so
`activityBlueprints.test.ts` / `activityPrompts.test.ts`, which assert every
field of every format differs, are untouched): draw the content across the
listed units, give each unit a share. The hands-on format's "textbook page"
wording is single-lesson and is reworded in the wide clause only.

### 3. Classroom builder (`classroom/builder.tsx`, `classroomPrompts.ts`) — size M

`ClassroomActivityRequest` gains optional `scope` and `coverage` (the type is the
blocker; `RemoteAIService` posts the body whole). The screen's grounding calls are
unscoped today; for a wide scope they are skipped and `buildScopeRequest` fields
are merged last. *Offline:* the seven types take the revision topic phrase and
draw bank items from the lesson table (quick-check, bingo, relay already bank on
maths/chemistry). *Live:* the 14 server templates bake `"lesson"` and
`"activityName"` from `b.topic`; the scope label is acceptable there as a display
name, and one wide clause is appended by the shared wrapper. `classroomRouting`
(card ids) and `classroomPrompts` (type set) tests must still hold.

### 4. Slides (`slides.tsx`, `lessonSlides.ts`) — size L

`slides.tsx` makes three calls and builds the deck locally with `buildLessonDeck`,
which is book-first around one `KBLesson`. For a wide scope the deck is built from
the **wide plan and the wide quick-check only**:

- `generateLessonPlan` (wide, §1) and `generateClassroomActivity` quick-check
  (wide, §3) go through as for the other tools;
- **`generateLessonTeaching` is skipped**: its prompt is single-lesson by design
  («التزم بهذا الدرس وحده») and it is the one call with no offline twin;
- `buildLessonDeck` gets `lesson: null`, which already drops the sections that
  read a lesson (book outcomes, vocabulary, rules, figures, exercises); the deck
  is the plan's introduction, one round per unit, the quick check and the closure.
  A test pins that a wide deck has no figures slide and no lesson-only slide.

The lesson-id side panels (`LessonAttachments`, `LessonLabItems`,
`LessonResources`) get no lesson id for a wide deck.

### 5. Lesson-flow (`lesson-flow.tsx`, `lessonFlowRunner.ts`) — size M

The runner spreads one `req` into six steps. For a wide scope: steps 1–3 (plan,
warm-up, activity) use the wide fields from §1–§2. Steps 5–6 (worksheet, exit
ticket) are already wide-capable after piece 2, but the runner overrides
`numQuestions` per step (5 and 3) after `coverage.slots` was planned for another
count — the live prompt would then contradict itself. **Lesson-flow sends the
`random` distribution (no `slots`) for its two question steps**, and the offline
path re-plans from the lesson table either way. `LessonFlowOutput` already
carries only `topic`/`grade`/`subject`; Save writes `scopeFormState` plus the
grade/subject ids (today's lesson-flow `formState` has neither `gradeIdx` nor
`subjectIdx`, so a reopened flow guesses them from the label — the scope carries
the ids for a wide flow). The PDF figures call is skipped for a wide flow.

### 6. Server

All five `/generate/*` routes already call `withGrounding`, which handles `scope`
and pools book pages. The new text lives in `prompts.ts` / `classroomPrompts.ts`
(§1–§3) as clauses present only when `scope` is present. `parseCoverage` is
reused for the `coverage.lessons` table on activity and classroom (lessons only;
`slots` are never sent by these tools).

### 7. Tests (inside the existing globs)

- `buildScopeRequest`: wide fields merged over teacher text keep the teacher's
  `contextSource`; explicit-undefined lesson fields; null for lesson/ungrounded.
- Lesson plan: a wide plan has eight sections, one round per unit in the main
  activity for each of the three teaching styles, the scope statement and the
  "left out" sentence in the introduction, first-person-future Arabic
  (`lessonPlanTeacherVoice.test.ts` still passes); a lesson plan request is
  byte-identical; the live clause is present only with `scope`.
- Activity: every format on a wide request draws from ≥2 units; the structure
  tests (`activityBlueprints`, `activityPrompts`) still pass; the regenerate
  counter key includes the scope.
- Classroom: each of the seven offline types renders without the label in a
  lesson-shaped sentence; the type/card-id pins pass.
- Slides: a wide deck has no figures and no lesson-only slide; the quick-check
  step carries the wide fields; `generateLessonTeaching` is not called.
- Lesson-flow: steps 5–6 carry `distribution: 'random'` and no `slots`; steps 1–3
  carry the scope.
- Screens (typecheck + read-through only, no browser): each uses the guards of §0.
- An end-to-end pin like piece 2's `coverageLivePrompt`: for a unit whose lessons
  all have banks, the offline activity's lessons are a subset of the lesson table
  the live clause lists.

## Rollout and verification

Same stance as piece 2: `offlineWideScope` is passed on all five screens
(production web runs `DEMO_MODE`; otherwise the feature is invisible), the web
build is not clicked through here, and **someone must click through each of the
five screens on the web preview before merging**. STATUS records this plainly.
The tools that already offered `unit` / `book` entries stop passing a label for
them, which is the bug fix hiding inside this piece.

## Known limits

- `presentation` → `whiteboard` passes `activity.lesson` (the scope label) as a
  bare topic, and lesson-flow's «ابدأ الحصة» sends the label to the classroom
  builder. Piece 3 does **not** fix these two links; Related-tools panels are
  hidden on a wide result (`hideRelated`), but these direct links still carry the
  label and can re-ground it on the receiving screen.
- A reopened wide material shows the saved scope but `TopicSelector`'s dropdowns
  show their placeholders (the component's documented prefill limit).
- The live model's adherence to the revision clause is untestable here.
- The introduction's "what is left out" is the model's/offline builder's own
  statement; it is not verified against the lessons.

## Open items for your review

1. **Ministry export on a wide plan** — hidden (proposed) vs generated with
   «يُراجَع قبل الاعتماد» placeholders for unit/periods/prior learning.
2. **Slides skip `generateLessonTeaching`** (proposed) vs a wide teaching variant.
   Skipping is smaller but the deck has less per-concept narration.
3. **Where "what the session leaves out" lives** — in the introduction
   (proposed, no schema change) vs the closure.
4. **Lesson-flow's question steps use `random`** (proposed) vs rebuilding
   `coverage` per step with that step's count.
5. **Order of work** (proposed): shared pieces (§0) → lesson plan → activity →
   classroom builder → slides → lesson-flow → STATUS; slides and lesson-flow
   depend on the first three.
