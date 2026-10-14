# Scanning external exams (مسح الاختبارات الخارجية) — design

Date: 2026-10-14 · Status: design approved in conversation, awaiting spec review

## Why

Today's mark scanner (`POST /attempts/:id/scan-marks`, STATUS.md «Scanning the
marks off the paper», 2026-08-25) reads a teacher's handwritten marks off one
student's marked paper. Two costs remain for a teacher who sets their own exam
on paper — the **paper exam** (`modules/assessment/paperExam.ts`), an exam the
app did not write:

1. **Setting the exam up is typing.** A paper exam is a grid of one row per
   question — marks, objective, competency — entered by hand in
   `app/evaluations/new.tsx`. The paper in the teacher's hand already says all
   of it.
2. **Marking a class is thirty round trips.** Scanning is per student: open the
   student, scan, confirm, go back. The whole value of scanning is saved
   keystrokes, and that loop gives most of it back.

This spec covers both. A third request — *auto-marking from the students'
answers* — is deliberately separate (see «Not in this spec»).

## Decisions taken

| Question | Decision |
| --- | --- |
| Scope of this spec | (1) paper setup from a photo, (2) batch scanning a class. Auto-marking from student answers is a later, separate spec |
| How a photographed paper finds its student | The model **transcribes the name written on the paper**; the **server** matches it to the roster. The roster is never sent to the model |
| When a match is trusted | Only an exact normalized full-name match to **exactly one** roster student is «confident». Everything else is «confirm» and is never assigned without a tap |
| Architecture | One request per photo, evaluation-scoped, run 3 at a time from the phone (approach A) |
| Does a scan write anything | **No.** Both new routes return proposals with `saved: false`. The existing grid `PUT` and the existing marking endpoint stay the only writers |
| Photos | Not stored, same as today. They live in client memory during the review session only |
| Input formats | Photos only. No PDF (the web build has no PDF rendering path) |
| Multi-page exam paper (setup only) | Up to **4 images in one request**, because a real exam rarely fits one page. Batch scanning stays **one photo per student**, of the page carrying the marks |
| Question text | Read only to suggest an objective. **Never stored** — paper exams keep an empty `body` on purpose |

Rejected for batch scanning: a single request carrying every photo (the 12 MB
body limit caps it at roughly ten downscaled photos on web and far fewer on
native, where photos are sent as picked; one failure loses the batch; and a call
reading many pages would likely outlive the 45 s client timeout); a server-side job queue (needs
photo and job storage, which this app deliberately does not have — see the
2026-08-25 note on why scans are not stored); matching students by roster order
(one skipped paper shifts every later mark onto the wrong child).

## Constraints found in the code

These shape the design and are easy to get wrong.

- **The paper grid is editable only while the exam is a draft**
  (`PUT /evaluations/:id/questions/paper` → 409 otherwise). **Attempts can be
  started only once it is published** (`POST /evaluations/:id/attempts` → 409
  otherwise). So the order a teacher works in is fixed: scan the paper → publish
  → scan the class. Part 1 lives on a draft, Part 2 on a published exam.
- **`POST /evaluations/:id/attempts` is find-or-create**, and the client's
  `startAttempt` (`services/evaluations.ts`) **discards the `created` flag**. The
  marking endpoint (`PUT /attempts/:id/grades/:questionId`) upserts. Together:
  a batch that "starts" an attempt for a student who already has a marked paper
  would silently overwrite their marks (and write `grade_overrides` rows).
  Batch save must read `created` and refuse to write into a paper it did not
  create.
- **The same find-or-create breaks retry.** If a row's save fails half-way, a
  retry calls `startAttempt` again, gets `created: false`, and would be skipped
  as «already has a paper» — a paper the batch itself made. The row must
  remember its `attemptId` from the first try and not call `startAttempt` again.
- **The class is the roster.** `evaluations.classGroupId` is nullable and chosen
  after the fact. The eligible roster is current, non-archived members of that
  class (`class_memberships`), narrowed by the exam's audience if it is a group
  check — the same rule `PATCH /attempts/:id` already applies when it moves a
  paper onto a student. An exam with no class has no roster to match against.
