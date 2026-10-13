# Row-Level Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postgres row-level security on the tables that hold children's and private data, switched on by one reversible env var, with the API's identity carried to the database per statement.

**Architecture:** `authMiddleware` runs the rest of the request inside an `AsyncLocalStorage` identity. `db` becomes a `pg.Pool` subclass (`ScopedPool`) that, when `RLS_ENFORCE=on`, wraps every statement in `BEGIN; SET LOCAL ROLE iqraa_app; set_config('app.user_id', …)` … `COMMIT`; policies in a hand-written migration read that identity. `systemDb` is the owner connection (bypasses RLS) for paths that act without a user. A differential test boots the built API with enforcement off and on and diffs what users see and cause — that test, not reading 41 files, is the audit.

**Tech Stack:** Postgres 16 (Neon in production), `pg` pool, Drizzle 0.45 (node-postgres driver), Node `AsyncLocalStorage`, `node --test` with `--experimental-strip-types`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-13-row-level-security-design.md` — read it first. §"Deviations found while prototyping" below overrides it where they differ, and Task 6 amends the spec to match.

## Global Constraints

- Role `iqraa_app`: `NOLOGIN NOBYPASSRLS`, never superuser, never owns an object. No password and no second connection string: the owner connection does `SET LOCAL ROLE iqraa_app`.
- Identity travels as two transaction-local settings: `app.user_id` (a uuid) and `app.role` (`lower_snake_case`, ≤ 32 chars). Both are validated in `asUser()` and then written as **literals** into a multi-statement simple query, because bind parameters are unavailable there — never loosen those two patterns.
- `RLS_ENFORCE` is read **once at boot** and enables enforcement only when it is exactly `on`; anything else (including unset) is off. It is a server-side variable, not `EXPO_PUBLIC_*`, so the three client declaration sites (`deploy.yml`, `eas.json`, `mobile-update.yml`) do not apply.
- With enforcement off, `db` must behave exactly as before: same pool, no `BEGIN`, no `SET ROLE`, no extra round trips. `systemDb` is then `db` itself.
- Migrations: hand-written SQL via `drizzle-kit generate --custom`; `pnpm --filter @workspace/db run generate` must stay quiet afterwards; nothing in it matches `destructive-migration-ack.yml`'s patterns (`DROP (TABLE|COLUMN)`, `RENAME`, `SET NOT NULL`, `SET DATA TYPE`). Never `push` to production.
- **No `ALTER DEFAULT PRIVILEGES`.** A table created later is not granted to `iqraa_app`; the coverage test fails until someone classifies it.
- Files loaded directly by `node --test` need explicit `.ts` relative imports. `lib/db/src/index.ts` and `schema/` keep extensionless imports (esbuild resolves them); anything a test imports must not pull those in. Tests go inside the existing globs and the globs are not narrowed.
- The files allowed to import `systemDb` are pinned by `systemDbFiles.test.ts` with a reason each. Adding one means editing that test.
- `STATUS.md` is edited in the same PR as the change (repo rule).
- Branch `ccr-3ee1b708-xc6gqo` is restarted from `main`; one PR; open it as a draft.

## Deviations found while prototyping

The plan below was prototyped end to end in a throwaway worktree against Postgres 16 before it was written; every file embedded here is the file that was run. Four things differ from the spec:

1. **Policies are hand-written SQL, not Drizzle `pgPolicy`** (spec §3). `drizzle-kit` does not track roles, functions or policies, so `generate` stays quiet and there is nothing to diff. The schema file no longer shows RLS; `rlsCoverage.test.ts` is what proves it is on.
2. **The wrapper is a `pg.Pool` subclass, not a Drizzle wrapper** (spec §1). Drizzle 0.45's node-postgres driver calls `pool.query()` for plain statements and `pool.connect()` + `begin` for `db.transaction()`; overriding those two methods covers both, including nested savepoints, with no change to any call site. Files switch to the owner connection with `import { systemDb as db }`, which leaves every call site untouched.
3. **Policies the prototype forced** (spec §2):
   - `chat_participants` insert: *either party of a direct thread may add either party*. `openDirectThread` inserts both rows with `ON CONFLICT DO NOTHING`, and Postgres checks an INSERT policy **before** it detects the conflict, so "thread owner only" rejected the second person to open a DM.
   - `evaluation_questions` is teacher-only (it carries the answer key; students read their paper from `attempts.question_snapshot`).
   - Grade tables (`attempt_question_grades`, `attempt_results`, `recommendations`, `grade_overrides`, `grading_jobs`) are written only under a teacher's identity; server-side grading runs on `systemDb`.
   - The three auth token tables have RLS on, **no policy and no grant**, so a mistaken `db` use fails loudly (`permission denied`) instead of quietly returning nothing.
4. **The audit is a test.** The spec said to find cross-user reads by reading ~41 files. A read-only diff found nothing (reads mostly select the caller's own data); the writes and fan-out found everything. See Task 4.

## What the prototype proved

| Check | Result |
| --- | --- |
| Policy matrix against real Postgres 16 | 21 tests: tenancy, parent/student visibility, answer key hidden, grades teacher-only, chat membership and sender spoofing, blocks invisible to the blocked, admin sees `chat_reports` but not students, token tables closed, fail-closed with no identity, `INSERT … RETURNING`, transaction and savepoint scoping, no leak to the next borrower, off-mode is a plain pool |
| Coverage guard | Fails on a new unclassified table, and on RLS enabled where the lists say it is not (both demonstrated) |
| Differential test, reads | 56 requests across 6 identities identical on/off; positive control proves the "on" server really runs as `iqraa_app` |
| Differential test, writes | 50 steps (DMs, groups, blocks, device handoff, login/refresh, claim, roster, exams, release, admin, link-based exam) identical on/off in status, **pushes sent**, **rows left behind** and logged errors |
| Mutation check | Reverting each of the 17 `systemDb` swaps one at a time: 16 caught by the differential test. The one not seen is the middleware's user lookup (kept: skips three round trips per request; `users` has no RLS yet). A swap of the `broadcast` block lookup was also tried and found unnecessary — teachers cannot be blocked — so it stays on `db` |
| Whole repo | `pnpm run typecheck` clean; api-server 1613 tests pass; `generate` quiet; fresh `migrate` + `verify-schema` pass |
| Cost | +0.24 ms per statement on loopback (≈ 2 extra round trips). **Not measured on Neon** — that is the go/no-go in Task 7 |

The failures that justified each `systemDb` use, in the words of the differential test: a phone handed to another account → `500`; a teacher's block on a parent not seen → the blocked parent could open a DM; **zero pushes sent at all** (recipients' tokens and blocks are other people's rows); reissuing a login code → `500` (`refresh_tokens`); and — the one that matters — **a student excluded from a restricted exam could take it through its share link**, because the audience read came back empty and an empty audience means "everyone".

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/db/src/identity.ts` (create) | `asUser()` / `currentIdentity()` — the `AsyncLocalStorage` and the validation that makes literal interpolation safe |
| `lib/db/src/scopedPool.ts` (create) | `ScopedPool extends pg.Pool` — scopes every statement/transaction when enforcing |
| `lib/db/src/index.ts` (modify) | exports `db`, `systemDb`, `rlsEnforced`, `asUser`, `currentIdentity` |
| `lib/db/migrations/0008_row_level_security.sql` (create) | role, grants, helper functions, RLS and policies |
| `lib/db/src/testing/rlsHarness.ts` (create) | fixture seed shared by the DB-backed suites |
| `lib/db/src/__tests__/identity.test.ts` (create) | unit tests, no database |
| `lib/db/src/__tests__/rlsCoverage.test.ts` (create) | every table protected, locked or explicitly deferred |
| `lib/db/src/__tests__/rlsMatrix.test.ts` (create) | each policy, through `ScopedPool` |
| `lib/db/src/__tests__/rlsDiff.test.ts` (create) | the audit: built API, enforcement off vs on |
| `artifacts/api-server/src/middlewares/auth.ts` (modify) | run the chain as the user; look the user up on `systemDb` |
| `artifacts/api-server/src/**` (12 files, modify) | `systemDb` where the differential test demands it |
| `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (create) | pins which files may use `systemDb` |
| `.github/workflows/ci.yml` (modify) | `rls` job; `lib/db` unit tests in the main job |
| `docs/…`, `STATUS.md`, `LOCAL_SETUP.md`, `CLAUDE.md` (modify) | switch, rollback, how to add a table; spec amendments |

### Local database for the DB-backed tests

Tasks 2–5 need a throwaway Postgres 16. Either:

```bash
docker run -d --name rls-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
export RLS_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
```

or any local Postgres 16 where you can `CREATE ROLE` (the suites create throwaway users and delete them; they never read or write anything else, but **do not point them at a database with real data** — a Neon *branch* is fine, production is not). Without `RLS_TEST_DATABASE_URL` the DB-backed suites skip, which is what the main CI job relies on.

---

### Task 1: Request identity

**Files:**
- Create: `lib/db/src/identity.ts`
- Test: `lib/db/src/__tests__/identity.test.ts`
- Modify: `lib/db/package.json` (add a `test` script), `lib/db/tsconfig.json` (`allowImportingTsExtensions`)

**Interfaces:**
- Produces: `interface Identity { userId: string; role: string }`; `asUser<T>(identity: Identity, fn: () => T): T` (throws on an invalid uuid or role, lowercases the uuid); `currentIdentity(): Identity | undefined`.

- [ ] **Step 1: Make `lib/db` able to run tests.** In `lib/db/package.json` add to `scripts`:

```json
"test": "node --experimental-strip-types --test --test-concurrency=1 \"src/**/__tests__/**/*.test.ts\""
```

`--test-concurrency=1` is required: the differential test briefly revokes a privilege that the coverage test inspects. In `lib/db/tsconfig.json` add `"allowImportingTsExtensions": true` to `compilerOptions` (after `"types": ["node"]`, with a comma). `api-server` already does the same.

- [ ] **Step 2: Write the failing test.**

```ts
// lib/db/src/__tests__/identity.test.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, test } from "node:test";
import { asUser, currentIdentity } from "../identity.ts";

describe("request identity", () => {
  test("is undefined outside a request", () => {
    assert.equal(currentIdentity(), undefined);
  });

  test("is visible to everything the request awaits", async () => {
    const userId = randomUUID();
    await asUser({ userId, role: "teacher" }, async () => {
      await new Promise(r => setTimeout(r, 5));
      assert.deepEqual(currentIdentity(), { userId, role: "teacher" });
      await Promise.all([1, 2, 3].map(async () => assert.equal(currentIdentity()?.userId, userId)));
    });
    assert.equal(currentIdentity(), undefined);
  });

  test("concurrent requests never see each other's identity", async () => {
    const ids = Array.from({ length: 20 }, () => randomUUID());
    const seen = await Promise.all(
      ids.map(userId =>
        asUser({ userId, role: "parent" }, async () => {
          await new Promise(r => setTimeout(r, Math.random() * 10));
          return currentIdentity()?.userId;
        }),
      ),
    );
    assert.deepEqual(seen, ids);
  });

  test("lowercases the id so it matches how Postgres prints a uuid", () => {
    const userId = randomUUID().toUpperCase();
    asUser({ userId, role: "teacher" }, () => assert.equal(currentIdentity()?.userId, userId.toLowerCase()));
  });

  // ScopedPool writes both fields into a multi-statement simple query, where bind
  // parameters are unavailable — these checks are what make that safe.
  test("refuses anything that is not a uuid", () => {
    for (const userId of ["", "not-a-uuid", `${randomUUID()}'; DROP TABLE students; --`, `${randomUUID()} `]) {
      assert.throws(() => asUser({ userId, role: "teacher" }, () => 0), /uuid/);
    }
  });

  test("refuses a role that is not lower_snake_case", () => {
    for (const role of ["", "Teacher", "teacher'; --", "a".repeat(33), "role with space"]) {
      assert.throws(() => asUser({ userId: randomUUID(), role }, () => 0), /role/);
    }
  });
});
```

- [ ] **Step 3: Run it to see it fail.**

Run: `pnpm --filter @workspace/db run test`
Expected: FAIL — `Cannot find module '../identity.ts'`.

- [ ] **Step 4: Implement.**

```ts
// lib/db/src/identity.ts
import { AsyncLocalStorage } from "node:async_hooks";

