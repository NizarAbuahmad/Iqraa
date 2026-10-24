// artifacts/api-server/src/lib/__tests__/guardianGate.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { guardianMayReach, guardianStatus, needsLinkLookup, pendingGuardian } from "../guardianGate.ts";

const student = { role: "student", email: "s@example.test", guardianApprovedAt: null as Date | null };
const NOW = new Date("2026-10-24T12:00:00Z");
const later = new Date("2026-10-31T12:00:00Z");
const earlier = new Date("2026-10-20T12:00:00Z");

describe("pendingGuardian", () => {
  it("holds an email student with no approval and no teacher link, when the flag is on", () => {
    assert.equal(pendingGuardian(student, { flagOn: true, hasLiveLink: false }), true);
  });
  it("never holds anyone when the flag is off", () => {
    assert.equal(pendingGuardian(student, { flagOn: false, hasLiveLink: false }), false);
  });
  it("does not hold a student a teacher has vouched for (live roster link)", () => {
    assert.equal(pendingGuardian(student, { flagOn: true, hasLiveLink: true }), false);
  });
  it("does not hold a code-only student (no email)", () => {
    assert.equal(pendingGuardian({ ...student, email: null }, { flagOn: true, hasLiveLink: false }), false);
  });
  it("does not hold an approved student", () => {
    assert.equal(pendingGuardian({ ...student, guardianApprovedAt: earlier }, { flagOn: true, hasLiveLink: false }), false);
  });
  it("does not hold a teacher, a parent or an admin", () => {
    for (const role of ["teacher", "parent", "school_admin", "system_admin"]) {
      assert.equal(pendingGuardian({ ...student, role }, { flagOn: true, hasLiveLink: false }), false, role);
    }
  });
});

describe("needsLinkLookup", () => {
  it("is true only for the candidates, so the link query runs for almost nobody", () => {
    assert.equal(needsLinkLookup(student, true), true);
    assert.equal(needsLinkLookup(student, false), false);
    assert.equal(needsLinkLookup({ ...student, role: "teacher" }, true), false);
    assert.equal(needsLinkLookup({ ...student, email: null }, true), false);
    assert.equal(needsLinkLookup({ ...student, guardianApprovedAt: earlier }, true), false);
  });
});

describe("guardianMayReach", () => {
  const may: [string, string][] = [
    ["GET", "/api/auth/me"],
    ["POST", "/api/auth/guardian-request"],
    ["POST", "/api/auth/logout"],
    ["DELETE", "/api/auth/users/me"],
    ["GET", "/api/auth/claim"],
    ["POST", "/api/auth/claim"],
    ["DELETE", "/api/auth/claim"],
    ["get", "/api/auth/me?x=1"],
    ["GET", "/auth/me/"],
  ];
  for (const [method, url] of may) {
    it(`lets ${method} ${url} through`, () => assert.equal(guardianMayReach(method, url), true));
  }
  const may_not: [string, string][] = [
    ["GET", "/api/student/exams"],
    ["POST", "/api/auth/role"],
    ["PATCH", "/api/auth/me"],
    ["GET", "/api/auth/me/ai-usage"],
    ["POST", "/api/auth/add-email"],
    ["GET", "/api/messaging/contacts"],
    ["DELETE", "/api/auth/users/avatar"],
  ];
  for (const [method, url] of may_not) {
    it(`stops ${method} ${url}`, () => assert.equal(guardianMayReach(method, url), false));
  }
});

describe("guardianStatus", () => {
  const base = { flagOn: true, hasLiveLink: false, now: NOW };
  it("is not_required when the flag is off, for a non-student, with no email, or when linked", () => {
    assert.equal(guardianStatus(student, { ...base, flagOn: false, request: null }), "not_required");
    assert.equal(guardianStatus({ ...student, role: "teacher" }, { ...base, request: null }), "not_required");
    assert.equal(guardianStatus({ ...student, email: null }, { ...base, request: null }), "not_required");
    assert.equal(guardianStatus(student, { ...base, hasLiveLink: true, request: null }), "not_required");
  });
  it("is approved once guardian_approved_at is set, even if later linked", () => {
    const s = { ...student, guardianApprovedAt: earlier };
    assert.equal(guardianStatus(s, { ...base, request: null }), "approved");
    assert.equal(guardianStatus(s, { ...base, hasLiveLink: true, request: null }), "approved");
  });
  it("is needed with no request, or when the open request has expired", () => {
    assert.equal(guardianStatus(student, { ...base, request: null }), "needed");
    assert.equal(guardianStatus(student, { ...base, request: { decision: null, expiresAt: earlier } }), "needed");
  });
  it("is waiting for an open request, issued or not yet issued", () => {
    assert.equal(guardianStatus(student, { ...base, request: { decision: null, expiresAt: later } }), "waiting");
    assert.equal(guardianStatus(student, { ...base, request: { decision: null, expiresAt: null } }), "waiting");
  });
  it("is declined when the latest request was declined", () => {
    assert.equal(guardianStatus(student, { ...base, request: { decision: "declined", expiresAt: later } }), "declined");
  });
});
