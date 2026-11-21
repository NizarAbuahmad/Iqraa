/**
 * The teacher newsletter's rules (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md):
 * who may receive it, and that a send is refused unless the exact text was test-sent in the
 * last 24 hours. Pure: no database, no mail.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  newsletterHash,
  parseNewsletter,
  pickTeacherRecipients,
  sendDecision,
  teacherUnsubscribeUrl,
  TEACHER_FOOTER,
  TEST_MAX_AGE_MS,
  type TeacherRow,
} from "../newsletter.ts";
import { readEmailUnsubscribeToken } from "../emailUnsubscribe.ts";
import { BODY_MAX, SUBJECT_MAX } from "../siteMail.ts";

let n = 0;
const row = (over: Partial<TeacherRow> = {}): TeacherRow => ({
  id: `id-${++n}`,
  email: `t${n}@school.jo`,
  role: "teacher",
  emailVerified: true,
  suspendedAt: null,
  ...over,
});

describe("pickTeacherRecipients", () => {
  it("takes verified, unsuspended teachers and school admins with a valid address", () => {
    const keep = row();
    const principal = row({ role: "school_admin" });
    const out = pickTeacherRecipients([
      keep,
      principal,
      row({ role: "student" }),
      row({ role: "parent" }),
      row({ role: "system_admin" }),
      row({ emailVerified: false }),
      row({ suspendedAt: new Date() }),
      row({ email: null }),
      row({ email: "not-an-address" }),
    ]);
    assert.deepEqual(out, [
      { id: keep.id, email: keep.email },
      { id: principal.id, email: principal.email },
    ]);
  });

  it("sends one copy to an address, whatever its case", () => {
    const first = row({ email: "Same@School.jo" });
    const out = pickTeacherRecipients([first, row({ email: "same@school.jo" })]);
    assert.deepEqual(out, [{ id: first.id, email: "Same@School.jo" }]);
  });

  it("keeps an address when its first row is ineligible and a later one, in another case, is", () => {
    const later = row({ email: "same@school.jo" });
    const out = pickTeacherRecipients([row({ email: "Same@School.jo", emailVerified: false }), later]);
    assert.deepEqual(out, [{ id: later.id, email: "same@school.jo" }]);
  });
});

describe("parseNewsletter", () => {
  it("trims and returns the text", () => {
    assert.deepEqual(parseNewsletter({ subject: "  Hello  ", body: "  ten chars!  " }), { subject: "Hello", text: "ten chars!" });
  });
  it("refuses a short or missing subject or body", () => {
    assert.deepEqual(parseNewsletter({ subject: "ab", body: "long enough body" }), { error: "subject" });
    assert.deepEqual(parseNewsletter({ subject: "Hello", body: "short" }), { error: "body" });
    assert.deepEqual(parseNewsletter(null), { error: "subject" });
    assert.deepEqual(parseNewsletter({ subject: "x".repeat(151), body: "long enough body" }), { error: "subject" });
    assert.deepEqual(parseNewsletter({ subject: "Hello", body: "x".repeat(10_001) }), { error: "body" });
  });
  it("accepts the exact limits", () => {
    const body = "b".repeat(10);
    assert.deepEqual(parseNewsletter({ subject: "abc", body }), { subject: "abc", text: body });
    const longSubject = "s".repeat(SUBJECT_MAX);
    assert.deepEqual(parseNewsletter({ subject: longSubject, body }), { subject: longSubject, text: body });
    const longBody = "b".repeat(BODY_MAX);
    assert.deepEqual(parseNewsletter({ subject: "abc", body: longBody }), { subject: "abc", text: longBody });
  });
});

describe("sendDecision", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const tested = (ago: number, subject = "Hello", text = "The body text") => ({
    contentHash: newsletterHash(subject, text),
    testedAt: new Date(now.getTime() - ago),
  });

  it("accepts the text that was tested", () => {
    assert.equal(sendDecision(tested(60_000), "Hello", "The body text", now), "ok");
  });
  it("refuses when nothing was tested", () => {
    assert.equal(sendDecision(null, "Hello", "The body text", now), "not-tested");
    assert.equal(sendDecision(undefined, "Hello", "The body text", now), "not-tested");
  });
  it("refuses a body or a subject edited after the test, even by one character", () => {
    assert.equal(sendDecision(tested(60_000), "Hello", "The body text.", now), "not-tested");
    assert.equal(sendDecision(tested(60_000), "Hello!", "The body text", now), "not-tested");
  });
  it("refuses a test older than 24 hours", () => {
    assert.equal(sendDecision(tested(TEST_MAX_AGE_MS + 1), "Hello", "The body text", now), "test-expired");
    assert.equal(sendDecision(tested(TEST_MAX_AGE_MS - 1), "Hello", "The body text", now), "ok");
  });
  it("fails closed on an unreadable testedAt", () => {
    const issue = { contentHash: newsletterHash("Hello", "The body text"), testedAt: new Date(NaN) };
    assert.equal(sendDecision(issue, "Hello", "The body text", now), "test-expired");
  });
  it("refuses a test exactly 24 hours old", () => {
    assert.equal(sendDecision(tested(TEST_MAX_AGE_MS), "Hello", "The body text", now), "test-expired");
  });
  it("does not confuse where the subject ends and the body begins", () => {
    assert.notEqual(newsletterHash("ab", "c long enough"), newsletterHash("a", "bc long enough"));
  });
});

describe("TEACHER_FOOTER", () => {
  it("says why the teacher got the mail, in both languages", () => {
    assert.deepEqual(TEACHER_FOOTER, {
      ar: "تصلك هذه الرسالة لأن لديك حساب معلّم في إقرأ.",
      en: "You received this because you have a teacher account on Iqrra.",
    });
  });
});

describe("teacherUnsubscribeUrl", () => {
  it("is the per-address unsubscribe link", () => {
    const before = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "s".repeat(32);
    try {
      const url = teacherUnsubscribeUrl({ email: "T@School.jo" });
      const token = new URL(url).searchParams.get("t");
      assert.match(url, /\/api\/email\/unsubscribe\?t=/);
      assert.equal(readEmailUnsubscribeToken(token), "t@school.jo");
    } finally {
      if (before === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = before;
    }
  });
});
