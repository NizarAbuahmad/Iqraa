/**
 * The admin alert for a reported chat message.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/messageReportAlert.test.ts
 *
 * A reported message carries a 24-hour moderation obligation, and the alert
 * leaves the app by email and push — so it says a report exists and where to
 * look, and nothing about who or what was said.
 */
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { alertMessageReport, messageReportAlert } from "../messageReportAlert.ts";
import { resetAlertGateForTests } from "../adminAlertGate.ts";

function countingStore() {
  const counts = new Map<string, number>();
  return {
    keys: [] as string[],
    async hit(key: string, windowMs: number) {
      this.keys.push(key);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { count: n, resetAt: new Date(Date.now() + windowMs) };
    },
  };
}

describe("messageReportAlert", () => {
  it("opens the moderation screen on the admin channel path", () => {
    const a = messageReportAlert();
    assert.equal(a.screen, "moderation");
    assert.equal(a.path, "/admin/moderation");
  });

  it("is fixed wording: takes no argument that could carry a name or the message", () => {
    assert.equal(messageReportAlert.length, 0);
  });
});

describe("alertMessageReport", () => {
  beforeEach(() => resetAlertGateForTests());

  it("notifies on a report", async () => {
    const store = countingStore();
    let n = 0;
    await alertMessageReport("reporter-1", { store, notify: async () => void n++ });
    assert.equal(n, 1);
  });

  it("one reporter pressing report repeatedly is one notification per window", async () => {
    const store = countingStore();
    let n = 0;
    for (let i = 0; i < 10; i++) await alertMessageReport("reporter-1", { store, notify: async () => void n++ });
    assert.equal(n, 1);
  });

  it("another reporter is a separate notification", async () => {
    const store = countingStore();
    let n = 0;
    await alertMessageReport("reporter-1", { store, notify: async () => void n++ });
    await alertMessageReport("reporter-2", { store, notify: async () => void n++ });
    assert.equal(n, 2);
  });

  it("the bucket key sits under the admin-alert prefix", async () => {
    const store = countingStore();
    await alertMessageReport("reporter-1", { store, notify: async () => {} });
    assert.ok(store.keys.every(k => k.startsWith("admin-alert:msg-report:")));
  });

  it("never throws", async () => {
    await assert.doesNotReject(() =>
      alertMessageReport("r", { store: countingStore(), notify: async () => { throw new Error("x"); } }),
    );
  });
});

describe("the report route", () => {
  const source = readFileSync(new URL("../../routes/messaging.ts", import.meta.url), "utf8");
  const start = source.indexOf('router.post("/messaging/reports"');
  const handler = source.slice(start, source.indexOf("// ─── Device push tokens", start));

  it("awaits the alert through pushWithin, before answering", () => {
    assert.match(handler, /await pushWithin\("message report"/);
    assert.ok(handler.indexOf("pushWithin(") < handler.indexOf("res.status(201)"));
  });

  it("passes no message text, names or ids into the alert", () => {
    const call = handler.slice(handler.indexOf("pushWithin("), handler.indexOf("res.status(201)"));
    assert.doesNotMatch(call, /reason|messageId|reportedUserId|displayName|body/);
  });
});
