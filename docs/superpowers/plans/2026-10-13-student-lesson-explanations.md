# Student lesson explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student taps «اشرح لي الدرس» on a lesson page and reads a stored, admin-approved explanation (hook, concept cards, worked example, practice problem) from the shared artifact pool, with no model call.

**Architecture:** A read-only student endpoint looks up `ai_artifacts` rows by `kind='lesson-teaching'` and `lesson_ref` = the curriculum lesson id, and serves only rows a `system_admin` has marked `student_approved_at`. The existing `scripts/pregenerate.ts` gains a `lesson-teaching` call kind (built by a shared builder extracted from `slides.tsx`) that fills the pool and writes a review file; a separate `--approve` step posts the reviewed ids to an admin endpoint. The mobile app gets a button on the lesson page and a card screen.

**Tech Stack:** Express + Drizzle (api-server, `node --test --experimental-strip-types`), drizzle-kit migrations, Expo / React Native + expo-router (mobile, bare `node --test` for `services/__tests__`).

**Spec:** `docs/superpowers/specs/2026-10-13-student-lesson-explanations-design.md` (read its *Revision* section first).

## Global Constraints

- Extensionless relative imports only work through esbuild: anything loaded directly by `node --test` needs an explicit `.ts` extension.
- The OpenAI client throws at module scope without a key: the new server modules must not import it, `generateContent`, or `aiBudget` (a test scans for this).
- A router mounted without a path prefix sees every request: scope every guard to its path (`router.use("/student/lesson-explanation", …)`), never a bare `router.use(mw)`.
- Mobile tests run only from `artifacts/mobile/services/__tests__/**/*.test.ts` with no React Native transform: a module under test must not import `react-native`, `expo-*` or `@/` aliases at module scope. Screens and components are not unit-tested.
- Arabic is the product language and the UI is RTL-first. Every new string goes in **both** the `ar` and `en` blocks of `artifacts/mobile/services/i18n.ts` (`i18n.test.ts` fails on a missing key).
- Carry the curriculum lesson id; never re-derive a lesson from its title. A prefill call whose title grounds to a different lesson id is skipped.
- The schema deploys as migrations: edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/`. Do not `push` to production. Destructive SQL (`DROP`, `RENAME`, `SET NOT NULL`, type change) is not allowed in this change.
- A student must never trigger a model call. Nothing in the student routes reaches `generateContent`.
- `DEMO_MODE` is not touched.
- Each commit message ends with the attribution trailer the session specifies. Commit on branch `ccr-76ac8d7f-92ruo7`.
- STATUS.md is edited in the same PR when something in it stops being true (Task 9).

---

## File Structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `artifacts/api-server/src/lib/lessonExplanation.ts` | Create | Pure: choose a row, strip `teacherNote`, validate ids and bodies |
| `artifacts/api-server/src/lib/__tests__/lessonExplanation.test.ts` | Create | Tests for the above |
| `lib/db/src/schema/aiArtifacts.ts` | Modify | Add `studentApprovedAt` column and `(kind, lesson_ref)` index |
| `lib/db/migrations/0007_*.sql` (+ `meta/`) | Generate | The migration |
| `artifacts/api-server/src/lib/lessonExplanationStore.ts` | Create | The three DB reads/writes (lazy `@workspace/db` import) |
| `artifacts/api-server/src/routes/studentLessonExplanation.ts` | Create | `GET` explanation, `POST` report |
| `artifacts/api-server/src/routes/__tests__/studentLessonExplanation.test.ts` | Create | Source scan: no model, no OpenAI |
| `artifacts/api-server/src/routes/index.ts` | Modify | Mount the new router |
| `artifacts/api-server/src/routes/moderation.ts` | Modify | `POST /moderation/lesson-explanations/approve` |
| `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` | Modify | 401 guards for the three new routes |
| `artifacts/mobile/services/generatorRequests.ts` | Modify | Add `buildLessonTeachingRequest` |
| `artifacts/mobile/app/ai-tools/slides.tsx` | Modify | Call the builder instead of an inline body |
| `artifacts/mobile/services/__tests__/lessonTeachingRequest.test.ts` | Create | Builder is byte-identical to the old inline body; id-space pin |
| `artifacts/mobile/scripts/pregenerate.ts` | Modify | `lesson-teaching` kind, review file, `--approve` |
| `artifacts/mobile/services/__tests__/pregenerate.test.ts` | Modify | Tests for the new kind and `reviewEntry` |
| `artifacts/mobile/services/lessonExplanationCards.ts` | Create | Pure: stored content → list of cards |
| `artifacts/mobile/services/__tests__/lessonExplanationCards.test.ts` | Create | Tests for the above |
| `artifacts/mobile/services/lessonExplanation.ts` | Create | Fetch + report (uses `apiJson`) |
| `artifacts/mobile/components/ui/LessonExplanationButton.tsx` | Create | Student button with checking / ready / soon states |
| `artifacts/mobile/app/curriculum/lesson-explanation.tsx` | Create | The card screen |
| `artifacts/mobile/app/curriculum/lesson-detail.tsx` | Modify | Show the button to students |
| `artifacts/mobile/app/_layout.tsx` | Modify | Register the screen |
| `artifacts/mobile/services/i18n.ts` | Modify | New strings, both languages |
| `artifacts/mobile/services/__tests__/routeGating.test.ts` | Modify | Pin the route as non-teacher |
| `STATUS.md`, `CLAUDE.md`, `.gitignore` | Modify | Record what is now true |

---

### Task 1: Pure helpers for the student view

**Files:**
- Create: `artifacts/api-server/src/lib/lessonExplanation.ts`
- Test: `artifacts/api-server/src/lib/__tests__/lessonExplanation.test.ts`

**Interfaces:**
- Produces (used by Tasks 3 and 4):
  - `type ExplanationRow = { id: string; createdAt: Date; timesServed: number; content: unknown }`
  - `pickExplanation(rows: readonly ExplanationRow[]): ExplanationRow | null`
  - `stripTeacherNotes(value: unknown): unknown`
  - `isLessonRef(value: unknown): value is string`
  - `isUuid(value: unknown): value is string`
  - `parseLanguage(value: unknown): "arabic" | "english"`
  - `parseApproveBody(body: unknown): string[] | null`
  - `const APPROVE_MAX = 200`

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/lib/__tests__/lessonExplanation.test.ts`:

```ts
/**
 * What a student may see of a stored lesson explanation, and which stored row
 * they are given. All pure: the student route is a thin shell around these.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APPROVE_MAX,
  isLessonRef,
  isUuid,
  parseApproveBody,
  parseLanguage,
  pickExplanation,
  stripTeacherNotes,
  type ExplanationRow,
} from "../lessonExplanation.ts";

const row = (id: string, createdAt: string, timesServed = 0): ExplanationRow => ({
  id,
  createdAt: new Date(createdAt),
  timesServed,
  content: { id },
});

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("pickExplanation", () => {
  it("returns null when nothing is approved", () => {
    assert.equal(pickExplanation([]), null);
  });

  it("serves the newest row, so a rerun after a prompt bump replaces the old text", () => {
    const picked = pickExplanation([
      row("old", "2026-10-01T00:00:00Z", 0),
      row("new", "2026-10-09T00:00:00Z", 50),
    ]);
    assert.equal(picked?.id, "new");
  });

  it("breaks a tie on creation time by the least-served row", () => {
    const picked = pickExplanation([
      row("busy", "2026-10-09T00:00:00Z", 9),
      row("quiet", "2026-10-09T00:00:00Z", 1),
    ]);
    assert.equal(picked?.id, "quiet");
  });

  it("does not reorder the caller's array", () => {
    const rows = [row("a", "2026-10-01T00:00:00Z"), row("b", "2026-10-09T00:00:00Z")];
    pickExplanation(rows);
    assert.deepEqual(rows.map((r) => r.id), ["a", "b"]);
  });
});

describe("stripTeacherNotes", () => {
  it("removes teacherNote at every depth and keeps everything else", () => {
    const stored = {
      hook: { question: "ما هو المول؟", teacherNote: "ابدأ بسؤال" },
      concepts: [
        { title: "المول", points: ["a", "b"], teacherNote: "اشرح ببطء", misconception: "x" },
        { title: "الكتلة", points: ["c"] },
      ],
      workedExample: { problem: "p", steps: ["s1"], answer: "4" },
      practice: { problem: "q", hint: "h", answer: "5" },
    };
    assert.deepEqual(stripTeacherNotes(stored), {
      hook: { question: "ما هو المول؟" },
      concepts: [
        { title: "المول", points: ["a", "b"], misconception: "x" },
        { title: "الكتلة", points: ["c"] },
      ],
      workedExample: { problem: "p", steps: ["s1"], answer: "4" },
      practice: { problem: "q", hint: "h", answer: "5" },
    });
  });

  it("passes non-objects through and does not mutate its input", () => {
    assert.equal(stripTeacherNotes("text"), "text");
    assert.equal(stripTeacherNotes(null), null);
    const input = { a: { teacherNote: "n", b: 1 } };
    stripTeacherNotes(input);
    assert.deepEqual(input, { a: { teacherNote: "n", b: 1 } });
  });
});

describe("isLessonRef", () => {
  it("accepts a curriculum lesson id", () => {
    assert.equal(isLessonRef("kbl-math-s1-u1-l2"), true);
  });
  it("rejects anything that is not id-shaped", () => {
    for (const bad of ["", "../etc", "a b", "درس", "x".repeat(121), 5, null, undefined]) {
      assert.equal(isLessonRef(bad), false, String(bad));
    }
  });
});

describe("parseLanguage", () => {
  it("follows the server's own rule: only 'english' is English", () => {
    assert.equal(parseLanguage("english"), "english");
    assert.equal(parseLanguage("arabic"), "arabic");
    assert.equal(parseLanguage(undefined), "arabic");
    assert.equal(parseLanguage("en"), "arabic");
  });
});

describe("parseApproveBody", () => {
  it("accepts 1..200 uuids and de-duplicates them", () => {
    assert.deepEqual(parseApproveBody({ variantIds: [U1, U2, U1.toUpperCase()] }), [U1, U2]);
  });
  it("rejects everything else", () => {
    assert.equal(parseApproveBody(null), null);
    assert.equal(parseApproveBody({}), null);
    assert.equal(parseApproveBody({ variantIds: [] }), null);
    assert.equal(parseApproveBody({ variantIds: "x" }), null);
    assert.equal(parseApproveBody({ variantIds: [U1, "not-a-uuid"] }), null);
    const tooMany = Array.from({ length: APPROVE_MAX + 1 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    assert.equal(parseApproveBody({ variantIds: tooMany }), null);
  });
});

describe("isUuid", () => {
  it("is strict", () => {
    assert.equal(isUuid(U1), true);
    assert.equal(isUuid("1111"), false);
    assert.equal(isUuid(undefined), false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/lessonExplanation.test.ts`
