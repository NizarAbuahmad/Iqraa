/**
 * What this guards: the harness itself. A database is created and migrated for
 * this run, the real bundle boots against it, a minted token passes the real
 * auth lookup, and drop() leaves nothing behind. If any of these is wrong, every
 * DB-backed test built on it is meaningless.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { describeDb } from "../gate.ts";
import { setupTestDb, type TestDb } from "../testDb.ts";
import { startServer, type TestServer } from "../startServer.ts";
import { accessToken } from "../tokens.ts";

describeDb("DB-backed test harness", () => {
  let db: TestDb;
  let server: TestServer;
  let parentId: string;

  before(async () => {
    db = await setupTestDb();
    const r = await db.pool.query<{ id: string }>(
      `INSERT INTO users (first_name, last_name, role) VALUES ('Test', 'Parent', 'parent') RETURNING id`,
    );
    parentId = r.rows[0].id;
    server = await startServer({ databaseUrl: db.url });
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("creates a migrated, empty database for this run", async () => {
    assert.match(db.name, /^iqraa_test_[0-9a-f]{12}$/);
    const r = await db.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM schedule_slots`);
    assert.equal(r.rows[0].n, 0);
  });

  it("boots the real bundle against it", async () => {
    const res = await fetch(`${server.base}/healthz`);
    assert.equal(res.status, 200);
  });

  it("lets a minted token for a seeded user through the real auth lookup", async () => {
    const res = await fetch(`${server.base}/parent/schedule`, {
      headers: { Authorization: `Bearer ${accessToken(parentId)}` },
    });
    assert.equal(res.status, 200, server.logs().slice(-1500));
    assert.deepEqual(await res.json(), { children: [] });
  });

  it("refuses a token for a user that does not exist", async () => {
    const res = await fetch(`${server.base}/parent/schedule`, {
      headers: { Authorization: `Bearer ${accessToken("00000000-0000-0000-0000-000000000000")}` },
    });
    assert.equal(res.status, 401);
  });

  it("drop() leaves no database behind", async () => {
    const extra = await setupTestDb();
    const name = extra.name;
    await extra.drop();
    const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    try {
      const r = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
      assert.equal(r.rowCount, 0);
    } finally {
      await admin.end();
    }
  });
});
