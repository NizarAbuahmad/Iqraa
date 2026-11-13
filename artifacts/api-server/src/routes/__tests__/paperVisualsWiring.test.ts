import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../generate.ts", import.meta.url), "utf8");

describe("the generate route settles a paper's drawings", () => {
  it("once, after every merge and trim, before the artifact is stored", () => {
    const calls = src.split("settlePaperVisuals(").length - 1;
    assert.equal(calls, 1, "called exactly once");
    const at = src.indexOf("settlePaperVisuals(");
    assert.ok(at > src.lastIndexOf("trimWorksheet("), "after the worksheet trim");
    assert.ok(at > src.lastIndexOf("absorbQuizTopUp("), "after the quiz top-up");
    assert.ok(at < src.indexOf("storeVariant({"), "before storing");
  });
  it('logs "paper visuals" with kind, lessonId, kept and dropped', () => {
    assert.match(src, /\{ kind, lessonId: lessonRefOf\(body\), kept: visuals\.kept, dropped: visuals\.dropped \},\s*"paper visuals"/);
  });
  it("gives a physics paper more output room for its drawings, in both ceilings", () => {
    const body = (name: string) => src.slice(src.indexOf(`function ${name}`), src.indexOf("\n}\n", src.indexOf(`function ${name}`)));
    for (const name of ["quizTokens", "worksheetTokens"]) {
      assert.ok(body(name).includes("isPhysicsRequest(body) ? PHYSICS_VISUAL_TOKENS : 0"), name);
    }
  });
});
