import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
});

// An idle client can die underneath the pool (Neon restarts or suspends compute,
// the pooler recycles a socket). pg re-emits that on the pool, and an 'error'
// event with no listener is thrown — it would take the whole process down with
// every in-flight request. The pool discards the dead client itself; the next
// query just opens a fresh one, so logging is all that's needed.
pool.on("error", (err) => {
  console.error(JSON.stringify({ level: "error", msg: "idle pg client error", err: err.message }));
});
export const db = drizzle(pool, { schema });

export * from "./schema";
