// lib/db/src/scopedPool.ts
import pg from "pg";
import { assertValidIdentity, currentIdentity, type Identity } from "./identity.ts";
import { currentScope, RequestScope, ScopeEnded } from "./requestScope.ts";

const BEGIN_RE = /^\s*begin\b/i;

/**
 * The statements that make a transaction act as the current request's user.
 * Both settings are always written, so nothing an earlier borrower left in the
 * connection's session state can survive into this transaction. No identity
 * still switches role — it sets both to '' (app_uid() reads '' as NULL), so
 * every policy evaluates false and the query sees nothing (fail closed).
 */
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

/**
 * A pg.Pool whose every statement runs as `iqraa_app` with the current
 * request's identity, so Postgres row-level security applies.
 *
 * - `query()` (what Drizzle calls outside a transaction): one short
 *   transaction per statement — BEGIN + scope, the statement, COMMIT.
 * - `connect()` (what Drizzle calls for `db.transaction`): the returned client
 *   runs the scope statements right after Drizzle's own BEGIN.
 * - With a RequestScope open for the request (`openScope`), `query()` runs on that
 *   one held connection instead; `connect()` (db.transaction) is unaffected.
 *
 * Both are SET LOCAL / set_config(..., true), so nothing outlives the
 * transaction — safe behind a transaction-mode pooler, and safe for the next
 * borrower of the connection.
 *
 * With `enforce` false it is exactly a pg.Pool.
 *
 * Two fail-open edges, both unused in this repo (Drizzle never does either):
 * - A call that passes a callback (`pool.query(sql, cb)`, `pool.connect(cb)`,
 *   `client.query(sql, cb)`) is NOT scoped, even with enforcement on.
 * - On the `connect()` path scoping starts at the caller's `BEGIN`, so a client
 *   that is checked out and queried without a transaction runs unscoped, as the
 *   owner.
 *
 * And one trap on the identity side: `res.on("close")` and any other callback
 * fired outside the request's async chain do not inherit the identity store, so
 * a statement issued from one runs with no identity and sees nothing. Capture
 * what you need before registering it, or use `systemDb`.
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
    // scopeSqlFor writes these into a simple query with no bind parameters: do not trust the caller.
    assertValidIdentity(identity);
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
    let released = false;

    (client as any).query = async (...a: any[]) => {
      if (typeof a[a.length - 1] === "function") return originalQuery(...a);
      const result = await originalQuery(...a);
      const first = a[0];
      const text = typeof first === "string" ? first : first?.text;
      if (typeof text === "string" && BEGIN_RE.test(text)) {
        try {
          await originalQuery(scope);
        } catch (err) {
          // Drizzle runs `begin` outside its try/finally, so it will never release
          // a client whose scope failed: the open transaction would leak the
          // connection. Destroy it here and surface the original error.
          client.release(true);
          throw err;
        }
      }
      return result;
    };
    client.release = (err?: Error | boolean) => {
      if (released) return; // idempotent: a caller's own finally must not double-release
      released = true;
      delete (client as any).query; // back to the prototype method for the next borrower
      return poolRelease.call(client, err);
    };
    return client;
  }
}
