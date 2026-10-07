import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getLabItem } from "@workspace/curriculum/lab";
import { labClassResourceSnapshot, parseLabClassResourceInput } from "../labClassResource.ts";

const REAL_ID = "law-newton-second";

describe("parseLabClassResourceInput", () => {
  it("accepts a real lab item id", () => {
    assert.deepEqual(parseLabClassResourceInput({ kind: "lab", itemId: REAL_ID }), { itemId: REAL_ID });
  });

  it("trims the id", () => {
    assert.deepEqual(parseLabClassResourceInput({ kind: "lab", itemId: `  ${REAL_ID} ` }), { itemId: REAL_ID });
  });

  it("refuses an id that is not in the catalogue, rather than storing a dead row", () => {
    const r = parseLabClassResourceInput({ kind: "lab", itemId: "law-does-not-exist" });
    assert.ok("error" in r);
  });

  it("refuses a missing, blank, non-string or oversized id", () => {
    for (const itemId of [undefined, "", "   ", 7, "x".repeat(201)]) {
      assert.ok("error" in parseLabClassResourceInput({ kind: "lab", itemId }), String(itemId));
    }
  });

  it("refuses any other kind and a non-object body", () => {
    assert.ok("error" in parseLabClassResourceInput({ kind: "library", itemId: REAL_ID }));
    assert.ok("error" in parseLabClassResourceInput(null));
    assert.ok("error" in parseLabClassResourceInput("lab"));
  });
});

describe("labClassResourceSnapshot", () => {
  it("writes the title from the catalogue, never from the request", () => {
    const snap = labClassResourceSnapshot(REAL_ID);
    assert.ok(snap);
    assert.equal(snap.title, getLabItem(REAL_ID)!.titleAr);
    assert.equal(snap.mediaKind, "lab");
    assert.equal(snap.url, null);
    assert.equal(snap.thumbnailUrl, null);
  });

  it("is null for an unknown id", () => {
    assert.equal(labClassResourceSnapshot("nope"), null);
  });
});
