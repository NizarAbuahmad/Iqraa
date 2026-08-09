# Student Level Evaluation Module — Design & Implementation Plan

> Status: **proposal, not yet built.** Written 2026-08-09 against the repo at
> commit `2b88517`. Nothing in this document is implemented yet.
> Verify claims against the running system before acting on them.

## Confirmed decisions (2026-08-09)

- **Iqraa stays a teacher product.** Students get no account, no login, no app
  install, and no user record. They are roster entries owned by a teacher.
- **Delivery is a shared browser link.** The teacher publishes and sends a link;
  the student opens it on any phone browser and answers. This is a **public route
  on the existing Expo web build** (`iqraa-web.onrender.com`) — nothing new to
  deploy, nothing to install. The student never sees teacher chrome, tabs, or a
  login wall.
- **Attribution is per-student links**, not one class-wide link. A level attached
  to the wrong name is worse than no level. A single shared "type your name" link
  can be added later as a convenience, but it is not the default.
- **Everything teacher-facing ships first.** The student link is the *last*
  feature phase, not the middle one. See the reordered plan in §8.
- Open: which model backs AI grading (§8). Blocks the AI-grading phase only.

### Why the teacher-only slice needs an answer-entry screen

Teacher-only work ends at *publish*. Grading, level, gaps and recommendations all
need answers, and answers only exist once someone responds. Building authoring
first and stopping would leave a strong question generator and none of the
evaluation.

So the grading pipeline is fed first by **teacher answer entry** — a teacher
opens a student, types or taps in what that student wrote on paper, and the app
grades it. This is teacher-facing, it makes the level real, and it is how most
Jordanian classrooms actually work today.

The student link, when it arrives, is a **second input channel into the same
pipeline** — not a second pipeline. `attempts.source` distinguishes them and
nothing downstream cares. That single field is what keeps the student phase cheap.

---

## 0. What already exists (and what doesn't)

Grounding first, because three items in the brief assume things this codebase
does not have.

| Brief assumes | Reality in the repo today |
|---|---|
| Students exist | **They don't.** `users.role` is hardcoded `"teacher"` at registration (`artifacts/api-server/src/routes/auth.ts:94`). No roster, no class, no student record anywhere. |
| The server knows the curriculum | **It doesn't.** Curriculum is client-side only: `artifacts/mobile/data/*.json` + `artifacts/mobile/services/curriculum*.ts`. The API has never seen a learning objective. |
| Learning objectives are addressable | **They are — this is the good news.** `LearningOutcome` already carries a stable `id`, `bloomsLevel` (`Remember`…`Create`) and `skills[]` (`artifacts/mobile/services/curriculumData.ts:69`). Your four competencies map directly onto data that already exists. |
| AI generation is real | **It is mocked.** `DEMO_MODE = true` (`artifacts/mobile/services/ai/demoMode.ts`). Live path calls model id `gpt-5.6-luna`, which STATUS.md flags as probably invalid. |
| Math can be machine-verified | **Partly.** The SymPy service proves the *derivative slice only* (`artifacts/mobile/services/ai/verifyMath.ts`). General "is the student's answer equivalent to the key" needs a small new endpoint. |
| A quiz generator exists | Yes, but only 3 question types (`multiple_choice`, `true_false`, `short_answer` — `AIService.ts:83`). The brief needs 8. The existing generator is for **printable teacher material**, not a graded, delivered, scored assessment. It is a starting point, not a foundation. |

**Consequence:** this is not "add a screen." It is a new vertical — roster,
delivery, grading, analytics — that happens to reuse the curriculum data and the
verifier. Plan accordingly. Phase 0 and 1 below build things the brief never
mentions but that everything else depends on.

### One honest flag before you read further

You can mock question *generation* and still demo credibly. **You cannot mock
grading and still call the output a student level.** A fake level is worse than
no level — it is the exact thing a teacher will catch in week one.

The way out is better than it sounds: **most of this module needs no LLM at
all.** Multiple choice, true/false, matching and fill-in-the-blank grade
deterministically. Math short answers grade through SymPy. Only genuinely
open-ended prose needs a model. So the recommendation is:

- **Generation:** mocked initially (deterministic, curriculum-derived), real later.
- **Objective + math grading:** real from day one, zero AI risk. This is ~70% of marks.
- **Open-ended grading:** real model, narrow scope, always confidence-scored and
  flagged for teacher review. This forces the `gpt-5.6-luna` model-id decision —
  it cannot be deferred past Phase 6.

---

## 1. Recommended user flow

### 1.1 Teacher — authoring

```
Evaluations list
  └─ [New evaluation]
      1. Scope        Grade → Subject → Book/Semester → Unit → Lesson
                      → pick learning objective(s)  [multi-select, ≥1 required]
      2. Shape        Difficulty (Basic / Standard / Advanced)
                      Question count
                      Assessment types (multi-select, 8 available)
                      Optional: time limit, shuffle, release-results-to-student
      3. Generate     AI proposes N questions, balanced across competencies
                      → progress state, cancellable
      4. Review&Edit  Per question: edit / delete / regenerate / change type,
                      difficulty, marks, objective, rubric. Add manual question.
                      Live "coverage meter": marks per competency & per objective.
      5. Preview      Renders exactly what the student sees (answers hidden)
      6. Publish      → assign to student(s) or a class, set due date
                      OR Save as draft (any step, at any time)
```

Two rules that matter:

- **Draft is the default and is always saveable.** A teacher planning tomorrow's
  lesson at 11pm gets interrupted. Autosave every mutation.
