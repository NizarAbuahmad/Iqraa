import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIGURE_LIMITS as L, PHYSICS_UNITS, SCENE_LIMITS as S, resolvePhysicsFigure } from "@workspace/figure";
import { PHYSICS_FIGURE_EXAMPLES, physicsFigureFormatAr, physicsFigureFormatEn } from "../figurePrompt.ts";

// Each limit inside the phrase that templates it: a bare includes(String(n)) is vacuous for small numbers.
const PHRASES = {
  en: [
    `${S.minIncline} to ${S.maxIncline}`,
    `1 to ${S.maxArrows};`,
    `less than ${S.minArrowGap}° apart`,
    `${S.minAngle} to ${S.maxAngle})`,
    `from 0 to ${S.maxValue}`,
    `at most ${S.valueDecimals} decimals`,
    `1 to ${L.maxVectors};`,
    `at most ${L.maxCoord})`,
  ],
  ar: [
    `من ${S.minIncline} إلى ${S.maxIncline}`,
    `من 1 إلى ${S.maxArrows}؛`,
    `عن ${S.minArrowGap}°`,
    `من ${S.minAngle} إلى ${S.maxAngle})`,
    `من 0 إلى ${S.maxValue}`,
    `بحدٍّ أقصى ${S.valueDecimals} منازل عشرية`,
    `من 1 إلى ${L.maxVectors}؛`,
    `${L.maxCoord} على الأكثر`,
  ],
};

describe("physics drawing format", () => {
  for (const [lang, text] of [["en", physicsFigureFormatEn()], ["ar", physicsFigureFormatAr()]] as const) {
    it(`${lang}: quotes every limit from the package`, () => {
      for (const p of PHRASES[lang]) assert.ok(text.includes(p), `missing «${p}»`);
    });
    it(`${lang}: lists every unit`, () => {
      for (const u of PHYSICS_UNITS) assert.ok(text.includes(u), `missing unit ${u}`);
    });
    it(`${lang}: names all six kinds and carries the examples`, () => {
      for (const k of ["forces", "attraction", "projectile", "circular", "wave", "vectors"]) assert.ok(text.includes(`"${k}"`), k);
      for (const e of PHYSICS_FIGURE_EXAMPLES) assert.ok(text.includes(e));
    });
  }
  it("every example passes the gate, one per kind", () => {
    const kinds = PHYSICS_FIGURE_EXAMPLES.map(e => resolvePhysicsFigure(JSON.parse(e))?.kind);
    assert.deepEqual(kinds, ["forces", "attraction", "projectile", "circular", "wave", "vectors"]);
  });
  it("says a drawing never carries the answer", () => {
    assert.match(physicsFigureFormatEn(), /Never put on the drawing the quantity the question asks for/);
    assert.match(physicsFigureFormatAr(), /لا تضع في الرسم الكمية التي يطلبها السؤال/);
  });
});
