# Homework project submission — foundation (API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher can mark a homework as needing a submission; each student hands in their own photos and note through the API; the teacher and linked parents can read it; nobody else can.

**Architecture:** Extend `homework` with `requires_submission` and add one RLS-protected table, `homework_submissions` (one row per homework per roster row). Photos go to the private R2 bucket, one per request as a `data:` URL, and are read only through short-lived signed URLs minted after an access check. A new router `routes/homeworkSubmissions.ts` carries the student, parent and teacher paths; the pure rules live in `modules/homework/submission.ts` so `node --test` can load them.

**Tech Stack:** TypeScript, Express, Drizzle + Postgres (RLS, `iqraa_app` role), `@aws-sdk/client-s3` (R2), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-30-homework-project-submission-design.md` (PR #1356). This plan is **phase 1 of 3** (foundation, API only). The student app and the teacher/parent app are separate plans, written once this one has merged and the API shape is real.

## Global Constraints

- **Additive migration only.** No `DROP`, `RENAME`, `SET NOT NULL` or type change, so no `destructive-migration: ok` in the PR body. Migrations only: never `push`, never hand-run DDL. (Numbering: this plan says `0020` throughout, which was the next number when it was written. `main` took `0020` for `email_suppressions` before this merged, so the feature's migration is `0021_blushing_blockbuster.sql`.)
- **A new table must be classified** in `lib/db/src/__tests__/rlsCoverage.test.ts`, and a new table gets **no** grant to `iqraa_app` automatically. `homework_submissions` is `PROTECTED`, not `DEFERRED`.
- **Guards are path-scoped.** Never a bare `router.use(mw)` in a router mounted at the root; `mountOrder.test.ts` asserts it.
- **Every student and parent route** checks `studentAccountsEnabled()` first and answers `403 { code: "student_accounts_disabled" }` when off, like `routes/familyHomework.ts`.
- **A student write never takes a `studentId` from the request.** The roster row is resolved from the account (`ownHomeworkRows`), in the homework's own class.
- **One answer for every failure to resolve:** `404 { error: "Homework not found" }`, so a response cannot be used to probe another class's ids.
- **Extensionless relative imports only work through esbuild.** Anything loaded directly by `node --test` imports with an explicit `.ts` extension, and must not import `@workspace/db`, `@workspace/curriculum` or anything that throws without `DATABASE_URL`.
- **No `sed -i`, no `perl -pi`** on source (UTF-8 with Arabic and `${…}`). Use the Edit tool. A `git diff --stat` line reading `Bin N -> M bytes` for a text file means corruption.
- **Commit with `git add <named paths>`**, never `-A` or `.`, and check `git diff --cached --stat` for files you did not touch.
- **Photo limits:** 1–6 photos per submission, 4 MB decoded each, `image/jpeg`, `image/png`, `image/webp` only. The server refuses HEIC.
- **Note limit:** 2000 characters.
- **Replace/lock rule:** a submitted project can be changed until the due day ends (`homework.due_at`, 23:59:59.999 Asia/Amman); after that it is locked. A student with no submitted row may still submit once after the due day and is shown as `late`. `late` is computed from `submitted_at > due_at`, never stored.
- **Signed read URLs live 600 seconds**, not the one-hour default of `presignedGetUrl`.
- **The Latin product name is `Iqrra`** in any copy; the repo and package names keep `Iqraa`.

## Prerequisites (once)

DB-backed tests need a local Postgres 16 (installed in this image; `pg_ctlcluster 16 main start` on Debian, or follow `LOCAL_SETUP.md`). Throughout:

```bash
export TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres   # api-server DB tests: creates and drops iqraa_test_* databases
```

The `lib/db` RLS suites need one already-migrated throwaway database (never one with real data):

```bash
createdb -h 127.0.0.1 -U postgres iqraa_rls_scratch
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/iqraa_rls_scratch pnpm --filter @workspace/db run migrate -- --from-env
export RLS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/iqraa_rls_scratch
```

Re-run the `migrate` line after Task 3 so the scratch database has the new table. If no Postgres can be started, say so in the PR body and rely on CI for the DB-backed steps; do not claim them green.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/modules/homework/submission.ts` (new) | Pure rules: limits, note and photo parsing, magic-byte check, status, lock, can-submit |
| `artifacts/api-server/src/modules/homework/__tests__/submission.test.ts` (new) | Tests for the above |
| `artifacts/api-server/src/modules/homework/rules.ts` (modify) | `requiresSubmission` in `parseCreate` / `parsePatch` |
| `lib/db/src/schema/homework.ts` (modify) | `requires_submission` column, `homeworkSubmissions` table, `SubmissionPhoto` |
| `lib/db/migrations/0020_*.sql` (+ meta, generated) | Schema, grants, RLS helper and policies |
| `lib/db/src/__tests__/rlsCoverage.test.ts`, `lib/db/src/testing/rlsHarness.ts`, `lib/db/src/__tests__/rlsMatrix.test.ts` (modify) | Classify the table, seed it, assert who sees and writes what |
| `artifacts/api-server/src/lib/r2.ts` (modify) | `newHomeworkSubmissionKey`, `R2_FORCE_PATH_STYLE` |
| `artifacts/api-server/src/test-support/s3Stub.ts` (new) + `__tests__/s3Stub.test.ts` (new) | In-memory S3 over HTTP so DB tests exercise real uploads |
| `artifacts/api-server/src/lib/homeworkDone.ts`, `lib/homeworkGame.ts` (modify) | Expose `requiresSubmission`/`dueAt`; refuse a manual tick and a game tick on a submission homework |
| `artifacts/api-server/src/lib/homeworkSubmission.ts` (new) | Database half: target resolution, photo add/remove, note, submit, teacher/parent reads, purge |
| `artifacts/api-server/src/routes/homeworkSubmissions.ts` (new) | Student, teacher and parent routes |
| `artifacts/api-server/src/routes/homework.ts` (modify) | Create/patch the flag, count `submittedCount`, purge on archive, export `ownedHomework` |
| `artifacts/api-server/src/routes/familyHomework.ts`, `modules/homework/familyHomework.ts`, `lib/familyHomeworkLoad.ts` (modify) | `submission_required` on the tick; family list carries the state |
| `artifacts/api-server/src/routes/index.ts` (modify) | Mount the new router |
| `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (modify) | Pin the one new `systemDb` user with its reason |
| `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts` (new), `mountOrder.test.ts` (modify) | End-to-end tests against a real database and the built bundle |
| `docs/status-log.md` (modify) | Write-up at the TOP |

---

### Task 1: Pure submission rules

**Files:**
- Create: `artifacts/api-server/src/modules/homework/submission.ts`
- Test: `artifacts/api-server/src/modules/homework/__tests__/submission.test.ts`

**Interfaces:**
- Consumes: `parseDataUrl(dataUrl): { mime: string; buffer: Buffer } | null` from `../../lib/lessonMediaUpload.ts` (already exists, pure).
- Produces (used by Tasks 7–10):
  - constants `PHOTOS_MAX = 6`, `NOTE_MAX = 2000`, `PHOTO_BYTES_MAX = 4 * 1024 * 1024`
  - `type SubmissionStatus = "none" | "submitted" | "late"`
  - `type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; code: string }`
  - `parseNote(body: unknown): Parsed<string>`
  - `parsePhotoUpload(body: unknown): Parsed<PhotoUpload>` where `PhotoUpload = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: string; buffer: Buffer }`
  - `sniffImageMime(buf: Buffer): PhotoUpload["mime"] | null`
  - `submissionStatus(i: { submittedAt: Date | null; dueAt: Date }): SubmissionStatus`
  - `isLocked(i: { submittedAt: Date | null; dueAt: Date; now: Date }): boolean`
  - `canSubmit(i: { photoCount: number; note: string }): boolean`

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/modules/homework/__tests__/submission.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOTE_MAX, PHOTO_BYTES_MAX, canSubmit, isLocked, parseNote, parsePhotoUpload, sniffImageMime, submissionStatus,
} from "../submission.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const url = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;

describe("sniffImageMime", () => {
  it("reads the three accepted formats from their first bytes", () => {
    assert.equal(sniffImageMime(JPEG), "image/jpeg");
    assert.equal(sniffImageMime(PNG), "image/png");
    assert.equal(sniffImageMime(WEBP), "image/webp");
  });
  it("refuses anything else, including an empty buffer and a PDF", () => {
    assert.equal(sniffImageMime(Buffer.alloc(0)), null);
    assert.equal(sniffImageMime(Buffer.from("%PDF-1.7")), null);
    assert.equal(sniffImageMime(Buffer.from("RIFF....WAVE")), null);
  });
});

describe("parsePhotoUpload", () => {
  it("accepts each format and gives its extension", () => {
    const j = parsePhotoUpload({ photoDataUrl: url("image/jpeg", JPEG) });
    assert.ok(j.ok);
    assert.equal(j.value.extension, ".jpg");
    assert.equal(j.value.mime, "image/jpeg");
    const p = parsePhotoUpload({ photoDataUrl: url("image/png", PNG) });
    assert.ok(p.ok && p.value.extension === ".png");
    const w = parsePhotoUpload({ photoDataUrl: url("image/webp", WEBP) });
    assert.ok(w.ok && w.value.extension === ".webp");
  });
  it("refuses a missing or non-string field", () => {
    for (const body of [null, {}, { photoDataUrl: "" }, { photoDataUrl: 5 }, "x"]) {
      const r = parsePhotoUpload(body);
      assert.ok(!r.ok);
      assert.equal(r.code, "missing_fields");
    }
  });
  it("refuses text that is not a data URL", () => {
    const r = parsePhotoUpload({ photoDataUrl: "https://example.com/a.jpg" });
    assert.ok(!r.ok);
    assert.equal(r.code, "bad_data_url");
  });
  it("refuses HEIC and other types by name", () => {
    for (const mime of ["image/heic", "image/heif", "application/pdf", "image/gif"]) {
      const r = parsePhotoUpload({ photoDataUrl: url(mime, JPEG) });
      assert.ok(!r.ok, mime);
      assert.equal(r.code, "unsupported_type");
    }
  });
  it("refuses bytes that are not the image they claim to be", () => {
    const r = parsePhotoUpload({ photoDataUrl: url("image/png", JPEG) });
    assert.ok(!r.ok);
    assert.equal(r.code, "bad_image");
    const text = parsePhotoUpload({ photoDataUrl: url("image/jpeg", Buffer.from("not an image at all")) });
    assert.ok(!text.ok && text.code === "bad_image");
  });
  it("refuses a photo over the byte cap", () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(PHOTO_BYTES_MAX)]);
    const r = parsePhotoUpload({ photoDataUrl: url("image/jpeg", big) });
    assert.ok(!r.ok);
    assert.equal(r.code, "file_too_large");
  });
});

describe("parseNote", () => {
  it("trims, and allows an empty note", () => {
    const r = parseNote({ note: "  حل المسألة  " });
    assert.ok(r.ok && r.value === "حل المسألة");
    const empty = parseNote({ note: "" });
    assert.ok(empty.ok && empty.value === "");
  });
  it("refuses a non-string and an over-long note", () => {
    for (const body of [null, {}, { note: 5 }, { note: null }]) {
      const r = parseNote(body);
      assert.ok(!r.ok);
      assert.equal(r.code, "invalid");
    }
    const long = parseNote({ note: "ا".repeat(NOTE_MAX + 1) });
    assert.ok(!long.ok && long.code === "too_long");
    assert.ok(parseNote({ note: "ا".repeat(NOTE_MAX) }).ok);
  });
});

describe("status, lock and can-submit", () => {
  const dueAt = new Date("2026-11-10T20:59:59.999Z");
  const before = new Date("2026-11-10T10:00:00Z");
  const after = new Date("2026-11-11T08:00:00Z");

  it("is none until it is handed in, submitted on time, late after the due day", () => {
    assert.equal(submissionStatus({ submittedAt: null, dueAt }), "none");
    assert.equal(submissionStatus({ submittedAt: before, dueAt }), "submitted");
    assert.equal(submissionStatus({ submittedAt: after, dueAt }), "late");
    // the very last millisecond of the due day is still on time
    assert.equal(submissionStatus({ submittedAt: dueAt, dueAt }), "submitted");
  });
  it("locks a handed-in project once the due day has ended, and never a draft", () => {
    assert.equal(isLocked({ submittedAt: before, dueAt, now: before }), false);
    assert.equal(isLocked({ submittedAt: before, dueAt, now: after }), true);
    assert.equal(isLocked({ submittedAt: null, dueAt, now: after }), false);
  });
  it("needs at least one photo or a non-blank note", () => {
    assert.equal(canSubmit({ photoCount: 0, note: "" }), false);
    assert.equal(canSubmit({ photoCount: 0, note: "   " }), false);
    assert.equal(canSubmit({ photoCount: 1, note: "" }), true);
    assert.equal(canSubmit({ photoCount: 0, note: "ملاحظة" }), true);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/homework/__tests__/submission.test.ts`
Expected: FAIL — `Cannot find module '../submission.ts'`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/api-server/src/modules/homework/submission.ts`:

```ts
/**
 * The rules for a student's project submission that need no database: reading
 * a note and a photo, and deciding what state a submission is in. Pure on
 * purpose, like rules.ts, so `node --test` loads it without `DATABASE_URL`.
 *
 * A photo arrives as a `data:` URL, one per request. The declared type is
 * checked against the first bytes, not trusted: this is a minor's upload that a
 * teacher and a parent will open, and a file that is not the image it says it
 * is must never be stored under an image key.
 */
import { parseDataUrl } from "../../lib/lessonMediaUpload.ts";

export const PHOTOS_MAX = 6;
export const NOTE_MAX = 2000;
/** Decoded bytes per photo. The app downscales first, so a real photo is far below this; it is the server's own backstop. */
export const PHOTO_BYTES_MAX = 4 * 1024 * 1024;
/** Base64 of PHOTO_BYTES_MAX is about 5.6M characters; refuse an absurd body before decoding it. */
const PHOTO_DATA_URL_MAX = 6_000_000;

export type SubmissionStatus = "none" | "submitted" | "late";
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

const EXTENSION = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as const;
type PhotoMime = keyof typeof EXTENSION;