- **Publish is a one-way-ish gate.** Once a student has started, questions are
  frozen for that attempt (each attempt stores its own question snapshot). Editing
  a published evaluation creates version N+1 for *future* attempts only. Without
  this, mid-flight edits silently corrupt results.

### 1.2 Student — taking (**Phase 9 — deferred until teacher scope is complete**)

The student opens a link the teacher sent (WhatsApp, printed QR, written on the
board). It loads a public route on the web build in a normal phone browser. No
install, no login, no account — the link itself is the identity.

```
Open the teacher's link
  1. Intro       Title, subject, lesson, N questions, time limit, instructions.
                 "Your answers save automatically."   [Start]
  2. Questions   One question per screen (default) — mobile-first, Arabic RTL.
                 Progress "السؤال ٤ من ١٥" + a dot-strip showing answered/skipped.
                 Back/Next freely. Autosave on every change + on blur.
  3. Review      Grid of all questions, answered/unanswered marked.
                 Jump to any. Unanswered count warned explicitly.
  4. Submit      Confirmation dialog naming the unanswered count. Irreversible.
  5. Result      Only if the teacher enabled release. Otherwise: "تم التسليم"
                 and a note that the teacher will review.
```

Never reveal correctness before submit — not via colour, not via ordering, not
via a "check" affordance. Enforce this **on the server**: the student endpoint
returns a projection of the question that physically does not contain
`expectedAnswer` or `rubric`. Hiding it in the client is not a control.

### 1.3 System — after submit

```
submit
 → freeze answers (is_final)
 → Tier 1  deterministic grading      (MCQ, T/F, matching, fill-blank)   sync, <100ms
 → Tier 2  math equivalence via SymPy (numeric/symbolic short answers)   sync, ~1s
 → Tier 3  AI rubric grading          (short answer, open, problem)      async job
 → compute competency + objective scores
 → resolve level against the scale snapshot
 → generate recommendations
 → notify teacher; flag low-confidence items into a review queue
```

Tiers 1–2 mean a student sees "submitted" instantly and a teacher sees a partial
score immediately, with prose items filling in behind. If Tier 3 fails entirely,
the result is still produced, marked **provisional**, with those items sent to the
teacher to grade by hand. The feature degrades; it does not break.

### 1.4 Teacher — results

```
Results dashboard (per evaluation)
  ├─ Class summary: level distribution, mean %, weakest objectives, review queue badge
  └─ Per student row → Student performance detail
        Level + overall %  |  competency bars  |  per-objective table
        Strengths / Gaps / Recommended next steps
        Question-by-question: student answer, verdict, marks, why,
                              grader badge (Verified / Auto / AI-judged),
                              confidence, [Override] on AI-judged items only
```

The **grader badge is not decoration** — it is the trust mechanism the brief asks
for in rule 7. Three visually distinct states:

- `✓ محقَّق` **Verified** — SymPy proved it. Show the proof.
- `● تصحيح آلي` **Auto** — exact/normalized match against the key. Deterministic.
- `◆ تقدير الذكاء الاصطناعي` **AI judgement** — a model decided. Confidence shown.
  Overridable. Below the confidence threshold it is *not counted as final* until
  the teacher confirms.

---

## 2. Database schema

New Drizzle files under `lib/db/src/schema/`. Postgres. All ids `uuid` defaults,
all timestamps `withTimezone`. `(P1)` = Phase 1 must-have, `(P2)` = later.

### 2.1 Roster — `students.ts`

**Confirmed: students do not get accounts.** Rostered records owned by the
teacher, reached by a per-attempt browser link. Rationale: auth for minors drags
in consent, password recovery for 15-year-olds, and a parent-facing support load
— none of which teaches anyone anything. Add accounts later only if the product
needs student-owned history across terms.

`class_groups.join_code` is kept in the schema but **unused in Phase 1** — it is
the hook for a future "one shared link, type your name" mode. Per-student links
are the shipping path.

```ts
class_groups
  id, teacher_id → users(cascade), name, name_ar,
  grade_id text, subject_id text, academic_year text,
  join_code text unique,            // short, human-typeable, rotatable
  archived_at timestamptz null, created_at

students
  id, teacher_id → users(cascade),
  display_name text, external_ref text null,   // school register number
  grade_id text, created_at, archived_at null
  // deliberately no email, no password_hash

class_memberships                    // many-to-many: a student has several subjects
  id, class_group_id → class_groups(cascade), student_id → students(cascade),
  created_at,  unique(class_group_id, student_id)
```

### 2.2 Configuration — `assessmentConfig.ts`

```ts
level_scales                          (P1)
  id, name, scope 'system'|'school'|'teacher', owner_id uuid null,
  is_default bool, version int default 1, created_at
  // versioned so changing thresholds never silently rewrites past results

level_bands                           (P1)
  id, scale_id → level_scales(cascade),
  key 'beginner'|'developing'|'proficient'|'advanced',
  label_ar, label_en, descriptor_ar, descriptor_en,
  min_percent numeric(5,2), max_percent numeric(5,2), sort_order int
  // constraint: bands of one scale must tile 0..100 without gaps or overlap

competency_definitions                (P1)
  id, key 'knowledge'|'understanding'|'application'|'critical_thinking',
  label_ar, label_en, blooms_levels text[],   // ['Remember'] / ['Analyze','Evaluate','Create']
  sort_order int
  // seeded, but a table not an enum — the brief demands expandability

rubric_templates                      (P2)
  id, owner_id → users null, name, name_ar, criteria jsonb, created_at
```

### 2.3 Authoring — `evaluations.ts`

