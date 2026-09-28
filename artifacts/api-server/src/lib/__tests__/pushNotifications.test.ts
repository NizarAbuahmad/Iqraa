/**
 * Expo answers push sends with 200 OK plus a per-message ticket, even when a
 * specific token is dead — sendExpoPush must read that ticket body (not just
 * the HTTP status) so a caller can prune tokens Expo says are gone. This
 * pins that parsing plus the two failure shapes (non-2xx response, thrown
 * fetch) that still need to produce an "error" result per message rather
 * than losing the token silently.
 */
import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import { sendExpoPush, deadTokensFrom } from "../pushNotifications.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  mock.restoreAll();
  globalThis.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("sendExpoPush filters out non-Expo tokens before sending", async () => {
  const fetchMock = mock.fn(async () => jsonResponse(200, { data: [] }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const results = await sendExpoPush([{ to: "not-an-expo-token", title: "t", body: "b" }]);

  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(results, []);
});

test("sendExpoPush maps each ticket back to its token, ok and error alike", async () => {
  const tokens = ["ExponentPushToken[aaa]", "ExponentPushToken[bbb]", "ExponentPushToken[ccc]"];
  globalThis.fetch = mock.fn(async () =>
    jsonResponse(200, {
      data: [
        { status: "ok" },
        { status: "error", message: "device not registered", details: { error: "DeviceNotRegistered" } },
        { status: "error", message: "rate limited", details: { error: "MessageRateExceeded" } },
      ],
    }),
  ) as unknown as typeof fetch;

  const results = await sendExpoPush(tokens.map(to => ({ to, title: "t", body: "b" })));

  assert.deepEqual(results, [
    { to: tokens[0], status: "ok" },
    { to: tokens[1], status: "error", error: "DeviceNotRegistered" },
    { to: tokens[2], status: "error", error: "MessageRateExceeded" },
  ]);
  assert.deepEqual(deadTokensFrom(results), [tokens[1]]);
});

test("sendExpoPush marks every message in the chunk as error on a non-2xx response", async () => {
  globalThis.fetch = mock.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;

  const results = await sendExpoPush([{ to: "ExponentPushToken[aaa]", title: "t", body: "b" }]);

  assert.deepEqual(results, [{ to: "ExponentPushToken[aaa]", status: "error" }]);
  assert.deepEqual(deadTokensFrom(results), []);
});

test("sendExpoPush marks every message in the chunk as error when fetch throws", async () => {
  globalThis.fetch = mock.fn(async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;

  const results = await sendExpoPush([{ to: "ExponentPushToken[aaa]", title: "t", body: "b" }]);

  assert.deepEqual(results, [{ to: "ExponentPushToken[aaa]", status: "error" }]);
});

test("sendExpoPush batches in chunks of 100", async () => {
  const fetchMock = mock.fn(async (_url: string, init: RequestInit) => {
    const sent = JSON.parse(init.body as string) as unknown[];
    return jsonResponse(200, { data: sent.map(() => ({ status: "ok" })) });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const messages = Array.from({ length: 150 }, (_, i) => ({
    to: `ExponentPushToken[${i}]`,
    title: "t",
    body: "b",
  }));

  const results = await sendExpoPush(messages);

  assert.equal(fetchMock.mock.callCount(), 2);
  assert.equal(results.length, 150);
  assert.ok(results.every(r => r.status === "ok"));
});