- **`aiLimiter` on `scan-marks` is 20 requests/minute/user.** A class of 30–40
  photos could reach that if a call takes under ~9 s with three in flight (call
  latency is **not measured** — no real photo has gone through yet). The new
  routes get their own limiter and the client treats a 429 as «wait and retry»,
  not failure. The exact 429 body/code `createRateLimiter` returns is confirmed
  in the plan; the client must key off the status, not a code assumed here.
- **Teacher marks survive a re-submit** (`/attempts/:id/submit` clears and
  recomputes only machine grades), so batch save can safely call submit last.

## 1. Paper setup from a photo

### Server

`POST /evaluations/:id/scan-paper`, in `routes/evaluations.ts` (already
path-scoped behind auth — nothing new to mount).

- Owner only; **draft only** (409 `not_draft`, same as the grid `PUT`).
- Body `{ images: string[] }`, 1–4 data URLs. Same guards as `scan-marks`:
  `data:image/` prefix, 8 MB per image, `assertLiveModeEnabled`,
  `assertBudgetAvailable`, `assertUserQuotaAvailable`. Total request must stay
  under the 12 MB body limit; over it answers the existing 413 advice.
- The prompt is given the evaluation's own objectives — id and Arabic title,
  resolved from `evaluation.objectiveIds` — and asked, per question, for: the
  number as printed, the marks as printed, one objective id **or null**, one
  competency key **or null**, `readAs` (the characters it saw for the marks), and
  the paper's printed total if it states one. It is told it is **reading, not
  setting** a paper: never invent a question, never guess a mark.
- Parsed by a new pure module `modules/assessment/scanPaper.ts`:
  - marks must satisfy the same rule `parsePaperRows` uses (> 0, ≤
    `MAX_MARKS_PER_QUESTION`) — otherwise the mark is **null**, not clamped;
  - `objectiveId` not in `evaluation.objectiveIds` → null (the model can only
    pick from the list it was given, but the server does not take its word);
  - `competencyKey` not in `COMPETENCY_KEYS` → null;
  - question numbers are deduplicated; a **gap in numbering** (1, 2, 4) produces
    a blank row 3 and a `skipped` entry, so row N in the grid is question N on
    the paper;
  - more than `MAX_QUESTIONS` (50) rows are cut, with a `skipped` note;
  - Arabic-Indic digits and half marks parse via the existing
    `parseArabicNumber`.
- Response: `{ rows: [{ number, marks, objectiveId, competencyKey, readAs }],
  printedTotal, skipped, model, saved: false }`. Writes nothing.
- `recordUsage(..., { promptVersion: "scan-paper-1" })`.

### Client

- A «قراءة من صورة» button on the paper-exam grid in `app/evaluations/new.tsx`.
  The picker becomes multi-select (`pickMarkSheetPhoto` →
  `pickMarkSheetPhotos`; `expo-image-picker` already supports
  `allowsMultipleSelection`, so **no native module changes** and no `version`
  bump in `app.json`).
- The returned rows **pre-fill the existing grid**; the teacher edits and saves
  through the existing `setPaperQuestions` → `PUT`, which re-validates
  everything. A row that came from a scan shows a «راجع» badge until the teacher
  touches it, and a blank cell stays blank — the grid's existing validation is
  what stops a row without marks, objective or competency from being saved.
- **Competency is a suggestion, not a derivation.** `paperExam.ts` is explicit
  that a question's cognitive demand is the teacher's choice and that inheriting
  or deriving it «quietly flattens the breakdown». It is pre-filled the way the
  grid's own default already is, badged, and overridable — never silent.
- If the grid already has edited rows, the scan asks before replacing them.
- If `printedTotal` is present and differs from the sum of the scanned marks,
  the grid shows a warning with both numbers. Cheap, and it catches a missed
  question or a misread mark before anything is published.

