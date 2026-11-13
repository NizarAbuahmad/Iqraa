/**
 * The live lesson plan is told the lesson's TYPE inside its subject, and the
 * grade's homework and closure size — the same two things the offline plan
 * decides (`artifacts/mobile/services/ai/lessonTypes.ts`, `lessonPlanTyped.ts`).
 *
 *     node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/lessonTypePrompts.test.ts
 *
 * Before this the subject clause was the whole story: an Islamic lesson on the
 * wudu was asked for choral reading and pronunciation, a drama lesson for "a
 * product", and a Grade 2 plan for any homework at all. The app sends
 * `lessonType`, read from the lesson's id; the request is client-controlled,
 * so an unknown type, or one from another subject, must add nothing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { lessonPlanPromptAr, lessonPlanPromptEn } from "../prompts.ts";
import {
  KIND_OF_TYPE, LESSON_TYPES, gradeBandClauseAr, gradeLevelOf, lessonTypeClauseAr, lessonTypeClauseEn, lessonTypeOf,
} from "../lessonKinds.ts";

/** Grade 4: Islamic and Arabic types hold up to Grade 6, and Grade 4 adds the five-sentence band. */
const base = { grade: "الصف الرابع", topic: "موضوع الاختبار", duration: 45 };

const mobileSource = readFileSync(
  fileURLToPath(new URL("../../../../mobile/services/ai/lessonTypes.ts", import.meta.url)),
  "utf8",
);

