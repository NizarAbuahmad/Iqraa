/**
 * Media-library share rules.
 *
 * What these guard is the upload/link split. Both kinds of row reach the same
 * send handler, and picking the wrong branch fails quietly: a message with an
 * attachment key that is null, or a link that arrives as an empty bubble.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/mediaLibrary.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isMediaKind,
  isValidLibraryLink,
  librarySharePayload,
  type ShareableItem,
} from "../mediaLibrary.ts";

const upload: ShareableItem = {
  kind: "image",
  r2Key: "lesson-media/abc.jpg",
  sourceUrl: null,
  caption: "مخطط الدرس",
  mimeType: "image/jpeg",
  sizeBytes: 12345,
};

const link: ShareableItem = {
  kind: "video",
  r2Key: null,
  sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
  caption: "شرح الاشتقاق — قناة الرياضيات",
  mimeType: null,
  sizeBytes: null,
};

describe("isMediaKind", () => {
  it("accepts the four kinds a row may claim", () => {
    for (const k of ["image", "video", "audio", "document"]) {
      assert.equal(isMediaKind(k), true, k);
    }
  });

  it("refuses anything else, including non-strings", () => {
    for (const k of ["", "gif", "IMAGE", null, undefined, 3, {}]) {
      assert.equal(isMediaKind(k), false, String(k));
    }
  });
});

describe("isValidLibraryLink", () => {
  it("accepts https", () => {
    assert.equal(isValidLibraryLink("https://youtu.be/dQw4w9WgXcQ"), true);
    assert.equal(isValidLibraryLink("  https://images.example/x.png  "), true);
  });

  // http is refused rather than upgraded: it loads as mixed content on Expo
  // web, which projects a blank frame instead of failing loudly.
  it("refuses http, other schemes and junk", () => {
    for (const url of [
      "http://example.com/x.png",
      "ftp://example.com/x.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAA",
      "example.com/x.png",
      "",
      "https://",
      "https:// spaced.example/x.png",
    ]) {
      assert.equal(isValidLibraryLink(url), false, url);
    }
  });
});

describe("librarySharePayload", () => {
  it("attaches an upload by reusing its own R2 key — no copy", () => {
    const out = librarySharePayload(upload);
    assert.equal(out?.attachment?.key, "lesson-media/abc.jpg");
    assert.equal(out?.attachment?.kind, "image");
    assert.equal(out?.attachment?.mime, "image/jpeg");
    assert.equal(out?.attachment?.sizeBytes, 12345);
    // The picture speaks for itself; nothing is appended to the body.
    assert.equal(out?.bodyLine, "");
  });

  it("falls back for an upload written before mime/size were recorded", () => {
    const out = librarySharePayload({ ...upload, mimeType: null, sizeBytes: null });
    assert.equal(out?.attachment?.mime, "application/octet-stream");
    assert.equal(out?.attachment?.sizeBytes, 0);
  });

  it("sends a link as text, captioned — there is no object to attach", () => {
    const out = librarySharePayload(link);
    assert.equal(out?.attachment, null);
    assert.equal(out?.bodyLine, "شرح الاشتقاق — قناة الرياضيات\nhttps://youtu.be/dQw4w9WgXcQ");
  });

  it("sends a bare url when the link has no caption", () => {
    const out = librarySharePayload({ ...link, caption: "   " });
    assert.equal(out?.bodyLine, "https://youtu.be/dQw4w9WgXcQ");
  });

  // Refusing beats sending an empty bubble the student cannot act on.
  it("refuses a row that is neither an upload nor a usable link", () => {
    assert.equal(librarySharePayload({ ...link, sourceUrl: null }), null);
    assert.equal(librarySharePayload({ ...link, sourceUrl: "  " }), null);
  });
});
