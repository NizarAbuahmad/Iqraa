/**
 * GET /admin/daily-activity, against a real database through the built bundle.
 *
 * What this guards: the daily active / new / returning split. A user who did two things in one day is
 * counted once; "new" means the account was created that same Amman day and "returning" an earlier
 * one; an AI generation with no user (cron, scripts) is not a person; a signup who has done nothing
 * shows in `signups` but not in `active`; and only a system admin may read it.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { ammanDay, ammanDayStart } from "../../lib/dailyActivity.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

describeDb("GET /admin/daily-activity", () => {
  let db: TestDb;
  let server: TestServer;
  let adminId: string;
  let teacherId: string;

  /** Noon, Amman time, `back` days before today — far from any day boundary. */
  const noon = (back: number): string => {
    const today = ammanDay(new Date());
    return new Date(ammanDayStart(today).getTime() - back * DAY_MS + 12 * 60 * 60 * 1000).toISOString();
  };
  const dayOf = (back: number): string => ammanDay(new Date(noon(back)));

  const addUser = async (name: string, role: string, createdAt: string): Promise<string> =>
    (
      await db.pool.query<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified, created_at)
         VALUES ($1, 'Test', $2, $3, true, $4) RETURNING id`,
        [name, role, `${name.toLowerCase()}@example.test`, createdAt],
      )
    ).rows[0]!.id;
  const generation = (userId: string | null, at: string) =>
    db.pool.query(`INSERT INTO ai_generations (user_id, kind, model, created_at) VALUES ($1, 'worksheet', 'm', $2)`, [
      userId,
      at,
    ]);
  const material = (userId: string, at: string) =>
    db.pool.query(`INSERT INTO saved_materials (user_id, type, title, created_at) VALUES ($1, 'worksheet', 't', $2)`, [
      userId,
      at,
    ]);

  before(async () => {
    db = await setupTestDb();
    server = await startServer({ databaseUrl: db.url });
    adminId = await addUser("Admin", "system_admin", noon(60));
    teacherId = await addUser("Plain", "teacher", noon(60));

    // A: an old account, active two days ago and today — twice today, through both sources.
    const a = await addUser("Ayla", "teacher", noon(30));
    await generation(a, noon(2));
    await generation(a, noon(0));
    await material(a, noon(0));
    // B: created yesterday and active yesterday (new), then again today (returning).
    const b = await addUser("Basel", "teacher", noon(1));
    await material(b, noon(1));
    await generation(b, noon(0));
    // C: signed up today and has done nothing.
    await addUser("Carmen", "teacher", noon(0));
    // A generation with no user must not be counted as a person.
    await generation(null, noon(0));
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("counts each person once a day and splits new from returning", async () => {
    const res = await call(server, "GET", "/admin/daily-activity?days=3", adminId);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.timezone, "Asia/Amman");
    assert.deepEqual(res.json.days, [
      { day: dayOf(2), active: 1, new: 0, returning: 1, signups: 0 },
      { day: dayOf(1), active: 1, new: 1, returning: 0, signups: 1 },
      { day: dayOf(0), active: 2, new: 0, returning: 2, signups: 1 },
    ]);
  });

  it("defaults to 30 days and zero-fills days with no activity", async () => {
    const res = await call(server, "GET", "/admin/daily-activity", adminId);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.days.length, 30);
    assert.equal(res.json.days[0].active, 0);
  });

  it("refuses a bad window", async () => {
    for (const days of ["0", "91", "abc"]) {
      const res = await call(server, "GET", `/admin/daily-activity?days=${days}`, adminId);
      assert.equal(res.status, 400, `days=${days}`);
    }
  });

  it("is for a system admin only", async () => {
    assert.equal((await call(server, "GET", "/admin/daily-activity")).status, 401);
    assert.equal((await call(server, "GET", "/admin/daily-activity", teacherId)).status, 403);
  });
});
