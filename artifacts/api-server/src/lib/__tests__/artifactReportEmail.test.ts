/**
 * The admin's «تقرير محتوى جديد» email. Before 2026-11-11 it said only that
 * *something* was wrong with a lesson: the report carried no reason. It now
 * quotes the reporter's words, which are free text, so they must be escaped.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { artifactReportedBodyHtml } from "../email.ts";

const info = { kind: "lesson", lessonRef: "الكسور" };

describe("artifactReportedBodyHtml", () => {
  it("quotes the reason in both the Arabic and the English block", () => {
    const html = artifactReportedBodyHtml({ ...info, reason: "المثال الثاني خاطئ" });
    assert.equal(html.split("المثال الثاني خاطئ").length - 1, 2);
    assert.match(html, /سبب البلاغ/);
    assert.match(html, /Reason given/);
  });

  it("says nothing about a reason when there is none", () => {
    for (const reason of [undefined, ""]) {
      const html = artifactReportedBodyHtml({ ...info, reason });
      assert.doesNotMatch(html, /سبب البلاغ/);
      assert.doesNotMatch(html, /Reason given/);
    }
  });

  it("escapes markup in the reason", () => {
    const html = artifactReportedBodyHtml({ ...info, reason: `<img src=x onerror="alert(1)">` });
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
  });

  it("keeps a line break as a line break", () => {
    const html = artifactReportedBodyHtml({ ...info, reason: "سطر أول\nسطر ثانٍ" });
    assert.match(html, /سطر أول<br\s*\/?>سطر ثانٍ/);
  });
});
