# Homework project submission — Phase 2 (student app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student whose homework asks for a project can open it from the School tab, add 1–6 photos from their library and a note, hand it in, replace it until the due day ends, and see it locked afterwards — all against the phase 1 API that already exists.

**Architecture:** Pure rules and types in `services/homeworkSubmission.ts` (no imports, loaded by bare `node --test`); fetchers in a dependency-injected `services/homeworkSubmissionApi.ts` (the `guardianApi.ts` pattern, because `apiClient` pulls in react-native); a library-picker wrapper that obeys `photoPickers.test.ts`; one new stack screen `app/homework-project/[id].tsx` kept thin by pushing every decision into the pure service; and a change to `HomeworkRow` in `app/(tabs)/school.tsx` so a submission homework shows its state and a link instead of the tick.

**Tech Stack:** Expo / React Native (web build too), expo-router, `expo-image-picker` + `expo-image-manipulator` (already installed and configured), `expo-image`, node:test.

**Spec:** `docs/superpowers/specs/2026-10-30-homework-project-submission-design.md` (§5 App, §3 Student API). Phase 1 contract: `artifacts/api-server/src/routes/homeworkSubmissions.ts`, `artifacts/api-server/src/modules/homework/submission.ts`, `artifacts/api-server/src/lib/homeworkSubmission.ts` (`SubmissionView`).

## Global Constraints

