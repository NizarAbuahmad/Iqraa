/**
 * The rules that keep DB-backed tests away from anything real. Pure, so they
 * are unit-tested: these tests CREATE and DROP databases.
 */
import { randomBytes } from "node:crypto";

export const TEST_DB_PREFIX = "iqraa_test_";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

type Env = Record<string, string | undefined>;

/** Parses the admin URL and refuses anything that is not a local Postgres. */
export function assertSafeAdminUrl(raw: string, env: Env = process.env): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`TEST_DATABASE_URL must be a postgres:// URL, got ${url.protocol}`);
  }
  if (!LOCAL_HOSTS.has(url.hostname) && env.ALLOW_REMOTE_TEST_DB !== "1") {
    throw new Error(
      `Refusing to run DB tests against non-local host ${url.hostname} (set ALLOW_REMOTE_TEST_DB=1 to override)`,
    );
  }
  // pg honours ?host= and ?hostaddr= OVER the URL hostname, so a local-looking
  // host with a query can still connect elsewhere (or to a Cloud SQL socket).
  if (url.search !== "" && env.ALLOW_REMOTE_TEST_DB !== "1") {
    throw new Error(
      "Refusing a TEST_DATABASE_URL with query parameters: a ?host= or ?hostaddr= would override the host check (set ALLOW_REMOTE_TEST_DB=1 to override)",
    );
  }
  return url;
}

export function newTestDbName(rand: () => string = () => randomBytes(6).toString("hex")): string {
  return `${TEST_DB_PREFIX}${rand()}`;
}

/** The only names the harness will create or drop. */
export function isTestDbName(name: string): boolean {
  return /^iqraa_test_[0-9a-f]{12}$/.test(name);
}

export function urlForDatabase(admin: URL, dbName: string): string {
  const u = new URL(admin.toString());
  u.pathname = `/${dbName}`;
  return u.toString();
}

/** Why DB-backed tests cannot run here, or null when they can. */
export function dbTestsSkipReason(env: Env = process.env, bundleExists = true): string | null {
  if (!env.TEST_DATABASE_URL) {
    return "set TEST_DATABASE_URL to run DB-backed tests (see LOCAL_SETUP.md, «DB-backed API tests»)";
  }
  if (!bundleExists) {
    return "run `pnpm build` first — DB-backed tests boot dist/index.mjs";
  }
  return null;
}

/** CI sets REQUIRE_DB_TESTS=true so a missing database fails instead of skipping. */
export function dbTestsRequired(env: Env = process.env): boolean {
  return env.REQUIRE_DB_TESTS === "true";
}
