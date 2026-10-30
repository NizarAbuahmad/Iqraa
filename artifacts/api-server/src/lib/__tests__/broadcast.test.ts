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
const unsub = (id: string) => `https://api.test/unsub?id=${id}`;
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, email: `p${i}@school.jo` }));

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
});
afterEach(() => {
  setSuppressionCheck(null);
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = realKey;
});

describe("sendBroadcast", () => {
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
