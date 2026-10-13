import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isUuid,
  linkMediaKind,
  parseClassResourceInput,
  parseLinkClassResourceInput,
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

  describe("a staff upload's link is built when the shelf is read", () => {
    const LIVE = "https://pub.example.test/library/v.mp4";

    it("serves the Library row's current url, not the one stored when the teacher added it", () => {
      const out = presentClassResource(row, new Set([UUID]), new Map([[UUID, LIVE]]));
      assert.equal(out.url, LIVE);
      assert.equal(out.unavailable, false);
    });

    it("keeps the stored url when no live urls are passed (the two-argument call)", () => {
      assert.equal(presentClassResource(row, new Set([UUID])).url, "https://example.test/v");
    });

    it("keeps the stored url, and the unavailable flag, when the Library row is gone", () => {
      const out = presentClassResource(row, new Set(), new Map([[UUID, LIVE]]));
      assert.equal(out.url, "https://example.test/v");
      assert.equal(out.unavailable, true);
    });

    it("keeps the stored url when the Library row has no url to compute", () => {
      const out = presentClassResource(row, new Set([UUID]), new Map([[UUID, null]]));
      assert.equal(out.url, "https://example.test/v");
      assert.equal(out.unavailable, false);
    });

    it("keeps the stored url when the map holds no entry for this upload", () => {
      const out = presentClassResource(row, new Set([UUID]), new Map([[OTHER_UUID, LIVE]]));
      assert.equal(out.url, "https://example.test/v");
    });

    it("never touches a premade sheet or a book-QR code, even if the map has an entry under their nativeId", () => {
      const sheet = { ...row, librarySource: "premade-sheet", libraryNativeId: "pw-x", url: null };
      const code = {
        ...row,
        librarySource: "book-qr",
        libraryNativeId: "31:http://example.test/a",
        url: "http://example.test/a",
      };
      const live = new Map([
        ["pw-x", LIVE],
        ["31:http://example.test/a", LIVE],
      ]);
      const present = new Set(["pw-x", "31:http://example.test/a"]);
      assert.equal(presentClassResource(sheet, present, live).url, null);
      assert.equal(presentClassResource(code, present, live).url, "http://example.test/a");
    });

    it("leaves every other column as stored", () => {
      const out = presentClassResource(row, new Set([UUID]), new Map([[UUID, LIVE]]));
      assert.equal(out.title, "فيديو");
      assert.equal(out.mediaKind, "video");
      assert.equal(out.thumbnailUrl, null);
    });
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

describe("presentClassResource — lab rows", () => {
  const labRow = (libraryNativeId: string | null) => ({
    id: "11111111-1111-4111-8111-111111111111",
    kind: "lab",
    librarySource: null,
    libraryNativeId,
    title: "القانون الثاني لنيوتن",
    mediaKind: "lab",
    url: null,
    thumbnailUrl: null,
    createdAt: new Date("2026-10-07T08:00:00.000Z"),
  });

  it("is available while the item is in the catalogue", () => {
    const r = presentClassResource(labRow("law-newton-second"), new Set());
    assert.equal(r.unavailable, false);
    assert.equal(r.kind, "lab");
    assert.equal(r.source, null);
    assert.equal(r.nativeId, "law-newton-second");
  });

  it("is unavailable once the item has left the catalogue", () => {
    assert.equal(presentClassResource(labRow("law-removed-later"), new Set()).unavailable, true);
  });

  it("is unavailable with no id at all", () => {
    assert.equal(presentClassResource(labRow(null), new Set()).unavailable, true);
  });

  it("does not change how a library row is judged", () => {
    const uploaded = {
      ...labRow("3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b"),
      kind: "library",
      librarySource: "uploaded",
      mediaKind: "video",
    };
    assert.equal(presentClassResource(uploaded, new Set()).unavailable, true);
    assert.equal(
      presentClassResource(uploaded, new Set(["3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b"])).unavailable,
      false,
    );
  });
});

describe("a teacher-pasted link", () => {
  function okLink(input: unknown) {
    const parsed = parseLinkClassResourceInput(input);
    assert.ok(!("error" in parsed), `expected ok, got ${JSON.stringify(parsed)}`);
    return parsed;
  }
  function badLink(input: unknown): string {
    const parsed = parseLinkClassResourceInput(input);
    assert.ok("error" in parsed, `expected an error, got ${JSON.stringify(parsed)}`);
    return parsed.error;
  }

  it("accepts an https link and trims the title the teacher gave it", () => {
    const parsed = okLink({ kind: "link", url: " https://drive.google.com/file/d/abc/view ", title: "  ورقة الوحدة  " });
    assert.equal(parsed.url, "https://drive.google.com/file/d/abc/view");
    assert.equal(parsed.title, "ورقة الوحدة");
  });

  it("names an untitled link after its site, without a leading www.", () => {
    assert.equal(okLink({ kind: "link", url: "https://www.khanacademy.org/math" }).title, "khanacademy.org");
    assert.equal(okLink({ kind: "link", url: "https://example.test/a", title: "   " }).title, "example.test");
  });

  it("refuses plain http, javascript: and anything that is not a link, so a tap never lands there", () => {
    assert.match(badLink({ kind: "link", url: "http://example.test/a" }), /url/);
    assert.match(badLink({ kind: "link", url: "javascript:alert(1)" }), /url/);
    assert.match(badLink({ kind: "link", url: "not a link" }), /url/);
    assert.match(badLink({ kind: "link" }), /url/);
  });

  it("refuses a link that carries a username or password", () => {
    assert.match(badLink({ kind: "link", url: "https://teacher:secret@example.test/a" }), /url/);
  });

  it("refuses a url longer than 2048 characters rather than clipping it into a dead link", () => {
    assert.match(badLink({ kind: "link", url: `https://example.test/${"a".repeat(2048)}` }), /url/);
  });

  it("refuses an over-long title instead of silently trimming it", () => {
    assert.match(badLink({ kind: "link", url: "https://example.test/a", title: "ا".repeat(201) }), /title/);
  });

  it("refuses a body that is not an object", () => {
    assert.match(badLink(null), /body/);
    assert.match(badLink("https://example.test"), /body/);
  });

  describe("what the link is, judged from the url alone", () => {
    it("calls YouTube and Vimeo video", () => {
      assert.equal(linkMediaKind("https://www.youtube.com/watch?v=jNQXAC9IVRw"), "video");
      assert.equal(linkMediaKind("https://youtu.be/jNQXAC9IVRw"), "video");
      assert.equal(linkMediaKind("https://vimeo.com/76979871"), "video");
      assert.equal(linkMediaKind("https://example.test/clip.mp4"), "video");
    });

    it("calls an image file an image, ignoring the query string", () => {
      assert.equal(linkMediaKind("https://example.test/a/diagram.PNG?w=800"), "image");
    });

    it("calls PDFs and Word files documents, and PowerPoint a presentation", () => {
      assert.equal(linkMediaKind("https://example.test/w.pdf"), "document");
      assert.equal(linkMediaKind("https://example.test/w.docx"), "document");
      assert.equal(linkMediaKind("https://example.test/s.pptx"), "presentation");
    });

    it("falls back to a page, because a Drive or Docs link says nothing about its file", () => {
      assert.equal(linkMediaKind("https://drive.google.com/file/d/abc/view"), "page");
      assert.equal(linkMediaKind("https://example.test/"), "page");
    });

    it("travels with the parsed link, so the route needs no second look", () => {
      assert.equal(okLink({ kind: "link", url: "https://youtu.be/jNQXAC9IVRw" }).mediaKind, "video");
    });

    it("never calls a host video just because its name contains youtube", () => {
      assert.equal(linkMediaKind("https://notyoutube.com/a"), "page");
      assert.equal(linkMediaKind("https://youtube.com.evil.test/a"), "page");
    });
  });
});

describe("presentClassResource — link rows", () => {
  const linkRow = {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "link",
    librarySource: null,
    libraryNativeId: null,
    title: "ورقة الوحدة",
    mediaKind: "page",
    url: "https://drive.google.com/file/d/abc/view",
    thumbnailUrl: null,
    createdAt: new Date("2026-10-13T08:00:00.000Z"),
  };

  it("is never unavailable: the link is the teacher's own and nothing in the app can delete it", () => {
    const r = presentClassResource(linkRow, new Set());
    assert.equal(r.unavailable, false);
    assert.equal(r.kind, "link");
    assert.equal(r.source, null);
    assert.equal(r.nativeId, null);
    assert.equal(r.url, "https://drive.google.com/file/d/abc/view");
  });
});
