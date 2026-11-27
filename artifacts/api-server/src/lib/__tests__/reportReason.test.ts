/**
 * The optional "what is wrong" text on a «بلّغ عن مشكلة» report.
 *
 * It is free text from a teacher (or a student), shown to admins in an email
 * and on the review card, so it is cut to a sane size and stripped of control
 * characters before it is stored. Empty is always valid: a report is a claim
 * with or without a reason, and a missing reason must never block one.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_REPORT_REASON, normalizeReportReason } from "../reportReason.ts";

describe("normalizeReportReason", () => {
  it("keeps what the reporter wrote, trimmed", () => {
    assert.equal(normalizeReportReason("  المثال الثاني خاطئ  "), "المثال الثاني خاطئ");
  });

  it("reads anything that is not a string as no reason", () => {
    for (const v of [undefined, null, 42, true, {}, ["x"]]) {
      assert.equal(normalizeReportReason(v), "", String(v));
    }
  });

  it("reads blank text as no reason", () => {
    assert.equal(normalizeReportReason("   \n\t "), "");
  });

  it("cuts a runaway paste to the cap", () => {
    const out = normalizeReportReason("ا".repeat(MAX_REPORT_REASON + 300));
    assert.equal(out.length, MAX_REPORT_REASON);
  });

  it("drops control characters but keeps line breaks", () => {
    assert.equal(normalizeReportReason("سطر\u0000 أول\nسطر ثانٍ\u0007"), "سطر أول\nسطر ثانٍ");
  });
});