/** Who a request is acting as. Set once by authMiddleware; read by ScopedPool. */
export interface Identity {
  userId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_RE = /^[a-z_]{1,32}$/;

const store = new AsyncLocalStorage<Identity>();

/**
 * Run `fn` — and everything it awaits — as `identity`.
 *
 * Both fields are checked here because ScopedPool writes them into a
 * multi-statement simple query, where bind parameters are not available. A
 * value that passes these two patterns cannot carry SQL.
 */
export function asUser<T>(identity: Identity, fn: () => T): T {
  if (!UUID_RE.test(identity.userId)) throw new Error("asUser: userId is not a uuid");
  if (!ROLE_RE.test(identity.role)) throw new Error("asUser: role must be lower_snake_case");
  return store.run({ userId: identity.userId.toLowerCase(), role: identity.role }, fn);
}

/** The identity of the request in flight, or undefined outside one. */
export function currentIdentity(): Identity | undefined {
  return store.getStore();
}
```

- [ ] **Step 5: Run it to see it pass.**

Run: `pnpm --filter @workspace/db run test`
Expected: PASS — 6 tests (the DB-backed suites do not exist yet).

- [ ] **Step 6: Commit.**

```bash
git add lib/db/src/identity.ts lib/db/src/__tests__/identity.test.ts lib/db/package.json lib/db/tsconfig.json
git commit -m "feat(db): request identity carried in AsyncLocalStorage"
```

---

### Task 2: The role, the helpers and the policies

**Files:**
- Create: `lib/db/migrations/0008_row_level_security.sql` (+ the `meta/` files `drizzle-kit` writes)
- Create: `lib/db/src/testing/rlsHarness.ts`
- Test: `lib/db/src/__tests__/rlsCoverage.test.ts`

**Interfaces:**
- Produces (SQL): role `iqraa_app`; `app_uid()`, `app_role()`; definer helpers `app_teaches_student`, `app_linked_to_student`, `app_is_student_self`, `app_owns_class`, `app_in_class`, `app_owns_thread`, `app_in_thread`, `app_may_add_participant`, `app_sees_message`, `app_teaches_evaluation`, `app_sees_evaluation`, `app_sees_attempt`, `app_teaches_attempt`, `app_writes_attempt`; 65 policies on 25 tables; RLS (no policy, no grant) on 3 token tables.
- Produces (TS): `TEST_URL: string | undefined`, `interface Fixture { ids: Record<string, string>; cleanup(): Promise<void> }`, `seed(owner: pg.Pool): Promise<Fixture>` — ids: `teacherA teacherB parentA parentB studentUser studentUser2 admin studentA studentB classA evalA questionA attemptA threadDirect threadOther threadClass msgDirect msgOther`.

- [ ] **Step 1: Start the local database** (see "Local database" above) and migrate the existing 8 migrations:

```bash
DATABASE_URL=$RLS_TEST_DATABASE_URL pnpm --filter @workspace/db run migrate -- --from-env
```
Expected: `Migrations up to date: 8 applied (8 new).`

- [ ] **Step 2: Write the fixture harness.**

```ts
// lib/db/src/testing/rlsHarness.ts
import { randomUUID } from "node:crypto";
import pg from "pg";

/**
 * Fixtures for the RLS suites. Everything is inserted as the connection's own
 * (owner) role, which bypasses RLS, then read back through a ScopedPool.
 * Rows are tied to throwaway users, so deleting the users cascades them all.
 */
export const TEST_URL = process.env.RLS_TEST_DATABASE_URL;

export interface Fixture {
  ids: Record<string, string>;
  cleanup(): Promise<void>;
}

export async function seed(owner: pg.Pool): Promise<Fixture> {
  const run = randomUUID().slice(0, 8);
  const id = (_: string) => randomUUID();
  const ids = {
    teacherA: id("teacherA"), teacherB: id("teacherB"),
    parentA: id("parentA"), parentB: id("parentB"),
    studentUser: id("studentUser"), studentUser2: id("studentUser2"), admin: id("admin"),
    studentA: id("studentA"), studentB: id("studentB"),
    classA: id("classA"), evalA: id("evalA"), questionA: id("questionA"), attemptA: id("attemptA"),
    threadDirect: id("threadDirect"), threadOther: id("threadOther"), threadClass: id("threadClass"),
    msgDirect: id("msgDirect"), msgOther: id("msgOther"),
  };
  const q = (text: string, values: unknown[] = []) => owner.query(text, values);

  const user = (key: keyof typeof ids, role: string) =>
    q(`INSERT INTO users (id, email, first_name, last_name, role) VALUES ($1, $2, 'T', $3, $4)`,
      [ids[key], `${key}.${run}@rls.test`, key, role]);
  await user("teacherA", "teacher"); await user("teacherB", "teacher");
  await user("parentA", "parent"); await user("parentB", "parent");
  await user("studentUser", "student"); await user("studentUser2", "student"); await user("admin", "system_admin");

  await q(`INSERT INTO students (id, teacher_id, display_name) VALUES ($1,$2,'Student A'), ($3,$4,'Student B')`,
    [ids.studentA, ids.teacherA, ids.studentB, ids.teacherB]);
  await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1,$2,'guardian'), ($1,$3,'self')`,
    [ids.studentA, ids.parentA, ids.studentUser]);
  await q(`INSERT INTO class_groups (id, teacher_id, name) VALUES ($1,$2,'Class A')`, [ids.classA, ids.teacherA]);
  await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1,$2)`, [ids.classA, ids.studentA]);
  await q(`INSERT INTO parent_contacts (teacher_id, student_id, kind, channel) VALUES ($1,$2,'note','copy')`,
    [ids.teacherA, ids.studentA]);

  await q(`INSERT INTO evaluations (id, teacher_id, grade_id, subject_id, book_id) VALUES ($1,$2,'g10','math','b1')`,
    [ids.evalA, ids.teacherA]);
  await q(`INSERT INTO evaluation_questions (id, evaluation_id, type, objective_id, competency_key) VALUES ($1,$2,'mcq','o1','c1')`,
    [ids.questionA, ids.evalA]);
  await q(`INSERT INTO attempts (id, evaluation_id, student_id) VALUES ($1,$2,$3)`,
    [ids.attemptA, ids.evalA, ids.studentA]);
  await q(`INSERT INTO attempt_results (attempt_id) VALUES ($1)`, [ids.attemptA]);

  await q(`INSERT INTO chat_threads (id, type, created_by, direct_key) VALUES ($1,'direct',$2,$5), ($3,'direct',$4,$6)`,
    [ids.threadDirect, ids.teacherA, ids.threadOther, ids.teacherB,
     [ids.teacherA, ids.parentA].sort().join(":"), [ids.teacherB, ids.parentB].sort().join(":")]);
  await q(`INSERT INTO chat_threads (id, type, class_group_id) VALUES ($1,'class_group',$2)`, [ids.threadClass, ids.classA]);
  await q(`INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2), ($1,$3), ($4,$5)`,
    [ids.threadDirect, ids.teacherA, ids.parentA, ids.threadOther, ids.teacherB]);
  await q(`INSERT INTO chat_messages (id, thread_id, sender_id, body) VALUES ($1,$2,$3,'hi'), ($4,$5,$6,'other')`,
    [ids.msgDirect, ids.threadDirect, ids.teacherA, ids.msgOther, ids.threadOther, ids.teacherB]);
  await q(`INSERT INTO chat_blocks (blocker_user_id, blocked_user_id) VALUES ($1,$2), ($3,$4)`,
    [ids.parentA, ids.teacherA, ids.teacherB, ids.parentB]);
  await q(`INSERT INTO chat_reports (reporter_user_id, reported_user_id, thread_id) VALUES ($1,$2,$3), ($4,$5,$6)`,
    [ids.parentA, ids.teacherA, ids.threadDirect, ids.teacherB, ids.parentB, ids.threadOther]);

  return {
    ids,
    async cleanup() {
      const users = [ids.teacherA, ids.teacherB, ids.parentA, ids.parentB, ids.studentUser, ids.studentUser2, ids.admin];
      await q(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [users]);
    },
  };
}
```

- [ ] **Step 3: Write the failing coverage test.** It lists every table once — protected, locked, or deferred — and checks the catalog against the lists.

```ts
// lib/db/src/__tests__/rlsCoverage.test.ts
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { TEST_URL } from "../testing/rlsHarness.ts";

/**
 * Every table is either protected by row-level security or on a written list of tables
 * not protected *yet*. A new table fails this until someone classifies it — the point is
 * that "forgot to think about RLS" cannot pass CI.
 *
 * Moving a table between the lists is the whole job of a follow-up RLS PR: add its
 * policies in a migration, then move its name from DEFERRED to PROTECTED here.
 */
const PROTECTED = [
  "attempt_answers", "attempt_question_grades", "attempt_results", "attempt_retakes", "attempts",
  "chat_blocks", "chat_message_reactions", "chat_message_reads", "chat_messages", "chat_participants",
  "chat_reports", "chat_threads", "class_groups", "class_memberships", "device_push_tokens",
  "evaluation_assignments", "evaluation_questions", "evaluations", "grade_overrides", "grading_jobs",
  "mastery_overrides", "parent_contacts", "recommendations", "roster_links", "students",
] as const;

/** RLS on, no policy, and no grant: only the owner connection (systemDb) can read them. */
const LOCKED = ["email_verification_tokens", "password_reset_tokens", "refresh_tokens"] as const;

const DEFERRED = [
  "ai_artifact_reports", "ai_artifacts", "ai_generations", "class_resources", "competency_definitions",
  "conversations", "feedback", "lesson_media", "level_bands", "level_scales", "library_resources",
  "manual_metrics", "messages", "rate_limit_buckets", "rubric_templates", "saved_materials",
  "schedule_periods", "schedule_slots", "schools", "site_signups", "teaching_plans", "users",
] as const;

describe("row-level security covers every table", { skip: !TEST_URL && "RLS_TEST_DATABASE_URL not set" }, () => {
  let owner: pg.Pool;
  before(() => { owner = new pg.Pool({ connectionString: TEST_URL, max: 1 }); });
  after(() => owner.end());

  const rows = async (sql: string) => (await owner.query(sql)).rows as Record<string, unknown>[];
  const names = async (sql: string) => (await rows(sql)).map(r => String(Object.values(r)[0])).sort();

  test("each table is protected, locked, or explicitly deferred — and nothing is in two lists", async () => {
    const all = await names(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const listed = [...PROTECTED, ...LOCKED, ...DEFERRED];
    assert.equal(new Set(listed).size, listed.length, "a table is on two lists");
    assert.deepEqual(all, [...listed].sort(), "a table exists that is on no list (or a listed table is gone)");
  });

  test("RLS is on exactly for the protected and locked tables", async () => {
    const on = await names(`SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity`);
    assert.deepEqual(on, [...PROTECTED, ...LOCKED].sort());
  });

  test("every protected table has a policy; a locked table has none", async () => {
    const withPolicy = await names(`SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'`);
    assert.deepEqual(withPolicy, [...PROTECTED].sort());
  });

  test("the app role reaches protected and deferred tables, and never the locked ones", async () => {
    for (const table of [...PROTECTED, ...DEFERRED]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        const [{ ok }] = (await owner.query(`SELECT has_table_privilege('iqraa_app', $1, $2) AS ok`, [`public.${table}`, privilege])).rows;
        assert.equal(ok, true, `iqraa_app lacks ${privilege} on ${table}`);
      }
    }
    for (const table of LOCKED) {
      const [{ ok }] = (await owner.query(`SELECT has_table_privilege('iqraa_app', $1, 'SELECT') AS ok`, [`public.${table}`])).rows;
      assert.equal(ok, false, `iqraa_app must not read ${table}`);
    }
  });

  test("the app role cannot bypass policies, log in, or own anything", async () => {
    const [role] = await rows(`SELECT rolsuper, rolbypassrls, rolcanlogin, rolcreaterole FROM pg_roles WHERE rolname = 'iqraa_app'`);
    assert.deepEqual(role, { rolsuper: false, rolbypassrls: false, rolcanlogin: false, rolcreaterole: false });
    const owned = await names(`SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'iqraa_app'`);
    assert.deepEqual(owned, []);
  });

  // A SECURITY DEFINER function runs with its owner's rights; without a pinned search_path a
  // schema the caller controls could shadow a table or function it names.
  test("every SECURITY DEFINER helper pins its search_path", async () => {
    const helpers = await rows(`SELECT proname, prosecdef, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'app\\_%'`);
    assert.ok(helpers.length >= 15, `only found ${helpers.length} helpers`);
    for (const h of helpers) {
      if (!h["prosecdef"]) continue;
      assert.ok(((h["proconfig"] as string[] | null) ?? []).some(c => c.startsWith("search_path=")), `${h["proname"]} does not pin search_path`);
    }
  });
});
```

- [ ] **Step 4: Run it to see it fail.**

Run: `pnpm --filter @workspace/db run test`
Expected: FAIL — the RLS-enabled, policy, privilege and `search_path` checks (four of the six coverage tests); `every table is protected, locked, or explicitly deferred` already passes. On a brand-new cluster the privilege checks fail with `role "iqraa_app" does not exist`.

- [ ] **Step 5: Create the migration.**

```bash
pnpm --filter @workspace/db exec drizzle-kit generate --custom --name=row_level_security
```
Expected: `Your SQL migration file ➜ migrations/0008_row_level_security.sql`. (If `main` has gained a migration since this plan was written, `drizzle-kit` numbers it `0009` or later — use the name it prints, and change the name where this plan and the `STATUS.md` entry mention it.) Replace that file's (empty) contents with:

```sql
-- lib/db/migrations/0008_row_level_security.sql
-- Row-level security foundation (scope A). Hand-written: drizzle-kit does not
-- track roles, functions or policies, so `generate` stays quiet about them.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iqraa_app') THEN
    CREATE ROLE iqraa_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
GRANT iqraa_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO iqraa_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iqraa_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iqraa_app;--> statement-breakpoint
REVOKE ALL ON "refresh_tokens", "password_reset_tokens", "email_verification_tokens" FROM iqraa_app;--> statement-breakpoint

-- Identity, as set by the API per statement (lib/db/src/scopedPool.ts).
CREATE OR REPLACE FUNCTION app_uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.role', true), '') $$;--> statement-breakpoint

