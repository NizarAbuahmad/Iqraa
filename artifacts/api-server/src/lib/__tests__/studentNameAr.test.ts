import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkNameAr, MAX_NAME_AR_LENGTH } from "../studentNameAr.ts";

describe("checkNameAr", () => {
  it("accepts an Arabic name and tidies its spacing", () => {
    assert.deepEqual(checkNameAr("  أحمد   علي "), { ok: true, value: "أحمد علي" });
  });

  it("keeps harakat and a hyphenated or apostrophe name", () => {
    assert.deepEqual(checkNameAr("عَبْد-الله"), { ok: true, value: "عَبْد-الله" });
  });

  it("treats empty as 'not recorded', which clears the field", () => {
    assert.deepEqual(checkNameAr(""), { ok: true, value: "" });
    assert.deepEqual(checkNameAr("   "), { ok: true, value: "" });
  });

  it("refuses a Latin name: the field exists to hold the Arabic one", () => {
    assert.deepEqual(checkNameAr("ahmad"), { ok: false, code: "student_name_ar_invalid" });
  });

  it("refuses Latin letters or digits mixed into an Arabic name", () => {
    assert.deepEqual(checkNameAr("أحمد ahmad"), { ok: false, code: "student_name_ar_invalid" });
    assert.deepEqual(checkNameAr("أحمد 2"), { ok: false, code: "student_name_ar_invalid" });
    assert.deepEqual(checkNameAr("أحمد ٢"), { ok: false, code: "student_name_ar_invalid" });
  });

  it("refuses punctuation with no letter in it", () => {
    assert.deepEqual(checkNameAr("-"), { ok: false, code: "student_name_ar_invalid" });
  });

  it("refuses a value that is not a string", () => {
    assert.deepEqual(checkNameAr(null), { ok: false, code: "student_name_ar_invalid" });
    assert.deepEqual(checkNameAr(12), { ok: false, code: "student_name_ar_invalid" });
  });

  it("refuses an over-long name", () => {
    assert.deepEqual(checkNameAr("ع".repeat(MAX_NAME_AR_LENGTH + 1)), { ok: false, code: "student_name_ar_too_long" });
    assert.equal(checkNameAr("ع".repeat(MAX_NAME_AR_LENGTH)).ok, true);
  });
});
