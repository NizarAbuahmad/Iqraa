# Seeded-Postgres route-test harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API route tests that run against a real, throwaway, migrated Postgres database with seeded rows, starting with the cross-family access tests the family-school spec requires.

**Architecture:** Each DB test file creates its own `iqraa_test_<hex>` database on a local Postgres, applies the repo's migrations with `lib/db/scripts/migrate.mjs --from-env`, seeds rows with raw SQL, and boots the **built bundle** (`dist/index.mjs`) as a child process pointed at that database (same pattern as `mountOrder.test.ts`, which must spawn the bundle because source files use extensionless imports). Requests are signed with access tokens minted in the test. Tests skip when no database is configured, and **fail** when `REQUIRE_DB_TESTS=true` (CI) so a misconfigured pipeline cannot silently skip.

**Tech Stack:** Node `--experimental-strip-types --test`, `pg`, `jsonwebtoken`, the esbuild bundle, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-10-11-family-school-views-design.md` — its **Testing** section requires "a parent cannot read another family's child; a student cannot read another class's homework; …; unowned paths still 404". This plan builds the harness and the first family-schedule cases. (The design for this harness was approved in conversation; it has no separate spec file.)

## Global Constraints

- Work on branch `claude/brave-einstein-qxpxc3` (draft PR #1007). Never push; the controller pushes. Keep the harness in its own commits (one per task) so the CI wiring can be read or reverted alone.
- Commit trailers on every commit, exactly, after a blank line (write "Sonnet 5.5" verbatim regardless of which model you are):
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX`
- Files loaded by `node --test` need explicit `.ts` extensions on relative imports. api-server tests live in `src/**/__tests__/**/*.test.ts`; do not narrow that glob.
- The harness may only ever create and drop databases named `iqraa_test_` + 12 hex chars, must refuse any admin host other than localhost/127.0.0.1/[::1] unless `ALLOW_REMOTE_TEST_DB=1`, and must never use the admin database itself for data. Never point it at a real database.
- Schema comes from migrations (`migrate.mjs --from-env`), never `push`. Always pass `--from-env` (without it the script deletes `DATABASE_URL` and reads the repo-root `.env`).
- `STUDENT_ACCOUNTS` is read per request; the harness server sets it to `true` by default (it is `true` in production).
- Run API commands from `/home/user/Iqraa/artifacts/api-server`. `pnpm build` must run before DB tests (they boot `dist/index.mjs`); a stale bundle gives stale results.
- **Local database in this sandbox:** a throwaway Postgres 16 is running on `127.0.0.1:55432` (trust auth, user `postgres`, data in `/tmp/pgtest-iqraa`). Use `TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres`. If it is not running (the sandbox may have restarted), start it:
  ```bash
  B=/usr/lib/postgresql/16/bin; D=/tmp/pgtest-iqraa
  [ -d $D/data ] || { mkdir -p $D && chown postgres:postgres $D && runuser -u postgres -- $B/initdb -D $D/data -A trust -U postgres; }
  runuser -u postgres -- $B/pg_ctl -D $D/data -o "-p 55432 -k $D -c listen_addresses=127.0.0.1" -l $D/log -w start
  $B/pg_isready -h 127.0.0.1 -p 55432
  ```
  Postgres refuses to run as root, hence `runuser -u postgres`.

## File Structure

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/test-support/env.ts` (new) | Paths (`bundleEntry`, `migrateScript`) and `TEST_SESSION_SECRET` |
| `artifacts/api-server/src/test-support/testDbRules.ts` (new) | Pure rules: admin-URL safety, DB-name rule, skip/require logic |
| `artifacts/api-server/src/test-support/gate.ts` (new) | `describeDb()`: skip, or fail when required |
| `artifacts/api-server/src/test-support/testDb.ts` (new) | `setupTestDb()`: create + migrate + pool + `drop()` |
| `artifacts/api-server/src/test-support/startServer.ts` (new) | Spawn the bundle on a free port against a database |
| `artifacts/api-server/src/test-support/tokens.ts` (new) | `accessToken()` |
| `artifacts/api-server/src/test-support/seedFamilies.ts` (new) | `seedFamilyWorld()` + exported constants |
| `artifacts/api-server/src/test-support/__tests__/testDbRules.test.ts` (new) | Unit tests for the pure rules |
| `artifacts/api-server/src/test-support/__tests__/harness.db.test.ts` (new) | DB smoke test of the harness |
| `artifacts/api-server/src/test-support/__tests__/seedFamilies.db.test.ts` (new) | Seed row counts |
| `artifacts/api-server/src/routes/__tests__/familySchedule.db.test.ts` (new) | The cross-family cases |
| `artifacts/api-server/package.json`, `pnpm-lock.yaml` (modify) | devDependencies `pg`, `@types/pg` |
| `.github/workflows/ci.yml`, `LOCAL_SETUP.md`, `STATUS.md` (modify) | CI wiring and docs |

---

### Task 1: Pure rules, paths, and the gate

**Files:**
- Create: `artifacts/api-server/src/test-support/env.ts`
- Create: `artifacts/api-server/src/test-support/testDbRules.ts`
- Create: `artifacts/api-server/src/test-support/gate.ts`
- Test: `artifacts/api-server/src/test-support/__tests__/testDbRules.test.ts`

**Interfaces:**
- Produces (`env.ts`): `serverRoot: string`, `repoRoot: string`, `bundleEntry: string`, `migrateScript: string`, `TEST_SESSION_SECRET: string`.
- Produces (`testDbRules.ts`):
  ```ts
  export const TEST_DB_PREFIX: string               // "iqraa_test_"
  export function assertSafeAdminUrl(raw: string, env?: Record<string, string | undefined>): URL
  export function newTestDbName(rand?: () => string): string
  export function isTestDbName(name: string): boolean
  export function urlForDatabase(admin: URL, dbName: string): string
  export function dbTestsSkipReason(env?: Record<string, string | undefined>, bundleExists?: boolean): string | null
  export function dbTestsRequired(env?: Record<string, string | undefined>): boolean
  ```
- Produces (`gate.ts`): `describeDb(name: string, fn: () => void): void`.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/test-support/__tests__/testDbRules.test.ts
/**
 * What this guards: the DB-backed tests create and DROP databases, so the rules
 * that keep them away from anything real are pure, tested, and strict — a remote
 * host, an odd database name, or a missing URL must never reach a CREATE/DROP.
 * The skip/require rule also lives here: CI sets REQUIRE_DB_TESTS so a pipeline
 * with no database fails instead of silently skipping (the mount-order trap).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  TEST_DB_PREFIX,
  assertSafeAdminUrl,
  dbTestsRequired,
  dbTestsSkipReason,
  isTestDbName,
  newTestDbName,
  urlForDatabase,
} from "../testDbRules.ts";

describe("assertSafeAdminUrl", () => {
  it("accepts a local server", () => {
    for (const raw of [
      "postgres://postgres:postgres@localhost:5432/postgres",
      "postgres://postgres@127.0.0.1:55432/postgres",
      "postgresql://u@[::1]:5432/postgres",
    ]) {
      assert.ok(assertSafeAdminUrl(raw, {}) instanceof URL, raw);
    }
  });

  it("refuses a remote host", () => {
    assert.throws(
      () => assertSafeAdminUrl("postgres://u:p@db.example.com:5432/postgres", {}),
      /non-local host db\.example\.com/,
    );
  });

  it("allows a remote host only with the explicit override", () => {
    assert.doesNotThrow(() =>
      assertSafeAdminUrl("postgres://u:p@db.example.com/postgres", { ALLOW_REMOTE_TEST_DB: "1" }),
    );
  });

  it("refuses other schemes and things that are not URLs", () => {
    assert.throws(() => assertSafeAdminUrl("mysql://u@localhost/x", {}), /postgres/);
    assert.throws(() => assertSafeAdminUrl("not a url", {}), /valid URL/);
  });
});

describe("test database names", () => {
  it("generates names the drop rule accepts", () => {
    const name = newTestDbName();
    assert.ok(name.startsWith(TEST_DB_PREFIX));
    assert.ok(isTestDbName(name), name);
  });

  it("uses the injected randomness", () => {
    assert.equal(newTestDbName(() => "0123456789ab"), "iqraa_test_0123456789ab");
  });

  it("refuses to treat anything else as a test database", () => {
    for (const name of [
      "postgres",
      "iqraa",
      "iqraa_test_",
      "iqraa_test_xyz",
      "iqraa_test_0123456789ab; DROP DATABASE postgres",
      "IQRAA_TEST_0123456789ab",
      "iqraa_test_0123456789abc",
    ]) {
      assert.equal(isTestDbName(name), false, name);
    }
  });
});

describe("urlForDatabase", () => {
  it("swaps only the database name", () => {
    const admin = new URL("postgres://postgres:secret@127.0.0.1:55432/postgres");
    assert.equal(
      urlForDatabase(admin, "iqraa_test_0123456789ab"),
      "postgres://postgres:secret@127.0.0.1:55432/iqraa_test_0123456789ab",
    );
  });
});

describe("dbTestsSkipReason / dbTestsRequired", () => {
  it("skips, with a pointer, when no database is configured", () => {
    assert.match(dbTestsSkipReason({}, true) ?? "", /TEST_DATABASE_URL/);
  });

  it("skips, with a pointer, when the bundle is not built", () => {
    assert.match(
      dbTestsSkipReason({ TEST_DATABASE_URL: "postgres://u@localhost/postgres" }, false) ?? "",
      /pnpm build/,
    );
  });

  it("runs when both are present", () => {
    assert.equal(dbTestsSkipReason({ TEST_DATABASE_URL: "postgres://u@localhost/postgres" }, true), null);
  });

  it("is required only when REQUIRE_DB_TESTS is exactly 'true'", () => {
    assert.equal(dbTestsRequired({ REQUIRE_DB_TESTS: "true" }), true);
    for (const v of [undefined, "", "1", "TRUE", "false"]) {
      assert.equal(dbTestsRequired({ REQUIRE_DB_TESTS: v }), false, String(v));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/test-support/__tests__/testDbRules.test.ts`