-- Helpers read other protected tables. SECURITY DEFINER runs them as the table
-- owner, which bypasses RLS, so policies on students / roster_links /
-- class_memberships can refer to each other without "infinite recursion".
CREATE OR REPLACE FUNCTION app_teaches_student(sid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM students WHERE id = sid AND teacher_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_linked_to_student(sid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_teaches_student(sid)
        OR EXISTS (SELECT 1 FROM roster_links WHERE student_id = sid AND user_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_student_self(sid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM roster_links
                       WHERE student_id = sid AND user_id = app_uid() AND relation = 'self') $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_owns_class(cid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM class_groups WHERE id = cid AND teacher_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_in_class(cid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_owns_class(cid)
        OR EXISTS (SELECT 1 FROM class_memberships m
                   JOIN roster_links r ON r.student_id = m.student_id
                   WHERE m.class_group_id = cid AND r.user_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_owns_thread(tid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM chat_threads t
                       WHERE t.id = tid
                         AND (t.created_by = app_uid()
                              OR (t.class_group_id IS NOT NULL AND app_owns_class(t.class_group_id)))) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_in_thread(tid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_owns_thread(tid)
        OR EXISTS (SELECT 1 FROM chat_participants WHERE thread_id = tid AND user_id = app_uid()) $$;--> statement-breakpoint
-- Either party of a direct thread may add either party (openDirectThread
-- inserts both rows, ON CONFLICT DO NOTHING — and Postgres checks an INSERT
-- policy before it detects the conflict, so a "thread owner only" rule would
-- reject the second person to open a DM). direct_key is the two user ids
-- joined by ':'.
CREATE OR REPLACE FUNCTION app_may_add_participant(tid uuid, added uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_owns_thread(tid)
        OR EXISTS (SELECT 1 FROM chat_threads t
                   WHERE t.id = tid AND t.type = 'direct' AND t.direct_key IS NOT NULL
                     AND app_uid()::text = ANY (string_to_array(t.direct_key, ':'))
                     AND added::text = ANY (string_to_array(t.direct_key, ':'))) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_sees_message(mid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM chat_messages m WHERE m.id = mid AND app_in_thread(m.thread_id)) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_teaches_evaluation(eid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM evaluations WHERE id = eid AND teacher_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_sees_evaluation(eid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_teaches_evaluation(eid)
        OR EXISTS (SELECT 1 FROM attempts a WHERE a.evaluation_id = eid AND app_linked_to_student(a.student_id))
        OR EXISTS (SELECT 1 FROM evaluation_assignments ea
                   WHERE ea.evaluation_id = eid
                     AND ((ea.student_id IS NOT NULL AND app_linked_to_student(ea.student_id))
                          OR (ea.class_group_id IS NOT NULL AND app_in_class(ea.class_group_id))))
        OR EXISTS (SELECT 1 FROM evaluations e
                   WHERE e.id = eid AND e.class_group_id IS NOT NULL AND app_in_class(e.class_group_id)) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_sees_attempt(aid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM attempts a
                       WHERE a.id = aid
                         AND (app_teaches_evaluation(a.evaluation_id) OR app_linked_to_student(a.student_id))) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_teaches_attempt(aid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM attempts a WHERE a.id = aid AND app_teaches_evaluation(a.evaluation_id)) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_writes_attempt(aid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM attempts a
                       WHERE a.id = aid
                         AND (app_teaches_evaluation(a.evaluation_id) OR app_is_student_self(a.student_id))) $$;--> statement-breakpoint

-- ── Roster ────────────────────────────────────────────────────────────────
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "students_select" ON "students" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_linked_to_student(id));--> statement-breakpoint
CREATE POLICY "students_insert" ON "students" FOR INSERT TO iqraa_app
  WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "students_update" ON "students" FOR UPDATE TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "students_delete" ON "students" FOR DELETE TO iqraa_app
  USING (teacher_id = app_uid());--> statement-breakpoint

ALTER TABLE "class_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "class_groups_select" ON "class_groups" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_in_class(id));--> statement-breakpoint
CREATE POLICY "class_groups_insert" ON "class_groups" FOR INSERT TO iqraa_app
  WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "class_groups_update" ON "class_groups" FOR UPDATE TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "class_groups_delete" ON "class_groups" FOR DELETE TO iqraa_app
  USING (teacher_id = app_uid());--> statement-breakpoint

ALTER TABLE "class_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "class_memberships_select" ON "class_memberships" FOR SELECT TO iqraa_app
  USING (app_owns_class(class_group_id) OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "class_memberships_insert" ON "class_memberships" FOR INSERT TO iqraa_app
  WITH CHECK (app_owns_class(class_group_id) AND app_teaches_student(student_id));--> statement-breakpoint
CREATE POLICY "class_memberships_delete" ON "class_memberships" FOR DELETE TO iqraa_app
  USING (app_owns_class(class_group_id));--> statement-breakpoint

ALTER TABLE "roster_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "roster_links_select" ON "roster_links" FOR SELECT TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));--> statement-breakpoint
CREATE POLICY "roster_links_insert" ON "roster_links" FOR INSERT TO iqraa_app
  WITH CHECK (user_id = app_uid() OR app_teaches_student(student_id));--> statement-breakpoint
CREATE POLICY "roster_links_delete" ON "roster_links" FOR DELETE TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));--> statement-breakpoint

ALTER TABLE "parent_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "parent_contacts_all" ON "parent_contacts" FOR ALL TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint

-- ── Chat ──────────────────────────────────────────────────────────────────
-- created_by is tested on the row itself, not through app_owns_thread(): a
-- STABLE function reads the statement's snapshot, which cannot see the row an
-- INSERT ... RETURNING has just written.
ALTER TABLE "chat_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_threads_select" ON "chat_threads" FOR SELECT TO iqraa_app
  USING (created_by = app_uid() OR app_in_thread(id));--> statement-breakpoint
CREATE POLICY "chat_threads_insert" ON "chat_threads" FOR INSERT TO iqraa_app
  WITH CHECK (created_by = app_uid()
              OR (type = 'class_group' AND class_group_id IS NOT NULL AND app_owns_class(class_group_id)));--> statement-breakpoint
CREATE POLICY "chat_threads_update" ON "chat_threads" FOR UPDATE TO iqraa_app
  USING (created_by = app_uid() OR app_owns_thread(id))
  WITH CHECK (created_by = app_uid() OR app_owns_thread(id));--> statement-breakpoint
CREATE POLICY "chat_threads_delete" ON "chat_threads" FOR DELETE TO iqraa_app
  USING (created_by = app_uid() OR app_owns_thread(id));--> statement-breakpoint

ALTER TABLE "chat_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_participants_select" ON "chat_participants" FOR SELECT TO iqraa_app
  USING (user_id = app_uid() OR app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_participants_insert" ON "chat_participants" FOR INSERT TO iqraa_app
  WITH CHECK (app_may_add_participant(thread_id, user_id));--> statement-breakpoint
CREATE POLICY "chat_participants_update" ON "chat_participants" FOR UPDATE TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint
CREATE POLICY "chat_participants_delete" ON "chat_participants" FOR DELETE TO iqraa_app
  USING (user_id = app_uid() OR app_owns_thread(thread_id));--> statement-breakpoint

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_messages_select" ON "chat_messages" FOR SELECT TO iqraa_app
  USING (app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_messages_insert" ON "chat_messages" FOR INSERT TO iqraa_app
  WITH CHECK (sender_id = app_uid() AND app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_messages_update" ON "chat_messages" FOR UPDATE TO iqraa_app
  USING (sender_id = app_uid() OR app_owns_thread(thread_id))
  WITH CHECK (sender_id = app_uid() OR app_owns_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_messages_delete" ON "chat_messages" FOR DELETE TO iqraa_app
  USING (sender_id = app_uid() OR app_owns_thread(thread_id));--> statement-breakpoint

ALTER TABLE "chat_message_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_message_reads_select" ON "chat_message_reads" FOR SELECT TO iqraa_app
  USING (app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reads_insert" ON "chat_message_reads" FOR INSERT TO iqraa_app
  WITH CHECK (user_id = app_uid() AND app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reads_update" ON "chat_message_reads" FOR UPDATE TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint
CREATE POLICY "chat_message_reads_delete" ON "chat_message_reads" FOR DELETE TO iqraa_app
  USING (user_id = app_uid());--> statement-breakpoint

ALTER TABLE "chat_message_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_message_reactions_select" ON "chat_message_reactions" FOR SELECT TO iqraa_app
  USING (app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reactions_insert" ON "chat_message_reactions" FOR INSERT TO iqraa_app
  WITH CHECK (user_id = app_uid() AND app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reactions_update" ON "chat_message_reactions" FOR UPDATE TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint
CREATE POLICY "chat_message_reactions_delete" ON "chat_message_reactions" FOR DELETE TO iqraa_app
  USING (user_id = app_uid());--> statement-breakpoint

ALTER TABLE "chat_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_blocks_all" ON "chat_blocks" FOR ALL TO iqraa_app
  USING (blocker_user_id = app_uid()) WITH CHECK (blocker_user_id = app_uid());--> statement-breakpoint

ALTER TABLE "chat_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_reports_select" ON "chat_reports" FOR SELECT TO iqraa_app
  USING (reporter_user_id = app_uid() OR app_role() IN ('school_admin', 'system_admin'));--> statement-breakpoint
CREATE POLICY "chat_reports_insert" ON "chat_reports" FOR INSERT TO iqraa_app
  WITH CHECK (reporter_user_id = app_uid() AND app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_reports_update" ON "chat_reports" FOR UPDATE TO iqraa_app
  USING (app_role() IN ('school_admin', 'system_admin'))
  WITH CHECK (app_role() IN ('school_admin', 'system_admin'));--> statement-breakpoint

ALTER TABLE "device_push_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "device_push_tokens_all" ON "device_push_tokens" FOR ALL TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint

-- ── Evaluations and attempts ──────────────────────────────────────────────
ALTER TABLE "evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evaluations_select" ON "evaluations" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_sees_evaluation(id));--> statement-breakpoint
CREATE POLICY "evaluations_insert" ON "evaluations" FOR INSERT TO iqraa_app
  WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "evaluations_update" ON "evaluations" FOR UPDATE TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "evaluations_delete" ON "evaluations" FOR DELETE TO iqraa_app
  USING (teacher_id = app_uid());--> statement-breakpoint

-- Questions carry the answer key: teacher-only. Students read their paper from
-- attempts.question_snapshot.
ALTER TABLE "evaluation_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evaluation_questions_all" ON "evaluation_questions" FOR ALL TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id)) WITH CHECK (app_teaches_evaluation(evaluation_id));--> statement-breakpoint

ALTER TABLE "evaluation_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evaluation_assignments_select" ON "evaluation_assignments" FOR SELECT TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id)
         OR (student_id IS NOT NULL AND app_linked_to_student(student_id))
         OR (class_group_id IS NOT NULL AND app_in_class(class_group_id)));--> statement-breakpoint
CREATE POLICY "evaluation_assignments_write" ON "evaluation_assignments" FOR ALL TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id)) WITH CHECK (app_teaches_evaluation(evaluation_id));--> statement-breakpoint

ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempts_select" ON "attempts" FOR SELECT TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "attempts_insert" ON "attempts" FOR INSERT TO iqraa_app
  WITH CHECK (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id));--> statement-breakpoint
CREATE POLICY "attempts_update" ON "attempts" FOR UPDATE TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id))
  WITH CHECK (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id));--> statement-breakpoint
CREATE POLICY "attempts_delete" ON "attempts" FOR DELETE TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id));--> statement-breakpoint

ALTER TABLE "attempt_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_answers_select" ON "attempt_answers" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "attempt_answers_write" ON "attempt_answers" FOR ALL TO iqraa_app
  USING (app_writes_attempt(attempt_id)) WITH CHECK (app_writes_attempt(attempt_id));--> statement-breakpoint

-- Grades are written by the teacher, or by server-side grading (systemDb).
ALTER TABLE "attempt_question_grades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_question_grades_select" ON "attempt_question_grades" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "attempt_question_grades_write" ON "attempt_question_grades" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "attempt_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_results_select" ON "attempt_results" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "attempt_results_write" ON "attempt_results" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "recommendations_select" ON "recommendations" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "recommendations_write" ON "recommendations" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "grade_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "grade_overrides_all" ON "grade_overrides" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "grading_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "grading_jobs_all" ON "grading_jobs" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "attempt_retakes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_retakes_select" ON "attempt_retakes" FOR SELECT TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "attempt_retakes_write" ON "attempt_retakes" FOR ALL TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id))
  WITH CHECK (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id));--> statement-breakpoint

ALTER TABLE "mastery_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "mastery_overrides_select" ON "mastery_overrides" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "mastery_overrides_write" ON "mastery_overrides" FOR ALL TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint

-- ── Auth tokens: no policy, and no grant above — systemDb only. ───────────
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ENABLE ROW LEVEL SECURITY;
```

A Postgres role is cluster-wide, not per database: migrating a second database in the same cluster finds `iqraa_app` already there (`IF NOT EXISTS`) and only re-applies the per-database grants, helpers and policies. That is harmless, and it is why a local cluster used for several experiments looks different from CI's fresh one.

Why these shapes, since a reviewer will ask:
- Helpers are `SECURITY DEFINER` so `students`, `roster_links`, `class_memberships` and `chat_*` can consult each other without "infinite recursion detected in policy"; each pins `search_path`.
- `chat_threads` tests `created_by = app_uid()` on the row itself rather than through `app_owns_thread()`: a `STABLE` function reads the statement's snapshot, which cannot see the row an `INSERT … RETURNING` has just written.
- The token tables get `REVOKE ALL` **and** RLS, so a stray `db` use errors instead of returning an empty list.

- [ ] **Step 6: Apply it and run the checks.**

```bash
DATABASE_URL=$RLS_TEST_DATABASE_URL pnpm --filter @workspace/db run migrate -- --from-env
DATABASE_URL=$RLS_TEST_DATABASE_URL pnpm --filter @workspace/db run verify-schema -- --from-env
pnpm --filter @workspace/db run generate
git status --porcelain lib/db/migrations
pnpm --filter @workspace/db run test
```
Expected: `9 applied`; verify-schema passes; `generate` prints `No schema changes, nothing to migrate`; `git status` shows only `0008_row_level_security.sql`, `meta/0008_snapshot.json` and `meta/_journal.json`; the test run passes (12 tests).

- [ ] **Step 7: Prove the guard can fail** (do not commit this). 

```bash
psql "$RLS_TEST_DATABASE_URL" -c "create table forgotten (id int)"
pnpm --filter @workspace/db run test   # expect: the "each table is protected…" test FAILS
psql "$RLS_TEST_DATABASE_URL" -c "drop table forgotten"
```

- [ ] **Step 8: Commit.**

```bash
git add lib/db/migrations lib/db/src/testing lib/db/src/__tests__/rlsCoverage.test.ts
git commit -m "feat(db): iqraa_app role, helper functions and row-level-security policies"
```

---

### Task 3: `ScopedPool`, and `db` / `systemDb`

**Files:**
- Create: `lib/db/src/scopedPool.ts`
- Modify: `lib/db/src/index.ts`
- Test: `lib/db/src/__tests__/rlsMatrix.test.ts`

**Interfaces:**
- Consumes: `currentIdentity()` (Task 1); the role, helpers and policies (Task 2); `seed`, `TEST_URL`, `Fixture` (Task 2).
- Produces: `class ScopedPool extends pg.Pool` with constructor `(config: pg.PoolConfig, enforce: boolean)`. From `@workspace/db`: `db` (scoped when `RLS_ENFORCE=on`), `systemDb` (owner connection; `=== db` when off), `systemPool`, `rlsEnforced: boolean`, `asUser`, `currentIdentity`, `type Identity`.

- [ ] **Step 1: Write the failing matrix test.** It exercises each policy through a real `ScopedPool(…, true)` against the migrated database, plus pool mechanics.

```ts
// lib/db/src/__tests__/rlsMatrix.test.ts
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { asUser } from "../identity.ts";
import { ScopedPool } from "../scopedPool.ts";
import { seed, TEST_URL, type Fixture } from "../testing/rlsHarness.ts";

// Needs a migrated Postgres. Without RLS_TEST_DATABASE_URL (the `workspace` CI
// job has no database) the suite skips; the `migrations` job supplies one.
describe("row-level security matrix", { skip: !TEST_URL && "RLS_TEST_DATABASE_URL not set" }, () => {
  let owner: pg.Pool;
  let scoped: ScopedPool;
  let fx: Fixture;
  let ids: Fixture["ids"];

  before(async () => {
    owner = new pg.Pool({ connectionString: TEST_URL, max: 2 });
    scoped = new ScopedPool({ connectionString: TEST_URL, max: 4 }, true);
    fx = await seed(owner);
    ids = fx.ids;
  });
  after(async () => {
    await fx.cleanup();
    await scoped.end();
    await owner.end();
  });

  const as = <T>(key: keyof Fixture["ids"], role: string, fn: () => Promise<T>) =>
    asUser({ userId: ids[key]!, role }, fn);
  const col = async (sql: string, values: unknown[] = []) =>
    (await scoped.query(sql, values)).rows.map((r: Record<string, unknown>) => Object.values(r)[0]);

  test("no identity sees nothing and writes nothing", async () => {
    assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), []);
    await assert.rejects(
      scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x')`, [ids.teacherA]),
      /row-level security/,
    );
  });

  test("a teacher sees their own students and no one else's", () =>
    as("teacherA", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), [ids.studentA]);
    }));

  test("a teacher cannot update or delete another teacher's student, nor create one in their name", () =>
    as("teacherB", "teacher", async () => {
      assert.equal((await scoped.query(`UPDATE students SET display_name = 'hax' WHERE id = $1`, [ids.studentA])).rowCount, 0);
      assert.equal((await scoped.query(`DELETE FROM students WHERE id = $1`, [ids.studentA])).rowCount, 0);
      await assert.rejects(
        scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x')`, [ids.teacherA]),
        /row-level security/,
      );
    }));

  test("INSERT ... RETURNING works for the owner of the row", () =>
    as("teacherA", "teacher", async () => {
      const res = await scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'New') RETURNING id`, [ids.teacherA]);
      assert.equal(res.rowCount, 1);
      const thread = await scoped.query(`INSERT INTO chat_threads (type, created_by) VALUES ('custom_group', $1) RETURNING id`, [ids.teacherA]);
      assert.equal(thread.rowCount, 1);
    }));

  test("a linked parent sees the child, the child's attempt and class — and cannot edit", () =>
    as("parentA", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), [ids.studentA]);
      assert.deepEqual(await col(`SELECT id FROM attempts`), [ids.attemptA]);
      assert.deepEqual(await col(`SELECT id FROM class_groups WHERE id = $1`, [ids.classA]), [ids.classA]);
      assert.equal((await scoped.query(`UPDATE students SET display_name = 'hax' WHERE id = $1`, [ids.studentA])).rowCount, 0);
      assert.equal((await scoped.query(`UPDATE attempts SET teacher_comment = 'hax' WHERE id = $1`, [ids.attemptA])).rowCount, 0);
    }));

  test("an unlinked parent sees no students, attempts or parent contacts", () =>
    as("parentB", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), []);
      assert.deepEqual(await col(`SELECT id FROM attempts`), []);
      assert.deepEqual(await col(`SELECT id FROM parent_contacts`), []);
    }));

  test("parent contacts are the teacher's alone", () =>
    as("parentA", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM parent_contacts`), []);
    }));

  test("a student sees their own record but never the answer key", () =>
    as("studentUser", "student", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), [ids.studentA]);
      assert.deepEqual(await col(`SELECT id FROM evaluations WHERE id = $1`, [ids.evalA]), [ids.evalA]);
      assert.deepEqual(await col(`SELECT id FROM evaluation_questions`), []);
    }));

  test("grades are written by the teacher, not by the student or parent", async () => {
    for (const [who, role] of [["studentUser", "student"], ["parentA", "parent"]] as const) {
      await as(who, role, async () => {
        await assert.rejects(
          scoped.query(`INSERT INTO attempt_question_grades (attempt_id, question_id, verdict, grader) VALUES ($1, $2, 'correct', 'auto')`, [ids.attemptA, ids.questionA]),
          /row-level security/,
        );
      });
    }
    await as("teacherA", "teacher", async () => {
      const res = await scoped.query(`INSERT INTO attempt_question_grades (attempt_id, question_id, verdict, grader) VALUES ($1, $2, 'correct', 'teacher') RETURNING id`, [ids.attemptA, ids.questionA]);
      assert.equal(res.rowCount, 1);
    });
  });

  test("a thread's participants see it and its messages; outsiders see neither", async () => {
    await as("parentA", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_messages WHERE id = ANY($1)`, [[ids.msgDirect, ids.msgOther]]), [ids.msgDirect]);
      assert.deepEqual(await col(`SELECT id FROM chat_threads WHERE id = ANY($1)`, [[ids.threadDirect, ids.threadOther]]), [ids.threadDirect]);
    });
    await as("parentB", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_messages WHERE id = ANY($1)`, [[ids.msgDirect, ids.msgOther]]), []);
    });
  });

  test("posting needs membership and your own sender id", async () => {
    await as("parentB", "parent", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1, $2, 'intrude')`, [ids.threadDirect, ids.parentB]),
        /row-level security/,
      );
    });
    await as("parentA", "parent", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1, $2, 'spoof')`, [ids.threadDirect, ids.teacherA]),
        /row-level security/,
      );
      const ok = await scoped.query(`INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1, $2, 'hello') RETURNING id`, [ids.threadDirect, ids.parentA]);
      assert.equal(ok.rowCount, 1);
    });
  });

  test("either party of a direct thread may add both parties — even when the other created it", async () => {
    await as("parentA", "parent", async () => {
      // The shape openDirectThread uses: both rows, ON CONFLICT DO NOTHING, rows already there.
      const res = await scoped.query(
        `INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2), ($1,$3) ON CONFLICT DO NOTHING`,
        [ids.threadDirect, ids.parentA, ids.teacherA],
      );
      assert.equal(res.rowCount, 0);
    });
  });

  test("nobody can add themselves to a thread they are not a party to", async () => {
    await as("parentB", "parent", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2)`, [ids.threadDirect, ids.parentB]),
        /row-level security/,
      );
      await assert.rejects(
        scoped.query(`INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2)`, [ids.threadClass, ids.parentB]),
        /row-level security/,
      );
    });
  });

  test("the class owner sees the class thread without a participant row", async () => {
    await as("teacherA", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_threads WHERE id = $1`, [ids.threadClass]), [ids.threadClass]);
    });
    await as("teacherB", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_threads WHERE id = $1`, [ids.threadClass]), []);
    });
  });

  test("blocks are visible only to the blocker", async () => {
    await as("parentA", "parent", async () => {
      assert.equal((await col(`SELECT id FROM chat_blocks`)).length, 1);
    });
    await as("teacherA", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_blocks`), []); // teacherA is the blocked one: must not learn it
    });
  });

  test("reports: reporter sees their own, an admin sees all", async () => {
    await as("parentA", "parent", async () => {
      assert.equal((await col(`SELECT id FROM chat_reports WHERE thread_id = ANY($1)`, [[ids.threadDirect, ids.threadOther]])).length, 1);
    });
    await as("admin", "system_admin", async () => {
      assert.equal((await col(`SELECT id FROM chat_reports WHERE thread_id = ANY($1)`, [[ids.threadDirect, ids.threadOther]])).length, 2);
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), []); // admins get no blanket access
    });
  });

  test("auth token tables are closed to the app role entirely", () =>
    as("teacherA", "teacher", async () => {
      await assert.rejects(scoped.query(`SELECT 1 FROM refresh_tokens`), /permission denied/);
      await assert.rejects(scoped.query(`SELECT 1 FROM password_reset_tokens`), /permission denied/);
      await assert.rejects(scoped.query(`SELECT 1 FROM email_verification_tokens`), /permission denied/);
    }));

  test("an owner connection (systemDb) is not subject to policies", async () => {
    const res = await owner.query(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]);
    assert.equal(res.rowCount, 2);
  });

  test("with enforcement off the pool behaves like a plain pg.Pool", async () => {
    const off = new ScopedPool({ connectionString: TEST_URL, max: 2 }, false);
    try {
      const res = await off.query(`SELECT current_user AS u, (SELECT count(*) FROM students WHERE id = ANY($1)) AS n`, [[ids.studentA, ids.studentB]]);
      assert.notEqual(res.rows[0].u, "iqraa_app");
      assert.equal(res.rows[0].n, "2");
    } finally {
      await off.end();
    }
  });

  test("a transaction (the db.transaction path) runs scoped and nothing leaks afterwards", async () => {
    await as("teacherA", "teacher", async () => {
      const client = await scoped.connect();
      try {
        await client.query("begin");
        const inside = await client.query(`SELECT current_user AS u, app_uid() AS uid, (SELECT count(*) FROM students WHERE id = ANY($1)) AS n`, [[ids.studentA, ids.studentB]]);
        assert.equal(inside.rows[0].u, "iqraa_app");
        assert.equal(inside.rows[0].uid, ids.teacherA);
        assert.equal(inside.rows[0].n, "1");
        await client.query("commit");
      } finally {
        client.release();
      }
    });
    // Next borrower, no identity: still iqraa_app, but no user left over.
    const after = await scoped.query(`SELECT current_user AS u, app_uid() AS uid`);
    assert.equal(after.rows[0].u, "iqraa_app");
    assert.equal(after.rows[0].uid, null);
  });

  test("a failed statement rolls back and the connection stays usable", () =>
    as("teacherA", "teacher", async () => {
      await assert.rejects(scoped.query(`INSERT INTO students (teacher_id) VALUES ($1)`, [ids.teacherA])); // display_name is NOT NULL
      assert.equal((await col(`SELECT 1 AS one`)).length, 1);
    }));
});
```

- [ ] **Step 2: Run it to see it fail.**

Run: `pnpm --filter @workspace/db run test`
Expected: FAIL — `Cannot find module '../scopedPool.ts'`.

- [ ] **Step 3: Implement `ScopedPool`.**

```ts
// lib/db/src/scopedPool.ts
import pg from "pg";
import { currentIdentity } from "./identity.ts";

