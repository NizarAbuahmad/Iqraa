/**
 * What this guards: the seed is the fixture every cross-family test leans on.
 * If a constraint (one `self` link per roster row, unique slot keys) rejects a
 * row, or a count drifts, the tests built on it would pass or fail for the
 * wrong reason. Counts here are the contract.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../gate.ts";
import { setupTestDb, type TestDb } from "../testDb.ts";
import { seedFamilyWorld, type FamilyWorld } from "../seedFamilies.ts";

describeDb("seedFamilyWorld", () => {
  let db: TestDb;
  let world: FamilyWorld;

  before(async () => {
    db = await setupTestDb();
    world = await seedFamilyWorld(db.pool);
  });
  after(async () => {
    await db?.drop();
  });

  async function count(table: string, where = "true"): Promise<number> {
    const r = await db.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`);
    return r.rows[0].n;
  }

  it("creates the people, classes and roster rows", async () => {
    assert.equal(await count("users"), 8);
    assert.equal(await count("class_groups"), 5);
    assert.equal(await count("class_groups", "archived_at IS NOT NULL"), 1);
    assert.equal(await count("students"), 6);
    assert.equal(await count("students", "archived_at IS NOT NULL"), 1);
  });

  it("creates memberships, links, periods and slots", async () => {
    assert.equal(await count("class_memberships"), 7);
    assert.equal(await count("roster_links"), 8);
    assert.equal(await count("roster_links", "relation = 'self'"), 2);
    assert.equal(await count("schedule_periods"), 3);
    assert.equal(await count("schedule_slots"), 6);
    assert.equal(await count("schedule_slots", "class_group_id IS NULL"), 1);
  });

  it("returns an id for every user it names", () => {
    for (const [key, id] of Object.entries(world.users)) {
      assert.match(id, /^[0-9a-f-]{36}$/, key);
    }
  });

  it("marks exactly one account suspended", async () => {
    assert.equal(await count("users", "suspended_at IS NOT NULL"), 1);
  });
});
