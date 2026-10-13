import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseDateRange, parseMetricInput, parsePublicIdea, parseSiteSignup, signupSource, siteKeyMatches, toCsv } from "../adminMetrics.ts";

describe("parseDateRange", () => {
  it("is open-ended when absent and makes `to` inclusive of its day", () => {
    assert.deepEqual(parseDateRange({}), {});
    const r = parseDateRange({ from: "2026-10-01", to: "2026-10-02" }) as { from: Date; to: Date };
    assert.equal(r.from.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(r.to.toISOString(), "2026-10-03T00:00:00.000Z");
  });
  it("rejects bad dates and inverted ranges", () => {
    assert.ok("error" in parseDateRange({ from: "1/10/2026" }));
    assert.ok("error" in parseDateRange({ from: "2026-10-05", to: "2026-10-01" }));
  });
});

describe("signupSource", () => {
  it("keeps only known platforms and a clipped referrer", () => {
    assert.deepEqual(signupSource({ "x-iqraa-platform": "android" }), { signupPlatform: "android", signupReferrer: null });
    assert.deepEqual(signupSource({ "x-iqraa-platform": "tv", "x-iqraa-landing": "  https://iqrra.com/ " }),
      { signupPlatform: null, signupReferrer: "https://iqrra.com/" });
    assert.equal((signupSource({ "x-iqraa-landing": "a".repeat(400) }).signupReferrer ?? "").length, 300);
  });
});

describe("parseMetricInput", () => {
  const today = "2026-10-01";
  it("accepts a known key and defaults the date to today", () => {
    assert.deepEqual(parseMetricInput({ key: "instagram", value: "120" }, today), {
      key: "instagram", value: 120, recordedOn: today,
    });
  });
  it("rejects unknown keys, negatives, fractions, bad and future dates", () => {
    assert.ok("error" in parseMetricInput({ key: "tiktok", value: 1 }, today));
    assert.ok("error" in parseMetricInput({ key: "x", value: -1 }, today));
    assert.ok("error" in parseMetricInput({ key: "x", value: 1.5 }, today));
    assert.ok("error" in parseMetricInput({ key: "x", value: 1, date: "1/10/2026" }, today));
    assert.ok("error" in parseMetricInput({ key: "x", value: 1, date: "2026-10-02" }, today));
  });
});

describe("parseSiteSignup", () => {
  it("needs a plausible email for the waitlist", () => {
    assert.ok("error" in parseSiteSignup({ kind: "waitlist", email: "nope" }));
    assert.equal((parseSiteSignup({ kind: "waitlist", email: " a@b.co " }) as { email: string }).email, "a@b.co");
  });
  it("needs a message for contact, email optional", () => {
    assert.ok("error" in parseSiteSignup({ kind: "contact", message: "hi" }));
    assert.ok(!("error" in parseSiteSignup({ kind: "contact", message: "hello there" })));
  });
  it("rejects an unknown kind", () => {
    assert.ok("error" in parseSiteSignup({ kind: "spam", email: "a@b.co" }));
  });
});

describe("siteKeyMatches", () => {
  it("is closed when unset and exact otherwise", () => {
    assert.equal(siteKeyMatches(undefined, ""), false);
    assert.equal(siteKeyMatches("", ""), false);
    assert.equal(siteKeyMatches("secret", "secre"), false);
    assert.equal(siteKeyMatches("secret", undefined), false);
    assert.equal(siteKeyMatches("secret", "secret"), true);
  });
});

describe("toCsv", () => {
  it("quotes commas/quotes/newlines and defuses formulas", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=HYPERLINK(1)", "-2\nz"]]);
    assert.equal(csv, 'a,b\r\n"x,y","say ""hi"""\r\n\'=HYPERLINK(1),"\'-2\nz"\r\n');
  });
});

// «اقترح ميزة» from a visitor with no account (POST /site/ideas). Public, so the
// parser is the first line of defence: a honeypot, a floor and a ceiling on the
// message, and an email that is optional but must look like one if given.
describe("parsePublicIdea", () => {
  it("accepts an idea with no email, tagged as an idea", () => {
    const r = parsePublicIdea({ message: "  تصدير ورقة العمل إلى Word  " });
    assert.deepEqual(r, { kind: "idea", email: "", name: "", message: "تصدير ورقة العمل إلى Word", context: "" });
  });
  it("keeps a valid email and a clipped context", () => {
    const r = parsePublicIdea({ message: "dark mode please", email: " t@school.jo ", context: "x".repeat(900) });
    assert.ok(!("error" in r) && !("spam" in r));
    if ("kind" in r) {
      assert.equal(r.email, "t@school.jo");
      assert.equal(r.context.length, 500);
    }
  });
  it("refuses a malformed email instead of storing it", () => {
    assert.deepEqual(parsePublicIdea({ message: "dark mode please", email: "nope" }), { error: "email" });
  });
  it("needs a message that says something, and caps a runaway paste", () => {
    for (const message of [undefined, "", "   ", "hi"]) {
      assert.deepEqual(parsePublicIdea({ message }), { error: "message" }, String(message));
    }
    const r = parsePublicIdea({ message: "x".repeat(5000) });
    assert.equal("kind" in r && r.message.length, 2000);
  });
  it("flags a filled honeypot as spam, so the route can answer ok and store nothing", () => {
    assert.deepEqual(parsePublicIdea({ message: "buy cheap watches", website: "http://spam.example" }), { spam: true });
  });
  it("survives a non-object body", () => {
    assert.deepEqual(parsePublicIdea(null), { error: "message" });
    assert.deepEqual(parsePublicIdea("idea"), { error: "message" });
  });
});