```ts
evaluations                           (P1)
  id, teacher_id → users(cascade),
  title, title_ar,
  grade_id, subject_id, book_id, unit_id null, lesson_id null,
  objective_ids text[] not null,               // ≥1, from curriculum package
  difficulty 'basic'|'standard'|'advanced',
  target_question_count int,
  assessment_types text[],                     // requested mix
  language 'ar'|'en' default 'ar',
  status 'draft'|'published'|'closed',
  version int default 1,
  level_scale_id → level_scales,
  time_limit_min int null,
  shuffle_questions bool default false,
  release_results_to_student bool default false,
  total_marks numeric(6,2) default 0,          // denormalized, recomputed on mutation
  generation_params jsonb,                     // exact request sent to the generator
  generator 'mock'|'llm', model_id text null,
  published_at, closed_at, created_at, updated_at

evaluation_questions                  (P1)
  id, evaluation_id → evaluations(cascade),
  order_index int,
  type 'multiple_choice'|'true_false'|'matching'|'fill_blank'
      |'short_answer'|'open_ended'|'problem_solving'|'practical_task',
  body jsonb not null,        // type-specific; see 2.5
  expected_answer jsonb not null,
  rubric jsonb null,          // required when grading_mode='ai_rubric'
  objective_id text not null,
  competency_key text not null,        // → competency_definitions.key
  skill text null,
  difficulty 'basic'|'standard'|'advanced',
  marks numeric(5,2) not null,
  grading_mode 'deterministic'|'math_equivalence'|'ai_rubric'|'manual',
  source 'ai'|'teacher'|'ai_edited',
  ai_metadata jsonb null,     // model, prompt hash, generation timestamp
  verification jsonb null,    // SymPy proof of the KEY at authoring time
  deleted_at timestamptz null,
  created_at, updated_at
  index (evaluation_id, order_index)

evaluation_question_revisions         (P2)
  id, question_id, snapshot jsonb, reason 'edit'|'regenerate', actor_id, created_at
```

### 2.4 Delivery & grading — `attempts.ts`

```ts
evaluation_assignments                (P1)
  id, evaluation_id → evaluations(cascade),
  student_id → students null, class_group_id → class_groups null,
  due_at null, assigned_by → users, created_at
  // exactly one of student_id / class_group_id  (CHECK constraint)

attempts                              (P1)
  id, evaluation_id, assignment_id null, student_id → students,
  source 'teacher_entry'|'student_link' default 'teacher_entry',
  // ↑ the seam. Teacher entry ships first; the student link plugs into the same
  //   row shape later. Nothing downstream of grading reads this field.
  entered_by → users null,                     // set when source='teacher_entry'
  status 'not_started'|'in_progress'|'submitted'|'grading'|'graded'|'needs_review',
  access_token_hash text unique null,          // student_link only; never store raw
  token_expires_at null,
  question_snapshot jsonb not null,            // FROZEN at start — see §7
  level_scale_snapshot jsonb not null,         // FROZEN at start
  started_at, submitted_at, graded_at,
  time_spent_sec int default 0,
  created_at
  index (evaluation_id, student_id)

attempt_answers                       (P1)
  id, attempt_id → attempts(cascade), question_id,
  response jsonb,             // shape mirrors question type
  is_final bool default false,
  answered_at, updated_at,  unique(attempt_id, question_id)

attempt_question_grades               (P1)
  id, attempt_id → attempts(cascade), question_id,
  awarded_marks numeric(5,2), max_marks numeric(5,2),
  verdict 'correct'|'partial'|'incorrect'|'unanswered',
  grader 'deterministic'|'math_verifier'|'ai'|'teacher',
  confidence numeric(4,3) null,       // null for deterministic — it isn't a guess
  needs_review bool default false,
  rationale_ar text, rationale_en text null,
  evidence jsonb null,        // matched key concepts, SymPy computed answer, etc.
  graded_at,  unique(attempt_id, question_id)

grade_overrides                       (P1)
  id, attempt_id, question_id, teacher_id → users,
  old_marks, new_marks, old_verdict, new_verdict, note text, created_at
  // append-only audit trail; never mutate a grade in place

attempt_results                       (P1)
  attempt_id primary key → attempts(cascade),
  earned_marks, total_marks, percent numeric(5,2),
  competency_scores jsonb,    // {knowledge:{earned,total,percent,questionCount,sufficient}}
  objective_scores jsonb,
  level_key text, level_scale_id, level_scale_version int,
  is_provisional bool default false,   // true while low-confidence AI marks are unconfirmed
  computed_at

recommendations                       (P1)
  id, attempt_id → attempts(cascade),
  kind 'review'|'practice'|'activity'|'reassess',
  objective_id text null, payload jsonb,
  generated_by 'rule'|'ai', confidence numeric(4,3) null, created_at

grading_jobs                          (P1)
  id, attempt_id, status 'queued'|'running'|'done'|'failed',
  attempt_count int default 0, last_error text, created_at, updated_at
```

### 2.5 Question `body` / `expected_answer` / `response` shapes

The one design decision that determines whether adding a 9th question type later
is an afternoon or a month. **Everything type-specific lives in jsonb; the table
stays stable.** Each type is a module registering `{ render, validate, grade,
sanitizeForStudent }`.

