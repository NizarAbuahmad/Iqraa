import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIGURE_LIMITS as L, PHYSICS_UNITS, SCENE_LIMITS as S, figureNumbers, resolvePhysicsFigure } from "@workspace/figure";
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
    it(`${lang}: states the no-repeat rules`, () => {
      assert.ok(text.includes(lang === "en" ? "never use one label twice" : "ولا تستعمل الوسم نفسه مرتين"));
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
  it("forbids drawing a resultant, an equilibrant or a wave sum, just before the examples", () => {
    const en = physicsFigureFormatEn();
    const ar = physicsFigureFormatAr();
    assert.ok(en.includes("Never draw a resultant or net force, an equilibrant, or the sum of two waves: those are what questions ask for.\nExamples:"));
    assert.ok(ar.includes("لا ترسم محصلةً (لمتجهات أو لقوى) ولا قوةً موازِنة ولا مجموع موجتين: فهذه ما تسأل عنه الأسئلة.\nأمثلة:"));
  });
  it("never offers a drawn wave sum, and asks for vectors from the origin with every end point stated", () => {
    const en = physicsFigureFormatEn();
    const ar = physicsFigureFormatAr();
    assert.ok(en.includes(`; "second": optional {"phase":"in" or "out","sum": false} (a second wave drawn with the first)`));
    assert.ok(ar.includes(`؛ و"second" اختياري {"phase": "in" أو "out"، "sum": false} (موجة ثانية تُرسم مع الأولى)`));
    assert.ok(!en.includes("true or false") && !ar.includes("true أو false"));
    assert.ok(en.includes("the question must state every non-zero coordinate of each end point and every non-zero component; draw vectors from [0,0] unless the question gives their positions"));
    assert.ok(ar.includes("فيجب أن يذكر السؤال كل إحداثي غير صفري لنهايتي كل متجه وكل مركّبة غير صفرية؛ وارسم المتجهات من [0,0] ما لم يذكر السؤال مواقعها"));
    assert.ok(en.includes("must appear in the question text, with the same value."));
    assert.ok(ar.includes("يجب أن يرد في نص السؤال بالقيمة نفسها."));
  });
  it("the vectors example is drawn from the origin: it prints its components only", () => {
    const v = resolvePhysicsFigure(JSON.parse(PHYSICS_FIGURE_EXAMPLES[5]));
    assert.ok(v && v.kind === "vectors");
    const components = v.vectors.flatMap(x => [Math.abs(x.to[0] - x.from[0]), Math.abs(x.to[1] - x.from[1])]).filter(n => n > 0);
    assert.deepEqual(figureNumbers(v), components);
  });
});