describe("the lesson-type list", () => {
  it("is the same list the app sends", () => {
    const block = mobileSource.slice(mobileSource.indexOf("export const LESSON_TYPES"), mobileSource.indexOf("] as const;"));
    const types = [...block.matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
    assert.deepEqual(types, [...LESSON_TYPES]);
  });

  it("maps each type to the same kind as the app", () => {
    const block = mobileSource.slice(mobileSource.indexOf("export const KIND_OF_TYPE"), mobileSource.indexOf("};", mobileSource.indexOf("export const KIND_OF_TYPE")));
    const pairs: Record<string, string> = {};
    for (const m of block.matchAll(/'?([a-z-]+)'?:\s*'([a-z]+)'/g)) pairs[m[1]!] = m[2]!;
    assert.deepEqual(pairs, KIND_OF_TYPE);
  });
});

describe("the lesson-type clause", () => {
  it("is added only for a known type that belongs to the request's subject", () => {
    assert.equal(lessonTypeOf({ subjectId: "islamic", lessonType: "creed" }), "creed");
    assert.equal(lessonTypeOf({ subject: "التربية الإسلامية", lessonType: "hadith" }), "hadith");
    assert.equal(lessonTypeOf({ subjectId: "creative-arts", lessonType: "drama" }), "drama");
    assert.equal(lessonTypeOf({ subjectId: "arabic", lessonType: "listening" }), "listening");
    // Another subject's type, an unknown one, a non-string, maths.
    assert.equal(lessonTypeOf({ subjectId: "arabic", lessonType: "drama" }), null);
    assert.equal(lessonTypeOf({ subjectId: "islamic", lessonType: "astrology" }), null);
    assert.equal(lessonTypeOf({ subjectId: "islamic", lessonType: { evil: true } }), null);
    assert.equal(lessonTypeOf({ subjectId: "mathematics", lessonType: "quran" }), null);
    assert.equal(lessonTypeClauseAr({ subjectId: "arabic", lessonType: "drama" }), "");
  });

  it("is added only to a direct-style plan, as offline", () => {
    for (const teachingStyle of ["inquiry", "collaborative"]) {
      assert.equal(lessonTypeOf({ subjectId: "islamic", lessonType: "hadith", teachingStyle }), null, teachingStyle);
      assert.doesNotMatch(lessonPlanPromptAr({ ...base, subject: "التربية الإسلامية", lessonType: "hadith", teachingStyle }), /نوع الدرس:/);
    }
    assert.equal(lessonTypeOf({ subjectId: "islamic", lessonType: "hadith", teachingStyle: "direct" }), "hadith");
  });

  it("holds Islamic and Arabic types to Grades 1–6, and the arts types in every grade", () => {
    assert.equal(lessonTypeOf({ subjectId: "islamic", lessonType: "conduct", grade: "الصف العاشر" }), null);
    assert.equal(lessonTypeOf({ subjectId: "arabic", lessonType: "listening", grade: "grade-7" }), null);
    assert.equal(lessonTypeOf({ subjectId: "arabic", lessonType: "listening", grade: "الصف السادس" }), "listening");
    assert.equal(lessonTypeOf({ subjectId: "creative-arts", lessonType: "drama", grade: "الصف العاشر" }), "drama");
  });

  it("gives every type its own wording in both languages", () => {
    const ar = LESSON_TYPES.map(t => lessonTypeClauseAr({ subjectId: subjectOf(t), lessonType: t, grade: base.grade }));
    const en = LESSON_TYPES.map(t => lessonTypeClauseEn({ subjectId: subjectOf(t), lessonType: t, grade: base.grade }));
    assert.equal(new Set(ar).size, LESSON_TYPES.length);
    assert.equal(new Set(en).size, LESSON_TYPES.length);
    for (const c of ar) assert.match(c, /^نوع الدرس: /);
    for (const c of en) assert.match(c, /^Lesson type: /);
  });

  it("sits after the subject clause, so it can override it", () => {
    const a = lessonPlanPromptAr({ ...base, subject: "التربية الإسلامية", lessonType: "worship" });
    const e = lessonPlanPromptEn({ ...base, subject: "Islamic Studies", lessonType: "worship" });
    assert.ok(a.indexOf("نوع الدرس:") > a.indexOf("طبيعة المادة"));
    assert.ok(e.indexOf("Lesson type:") > e.indexOf("Nature of the subject"));
    assert.match(a, /يحلّ محلّ ما يخالفه في بند طبيعة المادة/);
  });

  it("tells a listening lesson that students do not read the text, and a drama lesson that nothing is made", () => {
    const listening = lessonPlanPromptAr({ ...base, subject: "اللغة العربية", lessonType: "listening" });
    assert.match(listening, /الكتب مغلقة/);
    assert.match(listening, /لا قراءة جهرية من الطلبة/);
    const drama = lessonPlanPromptEn({ ...base, subject: "Art, Music and Drama Education", subjectId: "creative-arts", lessonType: "drama" });
    assert.match(drama, /No "finished model" and no product to make/);
  });

  it("leaves a request with no type exactly as it was", () => {
    const a = lessonPlanPromptAr({ ...base, subject: "التربية الإسلامية" });
    assert.doesNotMatch(a, /نوع الدرس:/);
    assert.doesNotMatch(lessonPlanPromptEn({ ...base, subject: "Islamic Studies" }), /Lesson type:/);
  });
});

describe("homework and closure sized to the grade", () => {
  it("reads the grade as the app and the API send it", () => {
    assert.equal(gradeLevelOf("الصف الثاني"), 2);
    assert.equal(gradeLevelOf("الصف الثاني عشر"), 12);
    assert.equal(gradeLevelOf("grade-2"), 2);
    assert.equal(gradeLevelOf("Grade 5"), 5);
    assert.equal(gradeLevelOf(undefined), null);
  });

  it("asks a Grade 2 plan for one short task and an oral close, in every subject", () => {
    for (const subject of ["الرياضيات", "التربية الإسلامية", "اللغة العربية"]) {
      const a = lessonPlanPromptAr({ ...base, grade: "الصف الثاني", subject });
      assert.match(a, /مهمة واحدة قصيرة/);
      assert.match(a, /"closure" شفويًا/);
    }
    assert.match(lessonPlanPromptEn({ ...base, grade: "Grade 2", subject: "Mathematics" }), /one short task/);
  });

  it("caps Grades 4–6 at five sentences, and leaves Grade 7 and up alone", () => {
    assert.match(gradeBandClauseAr({ grade: "الصف الخامس" }), /خمس جمل/);
    assert.equal(gradeBandClauseAr({ grade: "الصف العاشر" }), "");
    assert.equal(gradeBandClauseAr({ grade: "something else" }), "");
    assert.doesNotMatch(lessonPlanPromptAr({ ...base, grade: "الصف العاشر", subject: "الرياضيات" }), /مهمة واحدة قصيرة|خمس جمل/);
  });
});

function subjectOf(t: (typeof LESSON_TYPES)[number]): string {
  return ({ recitation: "islamic", making: "creative-arts", arabic: "arabic" } as Record<string, string>)[KIND_OF_TYPE[t]]!;
}
