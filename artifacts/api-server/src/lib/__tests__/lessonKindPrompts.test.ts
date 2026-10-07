/**
 * The live lesson-plan prompt has to know what KIND of lesson a subject
 * teaches, not only how it is taught.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/lessonKindPrompts.test.ts
 *
 * Before `lessonKinds.ts` the prompt was subject-blind: its "direct" style
 * asks for fully worked examples and silent individual solving, which is a
 * maths lesson, and a Quran, PE or art plan inherited it. The offline
 * generator fixed the same defect (`lessonPlanKinds.ts`); the subject → kind
 * table is shared by copy, so one test here reads the mobile file and fails if
 * the two drift.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { lessonPlanPromptAr, lessonPlanPromptEn } from "../prompts.ts";
import { KIND_BY_SUBJECT, lessonKindClauseAr, lessonKindClauseEn, lessonKindOf } from "../lessonKinds.ts";

const base = { grade: "العاشر", topic: "موضوع الاختبار", duration: 45 };

describe("the subject → kind table", () => {
  it("is the same table the offline generator uses", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../../../mobile/services/ai/lessonPlanKinds.ts", import.meta.url)),
      "utf8",
    );
    const block = src.slice(src.indexOf("KIND_BY_SUBJECT"), src.indexOf("};", src.indexOf("KIND_BY_SUBJECT")));
    const pairs: Record<string, string> = {};
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*'?"?([a-z-]+)'?"?:\s*'([a-z]+)'/);
      if (m) pairs[m[1]!] = m[2]!;
    }
    assert.ok(Object.keys(pairs).length >= 18, `parsed only ${Object.keys(pairs).length} entries`);
    assert.deepEqual(pairs, KIND_BY_SUBJECT);
  });

  it("resolves Arabic and English subject names, and an explicit id wins", () => {
    assert.equal(lessonKindOf({ subject: "التربية الإسلامية" }), "recitation");
    assert.equal(lessonKindOf({ subject: "Physical Education" }), "movement");
    assert.equal(lessonKindOf({ subject: "اللغة الإنجليزية" }), "english");
    assert.equal(lessonKindOf({ subject: "الرياضيات", subjectId: "physics" }), "science");
  });

  it("adds nothing for maths, an unknown subject or a typed one", () => {
    for (const subject of ["الرياضيات", "Mathematics", "Something Unlisted", "", undefined]) {
      assert.equal(lessonKindOf({ subject }), null);
      assert.equal(lessonKindClauseAr({ subject }), "");
      assert.equal(lessonKindClauseEn({ subject }), "");
    }
  });
});

describe("the live lesson-plan prompt", () => {
  const SUBJECTS: Array<[string, string, RegExp, RegExp]> = [
    ["التربية الإسلامية", "Islamic Studies", /قراءة سليمة/, /correct reading/],
    ["العلوم", "Science", /ملاحظة/, /observe/],
    ["اللغة العربية", "Arabic", /المهارات الأربع/, /four skills/],
    ["اللغة الإنجليزية", "English", /الإنجليزية/, /present, practise, produce/],
    ["الدراسات الاجتماعية", "Social Studies", /مصدر/, /source/],
    ["التربية الرياضية", "Physical Education", /إحماء/, /warm-up/],
    ["التربية الفنية والموسيقية والمسرحية", "Art, Music and Drama Education", /معايير جودة/, /quality criteria/],
  ];

  for (const [ar, en, arRe, enRe] of SUBJECTS) {
    it(`${en}: both languages carry that subject's clause, after the style clause`, () => {
      const a = lessonPlanPromptAr({ ...base, subject: ar });
      const e = lessonPlanPromptEn({ ...base, subject: en });
      assert.match(a, arRe);
      assert.match(e, enRe);
      assert.ok(a.indexOf("طبيعة المادة") > a.indexOf("أسلوب التدريس"), "kind clause comes after the style clause");
      assert.ok(e.indexOf("Nature of the subject") > e.indexOf("Teaching style"));
      assert.match(a, /يحلّ محلّ أي مطلب/);
      assert.match(e, /replaces any requirement/);
    });
  }

  it("each non-maths kind gets its own wording", () => {
    const kinds = new Set(Object.values(KIND_BY_SUBJECT).filter(k => k !== "calc"));
    assert.equal(kinds.size, 7);
    const ids = ["islamic", "science", "arabic", "english", "social", "physical-education", "creative-arts"];
    const ar = ids.map(subjectId => lessonKindClauseAr({ subjectId }));
    const en = ids.map(subjectId => lessonKindClauseEn({ subjectId }));
    assert.equal(new Set(ar).size, 7);
    assert.equal(new Set(en).size, 7);
    for (const c of [...ar, ...en]) assert.ok(c.length > 300, "a clause is more than a label");
  });

  it("a Quran plan is not asked for worked examples and may not quote from memory", () => {
    const a = lessonPlanPromptAr({ ...base, subject: "التربية الإسلامية" });
    const e = lessonPlanPromptEn({ ...base, subject: "Islamic Studies" });
    assert.match(a, /ممنوع: «مثال محلول»/);
    assert.match(a, /لا تكتب نصّ آية أو حديث من ذاكرتك/);
    assert.match(e, /Forbidden: "worked example"/);
    assert.match(e, /Do not write out a verse or hadith from memory/);
  });

  it("physics and chemistry keep their calculations, biology does not get them", () => {
    for (const subject of ["الفيزياء", "الكيمياء"]) assert.match(lessonPlanPromptAr({ ...base, subject }), /فيها حسابات/);
    for (const subject of ["Physics", "Chemistry"]) assert.match(lessonPlanPromptEn({ ...base, subject }), /has calculations/);
    assert.doesNotMatch(lessonPlanPromptAr({ ...base, subject: "الأحياء" }), /فيها حسابات/);
    assert.doesNotMatch(lessonPlanPromptEn({ ...base, subject: "Science" }), /has calculations/);
  });

  it("maths and unknown subjects get the prompt they always had", () => {
    for (const subject of ["الرياضيات", "موضوع حر"]) {
      const a = lessonPlanPromptAr({ ...base, subject });
      assert.doesNotMatch(a, /طبيعة المادة/);
      assert.match(a, /أسلوب التدريس/);
    }
    assert.doesNotMatch(lessonPlanPromptEn({ ...base, subject: "Mathematics" }), /Nature of the subject/);
  });

  it("works with every teaching style and with a prior-knowledge review", () => {
    for (const teachingStyle of ["direct", "inquiry", "collaborative"]) {
      const p = lessonPlanPromptAr({
        ...base, subject: "التربية الرياضية", teachingStyle, includePriorReview: true, priorKnowledge: ["الإحماء"],
      });
      assert.match(p, /طبيعة المادة/);
      assert.match(p, /"priorReview"/);
      assert.match(p, /أعد JSON/);
    }
  });
});
