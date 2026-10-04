import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isUuid,
  parseClassResourceInput,
  presentClassResource,
  uploadedLibraryIds,
} from "../classResource.ts";

const UUID = "3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b";
const OTHER_UUID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const premade = {
  kind: "library",
  source: "premade-sheet",
  nativeId: "pw-kbl-math-s1-nccd-u1_l1-medium",
  title: "  ورقة عمل: الاقترانات  ",
  mediaKind: "worksheet",
};
const qr = {
  kind: "library",
  source: "book-qr",
  nativeId: "31:http://example.test/a",
  title: "كتاب الرياضيات",
  mediaKind: "video",
  url: "http://example.test/a",
};

function ok(input: unknown) {
  const parsed = parseClassResourceInput(input);
  assert.ok(!("error" in parsed), `expected ok, got ${JSON.stringify(parsed)}`);
  return parsed;
}
function bad(input: unknown): string {
  const parsed = parseClassResourceInput(input);
  assert.ok("error" in parsed, `expected an error, got ${JSON.stringify(parsed)}`);
  return parsed.error;
}

describe("class resource input", () => {
  it("takes a staff upload by id alone and ignores whatever else the app sent", () => {
    const parsed = ok({ kind: "library", source: "uploaded", nativeId: UUID, title: "x", url: "https://evil.test" });
    assert.deepEqual(parsed, { source: "uploaded", nativeId: UUID });
  });

  it("rejects a staff upload whose id is not a uuid", () => {
    assert.match(bad({ kind: "library", source: "uploaded", nativeId: "not-a-uuid" }), /nativeId/);
  });

  it("lowercases an uppercase uuid so the dedupe key is canonical", () => {
    const parsed = ok({ kind: "library", source: "uploaded", nativeId: UUID.toUpperCase() });
    assert.deepEqual(parsed, { source: "uploaded", nativeId: UUID });
  });

  it("accepts a premade sheet, trims its title, and drops any url (it never leaves the app)", () => {
    const parsed = ok({ ...premade, url: "https://example.test/x" });
    assert.ok(parsed.source === "premade-sheet");
    assert.equal(parsed.title, "ورقة عمل: الاقترانات");
    assert.equal(parsed.url, null);
    assert.equal(parsed.thumbnailUrl, null);
  });

  it("accepts a book-QR link over plain http, because some printed codes use it", () => {
    const parsed = ok(qr);
    assert.ok(parsed.source === "book-qr");
    assert.equal(parsed.url, "http://example.test/a");
  });

  it("requires a url for a book-QR code", () => {
    assert.match(bad({ ...qr, url: undefined }), /url/);
  });

  it("refuses a url that is not http(s), so a tap never lands on javascript:", () => {
    assert.match(bad({ ...qr, url: "javascript:alert(1)" }), /url/);
    assert.match(bad({ ...qr, url: "ftp://example.test/a" }), /url/);
  });

  it("refuses a url longer than 2048 characters", () => {
    assert.match(bad({ ...qr, url: `https://example.test/${"a".repeat(2048)}` }), /url/);
  });

  it("only takes an https thumbnail", () => {
    assert.match(bad({ ...premade, thumbnailUrl: "http://example.test/t.jpg" }), /thumbnailUrl/);
    const parsed = ok({ ...premade, thumbnailUrl: "https://example.test/t.jpg" });
    assert.ok(parsed.source === "premade-sheet");
    assert.equal(parsed.thumbnailUrl, "https://example.test/t.jpg");
  });

  it("refuses a media kind outside the Library's categories and 'page'", () => {
    assert.match(bad({ ...premade, mediaKind: "movie" }), /mediaKind/);
    ok({ ...qr, mediaKind: "page" });
  });

  it("refuses an empty or over-long title instead of silently trimming it", () => {
    assert.match(bad({ ...premade, title: "   " }), /title/);
    assert.match(bad({ ...premade, title: "ا".repeat(201) }), /title/);
  });

  it("refuses a kind other than library, an unknown source, and a body that is not an object", () => {
    assert.match(bad({ ...premade, kind: "link" }), /kind/);
    assert.match(bad({ ...premade, source: "dropbox" }), /source/);
    assert.match(bad(null), /body/);
    assert.match(bad("x"), /body/);
  });
});

describe("isUuid", () => {
  it("recognises a uuid and nothing looser", () => {
    assert.equal(isUuid(UUID), true);
    assert.equal(isUuid("3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5"), false);
    assert.equal(isUuid(""), false);
    assert.equal(isUuid(undefined), false);
  });
});

describe("which staff uploads to look up", () => {
  it("returns only the uploaded rows' uuids", () => {
    const ids = uploadedLibraryIds([
      { librarySource: "uploaded", libraryNativeId: UUID },
      { librarySource: "premade-sheet", libraryNativeId: "pw-x" },
      { librarySource: "uploaded", libraryNativeId: "not-a-uuid" },
      { librarySource: "uploaded", libraryNativeId: null },
      { librarySource: "uploaded", libraryNativeId: OTHER_UUID },
    ]);
    assert.deepEqual(ids, [UUID, OTHER_UUID]);
  });
});

describe("shaping a row for the app", () => {
  const row = {
    id: "r1",
    kind: "library",
    librarySource: "uploaded",
    libraryNativeId: UUID,
    title: "فيديو",
    mediaKind: "video",
    url: "https://example.test/v",
    thumbnailUrl: null,
    createdAt: new Date("2026-10-04T10:00:00.000Z"),
  };

  it("flags a staff upload whose library row is gone as unavailable", () => {
    assert.equal(presentClassResource(row, new Set()).unavailable, true);
    assert.equal(presentClassResource(row, new Set([UUID])).unavailable, false);
  });

  it("never flags a premade sheet or a book-QR code — they ship with the app", () => {
    const sheet = { ...row, librarySource: "premade-sheet", libraryNativeId: "pw-x" };
    const code = { ...row, librarySource: "book-qr", libraryNativeId: "31:http://example.test/a" };
    assert.equal(presentClassResource(sheet, new Set()).unavailable, false);
    assert.equal(presentClassResource(code, new Set()).unavailable, false);
  });

  it("renames the columns the way the app reads them and serialises the date", () => {
    assert.deepEqual(presentClassResource(row, new Set([UUID])), {
      id: "r1",
      kind: "library",
      source: "uploaded",
      nativeId: UUID,
      title: "فيديو",
      mediaKind: "video",
      url: "https://example.test/v",
      thumbnailUrl: null,
      createdAt: "2026-10-04T10:00:00.000Z",
      unavailable: false,
    });
  });
});
