/**
 * Runs raw SQL from the command line against whatever DATABASE_URL is in the
 * environment (set DATABASE_URL before calling, or use --from-env with the
 * same flag semantics as verify-schema.mjs).
 *
 * Usage:
 *   DATABASE_URL=<url> node lib/db/scripts/run-sql.mjs "ALTER TABLE ..."
 *
 * Exits 0 on success, 1 on failure.
 */
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

const fromEnv = process.argv.includes("--from-env");
if (!fromEnv) {
  delete process.env.DATABASE_URL;
  loadEnvFile(path.join(workspaceRoot, ".env"));
}

const sql = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
if (!sql) {
  console.error("Usage: node run-sql.mjs [--from-env] \"<SQL>\"");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const res = await client.query(sql);
  console.log("OK —", res.command ?? "done", res.rowCount != null ? `(${res.rowCount} rows)` : "");
} catch (err) {
  console.error("SQL error:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
