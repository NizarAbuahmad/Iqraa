/**
 * GET /admin/insights and /admin/insights/users/:id, against a real database through the built bundle.
 *
 * What this guards: only a system admin may read them (a school admin and a teacher get 403);
 * minutes add up per area; a person active on two days is "returning" and one active once is not;
 * the frequent-users list is ordered by active days, then minutes, and carries what they teach,
 * their governorate and top areas; feature counts come from the generation and saved-material
 * tables; a demographic group of one or two teachers is hidden; and the per-user page answers
 * 404 for an unknown id and 400 for a malformed one.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { addDays, ammanDay, ammanDayStart } from "../../lib/dailyActivity.ts";

describeDb("GET /admin/insights", () => {
  let db: TestDb;
  let server: TestServer;
  let adminId: string;
  let schoolAdminId: string;
  let ayla: string;
  let basel: string;
  let carmen: string;
  let dina: string;

  const today = ammanDay(new Date());
  const day = (back: number) => addDays(today, -back);
  /** Noon Amman time, `back` days ago — far from a day boundary. */
  const noon = (back: number) => new Date(ammanDayStart(day(back)).getTime() + 12 * 3600_000).toISOString();

  const addUser = async (name: string, role: string, extra: Record<string, unknown> = {}): Promise<string> => {
    const cols = ["first_name", "last_name", "role", "email", "email_verified", "created_at", ...Object.keys(extra)];
    // grade_ids / subject_ids are jsonb: an array goes as JSON text.
    const vals = [
      name,
      "Test",
      role,
      `${name.toLowerCase()}@example.test`,
      true,
      noon(60),
      ...Object.values(extra).map((v) => (Array.isArray(v) ? JSON.stringify(v) : v)),
    ];
    const ph = vals.map((_, i) => `$${i + 1}`).join(", ");
    return (await db.pool.query<{ id: string }>(`INSERT INTO users (${cols.join(", ")}) VALUES (${ph}) RETURNING id`, vals))
      .rows[0]!.id;
  };
  const minutes = (userId: string, back: number, area: string, n: number) =>
    db.pool.query(
      `INSERT INTO usage_minutes (user_id, day, area, platform, minutes) VALUES ($1, $2, $3, 'web', $4)`,
      [userId, day(back), area, n],
    );
  const generation = (userId: string, back: number, kind: string) =>
    db.pool.query(`INSERT INTO ai_generations (user_id, kind, model, created_at) VALUES ($1, $2, 'm', $3)`, [
      userId,
      kind,
      noon(back),
    ]);

  before(async () => {
    db = await setupTestDb();
    server = await startServer({ databaseUrl: db.url });
    adminId = await addUser("Admin", "system_admin");
    schoolAdminId = await addUser("Principal", "school_admin");

    // Ayla: three active days, 40 minutes, most in the quiz generator.
    ayla = await addUser("Ayla", "teacher", {
      governorate: "amman",
      gender: "female",
      subject_ids: ["mathematics"],
      grade_ids: ["grade-10"],
    });
    await minutes(ayla, 0, "gen-quiz", 30);
    await minutes(ayla, 1, "classes", 10);
    await generation(ayla, 2, "quiz");
    // Basel: two active days, 5 minutes.
    basel = await addUser("Basel", "teacher", { governorate: "amman", gender: "male" });
    await minutes(basel, 0, "chat", 5);
    await generation(basel, 3, "worksheet");
    // Carmen: one active day (a saved material only).
    carmen = await addUser("Carmen", "teacher", { governorate: "amman" });
    await db.pool.query(`INSERT INTO saved_materials (user_id, type, title, created_at) VALUES ($1, 'worksheet', 't', $2)`, [
      carmen,
      noon(1),
    ]);
    // Dina: a student, the most active of all — counted in the totals, never named.
    dina = await addUser("Dina", "student");
    for (const back of [0, 1, 2, 3, 4]) await minutes(dina, back, "school", 1);
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("is for a system admin only", async () => {
    for (const who of [schoolAdminId, ayla]) {
      assert.equal((await call(server, "GET", "/admin/insights", who)).status, 403);
      assert.equal((await call(server, "GET", `/admin/insights/users/${ayla}`, who)).status, 403);
    }
    assert.equal((await call(server, "GET", "/admin/insights")).status, 401);
  });

  it("refuses a period other than 7, 30 or 90", async () => {
    assert.equal((await call(server, "GET", "/admin/insights?days=14", adminId)).status, 400);
  });

  it("adds up time per area and splits returning from one-day users", async () => {
    const res = await call(server, "GET", "/admin/insights?days=7", adminId);
    assert.equal(res.status, 200, res.text);
    const { time, retention, features } = res.json;
    assert.equal(time.totalMinutes, 50);
    assert.deepEqual(time.byArea[0], { area: "gen-quiz", minutes: 30, users: 1 });
    assert.equal(time.byDay.length, 7);
    assert.equal(time.byDay.at(-1).minutes, 36);
    // Ayla, Basel, Carmen and the student Dina; returning: Ayla, Basel, Dina.
    assert.equal(retention.active, 4);
    assert.equal(retention.returning, 3);
    assert.deepEqual(
      features.generations.map((g: { kind: string; count: number }) => [g.kind, g.count]).sort(),
      [["quiz", 1], ["worksheet", 1]],
    );
    assert.deepEqual(features.saved, [{ type: "worksheet", count: 1, users: 1 }]);
  });

  it("ranks the most frequent users and says what they teach and where they spend time", async () => {
    const res = await call(server, "GET", "/admin/insights?days=7", adminId);
    const top = res.json.topUsers;
    assert.deepEqual(
      top.map((u: { name: string }) => u.name),
      ["Ayla Test", "Basel Test", "Carmen Test"],
    );
    assert.deepEqual(
      { ...top[0], lastSeen: typeof top[0].lastSeen },
      {
        id: ayla,
        name: "Ayla Test",
        role: "teacher",
        school: null,
        gradeIds: ["grade-10"],
        subjectIds: ["mathematics"],
        governorate: "amman",
        activeDays: 3,
        minutes: 40,
        topAreas: ["gen-quiz", "classes"],
        generations: 1,
        lastSeen: "string",
      },
    );
  });

  it("hides a demographic group of one or two teachers", async () => {
    const res = await call(server, "GET", "/admin/insights", adminId);
    const { teachers } = res.json;
    assert.equal(teachers.total, 3);
    assert.deepEqual(teachers.governorate, { answered: 3, unanswered: 0, rows: [{ key: "amman", count: 3 }] });
    // One woman and one man: each group is hidden, and so are both totals (no subtraction).
    assert.deepEqual(teachers.gender, {
      answered: null,
      unanswered: null,
      rows: [
        { key: "female", count: null },
        { key: "male", count: null },
      ],
    });
  });

  it("opens one person's page", async () => {
    const res = await call(server, "GET", `/admin/insights/users/${ayla}?days=7`, adminId);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.user.name, "Ayla Test");
    assert.equal(res.json.user.teacherProfile.governorate, "amman");
    assert.equal(res.json.activeDays, 3);
    assert.deepEqual(res.json.areas[0], { area: "gen-quiz", minutes: 30 });
    assert.equal(res.json.daily.length, 7);
    assert.deepEqual(res.json.daily.at(-1), { day: today, minutes: 30, active: true });
  });

  it("never names a student — not in the list, and no per-person page", async () => {
    const res = await call(server, "GET", "/admin/insights?days=7", adminId);
    assert.ok(!res.json.topUsers.some((u: { id: string }) => u.id === dina));
    assert.equal((await call(server, "GET", `/admin/insights/users/${dina}`, adminId)).status, 404);
  });

  it("answers 404 for an unknown person and 400 for a malformed id", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    assert.equal((await call(server, "GET", `/admin/insights/users/${unknown}`, adminId)).status, 404);
    assert.equal((await call(server, "GET", "/admin/insights/users/not-a-uuid", adminId)).status, 400);
  });
});
