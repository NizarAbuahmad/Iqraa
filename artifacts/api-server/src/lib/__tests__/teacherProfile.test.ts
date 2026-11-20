import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TEACHER_PROFILE_OPTIONS, parseTeacherProfile, teacherProfileOf } from "../teacherProfile.ts";

describe("teacher profile", () => {
  it("offers closed lists, including Jordan's twelve governorates", () => {
    assert.deepEqual(TEACHER_PROFILE_OPTIONS.gender, ["male", "female", "unspecified"]);
    assert.deepEqual(TEACHER_PROFILE_OPTIONS.ageRange, ["20-29", "30-39", "40-49", "50+"]);
    assert.deepEqual(TEACHER_PROFILE_OPTIONS.yearsTeaching, ["0-2", "3-5", "6-10", "11+"]);
    assert.equal(TEACHER_PROFILE_OPTIONS.governorate.length, 12);
    assert.ok(TEACHER_PROFILE_OPTIONS.governorate.includes("amman"));
  });

  it("takes known values, clears with null, and leaves an absent field alone", () => {
    assert.deepEqual(parseTeacherProfile({ gender: "female", ageRange: "30-39", governorate: null }), {
      ok: true,
      updates: { gender: "female", ageRange: "30-39", governorate: null },
    });
    assert.deepEqual(parseTeacherProfile({}), { ok: true, updates: {} });
  });

  it("refuses an unknown value, a non-object, and free text", () => {
    assert.equal(parseTeacherProfile({ gender: "other" }).ok, false);
    assert.equal(parseTeacherProfile({ governorate: "Amman" }).ok, false);
    assert.equal(parseTeacherProfile({ yearsTeaching: 5 }).ok, false);
    assert.equal(parseTeacherProfile("female").ok, false);
    assert.equal(parseTeacherProfile(null).ok, false);
    assert.equal(parseTeacherProfile([]).ok, false);
  });

  it("ignores keys that are not profile fields", () => {
    assert.deepEqual(parseTeacherProfile({ role: "system_admin", gender: "male" }), {
      ok: true,
      updates: { gender: "male" },
    });
  });

  it("reads the four columns back as one object", () => {
    assert.deepEqual(
      teacherProfileOf({ gender: "male", ageRange: null, governorate: "irbid", yearsTeaching: "11+" }),
      { gender: "male", ageRange: null, governorate: "irbid", yearsTeaching: "11+" },
    );
  });
});
