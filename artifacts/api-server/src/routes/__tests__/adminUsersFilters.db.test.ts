/**
 * GET /admin/users `channel` and `cohort`, against a real database through the built bundle.
 *
 * What this guards: `channel=app` is either store platform, `web` is web and `unknown` is a null
 * platform; `cohort=new` is made inside the range; `cohort=returning` is made BEFORE the range and
 * back inside it — by a sign-in, an AI generation or a saved material, each enough on its own — and
 * an old account that did nothing in the range, or did something only after it, is not returning.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Noon UTC, `back` days before today — far from any day boundary. */
const noon = (back: number): string => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  return new Date(d.getTime() - back * DAY_MS).toISOString();
};
const day = (back: number): string => noon(back).slice(0, 10);

describeDb("GET /admin/users channel and cohort filters", () => {
  let db: TestDb;
  let server: TestServer;
  let adminId: string;

  const addUser = async (name: string, createdAt: string, platform: string | null, lastLogin: string | null = null) =>
    (
      await db.pool.query<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified, created_at, signup_platform, last_login)
         VALUES ($1, 'Filter', 'teacher', $2, true, $3, $4, $5) RETURNING id`,
        [name, `${name.toLowerCase()}@example.test`, createdAt, platform, lastLogin],
      )
    ).rows[0]!.id;

  before(async () => {
    db = await setupTestDb();
    server = await startServer({ databaseUrl: db.url });
    adminId = await addUser("Admin", noon(90), null);
    await db.pool.query(`UPDATE users SET role = 'system_admin' WHERE id = $1`, [adminId]);

    // New inside the last 7 days, one per channel.
    await addUser("Webnew", noon(1), "web");
    await addUser("Andnew", noon(2), "android");
    await addUser("Iosnew", noon(3), "ios");
    // Old accounts (made 40 days ago) — returning only if back in the last 7 days.
    await addUser("Login", noon(40), "android", noon(2)); // signed in
    const gen = await addUser("Gen", noon(40), "web");
    await db.pool.query(`INSERT INTO ai_generations (user_id, kind, model, created_at) VALUES ($1, 'quiz', 'm', $2)`, [gen, noon(1)]);
    const mat = await addUser("Mat", noon(40), null);
    await db.pool.query(`INSERT INTO saved_materials (user_id, type, title, created_at) VALUES ($1, 'quiz', 't', $2)`, [mat, noon(4)]);
    await addUser("Quiet", noon(40), "web", noon(20)); // last seen before the window
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  const names = async (query: string): Promise<string[]> => {
    const res = await call(server, "GET", `/admin/users?q=&${query}`, adminId);
    assert.equal(res.status, 200, res.text);
    const body = res.json as { items: { firstName: string }[]; total: number };
    assert.equal(body.total, body.items.length);
    return body.items.map((u) => u.firstName).filter((n) => n !== "Admin").sort();
  };

  it("filters by channel", async () => {
    assert.deepEqual(await names("channel=web"), ["Gen", "Quiet", "Webnew"]);
    assert.deepEqual(await names("channel=app"), ["Andnew", "Iosnew", "Login"]);
    assert.deepEqual(await names("channel=unknown"), ["Mat"]);
  });

  it("new is made inside the range, and combines with the channel", async () => {
    assert.deepEqual(await names(`from=${day(6)}&cohort=new`), ["Andnew", "Iosnew", "Webnew"]);
    assert.deepEqual(await names(`from=${day(6)}&cohort=new&channel=app`), ["Andnew", "Iosnew"]);
  });

  it("returning is made before the range and back in it by a sign-in, a generation or a save", async () => {
    assert.deepEqual(await names(`from=${day(6)}&cohort=returning`), ["Gen", "Login", "Mat"]);
    assert.deepEqual(await names(`from=${day(6)}&cohort=returning&channel=web`), ["Gen"]);
  });

  it("returning respects the end day too", async () => {
    // Only the last 3 days: Login (day 2) and Gen (day 1) came back; Mat saved on day 4.
    assert.deepEqual(await names(`from=${day(3)}&cohort=returning`), ["Gen", "Login"]);
    // Days 6..3: Mat only.
    assert.deepEqual(await names(`from=${day(6)}&to=${day(3)}&cohort=returning`), ["Mat"]);
  });

  it("refuses returning with no start day, and an unknown channel", async () => {
    assert.equal((await call(server, "GET", "/admin/users?cohort=returning", adminId)).status, 400);
    assert.equal((await call(server, "GET", "/admin/users?channel=android", adminId)).status, 400);
  });
});
