import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fetchSubscriberCount, parseSubscriberCount } from "../youtubeSubscribers.ts";

const reply = (statistics: object) => ({ items: [{ statistics }] });
const fakeFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("parseSubscriberCount", () => {
  it("reads the count, which YouTube sends as a string", () => {
    assert.equal(parseSubscriberCount(reply({ subscriberCount: "1280", hiddenSubscriberCount: false })), 1280);
    assert.equal(parseSubscriberCount(reply({ subscriberCount: "0" })), 0);
  });
  it("is null when hidden, absent or not a count", () => {
    assert.equal(parseSubscriberCount(reply({ subscriberCount: "50", hiddenSubscriberCount: true })), null);
    assert.equal(parseSubscriberCount({ items: [] }), null);
    assert.equal(parseSubscriberCount({}), null);
    assert.equal(parseSubscriberCount(null), null);
    assert.equal(parseSubscriberCount(reply({ subscriberCount: "lots" })), null);
    assert.equal(parseSubscriberCount(reply({ subscriberCount: "-3" })), null);
  });
});

describe("fetchSubscriberCount", () => {
  it("asks by handle and returns the count", async () => {
    let url = "";
    const f = (async (u: string) => { url = u; return new Response(JSON.stringify(reply({ subscriberCount: "42" }))); }) as unknown as typeof fetch;
    assert.equal(await fetchSubscriberCount("k", f), 42);
    assert.match(url, /forHandle=IQRRA_ME/);
  });
  it("is null on an HTTP error", async () => {
    assert.equal(await fetchSubscriberCount("k", fakeFetch(403, { error: {} })), null);
  });
});