export interface PhotoUpload {
  mime: PhotoMime;
  extension: string;
  buffer: Buffer;
}

function fail(error: string, code: string): { ok: false; error: string; code: string } {
  return { ok: false, error, code };
}

/** The image type the first bytes say it is, or null. */
export function sniffImageMime(buf: Buffer): PhotoMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function parsePhotoUpload(body: unknown): Parsed<PhotoUpload> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>)["photoDataUrl"] : undefined;
  if (typeof raw !== "string" || raw === "") return fail("photoDataUrl is required", "missing_fields");
  if (raw.length > PHOTO_DATA_URL_MAX) return fail("That photo is too large.", "file_too_large");
  const parsed = parseDataUrl(raw);
  if (!parsed) return fail("photoDataUrl must be a data: URL", "bad_data_url");
  if (!(parsed.mime in EXTENSION)) {
    return fail(`Unsupported photo type: ${parsed.mime}. HEIC must be converted on the device.`, "unsupported_type");
  }
  if (parsed.buffer.length > PHOTO_BYTES_MAX) return fail("That photo is too large.", "file_too_large");
  const sniffed = sniffImageMime(parsed.buffer);
  if (sniffed === null || sniffed !== parsed.mime) return fail("The file is not a valid image", "bad_image");
  return { ok: true, value: { mime: sniffed, extension: EXTENSION[sniffed], buffer: parsed.buffer } };
}

export function parseNote(body: unknown): Parsed<string> {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>)["note"] : undefined;
  if (typeof raw !== "string") return fail("note must be text", "invalid");
  const note = raw.trim();
  if (note.length > NOTE_MAX) return fail(`note must be at most ${NOTE_MAX} characters`, "too_long");
  return { ok: true, value: note };
}

/** `late` is computed, never stored: it is `submitted_at` against the due day's last millisecond. */
export function submissionStatus(input: { submittedAt: Date | null; dueAt: Date }): SubmissionStatus {
  if (!input.submittedAt) return "none";
  return input.submittedAt.getTime() > input.dueAt.getTime() ? "late" : "submitted";
}

/** A handed-in project can be replaced until the due day ends. A draft is never locked. */
export function isLocked(input: { submittedAt: Date | null; dueAt: Date; now: Date }): boolean {
  return input.submittedAt !== null && input.now.getTime() > input.dueAt.getTime();
}

