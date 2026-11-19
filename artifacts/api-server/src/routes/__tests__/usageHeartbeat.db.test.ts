/**
 * POST /usage/heartbeat, against a real database through the built bundle.
 *
 * What this guards: a beat counts one minute for the caller's own row (day, area, platform);
 * a second beat inside 50 s counts nothing — in any area or platform, the gap is per person — so a
 * looping client cannot inflate the numbers; a
 * beat after the gap counts again; an unknown area is stored as `other`; the platform comes
 * from X-Iqraa-Platform; the day is the Amman day; and an unauthenticated beat is refused.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import { call } from "../../test-support/http.ts";
import { ammanDay } from "../../lib/dailyActivity.ts";

describeDb("POST /usage/heartbeat", () => {
  let db: TestDb;
  let server: TestServer;
  let teacherId: string;

  const beat = async (userId: string, area: unknown, platform?: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken(userId)}`,
      "Content-Type": "application/json",
    };
    if (platform) headers["X-Iqraa-Platform"] = platform;
    const res = await fetch(`${server.base}/usage/heartbeat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ area }),
    });
    return res.status;
  };
  const rows = async (userId: string) =>
    (
      await db.pool.query<{ day: string; area: string; platform: string; minutes: number }>(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, area, platform, minutes
           FROM usage_minutes WHERE user_id = $1 ORDER BY area, platform`,
        [userId],
      )
    ).rows;

  before(async () => {
    db = await setupTestDb();
    server = await startServer({ databaseUrl: db.url });
    teacherId = (
      await db.pool.query<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified)
         VALUES ('Huda', 'Test', 'teacher', 'huda@example.test', true) RETURNING id`,
      )
    ).rows[0]!.id;
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("counts one minute on the Amman day, for the area and platform sent", async () => {
    assert.equal(await beat(teacherId, "gen-quiz", "android"), 204);
    assert.deepEqual(await rows(teacherId), [
      { day: ammanDay(new Date()), area: "gen-quiz", platform: "android", minutes: 1 },
    ]);
  });

  it("does not count a second beat inside 50 seconds", async () => {
    assert.equal(await beat(teacherId, "gen-quiz", "android"), 204);
    const [row] = await rows(teacherId);
    assert.equal(row!.minutes, 1);
  });

  it("counts again once the gap has passed", async () => {
    await db.pool.query(
      `UPDATE usage_minutes SET last_beat_at = now() - interval '2 minutes' WHERE user_id = $1`,
      [teacherId],
    );
    assert.equal(await beat(teacherId, "gen-quiz", "android"), 204);
    const [row] = await rows(teacherId);
    assert.equal(row!.minutes, 2);
  });

  it("counts nothing for another area or platform inside the gap — the cap is per person", async () => {
    assert.equal(await beat(teacherId, "chat", "android"), 204);
    assert.equal(await beat(teacherId, "gen-quiz", "web"), 204);
    assert.deepEqual(
      (await rows(teacherId)).map((r) => [r.area, r.platform, r.minutes]),
      [["gen-quiz", "android", 2]],
    );
  });

  it("stores an unknown area as `other` and a missing platform as `unknown`", async () => {
    await db.pool.query(
      `UPDATE usage_minutes SET last_beat_at = now() - interval '2 minutes' WHERE user_id = $1`,
      [teacherId],
    );
    assert.equal(await beat(teacherId, "/ai-tools/quiz?lesson=abc"), 204);
    const other = (await rows(teacherId)).find((r) => r.area === "other");
    assert.deepEqual(other && { area: other.area, platform: other.platform, minutes: other.minutes }, {
      area: "other",
      platform: "unknown",
      minutes: 1,
    });
  });

  it("refuses a beat with no session", async () => {
    const res = await call(server, "POST", "/usage/heartbeat", undefined, { area: "today" });
    assert.equal(res.status, 401);
  });
});