```jsonc
// multiple_choice
body:            { "stem": "...", "options": [{"id":"a","text":"..."}, ...], "multiSelect": false }
expected_answer: { "optionIds": ["b"] }
response:        { "optionIds": ["b"] }

// true_false
body:            { "statement": "..." }
expected_answer: { "value": true }
response:        { "value": false }

// matching
body:            { "left": [{"id":"l1","text":"..."}], "right": [{"id":"r1","text":"..."}] }
expected_answer: { "pairs": [["l1","r3"], ["l2","r1"]] }
response:        { "pairs": [["l1","r3"]] }          // partial credit per pair

// fill_blank
body:            { "template": "ناتج ٣ + ٤ يساوي {{1}} ووحدته {{2}}", "blanks": 2 }
expected_answer: { "blanks": [ {"accept": ["٧","7","سبعة"], "normalize": "ar-numeric"},
                               {"accept": ["سم"], "normalize": "ar-text"} ] }
response:        { "blanks": ["7", "سم"] }

// short_answer
body:            { "prompt": "..." }
expected_answer: { "modelAnswer": "...", "keyConcepts": ["...","..."],
                   "mathEquivalence": { "enabled": true, "expression": "2*x+3" } }
response:        { "text": "..." }

// open_ended  /  problem_solving
body:            { "prompt": "...", "scenario": "..." }          // scenario only for problem_solving
expected_answer: { "modelAnswer": "...", "keyConcepts": [...], "requiredSteps": [...] }
response:        { "text": "..." }

// practical_task
body:            { "prompt": "...", "materials": [...], "steps": [...],
                   "submission": "text"|"photo"|"offline" }
expected_answer: { "successCriteria": [...] }
response:        { "text": "...", "attachmentIds": [...] }
// note: 'offline' submission is graded by the teacher only — excluded from AI scoring

// rubric (any AI-graded type)
rubric: { "criteria": [ { "id":"c1", "label_ar":"صحة المفهوم", "marks": 2,
                          "levels": [ {"marks":2,"descriptor_ar":"..."},
                                      {"marks":1,"descriptor_ar":"..."},
                                      {"marks":0,"descriptor_ar":"..."} ] } ] }
```

`practical_task` deserves a warning: it is the one type that often cannot be
assessed through a screen. Treat `submission: "offline"` as teacher-graded by
design and exclude it from the automatic level calculation, or the level silently
measures "did the student type something."

---

## 3. API endpoints

Mounted under a new `artifacts/api-server/src/routes/evaluations/` directory,
registered in `routes/index.ts`. All teacher routes behind the existing
`requireAuth` middleware. Student routes use a **separate attempt-token guard** —
never the user JWT.

### 3.1 Curriculum (new, server-side)

```
GET  /curriculum/grades
GET  /curriculum/subjects?gradeId=
GET  /curriculum/books?gradeId=&subjectId=
GET  /curriculum/units?bookId=
GET  /curriculum/lessons?unitId=
GET  /curriculum/objectives?lessonId=   → [{id, description, descriptionAr, bloomsLevel, skills}]
```

### 3.2 Roster

```
POST   /classes                         GET /classes            GET /classes/:id
PATCH  /classes/:id                     POST /classes/:id/rotate-code
POST   /classes/:id/students            { displayName, externalRef? }  (bulk accepted)
DELETE /classes/:id/students/:studentId
GET    /students?classId=
```

### 3.3 Authoring

```
POST   /evaluations                          → draft
GET    /evaluations?status=&subjectId=&page=
GET    /evaluations/:id                      → full, with answers (teacher view)
PATCH  /evaluations/:id
DELETE /evaluations/:id                      (draft only; published → /close)

POST   /evaluations/:id/generate             → { jobId } | { questions } if mock
GET    /evaluations/:id/generate/:jobId      → poll
POST   /evaluations/:id/generate/cancel

POST   /evaluations/:id/questions            add manual
PATCH  /evaluations/:id/questions/:qid       edit any field incl. rubric, marks, objective
DELETE /evaluations/:id/questions/:qid       soft delete
POST   /evaluations/:id/questions/:qid/regenerate   { keep?: ['objective','type','marks'] }
POST   /evaluations/:id/questions/reorder    { orderedIds: [...] }

GET    /evaluations/:id/preview              student-shaped payload, answers stripped
GET    /evaluations/:id/coverage             marks per competency / objective + warnings
POST   /evaluations/:id/publish              validates, freezes v N
POST   /evaluations/:id/close
POST   /evaluations/:id/assign               { studentIds[] | classGroupId, dueAt? }
                                             → [{ studentId, attemptId, link }]
```

### 3.4 Student — **Phase 9, deferred** (attempt-token auth)

Specified now so the schema and the sanitized-projection contract are right from
day one; not built until every teacher-facing phase is done.

```
POST /student/sessions            { joinCode, displayName|studentRef } → { attemptId, token }
GET  /student/attempts/:id                    intro payload
POST /student/attempts/:id/start              freezes question_snapshot, starts clock
GET  /student/attempts/:id/questions          SANITIZED — no answers, no rubric
PUT  /student/attempts/:id/answers/:qid       autosave; 409 if already submitted
GET  /student/attempts/:id/answers            for the review screen
POST /student/attempts/:id/submit             idempotent; triggers grading
GET  /student/attempts/:id/result             403 unless release_results_to_student
```

### 3.5 Grading & results

```
GET  /evaluations/:id/results                 class summary + level distribution
GET  /attempts/:attemptId/result              full detail incl. per-question grades
POST /attempts/:attemptId/regrade             re-run all tiers
POST /attempts/:attemptId/questions/:qid/override   { marks, verdict, note }
GET  /evaluations/:id/review-queue            low-confidence items across all students
POST /attempts/:attemptId/finalize            clears is_provisional after teacher review
GET  /attempts/:attemptId/recommendations
POST /attempts/:attemptId/recommendations/regenerate
```

### 3.6 Config

```
GET  /level-scales                GET /level-scales/:id
POST /level-scales                PATCH /level-scales/:id     (school/teacher scope)
GET  /competencies
```

---

## 4. AI prompts & evaluation logic

Three separate AI surfaces. Never one mega-prompt — they have different failure
modes and different tolerances for being wrong.

