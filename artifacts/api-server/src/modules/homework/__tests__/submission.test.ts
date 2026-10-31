import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOTE_MAX, PHOTO_BYTES_MAX, canSubmit, isLocked, parseNote, parsePhotoUpload, sniffImageMime, submissionStatus,
} from "../submission.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const url = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;

describe("sniffImageMime", () => {
  it("reads the three accepted formats from their first bytes", () => {
    assert.equal(sniffImageMime(JPEG), "image/jpeg");
    assert.equal(sniffImageMime(PNG), "image/png");
    assert.equal(sniffImageMime(WEBP), "image/webp");
  });
  it("refuses anything else, including an empty buffer and a PDF", () => {
    assert.equal(sniffImageMime(Buffer.alloc(0)), null);
    assert.equal(sniffImageMime(Buffer.from("%PDF-1.7")), null);
    assert.equal(sniffImageMime(Buffer.from("RIFF....WAVE")), null);
  });
});

describe("parsePhotoUpload", () => {
  it("accepts each format and gives its extension", () => {
    const j = parsePhotoUpload({ photoDataUrl: url("image/jpeg", JPEG) });
    assert.ok(j.ok);
    assert.equal(j.value.extension, ".jpg");
    assert.equal(j.value.mime, "image/jpeg");
    const p = parsePhotoUpload({ photoDataUrl: url("image/png", PNG) });
    assert.ok(p.ok && p.value.extension === ".png");
    const w = parsePhotoUpload({ photoDataUrl: url("image/webp", WEBP) });
    assert.ok(w.ok && w.value.extension === ".webp");
  });
  it("refuses a missing or non-string field", () => {
    for (const body of [null, {}, { photoDataUrl: "" }, { photoDataUrl: 5 }, "x"]) {
      const r = parsePhotoUpload(body);
      assert.ok(!r.ok);
      assert.equal(r.code, "missing_fields");
    }
  });
  it("refuses text that is not a data URL", () => {
    const r = parsePhotoUpload({ photoDataUrl: "https://example.com/a.jpg" });
    assert.ok(!r.ok);
    assert.equal(r.code, "bad_data_url");
  });
  it("refuses HEIC and other types by name", () => {
    for (const mime of ["image/heic", "image/heif", "application/pdf", "image/gif"]) {
      const r = parsePhotoUpload({ photoDataUrl: url(mime, JPEG) });
      assert.ok(!r.ok, mime);
      assert.equal(r.code, "unsupported_type");
    }
  });
  it("refuses bytes that are not the image they claim to be", () => {
    const r = parsePhotoUpload({ photoDataUrl: url("image/png", JPEG) });
    assert.ok(!r.ok);
    assert.equal(r.code, "bad_image");
    const text = parsePhotoUpload({ photoDataUrl: url("image/jpeg", Buffer.from("not an image at all")) });
    assert.ok(!text.ok && text.code === "bad_image");
  });
  it("refuses a photo over the byte cap", () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(PHOTO_BYTES_MAX)]);
    const r = parsePhotoUpload({ photoDataUrl: url("image/jpeg", big) });
    assert.ok(!r.ok);
    assert.equal(r.code, "file_too_large");
  });
});

describe("parseNote", () => {
  it("trims, and allows an empty note", () => {
    const r = parseNote({ note: "  حل المسألة  " });
    assert.ok(r.ok && r.value === "حل المسألة");
    const empty = parseNote({ note: "" });
    assert.ok(empty.ok && empty.value === "");
  });
  it("refuses a non-string and an over-long note", () => {
    for (const body of [null, {}, { note: 5 }, { note: null }]) {
      const r = parseNote(body);
      assert.ok(!r.ok);
      assert.equal(r.code, "invalid");
    }
    const long = parseNote({ note: "ا".repeat(NOTE_MAX + 1) });
    assert.ok(!long.ok && long.code === "too_long");
    assert.ok(parseNote({ note: "ا".repeat(NOTE_MAX) }).ok);
  });
});

describe("status, lock and can-submit", () => {
  const dueAt = new Date("2026-11-10T20:59:59.999Z");
  const before = new Date("2026-11-10T10:00:00Z");
  const after = new Date("2026-11-11T08:00:00Z");

  it("is none until it is handed in, submitted on time, late after the due day", () => {
    assert.equal(submissionStatus({ submittedAt: null, dueAt }), "none");
    assert.equal(submissionStatus({ submittedAt: before, dueAt }), "submitted");
    assert.equal(submissionStatus({ submittedAt: after, dueAt }), "late");
    // the very last millisecond of the due day is still on time
    assert.equal(submissionStatus({ submittedAt: dueAt, dueAt }), "submitted");
  });
  it("locks a handed-in project once the due day has ended, and never a draft", () => {
    assert.equal(isLocked({ submittedAt: before, dueAt, now: before }), false);
    assert.equal(isLocked({ submittedAt: before, dueAt, now: after }), true);
    assert.equal(isLocked({ submittedAt: null, dueAt, now: after }), false);
  });
  it("needs at least one photo or a non-blank note", () => {
    assert.equal(canSubmit({ photoCount: 0, note: "" }), false);
    assert.equal(canSubmit({ photoCount: 0, note: "   " }), false);
    assert.equal(canSubmit({ photoCount: 1, note: "" }), true);
    assert.equal(canSubmit({ photoCount: 0, note: "ملاحظة" }), true);
  });
});
