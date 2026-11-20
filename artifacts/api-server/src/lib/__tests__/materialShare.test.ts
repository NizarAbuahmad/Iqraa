/**
 * What this guards: the two pure halves of a material's share link.
 *
 * The code is the only credential a share link has and it never expires, so it
 * must be long enough not to walk (8 characters, not the exam's 6) and read back
 * from a WhatsApp message unambiguously. And a colleague's saved copy must keep
 * the pickers that reopen the right lesson, but never the owner's own notes —
 * a lesson plan's `adaptations` can name a pupil.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SHARE_CODE_ALPHABET } from "../shareCodeAlphabet.ts";
import {
  MATERIAL_SHARE_CODE_LENGTH,
  copyableFormState,
  generateMaterialShareCode,
  normalizeMaterialShareCode,
} from "../materialShare.ts";

describe("material share codes", () => {
  it("are 8 characters from the unambiguous alphabet", () => {
    assert.equal(MATERIAL_SHARE_CODE_LENGTH, 8);
    for (let i = 0; i < 200; i++) {
      const code = generateMaterialShareCode();
      assert.equal(code.length, 8);
      for (const ch of code) assert.ok(SHARE_CODE_ALPHABET.includes(ch), `${ch} in ${code}`);
    }
  });

  it("normalizes what a person might paste, and refuses anything else", () => {
    assert.equal(normalizeMaterialShareCode(" k7qx4mpa "), "K7QX4MPA");
    assert.equal(normalizeMaterialShareCode("K7QX4MPA"), "K7QX4MPA");
    for (const bad of ["K7QX4M", "K7QX4MPAA", "K7QX4MP0", "K7QX4MPI", "", null, undefined, 12345678, ["K7QX4MPA"]]) {
      assert.equal(normalizeMaterialShareCode(bad), null, String(bad));
    }
  });
});

describe("copyableFormState", () => {
  it("keeps the pickers that reopen the lesson, and drops the owner's own notes", () => {
    const kept = copyableFormState({
      gradeIdx: 0, subjectIdx: 2, topic: "قانون الجيوب", lessonId: "g10-math-u3-l2",
      scope: JSON.stringify({ kind: "unit", unitId: "u3" }), isHomework: true, numQIdx: 3,
      priorTopicsNotes: "راجعنا الزوايا الخاصة", adaptations: "سارة تحتاج خطًا أكبر",
      objectives: "أن يطبّق الطالب القانون", objective: "تعاون", notes: "ملاحظة", additionalContext: "نص المعلم",
      nested: { a: 1 }, list: [1, 2], long: "س".repeat(300),
    });
    assert.deepEqual(kept, {
      gradeIdx: 0, subjectIdx: 2, topic: "قانون الجيوب", lessonId: "g10-math-u3-l2",
      scope: JSON.stringify({ kind: "unit", unitId: "u3" }), isHomework: true, numQIdx: 3,
    });
  });

  it("is empty for anything that is not an object", () => {
    for (const v of [null, undefined, "x", 3, ["a"]]) assert.deepEqual(copyableFormState(v), {});
  });
});