### 4.1 Generation

**System prompt (Arabic-first, curriculum-locked):**

```
أنت مصمّم تقييمات تربوي خبير في المنهاج الأردني الوطني.
مهمتك: توليد أسئلة تقييم دقيقة ومناسبة للصف المحدّد فقط.

قواعد ملزمة:
١. لا تخرج عن محتوى الوحدة والدرس المُعطى. لا تفترض معرفة من صفوف أعلى.
٢. كل سؤال يجب أن يرتبط بنتاج تعلّم واحد من القائمة المُعطاة، بمعرّفه.
٣. تجنّب الأسئلة الغامضة أو ذات الإجابات المتعدّدة غير المقصودة.
٤. استخدم مفردات مناسبة لعمر الطالب. تجنّب التعقيد اللغوي غير الضروري.
٥. العربية هي لغة الإخراج، بصياغة طبيعية سليمة — لا ترجمة حرفية.
٦. وازِن بين مستويات: معرفة، فهم، تطبيق، تحليل/تفكير ناقد.
٧. لا تقتصر على الحفظ والاستظهار.
٨. للأسئلة المفتوحة: أرفق سُلّم تقدير (rubric) واضح المعايير.

أخرج JSON صالحًا فقط، دون أي نص إضافي.
```

**User prompt** is assembled server-side from the curriculum package — the client
never supplies curriculum text, so it cannot widen scope:

```
الصف: {grade}   المادة: {subject}
الوحدة: {unit}  الدرس: {lesson}

نتاجات التعلّم المستهدفة:
- [{objectiveId}] {description}  (مستوى بلوم: {bloomsLevel}, المهارات: {skills})
...

المستوى المطلوب: {basic|standard|advanced}
عدد الأسئلة: {n}
أنواع الأسئلة المسموحة: {types}
التوزيع المطلوب على الكفايات: معرفة {a}٪، فهم {b}٪، تطبيق {c}٪، تفكير ناقد {d}٪

مقتطف المنهاج المرجعي:
"""{knowledge base excerpt}"""
```

**Output contract:** strict JSON, one object per question, matching §2.5 exactly
plus `objectiveId`, `competencyKey`, `difficulty`, `marks`, `rubric`.

**The validator is not optional.** Generation output is never persisted raw. A
deterministic `validateGeneratedQuestions()` runs first and rejects/repairs:

1. `objectiveId` not in the requested set → reject the question.
2. Type not in the requested set → reject.
3. MCQ: <3 options, duplicate options, or ≠1 correct answer → reject.
4. Duplicate/near-duplicate stems (normalized Levenshtein > 0.85) → reject.
5. Marks sum ≠ declared total → rescale proportionally.
6. Competency mix off target by >15 points → request a top-up round.
7. `ai_rubric` question with no rubric → reject.
8. Arabic sanity: Latin text in an `ar` question beyond math/symbols → flag.
9. Vocabulary: token length and rare-word ratio above a grade band → flag for review.
10. **Math key verification:** every math question's key goes through SymPy at
    authoring time. A key the verifier contradicts is dropped before a teacher
    ever sees it. This is the single highest-value validator in the list.

Rejections trigger one bounded retry round for the missing count, then surface
honestly: "تم توليد ١٢ من ١٥ سؤالًا" with an [أضف المزيد] button. Silently
shipping 12 while claiming 15 is how teachers stop trusting the tool.

### 4.2 AI grading (Tier 3 only)

**One question per call.** Batching saves tokens and destroys traceability — and
makes a confidence score meaningless.

```
أنت مصحّح تربوي عادل ودقيق.

السؤال: {question}
الإجابة النموذجية: {modelAnswer}
المفاهيم الأساسية المطلوبة: {keyConcepts}
سُلّم التقدير: {rubric}
العلامة القصوى: {marks}

إجابة الطالب: """{studentAnswer}"""

قواعد التصحيح:
١. قيّم المعنى والفهم والاستدلال — لا مطابقة الألفاظ.
٢. لا تخصم لأن صياغة الطالب تختلف عن الإجابة النموذجية.
٣. لا تخصم على الإملاء أو النحو إلا إذا كان معيارًا في سُلّم التقدير.
٤. امنح علامة جزئية لكل معيار تحقّق.
٥. إذا كانت الإجابة فارغة أو غير متعلّقة بالسؤال، امنح صفرًا وبيّن السبب.
٦. اذكر ثقتك في التصحيح بصدق. إذا كانت الإجابة غامضة أو تحتمل قراءتين،
   اخفض الثقة بدل أن تخمّن.

أخرج JSON فقط:
{ "awardedMarks": number,
  "verdict": "correct"|"partial"|"incorrect",
  "criteriaBreakdown": [{"criterionId": "...", "marks": n, "reason": "..."}],
  "matchedConcepts": [...], "missedConcepts": [...],
  "rationaleAr": "شرح موجز للطالب بضمير المخاطب",
  "confidence": 0.0-1.0 }
```

**Confidence handling — the part that makes rule 11 real:**

| Confidence | Behaviour |
|---|---|
| ≥ 0.85 | Accepted. Counted in the level. Badge: AI judgement. |
| 0.60 – 0.85 | Accepted **provisionally**. `needs_review = true`. Result marked provisional. Teacher prompted. |
| < 0.60 | **Not scored.** Question excluded from totals, sent to the teacher queue. The level is computed on the remaining marks with an explicit "٣ أسئلة بانتظار مراجعتك" notice. |