## 2. Batch scanning a class

### Server

`POST /evaluations/:id/scan-class-paper`, in `routes/evaluations.ts`.

- Owner only; **published only**; 409 `no_class` if `classGroupId` is null (no
  roster, nothing to match).
- Body `{ image }` — one photo of one student's marked paper, same guards and
  caps as `scan-marks`.
- Questions come from `liveQuestions(evaluation.id)`, mapped to
  `ScannableQuestion` exactly as `scan-marks` does, and parsed by the existing
  `parseScanResponse` **unchanged**: a mark it cannot read is absent, never
  zero; out-of-range is dropped, not clamped; a mark for a question not on the
  paper is ignored; every proposal carries `readAs`.
- `buildScanPrompt` gains an optional `readName` mode that additionally asks for
  the student's name **exactly as written**, or null. The default (no option) is
  byte-identical to today, so `scan-marks` and its 13 + 6 existing tests are
  untouched.
- **Name matching is the server's job**, in a new pure module
  `modules/assessment/studentMatch.ts`:
  - normalize both sides with `normalizeArabic` (`lib/curriculum/src/arabic.ts`)
    and collapse whitespace;
  - `confident` ⇔ the normalized read name equals the normalized `displayName`
    of **exactly one** roster student. Two students with the same name — or a
    first name shared by single-name roster rows — can never be `confident`;
  - otherwise `confirm`, with up to three candidates ranked by token overlap
    (a minimum score keeps an unrelated name from being offered);
  - no name read, or nothing above the minimum, is `none`;
  - the model never sees the roster, so it cannot be steered toward a plausible
    name — it can only transcribe.
- Roster: current, non-archived `class_memberships` of `classGroupId`, narrowed
  by `evaluationAudience` for a group check. Each roster entry also carries
  `hasAttempt` (from the existing attempts table) so the client can flag it
  before saving.
- Response: `{ nameRead, match: { status, studentId, candidates:[{studentId,
  displayName, score, hasAttempt}] }, proposals, skipped, printedTotal, model,
  saved: false }`. Writes nothing.
- Own limiter, `ai-scan-class`, 30/minute/user, keyed like `ai-scan-marks`.
  `recordUsage(..., { promptVersion: "scan-class-paper-1" })`.

### Client

- A «مسح أوراق الصف» entry on the evaluation screen for a published paper
  exam, opening a new screen `app/evaluations/[id]/scan-class.tsx`.
- The teacher picks or takes up to **40** photos. A pure runner
  (`services/classScan.ts`) sends them **three at a time**. A 429 backs off and
  retries that photo (twice); `user_quota_exceeded`, `budget_exceeded` and
  `live_mode_off` **stop the batch and keep everything read so far**.
