import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compileExpression, FIGURE_LIMITS as L, resolveFigure } from "@workspace/figure";
import { figureFormatAr, figureFormatEn } from "../figurePrompt.ts";

// Each limit is checked inside the phrase that templates it. A bare
// `includes(String(n))` is vacuous for 3, 4, 5 and 0.5, which also occur in the
// examples and the static text, so a changed limit would not fail it.
const PHRASES = {
  en: {
    text: figureFormatEn(),
    repeat: "repeat",
    limits: [
      `1 to ${L.maxFunctions};`,
      `at most ${L.maxExprChars} characters`,
      `width ${L.minXWidth} to ${L.maxXWidth})`,
      `height ${L.minYHeight} to ${L.maxYHeight})`,
      `at most ${L.maxPoints};`,
      `1 to ${L.maxVectors};`,
      `at most ${L.maxCoord})`,
      `below ${L.maxSampleAbs} in magnitude`,
    ],
    statements: [
      'inside "x"',
      "FIRST function",
      "never the answer",
    ],
  },
  ar: {
    text: figureFormatAr(),
    repeat: "تكرّر",
    limits: [
      `من 1 إلى ${L.maxFunctions}؛`,
      `بحدٍّ أقصى ${L.maxExprChars} حرفًا`,
      `العرض من ${L.minXWidth} إلى ${L.maxXWidth})`,
      `الارتفاع من ${L.minYHeight} إلى ${L.maxYHeight})`,
      `حتى ${L.maxPoints}؛`,
      `من 1 إلى ${L.maxVectors}؛`,
      `${L.maxCoord} على الأكثر`,
      `أقل من ${L.maxSampleAbs} بالقيمة المطلقة`,
    ],
    statements: [
      'داخل "x"',
      "الاقتران الأول",
      "ولا تعلّم الإجابة",
    ],
  },
} as const;

describe("figure prompt text", () => {
  for (const [lang, { text, repeat, limits, statements }] of Object.entries(PHRASES)) {
    it(`${lang}: names both kinds and prints every limit from the gate`, () => {
      assert.ok(text.includes('"function-graph"') && text.includes('"vectors"'));
      for (const phrase of limits) assert.ok(text.includes(phrase), `${lang}: ${phrase}`);
    });
    it(`${lang}: says a drawing never repeats a function or a vector`, () => {
      assert.ok(text.includes(repeat), `${lang}: ${repeat}`);
    });
    it(`${lang}: places a point inside x, on the first curve, and never on the answer`, () => {
      for (const s of statements) assert.ok(text.includes(s), `${lang}: ${s}`);
    });
    it(`${lang}: stays compact, one model read per maths exam request`, () => {
      assert.ok(text.split("\n").length <= 14, `${lang}: ${text.split("\n").length} lines`);
    });
    it(`${lang}: its examples pass the gate`, () => {
      const examples = text.split("\n").filter(l => l.startsWith('{"kind"'));
      assert.equal(examples.length, 2);
      for (const e of examples) assert.ok(resolveFigure(JSON.parse(e)), e);
    });
    it(`${lang}: no example marks a root of its function, which would draw the answer`, () => {
      const examples = text.split("\n").filter(l => l.startsWith('{"kind":"function-graph"'));
      assert.ok(examples.length >= 1);
      for (const e of examples) {
        const fig = JSON.parse(e);
        for (const p of fig.points ?? []) {
          const f = compileExpression(fig.functions[p.on ?? 0].expr);
          assert.ok(f, e);
          const y = f(p.at);
          assert.ok(y !== null && Math.abs(y) > 1e-9, `${lang}: ${e} marks a root at x = ${p.at}`);
        }
      }
    });
  }
});