- **Library picker only, no camera in this phase.** `app.json` has `expo-image-picker` with `cameraPermission: false`. Adding a camera button changes the iOS usage string / Android manifest = a native change = `app.json` `version` bump (currently `1.6.0`) and a real build. Do NOT touch `app.json`, `package.json` dependencies, or `eas.json` in this plan. A student can still photograph the work in their phone's camera app and pick it from the library.
- **No new native module, no config-plugin change** ⇒ OTA-safe; the plan must end with `git diff --stat` showing `app.json` untouched.
- Latin product name is **Iqrra** (two r's) in copy; Arabic brand «إقرأ»; the verb «اقرأ» stays ordinary copy. No «Iqraa»/«Iqra» in strings.
- Copy exists in **both** `ar` and `en` in `services/i18n.ts`; `i18n.test.ts` requires identical key sets, no empty strings, matching function/string shape. `i18nTerminology.test.ts` bans some phrasings (read its list before writing Arabic).
- Dates: use `formatDueDate`, `dueBadge`, `ammanToday` from `services/homework.ts`; never `new Date('YYYY-MM-DD')`, never read `dueAt`.
- Colours from `useColors()`, never `palette`; text on `colors.primary` is `colors.primaryForeground`; a card uses `useSurface()` and drops its own `borderWidth: 1` and never sets `overflow: 'hidden'`.
- Type, spacing and radius use the `TYPE`/`SPACE`/`RADIUS` scales in `constants/theme.ts` (`designScale.test.ts`/`typeScale.test.ts` are ratchets). Icons: `<Ionicons>` only, sizes from `ICON`/`ICON_DISPLAY` (`constants/icons.ts`); never an emoji for a tick/cross/warning. State is announced with `aria-*` props, never `accessibilityState=` (`ariaState.test.ts`). Touch targets ≥ 44. Every state signalled by colour is also text.
- Do **not** add a `KeyboardAvoidingView` in the screen (the root Stack already wraps every screen in `KeyboardSafeView`).
- `services/*.ts` files loaded by tests import with explicit `.ts` extensions and must not import `react-native`/`expo-*` at module scope.
- `canTrack === false` homework items must never be called late/unfinished and must not offer the submit screen.
- No `sed -i`/`perl -pi` on source; use the Edit tool. Stage named paths only (`git add <paths>`), never `-A`.
- Photos upload as JSON `{ photoDataUrl }` through `apiFetch` with an explicit `timeoutMs` (the 15 s default is too short on a phone connection): use `45_000`.
- Phase 1's server limits are the source of truth: `PHOTOS_MAX = 6`, `NOTE_MAX = 2000`, photo ≤ 4 MiB decoded, jpeg/png/webp only, a data URL longer than 6,000,000 characters is refused, 60 upload attempts per hour per account.
- The phase 1 API has **no `draft` status**: `status` is `none | submitted | late`; `locked` is true only when handed in and past the due day; a draft (photos or note, not handed in) reads as `none` with `photos`/`note` filled.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `artifacts/mobile/services/homeworkSubmission.ts` (create) | Types, `normalizeSubmission`, hand-in/add-photo rules, state → label key, data-URL pre-check. No imports. |
| `artifacts/mobile/services/__tests__/homeworkSubmission.test.ts` (create) | Pure tests for the above. |
| `artifacts/mobile/services/homeworkSubmissionApi.ts` (create) | `makeHomeworkSubmissionApi(deps)` (injected `apiFetch`) + `SubmissionError`; plus a default bound instance in a separate tiny file if needed to keep the factory importable by tests. |
| `artifacts/mobile/services/__tests__/homeworkSubmissionApi.test.ts` (create) | URL/method/body/error-mapping tests with a fake `apiFetch`. |
| `artifacts/mobile/services/apiErrorKey.ts` (modify) | `BY_CODE` entries for `locked`, `photo_limit`, `empty`, `submission_required`, `storage_unavailable`, `bad_image`, `bad_data_url`, `invalid`. |
| `artifacts/mobile/services/__tests__/apiErrorKey.test.ts` (modify) | Pin them. |
| `artifacts/mobile/services/homework.ts` (modify) | `FamilyHomework` gains `requiresSubmission`, `submission`; normalizer; helper `showsSubmissionLink`. |
| `artifacts/mobile/services/__tests__/homework.test.ts` (modify) | Cover the new fields. |
| `artifacts/mobile/services/homeworkPhotoPick.ts` (create) | `pickHomeworkPhoto()` — library picker → downscaled JPEG data URL. |
| `artifacts/mobile/services/__tests__/photoPickers.test.ts` (modify) | Add the new file to `FILES`. |
| `artifacts/mobile/services/routeGating.ts` (modify) + test | Allow `/homework-project` for non-teachers. |
| `artifacts/mobile/services/i18n.ts` (modify) | New ar+en keys. |
| `artifacts/mobile/app/homework-project/[id].tsx` (create) | The screen. |
| `artifacts/mobile/services/__tests__/homeworkProjectScreen.test.ts` (create) | Source-reading invariants for the screen (no `palette`, no `KeyboardAvoidingView`, no `accessibilityState=`, uses `useSurface`, has a retry path, etc.). |
| `artifacts/mobile/app/(tabs)/school.tsx` (modify) | `HomeworkRow`: state chip + link for a submission homework, no tick. |
| `docs/status-log.md`, spec §6/§8, PR body | Write-up. |

---

### Task 1: Pure submission rules and types

**Files:**
- Create: `artifacts/mobile/services/homeworkSubmission.ts`
- Test: `artifacts/mobile/services/__tests__/homeworkSubmission.test.ts`

**Interfaces:**
- Produces (exact names, later tasks import them):
  ```ts
  export const PHOTOS_MAX = 6;
  export const NOTE_MAX = 2000;
  export type SubmissionState = 'none' | 'submitted' | 'late';
  export interface SubmissionPhoto { id: string; url: string | null; mime: string; sizeBytes: number }
  export interface SubmissionView { status: SubmissionState; locked: boolean; note: string; photos: SubmissionPhoto[]; submittedAt: string | null }
  export function normalizeSubmissionState(v: unknown): SubmissionState        // anything unknown -> 'none'
  export function normalizeSubmission(raw: unknown): SubmissionView            // tolerant; non-object -> emptySubmission()
  export function emptySubmission(): SubmissionView
  export function slotsLeft(photoCount: number): number                         // PHOTOS_MAX - n, never < 0
  export function canAddPhoto(v: { photos: unknown[]; locked: boolean }): boolean
  export function canHandIn(v: { photos: unknown[]; locked: boolean }, note: string): boolean
  export function noteChanged(saved: string, draft: string): boolean            // trim-compare
  export function photoDataUrlOk(dataUrl: string): boolean                      // data:image/(jpeg|png|webp);base64,... and length <= 6_000_000
  export type SubmissionLabelKey = 'submissionNone' | 'submissionSubmitted' | 'submissionLate';
  export function stateLabelKey(state: SubmissionState): SubmissionLabelKey
  ```

- [ ] **Step 1: Write the failing test** (`homeworkSubmission.test.ts`, node:test, explicit `.ts` import)

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHOTOS_MAX, NOTE_MAX, normalizeSubmission, normalizeSubmissionState, emptySubmission,
  slotsLeft, canAddPhoto, canHandIn, noteChanged, photoDataUrlOk, stateLabelKey,
} from '../homeworkSubmission.ts';

test('limits mirror the server', () => {
  assert.equal(PHOTOS_MAX, 6);
  assert.equal(NOTE_MAX, 2000);
});

test('state: only the three known values survive', () => {
  assert.equal(normalizeSubmissionState('submitted'), 'submitted');
  assert.equal(normalizeSubmissionState('late'), 'late');
  assert.equal(normalizeSubmissionState('none'), 'none');
  assert.equal(normalizeSubmissionState('draft'), 'none');
  assert.equal(normalizeSubmissionState(undefined), 'none');
  assert.equal(normalizeSubmissionState(3), 'none');
});

test('normalizeSubmission is tolerant and drops bad photos', () => {
  assert.deepEqual(normalizeSubmission(null), emptySubmission());
  assert.deepEqual(normalizeSubmission('x'), emptySubmission());
  const v = normalizeSubmission({
    status: 'late', locked: true, note: 'hi', submittedAt: '2026-10-01T10:00:00.000Z',
    photos: [
      { id: 'a', url: 'https://x/a.jpg', mime: 'image/jpeg', sizeBytes: 10 },
      { id: 7 }, null, { url: 'u' },
      { id: 'b', url: null, mime: 'image/png', sizeBytes: 5 },
    ],
  });
  assert.equal(v.status, 'late');
  assert.equal(v.locked, true);
  assert.equal(v.note, 'hi');
  assert.deepEqual(v.photos.map(p => p.id), ['a', 'b']);
  assert.equal(v.photos[1].url, null);
});

