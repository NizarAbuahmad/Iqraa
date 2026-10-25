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

  /** The ScopedPool that made this scope; another pool must not run statements on it. */
  readonly owner: object;
  private readonly acquire: () => Promise<pg.PoolClient>;
  private readonly beginSql: string;
  private readonly holdTimeoutMs: number;

  // Explicit fields, not parameter properties: node --test strips types and cannot run those.
  constructor(
    owner: object,
    acquire: () => Promise<pg.PoolClient>,
    beginSql: string,
    holdTimeoutMs: number,
  ) {
    this.owner = owner;
    this.acquire = acquire;
    this.beginSql = beginSql;
    this.holdTimeoutMs = holdTimeoutMs;
  }

  async query(args: any[]): Promise<pg.QueryResult> {
    if (this.ended) throw new ScopeEnded();
    let client: pg.PoolClient;
    try {
      client = await this.open();
    } catch {
      // No connection, or its BEGIN failed (a stale pooled connection, say): the per-statement
      // path takes a fresh one, so end the scope and let ScopedPool retry there.
      await this.end(true);
      throw new ScopeEnded();
    }
    if (this.ended) throw new ScopeEnded(); // ended while we waited for the connection
    this.statements++;
    try {
      return await (client.query as any).apply(client, args);
    } catch (err) {
      // If the scope had already ended when this error arrived, this statement was queued
      // behind one that failed (or behind the timeout's rollback) and died in the aborted
      // transaction: its error says nothing about the statement itself. Held statements are
      // read-only, so ScopedPool can safely run it again per-statement. The statement that
      // failed first still surfaces its own error.
      const endedBefore = this.ended;
      await this.end(true); // the transaction is aborted; later statements go per-statement
      if (endedBefore) throw new ScopeEnded();
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
