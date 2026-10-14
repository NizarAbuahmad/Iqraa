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