Also force `needs_review` regardless of confidence when: the student's answer is
>3× the model answer's length (essay-dumping to game a grader), or the answer is
in a different language than the question, or the model returns `incorrect` on an
answer containing every key concept (a classic wording-mismatch false negative —
exactly what rule 8 forbids).

**Self-consistency for high-stakes items:** for `problem_solving` and any question
worth >20% of total marks, grade twice at temperature 0 with the criteria order
shuffled. Agreement → keep, confidence unchanged. Disagreement → take the *higher*
mark and drop confidence to 0.5, which routes it to the teacher. Costs one extra
call on a handful of questions; removes the worst failure mode (a student
under-marked by a coin flip).

### 4.3 Recommendations

Fed **only** the computed weak areas, never the whole transcript — that is what
keeps it specific instead of generic.

```
نتائج الطالب:
- المستوى العام: {level} ({percent}٪)
- الكفايات: معرفة {a}٪، فهم {b}٪، تطبيق {c}٪، تفكير ناقد {d}٪
- نتاجات التعلّم الضعيفة: [{objectiveId}] {description} — {percent}٪
- الأخطاء المتكرّرة: {errorPatterns}

اقترح خطة علاجية محدّدة لهذا الطالب:
١. ماذا يراجع؟ مفاهيم بعينها من الدرس — لا عبارات عامة مثل "راجع الوحدة".
٢. تدريب مقترح: نوع التمارين وعددها، مرتبطة بالنتاج الضعيف تحديدًا.
٣. نشاط عملي واحد يعالج الفجوة.
٤. موعد إعادة التقييم المقترح وشرطه.

ممنوع: النصائح العامة، عبارات التشجيع بلا مضمون، إعادة صياغة النتيجة.
```

**Rule-based floor:** even with AI off, recommendations are produced
deterministically — every objective below the proficiency threshold yields
"راجع {objective}" plus practice items pulled from the existing lesson resources
(`g10_math_support_resources.json`). The AI layer *enriches* this; it is not the
only source. The feature must never return an empty recommendations panel.

---

## 5. Component / screen structure

### 5.1 Server modules — `artifacts/api-server/src/modules/assessment/`

Strictly separated per the brief's §11, each independently testable:

```
curriculum/         objective lookup, scope validation      (shared package wrapper)
generation/
  index.ts          EvaluationGenerator interface
  mockGenerator.ts  deterministic, curriculum-derived        ← DEMO_MODE path
  llmGenerator.ts   real model
  validator.ts      the 10 rules from §4.1
questions/          CRUD, reorder, versioning, marks recompute
types/              one module per question type:
  registry.ts       { validate, sanitizeForStudent, grade, marksOf }
  multipleChoice.ts trueFalse.ts matching.ts fillBlank.ts
  shortAnswer.ts openEnded.ts problemSolving.ts practicalTask.ts
delivery/           assign, attempt lifecycle, token issue/verify, snapshot freeze
submission/         autosave, finalize, idempotent submit
grading/
  deterministic.ts  tier 1
  mathEquivalence.ts tier 2 → SymPy
  aiGrader.ts       tier 3 + confidence policy
  normalize.ts      Arabic-aware normalization (§7)
  orchestrator.ts   tier sequencing, partial failure, job retry
scoring/
  competency.ts     per-competency aggregation + sufficiency rule
  objectives.ts     per-objective aggregation
  level.ts          band resolution + demotion rules
recommendations/
  rules.ts          deterministic floor
  ai.ts             enrichment
analytics/          class summaries, objective heatmap, review queue
```

**Adding a 9th question type = one file in `types/` + one enum value.** Nothing
else changes. That is the modularity the brief asks for, made concrete.

### 5.2 Mobile screens — `artifacts/mobile/app/`

```
evaluations/
  index.tsx                       list: drafts, published, results
  new/
    scope.tsx                     grade→subject→unit→lesson→objectives
    shape.tsx                     difficulty, count, types, options
    generating.tsx                progress + cancel
  [id]/
    review.tsx                    question list + coverage meter
    question/[qid].tsx            edit sheet: type, marks, objective, rubric
    preview.tsx                   student-shaped
    publish.tsx                   assign to students/class
    results/
      index.tsx                   class dashboard
      [attemptId].tsx             student detail
      review-queue.tsx            low-confidence grading queue
classes/
  index.tsx  [id].tsx             roster management

    answers/
      index.tsx                   pick a student to enter answers for
      [studentId].tsx             fast answer-entry grid          ← Phase 4

student/                          PHASE 9 — deferred
  [token]/                        separate stack, no teacher chrome, no tab bar
    intro.tsx  question.tsx  review.tsx  submitted.tsx  result.tsx
```

### 5.3 Shared components — `artifacts/mobile/components/assessment/`

```
QuestionRenderer.tsx      switches on type; used by BOTH preview and student
  inputs/ MultipleChoiceInput TrueFalseInput MatchingInput FillBlankInput
          ShortAnswerInput OpenEndedInput ProblemSolvingInput PracticalTaskInput
ProgressStrip.tsx         "السؤال ٤ من ١٥" + answered/skipped dots (RTL-aware)
CompetencyBars.tsx        four bars + "insufficient evidence" state
LevelBadge.tsx            beginner→advanced, colour + Arabic descriptor
GraderBadge.tsx           Verified / Auto / AI-judged + confidence
ObjectiveTable.tsx        per-objective % with weak-row highlighting
RecommendationCard.tsx    review / practice / activity / reassess
CoverageMeter.tsx         authoring-time balance warnings
```

`QuestionRenderer` being shared between preview and student delivery is what
makes "Preview" honest — the teacher literally sees the student's component tree,
not a second implementation that drifts.

RTL is not a nice-to-have here: matching lines, fill-blank inline inputs, and the
progress strip all have a direction. Build them RTL-first and mirror to LTR, not
the reverse.

