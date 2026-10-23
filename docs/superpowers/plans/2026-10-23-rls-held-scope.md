# Row-level security: one scoped connection per request — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the added latency of `RLS_ENFORCE=on` on the teacher/parent/student inbox inside the +100 ms p95 budget by holding one scoped, read-only connection for the whole request instead of three round trips per statement.

**Architecture:** `ScopedPool` gains `openScope(identity)`, which returns a `RequestScope` that checks out one connection lazily, runs `BEGIN READ ONLY; SET LOCAL ROLE iqraa_app; set_config(…)` once, runs every statement of the request on it, and `COMMIT`s when the response ends. An Express middleware, mounted only on an allow-listed set of GET routes, opens the scope and closes it from `res` `finish`/`close`. Everything else (writes, unlisted routes, enforcement off) is unchanged.

**Tech Stack:** TypeScript, node-postgres (`pg`), `AsyncLocalStorage`, Express, `node:test`; Postgres 16 for the db tests.

**Spec:** `docs/superpowers/specs/2026-10-23-rls-latency-request-scoped-connection-design.md`

## Global Constraints

- With enforcement off, `ScopedPool` must stay exactly a `pg.Pool` (`openScope` returns `undefined`, `query` is `super.query`).
- Never run a statement unscoped: after a scope ends, or on any failure of the held path, statements fall back to the existing per-statement scoped path.
- Held scopes are `READ ONLY` and GET-only; the hold timeout is 5000 ms.
- Files in `lib/db/src` that `node --test` loads directly use explicit `.ts` import extensions (`./identity.ts`); `lib/db/src/index.ts` keeps its extensionless imports (esbuild). `artifacts/api-server/src/lib/__tests__` files import the code under test with an explicit `.ts` extension, and that code must not import `@workspace/db` (it throws at import without `DATABASE_URL`).
- No `sed -i` / `perl -pi` on source; use the Edit tool.
- Tests go inside the existing globs: `lib/db/src/**/__tests__/**/*.test.ts`, `artifacts/api-server/src/**/__tests__/**/*.test.ts`.
- Do not change any policy, and do not touch `RLS_ENFORCE` in any environment; the production switch is the owner's step (checklist D).
- Branch: start from `main` (`git fetch origin main && git checkout -B ccr-3ee1b708-xc6gqo origin/main`) once PR #1211 is merged, so this code is its own PR.

## Running the database tests locally

The db tests need a migrated Postgres. Without `RLS_TEST_DATABASE_URL` they skip (a skip is not a pass).

```bash
S=$(mktemp -d); chown postgres "$S"; chmod 755 "$S"
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $S/data -A trust >/dev/null && /usr/lib/postgresql/16/bin/pg_ctl -D $S/data -o '-p 55432 -k /tmp' -l $S/log -w start"
psql -h /tmp -p 55432 -U postgres -c "create database rlstest"
export U='postgresql://postgres@localhost:55432/rlstest?sslmode=disable'
DATABASE_URL="$U" pnpm --filter @workspace/db run migrate -- --from-env
RLS_TEST_DATABASE_URL="$U" pnpm --filter @workspace/db run test
```

When finished: `pkill -9 -u postgres` and `rm -rf "$S"` (stop the server before deleting its directory).

## File Structure

- Create `lib/db/src/requestScope.ts` — `RequestScope`, `ScopeEnded`, `runInScope`, `currentScope`. One responsibility: own one held connection for one request.
- Modify `lib/db/src/scopedPool.ts` — `scopeSqlFor(identity)`, `openScope`, and the held branch in `query`.
- Modify `lib/db/src/index.ts` — export `runInScope`, `RequestScope` type, `openRequestScope`.
- Create `lib/db/src/__tests__/requestScope.test.ts`.
- Create `artifacts/api-server/src/lib/heldConnection.ts` — pure middleware factory (no `@workspace/db` import).
- Create `artifacts/api-server/src/middlewares/holdScopedConnection.ts` — wires the factory to `@workspace/db` and the logger.
- Create `artifacts/api-server/src/lib/heldReads.ts` — the allow-list with a reason per route.
- Modify `artifacts/api-server/src/routes/messaging.ts` — import and mount on `GET /messaging/threads`.
- Create `artifacts/api-server/src/lib/__tests__/heldConnection.test.ts` and `heldReads.test.ts`.
- Modify `lib/db/scripts/bench-rls.ts` (a `held` column), `docs/rls-rollout-checklist.md`, `STATUS.md`, `docs/status-log.md`.

---

### Task 1: `RequestScope` and the held path in `ScopedPool`

**Files:**
- Create: `lib/db/src/requestScope.ts`
- Modify: `lib/db/src/scopedPool.ts`
- Test: `lib/db/src/__tests__/requestScope.test.ts`

