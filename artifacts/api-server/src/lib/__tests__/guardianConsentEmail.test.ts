// artifacts/api-server/src/lib/__tests__/guardianConsentEmail.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { guardianConsentBodyHtml, guardianConsentSubject } from "../guardianConsentEmail.ts";

const LINK = "https://app.iqrra.com/guardian/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

describe("guardianConsentBodyHtml", () => {
  const html = guardianConsentBodyHtml("سلمى", LINK);

  it("names the child and carries the link as the button target, once per language block", () => {
    assert.ok(html.includes("سلمى"));
    // One button in the Arabic block and one in the English block, and nowhere else (no bare-text copy of the link).
    assert.equal(html.split(`href="${LINK}"`).length - 1, 2);
    assert.equal(html.split(LINK).length - 1, 2);
  });
  it("is bilingual, Arabic first, with the brand spelled the way CI requires", () => {
    assert.ok(html.indexOf('dir="rtl"') < html.indexOf('dir="ltr"'));
    assert.ok(html.includes("«إقرأ»"));
    assert.ok(html.includes("Iqrra"));
    assert.ok(!html.includes("Iqraa"));
    assert.ok(!html.includes("«اقرأ»"));
  });
  it("says what approving means and that the link lasts seven days", () => {
    assert.ok(html.includes("7"));
    assert.match(html, /parent or legal guardian/i);
    assert.ok(html.includes("وليّ"));
  });
  it("escapes the child's name and the link: a first name is typed by the student", () => {
    const evil = guardianConsentBodyHtml('<img src=x onerror=alert(1)>"', 'https://x.test/?a="b"&c=<d>');
    assert.ok(!evil.includes("<img src=x"));
    assert.ok(evil.includes("&lt;img"));
    assert.ok(!evil.includes('href="https://x.test/?a="b"'));
    assert.ok(evil.includes("&quot;"));
  });
  it("has a bilingual subject that names Iqrra", () => {
    assert.ok(guardianConsentSubject.includes("Iqrra"));
    assert.ok(guardianConsentSubject.includes("إقرأ"));
  });
});
