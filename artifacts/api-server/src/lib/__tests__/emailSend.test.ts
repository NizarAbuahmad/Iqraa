/**
 * What this guards: `sendVerificationEmail` is the signal every endpoint above
 * it now reports to the user, so it has to say `false` for every way a send can
 * fail — no key configured, the provider refusing the request, the request
 * never arriving — and `true` only when the provider accepted it. Run against a
 * stubbed `fetch`, so nothing is sent and no key is needed.
 */
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { sendVerificationEmail } from "../email.ts";

const realFetch = globalThis.fetch;
const realKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = realKey;
});

describe("sendVerificationEmail", () => {
  it("is false when no key is configured, and does not call the provider", async () => {
    delete process.env.RESEND_API_KEY;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    assert.equal(await sendVerificationEmail("a@b.co", "123456"), false);
    assert.equal(called, false);
  });

  it("is false when the provider refuses the request", async () => {
    globalThis.fetch = (async () =>
      new Response('{"message":"The domain is not verified"}', { status: 403 })) as typeof fetch;
    assert.equal(await sendVerificationEmail("a@b.co", "123456"), false);
  });

  it("is false when the request never arrives", async () => {
    globalThis.fetch = (async () => {
      throw new Error("socket hang up");
    }) as typeof fetch;
    assert.equal(await sendVerificationEmail("a@b.co", "123456"), false);
  });

  it("is true when the provider accepts it", async () => {
    globalThis.fetch = (async () => new Response('{"id":"x"}', { status: 200 })) as typeof fetch;
    assert.equal(await sendVerificationEmail("a@b.co", "123456"), true);
  });
});
