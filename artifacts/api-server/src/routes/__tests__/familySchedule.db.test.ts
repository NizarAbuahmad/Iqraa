/**
 * What this guards: the family routes reach real children's accounts, and until
 * these tests nothing exercised them with real rows. Every case here is a way
 * the feature could show one family another family's data, show a teacher's
 * private note, or show a row that should be hidden (archived, no class).
 * One database and one server for the file; a second server with the flag off.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import {
  ARCHIVED_CLASS_NOTE,
  B_ONLY_NOTE,
  CHILDREN,
  FREE_PERIOD_NOTE,
  SECRET_NOTE,
  TEACHER_NAMES,
  seedFamilyWorld,
  type FamilyWorld,
} from "../../test-support/seedFamilies.ts";

interface Period {
  periodNumber: number;
  startTime: string | null;
  durationMinutes: number | null;
  subjectId: string;
  teacherName: string;
}
interface Day {
  dayOfWeek: number;
  periods: Period[];
}
interface Schedule {
  days: Day[];
}
interface ChildBody {
  key: string;
  displayName: string;
  schedule: Schedule;
}

async function call(server: TestServer, path: string, userId?: string) {
  const res = await fetch(`${server.base}${path}`, {
    headers: userId ? { Authorization: `Bearer ${accessToken(userId)}` } : {},
  });
  const text = await res.text();
  return { status: res.status, text, json: (text ? JSON.parse(text) : null) as unknown };
}

const dayNumbers = (s: Schedule): number[] => s.days.map(d => d.dayOfWeek);
const ALL_NOTES = [SECRET_NOTE, B_ONLY_NOTE, ARCHIVED_CLASS_NOTE, FREE_PERIOD_NOTE];

describeDb("family schedule over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let off: TestServer;
  let w: FamilyWorld;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    on = await startServer({ databaseUrl: db.url });
    off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined } });
  });
  after(async () => {
    await off?.stop();
    await on?.stop();
    await db?.drop();
  });

  describe("who may call", () => {
    it("refuses no token and a bad token", async () => {
      for (const path of ["/student/schedule", "/parent/schedule"]) {
        assert.equal((await call(on, path)).status, 401, `${path} without a token`);
        const bad = await fetch(`${on.base}${path}`, { headers: { Authorization: "Bearer not-a-token" } });
        assert.equal(bad.status, 401, `${path} with a bad token`);
      }
    });

    it("refuses the wrong role on each route", async () => {
      const cases: Array<[string, string, string]> = [
        ["/student/schedule", w.users.t1, "teacher"],
        ["/student/schedule", w.users.parentA, "parent"],
        ["/parent/schedule", w.users.t1, "teacher"],
        ["/parent/schedule", w.users.studentA, "student"],
      ];
      for (const [path, userId, who] of cases) {
        assert.equal((await call(on, path, userId)).status, 403, `${path} as a ${who}`);
      }
    });

    it("refuses a suspended account", async () => {
      const r = await call(on, "/parent/schedule", w.users.suspendedParent);
      assert.equal(r.status, 403);
      assert.equal((r.json as { code?: string }).code, "account_suspended");
    });

    it("answers student_accounts_disabled while the flag is off", async () => {
      const cases: Array<[string, string]> = [
        ["/student/schedule", w.users.studentA],
        ["/parent/schedule", w.users.parentA],
      ];
      for (const [path, userId] of cases) {
        const r = await call(off, path, userId);
        assert.equal(r.status, 403, path);
        assert.equal((r.json as { code?: string }).code, "student_accounts_disabled", path);
      }
    });
  });

  describe("a parent's view", () => {
    let a: { text: string; children: ChildBody[] };
    let b: { text: string; children: ChildBody[] };

    before(async () => {
      const ra = await call(on, "/parent/schedule", w.users.parentA);
      const rb = await call(on, "/parent/schedule", w.users.parentB);
      assert.equal(ra.status, 200, on.logs().slice(-1500));
      assert.equal(rb.status, 200);
      a = { text: ra.text, children: (ra.json as { children: ChildBody[] }).children };
      b = { text: rb.text, children: (rb.json as { children: ChildBody[] }).children };
    });

    it("gets exactly their own children — none of another family's", () => {
      assert.deepEqual(
        a.children.map(c => c.displayName).sort(),
        [CHILDREN.adam, CHILDREN.sara].sort(),
      );
      assert.deepEqual(
        b.children.map(c => c.displayName).sort(),
        [CHILDREN.noor, CHILDREN.yazan].sort(),
      );
      for (const name of [CHILDREN.sara, CHILDREN.adam, TEACHER_NAMES.t2]) {
        assert.ok(!b.text.includes(name), `family B's response must not contain ${name}`);
      }
      for (const name of [CHILDREN.noor, CHILDREN.yazan]) {
        assert.ok(!a.text.includes(name), `family A's response must not contain ${name}`);
      }
    });

    it("shows a child taught by two teachers as ONE child, each period with its own teacher's time", () => {
      const sara = a.children.find(c => c.displayName === CHILDREN.sara);
      assert.ok(sara, "Sara is present");
      assert.deepEqual(dayNumbers(sara.schedule), [0, 2]);
      const sunday = sara.schedule.days[0].periods;
      assert.deepEqual(sunday.map(p => p.teacherName), [TEACHER_NAMES.t1, TEACHER_NAMES.t2]);
      assert.deepEqual(sunday.map(p => p.startTime), ["08:00", "10:30"]);
      assert.deepEqual(sunday.map(p => p.durationMinutes), [45, 50]);
      assert.deepEqual(sunday.map(p => p.subjectId), ["mathematics", "physics"]);
    });

    it("excludes an archived roster row and an archived class", () => {
      const adam = a.children.find(c => c.displayName === CHILDREN.adam);
      assert.ok(adam, "Adam is present");
      // His archived row (under teacher 2) and his archived class (Wednesday) contribute nothing.
      assert.deepEqual(dayNumbers(adam.schedule), [0, 2]);
      assert.ok(!JSON.stringify(adam).includes(TEACHER_NAMES.t2));
    });

    it("returns an empty week — not an error — for a class with no slots", () => {
      const yazan = b.children.find(c => c.displayName === CHILDREN.yazan);
      assert.ok(yazan, "Yazan is present");
      assert.deepEqual(yazan.schedule, { days: [] });
      const noor = b.children.find(c => c.displayName === CHILDREN.noor);
      assert.deepEqual(noor && dayNumbers(noor.schedule), [1]);
    });

    it("never sends a teacher's private slot note (or the slot with no class)", () => {
      for (const note of ALL_NOTES) {
        assert.ok(!a.text.includes(note), `family A's response must not contain "${note}"`);
        assert.ok(!b.text.includes(note), `family B's response must not contain "${note}"`);
      }
      assert.ok(!a.text.includes('"notes"'), "no notes field at all");
    });
  });

  describe("a student's view", () => {
    it("sees only the classes their own roster row sits in", async () => {
      const r = await call(on, "/student/schedule", w.users.studentA);
      assert.equal(r.status, 200, on.logs().slice(-1500));
      const { schedule } = r.json as { schedule: Schedule };
      assert.deepEqual(dayNumbers(schedule), [0, 2]);
      // studentA is linked to Sara's row under teacher 1 only — not to her row under teacher 2.
      assert.ok(!r.text.includes(TEACHER_NAMES.t2));
      for (const note of ALL_NOTES) assert.ok(!r.text.includes(note), note);
    });

    it("does not see another family's class", async () => {
      const r = await call(on, "/student/schedule", w.users.studentB);
      const { schedule } = r.json as { schedule: Schedule };
      assert.deepEqual(dayNumbers(schedule), [1]);
      assert.ok(!r.text.includes(CHILDREN.sara));
    });

    it("gets an empty week for an account linked to no roster row", async () => {
      const r = await call(on, "/student/schedule", w.users.studentUnlinked);
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { schedule: { days: [] } });
    });
  });

  describe("the exam lists share the same link queries (the studentExams refactor)", () => {
    it("lists one parent section per live roster row, never an archived one", async () => {
      const a = await call(on, "/parent/exams", w.users.parentA);
      assert.equal(a.status, 200, on.logs().slice(-1500));
      const kidsA = (a.json as { children: Array<{ displayName: string; exams: unknown[] }> }).children;
      // Sara has two roster rows (two teachers); the archived Adam row is excluded.
      assert.deepEqual(
        kidsA.map(k => k.displayName).sort(),
        [CHILDREN.adam, CHILDREN.sara, CHILDREN.sara].sort(),
      );
      assert.ok(kidsA.every(k => k.exams.length === 0));

      const b = await call(on, "/parent/exams", w.users.parentB);
      const kidsB = (b.json as { children: Array<{ displayName: string }> }).children;
      assert.deepEqual(kidsB.map(k => k.displayName).sort(), [CHILDREN.noor, CHILDREN.yazan].sort());
    });

    it("gives a student their own (empty) exam list", async () => {
      const r = await call(on, "/student/exams", w.users.studentA);
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { exams: [] });
    });
  });
});
