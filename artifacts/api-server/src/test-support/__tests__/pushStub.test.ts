/**
 * The stub stands in for Expo in every push DB test, so it has to behave like
 * Expo where the server cares: one ticket per message in order, a
 * DeviceNotRegistered ticket for a dead token, a failed batch, a slow answer.
 * Driven through the real sendExpoPush, which also proves the EXPO_PUSH_URL seam.
 */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { startPushStub, type PushStub } from "../pushStub.ts";
import { deadTokensFrom, sendExpoPush } from "../../lib/pushNotifications.ts";

describe("the Expo push stub", () => {
  let stub: PushStub;
  let saved: string | undefined;
  before(async () => {
    stub = await startPushStub();
    saved = process.env.EXPO_PUSH_URL;
    process.env.EXPO_PUSH_URL = stub.url;
  });
  after(async () => {
    if (saved === undefined) delete process.env.EXPO_PUSH_URL;
    else process.env.EXPO_PUSH_URL = saved;
    await stub.close();
  });
  beforeEach(() => stub.clear());

  it("records what sendExpoPush sends and answers with tickets", async () => {
    const message = { to: "ExponentPushToken[a]", title: "t", body: "b", channelId: "homework" as const, sound: null, data: { screen: "school" } };
    const results = await sendExpoPush([message]);
    assert.deepEqual(results, [{ to: "ExponentPushToken[a]", status: "ok" }]);
    assert.deepEqual(stub.messages(), [message]);
  });

  it("answers DeviceNotRegistered for a token marked dead", async () => {
    stub.markDead("ExponentPushToken[b]");
    const results = await sendExpoPush([
      { to: "ExponentPushToken[a]", title: "t", body: "b" },
      { to: "ExponentPushToken[b]", title: "t", body: "b" },
    ]);
    assert.deepEqual(deadTokensFrom(results), ["ExponentPushToken[b]"]);
  });

  it("fails one batch on request, records nothing from it, then recovers", async () => {
    stub.failNext(500);
    const failed = await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    assert.deepEqual(failed, [{ to: "ExponentPushToken[a]", status: "error" }]);
    assert.deepEqual(stub.messages(), []);
    const ok = await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    assert.equal(ok[0]?.status, "ok");
  });

  it("delays one answer on request", async () => {
    stub.delayNext(200);
    const started = Date.now();
    await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    assert.ok(Date.now() - started >= 180);
  });

  it("waitFor gives up, saying what it saw", async () => {
    await assert.rejects(stub.waitFor(all => all.length > 5, 100), /waited 100ms/);
  });
});