Expected: FAIL — cannot find module `../testDbRules.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// artifacts/api-server/src/test-support/env.ts
/**
 * Paths and constants shared by the DB-backed test helpers.
 *
 * The bundle (not the source) is what the DB tests boot: source files use
 * extensionless imports only esbuild resolves — see mountOrder.test.ts.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** artifacts/api-server */
export const serverRoot = path.resolve(here, "../..");
export const repoRoot = path.resolve(serverRoot, "../..");
export const bundleEntry = path.join(serverRoot, "dist", "index.mjs");
export const migrateScript = path.join(repoRoot, "lib", "db", "scripts", "migrate.mjs");

/** At least 32 characters: src/index.ts refuses a shorter SESSION_SECRET. Used by both the spawned server and the token minter. */
export const TEST_SESSION_SECRET = "db-test-secret-padded-to-clear-the-32-char-boot-check";
```

```ts
// artifacts/api-server/src/test-support/testDbRules.ts
/**
 * The rules that keep DB-backed tests away from anything real. Pure, so they
 * are unit-tested: these tests CREATE and DROP databases.
 */
import { randomBytes } from "node:crypto";

export const TEST_DB_PREFIX = "iqraa_test_";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

type Env = Record<string, string | undefined>;

/** Parses the admin URL and refuses anything that is not a local Postgres. */
export function assertSafeAdminUrl(raw: string, env: Env = process.env): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`TEST_DATABASE_URL must be a postgres:// URL, got ${url.protocol}`);
  }
  if (!LOCAL_HOSTS.has(url.hostname) && env.ALLOW_REMOTE_TEST_DB !== "1") {
    throw new Error(
      `Refusing to run DB tests against non-local host ${url.hostname} (set ALLOW_REMOTE_TEST_DB=1 to override)`,
    );
  }
  return url;
}

export function newTestDbName(rand: () => string = () => randomBytes(6).toString("hex")): string {
  return `${TEST_DB_PREFIX}${rand()}`;
}

/** The only names the harness will create or drop. */
export function isTestDbName(name: string): boolean {
  return /^iqraa_test_[0-9a-f]{12}$/.test(name);
}

export function urlForDatabase(admin: URL, dbName: string): string {
  const u = new URL(admin.toString());
  u.pathname = `/${dbName}`;
  return u.toString();
}

/** Why DB-backed tests cannot run here, or null when they can. */
export function dbTestsSkipReason(env: Env = process.env, bundleExists = true): string | null {
  if (!env.TEST_DATABASE_URL) {
    return "set TEST_DATABASE_URL to run DB-backed tests (see LOCAL_SETUP.md, «DB-backed API tests»)";
  }
  if (!bundleExists) {
    return "run `pnpm build` first — DB-backed tests boot dist/index.mjs";
  }
  return null;
}

/** CI sets REQUIRE_DB_TESTS=true so a missing database fails instead of skipping. */
export function dbTestsRequired(env: Env = process.env): boolean {
  return env.REQUIRE_DB_TESTS === "true";
}
```

```ts
// artifacts/api-server/src/test-support/gate.ts
/**
 * `describeDb` is `describe` for tests that need a real database: it skips with
 * a pointer when none is configured — unless REQUIRE_DB_TESTS=true (CI), where
 * the missing database is itself a failing test. A pipeline that loses its
 * Postgres service must go red, not quietly stop testing access control.
 */
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { bundleEntry } from "./env.ts";
import { dbTestsRequired, dbTestsSkipReason } from "./testDbRules.ts";

