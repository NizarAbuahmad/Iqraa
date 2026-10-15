/**
 * A throwaway, migrated database for one test file.
 *
 * Creates `iqraa_test_<hex>` on the server named by TEST_DATABASE_URL, applies
 * the repo's own migrations to it (the schema's source of truth — never `push`),
 * and hands back a pool plus a drop(). The admin database is only ever used to
 * CREATE and DROP databases whose names pass isTestDbName.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import type { Pool } from "pg";

import { migrateScript } from "./env.ts";
import { assertSafeAdminUrl, isTestDbName, newTestDbName, urlForDatabase } from "./testDbRules.ts";

export interface TestDb {
  name: string;
  url: string;
  pool: Pool;
  /** Closes the pool and drops the database. Safe to call once. */
  drop(): Promise<void>;
}

/** Arbitrary constant; any process that takes it waits for the one migrating. */
const MIGRATE_LOCK = 7_301_123;

async function withAdmin<T>(admin: URL, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: admin.toString(), max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function dropDatabase(admin: URL, name: string): Promise<void> {
  if (!isTestDbName(name)) throw new Error(`refusing to drop ${name}: not a test database name`);
  await withAdmin(admin, p => p.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
}

export async function setupTestDb(adminUrlRaw: string | undefined = process.env.TEST_DATABASE_URL): Promise<TestDb> {
  if (!adminUrlRaw) throw new Error("TEST_DATABASE_URL is not set");
  const admin = assertSafeAdminUrl(adminUrlRaw);
  const name = newTestDbName();
  if (!isTestDbName(name)) throw new Error(`generated an invalid test database name: ${name}`);

  const url = urlForDatabase(admin, name);

  // One database is created and migrated at a time, across every test file (they run as
  // separate processes against one server). Migration 0008 creates the cluster-wide role
  // `iqraa_app` with an "IF NOT EXISTS" check that two concurrent migrations both pass —
  // the second CREATE ROLE then fails — and it grants memberships and defaults that are
  // also cluster-wide. An advisory lock taken on the admin database serialises them.
  const failed = await withAdmin(admin, async p => {
    await p.query("SELECT pg_advisory_lock($1)", [MIGRATE_LOCK]);
    try {
      // The name is generated and validated above, so interpolating it is safe.
      await p.query(`CREATE DATABASE ${name}`);
      // --from-env is mandatory: without it the script deletes DATABASE_URL and
      // reads the repo-root .env, which could point somewhere that matters.
      const res = spawnSync(process.execPath, [migrateScript, "--from-env"], {
        env: { ...process.env, DATABASE_URL: url },
        encoding: "utf8",
      });
      return res.status === 0 ? null : `migrations failed (exit ${res.status}):\n${res.stdout}\n${res.stderr}`;
    } finally {
      await p.query("SELECT pg_advisory_unlock($1)", [MIGRATE_LOCK]);
    }
  });
  if (failed) {
    await dropDatabase(admin, name);
    throw new Error(failed);
  }

  const pool = new pg.Pool({ connectionString: url, max: 4 });
  return {
    name,
    url,
    pool,
    async drop() {
      await pool.end();
      await dropDatabase(admin, name);
    },
  };
}