---

## 6. Scoring & level calculation

### 6.1 Per question

```
awarded ∈ [0, marks]
verdict: correct (awarded == marks) | partial (0 < awarded < marks)
       | incorrect (awarded == 0, attempted) | unanswered (no response)
```

Unanswered scores 0 **and** is counted in the denominator — but tracked
separately, because 40% from "wrong" and 40% from "ran out of time" are different
diagnoses and must not produce the same recommendation.

### 6.2 Competency scores

```
competency_percent(c) = Σ awarded(q) for q where competency(q)=c
                      / Σ marks(q)   for q where competency(q)=c
```

**Sufficiency rule (important):** a competency reported from one question is
noise, not measurement. Require **≥2 questions AND ≥10% of total marks**.
Otherwise report `sufficient: false` and render "بيانات غير كافية" instead of a
percentage. Do not include insufficient competencies in level determination.

The brief's example output shows four clean percentages. With 10 questions across
4 competencies you get 2–3 questions each — right at the edge. This rule is what
stops the dashboard from confidently displaying a number built on one lucky guess.

### 6.3 Objective scores

Same aggregation keyed by `objective_id`. An objective is **weak** when
`percent < proficient_band.min_percent`. Weak objectives drive the recommendations.

### 6.4 Overall & level

```
overall_percent = Σ awarded / Σ marks        (marks-weighted, not question-count)
```

Excluded from both numerator and denominator: questions with confidence < 0.60,
`practical_task` with `submission: 'offline'`, and any question the teacher
deleted post-publish.

```
level = band where min_percent ≤ overall_percent ≤ max_percent
        resolved against attempts.level_scale_snapshot   ← NOT the live scale
```

**Demotion rules** (configurable per scale, defaults shown) — because an average
can hide a hole:

1. `knowledge < 50%` → cap at **Developing**. You cannot be Proficient in a topic
   whose facts you don't have.
2. Any two competencies below the Developing floor → cap at **Developing**.
3. `critical_thinking` insufficient or absent → cap at **Proficient**. Advanced is
   a claim about independent reasoning; without evidence of reasoning, don't make it.

Default bands (seeded, editable):

| Level | Range | Descriptor (ar) |
|---|---|---|
| مبتدئ Beginner | 0–49 | فجوات جوهرية في المعرفة الأساسية |
| نامٍ Developing | 50–69 | يفهم بعض المفاهيم ويحتاج إلى دعم |
| متمكّن Proficient | 70–84 | يحقّق نتاجات التعلّم المتوقّعة لصفّه |
| متقدّم Advanced | 85–100 | فهم عميق وتطبيق مستقل للمفاهيم |

### 6.5 Strengths & gaps

Deterministic, not AI — they must agree with the numbers on screen:

- **Strength:** objective ≥ 80% with ≥2 questions.
- **Gap:** objective < 60%, ordered by `marks_lost` descending — so the biggest
  actual damage tops the list, not merely the lowest percentage.
- Ties broken by Bloom's level: foundational gaps first, because fixing those
  moves the ones above them.

---

## 7. Edge cases

**Authoring**
- Zero objectives selected → block generation with a clear message, not an empty result.
- Generator returns fewer than requested → report the true count, offer top-up.
- Teacher deletes every question then publishes → block.
- Teacher sets all marks to 0 → block (division by zero downstream).
- Teacher edits a published evaluation with attempts in flight → new version;
  in-flight attempts keep their snapshot.
- Objective removed from the curriculum after an evaluation references it →
  keep the stored label in the snapshot; never render a bare id.
- Same evaluation assigned to a student twice → separate attempts, teacher chooses
  which counts (default: latest; keep both).

**Delivery**
- Two devices, one attempt → last-write-wins per question with an `updated_at`
  guard; return 409 on stale writes so the client can refetch rather than clobber.
- Network drops mid-answer → autosave is idempotent per `(attempt, question)`;
  queue locally and replay.
- Time limit expires while offline → server clock is authoritative on submit;
  grace window of 60s; auto-submit whatever was saved.
- Student never submits → attempt goes `abandoned` after due date + grace,
  gradeable on demand by the teacher as-is.
- Token shared with a classmate → tokens are single-student and single-use for
  `start`; log and warn the teacher on second-device use, don't hard-block a kid
  mid-exam over a heuristic.
- Browser refresh mid-attempt → resume exactly, including remaining time.

