/**
 * What this guards: the waitlist broadcast reports exactly who Resend accepted
 * (the admin route stamps only those), a refused or lost batch fails its own
 * recipients and no others, and every mail carries its own unsubscribe link and
 * the one-click headers. Run against a stubbed `fetch`; nothing is sent.
 */
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { sendBroadcast, setSuppressionCheck } from "../email.ts";

const realFetch = globalThis.fetch;
const realKey = process.env.RESEND_API_KEY;
const realNodeEnv = process.env.NODE_ENV;
const unsub = (r: { id: string }) => `https://api.test/unsub?id=${r.id}`;
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, email: `p${i}@school.jo` }));

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
});
afterEach(() => {
  setSuppressionCheck(null);
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_URL;
  if (realNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = realNodeEnv;
  if (realKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = realKey;
});

describe("sendBroadcast", () => {
  it("hands the whole recipient to the link builder and prints the footer it was given", async () => {
    let batch: { html: string; headers: Record<string, string> }[] = [];
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      batch = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    await sendBroadcast(
      [{ id: "u1", email: "t@school.jo" }],
      "Hello",
      "<p>x</p>",
      r => `https://api.test/u?e=${encodeURIComponent(r.email)}`,
      { ar: "سطر المعلّم", en: "Teacher line" },
    );
    assert.match(batch[0]!.html, /سطر المعلّم/);
    assert.match(batch[0]!.html, /Teacher line/);
    assert.doesNotMatch(batch[0]!.html, /iqrra\.com\./, "the waitlist sentence is gone");
    assert.equal(batch[0]!.headers["List-Unsubscribe"], "<https://api.test/u?e=t%40school.jo>");
  });

  it("keeps the waitlist sentence when no footer is given", async () => {
    let html = "";
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      html = JSON.parse(String(init?.body))[0].html;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await sendBroadcast(people(1), "s", "<p>x</p>", unsub);
    assert.match(html, /You received this because you signed up for Iqrra at iqrra\.com\./);
  });

  it("calls RESEND_API_URL when it is set", async () => {
    let url = "";
    globalThis.fetch = (async (u: unknown) => {
      url = String(u);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    process.env.NODE_ENV = "test";
    process.env.RESEND_API_URL = "http://127.0.0.1:9/";
    await sendBroadcast(people(1), "s", "<p>x</p>", unsub);
    assert.equal(url, "http://127.0.0.1:9/emails/batch");
  });

  it("ignores RESEND_API_URL in production: the key and the addresses go to Resend only", async () => {
    let url = "";
    globalThis.fetch = (async (u: unknown) => {
      url = String(u);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    // Production refuses to mail without an unsubscribe check; give it one that suppresses nobody.
    setSuppressionCheck(async () => new Set());
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_URL = "http://127.0.0.1:9/";
    const out = await sendBroadcast(people(1), "s", "<p>x</p>", unsub);
    assert.equal(url, "https://api.resend.com/emails/batch");
    assert.deepEqual(out.sent, ["p0@school.jo"]);
  });

  it("gives each recipient their own unsubscribe link, in the footer and the headers", async () => {
    let url = "";
    let batch: { to: string; subject: string; html: string; headers: Record<string, string> }[] = [];
    globalThis.fetch = (async (u: unknown, init?: RequestInit) => {
      url = String(u);
      batch = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const out = await sendBroadcast(people(2), "Hello", "<p>body</p>", unsub);
    assert.equal(url, "https://api.resend.com/emails/batch");
    assert.deepEqual(out, { sent: ["p0@school.jo", "p1@school.jo"], failed: [], skipped: [] });
    assert.equal(batch.length, 2);
    assert.equal(batch[1]!.to, "p1@school.jo");
    assert.equal(batch[1]!.subject, "Hello");
    assert.match(batch[1]!.html, /<p>body<\/p>/);
    assert.match(batch[1]!.html, /href="https:\/\/api\.test\/unsub\?id=id-1"/);
    assert.doesNotMatch(batch[1]!.html, /id=id-0/);
    assert.equal(batch[1]!.headers["List-Unsubscribe"], "<https://api.test/unsub?id=id-1>");
    assert.equal(batch[1]!.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  });

  it("sends at most 100 per request and fails only the chunk that was refused", async () => {
    const sizes: number[] = [];
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      sizes.push(JSON.parse(String(init?.body)).length);
      return new Response("no", { status: sizes.length === 1 ? 200 : 429 });
    }) as typeof fetch;

    const out = await sendBroadcast(people(101), "Hello", "<p>x</p>", unsub);
    assert.deepEqual(sizes, [100, 1]);
    assert.equal(out.sent.length, 100);
    assert.deepEqual(out.failed, ["p100@school.jo"]);
  });

  it("fails everyone for a lost request, and for a missing key", async () => {
    globalThis.fetch = (async () => {
      throw new Error("socket hang up");
    }) as typeof fetch;
    assert.deepEqual(await sendBroadcast(people(2), "s", "<p>x</p>", unsub), { sent: [], failed: ["p0@school.jo", "p1@school.jo"], skipped: [] });

    delete process.env.RESEND_API_KEY;
    assert.deepEqual(await sendBroadcast(people(1), "s", "<p>x</p>", unsub), { sent: [], failed: ["p0@school.jo"], skipped: [] });
  });

  it("leaves out anyone who unsubscribed from any of our mail, whatever the case they signed up in", async () => {
    let batch: { to: string }[] = [];
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      batch = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    setSuppressionCheck(async (emails) => new Set(emails.filter((e) => e === "p1@school.jo")));

    const out = await sendBroadcast([...people(1), { id: "id-x", email: "P1@School.jo" }], "s", "<p>x</p>", unsub);
    assert.deepEqual(batch.map((m) => m.to), ["p0@school.jo"]);
    assert.deepEqual(out, { sent: ["p0@school.jo"], failed: [], skipped: ["P1@School.jo"] });
  });

  it("sends nothing when the unsubscribe list cannot be read", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    setSuppressionCheck(async () => {
      throw new Error("db down");
    });
    assert.deepEqual(await sendBroadcast(people(2), "s", "<p>x</p>", unsub), { sent: [], failed: ["p0@school.jo", "p1@school.jo"], skipped: [] });
    assert.equal(called, false);
  });
});