const BEGIN_RE = /^\s*begin\b/i;

/**
 * The statements that make a transaction act as the current request's user.
 * No identity still switches role — it just sets no user, so every policy
 * evaluates false and the query sees nothing (fail closed).
 */
function scopeSql(): string {
  const identity = currentIdentity();
  const toRole = "SET LOCAL ROLE iqraa_app";
  if (!identity) return toRole;
  return (
    `${toRole}; SELECT set_config('app.user_id', '${identity.userId}', true), ` +
    `set_config('app.role', '${identity.role}', true)`
  );
}

/**
 * A pg.Pool whose every statement runs as `iqraa_app` with the current
 * request's identity, so Postgres row-level security applies.
 *
 * - `query()` (what Drizzle calls outside a transaction): one short
 *   transaction per statement — BEGIN + scope, the statement, COMMIT.
 * - `connect()` (what Drizzle calls for `db.transaction`): the returned client
 *   runs the scope statements right after Drizzle's own BEGIN.
 *
 * Both are SET LOCAL / set_config(..., true), so nothing outlives the
 * transaction — safe behind a transaction-mode pooler, and safe for the next
 * borrower of the connection.
 *
 * With `enforce` false it is exactly a pg.Pool.
 */
export class ScopedPool extends pg.Pool {
  private enforce: boolean;

  constructor(config: pg.PoolConfig, enforce: boolean) {
    super(config);
    this.enforce = enforce;
  }

  override query(...args: any[]): any {
    if (!this.enforce || typeof args[args.length - 1] === "function") {
      return (super.query as any).apply(this, args);
    }
    return this.scopedQuery(args);
  }

  override connect(): Promise<pg.PoolClient>;
  override connect(cb: (err: Error | undefined, client: pg.PoolClient | undefined, done: (release?: any) => void) => void): void;
  override connect(cb?: any): any {
    if (!this.enforce || cb) return (super.connect as any).call(this, cb);
    return this.scopedConnect();
  }

  private async scopedQuery(args: any[]): Promise<pg.QueryResult> {
    const client = await super.connect();
    let broken = false;
    try {
      await client.query(`BEGIN; ${scopeSql()}`);
      const result = await (client.query as any)(...args);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        broken = true; // a connection that cannot roll back is discarded, not reused
      }
      throw err;
    } finally {
      client.release(broken);
    }
  }

  private async scopedConnect(): Promise<pg.PoolClient> {
    const client = await super.connect();
    const scope = scopeSql(); // fixed at checkout: a transaction keeps its caller's identity
    const originalQuery = client.query.bind(client) as (...a: any[]) => any;
    const poolRelease = client.release;

    (client as any).query = async (...a: any[]) => {
      if (typeof a[a.length - 1] === "function") return originalQuery(...a);
      const result = await originalQuery(...a);
      const first = a[0];
      const text = typeof first === "string" ? first : first?.text;
      if (typeof text === "string" && BEGIN_RE.test(text)) await originalQuery(scope);
      return result;
    };
    client.release = (err?: Error | boolean) => {
      delete (client as any).query; // back to the prototype method for the next borrower
      return poolRelease.call(client, err);
    };
    return client;
  }
}
```

- [ ] **Step 4: Run the matrix.**

Run: `pnpm --filter @workspace/db run test`
Expected: PASS — 33 tests (6 identity, 6 coverage, 21 matrix).

- [ ] **Step 5: Wire `db` and `systemDb`.** Edit `lib/db/src/index.ts` so it reads exactly:

```ts
// lib/db/src/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { ScopedPool } from "./scopedPool";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/** Set by the deploy (Cloud Run env), read once at boot. Off unless exactly "on". */
export const rlsEnforced = process.env.RLS_ENFORCE === "on";

export const pool = new ScopedPool({ connectionString: process.env.DATABASE_URL, keepAlive: true }, rlsEnforced);

// An idle client can die underneath the pool (Neon restarts or suspends compute,
// the pooler recycles a socket). pg re-emits that on the pool, and an 'error'
// event with no listener is thrown — it would take the whole process down with
// every in-flight request. The pool discards the dead client itself; the next
// query just opens a fresh one, so logging is all that's needed.
pool.on("error", (err) => {
  console.error(JSON.stringify({ level: "error", msg: "idle pg client error", err: err.message }));
});
export const db = drizzle(pool, { schema });

/**
 * The owner connection: no role switch, so row-level security does not apply.
 * For the paths that act without a user (login, token-link attempts), or on
 * behalf of the server (notification fan-out, grading). With enforcement off it
 * is `db` itself — one pool, nothing changes. With it on there are two pools of the
 * default size, so an instance can hold twice the connections: check the database's
 * limit (and Cloud Run's max instances) before the flip.
 */
export const systemPool: pg.Pool = rlsEnforced ? new Pool({ connectionString: process.env.DATABASE_URL, keepAlive: true }) : pool;
if (systemPool !== pool) {
  systemPool.on("error", (err) => {
    console.error(JSON.stringify({ level: "error", msg: "idle pg client error (system pool)", err: err.message }));
  });
}
export const systemDb = systemPool === pool ? db : drizzle(systemPool, { schema });

export { asUser, currentIdentity, type Identity } from "./identity";

export * from "./schema";
```

Imports here stay extensionless (`./scopedPool`, `./identity`), like the rest of this file — esbuild resolves them; `scopedPool.ts` itself imports `./identity.ts` with the extension so tests can load it directly.

- [ ] **Step 6: Verify the whole repo still builds and nothing changed with enforcement off.**

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run test
```
Expected: typecheck clean; build succeeds; api-server tests pass (1613 at the time of writing). With `RLS_ENFORCE` unset `db` is a plain pool and `systemDb === db`.

- [ ] **Step 7: Commit.**

```bash
git add lib/db/src
git commit -m "feat(db): ScopedPool runs every statement as iqraa_app with the request's identity"
```

---

### Task 4: Carry the identity from `authMiddleware`, and write the audit

This task ends **red on purpose**: its deliverable is the differential test and the exact list of what breaks. Commit it together with Task 5.

**Files:**
- Modify: `artifacts/api-server/src/middlewares/auth.ts`
- Test: `lib/db/src/__tests__/rlsDiff.test.ts`

**Interfaces:**
- Consumes: `asUser`, `systemDb` (Task 3).
- Produces: every request that passes `authMiddleware` runs inside `asUser({ userId, role }, …)`.

- [ ] **Step 1: Wire the middleware.** Apply:

```diff
diff --git a/artifacts/api-server/src/middlewares/auth.ts b/artifacts/api-server/src/middlewares/auth.ts
index 39001be..7d9e7ff 100644
--- a/artifacts/api-server/src/middlewares/auth.ts
+++ b/artifacts/api-server/src/middlewares/auth.ts
@@ -1,6 +1,5 @@
 import { type Request, type Response, type NextFunction } from "express";
 import jwt from "jsonwebtoken";
-import { db } from "@workspace/db";
-import { users } from "@workspace/db";
+import { asUser, systemDb as db, users } from "@workspace/db";
 import { eq } from "drizzle-orm";
 import { logger } from "../lib/logger.js";
@@ -91,5 +90,8 @@ export async function authMiddleware(
     const { suspendedAt: _suspendedAt, suspendedReason: _suspendedReason, ...principal } = user;
     req.user = principal;
-    next();
+    // Everything downstream — handlers, helpers, fire-and-forget work they
+    // start — runs as this user, so Postgres row-level security can tell who
+    // is asking (lib/db/src/scopedPool.ts). Inert while RLS_ENFORCE is off.
+    asUser({ userId: principal.id, role: principal.role }, () => next());
   } catch (err) {
     // An expired/malformed/wrong-secret token is routine — every client with
```