Expected: FAIL — `Cannot find module '.../lessonExplanation.ts'`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/api-server/src/lib/lessonExplanation.ts`:

```ts
/**
 * What a student may see of a stored `lesson-teaching` artifact, and which
 * stored row they are given.
 *
 * Pure on purpose: no database and no OpenAI client, both of which throw at
 * module scope without their env vars and would make this untestable under
 * `node --test` (CLAUDE.md). The route and the store are thin shells around it.
 *
 * Students are only ever served what a `system_admin` approved
 * (`ai_artifacts.student_approved_at`); the store filters on that, so every
 * row reaching `pickExplanation` is already approved and live.
 */

export type ExplanationRow = {
  id: string;
  createdAt: Date;
  timesServed: number;
  content: unknown;
};

/**
 * The newest row wins, so rerunning the prefill after a prompt bump replaces
 * the old text instead of splitting students across versions. Rows created at
 * the same instant go to the least-served, as the teacher pool does.
 */
export function pickExplanation(rows: readonly ExplanationRow[]): ExplanationRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.timesServed - b.timesServed,
  )[0]!;
}

/**
 * `teacherNote` is stage direction for whoever is projecting the slide
 * («ابدأ بسؤال…»). A student reading alone has no use for it and it reads as
 * an instruction to someone else. Removed at every depth; nothing else is.
 */
export function stripTeacherNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTeacherNotes);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === "teacherNote") continue;
      out[key] = stripTeacherNotes(inner);
    }
    return out;
  }
  return value;
}

const LESSON_REF = /^[A-Za-z0-9_.:-]{1,120}$/;

/** Shape only. The KB lesson list lives in the mobile app, and an id that is
 *  not a lesson can only ever match an approved row, of which there are none. */
