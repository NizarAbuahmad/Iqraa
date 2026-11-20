# Material share link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher sends `https://app.iqrra.com/m/CODE` for a saved material; anyone opens it read-only without answers, a teacher sees the answers and saves a copy.

**Architecture:** Two nullable columns on `saved_materials`; owner routes on the workspace router; a new public `/shared` router whose reads go through one `systemDb` file and reuse `studentCopy`; the app renders `workspace/view.tsx` in a new `shared` mode behind the public route `/m/[code]`.

**Tech Stack:** Express + Drizzle (Postgres), Expo Router / React Native Web, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-20-material-share-link-design.md`

## Global Constraints

- Schema changes are migrations only: edit `lib/db/src/schema`, `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/` (next is 0030). Additive only — no `destructive-migration` ack needed.
- The public read never sends `formState`, the owner's id or name, or an answer field `studentCopy` strips.
- A bad, stopped or unknown code is a 404 with one body.
- Codes: 8 chars from `SHARE_CODE_ALPHABET` (`artifacts/api-server/src/lib/shareCodeAlphabet.ts`).
- Link origin: `PROD_ORIGIN` (`artifacts/mobile/services/siteOrigin.ts`).
- No `sed -i` on source; Arabic copy via the Edit tool. Product name in copy: «إقرأ» / Iqrra.
- Mobile tests only run from `artifacts/mobile/services/__tests__/`.

---

### Task 1: Schema + pure helpers (API)

**Files:**
- Modify: `lib/db/src/schema/savedMaterials.ts` (add `shareCode`, `sharedAt`)
- Create: `lib/db/migrations/0030_*.sql` (generated)
- Create: `artifacts/api-server/src/lib/materialShare.ts`
- Test: `artifacts/api-server/src/lib/__tests__/materialShare.test.ts`

**Interfaces — Produces:**
- `generateMaterialShareCode(): string` — 8 chars of the alphabet.
- `normalizeMaterialShareCode(raw: unknown): string | null` — trims, upper-cases, null unless exactly 8 alphabet chars.
- `copyableFormState(formState: unknown): Record<string, string | number | boolean>` — drops non-primitives, strings over 200 chars, and `FREE_TEXT_KEYS` (`priorTopicsNotes`, `adaptations`, `objectives`, `objective`, `notes`, `additionalContext`).

- [ ] Write `materialShare.test.ts`: code length/alphabet over 200 draws; normalize accepts lower-case and rejects 6-char, `I`/`0`, non-strings; `copyableFormState` keeps `gradeIdx`, `subjectIdx`, `topic`, `lessonId`, `scope` JSON, `isHomework`, drops `priorTopicsNotes`, `adaptations`, `objectives`, a nested object, a 300-char string; returns `{}` for null/array.
- [ ] Run it — fails (module missing).
- [ ] Implement `materialShare.ts` (uses `crypto.randomInt`, like `generateShareCode` in `modules/assessment/studentView.ts`).
- [ ] Run it — passes.
- [ ] Add columns: `shareCode: text("share_code").unique()`, `sharedAt: timestamp("shared_at", { withTimezone: true })`; run `generate`; read the SQL (two `ADD COLUMN`, one unique constraint, nothing else).
- [ ] Commit.

### Task 2: Owner routes + public router (API)

**Files:**
- Modify: `artifacts/api-server/src/routes/workspace.ts` (`POST|DELETE /items/:id/share`, `shareCode` in `toClientItem`)
- Create: `artifacts/api-server/src/lib/sharedMaterial.ts` (`systemDb` reads/copy)
- Create: `artifacts/api-server/src/routes/sharedMaterials.ts` (mounted at `/shared`)
- Modify: `artifacts/api-server/src/routes/index.ts` (mount after the teacher routers, before `studentAttemptRouter`)
- Modify: `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (pin `lib/sharedMaterial.ts`)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (public `/shared/X` → 404 not 401; `/shared/X/full` and `/save` → 401)
- Test: `artifacts/api-server/src/routes/__tests__/sharedMaterial.db.test.ts`

