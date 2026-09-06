/**
 * Does the database actually have the tables the schema declares?
 *
 * Nothing deploys the schema. `push` runs by hand, so a release that adds a
 * table and skips it produces endpoints that answer 503 against a database
 * missing it. On 2026-08-19 that had gone unnoticed long enough that 14 of 24
 * tables were absent from production — including every table behind the
 * evaluations subsystem, a pilot feature that had never once been able to work
 * there. Nobody was lying; there was simply no way to ask the question.
 *
 * This is that question, as one command:
 *
 *   pnpm --filter @workspace/db run verify-schema
 *
 * Reads DATABASE_URL the same way `push` does, so pointing it at production
 * means putting the production URL in the repo-root .env — the same deliberate,
 * manual step. Pass `--from-env` to read it from the environment instead, which
 * is how the scheduled production check runs it on a GitHub runner. Read-only:
 * `to_regclass` looks a name up in the catalog and touches no data.
 *
 * What it does NOT prove: `to_regclass` asks whether a table *name* exists.
 * A table whose columns have drifted — created by an early migration, never
 * updated by a later one — still reports `ok`. A green run means every table
 * is present, not that every table is correct.
 *
 * (That 2026-08-19 outage was fixed the same afternoon; production verified
 * 24/24 on 2026-08-22. The manual-push gap that caused it is still open,
 * which is why this script exists.)
 *
 * Exit codes: 0 every table present, 1 tables missing, 2 could not check at
 * all (unreadable schema, no `pg`, unreachable database). The split matters to
 * the scheduled production check — "could not connect" must never be read as
 * "the schema is broken", or the alert stops meaning anything.
 *
 * Why the schema is parsed rather than imported: `src/schema/index.ts` re-exports
 * with extensionless paths, which resolve only through esbuild — importing it
 * from plain node fails. Parsing keeps this script dependency-free, at the cost
 * of relying on a regex, so the parse is checked against a raw count of
 * `pgTable(` occurrences and refuses to run if the two disagree. A verifier that
 * quietly checks fewer tables than exist is worse than no verifier: it reports
 * all-clear over the exact gap it was written to catch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = path.join(dbDir, "src", "schema");

/*
 * Where DATABASE_URL comes from.
 *
 * By default the repo-root .env wins over whatever is in the shell — the same
 * rule push.mjs follows, because a stale exported URL pointing at a different
 * database is the one mistake that makes this script lie about which database
 * it checked.
 *
 * `--from-env` is the exception, for CI. A GitHub runner has no .env and
 * writing one just to hold a secret puts the credential in a file for no
 * reason, so the flag says "the environment is the source, on purpose". It is
 * opt-in precisely so that a stale local shell value can never reach the check
 * silently — you have to ask for it.
 */
const fromEnv = process.argv.includes("--from-env");
if (!fromEnv) {
  delete process.env.DATABASE_URL;
  loadEnvFile(path.join(workspaceRoot, ".env"));
}

if (!process.env.DATABASE_URL) {
  console.error(
    fromEnv
      ? "DATABASE_URL is not set in the environment, and --from-env says not to read .env."
      : "DATABASE_URL is not set. Add it to the repo-root .env (see .env.example), then retry.",
  );
  // 2, not 1: nothing was checked. Exit 1 is reserved for a completed check
  // that found tables missing, so an alert on it always means the schema.
  process.exit(2);
}

/** What goes dark when a file's tables are absent — so output needs no lookup. */
const OWNS = {
  "users.ts": "sign-in, sessions, password reset",
  "conversations.ts": "chat history",
  "messages.ts": "chat history",
  "savedMaterials.ts": "the workspace / saved materials",
  "students.ts": "classes and rosters",
  "assessmentConfig.ts": "competencies, level scales, rubrics",
  "evaluations.ts": "evaluation authoring (التقييمات)",
  "attempts.ts": "student attempts, grading, results",
  "feedback.ts": "in-app feedback",
  "aiGenerations.ts": "AI spend total + cache-hit measurement",
};

