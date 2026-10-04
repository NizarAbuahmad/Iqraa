import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resultsReleaseDecision } from "../resultsRelease.ts";

describe("resultsReleaseDecision", () => {
  it("releases a published or a closed exam", () => {
    assert.deepEqual(resultsReleaseDecision({ status: "published" }, { released: true }), { ok: true, released: true });
    assert.deepEqual(resultsReleaseDecision({ status: "closed" }, { released: true }), { ok: true, released: true });
  });

  it("refuses to release a draft — nobody can have sat it", () => {
    const d = resultsReleaseDecision({ status: "draft" }, { released: true });
    assert.equal(d.ok, false);
    assert.equal(!d.ok && d.code, "not_published");
  });

  it("always lets a teacher take a release back", () => {
    assert.deepEqual(resultsReleaseDecision({ status: "draft" }, { released: false }), { ok: true, released: false });
    assert.deepEqual(resultsReleaseDecision({ status: "closed" }, { released: false }), { ok: true, released: false });
  });

  it("needs an explicit boolean", () => {
    for (const body of [{}, { released: "true" }, null, { released: 1 }]) {
      const d = resultsReleaseDecision({ status: "published" }, body);
      assert.equal(d.ok, false);
      assert.equal(!d.ok && d.code, "invalid_input");
    }
  });
});
