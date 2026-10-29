import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PLAY_PACKAGE,
  configuredAutoMetrics,
  decodePlayCsv,
  fetchFacebookFollowers,
  fetchInstagramFollowers,
  fetchPlayInstalls,
  metadataToken,
  parseGraphCount,
  parseInstallsCsv,
} from "../autoMetrics.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A report as Play writes it: UTF-16 little-endian with a byte-order mark. */
const utf16 = (text: string) => {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    out[2 + i * 2] = text.charCodeAt(i) & 0xff;
    out[3 + i * 2] = text.charCodeAt(i) >> 8;
  }
  return out;
};

const CSV = "Date,Package Name,Daily Device Installs,Daily User Installs,Current Device Installs\r\n"
  + "2026-10-27,com.x,5,4,10\r\n2026-10-28,com.x,3,2,12\r\n2026-10-29,com.x,0,0,12\r\n";

describe("parseGraphCount", () => {
  it("takes the first field that is a whole number, and Graph sends them as numbers", () => {
    assert.equal(parseGraphCount({ followers_count: 120, fan_count: 99 }, ["followers_count", "fan_count"]), 120);
    assert.equal(parseGraphCount({ fan_count: 99 }, ["followers_count", "fan_count"]), 99);
    assert.equal(parseGraphCount({ followers_count: 0 }, ["followers_count"]), 0);
  });
  it("is null for an error reply, a missing field, or something that is not a count", () => {
    assert.equal(parseGraphCount({ error: { code: 190 } }, ["followers_count"]), null);
    assert.equal(parseGraphCount({}, ["followers_count"]), null);
    assert.equal(parseGraphCount(null, ["followers_count"]), null);
    assert.equal(parseGraphCount({ followers_count: -1 }, ["followers_count"]), null);
    assert.equal(parseGraphCount({ followers_count: "lots" }, ["followers_count"]), null);
    assert.equal(parseGraphCount({ followers_count: 1.5 }, ["followers_count"]), null);
  });
});

describe("Facebook and Instagram", () => {
  it("send the token in a header, never in the URL, and ask for the right field", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
      return json({ followers_count: 321 });
    }) as unknown as typeof fetch;
    assert.equal(await fetchFacebookFollowers("SECRET", "1234", f), 321);
    assert.equal(await fetchInstagramFollowers("SECRET", "5678", f), 321);
    assert.match(seen[0]!.url, /graph\.facebook\.com\/1234\?fields=followers_count,fan_count$/);
    assert.match(seen[1]!.url, /graph\.facebook\.com\/5678\?fields=followers_count$/);
    for (const s of seen) {
      assert.equal(s.auth, "Bearer SECRET");
      assert.ok(!s.url.includes("SECRET"), "the token must not be in the URL");
    }
  });
  it("are null on an HTTP error such as an expired token", async () => {
    const f = (async () => json({ error: { code: 190 } }, 400)) as unknown as typeof fetch;
    assert.equal(await fetchFacebookFollowers("t", "1", f), null);
    assert.equal(await fetchInstagramFollowers("t", "1", f), null);
  });
});

