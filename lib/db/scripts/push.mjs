import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(workspaceRoot, ".env");
// Always prefer the repo-root .env for DATABASE_URL (shell may have a stale value).
delete process.env.DATABASE_URL;
loadEnvFile(envFile);

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Add it to the repo-root .env (see .env.example), then retry.",
  );
  process.exit(1);
}

const force = process.argv.includes("--force");
const args = ["drizzle-kit", "push", "--config", "./drizzle.config.ts"];
if (force) args.push("--force");

const isWin = process.platform === "win32";
const result = spawnSync("pnpm", ["exec", ...args], {
  cwd: dbDir,
  env: process.env,
  stdio: "inherit",
  shell: isWin,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  console.error(
    "\nDatabase push failed. Common fixes:\n" +
      "  1) Wrong password in root .env DATABASE_URL (postgres user password)\n" +
      "  2) Database missing — create it:\n" +
      '     psql -U postgres -h localhost -c "CREATE DATABASE iqraa;"\n' +
      "  3) Postgres service not running\n",
  );
}

process.exit(result.status ?? 1);
