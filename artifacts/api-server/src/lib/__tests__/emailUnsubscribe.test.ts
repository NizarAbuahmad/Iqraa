/**
 * What this guards: every mail the API sends carries a working unsubscribe link
 * (in the footer and in the one-click headers), the link cannot be forged or
 * read back as someone else's address, and the list it feeds stops every
 * `general` mail while a code someone just asked for still arrives. Run against
 * a stubbed `fetch` and a stubbed list; nothing is sent and no database is used.
 */
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  sendAppInviteEmail,
  sendArtifactReportedEmail,
  sendGoogleAccountNoticeEmail,
  sendGuardianConsentEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  setSuppressionCheck,
} from "../email.ts";
import {
  emailUnsubscribeToken,
  emailUnsubscribeUrl,
  readEmailUnsubscribeToken,
  unsubscribeFooterHtml,
  unsubscribeHeaders,
  UNSUBSCRIBE_MAILTO,
} from "../emailUnsubscribe.ts";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const realFetch = globalThis.fetch;
const realKey = process.env.RESEND_API_KEY;
const realSecret = process.env.SESSION_SECRET;
const realEnv = process.env.NODE_ENV;

type Sent = { to: string; subject: string; html: string; headers: Record<string, string> };
let sent: Sent[] = [];

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.SESSION_SECRET = SECRET;
  sent = [];
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response('{"id":"x"}', { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  setSuppressionCheck(null);
  globalThis.fetch = realFetch;
  for (const [k, v] of [["RESEND_API_KEY", realKey], ["SESSION_SECRET", realSecret], ["NODE_ENV", realEnv]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const TO = "Teacher@School.jo";
const general = {
  "app invite": () => sendAppInviteEmail(TO),
  "parent approval request": () => sendGuardianConsentEmail(TO, "Sara", "https://app.test/guardian#tok"),
  "admin report notice": () => sendArtifactReportedEmail(TO, { kind: "quiz", lessonRef: "L1" }),
};
const security = {
  "sign-up code": () => sendVerificationEmail(TO, "123456"),
  "password reset code": () => sendPasswordResetEmail(TO, "123456"),
  "Google sign-in notice": () => sendGoogleAccountNoticeEmail(TO),
};

describe("the unsubscribe token", () => {
  it("reads back the address it was made for, lowercased", () => {
    assert.equal(readEmailUnsubscribeToken(emailUnsubscribeToken(" A@B.co ", SECRET), SECRET), "a@b.co");
  });

  it("refuses an altered token, another server's token, and junk", () => {
    const t = emailUnsubscribeToken("a@b.co", SECRET);
    const flipped = t.slice(0, -2) + (t.at(-2) === "A" ? "B" : "A") + t.at(-1);
    assert.equal(readEmailUnsubscribeToken(flipped, SECRET), null);
    assert.equal(readEmailUnsubscribeToken(t, `${SECRET}-other`), null);
    for (const junk of ["", "forged", "a@b.co", 42, undefined, "x".repeat(700)]) {
      assert.equal(readEmailUnsubscribeToken(junk, SECRET), null, String(junk));
    }
  });

  it("does not put the address in the link, where a request log would keep it", () => {
    const url = emailUnsubscribeUrl("teacher@school.jo", SECRET)!;
    assert.match(url, /\/api\/email\/unsubscribe\?t=[A-Za-z0-9_-]+$/);
    assert.doesNotMatch(url, /teacher|school/i);
  });

  it("falls back to the mailto address when nothing can sign a link", () => {
    assert.equal(emailUnsubscribeUrl("a@b.co", ""), null);
    assert.match(unsubscribeFooterHtml(null, "general"), new RegExp(`href="${UNSUBSCRIBE_MAILTO.replace(/[?]/g, "\\?")}"`));
    assert.deepEqual(unsubscribeHeaders(null), { "List-Unsubscribe": `<${UNSUBSCRIBE_MAILTO}>` });
  });
});

describe("every mail carries the unsubscribe link", () => {
  for (const [name, send] of Object.entries({ ...general, ...security })) {
    it(name, async () => {
      assert.equal(await send(), true);
      const mail = sent[0]!;
      const link = /href="(https:\/\/[^"]+\/api\/email\/unsubscribe\?t=[^"]+)"/.exec(mail.html)?.[1];
      assert.ok(link, "no unsubscribe link in the footer");
      assert.match(mail.html, /إلغاء الاشتراك/);
      assert.match(mail.html, /Unsubscribe/);
      const token = new URL(link.replace(/&amp;/g, "&")).searchParams.get("t");
      assert.equal(readEmailUnsubscribeToken(token, SECRET), "teacher@school.jo", "the link must speak for the recipient");
      assert.match(mail.headers["List-Unsubscribe"]!, /^<https:\/\/[^>]+\/api\/email\/unsubscribe\?t=[^>]+>, <mailto:/);
      assert.equal(mail.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    });
  }
});

describe("the unsubscribe list", () => {
  const unsubscribed = () => setSuppressionCheck(async (emails) => new Set(emails.filter((e) => e === "teacher@school.jo")));

  for (const [name, send] of Object.entries(general)) {
    it(`stops the ${name}`, async () => {
      unsubscribed();
      assert.equal(await send(), false);
      assert.equal(sent.length, 0);
    });
  }

  for (const [name, send] of Object.entries(security)) {
    it(`does not stop the ${name}, and its footer says so`, async () => {
      unsubscribed();
      assert.equal(await send(), true);
      assert.match(sent[0]!.html, /security email/);
      assert.match(sent[0]!.html, /رسالة أمان/);
    });
  }

  it("sends no general mail when the list cannot be read", async () => {
    setSuppressionCheck(async () => {
      throw new Error("db down");
    });
    assert.equal(await sendAppInviteEmail(TO), false);
    assert.equal(sent.length, 0);
  });

  it("refuses general mail on a production server where no list was registered", async () => {
    process.env.NODE_ENV = "production";
    assert.equal(await sendGuardianConsentEmail(TO, "Sara", "https://app.test/guardian#tok"), false);
    assert.equal(sent.length, 0);
  });
});
