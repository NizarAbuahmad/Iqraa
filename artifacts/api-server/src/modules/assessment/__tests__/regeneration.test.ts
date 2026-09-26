import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionForRegeneration } from "../regeneration.ts";

test("regenerating keeps teacher-written questions and replaces generated ones", () => {
  const rows = [
    { id: "ai", source: "ai", gradingMode: "deterministic", body: { stem: "…" } },
    { id: "edited", source: "ai_edited", gradingMode: "deterministic", body: { stem: "…" } },
    { id: "mine", source: "teacher", gradingMode: "deterministic", body: { statement: "…" } },
    { id: "mine-manual", source: "teacher", gradingMode: "manual", body: { prompt: "…" } },
    { id: "paper", source: "teacher", gradingMode: "manual", body: {} },
  ];
  const { keep, replace } = partitionForRegeneration(rows);
  assert.deepEqual(keep.map(r => r.id), ["mine", "mine-manual"]);
  assert.deepEqual(replace.map(r => r.id), ["ai", "edited", "paper"]);
});