export function isLessonRef(value: unknown): value is string {
  return typeof value === "string" && LESSON_REF.test(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The prompt builders' own rule (`language !== "english"`): anything but
 *  'english' is keyed as Arabic. See `generationKeys`. */
export function parseLanguage(value: unknown): "arabic" | "english" {
  return value === "english" ? "english" : "arabic";
}

export const APPROVE_MAX = 200;

/** `{ variantIds: string[] }` with 1..200 uuids; lower-cased and de-duplicated. */
export function parseApproveBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const ids = (body as { variantIds?: unknown }).variantIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > APPROVE_MAX) return null;
  if (!ids.every(isUuid)) return null;
  return [...new Set((ids as string[]).map((id) => id.toLowerCase()))];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/lessonExplanation.test.ts`
Expected: PASS, all suites green.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/lib/lessonExplanation.ts artifacts/api-server/src/lib/__tests__/lessonExplanation.test.ts
git commit -m "feat(api): pure helpers for the student lesson-explanation view"
```

---

### Task 2: Schema — approval column and lookup index

**Files:**
- Modify: `lib/db/src/schema/aiArtifacts.ts`
- Generate: `lib/db/migrations/0007_*.sql`, `lib/db/migrations/meta/0007_snapshot.json`, `lib/db/migrations/meta/_journal.json`

**Interfaces:**
- Produces: `aiArtifacts.studentApprovedAt` (nullable `timestamp with time zone`); index `ai_artifacts_kind_lesson_idx` on `(kind, lesson_ref)`. Tasks 3 and 4 read/write the column.

- [ ] **Step 1: Edit the schema**

In `lib/db/src/schema/aiArtifacts.ts`, replace

```ts
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
```

with

```ts
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    /**
     * Set by a `system_admin` who has read this explanation and judged it fit
     * for students. `GET /student/lesson-explanation/:lessonId` serves only rows
     * with this set. Teachers are unaffected: the pool a teacher is served from
     * does not look at it.
     *
     * A gate on the data, not on a procedure. A teacher's `lesson-teaching` row
     * can be stored under the wrong lesson id (`slides.tsx` re-derives it from
     * the title), and a teacher accepts what they read where a student is a
     * minor, so "everything stored" is not the same as "everything shown".
     */
    studentApprovedAt: timestamp("student_approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
```

and replace

```ts
    uniqueIndex("ai_artifacts_key_variant_idx").on(t.strictKey, t.variantIndex),
  ],
```

with

```ts
    uniqueIndex("ai_artifacts_key_variant_idx").on(t.strictKey, t.variantIndex),
    // The student lookup: one lesson's rows of one kind, without re-deriving a
    // strictKey that changes with the model and the prompt version.
    index("ai_artifacts_kind_lesson_idx").on(t.kind, t.lessonRef),
  ],
```

- [ ] **Step 2: Generate the migration**

Run: `cd /home/user/Iqraa && pnpm --filter @workspace/db run generate`
Expected: drizzle-kit writes a new `lib/db/migrations/0007_<name>.sql`, a `meta/0007_snapshot.json`, and updates `meta/_journal.json`.

- [ ] **Step 3: Verify the SQL is additive only**

Run: `cd /home/user/Iqraa && cat lib/db/migrations/0007_*.sql`
Expected: exactly an `ALTER TABLE "ai_artifacts" ADD COLUMN "student_approved_at" timestamp with time zone;` and a `CREATE INDEX "ai_artifacts_kind_lesson_idx" ON "ai_artifacts" USING btree ("kind","lesson_ref");`.

Run: `cd /home/user/Iqraa && grep -ciE 'DROP|RENAME|SET NOT NULL|ALTER COLUMN' lib/db/migrations/0007_*.sql`
Expected: `0`. If it is not 0, stop and fix the schema edit; CI treats those as destructive.

- [ ] **Step 4: Typecheck the db package**

Run: `cd /home/user/Iqraa && pnpm --filter @workspace/db exec tsc --noEmit 2>&1 | tail -5`
Expected: no errors (if the package has no `tsc` script, run `pnpm run typecheck` from the repo root and expect it to pass).

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add lib/db/src/schema/aiArtifacts.ts lib/db/migrations
git commit -m "feat(db): student_approved_at and a (kind, lesson_ref) index on ai_artifacts"
```

---

### Task 3: Student routes, store, mount, and guards

**Files:**
- Create: `artifacts/api-server/src/lib/lessonExplanationStore.ts`
- Create: `artifacts/api-server/src/routes/studentLessonExplanation.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (import near line 19, mount near line 98)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`
- Test: `artifacts/api-server/src/routes/__tests__/studentLessonExplanation.test.ts`

**Interfaces:**
- Consumes (Task 1): `pickExplanation`, `stripTeacherNotes`, `isLessonRef`, `isUuid`, `parseLanguage`, `type ExplanationRow`. From Task 2: `aiArtifacts.studentApprovedAt`. Existing: `noteServed(id)` and `reportVariant({artifactId, reporterUserId})` from `../lib/artifactCache.ts`; `notifyAdminsOfArtifactReport({kind, lessonRef})` from `../lib/adminNotify.ts`.
- Produces (used by Task 4):
  - `readApprovedExplanations(lessonRef: string, language: "arabic" | "english"): Promise<ExplanationRow[]>`
  - `isStudentVisibleExplanation(artifactId: string): Promise<boolean>`
  - `markApprovedForStudents(ids: string[]): Promise<number>`
- Produces (HTTP, used by Task 7): `GET /api/student/lesson-explanation/:lessonId?language=arabic|english` → `200 { content, variantId }` or `404 { code: "not_available" }`; `POST /api/student/lesson-explanation/:variantId/report` → `200 { reported: true }` or `404 { code: "not_available" }`.

- [ ] **Step 1: Write the failing test (source scan)**

Create `artifacts/api-server/src/routes/__tests__/studentLessonExplanation.test.ts`:

```ts
/**
 * The student routes read a pool somebody else paid for. They must never be
 * able to cause a paid call, and the OpenAI client throws at module scope
 * without a key, so these files must also stay importable under `node --test`.
 * A source scan is the cheapest proof that neither import can creep in.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8");

const FILES = {
  route: "../studentLessonExplanation.ts",
  store: "../../lib/lessonExplanationStore.ts",
  pure: "../../lib/lessonExplanation.ts",
};

describe("student lesson-explanation modules make no model call", () => {
  for (const [name, rel] of Object.entries(FILES)) {
    it(`${name} imports no generation, budget or OpenAI code`, () => {
      const source = read(rel);
      assert.doesNotMatch(source, /generateContent|completeOnce|aiBudget|from\s+["']openai["']|new OpenAI/);
    });
  }

  it("the route guards its own prefix instead of relying on mount order", () => {
    const source = read(FILES.route);
    assert.match(source, /router\.use\(\s*"\/student\/lesson-explanation"\s*,\s*authMiddleware\s*,\s*requireRole\("student"\)\s*\)/);
    assert.doesNotMatch(source, /router\.use\(\s*authMiddleware/);
  });

  it("serves only approved rows", () => {
    assert.match(read(FILES.store), /isNotNull\(aiArtifacts\.studentApprovedAt\)/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/routes/__tests__/studentLessonExplanation.test.ts`
Expected: FAIL — `ENOENT` for `studentLessonExplanation.ts`.

- [ ] **Step 3: Write the store**

Create `artifacts/api-server/src/lib/lessonExplanationStore.ts`:

```ts
/**
 * The three database touches behind the student lesson-explanation routes.
 *
 * `@workspace/db` is imported lazily, as `artifactCache.ts` does, so the module
 * that imports this one can still be loaded under `node --test`. Errors are
 * not swallowed: a failed read is a 500 the route reports, never a quiet
 * "not available" that would hide a broken table from everyone.
 */
import type { ExplanationRow } from "./lessonExplanation.ts";

/**
 * Live, approved `lesson-teaching` rows for one lesson and language. Several
 * can exist (a prefill rerun after a prompt bump); `pickExplanation` chooses.
 */
export async function readApprovedExplanations(
  lessonRef: string,
  language: "arabic" | "english",
): Promise<ExplanationRow[]> {
  const { db, aiArtifacts } = await import("@workspace/db");
  const { and, eq, isNotNull, isNull } = await import("drizzle-orm");
  return db
    .select({
      id: aiArtifacts.id,
      createdAt: aiArtifacts.createdAt,
      timesServed: aiArtifacts.timesServed,
      content: aiArtifacts.content,
    })
    .from(aiArtifacts)
    .where(
      and(
        eq(aiArtifacts.kind, "lesson-teaching"),
        eq(aiArtifacts.lessonRef, lessonRef),
        eq(aiArtifacts.language, language),
        isNull(aiArtifacts.retiredAt),
        isNotNull(aiArtifacts.studentApprovedAt),
      ),
    );
}

/**
 * Whether this artifact is one a student can currently be shown. The report
 * route checks it so a student cannot file reports against arbitrary pool
 * rows (teacher worksheets, quizzes) and fill the admins' queue.
 */
export async function isStudentVisibleExplanation(artifactId: string): Promise<boolean> {
  const { db, aiArtifacts } = await import("@workspace/db");
  const { and, eq, isNotNull, isNull } = await import("drizzle-orm");
  const rows = await db
    .select({ id: aiArtifacts.id })
    .from(aiArtifacts)
    .where(
      and(
        eq(aiArtifacts.id, artifactId),
        eq(aiArtifacts.kind, "lesson-teaching"),
        isNull(aiArtifacts.retiredAt),
        isNotNull(aiArtifacts.studentApprovedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Mark live `lesson-teaching` rows approved for students. Returns how many
 * were newly approved; a row already approved, retired, or of another kind is
 * not counted and not touched.
 */
export async function markApprovedForStudents(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { db, aiArtifacts } = await import("@workspace/db");
  const { and, eq, inArray, isNull } = await import("drizzle-orm");
  const updated = await db
    .update(aiArtifacts)
    .set({ studentApprovedAt: new Date() })
    .where(
      and(
        inArray(aiArtifacts.id, ids),
        eq(aiArtifacts.kind, "lesson-teaching"),
        isNull(aiArtifacts.retiredAt),
        isNull(aiArtifacts.studentApprovedAt),
      ),
    )
    .returning({ id: aiArtifacts.id });
  return updated.length;
}
```

- [ ] **Step 4: Write the route**

Create `artifacts/api-server/src/routes/studentLessonExplanation.ts`:

```ts
/**
 * «اشرح لي الدرس»: a student reads a stored, admin-approved explanation of a
 * lesson.
 *
 * Read-only over the shared artifact pool. This file never calls the model:
 * it imports no generation, budget or OpenAI code, so it needs none of the
 * three guards (live mode, spend caps, per-user quota) that every generation
 * route carries — they are absent on purpose, and a student cannot cause a
 * paid call. `studentLessonExplanation.test.ts` scans for the imports.
 *
 * Only rows a `system_admin` approved are served (`student_approved_at`).
 * What is stored is not what is shown: a teacher's row can sit under the
 * wrong lesson id, and a student is a minor.
 *
 * Path-scoped guard, like every other router here — see `mountOrder.test.ts`.
 */
import { Router } from "express";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { noteServed, reportVariant } from "../lib/artifactCache.ts";
import { notifyAdminsOfArtifactReport } from "../lib/adminNotify.ts";
import {
  isLessonRef,
  isUuid,
  parseLanguage,
  pickExplanation,
  stripTeacherNotes,
} from "../lib/lessonExplanation.ts";
import {
  isStudentVisibleExplanation,
  readApprovedExplanations,
} from "../lib/lessonExplanationStore.ts";

const router = Router();

router.use("/student/lesson-explanation", authMiddleware, requireRole("student"));

/** Express types a param as `string | string[]`; a repeated one must not reach a query as an array. */
const one = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const NOT_AVAILABLE = { error: "No explanation is available for this lesson.", code: "not_available" } as const;

/** GET /student/lesson-explanation/:lessonId?language=arabic|english */
router.get("/student/lesson-explanation/:lessonId", async (req: AuthenticatedRequest, res) => {
  const lessonId = one(req.params["lessonId"]);
  if (!isLessonRef(lessonId)) {
    res.status(404).json(NOT_AVAILABLE);
    return;
  }
  try {
    const rows = await readApprovedExplanations(lessonId, parseLanguage(one(req.query["language"] as string | undefined)));
    const row = pickExplanation(rows);
    if (!row) {
      res.status(404).json(NOT_AVAILABLE);
      return;
    }
    noteServed(row.id);
    res.json({ content: stripTeacherNotes(row.content), variantId: row.id });
  } catch (err) {
    logger.error({ err, lessonId }, "student lesson-explanation read failed");
    res.status(500).json({ error: "Failed to load the explanation." });
  }
});

/**
 * POST /student/lesson-explanation/:variantId/report
 *
 * Queues a report for a `system_admin` (`routes/moderation.ts`). It does NOT
 * retire the row: a teacher may withdraw a bad paper at once because they are
 * the person holding it, but one student's tap removing an explanation for
 * every classmate — with nothing regenerating it, since a student cannot
 * trigger generation — is a bad trade. The row keeps serving until reviewed.
 */
router.post("/student/lesson-explanation/:variantId/report", async (req: AuthenticatedRequest, res) => {
  const variantId = one(req.params["variantId"]);
  if (!isUuid(variantId)) {
    res.status(404).json(NOT_AVAILABLE);
    return;
  }
  try {
    if (!(await isStudentVisibleExplanation(variantId))) {
      res.status(404).json(NOT_AVAILABLE);
      return;
    }
    const outcome = await reportVariant({ artifactId: variantId, reporterUserId: req.user!.id });
    if (!outcome.ok) {
      res.status(404).json(NOT_AVAILABLE);
      return;
    }
    if (!outcome.duplicate) {
      logger.warn(
        { artifactId: variantId, reportId: outcome.reportId, userId: req.user?.id },
        "lesson explanation reported by a student",
      );
      notifyAdminsOfArtifactReport({ kind: outcome.kind, lessonRef: outcome.lessonRef }).catch((err) =>
        logger.error({ err, artifactId: variantId }, "admin artifact-report notification failed"),
      );
    }
    res.json({ reported: true });
  } catch (err) {
    logger.error({ err, variantId }, "student lesson-explanation report failed");
    res.status(500).json({ error: "Failed to send the report." });
  }
});

export default router;
```

- [ ] **Step 5: Run the scan test**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/routes/__tests__/studentLessonExplanation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Mount the router**

In `artifacts/api-server/src/routes/index.ts`, after the line `import studentExamsRouter from "./studentExams";` add:

```ts
import studentLessonExplanationRouter from "./studentLessonExplanation";
```

and after the line `router.use(studentExamsRouter);` add:

```ts
// «اشرح لي الدرس» — authenticated, student-only, path-scoped to
// /student/lesson-explanation. Read-only over the pool; makes no model call.
router.use(studentLessonExplanationRouter);
```

- [ ] **Step 7: Add the mount-order guard test**

In `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`, directly after the test

```ts
  it("keeps published curriculum data public", async () => {
    const res = await fetch(`${base}/curriculum/grades`);
    assert.equal(res.status, 200);
  });
```

insert:

```ts
  it("guards the student lesson-explanation routes and the approval route", async () => {
    // No token: refused before any database access (DATABASE_URL is a dead
    // address here), so these prove the guards are mounted, not that a query
    // works. Role refusal (403) is requireRole's own and is exercised by the
    // existing /student routes.
    const read = await fetch(`${base}/student/lesson-explanation/kbl-x`);
    assert.equal(read.status, 401);
    const report = await fetch(
      `${base}/student/lesson-explanation/00000000-0000-4000-8000-000000000000/report`,
      { method: "POST" },
    );
    assert.equal(report.status, 401);
    const approve = await fetch(`${base}/moderation/lesson-explanations/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantIds: [] }),
    });
    assert.equal(approve.status, 401);
  });
```

(The approve route is added in Task 4; this test is run at the end of Task 4.)

- [ ] **Step 8: Typecheck**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15`
Expected: no errors in `artifacts/api-server`. (If the full run is slow, `pnpm --filter @workspace/api-server exec tsc --noEmit`.)

- [ ] **Step 9: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/lib/lessonExplanationStore.ts \
  artifacts/api-server/src/routes/studentLessonExplanation.ts \
  artifacts/api-server/src/routes/index.ts \
  artifacts/api-server/src/routes/__tests__/studentLessonExplanation.test.ts \
  artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -m "feat(api): read-only student endpoint for approved lesson explanations"
```

---

### Task 4: Admin approval endpoint

**Files:**
- Modify: `artifacts/api-server/src/routes/moderation.ts` (imports near line 40; handler before `export default router;`)

**Interfaces:**
- Consumes (Task 1): `parseApproveBody`. (Task 3): `markApprovedForStudents`.
- Produces (HTTP, used by Task 6): `POST /api/moderation/lesson-explanations/approve`, body `{ variantIds: string[] }`, `system_admin` only → `200 { requested: number, approved: number }`, `400` on a bad body.

- [ ] **Step 1: Add the imports**

In `artifacts/api-server/src/routes/moderation.ts`, after the line `import { retireVariant } from "../lib/artifactCache.ts";` add:

```ts
import { APPROVE_MAX, parseApproveBody } from "../lib/lessonExplanation.ts";
import { markApprovedForStudents } from "../lib/lessonExplanationStore.ts";
```

- [ ] **Step 2: Add the handler**

Replace the final line `export default router;` of that file with:

```ts
/**
 * POST /moderation/lesson-explanations/approve
 *
 * Body: { variantIds: string[] }  (1..200 uuids)
 *
 * Marks stored `lesson-teaching` rows as fit for students
 * (`ai_artifacts.student_approved_at`). `system_admin` only — the same role
 * that resolves artifact reports — because what this releases is shown to
 * minors. There is no revoke: retiring a row (an approved student report)
 * already stops it being served.
 *
 * The caller is `scripts/pregenerate.ts --approve=<review file>`, run after a
 * person has read the file and deleted the entries they reject.
 */
router.post(
  "/moderation/lesson-explanations/approve",
  authMiddleware,
  requireRole(...ARTIFACT_ADMIN_ROLES),
  async (req: AuthenticatedRequest, res) => {
    const ids = parseApproveBody(req.body);
    if (!ids) {
      res.status(400).json({ error: `variantIds must be 1-${APPROVE_MAX} uuids` });
      return;
    }
    try {
      const approved = await markApprovedForStudents(ids);
      logger.info(
        { moderatorId: req.user!.id, requested: ids.length, approved },
        "lesson explanations approved for students",
      );
      res.json({ requested: ids.length, approved });
    } catch (err) {
      logger.error({ err }, "approve lesson explanations failed");
      res.status(500).json({ error: "Failed to approve" });
    }
  },
);

export default router;
```

- [ ] **Step 3: Typecheck**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15`
Expected: no errors.

- [ ] **Step 4: Build and run the whole api-server suite**

Run: `cd /home/user/Iqraa/artifacts/api-server && pnpm build && pnpm test 2>&1 | tail -25`
Expected: all pass, including the new mount-order test (three 401s) and the unchanged "an unowned path is 404, not 401" test. Nothing is skipped (the bundle was just built).

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/routes/moderation.ts
git commit -m "feat(api): system_admin endpoint to approve lesson explanations for students"
```

---

### Task 5: One request builder for Slides Maker and the prefill

**Files:**
- Modify: `artifacts/mobile/services/generatorRequests.ts`
- Modify: `artifacts/mobile/app/ai-tools/slides.tsx` (the `teachingPromise` block near line 549, plus one import)
- Test: `artifacts/mobile/services/__tests__/lessonTeachingRequest.test.ts`

**Interfaces:**
- Produces (used by Tasks 5's screen edit and 6):
  - `type LessonTeachingForm = { gradeName: string; subjectName: string; topic: string; lang: 'ar' | 'en' }`
  - `buildLessonTeachingRequest(form: LessonTeachingForm, grounding: GeneratorGrounding, regen?: ReturnType<typeof regenerationFields>): AIRequest`

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/lessonTeachingRequest.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLessonById as getBrowserLessonById, getPickerGrades, getPickerSubjects } from '../curriculumData.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import {
  buildGeneratorContext,
  generatorLessonId,
  generatorUnitId,
  resolveGeneratorGrounding,
} from '../kbContext.ts';
import { buildLessonTeachingRequest } from '../generatorRequests.ts';
import { regenerationFields } from '../ai/regeneration.ts';

const grade = getPickerGrades().find(g => g.nameAr === 'الصف العاشر')!;
const subject = getPickerSubjects().find(s => s.name === 'Mathematics')!;

function* grade10MathTopics(): Generator<string> {
  for (const unit of getUnitsForSubjectGrade(subject.id, grade.id)) {
    for (const lesson of getLessonsForUnit(unit.id)) yield lesson.titleAr.trim();
  }
}

// The pool reuses a stored artifact only when the whole request hashes the
// same. Slides Maker used to build this body inline; the builder replaced it,
// so any difference here silently orphans every explanation teachers have
// already stored.
test('the builder sends exactly what Slides Maker used to build inline', () => {
  let checked = 0;
  for (const topic of grade10MathTopics()) {
    const legacy = {
      grade: grade.nameAr,
      subject: subject.name,
      topic,
      language: 'arabic',
      additionalContext: buildGeneratorContext(topic, 'ar'),
      unitId: generatorUnitId(topic, 'ar'),
      lessonId: generatorLessonId(topic, 'ar'),
      contextSource: 'curriculum',
    };
    const built = buildLessonTeachingRequest(
      { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' },
      resolveGeneratorGrounding(topic, 'ar'),
    );
    assert.deepEqual(built, legacy, topic);
    checked++;
  }
  assert.ok(checked >= 20, `expected a real lesson list, got ${checked}`);
});

test('regeneration fields are merged last, as the screen spread them', () => {
  const topic = [...grade10MathTopics()][0]!;
  const grounding = resolveGeneratorGrounding(topic, 'ar');
  const form = { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' as const };
  const regen = regenerationFields(true, undefined);
  const plain = buildLessonTeachingRequest(form, grounding);
  assert.deepEqual(buildLessonTeachingRequest(form, grounding, regen), { ...plain, ...regen });
});

test('an English request is keyed English and carries the same lesson id', () => {
  const topic = [...grade10MathTopics()][0]!;
  const ar = buildLessonTeachingRequest(
    { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' },
    resolveGeneratorGrounding(topic, 'ar'),
  );
  const en = buildLessonTeachingRequest(
    { gradeName: grade.name, subjectName: subject.name, topic, lang: 'en' },
    resolveGeneratorGrounding(topic, 'en'),
  );
  assert.equal(en.language, 'english');
  assert.equal(ar.language, 'arabic');
});

// The student endpoint looks rows up by the id the lesson page holds
// (`getLessonById` from the curriculum browser) while the pool stores the id
// the generator grounded to (the KB's). They must be one id space.
test('a KB lesson id resolves through the curriculum browser the lesson page uses', () => {
  for (const topic of grade10MathTopics()) {
    const id = resolveGeneratorGrounding(topic, 'ar').lesson?.id;
    if (!id) continue;
    assert.equal(getBrowserLessonById(id)?.id, id, topic);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonTeachingRequest.test.ts`
Expected: FAIL — `buildLessonTeachingRequest` is not exported.

- [ ] **Step 3: Add the builder**

In `artifacts/mobile/services/generatorRequests.ts`, directly above the line `export type ActivityForm = {` add:

```ts
export type LessonTeachingForm = {
  /** Localised grade name — display-only, carried into the content verbatim. */
  gradeName: string;
  /** English subject name — the string the generators branch on. */
  subjectName: string;
  topic: string;
  lang: Lang;
};

/**
 * The `/generate/lesson-teaching` body: the explanation section of a Slides
 * Maker deck, which the student lesson page reads back from the pool.
 *
 * Extracted from `slides.tsx`, which built this inline. Byte-identical to what
 * it sent (pinned by `lessonTeachingRequest.test.ts`), so explanations
 * teachers have already stored keep matching. The lesson id comes from the
 * grounding the caller already resolved, not from the title.
 */
export function buildLessonTeachingRequest(
  form: LessonTeachingForm,
  grounding: GeneratorGrounding,
  regen: ReturnType<typeof regenerationFields> = {},
): AIRequest {
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic: form.topic.trim(),
    language: form.lang === 'ar' ? 'arabic' : 'english',
    additionalContext: grounding.grounded ? grounding.context : grounding.ungroundedNote,
    unitId: nccdUnitId(grounding.lesson?.unitId),
    lessonId: grounding.lesson?.id,
    contextSource: 'curriculum' as const,
    ...regen,
  };
}

```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonTeachingRequest.test.ts`
Expected: PASS (4 tests). If the first test fails on a specific topic, the builder differs from the old body for that lesson: fix the builder, not the test.

- [ ] **Step 5: Make `slides.tsx` use the builder**

In `artifacts/mobile/app/ai-tools/slides.tsx`, after the line `import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';` add:

```ts
import { buildLessonTeachingRequest } from '@/services/generatorRequests';
```

Then replace

```tsx
      const teachingPromise = aiService
        .generateLessonTeaching({
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          language: isAr ? 'arabic' : 'english',
          additionalContext: generatorContext,
          unitId,
          lessonId,
          contextSource: 'curriculum',
          ...regen,
        }, { signal: controller.signal })
```

with

```tsx
      const teachingPromise = aiService
        .generateLessonTeaching(buildLessonTeachingRequest({
          gradeName: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subjectName: subjects[subjectIdx].name,
          topic: trimmed,
          lang,
        }, grounding, regen), { signal: controller.signal })
```

`generatorContext`, `unitId` and `lessonId` stay declared: the quick-check and lesson-plan calls below still use them.

- [ ] **Step 6: Typecheck and run the mobile suite**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15`
Expected: no errors (in particular none for `slides.tsx`: `lang` is `'ar' | 'en'` there, as it is passed to `buildGeneratorContext(trimmed, lang)` a few lines earlier).

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -15`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/generatorRequests.ts artifacts/mobile/app/ai-tools/slides.tsx \
  artifacts/mobile/services/__tests__/lessonTeachingRequest.test.ts
git commit -m "refactor(mobile): one lesson-teaching request builder for Slides Maker and the prefill"
```

---

### Task 6: Prefill — `lesson-teaching` kind, review file, `--approve`

**Files:**
- Modify (replace whole file): `artifacts/mobile/scripts/pregenerate.ts`
- Modify: `artifacts/mobile/services/__tests__/pregenerate.test.ts` (append)
- Modify: `.gitignore`

**Interfaces:**
- Consumes (Task 5): `buildLessonTeachingRequest`. (Task 4, over HTTP): `POST /api/moderation/lesson-explanations/approve`.
- Produces:
  - `plannedCalls(): Call[]` — unchanged behaviour (grade 10 maths worksheet + lesson plan).
  - `plannedTeachingCalls(): Call[]` — one `lesson-teaching` call per lesson, grade 10 Mathematics and Chemistry.
  - `reviewEntry(call: Call, json: unknown): ReviewEntry | null`
  - `type Call = { kind: 'worksheet' | 'lesson-plan' | 'lesson-teaching'; lesson: string; body: Record<string, unknown> }`
  - `type ReviewEntry = { variantId: string; lessonId: string; lesson: string; content: unknown }`

- [ ] **Step 1: Write the failing tests**

Append to `artifacts/mobile/services/__tests__/pregenerate.test.ts`, and change its import line to `import { plannedCalls, plannedTeachingCalls, reviewEntry, type Call } from '../../scripts/pregenerate.ts';`:

```ts
import { getLessonById as getBrowserLessonById } from '../curriculumData.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';

test('the lesson-teaching prefill sends the lesson\'s own id, once per lesson, in both subjects', () => {
  const calls = plannedTeachingCalls();
  // Ambiguous titles are skipped on purpose, so this is a floor, not a count.
  assert.ok(calls.length >= 30, `expected maths and chemistry lessons, got ${calls.length}`);
  assert.deepEqual(
    [...new Set(calls.map(c => (c.body as Record<string, unknown>).subject))].sort(),
    ['Chemistry', 'Mathematics'],
  );

  const ids = new Set<string>();
  for (const c of calls) {
    const b = c.body as Record<string, unknown>;
    assert.equal(c.kind, 'lesson-teaching');
    assert.equal(b.contextSource, 'curriculum', c.lesson);
    assert.equal(b.language, 'arabic');
    assert.equal(b.grade, 'الصف العاشر');
    assert.equal(b.topic, c.lesson);
    assert.ok(b.additionalContext, `no curriculum context for ${c.lesson}`);
    // The id is the grounding's, never a re-derivation from the title.
    assert.equal(b.lessonId, resolveGeneratorGrounding(c.lesson, 'ar').lesson?.id, c.lesson);
    assert.equal(getBrowserLessonById(b.lessonId as string)?.id, b.lessonId, c.lesson);
    assert.ok(!ids.has(b.lessonId as string), `duplicate lesson id ${String(b.lessonId)}`);
    ids.add(b.lessonId as string);
  }
});

test('plannedCalls is unchanged: maths worksheet + lesson plan only', () => {
  const kinds = new Set(plannedCalls().map(c => c.kind));
  assert.deepEqual([...kinds].sort(), ['lesson-plan', 'worksheet']);
});

test('reviewEntry shows what a student would read, and nothing else', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  const entry = reviewEntry(call, {
    hook: { question: 'ما المول؟', teacherNote: 'ابدأ بسؤال' },
    concepts: [{ title: 'المول', points: ['a'], teacherNote: 'اشرح' }],
    sources: [{ titleAr: 'كتاب', page: 3 }],
    servedReason: 'budget',
    variantId: 'v-1',
  });
  assert.deepEqual(entry, {
    variantId: 'v-1',
    lessonId: 'kbl-x',
    lesson: 'المول',
    content: { hook: { question: 'ما المول؟' }, concepts: [{ title: 'المول', points: ['a'] }] },
  });
});

test('reviewEntry returns null for a result that was never pooled', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  assert.equal(reviewEntry(call, { hook: { question: 'q' } }), null);
  assert.equal(reviewEntry(call, null), null);
  assert.equal(reviewEntry({ ...call, body: {} }, { variantId: 'v-1' }), null);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/pregenerate.test.ts`
Expected: FAIL — `plannedTeachingCalls` / `reviewEntry` are not exported.

- [ ] **Step 3: Replace `scripts/pregenerate.ts`**

Overwrite `artifacts/mobile/scripts/pregenerate.ts` with:

```ts
/**
 * Pre-generate default worksheets, lesson plans and lesson explanations into
 * the shared pool.
 *
 * The first teacher to ask for a lesson waits 7–14 s for the model; everyone
 * after gets the stored copy in ~0.5 s. This makes the first teacher's copy in
 * advance, for the lessons and options teachers pick by default.
 *
 * It only helps a request that matches exactly (see `generatorRequests.ts`),
 * which is why the bodies come from the same builders the screens use.
 *
 *   pnpm run pregenerate                     dry run: lists the calls and the
 *                                            worst-case cost, sends nothing
 *   PREGEN_API_BASE=https://…  PREGEN_EMAIL=…  PREGEN_PASSWORD=…  \
 *     pnpm run pregenerate -- --go [--cap=1] [--only=lesson-teaching]
 *                                            sends them, stops at the cap
 *
 * Use a dedicated account: every call counts against that account's AI quota,
 * not a real teacher's. Re-running is safe and cheap — a call the pool already
 * holds returns fast and is not counted against the cap.
 *
 * LESSON EXPLANATIONS FOR STUDENTS (`lesson-teaching`) have two more steps,
 * because what is stored is not what is shown to a minor:
 *
 *   1. `--go --only=lesson-teaching` generates (or finds) each lesson's
 *      explanation and writes `pregen-review.json` (`--review=` to rename):
 *      for each lesson, the exact text a student would read.
 *   2. A person reads the file and deletes the entries they reject. Look for
 *      wording that assumes a class or a projector ("your teacher", "the
 *      screen"), wrong maths or chemistry, and a different lesson's content.
 *   3. `pnpm run pregenerate -- --approve=pregen-review.json` marks the entries
 *      left in the file as fit for students. Needs a `system_admin` login.
 *      Nothing is approved by a run that only generates.
 *
 * ponytail: grade 10 maths (worksheets and plans) and grade 10 maths +
 * chemistry (explanations). Other grades/subjects are the `SCOPE` and
 * `TEACHING_SCOPES` lines; other option combinations only if teachers turn out
 * to change the defaults a lot (the pool's hit rate says).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { getPickerGrades, getPickerSubjects } from '../services/curriculumData.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../services/knowledgeBase.ts';
import { resolveGeneratorGrounding } from '../services/kbContext.ts';
import {
  buildLessonPlanRequest,
  buildLessonTeachingRequest,
  buildWorksheetRequest,
  groundLessonPlanTopic,
} from '../services/generatorRequests.ts';

type Scope = { gradeNameAr: string; subjectName: string };

const SCOPE: Scope = { gradeNameAr: 'الصف العاشر', subjectName: 'Mathematics' };
const TEACHING_SCOPES: Scope[] = [
  SCOPE,
  { gradeNameAr: 'الصف العاشر', subjectName: 'Chemistry' },
];
/** Conservative: gpt-4o-mini is nearer $0.003 for one of these. */
const EST_COST_PER_CALL_USD = 0.01;
/** Faster than any model call; the pool answered. */
const POOL_HIT_MS = 3000;

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const go = args.includes('--go');
const capUsd = Number(flag('cap') ?? 1);
const only = flag('only');
const reviewPath = flag('review') ?? 'pregen-review.json';
const approvePath = flag('approve');

export type Call = {
  kind: 'worksheet' | 'lesson-plan' | 'lesson-teaching';
  lesson: string;
  body: Record<string, unknown>;
};

/**
 * Every lesson in a scope whose title grounds back to itself.
 *
 * The teacher picks by title, and the request carries the title. A title that
 * grounds to a different lesson would store a copy under the wrong lesson's
 * content (and, for explanations, the wrong lesson id), so it is skipped
 * rather than pre-generated wrong.
 */
function* lessonsIn(scope: Scope) {
  const grade = getPickerGrades().find(g => g.nameAr === scope.gradeNameAr);
  const subject = getPickerSubjects().find(s => s.name === scope.subjectName);
  if (!grade || !subject) throw new Error(`scope not found: ${JSON.stringify(scope)}`);

  const seen = new Set<string>();
  for (const unit of getUnitsForSubjectGrade(subject.id, grade.id)) {
    for (const lesson of getLessonsForUnit(unit.id)) {
      const topic = lesson.titleAr.trim();
      if (seen.has(topic) || resolveGeneratorGrounding(topic, 'ar').lesson?.id !== lesson.id) continue;
      seen.add(topic);
      yield { grade, subject, topic };
    }
  }
}

/** Every worksheet and lesson-plan call the default form would make. Exported for the test. */
export function plannedCalls(): Call[] {
  const calls: Call[] = [];
  for (const { grade, subject, topic } of lessonsIn(SCOPE)) {
    const common = { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' as const };
    const worksheetForm = {
      ...common, difficulty: 'easy' as const, numQuestions: 10,
      questionTypes: ['multiple_choice', 'short_answer'] as ('multiple_choice' | 'short_answer')[], includePriorReview: false,
    };
    calls.push({
      kind: 'worksheet', lesson: topic,
      body: buildWorksheetRequest(worksheetForm, resolveGeneratorGrounding(topic, 'ar')) as unknown as Record<string, unknown>,
    });
    const planForm = {
      ...common, durationMinutes: 45, teachingStyle: 'direct' as const,
      objectives: '', adaptations: '', priorTopicsNotes: '', includePriorReview: false,
    };
    calls.push({
      kind: 'lesson-plan', lesson: topic,
      body: buildLessonPlanRequest(planForm, groundLessonPlanTopic(planForm)) as unknown as Record<string, unknown>,
    });
  }
  return calls;
}

/** One `lesson-teaching` call per lesson — the body Slides Maker sends. Exported for the test. */
export function plannedTeachingCalls(): Call[] {
  const calls: Call[] = [];
  for (const scope of TEACHING_SCOPES) {
    for (const { grade, subject, topic } of lessonsIn(scope)) {
      calls.push({
        kind: 'lesson-teaching', lesson: topic,
        body: buildLessonTeachingRequest(
          { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' },
          resolveGeneratorGrounding(topic, 'ar'),
        ) as unknown as Record<string, unknown>,
      });
    }
  }
  return calls;
}

export type ReviewEntry = { variantId: string; lessonId: string; lesson: string; content: unknown };

function withoutTeacherNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTeacherNotes);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'teacherNote')
        .map(([key, inner]) => [key, withoutTeacherNotes(inner)]),
    );
  }
  return value;
}

/**
 * What a reviewer reads for one lesson: the pool variant that was served and
 * the text a student would see (no `teacherNote`, no response metadata).
 * Null when the response carried no `variantId` — it was never pooled, so
 * there is nothing a student could be served and nothing to approve.
 */
export function reviewEntry(call: Call, json: unknown): ReviewEntry | null {
  if (!json || typeof json !== 'object') return null;
  const content: Record<string, unknown> = { ...(json as Record<string, unknown>) };
  const variantId = content.variantId;
  delete content.variantId;
  delete content.sources;
  delete content.servedReason;
  const lessonId = call.body.lessonId;
  if (typeof variantId !== 'string' || !variantId.trim()) return null;
  if (typeof lessonId !== 'string' || !lessonId) return null;
  return { variantId, lessonId, lesson: call.lesson, content: withoutTeacherNotes(content) };
}

function apiEnv() {
  const base = process.env.PREGEN_API_BASE?.replace(/\/$/, '');
  const email = process.env.PREGEN_EMAIL;
  const password = process.env.PREGEN_PASSWORD;
  if (!base || !email || !password) throw new Error('set PREGEN_API_BASE, PREGEN_EMAIL and PREGEN_PASSWORD');
  return { base, email, password };
}

async function login({ base, email, password }: ReturnType<typeof apiEnv>): Promise<string> {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status}`);
  return ((await r.json()) as { accessToken: string }).accessToken;
}

/** Mark the entries still in a reviewed file as fit for students. */
async function approve(file: string): Promise<void> {
  const env = apiEnv();
  const token = await login(env);
  const entries = JSON.parse(readFileSync(file, 'utf8')) as ReviewEntry[];
  const ids = [...new Set(entries.map(e => e.variantId))];
  let approved = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const r = await fetch(`${env.base}/api/moderation/lesson-explanations/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ variantIds: ids.slice(i, i + 100) }),
    });
    if (!r.ok) throw new Error(`approve failed: ${r.status} (needs a system_admin login)`);
    approved += ((await r.json()) as { approved: number }).approved;
  }
  console.log(`approved ${approved} of ${ids.length} (rows already approved or retired are not counted).`);
}

async function main() {
  if (approvePath) { await approve(approvePath); return; }

  const all = [...plannedCalls(), ...plannedTeachingCalls()];
  const calls = only ? all.filter(c => c.kind === only) : all;
  const maxCalls = Math.floor(capUsd / EST_COST_PER_CALL_USD);
  const byKind = (['worksheet', 'lesson-plan', 'lesson-teaching'] as const)
    .map(k => `${calls.filter(c => c.kind === k).length} ${k}`).join(', ');
  console.log(`${calls.length} calls planned (${byKind}).`);
  console.log(`Worst case at $${EST_COST_PER_CALL_USD}/call: $${(calls.length * EST_COST_PER_CALL_USD).toFixed(2)}; cap $${capUsd} allows ${maxCalls} model calls.`);
  if (!go) { console.log('Dry run — nothing sent. Add --go to send.'); return; }

  const env = apiEnv();
  const base = env.base;
  let token = await login(env);

  const review: ReviewEntry[] = [];
  let modelCalls = 0, poolHits = 0, failed = 0;
  for (const c of calls) {
    if (modelCalls >= maxCalls) { console.log(`cap reached after ${modelCalls} model calls; stopping.`); break; }
    const send = () => fetch(`${base}/api/generate/${c.kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(c.body),
    });
    const t0 = Date.now();
    let r = await send();
    if (r.status === 401) { token = await login(env); r = await send(); }
    // Two different 429s. The API allows 15 requests a minute per account, and a
    // pool hit answers in ~0.5 s, so a re-run trips it: wait as told and go on.
    // A quota/budget refusal carries a `code` and is final.
    let waits = 0;
    while (r.status === 429 && waits < 5) {
      const body = await r.clone().json().catch(() => ({})) as { code?: string };
      if (body.code === 'user_quota_exceeded' || body.code === 'budget_exceeded') break;
      const wait = Number(r.headers.get('retry-after') ?? 30) + 1;
      console.log(`rate limited — waiting ${wait}s`);
      await new Promise(res => setTimeout(res, wait * 1000));
      r = await send(); waits++;
    }
    const ms = Date.now() - t0;
    if (r.status === 429) { console.log(`429 (quota/budget) on ${c.kind} — stopping.`); break; }
    if (!r.ok) { failed++; console.log(`FAIL ${r.status} ${c.kind} ${c.lesson}`); continue; }
    if (ms < POOL_HIT_MS) { poolHits++; console.log(`stored already  ${ms}ms  ${c.kind}  ${c.lesson}`); }
    else { modelCalls++; console.log(`generated       ${ms}ms  ${c.kind}  ${c.lesson}`); }

    if (c.kind === 'lesson-teaching') {
      const entry = reviewEntry(c, await r.json().catch(() => null));
      if (entry) {
        review.push(entry);
        // Written as it goes, so a run that dies midway still leaves a file.
        writeFileSync(reviewPath, JSON.stringify(review, null, 2));
      } else {
        console.log(`  not pooled, nothing to review: ${c.lesson}`);
      }
    }
  }
  console.log(`done: ${modelCalls} generated (≤ $${(modelCalls * EST_COST_PER_CALL_USD).toFixed(2)}), ${poolHits} already stored, ${failed} failed.`);
  if (review.length > 0) {
    console.log(`${review.length} explanations to review in ${reviewPath}. Read it, delete the entries you reject, then: pnpm run pregenerate -- --approve=${reviewPath}`);
  }
}

// Only when run directly, so the test can import `plannedCalls` without a run.
if (process.argv[1]?.endsWith('pregenerate.ts')) {
  main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
```

- [ ] **Step 4: Ignore the review file**

Run: `cd /home/user/Iqraa && printf '\n# Output of scripts/pregenerate.ts (lesson explanations awaiting review)\nartifacts/mobile/pregen-review.json\n' >> .gitignore && tail -3 .gitignore`
Expected: the two new lines are the last in the file.

- [ ] **Step 5: Run the tests**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/pregenerate.test.ts`
Expected: PASS. If `plannedTeachingCalls` throws `scope not found`, the chemistry name differs from the picker's: check `getPickerSubjects().map(s => s.name)` and fix the `TEACHING_SCOPES` string, not the test.

- [ ] **Step 6: Dry-run the script**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm run pregenerate 2>&1 | tail -5`
Expected: `N calls planned (X worksheet, X lesson-plan, Y lesson-teaching).` with the same worksheet/lesson-plan counts as before, then `Dry run — nothing sent.`

- [ ] **Step 7: Typecheck**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/scripts/pregenerate.ts artifacts/mobile/services/__tests__/pregenerate.test.ts .gitignore
git commit -m "feat(mobile): prefill lesson explanations into the pool, with a review file and an approve step"
```

---

### Task 7: Mobile service and card model

**Files:**
- Create: `artifacts/mobile/services/lessonExplanationCards.ts`
- Create: `artifacts/mobile/services/lessonExplanation.ts`
- Test: `artifacts/mobile/services/__tests__/lessonExplanationCards.test.ts`

**Interfaces:**
- Consumes (HTTP, Task 3): the two student routes. Existing: `apiJson`, `ApiError` from `./apiClient.ts`; `LessonTeachingOutput` from `./ai/AIService.ts`.
- Produces (used by Task 8):
  - `type ExplanationCard = { kind: 'hook'; text: string } | { kind: 'concept'; title: string; points: string[]; misconception?: string } | { kind: 'example'; problem: string; steps: string[]; answer: string } | { kind: 'practice'; problem: string; hint?: string; answer?: string }`
  - `buildExplanationCards(content: LessonTeachingOutput | null | undefined): ExplanationCard[]`
  - `type LessonExplanation = { content: LessonTeachingOutput; variantId: string }`
  - `getLessonExplanation(lessonId: string, lang: 'ar' | 'en'): Promise<{ status: 'ok'; explanation: LessonExplanation } | { status: 'unavailable' }>` (rejects on a network or server error)
  - `reportLessonExplanation(variantId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/lessonExplanationCards.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExplanationCards } from '../lessonExplanationCards.ts';

const full = {
  hook: { question: ' ما الذي يربط عدد الجسيمات بالكتلة؟ ' },
  concepts: [
    { title: 'المول وحدة عدّ', points: ['المول = 6.022×10²³ جسيمًا', ' ', 'مثال: 12 g من الكربون'], misconception: 'المول ليس كتلة' },
    { title: 'الكتلة المولية', points: ['كتلة مول واحد بالغرام'] },
  ],
  workedExample: { problem: 'كم مولًا في 24 g من الكربون؟', steps: ['n = m / M', 'n = 24 / 12'], answer: '2 mol' },
  practice: { problem: 'كم مولًا في 36 g من الكربون؟', hint: 'اقسم على 12', answer: '3 mol' },
};

test('a full artifact becomes hook, concepts, example and practice, in that order', () => {
  const cards = buildExplanationCards(full);
  assert.deepEqual(cards.map(c => c.kind), ['hook', 'concept', 'concept', 'example', 'practice']);
  assert.deepEqual(cards[0], { kind: 'hook', text: 'ما الذي يربط عدد الجسيمات بالكتلة؟' });
});

test('blank points are dropped and a misconception is kept only when present', () => {
  const [, first, second] = buildExplanationCards(full);
  assert.deepEqual(first, {
    kind: 'concept',
    title: 'المول وحدة عدّ',
    points: ['المول = 6.022×10²³ جسيمًا', 'مثال: 12 g من الكربون'],
    misconception: 'المول ليس كتلة',
  });
  assert.equal('misconception' in second!, false);
});

test('an artifact with no worked example simply has no example card', () => {
  const cards = buildExplanationCards({ ...full, workedExample: undefined });
  assert.deepEqual(cards.map(c => c.kind), ['hook', 'concept', 'concept', 'practice']);
});

test('practice keeps hint and answer only when they exist', () => {
  const cards = buildExplanationCards({ practice: { problem: 'مسألة', hint: '  ', answer: undefined } });
  assert.deepEqual(cards, [{ kind: 'practice', problem: 'مسألة' }]);
});

test('nothing usable gives no cards, so the screen can say so instead of rendering blank', () => {
  assert.deepEqual(buildExplanationCards(null), []);
  assert.deepEqual(buildExplanationCards({}), []);
  assert.deepEqual(buildExplanationCards({ concepts: [], hook: { question: '   ' } }), []);
  // A concept with no title is not a card: a title is the idea itself.
  assert.deepEqual(buildExplanationCards({ concepts: [{ points: ['x'] }] }), []);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonExplanationCards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the card model**

Create `artifacts/mobile/services/lessonExplanationCards.ts`:

```ts
/**
 * Turns a stored `lesson-teaching` artifact into the cards the student screen
 * draws.
 *
 * Pure, with a type-only import, so it runs under bare `node --test` (the
 * screen itself cannot). The text is shown as stored, the same as the slide
 * deck shows it. Anything blank is dropped here, so the screen never renders
 * an empty card; an artifact with nothing usable yields no cards and the
 * screen says so.
 */
import type { LessonTeachingOutput } from './ai/AIService.ts';

export type ExplanationCard =
  | { kind: 'hook'; text: string }
  | { kind: 'concept'; title: string; points: string[]; misconception?: string }
  | { kind: 'example'; problem: string; steps: string[]; answer: string }
  | { kind: 'practice'; problem: string; hint?: string; answer?: string };

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const cleanList = (values: unknown): string[] =>
  Array.isArray(values) ? values.map(clean).filter(Boolean) : [];

export function buildExplanationCards(content: LessonTeachingOutput | null | undefined): ExplanationCard[] {
  if (!content) return [];
  const cards: ExplanationCard[] = [];

  const hook = clean(content.hook?.question);
  if (hook) cards.push({ kind: 'hook', text: hook });

  for (const concept of content.concepts ?? []) {
    const title = clean(concept?.title);
    if (!title) continue;
    const misconception = clean(concept.misconception);
    cards.push({
      kind: 'concept',
      title,
      points: cleanList(concept.points),
      ...(misconception ? { misconception } : {}),
    });
  }

  const example = content.workedExample;
  const exampleProblem = clean(example?.problem);
  if (exampleProblem) {
    cards.push({
      kind: 'example',
      problem: exampleProblem,
      steps: cleanList(example?.steps),
      answer: clean(example?.answer),
    });
  }

  const practice = content.practice;
  const practiceProblem = clean(practice?.problem);
  if (practiceProblem) {
    const hint = clean(practice?.hint);
    const answer = clean(practice?.answer);
    cards.push({
      kind: 'practice',
      problem: practiceProblem,
      ...(hint ? { hint } : {}),
      ...(answer ? { answer } : {}),
    });
  }

  return cards;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonExplanationCards.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the network service**

Create `artifacts/mobile/services/lessonExplanation.ts`:

```ts
/**
 * The student's call for a lesson explanation. Not unit-tested: it is a thin
 * wrapper over `apiJson`, which cannot be loaded under bare `node --test`.
 * What it decides — which cards to draw — is `lessonExplanationCards.ts`.
 *
 * Goes through `apiJson` (the signed-in session), unlike the exam link in
 * `studentExam.ts`: this is an account route, and the server requires the
 * student role.
 */
import { ApiError, apiJson } from './apiClient.ts';
import type { LessonTeachingOutput } from './ai/AIService.ts';

export type LessonExplanation = { content: LessonTeachingOutput; variantId: string };

export type ExplanationResult =
  | { status: 'ok'; explanation: LessonExplanation }
  | { status: 'unavailable' };

// Per session. The lesson page checks availability and the screen then asks
// for the same content; only a found explanation is remembered, so a lesson
// that was «قريبًا» is asked again the next time it is opened.
const cache = new Map<string, LessonExplanation>();

export async function getLessonExplanation(lessonId: string, lang: 'ar' | 'en'): Promise<ExplanationResult> {
  const key = `${lessonId}:${lang}`;
  const hit = cache.get(key);
  if (hit) return { status: 'ok', explanation: hit };
  try {
    const explanation = await apiJson<LessonExplanation>(
      `/student/lesson-explanation/${encodeURIComponent(lessonId)}?language=${lang === 'ar' ? 'arabic' : 'english'}`,
    );
    cache.set(key, explanation);
    return { status: 'ok', explanation };
  } catch (e) {
    // 404 is the server saying "nothing approved for this lesson yet", which
    // is an answer, not a failure. Anything else is a failure and rejects.
    if (e instanceof ApiError && e.status === 404) return { status: 'unavailable' };
    throw e;
  }
}

/** Queues a report for an admin. Does not remove the explanation for anyone. */
export async function reportLessonExplanation(variantId: string): Promise<void> {
  await apiJson<{ reported: boolean }>(
    `/student/lesson-explanation/${encodeURIComponent(variantId)}/report`,
    { method: 'POST' },
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/lessonExplanationCards.ts artifacts/mobile/services/lessonExplanation.ts \
  artifacts/mobile/services/__tests__/lessonExplanationCards.test.ts
git commit -m "feat(mobile): lesson-explanation service and card model"
```

---

### Task 8: Student button, screen, strings, routing

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (two inserts)
- Create: `artifacts/mobile/components/ui/LessonExplanationButton.tsx`
- Create: `artifacts/mobile/app/curriculum/lesson-explanation.tsx`
- Modify: `artifacts/mobile/app/curriculum/lesson-detail.tsx` (import near line 9, button near line 171)
- Modify: `artifacts/mobile/app/_layout.tsx` (after line 194)
- Modify: `artifacts/mobile/services/__tests__/routeGating.test.ts` (append)

**Interfaces:**
- Consumes (Task 7): `getLessonExplanation`, `reportLessonExplanation`, `buildExplanationCards`, `ExplanationCard`, `LessonExplanation`.
- Produces: route `/curriculum/lesson-explanation?lessonId=<id>&subjectColor=<hex>`; string keys `lessonExplainButton`, `lessonExplainSoon`, `lessonExplainTitle`, `lessonExplainThink`, `lessonExplainExample`, `lessonExplainPractice`, `lessonExplainShowHint`, `lessonExplainShowAnswer`, `lessonExplainAnswer`, `lessonExplainCommonMistake`, `lessonExplainReport`, `lessonExplainReported`, `lessonExplainEmpty`, `lessonExplainError`, `lessonExplainRetry`.

- [ ] **Step 1: Write the failing tests (strings and routing)**

Append to `artifacts/mobile/services/__tests__/routeGating.test.ts`:

```ts
describe('the student lesson explanation screen', () => {
  it('is reachable by a student, because /curriculum is on the non-teacher allowlist', () => {
    assert.equal(isNonTeacherRoute('/curriculum/lesson-explanation'), true);
  });
});
```

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/routeGating.test.ts`
Expected: PASS already (the route sits under `/curriculum`). It is a guard against someone narrowing the allowlist later.

- [ ] **Step 2: Add the strings (Arabic)**

In `artifacts/mobile/services/i18n.ts`, in the **Arabic** block, replace

```ts
    lessonNotFound: 'لم نجد هذا الدرس',
```

with

```ts
    lessonNotFound: 'لم نجد هذا الدرس',
    lessonExplainButton: 'اشرح لي الدرس',
    lessonExplainSoon: 'شرح الدرس قريبًا',
    lessonExplainTitle: 'شرح الدرس',
    lessonExplainThink: 'فكّر قبل أن تقرأ',
    lessonExplainExample: 'مثال محلول',
    lessonExplainPractice: 'جرّب بنفسك',
    lessonExplainShowHint: 'أظهر التلميح',
    lessonExplainShowAnswer: 'أظهر الإجابة',
    lessonExplainAnswer: 'الإجابة',
    lessonExplainCommonMistake: 'خطأ شائع',
    lessonExplainReport: 'بلّغ عن مشكلة في هذا الشرح',
    lessonExplainReported: 'وصلنا بلاغك، شكرًا لك',
    lessonExplainEmpty: 'لا يوجد شرح لهذا الدرس بعد',
    lessonExplainError: 'تعذّر تحميل الشرح. تأكد من الاتصال وحاول مرة أخرى.',
    lessonExplainRetry: 'إعادة المحاولة',
```

- [ ] **Step 3: Add the strings (English)**

In the **English** block of the same file, replace

```ts
    lessonNotFound: 'Lesson not found',
```

with

```ts
    lessonNotFound: 'Lesson not found',
    lessonExplainButton: 'Explain this lesson',
    lessonExplainSoon: 'Explanation coming soon',
    lessonExplainTitle: 'Lesson explanation',
    lessonExplainThink: 'Think before you read',
    lessonExplainExample: 'Worked example',
    lessonExplainPractice: 'Try it yourself',
    lessonExplainShowHint: 'Show hint',
    lessonExplainShowAnswer: 'Show answer',
    lessonExplainAnswer: 'Answer',
    lessonExplainCommonMistake: 'Common mistake',
    lessonExplainReport: 'Report a problem with this explanation',
    lessonExplainReported: 'Report sent, thank you',
    lessonExplainEmpty: 'There is no explanation for this lesson yet',
    lessonExplainError: "Couldn't load the explanation. Check your connection and try again.",
    lessonExplainRetry: 'Try again',
```

- [ ] **Step 4: Run the string tests**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts`
Expected: PASS. If `i18nTerminology` objects to a word, change that string in both languages to the term it expects.

- [ ] **Step 5: Create the button**

Create `artifacts/mobile/components/ui/LessonExplanationButton.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonExplanation } from '@/services/lessonExplanation';

type State = 'checking' | 'ready' | 'soon';

/**
 * «اشرح لي الدرس» — students only (the lesson page decides who sees it).
 *
 * Asks the server whether an approved explanation exists when the page opens.
 * «قريبًا» means the server said no; a network failure leaves the button
 * enabled, because the screen it opens has a retry and a dead button teaches
 * students to stop trying.
 */
export function LessonExplanationButton({ lessonId, accent }: { lessonId: string; accent: string }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let cancelled = false;
    setState('checking');
    getLessonExplanation(lessonId, lang === 'ar' ? 'ar' : 'en')
      .then(result => { if (!cancelled) setState(result.status === 'ok' ? 'ready' : 'soon'); })
      .catch(() => { if (!cancelled) setState('ready'); });
    return () => { cancelled = true; };
  }, [lessonId, lang]);

  const disabled = state !== 'ready';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: '/curriculum/lesson-explanation', params: { lessonId, subjectColor: accent } } as never);
      }}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? colors.muted : accent,
          borderRadius: colors.radius,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          opacity: state === 'checking' ? 0.7 : 1,
        },
      ]}
    >
      {state === 'checking' ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : (
        <Ionicons name={disabled ? 'time-outline' : 'bulb-outline'} size={18} color={disabled ? colors.mutedForeground : '#fff'} />
      )}
      <Text style={[styles.text, { color: disabled ? colors.mutedForeground : '#fff', fontFamily: 'ReadexPro_600SemiBold' }]}>
        {state === 'soon' ? t('lessonExplainSoon') : t('lessonExplainButton')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 14 },
  text: { fontSize: 15 },
});
```

- [ ] **Step 6: Create the screen**

Create `artifacts/mobile/app/curriculum/lesson-explanation.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { BackButton } from '@/components/ui/BackButton';
import { getLessonById } from '@/services/curriculumData';
import {
  getLessonExplanation,
  reportLessonExplanation,
  type LessonExplanation,
} from '@/services/lessonExplanation';
import { buildExplanationCards, type ExplanationCard } from '@/services/lessonExplanationCards';

