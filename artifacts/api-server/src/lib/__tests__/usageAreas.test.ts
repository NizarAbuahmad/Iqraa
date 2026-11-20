import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { HEARTBEAT_MIN_GAP_SECONDS, USAGE_AREAS, normalizeArea, normalizePlatform } from "../usageAreas.ts";

describe("usage areas", () => {
  it("is a closed list with no duplicates, ending in the catch-all", () => {
    assert.equal(new Set(USAGE_AREAS).size, USAGE_AREAS.length);
    assert.ok(USAGE_AREAS.includes("other"));
    for (const a of USAGE_AREAS) assert.match(a, /^[a-z][a-z-]*$/);
  });

  it("keeps a known area and folds anything else into `other`", () => {
    assert.equal(normalizeArea("gen-quiz"), "gen-quiz");
    assert.equal(normalizeArea("corner-math"), "corner-math");
    assert.equal(normalizeArea("/ai-tools/quiz"), "other");
    assert.equal(normalizeArea(""), "other");
    assert.equal(normalizeArea(42), "other");
    assert.equal(normalizeArea(undefined), "other");
  });

  it("reads the platform the app reports, and calls anything else unknown", () => {
    assert.equal(normalizePlatform("android"), "android");
    assert.equal(normalizePlatform("ios"), "ios");
    assert.equal(normalizePlatform("web"), "web");
    assert.equal(normalizePlatform(null), "unknown");
    assert.equal(normalizePlatform("windows"), "unknown");
  });

  it("counts at most one minute per 50 seconds", () => {
    assert.equal(HEARTBEAT_MIN_GAP_SECONDS, 50);
  });
});
