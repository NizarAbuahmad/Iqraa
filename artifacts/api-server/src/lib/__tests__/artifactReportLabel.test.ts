import { test } from "node:test";
import assert from "node:assert/strict";
import { artifactReportLabel } from "../artifactReportLabel.ts";

test("a catalog lesson id becomes its title, grade and subject", () => {
  // The id from the 2026-10-31 report email that showed only raw codes.
  const l = artifactReportLabel("lesson-teaching", "kbl-g4-islamic-s2-nccd-u7_l2");
  assert.equal(l.kindAr, "شرح الدرس");
  assert.notEqual(l.lessonAr, "kbl-g4-islamic-s2-nccd-u7_l2");
  assert.match(l.contextAr, /الرابع/);
  assert.match(l.contextAr, /الإسلامية/);
});

test("a free topic and an unknown kind pass through unchanged", () => {
  const l = artifactReportLabel("mystery", "الكسور");
  assert.equal(l.kindAr, "mystery");
  assert.equal(l.lessonAr, "الكسور");
  assert.equal(l.contextAr, "");
});
