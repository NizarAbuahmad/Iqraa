# Class Resources — Piece 1 (Library items in a class) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher can add Library items (staff uploads, premade worksheets, book-QR links) to a class's الموارد tab from inside the class, see them in one newest-first list beside their own materials, open them, and remove them.

**Architecture:** A new `class_resources` table holds a pointer plus a display snapshot per item. Three endpoints under `/classes/:id/resources` live in the existing roster router (so the router's path-scoped auth and consent guards apply). The class screen gains a «من المكتبة» row in its «+» sheet that opens a new `LibraryPickerSheet`, and merges the new rows into its list through a pure, tested `mergeClassShelf`.

**Tech Stack:** Express + Drizzle (Postgres) in `artifacts/api-server`; Expo / React Native (also the web build) in `artifacts/mobile`; `node:test` for both.

**Spec:** `docs/superpowers/specs/2026-10-04-class-resources-design.md` (PR #833). Read it first; this plan implements piece #1 of it. Pieces #2 (pasted links) and #3 (device files) are out of scope here.

## Global Constraints

- Table `class_resources` with exactly these columns: `id` uuid pk, `class_group_id` uuid not null → `class_groups(id)` on delete cascade, `teacher_id` uuid not null → `users(id)` on delete cascade, `kind` text not null, `library_source` text, `library_native_id` text, `title` text not null, `media_kind` text not null, `url` text, `thumbnail_url` text, `created_at` timestamptz not null default now(). Partial unique index on `(class_group_id, library_source, library_native_id)` where `kind = 'library'`.
- Endpoints: `GET`, `POST`, `DELETE /:rid` under `/classes/:id/resources`. A class that is not the caller's, or is archived, answers **404** (use `findLiveClass`), never 403.
- `POST` of an item already on the shelf answers **409** with `code: "already_added"`; the app treats it as success.
- Missing table: `GET` answers `{ "resources": [] }`; `POST` and `DELETE` answer **503** `roster_storage_unavailable` (the code `failRoster` already returns and the app already understands). *This corrects the spec, which named a new code; the spec is amended in the same PR as this plan.*
- For `source = uploaded` the server copies title, kind, url and cover from its own `library_resources` row and ignores whatever the app sent.
- Validation: title ≤ 200 characters; url ≤ 2048; thumbnail url ≤ 2000 and **https only**; link urls are https only **except** `book-qr`, which also accepts plain http; `media_kind` is one of the Library categories (`infographic image video audio game worksheet template presentation document`) or `page`.
- Schema is changed by a hand-written additive `docs/schema-push-<date>-class-resources.sql`, run in the Neon console **before** merge. The PR description needs `schema-push: done` at the **start of a line** with nothing between the colon and the word (matched literally by CI).
- `verify-schema` parses `lib/db/src/schema/*.ts` with regexes: use only the pg-core column types it knows (`text uuid timestamp ...`), and keep any comment *inside* a table's column object free of text shaped like `word: word(`.
- Mobile tests only run from `artifacts/mobile/services/__tests__/**/*.test.ts` and are bare `node --test`: a tested module must not import `react-native` or `expo-*` at runtime, and relative imports in it need an explicit `.ts` extension. API tests run from `artifacts/api-server/src/**/__tests__/**/*.test.ts` — do not narrow either glob.
- Arabic is the product language and the UI is RTL-first; every new string needs an Arabic **and** an English entry (a test enforces identical key sets).
- Do not change the `/classes/:id/resources` paths into a bare `router.use(...)`: guards must stay path-scoped (CLAUDE.md, "Routers mounted without a path prefix").

## Setup notes (read once)

- **Branch.** Create `claude/class-resources-impl` from `origin/main`. PR #822 also edits `app/classes/[id].tsx` (one hunk inside the «أنشئ مادة جديدة» press handler) and `app/(tabs)/ai-tools.tsx`; this plan's edits to the class screen are in different regions and anchored by text, not line numbers, so they merge cleanly in either order. Pushing a new branch needs the owner's go-ahead in the cloud session.
- **Local verification environment** (used by Tasks 1, 3 and 11; all files below are gitignored — delete them at the end of Task 11):

```bash
pg_ctlcluster 16 main start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'pw'\" -c \"CREATE DATABASE iqraa\""   # first time only
cat > .env <<'EOF'
DATABASE_URL=postgres://postgres:pw@localhost:5432/iqraa
SESSION_SECRET=local-verification-secret-0123456789abcdef
OPENAI_API_KEY=sk-local-dummy
PORT=8080
EOF
printf 'EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api\n' > artifacts/mobile/.env
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push          # on the schema WITHOUT class_resources — see Task 1
pnpm --filter @workspace/db run seed:assessment
```

- **Commands.** Whole-repo typecheck: `pnpm run typecheck` (it builds the libs first; a bare `tsc` in `artifacts/mobile` fails with TS6305 until they are built). Mobile suite: `cd artifacts/mobile && pnpm test`. API suite: `cd artifacts/api-server && pnpm build && pnpm test` (the mount-order suite boots the built bundle and skips without a build).
- **Why some "red" steps are missing.** Schema and pure-constant moves have no unit test to fail; their red/green is a typecheck or `verify-schema` run, said so where it applies. The mount-order test in Task 3 passes *before* the routes exist (the prefix guard answers 401 for any `/classes/**` path) — it is a regression guard, and the real red/green for the routes is the live script in the same task.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/db/src/schema/classResources.ts` (new) | The table definition. |
| `lib/db/src/schema/index.ts` | Export it. |
| `lib/db/scripts/verify-schema.mjs` | One-line description of what goes dark without it. |
| `docs/schema-push-2026-10-04-class-resources.sql` (new) | Additive SQL for production. |
| `artifacts/api-server/src/lib/classResource.ts` (new) | Pure: input validation, shaping a row for the client, which staff-upload ids to check. |
| `artifacts/api-server/src/lib/__tests__/classResource.test.ts` (new) | Its tests. |
| `artifacts/api-server/src/routes/roster.ts` | The three endpoints. |
| `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` | Guard regression test. |
| `artifacts/mobile/services/classResources.ts` (new) | Pure: types, `mergeClassShelf`, `addedKeys`, `addBodyFor`, `openTargetFor`. |
| `artifacts/mobile/services/__tests__/classResources.test.ts` (new) | Its tests. |
| `artifacts/mobile/services/resourceCatalog.ts` + its test | Retire the dormant `add-to-class` plan. |
| `artifacts/mobile/constants/resourceKind.ts` (new) | Kind → label / icon, lifted out of the Library screen. |
| `artifacts/mobile/app/curriculum/resources.tsx` | Import those instead of defining them. |
| `artifacts/mobile/services/i18n.ts` | New strings; new empty-state copy. |
| `artifacts/mobile/services/roster.ts` | `listClassResources`, `addClassResource`, `removeClassResource`. |
| `artifacts/mobile/components/classes/ClassResourceRow.tsx` (new) | One resource row on the tab. |
| `artifacts/mobile/components/classes/LibraryPickerSheet.tsx` (new) | The picker. |
| `artifacts/mobile/app/classes/[id].tsx` | Wire it all in (kept to small edits; the new UI lives in the two components above). |
| `STATUS.md` | Entry for the change. |

---

### Task 1: The `class_resources` table and its production SQL

**Files:**
- Create: `lib/db/src/schema/classResources.ts`
- Modify: `lib/db/src/schema/index.ts`
- Modify: `lib/db/scripts/verify-schema.mjs` (the `OWNS` map)
- Create: `docs/schema-push-2026-10-04-class-resources.sql`

**Interfaces:**
- Produces: `classResources` (Drizzle table) and the row type `ClassResourceRow`, both exported from `@workspace/db`. Task 3 queries it.

- [ ] **Step 1: Prepare the local database on the OLD schema**

Run the *Local verification environment* block above, **before** creating any file in this task, so `push` creates every table except `class_resources`.

- [ ] **Step 2: Add the schema file**

Create `lib/db/src/schema/classResources.ts`:

```ts
/**
 * What a teacher has put in front of a class from the Library — the second
 * thing a class's الموارد tab shows, beside the teacher's own saved materials.
 *
 * A row is a pointer plus a snapshot, not a copy of anything. `library_source`
 * and `library_native_id` say which catalogue item it points at; `title`,
 * `media_kind`, `url` and `thumbnail_url` are what the item looked like when it
 * was added, so the tab renders without downloading the Library. A staff upload
 * can be deleted afterwards — the list endpoint reports that as `unavailable`
 * rather than the row quietly dying.
 *
 * `kind` is `library` today. `link` (a teacher-pasted URL) and `file` (a device
 * upload) are reserved for later pieces and need no change to this shape except
 * that files add their own storage columns.
 *
 * Archiving is this product's "delete a class" (DELETE /classes/:id sets
 * archivedAt), so the cascade below mostly matters for deleting an account.
 *
 * Spec: docs/superpowers/specs/2026-10-04-class-resources-design.md
 */
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { classGroups } from "./students";

export const classResources = pgTable(
  "class_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    librarySource: text("library_source"),
    libraryNativeId: text("library_native_id"),
    title: text("title").notNull(),
    mediaKind: text("media_kind").notNull(),
    url: text("url"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    index("class_resources_class_idx").on(t.classGroupId),
    uniqueIndex("class_resources_library_unique")
      .on(t.classGroupId, t.librarySource, t.libraryNativeId)
      .where(sql`${t.kind} = 'library'`),
  ],
);

export type ClassResourceRow = typeof classResources.$inferSelect;
```

- [ ] **Step 3: Export it**

In `lib/db/src/schema/index.ts`, directly after the line `export * from "./lessonMedia";` add:

```ts

// What a teacher put in front of a class from the Library — see classResources.ts
export * from "./classResources";
```

- [ ] **Step 4: Tell `verify-schema` what goes dark without it**

In `lib/db/scripts/verify-schema.mjs`, in the `OWNS` object, directly after the line `  "aiGenerations.ts": "AI spend total + cache-hit measurement",` add:

```js
  "classResources.ts": "the Library items on a class's Resources tab",
```

- [ ] **Step 5: Run `verify-schema` — it must FAIL (red)**

Run: `pnpm --filter @workspace/db run verify-schema; echo "exit: $?"`
Expected: output names `class_resources` as missing and `exit: 1`. (If it says `exit: 2` nothing was checked — fix `.env`/Postgres first.)

- [ ] **Step 6: Write the production SQL**

Create `docs/schema-push-2026-10-04-class-resources.sql`:

```sql
-- Class resources (piece 1: Library items on a class's Resources tab).
-- Additive only: one new table and two indexes; nothing existing is touched.
--
-- Run in the Neon SQL console against PRODUCTION, BEFORE merging the PR that
-- adds it. Until it exists the new endpoints answer 503 on write and an empty
-- list on read, so an early deploy cannot break the class screen — but nothing
-- can be added. Then confirm with
--   pnpm --filter @workspace/db run verify-schema
-- and put `schema-push: done` at the start of a line in the PR description.
CREATE TABLE IF NOT EXISTS class_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group_id uuid NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  library_source text,
  library_native_id text,
  title text NOT NULL,
  media_kind text NOT NULL,
  url text,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_resources_class_idx
  ON class_resources (class_group_id);

-- One Library item per class. Partial: a pasted link or a file (later pieces)
-- has no library source and must not collide on the NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS class_resources_library_unique
  ON class_resources (class_group_id, library_source, library_native_id)
  WHERE kind = 'library';
```

- [ ] **Step 7: Apply it locally and run `verify-schema` — it must PASS (green)**

Run:
```bash
env PGPASSWORD=pw psql -h localhost -U postgres -d iqraa -f docs/schema-push-2026-10-04-class-resources.sql
pnpm --filter @workspace/db run verify-schema; echo "exit: $?"
```
Expected: `CREATE TABLE`, `CREATE INDEX`, `CREATE INDEX`, then `verify-schema` reports every table and column present and `exit: 0`.

- [ ] **Step 8: Typecheck**

Run: `pnpm run typecheck`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add lib/db/src/schema/classResources.ts lib/db/src/schema/index.ts lib/db/scripts/verify-schema.mjs docs/schema-push-2026-10-04-class-resources.sql
git commit -m "Add the class_resources table and its production SQL"
```

---

### Task 2: Server-side validation and shaping (pure, tested)

**Files:**
- Create: `artifacts/api-server/src/lib/classResource.ts`
- Test: `artifacts/api-server/src/lib/__tests__/classResource.test.ts`

**Interfaces:**
- Consumes: `LIBRARY_CATEGORIES`, `LibraryCategory` from `./libraryResource.ts`.
- Produces (Task 3 uses all of these):
  - `parseClassResourceInput(body: unknown): ClassResourceInput | { error: string }`
  - `type ClassResourceInput = { source: "uploaded"; nativeId: string } | { source: "premade-sheet" | "book-qr"; nativeId: string; title: string; mediaKind: MediaKind; url: string | null; thumbnailUrl: string | null }`
  - `isUuid(value: unknown): value is string`
  - `uploadedLibraryIds(rows: ReadonlyArray<{ librarySource: string | null; libraryNativeId: string | null }>): string[]`
  - `presentClassResource(row: ClassResourceRowLike, presentLibraryIds: ReadonlySet<string>): ClientClassResource`

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/lib/__tests__/classResource.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isUuid,
  parseClassResourceInput,
  presentClassResource,
  uploadedLibraryIds,
} from "../classResource.ts";

const UUID = "3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b";
const OTHER_UUID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const premade = {
  kind: "library",
  source: "premade-sheet",
  nativeId: "pw-kbl-math-s1-nccd-u1_l1-medium",
  title: "  ورقة عمل: الاقترانات  ",
  mediaKind: "worksheet",
};
const qr = {
  kind: "library",
  source: "book-qr",
  nativeId: "31:http://example.test/a",
  title: "كتاب الرياضيات",
  mediaKind: "video",
  url: "http://example.test/a",
};

function ok(input: unknown) {
  const parsed = parseClassResourceInput(input);
  assert.ok(!("error" in parsed), `expected ok, got ${JSON.stringify(parsed)}`);
  return parsed;
}
function bad(input: unknown): string {
  const parsed = parseClassResourceInput(input);
  assert.ok("error" in parsed, `expected an error, got ${JSON.stringify(parsed)}`);
  return parsed.error;
}

describe("class resource input", () => {
  it("takes a staff upload by id alone and ignores whatever else the app sent", () => {
    const parsed = ok({ kind: "library", source: "uploaded", nativeId: UUID, title: "x", url: "https://evil.test" });
    assert.deepEqual(parsed, { source: "uploaded", nativeId: UUID });
  });

  it("rejects a staff upload whose id is not a uuid", () => {
    assert.match(bad({ kind: "library", source: "uploaded", nativeId: "not-a-uuid" }), /nativeId/);
  });

  it("accepts a premade sheet, trims its title, and drops any url (it never leaves the app)", () => {
    const parsed = ok({ ...premade, url: "https://example.test/x" });
    assert.ok(parsed.source === "premade-sheet");
    assert.equal(parsed.title, "ورقة عمل: الاقترانات");
    assert.equal(parsed.url, null);
    assert.equal(parsed.thumbnailUrl, null);
  });

  it("accepts a book-QR link over plain http, because some printed codes use it", () => {
    const parsed = ok(qr);
    assert.ok(parsed.source === "book-qr");
    assert.equal(parsed.url, "http://example.test/a");
  });

  it("requires a url for a book-QR code", () => {
    assert.match(bad({ ...qr, url: undefined }), /url/);
  });

  it("refuses a url that is not http(s), so a tap never lands on javascript:", () => {
    assert.match(bad({ ...qr, url: "javascript:alert(1)" }), /url/);
    assert.match(bad({ ...qr, url: "ftp://example.test/a" }), /url/);
  });

  it("refuses a url longer than 2048 characters", () => {
    assert.match(bad({ ...qr, url: `https://example.test/${"a".repeat(2048)}` }), /url/);
  });

  it("only takes an https thumbnail", () => {
    assert.match(bad({ ...premade, thumbnailUrl: "http://example.test/t.jpg" }), /thumbnailUrl/);
    const parsed = ok({ ...premade, thumbnailUrl: "https://example.test/t.jpg" });
    assert.ok(parsed.source === "premade-sheet");
    assert.equal(parsed.thumbnailUrl, "https://example.test/t.jpg");
  });

  it("refuses a media kind outside the Library's categories and 'page'", () => {
    assert.match(bad({ ...premade, mediaKind: "movie" }), /mediaKind/);
    ok({ ...qr, mediaKind: "page" });
  });

  it("refuses an empty or over-long title instead of silently trimming it", () => {
    assert.match(bad({ ...premade, title: "   " }), /title/);
    assert.match(bad({ ...premade, title: "ا".repeat(201) }), /title/);
  });

  it("refuses a kind other than library, an unknown source, and a body that is not an object", () => {
    assert.match(bad({ ...premade, kind: "link" }), /kind/);
    assert.match(bad({ ...premade, source: "dropbox" }), /source/);
    assert.match(bad(null), /body/);
    assert.match(bad("x"), /body/);
  });
});

describe("isUuid", () => {
  it("recognises a uuid and nothing looser", () => {
    assert.equal(isUuid(UUID), true);
    assert.equal(isUuid("3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5"), false);
    assert.equal(isUuid(""), false);
    assert.equal(isUuid(undefined), false);
  });
});

describe("which staff uploads to look up", () => {
  it("returns only the uploaded rows' uuids", () => {
    const ids = uploadedLibraryIds([
      { librarySource: "uploaded", libraryNativeId: UUID },
      { librarySource: "premade-sheet", libraryNativeId: "pw-x" },
      { librarySource: "uploaded", libraryNativeId: "not-a-uuid" },
      { librarySource: "uploaded", libraryNativeId: null },
      { librarySource: "uploaded", libraryNativeId: OTHER_UUID },
    ]);
    assert.deepEqual(ids, [UUID, OTHER_UUID]);
  });
});

describe("shaping a row for the app", () => {
  const row = {
    id: "r1",
    kind: "library",
    librarySource: "uploaded",
    libraryNativeId: UUID,
    title: "فيديو",
    mediaKind: "video",
    url: "https://example.test/v",
    thumbnailUrl: null,
    createdAt: new Date("2026-10-04T10:00:00.000Z"),
  };

  it("flags a staff upload whose library row is gone as unavailable", () => {
    assert.equal(presentClassResource(row, new Set()).unavailable, true);
    assert.equal(presentClassResource(row, new Set([UUID])).unavailable, false);
  });

  it("never flags a premade sheet or a book-QR code — they ship with the app", () => {
    const sheet = { ...row, librarySource: "premade-sheet", libraryNativeId: "pw-x" };
    const code = { ...row, librarySource: "book-qr", libraryNativeId: "31:http://example.test/a" };
    assert.equal(presentClassResource(sheet, new Set()).unavailable, false);
    assert.equal(presentClassResource(code, new Set()).unavailable, false);
  });

  it("renames the columns the way the app reads them and serialises the date", () => {
    assert.deepEqual(presentClassResource(row, new Set([UUID])), {
      id: "r1",
      kind: "library",
      source: "uploaded",
      nativeId: UUID,
      title: "فيديو",
      mediaKind: "video",
      url: "https://example.test/v",
      thumbnailUrl: null,
      createdAt: "2026-10-04T10:00:00.000Z",
      unavailable: false,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/classResource.test.ts 2>&1 | grep -E "Cannot find module|# (pass|fail)"`
Expected: FAIL — `Cannot find module '.../classResource.ts'`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/api-server/src/lib/classResource.ts`:

```ts
/**
 * Rules for a class's Library resources (routes/roster.ts,
 * /classes/:id/resources): what the app may send, and what the app is sent
 * back. Pure, so the decisions are testable without a database. Sibling of
 * libraryResource.ts, which governs the Library itself.
 *
 * Spec: docs/superpowers/specs/2026-10-04-class-resources-design.md
 */
import { LIBRARY_CATEGORIES, type LibraryCategory } from "./libraryResource.ts";

export const LIBRARY_SOURCES = ["uploaded", "premade-sheet", "book-qr"] as const;
export type LibrarySource = (typeof LIBRARY_SOURCES)[number];

/** The Library categories plus `page`, which a book-QR code can point at. */
export const MEDIA_KINDS = [...LIBRARY_CATEGORIES, "page"] as const;
export type MediaKind = LibraryCategory | "page";

function isLibrarySource(value: unknown): value is LibrarySource {
  return typeof value === "string" && (LIBRARY_SOURCES as readonly string[]).includes(value);
}

function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const MAX_TITLE = 200;
const MAX_URL = 2048;
const MAX_THUMBNAIL = 2000;
/** A book-QR id is `<page>:<url>`, so it is as long as a url. */
const MAX_NATIVE_ID = 2200;

export type ClassResourceInput =
  | { source: "uploaded"; nativeId: string }
  | {
      source: "premade-sheet" | "book-qr";
      nativeId: string;
      title: string;
      mediaKind: MediaKind;
      url: string | null;
      thumbnailUrl: string | null;
    };

/** A well-formed link within `max` characters, or null. Never truncates: a clipped url saves a link that 404s. */
function parseUrl(value: unknown, allowHttp: boolean, max: number): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > max) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || (allowHttp && url.protocol === "http:")) return url.toString();
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates the body of `POST /classes/:id/resources`.
 *
 * A staff upload is identified by its id alone: the route copies title, kind
 * and link from its own `library_resources` row, so nothing else the app sent
 * is read. A premade sheet or a book-QR code lives in the app's own bundle
 * where the server cannot see it, so the snapshot the app sends is validated.
 */
export function parseClassResourceInput(body: unknown): ClassResourceInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "A JSON body is required" };
  const b = body as Record<string, unknown>;

  if (b["kind"] !== "library") return { error: "kind must be library" };
  const source = b["source"];
  if (!isLibrarySource(source)) return { error: `source must be one of ${LIBRARY_SOURCES.join(", ")}` };

  const nativeId = typeof b["nativeId"] === "string" ? b["nativeId"].trim() : "";
  if (!nativeId || nativeId.length > MAX_NATIVE_ID) return { error: "nativeId is required" };

  if (source === "uploaded") {
    if (!isUuid(nativeId)) return { error: "nativeId must be a library item id" };
    return { source, nativeId };
  }

  const title = typeof b["title"] === "string" ? b["title"].trim() : "";
  if (!title) return { error: "title is required" };
  if (title.length > MAX_TITLE) return { error: `title must be at most ${MAX_TITLE} characters` };

  const mediaKind = b["mediaKind"];
  if (!isMediaKind(mediaKind)) return { error: `mediaKind must be one of ${MEDIA_KINDS.join(", ")}` };

  // A premade sheet never leaves the app, so any url sent with it is dropped.
  let url: string | null = null;
  if (source === "book-qr") {
    url = parseUrl(b["url"], true, MAX_URL);
    if (!url) return { error: `url must be an http(s) link of at most ${MAX_URL} characters` };
  }

  let thumbnailUrl: string | null = null;
  if (b["thumbnailUrl"] != null && b["thumbnailUrl"] !== "") {
    thumbnailUrl = parseUrl(b["thumbnailUrl"], false, MAX_THUMBNAIL);
    if (!thumbnailUrl) return { error: `thumbnailUrl must be an https link of at most ${MAX_THUMBNAIL} characters` };
  }

  return { source, nativeId, title, mediaKind, url, thumbnailUrl };
}

/** The ids of staff uploads among `rows`, i.e. the ones the Library can later delete. */
export function uploadedLibraryIds(
  rows: ReadonlyArray<{ librarySource: string | null; libraryNativeId: string | null }>,
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.librarySource === "uploaded" && isUuid(row.libraryNativeId)) ids.push(row.libraryNativeId);
  }
  return ids;
}

export interface ClassResourceRowLike {
  id: string;
  kind: string;
  librarySource: string | null;
  libraryNativeId: string | null;
  title: string;
  mediaKind: string;
  url: string | null;
  thumbnailUrl: string | null;
  createdAt: Date;
}

export interface ClientClassResource {
  id: string;
  kind: string;
  source: string | null;
  nativeId: string | null;
  title: string;
  mediaKind: string;
  url: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  /** A staff upload the Library has since deleted. Premade sheets and book codes ship with the app and cannot vanish. */
  unavailable: boolean;
}

/** One row as the app reads it. `presentLibraryIds` are the staff uploads that still exist. */
export function presentClassResource(
  row: ClassResourceRowLike,
  presentLibraryIds: ReadonlySet<string>,
): ClientClassResource {
  const gone =
    row.librarySource === "uploaded" && !!row.libraryNativeId && !presentLibraryIds.has(row.libraryNativeId);
  return {
    id: row.id,
    kind: row.kind,
    source: row.librarySource,
    nativeId: row.libraryNativeId,
    title: row.title,
    mediaKind: row.mediaKind,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
    unavailable: gone,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/classResource.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` and `# pass` equal to `# tests` (16).

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/classResource.ts artifacts/api-server/src/lib/__tests__/classResource.test.ts
git commit -m "Validate and shape class resources: pure rules, tested"
```

---

### Task 3: The three endpoints, a guard test, and a live two-teacher check

**Files:**
- Modify: `artifacts/api-server/src/routes/roster.ts`
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`

**Interfaces:**
- Consumes: Task 1's `classResources`, `libraryResources`; Task 2's `parseClassResourceInput`, `presentClassResource`, `uploadedLibraryIds`, `isUuid`; existing `findLiveClass`, `failRoster`, `isSchemaMissing`, `publicUrl`.
- Produces (Task 8 relies on these shapes):
  - `GET /classes/:id/resources` → `200 { resources: ClientClassResource[] }`, newest first.
  - `POST /classes/:id/resources` body `{ kind: "library", source, nativeId, title?, mediaKind?, url?, thumbnailUrl? }` → `201 { resource: ClientClassResource }`; `409 { code: "already_added" }`; `400 { error }`; `404`; `503 { code: "roster_storage_unavailable" }`.
  - `DELETE /classes/:id/resources/:rid` → `200 { removed: <rid> }` or `404`.

- [ ] **Step 1: Add the guard regression test**

In `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`, directly after the `it("mounts both claim-code routes inside the roster's guarded prefix", …)` block (it ends with `assert.equal(post.status, 401, "minting a link code must require a token");` and `});`), add:

```ts

  it("mounts the class-resource routes inside the roster's guarded prefix", async () => {
    // Like the claim-code routes: had these landed outside `router.use(["/classes",
    // "/students"], …)` they would answer 404 rather than 401, and a teacher's class
    // shelf would be readable and writable with no token at all. NB this passes
    // before the routes exist (the prefix guard answers 401 for any /classes/** path)
    // — it is a guard against someone moving them out, not a test that they exist.
    const id = "00000000-0000-0000-0000-000000000000";
    const get = await fetch(`${base}/classes/${id}/resources`);
    assert.equal(get.status, 401, "listing class resources must require a token");

    const post = await fetch(`${base}/classes/${id}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(post.status, 401, "adding a class resource must require a token");

    const del = await fetch(`${base}/classes/${id}/resources/${id}`, { method: "DELETE" });
    assert.equal(del.status, 401, "removing a class resource must require a token");
  });
```

- [ ] **Step 2: Imports in `roster.ts`**

In the `import { … } from "@workspace/db";` block at the top of `artifacts/api-server/src/routes/roster.ts`, add `classResources,` after `classMemberships,` and `libraryResources,` after `evaluations,` (keep the list alphabetical-ish as it is). Then, after the line `import { findLiveClass } from "../lib/classOwnership.js";`, add:

```ts
import { publicUrl } from "../lib/r2.js";
import {
  isUuid,
  parseClassResourceInput,
  presentClassResource,
  uploadedLibraryIds,
} from "../lib/classResource.js";
```

- [ ] **Step 3: Add the routes**

In `roster.ts`, directly after the `router.delete("/classes/:id/students/:studentId", …)` handler (it ends `failRoster(res, err, "remove student", "Failed to remove student");` / `}` / `});`) and before `const STUDENT_GENDERS`, add:

```ts

// ─── Class resources ─────────────────────────────────────────────────────────
// What a teacher has put in front of a class from the Library. Rows are a
// pointer plus a snapshot; see lib/db/src/schema/classResources.ts and
// docs/superpowers/specs/2026-10-04-class-resources-design.md.

router.get("/classes/:id/resources", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    if (!(await findLiveClass(classId, req.user!.id))) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    let rows: (typeof classResources.$inferSelect)[];
    try {
      rows = await db
        .select()
        .from(classResources)
        .where(eq(classResources.classGroupId, classId))
        .orderBy(desc(classResources.createdAt));
    } catch (err) {
      // The table comes from a manual schema push. Until then an empty shelf is
      // the truth a teacher can act on; a 503 here would blank the class screen.
      if (isSchemaMissing(err)) {
        res.json({ resources: [] });
        return;
      }
      throw err;
    }

    // A staff upload can be deleted after a teacher added it. One query for all
    // of them, not one per row.
    const present = new Set<string>();
    const ids = uploadedLibraryIds(rows);
    if (ids.length > 0) {
      try {
        const found = await db
          .select({ id: libraryResources.id })
          .from(libraryResources)
          .where(inArray(libraryResources.id, ids));
        for (const f of found) present.add(f.id);
      } catch (err) {
        // Cannot tell, so call every row available rather than all of them gone.
        logger.error({ err }, "class resources: library lookup failed");
        for (const id of ids) present.add(id);
      }
    }

    res.json({ resources: rows.map(row => presentClassResource(row, present)) });
  } catch (err) {
    failRoster(res, err, "list class resources", "Failed to load class resources");
  }
});

router.post("/classes/:id/resources", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    if (!(await findLiveClass(classId, req.user!.id))) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const input = parseClassResourceInput(req.body);
    if ("error" in input) {
      res.status(400).json({ error: input.error });
      return;
    }

    let snapshot: { title: string; mediaKind: string; url: string | null; thumbnailUrl: string | null };
    if (input.source === "uploaded") {
      // Never trust the app for a staff upload: copy it from the Library's own row.
      const [item] = await db
        .select()
        .from(libraryResources)
        .where(eq(libraryResources.id, input.nativeId))
        .limit(1);
      if (!item) {
        res.status(404).json({ error: "Library item not found" });
        return;
      }
      snapshot = {
        title: item.titleAr,
        mediaKind: item.category,
        url: item.r2Key ? publicUrl(item.r2Key) : item.sourceUrl,
        thumbnailUrl: item.thumbnailUrl,
      };
    } else {
      snapshot = {
        title: input.title,
        mediaKind: input.mediaKind,
        url: input.url,
        thumbnailUrl: input.thumbnailUrl,
      };
    }

    const [row] = await db
      .insert(classResources)
      .values({
        classGroupId: classId,
        teacherId: req.user!.id,
        kind: "library",
        librarySource: input.source,
        libraryNativeId: input.nativeId,
        ...snapshot,
      })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      // The partial unique index refused it: this item is already on the shelf.
      res.status(409).json({ code: "already_added", error: "Already added to this class" });
      return;
    }
    res.status(201).json({ resource: presentClassResource(row, new Set([input.nativeId])) });
  } catch (err) {
    failRoster(res, err, "add class resource", "Failed to add the resource");
  }
});

router.delete("/classes/:id/resources/:rid", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const rid = req.params["rid"] as string;
    if (!(await findLiveClass(classId, req.user!.id))) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    // A malformed id would be a Postgres cast error (a 500); to the caller it is
    // simply not there.
    if (!isUuid(rid)) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    const removed = await db
      .delete(classResources)
      .where(
        and(
          eq(classResources.id, rid),
          eq(classResources.classGroupId, classId),
          eq(classResources.teacherId, req.user!.id),
        ),
      )
      .returning({ id: classResources.id });

    if (removed.length === 0) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    // Removes the class's row only; the Library item itself is never touched.
    res.json({ removed: rid });
  } catch (err) {
    failRoster(res, err, "remove class resource", "Failed to remove the resource");
  }
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Build and run the API suite**

Run: `cd artifacts/api-server && pnpm build && pnpm test 2>&1 | grep -E "^# (tests|pass|fail|skipped)|^not ok"`
Expected: `# fail 0`, `# skipped 0` (a non-zero skip means the build did not happen), and the new mount-order test among the passes.

- [ ] **Step 6: Live two-teacher check against local Postgres**

Start the API (`pnpm run dev:api > /tmp/api.log 2>&1 &`, then wait until `curl -s localhost:8080/api/healthz` answers `{"status":"ok"}`). Save the following as a scratch file (do not commit it) and run it with `bash`:

```bash
B=http://localhost:8080/api
PSQL="env PGPASSWORD=pw psql -h localhost -U postgres -d iqraa -qtA"
FAILED=0
VERSION=$(curl -s $B/auth/roster-consent | python3 -c 'import json,sys;print(json.load(sys.stdin)["version"])')

teacher() { # $1 = name; prints an access token
  curl -s -X POST $B/auth/register -H 'content-type: application/json' \
    -d "{\"firstName\":\"T\",\"lastName\":\"$1\",\"email\":\"$1@example.com\",\"password\":\"Verify-Pass-123!\",\"confirmPassword\":\"Verify-Pass-123!\",\"acceptedTerms\":true}" >/dev/null
  $PSQL -c "UPDATE users SET email_verified = true WHERE email='$1@example.com'" >/dev/null
  curl -s -X POST $B/auth/login -H 'content-type: application/json' \
    -d "{\"email\":\"$1@example.com\",\"password\":\"Verify-Pass-123!\"}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])'
}
req() { # METHOD TOKEN PATH [BODY] -> "<json> <status>"
  local m=$1 tok=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -w ' %{http_code}' -X "$m" "$B$path" -H "authorization: Bearer $tok" -H 'content-type: application/json' -d "$body"
  else
    curl -s -w ' %{http_code}' -X "$m" "$B$path" -H "authorization: Bearer $tok"
  fi
}
expect() { # LABEL WANT_STATUS GOT_OUTPUT
  local got=${3##* }
  if [ "$got" = "$2" ]; then echo "PASS  $1"; else echo "FAIL  $1 (want $2, got $got): $3"; FAILED=1; fi
}
jget() { python3 -c "import json,sys;d=json.loads(sys.stdin.read());print($1)"; }

A=$(teacher alpha); BT=$(teacher beta)
for T in $A $BT; do
  curl -s -X POST $B/auth/roster-consent -H "authorization: Bearer $T" -H 'content-type: application/json' -d "{\"version\":\"$VERSION\"}" >/dev/null
done
CLASS=$(curl -s -X POST $B/classes -H "authorization: Bearer $A" -H 'content-type: application/json' \
  -d '{"name":"10A","nameAr":"العاشر أ","gradeId":"grade-10","subjectId":"mathematics"}' | jget 'd["class"]["id"]')
LIB=$($PSQL -c "INSERT INTO library_resources (grade_id, subject_id, category, title_ar, source_url) VALUES ('grade-10','mathematics','video','فيديو تجريبي','https://example.com/v') RETURNING id")
P="/classes/$CLASS/resources"
SHEET='{"kind":"library","source":"premade-sheet","nativeId":"pw-demo-sheet","title":"ورقة تجريبية","mediaKind":"worksheet"}'
QR='{"kind":"library","source":"book-qr","nativeId":"31:http://example.test/a","title":"كتاب","mediaKind":"video","url":"http://example.test/a"}'

out=$(req GET $A $P);                                   expect "empty shelf reads as []"          200 "$out"
echo "$out" | grep -q '"resources":\[\]' || { echo "FAIL  empty shelf body: $out"; FAILED=1; }
out=$(req POST $A $P "{\"kind\":\"library\",\"source\":\"uploaded\",\"nativeId\":\"$LIB\",\"title\":\"IGNORED\",\"url\":\"https://evil.test\"}")
                                                        expect "add a staff upload"               201 "$out"
echo "$out" | grep -q 'فيديو تجريبي' || { echo "FAIL  snapshot should come from the library row, not the app: $out"; FAILED=1; }
echo "$out" | grep -q 'evil.test'   && { echo "FAIL  the app's url leaked into a staff upload: $out"; FAILED=1; }
out=$(req POST $A $P "{\"kind\":\"library\",\"source\":\"uploaded\",\"nativeId\":\"$LIB\"}")
                                                        expect "adding it again is a 409"         409 "$out"
echo "$out" | grep -q already_added || { echo "FAIL  409 should carry already_added: $out"; FAILED=1; }
out=$(req POST $A $P "$SHEET");                         expect "add a premade sheet"              201 "$out"
out=$(req POST $A $P "$QR");                            expect "add a book-QR over http"          201 "$out"
RID=$(echo "${out% *}" | jget 'd["resource"]["id"]')
out=$(req POST $A $P '{"kind":"library","source":"book-qr","nativeId":"x","title":"t","mediaKind":"video","url":"javascript:alert(1)"}')
                                                        expect "javascript: url refused"          400 "$out"
out=$(req POST $A $P '{"kind":"library","source":"premade-sheet","nativeId":"x","title":"t","mediaKind":"movie"}')
                                                        expect "unknown media kind refused"       400 "$out"
out=$(req POST $A $P '{"kind":"library","source":"uploaded","nativeId":"not-a-uuid"}')
                                                        expect "non-uuid upload id refused"       400 "$out"
out=$(req POST $A $P '{"kind":"library","source":"uploaded","nativeId":"00000000-0000-0000-0000-000000000000"}')
                                                        expect "unknown upload id is a 404"       404 "$out"
out=$(req GET $A $P);                                   expect "list has the shelf"               200 "$out"
[ "$(echo "${out% *}" | jget 'len(d["resources"])')" = "3" ] || { echo "FAIL  expected 3 rows: $out"; FAILED=1; }

$PSQL -c "DELETE FROM library_resources WHERE id='$LIB'" >/dev/null
out=$(req GET $A $P)
echo "$out" | python3 -c 'import json,sys;d=json.loads(sys.stdin.read().rsplit(" ",1)[0]);r=[x for x in d["resources"] if x["source"]=="uploaded"][0];sys.exit(0 if r["unavailable"] else 1)' \
  && echo "PASS  a deleted staff upload comes back unavailable" || { echo "FAIL  deleted upload not flagged: $out"; FAILED=1; }

out=$(req GET $BT $P);                                  expect "another teacher cannot read"      404 "$out"
out=$(req POST $BT $P "$SHEET");                        expect "another teacher cannot add"       404 "$out"
out=$(req DELETE $BT "$P/$RID");                        expect "another teacher cannot remove"    404 "$out"
expect "no token is a 401" 401 "$(curl -s -w ' %{http_code}' $B$P)"

out=$(req DELETE $A "$P/$RID");                         expect "remove"                           200 "$out"
out=$(req DELETE $A "$P/$RID");                         expect "remove again is a 404"            404 "$out"
out=$(req DELETE $A "$P/not-a-uuid");                   expect "malformed id is a 404, not a 500" 404 "$out"

# The schema gap: before the manual push, reads degrade and writes say so.
$PSQL -c "DROP TABLE class_resources" >/dev/null
out=$(req GET $A $P);                                   expect "missing table reads as empty"     200 "$out"
echo "$out" | grep -q '"resources":\[\]' || { echo "FAIL  missing table should read []: $out"; FAILED=1; }
out=$(req POST $A $P "$SHEET");                         expect "missing table: write is a 503"    503 "$out"
echo "$out" | grep -q roster_storage_unavailable || { echo "FAIL  503 should carry roster_storage_unavailable: $out"; FAILED=1; }
env PGPASSWORD=pw psql -h localhost -U postgres -d iqraa -qf docs/schema-push-2026-10-04-class-resources.sql >/dev/null
[ "$FAILED" = 0 ] && echo "ALL PASS" || echo "SOME CHECKS FAILED"
```

Expected: every line `PASS`, ending `ALL PASS`. (The script ends by recreating the table from the production SQL, which also re-proves that file.) Stop the API afterwards.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/routes/roster.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -m "Class resources: list, add and remove under /classes/:id/resources"
```

---

### Task 4: The app's pure shelf logic (tested)

**Files:**
- Create: `artifacts/mobile/services/classResources.ts`
- Test: `artifacts/mobile/services/__tests__/classResources.test.ts`

**Interfaces:**
- Consumes (types only): `SavedMaterial` from `./workspace.ts`; `ResourceItem`, `ResourceKind`, `ResourceSource` from `./resourceCatalog.ts`.
- Produces (Tasks 8, 9, 10 use these):
  - `interface ClassResource { id: string; kind: 'library'; source: ResourceSource; nativeId: string; title: string; mediaKind: ResourceKind; url: string | null; thumbnailUrl: string | null; createdAt: string; unavailable: boolean }`
  - `interface AddResourceBody { kind: 'library'; source: ResourceSource; nativeId: string; title?: string; mediaKind?: ResourceKind; url?: string; thumbnailUrl?: string }`
  - `type ClassShelfEntry = { type: 'material'; key: string; at: string; material: SavedMaterial } | { type: 'resource'; key: string; at: string; resource: ClassResource }`
  - `mergeClassShelf(materials: SavedMaterial[], resources: ClassResource[]): ClassShelfEntry[]`
  - `addedKeys(resources: ClassResource[]): Set<string>` — keys are `<source>:<nativeId>`, identical to `ResourceItem.key`.
  - `addBodyFor(item: ResourceItem, lang: 'ar' | 'en'): AddResourceBody`
  - `type OpenTarget = { kind: 'url'; url: string } | { kind: 'premade'; id: string } | { kind: 'none' }`
  - `openTargetFor(resource: ClassResource): OpenTarget`

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/classResources.test.ts`:

```ts
/**
 * The pure half of a class's Resources tab: how teacher materials and Library
 * resources merge into one list, what "already added" means, what the app sends
 * to add an item, and where a tap on a row goes.
 *
 * Runs with `pnpm test` in artifacts/mobile.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addBodyFor,
  addedKeys,
  mergeClassShelf,
  openTargetFor,
  type ClassResource,
} from '../classResources.ts';
import type { ResourceItem } from '../resourceCatalog.ts';
import type { SavedMaterial } from '../workspace.ts';

const material = (id: string, savedAt: string): SavedMaterial => ({
  id,
  type: 'worksheet',
  title: `m-${id}`,
  subject: '',
  grade: '',
  topic: '',
  language: 'ar',
  savedAt,
  isFavorite: false,
  content: '{}',
  formState: {},
});

const resource = (patch: Partial<ClassResource> & { id: string }): ClassResource => ({
  kind: 'library',
  source: 'uploaded',
  nativeId: patch.id,
  title: `r-${patch.id}`,
  mediaKind: 'video',
  url: 'https://example.test/v',
  thumbnailUrl: null,
  createdAt: '2026-10-04T10:00:00.000Z',
  unavailable: false,
  ...patch,
});

const item = (patch: Partial<ResourceItem>): ResourceItem => ({
  key: 'uploaded:u1',
  source: 'uploaded',
  nativeId: 'u1',
  kind: 'video',
  titleAr: 'عنوان',
  titleEn: 'Title',
  actions: ['open'],
  ...patch,
});

describe('mergeClassShelf', () => {
  it('puts the newest first, whichever kind it is', () => {
    const shelf = mergeClassShelf(
      [material('old', '2026-10-01T08:00:00.000Z'), material('new', '2026-10-04T08:00:00.000Z')],
      [resource({ id: 'mid', createdAt: '2026-10-03T08:00:00.000Z' })],
    );
    assert.deepEqual(shelf.map(e => e.key), ['material:new', 'resource:mid', 'material:old']);
  });

  it('keeps a material ahead of a resource added at the same instant', () => {
    const at = '2026-10-04T08:00:00.000Z';
    const shelf = mergeClassShelf([material('m', at)], [resource({ id: 'r', createdAt: at })]);
    assert.deepEqual(shelf.map(e => e.key), ['material:m', 'resource:r']);
  });

  it('sends an unreadable timestamp to the end rather than scrambling the order', () => {
    const shelf = mergeClassShelf(
      [material('bad', 'not a date'), material('good', '2026-10-04T08:00:00.000Z')],
      [],
    );
    assert.deepEqual(shelf.map(e => e.key), ['material:good', 'material:bad']);
  });

  it('keys a material and a resource with the same id apart', () => {
    const shelf = mergeClassShelf([material('x', '2026-10-04T08:00:00.000Z')], [resource({ id: 'x' })]);
    assert.equal(new Set(shelf.map(e => e.key)).size, 2);
  });

  it('is empty for an empty class', () => {
    assert.deepEqual(mergeClassShelf([], []), []);
  });
});

describe('addedKeys', () => {
  it('matches the key the Library catalogue gives the same item', () => {
    const upload = resource({ id: 'u1', source: 'uploaded', nativeId: 'u1' });
    const sheet = resource({ id: 'p1', source: 'premade-sheet', nativeId: 'pw-demo' });
    const code = resource({ id: 'q1', source: 'book-qr', nativeId: '31:http://example.test/a' });
    const added = addedKeys([upload, sheet, code]);
    assert.ok(added.has(item({ key: 'uploaded:u1' }).key));
    assert.ok(added.has('premade-sheet:pw-demo'));
    assert.ok(added.has('book-qr:31:http://example.test/a'));
    assert.ok(!added.has('uploaded:other'));
  });
});

describe('addBodyFor', () => {
  it('sends a staff upload by id alone — the server copies the rest from its own row', () => {
    assert.deepEqual(addBodyFor(item({ source: 'uploaded', nativeId: 'u1', url: 'https://example.test/v' }), 'ar'), {
      kind: 'library',
      source: 'uploaded',
      nativeId: 'u1',
    });
  });

  it('snapshots a premade sheet in the active language, with no url', () => {
    const sheet = item({
      key: 'premade-sheet:pw-demo',
      source: 'premade-sheet',
      nativeId: 'pw-demo',
      kind: 'worksheet',
      titleAr: 'ورقة',
      titleEn: 'Sheet',
      actions: ['print'],
    });
    assert.deepEqual(addBodyFor(sheet, 'ar'), {
      kind: 'library',
      source: 'premade-sheet',
      nativeId: 'pw-demo',
      title: 'ورقة',
      mediaKind: 'worksheet',
    });
    assert.equal(addBodyFor(sheet, 'en').title, 'Sheet');
  });

  it('falls back to the Arabic title when there is no English one', () => {
    const sheet = item({ source: 'premade-sheet', nativeId: 'p', kind: 'worksheet', titleAr: 'ورقة', titleEn: '' });
    assert.equal(addBodyFor(sheet, 'en').title, 'ورقة');
  });

  it('carries a book-QR code with its link', () => {
    const code = item({
      key: 'book-qr:31:http://example.test/a',
      source: 'book-qr',
      nativeId: '31:http://example.test/a',
      kind: 'page',
      url: 'http://example.test/a',
      page: 31,
    });
    assert.deepEqual(addBodyFor(code, 'ar'), {
      kind: 'library',
      source: 'book-qr',
      nativeId: '31:http://example.test/a',
      title: 'عنوان',
      mediaKind: 'page',
      url: 'http://example.test/a',
    });
  });
});

describe('openTargetFor', () => {
  it('opens nothing for a resource the Library no longer has', () => {
    assert.deepEqual(openTargetFor(resource({ id: 'r', unavailable: true })), { kind: 'none' });
  });

  it('opens a premade sheet in the sheet viewer, by its id', () => {
    const sheet = resource({ id: 'p', source: 'premade-sheet', nativeId: 'pw-demo', url: null });
    assert.deepEqual(openTargetFor(sheet), { kind: 'premade', id: 'pw-demo' });
  });

  it('opens a link-bearing resource at its url', () => {
    assert.deepEqual(openTargetFor(resource({ id: 'r', url: 'https://example.test/v' })), {
      kind: 'url',
      url: 'https://example.test/v',
    });
  });

  it('opens nothing when there is no url to open', () => {
    assert.deepEqual(openTargetFor(resource({ id: 'r', url: null })), { kind: 'none' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classResources.test.ts 2>&1 | grep -E "Cannot find module|# (pass|fail)"`
Expected: FAIL — `Cannot find module '.../classResources.ts'`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/mobile/services/classResources.ts`:

```ts
/**
 * The pure half of a class's Resources tab — what sits beside a teacher's own
 * materials once Library items can be put in front of a class.
 *
 * Pure on purpose: no `react-native`, no `expo-*`, and every import is a type
 * import, so the bare `node --test` runner can load it.
 *
 * Spec: docs/superpowers/specs/2026-10-04-class-resources-design.md
 */
import type { ResourceItem, ResourceKind, ResourceSource } from './resourceCatalog.ts';
import type { SavedMaterial } from './workspace.ts';

/**
 * One Library item on a class's shelf, as the server returns it. `kind` is
 * `library` today; pasted links and device files are later pieces.
 */
export interface ClassResource {
  id: string;
  kind: 'library';
  source: ResourceSource;
  nativeId: string;
  /** The title the item had when it was added. */
  title: string;
  mediaKind: ResourceKind;
  url: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  /** A staff upload the Library has since deleted. */
  unavailable: boolean;
}

/** The body of `POST /classes/:id/resources`. */
export interface AddResourceBody {
  kind: 'library';
  source: ResourceSource;
  nativeId: string;
  title?: string;
  mediaKind?: ResourceKind;
  url?: string;
  thumbnailUrl?: string;
}

export type ClassShelfEntry =
  | { type: 'material'; key: string; at: string; material: SavedMaterial }
  | { type: 'resource'; key: string; at: string; resource: ClassResource };

function timeOf(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Materials and resources as one list, newest first.
 *
 * `Array.prototype.sort` is stable, so two entries with the same timestamp keep
 * their input order: materials ahead of resources. An unreadable timestamp
 * counts as the oldest instead of making the comparator return NaN, which would
 * leave the order undefined.
 */
export function mergeClassShelf(
  materials: SavedMaterial[],
  resources: ClassResource[],
): ClassShelfEntry[] {
  const entries: ClassShelfEntry[] = [
    ...materials.map(material => ({
      type: 'material' as const,
      key: `material:${material.id}`,
      at: material.savedAt,
      material,
    })),
    ...resources.map(resource => ({
      type: 'resource' as const,
      key: `resource:${resource.id}`,
      at: resource.createdAt,
      resource,
    })),
  ];
  return entries.sort((a, b) => timeOf(b.at) - timeOf(a.at));
}

/**
 * `<source>:<nativeId>` for every resource already on the shelf — the same key
 * `ResourceItem.key` carries, so "already added" is one Set lookup in the picker.
 */
export function addedKeys(resources: ClassResource[]): Set<string> {
  return new Set(resources.map(resource => `${resource.source}:${resource.nativeId}`));
}

/**
 * What to POST for a catalogue item. A staff upload goes by id alone: the
 * server copies title, kind and link from its own row and ignores anything
 * else. A premade sheet or a book-QR code lives in this bundle where the server
 * cannot see it, so the snapshot travels with the request.
 */
export function addBodyFor(item: ResourceItem, lang: 'ar' | 'en'): AddResourceBody {
  const base = { kind: 'library' as const, source: item.source, nativeId: item.nativeId };
  if (item.source === 'uploaded') return base;
  return {
    ...base,
    title: lang === 'en' && item.titleEn ? item.titleEn : item.titleAr,
    mediaKind: item.kind,
    ...(item.source === 'book-qr' && item.url ? { url: item.url } : {}),
    ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
  };
}

export type OpenTarget =
  | { kind: 'url'; url: string }
  | { kind: 'premade'; id: string }
  | { kind: 'none' };

/** Where a tap on a resource row goes. */
export function openTargetFor(resource: ClassResource): OpenTarget {
  if (resource.unavailable) return { kind: 'none' };
  if (resource.source === 'premade-sheet') return { kind: 'premade', id: resource.nativeId };
  return resource.url ? { kind: 'url', url: resource.url } : { kind: 'none' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classResources.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, `# pass 14`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/classResources.ts artifacts/mobile/services/__tests__/classResources.test.ts
git commit -m "Class shelf logic: merge, already-added keys, add body, open target"
```

---

### Task 5: Retire the dormant `add-to-class` plan

**Files:**
- Modify: `artifacts/mobile/services/__tests__/resourceCatalog.test.ts`
- Modify: `artifacts/mobile/services/resourceCatalog.ts`

**Interfaces:**
- Consumes: nothing new. Nothing outside these two files and the Library screen's use of `item.actions.includes('print' | 'open')` depends on the removed names (grep confirmed).
- Produces: `ResourceAction` is now `'print' | 'open'`; `addToClassPlan` and `AddToClassStep` no longer exist.

- [ ] **Step 1: Update the test first**

In `artifacts/mobile/services/__tests__/resourceCatalog.test.ts`:

(a) In the import list from `'../resourceCatalog.ts'` delete the line `  addToClassPlan,`.

(b) Replace
```ts
  it('offers a pre-made sheet for printing and for a class', () => {
    const sheet = buildResourceCatalog(input).find(i => i.source === 'premade-sheet');
    assert.deepEqual([...(sheet?.actions ?? [])].sort(), ['add-to-class', 'print']);
  });
```
with
```ts
  it('offers a pre-made sheet for printing only — putting it on a class happens inside the class', () => {
    const sheet = buildResourceCatalog(input).find(i => i.source === 'premade-sheet');
    assert.deepEqual([...(sheet?.actions ?? [])].sort(), ['print']);
  });
```

(c) In `it('never offers an action it cannot carry out', …)` delete the line
```ts
      if (item.actions.includes('add-to-class')) assert.ok(addToClassPlan(item).length > 0, item.key);
```

(d) Delete the whole block at the end of the file:
```ts
describe('what "add to class" has to write', () => {
  it('materialises a teacher-owned copy of a sheet, and cannot attach shared links', () => {
    assert.deepEqual(addToClassPlan({ source: 'premade-sheet' }), ['save-material', 'attach-material']);
    assert.deepEqual(addToClassPlan({ source: 'uploaded' }), []);
    assert.deepEqual(addToClassPlan({ source: 'book-qr' }), []);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/resourceCatalog.test.ts 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: FAIL on `offers a pre-made sheet for printing only` (it still gets `['add-to-class', 'print']`).

- [ ] **Step 3: Remove the plan from the catalogue**

In `artifacts/mobile/services/resourceCatalog.ts`:

(a) Replace
```ts
/**
 * What a row lets a teacher do. `print` renders a frozen sheet; `open` opens
 * the file or link; `add-to-class` files a copy — see `addToClassPlan`.
 */
export type ResourceAction = 'add-to-class' | 'print' | 'open';
```
with
```ts
/**
 * What a row lets a teacher do on the Library screen. `print` renders a frozen
 * sheet; `open` opens the file or link. Putting a row on a class's shelf is not
 * a Library-screen action: it happens from inside the class
 * (`components/classes/LibraryPickerSheet.tsx`), as a pointer, never a copy.
 */
export type ResourceAction = 'print' | 'open';
```

(b) In `fromPremade`, replace `    actions: ['add-to-class', 'print'],` with `    actions: ['print'],`.

(c) Delete the whole block from the doc comment `/**\n * The writes "add to class" needs, in order, for a given source.` through the closing `}` of `addToClassPlan` (the `AddToClassStep` type and the `addToClassPlan` function with its `switch`).

- [ ] **Step 4: Run it to verify it passes, then typecheck**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/resourceCatalog.test.ts 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`.
Run: `pnpm run typecheck` (from the repo root) → exits 0 (this also proves nothing else referenced the removed names).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/resourceCatalog.ts artifacts/mobile/services/__tests__/resourceCatalog.test.ts
git commit -m "Retire the unwired add-to-class plan: a class holds Library items as pointers"
```

---

### Task 6: Share the kind labels and icons

**Files:**
- Create: `artifacts/mobile/constants/resourceKind.ts`
- Modify: `artifacts/mobile/app/curriculum/resources.tsx`

**Interfaces:**
- Produces: `RESOURCE_KIND_LABEL: Record<ResourceKind, TranslationKey>` and `RESOURCE_KIND_ICON: Record<ResourceKind, keyof typeof Ionicons.glyphMap>`. Tasks 9 uses both. These are an exact move of `KIND_LABEL` / `KIND_ICON`, so the Library screen must look identical.

There is no unit test to fail for a constants move; both are exhaustive `Record<ResourceKind, …>` maps, so the compiler is the check (a missing kind would not typecheck).

- [ ] **Step 1: Create the shared constants**

Create `artifacts/mobile/constants/resourceKind.ts`:

```ts
/**
 * How each kind of Library resource reads and looks — shared by the Library
 * screen and a class's Resources tab, so a video is the same icon and word in
 * both. Lived inline in `app/curriculum/resources.tsx`; a second screen needing
 * it is the point at which a copy would start to drift.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { ResourceKind } from '@/services/resourceCatalog';
import type { TranslationKey } from '@/services/i18n';

export const RESOURCE_KIND_LABEL: Record<ResourceKind, TranslationKey> = {
  infographic: 'libraryCatInfographic',
  video: 'libraryCatVideo',
  audio: 'libraryCatAudio',
  game: 'libraryCatGame',
  worksheet: 'libraryCatWorksheet',
  template: 'libraryCatTemplate',
  presentation: 'libraryCatPresentation',
  document: 'libraryCatDocument',
  image: 'qrKindImage',
  page: 'qrKindPage',
};

export const RESOURCE_KIND_ICON: Record<ResourceKind, keyof typeof Ionicons.glyphMap> = {
  infographic: 'bar-chart-outline',
  video: 'play-circle-outline',
  audio: 'musical-notes-outline',
  game: 'game-controller-outline',
  worksheet: 'document-text-outline',
  template: 'copy-outline',
  presentation: 'easel-outline',
  document: 'document-outline',
  image: 'image-outline',
  page: 'globe-outline',
};
```

- [ ] **Step 2: Use it from the Library screen**

In `artifacts/mobile/app/curriculum/resources.tsx`:

(a) Delete the two local definitions — the whole `const KIND_LABEL: Record<ResourceKind, TranslationKey> = { … };` block and the whole `const KIND_ICON: Record<ResourceKind, React.ComponentProps<typeof Ionicons>['name']> = { … };` block (they sit directly after `type Cols = 1 | 2 | 3;` and before the `/** One tile per shelf … */` comment).

(b) Directly after the line `import { CONTENT_MAX_WIDTH } from '@/constants/layout';` add:

```ts
import { RESOURCE_KIND_ICON as KIND_ICON, RESOURCE_KIND_LABEL as KIND_LABEL } from '@/constants/resourceKind';
```
(The alias keeps every existing use of `KIND_LABEL` / `KIND_ICON` in the file untouched.)

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: exits 0. If it reports `ResourceKind` (or `TranslationKey`) as an unused import in `resources.tsx`, delete just that name from its import.

- [ ] **Step 4: Run the mobile suite**

Run: `cd artifacts/mobile && pnpm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/constants/resourceKind.ts artifacts/mobile/app/curriculum/resources.tsx
git commit -m "Share the Library kind labels and icons between screens"
```

---

### Task 7: Strings

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Produces: translation keys `fromLibrary`, `libraryPickerTitle`, `libraryPickerEmpty`, `libraryPickerDone`, `resourceAdded`, `resourceTag`, `resourceUnavailable`, `classResourceFailed` (all plain strings, in `ar` and `en`); and new copy for the existing `noMaterialsDesc`. Tasks 9 and 10 use them.

The existing test `services/__tests__/i18n.test.ts` ("Arabic and English define exactly the same keys") is the red/green here.

- [ ] **Step 1: Confirm the names are free**

Run: `grep -n "fromLibrary\|libraryPickerTitle\|libraryPickerEmpty\|libraryPickerDone\|resourceAdded\|resourceTag\|resourceUnavailable\|classResourceFailed" artifacts/mobile/services/i18n.ts`
Expected: no output.

- [ ] **Step 2: Add the Arabic strings only**

In `artifacts/mobile/services/i18n.ts`, in the Arabic block, after the line `    createNewMaterial: 'أنشئ مادة جديدة',` add:

```ts
    fromLibrary: 'من المكتبة',
    libraryPickerTitle: 'أضف من المكتبة',
    libraryPickerEmpty: 'لا موارد في المكتبة لهذا الصف وهذه المادة بعد',
    libraryPickerDone: 'تم',
    resourceAdded: 'مضاف',
    resourceTag: 'المكتبة',
    resourceUnavailable: 'لم يعد متاحًا',
    classResourceFailed: 'تعذّر تحديث موارد الشعبة — حاول مرة أخرى',
```
and replace the Arabic `noMaterialsDesc` value `'أرفق درسًا أو ورقة عمل من مساحتك ليظهرا هنا'` with `'أرفق مادة من مساحتك أو موردًا من المكتبة ليظهر هنا'`.

- [ ] **Step 3: Run the i18n test — it must FAIL (red)**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/i18n.test.ts 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: FAIL on `Arabic and English define exactly the same keys`.

- [ ] **Step 4: Add the English strings**

In the English block, after the line `    createNewMaterial: 'Create a new material',` add:

```ts
    fromLibrary: 'From the Library',
    libraryPickerTitle: 'Add from the Library',
    libraryPickerEmpty: 'Nothing in the Library for this grade and subject yet',
    libraryPickerDone: 'Done',
    resourceAdded: 'Added',
    resourceTag: 'Library',
    resourceUnavailable: 'No longer available',
    classResourceFailed: "Couldn't update the class's resources — try again",
```
and replace the English `noMaterialsDesc` value `'Attach a lesson or worksheet from your workspace and it will show up here'` with `'Attach a material from your workspace or a resource from the Library and it will show up here'`.

- [ ] **Step 5: Run the i18n test — it must PASS (green)**

Run the same command as Step 3.
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/i18n.ts
git commit -m "Strings for the class Library picker and shelf"
```

---

### Task 8: The app's API calls

**Files:**
- Modify: `artifacts/mobile/services/roster.ts`

**Interfaces:**
- Consumes: Task 4's `ClassResource`, `AddResourceBody` (type imports); the existing `apiFetch`, `readJson`, `RosterError`.
- Produces (Task 10 calls these):
  - `listClassResources(classId: string): Promise<ClassResource[]>`
  - `addClassResource(classId: string, body: AddResourceBody): Promise<ClassResource | null>` — resolves `null` when the server said `409 already_added` (a double tap is not a failure); throws `RosterError` otherwise.
  - `removeClassResource(classId: string, resourceId: string): Promise<void>`

`roster.ts` imports `apiClient`, which needs React Native, so these cannot be unit-tested under `node --test`; they are checked by typecheck here and by the live run in Tasks 3 and 11. `apiFetch` already sets `Content-Type: application/json`, as `createClass` relies on.

- [ ] **Step 1: Import the types**

In `artifacts/mobile/services/roster.ts`, directly after the line `import { trackEvent } from './analytics.ts';` add:

```ts
import type { AddResourceBody, ClassResource } from './classResources.ts';
```

- [ ] **Step 2: Add the three functions**

Directly after the `removeStudentFromClass` function (it ends `await readJson(res, 'Removing student');` / `}`) add:

```ts

/**
 * The Library items a teacher has put in front of this class. The server reads
 * a missing table as an empty list, so this never fails for want of a schema.
 */
export async function listClassResources(classId: string): Promise<ClassResource[]> {
  const res = await apiFetch(`/classes/${classId}/resources`);
  const data = await readJson<{ resources: ClassResource[] }>(res, 'Loading class resources');
  return data.resources;
}

/**
 * Put a Library item on a class's shelf. Resolves with the new row, or `null`
 * when it was already there — a double tap, or a second device, is not a
 * failure the teacher needs to hear about.
 */
export async function addClassResource(
  classId: string,
  body: AddResourceBody,
): Promise<ClassResource | null> {
  const res = await apiFetch(`/classes/${classId}/resources`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  try {
    const data = await readJson<{ resource: ClassResource }>(res, 'Adding resource');
    return data.resource;
  } catch (err) {
    if (err instanceof RosterError && err.status === 409 && err.code === 'already_added') return null;
    throw err;
  }
}

/** Take an item off the class's shelf. The Library item itself is untouched. */
export async function removeClassResource(classId: string, resourceId: string): Promise<void> {
  const res = await apiFetch(`/classes/${classId}/resources/${resourceId}`, { method: 'DELETE' });
  await readJson(res, 'Removing resource');
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/services/roster.ts
git commit -m "App client for a class's Library resources"
```

---

### Task 9: The row and the picker

**Files:**
- Create: `artifacts/mobile/components/classes/ClassResourceRow.tsx`
- Create: `artifacts/mobile/components/classes/LibraryPickerSheet.tsx`

**Interfaces:**
- Consumes: Task 4 `ClassResource`; Task 6 `RESOURCE_KIND_ICON` / `RESOURCE_KIND_LABEL`; Task 7 strings; existing `listLibrary`, `buildResourceCatalog`, `filterResources`, `groupIntoShelves`, `qrResourcesForGrade`, `allPremade`, `useColors`, `useLanguage`.
- Produces (Task 10 mounts these):
  - `ClassResourceRow({ resource: ClassResource; onOpen: () => void; onRemove: () => void })`
  - `LibraryPickerSheet({ visible: boolean; group: { gradeId: string; subjectId: string }; added: ReadonlySet<string>; busyKey: string | null; onAdd: (item: ResourceItem) => void; onClose: () => void })`

These are React Native components, so (like the class screen's other sheets) they are checked by typecheck here and by driving the UI in Task 11.

- [ ] **Step 1: Create the row**

Create `artifacts/mobile/components/classes/ClassResourceRow.tsx`:

```tsx
/**
 * One Library resource on a class's Resources tab, beside the teacher's own
 * materials. Tapping opens it; ✕ takes it off the class's shelf (and only
 * that — the Library item is never touched, so there is no confirmation).
 *
 * A staff upload the Library has since deleted stays on the shelf, greyed out
 * and labelled, with its ✕ still working: the teacher should see that it went,
 * not find the row silently gone.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RESOURCE_KIND_ICON, RESOURCE_KIND_LABEL } from '@/constants/resourceKind';
import type { ClassResource } from '@/services/classResources';

export function ClassResourceRow({
  resource,
  onOpen,
  onRemove,
}: {
  resource: ClassResource;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const gone = resource.unavailable;
  const tint = gone ? colors.mutedForeground : colors.primary;

  return (
    <Pressable
      // Not `disabled`: that would swallow the ✕ on some platforms.
      onPress={gone ? undefined : onOpen}
      accessibilityRole="button"
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          opacity: gone ? 0.6 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tint + '18' }]}>
        <Ionicons name={RESOURCE_KIND_ICON[resource.mediaKind]} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={[styles.name, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }]}
        >
          {resource.title}
        </Text>
        <Text style={[styles.meta, { color: tint, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {gone
            ? t('resourceUnavailable')
            : `${t('resourceTag')} · ${t(RESOURCE_KIND_LABEL[resource.mediaKind])}`}
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('remove')}>
        <Ionicons name="close" size={20} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15 },
  meta: { fontSize: 13, lineHeight: 21, marginTop: 2 },
});
```

- [ ] **Step 2: Create the picker**

Create `artifacts/mobile/components/classes/LibraryPickerSheet.tsx`:

```tsx
/**
 * "Add from the Library" — opened from a class's «+» sheet.
 *
 * The same catalogue the Library screen shows (staff uploads, premade sheets,
 * book-QR codes), narrowed to this class's grade and subject by the existing,
 * tested `filterResources`, and ordered by the Library's own shelf order. One
 * tap adds an item and the sheet stays open, so a teacher can add several;
 * items already on the shelf read «مضاف».
 *
 * A compact row rather than the Library screen's cover cards, so that screen is
 * untouched. `listLibrary` already returns [] when the staff list cannot be
 * reached, so premade sheets and book codes still show and no error state is
 * needed here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { allPremade } from '@workspace/curriculum/premade';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RESOURCE_KIND_ICON, RESOURCE_KIND_LABEL } from '@/constants/resourceKind';
import { listLibrary, type LibraryItem } from '@/services/libraryApi';
import { qrResourcesForGrade } from '@/services/bookQrLinks';
import {
  buildResourceCatalog,
  filterResources,
  groupIntoShelves,
  type ResourceItem,
} from '@/services/resourceCatalog';

function PickerRow({
  item,
  isAdded,
  isBusy,
  onAdd,
}: {
  item: ResourceItem;
  isAdded: boolean;
  isBusy: boolean;
  onAdd: () => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const title = lang === 'ar' ? item.titleAr : item.titleEn;
  const page =
    item.page === undefined ? null : lang === 'ar' ? item.page.toLocaleString('ar-EG') : String(item.page);
  const detail = [t(RESOURCE_KIND_LABEL[item.kind]), page ? t('qrOnPage', page) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onAdd}
      disabled={isAdded || isBusy}
      accessibilityRole="button"
      style={[
        styles.row,
        { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: isAdded ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={RESOURCE_KIND_ICON[item.kind]} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, textAlign: align }}
        >
          {title}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
          {detail}
        </Text>
        {item.insecure ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: align }}>
            {t('qrInsecureRow')}
          </Text>
        ) : null}
      </View>
      {isBusy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : isAdded ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <Ionicons name="checkmark-circle" size={18} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>
            {t('resourceAdded')}
          </Text>
        </View>
      ) : (
        <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
      )}
    </Pressable>
  );
}

export function LibraryPickerSheet({
  visible,
  group,
  added,
  busyKey,
  onAdd,
  onClose,
}: {
  visible: boolean;
  /** The class's grade and subject. An empty subject means "any". */
  group: { gradeId: string; subjectId: string };
  /** `<source>:<nativeId>` of every item already on the class's shelf. */
  added: ReadonlySet<string>;
  /** The item currently being added, so its row can show a spinner. */
  busyKey: string | null;
  onAdd: (item: ResourceItem) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t } = useLanguage();
  const [uploaded, setUploaded] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !group.gradeId) return;
    let live = true;
    setLoading(true);
    void listLibrary(group.gradeId).then(rows => {
      if (!live) return;
      setUploaded(rows);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [visible, group.gradeId]);

  const items = useMemo(() => {
    const all = buildResourceCatalog({
      uploaded,
      premade: allPremade().filter(sheet => sheet.gradeId === group.gradeId),
      qr: qrResourcesForGrade(group.gradeId),
    });
    const scoped = filterResources(all, {
      gradeId: group.gradeId,
      subjectId: group.subjectId || undefined,
    });
    return groupIntoShelves(scoped).flatMap(shelf => shelf.items);
  }, [uploaded, group.gradeId, group.subjectId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {t('libraryPickerTitle')}
          </Text>
          {loading && items.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
          <FlatList
            data={items}
            keyExtractor={i => i.key}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ gap: 8 }}
            ListEmptyComponent={
              loading ? null : (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: 'Almarai_400Regular',
                    textAlign: 'center',
                    paddingVertical: 24,
                  }}
                >
                  {t('libraryPickerEmpty')}
                </Text>
              )
            }
            renderItem={({ item }) => (
              <PickerRow
                item={item}
                isAdded={added.has(item.key)}
                isBusy={busyKey === item.key}
                onAdd={() => onAdd(item)}
              />
            )}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold' }}>
                {t('libraryPickerDone')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 460, borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18 },
  row: { alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
});
```

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: exits 0. (The components are unused until Task 10, which is fine for the compiler.)

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/components/classes/ClassResourceRow.tsx artifacts/mobile/components/classes/LibraryPickerSheet.tsx
git commit -m "Library picker sheet and class resource row"
```

---

### Task 10: Wire the class screen

**Files:**
- Modify: `artifacts/mobile/app/classes/[id].tsx`

**Interfaces:**
- Consumes: Task 4 `addedKeys`, `addBodyFor`, `mergeClassShelf`, `openTargetFor`, `ClassResource`; Task 8 `listClassResources`, `addClassResource`, `removeClassResource`; Task 9 `ClassResourceRow`, `LibraryPickerSheet`; existing `openExternal` (`@/services/externalLinks`), `trackEvent` (`@/services/analytics`).
- Produces: the user-visible feature. All edits below are anchored on text that exists on `main` today; do not rely on line numbers.

- [ ] **Step 1: Imports**

(a) In the `import { … } from '@/services/roster';` list, add `addClassResource,` on its own line directly after `RosterError,`; add `listClassResources,` directly after `listClassParentContacts,`; add `removeClassResource,` directly after `removeStudentFromClass,`.

(b) Directly after the line `import { goBack } from '@/services/navigation';` add:

```ts
import { ClassResourceRow } from '@/components/classes/ClassResourceRow';
import { LibraryPickerSheet } from '@/components/classes/LibraryPickerSheet';
import {
  addBodyFor,
  addedKeys,
  mergeClassShelf,
  openTargetFor,
  type ClassResource,
} from '@/services/classResources';
import { openExternal } from '@/services/externalLinks';
import { trackEvent } from '@/services/analytics';
import type { ResourceItem } from '@/services/resourceCatalog';
```

- [ ] **Step 2: State**

Directly after the line `  const [attachingId, setAttachingId] = useState<string | null>(null);` add:

```ts
  const [resources, setResources] = useState<ClassResource[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
```

- [ ] **Step 3: Load the resources with the rest of the tab**

In `load`, directly after the line `    setMaterials(await getItems({ classId: id }));` add:

```ts
    // The shelf's second source, with its own try/catch like exams below: a
    // failure keeps what was showing and never blanks the materials.
    try {
      setResources(await listClassResources(id));
    } catch (err) {
      setError(describe(err));
    }
```

- [ ] **Step 4: Derived values (next to the other `useMemo`s, above any early return)**

Directly after the `const contactSummary = useMemo(` … `);` block add:

```ts
  const shelf = useMemo(() => mergeClassShelf(materials, resources), [materials, resources]);
  const shelfKeys = useMemo(() => addedKeys(resources), [resources]);
```

- [ ] **Step 5: Handlers**

Directly after the `onDetach` function (it ends `setMaterials(prev => prev.filter(m => m.id !== material.id));` / `};`) add:

```ts

  const onAddResource = async (item: ResourceItem) => {
    if (!id || addingKey) return;
    setAddingKey(item.key);
    try {
      await addClassResource(id, addBodyFor(item, lang as 'ar' | 'en'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent('class_resource_added', { source: item.source, mediaKind: item.kind });
      // Re-read rather than splice: the server owns the snapshot, and a 409
      // (already there) resolves quietly with nothing to splice at all.
      setResources(await listClassResources(id));
    } catch {
      setError(t('classResourceFailed'));
    } finally {
      setAddingKey(null);
    }
  };

  const onRemoveResource = async (resource: ClassResource) => {
    if (!id) return;
    try {
      await removeClassResource(id, resource.id);
      // Only drop it once the delete persisted, as onDetach does.
      setResources(prev => prev.filter(r => r.id !== resource.id));
    } catch {
      setError(t('classResourceFailed'));
    }
  };

  const onOpenResource = (resource: ClassResource) => {
    const target = openTargetFor(resource);
    if (target.kind === 'url') void openExternal(target.url);
    // `as never`: the typed route has no `premade` param, as in the Library screen.
    else if (target.kind === 'premade') {
      router.push({ pathname: '/workspace/view' as never, params: { premade: target.id } });
    }
  };
```

- [ ] **Step 6: Tab count**

Replace
```tsx
          {renderTab('materials', t('classTabMaterials'), countMaterials(materials.length, lang))}
```
with
```tsx
          {renderTab('materials', t('classTabMaterials'), countMaterials(materials.length + resources.length, lang))}
```

- [ ] **Step 7: Render both kinds in the materials list**

Replace
```tsx
        <FlatList
          data={materials}
          keyExtractor={m => m.id}
          contentContainerStyle={[{ padding: 20, paddingBottom: 100, gap: 10 }, CENTERED]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={empty('folder-open-outline', 'noMaterialsYet', 'noMaterialsDesc')}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/workspace/view', params: { id: item.id } })}
```
with
```tsx
        <FlatList
          data={shelf}
          keyExtractor={e => e.key}
          contentContainerStyle={[{ padding: 20, paddingBottom: 100, gap: 10 }, CENTERED]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={empty('folder-open-outline', 'noMaterialsYet', 'noMaterialsDesc')}
          renderItem={({ item: entry }) => {
            if (entry.type === 'resource') {
              return (
                <ClassResourceRow
                  resource={entry.resource}
                  onOpen={() => onOpenResource(entry.resource)}
                  onRemove={() => { void onRemoveResource(entry.resource); }}
                />
              );
            }
            const item = entry.material;
            return (
            <Pressable
              onPress={() => router.push({ pathname: '/workspace/view', params: { id: item.id } })}
```
and replace the end of that same `renderItem`:
```tsx
              <Pressable onPress={() => { void onDetach(item); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('remove')}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </Pressable>
          )}
        />
```
with
```tsx
              <Pressable onPress={() => { void onDetach(item); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('remove')}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </Pressable>
            );
          }}
        />
```
(The material row's own JSX is deliberately left at its current indentation to keep the diff small; re-indent only if you also run the repo's formatter over the file.)

- [ ] **Step 8: The «من المكتبة» row in the attach sheet**

In the attach `Modal`, find the comment that begins `{/* The sheet offered one way out — pick something that exists.` and insert this block **directly above it**:

```tsx
            <Pressable
              onPress={() => {
                setShowAttach(false);
                setShowLibrary(true);
              }}
              accessibilityRole="button"
              style={[
                styles.createRow,
                { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Ionicons name="library-outline" size={18} color={ACCENT} />
              <Text
                style={{
                  color: ACCENT,
                  fontFamily: 'ReadexPro_600SemiBold',
                  flex: 1,
                  textAlign: align,
                }}
              >
                {t('fromLibrary')}
              </Text>
            </Pressable>

```

- [ ] **Step 9: Mount the picker**

Directly **before** the line `      <Modal` that opens the exams attach sheet (the one with `visible={showAttachExam}`), add:

```tsx
      <LibraryPickerSheet
        visible={showLibrary}
        group={{ gradeId: group?.gradeId ?? '', subjectId: group?.subjectId ?? '' }}
        added={shelfKeys}
        busyKey={addingKey}
        onAdd={item => { void onAddResource(item); }}
        onClose={() => setShowLibrary(false)}
      />

```

- [ ] **Step 10: Typecheck and run the suite**

Run: `pnpm run typecheck` → exits 0.
Run: `cd artifacts/mobile && pnpm test 2>&1 | grep -E "^# (tests|pass|fail)"` → `# fail 0`.

- [ ] **Step 11: Commit**

```bash
git add "artifacts/mobile/app/classes/[id].tsx"
git commit -m "Class screen: add Library items from the + sheet and show them in the list"
```

---

### Task 11: Drive it, record it, open the PR

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Bring up the stack on the local database**

Use the *Local verification environment* block (the table already exists from Task 3's script). Start the API (`pnpm run dev:api > /tmp/api.log 2>&1 &`) and Expo web (`CI=1 pnpm run dev:mobile:web > /tmp/web.log 2>&1 &`; the first bundle takes a minute or more). Create one teacher and a maths class with the helper functions from Task 3's script. Give the teacher a grade/subject so the app does not send them to onboarding:

```bash
env PGPASSWORD=pw psql -h localhost -U postgres -d iqraa -c "UPDATE users SET grade_ids='[\"grade-10\"]', subject_ids='[\"mathematics\"]', teaching_assignments='[{\"gradeId\":\"grade-10\",\"subjectIds\":[\"mathematics\"]}]' WHERE email='alpha@example.com'"
env PGPASSWORD=pw psql -h localhost -U postgres -d iqraa -qtA -c "INSERT INTO library_resources (grade_id, subject_id, category, title_ar, source_url) VALUES ('grade-10','mathematics','video','فيديو تجريبي للاقترانات','https://example.com/v')"
```

- [ ] **Step 2: Drive the feature in a browser**

Playwright (global at `/opt/node22/lib/node_modules`) with the preinstalled Chromium. Seed the session by putting the access and refresh tokens in `localStorage` under `iqra_access_token` / `iqra_refresh_token` before the first navigation. **Filter every text query to visible elements** — every tab and the class screen stay mounted, so a bare text match lands on hidden copies. Skeleton:

```js
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' });
await ctx.addInitScript(([a, r]) => { localStorage.setItem('iqra_access_token', a); localStorage.setItem('iqra_refresh_token', r); }, [ACCESS, REFRESH]);
const page = await ctx.newPage();
const vis = (text, o = {}) => page.getByText(text, o).filter({ visible: true });
await page.goto(`http://localhost:8081/classes/${CLASS_ID}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
await vis('الموارد', { exact: true }).first().click();
await page.getByRole('button', { name: 'أرفق مادة' }).click();
await vis('من المكتبة').first().click();          // the new row in the + sheet
// ... add two items, assert «مضاف», press «تم», assert rows on the tab, reload, remove one
```

Verify and write down what you **observe** (do not assume):
  1. The «+» sheet shows «من المكتبة» even for a class with nothing saved.
  2. The picker lists the seeded video, at least one premade sheet, and (if the grade has any) book-QR rows; rows are in Library shelf order and each shows its kind.
  3. Tapping an item shows a spinner then «مضاف»; the sheet stays open; tapping it again does nothing.
  4. «تم» closes it; the tab lists the added rows tagged «المكتبة · <kind>"; the tab count includes them.
  5. A reload shows the same rows (they persisted); the database has the rows (`SELECT title, library_source, media_kind FROM class_resources`).
  6. A staff-upload row opens its link in a new tab; a premade-sheet row navigates to `/workspace/view?premade=…` and renders the sheet.
  7. ✕ removes only that row (and `library_resources` still has the video); re-opening the picker shows it addable again.
  8. After `DELETE FROM library_resources`, reloading shows that row greyed out and labelled «لم يعد متاحًا», with ✕ still working.
  9. Browser console shows no errors other than blocked third-party fonts/images.

Stop the servers afterwards (`lsof -ti:8080 -sTCP:LISTEN | xargs -r kill`, same for `:8081`).

- [ ] **Step 3: Final checks**

Run: `pnpm run typecheck` → exits 0.
Run: `cd artifacts/mobile && pnpm test 2>&1 | grep -E "^# (tests|pass|fail)"` → `# fail 0`.
Run: `cd artifacts/api-server && pnpm build && pnpm test 2>&1 | grep -E "^# (tests|pass|fail|skipped)"` → `# fail 0`, `# skipped 0`.

- [ ] **Step 4: Remove the temporary environment files**

Run: `rm -f .env artifacts/mobile/.env && git status --short` — only the intended files appear.

- [ ] **Step 5: Add the STATUS.md entry**

Add a new section at the top of the dated entries in `STATUS.md` (directly above the newest `## … , 2026-10-0x` heading), with the results you actually observed in Step 2 (edit any claim the run contradicted):

```markdown
## A class can hold Library items, 2026-10-04

A class's الموارد tab held one thing — the teacher's own saved materials — so a
Library video or a ready-made worksheet could not be put in front of a class.
The «+» sheet now has **«من المكتبة»**, which opens a picker filtered to the
class's grade and subject; one tap adds an item and the tab shows it beside the
teacher's materials, newest first, tagged «المكتبة».

**What a row is.** A pointer plus a snapshot (`class_resources`: which catalogue
item, and its title / kind / link as they were when added), not a copy. The tab
renders without downloading the Library. A staff upload deleted afterwards shows
greyed out as «لم يعد متاحًا» (the list endpoint checks), and ✕ removes only the
class's row. Premade sheets open in the existing read-only sheet viewer.

**Why not `saved_materials`.** A later piece (device uploads) needs a storage
key, and in an app-written JSON column the server would be signing URLs from
keys a client supplied. Here the server owns every column. Design:
`docs/superpowers/specs/2026-10-04-class-resources-design.md`; plan:
`docs/superpowers/plans/2026-10-04-class-resources-piece-1.md`.

**API** (`/classes/:id/resources`, inside the roster router so its path-scoped
auth and consent guards apply): `GET`, `POST` (a repeat is `409 already_added`,
which the app treats as success), `DELETE /:rid`. Another teacher's class is a
404. A staff upload is copied from the Library's own row, never from what the
app sent; links are https-only except book-QR codes, some of which are printed
http and keep the Library's per-row warning. A missing table reads as an empty
shelf and writes answer `503 roster_storage_unavailable`.

**Retired.** `addToClassPlan` and the `add-to-class` action: the plan was to copy
a premade sheet into the teacher's materials, nothing ever called it, and the
viewer is read-only so a copy had no use. Premade sheets advertised an action
nothing carried out.

**Schema push required before merge.** `docs/schema-push-2026-10-04-class-resources.sql`
(one table, two indexes, additive). Run it in Neon, then
`pnpm --filter @workspace/db run verify-schema`.

**Verified against the running system** (local Postgres, real API, Expo web,
headless Chromium): the «+» sheet offered «من المكتبة» on a class with nothing
saved; the picker listed the staff video and the premade sheets in Library shelf
order; one tap added an item (spinner, then «مضاف») and the sheet stayed open;
the tab showed the rows tagged «المكتبة» and the count included them; a reload
and the database both had them; a staff link opened in a new tab and a premade
sheet opened in the read-only viewer; ✕ removed only the class's row and the
Library video survived; a deleted staff upload showed greyed out as «لم يعد
متاحًا». The API was also driven with two teachers: the other teacher got 404 on read, add
and remove; a repeated add was a 409; a deleted staff upload came back
`unavailable`; with the table dropped, a read returned `[]` and a write a 503.
**Not verified on a native device**; only Expo web was driven.

**Not in this change.** Teacher-pasted links (no schema change) and device
uploads (one more push, private storage, no video under the 8 MB cap) are
pieces 2 and 3 of the spec. A Library-screen «add to class» button is out of
scope; it could reuse the same `POST`.
```

- [ ] **Step 6: Commit and push**

```bash
git add STATUS.md
git commit -m "STATUS: a class can hold Library items"
git push -u origin claude/class-resources-impl
```

- [ ] **Step 7: Open the PR as a draft and leave it draft until the SQL has run in production**

Create a draft PR into `main`. In the description: what changed (one paragraph, from the STATUS entry), what was and was not verified, a link to the spec and plan, and — **only after the owner has run `docs/schema-push-2026-10-04-class-resources.sql` against production and `verify-schema` reports it** — a line that starts exactly `schema-push: done`. Until then write the line `schema-push: pending — SQL not yet run in production` and keep the PR a draft; do not mark it ready or merge it. (CI's "schema push acknowledged" check matches `schema-push: done|n/a` at the start of a line, so it will stay red until the owner confirms — that is the check doing its job.)
