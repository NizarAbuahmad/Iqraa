/**
 * Applies `lib/db/migrations` to DATABASE_URL.
 *
 *   pnpm --filter @workspace/db run migrate                 # repo-root .env
 *   pnpm --filter @workspace/db run migrate -- --from-env   # CI
 *   pnpm --filter @workspace/db run migrate -- --baseline   # once per old database
 *
 * Why this replaced `push` for production: `push` diffs the live database and
 * resolves drift however it likes — including by dropping columns — so it was
 * never safe to run unattended, and running it by hand is what kept leaving
 * production behind the code (2026-08-19, 2026-09-16, 2026-09-26, 2026-10-05).
 * A migration is plain SQL generated at PR time, reviewed in the diff, and
 * applied by deploy.yml before the API ships.
 *
 * `--baseline`: production predates migrations. Its tables already exist, so
 * running 0000_baseline.sql there would fail on the first CREATE TABLE. This
 * records 0000 as applied without running it, exactly as drizzle's migrator
 * would have (sha256 of the file + the journal's `when`), so the next real
 * migration is the first one executed. A database that has tables but no
 * history is refused by plain `migrate` rather than guessed at.
 *
 * Exit codes match verify-schema: 0 ok, 1 refused or a migration failed,
 * 2 could not run at all (no URL, unreachable database).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
const fromEnv = process.argv.includes("--from-env");
const baseline = process.argv.includes("--baseline");

if (!fromEnv) {
  // Same rule as push/verify-schema: the repo-root .env wins over a stale shell value.
  delete process.env.DATABASE_URL;
  loadEnvFile(path.join(workspaceRoot, ".env"));
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
} catch (err) {
  // The message names the host at most; never print the URL itself.
  console.error(`Could not connect: ${err.message}`);
  process.exit(2);
}

try {
  const { rows: [state] } = await client.query(`
    select to_regclass('drizzle.__drizzle_migrations') is not null as has_history,
           to_regclass('public.users') is not null as has_tables`);
  const applied = state.has_history
    ? (await client.query("select count(*)::int as n from drizzle.__drizzle_migrations")).rows[0].n
    : 0;

  if (baseline) {
    if (applied > 0) {
      console.log(`Already has ${applied} recorded migration(s); nothing to baseline.`);
    } else if (!state.has_tables) {
      console.error("This database is empty. Run `migrate` (without --baseline) to create it.");
      process.exitCode = 1;
    } else {
      const first = JSON.parse(fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8")).entries[0];
      const sql = fs.readFileSync(path.join(folder, `${first.tag}.sql`)).toString();
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      // Same DDL as drizzle-orm's pg dialect, so its migrator reads this row as its own.
      await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
      await client.query(
        'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
      );
      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
        [hash, first.when],
      );
      console.log(`Recorded ${first.tag} as applied without running it.`);
    }
  } else if (applied === 0 && state.has_tables) {
    console.error(
      "This database has tables but no migration history — it predates migrations.\n" +
        "Check it matches the schema (`verify-schema`), then run once:\n" +
        "  pnpm --filter @workspace/db run migrate -- --baseline\n" +
        "See docs/deploying.md, «Schema».",
    );
    process.exitCode = 1;
  } else {
    await migrate(drizzle(client), { migrationsFolder: folder });
    const { rows: [after] } = await client.query("select count(*)::int as n from drizzle.__drizzle_migrations");
    console.log(`Migrations up to date: ${after.n} applied (${after.n - applied} new).`);
  }
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