export function describeDb(name: string, fn: () => void): void {
  const reason = dbTestsSkipReason(process.env, existsSync(bundleEntry));
  if (reason && dbTestsRequired()) {
    describe(name, () => {
      it("DB-backed tests are required in this environment", () => {
        assert.fail(reason);
      });
    });
    return;
  }
  describe(name, { skip: reason ?? false }, fn);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test src/test-support/__tests__/testDbRules.test.ts && pnpm typecheck`
Expected: all tests PASS; typecheck exits 0. (If `urlForDatabase` produces a trailing-slash or different string for the non-special `postgres:` scheme, fix the implementation, not the test expectation, and say so in your report.)

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/test-support
git commit -m "$(cat <<'EOF'
test(api): rules and gate for DB-backed tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 2: Create/migrate a database, boot the bundle, mint tokens

**Files:**
- Modify: `artifacts/api-server/package.json`, `pnpm-lock.yaml` (devDependencies `pg`, `@types/pg`)
- Create: `artifacts/api-server/src/test-support/testDb.ts`
- Create: `artifacts/api-server/src/test-support/startServer.ts`
- Create: `artifacts/api-server/src/test-support/tokens.ts`
- Test: `artifacts/api-server/src/test-support/__tests__/harness.db.test.ts`

**Interfaces:**
- Consumes (Task 1): `assertSafeAdminUrl`, `newTestDbName`, `isTestDbName`, `urlForDatabase`; `migrateScript`, `bundleEntry`, `TEST_SESSION_SECRET`; `describeDb`.
- Produces:
  ```ts
  // testDb.ts
  export interface TestDb { name: string; url: string; pool: Pool; drop(): Promise<void> }
  export function setupTestDb(adminUrlRaw?: string): Promise<TestDb>
  // startServer.ts
  export interface TestServer { base: string; logs(): string; stop(): Promise<void> }   // base = "http://127.0.0.1:<port>/api"
  export function startServer(opts: { databaseUrl: string; env?: Record<string, string | undefined> }): Promise<TestServer>
  // tokens.ts
  export function accessToken(userId: string, secret?: string): string
  ```

- [ ] **Step 1: Add the dev dependencies**

Run from `/home/user/Iqraa`:
`pnpm --filter @workspace/api-server add -D pg@^8.22.0 @types/pg@^8.20.0`
Expected: `artifacts/api-server/package.json` gains `devDependencies` entries with exactly those specifiers (they are the same as `lib/db`'s, already in the lockfile), and `pnpm-lock.yaml` changes only for the api-server importer. Check with `git diff --stat` that nothing else changed; if pnpm rewrote unrelated lines, revert those.

- [ ] **Step 2: Write the failing test**

```ts
// artifacts/api-server/src/test-support/__tests__/harness.db.test.ts
/**
 * What this guards: the harness itself. A database is created and migrated for
 * this run, the real bundle boots against it, a minted token passes the real
 * auth lookup, and drop() leaves nothing behind. If any of these is wrong, every
 * DB-backed test built on it is meaningless.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { describeDb } from "../gate.ts";
import { setupTestDb, type TestDb } from "../testDb.ts";
import { startServer, type TestServer } from "../startServer.ts";
import { accessToken } from "../tokens.ts";

describeDb("DB-backed test harness", () => {
  let db: TestDb;
  let server: TestServer;
  let parentId: string;

  before(async () => {
    db = await setupTestDb();
    const r = await db.pool.query<{ id: string }>(
      `INSERT INTO users (first_name, last_name, role) VALUES ('Test', 'Parent', 'parent') RETURNING id`,
    );
    parentId = r.rows[0].id;
    server = await startServer({ databaseUrl: db.url });
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("creates a migrated, empty database for this run", async () => {
    assert.match(db.name, /^iqraa_test_[0-9a-f]{12}$/);
    const r = await db.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM schedule_slots`);
    assert.equal(r.rows[0].n, 0);
  });

  it("boots the real bundle against it", async () => {
    const res = await fetch(`${server.base}/healthz`);
    assert.equal(res.status, 200);
  });

  it("lets a minted token for a seeded user through the real auth lookup", async () => {
    const res = await fetch(`${server.base}/parent/schedule`, {
      headers: { Authorization: `Bearer ${accessToken(parentId)}` },
    });
    assert.equal(res.status, 200, server.logs().slice(-1500));
    assert.deepEqual(await res.json(), { children: [] });
  });

  it("refuses a token for a user that does not exist", async () => {
    const res = await fetch(`${server.base}/parent/schedule`, {
      headers: { Authorization: `Bearer ${accessToken("00000000-0000-0000-0000-000000000000")}` },
    });
    assert.equal(res.status, 401);
  });

  it("drop() leaves no database behind", async () => {
    const extra = await setupTestDb();
    const name = extra.name;
    await extra.drop();
    const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    try {
      const r = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
      assert.equal(r.rowCount, 0);
    } finally {
      await admin.end();
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres node --experimental-strip-types --test src/test-support/__tests__/harness.db.test.ts`
Expected: FAIL — cannot find module `../testDb.ts`.

- [ ] **Step 4: Write the implementation**

```ts
// artifacts/api-server/src/test-support/testDb.ts
/**
 * A throwaway, migrated database for one test file.
 *
 * Creates `iqraa_test_<hex>` on the server named by TEST_DATABASE_URL, applies
 * the repo's own migrations to it (the schema's source of truth — never `push`),
 * and hands back a pool plus a drop(). The admin database is only ever used to
 * CREATE and DROP databases whose names pass isTestDbName.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import type { Pool } from "pg";

import { migrateScript } from "./env.ts";
import { assertSafeAdminUrl, isTestDbName, newTestDbName, urlForDatabase } from "./testDbRules.ts";

export interface TestDb {
  name: string;
  url: string;
  pool: Pool;
  /** Closes the pool and drops the database. Safe to call once. */
  drop(): Promise<void>;
}