export function canSubmit(input: { photoCount: number; note: string }): boolean {
  return input.photoCount > 0 || input.note.trim() !== "";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/homework/__tests__/submission.test.ts`
Expected: PASS, every case green.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/homework/submission.ts artifacts/api-server/src/modules/homework/__tests__/submission.test.ts
git diff --cached --stat
git commit -m "Homework submissions: pure rules for photo, note, status and lock"
```

---

### Task 2: `requiresSubmission` in the teacher's create and patch parsing

**Files:**
- Modify: `artifacts/api-server/src/modules/homework/rules.ts` (`CreateInput`, `PatchInput`, `parseCreate`, `parsePatch`)
- Test: `artifacts/api-server/src/modules/homework/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: existing `parseCreate`, `parsePatch`, `Parsed`.
- Produces: `CreateInput.requiresSubmission: boolean` (default `false`), `PatchInput.requiresSubmission?: boolean`. A non-boolean value is a 400 `requiresSubmission must be true or false`.

- [ ] **Step 1: Write the failing tests**

Append to `rules.test.ts` (keep its existing imports and its `CLASS` and `NOW` constants; `parseCreate` and `parsePatch` are already imported there):

```ts
describe("requiresSubmission", () => {
  const base = { classGroupId: CLASS, title: "مشروع الوحدة", dueDate: "2026-10-20" };

  it("defaults to false on create and accepts true and false", () => {
    const none = parseCreate(base, NOW);
    assert.ok(none.ok);
    assert.equal(none.value.requiresSubmission, false);
    const on = parseCreate({ ...base, requiresSubmission: true }, NOW);
    assert.ok(on.ok && on.value.requiresSubmission === true);
    const off = parseCreate({ ...base, requiresSubmission: false }, NOW);
    assert.ok(off.ok && off.value.requiresSubmission === false);
  });
  it("refuses anything that is not a boolean, on create and on patch", () => {
    for (const bad of ["true", 1, null, {}]) {
      const c = parseCreate({ ...base, requiresSubmission: bad }, NOW);
      assert.ok(!c.ok, `create ${String(bad)}`);
      assert.equal(c.error, "requiresSubmission must be true or false");
      const p = parsePatch({ requiresSubmission: bad }, NOW);
      assert.ok(!p.ok, `patch ${String(bad)}`);
      assert.equal(p.error, "requiresSubmission must be true or false");
    }
  });
  it("patches the flag alone, and leaves it out when not sent", () => {
    const on = parsePatch({ requiresSubmission: true }, NOW);
    assert.ok(on.ok);
    assert.equal(on.value.requiresSubmission, true);
    const title = parsePatch({ title: "عنوان جديد" }, NOW);
    assert.ok(title.ok);
    assert.equal("requiresSubmission" in title.value, false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/homework/__tests__/rules.test.ts`
Expected: FAIL — `value.requiresSubmission` is `undefined` and the bad values are accepted.

- [ ] **Step 3: Implement**

In `rules.ts`, add the field to the two interfaces:

```ts
export interface CreateInput {
  classGroupId: string;
  title: string;
  instructions: string;
  dueAt: Date;
  evaluationId: string | null;
  /** Raw items, each checked by the route (parseClassResourceInput needs @workspace/curriculum). */
  resources: unknown[];
  /** Students hand in a project (photos and a note) instead of just ticking it off. */
  requiresSubmission: boolean;
}
export interface PatchInput {
  title?: string;
  instructions?: string;
  dueAt?: Date;
  evaluationId?: string | null;
  resources?: unknown[];
  requiresSubmission?: boolean;
}
```

Add a parser next to `parseResources`:

```ts
function parseRequiresSubmission(v: unknown): Parsed<boolean> {
  return typeof v === "boolean" ? { ok: true, value: v } : { ok: false, error: "requiresSubmission must be true or false" };
}
```

In `parseCreate`, after the `resources` check and before the `return`:

```ts
  const requiresSubmission = b["requiresSubmission"] === undefined ? ({ ok: true, value: false } as const) : parseRequiresSubmission(b["requiresSubmission"]);
  if (!requiresSubmission.ok) return requiresSubmission;
```

and add `requiresSubmission: requiresSubmission.value,` to the returned `value`.

In `parsePatch`, after the `resources` branch and before the "Nothing to change" check:

```ts
  if (b["requiresSubmission"] !== undefined) {
    const r = parseRequiresSubmission(b["requiresSubmission"]);
    if (!r.ok) return r;
    out.requiresSubmission = r.value;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/homework/__tests__/rules.test.ts`
Expected: PASS, including every existing case in the file.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/homework/rules.ts artifacts/api-server/src/modules/homework/__tests__/rules.test.ts
git diff --cached --stat
git commit -m "Homework: parse requiresSubmission on create and patch"
```

---

### Task 3: Schema, migration and row-level security

**Files:**
- Modify: `lib/db/src/schema/homework.ts`
- Create (generated, then edited): `lib/db/migrations/0020_*.sql` and its `meta/` snapshot
- Modify: `lib/db/src/__tests__/rlsCoverage.test.ts`

**Interfaces:**
- Produces: `homework.requiresSubmission: boolean`; `homeworkSubmissions` table; types `SubmissionPhoto` and `HomeworkSubmission`; SQL function `app_teaches_homework(uuid)`; policies `homework_submissions_select|insert|update`. **No delete policy**: the only deleter is `systemDb` in Task 9.

- [ ] **Step 1: Edit the schema**

In `lib/db/src/schema/homework.ts`:

1. Change the file header's `No uploads and no grading` sentence to: `No grading. A homework may also ask for a submission (photos and a note, see homework_submissions below); otherwise a student marks it done, a parent reads it, the teacher sees a count.`
2. Add `boolean` to the `drizzle-orm/pg-core` import.
3. In the `homework` table, after the `resources` column add:

```ts
    /**
     * Students hand in a project (photos and a note) rather than ticking it off.
     * When true the tick is set only by submitting (lib/homeworkSubmission.ts) —
     * `PUT/DELETE /student/homework/:id/done` answer 409 `submission_required`.
     */
    requiresSubmission: boolean("requires_submission").notNull().default(false),
```

4. After `homeworkCompletions`, add:

```ts
/** One stored photo of a project. `key` is the private-bucket object key; it is never sent to a client. */
export interface SubmissionPhoto {
  id: string;
  key: string;
  mime: string;
  sizeBytes: number;
}

/**
 * A student's project for one homework. One row per (homework, roster row), like
 * a completion: a roster row is a name a teacher wrote down, not an account, and
 * the account that is self-linked to it is the only one that may write here.
 *
 * `submitted_at` null is a DRAFT — photos uploaded, not handed in. Only the
 * author sees a draft. The first hand-in time is kept when the student replaces
 * their work before the due day, so improving a project never makes it late;
 * `late` is computed from it against `homework.due_at` and is not a column.
 *
 * Row-level security protects this table (policies in the migration that
 * created it): it holds a minor's work.
 */
export const homeworkSubmissions = pgTable(
  "homework_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    photos: jsonb("photos").$type<SubmissionPhoto[]>().notNull().default([]),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("homework_submissions_unique").on(t.homeworkId, t.studentId),
    index("homework_submissions_student_idx").on(t.studentId),
  ],
);
```

5. In the type exports near the bottom add: `export type HomeworkSubmission = typeof homeworkSubmissions.$inferSelect;`

`lib/db/src/schema/index.ts` already has `export * from "./homework";`, so nothing to add there.

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @workspace/db run generate`
Expected: a new `lib/db/migrations/0020_<name>.sql` containing `ALTER TABLE "homework" ADD COLUMN "requires_submission" boolean DEFAULT false NOT NULL;` and `CREATE TABLE "homework_submissions" …`, plus a snapshot in `meta/`. Open the file and confirm there is **no** `DROP`, `RENAME` or `SET NOT NULL` on an existing column. (Adding a `NOT NULL` column with a default is fine and is metadata-only on Postgres 11+.)

- [ ] **Step 3: Append the grants, helper and policies to the generated file**

`drizzle-kit` does not track roles, functions or policies, so append by hand to the end of `0020_*.sql`, as `0017_yummy_miek.sql` did. If the generated file does not end with `--> statement-breakpoint`, add one on the line before the first line below:

```sql
--> statement-breakpoint
ALTER TABLE "homework_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homework_submissions" TO iqraa_app;--> statement-breakpoint
-- The teacher of a homework. SECURITY DEFINER like the other helpers (0008): `homework` is not
-- itself protected, but the helper keeps this policy independent of whatever later protects it.
CREATE OR REPLACE FUNCTION app_teaches_homework(hid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM homework WHERE id = hid AND teacher_id = app_uid()) $$;--> statement-breakpoint
-- The author (the account self-linked to the roster row) reads everything of theirs, draft or not.
-- Anyone else — the student's teacher, the homework's teacher, a guardian — sees only a handed-in row.
CREATE POLICY "homework_submissions_select" ON "homework_submissions" FOR SELECT TO iqraa_app
  USING (app_is_student_self(student_id)
         OR (submitted_at IS NOT NULL AND (app_linked_to_student(student_id) OR app_teaches_homework(homework_id))));--> statement-breakpoint
-- Only the author writes. A guardian link grants read, never write; a teacher cannot write a student's work.
-- No DELETE policy: removing the rows of an archived homework is systemDb's job (lib/homeworkSubmission.ts).
CREATE POLICY "homework_submissions_insert" ON "homework_submissions" FOR INSERT TO iqraa_app
  WITH CHECK (app_is_student_self(student_id));--> statement-breakpoint
CREATE POLICY "homework_submissions_update" ON "homework_submissions" FOR UPDATE TO iqraa_app
  USING (app_is_student_self(student_id))
  WITH CHECK (app_is_student_self(student_id));
```

- [ ] **Step 4: Classify the table**

In `lib/db/src/__tests__/rlsCoverage.test.ts`, add `"homework_submissions"` to the `PROTECTED` array (after `"grading_jobs"`). It is not in `DEFERRED`.

- [ ] **Step 5: Apply the migrations and run the coverage suite**

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/iqraa_rls_scratch pnpm --filter @workspace/db run migrate -- --from-env
cd lib/db && RLS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/iqraa_rls_scratch node --experimental-strip-types --test --test-concurrency=1 src/__tests__/rlsCoverage.test.ts
```
Expected: the migration applies cleanly; all `rlsCoverage` tests PASS (the table is on exactly one list, has RLS on, has a policy, and the app role has all four privileges).

- [ ] **Step 6: Typecheck**

Run: `pnpm run typecheck`
Expected: no errors. (Nothing else reads the new column yet, so this should be quiet.)

- [ ] **Step 7: Commit**

```bash
git add lib/db/src/schema/homework.ts lib/db/migrations lib/db/src/__tests__/rlsCoverage.test.ts
git diff --cached --stat
git commit -m "Homework submissions: table, requires_submission column and RLS policies"
```

---

### Task 4: Prove the policies with the RLS matrix

**Files:**
- Modify: `lib/db/src/testing/rlsHarness.ts` (seed)
- Modify: `lib/db/src/__tests__/rlsMatrix.test.ts` (cases)

**Interfaces:**
- Produces fixture ids: `hwA` (homework by `teacherA` for `classA`), `hwA2` (a second one), `subA` (studentA's handed-in submission to `hwA`), `subDraftA` (studentA's draft on `hwA2`). Roles in the fixture: `teacherA` owns studentA and the homework; `teacherB` is unrelated; `parentA` is studentA's guardian; `studentUser` is studentA's `self` account; `studentUser2` only has a *pending* claim (no link); `parentB` is unrelated.

- [ ] **Step 1: Seed the rows**

In `rlsHarness.ts`, add `hwA: id("hwA"), hwA2: id("hwA2"), subA: id("subA"), subDraftA: id("subDraftA"),` to the `ids` object, and after the `class_memberships` insert add:

```ts
  await q(`INSERT INTO homework (id, teacher_id, class_group_id, title, due_at, requires_submission)
           VALUES ($1,$2,$3,'hw-a', now() + interval '3 days', true), ($4,$2,$3,'hw-a2', now() + interval '3 days', true)`,
    [ids.hwA, ids.teacherA, ids.classA, ids.hwA2]);
  await q(`INSERT INTO homework_submissions (id, homework_id, student_id, note, submitted_at) VALUES ($1,$2,$3,'done', now())`,
    [ids.subA, ids.hwA, ids.studentA]);
  await q(`INSERT INTO homework_submissions (id, homework_id, student_id, note) VALUES ($1,$2,$3,'unfinished')`,
    [ids.subDraftA, ids.hwA2, ids.studentA]);
```

Cleanup already deletes the users, which cascades teachers → homework → submissions and students.

- [ ] **Step 2: Write the failing tests**

Append inside the `describe` block of `rlsMatrix.test.ts` (it already defines `as`, `col`, `scoped`, `ids`):

```ts
  test("homework submissions: the author sees a draft, the teacher and a guardian only see a handed-in row", async () => {
    const all = async () => col(`SELECT id FROM homework_submissions WHERE id = ANY($1) ORDER BY id`, [[ids.subA, ids.subDraftA]]);
    const sorted = (a: string[]) => [...a].sort();
    await as("studentUser", "student", async () => assert.deepEqual(await all(), sorted([ids.subA!, ids.subDraftA!])));
    await as("teacherA", "teacher", async () => assert.deepEqual(await all(), [ids.subA]));
    await as("parentA", "parent", async () => assert.deepEqual(await all(), [ids.subA]));
  });

  test("homework submissions: an unrelated teacher, parent and a student with only a pending claim see nothing", async () => {
    for (const [key, role] of [["teacherB", "teacher"], ["parentB", "parent"], ["studentUser2", "student"]] as const) {
      await as(key, role, async () => {
        assert.deepEqual(await col(`SELECT id FROM homework_submissions WHERE id = ANY($1)`, [[ids.subA, ids.subDraftA]]), [], key);
      });
    }
  });

  test("homework submissions: nobody sees any without an identity", async () => {
    assert.deepEqual(await col(`SELECT id FROM homework_submissions WHERE id = ANY($1)`, [[ids.subA, ids.subDraftA]]), []);
  });

  test("homework submissions: only the author writes", async () => {
    await as("studentUser", "student", async () => {
      assert.equal((await scoped.query(`UPDATE homework_submissions SET note = 'edited' WHERE id = $1`, [ids.subDraftA])).rowCount, 1);
    });
    for (const [key, role] of [["parentA", "parent"], ["teacherA", "teacher"], ["teacherB", "teacher"]] as const) {
      await as(key, role, async () => {
        assert.equal((await scoped.query(`UPDATE homework_submissions SET note = 'hax' WHERE id = $1`, [ids.subA])).rowCount, 0, `${key} update`);
        assert.equal((await scoped.query(`DELETE FROM homework_submissions WHERE id = $1`, [ids.subA])).rowCount, 0, `${key} delete`);
      });
    }
    // The author cannot delete it either: removal is systemDb's job.
    await as("studentUser", "student", async () => {
      assert.equal((await scoped.query(`DELETE FROM homework_submissions WHERE id = $1`, [ids.subA])).rowCount, 0);
    });
  });

  test("homework submissions: a guardian and a teacher cannot create one for the child", async () => {
    for (const [key, role] of [["parentA", "parent"], ["teacherA", "teacher"], ["studentUser2", "student"]] as const) {
      await as(key, role, async () => {
        await assert.rejects(
          scoped.query(`INSERT INTO homework_submissions (homework_id, student_id) VALUES ($1, $2)`, [ids.hwA, ids.studentA]),
          /row-level security|violates|duplicate/,
          key,
        );
      });
    }
  });

  test("homework submissions: the author may create their own, and only for their own roster row", async () => {
    await as("studentUser", "student", async () => {
      // studentB is not theirs
      await assert.rejects(
        scoped.query(`INSERT INTO homework_submissions (homework_id, student_id) VALUES ($1, $2)`, [ids.hwA2, ids.studentB]),
        /row-level security/,
      );
    });
  });
```

The duplicate-key alternative in the third test's regex is deliberate: for the pair `(hwA, studentA)` that already has a row, Postgres may report either the policy or the unique key first; both mean "refused".

- [ ] **Step 3: Run and confirm**

Run: `cd lib/db && RLS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/iqraa_rls_scratch node --experimental-strip-types --test --test-concurrency=1 src/__tests__/rlsMatrix.test.ts`
Expected: the new cases PASS together with the existing ones. (The policies already exist from Task 3; this task is the proof, so it is written against them. To see a case fail for the right reason, temporarily change `app_is_student_self(student_id)` to `true` in the select policy of a scratch copy and watch "an unrelated teacher … sees nothing" fail. Do not commit that.)

- [ ] **Step 4: Run the whole `lib/db` suite**

Run: `cd lib/db && RLS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/iqraa_rls_scratch pnpm test`
Expected: PASS, including `rlsCoverage`, `rlsDiff` and `rlsDiffPort`. If `rlsDiff` fails because its fixture lists every table's rows, read the failure first; the new table is only read by routes added in later tasks, so `rlsDiff` should not change here.

- [ ] **Step 5: Commit**

```bash
git add lib/db/src/testing/rlsHarness.ts lib/db/src/__tests__/rlsMatrix.test.ts
git diff --cached --stat
git commit -m "Homework submissions: RLS matrix cases for author, teacher, guardian and strangers"
```

---

### Task 5: R2 plumbing and an in-memory S3 for tests

**Files:**
- Modify: `artifacts/api-server/src/lib/r2.ts`
- Create: `artifacts/api-server/src/test-support/s3Stub.ts`
- Test: `artifacts/api-server/src/test-support/__tests__/s3Stub.test.ts`

**Interfaces:**
- Produces: `newHomeworkSubmissionKey(homeworkId: string, studentId: string, extension: string): string` → `homework-submissions/<homeworkId>/<studentId>/<uuid><extension>`; env `R2_FORCE_PATH_STYLE=true` makes the S3 client use `http://host/bucket/key` (the stub has no wildcard DNS); `startS3Stub(bucket?: string): Promise<S3Stub>`; `s3Env(stub: S3Stub): Record<string, string>` for `startServer({ env })`.
- `S3Stub = { endpoint: string; keys(): string[]; body(key: string): Buffer | undefined; close(): Promise<void> }`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/test-support/__tests__/s3Stub.test.ts`:

```ts
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { s3Env, startS3Stub, type S3Stub } from "../s3Stub.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);

describe("the S3 stub, driven by the real r2.ts", () => {
  let stub: S3Stub;
  let r2: typeof import("../../lib/r2.ts");

  before(async () => {
    stub = await startS3Stub();
    // r2.ts caches its client on first use, so the env must be in place before the first call.
    Object.assign(process.env, s3Env(stub));
    r2 = await import("../../lib/r2.ts");
  });
  after(async () => {
    await stub.close();
  });

  it("builds an unguessable key under the homework-submissions prefix", () => {
    const key = r2.newHomeworkSubmissionKey("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", ".png");
    assert.match(
      key,
      /^homework-submissions\/11111111-1111-4111-8111-111111111111\/22222222-2222-4222-8222-222222222222\/[0-9a-f-]{36}\.png$/,
    );
    assert.notEqual(key, r2.newHomeworkSubmissionKey("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", ".png"));
  });

  it("stores exactly the bytes it was given, signs a readable URL, and deletes", async () => {
    assert.equal(r2.isR2Configured(), true);
    await r2.putObject("homework-submissions/t/s/a.png", PNG, "image/png");
    assert.deepEqual(stub.keys(), ["homework-submissions/t/s/a.png"]);
    assert.ok(stub.body("homework-submissions/t/s/a.png")!.equals(PNG), "stored bytes must equal the upload");

    const url = await r2.presignedGetUrl("homework-submissions/t/s/a.png", 600);
    assert.ok(url, "a signed URL");
    assert.match(url!, /X-Amz-Expires=600/);
    const res = await fetch(url!);
    assert.equal(res.status, 200);
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(PNG));

    await r2.deleteObject("homework-submissions/t/s/a.png");
    assert.deepEqual(stub.keys(), []);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/test-support/__tests__/s3Stub.test.ts`
Expected: FAIL — `Cannot find module '../s3Stub.ts'`.

- [ ] **Step 3: Add the key helper and the path-style switch**

In `lib/r2.ts`, change the client construction to:

```ts
  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // Real R2 uses virtual-hosted style. The DB tests point R2_ENDPOINT at a local stub that has
    // no wildcard DNS, so they set this; production never does.
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE === "true",
  });
```

and add next to `newAttemptAudioKey`:

```ts
/**
 * A student's project photo. A prefix of its own, with the homework and the roster row in the
 * path: this is a minor's work, so "delete everything for this homework" or "for this child" is
 * a prefix operation rather than a query someone has to get right. The filename is never the
 * caller's, and the UUID makes the key unguessable even if the bucket's public toggle is left on.
 */
export function newHomeworkSubmissionKey(homeworkId: string, studentId: string, extension: string): string {
  return `homework-submissions/${homeworkId}/${studentId}/${randomUUID()}${extension}`;
}
```

- [ ] **Step 4: Write the stub**

Create `artifacts/api-server/src/test-support/s3Stub.ts`:

```ts
/**
 * A stand-in for the private R2 bucket, running in the test process. The built server (a child
 * process — startServer.ts) is pointed at it with R2_ENDPOINT, so a DB test can upload a photo
 * through the real route, read back the very bytes that were stored, and — as importantly —
 * assert which keys exist and which do not.
 *
 * Path-style only (`/<bucket>/<key>`); the server is told so by R2_FORCE_PATH_STYLE. Signatures
 * are not checked: the point is what the API stores and deletes, not AWS's auth.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface S3Stub {
  /** e.g. http://127.0.0.1:41234 */
  endpoint: string;
  keys(): string[];
  body(key: string): Buffer | undefined;
  close(): Promise<void>;
}

/** The SDK may send a PUT body as `aws-chunked`: `<hex size>;chunk-signature=…\r\n<data>\r\n … 0\r\n`. Store only the data. */
function decodeAwsChunked(buf: Buffer): Buffer {
  const parts: Buffer[] = [];
  let pos = 0;
  for (;;) {
    const lineEnd = buf.indexOf("\r\n", pos);
    if (lineEnd < 0) break;
    const size = parseInt(buf.toString("ascii", pos, lineEnd).split(";")[0]!, 16);
    if (!Number.isFinite(size) || size === 0) break;
    parts.push(buf.subarray(lineEnd + 2, lineEnd + 2 + size));
    pos = lineEnd + 2 + size + 2;
  }
  return Buffer.concat(parts);
}

export async function startS3Stub(bucket = "iqraa-media"): Promise<S3Stub> {
  const objects = new Map<string, Buffer>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    const prefix = `/${bucket}/`;
    if (!url.pathname.startsWith(prefix)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    const chunks: Buffer[] = [];
    req.on("data", c => chunks.push(c as Buffer));
    req.on("end", () => {
      if (req.method === "PUT") {
        let body = Buffer.concat(chunks);
        const encoding = String(req.headers["content-encoding"] ?? "");
        const sha = String(req.headers["x-amz-content-sha256"] ?? "");
        if (encoding.includes("aws-chunked") || sha.startsWith("STREAMING")) body = decodeAwsChunked(body);
        objects.set(key, body);
        res.statusCode = 200;
        res.setHeader("ETag", '"stub"');
        res.end();
      } else if (req.method === "GET") {
        const body = objects.get(key);
        if (!body) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/xml");
          res.end("<Error><Code>NoSuchKey</Code></Error>");
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Length", String(body.length));
        res.end(body);
      } else if (req.method === "DELETE") {
        objects.delete(key);
        res.statusCode = 204;
        res.end();
      } else {
        res.statusCode = 405;
        res.end();
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    keys: () => [...objects.keys()].sort(),
    body: key => objects.get(key),
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

/** The env a server needs to talk to the stub — pass as `startServer({ env })`. */
export function s3Env(stub: S3Stub): Record<string, string> {
  return {
    R2_ENDPOINT: stub.endpoint,
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_FORCE_PATH_STYLE: "true",
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/test-support/__tests__/s3Stub.test.ts`
Expected: PASS. If "stored bytes must equal the upload" fails, the SDK sent a framing the stub did not strip: print `req.headers` in the PUT branch, then extend `decodeAwsChunked`'s trigger. Do not weaken the assertion and do not change `r2.ts` to avoid it.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/lib/r2.ts artifacts/api-server/src/test-support/s3Stub.ts artifacts/api-server/src/test-support/__tests__/s3Stub.test.ts
git diff --cached --stat
git commit -m "R2: submission key helper, path-style switch and an in-memory S3 for tests"
```

---

### Task 6: The flag reaches the teacher's routes, and a submission homework cannot be ticked by hand

**Files:**
- Modify: `artifacts/api-server/src/routes/homework.ts` (insert, patch, `TeacherHomework`, `withCounts`)
- Modify: `artifacts/api-server/src/lib/homeworkDone.ts`, `artifacts/api-server/src/lib/homeworkGame.ts`, `artifacts/api-server/src/routes/familyHomework.ts`
- Test: `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts` (created here, extended in later tasks)

**Interfaces:**
- Consumes: `CreateInput.requiresSubmission`, `PatchInput.requiresSubmission` (Task 2), `homework.requiresSubmission` and `homeworkSubmissions` (Task 3).
- Produces:
  - `TeacherHomework.requiresSubmission: boolean` and `TeacherHomework.submittedCount: number` (handed-in rows for live class members only).
  - `OwnHomeworkRows` gains `requiresSubmission: boolean` and `dueAt: Date`.
  - `setHomeworkDone(...)` now returns `"ok" | "not_found" | "submission_required"`. Both tick directions refuse on a submission homework.
  - `recordGameResult` still records the game but no longer ticks a submission homework.

- [ ] **Step 1: Create the DB test file with its helpers and the first failing cases**

Create `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts`:

```ts
/**
 * What this guards: a teacher can ask for a project, and the ways that goes wrong are all about
 * WHOSE project it is — a student reaching another student's work, a parent or an unrelated
 * teacher reading a draft, a locked project being replaced, a photo that is not an image being
 * stored — and about the tick: a homework that wants a project must not be done by tapping.
 * Every case runs against real rows in a real database, and uploads go through the real route
 * to an in-memory S3 (test-support/s3Stub.ts).
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { s3Env, startS3Stub, type S3Stub } from "../../test-support/s3Stub.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 9, 9]);
const photoBody = (mime: string, bytes: Buffer) => ({ photoDataUrl: `data:${mime};base64,${bytes.toString("base64")}` });
const RANDOM_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";

async function call(server: TestServer, method: string, path: string, userId?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (userId) headers["Authorization"] = `Bearer ${accessToken(userId)}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${server.base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text, json: (text ? JSON.parse(text) : null) as any };
}

/** The Amman calendar day `days` from now. */
const ammanDay = (days: number) => new Date(Date.now() + 3 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

describeDb("homework project submissions over HTTP, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let s3: S3Stub;
  let w: FamilyWorld;
  /** A second student account in the same class (c1), so "another student" is a real account. */
  let sibling: { user: string; row: string };
  /** t1 / c1, due in 5 days, wants a project. */
  let hwOpen: string;
  /** t1 / c1, due yesterday, wants a project — the due day has ended. */
  let hwClosed: string;
  /** t1 / c1, due in 5 days, an ordinary tick-off homework. */
  let hwPlain: string;

  const insertHomework = async (title: string, dueOffset: string, requires: boolean) =>
    (
      await db.pool.query(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission)
         VALUES ($1, $2, $3, now() + $4::interval, $5) RETURNING id`,
        [w.users.t1, w.classes.c1, title, dueOffset, requires],
      )
    ).rows[0].id as string;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    s3 = await startS3Stub();
    server = await startServer({ databaseUrl: db.url, env: s3Env(s3) });

    const user = (await db.pool.query(
      `INSERT INTO users (first_name, last_name, role) VALUES ('Layla', 'C', 'student') RETURNING id`,
    )).rows[0].id as string;
    const row = (await db.pool.query(
      `INSERT INTO students (teacher_id, display_name) VALUES ($1, 'ليلى') RETURNING id`,
      [w.users.t1],
    )).rows[0].id as string;
    await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, row]);
    await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [row, user]);
    sibling = { user, row };

    hwOpen = await insertHomework("project-open", "5 days", true);
    hwClosed = await insertHomework("project-closed", "-1 day", true);
    hwPlain = await insertHomework("plain", "5 days", false);
  });
  after(async () => {
    await server?.stop();
    await s3?.close();
    await db?.drop();
  });

  describe("the teacher's flag and the tick", () => {
    it("creates a homework that needs a project, and says so in the list", async () => {
      const created = await call(server, "POST", "/homework", w.users.t1, {
        classGroupId: w.classes.c1,
        title: "مشروع الوحدة الثالثة",
        dueDate: ammanDay(10),
        requiresSubmission: true,
      });
      assert.equal(created.status, 201, created.text);
      assert.equal(created.json.homework.requiresSubmission, true);
      assert.equal(created.json.homework.submittedCount, 0);

      const plain = await call(server, "POST", "/homework", w.users.t1, {
        classGroupId: w.classes.c1,
        title: "واجب عادي",
        dueDate: ammanDay(10),
      });
      assert.equal(plain.json.homework.requiresSubmission, false);
    });

    it("patches the flag, and refuses a value that is not a boolean", async () => {
      const on = await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: true });
      assert.equal(on.status, 200, on.text);
      assert.equal(on.json.homework.requiresSubmission, true);
      const off = await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: false });
      assert.equal(off.json.homework.requiresSubmission, false);
      const bad = await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: "yes" });
      assert.equal(bad.status, 400);
    });

    it("does not let a homework that wants a project be ticked off by hand, in either direction", async () => {
      const tick = await call(server, "PUT", `/student/homework/${hwOpen}/done`, w.users.studentA);
      assert.equal(tick.status, 409, tick.text);
      assert.equal(tick.json.code, "submission_required");
      const untick = await call(server, "DELETE", `/student/homework/${hwOpen}/done`, w.users.studentA);
      assert.equal(untick.status, 409);
      const done = await db.pool.query(`SELECT 1 FROM homework_completions WHERE homework_id = $1`, [hwOpen]);
      assert.equal(done.rowCount, 0, "nothing was ticked");
    });

    it("still ticks an ordinary homework", async () => {
      await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: false });
      const tick = await call(server, "PUT", `/student/homework/${hwPlain}/done`, w.users.studentA);
      assert.equal(tick.status, 200, tick.text);
    });
  });
});
```

(`describeDb` here is the file's one top-level suite; later tasks add further `describe` blocks **inside** it, after this one.)

- [ ] **Step 2: Build and run to verify it fails**

```bash
cd artifacts/api-server && pnpm build
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts
```
Expected: FAIL — `requiresSubmission` is `undefined` in the create response, the PATCH answers 400 `Nothing to change` (the route does not persist the flag), and the tick returns 200.

- [ ] **Step 3: Persist and report the flag in `routes/homework.ts`**

1. Add `homeworkSubmissions` to the `@workspace/db` import list and `isNotNull` to the `drizzle-orm` import.
2. Add to `interface TeacherHomework`:

```ts
  /** Students hand in a project instead of ticking it off. */
  requiresSubmission: boolean;
  /** Of studentCount, the live roster rows that have handed a project in. Drafts are not counted. */
  submittedCount: number;
```

3. In `POST /homework`, add `requiresSubmission: input.requiresSubmission,` to the `.values({ … })` object.
4. In `PATCH /homework/:id`, add `...(patch.requiresSubmission !== undefined && { requiresSubmission: patch.requiresSubmission }),` to the `.set({ … })` object (next to `resources`).
5. In `withCounts`, add a fourth query to the `Promise.all` and destructure it as `submitted`:

```ts
    db
      .select({ homeworkId: homeworkSubmissions.homeworkId, n: count() })
      .from(homeworkSubmissions)
      .innerJoin(homework, eq(homework.id, homeworkSubmissions.homeworkId))
      .innerJoin(
        classMemberships,
        and(
          eq(classMemberships.classGroupId, homework.classGroupId),
          eq(classMemberships.studentId, homeworkSubmissions.studentId),
        ),
      )
      .innerJoin(students, eq(students.id, homeworkSubmissions.studentId))
      .where(
        and(
          inArray(homeworkSubmissions.homeworkId, homeworkIds),
          isNotNull(homeworkSubmissions.submittedAt),
          isNull(students.archivedAt),
        ),
      )
      .groupBy(homeworkSubmissions.homeworkId),
```

   then below `const done = …` add `const submittedBy = new Map(submitted.map(c => [c.homeworkId, Number(c.n)]));` and in the returned object add `requiresSubmission: r.requiresSubmission,` and `submittedCount: submittedBy.get(r.id) ?? 0,`.

- [ ] **Step 4: Refuse the tick**

In `lib/homeworkDone.ts`:

- Add to `interface OwnHomeworkRows`: `requiresSubmission: boolean;` and `dueAt: Date;`
- In `ownHomeworkRows`, change the target select to `.select({ classGroupId: homework.classGroupId, resources: homework.resources, requiresSubmission: homework.requiresSubmission, dueAt: homework.dueAt })` and the return to `return { rows, resources: target.resources, requiresSubmission: target.requiresSubmission, dueAt: target.dueAt };`
- Change `setHomeworkDone`:

```ts
/**
 * A homework that asks for a project is done by handing the project in, and by nothing else —
 * lib/homeworkSubmission.ts ticks it. Tapping "done" (or taking the tick back) on such a
 * homework is refused so the tick and the submission can never disagree.
 */
export async function setHomeworkDone(
  userId: string,
  homeworkId: string,
  done: boolean,
): Promise<"ok" | "not_found" | "submission_required"> {
  const own = await ownHomeworkRows(userId, homeworkId);
  if (!own) return "not_found";
  if (own.requiresSubmission) return "submission_required";
  // …the existing `if (done) { … } else { … }` and `return "ok"` stay as they are
```

In `lib/homeworkGame.ts`, replace `await tickRows(homeworkId, own.rows);` with:

```ts
  // A homework that asks for a project is done by submitting it, not by playing a game.
  if (!own.requiresSubmission) await tickRows(homeworkId, own.rows);
```

In `routes/familyHomework.ts`, inside `mark`, after the `not_found` branch add:

```ts
    if (result === "submission_required") {
      res.status(409).json({ error: "This homework is done by handing in the project", code: "submission_required" });
      return;
    }
```

- [ ] **Step 5: Rebuild and run**

```bash
cd artifacts/api-server && pnpm build
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts src/routes/__tests__/homework.db.test.ts src/routes/__tests__/familyHomework.db.test.ts
```
Expected: PASS, and the two existing homework suites stay green (they are the check that the tick and the counts still behave for ordinary homework).

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm run typecheck
git add artifacts/api-server/src/routes/homework.ts artifacts/api-server/src/lib/homeworkDone.ts artifacts/api-server/src/lib/homeworkGame.ts artifacts/api-server/src/routes/familyHomework.ts artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts
git diff --cached --stat
git commit -m "Homework: persist requiresSubmission, count handed-in projects, refuse a manual tick"
```

---

### Task 7: The database half — one student's submission

**Files:**
- Create: `artifacts/api-server/src/lib/homeworkSubmission.ts`

**Interfaces:**
- Consumes: `ownHomeworkRows`, `tickRows` (`lib/homeworkDone.ts`), pure rules (Task 1), `presignedGetUrl` (`lib/r2.ts`).
- Produces (used by Tasks 8–10):

```ts
export interface SubmissionTarget { homeworkId: string; studentId: string; rows: string[]; dueAt: Date }
export interface SubmissionPhotoView { id: string; url: string | null; mime: string; sizeBytes: number }
export interface SubmissionView {
  status: SubmissionStatus;          // "none" while a draft
  locked: boolean;
  note: string;
  photos: SubmissionPhotoView[];
  submittedAt: string | null;        // ISO
}
export async function submissionTarget(userId: string, homeworkId: string): Promise<SubmissionTarget | null>
export async function readOwnSubmission(t: SubmissionTarget): Promise<HomeworkSubmission | null>
export async function viewSubmission(row: HomeworkSubmission | null, dueAt: Date, now?: Date): Promise<SubmissionView>
export async function addPhoto(t: SubmissionTarget, photo: SubmissionPhoto, now?: Date): Promise<"ok" | "locked" | "photo_limit">
export async function removePhoto(t: SubmissionTarget, photoId: string, now?: Date): Promise<{ key: string } | "locked" | "empty" | "not_found">
export async function setNote(t: SubmissionTarget, note: string, now?: Date): Promise<"ok" | "locked" | "empty">
export async function submit(t: SubmissionTarget, now?: Date): Promise<"ok" | "empty" | "locked">
```

This task has no test of its own: every function is exercised through the routes in Task 8, against a real database, and a mocked-database unit test here would only restate the queries. The pure parts it depends on are already covered by Task 1.

- [ ] **Step 1: Write the module**

Create `artifacts/api-server/src/lib/homeworkSubmission.ts`:

```ts
/**
 * The database half of a student's project submission.
 *
 * WHOSE row it is comes from the account, never from the request: `submissionTarget` resolves the
 * roster row the way the tick does (`ownHomeworkRows` — the account's self-linked rows that sit in
 * the homework's own class), and every function below takes that target. Nothing here accepts a
 * `studentId` from a client. Every way to fail to resolve is `null`, so a caller answers one 404.
 *
 * The photo list is changed with single SQL statements (append with a count guard, remove by
 * filtering), not read-modify-write, so two uploads sent at once cannot lose a photo or pass the
 * cap of six together.
 */
import { db, homeworkSubmissions, type HomeworkSubmission, type SubmissionPhoto } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { presignedGetUrl } from "./r2.ts";
import { ownHomeworkRows, tickRows } from "./homeworkDone.ts";
import {
  PHOTOS_MAX,
  canSubmit,
  isLocked,
  submissionStatus,
  type SubmissionStatus,
} from "../modules/homework/submission.ts";

export interface SubmissionTarget {
  homeworkId: string;
  /** The roster row the submission is stored on: the one that already holds it, else the first (sorted) own row. */
  studentId: string;
  /** Every own roster row in the homework's class — all of them are ticked on a hand-in. */
  rows: string[];
  dueAt: Date;
}

export interface SubmissionPhotoView {
  id: string;
  /** A signed URL valid for ten minutes; null when storage is not configured or signing failed. */
  url: string | null;
  mime: string;
  sizeBytes: number;
}

export interface SubmissionView {
  /** `none` while it is still a draft. */
  status: SubmissionStatus;
  locked: boolean;
  note: string;
  photos: SubmissionPhotoView[];
  submittedAt: string | null;
}

/** Ten minutes: long enough to open a photo, short enough that a copied link dies quickly. */
export const SIGNED_URL_SECONDS = 600;

export async function submissionTarget(userId: string, homeworkId: string): Promise<SubmissionTarget | null> {
  const own = await ownHomeworkRows(userId, homeworkId);
  if (!own || !own.requiresSubmission) return null;
  const [held] = await db
    .select({ studentId: homeworkSubmissions.studentId })
    .from(homeworkSubmissions)
    .where(and(eq(homeworkSubmissions.homeworkId, homeworkId), inArray(homeworkSubmissions.studentId, own.rows)))
    .limit(1);
  return { homeworkId, studentId: held?.studentId ?? own.rows[0]!, rows: own.rows, dueAt: own.dueAt };
}

export async function readOwnSubmission(t: SubmissionTarget): Promise<HomeworkSubmission | null> {
  const [row] = await db
    .select()
    .from(homeworkSubmissions)
    .where(and(eq(homeworkSubmissions.homeworkId, t.homeworkId), eq(homeworkSubmissions.studentId, t.studentId)))
    .limit(1);
  return row ?? null;
}

export async function signPhotos(photos: readonly SubmissionPhoto[]): Promise<SubmissionPhotoView[]> {
  return Promise.all(
    photos.map(async p => ({
      id: p.id,
      url: await presignedGetUrl(p.key, SIGNED_URL_SECONDS),
      mime: p.mime,
      sizeBytes: p.sizeBytes,
    })),
  );
}

/** A row (or none) as a client sees it. The object key is never in it. */
export async function viewSubmission(
  row: HomeworkSubmission | null,
  dueAt: Date,
  now: Date = new Date(),
): Promise<SubmissionView> {
  if (!row) return { status: "none", locked: false, note: "", photos: [], submittedAt: null };
  return {
    status: submissionStatus({ submittedAt: row.submittedAt, dueAt }),
    locked: isLocked({ submittedAt: row.submittedAt, dueAt, now }),
    note: row.note,
    photos: await signPhotos(row.photos),
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
}

async function ensureRow(t: SubmissionTarget): Promise<void> {
  await db
    .insert(homeworkSubmissions)
    .values({ homeworkId: t.homeworkId, studentId: t.studentId })
    .onConflictDoNothing();
}

export async function addPhoto(
  t: SubmissionTarget,
  photo: SubmissionPhoto,
  now: Date = new Date(),
): Promise<"ok" | "locked" | "photo_limit"> {
  const existing = await readOwnSubmission(t);
  if (existing && isLocked({ submittedAt: existing.submittedAt, dueAt: t.dueAt, now })) return "locked";
  await ensureRow(t);
  const updated = await db
    .update(homeworkSubmissions)
    .set({ photos: sql`${homeworkSubmissions.photos} || ${JSON.stringify([photo])}::jsonb`, updatedAt: now })
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, t.homeworkId),
        eq(homeworkSubmissions.studentId, t.studentId),
        sql`jsonb_array_length(${homeworkSubmissions.photos}) < ${PHOTOS_MAX}`,
      ),
    )
    .returning({ id: homeworkSubmissions.id });
  return updated.length > 0 ? "ok" : "photo_limit";
}

export async function removePhoto(
  t: SubmissionTarget,
  photoId: string,
  now: Date = new Date(),
): Promise<{ key: string } | "locked" | "empty" | "not_found"> {
  const row = await readOwnSubmission(t);
  const photo = row?.photos.find(p => p.id === photoId);
  if (!row || !photo) return "not_found";
  if (isLocked({ submittedAt: row.submittedAt, dueAt: t.dueAt, now })) return "locked";
  // A handed-in project may not be emptied by removing its last photo: it would stay "submitted" with nothing in it.
  if (row.submittedAt && !canSubmit({ photoCount: row.photos.length - 1, note: row.note })) return "empty";
  await db
    .update(homeworkSubmissions)
    .set({
      photos: sql`coalesce((SELECT jsonb_agg(p) FROM jsonb_array_elements(${homeworkSubmissions.photos}) p WHERE p->>'id' <> ${photoId}), '[]'::jsonb)`,
      updatedAt: now,
    })
    .where(eq(homeworkSubmissions.id, row.id));
  return { key: photo.key };
}

export async function setNote(
  t: SubmissionTarget,
  note: string,
  now: Date = new Date(),
): Promise<"ok" | "locked" | "empty"> {
  const existing = await readOwnSubmission(t);
  if (existing && isLocked({ submittedAt: existing.submittedAt, dueAt: t.dueAt, now })) return "locked";
  if (existing?.submittedAt && !canSubmit({ photoCount: existing.photos.length, note })) return "empty";
  await ensureRow(t);
  await db
    .update(homeworkSubmissions)
    .set({ note, updatedAt: now })
    .where(and(eq(homeworkSubmissions.homeworkId, t.homeworkId), eq(homeworkSubmissions.studentId, t.studentId)));
  return "ok";
}

/**
 * Hands the project in. `submitted_at` keeps the FIRST hand-in time (`coalesce`), so replacing a
 * project before the due day never makes it late. The tick is written before this returns — the
 * route answers afterwards (Cloud Run throttles work after `res.json`).
 */
export async function submit(t: SubmissionTarget, now: Date = new Date()): Promise<"ok" | "empty" | "locked"> {
  const row = await readOwnSubmission(t);
  if (row && isLocked({ submittedAt: row.submittedAt, dueAt: t.dueAt, now })) return "locked";
  if (!row || !canSubmit({ photoCount: row.photos.length, note: row.note })) return "empty";
  await db
    .update(homeworkSubmissions)
    .set({ submittedAt: sql`coalesce(${homeworkSubmissions.submittedAt}, now())`, updatedAt: now })
    .where(eq(homeworkSubmissions.id, row.id));
  await tickRows(t.homeworkId, t.rows);
  return "ok";
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: no errors. If `SubmissionPhoto` or `HomeworkSubmission` are not found, confirm `export * from "./homework"` in `lib/db/src/schema/index.ts` and that `@workspace/db` re-exports `./schema` (it does for `Homework`, so the same path applies).

- [ ] **Step 3: Commit**

```bash
git add artifacts/api-server/src/lib/homeworkSubmission.ts
git diff --cached --stat
git commit -m "Homework submissions: the student's database half"
```

---

### Task 8: Student routes

**Files:**
- Create: `artifacts/api-server/src/routes/homeworkSubmissions.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (mount)
- Test: `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts` (new `describe` block inside the file's suite)

**Interfaces:**
- Consumes: Task 7's functions, Task 1's parsers, `newHomeworkSubmissionKey`, `putObject`, `deleteObject`, `isR2Configured` (`lib/r2.ts`), `createRateLimiter` (`lib/rateLimit.ts`).
- Produces routes (all answer 403 `student_accounts_disabled` when the flag is off, and 404 `{ error: "Homework not found" }` for every failure to resolve):
  - `GET /student/homework/:id/submission` → `200 { submission: SubmissionView, dueDate }` (a student with nothing yet gets `status: "none"`, not a 404)
  - `POST /student/homework/:id/submission/photos` body `{ photoDataUrl }` → `201 { photo: SubmissionPhotoView, photoCount }`; `409 { code: "locked" | "photo_limit" }`; `400/413 { code }` from `parsePhotoUpload`; `503 { code: "storage_unavailable" }`
  - `DELETE /student/homework/:id/submission/photos/:photoId` → `200 { removed: true }`; `404`; `409 { code: "locked" | "empty" }`
  - `PUT /student/homework/:id/submission` body `{ note }` → `200 { submission }`; `400 { code }`; `409 { code: "locked" | "empty" }`
  - `POST /student/homework/:id/submission/submit` → `200 { submission }`; `409 { code: "empty" | "locked" }`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block inside the file's top-level `describeDb(...)`, after the first block:

```ts
  describe("the student's own submission", () => {
    const photosOf = async (homeworkId: string, rowId: string) =>
      (await db.pool.query(`SELECT photos, submitted_at, note FROM homework_submissions WHERE homework_id = $1 AND student_id = $2`, [homeworkId, rowId])).rows[0];

    it("starts with nothing, and a stranger's homework id is one 404", async () => {
      const mine = await call(server, "GET", `/student/homework/${hwOpen}/submission`, w.users.studentA);
      assert.equal(mine.status, 200, mine.text);
      assert.equal(mine.json.submission.status, "none");
      assert.deepEqual(mine.json.submission.photos, []);

      // not a submission homework, a random id, another class's homework, and a parent's token
      for (const [id, user] of [
        [hwPlain, w.users.studentA], [RANDOM_UUID, w.users.studentA], ["not-a-uuid", w.users.studentA],
        [hwOpen, w.users.studentB], [hwOpen, w.users.studentUnlinked],
      ] as const) {
        const r = await call(server, "GET", `/student/homework/${id}/submission`, user);
        assert.equal(r.status, 404, `${id} as ${user}: ${r.text}`);
      }
      const asParent = await call(server, "GET", `/student/homework/${hwOpen}/submission`, w.users.parentA);
      assert.equal(asParent.status, 403, "a parent token is not a student");
      const anon = await call(server, "GET", `/student/homework/${hwOpen}/submission`);
      assert.equal(anon.status, 401);
    });

    it("stores a photo under the homework and roster-row prefix, and hands back a URL for the same bytes", async () => {
      const up = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(up.status, 201, up.text);
      assert.equal(up.json.photoCount, 1);
      assert.equal("key" in up.json.photo, false, "the object key is never sent to a client");

      const keys = s3.keys().filter(k => k.startsWith(`homework-submissions/${hwOpen}/${w.students.sA1}/`));
      assert.equal(keys.length, 1);
      assert.ok(s3.body(keys[0]!)!.equals(JPEG), "the stored bytes are the uploaded bytes");

      const url = up.json.photo.url as string;
      assert.match(url, /X-Amz-Expires=600/);
      const fetched = await fetch(url);
      assert.ok(Buffer.from(await fetched.arrayBuffer()).equals(JPEG));
    });

    it("refuses what is not an image, and stores nothing for it", async () => {
      const before = s3.keys().length;
      const cases: Array<[unknown, number, string]> = [
        [{}, 400, "missing_fields"],
        [{ photoDataUrl: "https://example.com/a.jpg" }, 400, "bad_data_url"],
        [photoBody("image/heic", JPEG), 400, "unsupported_type"],
        [photoBody("image/png", JPEG), 400, "bad_image"],
        [photoBody("image/jpeg", Buffer.from("this is not an image")), 400, "bad_image"],
      ];
      for (const [body, status, code] of cases) {
        const r = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, body);
        assert.equal(r.status, status, r.text);
        assert.equal(r.json.code, code);
      }
      assert.equal(s3.keys().length, before, "nothing was stored");
    });

    it("keeps one project per student: a classmate's upload lands on their own row", async () => {
      const mine = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, sibling.user, photoBody("image/png", PNG));
      assert.equal(mine.status, 201, mine.text);
      const a = await photosOf(hwOpen, w.students.sA1);
      const b = await photosOf(hwOpen, sibling.row);
      assert.equal(a.photos.length, 1, "studentA's project did not gain a photo");
      assert.equal(b.photos.length, 1);
      assert.notEqual(a.photos[0].key, b.photos[0].key);
    });

    it("caps a project at six photos, and removes the object when it refuses", async () => {
      for (let i = 0; i < 5; i++) {
        const r = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
        assert.equal(r.status, 201, r.text);
      }
      const keysBefore = s3.keys().length;
      const seventh = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(seventh.status, 409);
      assert.equal(seventh.json.code, "photo_limit");
      assert.equal(s3.keys().length, keysBefore, "the refused photo was not left in the bucket");
    });

    it("removes a photo from the row and from the bucket; a classmate cannot remove it", async () => {
      const row = await photosOf(hwOpen, w.students.sA1);
      const victim = row.photos[0] as { id: string; key: string };
      const theirs = await call(server, "DELETE", `/student/homework/${hwOpen}/submission/photos/${victim.id}`, sibling.user);
      assert.equal(theirs.status, 404, "the photo id is not on the classmate's own submission");
      assert.ok(s3.body(victim.key), "still stored");

      const mine = await call(server, "DELETE", `/student/homework/${hwOpen}/submission/photos/${victim.id}`, w.users.studentA);
      assert.equal(mine.status, 200, mine.text);
      assert.equal(s3.body(victim.key), undefined, "gone from the bucket");
      assert.equal((await photosOf(hwOpen, w.students.sA1)).photos.length, 5);
    });

    it("refuses to hand in an empty project, then hands it in, ticks it, and is not late", async () => {
      // the classmate has a photo; use a fresh homework for an empty draft
      const fresh = await insertHomework("project-empty", "5 days", true);
      const empty = await call(server, "POST", `/student/homework/${fresh}/submission/submit`, w.users.studentA);
      assert.equal(empty.status, 409);
      assert.equal(empty.json.code, "empty");

      const note = await call(server, "PUT", `/student/homework/${fresh}/submission`, w.users.studentA, { note: "  عملت المشروع  " });
      assert.equal(note.status, 200, note.text);
      assert.equal(note.json.submission.note, "عملت المشروع");
      assert.equal((await call(server, "PUT", `/student/homework/${fresh}/submission`, w.users.studentA, { note: "ا".repeat(2001) })).status, 400);

      const done = await call(server, "POST", `/student/homework/${fresh}/submission/submit`, w.users.studentA);
      assert.equal(done.status, 200, done.text);
      assert.equal(done.json.submission.status, "submitted");
      const ticked = await db.pool.query(`SELECT 1 FROM homework_completions WHERE homework_id = $1 AND student_id = $2`, [fresh, w.students.sA1]);
      assert.equal(ticked.rowCount, 1, "handing in ticks the homework");
    });

    it("keeps the FIRST hand-in time when the student replaces their work before the due day", async () => {
      const first = await call(server, "POST", `/student/homework/${hwOpen}/submission/submit`, w.users.studentA);
      assert.equal(first.status, 200, first.text);
      const t1 = (await photosOf(hwOpen, w.students.sA1)).submitted_at as Date;
      await new Promise(r => setTimeout(r, 30));
      const edit = await call(server, "PUT", `/student/homework/${hwOpen}/submission`, w.users.studentA, { note: "نسخة محسّنة" });
      assert.equal(edit.status, 200, edit.text);
      const again = await call(server, "POST", `/student/homework/${hwOpen}/submission/submit`, w.users.studentA);
      assert.equal(again.status, 200);
      assert.equal(((await photosOf(hwOpen, w.students.sA1)).submitted_at as Date).getTime(), t1.getTime());
    });

    it("will not empty a handed-in project by removing its last photo and note", async () => {
      const fresh = await insertHomework("project-one-photo", "5 days", true);
      const up = await call(server, "POST", `/student/homework/${fresh}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      await call(server, "POST", `/student/homework/${fresh}/submission/submit`, w.users.studentA);
      const del = await call(server, "DELETE", `/student/homework/${fresh}/submission/photos/${up.json.photo.id}`, w.users.studentA);
      assert.equal(del.status, 409);
      assert.equal(del.json.code, "empty");
    });

    it("locks a handed-in project once the due day has ended, but takes a first hand-in as late", async () => {
      // A project handed in on time, then the clock passes the due day.
      const handedIn = await insertHomework("project-was-on-time", "5 days", true);
      await call(server, "POST", `/student/homework/${handedIn}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      await call(server, "POST", `/student/homework/${handedIn}/submission/submit`, w.users.studentA);
      await db.pool.query(`UPDATE homework SET due_at = now() - interval '1 hour' WHERE id = $1`, [handedIn]);
      const edit = await call(server, "PUT", `/student/homework/${handedIn}/submission`, w.users.studentA, { note: "متأخر" });
      assert.equal(edit.status, 409);
      assert.equal(edit.json.code, "locked");
      const photo = await call(server, "POST", `/student/homework/${handedIn}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(photo.status, 409);
      assert.equal(photo.json.code, "locked");
      assert.equal((await call(server, "GET", `/student/homework/${handedIn}/submission`, w.users.studentA)).json.submission.locked, true);

      // hwClosed was due yesterday and nobody handed anything in: one late hand-in is accepted.
      const up = await call(server, "POST", `/student/homework/${hwClosed}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(up.status, 201, up.text);
      const late = await call(server, "POST", `/student/homework/${hwClosed}/submission/submit`, w.users.studentA);
      assert.equal(late.status, 200, late.text);
      assert.equal(late.json.submission.status, "late");
      assert.equal(late.json.submission.locked, true, "a late hand-in is final");
    });

    it("answers 503 storage_unavailable when R2 is not configured", async () => {
      const bare = await startServer({ databaseUrl: db.url });
      try {
        const r = await call(bare, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
        assert.equal(r.status, 503);
        assert.equal(r.json.code, "storage_unavailable");
      } finally {
        await bare.stop();
      }
    });

    it("is closed while student accounts are off", async () => {
      const off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined, ...s3Env(s3) } });
      try {
        const r = await call(off, "GET", `/student/homework/${hwOpen}/submission`, w.users.studentA);
        assert.equal(r.status, 403);
        assert.equal(r.json.code, "student_accounts_disabled");
      } finally {
        await off.stop();
      }
    });
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd artifacts/api-server && pnpm build
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts
```
Expected: the first block still passes; every case of the new block FAILS with 404 (no such route).

- [ ] **Step 3: Write the router**

Create `artifacts/api-server/src/routes/homeworkSubmissions.ts`:

```ts
/**
 * A student's project for a homework that asks for one — the student's side. (The teacher's and
 * the parent's reads are in this file too, added below.)
 *
 * Guards are path-scoped and repeat the ones in familyHomework.ts on purpose, so moving a mount
 * cannot quietly open a route: see mountOrder.test.ts. No bare `router.use(mw)`.
 *
 * Every failure to resolve — a missing homework, one that does not ask for a project, another
 * class's, an account with no roster row in the class — is the same 404. No `studentId` is ever
 * read from a request: the row comes from the account (lib/homeworkSubmission.ts).
 */
import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { createRateLimiter } from "../lib/rateLimit.ts";
import { deleteObject, isR2Configured, newHomeworkSubmissionKey, putObject } from "../lib/r2.js";
import {
  addPhoto,
  readOwnSubmission,
  removePhoto,
  setNote,
  signPhotos,
  submissionTarget,
  submit,
  viewSubmission,
  type SubmissionTarget,
} from "../lib/homeworkSubmission.ts";
import { dueAtToDueDate } from "../modules/homework/rules.ts";
import { parseNote, parsePhotoUpload } from "../modules/homework/submission.ts";

const router = Router();

router.use("/student/homework", authMiddleware, requireRole("student"));

const DISABLED = {
  code: "student_accounts_disabled",
  error: "Parent and student accounts are not available yet.",
} as const;
const NO_HOMEWORK = { error: "Homework not found" } as const;

/** 60 photos an hour per account: far above a real project (six, with retakes), far below a file host. */
const photoLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 60,
  name: "homework-submission-photo",
  key: req => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

/** The shared shell of every student route: the flag, the target, one 404, one 500. */
async function withTarget(
  req: AuthenticatedRequest,
  res: Response,
  what: string,
  run: (t: SubmissionTarget) => Promise<void>,
): Promise<void> {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const target = await submissionTarget(req.user!.id, String(req.params["id"]));
    if (!target) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    await run(target);
  } catch (err) {
    logger.error({ err }, `student homework submission: ${what} failed`);
    res.status(500).json({ error: `Failed to ${what}` });
  }
}

async function currentView(t: SubmissionTarget) {
  return viewSubmission(await readOwnSubmission(t), t.dueAt);
}

router.get("/student/homework/:id/submission", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "load your project", async t => {
    res.json({ submission: await currentView(t), dueDate: dueAtToDueDate(t.dueAt) });
  }),
);

router.post("/student/homework/:id/submission/photos", photoLimiter, (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "save your photo", async t => {
    if (!isR2Configured()) {
      res.status(503).json({ code: "storage_unavailable", error: "Photo storage is not set up on this server yet." });
      return;
    }
    const parsed = parsePhotoUpload(req.body);
    if (!parsed.ok) {
      res.status(parsed.code === "file_too_large" ? 413 : 400).json({ error: parsed.error, code: parsed.code });
      return;
    }
    const { buffer, mime, extension } = parsed.value;
    // Stored first, then recorded: a refusal below removes the object, so a refused photo is never left behind.
    const key = newHomeworkSubmissionKey(t.homeworkId, t.studentId, extension);
    await putObject(key, buffer, mime);
    const photo = { id: randomUUID(), key, mime, sizeBytes: buffer.length };
    const result = await addPhoto(t, photo);
    if (result !== "ok") {
      await deleteObject(key).catch(err => logger.error({ err }, "student homework submission: could not remove a refused photo"));
      res.status(409).json({ error: result === "locked" ? "This project is locked" : "A project holds at most six photos", code: result });
      return;
    }
    const [view] = await signPhotos([photo]);
    const row = await readOwnSubmission(t);
    res.status(201).json({ photo: view, photoCount: row?.photos.length ?? 1 });
  }),
);

router.delete("/student/homework/:id/submission/photos/:photoId", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "remove your photo", async t => {
    const result = await removePhoto(t, String(req.params["photoId"]));
    if (result === "not_found") {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    if (result === "locked" || result === "empty") {
      res.status(409).json({
        error: result === "locked" ? "This project is locked" : "A handed-in project cannot be emptied",
        code: result,
      });
      return;
    }
    // Best effort: the row no longer lists the photo, so a leftover object is unreachable, not exposed.
    await deleteObject(result.key).catch(err => logger.error({ err }, "student homework submission: could not delete a removed photo"));
    res.json({ removed: true });
  }),
);

router.put("/student/homework/:id/submission", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "save your note", async t => {
    const parsed = parseNote(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: parsed.code });
      return;
    }
    const result = await setNote(t, parsed.value);
    if (result !== "ok") {
      res.status(409).json({
        error: result === "locked" ? "This project is locked" : "A handed-in project cannot be emptied",
        code: result,
      });
      return;
    }
    res.json({ submission: await currentView(t) });
  }),
);

router.post("/student/homework/:id/submission/submit", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "hand in your project", async t => {
    const result = await submit(t);
    if (result !== "ok") {
      res.status(409).json({
        error: result === "locked" ? "This project is locked" : "Add a photo or a note first",
        code: result,
      });
      return;
    }
    res.json({ submission: await currentView(t) });
  }),
);

export default router;
```

- [ ] **Step 4: Mount it**

In `routes/index.ts`, next to the other homework imports add `import homeworkSubmissionsRouter from "./homeworkSubmissions";` and, immediately after `router.use(familyHomeworkRouter);`:

```ts
// A student's project for a homework that asks for one; teacher and parent reads are added to
// the same router. Path-scoped guards inside (/student/homework, /parent/homework, /homework).
router.use(homeworkSubmissionsRouter);
```

- [ ] **Step 5: Rebuild and run**

```bash
cd artifacts/api-server && pnpm build
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts
```
Expected: PASS. If the late-hand-in assertion `status === "late"` fails because `hwClosed`'s `due_at` was set 1 day back, confirm `insertHomework` used `"-1 day"` and that `submit` used the database's `now()`.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm run typecheck
git add artifacts/api-server/src/routes/homeworkSubmissions.ts artifacts/api-server/src/routes/index.ts artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts
git diff --cached --stat
git commit -m "Homework submissions: the student's routes"
```

---

### Task 9: Teacher routes, and purge on archive

**Files:**
- Modify: `artifacts/api-server/src/lib/homeworkSubmission.ts` (teacher reads + purge)
- Modify: `artifacts/api-server/src/routes/homeworkSubmissions.ts` (teacher routes)
- Modify: `artifacts/api-server/src/routes/homework.ts` (export `ownedHomework`, purge on delete)
- Modify: `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (pin)
- Test: `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts`

**Interfaces:**
- Produces:

```ts
export interface TeacherSubmissionRow {
  studentId: string; displayName: string;
  status: SubmissionStatus;     // never reports a draft: a draft is "none"
  submittedAt: string | null;
  photoCount: number;
}
export async function listForTeacher(hw: { id: string; classGroupId: string; dueAt: Date }): Promise<TeacherSubmissionRow[]>
export async function readForTeacher(hw: { id: string; classGroupId: string; dueAt: Date }, studentId: string): Promise<{ displayName: string; submission: SubmissionView } | null>
export async function purgeSubmissions(homeworkId: string): Promise<{ rows: number; objects: number }>   // systemDb
```
- Routes: `GET /homework/:id/submissions` → `{ homework: { id, title, dueDate }, submittedCount, submissions: TeacherSubmissionRow[] }`; `GET /homework/:id/submissions/:studentId` → `{ student: { id, displayName }, submission: SubmissionView }`; 404 `{ error: "Homework not found" }` for a homework that is not yours, archived, or in an archived class; 404 `{ error: "Submission not found" }` for a draft, a missing one, a student outside the class, or a malformed id.
- `DELETE /homework/:id` (existing) additionally calls `purgeSubmissions` after archiving.

- [ ] **Step 1: Write the failing tests**

Add another `describe` block inside the file's top-level suite:

```ts
  describe("the teacher's view, and what archiving removes", () => {
    let hwTeacher: string;
    const seedHandedIn = async (homeworkId: string, studentRow: string, photos: Array<{ id: string; key: string }>, submitted: boolean) => {
      for (const p of photos) await s3.putForTest(p.key, JPEG);
      await db.pool.query(
        `INSERT INTO homework_submissions (homework_id, student_id, note, photos, submitted_at)
         VALUES ($1, $2, 'ملاحظة', $3::jsonb, CASE WHEN $4::boolean THEN now() END)`,
        [homeworkId, studentRow, JSON.stringify(photos.map(p => ({ ...p, mime: "image/jpeg", sizeBytes: JPEG.length }))), submitted],
      );
    };

    before(async () => {
      hwTeacher = await insertHomework("project-teacher-view", "5 days", true);
      await seedHandedIn(hwTeacher, w.students.sA1, [{ id: "p1", key: `homework-submissions/${hwTeacher}/${w.students.sA1}/p1.jpg` }], true);
      await seedHandedIn(hwTeacher, sibling.row, [{ id: "p2", key: `homework-submissions/${hwTeacher}/${sibling.row}/p2.jpg` }], false); // a draft
    });

    it("lists every live member with their state; a draft is reported as none", async () => {
      const r = await call(server, "GET", `/homework/${hwTeacher}/submissions`, w.users.t1);
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.submittedCount, 1);
      const byId = new Map<string, any>(r.json.submissions.map((s: any) => [s.studentId, s]));
      assert.equal(byId.get(w.students.sA1).status, "submitted");
      assert.equal(byId.get(w.students.sA1).photoCount, 1);
      assert.equal(byId.get(sibling.row).status, "none", "the teacher never sees an unfinished upload");
      assert.equal(byId.get(sibling.row).photoCount, 0);
    });

    it("opens one student's project with signed URLs; a draft, a stranger's student and a bad id are one 404", async () => {
      const ok = await call(server, "GET", `/homework/${hwTeacher}/submissions/${w.students.sA1}`, w.users.t1);
      assert.equal(ok.status, 200, ok.text);
      assert.equal(ok.json.submission.note, "ملاحظة");
      assert.equal(ok.json.submission.photos.length, 1);
      assert.ok(Buffer.from(await (await fetch(ok.json.submission.photos[0].url)).arrayBuffer()).equals(JPEG));
      for (const id of [sibling.row, w.students.nB1, RANDOM_UUID, "nope"]) {
        const r = await call(server, "GET", `/homework/${hwTeacher}/submissions/${id}`, w.users.t1);
        assert.equal(r.status, 404, `${id}: ${r.text}`);
      }
    });

    it("is closed to another teacher, a student and an anonymous caller", async () => {
      for (const [user, status] of [[w.users.t2, 404], [w.users.studentA, 403], [w.users.parentA, 403], [undefined, 401]] as const) {
        const list = await call(server, "GET", `/homework/${hwTeacher}/submissions`, user);
        assert.equal(list.status, status, `list as ${user}`);
        const one = await call(server, "GET", `/homework/${hwTeacher}/submissions/${w.students.sA1}`, user);
        assert.equal(one.status, status, `one as ${user}`);
      }
    });

    it("archiving the homework removes every photo, drafts included, and the rows", async () => {
      assert.ok(s3.keys().some(k => k.startsWith(`homework-submissions/${hwTeacher}/`)));
      const del = await call(server, "DELETE", `/homework/${hwTeacher}`, w.users.t1);
      assert.equal(del.status, 200, del.text);
      assert.deepEqual(s3.keys().filter(k => k.startsWith(`homework-submissions/${hwTeacher}/`)), []);
      const left = await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = $1`, [hwTeacher]);
      assert.equal(left.rowCount, 0);
      const other = s3.keys().filter(k => k.startsWith(`homework-submissions/${hwOpen}/`));
      assert.ok(other.length > 0, "another homework's photos are untouched");
    });
  });
```

The `seedHandedIn` helper puts bytes straight into the stub, so add a test-only setter to `S3Stub`: in `test-support/s3Stub.ts` add `putForTest(key: string, body: Buffer): Promise<void>` to the interface and return `putForTest: async (key, body) => { objects.set(key, body); }` from `startS3Stub`.

- [ ] **Step 2: Run to verify it fails**

```bash
cd artifacts/api-server && pnpm build
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts
```
Expected: the new block FAILS (404 on the new routes; the archive case leaves the keys behind).

- [ ] **Step 3: Teacher reads and the purge**

In `lib/homeworkSubmission.ts`, extend the `@workspace/db` import with `classMemberships, students, systemDb`, the `drizzle-orm` import with `asc, isNotNull, isNull`, and add `import { logger } from "./logger"; import { deleteObject } from "./r2.ts";` Then append:

```ts
export interface TeacherSubmissionRow {
  studentId: string;
  displayName: string;
  /** A draft is `none`: the teacher never sees an unfinished upload. */
  status: SubmissionStatus;
  submittedAt: string | null;
  photoCount: number;
}

interface TeacherHomeworkRef {
  id: string;
  classGroupId: string;
  dueAt: Date;
}

/**
 * Every live roster row in the homework's class, with the state of its handed-in project. Only a
 * handed-in row is joined: row-level security would hide a draft from the teacher anyway, and the
 * explicit filter keeps this correct if it ever ran on a connection that does not enforce it.
 */
export async function listForTeacher(hw: TeacherHomeworkRef): Promise<TeacherSubmissionRow[]> {
  const rows = await db
    .select({
      studentId: students.id,
      displayName: students.displayName,
      submittedAt: homeworkSubmissions.submittedAt,
      photos: homeworkSubmissions.photos,
    })
    .from(classMemberships)
    .innerJoin(students, eq(students.id, classMemberships.studentId))
    .leftJoin(
      homeworkSubmissions,
      and(
        eq(homeworkSubmissions.studentId, students.id),
        eq(homeworkSubmissions.homeworkId, hw.id),
        isNotNull(homeworkSubmissions.submittedAt),
      ),
    )
    .where(and(eq(classMemberships.classGroupId, hw.classGroupId), isNull(students.archivedAt)))
    .orderBy(asc(students.displayName));
  return rows.map(r => ({
    studentId: r.studentId,
    displayName: r.displayName,
    status: submissionStatus({ submittedAt: r.submittedAt, dueAt: hw.dueAt }),
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    photoCount: r.photos?.length ?? 0,
  }));
}

/** One live class member's handed-in project, or null for a draft, a missing one, or a student outside the class. */
export async function readForTeacher(
  hw: TeacherHomeworkRef,
  studentId: string,
): Promise<{ displayName: string; submission: SubmissionView } | null> {
  const [row] = await db
    .select({ submission: homeworkSubmissions, displayName: students.displayName })
    .from(homeworkSubmissions)
    .innerJoin(students, eq(students.id, homeworkSubmissions.studentId))
    .innerJoin(
      classMemberships,
      and(eq(classMemberships.studentId, students.id), eq(classMemberships.classGroupId, hw.classGroupId)),
    )
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, hw.id),
        eq(homeworkSubmissions.studentId, studentId),
        isNotNull(homeworkSubmissions.submittedAt),
        isNull(students.archivedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { displayName: row.displayName, submission: await viewSubmission(row.submission, hw.dueAt) };
}

/**
 * Removes every photo and every row of a homework that has been archived. `systemDb` on purpose:
 * the teacher's own connection cannot see a student's DRAFT (row-level security), and a draft's
 * photos are in the bucket all the same, so purging on the teacher's identity would leave them
 * behind. The caller (DELETE /homework/:id) has already proved the homework is the teacher's.
 * A failed object delete is logged, not fatal: the rows (and so the keys) are deleted either way,
 * and the object is unreachable from then on.
 */
export async function purgeSubmissions(homeworkId: string): Promise<{ rows: number; objects: number }> {
  const rows = await systemDb
    .select({ photos: homeworkSubmissions.photos })
    .from(homeworkSubmissions)
    .where(eq(homeworkSubmissions.homeworkId, homeworkId));
  let objects = 0;
  for (const { photos } of rows) {
    for (const p of photos) {
      try {
        await deleteObject(p.key);
        objects += 1;
      } catch (err) {
        logger.error({ err, homeworkId }, "homework submission purge: could not delete an object");
      }
    }
  }
  await systemDb.delete(homeworkSubmissions).where(eq(homeworkSubmissions.homeworkId, homeworkId));
  return { rows: rows.length, objects };
}
```

- [ ] **Step 4: Teacher routes**

In `routes/homework.ts` change `async function ownedHomework(` to `export async function ownedHomework(` (no other change to it), and in `DELETE /homework/:id`, after the `db.update(...)` that archives and before `res.json`, add:

```ts
    // The photos are a minor's work and archiving is the teacher's "delete": remove them now.
    // Awaited, capped by the work itself (a handful of objects), and never failing the archive.
    await purgeSubmissions(existing.id).catch(err => logger.error({ err, homeworkId: existing.id }, "homework archive: could not purge submissions"));
```

with `import { purgeSubmissions } from "../lib/homeworkSubmission.ts";` at the top.

In `routes/homeworkSubmissions.ts` add the imports `TEACHER_ROLES` (from `../middlewares/auth.js`), `ownedHomework` (from `./homework`), `isUuid` (from `../modules/homework/rules.ts`), `listForTeacher`, `readForTeacher` (from `../lib/homeworkSubmission.ts`); add the guard next to the student one:

```ts
router.use("/homework", authMiddleware, requireRole(...TEACHER_ROLES));
```

and these routes before `export default router;`:

```ts
const NO_SUBMISSION = { error: "Submission not found" } as const;

router.get("/homework/:id/submissions", async (req: AuthenticatedRequest, res) => {
  try {
    const hw = await ownedHomework(String(req.params["id"]), req.user!.id);
    if (!hw || !hw.requiresSubmission) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const submissions = await listForTeacher(hw);
    res.json({
      homework: { id: hw.id, title: hw.title, dueDate: dueAtToDueDate(hw.dueAt) },
      submittedCount: submissions.filter(s => s.status !== "none").length,
      submissions,
    });
  } catch (err) {
    logger.error({ err }, "teacher homework submissions failed");
    res.status(500).json({ error: "Failed to load the submissions" });
  }
});

router.get("/homework/:id/submissions/:studentId", async (req: AuthenticatedRequest, res) => {
  try {
    const hw = await ownedHomework(String(req.params["id"]), req.user!.id);
    if (!hw || !hw.requiresSubmission) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const studentId = String(req.params["studentId"]);
    const found = isUuid(studentId) ? await readForTeacher(hw, studentId) : null;
    if (!found) {
      res.status(404).json(NO_SUBMISSION);
      return;
    }
    res.json({ student: { id: studentId, displayName: found.displayName }, submission: found.submission });
  } catch (err) {
    logger.error({ err }, "teacher homework submission failed");
    res.status(500).json({ error: "Failed to load the submission" });
  }
});
```

- [ ] **Step 5: Pin the new `systemDb` user**

In `lib/__tests__/systemDbFiles.test.ts`, add to `ALLOWED` (keep the list's grouping; put it after `"lib/homeworkReminders.ts"`):

```ts
  "lib/homeworkSubmission.ts": "archiving a homework purges every photo and row of it, drafts included — a draft is invisible to the teacher's own identity (row-level security) but its photos are in the bucket all the same",
```

- [ ] **Step 6: Rebuild and run**

```bash
cd artifacts/api-server && pnpm build
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts src/lib/__tests__/systemDbFiles.test.ts src/routes/__tests__/homework.db.test.ts
```
Expected: PASS. The existing `homework.db.test.ts` is the check that the delete route still archives and answers as before.

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm run typecheck
git add artifacts/api-server/src/lib/homeworkSubmission.ts artifacts/api-server/src/routes/homeworkSubmissions.ts artifacts/api-server/src/routes/homework.ts artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts artifacts/api-server/src/test-support/s3Stub.ts artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts
git diff --cached --stat
git commit -m "Homework submissions: teacher reads, and purge photos when a homework is archived"
```

---

### Task 10: Parent read, and the state in the family's list

**Files:**
- Modify: `artifacts/api-server/src/lib/homeworkSubmission.ts` (parent read)
- Modify: `artifacts/api-server/src/routes/homeworkSubmissions.ts` (parent route)
- Modify: `artifacts/api-server/src/modules/homework/familyHomework.ts`, `artifacts/api-server/src/lib/familyHomeworkLoad.ts`
- Test: `artifacts/api-server/src/modules/homework/__tests__/familyHomework.test.ts`, `artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts`

**Interfaces:**
- Consumes: `guardianLinkedStudents` (`lib/familyAccess.ts`), `groupChildren` (`modules/family/children.ts`: `{ key, displayName, studentIds }` per child).
- Produces:
  - `readForParent(userId: string, homeworkId: string): Promise<Array<{ key: string; displayName: string; submission: SubmissionView }> | null>` — `null` when the homework is not a live submission homework in a class one of the guardian's children is in.
  - `GET /parent/homework/:id/submissions` → `{ children: [{ key, displayName, submission }] }`.
  - `FamilyHomeworkItem.requiresSubmission: boolean` and `FamilyHomeworkItem.submission: SubmissionStatus`. `HomeworkRow.requiresSubmission?: boolean`. `buildFamilyHomework` takes `submissions?: SubmissionRow[]` where `SubmissionRow = { homeworkId: string; studentId: string; submittedAt: Date | null }`.

- [ ] **Step 1: Write the failing pure tests**

Append to `modules/homework/__tests__/familyHomework.test.ts` (reuse its fixture helpers; read the top of the file first and build the minimal input the same way the existing cases do, with `withAccount` and one membership):

```ts
describe("a homework that asks for a project", () => {
  const dueAt = new Date("2026-11-10T20:59:59.999Z");
  const now = new Date("2026-11-08T08:00:00Z");
  const hw = { id: "h1", classGroupId: "c1", title: "مشروع", instructions: "", dueAt, evaluationId: null, requiresSubmission: true };
  const membership = { classGroupId: "c1", studentId: "s1", className: "10A", teacherId: "t1" };
  const build = (submissions: Array<{ homeworkId: string; studentId: string; submittedAt: Date | null }>) =>
    buildFamilyHomework({
      homework: [hw], memberships: [membership], completions: [], teachers: [{ id: "t1", firstName: "Omar", lastName: "H" }],
      exams: [], now, withAccount: new Set(["s1"]), submissions,
    })[0]!;

  it("says whether it asks for a project, and that nothing is handed in yet", () => {
    const item = build([]);
    assert.equal(item.requiresSubmission, true);
    assert.equal(item.submission, "none");
  });
  it("is submitted on time, late after the due day, and ignores a draft and another child's row", () => {
    assert.equal(build([{ homeworkId: "h1", studentId: "s1", submittedAt: new Date("2026-11-09T10:00:00Z") }]).submission, "submitted");
    assert.equal(build([{ homeworkId: "h1", studentId: "s1", submittedAt: new Date("2026-11-11T10:00:00Z") }]).submission, "late");
    assert.equal(build([{ homeworkId: "h1", studentId: "s1", submittedAt: null }]).submission, "none");
    assert.equal(build([{ homeworkId: "h1", studentId: "someone-else", submittedAt: new Date("2026-11-09T10:00:00Z") }]).submission, "none");
  });
  it("an ordinary homework is not a project and is never 'submitted'", () => {
    const item = buildFamilyHomework({
      homework: [{ ...hw, requiresSubmission: undefined }], memberships: [membership], completions: [],
      teachers: [], exams: [], now, withAccount: new Set(), submissions: [{ homeworkId: "h1", studentId: "s1", submittedAt: new Date("2026-11-09T10:00:00Z") }],
    })[0]!;
    assert.equal(item.requiresSubmission, false);
    assert.equal(item.submission, "none");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/homework/__tests__/familyHomework.test.ts`
Expected: FAIL — `requiresSubmission` and `submission` are `undefined`.

- [ ] **Step 3: Implement the builder and the loader**

In `modules/homework/familyHomework.ts`: add `import { submissionStatus, type SubmissionStatus } from "./submission.ts";`; add `requiresSubmission?: boolean;` to `HomeworkRow`; add

```ts
/** A handed-in or draft project, for one roster row. */
export interface SubmissionRow { homeworkId: string; studentId: string; submittedAt: Date | null }
```

add to `FamilyHomeworkItem`:

```ts
  /** The teacher asked for a project (photos and a note) instead of a tick. */
  requiresSubmission: boolean;
  /** The best state among the family's own roster rows in this item's class; `none` for a draft or an ordinary homework. */
  submission: SubmissionStatus;
```

add `submissions?: SubmissionRow[];` to the `buildFamilyHomework` input, and inside the loop, before `items.push`, compute and then include both fields:

```ts
    const requiresSubmission = h.requiresSubmission === true;
    let submission: SubmissionStatus = "none";
    if (requiresSubmission) {
      for (const s of input.submissions ?? []) {
        if (s.homeworkId !== h.id || !rosterIds.has(s.studentId)) continue;
        const status = submissionStatus({ submittedAt: s.submittedAt, dueAt: h.dueAt });
        if (status !== "none" && (submission === "none" || status === "submitted")) submission = status;
      }
    }
```

In `lib/familyHomeworkLoad.ts`: add `requiresSubmission: homework.requiresSubmission,` to the `homeworkRows` select, add `homeworkSubmissions` to the `@workspace/db` import and `isNotNull` to the drizzle import, add a fifth query to the `Promise.all` (destructure as `submissionRows`):

```ts
    // Like completions: the family's own roster rows only, and only a handed-in project — a draft is the author's alone.
    db
      .select({
        homeworkId: homeworkSubmissions.homeworkId,
        studentId: homeworkSubmissions.studentId,
        submittedAt: homeworkSubmissions.submittedAt,
      })
      .from(homeworkSubmissions)
      .where(
        and(
          inArray(homeworkSubmissions.homeworkId, hwIds),
          inArray(homeworkSubmissions.studentId, studentIds),
          isNotNull(homeworkSubmissions.submittedAt),
        ),
      ) as Promise<SubmissionRow[]>,
```

import `type SubmissionRow` from the builder module, and pass `submissions: submissionRows` to `buildFamilyHomework`.

- [ ] **Step 4: Run the pure tests to verify they pass**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/homework/__tests__/familyHomework.test.ts`
Expected: PASS, including the existing cases.

- [ ] **Step 5: Write the failing DB cases**

Add a `describe` block inside the file's top-level suite:

```ts
  describe("a parent, and the family's list", () => {
    let hwFamily: string;
    before(async () => {
      hwFamily = await insertHomework("project-family", "5 days", true);
      const key = `homework-submissions/${hwFamily}/${w.students.sA1}/fam.jpg`;
      await s3.putForTest(key, JPEG);
      await db.pool.query(
        `INSERT INTO homework_submissions (homework_id, student_id, note, photos, submitted_at) VALUES ($1, $2, 'للأهل', $3::jsonb, now())`,
        [hwFamily, w.students.sA1, JSON.stringify([{ id: "f1", key, mime: "image/jpeg", sizeBytes: JPEG.length }])],
      );
      // a draft of the classmate's, which no parent may see
      await db.pool.query(`INSERT INTO homework_submissions (homework_id, student_id, note) VALUES ($1, $2, 'مسودة')`, [hwFamily, sibling.row]);
    });

    it("lets a guardian read their own child's handed-in project, read-only", async () => {
      const r = await call(server, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentA);
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.children.length, 1);
      assert.equal(r.json.children[0].displayName, "سارة");
      assert.equal(r.json.children[0].submission.note, "للأهل");
      assert.equal(r.json.children[0].submission.photos.length, 1);
      assert.ok(Buffer.from(await (await fetch(r.json.children[0].submission.photos[0].url)).arrayBuffer()).equals(JPEG));
      const write = await call(server, "PUT", `/parent/homework/${hwFamily}/submission`, w.users.parentA, { note: "x" });
      assert.ok([404, 405].includes(write.status), "a parent has no write route");
    });

    it("shows another family, a teacher and an anonymous caller nothing", async () => {
      assert.equal((await call(server, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentB)).status, 404);
      assert.equal((await call(server, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.t1)).status, 403);
      assert.equal((await call(server, "GET", `/parent/homework/${hwFamily}/submissions`)).status, 401);
      assert.equal((await call(server, "GET", `/parent/homework/${RANDOM_UUID}/submissions`, w.users.parentA)).status, 404);
    });

    it("carries the state in the student's and the parent's homework lists", async () => {
      const student = await call(server, "GET", "/student/homework", w.users.studentA);
      const mine = student.json.homework.find((h: any) => h.id === hwFamily);
      assert.equal(mine.requiresSubmission, true);
      assert.equal(mine.submission, "submitted");
      const parent = await call(server, "GET", "/parent/homework", w.users.parentA);
      const sara = parent.json.children.find((c: any) => c.displayName === "سارة");
      assert.equal(sara.homework.find((h: any) => h.id === hwFamily).submission, "submitted");
      // the classmate's draft is not "submitted" for them
      const layla = await call(server, "GET", "/student/homework", sibling.user);
      assert.equal(layla.json.homework.find((h: any) => h.id === hwFamily).submission, "none");
    });
  });
```

- [ ] **Step 6: Parent read and route**

In `lib/homeworkSubmission.ts` add imports `classGroups, homework` (from `@workspace/db`) and `guardianLinkedStudents` (from `./familyAccess.ts`), `groupChildren` (from `../modules/family/children.ts`), and:

```ts
/**
 * The handed-in projects of the guardian's own children for one homework, one entry per child.
 * The homework must ask for a project and be live, in a live class that one of the children is in.
 * `null` is the one answer for every other case.
 */
export async function readForParent(
  userId: string,
  homeworkId: string,
): Promise<Array<{ key: string; displayName: string; submission: SubmissionView }> | null> {
  const [hw] = await db
    .select({ classGroupId: homework.classGroupId, dueAt: homework.dueAt, requiresSubmission: homework.requiresSubmission })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(and(eq(homework.id, homeworkId), isNull(homework.archivedAt), isNull(classGroups.archivedAt)))
    .limit(1);
  if (!hw || !hw.requiresSubmission) return null;

  const children = groupChildren(await guardianLinkedStudents(userId));
  const allRows = children.flatMap(c => c.studentIds);
  if (allRows.length === 0) return null;
  const inClass = await db
    .select({ studentId: classMemberships.studentId })
    .from(classMemberships)
    .where(and(eq(classMemberships.classGroupId, hw.classGroupId), inArray(classMemberships.studentId, allRows)));
  const classRows = new Set(inClass.map(m => m.studentId));
  const mine = children.filter(c => c.studentIds.some(id => classRows.has(id)));
  if (mine.length === 0) return null;

  const subs = await db
    .select()
    .from(homeworkSubmissions)
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, homeworkId),
        inArray(homeworkSubmissions.studentId, [...classRows]),
        isNotNull(homeworkSubmissions.submittedAt),
      ),
    );
  return Promise.all(
    mine.map(async c => ({
      key: c.key,
      displayName: c.displayName,
      submission: await viewSubmission(subs.find(s => c.studentIds.includes(s.studentId)) ?? null, hw.dueAt),
    })),
  );
}
```

In `routes/homeworkSubmissions.ts` add the guard `router.use("/parent/homework", authMiddleware, requireRole("parent"));` and the route:

```ts
router.get("/parent/homework/:id/submissions", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const children = isUuid(String(req.params["id"])) ? await readForParent(req.user!.id, String(req.params["id"])) : null;
    if (!children) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    res.json({ children });
  } catch (err) {
    logger.error({ err }, "parent homework submissions failed");
    res.status(500).json({ error: "Failed to load your child's project" });
  }
});
```

(importing `readForParent`.)

- [ ] **Step 7: Rebuild and run everything homework**

```bash
cd artifacts/api-server && pnpm build
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/routes/__tests__/homeworkSubmission.db.test.ts src/routes/__tests__/familyHomework.db.test.ts src/routes/__tests__/homework.db.test.ts src/routes/__tests__/homeworkMaterial.db.test.ts src/modules/homework/__tests__/familyHomework.test.ts
```
Expected: PASS. `familyHomework.db.test.ts` is the check that the family list's existing fields are unchanged.

- [ ] **Step 8: Typecheck and commit**

```bash
pnpm run typecheck
git add artifacts/api-server/src/lib/homeworkSubmission.ts artifacts/api-server/src/routes/homeworkSubmissions.ts artifacts/api-server/src/modules/homework/familyHomework.ts artifacts/api-server/src/lib/familyHomeworkLoad.ts artifacts/api-server/src/modules/homework/__tests__/familyHomework.test.ts artifacts/api-server/src/routes/__tests__/homeworkSubmission.db.test.ts
git diff --cached --stat
git commit -m "Homework submissions: the parent's read, and the state in the family's list"
```

---

### Task 11: Mount order, the log entry, and the whole check

**Files:**
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`
- Modify: `docs/status-log.md` (entry at the TOP)
- Modify: `docs/superpowers/specs/2026-10-30-homework-project-submission-design.md` (corrections found while planning — see Step 3)

- [ ] **Step 1: Mount-order test**

In `mountOrder.test.ts`, directly after the `"guards family homework, for both roles and the done toggle"` case, add:

```ts
  it("guards homework project submissions for the student, the parent and the teacher", async () => {
    // Path-scoped inside homeworkSubmissions.ts: every verb is refused without a token, and the
    // router answers for nothing outside its three prefixes.
    const id = "00000000-0000-4000-8000-000000000000";
    for (const [method, p] of [
      ["GET", `/student/homework/${id}/submission`],
      ["POST", `/student/homework/${id}/submission/photos`],
      ["DELETE", `/student/homework/${id}/submission/photos/${id}`],
      ["PUT", `/student/homework/${id}/submission`],
      ["POST", `/student/homework/${id}/submission/submit`],
      ["GET", `/parent/homework/${id}/submissions`],
      ["GET", `/homework/${id}/submissions`],
      ["GET", `/homework/${id}/submissions/${id}`],
    ] as const) {
      const res = await fetch(`${base}${p}`, { method });
      assert.equal(res.status, 401, `${method} ${p} must require a token`);
    }
    // An unowned path is still a 404, not a 401: the new router must not have installed a guard for everything after it.
    const unowned = await fetch(`${base}/no-such-homework-path/${id}`);
    assert.equal(unowned.status, 404);
  });
```

- [ ] **Step 2: Run the mount-order suite**

```bash
cd artifacts/api-server && pnpm build && node --experimental-strip-types --test src/routes/__tests__/mountOrder.test.ts
```
Expected: PASS, including the new case and every existing one.

- [ ] **Step 3: Correct the spec where planning found it wrong**

Apply these edits to `docs/superpowers/specs/2026-10-30-homework-project-submission-design.md` with the Edit tool (each is a place where reading the code showed the spec's wording to be inexact):

1. In §1 replace `Two accounts linked to the same roster row share one submission, exactly as they share ticks.` with `A roster row has at most one student account (`roster_links_one_self_idx`), so in practice one student account writes a submission; a guardian linked to the same row reads it. The submission is on the roster row, not the account, like a completion.`
2. In §3 replace the `GET /student/homework/:id/submission` row's tail `404 when there is none` with `A student with nothing yet gets status "none", not a 404; 404 is for a homework that does not resolve`.
3. In §3 "The tick", replace the last sentence `DELETE …/done stays allowed; it does not delete the submission.` with `DELETE …/done is refused the same way, so the tick and the submission cannot disagree. Playing an attached game no longer ticks such a homework either.`
4. In §3 teacher table, replace the `DELETE /homework/:id (existing)` cell with: `That route archives (archived_at). It now also removes every stored photo (drafts included, on systemDb: a draft is invisible to the teacher's own identity) and deletes the submission rows. Not recoverable, so the teacher's delete confirmation must say so.` In §1 "Decisions already made" and §8, change "empties photos; the rows stay" wording to match.
5. In §4 layer 3 replace `**Write:** INSERT/UPDATE/DELETE only by the self-linked author of that roster row, or systemDb.` with `**Write:** INSERT and UPDATE only by the self-linked author of that roster row. There is no DELETE policy; removal is systemDb's job.`

Run `git diff --stat docs/` and read the diff; a line reading `Bin N -> M bytes` means corruption.

- [ ] **Step 4: Write the log entry**

At the TOP of `docs/status-log.md` (above the newest entry, keeping its heading style: read the first 40 lines and match them), add an entry titled **«Homework project submission — API foundation»** stating: what shipped (the column, the table with RLS, the student, teacher and parent routes, purge on archive); what was verified (name each test file that passed and the command; if a DB suite could not be run locally, say so in that sentence instead); what is **not** built (the student app, the teacher and parent app, grading and comments, supervisor access); and the known limits copied from the spec's §8 (no moderation queue, no per-student photo removal by the teacher, storage is capped only by the six-photo and rate limits). Per `CLAUDE.md`, do **not** edit `STATUS.md` unless a line in it stopped being true.

- [ ] **Step 5: The whole check**

```bash
pnpm run typecheck
cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres pnpm test
cd ../../lib/db && RLS_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/iqraa_rls_scratch pnpm test
cd ../../artifacts/mobile && pnpm test
```
Expected: all green. The mobile suite prints nothing until it finishes (minutes); that is not a hang. It is run because `FamilyHomeworkItem` gained fields that the app's `services/` types may mirror: if a mobile typecheck or test fails on them, the change belongs in the **student-app plan**, not here — add the optional fields to the mobile type only if the typecheck forces it, and say so in the PR body.

- [ ] **Step 6: Commit and open the PR**

```bash
git add artifacts/api-server/src/routes/__tests__/mountOrder.test.ts docs/status-log.md docs/superpowers/specs/2026-10-30-homework-project-submission-design.md
git diff --cached --stat
git commit -m "Homework submissions: mount-order guard, log entry, spec corrections"
```

Open a **draft** PR. Per `CLAUDE.md`, a merge to `main` deploys the API and runs the migration, so the PR body must say: the migration is additive (no `destructive-migration` line needed); that `R2_*` secrets already exist on Cloud Run for chat attachments, so no new secret is attached; that no mobile code changed, so no OTA and no `app.json` `version` bump; and exactly which suites were and were not run locally.

---

## Self-review

**Spec coverage** (spec section → task):
- §1 `requires_submission` and `homework_submissions`, unique key, roster-row semantics, late computed → Tasks 3, 1, 7. First-of-sorted-rows rule → Task 7 (`submissionTarget`).
- §2 private R2 key helper, signed URLs of ten minutes, one photo per request, mime/size/magic-byte rules, HEIC refused → Tasks 1, 5, 7, 8.
- §3 student routes (five), teacher routes (two + purge), parent route, family list state, replace/lock/late, tick refusal → Tasks 8, 9, 10, 6.
- §4 three isolation layers: route resolution (Tasks 7–8, tested by the cross-student and stranger cases), scoped reads (Tasks 9–10), RLS (Tasks 3–4). The spec's extra request, `rlsDiff` cases for the new routes, is **not** done here: `rlsDiff` boots the server with and without `RLS_ENFORCE` and compares what every endpoint returns, which would need an R2 stub wired into its own bespoke server boot. The RLS matrix (Task 4) proves the policies directly, and `homeworkSubmission.db.test.ts` runs the student journey, the teacher's reads, the purge and the parent's read once each on a server with `RLS_ENFORCE=on` (its other cases run on the plain server). Say so in the PR body rather than claim the diff covers it.
- §5 app → **not in this plan** (phases 2 and 3).
- §6 phases → this plan is phase 1; phases 2–3 get their own plans.
- §7 testing: DB tests (Tasks 6, 8, 9, 10), pure tests (1, 2, 10), RLS (4), `mountOrder` (11), s3 stub (5). The browser smoke step and the mobile `services/__tests__` cases belong to the app plans.
- §8 risks: rate limit (Task 8), storage_unavailable (Task 8), no moderation (stated in Task 11's log entry).
- Spec corrections found while planning (one self-link per row; `GET` returns `none` not 404; both tick directions refused; archive deletes rows; no DELETE policy) → Task 11 Step 3.

**Placeholder scan:** none left — no "TBD", every code step shows the code. The one instruction that depends on reading a file the plan has not shown (Task 10 Step 1, "build the minimal input the same way the existing cases do") is bounded by the full fixture in the example and is a read, not a guess.

**Type consistency:** `SubmissionTarget`, `SubmissionView`, `SubmissionPhotoView`, `TeacherSubmissionRow` are defined in Tasks 7 and 9 and used with the same fields in Tasks 8–10. `setHomeworkDone`'s new return `"submission_required"` (Task 6) is the string `mark` branches on. `ownHomeworkRows` gains `requiresSubmission` and `dueAt` in Task 6, read by `submissionTarget` in Task 7. `PhotoUpload.extension` (Task 1) is what `newHomeworkSubmissionKey(…, extension)` receives (Tasks 5, 8). `ownedHomework` is exported in Task 9 and used there only.
