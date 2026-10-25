/**
 * The four document calls wait long enough for Claude.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/documentTimeout.test.ts
 *
 * `RemoteAIService` imports react-native modules, so the runner cannot load it;
 * this reads the source instead (as `paperOrder.test.ts` reads the quiz screen).
 * What it pins: a lesson plan, worksheet, quiz or slide deck is written by a
 * model that takes 11-33 s per call (two calls when a top-up or a regenerate
 * retry is needed), so none of them may use the 45 s default — `prompt-slides`
 * has no offline fallback to hide a timeout behind. And the long wait stays
 * scoped: a call that was never slow must not inherit it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "ai", "RemoteAIService.ts"), "utf8");
const lines = src.split("\n");

/** The line that posts to exactly this path (a trailing quote keeps `/prompt-slides` apart from `/prompt-slides/questions`). */
const postLine = (path: string) => lines.find((l) => l.includes("postJSON") && l.includes(`'/generate/${path}'`));

describe("document timeout", () => {
  it("is at least twice the 45 s default", () => {
    const m = src.match(/const DOCUMENT_TIMEOUT_MS = ([\d_]+);/);
    assert.ok(m, "DOCUMENT_TIMEOUT_MS is not declared");
    assert.ok(Number(m[1]!.replace(/_/g, "")) >= 90_000);
  });

  for (const path of ["lesson-plan", "worksheet", "quiz", "prompt-slides"]) {
    it(`/generate/${path} passes it`, () => {
      const line = postLine(path);
      assert.ok(line, `no postJSON call for /generate/${path}`);
      assert.match(line!, /DOCUMENT_TIMEOUT_MS/);
    });
  }

  it("is not handed to a call that was never slow", () => {
    for (const path of ["activity", "infographic", "homework", "classroom-activity", "lesson-teaching"]) {
      const line = postLine(path);
      assert.ok(line, `no postJSON call for /generate/${path}`);
      assert.doesNotMatch(line!, /DOCUMENT_TIMEOUT_MS/, `/generate/${path} should keep the default`);
    }
  });
});
