/**
 * What this guards: who a code is allowed to attach to whom.
 *
 * A class join code is one string handed to thirty families, so the three rules
 * below are the only thing standing between "the roster" and "any name on it".
 * They are checked here rather than through the routes because importing
 * anything that reaches @workspace/db needs a live database (see the header of
 * ../claimDecision.ts) — this file imports the decision alone, no pool, no
 * DATABASE_URL.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideClaim, type ClaimInput } from "../claimDecision.ts";

const NOW = new Date("2026-09-05T12:00:00Z");
const LIVE = new Date("2026-10-05T12:00:00Z");
const DEAD = new Date("2026-08-05T12:00:00Z");

/** Nothing found, nothing linked, nobody in any class — each test opts into what it needs. */
const base: ClaimInput = {
  now: NOW,
  role: "parent",
  student: null,
  classGroup: null,
  isMember: async () => false,
  hasSelfLink: async () => false,
};

const decide = (over: Partial<ClaimInput>) => decideClaim({ ...base, ...over });

describe("per-student claim codes", () => {
  it("resolves without a studentId, exactly as before class codes existed", async () => {
    const got = await decide({ student: { id: "stu-1", expiresAt: LIVE } });
    assert.deepEqual(got, { ok: true, studentId: "stu-1", relation: "guardian" });
  });

  it("ignores a studentId sent alongside one — the code already names its student", async () => {
    const got = await decide({
      student: { id: "stu-1", expiresAt: LIVE },
      requestedStudentId: "stu-99",
    });
    assert.deepEqual(got, { ok: true, studentId: "stu-1", relation: "guardian" });
  });

  it("refuses an expired one", async () => {
    const got = await decide({ student: { id: "stu-1", expiresAt: DEAD } });
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.status, 400);
  });

  it("refuses one that was never given an expiry", async () => {
    const got = await decide({ student: { id: "stu-1", expiresAt: null } });
    assert.equal(got.ok, false);
  });
});

describe("class join codes", () => {
  const classGroup = { id: "cls-1", expiresAt: LIVE };
  const inClass: Partial<ClaimInput> = { classGroup, isMember: async () => true };

  it("refuses a live code with no name picked, and says so distinctly", async () => {
    const got = await decide({ classGroup });
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.status, 400);
    // Not the "invalid or expired" wording: the code worked, the joiner just
    // has one more step, and telling them otherwise sends them back to the
    // teacher for a code that was fine.
    assert.match(got.ok === false ? got.error : "", /name/i);
  });

  it("refuses a name that is not on this class list", async () => {
    const got = await decide({ classGroup, requestedStudentId: "stu-9", isMember: async () => false });
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.status, 400);
  });

  it("resolves a member name", async () => {
    const got = await decide({ ...inClass, requestedStudentId: "stu-1" });
    assert.deepEqual(got, { ok: true, studentId: "stu-1", relation: "guardian" });
  });

  it("refuses an expired class code even when the name is a real member", async () => {
    const got = await decide({
      classGroup: { id: "cls-1", expiresAt: DEAD },
      requestedStudentId: "stu-1",
      isMember: async () => true,
    });
    assert.equal(got.ok, false);
  });

  it("checks membership against the class the code belongs to", async () => {
    const seen: Array<[string, string]> = [];
    await decide({
      classGroup,
      requestedStudentId: "stu-1",
      isMember: async (studentId, classGroupId) => {
        seen.push([studentId, classGroupId]);
        return true;
      },
    });
    assert.deepEqual(seen, [["stu-1", "cls-1"]]);
  });

  it("never asks about membership on the per-student path", async () => {
    let asked = false;
    await decide({
      student: { id: "stu-1", expiresAt: LIVE },
      isMember: async () => {
        asked = true;
        return false;
      },
    });
    assert.equal(asked, false);
  });
});

describe("one account per student", () => {
  const classGroup = { id: "cls-1", expiresAt: LIVE };

  it("refuses a second student on the same name, with 409", async () => {
    const got = await decide({
      role: "student",
      classGroup,
      requestedStudentId: "stu-1",
      isMember: async () => true,
      hasSelfLink: async () => true,
    });
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.status, 409);
  });

  it("allows a second guardian on the same name — both parents is the normal case", async () => {
    const got = await decide({
      role: "parent",
      classGroup,
      requestedStudentId: "stu-1",
      isMember: async () => true,
      hasSelfLink: async () => true,
    });
    assert.deepEqual(got, { ok: true, studentId: "stu-1", relation: "guardian" });
  });

  it("guards the per-student code path too", async () => {
    const got = await decide({
      role: "student",
      student: { id: "stu-1", expiresAt: LIVE },
      hasSelfLink: async () => true,
    });
    assert.equal(got.ok === false && got.status, 409);
  });

  it("checks the link against the picked name, not the code", async () => {
    const seen: string[] = [];
    await decide({
      role: "student",
      classGroup,
      requestedStudentId: "stu-7",
      isMember: async () => true,
      hasSelfLink: async id => {
        seen.push(id);
        return false;
      },
    });
    assert.deepEqual(seen, ["stu-7"]);
  });
});

describe("no code at all", () => {
  it("refuses when neither lookup matched", async () => {
    const got = await decide({ requestedStudentId: "stu-1" });
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.status, 400);
  });
});
