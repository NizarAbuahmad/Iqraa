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

import { sendExpoPush, deadTokensFrom, PUSH_CHANNEL } from "../pushNotifications.ts";

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

// The Android channel and the app-icon count ride on the message itself;
// Expo forwards them to the device, where expo-notifications reads both.
test("sendExpoPush passes channelId and badge through to Expo", async () => {
  let sent: unknown[] = [];
  globalThis.fetch = mock.fn(async (_url: string, init: RequestInit) => {
    sent = JSON.parse(init.body as string) as unknown[];
    return jsonResponse(200, { data: sent.map(() => ({ status: "ok" })) });
  }) as unknown as typeof fetch;

  await sendExpoPush([
    { to: "ExponentPushToken[aaa]", title: "t", body: "b", channelId: PUSH_CHANNEL.messages, badge: 4 },
    { to: "ExponentPushToken[bbb]", title: "t", body: "b", channelId: PUSH_CHANNEL.results },
  ]);

  assert.deepEqual(sent, [
    { to: "ExponentPushToken[aaa]", title: "t", body: "b", channelId: "messages", badge: 4 },
    { to: "ExponentPushToken[bbb]", title: "t", body: "b", channelId: "results" },
  ]);
});

test("sendExpoPush passes sound through, null included", async () => {
  let sent: unknown[] = [];
  globalThis.fetch = mock.fn(async (_url: string, init: RequestInit) => {
    sent = JSON.parse(init.body as string) as unknown[];
    return jsonResponse(200, { data: sent.map(() => ({ status: "ok" })) });
  }) as unknown as typeof fetch;

  await sendExpoPush([
    { to: "ExponentPushToken[aaa]", title: "t", body: "b", channelId: PUSH_CHANNEL.homework, sound: "default" },
    { to: "ExponentPushToken[bbb]", title: "t", body: "b", channelId: PUSH_CHANNEL.quiet, sound: null },
  ]);

  assert.deepEqual(sent, [
    { to: "ExponentPushToken[aaa]", title: "t", body: "b", channelId: "homework", sound: "default" },
    { to: "ExponentPushToken[bbb]", title: "t", body: "b", channelId: "quiet", sound: null },
  ]);
});

test("sendExpoPush posts to EXPO_PUSH_URL when it is set, and to Expo otherwise", async () => {
  const urls: string[] = [];
  globalThis.fetch = mock.fn(async (url: string, init: RequestInit) => {
    urls.push(String(url));
    const sent = JSON.parse(init.body as string) as unknown[];
    return jsonResponse(200, { data: sent.map(() => ({ status: "ok" })) });
  }) as unknown as typeof fetch;
  const saved = process.env.EXPO_PUSH_URL;
  try {
    delete process.env.EXPO_PUSH_URL;
    await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    process.env.EXPO_PUSH_URL = "http://127.0.0.1:9/stub";
    await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUSH_URL;
    else process.env.EXPO_PUSH_URL = saved;
  }
  assert.deepEqual(urls, ["https://exp.host/--/api/v2/push/send", "http://127.0.0.1:9/stub"]);
});

// A hung Expo call must not outlive pushWithin's cap or Cloud Run's request
// timeout, so the POST carries an abort signal. An abort is just another
// fetch failure: error results, no throw.
test("sendExpoPush passes an abort signal to fetch", async () => {
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = mock.fn(async (_url: string, init: RequestInit) => {
    signal = init.signal;
    const sent = JSON.parse(init.body as string) as unknown[];
    return jsonResponse(200, { data: sent.map(() => ({ status: "ok" })) });
  }) as unknown as typeof fetch;

  await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);

  assert.ok(signal instanceof AbortSignal, "fetch got a signal");
  assert.equal(signal.aborted, false);
});

test("sendExpoPush treats a timed-out (aborted) request like any other network failure", async () => {
  for (const name of ["TimeoutError", "AbortError"]) {
    globalThis.fetch = mock.fn(async () => {
      throw new DOMException("The operation was aborted", name);
    }) as unknown as typeof fetch;

    const results = await sendExpoPush([{ to: "ExponentPushToken[aaa]", title: "t", body: "b" }]);

    assert.deepEqual(results, [{ to: "ExponentPushToken[aaa]", status: "error" }], name);
  }
});

test("sendExpoPush really gives up on a hung Expo (the signal is wired to a timeout)", async () => {
  // A fetch that never settles on its own, only when its signal fires.
  globalThis.fetch = mock.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal;
        if (!signal) return; // no signal: hangs, and the test times out
        if (signal.aborted) return reject(signal.reason);
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  ) as unknown as typeof fetch;
  const realTimeout = AbortSignal.timeout;
  AbortSignal.timeout = (() => AbortSignal.abort(new DOMException("timed out", "TimeoutError"))) as typeof AbortSignal.timeout;
  try {
    const results = await sendExpoPush([{ to: "ExponentPushToken[aaa]", title: "t", body: "b" }]);
    assert.deepEqual(results, [{ to: "ExponentPushToken[aaa]", status: "error" }]);
  } finally {
    AbortSignal.timeout = realTimeout;
  }
});