describe("Play install reports", () => {
  it("decodes UTF-16 with a byte-order mark, and plain UTF-8", () => {
    assert.equal(decodePlayCsv(utf16("a,b")), "a,b");
    assert.equal(decodePlayCsv(new TextEncoder().encode("a,b")), "a,b");
  });
  it("sums the Daily User Installs column and ignores the others", () => {
    assert.equal(parseInstallsCsv(CSV), 6);
  });
  it("is null when the column is missing, so a renamed column is not read as zero installs", () => {
    assert.equal(parseInstallsCsv("Date,Package Name\r\n2026-10-27,com.x\r\n"), null);
    assert.equal(parseInstallsCsv(""), null);
  });
  it("copes with quoted cells and blank lines", () => {
    assert.equal(parseInstallsCsv('"Date","Daily User Installs"\r\n"2026-10-27","7"\r\n\r\n"2026-10-28","1"\r\n'), 8);
  });

  const bucket = "pubsite_prod_rev_123";
  const fakeStorage = (files: Record<string, Uint8Array>, listStatus = 200) =>
    (async (url: string, init?: RequestInit) => {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer tok");
      if (url.includes("/o?prefix=")) {
        assert.ok(url.includes(encodeURIComponent(`stats/installs/installs_${PLAY_PACKAGE}_`)));
        return json({ items: Object.keys(files).map(name => ({ name })) }, listStatus);
      }
      const name = decodeURIComponent(url.split("/o/")[1]!.split("?")[0]!);
      const body = files[name];
      return body ? new Response(body) : new Response("nope", { status: 404 });
    }) as unknown as typeof fetch;

  it("adds up every monthly overview file and skips the other report types", async () => {
    const p = (m: string, kind: string) => `stats/installs/installs_${PLAY_PACKAGE}_${m}_${kind}.csv`;
    const files = {
      [p("202609", "overview")]: utf16("Date,Daily User Installs\r\n2026-09-30,10\r\n"),
      [p("202610", "overview")]: utf16(CSV),
      [p("202610", "country")]: utf16("Date,Daily User Installs\r\n2026-10-01,999\r\n"),
    };
    assert.equal(await fetchPlayInstalls(bucket, PLAY_PACKAGE, async () => "tok", fakeStorage(files)), 16);
  });
  it("is null with no token, an unreadable bucket, no report yet, or no usable file", async () => {
    assert.equal(await fetchPlayInstalls(bucket, PLAY_PACKAGE, async () => null, fakeStorage({})), null);
    assert.equal(await fetchPlayInstalls(bucket, PLAY_PACKAGE, async () => "tok", fakeStorage({}, 403)), null);
    assert.equal(await fetchPlayInstalls(bucket, PLAY_PACKAGE, async () => "tok", fakeStorage({})), null);
    const bad = { [`stats/installs/installs_${PLAY_PACKAGE}_202610_overview.csv`]: utf16("Date,Other\r\n1,2\r\n") };
    assert.equal(await fetchPlayInstalls(bucket, PLAY_PACKAGE, async () => "tok", fakeStorage(bad)), null);
  });
});

describe("metadataToken", () => {
  it("reads the token from the metadata server, with its required header", async () => {
    let flavor: string | null = null;
    const f = (async (_u: string, init?: RequestInit) => {
      flavor = new Headers(init?.headers).get("metadata-flavor");
      return json({ access_token: "abc" });
    }) as unknown as typeof fetch;
    assert.equal(await metadataToken(f), "abc");
    assert.equal(flavor, "Google");
  });
  it("is null off Google Cloud, where the host does not exist", async () => {
    const f = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    assert.equal(await metadataToken(f), null);
  });
});

describe("configuredAutoMetrics", () => {
  const keys = (env: Record<string, string>) => configuredAutoMetrics(env).map(m => m.key);
  it("is empty until something is set, so deploying changes nothing", () => {
    assert.deepEqual(keys({}), []);
  });
  it("turns each number on by its own settings", () => {
    assert.deepEqual(keys({ YOUTUBE_API_KEY: "k" }), ["youtube"]);
    assert.deepEqual(keys({ META_ACCESS_TOKEN: "t", META_PAGE_ID: "1" }), ["facebook"]);
    assert.deepEqual(keys({ META_ACCESS_TOKEN: "t", META_IG_USER_ID: "2" }), ["instagram"]);
    assert.deepEqual(keys({ PLAY_STATS_BUCKET: "b" }), ["play_downloads"]);
    assert.deepEqual(
      keys({ YOUTUBE_API_KEY: "k", META_ACCESS_TOKEN: "t", META_PAGE_ID: "1", META_IG_USER_ID: "2", PLAY_STATS_BUCKET: "b" }),
      ["youtube", "facebook", "instagram", "play_downloads"],
    );
  });
  it("needs both halves for Meta: a token with no id, or an id with no token, is off", () => {
    assert.deepEqual(keys({ META_ACCESS_TOKEN: "t" }), []);
    assert.deepEqual(keys({ META_PAGE_ID: "1", META_IG_USER_ID: "2" }), []);
  });
});
