/**
 * What this guards: archiving a class does not touch the timetable, so a period
 * kept pointing at a class the teacher can no longer see. The weekly schedule
 * drew that cell as empty, while Today announced a "next period" for a class
 * with no name and asked for a pacing plan on it, which no plan could ever
 * satisfy — the teacher's plans belong to the classes they can see. `GET
 * /schedule` is the one read every screen takes the timetable from, so it is
 * where an archived class becomes "no class".
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import {
  ARCHIVED_CLASS_NOTE,
  B_ONLY_NOTE,
  FREE_PERIOD_NOTE,
  SECRET_NOTE,
  seedFamilyWorld,
  type FamilyWorld,
} from "../../test-support/seedFamilies.ts";

interface Slot {
  dayOfWeek: number;
  periodNumber: number;
  classGroupId: string | null;
  notes: string;
}

describeDb("GET /schedule and a class that was archived, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  const slotWithNote = (slots: Slot[], note: string): Slot => {
    const found = slots.find(s => s.notes === note);
    assert.ok(found, `no slot carries the note ${note}`);
    return found;
  };

  it("reads a period in an archived class as free, and keeps its note", async () => {
    const res = await call(on, "GET", "/schedule", w.users.t1);
    assert.equal(res.status, 200);
    const slots = res.json.slots as Slot[];
    const archived = slotWithNote(slots, ARCHIVED_CLASS_NOTE);
    assert.equal(archived.classGroupId, null);
    assert.equal(archived.dayOfWeek, 3);
  });

  it("leaves periods in live classes, and free ones, as they were", async () => {
    const slots = (await call(on, "GET", "/schedule", w.users.t1)).json.slots as Slot[];
    assert.equal(slotWithNote(slots, SECRET_NOTE).classGroupId, w.classes.c1);
    assert.equal(slotWithNote(slots, B_ONLY_NOTE).classGroupId, w.classes.c3);
    assert.equal(slotWithNote(slots, FREE_PERIOD_NOTE).classGroupId, null);
    assert.equal(slots.length, 5);
  });

  it("does not rewrite the stored period: the class is archived, the row is not edited", async () => {
    await call(on, "GET", "/schedule", w.users.t1);
    const { rows } = await db.pool.query(
      `SELECT class_group_id FROM schedule_slots WHERE notes = $1`,
      [ARCHIVED_CLASS_NOTE],
    );
    assert.equal(rows[0].class_group_id, w.classes.c4);
  });

  it("still returns another teacher's own timetable untouched", async () => {
    const slots = (await call(on, "GET", "/schedule", w.users.t2)).json.slots as Slot[];
    assert.equal(slots.length, 1);
    assert.equal(slots[0]!.classGroupId, w.classes.c2);
  });
});
