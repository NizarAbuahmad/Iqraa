# Resources Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/curriculum/resources` into the single browsable home for every supplementary teaching
resource — pre-made printable practice sheets, classroom games/activities, and curriculum media — where
a teacher can add any item to a class or use/print it immediately.

**Architecture:** Pre-made sheets are generated **once, offline** and ship as a git-committed JSON
manifest bundled into the app (mirroring the existing `external_resources.json` pattern), so browsing
costs no AI call and works when the media API is down. The resources screen becomes a
section-and-kind-filtered list over a single unified view-model that adapts five existing data sources.
"Add to class" reuses the existing nullable `classGroupId` FK pattern; the only schema change in the
whole plan is adding that one column to `lesson_media`.

**Tech Stack:** Expo/React Native (also the web build), Express + Drizzle/Postgres, `expo-print` +
`expo-sharing` for printing, Cloudflare R2 for uploaded bytes, SymPy math-verifier for answer keys.

**Spec:** This document. Source material: `kinza.mp4` (analysed in **Context** below) plus the four
product decisions recorded in **Decisions**.

**Repo plan location:** `writing-plans` mandates `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.
Task 0 Step 5 copies this file to `docs/superpowers/plans/2026-09-15-resources-tab.md` and commits it,
so the plan travels with the repo.

**Start at Task 0.** The environment is currently unable to build at all — 0.25 GB free disk — and all
work must happen in a new worktree off `main`, because the main checkout is on another task's branch
with uncommitted changes to `STATUS.md`, which Task 8 also edits.

## Revision, 2026-09-15 — the media library is not on `main`

The three exploration scans read the **main checkout**, which has
`feat/islamic-and-s2-figures` checked out. That branch carries 7 unmerged commits containing the whole
teacher media library — nullable `lessonId`, `sourceUrl`, the `video` kind, `GET /media/library`,
`saveLibraryLink`, `MediaLibraryPicker`, `ShareToStudentsSheet`. **None of it is on `main`,** which has
a much simpler `lesson_media`: `lessonId` NOT NULL, `r2Key`/`mimeType`/`sizeBytes` NOT NULL, kinds
`image | audio | document`, and a 163-line route file with no library endpoint. There is no open PR for
that branch, so its merge date is unknown.

This plan was therefore written against a codebase state `main` does not have — the trap CLAUDE.md
names first ("Verify claims against the running system").

**Decision: stay on `main` and defer everything that needs the library.**

- **Task 3 is deferred, not done.** It edits `lib/db/src/schema/lessonMedia.ts`, the exact file that
  branch rewrites; adding a column now guarantees a hard conflict for no v1 benefit.
- **Task 7 is deferred** with it — it only exists to display what Task 3 attaches.
- **Task 4 covers four sources, not five.** `my-library` is dropped; `ResourceSource` is
  `premade-sheet | activity | curriculum-media | book-qr`.
- **Task 5 renders four sections, not five.** Every one is bundled, so the `loading`/`ready`/
  `unavailable` three-state handling is not needed in v1 — there is no network call behind any section.
- **Task 6 attaches sheets and activities only.** Curated media and book-QR rows offer `open`, because
  `saveLibraryLink` — the call that would give a teacher their own row to attach — is on that branch.

What v1 still delivers: pre-made sheets, the 7 activity/game cards, 19 curated licensed resources and
186 book-QR resources, browsable and filterable, with print for sheets and add-to-class for sheets and
activities. Media attach slots in behind the same `ResourceItem` view-model when the library merges,
with no rework of the tab.

**Count correction: 33 sheets, not 36.** Measured by running the catalog builders: Grade 10 maths has
36 lessons, of which 3 are GeoGebra labs (`order === 0`) that get no sheet. Task 4's assertion is
`>= 33`.

## Global Constraints

- Arabic is the product language; the UI is **RTL-first**. Every new string needs an `ar` + `en` pair in
  `artifacts/mobile/services/i18n.ts`.
- Compute maths in latin `x`; convert to `س` / Arabic digits **only at display time**.
- **`verified` means the verifier confirmed it.** Never set it from a code-computed fallback. Use
  `verificationSource` to record how a key was established.
- **Carry the KB lesson id, never the title.** `searchKBSemantic(title)` returns a *different* lesson for
  16 of 63 picker lessons.
- **Generators branch on the subject NAME** (`isMathContext` tests the string). Anything calling a
  generator must pass the lesson's own subject.
- **Append only** to `MVP_SUBJECT_IDS` / `MVP_GRADE_IDS` (`lib/curriculum/src/catalog.ts:622,660`) —
  inserting shifts persisted picker indices.
- Mobile tests run **only** under `artifacts/mobile/services/__tests__/**` with bare `node --test`, no
  React Native transform. A test file — and anything it imports — must not import `react-native` or
  `expo-*` at module scope.
- `cd artifacts/api-server && pnpm build` **before** `pnpm test`, or the mount-order suite skips.
- Feature branches + PRs; `main` is merge-only. A merge auto-deploys the web app only — **the API is
  deployed by hand** (`docs/deploying.md`).
- **Empty and broken must not look identical.** Media endpoints return `[]` (not an error) when schema or
  R2 is missing (`routes/lessonMedia.ts:170-173,202-205`); any new list UI must distinguish the two.
- Update `STATUS.md` in the same PR that makes any of its claims untrue.

---

## Context

**The reference.** `kinza.mp4` (16s, Arabic/Egyptian caption "مدرسين وأولياء أمور... الموقع ده يستاهل
الحفظ!", posted by *First Learning Academy*) promotes **kiddoworksheets.com**: a browsable grid of
worksheet categories, a nav bar offering a Worksheet Generator alongside pre-made categories, drill-down
to individual sheets each showing view/download counters (152k/114k on letter A), and one big
**DOWNLOAD FREE WORKSHEET** button per sheet.

The thing worth copying is not the content (alphabet tracing is irrelevant to Grade 10 Jordanian
math) — it is the **distribution model**: pre-made, zero-wait, browsable, printable. Nothing is
generated at browse time.

**The gap.** Iqraa has a worksheet *generator* (`artifacts/mobile/app/ai-tools/worksheet.tsx`) but no
pre-made browsable library in front of it. A teacher must know what to ask for, wait for generation, and
accept that two teachers asking for "the same" sheet get different output.

**Intended outcome.** A teacher preparing a lesson opens the resources tab, browses by grade → subject →
lesson, sees ready resources of every kind, and in one tap either adds one to a class or prints it.

## Decisions

| # | Decision | Consequence |
|---|---|---|
| 1 | **Placement: the resources tab.** "All additional resources should be in a resources tab, teacher can select from and add or use" | Extend `app/curriculum/resources.tsx` rather than build a new screen |
| 2 | **Format: pre-generated, printable** | Content frozen offline in a manifest; print renders locally from the frozen JSON |
| 3 | **First batch: Grade 10 math only** — 36 lessons across `kb-math-10-s1` + `kb-math-10-s2` | Chemistry excluded: its question bank is missing and generators branch on subject name |
| 4 | **Scope: everything** — sheets, games, activities, media | Five data sources unified behind one view-model |
| 5 | **Students see everything, answer keys included** | No role gate on the resources screen. **Recorded as a deliberate product call**: any student can read the key to any pre-made sheet, so a sheet added to a class is practice, not assessment. Use an exam (`/take/:code`) when the answer must be hidden. Reversible later by gating the `answerKey` field only — noted in Task 5 |

## What already exists (verified by scan, not assumed)

**There is no "gallery" feature.** `gallery` appears only as `gallery-walk`, one of seven classroom
activity formats (`artifacts/mobile/services/classroomRouting.ts:81-86`).

| Piece | Where |
| --- | --- |
| Resources screen ("the library", book QR links) | `artifacts/mobile/app/curriculum/resources.tsx` (309 L) — has `KIND_ORDER` filter chips, `ResourceRow`, grouping by book |
| 186 book QR resources | `knowledge-base/book-qr-links.json`, typed `QrResource` in `services/bookQrLinks.ts:34-52`, read via `qrResourcesForGrade` |
| 19 curated licensed resources | `lib/curriculum/src/data/external_resources.json`, typed `ExternalResource` in `lib/curriculum/src/external.ts:76-130`, served by `GET /media/external/:id` (`routes/media.ts:201`) |
| Teacher media library | `lesson_media` (`lib/db/src/schema/lessonMedia.ts:42-55`); upload group `r2Key`+`mimeType`+`sizeBytes` **XOR** reference group `sourceUrl` |
| Save a link as a library item | `saveLibraryLink()` (`services/lessonMediaApi.ts:96-111`) → `POST /media/lesson` (`routes/lessonMedia.ts:87-104`) |
| 7 activity/game cards | `ACTIVITY_CARDS` in `services/classroomRouting.ts:33-87` |
| Saved materials | `saved_materials` (`lib/db/src/schema/savedMaterials.ts:7-35`); `type` includes `'worksheet'` and `'activity'`; has `classGroupId` |
| Attach to class | `updateItem(id, { classGroupId })` → `PATCH /api/workspace/items/:id` (`routes/workspace.ts:179-233`, allowlist at `:198-211`) |
| Attach UI | `components/ui/ClassPickerSheet.tsx`, `components/ui/MaterialClassField.tsx` |
| Class detail, 3 tabs | `app/classes/[id].tsx:67` — `type Tab = 'students' \| 'materials' \| 'exams'`, materials tab labelled الموارد |
| Worksheet HTML + print | `buildWorksheetHTML` (`services/exportHtml.ts:446`, `@page { size: A4 portrait; margin: 14mm 12mm; }`) → `exportAsPDF` (`services/share.ts:119-163`): web = sandboxed iframe `print()`, native = `Print.printToFileAsync` + `Sharing.shareAsync` |
| Export hook | `hooks/useGeneratorExport.ts` |
| Worksheet result type | `WorksheetOutput` (`services/ai/AIService.ts:158-198`) |
| Server worksheet generation | `POST /generate/worksheet` (`routes/generate.ts:408-419`) via `worksheetPromptAr/En` (`src/lib/prompts.ts`) + `generateContent` |
| Grade-10 math lessons | 36 (18 + 18), 8 units; `getUnitsForSubjectGrade` → `getLessonsForUnit` (`services/knowledgeBase.ts:3054,3075`) |
| Offline batch precedent | `artifacts/api-server/scripts/provider-eval.ts` (run with `node --experimental-strip-types`) |

## Constraints discovered

1. **No server-side PDF renderer.** `expo-print` is client-side only; the API is JSON-only with zero
   `express.static`. So sheets cannot be pre-rendered to stored `.pdf` files without a new dependency
   (puppeteer). **This plan stores frozen worksheet JSON and renders to PDF locally at print time** via
   the existing tested `buildWorksheetHTML` → `exportAsPDF` path. Teacher experience is identical
   (instant, deterministic, same output every time); diff is far smaller.
2. **`lesson_media` has no class column** — images/videos cannot be attached to a class today. Task 3
   adds one nullable FK, mirroring `saved_materials` and `evaluations`.
3. **Adding a material to a class is filing, not delivery.** Students have no assigned-work screen
   (`services/routeGating.ts:55`). A sheet added to a class appears in the teacher's الموارد tab; the
   student route to it is the resources tab itself (which is why Decision 5 matters).
4. **`evaluation_assignments` is dead** (`lib/db/src/schema/attempts.ts:46-63`, zero readers/writers).
   Not touched by this plan.
5. **`saved_materials` is one-class-per-material** by deliberate choice (`savedMaterials.ts:19-29`).
   Two sections = two rows via `POST /workspace/items/:id/duplicate`.
6. **Production media is degraded.** `lesson_media` is dev-only today; production returns 503/`[]`.
   The manifest-based sheets and the bundled book QR links therefore work in production on day one,
   while the مكتبتي section will legitimately be empty — Constraint "empty ≠ broken" applies.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `lib/curriculum/src/premade.ts` | `PremadeWorksheet` types + accessors (`premadeForLesson`, `premadeForGradeSubject`, `allPremade`). Pure, no deps |
| `lib/curriculum/src/data/premade_worksheets.json` | The generated, git-committed manifest |
| `artifacts/api-server/scripts/build-premade-sheets.ts` | One-time offline batch: generate + verify + write manifest + print review report |
| `artifacts/mobile/services/resourceCatalog.ts` | Unified `ResourceItem` view-model adapting all five sources. Pure — **no `react-native` / `expo-*` imports** |
| `artifacts/mobile/services/__tests__/resourceCatalog.test.ts` | Tests for the above |
| `artifacts/mobile/services/__tests__/premadeSheets.test.ts` | Manifest integrity + `WorksheetOutput` assignability |
| `artifacts/mobile/components/ui/ResourceActions.tsx` | Per-row أضف إلى الصف + استخدام/طباعة buttons |

**Modify**

| File | Change |
|---|---|
| `lib/db/src/schema/lessonMedia.ts:42-55` | Add `classGroupId` column |
| `artifacts/api-server/src/routes/lessonMedia.ts` | Return `classGroupId`; add `PATCH /media/lesson/:id`; accept `?classId=` on `GET /media/lesson` |
| `artifacts/mobile/services/lessonMediaApi.ts` | Mirror the above (`setMediaClass`, `classId` filter) |
| `artifacts/mobile/app/curriculum/resources.tsx` | Sectioned, kind-filtered list over `resourceCatalog` |
| `artifacts/mobile/app/classes/[id].tsx` | Materials tab also lists media attached to the class |
| `artifacts/mobile/services/i18n.ts` | New `ar`/`en` string pairs |
| `lib/curriculum/src/index.ts`, `lib/curriculum/package.json` | Export the `./premade` subpath |
| `STATUS.md` | Record the resources tab, the manifest, and Decision 5 |

---

## Task 0: Reclaim disk space and get an isolated worktree

**Why this is Task 0:** the first attempt to create a worktree failed mid-checkout —
`error: unable to write file …` for hundreds of figure PNGs and book PDFs, ending in
`fatal: Could not reset index file to revision 'HEAD'`. Cause: **the disk has 0.25 GB free of
474 GB used.** Nothing in this plan can run — not `pnpm install`, and probably not
`pnpm build` — until that is fixed. Git rolled the partial checkout back on its own; the leftover
`worktree-resources-tab` branch has already been deleted, so the repo is clean.

**Measured usage** (`Get-ChildItem -Recurse` per path):

| Path | Size | Files |
|---|---|---|
| `.claude/worktrees/` | **13.21 GB** | 552,350 |
| `knowledge-base/` | 3.34 GB | 2,186 |
| `node_modules/` (main worktree) | 0.66 GB | 58,638 |
| `attached_assets/` | 0.22 GB | 78 |
| `artifacts/` | 0.16 GB | 6,024 |

The repo totals ~18 GB, so ~456 GB of the 474 GB used is **outside this project**. This task buys
headroom to work; it does not fix a broadly full disk.

**Current worktree state:** 13 worktrees exist under `.claude/worktrees/`, each with its own
`node_modules` (~1 GB each, mostly that install). The main worktree is on
`feat/islamic-and-s2-figures` — 6 unmerged commits, behind `main`, with uncommitted book-figure work
including **`STATUS.md`**, which Task 8 also edits. All of this plan's work therefore happens in a new
worktree off `main`, never in the main checkout.

**User-approved action: delete `node_modules` inside all 13 worktrees under `.claude/worktrees/`.**

Safe because `node_modules` is gitignored build output, regenerated deterministically from
`pnpm-lock.yaml`; no work is lost and recovery in any worktree is a single `pnpm install`.

**Do not touch:** any source file in any worktree; any branch, commit or uncommitted edit (the
`feat/islamic-and-s2-figures` work included); the **main** worktree's own `node_modules` (so the
in-progress figures task keeps building); `knowledge-base/` and `attached_assets/` (3.5 GB of book
content, irreplaceable without re-extraction).

**Known risk, accepted:** if another Claude session is mid-build in one of those worktrees, its build
breaks until it reinstalls. 13 worktrees exist and several branches were committed today, so this is
plausible; it cannot be determined from here which are live.

- [ ] **Step 1: Record the per-worktree baseline**

```bash
for d in "C:/Users/Lenovo/Downloads/Iqraa/Iqraa/.claude/worktrees"/*/; do
  [ -d "$d/node_modules" ] && echo "has node_modules: $d"
