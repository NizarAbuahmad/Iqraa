import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { archiveDecision } from "../evaluationArchive.ts";

describe("archiveDecision", () => {
  it("lets a draft or a closed exam be removed", () => {
    for (const status of ["draft", "closed"]) {
      assert.deepEqual(archiveDecision({ status, archivedAt: null }), { ok: true, alreadyArchived: false });
    }
  });

  it("refuses a published exam — its link is still live", () => {
    const d = archiveDecision({ status: "published", archivedAt: null });
    assert.equal(d.ok, false);
    assert.equal(!d.ok && d.status, 409);
    assert.equal(!d.ok && d.code, "still_published");
  });

  it("treats a second removal as success, not an error", () => {
    const at = new Date();
    assert.deepEqual(archiveDecision({ status: "closed", archivedAt: at }), { ok: true, alreadyArchived: true });
    // even if it somehow got archived while published, the answer is "already gone"
    assert.deepEqual(archiveDecision({ status: "published", archivedAt: at }), { ok: true, alreadyArchived: true });
  });
});