The lookup is on `systemDb` because no identity exists yet, and because it saves three round trips on every request. `next()` is called inside `asUser` so handlers, helpers and fire-and-forget work they start (push fan-out) keep the identity.

- [ ] **Step 2: Write the differential test.** It boots `dist/index.mjs` twice (enforcement off and on) on one seeded database, preloads a `fetch` stub into each that records Expo pushes, and compares: every read for six identities; every write step's status; the pushes sent; the rows left behind; and any error the "on" server logs that the "off" server does not. A positive control revokes a privilege to prove the "on" server really switches role.

```ts
// lib/db/src/__tests__/rlsDiff.test.ts
import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { seed, TEST_URL, type Fixture } from "../testing/rlsHarness.ts";

/**
 * The audit, as a test. Boots the built API twice against one seeded database —
 * RLS_ENFORCE off, then on — and drives the same requests as every kind of user.
 * Turning enforcement on must change nothing anyone can see or cause. A status, a
 * body, a push notification or a row left behind that differs is a query that reads
 * another user's rows (or a policy that is too tight): it shows up here, not in
 * production. Run it after every route change that touches a protected table.
 *
 * Needs `pnpm --filter @workspace/api-server build` first, and a migrated database.
 */
const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../artifacts/api-server/dist/index.mjs");
const skip = !TEST_URL ? "RLS_TEST_DATABASE_URL not set" : !existsSync(entry) ? "build the api-server first" : false;
const SECRET = "rls-diff-secret-padded-to-clear-the-32-char-boot-check";
const SITE_KEY = "rls-diff-site-key";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // what the API accepts in share and login codes

function accessToken(sub: string, role: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, email: `${sub}@rls.test`, role, type: "access", iat: now, exp: now + 600 });
  return `${head}.${body}.${createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url")}`;
}

const randomCode = (length: number) => Array.from(randomBytes(length), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

interface Server { base: string; child: ChildProcess; logs: string[]; pushLog: string }

// Preloaded into each server: records every Expo push instead of sending it, so a
// notification that silently stops being sent shows up in the comparison. A token
// containing "dead" is answered the way Expo answers an uninstalled app.
const PUSH_STUB = `
import { appendFileSync } from "node:fs";
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("exp.host")) {
    const messages = JSON.parse(init.body);
    for (const m of messages) appendFileSync(process.env.RLS_PUSH_LOG, JSON.stringify({ to: m.to, title: m.title, body: m.body }) + "\\n");
    const data = messages.map(m => String(m.to).includes("dead")
      ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
      : { status: "ok" });
    return new Response(JSON.stringify({ data }), { status: 200 });
  }
  return realFetch(url, init);
};
`;

async function boot(enforce: "on" | "off"): Promise<Server> {
  const dir = mkdtempSync(path.join(tmpdir(), "rls-diff-"));
  const stub = path.join(dir, "push-stub.mjs");
  const pushLog = path.join(dir, "pushes.jsonl");
  writeFileSync(stub, PUSH_STUB);
  writeFileSync(pushLog, "");
  const port = 8500 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: TEST_URL!,
      SESSION_SECRET: SECRET,
      OPENAI_API_KEY: "sk-test-placeholder",
      SITE_INGEST_KEY: SITE_KEY,
      RLS_ENFORCE: enforce,
      STUDENT_ACCOUNTS: "true", // parent and student routes answer 403 without it
      NODE_OPTIONS: `--import ${stub}`,
      RLS_PUSH_LOG: pushLog,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs: string[] = [];
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", (chunk: Buffer) => logs.push(...chunk.toString().split("\n").filter(Boolean)));
  const base = `http://127.0.0.1:${port}/api`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    try { if ((await fetch(`${base}/healthz`)).ok) return { base, child, logs, pushLog }; } catch { /* not listening yet */ }
    if (Date.now() > deadline) throw new Error(`server (${enforce}) did not start`);
    await new Promise(r => setTimeout(r, 150));
  }
}

/** `updatedAt` moves whenever an endpoint syncs something as a side effect, so two concurrent reads differ by milliseconds. */
function withoutVolatile(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutVolatile);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "updatedAt").map(([k, v]) => [k, withoutVolatile(v)]));
  }
  return value;
}

/** The first place two JSON values disagree, with a little context — whole bodies are too long to read. */
function firstDifference(a: unknown, b: unknown, at = "$"): { off: string; on: string } {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) return { off: "(same)", on: "(same)" };
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
      const x = (a as Record<string, unknown>)[k];
      const y = (b as Record<string, unknown>)[k];
      if (JSON.stringify(x) !== JSON.stringify(y)) return firstDifference(x, y, `${at}.${k}`);
    }
  }
  return { off: `${at} = ${sa?.slice(0, 120)}`, on: `${at} = ${sb?.slice(0, 120)}` };
}

interface Reply { status: number; label: string; json: Record<string, unknown> }

