// artifacts/api-server/src/lib/__tests__/keyTerms.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KEY_TERMS_MAX, keyTermsQuestionClauseAr, keyTermsQuestionClauseEn,
  keyTermsTeachingClauseAr, keyTermsTeachingClauseEn, missingKeyTerms, parseKeyTerms,
} from "../keyTerms.ts";

const WAVES = ["انعكاس الموجة", "انكسار الموجة", "مبدأ تراكب الموجات", "تداخل", "حيود", "استقطاب", "تأثير دوبلر"];
const scope = { kind: "semester", scopeKey: "sem:grade-10:physics:2", unitIds: ["kbu-phys-s2-nccd-u6"] };

describe("parseKeyTerms", () => {
  it("reads a clean list", () => {
    assert.deepEqual(parseKeyTerms({ keyTerms: WAVES }), WAVES);
  });

  it("folds whitespace and drops duplicates", () => {
    assert.deepEqual(parseKeyTerms({ keyTerms: [" زمن\nالتحليق ", "زمن التحليق", "المدى الأفقي"] }), ["زمن التحليق", "المدى الأفقي"]);
  });

  it("rejects request-controlled junk", () => {
    assert.equal(parseKeyTerms({}), null);
    assert.equal(parseKeyTerms({ keyTerms: "حيود" }), null);
    assert.equal(parseKeyTerms({ keyTerms: [] }), null);
    assert.equal(parseKeyTerms({ keyTerms: ["حيود", 3] }), null);
    assert.equal(parseKeyTerms({ keyTerms: ["حيود", "  "] }), null);
    assert.equal(parseKeyTerms({ keyTerms: ["x".repeat(61)] }), null);
    assert.equal(parseKeyTerms({ keyTerms: Array.from({ length: KEY_TERMS_MAX + 1 }, (_, i) => `t${i}`) }), null);
  });

  it("is null on a wide scope — a semester paper is spread over lessons, not terms", () => {
    assert.equal(parseKeyTerms({ scope, keyTerms: WAVES }), null);
  });
});

describe("clauses", () => {
  for (const [lang, q, t] of [["ar", keyTermsQuestionClauseAr, keyTermsTeachingClauseAr], ["en", keyTermsQuestionClauseEn, keyTermsTeachingClauseEn]] as const) {
    it(`${lang}: nothing without terms`, () => {
      assert.equal(q({}), "");
      assert.equal(t({}), "");
      assert.equal(q({ keyTerms: ["x".repeat(61)] }), "");
    });

    it(`${lang}: the question clause lists every term and asks for calculations on quantities`, () => {
      const c = q({ keyTerms: WAVES });
      for (const term of WAVES) assert.ok(c.includes(`- ${term}`), term);
      assert.match(c, lang === "ar" ? /سؤالًا واحدًا على الأقل/ : /at least one question/);
      assert.match(c, lang === "ar" ? /مسألة حسابية بأرقام/ : /calculation with numbers/);
    });

    it(`${lang}: the teaching clause lists every term and forbids dropping one`, () => {
      const c = t({ keyTerms: WAVES });
      for (const term of WAVES) assert.ok(c.includes(`- ${term}`), term);
      assert.match(c, lang === "ar" ? /لا تُسقط مصطلحًا/ : /Do not drop a term/);
      assert.match(c, lang === "ar" ? /"workedExample"/ : /"workedExample"/);
    });
  }
});

describe("missingKeyTerms", () => {
  const content = {
    concepts: [
      { title: "يحدث الحيود عند مرور الموجة بفتحة", points: ["حُيود الموجات يزداد كلما ضاقت الفتحة"] },
      { title: "يحدث انكسار الموجة عند انتقالها بين وسطين", points: ["تتغير سرعتها"] },
      { title: "الانكسار يغيّر الاتجاه", points: ["مثال"] },
    ],
    workedExample: { problem: "احسب التردد الذي يسمعه المراقب في تأثير دوبلر", steps: ["..."] },
  };

  it("finds a term with the article added or with harakat", () => {
    assert.deepEqual(missingKeyTerms(["حيود", "تأثير دوبلر"], content), []);
  });

  it("finds a two-word term only as the whole phrase", () => {
    assert.deepEqual(missingKeyTerms(["انكسار الموجة"], content), []);
    assert.deepEqual(missingKeyTerms(["انعكاس الموجة"], content), ["انعكاس الموجة"]);
    // «الانكسار» alone, as in the third concept, is not «انكسار الموجة».
    assert.deepEqual(missingKeyTerms(["انكسار الموجة"], { title: "الانكسار يغيّر الاتجاه" }), ["انكسار الموجة"]);
  });

  it("works for English and ignores case", () => {
    assert.deepEqual(missingKeyTerms(["Time of Flight", "Range"], { q: "Find the time of flight." }), ["Range"]);
  });
});
