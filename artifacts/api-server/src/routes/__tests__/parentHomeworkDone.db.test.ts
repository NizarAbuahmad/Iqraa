/**
 * PUT/DELETE /parent/homework/:id/done?child=<key> — a parent ticks homework for a child who has no student account —
 * against a real database. What it pins: the tick lands on that child's row in that class and nowhere else; a sibling
 * in the same class who HAS an account is refused (`student_tracks`: they tick their own); a project is refused
 * (`submission_required`); another family's child, a child outside the homework's class, a missing key and a student
 * calling the parent route are refused with nothing written; and the parent's own list then reads the item as done.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

describeDb("a parent ticks homework for a child with no student account", () => {
  let db: TestDb;
  let on: TestServer;
  const u: Record<string, string> = {};
  const row: Record<string, string> = {};
  const hw: Record<string, string> = {};

  const q = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await db.pool.query<T>(text, params)).rows;
  const completions = async (homeworkId: string) =>
    (await q<{ student_id: string }>(`SELECT student_id FROM homework_completions WHERE homework_id = $1 ORDER BY student_id`, [homeworkId]))
      .map(r => r.student_id);
  const tick = (as: string, homeworkId: string, child: string, method: "PUT" | "DELETE" = "PUT") =>
    call(on, method, `/parent/homework/${homeworkId}/done?child=${encodeURIComponent(child)}`, as);

  before(async () => {
    db = await setupTestDb();
    const mkUser = async (key: string, role: string) => {
      u[key] = (await q<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, roster_consent_at) VALUES ('U', $1, $2, $3, now()) RETURNING id`,
        [key, role, `${key}@example.test`],
      ))[0]!.id;
    };
    await mkUser("teacher", "teacher");
    await mkUser("parent", "parent");
    await mkUser("otherParent", "parent");
    await mkUser("omarAccount", "student");

    const mkClass = async (name: string) =>
      (await q<{ id: string }>(
        `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids) VALUES ($1, $2, 'mathematics', '["mathematics"]'::jsonb) RETURNING id`,
        [u["teacher"], name],
      ))[0]!.id;
    const classA = await mkClass("10A");
    const classB = await mkClass("10B");

    const mkRow = async (key: string, name: string, classId: string) => {
      row[key] = (await q<{ id: string }>(
        `INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`,
        [u["teacher"], name],
      ))[0]!.id;
      await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [classId, row[key]]);
    };
    await mkRow("sara", "سارة", classA); // no student account
    await mkRow("omar", "عمر", classA); // has one
    await mkRow("hadi", "هادي", classA); // another family's child, no account
    const link = (studentKey: string, userKey: string, relation: "guardian" | "self") =>
      q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, $3)`, [row[studentKey], u[userKey], relation]);
    await link("sara", "parent", "guardian");
    await link("omar", "parent", "guardian");
    await link("omar", "omarAccount", "self");
    await link("hadi", "otherParent", "guardian");

    const mkHw = async (key: string, classId: string, project: boolean) => {
      hw[key] = (await q<{ id: string }>(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission)
         VALUES ($1, $2, $3, now() + interval '2 days', $4) RETURNING id`,
        [u["teacher"], classId, key, project],
      ))[0]!.id;
    };
    await mkHw("plain", classA, false);
    await mkHw("project", classA, true);
    await mkHw("elsewhere", classB, false);

    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  // A child's key is its smallest roster-row id (`groupChildren`); each child here has one row.
  it("ticks the child's row in that class, and the parent's list then reads it as done", async () => {
    const res = await tick(u["parent"]!, hw["plain"]!, row["sara"]!);
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.json, { done: true });
    assert.deepEqual(await completions(hw["plain"]!), [row["sara"]], "Sara's row only: not her sibling's");

    const list = await call(on, "GET", "/parent/homework", u["parent"]);
    assert.equal(list.status, 200, list.text);
    const sara = list.json.children.find((c: { key: string }) => c.key === row["sara"]);
    const item = sara.homework.find((h: { id: string }) => h.id === hw["plain"]);
    assert.equal(item.done, true);
    assert.equal(item.canTrack, false, "still a child with no student account");
  });

  it("is idempotent, and DELETE takes the tick back", async () => {
    assert.equal((await tick(u["parent"]!, hw["plain"]!, row["sara"]!)).status, 200);
    assert.deepEqual(await completions(hw["plain"]!), [row["sara"]]);
    const res = await tick(u["parent"]!, hw["plain"]!, row["sara"]!, "DELETE");
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.json, { done: false });
    assert.deepEqual(await completions(hw["plain"]!), []);
  });

  it("refuses a child who has a student account: they tick their own", async () => {
    const res = await tick(u["parent"]!, hw["plain"]!, row["omar"]!);
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "student_tracks");
    assert.deepEqual(await completions(hw["plain"]!), []);
  });

  it("refuses a project: it is done by handing the project in", async () => {
    const res = await tick(u["parent"]!, hw["project"]!, row["sara"]!);
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "submission_required");
    assert.deepEqual(await completions(hw["project"]!), []);
  });

  it("refuses everything that is not this parent's child in this homework's class, with one 404 and nothing written", async () => {
    const cases: Array<[string, string, string]> = [
      ["another family's child", hw["plain"]!, row["hadi"]!],
      ["a child outside the homework's class", hw["elsewhere"]!, row["sara"]!],
      ["no child key", hw["plain"]!, ""],
      ["a key that is no child", hw["plain"]!, "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90"],
      ["a homework id that is not a uuid", "nope", row["sara"]!],
    ];
    for (const [label, homeworkId, child] of cases) {
      const res = await tick(u["parent"]!, homeworkId, child);
      assert.equal(res.status, 404, `${label}: ${res.text}`);
    }
    // And the other family cannot tick Sara.
    assert.equal((await tick(u["otherParent"]!, hw["plain"]!, row["sara"]!)).status, 404);
    assert.deepEqual(await completions(hw["plain"]!), []);
    assert.deepEqual(await completions(hw["elsewhere"]!), []);
  });

  it("is a parent's route: a student is refused", async () => {
    const res = await tick(u["omarAccount"]!, hw["plain"]!, row["omar"]!);
    assert.equal(res.status, 403, res.text);
    assert.deepEqual(await completions(hw["plain"]!), []);
  });

  it("with parent and student accounts off, refuses with student_accounts_disabled", async () => {
    const off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined } });
    try {
      const res = await call(off, "PUT", `/parent/homework/${hw["plain"]}/done?child=${row["sara"]}`, u["parent"]);
      assert.equal(res.status, 403, res.text);
      assert.equal(res.json.code, "student_accounts_disabled");
    } finally {
      await off.stop();
    }
  });
});
