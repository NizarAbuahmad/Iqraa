/**
 * Does the database actually have the tables — and columns — the schema
 * declares?
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
 * `information_schema.columns` looks names up in the catalog and touches no
 * data.
 *
 * Originally this only asked `to_regclass` whether each table *name* existed
 * — a table whose columns had drifted still reported `ok`. That gap was
 * flagged the day it shipped and then bit for real: on 2026-09-16 a PR added
 * `refresh_tokens.family_id` and `.rotated_at`, the PR body claimed
 * `schema-push: done`, and the columns were not actually in production. Every
 * sign-in path 500'd for 36 minutes — `storeRefreshToken` sits on `/login`,
 * `/google`, `/verify-email` and `/refresh` alike — and this check, run right
 * after the merge, would still have said `ok`. It now asks per column, not
 * just per table.
 *
 * What it still does NOT prove: a column's *type*, nullability, default, or
 * any index/foreign key is unchecked. A `text` column that should have been
 * `uuid`, or a dropped NOT NULL, reports `ok`. A green run means every
 * declared table and column exists by name, not that every one is shaped
 * right.
 *
 * (The 2026-08-19 outage was fixed the same afternoon; production verified
 * 24/24 on 2026-08-22. The 2026-09-16 one was fixed within the hour by hand,
 * which is what prompted the column check.)
 *
 * Exit codes: 0 everything present, 1 something missing, 2 could not check at
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
 * all-clear over the exact gap it was written to catch. Same reasoning extends
 * to columns: `COLUMN_TYPES` below is the list of drizzle column constructors
 * this schema currently imports. A column declared with a pg-core type not on
 * that list is invisible to the parser, so if a new type shows up, add it here
 * — the per-table self-check below exists for exactly that reason.
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

// drizzle-orm/pg-core column constructors this schema currently imports (see
// the header docstring for what happens when a new one shows up).
const COLUMN_TYPES = ["text", "uuid", "timestamp", "jsonb", "integer", "numeric", "boolean", "serial"];
const columnRe = new RegExp(`:\\s*(?:${COLUMN_TYPES.join("|")})\\(\\s*["']([^"']+)["']`, "g");
// Any column-shaped field at all ("name: identifier("), used only as the
// self-check below — it should always count the same fields as columnRe.
const anyColumnRe = /:\s*[a-zA-Z_]+\(/g;

/**
 * Parses each schema file for its tables and, per table, its column names.
 *
 * A table's columns live in the first `{ ... }` argument to
 * `pgTable(name, { ... }, t => [...])`. That object is found by brace-depth
 * balancing from the first `{` after the table name — cheap and correct here
 * because the only nested braces inside a column definition are matched pairs
 * like `.default({})`, which balance themselves regardless of what's between.
 */
function declaredSchema() {
  const byFile = new Map();
  let declaredTableCount = 0;
  let foundTableCount = 0;

  for (const file of fs.readdirSync(schemaDir).sort()) {
    if (!file.endsWith(".ts") || file === "index.ts") continue;
    const src = fs.readFileSync(path.join(schemaDir, file), "utf8");
    declaredTableCount += (src.match(/pgTable\(/g) ?? []).length;

    const tables = [];
    const tableRe = /pgTable\(\s*["']([^"']+)["']\s*,/g;
    let m;
    while ((m = tableRe.exec(src))) {
      const objStart = src.indexOf("{", tableRe.lastIndex);
      if (objStart === -1) continue;
      let depth = 0;
      let i = objStart;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) { i++; break; }
        }
      }
      const body = src.slice(objStart, i);

      const columns = [...body.matchAll(columnRe)].map(c => c[1]);
      const columnShaped = [...body.matchAll(anyColumnRe)].length;
      if (columnShaped !== columns.length) {
        console.error(
          `Parse mismatch in ${file}, table "${m[1]}": ${columnShaped} column-shaped ` +
          `field(s) but ${columns.length} matched a type in COLUMN_TYPES.\n` +
          "A column uses a pg-core constructor this script doesn't recognise, so it\n" +
          "would be silently skipped. Add it to COLUMN_TYPES in verify-schema.mjs\n" +
          "before trusting this check.",
        );
        process.exit(2);
      }

      tables.push({ table: m[1], columns });
    }

    foundTableCount += tables.length;
    if (tables.length) byFile.set(file, tables);
  }

  if (declaredTableCount !== foundTableCount) {
    console.error(
      `Parse mismatch: ${declaredTableCount} pgTable( calls but ${foundTableCount} names extracted.\n` +
      "A table is declared in a form this script cannot read, so it would be\n" +
      "silently skipped. Fix the regex in verify-schema.mjs before trusting it.",
    );
    process.exit(2);
  }
  return byFile;
}

const byFile = declaredSchema();
const allTables = [...byFile.values()].flat().map(t => t.table);

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

// One query for every declared table's columns, rather than one round trip
// per table — `information_schema.columns` simply returns nothing for a
// table that doesn't exist, which is what tells the two cases apart below.
const { rows } = await client.query(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY($1)`,
  [allTables],
);
await client.end();

const presentColumns = new Map();
for (const { table_name, column_name } of rows) {
  if (!presentColumns.has(table_name)) presentColumns.set(table_name, new Set());
  presentColumns.get(table_name).add(column_name);
}

console.log(`\nSchema check against ${dbUrl.host}${useSsl ? " (TLS)" : ""}`);

let tablesPresent = 0;
let tablesMissing = 0;
let columnsMissing = 0;

for (const [file, tables] of byFile) {
  const detail = [];
  for (const { table, columns } of tables) {
    const present = presentColumns.get(table);
    if (!present) {
      tablesMissing++;
      detail.push(`       missing table: ${table}`);
      continue;
    }
    tablesPresent++;
    for (const c of columns.filter(c => !present.has(c))) {
      columnsMissing++;
      detail.push(`       missing column: ${table}.${c}`);
    }
  }
  const mark = detail.length === 0 ? "ok  " : "MISS";
  console.log(`${mark} ${file.padEnd(22)} ${tables.length} table(s)  ${OWNS[file] ?? ""}`);
  for (const line of detail) console.log(line);
}

console.log(`\n${tablesPresent} of ${allTables.length} tables present`);

if (tablesMissing === 0 && columnsMissing === 0) {
  console.log("Every declared table and column exists.");
  process.exit(0);
}

const parts = [];
if (tablesMissing) parts.push(`${tablesMissing} table(s)`);
if (columnsMissing) parts.push(`${columnsMissing} column(s)`);
console.log(
  `\n${parts.join(" and ")} missing. The features listed beside them cannot work\n` +
  "against this database — expect 503s or 500s, not a clean failure.\n\n" +
  "Fix: for a whole missing table, `pnpm --filter @workspace/db run push`\n" +
  "(against this same DATABASE_URL). For one or two columns, a targeted\n" +
  "`ALTER TABLE ... ADD COLUMN` is safer — `push` reconciles the entire schema\n" +
  "and may propose dropping something this checkout doesn't know about yet.",
);
process.exit(1);
