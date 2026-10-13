/**
 * The student routes read a pool somebody else paid for. They must never be
 * able to cause a paid call, and the OpenAI client throws at module scope
 * without a key. A source scan is the cheapest proof that neither import can
 * creep in. What it proves is textual: these three files name no generation,
 * budget or OpenAI import. It does not make them importable under `node --test`
 * (the route imports `adminNotify`, which loads `@workspace/db` at module scope).
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

  it("every student-facing query filters to live, approved lesson-teaching rows", () => {
    const source = read(FILES.store);
    // Slice from `export async function <name>` to the next export (or EOF),
    // so a filter present in one function cannot vouch for another.
    const body = (name: string): string => {
      const start = source.indexOf(`export async function ${name}`);
      assert.notEqual(start, -1, `${name} not found in the store`);
      const next = source.indexOf("export async function", start + 1);
      return source.slice(start, next === -1 ? undefined : next);
    };
    for (const name of ["readApprovedExplanations", "isStudentVisibleExplanation"]) {
      const fn = body(name);
      assert.ok(fn.includes("isNotNull(aiArtifacts.studentApprovedAt)"), `${name} must filter on studentApprovedAt`);
      assert.ok(fn.includes("isNull(aiArtifacts.retiredAt)"), `${name} must exclude retired rows`);
      assert.ok(fn.includes('eq(aiArtifacts.kind, "lesson-teaching")'), `${name} must restrict to lesson-teaching`);
    }
  });
});