**Grading**
- Empty answer → `unanswered`, 0 marks, no AI call (don't pay a model to read "").
- Answer in the wrong language → grade on meaning, flag for review.
- Student writes the right answer with different wording → **must not lose marks**;
  this is rule 8 and needs a regression test with real Arabic examples.
- Arabic normalization for fill-blank/short-answer keys, all applied before compare:
  - alef forms `أ إ آ ٱ` → `ا`
  - `ة` → `ه`, final `ى` → `ي`
  - strip tatweel `ـ`, strip harakat `ًٌٍَُِّْ`
  - Arabic-Indic digits `٠١٢٣٤٥٦٧٨٩` → `0123456789`
  - Arabic decimal separator `٫` → `.`
  - collapse whitespace, trim, casefold Latin
  - **do not** strip hamza on `ء` as a standalone letter — it changes words
- Numeric answers: compare with tolerance (default 0.01 relative), accept `٧`,
  `7`, `7.0`, and `سبعة` where the key lists it.
- Math equivalence: `2x+3` vs `3+2x` vs `x*2+3` must all pass. That needs
  `simplify(student - key) == 0` in SymPy — **a new endpoint**; today's service
  only proves derivatives.
- SymPy service down → fall back to normalized string match, mark
  `grader: 'deterministic'`, flag for review. Never fail the submission.
- AI grader times out / returns malformed JSON → retry twice with backoff, then
  route to the teacher queue. Result still computes, marked provisional.
- Teacher overrides a mark → recompute competencies, objectives, level, and
  recommendations; clear `is_provisional` if nothing else is pending.
- All questions low-confidence → no level at all. Show "بانتظار مراجعة المعلّم".
  Emitting a level from marks nobody trusts is the worst possible output.

**Scoring**
- Competency with <2 questions → insufficient, excluded (§6.2).
- Every question one competency → report that one, no overall level; warn the
  teacher at authoring time via the coverage meter so it rarely happens.
- Thresholds edited after grading → historical results keep their snapshot;
  offer an explicit "recompute with the new scale" action.
- Percent exactly on a boundary (70.0) → inclusive lower bound; bands must tile
  0–100 with no gap or overlap (DB constraint).

**Privacy / integrity**
- Student answers are personal data about a minor → never log answer bodies at
  `info`; redact in error reports.
- Answer keys must never appear in a student payload — enforce with an automated
  test that asserts the sanitized projection contains no `expectedAnswer`/`rubric`
  key at any depth. A code review will eventually miss this; a test won't.
- Rate-limit `/student/sessions` by join code — it is guessable by design.

---

## 8. Implementation plan

One PR per phase onto `main`, per the working agreement. Each ships something
demonstrable; none leaves the tree broken.

| # | Phase | Scope | Done when |
|---|---|---|---|
| **0** | Shared curriculum | Extract `lib/curriculum` package from `artifacts/mobile/data` + `curriculum*.ts`; mobile imports it unchanged; add `/curriculum/*` routes | API returns real objectives for G10 math S1; mobile behaviour unchanged; typecheck + 219 tests still green |
| **1** | Schema & roster | All §2 tables + migrations; seed competencies + default level scale; roster CRUD + UI | Teacher creates a class, adds 5 students, sees them listed |
| **2** | Authoring API | Evaluation CRUD, question CRUD, mock generator, the 10 validators, coverage endpoint | `POST /evaluations/:id/generate` returns 15 valid, balanced, objective-tagged questions with DEMO_MODE on |
| **3** | Authoring UI | Scope → shape → generate → review/edit → preview → publish; all 8 type editors | Teacher builds and publishes an evaluation end-to-end without touching an API client |
| **4** | Answer entry (teacher) | Attempt rows with `source='teacher_entry'`; fast per-student entry grid — one tap per objective question, text box for written ones | Teacher opens a student, enters 15 answers in under two minutes, saves |
| **5** | Deterministic + math grading | Tier 1 + Tier 2; Arabic normalization; **new SymPy equivalence endpoint**; fallbacks | MCQ/TF/matching/fill-blank grade instantly and correctly; `3+2x` accepted for `2x+3` |
| **6** | Level & dashboard | Competency/objective aggregation, sufficiency + demotion rules, class + student dashboards | Teacher sees "نامٍ" with four competency bars, strengths, gaps, per-objective table — from objective questions alone |
| **7** | AI grading | Tier 3, rubric prompt, confidence policy, self-consistency, review queue, overrides | Open-ended answers graded with rationale + confidence; <0.60 excluded and queued; override recomputes everything |
| **8** | Recommendations | Rule-based floor + AI enrichment + reassessment scheduling | Every graded attempt yields specific, objective-linked next steps — never empty, never generic |
| — | **← teacher scope ends here** | Everything above is usable with zero student devices | |
| **9** | Student link | Assign, tokens, snapshot freeze, sanitized delivery, autosave, review, submit; `source='student_link'` | Student opens a link on a phone, answers in Arabic RTL, submits; keys provably absent from the payload |
| **10** | Hardening | i18n sweep, a11y, offline resilience, analytics, load test on 30 concurrent attempts | A real class of 30 completes an evaluation without an incident |

**Critical path:** 0 → 1 → 2 → 4 → 5 → 6. Phase 3 (authoring UI) can overlap once
2 lands; phases 7–8 can overlap once 6 lands.

**Note the deliberate ordering of 6 before 7.** Level calculation lands *before*
AI grading, so the first working end-to-end level is computed entirely from
deterministic and SymPy-verified marks. Nothing in that first result is a
judgement call. AI grading then extends a system that already demonstrably works,
rather than being the thing the whole feature rests on.

**Realistic sizing.** Phases 0–2 and 4–5 are the functional spine and the bulk of
the work. This is several weeks of focused work, not a few days — mostly because
roster, attempt handling and grading infrastructure are entirely new ground that
the brief treats as already existing.

Phase 9 is genuinely cheap *because* of the `attempts.source` seam: it adds an
input channel and a set of student screens, and touches no grading, scoring, or
recommendation code.

**Still open — blocks Phase 6 only:** which model backs AI grading.
`gpt-5.6-luna` is hardcoded and flagged as probably invalid (STATUS.md). The
answer decides whether the demo shows real open-ended grading or objective-only.
Objective + math grading is real regardless, and that is already ~70% of marks.

*(Resolved 2026-08-09: students are rostered with per-student browser links, no
accounts — see "Confirmed decisions" at the top.)*

**Testing, per phase, not after:**
- Unit: each question type's `grade()`, Arabic normalization, level resolution
  including every boundary and demotion rule.
- Contract: sanitized student payload never contains answers (asserted at depth).
- Integration: create → generate → publish → attempt → submit → grade → level,
  as one test.
- Regression: an Arabic answer bank of correct-but-differently-worded responses
  that must all score full marks (rule 8).
