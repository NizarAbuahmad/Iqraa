import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isHiddenFor } from "../threadHiding.ts";

const at = (iso: string) => new Date(iso);

describe("isHiddenFor", () => {
  it("never hides a thread that was not hidden", () => {
    assert.equal(isHiddenFor(null, at("2026-10-09T10:00:00Z")), false);
    assert.equal(isHiddenFor(undefined, null), false);
  });

  it("hides a thread whose newest message is older than the hide", () => {
    assert.equal(isHiddenFor(at("2026-10-09T10:00:00Z"), at("2026-10-09T09:00:00Z")), true);
  });

  it("hides a thread with no messages at all", () => {
    assert.equal(isHiddenFor(at("2026-10-09T10:00:00Z"), null), true);
  });

  it("brings the thread back when a newer message arrives", () => {
    assert.equal(isHiddenFor(at("2026-10-09T10:00:00Z"), at("2026-10-09T10:00:01Z")), false);
  });

  it("treats a message sent in the same instant as already hidden", () => {
    assert.equal(isHiddenFor(at("2026-10-09T10:00:00Z"), at("2026-10-09T10:00:00Z")), true);
  });
});