done
```

- [ ] **Step 2: Delete them**

`git worktree remove` is **not** usable here — pnpm's nested `node_modules` exceeds Windows MAX_PATH
(recorded in memory). Use the long-path form, backgrounded, since it is ~550k files:

```powershell
Get-ChildItem 'C:\Users\Lenovo\Downloads\Iqraa\Iqraa\.claude\worktrees' -Directory |
  ForEach-Object {
    $nm = Join-Path $_.FullName 'node_modules'
    if (Test-Path -LiteralPath $nm) {
      Remove-Item -LiteralPath "\\?\$nm" -Recurse -Force -ErrorAction Continue
    }
  }
```

- [ ] **Step 3: Confirm the space came back**

```powershell
Get-PSDrive C | Select-Object @{n='FreeGB';e={[math]::Round($_.Free/1GB,2)}}
```
Expected: several GB free (estimate ~8 GB, extrapolated from the main worktree's 0.66 GB install — not
measured per worktree). **If free space is still under ~3 GB, stop and report** rather than starting an
install that will fail halfway and leave a corrupt store.

- [ ] **Step 4: Create the worktree and install**

```bash
# EnterWorktree name: resources-tab   (branches off main per worktree.baseRef=fresh)
pnpm install
```
Expected: `.claude/worktrees/resources-tab` on a fresh branch off `main`, dependencies installed.

- [ ] **Step 5: Copy the plan in and commit it**

Per the `writing-plans` convention, and so the plan travels with the repo:

```bash
cp <this plan file> docs/superpowers/plans/2026-09-15-resources-tab.md
git add docs/superpowers/plans/2026-09-15-resources-tab.md
git commit -m "docs: plan the resources tab"
```

- [ ] **Step 6: Confirm the toolchain runs before writing any code**

```bash
pnpm run typecheck
```
Expected: clean. A failure here is an environment problem, not a code problem — fix it before Task 1.

---

## Task 1: Pre-made worksheet manifest types and accessors

**Files:**
- Create: `lib/curriculum/src/premade.ts`
- Create: `lib/curriculum/src/data/premade_worksheets.json` (stub: `{"version":1,"sheets":[]}`)
- Modify: `lib/curriculum/src/index.ts`, `lib/curriculum/package.json`
- Test: `lib/curriculum/src/__tests__/premade.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PremadeWorksheet`, `PremadeWorksheetContent`, `KeyVerification`, `PremadeLevel`,
  `allPremade(): PremadeWorksheet[]`, `premadeForLesson(lessonId: string): PremadeWorksheet[]`,
  `premadeForGradeSubject(gradeId: string, subjectId: string): PremadeWorksheet[]`.

`PremadeWorksheetContent` structurally mirrors `WorksheetOutput`
(`artifacts/mobile/services/ai/AIService.ts:158-198`) because `lib/` cannot import from
`artifacts/mobile`. Task 4 adds a compile-time assignability guard so the two cannot drift.

- [ ] **Step 1: Write the failing test**

```ts
// lib/curriculum/src/__tests__/premade.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allPremade, premadeForLesson, premadeForGradeSubject } from '../premade.ts';

