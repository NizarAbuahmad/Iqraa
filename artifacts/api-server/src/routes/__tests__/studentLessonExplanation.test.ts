/**
 * The student routes read a pool somebody else paid for. They must never be
 * able to cause a paid call, and the OpenAI client throws at module scope
 * without a key, so these files must also stay importable under `node --test`.
 * A source scan is the cheapest proof that neither import can creep in.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8");

const FILES = {
  route: "../studentLessonExplanation.ts",
  store: "../../lib/lessonExplanationStore.ts",
  pure: "../../lib/lessonExplanation.ts",
};

describe("student lesson-explanation modules make no model call", () => {
  for (const [name, rel] of Object.entries(FILES)) {
    it(`${name} imports no generation, budget or OpenAI code`, () => {
      const source = read(rel);
      assert.doesNotMatch(source, /generateContent|completeOnce|aiBudget|from\s+["']openai["']|new OpenAI/);
    });
  }

  it("the route guards its own prefix instead of relying on mount order", () => {
    const source = read(FILES.route);
    assert.match(source, /router\.use\(\s*"\/student\/lesson-explanation"\s*,\s*authMiddleware\s*,\s*requireRole\("student"\)\s*\)/);
    assert.doesNotMatch(source, /router\.use\(\s*authMiddleware/);
  });

  it("serves only approved rows", () => {
    assert.match(read(FILES.store), /isNotNull\(aiArtifacts\.studentApprovedAt\)/);
  });
});