function declaredTables() {
  const byFile = new Map();
  let declared = 0;
  let found = 0;

  for (const file of fs.readdirSync(schemaDir).sort()) {
    if (!file.endsWith(".ts") || file === "index.ts") continue;
    const src = fs.readFileSync(path.join(schemaDir, file), "utf8");
    declared += (src.match(/pgTable\(/g) ?? []).length;
    const names = [...src.matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    found += names.length;
    if (names.length) byFile.set(file, names);
  }

  if (declared !== found) {
    console.error(
      `Parse mismatch: ${declared} pgTable( calls but ${found} names extracted.\n` +
      "A table is declared in a form this script cannot read, so it would be\n" +
      "silently skipped. Fix the regex in verify-schema.mjs before trusting it.",
    );
    process.exit(2);
  }
  return byFile;
}

const byFile = declaredTables();
const all = [...byFile.values()].flat();

// Imported here, not at module scope: a static import fails with a bare
// ERR_MODULE_NOT_FOUND before the DATABASE_URL check above ever runs, so
// someone who simply has not installed yet gets a stack trace instead of the
// one-line reason.
let pg;
try {
  ({ default: pg } = await import("pg"));
} catch {
  console.error("Cannot load `pg`. Run `pnpm install` at the repo root, then retry.");
  process.exit(2);
}

/*
 * TLS is decided by the URL, not hardcoded. Forcing it on made the script
 * unusable against a plain local Postgres — "The server does not support SSL
 * connections" — which is the first database most people would point it at.
 * Forcing it off would fail against Neon, which requires it. So: off for
 * loopback or an explicit sslmode=disable, on otherwise, and permissive about
 * the chain because managed providers' roots are not in every local trust store.
 */
const dbUrl = new URL(process.env.DATABASE_URL);
const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(dbUrl.hostname);
const sslMode = dbUrl.searchParams.get("sslmode");
const useSsl = sslMode ? sslMode !== "disable" : !isLoopback;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

/*
 * A database that cannot be reached is not a database with missing tables.
 *
 * Unhandled, a refused connection exits non-zero with a stack trace — which,
 * to the scheduled production check, is indistinguishable from the schema gap
 * it exists to find. Exit 2 keeps "could not check" separate from exit 1's
 * "checked, and tables are missing", so a flaky night does not read as an
 * outage and an outage is never dismissed as a flaky night.
 */
try {
  await client.connect();
} catch (err) {
  console.error(
    `Cannot connect to ${dbUrl.host}${useSsl ? " (TLS)" : ""}: ${err instanceof Error ? err.message : String(err)}\n` +
    "Nothing was checked — this says nothing about whether the schema is correct.",
  );
  process.exit(2);
}

const present = new Set();
for (const table of all) {
  // to_regclass returns null rather than throwing for an absent relation.
  const { rows } = await client.query("SELECT to_regclass($1) AS oid", [`public.${table}`]);
  if (rows[0]?.oid) present.add(table);
}
await client.end();

console.log(`\nSchema check against ${dbUrl.host}${useSsl ? " (TLS)" : ""}`);
console.log(`${present.size} of ${all.length} tables present\n`);

let missingTotal = 0;
for (const [file, tables] of byFile) {
  const missing = tables.filter(t => !present.has(t));
  missingTotal += missing.length;
  const mark = missing.length === 0 ? "ok  " : "MISS";
  console.log(`${mark} ${file.padEnd(22)} ${tables.length - missing.length}/${tables.length}  ${OWNS[file] ?? ""}`);
  for (const t of missing) console.log(`       missing: ${t}`);
}

if (missingTotal === 0) {
  console.log("\nEvery declared table exists.");
  process.exit(0);
}

console.log(
  `\n${missingTotal} table(s) missing. The features listed beside them cannot work\n` +
  "against this database — their endpoints answer 503.\n\n" +
  "Fix: pnpm --filter @workspace/db run push   (against this same DATABASE_URL)",
);
process.exit(1);