async function withAdmin<T>(admin: URL, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: admin.toString(), max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function dropDatabase(admin: URL, name: string): Promise<void> {
  if (!isTestDbName(name)) throw new Error(`refusing to drop ${name}: not a test database name`);
  await withAdmin(admin, p => p.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
}

export async function setupTestDb(adminUrlRaw: string | undefined = process.env.TEST_DATABASE_URL): Promise<TestDb> {
  if (!adminUrlRaw) throw new Error("TEST_DATABASE_URL is not set");
  const admin = assertSafeAdminUrl(adminUrlRaw);
  const name = newTestDbName();
  if (!isTestDbName(name)) throw new Error(`generated an invalid test database name: ${name}`);

  // The name is generated and validated above, so interpolating it is safe.
  await withAdmin(admin, p => p.query(`CREATE DATABASE ${name}`));
  const url = urlForDatabase(admin, name);

  // --from-env is mandatory: without it the script deletes DATABASE_URL and
  // reads the repo-root .env, which could point somewhere that matters.
  const res = spawnSync(process.execPath, [migrateScript, "--from-env"], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (res.status !== 0) {
    await dropDatabase(admin, name);
    throw new Error(`migrations failed (exit ${res.status}):\n${res.stdout}\n${res.stderr}`);
  }

  const pool = new pg.Pool({ connectionString: url, max: 4 });
  return {
    name,
    url,
    pool,
    async drop() {
      await pool.end();
      await dropDatabase(admin, name);
    },
  };
}
```

```ts
// artifacts/api-server/src/test-support/startServer.ts
/**
 * Boots the BUILT bundle (dist/index.mjs) as a child process against a given
 * database, on a free port. This is the same approach as mountOrder.test.ts —
 * source files use extensionless imports that only esbuild resolves — but
 * pointed at a real database so authenticated routes can be exercised.
 */
import { spawn } from "node:child_process";
import net from "node:net";

import { bundleEntry, TEST_SESSION_SECRET } from "./env.ts";

export interface TestServer {
  /** e.g. http://127.0.0.1:41234/api */
  base: string;
  /** stdout+stderr of the server so far, for failure messages. */
  logs(): string;
  stop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export async function startServer(opts: {
  databaseUrl: string;
  /** Extra/overriding env. A key set to `undefined` is REMOVED from the child's env. */
  env?: Record<string, string | undefined>;
}): Promise<TestServer> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}/api`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: opts.databaseUrl,
    SESSION_SECRET: TEST_SESSION_SECRET,
    // chat.ts and generate.ts construct the OpenAI client at module scope.
    OPENAI_API_KEY: "sk-test-placeholder",
    // True in production; tests that need the flag off pass { STUDENT_ACCOUNTS: undefined }.
    STUDENT_ACCOUNTS: "true",
  };
  for (const [key, value] of Object.entries(opts.env ?? {})) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const child = spawn(process.execPath, [bundleEntry], { env, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout?.on("data", d => {
    logs += String(d);
  });
  child.stderr?.on("data", d => {
    logs += String(d);
  });
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });

  const deadline = Date.now() + 30_000;
  for (;;) {
    if (exited) throw new Error(`server exited during boot:\n${logs.slice(-2000)}`);
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) break;
    } catch {
      /* not listening yet */
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server did not start within 30s:\n${logs.slice(-2000)}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  return {
    base,
    logs: () => logs,
    async stop() {
      if (exited) return;
      await new Promise<void>(resolve => {
        child.once("exit", () => resolve());
        child.kill();
      });
    },
  };
}
```

```ts
// artifacts/api-server/src/test-support/tokens.ts
/**
 * Access tokens for tests. authMiddleware verifies an HS256 token with type
 * "access", then re-reads the user row — role and email come from the database,
 * never the token — so `sub` is the only claim that matters.
 */
import jwt from "jsonwebtoken";

import { TEST_SESSION_SECRET } from "./env.ts";

export function accessToken(userId: string, secret: string = TEST_SESSION_SECRET): string {
  return jwt.sign({ sub: userId, email: "", role: "ignored-by-server", type: "access" }, secret, {
    algorithm: "HS256",
    expiresIn: "15m",
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm typecheck && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres node --experimental-strip-types --test src/test-support/__tests__/harness.db.test.ts`
Expected: typecheck exit 0; 5 tests PASS (not skipped).
Then prove the gate: (a) run the same command **without** `TEST_DATABASE_URL` → the suite is reported skipped, exit 0; (b) run it with `REQUIRE_DB_TESTS=true` and no URL → it **fails** with the "set TEST_DATABASE_URL" message. Paste the outputs of (a) and (b) in your report.
Finally confirm nothing leaked: `psql -h 127.0.0.1 -p 55432 -U postgres -Atc "select datname from pg_database where datname like 'iqraa_test_%'"` prints nothing.

- [ ] **Step 6: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/package.json pnpm-lock.yaml artifacts/api-server/src/test-support
git commit -m "$(cat <<'EOF'
test(api): create a migrated database, boot the bundle, mint tokens

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 3: Seed the family world

**Files:**
- Create: `artifacts/api-server/src/test-support/seedFamilies.ts`
- Test: `artifacts/api-server/src/test-support/__tests__/seedFamilies.db.test.ts`

**Interfaces:**
- Consumes (Task 2): `setupTestDb`, `TestDb`.
- Produces:
  ```ts
  export const CHILDREN: { sara: string; adam: string; noor: string; yazan: string }   // Arabic display names
  export const TEACHER_NAMES: { t1: string; t2: string }                                  // "Omar Haddad", "Lina Saleh"
  export const SECRET_NOTE: string; export const B_ONLY_NOTE: string;
  export const ARCHIVED_CLASS_NOTE: string; export const FREE_PERIOD_NOTE: string
  export interface FamilyWorld { users: { t1; t2; parentA; parentB; studentA; studentB; studentUnlinked; suspendedParent: string } }
  export function seedFamilyWorld(pool: Pool): Promise<FamilyWorld>
  ```

The world (all rows created by `seedFamilyWorld`):
- **Users (8):** teachers `t1` (Omar Haddad), `t2` (Lina Saleh); `parentA` (no email), `parentB`; student accounts `studentA`, `studentB`, `studentUnlinked`; `suspendedParent` (suspended).
- **Classes (5):** `c1` T1 maths (family A), `c2` T2 physics (family A), `c3` T1 maths (family B), `c4` T1 maths **archived**, `c5` T2 physics (no slots).
- **Roster rows (6):** Sara×2 (`sA1` under T1 in c1, `sA2` under T2 in c2 — the same child under two teachers), Adam `aA` (T1, in c1 **and** the archived c4), Adam `aArch` (T2, **archived**, in c2), Noor `nB1` (T1, in c3), Yazan `yB` (T2, in c5).
- **Memberships (7):** sA1→c1, sA2→c2, aA→c1, aA→c4, aArch→c2, nB1→c3, yB→c5.
- **Links (8):** `parentA` guardian of sA1, sA2, aA, aArch; `parentB` guardian of nB1, yB; `studentA` self of sA1; `studentB` self of nB1.
- **Periods (3):** T1 p1 08:00/45, T1 p2 08:50/45, T2 p1 10:30/50 (the two teachers' "period 1" differ).
- **Slots (6):** T1: Sun p1 c1 (note `SECRET_NOTE`), Tue p2 c1, Mon p1 c3 (note `B_ONLY_NOTE`), Wed p1 c4 (note `ARCHIVED_CLASS_NOTE`), Thu p1 **no class** (note `FREE_PERIOD_NOTE`); T2: Sun p1 c2 (subject `physics`).

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/test-support/__tests__/seedFamilies.db.test.ts
/**
 * What this guards: the seed is the fixture every cross-family test leans on.
 * If a constraint (one `self` link per roster row, unique slot keys) rejects a
 * row, or a count drifts, the tests built on it would pass or fail for the
 * wrong reason. Counts here are the contract.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../gate.ts";
import { setupTestDb, type TestDb } from "../testDb.ts";
import { seedFamilyWorld, type FamilyWorld } from "../seedFamilies.ts";

describeDb("seedFamilyWorld", () => {
  let db: TestDb;
  let world: FamilyWorld;

  before(async () => {
    db = await setupTestDb();
    world = await seedFamilyWorld(db.pool);
  });
  after(async () => {
    await db?.drop();
  });

  async function count(table: string, where = "true"): Promise<number> {
    const r = await db.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`);
    return r.rows[0].n;
  }

  it("creates the people, classes and roster rows", async () => {
    assert.equal(await count("users"), 8);
    assert.equal(await count("class_groups"), 5);
    assert.equal(await count("class_groups", "archived_at IS NOT NULL"), 1);
    assert.equal(await count("students"), 6);
    assert.equal(await count("students", "archived_at IS NOT NULL"), 1);
  });

  it("creates memberships, links, periods and slots", async () => {
    assert.equal(await count("class_memberships"), 7);
    assert.equal(await count("roster_links"), 8);
    assert.equal(await count("roster_links", "relation = 'self'"), 2);
    assert.equal(await count("schedule_periods"), 3);
    assert.equal(await count("schedule_slots"), 6);
    assert.equal(await count("schedule_slots", "class_group_id IS NULL"), 1);
  });

  it("returns an id for every user it names", () => {
    for (const [key, id] of Object.entries(world.users)) {
      assert.match(id, /^[0-9a-f-]{36}$/, key);
    }
  });

  it("marks exactly one account suspended", async () => {
    assert.equal(await count("users", "suspended_at IS NOT NULL"), 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres node --experimental-strip-types --test src/test-support/__tests__/seedFamilies.db.test.ts`
Expected: FAIL — cannot find module `../seedFamilies.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// artifacts/api-server/src/test-support/seedFamilies.ts
/**
 * The fixture for cross-family access tests: two families whose children are
 * taught by two teachers, plus the awkward rows that must NOT show up — an
 * archived roster row, an archived class, a class with no slots, a slot with
 * no class, and teachers' private slot notes.
 *
 * Raw SQL on purpose: @workspace/db cannot be imported under node --test
 * (extensionless re-exports), and tests should state the rows they depend on.
 */
import type { Pool } from "pg";

export const CHILDREN = { sara: "سارة", adam: "آدم", noor: "نور", yazan: "يزن" } as const;
export const TEACHER_NAMES = { t1: "Omar Haddad", t2: "Lina Saleh" } as const;

/** A note a teacher might write about one child — it must never reach any family. */
export const SECRET_NOTE = "غياب سارة متكرر — كلّم وليّ الأمر";
export const B_ONLY_NOTE = "b-only-note";
export const ARCHIVED_CLASS_NOTE = "archived-class-note";
export const FREE_PERIOD_NOTE = "free-period-note";

export interface FamilyWorld {
  users: {
    t1: string;
    t2: string;
    parentA: string;
    parentB: string;
    studentA: string;
    studentB: string;
    studentUnlinked: string;
    suspendedParent: string;
  };
}

async function id(pool: Pool, sql: string, params: unknown[]): Promise<string> {
  const r = await pool.query<{ id: string }>(sql, params);
  return r.rows[0].id;
}

function user(
  pool: Pool,
  first: string,
  last: string,
  role: string,
  email: string | null = null,
  suspended = false,
): Promise<string> {
  return id(
    pool,
    `INSERT INTO users (first_name, last_name, role, email, suspended_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
    [first, last, role, email, suspended],
  );
}

function classGroup(pool: Pool, teacherId: string, name: string, subject: string, archived = false): Promise<string> {
  return id(
    pool,
    `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids, archived_at)
     VALUES ($1, $2, $3, $4::jsonb, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
    [teacherId, name, subject, JSON.stringify([subject]), archived],
  );
}

function rosterRow(pool: Pool, teacherId: string, displayName: string, archived = false): Promise<string> {
  return id(
    pool,
    `INSERT INTO students (teacher_id, display_name, archived_at)
     VALUES ($1, $2, CASE WHEN $3::boolean THEN now() END) RETURNING id`,
    [teacherId, displayName, archived],
  );
}

async function member(pool: Pool, classId: string, studentId: string): Promise<void> {
  await pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [classId, studentId]);
}

async function link(pool: Pool, studentId: string, userId: string, relation: "self" | "guardian"): Promise<void> {
  await pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, $3)`, [
    studentId,
    userId,
    relation,
  ]);
}

async function period(pool: Pool, teacherId: string, n: number, start: string, minutes: number): Promise<void> {
  await pool.query(
    `INSERT INTO schedule_periods (teacher_id, period_number, start_time, duration_minutes) VALUES ($1, $2, $3, $4)`,
    [teacherId, n, start, minutes],
  );
}

async function slot(
  pool: Pool,
  teacherId: string,
  day: number,
  n: number,
  classId: string | null,
  subject: string,
  notes: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO schedule_slots (teacher_id, day_of_week, period_number, class_group_id, subject_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [teacherId, day, n, classId, subject, notes],
  );
}

export async function seedFamilyWorld(pool: Pool): Promise<FamilyWorld> {
  const t1 = await user(pool, "Omar", "Haddad", "teacher", "t1@example.test");
  const t2 = await user(pool, "Lina", "Saleh", "teacher", "t2@example.test");
  // Parents/students may have no email at all (code-only accounts).
  const parentA = await user(pool, "Parent", "A", "parent", null);
  const parentB = await user(pool, "Parent", "B", "parent", "parent-b@example.test");
  const studentA = await user(pool, "Student", "A", "student", null);
  const studentB = await user(pool, "Student", "B", "student", null);
  const studentUnlinked = await user(pool, "Student", "Unlinked", "student", null);
  const suspendedParent = await user(pool, "Parent", "Suspended", "parent", null, true);

  const c1 = await classGroup(pool, t1, "10A maths", "mathematics");
  const c2 = await classGroup(pool, t2, "10A physics", "physics");
  const c3 = await classGroup(pool, t1, "9B maths", "mathematics");
  const c4 = await classGroup(pool, t1, "old maths", "mathematics", true);
  const c5 = await classGroup(pool, t2, "9B physics", "physics");

  // The same child, Sara, is two roster rows: one per teacher.
  const sA1 = await rosterRow(pool, t1, CHILDREN.sara);
  const sA2 = await rosterRow(pool, t2, CHILDREN.sara);
  const aA = await rosterRow(pool, t1, CHILDREN.adam);
  const aArch = await rosterRow(pool, t2, CHILDREN.adam, true);
  const nB1 = await rosterRow(pool, t1, CHILDREN.noor);
  const yB = await rosterRow(pool, t2, CHILDREN.yazan);

  await member(pool, c1, sA1);
  await member(pool, c2, sA2);
  await member(pool, c1, aA);
  await member(pool, c4, aA);
  await member(pool, c2, aArch);
  await member(pool, c3, nB1);
  await member(pool, c5, yB);

  for (const row of [sA1, sA2, aA, aArch]) await link(pool, row, parentA, "guardian");
  for (const row of [nB1, yB]) await link(pool, row, parentB, "guardian");
  await link(pool, sA1, studentA, "self");
  await link(pool, nB1, studentB, "self");

  await period(pool, t1, 1, "08:00", 45);
  await period(pool, t1, 2, "08:50", 45);
  await period(pool, t2, 1, "10:30", 50);

  await slot(pool, t1, 0, 1, c1, "", SECRET_NOTE);
  await slot(pool, t1, 2, 2, c1, "", "");
  await slot(pool, t1, 1, 1, c3, "", B_ONLY_NOTE);
  await slot(pool, t1, 3, 1, c4, "", ARCHIVED_CLASS_NOTE);
  await slot(pool, t1, 4, 1, null, "", FREE_PERIOD_NOTE);
  await slot(pool, t2, 0, 1, c2, "physics", "");

  return { users: { t1, t2, parentA, parentB, studentA, studentB, studentUnlinked, suspendedParent } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm typecheck && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres node --experimental-strip-types --test src/test-support/__tests__/seedFamilies.db.test.ts`
Expected: typecheck exit 0; 4 tests PASS. If a constraint rejects a row, fix the seed (not the schema) and report it.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/test-support
git commit -m "$(cat <<'EOF'
test(api): seed two families, two teachers and the rows that must not leak

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 4: The cross-family cases (and proof they can fail)

**Files:**
- Test: `artifacts/api-server/src/routes/__tests__/familySchedule.db.test.ts`

**Interfaces:**
- Consumes: `describeDb`, `setupTestDb`/`TestDb`, `startServer`/`TestServer`, `accessToken`, and everything exported by `seedFamilies.ts` (Task 3).
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the tests**

```ts
// artifacts/api-server/src/routes/__tests__/familySchedule.db.test.ts
/**
 * What this guards: the family routes reach real children's accounts, and until
 * these tests nothing exercised them with real rows. Every case here is a way
 * the feature could show one family another family's data, show a teacher's
 * private note, or show a row that should be hidden (archived, no class).
 * One database and one server for the file; a second server with the flag off.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import {
  ARCHIVED_CLASS_NOTE,
  B_ONLY_NOTE,
  CHILDREN,
  FREE_PERIOD_NOTE,
  SECRET_NOTE,
  TEACHER_NAMES,
  seedFamilyWorld,
  type FamilyWorld,
} from "../../test-support/seedFamilies.ts";

interface Period {
  periodNumber: number;
  startTime: string | null;
  durationMinutes: number | null;
  subjectId: string;
  teacherName: string;
}
interface Day {
  dayOfWeek: number;
  periods: Period[];
}
interface Schedule {
  days: Day[];
}
interface ChildBody {
  key: string;
  displayName: string;
  schedule: Schedule;
}

async function call(server: TestServer, path: string, userId?: string) {
  const res = await fetch(`${server.base}${path}`, {
    headers: userId ? { Authorization: `Bearer ${accessToken(userId)}` } : {},
  });
  const text = await res.text();
  return { status: res.status, text, json: (text ? JSON.parse(text) : null) as unknown };
}

const dayNumbers = (s: Schedule): number[] => s.days.map(d => d.dayOfWeek);
const ALL_NOTES = [SECRET_NOTE, B_ONLY_NOTE, ARCHIVED_CLASS_NOTE, FREE_PERIOD_NOTE];

describeDb("family schedule over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let off: TestServer;
  let w: FamilyWorld;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    on = await startServer({ databaseUrl: db.url });
    off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined } });
  });
  after(async () => {
    await off?.stop();
    await on?.stop();
    await db?.drop();
  });

  describe("who may call", () => {
    it("refuses no token and a bad token", async () => {
      for (const path of ["/student/schedule", "/parent/schedule"]) {
        assert.equal((await call(on, path)).status, 401, `${path} without a token`);
        const bad = await fetch(`${on.base}${path}`, { headers: { Authorization: "Bearer not-a-token" } });
        assert.equal(bad.status, 401, `${path} with a bad token`);
      }
    });

    it("refuses the wrong role on each route", async () => {
      const cases: Array<[string, string, string]> = [
        ["/student/schedule", w.users.t1, "teacher"],
        ["/student/schedule", w.users.parentA, "parent"],
        ["/parent/schedule", w.users.t1, "teacher"],
        ["/parent/schedule", w.users.studentA, "student"],
      ];
      for (const [path, userId, who] of cases) {
        assert.equal((await call(on, path, userId)).status, 403, `${path} as a ${who}`);
      }
    });

    it("refuses a suspended account", async () => {
      const r = await call(on, "/parent/schedule", w.users.suspendedParent);
      assert.equal(r.status, 403);
      assert.equal((r.json as { code?: string }).code, "account_suspended");
    });

    it("answers student_accounts_disabled while the flag is off", async () => {
      const cases: Array<[string, string]> = [
        ["/student/schedule", w.users.studentA],
        ["/parent/schedule", w.users.parentA],
      ];
      for (const [path, userId] of cases) {
        const r = await call(off, path, userId);
        assert.equal(r.status, 403, path);
        assert.equal((r.json as { code?: string }).code, "student_accounts_disabled", path);
      }
    });
  });

  describe("a parent's view", () => {
    let a: { text: string; children: ChildBody[] };
    let b: { text: string; children: ChildBody[] };

    before(async () => {
      const ra = await call(on, "/parent/schedule", w.users.parentA);
      const rb = await call(on, "/parent/schedule", w.users.parentB);
      assert.equal(ra.status, 200, on.logs().slice(-1500));
      assert.equal(rb.status, 200);
      a = { text: ra.text, children: (ra.json as { children: ChildBody[] }).children };
      b = { text: rb.text, children: (rb.json as { children: ChildBody[] }).children };
    });

    it("gets exactly their own children — none of another family's", () => {
      assert.deepEqual(
        a.children.map(c => c.displayName).sort(),
        [CHILDREN.adam, CHILDREN.sara].sort(),
      );
      assert.deepEqual(
        b.children.map(c => c.displayName).sort(),
        [CHILDREN.noor, CHILDREN.yazan].sort(),
      );
      for (const name of [CHILDREN.sara, CHILDREN.adam, TEACHER_NAMES.t2]) {
        assert.ok(!b.text.includes(name), `family B's response must not contain ${name}`);
      }
      for (const name of [CHILDREN.noor, CHILDREN.yazan]) {
        assert.ok(!a.text.includes(name), `family A's response must not contain ${name}`);
      }
    });

    it("shows a child taught by two teachers as ONE child, each period with its own teacher's time", () => {
      const sara = a.children.find(c => c.displayName === CHILDREN.sara);
      assert.ok(sara, "Sara is present");
      assert.deepEqual(dayNumbers(sara.schedule), [0, 2]);
      const sunday = sara.schedule.days[0].periods;
      assert.deepEqual(sunday.map(p => p.teacherName), [TEACHER_NAMES.t1, TEACHER_NAMES.t2]);
      assert.deepEqual(sunday.map(p => p.startTime), ["08:00", "10:30"]);
      assert.deepEqual(sunday.map(p => p.durationMinutes), [45, 50]);
      assert.deepEqual(sunday.map(p => p.subjectId), ["mathematics", "physics"]);
    });

    it("excludes an archived roster row and an archived class", () => {
      const adam = a.children.find(c => c.displayName === CHILDREN.adam);
      assert.ok(adam, "Adam is present");
      // His archived row (under teacher 2) and his archived class (Wednesday) contribute nothing.
      assert.deepEqual(dayNumbers(adam.schedule), [0, 2]);
      assert.ok(!JSON.stringify(adam).includes(TEACHER_NAMES.t2));
    });

    it("returns an empty week — not an error — for a class with no slots", () => {
      const yazan = b.children.find(c => c.displayName === CHILDREN.yazan);
      assert.ok(yazan, "Yazan is present");
      assert.deepEqual(yazan.schedule, { days: [] });
      const noor = b.children.find(c => c.displayName === CHILDREN.noor);
      assert.deepEqual(noor && dayNumbers(noor.schedule), [1]);
    });

    it("never sends a teacher's private slot note (or the slot with no class)", () => {
      for (const note of ALL_NOTES) {
        assert.ok(!a.text.includes(note), `family A's response must not contain "${note}"`);
        assert.ok(!b.text.includes(note), `family B's response must not contain "${note}"`);
      }
      assert.ok(!a.text.includes('"notes"'), "no notes field at all");
    });
  });

  describe("a student's view", () => {
    it("sees only the classes their own roster row sits in", async () => {
      const r = await call(on, "/student/schedule", w.users.studentA);
      assert.equal(r.status, 200, on.logs().slice(-1500));
      const { schedule } = r.json as { schedule: Schedule };
      assert.deepEqual(dayNumbers(schedule), [0, 2]);
      // studentA is linked to Sara's row under teacher 1 only — not to her row under teacher 2.
      assert.ok(!r.text.includes(TEACHER_NAMES.t2));
      for (const note of ALL_NOTES) assert.ok(!r.text.includes(note), note);
    });

    it("does not see another family's class", async () => {
      const r = await call(on, "/student/schedule", w.users.studentB);
      const { schedule } = r.json as { schedule: Schedule };
      assert.deepEqual(dayNumbers(schedule), [1]);
      assert.ok(!r.text.includes(CHILDREN.sara));
    });

    it("gets an empty week for an account linked to no roster row", async () => {
      const r = await call(on, "/student/schedule", w.users.studentUnlinked);
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { schedule: { days: [] } });
    });
  });

  describe("the exam lists share the same link queries (the studentExams refactor)", () => {
    it("lists one parent section per live roster row, never an archived one", async () => {
      const a = await call(on, "/parent/exams", w.users.parentA);
      assert.equal(a.status, 200, on.logs().slice(-1500));
      const kidsA = (a.json as { children: Array<{ displayName: string; exams: unknown[] }> }).children;
      // Sara has two roster rows (two teachers); the archived Adam row is excluded.
      assert.deepEqual(
        kidsA.map(k => k.displayName).sort(),
        [CHILDREN.adam, CHILDREN.sara, CHILDREN.sara].sort(),
      );
      assert.ok(kidsA.every(k => k.exams.length === 0));

      const b = await call(on, "/parent/exams", w.users.parentB);
      const kidsB = (b.json as { children: Array<{ displayName: string }> }).children;
      assert.deepEqual(kidsB.map(k => k.displayName).sort(), [CHILDREN.noor, CHILDREN.yazan].sort());
    });

    it("gives a student their own (empty) exam list", async () => {
      const r = await call(on, "/student/exams", w.users.studentA);
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { exams: [] });
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres node --experimental-strip-types --test src/routes/__tests__/familySchedule.db.test.ts`
Expected: all cases PASS. **If any case fails, do not edit the test to make it pass.** Decide which it is and report it plainly with the output: (a) a harness/seed mistake (fix that), or (b) a real defect in the family code (report it as a finding; do not change production code in this task). Include `on.logs()` output for any 500.

- [ ] **Step 3: Prove each guard can fail (mutation checks)**

For each mutation below: apply it to the **source** file, run `pnpm build`, run the same test command, confirm the named test(s) go **red**, then restore with `git checkout -- <file>`, `pnpm build` again, and confirm `git status --short` shows only your new test file. Paste the failing test names for each.

| # | File | Mutation | Expected red |
| --- | --- | --- | --- |
| a | `src/lib/familyAccess.ts` | in `guardianLinkedStudents`, remove the line `eq(rosterLinks.userId, userId),` from the `where(and(...))` | "gets exactly their own children…" (and the exam-list case) |
| b | `src/lib/familyScheduleLoad.ts` + `src/modules/schedule/familySchedule.ts` | add `notes: scheduleSlots.notes,` to the slots `select({...})`, and in the builder's `entry` object add `notes: (s as unknown as { notes: string }).notes,` | "never sends a teacher's private slot note…" |
| c | `src/lib/familyScheduleLoad.ts` | remove `isNull(classGroups.archivedAt)` from the memberships `where(and(...))` (leave the import) | "excludes an archived roster row and an archived class" |
| d | `src/lib/familyAccess.ts` | in `guardianLinkedStudents`, remove `isNull(students.archivedAt),` from the `where(and(...))` | "lists one parent section per live roster row…" |

If a mutation does **not** turn anything red, the test is too weak: report it and strengthen the test (not the mutation).

- [ ] **Step 4: Full suite, then commit**

Run: `pnpm typecheck && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres pnpm test`
Expected: exit 0; every previously passing test still passes (baseline 1508) plus the new ones; DB tests are **run, not skipped**. Then check no databases leaked (`psql … "select datname from pg_database where datname like 'iqraa_test_%'"` prints nothing).

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/routes/__tests__/familySchedule.db.test.ts
git commit -m "$(cat <<'EOF'
test(api): cross-family access tests for the schedule routes, on a real database

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

### Task 5: CI wiring and docs

**Files:**
- Modify: `.github/workflows/ci.yml` (the `workspace` job, `name: typecheck + tests`)
- Modify: `LOCAL_SETUP.md` (new section before `## Run the frontend`)
- Modify: `STATUS.md` (new short section; find the spot with `grep -n "weekly timetable, 2026-10-11" STATUS.md`; **do not open STATUS.md whole, it is 1 MB**)

**Interfaces:**
- Consumes: env names `TEST_DATABASE_URL`, `REQUIRE_DB_TESTS`, `ALLOW_REMOTE_TEST_DB` from Task 1.
- Produces: nothing.

- [ ] **Step 1: ci.yml — add the Postgres service to the `workspace` job**

Insert, directly under `timeout-minutes: 20` of the `workspace` job and before `steps:` (copy of the `migrations` job's service block):

```yaml
    # DB-backed API tests (src/test-support) create their own iqraa_test_*
    # databases on this server; they never touch the `postgres` database itself.
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
```

- [ ] **Step 2: ci.yml — point the api-server test step at it**

Replace the step

```yaml
      - name: Test api-server
        run: pnpm --filter @workspace/api-server run test
```

with

```yaml
      # REQUIRE_DB_TESTS makes a missing database a FAILURE, not a skip: a
      # pipeline that loses its Postgres service must not quietly stop testing
      # cross-family access.
      - name: Test api-server
        run: pnpm --filter @workspace/api-server run test
        env:
          TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
          REQUIRE_DB_TESTS: 'true'
```

Do not touch the `migrations` job.

- [ ] **Step 3: LOCAL_SETUP.md — add the section**

Insert immediately before the line `## Run the frontend`:

````md
## DB-backed API tests

Some api-server tests (`*.db.test.ts`) run against a real Postgres: each test file
creates its own throwaway database (`iqraa_test_<hex>`), applies the repo's
migrations, seeds rows, boots the **built bundle** against it and calls the real
routes. They **skip** unless `TEST_DATABASE_URL` is set, and **fail** if
`REQUIRE_DB_TESTS=true` (CI sets both).

```bash
pnpm --filter @workspace/api-server run build      # the tests boot dist/index.mjs
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres \
  pnpm --filter @workspace/api-server run test
```

`TEST_DATABASE_URL` is an *admin* URL: the harness only ever `CREATE`s and
`DROP`s databases named `iqraa_test_` + 12 hex characters, and never stores data
in the database the URL names. It refuses any host except `localhost`,
`127.0.0.1` and `[::1]` unless `ALLOW_REMOTE_TEST_DB=1`. Never point it at a real
database.

No Postgres handy? Start a throwaway one (Postgres refuses to run as root, hence
`runuser`; adjust the binary path for your install):

```bash
B=/usr/lib/postgresql/16/bin; D=/tmp/pgtest-iqraa
mkdir -p $D && chown postgres:postgres $D
runuser -u postgres -- $B/initdb -D $D/data -A trust -U postgres
runuser -u postgres -- $B/pg_ctl -D $D/data -o "-p 55432 -k $D -c listen_addresses=127.0.0.1" -l $D/log -w start
# TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres
```
````

- [ ] **Step 4: STATUS.md — add a short section**

Find the section `## Students and parents see the weekly timetable, 2026-10-11` with the grep above, read ~50 lines from its heading to find its end, and insert this new section right after it (match the heading level):

```md
## API tests can run against a real database, 2026-10-12

Until now **no test touched a real database** — `mountOrder.test.ts` boots the built
bundle against a fake `DATABASE_URL` and only proves the 401s. `src/test-support/`
adds a harness: per test file it creates a throwaway `iqraa_test_<hex>` database on
the server named by `TEST_DATABASE_URL`, applies the real migrations, seeds rows
with raw SQL, boots `dist/index.mjs` against it and calls routes with minted access
tokens. First user: `src/routes/__tests__/familySchedule.db.test.ts` — cross-family
access (a parent sees only their children; a student only their class), archived
rows and classes excluded, teachers' private slot notes never sent, the flag-off 403,
and the `/parent/exams` + `/student/exams` queries shared with the schedule.

- **CI** (`workspace` job) now has a `postgres:16` service and sets `REQUIRE_DB_TESTS=true`,
  so a missing database fails instead of skipping. Locally the tests skip unless
  `TEST_DATABASE_URL` is set — see `LOCAL_SETUP.md`, «DB-backed API tests».
- **Safety:** only `iqraa_test_` + 12 hex names are created/dropped; non-local hosts are
  refused without `ALLOW_REMOTE_TEST_DB=1`. Schema comes from the migrations, never `push`.
- **Build first:** the tests boot `dist/index.mjs`, so `pnpm build` precedes `pnpm test` (CI already does).
- New tests for routes that need real rows (homework, exams — spec Parts 2–3) should be
  written as `*.db.test.ts` on this harness.
```

- [ ] **Step 5: Verify**

Run from `/home/user/Iqraa`: `pnpm run typecheck`, then in `artifacts/api-server`: `pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres pnpm test` (exit 0, DB tests run not skipped) and `REQUIRE_DB_TESTS=true pnpm test` **without** a URL (the DB suites fail with the "set TEST_DATABASE_URL" message — paste it). Validate the workflow file parses: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8');console.log(y.includes('REQUIRE_DB_TESTS')&&y.includes('postgres:16'))"` prints `true`, and `git diff .github/workflows/ci.yml` shows only the two insertions above (no other job touched).

- [ ] **Step 6: Commit**

```bash
cd /home/user/Iqraa
git add .github/workflows/ci.yml LOCAL_SETUP.md STATUS.md
git commit -m "$(cat <<'EOF'
ci: run DB-backed API tests against a Postgres service, and document them

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0136ftdQk7tF2xtf2Za7RUAX
EOF
)"
```

---

## Self-review

**Spec coverage.** Spec Testing section → Task 4 covers "a parent cannot read another family's child", cross-class student access, archived/no-slot rows, notes, flag-off, and the shared `/parent/exams`/`/student/exams` queries. "Unowned paths still 404" is already asserted by `mountOrder.test.ts`; the homework-specific cases (teacher cannot edit another teacher's homework, results hidden until released) belong to spec Parts 2–3 and will be written on this harness. The approved design's items: safety rails (Task 1), gate with REQUIRE_DB_TESTS (Task 1), free port + bundle boot (Task 2), tokens (Task 2), seeds with the awkward rows (Task 3), nine cases (Task 4 — #1–#9 map to the "who may call", parent, student, exam-list groups), mutation proof (Task 4 Step 3), CI + docs (Task 5), cleanup check (Task 2 Step 5).

**Placeholder scan.** No TBD/TODO. Two steps are procedural by necessity: Task 2 Step 1 (what pnpm rewrites in the lockfile) and Task 5 Step 4 (insertion point in a 1 MB file found by grep) — each names the exact command and expected result.

**Type consistency.** `TestDb {name,url,pool,drop}` (Task 2) is what Tasks 3–4 use; `TestServer {base,logs,stop}` likewise; `accessToken(userId, secret?)`; `FamilyWorld.users` keys (`t1,t2,parentA,parentB,studentA,studentB,studentUnlinked,suspendedParent`) match every use in Task 4; seed counts in Task 3 (8 users, 5 classes, 6 roster rows, 7 memberships, 8 links, 3 periods, 6 slots) match the world listing and the seed code (7 `member()` calls, 4+2+2 `link()` calls, 6 `slot()` calls). Response shapes match the routes (`{schedule}`, `{children:[{key,displayName,schedule}]}`, `{exams}`, `/parent/exams` `{children:[{displayName,exams}]}`); `FamilyPeriod` has no `notes` since the notes fix.