test('locked defaults to false and a non-boolean is false', () => {
  assert.equal(normalizeSubmission({ locked: 'yes' }).locked, false);
});

test('slots and add rule', () => {
  assert.equal(slotsLeft(0), 6);
  assert.equal(slotsLeft(6), 0);
  assert.equal(slotsLeft(9), 0);
  assert.equal(canAddPhoto({ photos: [1, 2, 3, 4, 5], locked: false }), true);
  assert.equal(canAddPhoto({ photos: [1, 2, 3, 4, 5, 6], locked: false }), false);
  assert.equal(canAddPhoto({ photos: [], locked: true }), false);
});

test('hand-in needs a photo or a non-blank note, and not locked', () => {
  assert.equal(canHandIn({ photos: [], locked: false }, ''), false);
  assert.equal(canHandIn({ photos: [], locked: false }, '   \n'), false);
  assert.equal(canHandIn({ photos: [], locked: false }, 'x'), true);
  assert.equal(canHandIn({ photos: [1], locked: false }, ''), true);
  assert.equal(canHandIn({ photos: [1], locked: true }, 'x'), false);
});

test('noteChanged compares trimmed text', () => {
  assert.equal(noteChanged('a', ' a '), false);
  assert.equal(noteChanged('a', 'b'), true);
  assert.equal(noteChanged('', '  '), false);
});

test('photoDataUrlOk accepts jpeg/png/webp base64 only, within the server cap', () => {
  assert.equal(photoDataUrlOk('data:image/jpeg;base64,AAAA'), true);
  assert.equal(photoDataUrlOk('data:image/png;base64,AAAA'), true);
  assert.equal(photoDataUrlOk('data:image/webp;base64,AAAA'), true);
  assert.equal(photoDataUrlOk('data:image/heic;base64,AAAA'), false);
  assert.equal(photoDataUrlOk('data:image/gif;base64,AAAA'), false);
  assert.equal(photoDataUrlOk('data:image/jpeg,AAAA'), false);
  assert.equal(photoDataUrlOk('image/jpeg;base64,AAAA'), false);
  assert.equal(photoDataUrlOk('data:image/jpeg;base64,' + 'A'.repeat(6_000_000)), false);
});