- A **review table**, one row per photo: thumbnail (from memory), student,
  marks per question, total. Row states: queued · reading · read · failed ·
  saved · save failed.
  - `confident` rows arrive assigned but visibly marked; `confirm` rows show the
    candidates and need a tap; `none` rows need a pick from the roster.
  - Every cell is editable; a `readAs` mismatch or a skipped question shows as a
    blank cell, never zero.
  - **Blocking** (save disabled for the batch, with the reason on the row): a row
    with no student; two rows assigned to the same student; a mark out of range.
  - **Non-blocking, flagged**: a student whose `hasAttempt` is true (the row will
    be skipped on save, with a link to that student's own screen); blank cells
    (saved as unmarked); a total that disagrees with `printedTotal`.
- **Save** is a client loop over the existing endpoints, row by row:
  `startAttempt` (modified to return `created`) → if `created` is false, **skip,
  write nothing** → `setQuestionGrade` for each non-blank cell → `submitAttempt`.
  The row stores its `attemptId` after the first success so a retry never calls
  `startAttempt` again. Failures are per row with a retry button; the summary
  says «٢٨ حُفظت · ٢ تحتاج مراجعة».
- Marks saved this way are ordinary `grader: 'teacher'` grades — nothing in
  scoring, levels, insights or recommendations changes, which is the same
  property the original scanner was built around.

## Shared decisions

- **Under-claiming everywhere.** Absent over zero, dropped over clamped, null over
  guessed, `confirm` over `confident`. A wrong reading here is a confident wrong
  number against a named child, and it does not throw.
- **Privacy.** Photos of minors' papers go to the model and are discarded, as
  today. The class roster stays on the server. Nothing new is persisted by
  either scan.
- **Arabic first.** New strings go in `services/i18n.ts`; every server `code`
  maps to an Arabic sentence that says what to do (`image_too_large`,
  `live_mode_off`, `budget_exceeded`, `user_quota_exceeded`, plus the new
  `not_draft`, `no_class`, and a rate-limit message) — the lesson of the 2026-08-25 first
  real scan, where the teacher was shown the server's English.
- **Web-only downscaling is reused** (`imageDownscale.ts`, `imageFit.ts`),
  unchanged; native still sends the photo as picked.

## Testing

Pure logic goes in modules that `node --test` can load, inside the existing
globs (api-server: `src/**/__tests__/**/*.test.ts`; mobile:
`services/__tests__/**/*.test.ts` — a mobile test anywhere else never runs).

- `scanPaper.test.ts` — marks 0 / negative / over-limit → null; unknown
  objective → null; unknown competency → null; Arabic-Indic digits and half
  marks; duplicate and gapped numbering; >50 rows; empty and garbage replies.
- `studentMatch.test.ts` — exact match; hamza/ta-marbuta/ya variants and
  diacritics; **two identical names → never confident**; first-name-only reads;
  unrelated name → none; empty name → none; candidates capped and ranked.
- Route guards for both routes, modelled on `scanMarks.test.ts`: bad body,
  oversized, another teacher's evaluation, no token (401), live mode off, wrong
  status (draft/published), no class, and that **nothing is written**. A path
  test that the new routes did not shadow anything (`mountOrder.test.ts`).
- `buildScanPrompt` default output unchanged (golden string) so `scan-marks`
  cannot drift.
- Mobile `classScan.test.ts` — runner concurrency and ordering; 429 retry;
  quota error stops the batch and keeps results; `canSave` blockers (unassigned,
  duplicate student, out of range); **retry after a half-failed save reuses the
  stored `attemptId` and does not skip**; a `created: false` row writes nothing.

## Not verified

**The model has never read a real exam paper or a real class set.** The local
key is a placeholder and these routes will not be deployed when written, so
every test above runs with live mode off — the same position the original
scanner shipped in. Three things only a real photo can answer: whether the
printed marks and the objective suggestions are good enough to save typing,
whether handwritten names are read well enough for exact matching to fire at
all (if it almost never does, the batch degrades to «confirm» on every row —
safe, but then it is no faster than picking the student first), and whether
three-at-a-time stays under the limiter in practice. STATUS.md must say this in
the same PR, and must not say the feature «works» until a real class has been
scanned.

## Not in this spec

**Auto-marking from the students' answers** (the second half of the original
request). It carries a different risk: here a misread is one wrong number in a
box a teacher is looking at; there a misread *changes the mark*. It needs its
own safety model (which answer types are even eligible, how a key is established
and verified — compare the `verified` / `verificationSource` rule in CLAUDE.md —
and what a teacher must review). It starts after these two ship and have seen
real papers.

## Open points for review

1. **Multi-page setup (up to 4 images)** was added after the design discussion;
   everything else matches what was agreed. Say if you want setup limited to one
   photo.
2. **Blank cells are saved as unmarked** rather than blocking the batch, matching
   how one-student scanning behaves today. The paper then stays provisional until
   the teacher fills them in. The alternative is to block until every cell has a
   value.
3. **A student who already has a paper is skipped, never overwritten.** Replacing
   marks from a scan is a separate, riskier feature.
4. Exact UI placement (the entry on the evaluation screen, the review table
   layout) is settled in the implementation plan, not here.
