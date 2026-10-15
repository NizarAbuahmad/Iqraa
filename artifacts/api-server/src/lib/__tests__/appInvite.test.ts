/**
 * What this guards: the admin invite mail carries the download link in both
 * languages, honours APP_INVITE_URL, and reports false for every way a send
 * can fail so the admin screen never shows "sent" for a mail that was not.
 * Run against a stubbed `fetch`, so nothing is sent and no key is needed.
 */
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderAppInviteEmailHtml, sendAppInviteEmail } from "../email.ts";

const realFetch = globalThis.fetch;
const realKey = process.env.RESEND_API_KEY;
const realUrl = process.env.APP_INVITE_URL;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  delete process.env.APP_INVITE_URL;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = realKey;
  if (realUrl === undefined) delete process.env.APP_INVITE_URL;
  else process.env.APP_INVITE_URL = realUrl;
});

describe("sendAppInviteEmail", () => {
  it("links the Play listing by default, in Arabic and English", async () => {
    let sent: { to: string; html: string } | undefined;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response('{"id":"x"}', { status: 200 });
    }) as typeof fetch;

    assert.equal(await sendAppInviteEmail("a@b.co"), true);
    assert.equal(sent?.to, "a@b.co");
    const links = sent!.html.match(/href="https:\/\/play\.google\.com\/[^"]+"/g) ?? [];
    assert.equal(links.length, 2);
    assert.match(sent!.html, /Download on Google Play/);
    assert.match(sent!.html, /حمّل التطبيق/);
  });

  it("uses APP_INVITE_URL when set", async () => {
    process.env.APP_INVITE_URL = "https://play.google.com/apps/testing/com.example";
    let html = "";
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      html = JSON.parse(String(init?.body)).html;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    await sendAppInviteEmail("a@b.co");
    assert.match(html, /apps\/testing\/com\.example/);
    assert.doesNotMatch(html, /details\?id=/);
  });

  it("is false with no key, a refusal, or a lost request", async () => {
    delete process.env.RESEND_API_KEY;
    assert.equal(await sendAppInviteEmail("a@b.co"), false);

    process.env.RESEND_API_KEY = "re_test_key";
    globalThis.fetch = (async () => new Response("no", { status: 403 })) as typeof fetch;
    assert.equal(await sendAppInviteEmail("a@b.co"), false);

    globalThis.fetch = (async () => {
      throw new Error("socket hang up");
    }) as typeof fetch;
    assert.equal(await sendAppInviteEmail("a@b.co"), false);
  });
});

describe("renderAppInviteEmailHtml", () => {
  it("puts the link on both buttons", () => {
    assert.equal(renderAppInviteEmailHtml("https://x.test/i").split('href="https://x.test/i"').length - 1, 2);
  });
});
