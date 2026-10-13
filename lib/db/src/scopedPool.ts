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
