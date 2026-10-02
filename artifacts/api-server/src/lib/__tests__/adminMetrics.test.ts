import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseMetricInput, parseSiteSignup, siteKeyMatches, toCsv } from "../adminMetrics.ts";

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
