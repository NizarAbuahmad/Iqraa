import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTENSION_BY_MIME, kindForMime, parseDataUrl } from "../lessonMediaUpload.ts";

test("parseDataUrl decodes a well-formed data URL", () => {
  const b64 = Buffer.from("hello").toString("base64");
  const parsed = parseDataUrl(`data:image/png;base64,${b64}`);
  assert.ok(parsed);
  assert.equal(parsed!.mime, "image/png");
  assert.equal(parsed!.buffer.toString("utf8"), "hello");
});

test("parseDataUrl rejects anything that isn't a data: URL", () => {
  assert.equal(parseDataUrl("https://example.com/a.png"), null);
  assert.equal(parseDataUrl(""), null);
  assert.equal(parseDataUrl("data:image/png,not-base64-prefixed"), null);
});

test("kindForMime buckets by the mime type's first segment", () => {
  assert.equal(kindForMime("image/jpeg"), "image");
  assert.equal(kindForMime("audio/mpeg"), "audio");
  assert.equal(kindForMime("application/pdf"), "document");
  assert.equal(kindForMime("text/plain"), "document"); // unknown prefixes fall back to document, not thrown
});

test("every EXTENSION_BY_MIME entry starts with a dot", () => {
  for (const ext of Object.values(EXTENSION_BY_MIME)) {
    assert.ok(ext.startsWith("."), `${ext} should start with a dot`);
  }
});