test('label keys', () => {
  assert.equal(stateLabelKey('none'), 'submissionNone');
  assert.equal(stateLabelKey('submitted'), 'submissionSubmitted');
  assert.equal(stateLabelKey('late'), 'submissionLate');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/homeworkSubmission.test.ts`
Expected: FAIL — cannot find module `../homeworkSubmission.ts`.

- [ ] **Step 3: Implement** `services/homeworkSubmission.ts` (no imports; read `services/homework.ts`'s `str`/`obj` helper style first and match it)

```ts
export const PHOTOS_MAX = 6;
export const NOTE_MAX = 2000;
const DATA_URL_MAX = 6_000_000;

export type SubmissionState = 'none' | 'submitted' | 'late';
export interface SubmissionPhoto { id: string; url: string | null; mime: string; sizeBytes: number }
export interface SubmissionView {
  status: SubmissionState; locked: boolean; note: string;
  photos: SubmissionPhoto[]; submittedAt: string | null;
}

export function normalizeSubmissionState(v: unknown): SubmissionState {
  return v === 'submitted' || v === 'late' ? v : 'none';
}

export function emptySubmission(): SubmissionView {
  return { status: 'none', locked: false, note: '', photos: [], submittedAt: null };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function normalizeSubmission(raw: unknown): SubmissionView {
  if (!isObj(raw)) return emptySubmission();
  const photos: SubmissionPhoto[] = [];
  if (Array.isArray(raw['photos'])) {
    for (const p of raw['photos']) {
      if (!isObj(p) || typeof p['id'] !== 'string' || p['id'] === '') continue;
      photos.push({
        id: p['id'],
        url: typeof p['url'] === 'string' ? p['url'] : null,
        mime: typeof p['mime'] === 'string' ? p['mime'] : '',
        sizeBytes: typeof p['sizeBytes'] === 'number' ? p['sizeBytes'] : 0,
      });
    }
  }
  return {
    status: normalizeSubmissionState(raw['status']),
    locked: raw['locked'] === true,
    note: typeof raw['note'] === 'string' ? raw['note'] : '',
    photos,
    submittedAt: typeof raw['submittedAt'] === 'string' ? raw['submittedAt'] : null,
  };
}

export function slotsLeft(photoCount: number): number {
  return Math.max(0, PHOTOS_MAX - photoCount);
}

export function canAddPhoto(v: { photos: unknown[]; locked: boolean }): boolean {
  return !v.locked && v.photos.length < PHOTOS_MAX;
}

export function canHandIn(v: { photos: unknown[]; locked: boolean }, note: string): boolean {
  return !v.locked && (v.photos.length > 0 || note.trim() !== '');
}

export function noteChanged(saved: string, draft: string): boolean {
  return saved.trim() !== draft.trim();
}

export function photoDataUrlOk(dataUrl: string): boolean {
  return dataUrl.length <= DATA_URL_MAX && /^data:image\/(jpeg|png|webp);base64,/.test(dataUrl);
}

export type SubmissionLabelKey = 'submissionNone' | 'submissionSubmitted' | 'submissionLate';
export function stateLabelKey(state: SubmissionState): SubmissionLabelKey {
  return state === 'late' ? 'submissionLate' : state === 'submitted' ? 'submissionSubmitted' : 'submissionNone';
}
```

- [ ] **Step 4: Run it and see it pass** (same command). Then break `canHandIn` (drop the `locked` check) → a test must fail; restore.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/homeworkSubmission.ts artifacts/mobile/services/__tests__/homeworkSubmission.test.ts
git commit -m "Student app: pure rules for a homework project submission"
```

---

### Task 2: API client, error mapping

**Files:**
- Create: `artifacts/mobile/services/homeworkSubmissionApi.ts`
- Test: `artifacts/mobile/services/__tests__/homeworkSubmissionApi.test.ts`
- Modify: `artifacts/mobile/services/apiErrorKey.ts`, `artifacts/mobile/services/__tests__/apiErrorKey.test.ts`, `artifacts/mobile/services/i18n.ts` (error keys only)

**Interfaces:**
- Consumes: `normalizeSubmission`, `SubmissionView` (Task 1). Read `services/guardianApi.ts` and `services/homeworkApi.ts` first and copy their injection/`readJson` style exactly (including how `HomeworkError` carries `status` and `code`); read `services/apiErrorKey.ts` for how `BY_CODE` and status mapping work.
- Produces:
  ```ts
  export class SubmissionError extends Error { constructor(message: string, readonly status: number, readonly code?: string) }
  export interface SubmissionApiDeps {
    apiFetch: (path: string, init?: { method?: string; body?: string; timeoutMs?: number }) => Promise<Response>;
  }
  export function makeHomeworkSubmissionApi(deps: SubmissionApiDeps): {
    get(homeworkId: string): Promise<{ submission: SubmissionView; dueDate: string }>;
    uploadPhoto(homeworkId: string, photoDataUrl: string): Promise<{ photo: SubmissionPhoto; photoCount: number }>;
    removePhoto(homeworkId: string, photoId: string): Promise<void>;
    saveNote(homeworkId: string, note: string): Promise<SubmissionView>;
    submit(homeworkId: string): Promise<SubmissionView>;
    /** Saves the note first only when `noteChanged(saved, note)`, then hands in. */
    handIn(homeworkId: string, savedNote: string, note: string): Promise<SubmissionView>;
  };
  export const UPLOAD_TIMEOUT_MS = 45_000;
  ```
  Paths (all `encodeURIComponent` on ids): `GET /student/homework/:id/submission`; `POST …/submission/photos` body `{photoDataUrl}`; `DELETE …/submission/photos/:photoId`; `PUT …/submission` body `{note}`; `POST …/submission/submit`.
  A binding file `services/homeworkSubmissionApi.default.ts` (imports `apiFetch` from `./apiClient.ts`) exports `homeworkSubmissionApi = makeHomeworkSubmissionApi({ apiFetch })` — the factory file itself must not import `apiClient`.

- [ ] **Step 1: Failing tests** with a fake `apiFetch` that records `(path, init)` and returns `new Response(JSON.stringify(body), { status })`. Cases:
  - `get` hits `GET /student/homework/h%201/submission`, returns normalized view + `dueDate`; a 404 throws `SubmissionError` with `status 404`.
  - `uploadPhoto` posts `{"photoDataUrl": …}` with `timeoutMs: UPLOAD_TIMEOUT_MS`, returns `{photo, photoCount}`; **refuses locally, without calling `apiFetch`**, a data URL that fails `photoDataUrlOk` (throws `SubmissionError` status 400, code `unsupported_type`).
  - `uploadPhoto` maps `409 {code:'photo_limit'}`, `409 {code:'locked'}`, `413 {code:'file_too_large'}`, `429` to a `SubmissionError` carrying `status` and `code` (body parse failure ⇒ `code undefined`).
  - `removePhoto` sends `DELETE` to the encoded photo path; `409 {code:'empty'}` surfaces as `SubmissionError`.
  - `saveNote` sends `PUT` with `{note}`.
  - `handIn(id, 'a', 'a ')` calls only `submit` (note unchanged after trim); `handIn(id, 'a', 'b')` calls `PUT` then `POST submit` in that order; if the `PUT` fails, `submit` is NOT called.
  - In `apiErrorKey.test.ts`: `apiErrorKey(new SubmissionError('x', 409, 'locked'), 'errGeneric')` ⇒ `'errSubmissionLocked'`; likewise `photo_limit`⇒`errPhotoLimit`, `empty`⇒`errSubmissionEmpty`, `submission_required`⇒`errSubmissionRequired`, `storage_unavailable`⇒`errStorageUnavailable`, `bad_image`/`bad_data_url`⇒`errBadImage`, `invalid`⇒`errGeneric`-or-existing; and the already-mapped `file_too_large`/`unsupported_type`/`too_long`/429 still map as before. Confirm `apiErrorKey` accepts a `SubmissionError` (it works on anything with `status`/`code`; if it uses `instanceof ApiError|HomeworkError`, extend it minimally and test that).

- [ ] **Step 2: Run, see them fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/homeworkSubmissionApi.test.ts services/__tests__/apiErrorKey.test.ts`

- [ ] **Step 3: Implement** the factory, `SubmissionError`, a local `readJson` that returns parsed JSON or throws `SubmissionError(message, status, code)` where `message` is the body's `error` string when present, then the `BY_CODE` entries (scope the generic words — `locked`, `empty`, `photo_limit`, `invalid` — the way the file already scopes things, so they cannot hijack another feature's identically-named code; if it has no scoping facility, key them as the file does for `due_date_out_of_range`) and these i18n error keys (ar+en; Arabic copy must pass `i18nTerminology.test.ts`):
  - `errSubmissionLocked` — «انتهى موعد التسليم، لم يعد التعديل ممكناً» / "The due day has passed, so this project can no longer be changed."
  - `errPhotoLimit` — «يمكنك إضافة ٦ صور كحد أقصى» / "You can add up to 6 photos."
  - `errSubmissionEmpty` — «أضف صورة أو ملاحظة قبل التسليم» / "Add a photo or a note before handing in."
  - `errSubmissionRequired` — «يُسلَّم هذا الواجب بمشروع، لا بالتأشير» / "This homework is handed in as a project, not ticked."
  - `errStorageUnavailable` — «تعذّر حفظ الصورة الآن، حاول بعد قليل» / "Photos can't be saved right now. Try again shortly."
  - `errBadImage` — «تعذّرت قراءة هذه الصورة، جرّب صورة أخرى» / "That image couldn't be read. Try another one."

- [ ] **Step 4: Run, see them pass.** Mutation check: make `handIn` always call `PUT` → the "only submit" test fails; restore.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/homeworkSubmissionApi.ts artifacts/mobile/services/homeworkSubmissionApi.default.ts artifacts/mobile/services/__tests__/homeworkSubmissionApi.test.ts artifacts/mobile/services/apiErrorKey.ts artifacts/mobile/services/__tests__/apiErrorKey.test.ts artifacts/mobile/services/i18n.ts
git commit -m "Student app: homework submission API client and error mapping"
```

---

### Task 3: Homework list carries the submission state; School row shows it

**Files:**
- Modify: `artifacts/mobile/services/homework.ts` (`FamilyHomework`, `normalizeFamilyHomework` ~line 244, new helper), `artifacts/mobile/services/__tests__/homework.test.ts`, `artifacts/mobile/services/routeGating.ts` (+ `__tests__/routeGating.test.ts`), `artifacts/mobile/services/i18n.ts`, `artifacts/mobile/app/(tabs)/school.tsx` (`HomeworkRow` ~592–750)

**Interfaces:**
- Consumes: `SubmissionState`, `normalizeSubmissionState`, `stateLabelKey` (Task 1).
- Produces:
  ```ts
  // homework.ts
  FamilyHomework { …; requiresSubmission: boolean; submission: SubmissionState }
  export function showsSubmissionLink(hw: Pick<FamilyHomework, 'requiresSubmission' | 'canTrack'>): boolean // requiresSubmission && canTrack
  // route: '/homework-project/<id>'
  ```
  i18n keys (ar+en): `submissionNone` «لم يُسلَّم بعد» / "Not handed in", `submissionSubmitted` «تم التسليم» / "Handed in", `submissionLate` «سُلِّم متأخراً» / "Handed in late", `submissionOpen` «افتح المشروع» / "Open project", `submissionOpenA11y` (function of title) «افتح مشروع الواجب: ${title}» / `Open the project for ${title}`.

- [ ] **Step 1: Failing tests** in `homework.test.ts`: an old-server payload with neither field normalizes to `requiresSubmission: false, submission: 'none'`; `{requiresSubmission:true, submission:'late'}` is kept; `{submission:'draft'}` → `'none'`; `showsSubmissionLink` true only when both required and `canTrack`; a `canTrack:false` submission item never reports state `overdue` (existing rule — assert it still holds with `requiresSubmission:true`). In `routeGating.test.ts` add `/homework-project/h1` to the "allows" list.
- [ ] **Step 2: Run, fail.** `node … --test services/__tests__/homework.test.ts services/__tests__/routeGating.test.ts`
- [ ] **Step 3: Implement** the type fields (update every fixture/factory the typechecker flags), the normalizer, `showsSubmissionLink`, the `NON_TEACHER_ROUTES` entry `'/homework-project'` with a one-line comment, the i18n keys, and in `school.tsx`'s `HomeworkRow`:
  - for `item.requiresSubmission`: **no tick `Pressable`** (the server answers 409 `submission_required`); show a non-pressable status icon (`checkmark-circle` filled when `submission !== 'none'`, `ellipse-outline` otherwise) plus a text chip `t(stateLabelKey(item.submission))` (late uses the same `palette`/`colors` the row already uses for overdue, never amber), and when `showsSubmissionLink(item)` a `PressableScale` link «افتح المشروع» → `router.push(\`/homework-project/${encodeURIComponent(item.id)}\` as never)`, `minHeight: 44`, `aria-label={t('submissionOpenA11y', item.title)}`;
  - `toggleDone` must early-return for a submission item (defence in depth) and `allTrackedDone`/`applyDone` keep using the server's `done` (the server ticks `done` on hand-in);
  - do not add an `<EmptyState>` to `school.tsx` (`emptyState.test.ts` pins exactly 2).
- [ ] **Step 4: Run, pass** (add a `homework.test.ts` mutation check: normalize `submission` without the `normalizeSubmissionState` call → the `'draft'` test fails). Then `pnpm run typecheck` from the repo root.
- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/homework.ts artifacts/mobile/services/__tests__/homework.test.ts artifacts/mobile/services/routeGating.ts artifacts/mobile/services/__tests__/routeGating.test.ts artifacts/mobile/services/i18n.ts "artifacts/mobile/app/(tabs)/school.tsx"
git commit -m "Student app: homework list shows a project's state and links to it"
```

---

### Task 4: Library photo picker

**Files:**
- Create: `artifacts/mobile/services/homeworkPhotoPick.ts`
- Modify: `artifacts/mobile/services/__tests__/photoPickers.test.ts` (add the file to `FILES`)

**Interfaces:**
- Consumes: `pickedPhotoToDataUrl`, `PICK_BASE64`, `photoPickQuality` from `services/imageDownscale.ts`; `photoDataUrlOk` (Task 1). Read `services/messaging.ts:22` (`pickChatImage`) and copy its shape.
- Produces:
  ```ts
  export type HomeworkPhotoPick =
    | { kind: 'ok'; dataUrl: string }
    | { kind: 'cancelled' }
    | { kind: 'denied' }
    | { kind: 'unsupported' };  // picked, but the encoded result is not jpeg/png/webp (e.g. HEIC passed through)
  export async function pickHomeworkPhoto(): Promise<HomeworkPhotoPick>;
  ```
  Behaviour: request media-library permission (`denied` if refused); `launchImageLibraryAsync({ mediaTypes: ['images'], quality: photoPickQuality(0.85), base64: PICK_BASE64 })`; cancelled ⇒ `cancelled`; else `pickedPhotoToDataUrl(asset)` (default `maxEdge` 1600); if `!photoDataUrlOk(result)` ⇒ `unsupported`. **Known trap from exploration:** an image already ≤ 1600 px is passed through un-re-encoded, so a small HEIC would reach the server as `data:image/heic` and be refused — the `unsupported` branch is how the screen shows `errBadImage` instead of a 400. If you can force a re-encode cheaply (a smaller `maxEdge` is NOT a guarantee), do not; just report `unsupported`.

- [ ] **Step 1:** Add `'homeworkPhotoPick.ts'` to `FILES` in `photoPickers.test.ts` and run it — it fails (file missing). `node … --test services/__tests__/photoPickers.test.ts`
- [ ] **Step 2: Implement** per the contract, obeying the test's rules (`base64:` only as `base64: PICK_BASE64`, `photoPickQuality(` alongside, `pickedPhotoToDataUrl(`, no `Promise.all`, no `downscaleImage(`). Lazy-import nothing new; `expo-image-picker` import at module scope is fine (this file is never loaded by tests other than as text).
- [ ] **Step 3: Run** `photoPickers.test.ts` ⇒ pass; root `pnpm run typecheck`.
- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/services/homeworkPhotoPick.ts artifacts/mobile/services/__tests__/photoPickers.test.ts
git commit -m "Student app: library photo picker for a homework project"
```

---

### Task 5: The project screen

**Files:**
- Create: `artifacts/mobile/app/homework-project/[id].tsx`, `artifacts/mobile/services/__tests__/homeworkProjectScreen.test.ts`
- Modify: `artifacts/mobile/services/i18n.ts` (screen keys)

**Interfaces:**
- Consumes: everything from Tasks 1–4; `homeworkSubmissionApi` (default instance); `useLocalSearchParams<{id:string}>()`; `useColors`, `useLanguage` (`t`, `isRTL`), `useSurface`, `PressableScale`, `Button`, `Input` (or `TextInput` styled like it — check `Input`'s multiline support), `BackButton`, `Toast`, `EmptyState`, `ImageViewerModal`, `confirm` (`services/confirm.ts`), `Celebrate` + `justCompleted` (`services/celebration.ts` — fire only on the crossing from not-handed-in to handed-in made on this screen, never on opening an already-handed-in project), `formatDueDate`, `apiErrorMessage(err, fallbackKey, t)`, `ICON`.
- Screen i18n keys (ar+en, write both): `projectTitle` «مشروع الواجب» / "Homework project"; `projectDue` (fn of formatted date) «آخر موعد للتسليم: ${d}» / `Hand in by ${d}`; `projectPhotos` «الصور» / "Photos"; `projectPhotosCount` (fn n) «${n} من ٦» / `${n} of 6`; `projectAddPhoto` «إضافة صورة» / "Add a photo"; `projectRemovePhoto` «حذف الصورة» / "Remove photo"; `projectRemoveConfirmTitle`/`…Body` (a removal deletes the photo from the server too); `projectNote` «ملاحظة (اختياري)» / "Note (optional)"; `projectNoteCounter` (fn n); `projectHandIn` «سلّم» / "Hand in"; `projectReplace` «سلّم من جديد» / "Hand in again"; `projectLocked` «انتهى موعد التسليم، المشروع للقراءة فقط» / "The due day has passed. This project is read-only."; `projectHandedIn` «تم تسليم المشروع» / "Project handed in"; `projectLoadFailed` + `projectRetry`; `projectUploading`; `projectPermissionDenied` «اسمح بالوصول إلى الصور من إعدادات الجهاز» / "Allow photo access in your device settings."; `projectLateNote` «سُلِّم بعد الموعد» / "Handed in after the due day". Arabic must pass `i18nTerminology.test.ts`.

**Behaviour contract (the implementer builds exactly this; each bullet maps to a source-reading assertion below):**
1. Load on mount **and when the screen regains focus** (signed URLs live 10 minutes) with `homeworkSubmissionApi.get(id)`. Three states: loading; **error with a visible retry** (a failed load must NOT look like "no submission"); loaded. A 404 shows the error state with the not-found message and no retry loop.
2. Header: stack-screen recipe (`paddingTop: insets.top + 12`, `colors.card`, hairline bottom border, `BackButton`). The due date line uses `formatDueDate(dueDate)`.
3. Photos: a grid of up to 6 slots; each filled slot shows the `expo-image` thumbnail (tap ⇒ `ImageViewerModal`) and, unless `locked`, a 44-pt remove control that goes through `confirm({... destructive: true})` then `removePhoto`. A `null` url renders a placeholder icon, not a broken image. The add slot is shown only when `canAddPhoto(view)`; it calls `pickHomeworkPhoto()`, handles `denied` (permission message), `unsupported` (`errBadImage`), `cancelled` (nothing); uploads **one at a time**, disables the add control while a request is in flight (`aria-busy`), appends the returned photo on success. On any error, show `apiErrorMessage` in a `Toast`/inline error and leave the view untouched.
4. Note: multiline input, `maxLength={NOTE_MAX}`, counter text, editable unless `locked`; it is held in local state and saved only on hand-in (via `handIn(id, view.note, draft)`) — and also on blur if `noteChanged`, via `saveNote`, so a student who leaves the screen does not lose it (a failed save shows an error and keeps the draft).
5. Hand-in button: `disabled`/`aria-disabled` unless `canHandIn(view, draft)` and nothing is in flight; label `projectHandIn`, or `projectReplace` when `view.status !== 'none'`. On success replace the view with the returned one; if the status crossed `none → submitted|late` on this screen, show `Celebrate` once (only for `submitted`, not `late`). On `409 locked`/`empty` show the mapped message and reload the view.
6. Status block at the top: text + icon for `none` / `submitted` / `late` (text always present, never colour alone); `late` shows `projectLateNote`.
7. Locked (`view.locked`): everything read-only, the lock message visible, no add/remove/hand-in controls.
8. No `palette` import; colours from `useColors()`; cards via `useSurface()` (no `borderWidth: 1`, no `overflow: 'hidden'`); sizes/radii/gaps from `TYPE`/`SPACE`/`RADIUS`; `Ionicons` sizes from `ICON`; `aria-*` only; no `KeyboardAvoidingView`; photos in a `ScrollView` with `contentContainerStyle` width-capped by `CONTENT_MAX_WIDTH`.
9. A homework that is not a project (the API's 404) and a `canTrack === false` item both end in the error state; the School row never links them (Task 3).

- [ ] **Step 1: Failing test** `homeworkProjectScreen.test.ts` (source-reading, like `photoPickers.test.ts`/`generatorScreens.test.ts`: `readFileSync` the screen and assert by regex):
  - does not import `palette`; does not contain `KeyboardAvoidingView` or `accessibilityState=`; contains `useSurface(`; contains no `borderWidth: 1` inside a `useSurface` card style (assert the file has no `overflow: 'hidden'`);
  - imports `homeworkSubmissionApi`, `pickHomeworkPhoto`, `canHandIn`, `canAddPhoto`, `confirm`;
  - has a retry affordance: contains `projectRetry`;
  - uses `NOTE_MAX` for `maxLength`; uses `formatDueDate(` and does not contain `new Date(`;
  - uses `useFocusEffect` or the router's focus hook for reload;
  - every `<Ionicons` `size=` is `ICON.` based (no numeric literal outside the scale);
  - contains none of the emoji ✓ ✕ ✗ ⚠ 💡 ✅ ❌.
  Run — fails (screen missing).
- [ ] **Step 2: Implement** the screen per the contract. Read `app/exam-review/[id].tsx` and `app/my-exams.tsx` for the header/scroll recipe and `components/ui/` for exact props before writing. Add the i18n keys.
- [ ] **Step 3: Run** the new test plus the policing suites: `node … --test services/__tests__/homeworkProjectScreen.test.ts services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts services/__tests__/designScale.test.ts services/__tests__/typeScale.test.ts services/__tests__/ariaState.test.ts services/__tests__/iconSystem.test.ts services/__tests__/dateLabels.test.ts services/__tests__/statusBar.test.ts services/__tests__/cornerTheme.test.ts`; fix the screen (not the ratchets) until green. Root `pnpm run typecheck`.
- [ ] **Step 4: Commit**

```bash
git add "artifacts/mobile/app/homework-project/[id].tsx" artifacts/mobile/services/__tests__/homeworkProjectScreen.test.ts artifacts/mobile/services/i18n.ts
git commit -m "Student app: the homework project screen"
```

---

### Task 6: Run it for real, write it up

**Files:** `docs/status-log.md` (new top entry «Homework project submission — student app»), spec §6/§8 (phase 2 built; camera deferred; what remains), PR #1356 body.

- [ ] **Step 1: Whole mobile suite and typecheck.** `cd artifacts/mobile && pnpm test` (prints nothing until it finishes; minutes) and root `pnpm run typecheck`. Also the brand check CI runs (`ci.yml` "Brand is «إقرأ»": no «اقرأ» quoted brand form in app source copy).
- [ ] **Step 2: Native-surface check.** `git diff origin/main --stat -- artifacts/mobile/app.json artifacts/mobile/package.json artifacts/mobile/eas.json` must list nothing. If it does, stop.
- [ ] **Step 3: Browser check** (CLAUDE.md: Playwright / `pnpm run dev:mobile:web`, not the Desktop Browser pane; start the API with `AI_LIVE_MODE=false` against a throwaway DB, register a throwaway teacher — the API logs the 6-digit code — create a class, a student code-signup, a homework, then set `requiresSubmission: true` through the API (no screen exposes it yet), then drive the student: School row shows «لم يُسلَّم بعد» and the link, no tick; open the project; add a photo (use Playwright's file chooser; the web picker returns base64 through a canvas), see it appear; remove it with the confirm; add two, write a note, hand in; the row shows «تم التسليم»; reopen and replace; set the due date in the past through the DB to verify the locked, read-only state. Test phone width and desktop, light and dark, Arabic RTL and English; screenshot each. Say plainly in the write-up which of these you did and which you could not (the real device picker, HEIC).
- [ ] **Step 4: Write-up** at the top of `docs/status-log.md`: what was built, what was verified and how, what was not (real device picker/HEIC/camera, the S3 path with real R2, TalkBack/VoiceOver), known limits (library only; no camera; photos re-fetch on focus only; no offline queue), decisions (library-only to avoid a native bump; thin screen over a pure service). Update spec §6 (phase 2 status) and §8. Update `STATUS.md` only if a line there became false.
- [ ] **Step 5: Commit, push, update the PR.** `git add` named paths; push the branch; update PR #1356's body (it currently says "no app code, no OTA" — that is now false: say this push ships app code over the air to the `preview` channel on merge, with no `app.json` change, and that the `production` channel stays manual).

---

## Self-review (spec §5 "Student" coverage)

- Homework list state instead of the tick → Task 3. Screen with note, six photo slots from the library (camera deferred, flagged), per-photo remove, «سلّم» disabled until a photo or note → Tasks 4–5. After the due day a submitted project is read-only with a lock message → Task 5 bullet 7. Failed load shows a retry → bullet 1. 44-pt targets, `useSurface()`/`useColors()`, no emoji ticks, state in text → Global Constraints + Task 5 bullet 8 + the source-reading test. Native surface check → Global Constraints + Task 6 step 2.
- Types: `SubmissionView`/`SubmissionState`/`SubmissionPhoto` are defined once (Task 1) and consumed by Tasks 2, 3, 5; `makeHomeworkSubmissionApi` method names (`get`, `uploadPhoto`, `removePhoto`, `saveNote`, `submit`, `handIn`) are used identically in Task 5; `HomeworkPhotoPick` kinds are handled in full in Task 5 bullet 3.
- Deliberately NOT here: teacher/parent views (phase 3), the `requiresSubmission` switch in the teacher UI (phase 3 — the toggle semantics decision is due then), camera capture (native bump), offline queue for uploads.
