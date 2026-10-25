/**
 * The facts the public bot answers from: the site's own llms.txt, cached, with a
 * built-in fallback. The loader never throws — a failed fetch must cost the bot
 * its freshness, not the visitor their answer.
 */
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { SITE_ASK_FALLBACK_FACTS } from "../siteAskPrompts.ts";
import {
  loadSiteFacts,
  resetSiteFactsCache,
  SITE_FACTS_MAX_CHARS,
  SITE_FACTS_RETRY_MS,
  SITE_FACTS_TTL_MS,
  SITE_FACTS_URL,
} from "../siteFacts.ts";

function fakeFetch(handler: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const impl = (async (url: unknown) => {
    calls.push(String(url));
    return handler();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

describe("loadSiteFacts", () => {
  beforeEach(() => resetSiteFactsCache());

  it("fetches the site's llms.txt and says it came from the site", async () => {
    const f = fakeFetch(() => new Response("  Iqraa is free in beta.  "));
    const facts = await loadSiteFacts({ fetchImpl: f.impl, now: clock().now });
    assert.deepEqual(facts, { text: "Iqraa is free in beta.", source: "site" });
    assert.deepEqual(f.calls, [SITE_FACTS_URL]);
    assert.equal(SITE_FACTS_URL, "https://www.iqrra.com/llms.txt");
  });

  it("serves from the cache for an hour, then fetches again", async () => {
    const f = fakeFetch(() => new Response("facts"));
    const c = clock();
    await loadSiteFacts({ fetchImpl: f.impl, now: c.now });
    c.advance(SITE_FACTS_TTL_MS - 1);
    await loadSiteFacts({ fetchImpl: f.impl, now: c.now });
    assert.equal(f.calls.length, 1);
    c.advance(2);
    await loadSiteFacts({ fetchImpl: f.impl, now: c.now });
    assert.equal(f.calls.length, 2);
  });

  it("falls back when the site answers with an error, and retries after a minute not per request", async () => {
    let ok = false;
    const f = fakeFetch(() => (ok ? new Response("back again") : new Response("down", { status: 503 })));
    const c = clock();
    const first = await loadSiteFacts({ fetchImpl: f.impl, now: c.now });
    assert.deepEqual(first, { text: SITE_ASK_FALLBACK_FACTS, source: "fallback" });
    await loadSiteFacts({ fetchImpl: f.impl, now: c.now });
    assert.equal(f.calls.length, 1, "a second request inside the retry window must not hit the site");
    ok = true;
    c.advance(SITE_FACTS_RETRY_MS + 1);
    const later = await loadSiteFacts({ fetchImpl: f.impl, now: c.now });
    assert.deepEqual(later, { text: "back again", source: "site" });
  });

  it("falls back when the fetch throws or times out", async () => {
    const f = fakeFetch(() => {
      throw new Error("network down");
    });
    const facts = await loadSiteFacts({ fetchImpl: f.impl, now: clock().now });
    assert.equal(facts.source, "fallback");
  });

  it("falls back on an empty body", async () => {
    const f = fakeFetch(() => new Response("   \n  "));
    const facts = await loadSiteFacts({ fetchImpl: f.impl, now: clock().now });
    assert.equal(facts.source, "fallback");
  });

  it("refuses a response that declares itself enormous", async () => {
    const f = fakeFetch(() => new Response("small", { headers: { "content-length": "999999" } }));
    const facts = await loadSiteFacts({ fetchImpl: f.impl, now: clock().now });
    assert.equal(facts.source, "fallback");
  });

  it("cuts text beyond the cap instead of dropping to the fallback", async () => {
    const f = fakeFetch(() => new Response("é".repeat(SITE_FACTS_MAX_CHARS + 500)));
    const facts = await loadSiteFacts({ fetchImpl: f.impl, now: clock().now });
    assert.equal(facts.source, "site");
    assert.equal(facts.text.length, SITE_FACTS_MAX_CHARS);
  });

  it("shares one fetch between simultaneous callers", async () => {
    const f = fakeFetch(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return new Response("shared");
    });
    const c = clock();
    const [a, b, d] = await Promise.all([
      loadSiteFacts({ fetchImpl: f.impl, now: c.now }),
      loadSiteFacts({ fetchImpl: f.impl, now: c.now }),
      loadSiteFacts({ fetchImpl: f.impl, now: c.now }),
    ]);
    assert.equal(f.calls.length, 1);
    assert.equal(a.text, "shared");
    assert.equal(b.text, "shared");
    assert.equal(d.text, "shared");
  });
});
