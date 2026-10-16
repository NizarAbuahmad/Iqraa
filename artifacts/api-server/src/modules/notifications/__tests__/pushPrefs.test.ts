import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { allowsPush, parsePushPrefsPatch, PUSH_CATEGORIES, readPushPrefs } from "../pushPrefs.ts";

describe("readPushPrefs", () => {
  it("reads an account that never chose as all on", () => {
    assert.deepEqual(readPushPrefs({}), { homework: true, exams: true, results: true });
    assert.deepEqual(readPushPrefs(null), { homework: true, exams: true, results: true });
    assert.deepEqual(readPushPrefs([false]), { homework: true, exams: true, results: true });
  });
  it("turns a switch off only for an explicit false", () => {
    assert.deepEqual(readPushPrefs({ homework: false }), { homework: false, exams: true, results: true });
    // Opt-outs: anything that is not `false` leaves the push on.
    assert.deepEqual(readPushPrefs({ exams: "false", results: 0 }), { homework: true, exams: true, results: true });
  });
  it("ignores keys it does not know", () => {
    assert.deepEqual(readPushPrefs({ chat: false }), { homework: true, exams: true, results: true });
  });
});

describe("allowsPush", () => {
  it("answers per category", () => {
    assert.equal(allowsPush({ results: false }, "results"), false);
    assert.equal(allowsPush({ results: false }, "homework"), true);
  });
});

describe("parsePushPrefsPatch", () => {
  it("takes any subset of the three switches", () => {
    assert.deepEqual(parsePushPrefsPatch({ homework: false }), { ok: true, value: { homework: false } });
    assert.deepEqual(parsePushPrefsPatch({ exams: true, results: false }), { ok: true, value: { exams: true, results: false } });
  });
  it("drops keys it does not own", () => {
    assert.deepEqual(parsePushPrefsPatch({ homework: true, chat: false }), { ok: true, value: { homework: true } });
  });
  it("refuses a switch that is not true or false", () => {
    assert.equal(parsePushPrefsPatch({ homework: "off" }).ok, false);
    assert.equal(parsePushPrefsPatch({ homework: null }).ok, false);
  });
  it("refuses a body that changes nothing", () => {
    for (const body of [{}, { chat: false }, null, [], "homework", 1]) {
      assert.equal(parsePushPrefsPatch(body).ok, false, JSON.stringify(body));
    }
  });
  it("names exactly three categories", () => {
    assert.deepEqual([...PUSH_CATEGORIES], ["homework", "exams", "results"]);
  });
});