async function request(server: Server, method: string, url: string, opts: { bearer?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Reply> {
  const res = await fetch(`${server.base}${url}`, {
    method,
    headers: { "content-type": "application/json", ...(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}), ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const code = typeof json["code"] === "string" ? ` ${json["code"]}` : "";
  return { status: res.status, label: `${res.status}${code}`, json: withoutVolatile(json) as Record<string, unknown> };
}

describe("turning row-level security on changes nothing a user can see or cause", { skip }, () => {
  let owner: pg.Pool;
  let fx: Fixture;
  let off: Server;
  let on: Server;

  before(async () => {
    owner = new pg.Pool({ connectionString: TEST_URL, max: 3 });
    fx = await seed(owner);
    [off, on] = await Promise.all([boot("off"), boot("on")]);
  });
  after(async () => {
    off?.child.kill();
    on?.child.kill();
    await fx?.cleanup();
    await owner?.end();
  });

  test("control: the enforcing server really runs queries as iqraa_app", async () => {
    // schedule_periods is unprotected and untouched by the other suites, so revoking it
    // here breaks nothing else. Off: the owner still reads it. On: the role switch makes
    // the same request fail. If both answered 200 this suite would be comparing two
    // servers that behave identically for the wrong reason.
    const token = accessToken(fx.ids.teacherA!, "teacher");
    await owner.query("REVOKE SELECT ON schedule_periods FROM iqraa_app");
    try {
      const [a, b] = await Promise.all([request(off, "GET", "/schedule", { bearer: token }), request(on, "GET", "/schedule", { bearer: token })]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 500);
    } finally {
      await owner.query("GRANT SELECT ON schedule_periods TO iqraa_app");
    }
  });

  // ── Reads ─────────────────────────────────────────────────────────────────
  const READS = (i: Fixture["ids"]): Record<string, [string, string[]]> => ({
    teacherA: ["teacher", [
      "/auth/me", "/classes", `/classes/${i.classA}`, `/classes/${i.classA}/mastery`, `/classes/${i.classA}/support-groups`,
      `/classes/${i.classA}/resources`, `/classes/${i.classA}/parent-contacts`, "/students",
      `/students/${i.studentA}/parent-contacts`, `/students/${i.studentA}/claim-code`,
      `/classes/${i.classA}/students/${i.studentA}/record`, "/evaluations", `/evaluations/${i.evalA}`,
      `/evaluations/${i.evalA}/attempts`, `/evaluations/${i.evalA}/coverage`, `/evaluations/${i.evalA}/insights`,
      `/attempts/${i.attemptA}`, "/messaging/contacts", "/messaging/threads", `/messaging/threads/${i.threadDirect}`,
      `/messaging/threads/${i.threadDirect}/messages`, `/messaging/threads/class/${i.classA}`,
      "/exam-calendar?from=2026-01-01&to=2026-12-31", "/schedule", "/teaching-plans", "/workspace/items",
    ]],
    teacherB: ["teacher", ["/students", "/evaluations", `/evaluations/${i.evalA}`, `/attempts/${i.attemptA}`, `/classes/${i.classA}`, `/messaging/threads/${i.threadDirect}`, "/messaging/threads"]],
    parentA: ["parent", [
      "/auth/me", "/parent/exams", "/student/exams", "/student/grades", "/student/progress", "/messaging/contacts",
      "/messaging/threads", `/messaging/threads/${i.threadDirect}`, `/messaging/threads/${i.threadDirect}/messages`,
    ]],
    parentB: ["parent", ["/parent/exams", "/messaging/contacts", "/messaging/threads", `/messaging/threads/${i.threadDirect}`]],
    studentUser: ["student", ["/auth/me", "/student/exams", "/student/grades", "/student/progress", "/messaging/contacts", "/messaging/threads"]],
    admin: ["system_admin", ["/moderation/reports", "/admin/users", "/admin/usage-summary", "/admin/metrics"]],
  });

  test("every read answers the same with enforcement on and off", async () => {
    const differences: string[] = [];
    let compared = 0;
    for (const [who, [role, urls]] of Object.entries(READS(fx.ids))) {
      const token = accessToken(fx.ids[who]!, role);
      for (const url of urls) {
        const [a, b] = await Promise.all([request(off, "GET", url, { bearer: token }), request(on, "GET", url, { bearer: token })]);
        compared++;
        if (process.env.RLS_DIFF_VERBOSE) console.log(`READ ${who.padEnd(11)} ${a.status}/${b.status} ${url}`);
        if (a.status !== b.status || JSON.stringify(a.json) !== JSON.stringify(b.json)) {
          const d = firstDifference(a.json, b.json);
          differences.push(`${who} GET ${url}\n   off ${a.status} ${d.off}\n   on  ${b.status} ${d.on}`);
        }
      }
    }
    assert.ok(compared > 50, `only compared ${compared} requests`);
    assert.deepEqual(differences, [], `\n${differences.join("\n")}\n`);
  });

  // ── Writes and side effects ───────────────────────────────────────────────
  // Each server gets its own fixture, so one mode's mutations cannot change the other's
  // answers. Statuses (and error codes) are compared, not ids, which differ.

  /** How many rows each table holds for one fixture's people — effects a status cannot show. */
  async function fingerprint(i: Fixture["ids"]): Promise<Record<string, number>> {
    const people = [i.teacherA, i.teacherB, i.parentA, i.parentB, i.studentUser, i.studentUser2, i.admin];
    const threads = `SELECT id FROM chat_threads WHERE created_by = ANY($1::uuid[]) OR class_group_id IN (SELECT id FROM class_groups WHERE teacher_id = ANY($1::uuid[]))`;
    const messages = `SELECT id FROM chat_messages WHERE thread_id IN (${threads})`;
    const attempts = `SELECT id FROM attempts WHERE evaluation_id = '${i.evalA}'`;
    const count = async (sql: string) => Number((await owner.query(sql, sql.includes("$1") ? [people] : [])).rows[0].n);
    return {
      participants: await count(`SELECT count(*) n FROM chat_participants WHERE thread_id IN (${threads})`),
      messages: await count(`SELECT count(*) n FROM (${messages}) m`),
      reads: await count(`SELECT count(*) n FROM chat_message_reads WHERE message_id IN (${messages})`),
      reactions: await count(`SELECT count(*) n FROM chat_message_reactions WHERE message_id IN (${messages})`),
      reports: await count(`SELECT count(*) n FROM chat_reports WHERE reporter_user_id = ANY($1::uuid[])`),
      threads: await count(`SELECT count(*) n FROM (${threads}) t`),
      classes: await count(`SELECT count(*) n FROM class_groups WHERE teacher_id = ANY($1::uuid[])`),
      students: await count(`SELECT count(*) n FROM students WHERE teacher_id = ANY($1::uuid[])`),
      memberships: await count(`SELECT count(*) n FROM class_memberships WHERE class_group_id IN (SELECT id FROM class_groups WHERE teacher_id = ANY($1::uuid[]))`),
      links: await count(`SELECT count(*) n FROM roster_links WHERE student_id IN (SELECT id FROM students WHERE teacher_id = ANY($1::uuid[]))`),
      contacts: await count(`SELECT count(*) n FROM parent_contacts WHERE teacher_id = ANY($1::uuid[])`),
      pushTokens: await count(`SELECT count(*) n FROM device_push_tokens WHERE user_id = ANY($1::uuid[])`),
      refreshTokens: await count(`SELECT count(*) n FROM refresh_tokens WHERE user_id = ANY($1::uuid[])`),
      attempts: await count(`SELECT count(*) n FROM (${attempts}) a`),
      grades: await count(`SELECT count(*) n FROM attempt_question_grades WHERE attempt_id IN (${attempts})`),
      results: await count(`SELECT count(*) n FROM attempt_results WHERE attempt_id IN (${attempts})`),
      signups: await count(`SELECT count(*) n FROM site_signups WHERE email = 'rls-${i.teacherA}@rls.test'`),
    };
  }

  interface WriteRun { steps: string[]; cleanup: () => Promise<void>; teacherPrefix: string; state: Record<string, number> }

  async function runWrites(server: Server, mode: "on" | "off"): Promise<WriteRun> {
    const f = await seed(owner);
    const i = f.ids;
    const prefix = i.teacherA!.slice(0, 8);
    const bearer: Record<string, string> = {
      teacher: accessToken(i.teacherA!, "teacher"),
      parent: accessToken(i.parentA!, "parent"),
      otherParent: accessToken(i.parentB!, "parent"),
      student: accessToken(i.studentUser!, "student"),
      student2: accessToken(i.studentUser2!, "student"),
      admin: accessToken(i.admin!, "system_admin"),
    };
    const q = (sql: string, v: unknown[] = []) => owner.query(sql, v);
    const steps: string[] = [];
    const step = async (name: string, who: keyof typeof bearer, method: string, url: string, body?: unknown) => {
      const reply = await request(server, method, url, { bearer: bearer[who], body });
      steps.push(`${name}: ${reply.label}`);
      return reply;
    };
    const publicStep = async (name: string, method: string, url: string, opts: { bearer?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
      const reply = await request(server, method, url, opts);
      steps.push(`${name}: ${reply.label}`);
      return reply;
    };

    // ── Fixture the seed does not cover ──
    const loginCode = randomCode(12);
    await q("DELETE FROM chat_blocks WHERE blocker_user_id = $1", [i.parentA]);
    await q("UPDATE users SET roster_consent_at = now(), roster_consent_version = '2026-09-05.v1' WHERE id = $1", [i.teacherA]);
    await q("UPDATE users SET login_code_hash = $2 WHERE id = $1", [i.parentA, createHash("sha256").update(loginCode).digest("hex")]);
    await q("UPDATE attempts SET question_snapshot = $2::jsonb, submitted_at = now(), status = 'submitted' WHERE id = $1", [i.attemptA, JSON.stringify([{ id: i.questionA, evaluationId: i.evalA, type: "mcq", marks: 1 }])]);
    await q("UPDATE evaluations SET status = 'published' WHERE id = $1", [i.evalA]);
    for (const [who, label] of [[i.teacherA, "teacher"], [i.parentA, "parent"], [i.studentUser, "student"], [i.admin, "admin"], [i.teacherA, "dead"]] as const) {
      await q("INSERT INTO device_push_tokens (user_id, expo_push_token, platform) VALUES ($1, $2, 'android')", [who, `ExponentPushToken[${label}-${mode}-${prefix}]`]);
    }

    // ── Direct messages: open from both sides (the second is the ON CONFLICT path), post, react, read ──
    await step("teacher opens DM", "teacher", "POST", "/messaging/threads", { counterpartUserId: i.parentA });
    await step("parent re-opens DM", "parent", "POST", "/messaging/threads", { counterpartUserId: i.teacherA });
    await step("teacher posts", "teacher", "POST", `/messaging/threads/${i.threadDirect}/messages`, { body: "hello" });
    await step("parent posts", "parent", "POST", `/messaging/threads/${i.threadDirect}/messages`, { body: "reply" });
    await step("parent reacts", "parent", "PUT", `/messaging/threads/${i.threadDirect}/messages/${i.msgDirect}/reaction`, { emoji: "👍" });
    await step("parent unreacts", "parent", "DELETE", `/messaging/threads/${i.threadDirect}/messages/${i.msgDirect}/reaction`);
    await step("teacher marks read", "teacher", "POST", `/messaging/threads/${i.threadDirect}/read`);
    await step("parent marks all read", "parent", "POST", "/messaging/threads/read-all");

    // ── Groups, blocks, and who gets a push ──
    await step("teacher creates group", "teacher", "POST", "/messaging/threads/custom", { title: "Group", participantUserIds: [i.parentA] });
    const { rows: [custom] } = await q("SELECT id FROM chat_threads WHERE type = 'custom_group' AND created_by = $1", [i.teacherA]);
    await q("UPDATE chat_threads SET student_posting_enabled = true WHERE id = $1", [custom?.id]);
    await q("INSERT INTO chat_participants (thread_id, user_id) VALUES ($1, $2)", [custom?.id, i.parentB]);
    await step("teacher posts in group", "teacher", "POST", `/messaging/threads/${custom?.id}/messages`, { body: "announce" });
    await step("parent blocks another parent", "parent", "POST", "/messaging/blocks", { blockedUserId: i.parentB });
    // parentB's post must reach the teacher (whose dead token is pruned) but not parentA, who blocked them.
    await step("blocked parent posts in group", "otherParent", "POST", `/messaging/threads/${custom?.id}/messages`, { body: "from the blocked one" });
    await step("parent unblocks them", "parent", "DELETE", `/messaging/blocks/${i.parentB}`);
    await step("parent hides group", "parent", "POST", `/messaging/threads/${custom?.id}/hide`);
    await step("teacher broadcasts", "teacher", "POST", "/messaging/threads/broadcast", { participantUserIds: [i.parentA], body: "all" });
    await step("parent reports", "parent", "POST", "/messaging/reports", { threadId: i.threadDirect, reportedUserId: i.teacherA, reason: "x" });
    const phone = `ExponentPushToken[phone-${mode}-${prefix}]`;
    await step("teacher registers device", "teacher", "POST", "/messaging/device-tokens", { expoPushToken: phone, platform: "android" });
    await step("parent registers the same device", "parent", "POST", "/messaging/device-tokens", { expoPushToken: phone, platform: "android" });
    await step("teacher blocks a parent", "teacher", "POST", "/messaging/blocks", { blockedUserId: i.parentA });
    await step("blocked parent opens DM", "parent", "POST", "/messaging/threads", { counterpartUserId: i.teacherA });
    await step("teacher unblocks the parent", "teacher", "DELETE", `/messaging/blocks/${i.parentA}`);

    // ── Signing in with a login code, refreshing, and a public signup that pushes the admins ──
    const signedIn = await publicStep("code login", "POST", "/auth/code-login", { body: { loginCode } });
    await publicStep("refresh", "POST", "/auth/refresh", { body: { refreshToken: signedIn.json["refreshToken"] } });
    await publicStep("public waitlist signup", "POST", "/site/signups", { body: { kind: "waitlist", email: `rls-${i.teacherA}@rls.test`, name: "n" }, headers: { "x-site-key": SITE_KEY } });

    // ── Roster ──
    await step("teacher creates class", "teacher", "POST", "/classes", { name: "Second" });
    const { rows: [c2] } = await q("SELECT id FROM class_groups WHERE teacher_id = $1 AND name = 'Second'", [i.teacherA]);
    await step("teacher adds a student to it", "teacher", "POST", `/classes/${c2?.id}/students`, { displayName: "New Kid" });
    await step("teacher edits a student", "teacher", "PATCH", `/students/${i.studentA}`, { teacherNote: "note" });
    await step("teacher logs a parent contact", "teacher", "POST", `/students/${i.studentA}/parent-contacts`, { kind: "missing-homework", channel: "copy" });
    await step("teacher issues a join code", "teacher", "POST", `/classes/${i.classA}/join-code`);
    // A parent claims a student with the teacher's code: the lookup runs before any link
    // exists, and the claim adds them to the class thread.
    const studentD = randomUUID();
    await q("INSERT INTO students (id, teacher_id, display_name) VALUES ($1, $2, 'Claim Kid')", [studentD, i.teacherA]);
    await q("INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)", [i.classA, studentD]);
    const issued = await step("teacher issues a claim code", "teacher", "POST", `/students/${studentD}/claim-code`);
    await step("parent claims a student", "otherParent", "POST", "/auth/claim", { claimCode: issued.json["claimCode"] });
    // A student claims their own record: the claim syncs them into the class thread, a write
    // to a thread they do not own and cannot see until it lands.
    const studentE = randomUUID();
    await q("INSERT INTO students (id, teacher_id, display_name) VALUES ($1, $2, 'Own Record')", [studentE, i.teacherA]);
    await q("INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)", [i.classA, studentE]);
    const issuedForStudent = await step("teacher issues a claim code for a student account", "teacher", "POST", `/students/${studentE}/claim-code`);
    await step("student claims their own record", "student2", "POST", "/auth/claim", { claimCode: issuedForStudent.json["claimCode"] });
    // Checked now, not in the final fingerprint: the next teacher action reconciles the thread
    // again and would hide a claim that silently failed to add the student.
    const { rows: [members] } = await q("SELECT count(*)::int AS n FROM chat_participants WHERE thread_id = $1", [i.threadClass]);
    steps.push(`class thread members right after the claim: ${members?.n}`);
    await step("teacher reissues a parent's login code", "teacher", "POST", `/students/${i.studentA}/links/${i.parentA}/login-code`);
    await step("teacher removes a student from the class", "teacher", "DELETE", `/classes/${i.classA}/students/${i.studentA}`);
    await step("teacher unlinks a parent", "teacher", "DELETE", `/students/${i.studentA}/links/${i.parentA}`);
    await step("admin sets a password", "admin", "POST", `/admin/users/${i.parentA}/password`, { password: "RlsDiff-Passw0rd-2026!" });

    // ── Exams: grade, comment, release (which fans out notifications) ──
    await step("teacher grades a question", "teacher", "PUT", `/attempts/${i.attemptA}/grades/${i.questionA}`, { awardedMarks: 1, verdict: "correct" });
    await step("teacher comments", "teacher", "PATCH", `/attempts/${i.attemptA}`, { teacherComment: "well done" });
    await step("teacher releases results", "teacher", "POST", `/evaluations/${i.evalA}/results-release`, { released: true });
    await step("student reads exams", "student", "GET", "/student/exams");

    // ── A student taking the exam from a shared link: no login, so no identity at all ──
    const scale = randomUUID();
    await q("INSERT INTO level_scales (id, name) VALUES ($1, $2)", [scale, `rls-${scale}`]);
    await q("INSERT INTO level_bands (scale_id, key, label_ar, label_en, min_percent, max_percent) VALUES ($1,'low','ضعيف','Low',0,49), ($1,'high','متقدم','High',50,100)", [scale]);
    const shareCode = randomCode(8);
    await q("UPDATE evaluations SET level_scale_id = $2, share_code = $3, share_code_expires_at = NULL, class_group_id = $4 WHERE id = $1", [i.evalA, scale, shareCode, i.classA]);
    await q("UPDATE evaluation_questions SET type = 'true_false' WHERE id = $1", [i.questionA]);
    const studentC = randomUUID();
    await q("INSERT INTO students (id, teacher_id, display_name) VALUES ($1, $2, 'Link Kid'), ($3, $2, 'Assigned Kid')", [studentC, i.teacherA, randomUUID()]);
    await q("INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)", [i.classA, studentC]);
    // The exam is assigned to one student only, so the link must refuse everyone else.
    await q("INSERT INTO evaluation_assignments (evaluation_id, student_id, assigned_by) VALUES ($1, $2, $3)", [i.evalA, i.studentA, i.teacherA]);
    await publicStep("link - open the exam", "GET", `/take/${shareCode}`);
    const refused = await publicStep("link - pick a name outside the group", "POST", `/take/${shareCode}/claim`, { body: { studentId: studentC } });
    await publicStep("link - answer with the refused token", "PUT", `/take/attempt/answers/${i.questionA}`, { bearer: refused.json["token"] as string | undefined, body: { response: { value: true } } });
    // Lift the restriction so the same student can sit it, and walk the whole attempt.
    await q("DELETE FROM evaluation_assignments WHERE evaluation_id = $1", [i.evalA]);
    const claimed = await publicStep("link - pick a name", "POST", `/take/${shareCode}/claim`, { body: { studentId: studentC } });
    const token = claimed.json["token"] as string | undefined;
    await publicStep("link - read state", "GET", "/take/attempt/state", { bearer: token });
    await publicStep("link - answer", "PUT", `/take/attempt/answers/${i.questionA}`, { bearer: token, body: { response: { value: true } } });
    await publicStep("link - hand in", "POST", "/take/attempt/submit", { bearer: token, body: {} });
    await publicStep("link - result", "GET", "/take/attempt/result", { bearer: token });

    await new Promise(r => setTimeout(r, 800)); // fire-and-forget work (push, group line) finishes after the response
    return { steps, cleanup: f.cleanup, teacherPrefix: prefix, state: await fingerprint(i) };
  }

  test("every write answers the same with enforcement on and off — and leaves the same behind", async () => {
    const [a, b] = await Promise.all([runWrites(off, "off"), runWrites(on, "on")]);
    try {
      if (process.env.RLS_DIFF_VERBOSE) for (const [n, line] of a.steps.entries()) console.log(`WRITE ${line}  | on: ${b.steps[n]?.split(": ").pop()}`);
      const statusDifferences = a.steps.flatMap((line, n) => (line === b.steps[n] ? [] : [`${line.split(": ")[0]}\n   off ${line.split(": ").pop()}\n   on  ${b.steps[n]?.split(": ").pop()}`]));

      // Strip what is specific to one fixture: the mode and id baked into each token, and the
      // signup address. (The public signup also pushes every admin in the shared database,
      // so both runs see both fixtures' admin tokens — they normalise to the same line.)
      const pushes = (server: Server) =>
        readFileSync(server.pushLog, "utf8").split("\n").filter(Boolean)
          .map(l => JSON.parse(l) as { to: string; title: string; body: string })
          .map(p => `${p.to} | ${p.title} | ${p.body}`.replace(/-(on|off)-[0-9a-f]{8}\]/g, "]").replace(/rls-[0-9a-f-]{36}@rls\.test/g, "rls-X@rls.test"))
          .sort();
      const offPushes = pushes(off);
      const onPushes = pushes(on);
      const pushDifferences = JSON.stringify(offPushes) === JSON.stringify(onPushes) ? [] : [`off sent:\n   ${offPushes.join("\n   ")}\n  on sent:\n   ${onPushes.join("\n   ")}`];

      const errors = (server: Server) => new Set(server.logs.filter(l => /"level":(50|60)|"level":"error"/.test(l)).map(l => { try { return String(JSON.parse(l).msg ?? l.slice(0, 120)); } catch { return l.slice(0, 120); } }));
      const newErrors = [...errors(on)].filter(m => !errors(off).has(m));

      assert.deepEqual(statusDifferences, [], `\nstatus differs:\n${statusDifferences.join("\n")}\n`);
      assert.deepEqual(b.state, a.state, "the rows left behind differ (expected = enforcement off, actual = on)");
      assert.deepEqual(pushDifferences, [], `\nthe pushes sent differ:\n${pushDifferences.join("")}\n`);
      assert.deepEqual(newErrors, [], `\nerrors logged only with enforcement on:\n${newErrors.join("\n")}\n`);
      assert.ok(a.steps.filter(s => /: 2\d\d/.test(s)).length >= 30, "too few steps succeeded — the scenario is not exercising the routes");
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});
```

- [ ] **Step 3: Build and run it; expect it red.**

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/db run test
```
Expected: the control and matrix pass; `every read answers the same` and `every write answers the same` **fail**. The reads fail on `admin GET /moderation/reports` (`reports.0` missing) and `admin GET /admin/usage-summary` (`totalEvaluations` 1 → 0). The writes fail on, among others:

```
parent registers the same device                 off 201                    on 500
blocked parent opens DM                          off 403 blocked            on 201
code login                                       off 200                    on 500
refresh                                          off 200                    on 401
parent claims a student                          off 201                    on 400 claim_code_invalid
student claims their own record                  off 201                    on 400 claim_code_invalid
class thread members right after the claim       off 3                      on 0
teacher reissues a parent's login code           off 200                    on 500
admin sets a password                            off 200                    on 500
link - open the exam / pick a name / state / …   off 200…                   on 404 link_not_found, 401 token_invalid
```
and, once those are fixed, the pushes sent still differ (none at all with enforcement on) until Task 5 Step 2. Do not commit yet.

---

### Task 5: Put each cross-user site on `systemDb`

**Files:**
- Modify: `artifacts/api-server/src/routes/messaging.ts`, `routes/roster.ts`, `lib/evaluationAudience.ts`, and (whole-file alias) `routes/auth.ts`, `routes/admin.ts`, `routes/moderation.ts`, `routes/studentAttempt.ts`, `lib/rosterClaim.ts`, `lib/classThread.ts`, `lib/adminNotify.ts`, `lib/resultsReleaseNotify.ts`, `modules/assessment/attemptGrading.ts`
- Test: `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts`

**Interfaces:**
- Consumes: `systemDb` (Task 3). Produces: the 13-file `systemDb` allowlist pinned by `systemDbFiles.test.ts`.

The rule for deciding, so a later change can apply it: **a file or statement goes on `systemDb` only if it must act without a user** (login, a share-link exam, a notification fan-out) **or must read another user's rows to decide something** (a block, a push token, the audience of an exam). A route a signed-in user calls over data they are entitled to stays on `db` — the policies cover it. Prefer a single statement over a whole file; whole files are used only where every query in them is of the first kind.

- [ ] **Step 1: Write the pin first (it fails).**

```ts
// artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `systemDb` is the connection row-level security does not apply to. Every file that
 * reaches for it is a hole in the wall, so the list is pinned here with the reason for
 * each — adding one means editing this test, which is where a reviewer asks "why?".
 *
 * Keep the list short. A file belongs on it only if it must act without a user
 * (login, a link-based exam, a notification fan-out) or read another user's rows to
 * decide something (a block, a push token). A route a signed-in user calls, over data
 * they are entitled to, belongs on `db` — the policies cover it.
 */
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ALLOWED: Record<string, string> = {
  "middlewares/auth.ts": "looks the caller up before any identity exists (and skips three round trips per request)",
  "routes/auth.ts": "sign-in, sign-up, refresh, password reset and claim run before — or without — a user identity; they own the token tables",
  "routes/admin.ts": "admin-only routes that read and revoke across every user, plus public site-signup ingestion",
  "routes/moderation.ts": "admin-only: reads the reported thread's messages, which the admin is not a participant of",
  "routes/studentAttempt.ts": "a student takes an exam from a share link with no login, so no identity",
  "routes/messaging.ts": "a recipient's blocks and push tokens belong to the recipient, and a phone handed to another account re-registers a token that still belongs to the last one",
  "routes/roster.ts": "reissuing a login code revokes that account's refresh tokens, which the app role cannot touch",
  "lib/evaluationAudience.ts": "read for link-based exams (no identity); an empty read means 'everyone', so it must not be filtered",
  "lib/classThread.ts": "reconciles who is in a class thread: a student claiming cannot see the thread or the other members' links",
  "lib/rosterClaim.ts": "resolves a claim code before any roster link for the claimer exists",
  "lib/resultsReleaseNotify.ts": "notifies every linked student and parent, none of whom is the teacher whose request triggered it",
  "lib/adminNotify.ts": "notifies every system admin from a public, unauthenticated request",
  "modules/assessment/attemptGrading.ts": "server-side grading writes the grade tables, which only a teacher's identity may write directly",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("which files may use the connection that bypasses row-level security", () => {
  const using = sources(src)
    .filter(f => /\bsystemDb\b/.test(readFileSync(f, "utf8")))
    .map(f => path.relative(src, f).split(path.sep).join("/"))
    .sort();

  test("exactly the pinned files", () => {
    assert.deepEqual(using, Object.keys(ALLOWED).sort());
  });

  test("the auth token tables are only ever touched from a file that may use it", () => {
    const tokenTables = /\b(refreshTokens|passwordResetTokens|emailVerificationTokens)\b/;
    const offenders = sources(src)
      .filter(f => tokenTables.test(readFileSync(f, "utf8")))
      .map(f => path.relative(src, f).split(path.sep).join("/"))
      .filter(f => !(f in ALLOWED));
    assert.deepEqual(offenders, [], "these touch the token tables but are not on the systemDb list — the app role has no access to them");
  });
});
```

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/systemDbFiles.test.ts`
Expected: FAIL on `exactly the pinned files` (only `middlewares/auth.ts` uses `systemDb` so far).

- [ ] **Step 2: `messaging.ts` — five statements, not the file.** A recipient's blocks and push tokens are the recipient's rows; a dead token and a re-registered phone belong to someone else. The `broadcast` block lookup stays on `db` (teachers cannot be blocked, so only the teacher's own, visible rows matter — reverting it was not detectable). Apply:

```diff
diff --git a/artifacts/api-server/src/routes/messaging.ts b/artifacts/api-server/src/routes/messaging.ts
index cb1ab3a..6016be4 100644
--- a/artifacts/api-server/src/routes/messaging.ts
+++ b/artifacts/api-server/src/routes/messaging.ts
@@ -40,5 +40,5 @@
  */
 import { Router } from "express";
-import { db } from "@workspace/db";
+import { db, systemDb } from "@workspace/db";
 import {
   chatThreads,
@@ -246,5 +246,6 @@ async function pruneDeadTokens(results: Awaited<ReturnType<typeof sendExpoPush>>
   const dead = deadTokensFrom(results);
   if (dead.length === 0) return;
-  await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
+  // systemDb: a dead token belongs to whoever registered it, not to the caller.
+  await systemDb.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
 }
 
@@ -260,5 +261,6 @@ async function notifyThreadParticipants(threadId: string, senderId: string, body
   if (recipientIds.length === 0) return;
 
-  const blockedByRows = await db
+  // systemDb: whether a recipient has blocked the sender is the recipient's row, not the sender's.
+  const blockedByRows = await systemDb
     .select({ blockerUserId: chatBlocks.blockerUserId })
     .from(chatBlocks)
@@ -268,5 +270,6 @@ async function notifyThreadParticipants(threadId: string, senderId: string, body
   if (notifiable.length === 0) return;
 
-  const tokenRows = await db
+  // systemDb: pushing to other people needs their tokens.
+  const tokenRows = await systemDb
     .select({ userId: devicePushTokens.userId, expoPushToken: devicePushTokens.expoPushToken })
     .from(devicePushTokens)
@@ -588,5 +591,6 @@ router.post("/messaging/threads", async (req: AuthenticatedRequest, res) => {
     }
 
-    const [existingBlock] = await db
+    // systemDb: a block in either direction stops a new thread, and one direction is the other person's row.
+    const [existingBlock] = await systemDb
       .select({ id: chatBlocks.id })
       .from(chatBlocks)
@@ -1577,5 +1581,6 @@ router.post("/messaging/device-tokens", async (req: AuthenticatedRequest, res) =
     }
 
-    await db
+    // systemDb: a phone handed to another account re-registers a token that still belongs to the last one.
+    await systemDb
       .insert(devicePushTokens)
       .values({ userId: req.user!.id, expoPushToken, platform })
```

Re-run the differential test; expect the `parent registers the same device`, `blocked parent opens DM` and push differences to disappear.

- [ ] **Step 3: `roster.ts` — one transaction.** Reissuing a login code deletes the account's refresh tokens, which the app role cannot touch. Authorization (the `roster_links` check) already ran above it on `db`. Apply:

```diff
diff --git a/artifacts/api-server/src/routes/roster.ts b/artifacts/api-server/src/routes/roster.ts
index af1d585..7eb2a9e 100644
--- a/artifacts/api-server/src/routes/roster.ts
+++ b/artifacts/api-server/src/routes/roster.ts
@@ -16,5 +16,5 @@
  */
 import { Router } from "express";
-import { db } from "@workspace/db";
+import { db, systemDb } from "@workspace/db";
 import {
   attemptResults,
@@ -1510,5 +1510,6 @@ router.post("/students/:id/links/:userId/login-code", async (req: AuthenticatedR
 
     const loginCode = generateLoginCode();
-    const reissued = await db.transaction(async tx => {
+    // systemDb: it deletes the account's refresh tokens, which the app role cannot touch.
+    const reissued = await systemDb.transaction(async tx => {
       // Locked, so a sign-in racing this either finishes before the old code
       // dies or waits and finds the old code gone — never mints a session after.
```

- [ ] **Step 4: `evaluationAudience.ts` — the reads only.** This is the one that matters for safety: with enforcement on, the audience read for a share-link student (no identity) came back empty, and an empty audience means "everyone", so an excluded student could take a restricted exam. `replaceEvaluationAudience` (a teacher's write) stays on `db`. Apply:

```diff
diff --git a/artifacts/api-server/src/lib/evaluationAudience.ts b/artifacts/api-server/src/lib/evaluationAudience.ts
index 1beecc1..fa14813 100644
--- a/artifacts/api-server/src/lib/evaluationAudience.ts
+++ b/artifacts/api-server/src/lib/evaluationAudience.ts
@@ -5,5 +5,5 @@
  * `evaluations.class_group_id`. See modules/assessment/audience.ts for the rule.
  */
-import { db, evaluationAssignments } from "@workspace/db";
+import { db, systemDb, evaluationAssignments } from "@workspace/db";
 import { and, eq, inArray, isNotNull } from "drizzle-orm";
 import { audienceFor, type Audience } from "../modules/assessment/audience.ts";
@@ -14,5 +14,8 @@ export async function assignedStudentsByEvaluation(
   const out = new Map<string, string[]>();
   if (evaluationIds.length === 0) return out;
-  const rows = await db
+  // systemDb: this also runs for a student opening an exam from its link, who has no
+  // login and so no identity. Under row-level security the read would come back empty,
+  // and an empty audience means "everyone" — a restricted exam would open to the class.
+  const rows = await systemDb
     .select({ evaluationId: evaluationAssignments.evaluationId, studentId: evaluationAssignments.studentId })
     .from(evaluationAssignments)
```

- [ ] **Step 5: Whole-file aliases for the nine files where every query is of the first kind.** Each swaps one import and leaves every call site as it was (`systemDb as db`). Apply:

```diff
diff --git a/artifacts/api-server/src/lib/adminNotify.ts b/artifacts/api-server/src/lib/adminNotify.ts
index 62281ab..8969f40 100644
--- a/artifacts/api-server/src/lib/adminNotify.ts
+++ b/artifacts/api-server/src/lib/adminNotify.ts
@@ -1,4 +1,5 @@
 // artifacts/api-server/src/lib/adminNotify.ts
-import { db, users, devicePushTokens } from "@workspace/db";
+// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
+import { systemDb as db, users, devicePushTokens } from "@workspace/db";
 import { eq, inArray } from "drizzle-orm";
 import { sendExpoPush, deadTokensFrom, PUSH_CHANNEL } from "./pushNotifications.ts";
diff --git a/artifacts/api-server/src/lib/classThread.ts b/artifacts/api-server/src/lib/classThread.ts
index a120856..5099463 100644
--- a/artifacts/api-server/src/lib/classThread.ts
+++ b/artifacts/api-server/src/lib/classThread.ts
@@ -9,5 +9,6 @@
  * class. Derivation lives here; both routes call it.
  */
-import { db } from "@workspace/db";
+// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
+import { systemDb as db } from "@workspace/db";
 import {
   chatThreads,
diff --git a/artifacts/api-server/src/lib/resultsReleaseNotify.ts b/artifacts/api-server/src/lib/resultsReleaseNotify.ts
index 3ee0221..b1f1b8f 100644
--- a/artifacts/api-server/src/lib/resultsReleaseNotify.ts
+++ b/artifacts/api-server/src/lib/resultsReleaseNotify.ts
@@ -19,5 +19,5 @@
  */
 import {
-  db,
+  systemDb as db, // Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
   attempts,
   chatMessages,
diff --git a/artifacts/api-server/src/lib/rosterClaim.ts b/artifacts/api-server/src/lib/rosterClaim.ts
index df05db3..36d220a 100644
--- a/artifacts/api-server/src/lib/rosterClaim.ts
+++ b/artifacts/api-server/src/lib/rosterClaim.ts
@@ -23,5 +23,6 @@
  * the user row already exists, so inserting is left to them.
  */
-import { db } from "@workspace/db";
+// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
+import { systemDb as db } from "@workspace/db";
 import { students, classGroups, classMemberships, rosterLinks } from "@workspace/db";
 import { and, eq, isNull, ne } from "drizzle-orm";
diff --git a/artifacts/api-server/src/modules/assessment/attemptGrading.ts b/artifacts/api-server/src/modules/assessment/attemptGrading.ts
index e267613..3f0f601 100644
--- a/artifacts/api-server/src/modules/assessment/attemptGrading.ts
+++ b/artifacts/api-server/src/modules/assessment/attemptGrading.ts
@@ -14,5 +14,6 @@
  * paper having no question left unmarked.
  */
-import { db } from "@workspace/db";
+// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
+import { systemDb as db } from "@workspace/db";
 import {
   attemptAnswers,
diff --git a/artifacts/api-server/src/routes/admin.ts b/artifacts/api-server/src/routes/admin.ts
index c7dc6c1..e8977a0 100644
--- a/artifacts/api-server/src/routes/admin.ts
+++ b/artifacts/api-server/src/routes/admin.ts
@@ -11,5 +11,5 @@ import {
   aiGenerations,
   classGroups,
-  db,
+  systemDb as db, // Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
   evaluations,
   feedback,
diff --git a/artifacts/api-server/src/routes/auth.ts b/artifacts/api-server/src/routes/auth.ts
index 0e81359..3659092 100644
--- a/artifacts/api-server/src/routes/auth.ts
+++ b/artifacts/api-server/src/routes/auth.ts
@@ -6,5 +6,6 @@ import jwt from "jsonwebtoken";
 import crypto from "crypto";
 import { OAuth2Client } from "google-auth-library";
-import { db } from "@workspace/db";
+// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
+import { systemDb as db } from "@workspace/db";
 import {
   users,
diff --git a/artifacts/api-server/src/routes/moderation.ts b/artifacts/api-server/src/routes/moderation.ts
index e80747c..43bc943 100644
--- a/artifacts/api-server/src/routes/moderation.ts
+++ b/artifacts/api-server/src/routes/moderation.ts
@@ -29,5 +29,5 @@ import {
   chatReports,
   chatThreads,
-  db,
+  systemDb as db, // Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
   users,
   type ArtifactReportStatus,
diff --git a/artifacts/api-server/src/routes/studentAttempt.ts b/artifacts/api-server/src/routes/studentAttempt.ts
index a35c97a..23db7ca 100644
--- a/artifacts/api-server/src/routes/studentAttempt.ts
+++ b/artifacts/api-server/src/routes/studentAttempt.ts
@@ -31,5 +31,6 @@
  */
 import { Router, type Response } from "express";
-import { db } from "@workspace/db";
+// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
+import { systemDb as db } from "@workspace/db";
 import {
   attemptAnswers,
```

Why each: `auth.ts` signs in, signs up, refreshes and resets before — or without — a user, and owns the token tables; `admin.ts` and `moderation.ts` are admin-only and read across every user; `studentAttempt.ts` is the share-link exam (no login); `rosterClaim.ts` resolves a code before any link exists; `classThread.ts` reconciles class-thread membership, which a claiming student cannot see; `resultsReleaseNotify.ts` and `adminNotify.ts` notify people who are not the requester; `attemptGrading.ts` writes grade tables only a teacher's identity may write directly.

- [ ] **Step 6: Everything green.**

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/db run test
pnpm --filter @workspace/api-server run test
```
Expected: typecheck clean; `lib/db`: 36 tests pass (6 identity, 6 coverage, 21 matrix, 3 differential); api-server: all pass including `systemDbFiles`.

- [ ] **Step 7: Mutation check** (run once, do not commit). For each of the swaps in Steps 2–5, revert just that swap (`systemDb` → `db`), rebuild, rerun `rlsDiff.test.ts`, and confirm it goes red; restore it. Expected: 16 of the 17 swaps are caught; the exception is the middleware lookup (no observable difference while `users` has no RLS — it stays for the round-trip saving) and the `broadcast` lookup (deliberately not swapped). A swap that no scenario can catch is either unnecessary or a missing scenario — add the scenario to `rlsDiff.test.ts`, do not leave it unproven.

- [ ] **Step 8: Commit Tasks 4 and 5 together.**

```bash
git add artifacts/api-server lib/db/src/__tests__/rlsDiff.test.ts
git commit -m "feat(api): run requests as their user; systemDb for the paths that cannot"
```

---

### Task 6: CI, docs, and the spec amendment

**Files:**
- Modify: `.github/workflows/ci.yml`, `docs/deploying.md`, `STATUS.md`, `LOCAL_SETUP.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-13-row-level-security-design.md`

- [ ] **Step 1: CI.** Add a `rls` job (Postgres service, full install, build the API, migrate an empty database, run the `lib/db` suites with `RLS_TEST_DATABASE_URL`) and a `Test db` step in the main job (the DB-backed suites skip there; the identity tests run). Apply:

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 91d4ac0..77488ad 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -86,4 +86,8 @@ jobs:
         run: pnpm --filter @workspace/api-server run test
 
+      # The row-level-security suites skip here (no database); the identity tests run.
+      - name: Test db
+        run: pnpm --filter @workspace/db run test
+
       - name: Test mobile
         run: pnpm --filter @workspace/mobile run test
@@ -182,4 +186,48 @@ jobs:
       # editing the body re-checks it. This workflow never sees `edited`.
 
+  # Row-level security needs a real Postgres and the built API: the matrix proves each
+  # policy, the coverage test stops a new table being forgotten, and the differential
+  # test boots the API with enforcement off and on and diffs what users see and cause
+  # (see docs/superpowers/specs/2026-10-13-row-level-security-design.md).
+  rls:
+    name: row-level security
+    runs-on: ubuntu-latest
+    timeout-minutes: 15
+    services:
+      postgres:
+        image: postgres:16
+        env:
+          POSTGRES_PASSWORD: postgres
+        ports: ['5432:5432']
+        options: >-
+          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 24.15.0
+
+      - name: Enable pnpm
+        run: |
+          corepack enable
+          corepack prepare pnpm@11.18.0 --activate
+
+      - name: Install
+        run: pnpm install --frozen-lockfile
+
+      - name: Build api-server
+        run: pnpm --filter @workspace/api-server run build
+
+      - name: Migrate an empty database
+        env:
+          DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
+        run: pnpm --filter @workspace/db run migrate -- --from-env
+
+      - name: Row-level security suites
+        env:
+          RLS_TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
+        run: pnpm --filter @workspace/db run test
+
   verifier:
     name: math verifier
```

Then check the YAML parses: `python3 -c "import yaml,sys; print(list(yaml.safe_load(open('.github/workflows/ci.yml'))['jobs']))"` → `['workspace', 'migrations', 'rls', 'verifier']`.

- [ ] **Step 2: `docs/deploying.md`.** Insert this section immediately before `## Point-of-no-return changes go up as drafts`:

````markdown
## Row-level security

Postgres enforces who may read a row on the tables that hold students, rosters,
parent contact history, chat, exams and attempts (spec:
`docs/superpowers/specs/2026-10-13-row-level-security-design.md`). It is a second line
of defence behind the API's own checks, and it is **off until you turn it on**.

**The switch** is one Cloud Run env var, read once at boot:

```bash
# on
gcloud run services update iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --update-env-vars RLS_ENFORCE=on
# off — the whole rollback
gcloud run services update iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --update-env-vars RLS_ENFORCE=off
```

`--update-env-vars`, never `--set-env-vars` (see *Rotating a secret*). Changing it rolls
a revision; it is not a code deploy. With it off nothing about the API changes — one
pool, no extra statements. With it on every `db` statement runs as the `iqraa_app` role
with the signed-in user's id, and `systemDb` (the owner connection) is used by the
thirteen files pinned in `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts`.

**Before the first flip**, on a Neon *branch* of production (never production):
run the migration, run `RLS_TEST_DATABASE_URL=<branch> pnpm --filter @workspace/db run test`,
walk the teacher / parent / student flows by hand, and **measure the added latency per
statement** — the wrapper costs about two extra round trips each, which is ~0.25 ms on
loopback and unmeasured across the Cloud Run → Neon hop. Also check the database's
connection limit: with enforcement on an instance holds two pools. See the plan's Task 7
for the gates.

**What goes wrong, and how it looks.** A query that reads *another user's* rows does not
fail under RLS — it returns fewer rows. So the symptom is rarely a 500; it is a
notification not sent, a block not honoured, a restricted exam that opens to the class.
`lib/db/src/__tests__/rlsDiff.test.ts` is the guard: it boots the built API with
enforcement off and on and diffs statuses, bodies, pushes and rows left behind. After any
route change that touches a protected table, run it (`pnpm --filter @workspace/api-server
run build` first) and add a scenario for what you added.

**Adding a table.** `rlsCoverage.test.ts` fails until the table is classified: *protected*
(add policies in a migration, put the name in `PROTECTED`), *locked* (RLS, no policy, no
grant — only `systemDb` reads it), or *deferred* (named in `DEFERRED` — still open to
`iqraa_app`, with the grant a new migration must add by hand, since there are no default
privileges on purpose). **Adding a `systemDb` use** means editing `systemDbFiles.test.ts`
and writing the reason.
````

- [ ] **Step 3: `STATUS.md`.** Insert this section immediately before `## A waitlist signup on iqrra.com pushes the admins, 2026-10-12`:

```markdown
## Row-level security is built and switched off, 2026-10-13

**State: shipped inert. Nothing in production changed.** The `iqraa_app` role, sixteen
helper functions and 65 policies exist (migration `0008_row_level_security.sql`); the API
carries each request's user to Postgres; and `RLS_ENFORCE` — unset, so off — decides
whether any of it applies. Spec: `docs/superpowers/specs/2026-10-13-row-level-security-design.md`;
how to flip it: *Row-level security* in `docs/deploying.md`.

**Verified (CI, Postgres 16):** the policy matrix, a coverage guard that fails on an
unclassified table, and a differential test that boots the built API with enforcement off
and on and finds no difference in what users see, which pushes are sent, which rows are
left behind, or what is logged — across 56 reads for six identities and 50 write steps.

**Not verified, and the reason it is off:** it has never run against Neon. Added latency
across the Cloud Run → Neon hop is unmeasured (≈ two extra round trips per statement; +0.24 ms
on loopback). The connection ceiling with two pools per instance is unchecked. No one has
walked the teacher / parent / student flows with it on in a real environment.

**What it does not cover yet:** `users` (every roster and chat screen reads names from it),
the teacher-owned planning tables, and the shared content tables are *deferred* by name in
`rlsCoverage.test.ts`. Thirteen files use `systemDb`, which bypasses it — they are pinned in
`systemDbFiles.test.ts` with a reason each. This guards against a forgotten `where`, not
against SQL injection: the session user is still the owner and could `RESET ROLE`.
```

- [ ] **Step 4: `LOCAL_SETUP.md`.** After the `AI_BUDGET_USD` row of the environment table add:

```markdown
| `RLS_ENFORCE` | unset (off) | Exactly `on` makes the API run every statement as the `iqraa_app` Postgres role under row-level security. Leave it off locally unless you are testing it. The DB-backed suites (`pnpm --filter @workspace/db run test`) need `RLS_TEST_DATABASE_URL` pointing at a migrated, disposable Postgres 16 — see `docs/deploying.md` |
```

- [ ] **Step 5: `CLAUDE.md`.** Add this bullet at the end of *Things that have bitten before*:

```markdown
- **Row-level security fails quietly, and `systemDb` is the hole in it (since 2026-10-13).**
  A query that reads *another user's* rows does not error under RLS — it returns fewer
  rows. In the prototype that meant: no push notifications at all (recipients' tokens),
  a blocked user able to open a thread (the block is the other person's row), and a student
  excluded from a restricted exam able to take it from its share link (the audience read came
  back empty, and an empty audience means «everyone»). Statuses alone cannot see any of
  that, so `lib/db/src/__tests__/rlsDiff.test.ts` also diffs the pushes sent and the rows
  left behind. `RLS_ENFORCE` is off by default; `systemDb` (the owner connection) is for
  paths that act without a user or must read other users' rows to decide something, and the
  files that use it are pinned in `systemDbFiles.test.ts`. A new table must be classified in
  `rlsCoverage.test.ts`, and a new table gets **no** grant to `iqraa_app` automatically.
```

- [ ] **Step 6: Amend the spec.** Append to `docs/superpowers/specs/2026-10-13-row-level-security-design.md`:

```markdown
## Amendments after prototyping (2026-10-13)

The design was prototyped end to end before the plan was written; four things changed.

1. **§3 — policies are hand-written SQL, not Drizzle `pgPolicy`.** `drizzle-kit` does not
   track roles, functions or policies. `generate` stays quiet; `rlsCoverage.test.ts`
   proves RLS is on.
2. **§1 — the wrapper is a `pg.Pool` subclass.** Drizzle's node-postgres driver calls
   `pool.query()` for plain statements and `pool.connect()` + `begin` for `db.transaction()`;
   overriding those two covers both, including savepoints. Files move to the owner
   connection with `import { systemDb as db }`.
3. **§2 — policies the prototype forced.** `chat_participants` insert: either party of a
   direct thread may add either party (`openDirectThread` inserts both rows with
   `ON CONFLICT DO NOTHING`, and Postgres checks an INSERT policy before detecting the
   conflict). `evaluation_questions` is teacher-only. Grade tables are written only under a
   teacher's identity; server grading uses `systemDb`. Token tables have RLS, no policy and
   no grant. The `systemDb` list is thirteen files, not the five paths listed in §1.
4. **§5 — the audit is a test.** The differential test (`rlsDiff.test.ts`) replaces the
   manual read of ~41 files; reads alone found nothing, writes and fan-out found everything.
   It compares statuses, bodies, pushes sent, rows left behind and logged errors.

Open: added latency on Neon, and the connection ceiling with two pools per instance, are
still unmeasured (plan Task 7).
```

- [ ] **Step 7: Verify and commit.**

```bash
pnpm run typecheck
git add .github docs STATUS.md LOCAL_SETUP.md CLAUDE.md
git commit -m "docs+ci: row-level security — CI job, deploy notes, status, spec amendment"
```

- [ ] **Step 8: Open the PR as a draft** and subscribe to its activity. Body: summary, "ships inert — `RLS_ENFORCE` unset", the verification table from *What the prototype proved*, and the explicit list of what is **not** verified (Neon, latency, connection ceiling). No `destructive-migration` line is needed.

---

### Task 7: Rehearse on Neon, then flip (manual — no code)

This task is a checklist for a person with Neon and Cloud Run access. Nothing here ships in the PR; do not flip the switch until every gate passes.

- [ ] **Step 1: Branch production** in Neon (a copy-on-write branch — never the production database). Note its connection string as `BRANCH_URL`.

- [ ] **Step 2: Prove the two assumptions the design rests on.**

```bash
DATABASE_URL="$BRANCH_URL" pnpm --filter @workspace/db run migrate -- --from-env
```
Expected: applies `0008`. This proves the Neon owner role can `CREATE ROLE` and `GRANT iqraa_app TO CURRENT_USER`. Then, using the **pooled** endpoint of the branch if production uses one:

```bash
RLS_TEST_DATABASE_URL="$BRANCH_URL" pnpm --filter @workspace/db run test
```
Expected: all 36 pass. This proves `SET LOCAL ROLE` and `set_config(…, true)` survive the pooler. (The suites create throwaway users and delete them; on a branch that is safe.) If this fails behind the pooler, stop: try the direct endpoint, and report which one production uses.

- [ ] **Step 3: Measure the added latency from where the API runs.** From a Cloud Run job (or the API's own region), against the branch:

```ts
// bench.ts — node --experimental-strip-types bench.ts
import { randomUUID } from "node:crypto";
import { asUser } from "./lib/db/src/identity.ts";
import { ScopedPool } from "./lib/db/src/scopedPool.ts";
const url = process.env.BRANCH_URL!;
const uid = randomUUID();
for (const enforce of [false, true, false, true]) {
  const pool = new ScopedPool({ connectionString: url, max: 4 }, enforce);
  await pool.query("select 1");
  const t0 = performance.now();
  await asUser({ userId: uid, role: "teacher" }, async () => {
    for (let n = 0; n < 300; n++) await pool.query("select count(*) from students where teacher_id = $1", [uid]);
  });
  console.log(`enforce=${enforce}: ${((performance.now() - t0) / 300).toFixed(2)} ms/statement`);
  await pool.end();
}
```
**Gate:** the difference (on − off) times the number of statements in a typical request (the teacher inbox is the heaviest read) must keep p95 request latency within an agreed budget — suggested: ≤ +100 ms on the inbox, ≤ +25 % elsewhere. If it fails, do not flip; the mitigations, in order, are: co-locate Cloud Run with Neon (Frankfurt, `europe-west3`); a request-scoped transaction for routes that never call a model (a middleware that holds one connection per request, never for `/generate` or `/chat`); fewer statements per request.

- [ ] **Step 4: Check connections.** With enforcement on an instance holds up to two pools (default 10 each). Confirm `max_connections` (or the pooler's limit) ≥ 2 × 10 × Cloud Run `--max-instances`, or set `max` explicitly on both pools in `lib/db/src/index.ts`.

- [ ] **Step 5: Walk the flows by hand** against a revision started with `RLS_ENFORCE=on` and `DATABASE_URL` pointing at the branch (a `--no-traffic --tag rls` revision): as a teacher — roster, create class, add student, issue claim code, DM a parent, post in a class group, release results, reissue a login code; as a parent — claim, inbox, read a thread, reply, `/parent/exams`; as a student — claim, take an exam from a share link, read results. Watch logs for `permission denied` and `row-level security`.

- [ ] **Step 6: Flip production**, outside school hours:

```bash
gcloud run services update iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --update-env-vars RLS_ENFORCE=on
```
Watch 5xx rate, p95 latency, push volume and the logs for 30 minutes. **Rollback** is the same command with `RLS_ENFORCE=off`. Then update `STATUS.md` (it says "off", "never run against Neon") in the same sitting.

---

## Self-review

**Spec coverage.** §1 mechanism → Tasks 1, 3, 4, 5. §2 policies (every row of the table) → Task 2 (SQL) and Task 3 (matrix). §3 migration → Task 2. §4 rollout (inert, rehearse, flip, rollback) → Tasks 6, 7. §5 testing (matrix, fail-closed, escape hatch, coverage, off-mode) → Tasks 2, 3, 4; the "key route suites once with enforcement on" is replaced, deliberately, by the differential test. §6 risks → "audit" is Task 4; latency and pooling are Task 7; "not injection-proof" is in `STATUS.md` and the spec. §7 follow-ups (users, remaining tables, shared content, separate login role) are unchanged and not in this plan.

**Placeholders.** None: every code block is the file that was run, and every diff is `git diff` of the prototype worktree.

**Type consistency.** `Identity`, `asUser`, `currentIdentity` (Task 1) are used unchanged by `scopedPool.ts`, `index.ts` and `auth.ts`; `ScopedPool(config, enforce)` matches its two call sites (the pool in `index.ts`, the tests); `seed(owner)` / `Fixture.ids` keys used by the matrix and differential tests are exactly those produced by the harness.

**Known limits worth a reviewer's attention.** The differential test can only catch what its scenarios exercise — the mutation check in Task 5 is how that is measured, and it found two scenarios missing during prototyping (push-block and class-thread sync). Users added later get no automatic coverage. The policies for `evaluation_assignments` / `attempt_retakes` student writes are exercised by the matrix only indirectly.
