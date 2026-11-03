import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIGURE_LIMITS, resolveFigure } from "@workspace/figure";
import { figureFormatAr, figureFormatEn } from "../figurePrompt.ts";

describe("figure prompt text", () => {
  for (const [lang, text, repeatWord] of [
    ["en", figureFormatEn(), "repeat"],
    ["ar", figureFormatAr(), "تكرّر"],
  ] as const) {
    it(`${lang}: names both kinds and prints the limits from the gate`, () => {
      assert.ok(text.includes('"function-graph"') && text.includes('"vectors"'));
      for (const n of [
        FIGURE_LIMITS.maxFunctions,
        FIGURE_LIMITS.maxPoints,
        FIGURE_LIMITS.maxVectors,
        FIGURE_LIMITS.maxExprChars,
        FIGURE_LIMITS.maxXWidth,
        FIGURE_LIMITS.maxCoord,
        FIGURE_LIMITS.minXWidth,
        FIGURE_LIMITS.minYHeight,
      ]) {
        assert.ok(text.includes(String(n)), `${lang}: ${n}`);
      }
    });
    it(`${lang}: says a drawing never repeats a function or a vector`, () => {
      assert.ok(text.includes(repeatWord), `${lang}: ${repeatWord}`);
    });
    it(`${lang}: stays compact, one model read per maths exam request`, () => {
      assert.ok(text.split("\n").length <= 14, `${lang}: ${text.split("\n").length} lines`);
    });
    it(`${lang}: its examples pass the gate`, () => {
      const examples = text.split("\n").filter(l => l.startsWith('{"kind"'));
      assert.equal(examples.length, 2);
      for (const e of examples) assert.ok(resolveFigure(JSON.parse(e)), e);
    });
  }
});