**Interfaces:**
- Consumes: `Identity` and `currentIdentity()` from `lib/db/src/identity.ts`; the existing `ScopedPool(config, enforce)`.
- Produces:
  - `class RequestScope` with `readonly owner: object`, `statements: number`, `ended: boolean`, `query(args: any[]): Promise<pg.QueryResult>`, `end(failed?: boolean): Promise<void>`, `stats(): { statements: number; heldMs: number }`
  - `class ScopeEnded extends Error`
  - `function runInScope<T>(scope: RequestScope, fn: () => T): T`, `function currentScope(): RequestScope | undefined`
  - `ScopedPool#openScope(identity: Identity, holdTimeoutMs?: number): RequestScope | undefined` (default 5000; `undefined` when enforcement is off)

- [ ] **Step 1: Write the failing test**

Create `lib/db/src/__tests__/requestScope.test.ts`:

```ts
// lib/db/src/__tests__/requestScope.test.ts
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { asUser, type Identity } from "../identity.ts";
import { runInScope, type RequestScope } from "../requestScope.ts";
import { ScopedPool } from "../scopedPool.ts";
import { seed, TEST_URL, type Fixture } from "../testing/rlsHarness.ts";

// Needs a migrated Postgres, like the matrix suite; skips without RLS_TEST_DATABASE_URL.
describe("request-scoped connection", { skip: !TEST_URL && "RLS_TEST_DATABASE_URL not set" }, () => {
  let owner!: pg.Pool;
  let scoped!: ScopedPool;
  let fx!: Fixture;
  let ids: Fixture["ids"];

  before(async () => {
    owner = new pg.Pool({ connectionString: TEST_URL, max: 2 });
    scoped = new ScopedPool({ connectionString: TEST_URL, max: 4 }, true);
    fx = await seed(owner);
    ids = fx.ids;
  });
  after(async () => {
    await fx?.cleanup();
    await scoped?.end();
    await owner?.end();
  });

  const identity = (key: keyof Fixture["ids"], role: string): Identity => ({ userId: ids[key]!, role });

  /** Run `fn` as `who` inside a held scope opened for them, and always end the scope. */
  const held = async <T>(who: Identity, fn: (scope: RequestScope) => Promise<T>, holdTimeoutMs = 5000): Promise<T> => {
    const scope = scoped.openScope(who, holdTimeoutMs)!;
    try {
      return await asUser(who, () => runInScope(scope, () => fn(scope)));
    } finally {
      await scope.end();
    }
  };

  test("every statement of the request runs as the caller, on one connection", async () => {
    await held(identity("teacherA", "teacher"), async scope => {
      const a = await scoped.query(
        `SELECT pg_backend_pid() AS pid, current_user AS u, app_uid() AS uid,
                (SELECT count(*) FROM students WHERE id = ANY($1)) AS n`,
        [[ids.studentA, ids.studentB]],
      );
      const b = await scoped.query(`SELECT pg_backend_pid() AS pid`);
      assert.equal(a.rows[0].u, "iqraa_app");
      assert.equal(a.rows[0].uid, ids.teacherA);
      assert.equal(a.rows[0].n, "1"); // teacher A sees their own student only
      assert.equal(a.rows[0].pid, b.rows[0].pid); // one connection for the whole request
      assert.equal(scope.stats().statements, 2);
    });
  });

  test("two requests at once never see each other's identity", async () => {
    const run = (who: Identity) =>
      held(who, async () => {
        const seen: unknown[] = [];
        for (let n = 0; n < 5; n++) seen.push((await scoped.query(`SELECT app_uid() AS uid`)).rows[0].uid);
        return seen;
      });
    const [a, b] = await Promise.all([run(identity("teacherA", "teacher")), run(identity("teacherB", "teacher"))]);
    assert.deepEqual(a, Array(5).fill(ids.teacherA));
    assert.deepEqual(b, Array(5).fill(ids.teacherB));
  });

  test("ending the scope commits, frees the connection and leaves no identity behind", async () => {
    await held(identity("teacherA", "teacher"), async () => {
      await scoped.query(`SELECT 1`);
    });
    assert.equal(scoped.idleCount, scoped.totalCount);
    assert.equal(scoped.waitingCount, 0);
    const after = await scoped.query(`SELECT app_uid() AS uid`);
    assert.equal(after.rows[0].uid, null);
  });

  test("a write inside a held scope is refused, ends the scope, and later statements still run scoped", async () => {
    await held(identity("teacherA", "teacher"), async scope => {
      await assert.rejects(
        scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x')`, [ids.teacherA]),
        /read-only/,
      );
      assert.equal(scope.ended, true);
      const after = await scoped.query(`SELECT current_user AS u, app_uid() AS uid`);
      assert.equal(after.rows[0].u, "iqraa_app");
      assert.equal(after.rows[0].uid, ids.teacherA);
    });
    assert.equal(scoped.idleCount, scoped.totalCount);
  });

  test("a scope held past its timeout is rolled back and its connection freed", async () => {
    await held(
      identity("teacherA", "teacher"),
      async scope => {
        await scoped.query(`SELECT 1`);
        await sleep(300);
        assert.equal(scope.ended, true);
        assert.equal(scoped.idleCount, scoped.totalCount);
        const after = await scoped.query(`SELECT app_uid() AS uid`); // per-statement path now
        assert.equal(after.rows[0].uid, ids.teacherA);
      },
      100,
    );
  });

  test("a scope that never ran a statement holds no connection", async () => {
    const before = scoped.totalCount;
    await held(identity("teacherA", "teacher"), async () => {});
    assert.equal(scoped.totalCount, before);
  });

  test("with enforcement off there is no scope", async () => {
    const off = new ScopedPool({ connectionString: TEST_URL, max: 1 }, false);
    try {
      assert.equal(off.openScope(identity("teacherA", "teacher")), undefined);
    } finally {
      await off.end();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (with the local Postgres from *Running the database tests locally*):
`RLS_TEST_DATABASE_URL="$U" pnpm --filter @workspace/db exec node --experimental-strip-types --test src/__tests__/requestScope.test.ts`
Expected: FAIL — `Cannot find module '../requestScope.ts'` (an import error, not a skip).

- [ ] **Step 3: Write `requestScope.ts`**

Create `lib/db/src/requestScope.ts`:

```ts
// lib/db/src/requestScope.ts
import { AsyncLocalStorage } from "node:async_hooks";
import type pg from "pg";

/** Thrown by `RequestScope.query` once the scope has ended; ScopedPool then takes the per-statement path. */
export class ScopeEnded extends Error {
  constructor() {
    super("request scope ended");
  }
}

/**
 * One connection held for one request, so row-level security costs three round
 * trips per request instead of three per statement.
 *
 * The connection is checked out on the first statement (a scope that never runs
 * one holds nothing), put in a READ ONLY transaction scoped to the caller with
 * the same SQL ScopedPool uses per statement, and kept until `end()`. One client
 * runs one statement at a time, so a Promise.all inside a held request runs
 * sequentially.
 *
 * A failed statement aborts the Postgres transaction, so the scope ends itself
 * (ROLLBACK) and later statements in the request take the per-statement path.
 * `end()` is also what the hold timeout calls, so a stuck handler cannot pin a
 * pool slot. `end()` is safe to call more than once.
 */
export class RequestScope {
  statements = 0;
  ended = false;
  private clientP: Promise<pg.PoolClient> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private startedAt = 0;
  private closing: Promise<void> | undefined;

  constructor(
    /** The ScopedPool that made this scope; another pool must not run statements on it. */
    readonly owner: object,
    private readonly acquire: () => Promise<pg.PoolClient>,
    private readonly beginSql: string,
    private readonly holdTimeoutMs: number,
  ) {}

  async query(args: any[]): Promise<pg.QueryResult> {
    if (this.ended) throw new ScopeEnded();
    const client = await this.open();
    if (this.ended) throw new ScopeEnded(); // ended while we waited for the connection
    this.statements++;
    try {
      return await (client.query as any).apply(client, args);
    } catch (err) {
      await this.end(true); // the transaction is aborted; later statements go per-statement
      throw err;
    }
  }

  end(failed = false): Promise<void> {
    this.ended = true;
    if (!this.closing) this.closing = this.close(failed);
    return this.closing;
  }

  stats(): { statements: number; heldMs: number } {
    return { statements: this.statements, heldMs: this.startedAt ? performance.now() - this.startedAt : 0 };
  }

  private open(): Promise<pg.PoolClient> {
    if (!this.clientP) {
      this.clientP = this.acquire()
        .then(async client => {
          try {
            await client.query(this.beginSql);
          } catch (err) {
            client.release(true);
            throw err;
          }
          this.startedAt = performance.now();
          this.timer = setTimeout(() => void this.end(true), this.holdTimeoutMs);
          this.timer.unref();
          return client;
        })
        .catch(err => {
          this.clientP = undefined; // the next statement tries again, like the per-statement path
          throw err;
        });
    }
    return this.clientP;
  }

  private async close(failed: boolean): Promise<void> {
    clearTimeout(this.timer);
    if (!this.clientP) return;
    let client: pg.PoolClient;
    try {
      client = await this.clientP;
    } catch {
      return;
    }
    let broken = false;
    try {
      await client.query(failed ? "ROLLBACK" : "COMMIT");
    } catch {
      broken = true; // a connection that cannot finish its transaction is discarded, not reused
    }
    client.release(broken);
  }
}

const store = new AsyncLocalStorage<RequestScope>();

/** Run `fn` — and everything it awaits — with `scope` as the request's held connection. */
export function runInScope<T>(scope: RequestScope, fn: () => T): T {
  return store.run(scope, fn);
}

/** The held scope of the request in flight, if any. */
export function currentScope(): RequestScope | undefined {
  return store.getStore();
}
```

- [ ] **Step 4: Change `scopedPool.ts`**

In `lib/db/src/scopedPool.ts`:

(a) Change the imports and the scope-SQL helper. Replace

```ts
import pg from "pg";
import { currentIdentity } from "./identity.ts";
```

with

```ts
import pg from "pg";
import { currentIdentity, type Identity } from "./identity.ts";
import { currentScope, RequestScope, ScopeEnded } from "./requestScope.ts";
```

and replace the whole `function scopeSql(): string { … }` (the doc comment above it stays) with:

```ts
function scopeSqlFor(identity: Identity | undefined): string {
  const toRole = "SET LOCAL ROLE iqraa_app";
  if (!identity) {
    return `${toRole}; SELECT set_config('app.user_id', '', true), set_config('app.role', '', true)`;
  }
  return (
    `${toRole}; SELECT set_config('app.user_id', '${identity.userId}', true), ` +
    `set_config('app.role', '${identity.role}', true)`
  );
}

const scopeSql = () => scopeSqlFor(currentIdentity());
```

(b) Add the held branch to `query`. Replace

```ts
    if (!this.enforce || typeof args[args.length - 1] === "function") {
      return (super.query as any).apply(this, args);
    }
    return this.scopedQuery(args);
  }
```

with

```ts
    if (!this.enforce || typeof args[args.length - 1] === "function") {
      return (super.query as any).apply(this, args);
    }
    const scope = currentScope();
    if (scope && !scope.ended && scope.owner === this) return this.heldQuery(scope, args);
    return this.scopedQuery(args);
  }

  /**
   * One scoped, read-only connection for the whole request (see requestScope.ts),
   * for the routes that opted in. `identity` is fixed when the scope is opened.
   * Undefined with enforcement off, where there is nothing to scope.
   */
  openScope(identity: Identity, holdTimeoutMs = 5000): RequestScope | undefined {
    if (!this.enforce) return undefined;
    return new RequestScope(
      this,
      () => (super.connect as any).call(this),
      `BEGIN READ ONLY; ${scopeSqlFor(identity)}`,
      holdTimeoutMs,
    );
  }

  private async heldQuery(scope: RequestScope, args: any[]): Promise<pg.QueryResult> {
    try {
      return await scope.query(args);
    } catch (err) {
      if (err instanceof ScopeEnded) return this.scopedQuery(args); // ended under us: still scoped, per statement
      throw err;
    }
  }
```

Also extend the class doc comment: add a bullet after the `connect()` bullet:

```
 * - With a RequestScope open for the request (`openScope`), `query()` runs on that
 *   one held connection instead; `connect()` (db.transaction) is unaffected.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `RLS_TEST_DATABASE_URL="$U" pnpm --filter @workspace/db run test`
Expected: PASS, no skips — the new file's 7 tests plus every existing suite (the matrix's 27, coverage, identity, pool options and the differential's 3 included).

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm run typecheck` — expected: no errors.

```bash
git add lib/db/src/requestScope.ts lib/db/src/scopedPool.ts lib/db/src/__tests__/requestScope.test.ts
git commit -m "db: hold one scoped, read-only connection for a request (RequestScope)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YJ7dEJhS2tXoLTWmvXP34"
```

---

### Task 2: The middleware, the allow-list, and the inbox route

**Files:**
- Modify: `lib/db/src/index.ts`
- Create: `artifacts/api-server/src/lib/heldConnection.ts`, `artifacts/api-server/src/middlewares/holdScopedConnection.ts`, `artifacts/api-server/src/lib/heldReads.ts`
- Modify: `artifacts/api-server/src/routes/messaging.ts`
- Test: `artifacts/api-server/src/lib/__tests__/heldConnection.test.ts`, `artifacts/api-server/src/lib/__tests__/heldReads.test.ts`

**Interfaces:**
- Consumes: `ScopedPool#openScope`, `runInScope`, `RequestScope` (Task 1); `currentIdentity`, `Identity` from `@workspace/db`; `logger` from `../lib/logger.js`.
- Produces:
  - `@workspace/db`: `openRequestScope(identity: Identity, holdTimeoutMs?: number): RequestScope | undefined`, `runInScope`, `type RequestScope`
  - `makeHoldScopedConnection<S extends HeldScope>(deps: HeldDeps<S>)` returning `(req: HeldReq, res: HeldRes, next: () => void) => void`
  - `holdScopedConnection` (the Express middleware, wired to the real deps)
  - `HELD_READS: Record<string, string>` keyed `"GET /path"`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/api-server/src/lib/__tests__/heldConnection.test.ts`:

```ts
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, test } from "node:test";
import { makeHoldScopedConnection } from "../heldConnection.ts";

function harness(opts: { identity?: { userId: string; role: string } | undefined; open?: boolean } = {}) {
  const events: string[] = [];
  const logs: Array<{ route: string; statements: number; heldMs: number }> = [];
  const scope = {
    end: async (failed?: boolean) => {
      events.push(failed ? "end(failed)" : "end");
    },
    stats: () => ({ statements: 3, heldMs: 12 }),
  };
  const mw = makeHoldScopedConnection({
    identity: () => ("identity" in opts ? opts.identity : { userId: "u1", role: "teacher" }),
    open: () => (opts.open === false ? undefined : scope),
    run: (_s, fn) => {
      events.push("run");
      return fn();
    },
    log: info => logs.push(info),
  });
  const next = () => events.push("next");
  const req = (method = "GET") => ({ method, originalUrl: "/api/messaging/threads?limit=5" });
  const flush = () => new Promise<void>(r => setImmediate(r));
  return { mw, events, logs, next, req, flush };
}

describe("holdScopedConnection", () => {
  test("a GET with an identity runs the handler inside the scope and ends it on finish", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    assert.deepEqual(h.events, ["run", "next"]);
    res.emit("finish");
    await h.flush();
    assert.deepEqual(h.events, ["run", "next", "end"]);
  });

  test("finish and close together end the scope once", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    res.emit("finish");
    res.emit("close");
    await h.flush();
    assert.equal(h.events.filter(e => e === "end").length, 1);
  });

  test("a client that hangs up still ends the scope", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    res.emit("close");
    await h.flush();
    assert.deepEqual(h.events, ["run", "next", "end"]);
  });

  test("logs the route without its query string, with the scope's statement count and hold time", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    res.emit("finish");
    await h.flush();
    assert.deepEqual(h.logs, [{ route: "GET /api/messaging/threads", statements: 3, heldMs: 12 }]);
  });

  test("a write is never held", () => {
    const h = harness();
    h.mw(h.req("POST"), new EventEmitter(), h.next);
    assert.deepEqual(h.events, ["next"]);
  });

  test("no identity means no scope", () => {
    const h = harness({ identity: undefined });
    h.mw(h.req(), new EventEmitter(), h.next);
    assert.deepEqual(h.events, ["next"]);
  });

  test("with enforcement off (open returns nothing) the handler just runs", () => {
    const h = harness({ open: false });
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    assert.deepEqual(h.events, ["next"]);
    assert.equal(res.listenerCount("finish"), 0);
  });
});
```

Create `artifacts/api-server/src/lib/__tests__/heldReads.test.ts`:

```ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { HELD_READS } from "../heldReads.ts";

