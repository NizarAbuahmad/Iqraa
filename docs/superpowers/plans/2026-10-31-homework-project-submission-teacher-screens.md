# Homework project submission — Phase 3 (teacher screens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher can switch a homework to "needs a project", see who has handed in, open a student's photos and note, and clear one student's project — all in the app, on top of the API that already exists.

**Architecture:** One small API change (the switch locks once any student has a tick or any submission; the class homework list says so) and four mobile pieces: pure helpers + an injected API client, the switch and card button in the existing `HomeworkTab`, a list screen and a detail screen under the top-level route `/homework-submissions` (so analytics exclusion by path prefix covers them).

**Tech Stack:** Express 5 + Drizzle (api-server), Expo / React Native + expo-router + expo-image (mobile), node:test.

**Spec:** `docs/superpowers/specs/2026-10-30-homework-project-submission-design.md` §10 (design approved 2026-10-31), §3 (teacher routes), §5, §8. Read the student screen `artifacts/mobile/app/homework-project/[id].tsx` and `services/homeworkProject.ts` as the model for load/retry/photo-grid wiring.

## Global Constraints

- **Switch rule (owner decision):** `PATCH /homework/:id` that *changes* `requiresSubmission` answers **409** `code: "submission_locked"` once ANY completion tick for the homework or ANY `homework_submissions` row for it exists (a draft counts although the teacher cannot see drafts). Setting the same value again is always allowed. The class homework list carries `requiresSubmissionLocked: boolean` per item. The existence check runs on the owner connection (`systemDb`; pinned in `lib/__tests__/systemDbFiles.test.ts`) because a draft is invisible to the teacher's identity under RLS.
- **No schema change, no migration.** `app.json`, `package.json`, `eas.json` untouched (OTA-safe).
- New screens live under the top-level path **`/homework-submissions`** (not `/classes/...`) and `services/screenTracking.ts` `EXCLUDED` gains `'/homework-submissions'` (they show a minor's photos). Teacher routes need NO `NON_TEACHER_ROUTES` entry.
- The detail screen **copies** the student screen's photo grid / viewer wiring; do not modify `app/homework-project/[id].tsx`.
- A draft is invisible to the teacher by design: a "not handed in" row is not tappable; the detail API 404s for a draft.
- Teacher 404s carry no `code`; branch on `status`. The new 409 carries `code: "submission_locked"`.
- Copy exists in **ar and en** in `services/i18n.ts` (identical key sets, no empty strings; `i18nTerminology.test.ts` bans some phrasings and «اً» spellings — use «ًا»). Latin product name **Iqrra**; Arabic brand «إقرأ».
- Colours from `useColors()`, cards via `useSurface()` (no `borderWidth: 1`, no `overflow: 'hidden'`), sizes/radii/gaps from `TYPE`/`SPACE`/`RADIUS`, icon sizes from `ICON`, `aria-*` props only (never `accessibilityState=`), targets ≥ 44, state conveyed by text as well as colour, no emoji ticks, dates via `formatDueDate` (never `new Date('YYYY-MM-DD')`), no `KeyboardAvoidingView`. Amber means "now" only (late = destructive via `submissionLook`).
- Files loaded by `node --test` use explicit `.ts` import extensions and import no react-native/expo modules at module scope.
- No `sed -i` / `perl -pi`; Edit tool only. Stage named paths, never `-A`.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `artifacts/api-server/src/modules/homework/rules.ts`, `routes/homework.ts`, `lib/homeworkSubmission.ts` (modify) | the lock + `requiresSubmissionLocked` |
| `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts` (modify) | lock tests |
| `artifacts/mobile/services/homework.ts`, `homeworkApi.ts` (modify) | `TeacherHomework` gains `requiresSubmission`, `submittedCount`, `requiresSubmissionLocked`; `NewHomework`/`HomeworkPatch` gain `requiresSubmission` |
| `artifacts/mobile/services/teacherSubmissions.ts` (create) | pure helpers: row/detail types + normalizers, `rowOpensDetail`, `submittedLabelArgs` |
| `artifacts/mobile/services/teacherSubmissionsApi.ts` + `.default.ts` (create) | injected API client for list / detail / clear |
| `artifacts/mobile/components/classes/HomeworkTab.tsx` (modify) | switch, locked state, card button, delete wording |
| `artifacts/mobile/app/homework-submissions/[homeworkId]/index.tsx` (create) | list screen |
| `artifacts/mobile/app/homework-submissions/[homeworkId]/[studentId].tsx` (create) | detail screen |
| `artifacts/mobile/services/screenTracking.ts` (+ test) | exclude `/homework-submissions` |
| `artifacts/mobile/services/i18n.ts` (modify) | new keys |
| tests under `artifacts/mobile/services/__tests__/` | pure + source-reading |
| `STATUS.md`, `docs/status-log.md`, spec §10/§8 | write-up |

---

### Task 1: The switch lock (API)

**Files:**
- Modify: `artifacts/api-server/src/modules/homework/rules.ts` (error constant if the file keeps them), `artifacts/api-server/src/routes/homework.ts` (PATCH ~L425-495; list `withCounts` ~L282), `artifacts/api-server/src/lib/homeworkSubmission.ts` (one new helper), `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (pin reason text if a file is added/touched)
- Test: `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/homeworkSubmission.ts
  /** Homework ids (of the given list) that have any completion tick or any submission row. Owner connection. */
  export async function homeworkIdsWithWork(homeworkIds: string[]): Promise<Set<string>>;
  ```
  PATCH: when `parsed.requiresSubmission !== undefined && parsed.requiresSubmission !== current.requiresSubmission` and `homeworkIdsWithWork([id])` has `id` → `409 { error: "…", code: "submission_locked" }` and NOTHING is changed (no other field of the same PATCH is applied either — check/decide this explicitly and test it). List items gain `requiresSubmissionLocked: boolean` (false when `requiresSubmission` is false AND nothing exists; true iff any tick or submission exists — compute for all items of the list with ONE query).
- Consumes: existing `ownedHomework`, `parsePatch`, `withCounts`.

- [ ] **Step 1: Write failing DB tests** (style of `homeworkSubmission.db.test.ts`; also one with `RLS_ENFORCE: "on"`): (a) fresh homework: PATCH on/off/on freely, list says `requiresSubmissionLocked:false`; (b) after a student ticks (manual tick on a non-project homework) PATCH `requiresSubmission:true` → 409 `submission_locked`, row unchanged, list says locked true; (c) project homework where a student uploads ONE photo (a draft, invisible to the teacher) → teacher PATCH off → 409, list `requiresSubmissionLocked:true`; (d) same-value PATCH (`true` when already `true`) with work present → 200; (e) a PATCH that changes title AND flips the flag with work present → 409 and the title is unchanged; (f) another teacher's homework → the existing 404; (g) after the teacher clears the only submission (the clear route) the lock opens again.
- [ ] **Step 2: Run, see them fail.** `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts` (start Postgres with `pg_ctlcluster 16 main start` if down).
- [ ] **Step 3: Implement** `homeworkIdsWithWork` (one query over `homework_completions` ∪ `homework_submissions` filtered to the ids, on `systemDb`), the PATCH check (before any write), and the list field. Keep the 409 body in the repo's error style.
- [ ] **Step 4: Run to green; break each guard once (skip the draft case; skip the same-value allowance; apply other fields before the check) and see a test fail; restore.** Then the whole api-server suite (`pnpm test`), root `pnpm run typecheck`.
- [ ] **Step 5: Commit**
  ```bash
  git add artifacts/api-server/src/routes/homework.ts artifacts/api-server/src/lib/homeworkSubmission.ts artifacts/api-server/src/modules/homework/rules.ts artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts
  git commit -m "Homework: the project switch locks once any student has started"
  ```
  (stage only the files you actually changed; message ends with the Co-Authored-By / Claude-Session lines the controller gives you).

---

### Task 2: Mobile services — types, API client, pure helpers

**Files:**
- Modify: `artifacts/mobile/services/homework.ts` (`TeacherHomework`, `normalizeTeacherHomework`), `artifacts/mobile/services/homeworkApi.ts` (`NewHomework`, `HomeworkPatch`), `artifacts/mobile/services/apiErrorKey.ts` (+ test) for `submission_locked`, `artifacts/mobile/services/i18n.ts` (error key only)
- Create: `artifacts/mobile/services/teacherSubmissions.ts`, `artifacts/mobile/services/teacherSubmissionsApi.ts`, `artifacts/mobile/services/teacherSubmissionsApi.default.ts`
- Test: `artifacts/mobile/services/__tests__/teacherSubmissions.test.ts`, `teacherSubmissionsApi.test.ts`, `homework.test.ts` (L~250-266 deepEqual needs the new fields), `apiErrorKey.test.ts`

**Interfaces (exact):**
```ts
// homework.ts
TeacherHomework { …existing; requiresSubmission: boolean; submittedCount: number; requiresSubmissionLocked: boolean }
// normalizer: absent => false / 0 / false (an older server)
// homeworkApi.ts
NewHomework { …; requiresSubmission?: boolean }
HomeworkPatch { …; requiresSubmission?: boolean }

// teacherSubmissions.ts (import-free)
export interface TeacherSubmissionRow { studentId: string; displayName: string; status: SubmissionState; submittedAt: string | null; photoCount: number }
export interface TeacherSubmissionList { homework: { id: string; title: string; dueDate: string }; submittedCount: number; submissions: TeacherSubmissionRow[] }
export interface TeacherSubmissionDetail { student: { id: string; displayName: string }; submission: SubmissionView }
export function normalizeTeacherSubmissionList(raw: unknown): TeacherSubmissionList   // tolerant; bad rows dropped; status via normalizeSubmissionState
export function normalizeTeacherSubmissionDetail(raw: unknown): TeacherSubmissionDetail | null  // null when student missing
export function rowOpensDetail(row: { status: SubmissionState }): boolean   // submitted | late only
// SubmissionState / normalizeSubmissionState / normalizeSubmission / SubmissionView come from ./homeworkSubmission.ts (phase 2)

// teacherSubmissionsApi.ts
export class TeacherSubmissionsError extends Error { constructor(message: string, readonly status: number, readonly code?: string) }
export function makeTeacherSubmissionsApi(deps: { apiFetch: (path: string, init?: { method?: string; body?: string; timeoutMs?: number }) => Promise<Response> }): {
  list(homeworkId: string): Promise<TeacherSubmissionList>;                       // GET /homework/:id/submissions
  detail(homeworkId: string, studentId: string): Promise<TeacherSubmissionDetail>; // GET /homework/:id/submissions/:studentId
  clear(homeworkId: string, studentId: string): Promise<void>;                     // DELETE …; 200 { cleared:true }
};
// ids are encodeURIComponent'd; a 2xx without usable data throws TeacherSubmissionsError(status 2xx); non-2xx carries status and code (body parse failure => code undefined)
```
Error key: add `errSubmissionLocked`-style key for `submission_locked` ar+en («لا يمكن تغيير هذا الإعداد بعد أن بدأ الطلبة» / "This can't be changed once students have started.") mapped in `apiErrorKey.ts` globally (it is a `HomeworkError` code from `PATCH /homework/:id`), plus a teacher clear failure key if the screens need one (Task 5 defines it).

- [ ] **Step 1: Write failing tests** — `teacherSubmissions.test.ts`: normalizer drops rows with a missing id, unknown `status` → `none`, `photoCount` non-number → 0, null detail on missing student, `rowOpensDetail` truth table (none false; submitted/late true); `teacherSubmissionsApi.test.ts` with a fake `apiFetch` recording `(path, init)`: list/detail/clear paths and methods with encoded ids (`h 1`), 404 → error with `status 404`, 500 on clear → error with `status 500`, 2xx with empty/odd body → throws; `homework.test.ts`: a payload without the new fields normalizes to `false/0/false`, with them keeps them; `apiErrorKey.test.ts`: a `HomeworkError` with code `submission_locked` maps to the new key.
- [ ] **Step 2: Run, see them fail:** `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/teacherSubmissions.test.ts services/__tests__/teacherSubmissionsApi.test.ts services/__tests__/homework.test.ts services/__tests__/apiErrorKey.test.ts`
- [ ] **Step 3: Implement** the above (read `services/homeworkSubmissionApi.ts` and copy its `readJson`/error style; the factory file must not import `apiClient`; `.default.ts` binds `apiFetch`).
- [ ] **Step 4: Run to green; mutation check** (e.g. let `rowOpensDetail` return true for `none` → a test fails; restore). Then the i18n tests and root `pnpm run typecheck`.
- [ ] **Step 5: Commit** (named paths): `Teacher app: types, API client and helpers for project submissions`.

---

### Task 3: The switch, the card button and the delete wording (`HomeworkTab`)

**Files:**
- Modify: `artifacts/mobile/components/classes/HomeworkTab.tsx` (Draft L~76, `openEdit` L~164, `onSave` L~232-254, modal body L~475-720, card block L~360-440, delete confirm L~274-295), `artifacts/mobile/services/i18n.ts`, `artifacts/mobile/services/homework.ts` (a pure helper)
- Test: `artifacts/mobile/services/__tests__/homework.test.ts`, a new source-reading `services/__tests__/homeworkTabProject.test.ts`

**Interfaces:**
- Consumes: Task 2's `TeacherHomework` fields, `NewHomework`/`HomeworkPatch.requiresSubmission`.
- Produces (pure, in `services/homework.ts`): 
  ```ts
  export function projectSubmittedText(hw: Pick<TeacherHomework, 'submittedCount' | 'trackableCount'>): { submitted: number; of: number }  // clamps submitted to [0, of]
  export function deleteConfirmKey(hw: Pick<TeacherHomework, 'requiresSubmission'>): 'hwDeleteConfirm' | 'hwDeleteConfirmProject'
  ```
  i18n keys (ar+en): `hwRequiresProject` «يتطلب تسليم مشروع» / "Requires a project hand-in"; `hwRequiresProjectHint` (a one-line helper: «يرفع الطالب صور عمله وملاحظة، ويراها المعلّم» / "Students upload photos of their work and a note; you see them."); `hwRequiresProjectLocked` «لا يمكن تغييره بعد أن بدأ الطلبة» / "Can't be changed once students have started."; `hwSubmittedCount` (fn submitted, total) «سلّم ${n} من ${m}» / `${n} of ${m} handed in`; `hwSubmissionsOpenA11y` (fn title); `hwDeleteConfirmProject` «سيختفي هذا الواجب عند الطلبة وأولياء الأمور، وتُحذف صور مشاريع الطلبة وملاحظاتهم نهائيًا ولا يمكن استرجاعها.» / "This will disappear for students and parents, and the students' project photos and notes are deleted for good and can't be recovered."

- [ ] **Step 1: Write failing tests:** pure helpers (`projectSubmittedText` clamps; `deleteConfirmKey` picks the project key only when `requiresSubmission`); source-reading test for `HomeworkTab.tsx`: contains `requiresSubmission` in the Draft and in the `createHomework`/`updateHomework` payloads, a `Switch` (or the file's existing toggle pattern) with `aria-checked` and `aria-disabled` bound to `requiresSubmissionLocked`, shows `hwRequiresProjectLocked` when locked, the card button navigates with `router.push` to `/homework-submissions/` + `encodeURIComponent(item.id)` only when `item.requiresSubmission`, uses `deleteConfirmKey`, and imports no `accessibilityState=`.
- [ ] **Step 2: Run, see them fail** (same node command with these files).
- [ ] **Step 3: Implement.** Switch row between the due-date and exam sections (follow the file's `shareToChat` row for layout, or `<Switch>` as in `app/settings.tsx` ~L443-451 with `aria-checked`); disabled + helper line when `editing?.requiresSubmissionLocked`; on a 409 `submission_locked` the existing `apiErrorMessage(e,'hwSaveFailed',t)` shows the new key; the card gets the «سلّم X من Y» `PressableScale` (≥ 44, `aria-label`) beside the results-button precedent for `item.requiresSubmission`; the delete confirm uses `deleteConfirmKey(editing)`. No new `<EmptyState>` outside the pinned count.
- [ ] **Step 4: Run to green + the policing suites** (`i18n.test.ts i18nTerminology.test.ts designScale.test.ts typeScale.test.ts ariaState.test.ts iconSystem.test.ts dateLabels.test.ts emptyState.test.ts`) and root typecheck; fix the code, never the ratchets.
- [ ] **Step 5: Commit**: `Teacher app: the project switch, the handed-in count and the delete warning`.

---

### Task 4: The list screen

**Files:**
- Create: `artifacts/mobile/app/homework-submissions/[homeworkId]/index.tsx`
- Modify: `artifacts/mobile/services/screenTracking.ts` (+ `__tests__/screenTracking.test.ts`), `artifacts/mobile/services/i18n.ts`
- Test: `artifacts/mobile/services/__tests__/teacherSubmissionsScreens.test.ts` (source-reading, list part)

**Interfaces:**
- Consumes: Task 2's `teacherSubmissionsApi.default` (`list`), `rowOpensDetail`, `submissionLook`/`stateLabelKey` (phase 2), `formatDueDate`.
- i18n keys (ar+en): `subListTitle` «مشاريع الطلبة» / "Student projects"; `subListDue` (fn date); `subListEmpty` «لا يوجد طلبة في هذا الصف بعد» / "No students in this class yet"; `subListLoadFailed`; `subListRetry` can reuse `retry`; row a11y `subRowOpenA11y` (fn name).

- [ ] **Step 1: Write failing tests:** `screenTracking.test.ts` — `/homework-submissions`, `/homework-submissions/h1` and `/homework-submissions/h1/s1` are NOT tracked, `/homework-submissionsX` is; source-reading assertions for the list screen: no `palette`, `useSurface(`, no `KeyboardAvoidingView`, no `accessibilityState=`, uses `useFocusEffect` (reload), has a retry affordance, rows call `rowOpensDetail` before pushing, pushes `/homework-submissions/<id>/<studentId>`, a 404 is a final (no-retry) state, `formatDueDate(` and no `new Date(`.
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement** the screen (stack-screen header recipe from `app/exam-review/[id].tsx`/the student screen, `BackButton`; `FlatList` of rows; each row: name, status chip with `submissionLook` icon + text (never colour alone), photo count (a photo-count icon + number), chevron `isRTL ? 'chevron-back' : 'chevron-forward'`; a non-openable row is a plain `View` with `aria-disabled`; header shows the homework title, `formatDueDate(dueDate)` and `hwSubmittedCount(submittedCount, rows.length)`); `loadSeq` guard against stale loads; error panel + retry; reload on focus; add `'/homework-submissions'` to `EXCLUDED` with a comment about minors' photos.
- [ ] **Step 4: Run to green + the policing suites + root typecheck.**
- [ ] **Step 5: Commit**: `Teacher app: the list of who handed in a project`.

---

### Task 5: The detail screen with "delete this project"

**Files:**
- Create: `artifacts/mobile/app/homework-submissions/[homeworkId]/[studentId].tsx`
- Modify: `artifacts/mobile/services/i18n.ts`; add a pure helper to `artifacts/mobile/services/teacherSubmissions.ts` if useful (e.g. `clearErrorKey`)
- Test: `artifacts/mobile/services/__tests__/teacherSubmissionsScreens.test.ts` (detail part)

**Interfaces:**
- Consumes: `teacherSubmissionsApi.default` (`detail`, `clear`), `photoSlotSize` from `services/homeworkProject.ts`, `ImageViewerModal`, `confirm`, `Toast`, `Button`, `useSurface`.
- i18n keys (ar+en): `subDetailTitle` (the student's name is the title; this key is the header fallback); `subDeleteProject` «حذف المشروع» / "Delete project"; `subDeleteTitle`/`subDeleteBody` («ستُحذف صور المشروع والملاحظة نهائيًا، وتُزال علامة «تم» عن الطالب، ويستطيع الطالب أن يبدأ من جديد.» / "The photos and note are deleted for good, the student's done tick is removed, and the student can start again."); `subDeleteFailed` («تعذّر حذف المشروع، حاول مرة أخرى» / "Couldn't delete the project. Try again."); `subDeleted` toast; `subNoNote` «لا توجد ملاحظة» / "No note".

- [ ] **Step 1: Write failing source-reading tests:** no `palette`; `useSurface(`; the photo grid uses `photoSlotSize` and `ImageViewerModal`; thumbnails use `cacheKey: photo.id` and the `projectOpenPhoto` label; a `null` url renders a placeholder; the delete goes through `confirm({ … destructive: true })` BEFORE calling `clear`; after a successful clear it navigates back (`router.back()` or `replace` to the list); a failed clear shows `subDeleteFailed` and stays; reload on focus; 404 final state; no `accessibilityState=`; `formatDueDate`/date helpers only (no `new Date(`).
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement** (copy the student screen's grid/viewer wiring; header with the student's name; status chip + hand-in time (use the file's existing date formatting helpers, not `toLocaleDateString()` — `dateLabels.test.ts`); the note card; the destructive button ≥ 44 with `aria-busy` while clearing; guard double taps with a ref).
- [ ] **Step 4: Run to green + policing suites + root typecheck + the whole mobile suite once** (`pnpm test`, silent for minutes).
- [ ] **Step 5: Commit**: `Teacher app: one student's project, and deleting it`.

---

### Task 6: Verify against the real stack and write it up

**Files:** `docs/status-log.md` (new TOP entry «Homework project submission — teacher screens»), spec §10/§8, `STATUS.md` (close the phase-3 Open lines this resolves: the teacher UI for clearing; the toggle decision; keep honest the ones that remain), PR body.

- [ ] **Step 1:** Whole mobile suite, api-server `pnpm build && pnpm test`, root typecheck, the brand grep from `.github/workflows/ci.yml`; `git diff origin/main --stat -- artifacts/mobile/app.json artifacts/mobile/package.json artifacts/mobile/eas.json` must be empty.
- [ ] **Step 2: Real-stack browser run** (as in phase 2: throwaway Postgres DB, migrate, built API with the in-memory S3 stub via `s3Env`, `AI_LIVE_MODE=false`, STUDENT_ACCOUNTS on, web build, Playwright from the scratchpad; never read `.env`): teacher creates a class and a homework with the switch ON (via the real form); the card shows «سلّم 0 من N»; a student (code signup) hands in a project; the teacher's card shows 1 of N, the list shows the student as handed in, the detail shows the photo and note; the switch is now disabled with the reason; PATCH via the form's flow cannot flip it; the teacher deletes the project (confirm text visible), the student's list is back to not handed in and the lock opens; phone and desktop widths, Arabic RTL and English, light and dark. Say plainly what you could not do.
- [ ] **Step 3:** Write the log entry, spec and STATUS updates; commit (docs only).

---

## Self-review

- Spec §10: switch rule + `requiresSubmissionLocked` → Task 1; form switch/disabled reason → Task 3; card button → Task 3; list screen → Task 4; detail + clear → Task 5; delete-homework wording → Task 3; analytics exclusion → Task 4; testing incl. real-stack run → Task 6.
- Types: `TeacherSubmissionRow/List/Detail`, `rowOpensDetail`, `makeTeacherSubmissionsApi` (Task 2) are the names Tasks 4–5 consume; `projectSubmittedText`/`deleteConfirmKey` (Task 3) are used only in Task 3; `submissionLook`/`stateLabelKey`/`photoSlotSize` are phase 2 exports.
- Deliberately not here: parents' view, push to the teacher, marks/comments, tab counts, any change to the student screen.
