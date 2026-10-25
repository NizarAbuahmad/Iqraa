/**
 * What this guards: the waitlist broadcast only reaches people who may be
 * mailed — unsubscribed, invalid, duplicate and (for `update`) pre-consent
 * addresses are dropped, a retry can't double-send, and an unsubscribe link
 * can't be forged or turn the admin's text into markup.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseBroadcast,
  pickRecipients,
  renderBroadcastBody,
  signUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribe,
  type SignupRow,
} from "../siteMail.ts";

const NOW = new Date("2026-10-25T12:00:00Z");
const day = (d: string) => new Date(`${d}T09:00:00Z`);
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const row = (over: Partial<SignupRow> = {}): SignupRow => ({
  id: uuid(),
  kind: "waitlist",
  email: `t${n}@school.jo`,
  createdAt: day("2026-10-03"),
  invitedAt: null,
  lastMessagedAt: null,
  unsubscribedAt: null,
  joinedAt: null,
  ...over,
});
const emails = (r: { email: string }[]) => r.map(x => x.email);

describe("pickRecipients", () => {
  it("takes waitlist rows with a deliverable address, once per address", () => {
    const rows = [
      row({ email: "a@school.jo" }),
      row({ email: "A@School.jo" }), // same person, typed differently
      row({ email: "not-an-email" }),
      row({ email: "" }),
      row({ email: "c@school.jo", kind: "contact" }),
      row({ email: "d@school.jo", kind: "idea" }),
      row({ email: "b@school.jo" }),
    ];
    assert.deepEqual(emails(pickRecipients(rows, "launch", { now: NOW })), ["a@school.jo", "b@school.jo"]);
  });

  it("points the unsubscribe id at the newest row for an address", () => {
    const older = row({ email: "a@school.jo", createdAt: day("2026-10-03") });
    const newer = row({ email: "a@school.jo", createdAt: day("2026-10-20") });
    assert.equal(pickRecipients([older, newer], "launch", { now: NOW })[0]!.id, newer.id);
  });

  it("never mails an address that unsubscribed on any of its rows", () => {
    const rows = [
      row({ email: "a@school.jo", unsubscribedAt: day("2026-10-10") }),
      row({ email: "a@school.jo" }), // signed up again afterwards
      row({ email: "b@school.jo" }),
    ];
    for (const purpose of ["invite", "launch"] as const) {
      assert.deepEqual(emails(pickRecipients(rows, purpose, { now: NOW })), ["b@school.jo"], purpose);
    }
  });

  it("invite skips people already invited; launch does not", () => {
    const rows = [row({ email: "a@school.jo", invitedAt: day("2026-10-05") }), row({ email: "b@school.jo" })];
    assert.deepEqual(emails(pickRecipients(rows, "invite", { now: NOW })), ["b@school.jo"]);
    assert.deepEqual(emails(pickRecipients(rows, "launch", { now: NOW })), ["a@school.jo", "b@school.jo"]);
  });

  it("invite skips people who already joined; launch and news still reach them", () => {
    const rows = [
      row({ email: "a@school.jo", joinedAt: day("2026-10-12") }),
      row({ email: "a@school.jo" }), // a second signup row for the same address, no join stamp of its own
      row({ email: "b@school.jo" }),
    ];
    assert.deepEqual(emails(pickRecipients(rows, "invite", { now: NOW })), ["b@school.jo"]);
    assert.deepEqual(emails(pickRecipients(rows, "launch", { now: NOW })), ["a@school.jo", "b@school.jo"]);
  });

  it("holds back anyone mailed in the last 12 hours, unless asked to ignore it", () => {
    const rows = [
      row({ email: "a@school.jo", lastMessagedAt: new Date(NOW.getTime() - 60 * 60 * 1000) }),
      row({ email: "b@school.jo", lastMessagedAt: new Date(NOW.getTime() - 13 * 60 * 60 * 1000) }),
    ];
    assert.deepEqual(emails(pickRecipients(rows, "launch", { now: NOW })), ["b@school.jo"]);
    assert.equal(pickRecipients(rows, "launch", { now: NOW, ignoreRecent: true }).length, 2);
  });

  it("update reaches nobody until the consent date is set, then only later signups", () => {
    const rows = [
      row({ email: "old@school.jo", createdAt: day("2026-10-03") }),
      row({ email: "new@school.jo", createdAt: day("2026-11-02") }),
    ];
    assert.deepEqual(pickRecipients(rows, "update", { now: NOW, consentFrom: null }), []);
    assert.deepEqual(emails(pickRecipients(rows, "update", { now: NOW, consentFrom: day("2026-11-01") })), ["new@school.jo"]);
    // The shipped default is closed: nothing in this file opens it by accident.
    assert.deepEqual(pickRecipients(rows, "update", { now: NOW }), []);
  });

  it("a later signup carries consent for an address that first signed up before the wording changed", () => {
    const rows = [
      row({ email: "a@school.jo", createdAt: day("2026-10-03") }),
      row({ email: "a@school.jo", createdAt: day("2026-11-05") }),
    ];
    assert.equal(pickRecipients(rows, "update", { now: NOW, consentFrom: day("2026-11-01") }).length, 1);
  });
});

describe("parseBroadcast", () => {
  it("needs a known purpose", () => {
    assert.deepEqual(parseBroadcast({ purpose: "spam" }), { error: "purpose" });
    assert.deepEqual(parseBroadcast(null), { error: "purpose" });
  });
  it("invite is a fixed template and takes no text", () => {
    assert.deepEqual(parseBroadcast({ purpose: "invite", subject: "x", body: "y" }), {
      purpose: "invite", subject: "", text: "", dryRun: false, testOnly: false,
    });
  });
  it("launch needs a real subject and body, except for a dry run", () => {
    assert.deepEqual(parseBroadcast({ purpose: "launch", subject: "hi", body: "long enough body" }), { error: "subject" });
    assert.deepEqual(parseBroadcast({ purpose: "launch", subject: "Launch day", body: "short" }), { error: "body" });
    assert.deepEqual(parseBroadcast({ purpose: "launch", subject: "Launch day", body: "x".repeat(10_001) }), { error: "body" });
    assert.deepEqual(parseBroadcast({ purpose: "launch", dryRun: true }), {
      purpose: "launch", subject: "", text: "", dryRun: true, testOnly: false,
    });
    assert.deepEqual(parseBroadcast({ purpose: "update", subject: " Launch day ", body: " The app is live. ", testOnly: true }), {
      purpose: "update", subject: "Launch day", text: "The app is live.", dryRun: false, testOnly: true,
    });
  });
});

describe("renderBroadcastBody", () => {
  it("escapes markup and only links http(s) URLs", () => {
    const html = renderBroadcastBody('<script>alert(1)</script> see https://iqrra.com/a?b=1&c=2. or javascript:alert(1) "quoted"');
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /<a href="https:\/\/iqrra\.com\/a\?b=1&amp;c=2" [^>]*>https:\/\/iqrra\.com\/a\?b=1&amp;c=2<\/a>\./);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.match(html, /&quot;quoted&quot;/);
  });
  it("splits paragraphs on blank lines and keeps single newlines as breaks", () => {
    const html = renderBroadcastBody("one\ntwo\n\nthree");
    assert.equal(html.match(/<p /g)?.length, 2);
    assert.match(html, /one<br \/>two/);
  });
  it("sets direction from the language", () => {
    assert.match(renderBroadcastBody("مرحبًا بكم في إقرأ"), /dir="rtl"/);
    assert.match(renderBroadcastBody("Hello from Iqrra"), /dir="ltr"/);
  });
});

describe("unsubscribe token", () => {
  const secret = "s".repeat(32);
  const id = "11111111-2222-4333-8444-555555555555";

  it("verifies its own token and rejects any other", () => {
    const t = signUnsubscribe(id, secret);
    assert.equal(verifyUnsubscribe(id, t, secret), true);
    assert.equal(verifyUnsubscribe("11111111-2222-4333-8444-555555555556", t, secret), false, "another row's id");
    assert.equal(verifyUnsubscribe(id, t.replace(/.$/, c => (c === "0" ? "1" : "0")), secret), false, "tampered token");
    assert.equal(verifyUnsubscribe(id, signUnsubscribe(id, "x".repeat(32)), secret), false, "signed with another secret");
  });
  it("rejects missing, non-string and non-uuid input without throwing", () => {
    assert.equal(verifyUnsubscribe(undefined, undefined, secret), false);
    assert.equal(verifyUnsubscribe(["a"], ["b"], secret), false);
    assert.equal(verifyUnsubscribe("not-a-uuid", signUnsubscribe("not-a-uuid", secret), secret), false);
    assert.equal(verifyUnsubscribe(id, "", secret), false);
  });
  it("fails closed without a secret", () => {
    assert.equal(verifyUnsubscribe(id, "anything", ""), false);
    assert.throws(() => signUnsubscribe(id, ""));
  });
  it("builds a link that verifies", () => {
    const prev = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = secret;
    try {
      const u = new URL(unsubscribeUrl(id));
      assert.equal(u.pathname, "/api/site/unsubscribe");
      assert.equal(verifyUnsubscribe(u.searchParams.get("id"), u.searchParams.get("t"), secret), true);
    } finally {
      if (prev === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = prev;
    }
  });
});