test('every sheet has a kbl- lesson id and a known level', () => {
  for (const s of allPremade()) {
    assert.match(s.lessonId, /^kbl-/, `${s.id} lessonId must be a KB id, never a title`);
    assert.ok(['easy', 'medium', 'hard'].includes(s.level), `${s.id} bad level`);
    assert.equal(s.id, `pw-${s.lessonId}-${s.level}`, `${s.id} id must be derivable`);
  }
});

test('sheet ids are unique', () => {
  const ids = allPremade().map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('answer key numbering covers every question exactly once', () => {
  for (const s of allPremade()) {
    const qCount = s.content.sections.reduce((n, sec) => n + sec.questions.length, 0);
    const nums = s.content.answerKey.map(k => k.num).sort((a, b) => a - b);
    assert.deepEqual(nums, Array.from({ length: qCount }, (_, i) => i + 1), `${s.id} key mismatch`);
  }
});

test('verification is recorded per question and never invented', () => {
  for (const s of allPremade()) {
    assert.equal(s.keyVerification.length, s.content.answerKey.length, `${s.id}`);
    for (const v of s.keyVerification) {
      assert.ok(['symbolic', 'none'].includes(v.verificationSource), `${s.id} q${v.num}`);
    }
  }
});

test('accessors filter', () => {
  assert.deepEqual(premadeForLesson('kbl-does-not-exist'), []);
  for (const s of premadeForGradeSubject('grade-10', 'mathematics')) {
    assert.equal(s.gradeId, 'grade-10');
    assert.equal(s.subjectId, 'mathematics');
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/premade.test.ts`
Expected: FAIL — cannot resolve `../premade.ts`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/curriculum/src/premade.ts
/**
 * Pre-made practice sheets — generated once, offline, and committed.
 *
 * Browsing a sheet costs no AI call and no network: the content is frozen in
 * `data/premade_worksheets.json` and bundled. That is deliberate. The media API
 * answers 503 in production today, so a DB-backed library would render empty
 * there, and two teachers opening "the same" sheet must get the same paper.
 *
 * `content` mirrors `WorksheetOutput` (artifacts/mobile/services/ai/AIService.ts)
 * structurally, because lib/ may not import from artifacts/. The mobile test
 * `services/__tests__/premadeSheets.test.ts` holds a compile-time assignability
 * guard so the two shapes cannot drift apart silently.
 */
import raw from './data/premade_worksheets.json' with { type: 'json' };

export type PremadeLevel = 'easy' | 'medium' | 'hard';

/** How a single answer key was established. Never inferred from code. */
export interface KeyVerification {
  num: number;
  verificationSource: 'symbolic' | 'none';
}

export interface PremadeWorksheetQuestion {
  text: string;
  options?: string[];
  answer?: string;
  points: number;
}

export interface PremadeWorksheetSection {
  type: 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem' | 'mixed';
  title: string;
  questions: PremadeWorksheetQuestion[];
}

export interface PremadeWorksheetContent {
  title: string;
  instructions: string;
  sections: PremadeWorksheetSection[];
  answerKey: Array<{ num: number; answer: string }>;
  sources?: Array<{ sourceId: string; titleAr: string; page: number }>;
  variantId?: string;
}

export interface PremadeWorksheet {
  /** `pw-<lessonId>-<level>`. Derivable, so nothing has to store a mapping. */
  id: string;
  /** KB lesson id (`kbl-…`). Ids, never titles. */
  lessonId: string;
  gradeId: string;
  subjectId: string;
  level: PremadeLevel;
  titleAr: string;
  titleEn: string;
  content: PremadeWorksheetContent;
  keyVerification: KeyVerification[];
  /** ISO timestamp of the offline run that produced this sheet. */
  generatedAt: string;
  promptVersion: string;
  model: string;
}

interface PremadeManifest {
  version: number;
  sheets: PremadeWorksheet[];
}

const MANIFEST = raw as PremadeManifest;

export function allPremade(): PremadeWorksheet[] {
  return MANIFEST.sheets;
}

export function premadeForLesson(lessonId: string): PremadeWorksheet[] {
  return MANIFEST.sheets.filter(s => s.lessonId === lessonId);
}

export function premadeForGradeSubject(gradeId: string, subjectId: string): PremadeWorksheet[] {
  return MANIFEST.sheets.filter(s => s.gradeId === gradeId && s.subjectId === subjectId);
}
```

Stub data file:

```json
{ "version": 1, "sheets": [] }
```

Add to `lib/curriculum/package.json` `exports` (do **not** use a star export — the package
deliberately avoids ambiguous star exports):

```json
"./premade": "./src/premade.ts"
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/premade.test.ts`
Expected: PASS (all loops are vacuous over the empty stub — that is correct; Task 2 fills it).

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm run typecheck
git add lib/curriculum/src/premade.ts lib/curriculum/src/data/premade_worksheets.json lib/curriculum/src/__tests__/premade.test.ts lib/curriculum/package.json lib/curriculum/src/index.ts
git commit -m "feat(curriculum): add pre-made worksheet manifest types and accessors"
```

---

## Task 2: Offline batch script that generates and verifies the 36 sheets

**Files:**
- Create: `artifacts/api-server/scripts/build-premade-sheets.ts`
- Modify: `artifacts/api-server/package.json` (add a `premade:build` script)
- Modify: `lib/curriculum/src/data/premade_worksheets.json` (the generated output, committed)

**Interfaces:**
- Consumes: `PremadeWorksheet` from Task 1; `worksheetPromptAr` + `generateContent`
  (`artifacts/api-server/src/lib/prompts.ts`, used by `routes/generate.ts:408-419`); the SymPy
  math-verifier; `getUnitsForSubjectGrade` / `getLessonsForUnit` for lesson enumeration.
- Produces: the populated manifest. No runtime code depends on this script.

Follow the `provider-eval.ts` precedent: a CLI run with `node --experimental-strip-types`, never part
of the server bundle. **One level per lesson (`medium`) for v1** — 36 sheets, 36 generation calls. The
`easy`/`hard` levels are a later run of the same script with `--level`.

- [ ] **Step 1: Write the script**

Requirements it must satisfy, each of which is a Global Constraint:
- Enumerate lessons by **id**, from `getUnitsForSubjectGrade('mathematics', 'grade-10')` then
  `getLessonsForUnit(unitId)`. Skip `order: 0` entries (GeoGebra lab lessons).
- Pass **the lesson's own subject** into the request (`subject: 'الرياضيات'`), never a default.
- Send `lessonId` and `unitId` on the request so grounding pins the right lesson.
- Verify every math answer key through the verifier, and write
  `verificationSource: 'symbolic'` **only** where the verifier confirmed it; `'none'` otherwise. Never
  derive it from a code-computed comparison.
- Print a review report to stdout: per lesson, question count and how many keys verified. Exit non-zero
  if any sheet came back with zero questions or a key-count mismatch — a malformed sheet must not reach
  the manifest.
- Write the manifest **sorted by `id`** so re-runs produce reviewable diffs.
- Be idempotent per lesson: `--only <lessonId>` regenerates one sheet in place.

```bash
# usage
cd artifacts/api-server
node --experimental-strip-types scripts/build-premade-sheets.ts --grade grade-10 --subject mathematics --level medium
node --experimental-strip-types scripts/build-premade-sheets.ts --only kbl-math-s1-nccd-u1_l4
```

- [ ] **Step 2: Dry-run against a single lesson**

Run: `node --experimental-strip-types scripts/build-premade-sheets.ts --only kbl-math-s1-nccd-u1_l4`
Expected: one sheet appended to the manifest; report shows its question count and verified-key count.

- [ ] **Step 3: Run Task 1's tests against the real single-sheet manifest**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/premade.test.ts`
Expected: PASS — the loops are now non-vacuous. If the key-numbering test fails, the generator produced
a mismatched key; fix the script's validation, do not relax the test.

- [ ] **Step 4: Full run, then review the diff by hand**

Run the full command from Step 1. Read the report. **A human reviews the generated manifest before it is
committed** — that review is the quality gate, the same way `external_resources.json` is hand-reviewed.
Any sheet whose keys are mostly `'none'` should be regenerated with `--only` before committing.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/scripts/build-premade-sheets.ts artifacts/api-server/package.json lib/curriculum/src/data/premade_worksheets.json
git commit -m "feat(curriculum): generate 36 pre-made grade-10 maths practice sheets"
```

---

## Task 3: Let a class own a media item

**Files:**
- Modify: `lib/db/src/schema/lessonMedia.ts:42-55`
- Modify: `artifacts/api-server/src/routes/lessonMedia.ts`
- Modify: `artifacts/mobile/services/lessonMediaApi.ts`
- Test: `artifacts/api-server/src/routes/__tests__/lessonMediaClass.test.ts`

**Interfaces:**
- Consumes: `classGroups` (`lib/db/src/schema/students.ts:25-77`).
- Produces: `PATCH /api/media/lesson/:id` accepting `{ classGroupId: string | null }`;
  `GET /api/media/lesson?classId=<id>`; client `setMediaClass(id, classGroupId): Promise<boolean>` and
  a `classId` option on the existing list function in `services/lessonMediaApi.ts` — Task 7 refers to it
  as `listLessonMedia({ classId })`; keep whichever name that module already exports and use it
  consistently. Every returned media row gains `classGroupId`.

Mirror `evaluations`' attach route (`routes/evaluations.ts:338-360`) exactly: `classGroupId === undefined`
→ 400; a non-null id must belong to `req.user!.id` → else 404; `onDelete: "set null"`.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/routes/__tests__/lessonMediaClass.test.ts
// Asserts, against the built bundle like the sibling suites:
//  1. PATCH /media/lesson/:id with a class the caller owns  -> 200, row updated
//  2. PATCH with another teacher's classGroupId             -> 404 "Class not found"
//  3. PATCH with classGroupId omitted                       -> 400
//  4. PATCH with classGroupId: null                          -> 200, detached
//  5. GET /media/lesson?classId=<id>                         -> only that class's rows
//  6. GET when the schema is missing                         -> [] (never 500)
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/api-server && pnpm build && pnpm test
```
Expected: FAIL — no such route.

- [ ] **Step 3: Add the column**

```ts
// lib/db/src/schema/lessonMedia.ts — inside pgTable("lesson_media", { … })
  /**
   * The class this item is filed under, or null for library-only.
   * ponytail: one class per item, same as saved_materials. A photo used with
   * two sections is saved twice. Promote to a join table if teachers ask.
   */
  classGroupId: uuid("class_group_id").references(() => classGroups.id, {
    onDelete: "set null",
  }),
```

- [ ] **Step 4: Add the route and the client mirror, then run the tests**

```bash
cd artifacts/api-server && pnpm build && pnpm test
```
Expected: PASS.

- [ ] **Step 5: Push the schema, then commit**

Per memory: `.env` points at the dev DB, so `run push` silently skips production — push dev with the
script, and apply production through the Neon console. Do **not** `grep` `.env` to check it.

```bash
pnpm --filter @workspace/db run push
git add lib/db/src/schema/lessonMedia.ts artifacts/api-server/src/routes/lessonMedia.ts artifacts/api-server/src/routes/__tests__/lessonMediaClass.test.ts artifacts/mobile/services/lessonMediaApi.ts
git commit -m "feat(media): let a class own a media item"
```

---

## Task 4: Unified resource view-model

**Files:**
- Create: `artifacts/mobile/services/resourceCatalog.ts`
- Test: `artifacts/mobile/services/__tests__/resourceCatalog.test.ts`
- Test: `artifacts/mobile/services/__tests__/premadeSheets.test.ts`

**Interfaces:**
- Consumes: Task 1's accessors; `qrResourcesForGrade` (`services/bookQrLinks.ts`); `ExternalResource`
  (`lib/curriculum/src/external.ts:76-130`); `ACTIVITY_CARDS`
  (`services/classroomRouting.ts:33-87`); `LessonMedia` rows from Task 3.
- Produces:

```ts
export type ResourceSource = 'premade-sheet' | 'activity' | 'curriculum-media' | 'book-qr' | 'my-library';
export type ResourceKind = 'worksheet' | 'game' | 'image' | 'video' | 'audio' | 'document' | 'page' | 'text';
export type ResourceAction = 'add-to-class' | 'print' | 'open' | 'run';

export interface ResourceItem {
  /** Unique across all sources: `<source>:<native id>`. */
  key: string;
  source: ResourceSource;
  kind: ResourceKind;
  titleAr: string;
  titleEn: string;
  /** KB lesson id when the item is lesson-scoped. Ids, never titles. */
  lessonId?: string;
  gradeId?: string;
  subjectId?: string;
  /** Rendered verbatim wherever the item appears, when the licence demands it. */
  attribution?: string;
  /** External target for `open`; absent for items rendered in-app. */
  url?: string;
  actions: ResourceAction[];
}

export function buildResourceCatalog(input: ResourceCatalogInput): ResourceItem[];
export function filterResources(
  items: ResourceItem[],
  f: { kinds?: ResourceKind[]; sources?: ResourceSource[]; lessonId?: string; query?: string },
): ResourceItem[];
export function groupBySource(items: ResourceItem[]): Array<{ source: ResourceSource; items: ResourceItem[] }>;

/** Which writes "add to class" needs for a given source. Implemented in Task 6. */
export type AddToClassStep = 'save-material' | 'attach-material' | 'save-link' | 'attach-media';
export function addToClassPlan(item: ResourceItem): AddToClassStep[];
```

`ResourceCatalogInput` takes already-fetched data (`premade`, `qr`, `external`, `activities`, `myLibrary`)
so this module stays pure and testable under the bare `node --test` runner.

**This file must not import `react-native` or `expo-*` at module scope** — it is loaded by a test.
`ACTIVITY_CARDS` lives in `services/classroomRouting.ts`; if that module imports `expo-*`, pass the
cards in through `ResourceCatalogInput` instead of importing them here, exactly as `routeGating.ts` and
`fetchWithTimeout.ts` were split out for the same reason.

- [ ] **Step 1: Write the failing tests**

```ts
// artifacts/mobile/services/__tests__/resourceCatalog.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResourceCatalog, filterResources, groupBySource } from '../resourceCatalog.ts';

const input = {
  premade: [{
    id: 'pw-kbl-math-s1-nccd-u1_l4-medium', lessonId: 'kbl-math-s1-nccd-u1_l4',
    gradeId: 'grade-10', subjectId: 'mathematics', level: 'medium' as const,
    titleAr: 'ورقة عمل', titleEn: 'Worksheet',
    content: { title: 'ورقة عمل', instructions: '', sections: [], answerKey: [] },
    keyVerification: [], generatedAt: '2026-09-15T00:00:00.000Z', promptVersion: 'v1', model: 'test',
  }],
  qr: [{ kind: 'video' as const, url: 'https://example.com/v', pdfPage: 12, isHttp: true }],
  external: [{
    id: 'voa-le-plastic-oceans', lessonIds: ['kbl-math-s1-nccd-u1_l4'], kind: 'video' as const,
    titleEn: 'Oceans', titleAr: 'المحيطات', attribution: 'VOA Learning English, public domain',
    sourceUrl: 'https://example.com/o',
  }],
  activities: [{ id: 'bingo', titleAr: 'بينغو', titleEn: 'Bingo' }],
  myLibrary: [],
};

test('keys are unique and namespaced by source', () => {
  const items = buildResourceCatalog(input as never);
  const keys = items.map(i => i.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const i of items) assert.ok(i.key.startsWith(`${i.source}:`), i.key);
});

test('a pre-made sheet can be added to a class and printed', () => {
  const sheet = buildResourceCatalog(input as never).find(i => i.source === 'premade-sheet')!;
  assert.equal(sheet.kind, 'worksheet');
  assert.deepEqual([...sheet.actions].sort(), ['add-to-class', 'print']);
});

test('a game is run, not printed', () => {
  const game = buildResourceCatalog(input as never).find(i => i.source === 'activity')!;
  assert.equal(game.kind, 'game');
  assert.ok(game.actions.includes('run'));
  assert.ok(!game.actions.includes('print'));
});

test('licensed media carries its attribution verbatim', () => {
  const media = buildResourceCatalog(input as never).find(i => i.source === 'curriculum-media')!;
  assert.equal(media.attribution, 'VOA Learning English, public domain');
});

test('filtering by kind and by lesson id', () => {
  const items = buildResourceCatalog(input as never);
  for (const i of filterResources(items, { kinds: ['video'] })) assert.equal(i.kind, 'video');
  for (const i of filterResources(items, { lessonId: 'kbl-math-s1-nccd-u1_l4' })) {
    assert.equal(i.lessonId, 'kbl-math-s1-nccd-u1_l4');
  }
  assert.deepEqual(filterResources(items, { lessonId: 'kbl-nope' }), []);
});

test('grouping keeps every item and drops empty sources', () => {
  const items = buildResourceCatalog(input as never);
  const groups = groupBySource(items);
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), items.length);
  assert.ok(!groups.some(g => g.items.length === 0));
});
```

```ts
// artifacts/mobile/services/__tests__/premadeSheets.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allPremade, type PremadeWorksheetContent } from '@workspace/curriculum/premade';
import type { WorksheetOutput } from '../ai/AIService.ts';

/**
 * Compile-time guard: the manifest's frozen content must stay assignable to the
 * live generator output type, or buildWorksheetHTML cannot render a pre-made
 * sheet. lib/ cannot import from artifacts/, so this is where drift is caught.
 */
type _AssignableToWorksheetOutput = PremadeWorksheetContent extends WorksheetOutput ? true : never;
const _guard: _AssignableToWorksheetOutput = true;

test('the assignability guard holds', () => {
  assert.equal(_guard, true);
});

test('grade-10 maths ships a sheet for every non-lab lesson', () => {
  const sheets = allPremade().filter(s => s.gradeId === 'grade-10' && s.subjectId === 'mathematics');
  assert.ok(sheets.length >= 36, `expected >= 36 sheets, got ${sheets.length}`);
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd artifacts/mobile && pnpm test
```
Expected: FAIL — `../resourceCatalog.ts` unresolved.

- [ ] **Step 3: Implement `resourceCatalog.ts`**

Adapter rules, one per source:

| Source | `kind` | `actions` |
|---|---|---|
| `premade-sheet` | `'worksheet'` | `['add-to-class', 'print']` |
| `activity` (the 7 cards) | `'game'` | `['add-to-class', 'run']` |
| `curriculum-media` (`external_resources`) | its `ExternalResourceKind` | `['add-to-class', 'open']` |
| `book-qr` | its `QrResourceKind` | `['open']` — ministry host cannot be embedded, see `services/bookQrLinks.ts` |
| `my-library` (`lesson_media`) | its `LessonMediaKind` | `['add-to-class', 'open']` |

`simulation` from `ExternalResourceKind` is **excluded**: there is no simulation the product may legally
embed (`components/ui/LessonMediaPanel.tsx:17-22` — PhET relicensed CC BY-NC 2026-03-29). The manifest
contains zero today; drop them rather than render a dead row.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd artifacts/mobile && pnpm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/resourceCatalog.ts artifacts/mobile/services/__tests__/resourceCatalog.test.ts artifacts/mobile/services/__tests__/premadeSheets.test.ts
git commit -m "feat(resources): unify five resource sources behind one view-model"
```

---

## Task 5: The resources tab

**Files:**
- Modify: `artifacts/mobile/app/curriculum/resources.tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: Task 4's `buildResourceCatalog` / `filterResources` / `groupBySource`; the existing
  `ResourceRow`, `KIND_LABEL`, `KIND_ICON`, `KIND_ORDER`, `ACCENT` already in this file.
- Produces: rows that render Task 6's `<ResourceActions item={…} />`.

Sections, in order: **الأوراق الجاهزة** (pre-made sheets) → **الأنشطة والألعاب** (activity cards) →
**وسائط المنهج** (curated media) → **موارد الكتاب** (the existing book QR links) → **مكتبتي**
(`lesson_media`).

- [ ] **Step 1: Keep the existing book-QR section working**

Do not restructure `ResourceRow` or the kind chips — extend them. The file's docblock explains why this
route exists and that `/curriculum` is already on the non-teacher allowlist; **update that docblock** to
record Decision 5 verbatim, so the next reader knows answer-key visibility was a decision and not an
oversight, and that gating only the `answerKey` field is the way to reverse it.

- [ ] **Step 2: Add an honest empty state per section**

Per the Global Constraint, `[]` from `GET /media/lesson` is ambiguous. Track three states for the
مكتبتي section — `loading` / `ready` / `unavailable` — and render "لا توجد عناصر بعد" only for `ready`,
"المكتبة غير متاحة حالياً" for `unavailable`. The pre-made, activity and book-QR sections are bundled,
so they are never `unavailable`.

- [ ] **Step 3: Add the lesson filter**

A lesson chip row driven by `filterResources(items, { lessonId })`, defaulting to "كل الدروس". Carry the
KB **id** in state, never the title.

- [ ] **Step 4: Verify on web**

```bash
pnpm run dev:mobile:web
```
Then drive `/curriculum/resources` in the Browser pane: confirm all five sections render, the kind chips
and lesson chips filter, RTL layout is correct at phone width, and attribution text appears on every
licensed media row.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/curriculum/resources.tsx artifacts/mobile/services/i18n.ts
git commit -m "feat(resources): browse sheets, games and media in one tab"
```

---

## Task 6: Add-to-class and use/print actions

**Files:**
- Create: `artifacts/mobile/components/ui/ResourceActions.tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: `ResourceItem` (Task 4); `ClassPickerSheet` (`components/ui/ClassPickerSheet.tsx`);
  `saveItem` / `updateItem` (`services/workspace.ts:119,174`); `saveLibraryLink` / `setMediaClass`
  (`services/lessonMediaApi.ts`, Task 3); `buildWorksheetHTML` (`services/exportHtml.ts:446`);
  `exportAsPDF` (`services/share.ts:119`); `setPendingClassroomActivity` +
  `ACTIVITY_CARDS` routing (`services/classroomRouting.ts`).
- Produces: `<ResourceActions item={ResourceItem} onToast={(msg: string) => void} />`.

Per-source `add-to-class`, all built from calls that already exist:

| Source | What "add to class" does |
|---|---|
| `premade-sheet` | `saveItem({ type: 'worksheet', content: JSON.stringify(sheet.content), … })` → `updateItem(id, { classGroupId })`. Materialises a teacher-owned copy, so later edits don't mutate the shared manifest |
| `activity` | `saveItem({ type: 'activity', content: '{}', formState: { cardId, lessonId } })` → `updateItem(id, { classGroupId })`. **v1 semantic: this files the plan, not a generated deck** — opening it routes to the existing classroom builder pre-filled, which generates on demand. 7 cards × 36 lessons of pre-generated decks is out of scope, and `CLAUDE.md` warns the offline-blueprint and live-prompt paths must move together |
| `curriculum-media`, `book-qr` | `saveLibraryLink({ sourceUrl, kind, caption })` → `setMediaClass(id, classGroupId)`. Reuses the existing link-save path; the licence stays with the manifest entry, and `attribution` is copied into `caption` so it travels with the row |
| `my-library` | `setMediaClass(id, classGroupId)` directly — the row already exists |

`print` renders `buildWorksheetHTML(sheet.content, …)` through `exportAsPDF` — the same tested path the
generator screen uses, so native gets a real PDF and web gets the print dialog. `run` calls
`setPendingClassroomActivity` then routes to `/ai-tools/classroom/presentation`. `open` calls
`openExternal(url)` (already imported by `resources.tsx`).

- [ ] **Step 1: Write the failing test for the action mapping**

Keep the decision logic in a pure helper so it is testable under the bare runner (the component itself
imports `react-native` and therefore cannot be):

```ts
// artifacts/mobile/services/__tests__/resourceCatalog.test.ts — append
import { addToClassPlan } from '../resourceCatalog.ts';

test('add-to-class plan per source', () => {
  assert.deepEqual(addToClassPlan({ source: 'premade-sheet' } as never), ['save-material', 'attach-material']);
  assert.deepEqual(addToClassPlan({ source: 'activity' } as never), ['save-material', 'attach-material']);
  assert.deepEqual(addToClassPlan({ source: 'book-qr' } as never), ['save-link', 'attach-media']);
  assert.deepEqual(addToClassPlan({ source: 'my-library' } as never), ['attach-media']);
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/mobile && pnpm test
```
Expected: FAIL — `addToClassPlan` is not exported.

- [ ] **Step 3: Implement `addToClassPlan` and `ResourceActions.tsx`**

Two guards, both non-negotiable:
- Every step is awaited and checked. `updateItem` returns falsy on failure — surface
  `t('saveToClassFailed')` (the string already exists, used at `app/classes/[id].tsx:271`) rather than
  reporting success for a half-done attach.
- Unauthenticated callers cannot attach. `services/workspace.ts` falls back to AsyncStorage when
  unauthenticated, which would silently file a sheet nowhere; check auth first and offer only `print`
  / `open` to a signed-out or student viewer.

- [ ] **Step 4: Run the tests and typecheck**

```bash
cd artifacts/mobile && pnpm test && cd ../.. && pnpm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/ui/ResourceActions.tsx artifacts/mobile/services/resourceCatalog.ts artifacts/mobile/services/__tests__/resourceCatalog.test.ts artifacts/mobile/services/i18n.ts
git commit -m "feat(resources): add any resource to a class, or print it"
```

---

## Task 7: Show class-attached media in the class

**Files:**
- Modify: `artifacts/mobile/app/classes/[id].tsx` (materials tab, load at `:120-141`)

**Interfaces:**
- Consumes: `listLessonMedia({ classId })` (Task 3); the existing `getItems({ classId: id })`.
- Produces: nothing new.

Without this the media half of Task 6 writes rows nobody can see — the attach would be a no-op from the
teacher's point of view.

- [ ] **Step 1: Load media alongside materials**

Add `listLessonMedia({ classId: id })` to the existing parallel load at `:120-141`.

- [ ] **Step 2: Render a media group inside the materials tab**

Reuse the tab; do not add a fourth one. `type Tab` at `:67` stays unchanged.

- [ ] **Step 3: Wire detach**

`setMediaClass(mediaId, null)`, mirroring `onDetach` at `:339-359`.

- [ ] **Step 4: Verify end to end on web**

Add an image to a class from `/curriculum/resources`, then open `/classes/<id>` → materials and confirm
it appears; detach it and confirm it disappears from the class but survives in مكتبتي.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/classes/[id].tsx
git commit -m "feat(classes): list class-attached media in the materials tab"
```

---

## Task 8: Documentation and status

**Files:**
- Modify: `STATUS.md`
- Modify: `docs/` — add `docs/resources-tab.md`

- [ ] **Step 1: Record in `STATUS.md`** the resources tab, the pre-made manifest (what it covers, how to
  regenerate it, that a human reviews the diff), the new `lesson_media.class_group_id`, and **Decision 5
  with its consequence** — students can read every pre-made answer key, so pre-made sheets are practice,
  not assessment.
- [ ] **Step 2: Write `docs/resources-tab.md`** — how to add a level or a subject to the manifest
  (`build-premade-sheets.ts --level hard`), and the five sources with their attach semantics.
- [ ] **Step 3: Commit**

```bash
git add STATUS.md docs/resources-tab.md
git commit -m "docs: record the resources tab and the pre-made sheet manifest"
```

---

## Verification

Run from the repo root unless stated.

- [ ] `pnpm run typecheck` — whole monorepo, clean.
- [ ] `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/premade.test.ts` — manifest integrity.
- [ ] `cd artifacts/mobile && pnpm test` — `resourceCatalog` + `premadeSheets` suites. Confirm the new
      files actually ran; a mobile test outside `services/__tests__/` never executes.
- [ ] `cd artifacts/api-server && pnpm build && pnpm test` — **build first**, or the mount-order suite
      skips. Confirm `mountOrder.test.ts` still passes: the new `PATCH /media/lesson/:id` must not be
      mounted without a path prefix, or it becomes API-wide middleware.
- [ ] `pnpm run dev:api` + `pnpm run dev:mobile:web`, then in the Browser pane:
  - `/curriculum/resources` — five sections render; kind + lesson chips filter; RTL correct at 400px width.
  - Print a pre-made sheet → A4 portrait, questions and answer key both present, Arabic renders RTL.
  - Add a sheet to a class → appears in `/classes/<id>` materials; `/workspace` shows it with the class label.
  - Add a book-QR video to a class → appears in the class materials media group with its attribution.
  - Run a game from the resources tab → lands in the classroom presenter.
  - Stop the API and reload: مكتبتي must say "unavailable", **not** "no items yet".
- [ ] Signed out (or as a student), confirm `print` / `open` still work and no attach control is offered.

## Out of scope (found in passing, do not fix here)

- **`getTopicSuggestions` returns 4 of 7 suggestions.** `services/knowledgeBase.ts:3097-3114` lists
  `kbl-chem-1-1`, `kbl-chem-3-2`, `kbl-chem-s2-5-1`, none of which exist since the chem catalog moved to
  `kbl-chem-s1-nccd-*` / `kbl-chem-s2-nccd-*`. A `.filter(l => l !== undefined)` swallows it silently.
- **Chemistry sheets** — needs the missing chemistry question bank first, and the subject-name generator
  trap makes a mislabeled paper the likely failure.
- **Real assignment with due dates** — `evaluation_assignments` stays unwritten.
- **Student-facing delivery of materials** — students reach sheets via the resources tab only; there is
  no assigned-work screen and this plan does not add one.
- **`easy` / `hard` levels** — the same script with `--level`, once `medium` is reviewed in production.