/**
 * A held route keeps one database connection for as long as its handler runs, so only routes
 * that read, and never call a model, another service or a push, may mount holdScopedConnection.
 * The list lives in lib/heldReads.ts with a reason per route; adding to it means editing this
 * pin's source of truth, which is where a reviewer asks "does this handler wait on anything?".
 */
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const MOUNT = /router\.get\(\s*"([^"]+)"\s*,\s*holdScopedConnection\b/g;
const CALLS_OUT = /\b(fetch|sendExpoPush|pushWithin|generateContent|streamChat|openai)\b/i;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** Every held mount: its route and the source from the mount to the next router.* registration. */
function mounts(): Array<{ route: string; body: string }> {
  return sources(path.join(src, "routes")).flatMap(file => {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(MOUNT)].map(m => {
      const next = text.indexOf("\nrouter.", m.index! + 1);
      return { route: `GET ${m[1]}`, body: text.slice(m.index!, next === -1 ? undefined : next) };
    });
  });
}

describe("which routes may hold a database connection", () => {
  test("exactly the allow-listed routes mount holdScopedConnection", () => {
    assert.deepEqual(mounts().map(m => m.route).sort(), Object.keys(HELD_READS).sort());
  });

  test("every entry is a GET and none is a model or chat route", () => {
    for (const key of Object.keys(HELD_READS)) {
      assert.match(key, /^GET \//);
      assert.doesNotMatch(key, /^GET \/(generate|chat)/);
    }
  });

  test("no held handler calls a model, another service or a push", () => {
    for (const { route, body } of mounts()) {
      assert.doesNotMatch(body, CALLS_OUT, `${route} waits on something outside the database`);
    }
  });

  test("every entry has a reason", () => {
    for (const [route, reason] of Object.entries(HELD_READS)) assert.ok(reason.length > 20, route);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/heldConnection.test.ts src/lib/__tests__/heldReads.test.ts`
Expected: FAIL — `Cannot find module '../heldConnection.ts'` / `'../heldReads.ts'`.

- [ ] **Step 3: Write the pure core**

Create `artifacts/api-server/src/lib/heldConnection.ts`:

```ts
/**
 * The logic of holdScopedConnection, with its collaborators passed in so it can be
 * tested without a database (importing @workspace/db throws without DATABASE_URL).
 * The real wiring is middlewares/holdScopedConnection.ts.
 */
export interface HeldScope {
  end(failed?: boolean): Promise<void>;
  stats(): { statements: number; heldMs: number };
}

export interface HeldDeps<S extends HeldScope> {
  identity(): { userId: string; role: string } | undefined;
  /** A held scope for this caller, or undefined (enforcement off). */
  open(identity: { userId: string; role: string }): S | undefined;
  run<T>(scope: S, fn: () => T): T;
  log(info: { route: string; statements: number; heldMs: number }): void;
}

export interface HeldReq {
  method: string;
  originalUrl?: string;
  url?: string;
}

export interface HeldRes {
  once(event: "finish" | "close", cb: () => void): unknown;
}

export function makeHoldScopedConnection<S extends HeldScope>(deps: HeldDeps<S>) {
  return function holdScopedConnection(req: HeldReq, res: HeldRes, next: () => void): void {
    const identity = deps.identity();
    // Only reads are held (the scope is READ ONLY), and only for a known caller; anything
    // else, and enforcement off, runs the handler on the ordinary per-statement path.
    const scope = req.method === "GET" && identity ? deps.open(identity) : undefined;
    if (!scope) {
      next();
      return;
    }
    const route = `${req.method} ${(req.originalUrl ?? req.url ?? "").split("?")[0]}`;
    let ended = false;
    // `finish` after a normal response, `close` when the client hangs up first. The scope is
    // captured here: a `close` callback does not inherit the request's async store.
    const done = () => {
      if (ended) return;
      ended = true;
      void scope
        .end()
        .catch(() => undefined)
        .then(() => deps.log({ route, ...scope.stats() }));
    };
    res.once("finish", done);
    res.once("close", done);
    deps.run(scope, next);
  };
}
```

Create `artifacts/api-server/src/middlewares/holdScopedConnection.ts`:

```ts
import { currentIdentity, openRequestScope, runInScope } from "@workspace/db";
import { makeHoldScopedConnection } from "../lib/heldConnection.js";
import { logger } from "../lib/logger.js";

/**
 * Hold one row-level-security connection for the whole request. Mount it, after authMiddleware,
 * ONLY on a GET route listed in lib/heldReads.ts: the handler keeps the connection until it
 * answers, so it must not wait on a model, another service or a push (heldReads.test.ts checks).
 * Inert while RLS_ENFORCE is off. How long each request held it is logged at debug level.
 */
export const holdScopedConnection = makeHoldScopedConnection({
  identity: currentIdentity,
  open: openRequestScope,
  run: runInScope,
  log: info => logger.debug(info, "held scope ended"),
});
```

Create `artifacts/api-server/src/lib/heldReads.ts`:

```ts
/**
 * The routes that hold one row-level-security connection for the whole request
 * (middlewares/holdScopedConnection.ts), and why each is safe to. A route belongs here only if
 * its handler reads and then answers: no model call, no HTTP call, no push while it runs.
 * lib/__tests__/heldReads.test.ts pins this list to the routes that actually mount the middleware.
 */
export const HELD_READS: Record<string, string> = {
  "GET /messaging/threads":
    "the inbox: seven or eight reads in sequence, then an answer; attachment links are signed locally, with no network call",
};
```

- [ ] **Step 4: Export from `@workspace/db` and mount on the inbox**

In `lib/db/src/index.ts`, add `import type { Identity } from "./identity";` beside the other imports, and at the end of the file add:

```ts
export { runInScope, type RequestScope } from "./requestScope";

/**
 * A held scope for the request in flight (see requestScope.ts), or undefined while
 * enforcement is off. Only routes allow-listed in the API's lib/heldReads.ts may use it.
 */
export function openRequestScope(identity: Identity, holdTimeoutMs?: number) {
  return pool.openScope(identity, holdTimeoutMs);
}
```

In `artifacts/api-server/src/routes/messaging.ts`, after the line `} from "../middlewares/auth.js";` (line 64) add:

```ts
import { holdScopedConnection } from "../middlewares/holdScopedConnection.js";
```

and change `router.get("/messaging/threads", async (req: AuthenticatedRequest, res) => {` to:

```ts
router.get("/messaging/threads", holdScopedConnection, async (req: AuthenticatedRequest, res) => {
```

- [ ] **Step 5: Run the tests, the build and the differential test**

Run:
- `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/heldConnection.test.ts src/lib/__tests__/heldReads.test.ts` — expected: PASS (7 + 4).
- `pnpm run typecheck` — expected: no errors.
- `cd artifacts/api-server && pnpm build && pnpm test` — expected: PASS (the mount-order suite runs, not skips).
- `RLS_TEST_DATABASE_URL="$U" pnpm --filter @workspace/db run test` — expected: PASS, including `rlsDiff.test.ts` — it requests `/messaging/threads` as five identities with enforcement off and on, so the on-side now exercises the held path and must give identical statuses, bodies and pushes.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/index.ts artifacts/api-server/src/lib/heldConnection.ts artifacts/api-server/src/middlewares/holdScopedConnection.ts artifacts/api-server/src/lib/heldReads.ts artifacts/api-server/src/routes/messaging.ts artifacts/api-server/src/lib/__tests__/heldConnection.test.ts artifacts/api-server/src/lib/__tests__/heldReads.test.ts
git commit -m "api: hold one scoped connection for the inbox read (allow-listed, GET only)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YJ7dEJhS2tXoLTWmvXP34"
```

---

### Task 3: Benchmark the held path, and update the docs

**Files:**
- Modify: `lib/db/scripts/bench-rls.ts`, `docs/rls-rollout-checklist.md`, `STATUS.md`, `docs/status-log.md`

**Interfaces:**
- Consumes: `ScopedPool#openScope`, `runInScope`, `asUser` (Tasks 1–2).
- Produces: `bench:rls` prints an `off`, `on` and `held` column and a gate line for `held`.

- [ ] **Step 1: Replace `lib/db/scripts/bench-rls.ts`**

```ts
// How much slower is a statement with row-level security on? (docs/rls-rollout-checklist.md, C1)
//
//   BENCH_DATABASE_URL='<pooled string of the rehearsal project>' \
//     pnpm --filter @workspace/db run bench:rls
//
// Three modes, alternating so a slow minute hits all of them:
//   off   — enforcement off, the plain pool
//   on    — enforcement on, one scoped transaction per statement (every route not on the held list)
//   held  — enforcement on, one scoped read-only connection for the whole request (a held route)
//
// Read-only: it only runs `select count(*) ... where teacher_id = <random uuid>`, so it writes nothing.
// Point it at the REHEARSAL project (migrations applied, so the iqraa_app role exists), not production.
// Run it from the API's region if you can: the extra cost is round trips, so a faraway machine
// overstates it. Use the pooled endpoint, because that is what production uses.
import { randomUUID } from "node:crypto";
import { asUser } from "../src/identity.ts";
import { runInScope } from "../src/requestScope.ts";
import { ScopedPool } from "../src/scopedPool.ts";

const url = process.env.BENCH_DATABASE_URL;
if (!url) {
  console.error("Set BENCH_DATABASE_URL to the rehearsal project's pooled connection string.");
  process.exit(1);
}
if (!/-pooler\./.test(url)) {
  console.warn("Warning: the host does not contain -pooler; production uses the pooled endpoint.\n");
}

// The teacher inbox runs 7 statements in sequence (8 for a parent or student); BENCH_STATEMENTS overrides.
const STATEMENTS_PER_REQUEST = Number(process.env.BENCH_STATEMENTS ?? 8);
const REQUESTS = 40; // per round
const MODES = ["off", "on", "held"] as const;
type Mode = (typeof MODES)[number];
const ROUNDS = MODES.length * 2; // each mode twice
const identity = { userId: randomUUID(), role: "teacher" };

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

async function round(mode: Mode): Promise<number[]> {
  const pool = new ScopedPool({ connectionString: url, max: 4 }, mode !== "off");
  try {
    await pool.query("select 1"); // connect before the clock starts
    const perRequest: number[] = [];
    for (let r = 0; r < REQUESTS; r++) {
      const t0 = performance.now();
      const request = async () => {
        for (let n = 0; n < STATEMENTS_PER_REQUEST; n++) {
          await pool.query("select count(*) from students where teacher_id = $1", [identity.userId]);
        }
      };
      await asUser(identity, async () => {
        if (mode !== "held") return request();
        const scope = pool.openScope(identity)!;
        try {
          await runInScope(scope, request);
        } finally {
          await scope.end();
        }
      });
      perRequest.push(performance.now() - t0);
    }
    return perRequest;
  } finally {
    await pool.end();
  }
}

const times: Record<Mode, number[]> = { off: [], on: [], held: [] };
for (let i = 0; i < ROUNDS; i++) {
  const mode = MODES[i % MODES.length];
  const ms = await round(mode);
  times[mode].push(...ms);
  console.log(`round ${i + 1}: ${mode.padEnd(4)} median ${median(ms).toFixed(1)} ms per ${STATEMENTS_PER_REQUEST}-statement request`);
}

const f = (n: number) => n.toFixed(1).padStart(7);
console.log(`\n${STATEMENTS_PER_REQUEST} statements per request          off      on    held   on-off  held-off`);
for (const [label, pick] of [["median", median], ["p95   ", p95]] as const) {
  const [off, on, held] = MODES.map(m => pick(times[m]));
  console.log(`${label} / request ms        ${f(off)} ${f(on)} ${f(held)}  ${f(on - off)}   ${f(held - off)}`);
}
const heldAdded = p95(times.held) - p95(times.off);
const onAdded = p95(times.on) - p95(times.off);
console.log(`\nInbox gate (held route): added p95 per ${STATEMENTS_PER_REQUEST}-statement request <= 100 ms. This run: +${heldAdded.toFixed(1)} ms -> ${heldAdded <= 100 ? "WITHIN BUDGET" : "OVER BUDGET"}.`);
console.log(`Routes not on the held list pay the "on" column: +${onAdded.toFixed(1)} ms for ${STATEMENTS_PER_REQUEST} statements (about ${(onAdded / STATEMENTS_PER_REQUEST).toFixed(1)} ms per statement).`);
```

- [ ] **Step 2: Run it against a local database**

With the local Postgres from *Running the database tests locally* migrated:
`BENCH_DATABASE_URL="$U" pnpm --filter @workspace/db run bench:rls`
Expected: three round lines per mode pair and a table. On loopback `held` is within a millisecond or two of `off` and `on` is a few times `off`; the last two lines print `WITHIN BUDGET` and the per-statement figure for unlisted routes. (Loopback proves it runs, not the real cost — the owner runs it against the rehearsal project.)

- [ ] **Step 3: Update the docs**

In `docs/rls-rollout-checklist.md`, in step C1's failed-gate paragraph, after the sentence ending `…measured from the API's region.` add:

```
  **Mitigation built (2026-10-23, spec `docs/superpowers/specs/2026-10-23-rls-latency-request-scoped-connection-design.md`):**
  the inbox (`GET /messaging/threads`) holds one scoped, read-only connection per request, so it pays about
  three round trips instead of three per statement. Re-run `bench:rls` from Cloud Shell once this has shipped
  and read the `held` column; **the gate is the `held` p95 added ≤ +100 ms**. Every route not on
  `artifacts/api-server/src/lib/heldReads.ts` still pays the `on` column (about 22 ms per statement), so decide
  whether that is acceptable or which route to add next. After the flip, `LOG_LEVEL=debug` logs
  `held scope ended` with the statements and milliseconds each held request used.
```

In `STATUS.md`, in the row-level security item, replace `it must not be switched on until a mitigation passes the same benchmark.` with `a mitigation (one held read-only connection per request, inbox first; spec 2026-10-23) is built, and it must not be switched on until \`bench:rls\`'s \`held\` column passes the gate.` and keep the rest of the item.

Add this entry at the top of `docs/status-log.md`, directly under the header paragraph:

```markdown
## Row-level security: one scoped connection per request, inbox first — built, switched off, 2026-10-23

`ScopedPool#openScope` / `RequestScope` (`lib/db/src/requestScope.ts`) hold one `BEGIN READ ONLY` scoped
connection for a whole request; `middlewares/holdScopedConnection.ts` opens it after `authMiddleware` and closes it
from `res` `finish`/`close`; it is mounted only on `GET /messaging/threads`, pinned by `lib/heldReads.ts` and
`heldReads.test.ts`. A write error or the 5 s hold timeout ends the scope, and later statements fall back to the
per-statement scoped path. Enforcement off is unchanged.

**Verified:** the new `requestScope.test.ts` (identity isolation under interleaving, commit and release, read-only
refusal, timeout, no leak), `heldConnection.test.ts`, `heldReads.test.ts`, and the differential test, whose
enforcement-on side now takes the held path for the inbox reads. **Not verified:** the real saving — run
`bench:rls` from the API's region against the rehearsal project's pooled endpoint and read the `held` column
(gate: ≤ +100 ms p95). Routes not on the list, and every write, still pay about 22 ms per statement;
`RLS_ENFORCE` is still unset in production.
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm run typecheck` (no errors) and `RLS_TEST_DATABASE_URL="$U" pnpm --filter @workspace/db run test` (PASS).

```bash
git add lib/db/scripts/bench-rls.ts docs/rls-rollout-checklist.md STATUS.md docs/status-log.md
git commit -m "bench:rls measures the held path; record the mitigation in the checklist, STATUS and log

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012YJ7dEJhS2tXoLTWmvXP34"
```

---

## After the code: the owner's steps (not tasks for an agent)

1. Merge; `deploy.yml` ships it. Nothing changes in production: enforcement is off, and `openScope` returns `undefined`.
2. From Cloud Shell, against the rehearsal project's pooled string, run `pnpm --filter @workspace/db run bench:rls` and read the `held` p95. Within +100 ms → continue the checklist (D, E). Over → do not flip; the next step is a design question (more routes held, or the Frankfurt move), not a retry.
3. After a flip, watch `poolStats().waiting` and the `held scope ended` debug lines; roll back with `RLS_ENFORCE=off` if either looks wrong.

## Self-review

- **Spec coverage:** requestScope + ScopedPool integration (Task 1, spec items 1–2); READ ONLY and GET only (Task 1 `BEGIN READ ONLY`, Task 2 core refuses non-GET); end-of-scope from `finish`/`close` with the scope captured (Task 2 core, tests); hold timeout (Task 1, timeout test); allow-list with a pinning test (Task 2); serialisation is inherent to one client and documented in the `RequestScope` comment; measurement as it runs (the debug log line, Task 2) and the `held` benchmark mode (Task 3); testing list — isolation, ends on finish/close/error (finish and close in Task 2, error and timeout in Task 1), no leak (`idleCount == totalCount`), write refused, still scoped after the end, enforcement-off identical (`openScope` undefined test), differential run (Task 2 Step 5). The spec's "auth lookup" item was removed because that read is already on `systemDb`.
- **Placeholder scan:** none; every step shows its code or its exact text.
- **Type consistency:** `RequestScope(owner, acquire, beginSql, holdTimeoutMs)` is built only in `ScopedPool#openScope`; `openScope(identity, holdTimeoutMs?)`, `openRequestScope(identity, holdTimeoutMs?)`, `runInScope(scope, fn)`, `scope.end(failed?)`, `scope.stats()` and `ScopeEnded` are used under those names in Tasks 1–3; `HeldScope`/`HeldDeps` in `heldConnection.ts` match what `holdScopedConnection.ts` passes (`RequestScope` satisfies `HeldScope`).