**Interfaces — Consumes:** Task 1. `studentCopy` from `modules/homework/materialCopy.ts`. `isUuid` from `modules/homework/rules.ts`. `createRateLimiter` (as in `routes/studentAttempt.ts`).
**Produces (HTTP):**
- `POST /workspace/items/:id/share` → `200 { shareCode }`; `DELETE` → `200 { ok: true }`; 404 for not-yours / malformed id.
- `GET /shared/:code` → `200 { material: { type, title, subject, grade, topic, language, content, savedAt }, full: false }`.
- `GET /shared/:code/full` (teacher) → same with `full: true`, answers kept.
- `POST /shared/:code/save` (teacher) → `201 { item }` (the caller's new `toClientItem`-shaped row).
- `lib/sharedMaterial.ts`: `loadSharedMaterial(code, { full }): Promise<SharedMaterial | null>`, `copySharedMaterial(code, userId): Promise<SavedMaterialRow | null>`.

- [ ] Write `sharedMaterial.db.test.ts` (pattern: `routes/__tests__/homeworkMaterial.db.test.ts`, `seedFamilyWorld`): idempotent share; stop + re-share gives a new code; public read strips `correctAnswer`/`explanation`, has no `formState`; teacher `/full` keeps them; student `/full` 403; anonymous `/full` 401; save copies with `priorTopicsNotes` gone and `gradeIdx` kept, owned by the caller, no share code; another teacher cannot share/stop → 404; unknown / malformed / stopped / deleted-material codes → 404.
- [ ] `pnpm build` then run it with `TEST_DATABASE_URL` — fails.
- [ ] Implement routes + lib; update `systemDbFiles` and `mountOrder` tests.
- [ ] `pnpm build && pnpm test` (with `TEST_DATABASE_URL`) — all pass.
- [ ] Commit.

### Task 3: App — service, public route, shared view mode

**Files:**
- Create: `artifacts/mobile/services/materialShareLink.ts` (pure: `materialShareUrl(code)`, `shareLinkMessage(title, url)`)
- Create: `artifacts/mobile/services/materialShareApi.ts` (`shareMaterial(id)`, `stopSharingMaterial(id)`, `getSharedMaterial(code, full)`, `saveSharedMaterial(code)`)
- Modify: `artifacts/mobile/services/workspace.ts` (`SavedMaterial.shareCode?: string | null`)
- Modify: `artifacts/mobile/services/routeGating.ts` (`'/m'` in `PUBLIC_ROUTES`)
- Modify: `artifacts/mobile/services/crashReportingCore.ts` (scrub `/m/<code>`)
- Create: `artifacts/mobile/app/m/[code].tsx` (re-exports the view screen)
- Modify: `artifacts/mobile/app/workspace/view.tsx` (`code` param → shared mode; save-copy / sign-up banner; owner's «مُشارَك برابط» + «إيقاف المشاركة»; link share in its export menu)
- Modify: `artifacts/mobile/services/i18n.ts` (ar + en keys)
- Test: `artifacts/mobile/services/__tests__/materialShareLink.test.ts`, routeGating + crash-scrub assertions

**Interfaces — Produces:** `materialShareUrl(code: string): string` → `${PROD_ORIGIN}/m/${code}`; `shareLinkMessage(title, url)`.

- [ ] Tests first (URL uses `PROD_ORIGIN`, message carries title and URL, `/m/ABCD2345` public, `/mx` not, crash scrub replaces the code). Run — fail. Implement. Run — pass.
- [ ] Wire `view.tsx`; typecheck.
- [ ] Commit.

### Task 4: App — share link from the generator screens

**Files:**
- Modify: `artifacts/mobile/hooks/useGeneratorExport.ts` (`handleShareLink` given `ensureSaved: () => Promise<string | null>`)
- Modify: `artifacts/mobile/app/ai-tools/{quiz,worksheet,lesson-plan,activity}.tsx` (pass `ensureSaved` = their `handleSave` returning the id; ExportMenu `onShare` → link)
- Modify: `artifacts/mobile/services/i18n.ts` (`exportShare`/`exportShareSub` → «مشاركة رابط» / «يفتحه زميلك دون إعادة التوليد»)
- Modify: `artifacts/mobile/services/whatsNew.ts` (teacher entry, today)

- [ ] Make each screen's `handleSave` return the saved id (or null); typecheck.
- [ ] Hook: ensureSaved → reject local `ws_` ids with toast `shareLinkNeedsAccount` → `shareMaterial` → `shareAsText(shareLinkMessage(...))` → toast.
- [ ] Mobile `pnpm test`, root `pnpm run typecheck`. Commit.

### Task 5: Verify end to end, docs, PR

- [ ] Run the API + web build locally against the throwaway Postgres; with Playwright: teacher saves a quiz, shares, opens `/m/CODE` signed out (no answers), signed in as a second teacher (answers + save copy).
- [ ] Status-log entry at the top of `docs/status-log.md`.
- [ ] PR (draft → ready per the owner's ask), watch CI, merge, production OTA.