type Phase = 'loading' | 'ready' | 'soon' | 'error';
type ReportState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * «شرح الدرس»: the stored, approved explanation, one idea per card.
 *
 * Read-only. The practice problem's hint and answer sit behind a tap so a
 * student tries first. Nothing here can start a generation; the server
 * answers from the pool or says it has nothing.
 */
export default function LessonExplanationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { lessonId, subjectColor } = useLocalSearchParams<{ lessonId: string; subjectColor?: string }>();
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const lessonTitle = lesson ? (lang === 'ar' ? (lesson.titleAr || lesson.title) : lesson.title) : '';
  const accent = subjectColor ?? colors.primary;
  const align = { textAlign: isRTL ? 'right' : 'left' } as const;

  const [phase, setPhase] = useState<Phase>('loading');
  const [explanation, setExplanation] = useState<LessonExplanation | null>(null);
  const [report, setReport] = useState<ReportState>('idle');
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!lessonId) { setPhase('soon'); return; }
    setPhase('loading');
    try {
      const result = await getLessonExplanation(lessonId, lang === 'ar' ? 'ar' : 'en');
      if (result.status === 'ok') { setExplanation(result.explanation); setPhase('ready'); }
      else setPhase('soon');
    } catch {
      setPhase('error');
    }
  }, [lessonId, lang]);

  useEffect(() => { void load(); }, [load]);

  const cards: ExplanationCard[] = explanation ? buildExplanationCards(explanation.content) : [];

  const sendReport = async () => {
    if (!explanation || report === 'sending' || report === 'sent') return;
    setReport('sending');
    try {
      await reportLessonExplanation(explanation.variantId);
      setReport('sent');
    } catch {
      setReport('failed');
    }
  };

  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }];
  const heading = (text: string) => (
    <Text style={[styles.cardLabel, align, { color: accent, fontFamily: 'ReadexPro_600SemiBold' }]}>{text}</Text>
  );
  const body = [styles.body, align, { color: colors.foreground, fontFamily: 'Almarai_400Regular' }];
  const reveal = (key: string, label: string, content: string) =>
    shown[key] ? (
      <View style={[styles.revealed, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
        <Text style={[styles.cardLabel, align, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium' }]}>{label}</Text>
        <Text style={body}>{content}</Text>
      </View>
    ) : (
      <Pressable
        accessibilityRole="button"
        onPress={() => setShown(s => ({ ...s, [key]: true }))}
        style={[styles.revealBtn, { borderColor: accent, borderRadius: colors.radius }]}
      >
        <Text style={{ color: accent, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>
          {key.endsWith('hint') ? t('lessonExplainShowHint') : t('lessonExplainShowAnswer')}
        </Text>
      </Pressable>
    );

  const renderCard = (c: ExplanationCard, i: number) => {
    switch (c.kind) {
      case 'hook':
        return (
          <View key={i} style={card}>
            {heading(t('lessonExplainThink'))}
            <Text style={[body, styles.hook]}>{c.text}</Text>
          </View>
        );
      case 'concept':
        return (
          <View key={i} style={card}>
            <Text style={[styles.cardTitle, align, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>{c.title}</Text>
            {c.points.map((p, j) => <Text key={j} style={body}>{p}</Text>)}
            {c.misconception ? (
              <View style={[styles.revealed, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                <Text style={[styles.cardLabel, align, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium' }]}>{t('lessonExplainCommonMistake')}</Text>
                <Text style={body}>{c.misconception}</Text>
              </View>
            ) : null}
          </View>
        );
      case 'example':
        return (
          <View key={i} style={card}>
            {heading(t('lessonExplainExample'))}
            <Text style={[body, styles.strong]}>{c.problem}</Text>
            {c.steps.map((s, j) => <Text key={j} style={body}>{`${j + 1}. ${s}`}</Text>)}
            {c.answer ? <Text style={[body, styles.strong, { color: accent }]}>{`${t('lessonExplainAnswer')}: ${c.answer}`}</Text> : null}
          </View>
        );
      case 'practice':
        return (
          <View key={i} style={card}>
            {heading(t('lessonExplainPractice'))}
            <Text style={[body, styles.strong]}>{c.problem}</Text>
            {c.hint ? reveal(`${i}:hint`, t('lessonExplainShowHint'), c.hint) : null}
            {c.answer ? reveal(`${i}:answer`, t('lessonExplainAnswer'), c.answer) : null}
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.card, paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={[styles.title, align, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>{t('lessonExplainTitle')}</Text>
        {lessonTitle ? <Text style={[styles.subtitle, align, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{lessonTitle}</Text> : null}
      </View>

      {phase === 'loading' ? (
        <View style={styles.center}><ActivityIndicator color={accent} /></View>
      ) : phase === 'error' ? (
        <View style={styles.center}>
          <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('lessonExplainError')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.retry, { backgroundColor: accent, borderRadius: colors.radius }]}>
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>{t('lessonExplainRetry')}</Text>
          </Pressable>
        </View>
      ) : phase === 'soon' || cards.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('lessonExplainEmpty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {cards.map(renderCard)}
          <Pressable
            accessibilityRole="button"
            disabled={report === 'sending' || report === 'sent'}
            onPress={() => void sendReport()}
            hitSlop={8}
            style={styles.reportBtn}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textDecorationLine: report === 'sent' ? 'none' : 'underline' }}>
              {report === 'sent' ? t('lessonExplainReported') : t('lessonExplainReport')}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginBottom: 4 },
  title: { fontSize: 24, marginBottom: 2 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  notice: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  retry: { paddingHorizontal: 22, paddingVertical: 12 },
  scroll: { padding: 20, paddingBottom: 80, gap: 14 },
  card: { borderWidth: 1, padding: 16, gap: 10 },
  cardLabel: { fontSize: 12 },
  cardTitle: { fontSize: 17, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 25 },
  hook: { fontSize: 17, lineHeight: 28 },
  strong: { fontFamily: 'ReadexPro_500Medium' },
  revealed: { padding: 12, gap: 4 },
  revealBtn: { borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  reportBtn: { alignSelf: 'center', paddingVertical: 12 },
});
```

- [ ] **Step 7: Show the button to students on the lesson page**

In `artifacts/mobile/app/curriculum/lesson-detail.tsx`:

Replace `import { isTeacherRole, useAuth } from '@/context/AuthContext';` with:

```tsx
import { isStudentRole, isTeacherRole, useAuth } from '@/context/AuthContext';
```

Add, beside the other `@/components/ui/...` imports (after `import { LessonShelfPanel } from '@/components/ui/LessonShelfPanel';`):

```tsx
import { LessonExplanationButton } from '@/components/ui/LessonExplanationButton';
```

Then, directly above the block that begins

```tsx
        {isTeacher ? (
        <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
```

insert:

```tsx
        {/* Students only. Teachers have the preparation buttons below; a student
            gets the stored, admin-approved explanation, which costs nothing to
            serve and cannot start a generation. */}
        {isStudentRole(user?.role) ? (
          <LessonExplanationButton lessonId={lesson.id} accent={color} />
        ) : null}

```

- [ ] **Step 8: Register the screen**

In `artifacts/mobile/app/_layout.tsx`, directly after the line

```tsx
      <Stack.Screen name="curriculum/lesson-detail" options={{ headerShown: false }} />
```

add:

```tsx
      <Stack.Screen name="curriculum/lesson-explanation" options={{ headerShown: false }} />
```

- [ ] **Step 9: Typecheck and run the mobile suite**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -20`
Expected: no errors. Likely fix-ups if any: `useColors()` field names (`radius`, `muted`, `card`, `border`), or `t` typed as `TranslationKey` (the new keys exist in the English block, so they are valid keys).

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -15`
Expected: all pass.

- [ ] **Step 10: Try it in the browser**

Run the app per `LOCAL_SETUP.md` (`pnpm run dev:api` and `pnpm run dev:mobile:web`). With a student account, open a lesson page: the button reads «شرح الدرس قريبًا» and is disabled (no approved row locally). Then, against a local database, insert one approved row for that lesson and confirm the button enables, the screen shows the cards, hint/answer reveal on tap, and «بلّغ عن مشكلة» changes to «وصلنا بلاغك، شكرًا لك»:

```sql
UPDATE ai_artifacts SET student_approved_at = now()
WHERE kind = 'lesson-teaching' AND lesson_ref = '<lesson id>' AND retired_at IS NULL;
```

If no local `lesson-teaching` row exists, run Task 6's prefill against the local API for one lesson first. Report honestly if any of this could not be run.

- [ ] **Step 11: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/i18n.ts artifacts/mobile/components/ui/LessonExplanationButton.tsx \
  artifacts/mobile/app/curriculum/lesson-explanation.tsx artifacts/mobile/app/curriculum/lesson-detail.tsx \
  artifacts/mobile/app/_layout.tsx artifacts/mobile/services/__tests__/routeGating.test.ts
git commit -m "feat(mobile): «اشرح لي الدرس» button and screen for students"
```

---

### Task 9: Record what is now true, and verify the whole change

**Files:**
- Modify: `STATUS.md` (append a dated section)
- Modify: `CLAUDE.md` (one bullet under *Things that have bitten before*, after the "A shared artifact makes every generator bug everybody's bug." bullet)

- [ ] **Step 1: Append to STATUS.md**

Append at the end of `STATUS.md` (match the surrounding `## <title>, YYYY-MM-DD` heading style):

```markdown

## Students can read a stored lesson explanation, 2026-10-13

A student opens a lesson page and taps «اشرح لي الدرس». They get the
`lesson-teaching` explanation the teacher pool already holds — hook, concept
cards, worked example, practice problem with hint and answer — with no model
call. Spec: `docs/superpowers/specs/2026-10-13-student-lesson-explanations-design.md`.

What is true, checked against the code and the suites:

- **Serve-only.** `GET /student/lesson-explanation/:lessonId` reads
  `ai_artifacts` and nothing else; it imports no generation, budget or OpenAI
  code (a test scans for it). A student cannot cause a paid call.
- **Only approved rows are shown.** `ai_artifacts.student_approved_at` is set
  by a `system_admin` through `POST /moderation/lesson-explanations/approve`.
  A teacher's stored row is not shown to students until then, because
  `slides.tsx` used to derive the lesson id from the title, so a stored row can
  sit under the wrong lesson.
- **Looked up by lesson id,** not by recomputing the teacher's `strictKey`, so a
  model or `PROMPT_VERSION` bump does not empty the student view. The newest
  approved row wins.
- **A student report queues, it does not retire.** It goes to the existing
  `reportVariant` queue for a `system_admin`.
- **Filling and approving the pool is a manual, three-step job** in
  `scripts/pregenerate.ts`: `--go --only=lesson-teaching` generates and writes
  `pregen-review.json`; a person reads it and deletes what they reject;
  `--approve=<file>` approves the rest. Grade 10 Mathematics and Chemistry only.
- `Slides Maker` and the prefill now build the request through
  `buildLessonTeachingRequest` (`services/generatorRequests.ts`), pinned
  byte-identical to the old inline body.

**Not built, and worth knowing:**
- Nothing has been generated or approved in production yet, so every lesson
  shows «شرح الدرس قريبًا» until the prefill, the review and the approval are run.
- The wording was written for a classroom projector. Whether it reads well to a
  student alone is checked only by a person reading the review file; if more
  than a few lessons need rewording the answer is a separate student prompt, not
  hand-edited text.
- Student chat is still never pooled. Parent summaries and hints on exam
  questions are separate specs.

**Needs the migration:** `ai_artifacts` gains `student_approved_at` and an
index. It deploys as a migration (`lib/db/migrations/0007_*`); until it has
applied, the student route returns 500 (the column does not exist) and
teachers are unaffected.
```

- [ ] **Step 2: Add the CLAUDE.md bullet**

In `CLAUDE.md`, directly after the bullet that begins `- **A shared artifact makes every generator bug everybody's bug.**` (ending `…it retires immediately rather than queuing a review.`), add:

```markdown
- **Students are shown only what an admin approved (since 2026-10-13).** The
  pool serves a teacher whatever is stored, but a stored row can be under the
  wrong lesson id and a student is a minor, so `GET /student/lesson-explanation/…`
  filters on `ai_artifacts.student_approved_at`, which only
  `POST /moderation/lesson-explanations/approve` sets. A new student-facing read
  of the pool needs the same gate, and must not import generation code — a
  student route that can reach `generateContent` is a student who can spend the
  budget. `scripts/pregenerate.ts` fills it; approval is a separate step on purpose.
```

- [ ] **Step 3: Full verification**

Run each and confirm the output, not just the exit code:

```bash
cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -10
cd /home/user/Iqraa/artifacts/api-server && pnpm build && pnpm test 2>&1 | tail -15
cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -15
cd /home/user/Iqraa && git status --short
```

Expected: typecheck clean; both suites fully green with nothing skipped in api-server; `git status` shows only the STATUS.md and CLAUDE.md edits (everything else already committed).

- [ ] **Step 4: Commit**

```bash
cd /home/user/Iqraa
git add STATUS.md CLAUDE.md
git commit -m "docs: record student lesson explanations in STATUS.md and CLAUDE.md"
```

- [ ] **Step 5: Push and update the PR**

```bash
cd /home/user/Iqraa && git push -u origin ccr-76ac8d7f-92ruo7
```

The existing draft PR (#1038) picks the commits up. Edit its title to `feat: student lesson explanations from the shared pool` and replace its body so it describes the implementation, the migration (`destructive-migration` is not needed: one nullable column and an index), and what still has to be run by a person (prefill, review, approve).

---

## Self-review

**Spec coverage**

| Spec item | Task |
| --- | --- |
| Read-only student endpoint, student role, path-scoped guard, 404 `not_available` | 3 |
| Newest approved live row, ties to least served; `teacherNote` stripped; `noteServed` | 1, 3 |
| No model call / no generation imports | 3 (source scan) |
| Id validated by shape | 1 |
| Migration: nullable `student_approved_at` + `(kind, lesson_ref)` index, non-destructive | 2 |
| Approval endpoint, `system_admin`, 1–200 uuids, no revoke | 1, 4 |
| Prefill as a third kind in `pregenerate.ts`; same body as the screen; id from grounding; Maths + Chemistry; review file; `--approve` | 5, 6 |
| Builder byte-identical to `slides.tsx`'s old body | 5 |
| Student button on `lesson-detail`, «قريبًا» on 404, retry on network error | 7, 8 |
| Card screen, hint/answer behind a tap, RTL, text as stored | 7, 8 |
| Report via `reportVariant`, queue not retire, only for visible explanations | 3 |
| Routing allowed for students; i18n parity | 8 |
| Id-space pin (browser id = KB id) | 5 |
| STATUS.md and CLAUDE.md | 9 |
| Open items before building (live mode, admin login, budget, migration applied) | Task 6 header comment and Task 9 STATUS text; these are operator actions, not code |

**Placeholders:** none. Every code step shows the code; every command shows its expected result.

**Names across tasks:** `ExplanationRow`, `pickExplanation`, `stripTeacherNotes`, `isLessonRef`, `isUuid`, `parseLanguage`, `parseApproveBody`, `APPROVE_MAX` (Task 1) are used with those names in Tasks 3 and 4. `readApprovedExplanations`, `isStudentVisibleExplanation`, `markApprovedForStudents` (Task 3) match Task 4's import. `buildLessonTeachingRequest` and `LessonTeachingForm` (Task 5) match Task 6. `Call`, `ReviewEntry`, `reviewEntry`, `plannedTeachingCalls` (Task 6) match its tests. `getLessonExplanation`, `reportLessonExplanation`, `LessonExplanation`, `buildExplanationCards`, `ExplanationCard` (Task 7) match Task 8. The ten i18n keys used in Task 8's components are all defined in its Steps 2–3.

**Known judgement calls to check at execution:** the exact chemistry subject string in the picker (Task 6 Step 5 says how to confirm), and whether `useColors()` exposes `radius`/`muted` as used (Task 8 Step 9 says how to fix).
